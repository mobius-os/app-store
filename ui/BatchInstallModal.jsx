/* BatchInstallModal keeps multi-app capability review and one approval action
   inside a single accessible App Store dialog. */
import React, { useCallback, useEffect, useRef } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { CapabilityContract } from './CapabilityContract.jsx'
import { IconBox } from './IconBox.jsx'

function resultCopy(result) {
  if (result?.status === 'installed') return 'Installed'
  if (result?.status === 'error') return 'Needs attention'
  return ''
}

export function BatchInstallModal({ review, token, onClose, onRetry, onApprove }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const openerRef = useRef(null)
  const busy = review.phase === 'loading' || review.phase === 'installing'
  const reviews = review.reviews || {}
  const results = review.results || {}
  const hasReviewError = review.items.some(item => reviews[item.id]?.status === 'error')
  const ready = review.items.length > 0 && review.items.every(
    item => reviews[item.id]?.preview?.capability_digest,
  )
  const installedCount = Object.values(results).filter(result => result.status === 'installed').length
  const failedCount = Object.values(results).filter(result => result.status === 'error').length

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
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
      )]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  const title = review.phase === 'done' ? 'Installation complete' : 'Review selected apps'
  const subtitle = review.phase === 'done'
    ? `${installedCount} installed${failedCount ? ` · ${failedCount} need attention` : ''}`
    : `${review.items.length} ${review.items.length === 1 ? 'app' : 'apps'} selected · approve once`

  return (
    <div className="st-batch-scrim" role="presentation" onClick={requestClose}>
      <div
        ref={dialogRef}
        className="st-batch-review"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="st-batch-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="st-batch-head">
          <div>
            <h2 id="st-batch-title" className="st-batch-title">{title}</h2>
            <p className="st-batch-subtitle">{subtitle}</p>
          </div>
          <button ref={closeRef} type="button" className="st-batch-close" onClick={requestClose} disabled={busy} aria-label="Close batch review">
            <X width="1em" height="1em" aria-hidden="true" />
          </button>
        </div>

        <div className="st-batch-body">
          {review.phase === 'loading' ? (
            <div className="st-batch-loading" role="status">Checking each app’s current access…</div>
          ) : null}
          {review.phase !== 'done' ? (
            <div className="st-batch-guidance">Review the access for each app below. Nothing is installed until you approve the complete selection.</div>
          ) : null}
          <div className="st-batch-list">
            {review.items.map((item, index) => {
              const itemReview = reviews[item.id]
              const result = results[item.id]
              const itemName = item.manifest?.name || item.name || item.id
              const isInstalling = review.phase === 'installing' && review.currentItemId === item.id
              return (
                <details className={`st-batch-item${result ? ` is-${result.status}` : ''}`} key={item.id} defaultOpen={review.items.length <= 3 || index === 0 || result?.status === 'error'}>
                  <summary>
                    <span className="st-batch-icon"><IconBox item={item} token={token} /></span>
                    <span className="st-batch-item-copy">
                      <strong>{itemName}</strong>
                      <small>{isInstalling ? 'Installing…' : resultCopy(result) || (itemReview?.status === 'error' ? 'Access check failed' : 'Review access')}</small>
                    </span>
                    <span className="st-batch-chevron" aria-hidden="true">›</span>
                  </summary>
                  <div className="st-batch-access">
                    {result?.status === 'error' ? <div className="st-error-box" role="alert">{result.error}</div> : null}
                    <CapabilityContract review={itemReview} onRetry={onRetry} />
                  </div>
                </details>
              )
            })}
          </div>
        </div>

        <div className="st-batch-actions">
          {review.phase === 'done' ? (
            <button type="button" className="st-btn st-btn-primary" onClick={requestClose}>Done</button>
          ) : (
            <>
              <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={busy}>Back to selection</button>
              {hasReviewError ? (
                <button type="button" className="st-btn st-btn-secondary" onClick={onRetry} disabled={busy}>Retry checks</button>
              ) : null}
              <button type="button" className="st-btn st-btn-primary" onClick={onApprove} disabled={busy || !ready}>
                {review.phase === 'installing' ? `Installing ${(review.currentItemIndex ?? 0) + 1} of ${review.items.length}…` : ready ? `Approve & install ${review.items.length}` : 'Checking access…'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
