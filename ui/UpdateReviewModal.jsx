import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from '@openai/apps-sdk-ui/components/Icon'
import { loadUpdateAgentChoices, visibleUpdateAgentChoices } from '../api.js'
import { capabilityDiffNeedsReview } from '../domain.js'
import { batchProgress, failedEntryActions, updateBatchBusy } from '../update-batch.js'
import { parseUnifiedDiff } from './diff/parseUnifiedDiff.js'
import FileDiffList from './diff/FileDiffList.jsx'
import { CapabilityContract } from './CapabilityContract.jsx'

const appName = entry => entry.item?.manifest?.name || entry.item?.name || String(entry.item?.id ?? '')
const providerNames = { codex: 'OpenAI Codex', claude: 'Claude Code', mobius: 'Möbius' }
// The platform model registry uses this scale when effort_levels is omitted.
// An explicit empty scale means the model accepts no effort setting.
const defaultEfforts = ['low', 'medium', 'high']

// Reused at each update-agent boundary. Cancel never creates a chat; a bound
// resolver may still reuse its original agent regardless of this selection.
export function UpdateAgentChooser({ token, title, onStart, onCancel }) {
  const dialogRef = useRef(null)
  const [choices, setChoices] = useState(null)
  const [selected, setSelected] = useState('')
  const [effort, setEffort] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    let back = window.mobius?.nav?.open('store-update-agent', {
      onBack: () => { back = null; dialog?.close() },
    })
    return () => { back?.close(); opener?.focus?.() }
  }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    loadUpdateAgentChoices(token, { signal: controller.signal }).then(data => {
      if (!active) return
      setChoices(data)
      const { selected: saved } = visibleUpdateAgentChoices(data)
      if (saved) {
        setSelected(`${saved.provider}:${saved.id}`)
        setEffort(Array.isArray(saved.effort_levels) && !saved.effort_levels.length ? '' : data.savedAgent.effort || '')
      }
    }).catch(err => { if (active) setError(err.message || 'Could not load agent choices.') })
    return () => { active = false; controller.abort() }
  }, [token])
  const { rows } = visibleUpdateAgentChoices(choices)
  const model = rows.find(row => `${row.provider}:${row.id}` === selected)
  const efforts = model ? (Array.isArray(model.effort_levels) ? model.effort_levels : defaultEfforts) : []
  const effortIndex = efforts.indexOf(effort)
  const invalidEffort = !!model && !!effort && efforts.length > 0 && effortIndex < 0
  const close = () => { if (!busy) onCancel() }
  const start = async () => {
    if (!model || busy || invalidEffort) return
    setBusy(true); setError('')
    try {
      await onStart({ provider: model.provider, model: model.id, ...(effort && efforts.includes(effort) ? { effort } : {}) })
      onCancel()
    } catch (err) {
      setError(err.message || 'Could not start the agent.')
    } finally { setBusy(false) }
  }
  return (
    <dialog ref={dialogRef} className="st-agent-choice" aria-labelledby="st-agent-choice-title" onCancel={event => { if (busy) event.preventDefault() }} onClose={close}>
      <div className="st-agent-choice-inner">
        <h2 id="st-agent-choice-title">{title || 'Choose an update agent'}</h2>
        <p>Uses your latest chat agent. An existing resolver keeps its original agent.</p>
        <button type="button" className="st-agent-choice-current" aria-label="Change update agent" aria-expanded={expanded} aria-controls="st-agent-choice-list" disabled={busy || !rows.length} onClick={() => setExpanded(value => !value)}>
          <span><strong>{model ? model.label || model.id : 'Choose an agent'}</strong><span className="st-agent-choice-caption">{model ? providerNames[model.provider] || model.provider : 'No agent selected'}</span></span>
          {model && effort ? <span className="st-agent-choice-badge">{effort}</span> : null}
          <ChevronDown width={18} height={18} aria-hidden="true" />
        </button>
        {expanded ? <div id="st-agent-choice-list" className="st-agent-choice-list" role="group" aria-label="Available agents">
          {rows.map(row => {
            const key = `${row.provider}:${row.id}`
            return <button type="button" key={key} className={`st-agent-choice-row${selected === key ? ' is-selected' : ''}`} aria-pressed={selected === key} disabled={busy} onClick={() => { setSelected(key); setEffort('') }}>
              <span><span className="st-agent-choice-provider">{providerNames[row.provider] || row.provider}</span><span className="st-agent-choice-model">{row.label || row.id}</span></span>
              {selected === key ? <Check className="st-agent-choice-check" width="1em" height="1em" aria-hidden="true" /> : null}
            </button>
          })}
        </div> : null}
        {expanded && model && efforts.length ? <div className="st-agent-choice-effort">
          <label htmlFor="st-agent-choice-effort">Effort <strong>{effort || 'Default'}</strong></label>
          <input id="st-agent-choice-effort" type="range" min="0" max={efforts.length} step="1" value={effortIndex < 0 ? 0 : effortIndex + 1} disabled={busy} onChange={e => setEffort(e.target.value === '0' ? '' : efforts[Number(e.target.value) - 1])} />
          <div className="st-agent-choice-effort-scale"><span>Default</span><span>{efforts.at(-1)}</span></div>
        </div> : null}
        {!choices && !error ? <p role="status">Loading available agents…</p> : null}
        {choices && !rows.length ? <p role="status">No connected provider has a visible model. Connect a provider in Settings.</p> : null}
        {choices && rows.length && !model ? <p role="alert">Your saved agent is unavailable or hidden. Choose another model to continue.</p> : null}
        {invalidEffort ? <p role="alert">Your saved effort is unavailable for this model. Choose an effort to continue.</p> : null}
        {error ? <p className="st-agent-choice-error" role="alert">{error}</p> : null}
        <div className="st-agent-choice-actions">
          <button type="button" className="st-btn st-btn-secondary" onClick={close} disabled={busy}>Cancel</button>
          <button type="button" className="st-btn st-btn-primary" onClick={start} disabled={busy || !model || invalidEffort}>{busy ? 'Starting…' : 'Start agent'}</button>
        </div>
      </div>
    </dialog>
  )
}

const STATUS = {
  checking: ['Checking…', 'ready'],
  queued: ['Queued', 'ready'],
  applying: ['Updating…', 'ready'],
  updated: ['Updated', 'success'],
  conflict: ['Local edits need review', 'attention'],
  failed: ['Could not update', 'error'],
}

function ReviewEntry({ entry, locked, onRetry, onAskAgent, onResolveOne, onOpenChat }) {
  const preview = entry.prepared?.preview || {}
  const files = useMemo(
    () => parseUnifiedDiff(entry.status === 'ready' && typeof preview.upstream_diff === 'string' ? preview.upstream_diff : ''),
    [entry.status, preview.upstream_diff],
  )
  const added = files.filter(file => file.status === 'A' || file.status === 'C').length
  const removed = files.filter(file => file.status === 'D').length
  const changed = files.length - added - removed
  const capabilitiesChanged = entry.status === 'ready' && capabilityDiffNeedsReview(
    entry.prepared?.capabilityReview?.preview?.capability_diff,
  )
  const version = preview.upstream_version || entry.version || entry.item?.manifest?.version || 'latest'
  const [label, tone] = entry.status === 'ready'
    ? [capabilitiesChanged ? 'Access review required' : 'Ready to update', 'ready']
    : STATUS[entry.status] || STATUS.failed
  const actions = failedEntryActions(entry)
  const changes = [
    added ? `${added} added` : '',
    changed ? `${changed} changed` : '',
    removed ? `${removed} removed` : '',
  ].filter(Boolean).join(' · ')
  const appId = entry.prepared?.installedApp?.id

  return (
    <section className="st-update-review-section" data-status={entry.status}>
      <div className="st-update-review-section-head">
        <div><h3>{appName(entry)}</h3><span className="st-update-version">Version {version}</span></div>
        <span className={`st-update-status is-${tone}`}>{label}</span>
      </div>
      {entry.status === 'updated' ? (
        <div className="st-update-review-notice is-success" role="status">
          This app was updated. No further action is needed.
        </div>
      ) : entry.status === 'checking' || entry.status === 'queued' || entry.status === 'applying' ? (
        <div className="st-update-review-notice" role="status">
          {entry.status === 'checking' ? 'Checking the release and its access. Nothing changes yet.'
            : entry.status === 'queued' ? 'Waiting for its turn. A few updates run at a time.'
              : 'Applying this update.'}
        </div>
      ) : entry.status === 'conflict' ? (
        <div className="st-update-review-notice is-error" role="alert">
          <div className="st-update-review-error-text">{entry.error || 'Your local edits overlap this update.'}</div>
          <p>
            {entry.resolver?.message
              ? `${entry.resolver.message} Your current app stays live.`
              : entry.resolver
                ? 'An agent is reconciling your edits with the update. Your current app stays live.'
                : 'Your current app stays live. An agent can reconcile the update while keeping your edits.'}
          </p>
          {entry.resolver?.chat_id ? (
            <button type="button" className="st-btn st-btn-secondary" onClick={() => onOpenChat?.(entry.resolver.chat_id)}>Open resolver chat</button>
          ) : appId != null && onResolveOne ? (
            <button type="button" className="st-btn st-btn-secondary" onClick={() => onResolveOne(appId)} disabled={locked}>Resolve in chat</button>
          ) : null}
        </div>
      ) : entry.status === 'failed' ? (
        <div className="st-update-review-notice is-error" role="alert">
          <div className="st-update-review-error-text">{entry.error || 'This update could not be completed.'}</div>
          <p>
            {actions.retry
              ? 'Your current app stays unchanged. Trying again checks the release before anything is applied.'
              : 'Your current app stays unchanged. Trying the same update again would fail the same way.'}
          </p>
          {actions.retry && entry.item?.manifest_url && onRetry ? (
            <button type="button" className="st-btn st-btn-secondary" onClick={() => onRetry(entry.item.id)} disabled={locked}>Try again</button>
          ) : null}
          {actions.retry && !entry.item?.manifest_url ? (
            <p>Find this app in Library to check its release again.</p>
          ) : null}
          {actions.askAgent && onAskAgent ? (
            <button type="button" className="st-btn st-btn-secondary" onClick={() => onAskAgent([entry])} disabled={locked}>Ask agent</button>
          ) : null}
        </div>
      ) : (
        <div className="st-update-change-summary">
          <h4>What changed</h4>
          <p>
            {files.length
              ? `${files.length} ${files.length === 1 ? 'file' : 'files'} in this preview: ${changes}.`
              : 'No source-file changes to show. This release may update app settings or artwork.'}
          </p>
          <p className="st-update-summary-note">
            {capabilitiesChanged ? 'Review the access changes below before confirming.' : 'No new access is requested.'}
          </p>
        </div>
      )}
      {entry.warnings?.length ? (
        <ul className="st-update-review-warnings" aria-label={`${appName(entry)} update notes`}>
          {entry.warnings.map((warning, index) => (
            <li key={index}>{typeof warning === 'string' ? warning : warning?.message || String(warning)}</li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <details className="st-update-technical">
          <summary>Technical details <span>{files.length} {files.length === 1 ? 'file' : 'files'}</span></summary>
          <FileDiffList files={files} />
        </details>
      ) : null}
      {capabilitiesChanged ? (
        <div>
          <h3>{entry.prepared.capabilityReview.preview.capability_diff?.unknown_previous ? 'Access review' : 'Access changes'}</h3>
          <CapabilityContract review={entry.prepared.capabilityReview} isInstalled updateReview />
        </div>
      ) : null}
    </section>
  )
}

// The review, its confirmation and the server batch's live progress share one
// dialog. Closing it never cancels server work; reopening shows the progress.
export function UpdateReviewModal({ review, agentReviewing = false, onClose, onConfirm, onRetry, onResolveAll, onResolveOne, onOpenChat, onAskAgent, onOpenBatch }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const openerRef = useRef(null)
  const { entries = [], phase = 'review', error = '' } = review
  const ready = entries.filter(entry => entry.status === 'ready')
  const updatedCount = entries.filter(entry => entry.status === 'updated').length
  const attentionCount = entries.filter(entry => entry.status === 'conflict' || entry.status === 'failed').length
  const unresolved = entries.filter(entry => entry.status === 'conflict' && !entry.resolver)
  const progress = batchProgress(entries)
  const applying = updateBatchBusy(review)
  // The per-app fallback (a Möbius without server batches) runs in this
  // Store, so the dialog stays open until it finishes, as it always did.
  const localApply = applying && review.local === true
  const checking = phase === 'checking'
  const locked = applying || checking || phase === 'resolving' || agentReviewing
  const hasResults = Boolean(review.batchId) || review.applied === true || updatedCount > 0
  const title = checking ? 'Checking for updates'
    : phase === 'resolving' ? 'Starting resolver chat'
      : applying ? 'Updating apps'
        : hasResults ? 'Update results'
          : entries.length === 1 ? 'Review update' : 'Review app updates'
  const subtitle = checking ? 'Comparing each release’s source and access. Checking changes nothing.'
    : phase === 'submitting' ? 'Starting the confirmed updates…'
      : localApply ? `${progress.finished} of ${progress.total} finished · ${progress.active} in progress. Keep the Store open until these finish.`
      : applying ? `${progress.finished} of ${progress.total} finished · ${progress.active} in progress. You can close this window; updates continue on the server.`
        : phase === 'resolving' ? 'Opening a resolver chat for the selected apps…'
          : hasResults ? `${updatedCount} updated · ${attentionCount} need attention${ready.length ? ` · ${ready.length} ready to confirm` : ''}.`
            : ready.length ? `Review what changed, then confirm ${ready.length === 1 ? 'this update' : `${ready.length} updates`}. Local edits stay protected; overlapping edits wait for you to resolve them.`
              : unresolved.length && unresolved.length === entries.length ? 'Local changes must be reconciled before updating. Nothing will change.'
                : 'No updates are ready to confirm. Your current apps stay unchanged.'

  const requestClose = useCallback(() => { if (!localApply) onClose() }, [localApply, onClose])

  useEffect(() => {
    openerRef.current = document.activeElement
    closeRef.current?.focus()
    return () => {
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = event => {
      if (!dialogRef.current?.contains(document.activeElement)) return
      if (event.key === 'Escape') { event.preventDefault(); requestClose(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])',
      )]
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  return (
    <div className="st-update-review-scrim" role="presentation" onClick={requestClose}>
      <div ref={dialogRef} className="st-update-review" role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="st-update-review-title" onClick={event => event.stopPropagation()}>
        <div className="st-update-review-head">
          <div>
            <h2 id="st-update-review-title" className="st-update-review-title">{title}</h2>
            <p className="st-update-review-subtitle" role="status" aria-live="polite">{subtitle}</p>
          </div>
          <button ref={closeRef} type="button" className="st-update-review-close" onClick={requestClose} disabled={localApply} aria-label="Close update review"><X width="1em" height="1em" aria-hidden="true" /></button>
        </div>

        <div className="st-update-review-body">
          {error ? (
            <div className="st-update-review-notice is-error" role="alert">
              <div className="st-update-review-error-text">{error}</div>
              {review.runningBatchId && onOpenBatch ? (
                <button type="button" className="st-btn st-btn-secondary" onClick={() => onOpenBatch(review.runningBatchId)}>View progress</button>
              ) : null}
            </div>
          ) : null}
          {entries.map(entry => (
            <ReviewEntry key={entry.item.id} entry={entry} locked={locked}
              onRetry={onRetry} onAskAgent={onAskAgent} onResolveOne={onResolveOne} onOpenChat={onOpenChat} />
          ))}
        </div>

        <div className="st-update-review-actions">
          <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={localApply}>
            {checking ? 'Cancel' : localApply ? 'Updating…' : applying ? 'Continue in background' : hasResults ? 'Done' : 'Not now'}
          </button>
          {unresolved.length > 1 && onResolveAll ? (
            <button type="button" className="st-btn st-btn-secondary" onClick={onResolveAll} disabled={locked}>Resolve all · {unresolved.length}</button>
          ) : null}
          {ready.length && onAskAgent ? (
            <button type="button" className="st-btn st-btn-secondary" onClick={() => onAskAgent(ready)} disabled={locked}>
              {agentReviewing ? 'Opening agent…' : 'Review with agent'}
            </button>
          ) : null}
          {ready.length || phase === 'submitting' ? (
            <button type="button" className="st-btn st-btn-primary" onClick={onConfirm} disabled={locked}>
              {phase === 'submitting' ? 'Starting…' : entries.length === 1 ? 'Confirm update' : `Confirm & update · ${ready.length}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
