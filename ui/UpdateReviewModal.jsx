import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { capabilityDiffNeedsReview } from '../domain.js'
import { parseUnifiedDiff } from './diff/parseUnifiedDiff.js'
import FileDiffList from './diff/FileDiffList.jsx'
import { CapabilityContract } from './CapabilityContract.jsx'

function ReviewEntry({ review, busy, onRetry }) {
  const preview = review.preview || {}
  const files = useMemo(
    () => parseUnifiedDiff(typeof preview.upstream_diff === 'string' ? preview.upstream_diff : ''),
    [preview.upstream_diff],
  )
  const added = files.filter(file => file.status === 'A' || file.status === 'C').length
  const removed = files.filter(file => file.status === 'D').length
  const changed = files.length - added - removed
  const capabilitiesChanged = capabilityDiffNeedsReview(review.capabilityReview?.preview?.capability_diff)
  const name = review.item.manifest?.name || review.item.id
  const version = preview.upstream_version || review.item.manifest?.version || 'latest'
  const conflict = review.outcome?.conflict || preview.pending_update_state === 'needs_resolution'
  const updated = review.outcome?.ok === true
  const error = updated ? '' : review.previewError || review.outcome?.resolverError || review.outcome?.error ||
    (review.outcome && !conflict ? 'This update could not be completed.' : '')
  const ready = !!preview.source_digest && !review.outcome && !review.previewError
  const resolving = review.outcome?.conflict && !review.outcome?.resolverError
  const status = updated ? 'Updated' : conflict ? 'Local edits need review' : error || !ready ? 'Could not update' : capabilitiesChanged ? 'Access review required' : 'Ready to update'
  const tone = updated ? 'success' : conflict ? 'attention' : error || !ready ? 'error' : 'ready'
  const changes = [added ? `${added} added` : '', changed ? `${changed} changed` : '', removed ? `${removed} removed` : ''].filter(Boolean).join(' · ')

  return (
    <section className="st-update-review-section">
      <div className="st-update-review-section-head">
        <div><h3>{name}</h3><span className="st-update-version">Version {version}</span></div>
        <span className={`st-update-status is-${tone}`}>{status}</span>
      </div>
      {updated ? (
        <div className="st-update-review-notice is-success" role="status">This app was updated. No further action is needed.</div>
      ) : error || conflict || !ready ? (
        <div className="st-update-review-notice is-error" role="alert">
          <div className="st-update-review-error-text">{error || (conflict ? 'Your local edits overlap this update.' : 'This update could not be verified.')}</div>
          <p>{resolving ? 'An agent is reviewing the overlap. Your current app stays live.' : conflict ? 'Resolve the local edits before updating. Your current app stays live.' : 'Your current app stays unchanged. Recheck the update before trying again.'}</p>
          {onRetry && !resolving ? <button type="button" className="st-btn st-btn-secondary" onClick={() => onRetry(review.item)} disabled={busy}>Try again</button> : null}
        </div>
      ) : (
        <div className="st-update-change-summary">
          <h4>What changed</h4>
          <p>{files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} in this preview: ${changes}.` : 'No source-file changes to show. This release may update app settings or artwork.'}</p>
          <p className="st-update-summary-note">{capabilitiesChanged ? 'Review the access changes below before confirming.' : 'No new access is requested.'}</p>
        </div>
      )}
      {!updated && files.length > 0 ? (
        <details className="st-update-technical">
          <summary>Technical details <span>{files.length} {files.length === 1 ? 'file' : 'files'}</span></summary>
          <FileDiffList files={files} />
        </details>
      ) : null}
      {!updated && capabilitiesChanged ? <div><h3>{review.capabilityReview?.preview?.capability_diff?.unknown_previous ? 'Access review' : 'Access changes'}</h3><CapabilityContract review={review.capabilityReview} isInstalled /></div> : null}
    </section>
  )
}

export function UpdateReviewModal({ review, applying = false, preparing = false, agentReviewing = false, onClose, onApply, onRetry, onReviewWithAgent }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const openerRef = useRef(null)
  const entries = review.entries || [review]
  // Exclude preview-error entries (e.g. needs_resolution conflict) so they
  // never appear as confirmable — they show an error message instead.
  const verified = entries.filter(
    entry => entry.preview?.source_digest && !entry.outcome && !entry.previewError,
  )
  const complete = entries.some(entry => entry.outcome)
  const updatedCount = entries.filter(entry => entry.outcome?.ok).length
  const attentionCount = entries.filter(entry => !entry.outcome?.ok && (entry.outcome || entry.previewError || !entry.preview?.source_digest)).length
  const allUpdated = updatedCount === entries.length
  const busy = applying || preparing || agentReviewing
  const hasFailure = entries.some(entry => entry.previewError || entry.outcome?.error || entry.outcome?.resolverError)

  const requestClose = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

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
            <h2 id="st-update-review-title" className="st-update-review-title">{complete ? 'Update results' : entries.length === 1 ? 'Review update' : 'Review app updates'}</h2>
            <p className="st-update-review-subtitle">
              {complete
                ? `${updatedCount} updated · ${attentionCount} need attention${verified.length ? ` · ${verified.length} ready to confirm` : ''}. Completed apps will not be updated again.`
                : verified.length
                  ? `Review what changed, then confirm ${verified.length === 1 ? 'this update' : `${verified.length} updates`}. Local edits stay protected; overlapping edits go to an agent for review.`
                  : 'No updates are ready to confirm. Your current apps stay unchanged.'}
            </p>
          </div>
          <button ref={closeRef} type="button" className="st-update-review-close" onClick={requestClose} disabled={busy} aria-label="Close update review"><X width="1em" height="1em" aria-hidden="true" /></button>
        </div>

        <div className="st-update-review-body">
          {entries.map(entry => <ReviewEntry key={entry.item.id} review={entry} busy={busy} onRetry={onRetry} />)}
        </div>

        <div className="st-update-review-actions">
          <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={busy}>{complete ? 'Done' : 'Not now'}</button>
          {onReviewWithAgent && !allUpdated ? (
            <button type="button" className="st-btn st-btn-secondary" onClick={onReviewWithAgent} disabled={busy}>
              {agentReviewing ? 'Opening agent…' : hasFailure ? 'Ask agent about error' : 'Review with agent'}
            </button>
          ) : null}
          {verified.length ? (
            <button type="button" className="st-btn st-btn-primary" onClick={onApply} disabled={busy}>
              {preparing ? 'Checking…' : applying ? 'Updating…' : entries.length === 1 ? 'Confirm update' : `Confirm & update · ${verified.length}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
