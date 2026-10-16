// Reviewed "Update all" runs on the server. The Store checks every candidate,
// the owner confirms one exact set of reviewed commits, and the platform's
// update-batch owner applies them (POST /api/apps/update-batches). Closing the
// Store never cancels accepted work; reopening reads its durable progress.

// Candidate checks are read-only and may overlap.
export const UPDATE_CHECK_CONCURRENCY = 6

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

const ENTRY_STATUSES = new Set(['queued', 'applying', 'updated', 'conflict', 'failed'])
// A platform that predates the real `queued` state reported waiting entries
// under other names; read them as the state they describe.
const LEGACY_STATUSES = { pending: 'queued', waiting: 'queued', running: 'applying', installing: 'applying' }
export const ACTIVE_ENTRY_STATUSES = ['queued', 'applying']
export const FINISHED_ENTRY_STATUSES = ['updated', 'conflict', 'failed']

// Failures that a fresh review can get past: the server refused the reviewed
// release (it changed, or never ran), not the app itself.
const REVIEW_AGAIN_CODES = new Set(['update_not_applied', 'update_changed', 'capability_changed'])

const NOT_UPDATED = 'This update could not be completed.'

// One shape for every snapshot, whichever platform produced it. Missing
// `error_code` and `retryable` read as unknown (null), never as permanent.
export function normalizeBatchSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null
  const complete = raw.phase === 'complete'
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap(row => {
    const appId = Number(row?.app_id)
    if (!Number.isFinite(appId)) return []
    let status = LEGACY_STATUSES[row.status] || row.status
    if (!ENTRY_STATUSES.has(status)) status = complete ? 'failed' : 'applying'
    // A complete batch has no running work, whatever an old row still says.
    if (complete && ACTIVE_ENTRY_STATUSES.includes(status)) status = 'failed'
    const error = typeof row.error === 'string' ? row.error : ''
    return [{
      app_id: appId,
      name: typeof row.name === 'string' ? row.name : '',
      status,
      version: row.version || null,
      error: status === 'failed' ? error || NOT_UPDATED : status === 'updated' ? '' : error,
      error_code: typeof row.error_code === 'string' && row.error_code ? row.error_code : null,
      retryable: typeof row.retryable === 'boolean' ? row.retryable : null,
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
      resolver_chat_id: row.resolver_chat_id || null,
      duration_ms: Number.isFinite(row.duration_ms) ? row.duration_ms : null,
    }]
  })
  return {
    id: raw.id,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    phase: complete ? 'complete' : 'applying',
    entries,
  }
}

export function newestBatchSnapshot(current, incoming) {
  return current?.id === incoming?.id && current.updated_at && incoming.updated_at
    && current.updated_at > incoming.updated_at ? current : incoming
}

export function updateBatchBusy(review) {
  return review?.phase === 'applying' || review?.phase === 'submitting'
}

// "Try again" re-checks a failed app (read-only) so the owner can confirm it
// again. A permanent failure gets "Ask agent" instead. An older platform that
// does not say which applies (retryable null) offers both.
export function failedEntryActions(entry) {
  if (entry?.status !== 'failed') return { retry: false, askAgent: false }
  const reviewAgain = REVIEW_AGAIN_CODES.has(entry.errorCode)
  return {
    retry: entry.retryable !== false || reviewAgain,
    askAgent: entry.retryable !== true && !reviewAgain,
  }
}

export function batchProgress(entries = []) {
  return {
    finished: entries.filter(entry => FINISHED_ENTRY_STATUSES.includes(entry.status)).length,
    active: entries.filter(entry => ACTIVE_ENTRY_STATUSES.includes(entry.status)).length,
    total: entries.length,
  }
}

function errorFields(error, fallback) {
  return {
    error: error?.message || fallback,
    errorCode: typeof error?.code === 'string' ? error.code : null,
    // No HTTP status means the request never got an answer: a network
    // failure is worth trying again.
    retryable: typeof error?.retryable === 'boolean' ? error.retryable : !error?.status,
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Statuses a gateway in front of the platform may answer while the platform
// itself did accept the batch: the outcome stays uncertain.
const GATEWAY_STATUSES = new Set([502, 504])

// One controller owns review, submission, recovered snapshots and explicit
// resolver actions. Browser teardown never cancels server-owned update work.
// `applyOne` is the fallback for a Möbius without server batches: the
// per-app reviewed update, one app at a time, while the Store stays open.
// `batchesMissing(error)` says whether this Möbius has no batch routes: with
// no error, whether that is already known; with a refused submit's error,
// whether the refusal shows it. Only then does `applyOne` run.
export function createUpdateBatch({ prepare, submit, read, watch, resolve, refresh, applyOne, batchesMissing, onChange, onSnapshot, onRefused, newId, reconnectMs = 1500 }, entries = []) {
  let state = { phase: 'review', entries, error: '', batchId: null, runningBatchId: null, local: false }
  let checkController = null
  let watchController = null
  let disposed = false
  let watchedId = null
  const snapshots = new Map()
  let uncertain = false
  const emit = patch => {
    state = { ...state, ...patch }
    if (!disposed) onChange?.(state)
  }
  const idle = () => !disposed && state.phase === 'review'
  // The installed app id once known; a check that failed before matching an
  // installed app keeps its catalog item id (often a string such as 'voice').
  const appId = entry => {
    const id = entry.prepared?.installedApp?.id
    return id != null ? Number(id) : entry.item?.id
  }
  // Batches this controller saw running (or submitted): their completion is
  // news, so the app list is re-read once when they finish.
  const awaitingCompletion = new Set()
  const replace = (id, patch) => emit({ entries: state.entries.map(entry => appId(entry) === id ? { ...entry, ...patch } : entry) })
  const mergeSnapshot = raw => {
    const snapshot = normalizeBatchSnapshot(raw)
    if (disposed || !snapshot) return
    if (newestBatchSnapshot(snapshots.get(snapshot.id), snapshot) !== snapshot) return
    snapshots.set(snapshot.id, snapshot)
    uncertain = false
    if (snapshot.phase === 'applying') awaitingCompletion.add(snapshot.id)
    onSnapshot?.(snapshot)
    const known = new Map(state.entries.map(entry => [appId(entry), entry]))
    const rows = snapshot.entries.map(row => {
      const prior = known.get(row.app_id)
      return {
        ...(prior || {}),
        item: prior?.item || { id: row.app_id, name: row.name || `App ${row.app_id}` },
        prepared: prior?.prepared || { installedApp: { id: row.app_id } },
        status: row.status,
        error: row.error,
        errorCode: row.error_code,
        retryable: row.retryable,
        warnings: row.warnings,
        version: row.version,
        durationMs: row.duration_ms,
        resolver: row.resolver_chat_id ? { chat_id: row.resolver_chat_id } : null,
      }
    })
    const returned = new Set(rows.map(appId))
    const siblings = state.entries.filter(entry => !returned.has(appId(entry)) && entry.status !== 'checking')
    emit({ batchId: snapshot.id, runningBatchId: null, phase: snapshot.phase === 'complete' ? 'review' : 'applying', error: '', entries: [...rows, ...siblings] })
    if (snapshot.phase === 'complete') {
      watchController?.abort()
      // Re-reading a finished batch changes nothing: refresh only once.
      if (!awaitingCompletion.delete(snapshot.id)) return
      const refreshFailed = () => {
        if (!disposed) emit({ error: 'Update results are kept, but the app list could not be refreshed. Reopen Store to refresh it.' })
      }
      void Promise.resolve().then(refresh).then(result => { if (!result) refreshFailed() }).catch(refreshFailed)
    }
  }
  async function watchBatch(id) {
    if ((watchedId === id && !watchController?.signal.aborted) || disposed) return
    watchController?.abort()
    watchedId = id
    const controller = new AbortController()
    watchController = controller
    let failures = 0
    try {
      while (!disposed && !controller.signal.aborted && state.batchId === id && state.phase === 'applying') {
        try {
          // A fresh GET precedes each stream attempt. It closes the race
          // between disconnect and resubscribe, and keeps progress moving on a
          // platform or proxy without the event stream.
          mergeSnapshot(await read(id, { signal: controller.signal }))
          if (controller.signal.aborted || state.phase !== 'applying') break
          await watch(id, snapshot => { if (!controller.signal.aborted) mergeSnapshot(snapshot) }, { signal: controller.signal })
          failures = 0
        } catch (error) {
          if (controller.signal.aborted) break
          failures += 1
          emit({ error: `${error?.status === 503 && error.message ? `${error.message} ` : 'Connection lost. '}Update work continues on the server; reconnecting…` })
        }
        if (state.phase === 'applying') await sleep(Math.min(reconnectMs * 2 ** Math.max(failures - 1, 0), 15_000))
      }
    } finally { if (watchController === controller) watchedId = null }
  }
  async function check(items) {
    if (!idle()) return
    if (uncertain) {
      // An approval that may already be running cannot be replaced by a new
      // review until its outcome is known.
      emit({ error: 'The confirmed updates may already be running. Confirm again to resend the same request, or reopen Store to see their status before checking again.' })
      return
    }
    checkController = new AbortController()
    const { signal } = checkController
    const ids = new Set(items.map(item => item.id))
    const retained = state.entries.filter(entry => !ids.has(entry.item.id))
    const seen = new Set(retained.map(appId))
    emit({ phase: 'checking', error: '', batchId: null, runningBatchId: null, applied: false, entries: [...retained, ...items.map(item => ({ item, status: 'checking' }))] })
    const checked = await mapWithConcurrency(items, UPDATE_CHECK_CONCURRENCY, async item => {
      if (signal.aborted) return null
      try {
        const prepared = await prepare(item, { signal })
        // A stale check can offer an update whose last attempt still has an
        // unresolved merge: it is resolved in chat, never confirmed again.
        if (prepared.preview?.pending_update_state === 'needs_resolution') {
          return { item, prepared, status: 'conflict', error: '', resolver: null }
        }
        const access = prepared.capabilityReview?.preview
        if (!prepared.installedApp?.id || !prepared.item?.manifest_url || !prepared.preview?.source_digest
          || !prepared.preview?.upstream_commit || !access?.capability_digest) {
          throw Object.assign(new Error('Source or access could not be verified. Check again before confirming.'), { retryable: true })
        }
        return { item, prepared, status: 'ready', error: '' }
      } catch (error) {
        return { item, status: 'failed', ...errorFields(error, 'This update could not be checked.') }
      }
    })
    if (signal.aborted || disposed) return
    emit({ phase: 'review', entries: [...retained, ...checked.filter(entry => {
      if (!entry || seen.has(appId(entry))) return false
      seen.add(appId(entry)); return true
    })] })
  }
  async function confirm() {
    if (!idle()) return
    const approved = state.entries.filter(entry => entry.status === 'ready')
    if (!approved.length) return
    // Known missing batch routes go straight to the per-app fallback. Posting
    // first would show "Starting", and a close then would leave the fallback
    // running in a dialog nobody can reopen.
    if (applyOne && batchesMissing?.()) {
      await applyEach(approved)
      return
    }
    const id = state.batchId || newId()
    const updates = approved.map(entry => ({
      app_id: entry.prepared.installedApp.id,
      manifest_url: entry.prepared.item.manifest_url,
      upstream_commit: entry.prepared.preview.upstream_commit,
      source_digest: entry.prepared.preview.source_digest,
      capability_digest: entry.prepared.capabilityReview.preview.capability_digest,
    }))
    // Keep the id before the request. If the answer is lost, a retry sends
    // this same id, which attaches to the batch rather than approving another.
    emit({ phase: 'submitting', error: '', batchId: id, runningBatchId: null })
    awaitingCompletion.add(id)
    try {
      mergeSnapshot(await submit({ id, updates }))
      if (state.phase === 'applying') void watchBatch(id)
    } catch (error) {
      if (error?.status && !GATEWAY_STATUSES.has(error.status)) {
        // The platform answered, so no batch exists under this id.
        uncertain = false
        awaitingCompletion.delete(id)
        onRefused?.(id)
        if (disposed) return
        if (applyOne && batchesMissing?.(error)) {
          // A Möbius without server batches: apply each reviewed update here.
          await applyEach(approved)
          return
        }
        // An app that is already updating points at the batch that owns it.
        const running = error.code === 'app_update_running' && error.detail?.batch_id
        emit({
          phase: 'review', batchId: null,
          runningBatchId: running ? String(error.detail.batch_id) : null,
          error: error.message || 'The updates could not be started.',
        })
        return
      }
      if (disposed) return
      try {
        mergeSnapshot(await read(id))
        if (state.phase === 'applying') void watchBatch(id)
        else if (state.phase === 'submitting') throw new Error('The batch was not found.')
      } catch {
        uncertain = true
        emit({ phase: 'review', error: `Could not confirm whether the updates started. Confirm again to resend the same request, or reopen Store to see its status. ${error?.message || ''}`.trim() })
      }
    }
  }
  // The per-app reviewed update, in order, as the Store did before server
  // batches. It needs the Store open, so the dialog stays until it finishes.
  async function applyEach(approved) {
    const ids = new Set(approved.map(appId))
    emit({ phase: 'applying', local: true, batchId: null, error: '',
      entries: state.entries.map(entry => ids.has(appId(entry)) ? { ...entry, status: 'queued' } : entry) })
    for (const entry of approved) {
      if (disposed) return
      replace(appId(entry), { status: 'applying' })
      let outcome
      try {
        outcome = await applyOne(entry)
      } catch (error) {
        outcome = { status: 'failed', ...errorFields(error, NOT_UPDATED) }
      }
      replace(appId(entry), { error: '', errorCode: null, retryable: null, warnings: [], ...outcome })
    }
    if (disposed) return
    emit({ phase: 'review', local: false, applied: true })
    const refreshFailed = () => {
      if (!disposed) emit({ error: 'Update results are kept, but the app list could not be refreshed. Reopen Store to refresh it.' })
    }
    await Promise.resolve().then(refresh).then(result => { if (!result) refreshFailed() }).catch(refreshFailed)
  }
  async function resolveEntries(ids) {
    if (!idle()) return
    const conflicts = state.entries.filter(entry => entry.status === 'conflict' && !entry.resolver && ids.includes(appId(entry)))
    if (!conflicts.length) return
    emit({ phase: 'resolving' })
    try {
      const resolver = await resolve([...new Set(conflicts.map(appId))])
      if (!resolver?.chat_id) throw new Error('The resolver chat was not returned. Try again.')
      const bound = Array.isArray(resolver.app_ids) && resolver.app_ids.length ? new Set(resolver.app_ids.map(Number)) : null
      for (const entry of conflicts) {
        if (bound && !bound.has(appId(entry))) {
          replace(appId(entry), { error: 'A resolver is already running for another app. Resolve this one separately when it finishes.' })
        } else replace(appId(entry), { resolver, error: '' })
      }
    } catch (error) {
      for (const entry of conflicts) replace(appId(entry), { error: error.message || 'The resolver could not be started. Try again.' })
    } finally { if (!disposed) emit({ phase: 'review' }) }
  }
  return {
    get state() { return state },
    // A submission whose outcome is unknown (its answer was lost).
    get uncertain() { return uncertain },
    check, confirm,
    recover(snapshot) {
      mergeSnapshot(snapshot)
      if (state.phase === 'applying') void watchBatch(state.batchId)
    },
    async refreshSnapshot() {
      const id = state.batchId
      if (!id || disposed) return
      let snapshot
      try {
        snapshot = await read(id)
      } catch (error) {
        // A submission whose answer was lost, read again later and still
        // unknown to the server, never started: release it like a refusal.
        if (error?.status === 404 && uncertain && state.batchId === id && state.phase === 'review') {
          uncertain = false
          awaitingCompletion.delete(id)
          onRefused?.(id)
          emit({ batchId: null, error: '' })
          return
        }
        throw error
      }
      if (state.batchId === id) mergeSnapshot(snapshot)
      if (state.phase === 'applying') void watchBatch(id)
    },
    // A snapshot the batch list already returned: no extra read.
    offer(snapshot) {
      if (disposed || snapshot?.id !== state.batchId) return
      mergeSnapshot(snapshot)
      if (state.phase === 'applying') void watchBatch(snapshot.id)
    },
    seedEntries(seeds) {
      if (disposed) return
      const byId = new Map(seeds.map(entry => [appId(entry), entry]))
      emit({ entries: state.entries.map(entry => {
        const seed = byId.get(appId(entry))
        return seed ? { ...entry, item: seed.item, prepared: { ...entry.prepared, installedApp: seed.prepared.installedApp } } : entry
      }) })
    },
    async retry(id) {
      if (!idle()) return
      const entry = state.entries.find(entry => entry.item.id === id && entry.status === 'failed')
      if (entry?.item?.manifest_url) await check([entry.item])
    },
    resolveOne(id) { return resolveEntries([Number(id)]) },
    resolveAll() { return resolveEntries(state.entries.filter(entry => entry.status === 'conflict' && !entry.resolver).map(appId)) },
    // A resolver finishes in its own chat. The shared update check is the
    // authority on whether that app is now current.
    reconcile(checks) {
      if (!idle()) return
      emit({ entries: state.entries.map(entry => {
        const check = checks[appId(entry)]
        return entry.status === 'conflict' && check?.available === false && check.pendingUpdateState === 'none'
          ? { ...entry, status: 'updated', error: '' } : entry
      }) })
    },
    dispose() { disposed = true; checkController?.abort(); watchController?.abort() },
  }
}
