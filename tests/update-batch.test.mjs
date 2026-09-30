import test from 'node:test'
import assert from 'node:assert/strict'
import {
  prepareUpdateTransaction,
  applyUpdateEntries,
  approvedUpdateEntries,
  authorizeUpdateEntries,
  isUpdateIssueEntry,
  mergeUpdateOutcomes,
  nextUpdateTransactionPhase,
  replaceUpdateEntry,
  reconcileUpdateEntriesWithChecks,
  reconcileUpdateTransaction,
  agentRequestedAppIds,
  UPDATE_CHECK_CONCURRENCY,
  UPDATE_APPLY_CONCURRENCY,
} from '../update-batch.js'

const gate = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
const items = count => Array.from({ length: count }, (_, id) => ({ id: `app-${id}` }))
const prepared = (item, changes = {}) => ({
  item, installedApp: { id: item.id }, preview: { source_digest: `source-${item.id}` },
  capabilityReview: { preview: { capability_digest: `access-${item.id}`, capability_diff: {
    unknown_previous: false, added: [], removed: [], changed: [], ...changes,
  } } },
})

test('six checks and three applications overlap without exceeding either bound', async () => {
  const checkGate = gate(), applyGate = gate(), checksFilled = gate(), appliesFilled = gate()
  let checking = 0, applying = 0, maxChecking = 0, maxApplying = 0
  const progress = []
  const preparing = prepareUpdateTransaction(items(12), {
    prepare: async item => {
      maxChecking = Math.max(maxChecking, ++checking)
      if (checking === UPDATE_CHECK_CONCURRENCY) checksFilled.resolve()
      await checkGate.promise
      checking--
      return prepared(item)
    },
  })
  await checksFilled.promise
  assert.equal(checking, 6)
  assert.equal(applying, 0)
  checkGate.resolve()
  const preparedEntries = (await preparing).entries
  const run = applyUpdateEntries(preparedEntries, {
    apply: async entry => {
      maxApplying = Math.max(maxApplying, ++applying)
      if (applying === UPDATE_APPLY_CONCURRENCY) appliesFilled.resolve()
      await applyGate.promise
      applying--
      return { ok: true, id: entry.item.id }
    },
    onProgress: value => progress.push(value),
  })
  await appliesFilled.promise
  assert.equal(applying, 3)
  assert.equal(progress.at(-1).current, 0, 'started is not completed')
  assert.equal(progress.at(-1).activeIds.length, 3)
  applyGate.resolve()
  const result = await run
  assert.equal(maxChecking, 6)
  assert.equal(maxApplying, 3)
  assert.equal(result.length, 12)
  assert.deepEqual(progress.at(-1), { current: 12, total: 12, activeIds: [] })
})

test('permission changes and unavailable sources stay outside the apply queue; other apps finish', async () => {
  const applied = []
  const transaction = await prepareUpdateTransaction(items(6), {
    prepare: async item => {
      if (item.id === 'app-0') throw new Error('Origin unavailable')
      if (item.id === 'app-1') return prepared(item, { added: ['manage_apps'] })
      if (item.id === 'app-2') return { ...prepared(item), preview: {} }
      return prepared(item)
    },
  })
  const result = await applyUpdateEntries(
    transaction.entries.filter(entry => entry.disposition?.kind === 'ready'), {
    apply: async entry => {
      applied.push(entry.item.id)
      if (entry.item.id === 'app-3') throw new Error('Compile failed')
      if (entry.item.id === 'app-4') return { ok: false, conflict: true }
      return { ok: true }
    },
    },
  )
  assert.deepEqual(applied, ['app-3', 'app-4', 'app-5'])
  assert.equal(transaction.checked[0].error, 'Origin unavailable')
  assert.deepEqual(result.map(entry => entry.outcome), [
    { ok: false, reason: 'error', error: 'Compile failed' },
    { ok: false, conflict: true }, { ok: true },
  ])
})

test('out-of-order completion retains every result and waits for the slow app', async () => {
  const slow = gate(), started = gate()
  let completed = false
  const progress = []
  const { entries } = await prepareUpdateTransaction(items(3), {
    prepare: async item => prepared(item),
  })
  const run = applyUpdateEntries(entries, {
    apply: async entry => {
      if (entry.item.id === 'app-0') { started.resolve(); await slow.promise }
      return { ok: true, id: entry.item.id }
    },
    onProgress: value => progress.push(value),
  }).then(result => { completed = true; return result })
  await started.promise
  // Let immediately resolved workers settle; this test never sleeps on wall time.
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(completed, false)
  assert.deepEqual(progress.at(-1), { current: 2, total: 3, activeIds: ['app-0'] })
  slow.resolve()
  assert.deepEqual((await run).map(entry => entry.outcome.id), ['app-0', 'app-1', 'app-2'])
  assert.deepEqual(progress.at(-1).activeIds, [])
})

test('catalog aliases of one installed app apply only once', async () => {
  const applied = []
  const result = await prepareUpdateTransaction(items(3), {
    prepare: async item => ({ ...prepared(item), installedApp: { id: 42 } }),
  })
  const outcomes = await applyUpdateEntries(result.entries, {
    apply: async entry => { applied.push(entry.item.id); return { ok: true } },
  })
  assert.deepEqual(applied, ['app-0'])
  assert.equal(outcomes.length, 1)
})

test('empty and all-review batches do not apply or publish fake progress', async () => {
  const options = {
    prepare: async item => prepared(item, { unknown_previous: true }),
  }
  assert.deepEqual(await prepareUpdateTransaction([], options), { checked: [], entries: [] })
  const result = await prepareUpdateTransaction(items(2), options)
  assert.equal(result.entries.filter(entry => entry.disposition?.kind === 'ready').length, 0)
  assert.equal(result.checked.length, 2)
})

test('transaction preparation retains every permission diff before any apply', async () => {
  const result = await prepareUpdateTransaction(items(3), {
    prepare: async item => item.id === 'app-1'
      ? prepared(item, { added: ['data.manage_apps'] })
      : prepared(item),
  })
  assert.equal(result.entries.length, 3)
  assert.deepEqual(result.entries.filter(e => e.disposition?.kind === 'ready').map(e => e.item.id), ['app-0', 'app-2'])
  assert.deepEqual(result.entries.filter(e => e.permissionDecision === 'pending').map(e => e.item.id), ['app-1'])
  assert.deepEqual(approvedUpdateEntries(result.entries).map(e => e.item.id), ['app-0', 'app-2'])
})

test('transient checks remain visible for retry instead of reporting false success', () => {
  assert.equal(isUpdateIssueEntry({
    disposition: { kind: 'retry', reason: 'source_unverified' },
    permissionDecision: 'not_required',
    applyState: 'waiting',
  }), true)
  assert.equal(isUpdateIssueEntry({
    disposition: { kind: 'ready' },
    permissionDecision: 'not_required',
    applyState: 'updated',
  }), false)
})

test('a resolved legacy conflict is no longer an issue even if its old disposition remains', () => {
  assert.equal(isUpdateIssueEntry({
    disposition: { kind: 'review', reason: 'conflict' },
    permissionDecision: 'not_required',
    applyState: 'updated',
  }), false)
})

test('retrying one batch entry preserves every sibling issue', () => {
  const original = [
    { item: { id: 'retry-a' }, disposition: { kind: 'retry' } },
    { item: { id: 'retry-b' }, disposition: { kind: 'retry' } },
    { item: { id: 'conflict-c' }, applyState: 'conflict' },
  ]
  const replacement = { item: { id: 'retry-a' }, applyState: 'updated' }
  const next = replaceUpdateEntry(original, replacement)
  assert.equal(next[0], replacement)
  assert.equal(next[1], original[1])
  assert.equal(next[2], original[2])
})

test('applying results changes only the matching transaction entries', () => {
  const original = [
    { item: { id: 'done' }, applyState: 'queued', error: '' },
    { item: { id: 'conflict' }, applyState: 'queued', error: '' },
    { item: { id: 'untouched' }, applyState: 'waiting', error: 'Keep me' },
  ]
  const next = mergeUpdateOutcomes(original, [
    { item: { id: 'done' }, outcome: { ok: true } },
    { item: { id: 'conflict' }, outcome: { ok: false, conflict: true } },
  ])
  assert.equal(next[0].applyState, 'updated')
  assert.equal(next[1].applyState, 'conflict')
  assert.equal(next[2], original[2])
})

test('cancelling transaction preparation stops before any review can publish', async () => {
  const controller = new AbortController()
  let started = 0
  await assert.rejects(
    prepareUpdateTransaction(items(8), {
      signal: controller.signal,
      prepare: async item => {
        started += 1
        if (item.id === 'app-0') controller.abort()
        await Promise.resolve()
        return prepared(item)
      },
    }),
    error => error?.name === 'AbortError',
  )
  assert.ok(started <= 6)
})

test('one transaction authorization approves every reviewed permission update', async () => {
  const { entries } = await prepareUpdateTransaction(items(2), {
    prepare: async item => prepared(item, item.id === 'app-0' ? { added: ['manage_apps'] } : {}),
  })
  assert.deepEqual(approvedUpdateEntries(entries).map(e => e.item.id), ['app-1'])
  const authorized = authorizeUpdateEntries(entries)
  assert.deepEqual(authorized.map(entry => entry.permissionDecision), ['approved', 'not_required'])
  assert.deepEqual(approvedUpdateEntries(authorized).map(e => e.item.id), ['app-0', 'app-1'])
})

test('approved retry excludes automatic entries that already finished', async () => {
  const { entries } = await prepareUpdateTransaction(items(2), {
    prepare: async item => prepared(
      item,
      item.id === 'app-0' ? {} : { added: ['manage_apps'] },
    ),
  })
  const afterAutomatic = entries.map(entry => entry.item.id === 'app-0'
    ? { ...entry, applyState: 'updated' }
    : { ...entry, permissionDecision: 'approved' })
  assert.deepEqual(
    approvedUpdateEntries(afterAutomatic).map(entry => entry.item.id),
    ['app-1'],
  )
})

test('transaction completion retains approved entries until they are applied', () => {
  const approved = {
    ...prepared({ id: 'approved' }),
    disposition: { kind: 'review', reason: 'access_changed' },
    permissionDecision: 'approved',
    applyState: 'waiting',
  }
  const updated = {
    ...prepared({ id: 'updated' }),
    disposition: { kind: 'ready' },
    permissionDecision: 'not_required',
    applyState: 'updated',
  }
  assert.equal(nextUpdateTransactionPhase([approved, updated]), 'permissions')
  assert.equal(nextUpdateTransactionPhase([updated]), null)
  assert.equal(nextUpdateTransactionPhase([
    { ...approved, permissionDecision: 'rejected' },
    updated,
  ]), null)
})

test('authoritative checks retire issues after an external resolver finishes', async () => {
  const { entries } = await prepareUpdateTransaction(items(1), {
    prepare: async item => prepared(item),
  })
  const conflicted = entries.map(entry => ({
    ...entry,
    applyState: 'conflict',
    agentState: 'requested',
  }))
  const reconciled = reconcileUpdateEntriesWithChecks(conflicted, {
    'app-0': { available: false, pendingUpdateState: 'none' },
  })
  assert.equal(reconciled[0].applyState, 'updated')
  assert.equal(reconciled[0].agentState, 'finished')
  assert.deepEqual(reconciled[0].outcome, { ok: true, reconciled: true })
})

test('read-only reconciliation never retires in-flight work', () => {
  const applying = {
    id: 'transaction',
    phase: 'applying',
    entries: [{
      ...prepared({ id: 'app-0' }),
      disposition: { kind: 'ready' },
      applyState: 'queued',
      permissionDecision: 'not_required',
    }],
  }
  const reconciled = reconcileUpdateTransaction(applying, {
    'app-0': { available: false, pendingUpdateState: 'none' },
  })
  assert.equal(reconciled, applying)
})

test('a review waiting on an agent settles once that app has updated', () => {
  const waiting = {
    id: 'transaction',
    phase: 'issues',
    entries: [
      {
        item: { id: 'contribute' }, prepared: { installedApp: { id: 80 } },
        applyState: 'conflict', agentState: 'requested',
        permissionDecision: 'not_required', outcome: { conflict: true },
      },
      {
        item: { id: 'kanban' }, prepared: { installedApp: { id: 118 } },
        applyState: 'conflict', agentState: 'none',
        permissionDecision: 'not_required', outcome: { conflict: true },
      },
    ],
  }
  // Only the app handed to an agent is followed.
  assert.deepEqual(agentRequestedAppIds(waiting), [80])
  assert.deepEqual(agentRequestedAppIds(null), [])

  // Still resolving: nothing changes.
  const pending = reconcileUpdateTransaction(waiting, {
    80: { available: true, pendingUpdateState: 'needs_resolution' },
  })
  assert.equal(pending.entries[0].agentState, 'requested')

  // The agent's update landed: that entry settles, the other still needs attention.
  const settled = reconcileUpdateTransaction(waiting, {
    80: { available: false, pendingUpdateState: 'none' },
  })
  assert.equal(settled.entries[0].applyState, 'updated')
  assert.equal(settled.entries[0].agentState, 'finished')
  assert.equal(settled.phase, 'issues')
  assert.deepEqual(agentRequestedAppIds(settled), [])

  // With nothing else open, the review closes itself.
  assert.equal(reconcileUpdateTransaction(
    { ...waiting, entries: [waiting.entries[0]] },
    { 80: { available: false, pendingUpdateState: 'none' } },
  ), null)
})
