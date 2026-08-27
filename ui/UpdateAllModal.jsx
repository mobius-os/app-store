import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { parseUnifiedDiff } from './diff/parseUnifiedDiff.js'

function itemName(entry) {
  return entry.item?.manifest?.name || entry.item?.name || entry.item?.id || 'App'
}

function itemVersion(entry) {
  return entry.prepared?.preview?.upstream_version || entry.item?.manifest?.version || 'latest'
}

function reviewReason(entry) {
  if (entry.disposition?.reason === 'trust_required') {
    return 'Review required by your preference'
  }
  if (entry.disposition?.reason === 'access_unrecorded') {
    return 'Confirm access once'
  }
  if (entry.disposition?.reason === 'access_changed') {
    return 'Access changes'
  }
  if (entry.disposition?.reason === 'source_unverified') {
    return 'Source could not be verified'
  }
  return entry.error || 'This update could not be checked'
}

function ReadyUpdate({ entry }) {
  const files = useMemo(
    () => parseUnifiedDiff(entry.prepared?.preview?.upstream_diff || ''),
    [entry.prepared?.preview?.upstream_diff],
  )
  const changed = files.length
  return (
    <details className="st-update-all-item">
      <summary>
        <span className="st-update-all-item-main">
          <strong>{itemName(entry)}</strong>
          <span>v{itemVersion(entry)} · {changed ? `${changed} ${changed === 1 ? 'file' : 'files'}` : 'package or assets'}</span>
        </span>
        <span className="st-update-all-state is-ready">Ready</span>
      </summary>
      <div className="st-update-all-files">
        {files.length
          ? files.map((file) => <div key={`${file.oldPath}:${file.newPath}`}>{file.newPath || file.oldPath}</div>)
          : <div>No text-file changes to list.</div>}
      </div>
    </details>
  )
}

export function UpdateAllModal({
  review,
  applying = false,
  progress = null,
  onClose,
  onApply,
  onReview,
}) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const openerRef = useRef(null)
  const ready = review.ready || []
  const attention = review.attention || []
  const busy = applying

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

  const appNoun = ready.length === 1 ? 'app' : 'apps'
  return (
    <div className="st-update-review-scrim" role="presentation" onClick={requestClose}>
      <div
        ref={dialogRef}
        className="st-update-review st-update-all-review"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="st-update-all-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="st-update-review-head">
          <div>
            <h2 id="st-update-all-title" className="st-update-review-title">Update all</h2>
            <p className="st-update-review-subtitle">
              {ready.length} ready{attention.length ? ` · ${attention.length} need a look` : ''}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="st-update-review-close"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close update all"
          ><X width="1em" height="1em" aria-hidden="true" /></button>
        </div>

        <div className="st-update-review-body">
          <div className="st-update-all-intro" role="status">
            {attention.length
              ? 'Only explicitly trusted routine updates can be applied together. Everything else stays on the individual review path.'
              : 'You explicitly trusted these routine updates. Möbius will still verify each release and stop on any access change.'}
          </div>

          {ready.length ? (
            <section className="st-update-review-section">
              <h3>Ready to update</h3>
              <div className="st-update-all-list">{ready.map((entry) => (
                <ReadyUpdate key={entry.item.id} entry={entry} />
              ))}</div>
            </section>
          ) : null}

          {attention.length ? (
            <section className="st-update-review-section">
              <h3>Review separately</h3>
              <div className="st-update-all-list">{attention.map((entry) => (
                <div className="st-update-all-attention" key={entry.item.id}>
                  <span className="st-update-all-item-main">
                    <strong>{itemName(entry)}</strong>
                    <span>{reviewReason(entry)}</span>
                  </span>
                  <button
                    type="button"
                    className="st-btn st-btn-secondary"
                    disabled={busy}
                    onClick={() => onReview(entry)}
                  >Review</button>
                </div>
              ))}</div>
            </section>
          ) : null}

          {applying && progress ? (
            <div className="st-update-all-progress" role="status" aria-live="polite">
              Updating {progress.current} of {progress.total}: {progress.name}
            </div>
          ) : null}
        </div>

        <div className="st-update-review-actions">
          <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={busy}>
            {ready.length ? 'Not now' : 'Close'}
          </button>
          {ready.length ? (
            <button type="button" className="st-btn st-btn-primary" onClick={onApply} disabled={busy}>
              {applying && progress
                ? `Updating ${progress.current}/${progress.total}`
                : `Update ${ready.length} ${appNoun}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
