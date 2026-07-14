import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { capabilityDiffNeedsReview } from '../domain.js'
import { summarizeUpdateDiff, updateFileStatusLabel } from '../update-review.js'
import { CapabilityContract } from './CapabilityContract.jsx'

function fileCountLabel(count) {
  return `${count} ${count === 1 ? 'file' : 'files'}`
}

export function UpdateReviewModal({
  review,
  applying = false,
  agentReviewing = false,
  error = '',
  onClose,
  onApply,
  onReviewWithAgent,
}) {
  const [diffOpen, setDiffOpen] = useState(false)
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const item = review.item
  const preview = review.preview || {}
  const diff = typeof preview.upstream_diff === 'string' ? preview.upstream_diff : ''
  const summary = useMemo(() => summarizeUpdateDiff(diff), [diff])
  const capabilitiesChanged = capabilityDiffNeedsReview(
    review.capabilityReview?.preview?.capability_diff,
  )
  const busy = applying || agentReviewing
  const name = item.manifest?.name || item.id
  const version = preview.upstream_version || item.manifest?.version || 'latest'

  const requestClose = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  return (
    <div className="st-update-review-scrim" role="presentation" onClick={requestClose}>
      <div
        ref={dialogRef}
        className="st-update-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="st-update-review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="st-update-review-head">
          <div>
            <h2 id="st-update-review-title" className="st-update-review-title">Review update</h2>
            <p className="st-update-review-subtitle">
              {name} to v{version}
              {summary.fileCount > 0 ? ` · ${fileCountLabel(summary.fileCount)}` : ''}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="st-update-review-close"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close update review"
          >×</button>
        </div>

        <div className="st-update-review-body">
          {review.previewError ? (
            <div className="st-update-review-notice" role="status">
              Couldn’t load the source diff. You can review the update with the agent,
              or apply it without reviewing the file changes.
            </div>
          ) : summary.fileCount === 0 ? (
            <div className="st-update-review-notice" role="status">
              No source-file changes to show. This release may update package metadata or assets.
            </div>
          ) : (
            <section className="st-update-review-section">
              <div className="st-update-review-section-head">
                <h3>{fileCountLabel(summary.fileCount)}</h3>
                <div className="st-update-review-total" aria-label={`${summary.insertions} additions and ${summary.deletions} deletions`}>
                  <span className="is-add">+{summary.insertions}</span>
                  <span className="is-del">−{summary.deletions}</span>
                </div>
              </div>
              <ul className="st-update-review-files">
                {summary.files.map((file) => (
                  <li key={`${file.status}:${file.oldPath}:${file.newPath}`} className="st-update-review-file">
                    <span className={`st-update-review-badge is-${file.status.toLowerCase()}`} title={updateFileStatusLabel(file.status)}>
                      {file.status}
                    </span>
                    <span className="st-update-review-path">{file.path}</span>
                    <span className="st-update-review-stat">
                      {file.insertions > 0 ? <span className="is-add">+{file.insertions}</span> : null}
                      {file.deletions > 0 ? <span className="is-del">−{file.deletions}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {diff ? (
            <section className="st-update-review-section">
              <button
                type="button"
                className="st-btn st-btn-secondary st-update-review-toggle"
                onClick={() => setDiffOpen((open) => !open)}
                aria-expanded={diffOpen}
              >
                {diffOpen ? 'Hide full diff' : 'Show full diff'}
              </button>
              {diffOpen ? <pre className="st-update-review-diff"><code>{diff}</code></pre> : null}
            </section>
          ) : null}

          {capabilitiesChanged ? (
            <section className="st-update-review-section">
              <h3>Access changes</h3>
              <CapabilityContract review={review.capabilityReview} isInstalled />
            </section>
          ) : null}

          {error ? <div className="st-error-box" role="alert">{error}</div> : null}
        </div>

        <div className="st-update-review-actions">
          <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={busy}>
            Not now
          </button>
          <button
            type="button"
            className="st-btn st-btn-secondary"
            onClick={onReviewWithAgent}
            disabled={busy}
          >
            {agentReviewing ? 'Opening agent…' : 'Review with agent'}
          </button>
          <button type="button" className="st-btn st-btn-primary" onClick={onApply} disabled={busy}>
            {applying ? 'Updating…' : 'Apply update'}
          </button>
        </div>
      </div>
    </div>
  )
}
