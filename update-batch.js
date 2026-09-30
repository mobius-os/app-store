import { updateBatchDisposition } from './domain.js'

// Git/network checks are cheap; application can compile or restart a service.
// The backend still owns per-repository exclusion and heavy-build admission.
export const UPDATE_CHECK_CONCURRENCY = 6
export const UPDATE_APPLY_CONCURRENCY = 3

// The Store owns the transaction boundary: checking is complete before any
// source is applied. One transaction-level confirmation authorizes every
// verified candidate, including disclosed access changes. Keeping this shape
// here lets single-app and Update-all use the same state machine.
export function updateTransactionEntries(checked = []) {
  return checked.map(entry => ({
    ...entry,
    permissionDecision: entry.disposition?.kind === 'review' &&
      ['access_changed', 'access_unrecorded'].includes(entry.disposition.reason)
      ? 'pending' : 'not_required',
    applyState: entry.disposition?.kind === 'ready' ? 'queued' : 'waiting',
    agentState: 'none',
  }))
}

export function isPermissionUpdateEntry(entry) {
  return entry?.disposition?.kind === 'review' &&
    ['access_changed', 'access_unrecorded'].includes(entry.disposition.reason)
}

export function isUpdateIssueEntry(entry) {
  if (entry?.applyState === 'updated') return false
  return entry?.applyState === 'conflict' || entry?.applyState === 'failed' ||
    entry?.disposition?.kind === 'retry' ||
    entry?.disposition?.kind === 'review' &&
      !isPermissionUpdateEntry(entry) && entry?.permissionDecision !== 'pending'
}

export function replaceUpdateEntry(entries = [], replacement) {
  if (!replacement?.item?.id) return entries
  return entries.map(entry => entry.item?.id === replacement.item.id ? replacement : entry)
}

export function mergeUpdateOutcomes(entries = [], outcomes = []) {
  const byId = new Map(outcomes.map(entry => [entry.item.id, entry.outcome || {}]))
  return entries.map(entry => {
    const outcome = byId.get(entry.item.id)
    return outcome ? {
      ...entry,
      outcome,
      applyState: outcome.ok ? 'updated' : outcome.conflict ? 'conflict' : 'failed',
      error: outcome.error || entry.error || '',
    } : entry
  })
}

export function approvedUpdateEntries(entries = []) {
  return entries.filter(entry => (
    entry.disposition?.kind === 'ready' && entry.applyState === 'queued'
  ) || (
    entry.permissionDecision === 'approved' && entry.applyState === 'waiting'
  ))
}

export function authorizeUpdateEntries(entries = []) {
  return entries.map(entry => entry.permissionDecision === 'pending'
    ? { ...entry, permissionDecision: 'approved' }
    : entry)
}

export function nextUpdateTransactionPhase(entries = []) {
  if (entries.some(entry => entry.permissionDecision === 'pending' || (
    entry.permissionDecision === 'approved' && entry.applyState === 'waiting'
  ))) {
    return 'permissions'
  }
  if (entries.some(isUpdateIssueEntry)) {
    return 'issues'
  }
  return null
}

export function reconcileUpdateEntriesWithChecks(entries = [], checks = {}) {
  return entries.map(entry => {
    const appId = entry.prepared?.installedApp?.id
    const check = appId == null ? null : checks[appId]
    if (!check || check.available !== false || check.pendingUpdateState !== 'none') {
      return entry
    }
    return {
      ...entry,
      applyState: 'updated',
      agentState: entry.agentState === 'requested' ? 'finished' : entry.agentState,
      error: '',
      outcome: { ok: true, reconciled: true },
    }
  })
}

// Apps whose overlap an agent is resolving in its own chat. The Store follows
// only these, so a finished resolver settles the review without a reload.
export function agentRequestedAppIds(transaction) {
  return [...new Set((transaction?.entries || [])
    .filter(entry => entry.agentState === 'requested')
    .map(entry => entry.prepared?.installedApp?.id)
    .filter(id => id != null))]
}

export function reconcileUpdateTransaction(transaction, checks = {}) {
  if (!transaction || transaction.phase === 'checking' || transaction.phase === 'applying') {
    return transaction
  }
  const entries = reconcileUpdateEntriesWithChecks(transaction.entries, checks)
  const phase = nextUpdateTransactionPhase(entries)
  return phase ? { ...transaction, phase, entries } : null
}

export async function mapWithConcurrency(items, limit, mapper) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await mapper(items[index], index)
    }
  }))
  return out
}

// Prepare a transaction without applying anything. This is the required
// boundary for permission review: no candidate can be installed just because
// it appeared in a combined batch.
export async function prepareUpdateTransaction(items, { prepare, signal }) {
  const checked = await mapWithConcurrency(items, UPDATE_CHECK_CONCURRENCY, async item => {
    if (signal?.aborted) throw new DOMException('Update check cancelled', 'AbortError')
    try {
      const prepared = await prepare(item, { signal })
      if (signal?.aborted) throw new DOMException('Update check cancelled', 'AbortError')
      return { item, prepared, disposition: updateBatchDisposition(prepared), error: '' }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      const message = error.message || 'This update could not be checked.'
      return { item, prepared: null, disposition: updateBatchDisposition({ error: message }), error: message }
    }
  })
  const seenApps = new Set()
  const entries = updateTransactionEntries(checked.filter(entry => {
    const key = entry.prepared?.installedApp?.id || entry.item.id
    if (seenApps.has(key)) return false
    seenApps.add(key)
    return true
  }))
  return { checked, entries }
}

export async function applyUpdateEntries(entries, { apply, onProgress = () => {} }) {
  const activeIds = new Set()
  let settled = 0
  const publish = () => onProgress({ current: settled, total: entries.length, activeIds: [...activeIds] })
  const outcomes = await mapWithConcurrency(entries, UPDATE_APPLY_CONCURRENCY, async entry => {
    activeIds.add(entry.item.id)
    publish()
    let outcome
    try {
      outcome = await apply(entry)
    } catch (error) {
      outcome = { ok: false, reason: 'error', error: error.message || 'This update failed.' }
    } finally {
      activeIds.delete(entry.item.id)
      settled += 1
      publish()
    }
    return { ...entry, outcome }
  })
  return outcomes
}
