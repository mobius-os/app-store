import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createUpdateBatch, UPDATE_CHECK_CONCURRENCY, newestBatchSnapshot, normalizeBatchSnapshot,
  failedEntryActions, mapWithConcurrency,
} from '../update-batch.js'
import { responseError, watchUpdateBatch, submitUpdateBatch, loadUpdateCandidatePreview, installApp, batchRoutesMissing, randomUuid } from '../api.js'
import { appLifecycleFor } from '../domain.js'

globalThis.__realCrypto = globalThis.crypto
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const items = count => Array.from({ length: count }, (_, i) => ({ id: i + 1, manifest_url: `https://example.test/${i + 1}/mobius.json` }))
const prepared = item => ({ item, installedApp: { id: item.id }, preview: {
  source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40),
}, capabilityReview: { preview: { capability_digest: 'c'.repeat(64) } } })
const snapshot = (id, statuses, phase = 'complete') => ({ id, phase, entries: statuses.map((status, i) => ({
  app_id: i + 1, name: `App ${i + 1}`, status, error: status === 'failed' ? 'Build failed' : '',
  error_code: status === 'failed' ? 'invalid_package' : null, retryable: false, warnings: [], version: null, resolver_chat_id: null,
})) })
const httpError = (status, detail) => responseError(status, JSON.stringify({ detail }))
function harness(options = {}, entries = []) {
  const submitted = [], resolved = [], changes = []
  const batch = createUpdateBatch({
    prepare: async item => prepared(item),
    submit: async payload => { submitted.push(payload); return snapshot(payload.id, payload.updates.map(() => 'updated')) },
    read: async id => snapshot(id, ['updated']), watch: async () => {},
    resolve: async ids => { resolved.push(ids); return { chat_id: 'chat' } },
    refresh: async () => true, onChange: state => changes.push(state), newId: () => 'key-1', reconnectMs: 1, ...options,
  }, entries)
  return { batch, submitted, resolved, changes }
}
const status = batch => batch.state.entries.map(entry => entry.status)
const tick = () => new Promise(resolve => setImmediate(resolve))

test('the Store has one bounded mapWithConcurrency, preserving order', async () => {
  let running = 0, peak = 0
  const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async value => {
    running++; peak = Math.max(peak, running)
    await new Promise(resolve => setTimeout(resolve, value))
    running--
    return value * 10
  })
  assert.deepEqual(out, [50, 10, 40, 20, 30])
  assert.equal(peak, 2)
  const { readFile } = await import('node:fs/promises')
  const index = await readFile(new URL('../index.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(index, /function mapWithConcurrency/, 'index.jsx imports the shared helper')
})

test('snapshots from an older platform normalize without error_code, retryable or queued', () => {
  const old = normalizeBatchSnapshot({ id: 'b', phase: 'applying', entries: [
    { app_id: 1, name: 'One', status: 'pending', error: '' },
    { app_id: '2', name: 'Two', status: 'running' },
    { app_id: 3, name: 'Three', status: 'failed' },
    { app_id: 4, name: 'Four', status: 'mystery' },
    { name: 'no id' },
  ] })
  assert.deepEqual(old.entries.map(entry => entry.status), ['queued', 'applying', 'failed', 'applying'])
  assert.deepEqual(old.entries.map(entry => entry.app_id), [1, 2, 3, 4])
  assert.equal(old.entries[2].retryable, null, 'unknown, not permanent')
  assert.equal(old.entries[2].error_code, null)
  assert.match(old.entries[2].error, /could not be completed/)
  const done = normalizeBatchSnapshot({ id: 'b', phase: 'complete', entries: [{ app_id: 1, status: 'applying' }] })
  assert.equal(done.entries[0].status, 'failed', 'a complete batch has nothing running')
  assert.equal(normalizeBatchSnapshot({ phase: 'complete' }), null)
  assert.equal(normalizeBatchSnapshot(null), null)
})

test('failed entries choose Try again or Ask agent from the server answer', () => {
  const failed = extra => ({ status: 'failed', ...extra })
  assert.deepEqual(failedEntryActions(failed({ retryable: true })), { retry: true, askAgent: false })
  assert.deepEqual(failedEntryActions(failed({ retryable: false, errorCode: 'invalid_package' })), { retry: false, askAgent: true })
  assert.deepEqual(failedEntryActions(failed({ retryable: null })), { retry: true, askAgent: true })
  assert.deepEqual(failedEntryActions(failed({ retryable: false, errorCode: 'update_not_applied' })), { retry: true, askAgent: false })
  assert.deepEqual(failedEntryActions(failed({ retryable: false, errorCode: 'update_changed' })), { retry: true, askAgent: false })
  assert.deepEqual(failedEntryActions({ status: 'updated' }), { retry: false, askAgent: false })
})

test('late snapshots cannot restore applying or stale resolver state', () => {
  const { batch } = harness()
  const fresh = { ...snapshot('batch', ['updated']), updated_at: '2026-10-09T12:00:00.000002+00:00' }
  const stale = { ...snapshot('batch', ['applying'], 'applying'), updated_at: '2026-10-09T12:00:00.000001+00:00' }
  batch.recover(fresh)
  batch.recover(stale)
  assert.deepEqual(status(batch), ['updated'])
  assert.equal(batch.state.phase, 'review')
  assert.equal(newestBatchSnapshot(fresh, stale), fresh)
  batch.dispose()
})

test('checks finish before one exact reviewed submit; no check or retry mutates', async () => {
  const { batch, submitted } = harness({ prepare: async item => {
    if (item.id === 3) throw Object.assign(new Error('Unavailable'), { status: 502, retryable: true })
    return prepared(item)
  } })
  await batch.check(items(3))
  assert.deepEqual(status(batch), ['ready', 'ready', 'failed'])
  assert.equal(batch.state.entries[2].retryable, true)
  assert.equal(submitted.length, 0)
  await batch.confirm()
  assert.equal(submitted.length, 1)
  assert.deepEqual(submitted[0], { id: 'key-1', updates: [1, 2].map(app_id => ({
    app_id, manifest_url: `https://example.test/${app_id}/mobius.json`,
    upstream_commit: 'b'.repeat(40), source_digest: 'a'.repeat(64), capability_digest: 'c'.repeat(64),
  })) })
  await batch.confirm()
  assert.equal(submitted.length, 1, 'a completed approval cannot replay')
  await batch.retry(3)
  assert.equal(submitted.length, 1)
})

test('check failures keep the server code and retryability; a lost answer is retryable', async () => {
  const rejected = httpError(409, { code: 'identity_mismatch', message: 'Not this app.' })
  const { batch } = harness({ prepare: async item => {
    if (item.id === 1) throw rejected
    if (item.id === 2) throw new TypeError('Failed to fetch')
    return { ...prepared(item), preview: { ...prepared(item).preview, pending_update_state: 'needs_resolution' } }
  } })
  await batch.check(items(3))
  const [one, two, three] = batch.state.entries
  assert.deepEqual([one.status, one.error, one.errorCode, one.retryable], ['failed', 'Not this app.', 'identity_mismatch', false])
  assert.deepEqual([two.status, two.retryable], ['failed', true])
  assert.equal(three.status, 'conflict', 'an unresolved merge is resolved, never confirmed again')
  await batch.confirm()
  assert.equal(batch.state.phase, 'review', 'nothing was ready to submit')
})

test('all verified apps enter one server-owned batch, never browser apply workers', async () => {
  const slow = gate(), submitted = []
  const { batch } = harness({ submit: async payload => {
    submitted.push(payload); await slow.promise
    return snapshot(payload.id, ['queued', 'applying', 'queued'], 'applying')
  }, read: async id => snapshot(id, ['queued', 'applying', 'queued'], 'applying'), watch: async () => {} })
  await batch.check(items(3))
  const confirming = batch.confirm()
  await batch.confirm()
  assert.equal(submitted.length, 1)
  assert.equal(batch.state.phase, 'submitting')
  slow.resolve(); await confirming
  assert.deepEqual(status(batch), ['queued', 'applying', 'queued'])
  batch.dispose()
})

test('progress follows the stream after a fresh read, and reconnects when it drops', async () => {
  const reads = [], streams = []
  let finish
  const { batch } = harness({
    submit: async payload => snapshot(payload.id, ['queued', 'queued'], 'applying'),
    read: async id => { reads.push(id); return snapshot(id, reads.length === 1 ? ['queued', 'queued'] : ['updated', 'applying'], 'applying') },
    watch: async (id, onSnapshot) => {
      streams.push(id)
      if (streams.length === 1) {
        onSnapshot(snapshot(id, ['applying', 'queued'], 'applying'))
        throw new Error('network dropped')
      }
      await new Promise(resolve => { finish = () => { onSnapshot(snapshot(id, ['updated', 'failed'])); resolve() } })
    },
  })
  await batch.check(items(2)); await batch.confirm()
  for (let i = 0; i < 20 && !finish; i++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.ok(finish, 'a second stream was opened')
  assert.equal(streams.length, 2)
  assert.ok(reads.length >= 2, 'each attempt re-reads first')
  assert.deepEqual(status(batch), ['updated', 'applying'])
  finish(); await tick()
  assert.deepEqual(status(batch), ['updated', 'failed'])
  assert.equal(batch.state.phase, 'review')
  assert.equal(batch.state.error, '')
})

test('recover reads progress, preserves per-app outcomes and does not submit or launch agents', async () => {
  const { batch, submitted, resolved } = harness({ read: async id => snapshot(id, ['updated', 'conflict', 'failed']) })
  batch.recover(snapshot('old-id', ['queued', 'applying', 'queued'], 'applying'))
  await tick()
  assert.deepEqual(status(batch), ['updated', 'conflict', 'failed'])
  assert.equal(batch.state.phase, 'review')
  assert.equal(submitted.length, 0)
  assert.equal(resolved.length, 0)
  assert.match(batch.state.entries[2].error, /Build failed/)
  assert.equal(batch.state.entries[2].errorCode, 'invalid_package')
})

test('Resolve is per app; Resolve all selects only unresolved conflicts', async () => {
  const { batch, resolved } = harness({}, items(3).map(item => ({ item, prepared: prepared(item), status: 'conflict' })))
  await batch.resolveOne(2)
  assert.deepEqual(resolved, [[2]])
  await batch.resolveAll()
  assert.deepEqual(resolved, [[2], [1, 3]])
  await batch.resolveAll()
  assert.equal(resolved.length, 2)
})

test('a running resolver binds only the apps the server names', async () => {
  const { batch } = harness({ resolve: async () => ({ chat_id: 'existing-chat', app_ids: [2], started: false, existing: true }) },
    items(2).map(item => ({ item, prepared: prepared(item), status: 'conflict' })))
  await batch.resolveAll()
  assert.equal(batch.state.entries[0].resolver, undefined)
  assert.match(batch.state.entries[0].error, /another app/)
  assert.equal(batch.state.entries[1].resolver.chat_id, 'existing-chat')
})

test('checks are bounded and can be cancelled without late consent', async () => {
  const pending = gate(), signals = []
  const { batch, submitted } = harness({ prepare: async (item, { signal }) => {
    signals.push(signal); await pending.promise; return prepared(item)
  } })
  const checking = batch.check(items(9))
  batch.dispose()
  assert.equal(signals.length, UPDATE_CHECK_CONCURRENCY)
  assert.ok(signals.every(signal => signal.aborted))
  pending.resolve(); await checking; await batch.confirm()
  assert.equal(submitted.length, 0)
})

test('aliases submit only once and reconciliation cannot mark pending conflicts updated', async () => {
  const { batch, submitted } = harness({ prepare: async item => ({ ...prepared(item), installedApp: { id: item.id === 2 ? 1 : item.id } }) })
  await batch.check(items(2)); await batch.confirm()
  assert.equal(submitted[0].updates.length, 1)
  const other = harness({}, items(3).map(item => ({ item, prepared: prepared(item), status: 'conflict' }))).batch
  other.reconcile({ 1: { available: false, pendingUpdateState: 'none' }, 2: { available: false, pendingUpdateState: 'needs_resolution' } })
  assert.deepEqual(status(other), ['updated', 'conflict', 'conflict'])
})

test('a lost POST answer resends the same id; it never becomes a fresh batch', async () => {
  const ids = []
  let attempts = 0
  const { batch } = harness({
    newId: () => `key-${++attempts}`,
    submit: async payload => { ids.push(payload.id); if (ids.length === 1) throw new TypeError('Failed to fetch'); return snapshot(payload.id, ['updated']) },
    read: async () => { throw httpError(404, 'App update batch not found.') },
  })
  await batch.check(items(1))
  await batch.confirm()
  assert.equal(batch.state.phase, 'review')
  assert.match(batch.state.error, /same request/)
  await batch.check(items(1))
  assert.equal(batch.state.batchId, 'key-1', 'checking cannot discard uncertain consent')
  await batch.confirm()
  assert.deepEqual(ids, ['key-1', 'key-1'])
  assert.equal(attempts, 1)
})

test('a lost POST answer recovers the batch the server did accept', async () => {
  const { batch } = harness({
    submit: async () => { throw new TypeError('Failed to fetch') },
    read: async id => snapshot(id, ['updated']),
  })
  await batch.check(items(1)); await batch.confirm()
  assert.equal(batch.state.batchId, 'key-1')
  assert.deepEqual(status(batch), ['updated'])
  assert.equal(batch.state.error, '')
})

test('an app already updating elsewhere points at the batch that owns it', async () => {
  const { batch } = harness({ submit: async () => { throw httpError(409, {
    code: 'app_update_running', batch_id: 'other-batch', message: 'An update for this app is already running. Open its progress.',
  }) } })
  await batch.check(items(1)); await batch.confirm()
  assert.equal(batch.state.phase, 'review')
  assert.equal(batch.state.runningBatchId, 'other-batch')
  assert.equal(batch.state.batchId, null, 'nothing was accepted under this id')
  assert.match(batch.state.error, /already running/)
  assert.deepEqual(status(batch), ['ready'], 'the review stays for a later confirmation')
})

test('a definite refusal is reported once and releases its id', async () => {
  const refused = []
  const { batch } = harness({ onRefused: id => refused.push(id), submit: async () => { throw httpError(503, 'App updates are unavailable while the server restarts.') } })
  await batch.check(items(1)); await batch.confirm()
  assert.match(batch.state.error, /server restarts/)
  assert.equal(batch.state.batchId, null)
  assert.deepEqual(refused, ['key-1'], 'the app can drop any placeholder for this id')
  const running = harness({ onRefused: id => refused.push(id), newId: () => 'key-2', submit: async () => { throw httpError(409, { code: 'app_update_running', batch_id: 'b', message: 'Already running.' }) } }).batch
  await running.check(items(1)); await running.confirm()
  assert.deepEqual(refused, ['key-1', 'key-2'])
})

test('a gateway error on submit is uncertain: the id is kept and re-read', async () => {
  const reads = [], refused = []
  const { batch } = harness({
    onRefused: id => refused.push(id),
    submit: async () => { throw httpError(504, 'Gateway Timeout') },
    read: async id => { reads.push(id); return snapshot(id, ['updated']) },
  })
  await batch.check(items(1)); await batch.confirm()
  assert.deepEqual(reads, ['key-1'])
  assert.deepEqual(refused, [])
  assert.equal(batch.state.batchId, 'key-1')
  assert.deepEqual(status(batch), ['updated'])
})

test('without server batches each reviewed update is applied in turn through the fallback', async () => {
  const applied = [], refreshed = []
  let concurrent = 0, peak = 0
  const { batch, changes } = harness({
    batchesMissing: error => batchRoutesMissing(error),
    submit: async () => { throw httpError(404, 'Not Found') },
    refresh: async () => { refreshed.push(true); return true },
    applyOne: async entry => {
      concurrent++; peak = Math.max(peak, concurrent)
      applied.push(entry.prepared.installedApp.id)
      await tick()
      concurrent--
      const id = entry.prepared.installedApp.id
      if (id === 2) return { status: 'conflict' }
      if (id === 3) throw Object.assign(new Error('Source unreachable.'), { status: 409, code: 'git_update_unavailable', retryable: true })
      return { status: 'updated', version: '2.0.0' }
    },
  })
  await batch.check(items(3)); await batch.confirm()
  assert.deepEqual(applied, [1, 2, 3])
  assert.equal(peak, 1, 'one app at a time, as before server batches')
  assert.ok(changes.some(state => state.phase === 'applying' && state.local), 'the dialog knows the Store must stay open')
  assert.deepEqual(status(batch), ['updated', 'conflict', 'failed'])
  assert.deepEqual([batch.state.entries[2].errorCode, batch.state.entries[2].retryable], ['git_update_unavailable', true])
  assert.equal(batch.state.phase, 'review')
  assert.equal(batch.state.applied, true)
  assert.equal(batch.state.error, '')
  assert.equal(refreshed.length, 1)
})

test('failed checks keep one entry each, even with string catalog ids', async () => {
  const ids = ['voice', 'maps', 'notes', 'tasks']
  const { batch } = harness({ prepare: async item => {
    if (item.id !== 'tasks') throw new Error(`${item.id} check failed`)
    return { ...prepared(item), installedApp: { id: 40 } }
  } })
  await batch.check(ids.map(id => ({ id, manifest_url: `https://example.test/${id}/mobius.json` })))
  assert.deepEqual(status(batch), ['failed', 'failed', 'failed', 'ready'])
  assert.deepEqual(batch.state.entries.map(entry => entry.error || entry.item.id), ['voice check failed', 'maps check failed', 'notes check failed', 'tasks'])
  // Trying one again keeps its siblings.
  await batch.retry('maps')
  assert.equal(batch.state.entries.length, 4)
})

test('a finished batch refreshes the app list once, not on every re-read', async () => {
  let refreshes = 0
  const { batch } = harness({ refresh: async () => { refreshes++; return true } })
  await batch.check(items(1)); await batch.confirm()
  assert.equal(refreshes, 1)
  await batch.refreshSnapshot(); await batch.refreshSnapshot()
  await tick()
  assert.equal(refreshes, 1)
  const recovered = harness({ refresh: async () => { refreshes++; return true } }).batch
  recovered.recover(snapshot('old', ['updated']))
  await tick()
  assert.equal(refreshes, 1, 'opening old results changes nothing')
})

test('a reused resolver chat keeps the server\'s reason', async () => {
  const message = 'Another chat is still resolving an earlier update of App 1; open or stop it there.'
  const { batch } = harness({ resolve: async () => ({ chat_id: 'old', app_ids: [1], existing: true, message }) },
    [{ item: items(1)[0], prepared: prepared(items(1)[0]), status: 'conflict' }])
  await batch.resolveAll()
  assert.equal(batch.state.entries[0].resolver.message, message)
})

test('authoritative snapshot clears a stale resolver binding and reconnect error', async () => {
  const { batch, submitted } = harness({}, [{ item: items(1)[0], prepared: prepared(items(1)[0]), status: 'conflict', resolver: { chat_id: 'old-chat' } }])
  batch.recover({ ...snapshot('batch-1', ['conflict']), entries: [{ app_id: 1, name: 'App 1', status: 'conflict', error: '', warnings: ['Review local edits'], version: null, resolver_chat_id: null }] })
  assert.equal(batch.state.entries[0].resolver, null)
  assert.deepEqual(batch.state.entries[0].warnings, ['Review local edits'])
  assert.equal(batch.state.error, '')
  await batch.confirm()
  assert.equal(submitted.length, 0, 'recovering a batch cannot replay approved writes')
})

test('responseError keeps the code and marks transient answers retryable', () => {
  const structured = httpError(409, { code: 'git_transfer_timeout', message: 'The Git transfer timed out.', retryable: true })
  assert.deepEqual([structured.message, structured.status, structured.code, structured.retryable], ['The Git transfer timed out.', 409, 'git_transfer_timeout', true])
  const permanent = httpError(409, { code: 'repository_moved', message: 'Moved.' })
  assert.equal(permanent.retryable, false)
  assert.equal(httpError(503, 'Restarting').retryable, true)
  assert.equal(httpError(422, 'Incomplete review').retryable, false)
  const plain = responseError(502, 'Bad gateway')
  assert.deepEqual([plain.message, plain.retryable], ['Bad gateway', true])
})

test('install and preview failures carry the structured detail', async () => {
  const oldFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: { code: 'git_update_unavailable', message: 'Source unreachable.', retryable: true } }), { status: 409 })
    await assert.rejects(installApp({ manifest_url: 'https://example.test/mobius.json', token: 't', reviewed_capability_digest: 'c'.repeat(64) }),
      error => error.message === 'Source unreachable.' && error.retryable === true && error.code === 'git_update_unavailable')
    globalThis.fetch = async (url, init) => {
      assert.ok(init.signal, 'the review can be cancelled')
      return new Response(JSON.stringify({ detail: { code: 'identity_mismatch', message: 'Not this app.' } }), { status: 409 })
    }
    await assert.rejects(loadUpdateCandidatePreview(7, '', 't', { signal: new AbortController().signal }),
      error => error.status === 409 && error.code === 'identity_mismatch' && error.retryable === false)
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: { code: 'app_update_running', batch_id: 'b-1', message: 'Already running.' } }), { status: 409 })
    await assert.rejects(submitUpdateBatch({ id: 'x', updates: [] }, 't'),
      error => error.code === 'app_update_running' && error.detail.batch_id === 'b-1')
  } finally { globalThis.fetch = oldFetch }
})

test('the event stream parser handles keepalives, split frames, CRLF and ends at complete', async () => {
  const oldFetch = globalThis.fetch
  const encoder = new TextEncoder()
  const chunks = [
    ': keepalive\n\n',
    'data: {"id":"b","phase":"applying","entr',
    'ies":[]}\r\n\r\n',
    'data: {"id":"b","phase":"complete","entries":[]}\n\n',
    'data: {"id":"b","phase":"after"}\n\n',
  ]
  let cancelled = false
  let requested
  globalThis.fetch = async (url, init) => {
    requested = { url, init }
    return new Response(new ReadableStream({
      pull(controller) { const next = chunks.shift(); if (next) controller.enqueue(encoder.encode(next)); else controller.close() },
      cancel() { cancelled = true },
    }), { headers: { 'content-type': 'text/event-stream' } })
  }
  try {
    const seen = []
    await watchUpdateBatch('b', 'tok', snapshot => seen.push(snapshot.phase))
    assert.deepEqual(seen, ['applying', 'complete'])
    assert.equal(requested.url, '/api/apps/update-batches/b/events')
    assert.equal(requested.init.headers.Accept, 'text/event-stream')
    assert.ok(cancelled, 'the stream is released after the final snapshot')
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'App update progress is unavailable while the server restarts.' }), { status: 503 })
    await assert.rejects(watchUpdateBatch('b', 'tok', () => {}), error => error.status === 503 && /restarts/.test(error.message))
  } finally { globalThis.fetch = oldFetch }
})

test('a rejected candidate shows its reason instead of a silent Open', () => {
  const item = { id: 'voice', manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json', manifest: { id: 'voice', name: 'Voice', version: '2.0.0' } }
  const installed = [{ id: 11, slug: 'voice', name: 'Voice', manifest_url: item.manifest_url, source_manifest: { id: 'voice', url: item.manifest_url } }]
  const moved = appLifecycleFor(item, { installed, updateChecks: { 11: { available: null, candidateRejected: { code: 'repository_moved', message: 'Moved to another repository.' } } } })
  assert.deepEqual([moved.key, moved.statusLabel, moved.statusDetail, moved.actionKind], ['rejected', 'Repository moved', 'Moved to another repository.', 'open'])
  const other = appLifecycleFor(item, { installed, updateChecks: { 11: { available: null, candidateRejected: { code: 'future_code', message: 'Not this app.' } } } })
  assert.deepEqual([other.key, other.statusLabel], ['rejected', 'Update not offered'], 'unknown codes read the same way')
  const unknown = appLifecycleFor(item, { installed, updateChecks: { 11: { available: null, candidateRejected: null } } })
  assert.equal(unknown.key, 'unverified')
})

test('only a missing-route answer means a Möbius without batches', () => {
  assert.equal(batchRoutesMissing(httpError(404, 'Not Found')), true)
  assert.equal(batchRoutesMissing(httpError(405, 'Method Not Allowed')), true)
  // An older GET /api/apps/{app_id} reads "update-batches" as an app id.
  assert.equal(batchRoutesMissing(httpError(422, [{ type: 'int_parsing', loc: ['path', 'app_id'], msg: 'Input should be a valid integer' }])), true)
  assert.equal(batchRoutesMissing(httpError(404, 'App not found.')), false, 'a real answer from the batch route')
  assert.equal(batchRoutesMissing(httpError(422, [{ loc: ['body', 'updates', 0, 'source_digest'], msg: 'Field required' }])), false)
  assert.equal(batchRoutesMissing(httpError(503, 'Restarting')), false)
  assert.equal(batchRoutesMissing(new TypeError('Failed to fetch')), false)
})

test('an app removed after its check is an ordinary error, never the per-app fallback', async () => {
  const applied = []
  const { batch } = harness({
    batchesMissing: error => batchRoutesMissing(error),
    applyOne: async entry => { applied.push(entry); return { status: 'updated' } },
    submit: async () => { throw httpError(404, 'App not found.') },
  })
  await batch.check(items(2)); await batch.confirm()
  assert.equal(applied.length, 0)
  assert.match(batch.state.error, /App not found/)
  assert.deepEqual(status(batch), ['ready', 'ready'])
})

test('when batch routes are already known missing, confirm goes straight to the fallback', async () => {
  const applied = []
  const { batch, submitted, changes } = harness({
    batchesMissing: error => error === undefined,
    applyOne: async entry => { applied.push(entry.prepared.installedApp.id); return { status: 'updated' } },
  })
  await batch.check(items(2)); await batch.confirm()
  assert.deepEqual(submitted, [], 'nothing is posted to a route known to be missing')
  assert.deepEqual(applied, [1, 2])
  assert.equal(changes.some(state => state.phase === 'submitting'), false, 'no "Starting" phase to close during')
  assert.deepEqual(status(batch), ['updated', 'updated'])
})

test('a lost submission the server never saw is released on a later read', async () => {
  const refused = []
  const { batch } = harness({
    onRefused: id => refused.push(id),
    submit: async () => { throw new TypeError('Failed to fetch') },
    read: async () => { throw httpError(404, 'App update batch not found.') },
  })
  await batch.check(items(1)); await batch.confirm()
  assert.equal(batch.uncertain, true)
  assert.equal(batch.state.batchId, 'key-1')
  await batch.check(items(1))
  assert.match(batch.state.error, /may already be running/, 'Try again says why it waits')
  await batch.refreshSnapshot()
  assert.equal(batch.uncertain, false)
  assert.equal(batch.state.batchId, null)
  assert.deepEqual(refused, ['key-1'])
  await batch.check(items(1))
  assert.deepEqual(status(batch), ['ready'], 'a new review can start')
})

test('batch ids are UUIDs even without crypto.randomUUID (plain HTTP)', () => {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  assert.match(randomUuid(), pattern)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  try {
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: bytes => globalThis.__realCrypto.getRandomValues(bytes) }, configurable: true })
    assert.match(randomUuid(), pattern)
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    const ids = new Set(Array.from({ length: 50 }, () => randomUuid()))
    assert.equal(ids.size, 50)
    for (const id of ids) assert.match(id, pattern)
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor) }
})
