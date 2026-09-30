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
  const insertions = files.reduce((sum, file) => sum + (file.insertions || 0), 0)
  const deletions = files.reduce((sum, file) => sum + (file.deletions || 0), 0)
  const capabilitiesChanged = capabilityDiffNeedsReview(
    review.capabilityReview?.preview?.capability_diff,
  )
  const name = review.item.manifest?.name || review.item.id
  const version = preview.upstream_version || review.item.manifest?.version || 'latest'
  const conflict = review.outcome?.conflict
  const error = review.previewError || review.outcome?.error || review.outcome?.resolverError ||
    (review.outcome && !conflict ? 'This update could not be completed.' : '')

  return (
    <section className="st-update-review-section">
      <div className="st-update-review-section-head">
        <h3>{name} · v{version}</h3>
        {files.length ? (
          <div className="st-update-review-total" aria-label={`${insertions} additions and ${deletions} deletions`}>
            <span className="is-add">+{insertions}</span>
            <span className="is-del">−{deletions}</span>
          </div>
        ) : null}
      </div>

      {error || conflict ? (
        <div className="st-update-review-notice is-error" role="alert">
          <div className="st-update-review-error-text">
            {error || 'Local changes overlap this update.'}
          </div>
          {conflict && !review.outcome?.resolverError
            ? 'An agent is reconciling the update while the current app stays live.'
            : onRetry
              ? 'Nothing else will change until you try again.'
              : 'This app is not included in the confirmed updates.'}
          {onRetry && (!conflict || review.outcome?.resolverError) ? (
            <div><button type="button" className="st-btn st-btn-secondary" onClick={() => onRetry(review.item)} disabled={busy}>Try again</button></div>
          ) : null}
        </div>
      ) : files.length === 0 ? (
        <div className="st-update-review-notice" role="status">
          No source-file changes to show. This release may update package metadata or assets.
        </div>
      ) : <FileDiffList files={files} />}

      {capabilitiesChanged ? (
        <div>
          <h3>{review.capabilityReview?.preview?.capability_diff?.unknown_previous ? 'Access review' : 'Access changes'}</h3>
          <CapabilityContract review={review.capabilityReview} isInstalled />
        </div>
      ) : null}
    </section>
  )
}

export function UpdateReviewModal({ review, applying = false, onClose, onApply, onRetry }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const openerRef = useRef(null)
  const entries = review.entries || [review]
  const verified = entries.filter(entry => entry.preview?.source_digest && !entry.outcome)
  const complete = entries.some(entry => entry.outcome)

  const requestClose = useCallback(() => {
    if (!applying) onClose()
  }, [applying, onClose])

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
        'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
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
            <h2 id="st-update-review-title" className="st-update-review-title">{complete ? 'Updates need attention' : entries.length === 1 ? 'Review update' : 'Review app updates'}</h2>
            <p className="st-update-review-subtitle">
              {complete
                ? 'Completed apps will not be updated again.'
                : verified.length
                  ? `Confirm once to update ${verified.length} verified ${verified.length === 1 ? 'app' : 'apps'} and start one resolver chat if local edits overlap.`
                  : 'No updates could be verified. Nothing will change.'}
            </p>
          </div>
          <button ref={closeRef} type="button" className="st-update-review-close" onClick={requestClose} disabled={applying} aria-label="Close update review"><X width="1em" height="1em" aria-hidden="true" /></button>
        </div>

        <div className="st-update-review-body">
          {entries.map(entry => <ReviewEntry key={entry.item.id} review={entry} busy={applying} onRetry={complete ? onRetry : null} />)}
        </div>

        <div className="st-update-review-actions">
          <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={applying}>Not now</button>
          {!complete && verified.length ? (
            <button type="button" className="st-btn st-btn-primary" onClick={onApply} disabled={applying}>
              {applying ? 'Updating…' : entries.length === 1 ? 'Confirm update' : `Confirm & update · ${verified.length}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
