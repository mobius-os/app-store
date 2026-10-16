import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { capabilityDiffNeedsReview } from '../domain.js'
import { batchProgress, failedEntryActions, updateBatchBusy } from '../update-batch.js'
import { parseUnifiedDiff } from './diff/parseUnifiedDiff.js'
import FileDiffList from './diff/FileDiffList.jsx'
import { CapabilityContract } from './CapabilityContract.jsx'

const appName = entry => entry.item?.manifest?.name || entry.item?.name || String(entry.item?.id ?? '')

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
