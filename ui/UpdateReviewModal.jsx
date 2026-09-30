import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { parseUnifiedDiff } from './diff/parseUnifiedDiff.js'
import FileDiffList from './diff/FileDiffList.jsx'
import { CapabilityContract } from './CapabilityContract.jsx'
import { approvedUpdateEntries, isPermissionUpdateEntry, isUpdateIssueEntry } from '../update-batch.js'

function fileCountLabel(count) {
  return `${count} ${count === 1 ? 'file' : 'files'}`
}

function appName(entry) {
  return entry.item?.manifest?.name || entry.item?.name || entry.item?.id || 'App'
}

function changedCapabilityPaths(diff) {
  if (!diff || typeof diff !== 'object') return []
  return [...(diff.added || []), ...(diff.removed || []), ...(diff.changed || [])]
}

function permissionSummary(entry) {
  const diff = entry.prepared?.capabilityReview?.preview?.capability_diff
  if (diff?.unknown_previous) return 'Previous access receipt is unavailable'
  const paths = changedCapabilityPaths(diff)
  return paths.length ? paths.join(', ') : 'Access could not be compared'
}

function entryError(entry) {
  return entry.error || entry.outcome?.error ||
    (entry.outcome?.conflict ? 'Local changes overlap this update.' : '')
}

function requiresAgent(entry) {
  return entry?.applyState === 'conflict' || entry?.outcome?.conflict === true
}

function reviewState(entry) {
  if (entry.disposition?.kind === 'ready') return ['Ready', 'Source and access checks passed.']
  if (isPermissionUpdateEntry(entry)) return ['Access changes', permissionSummary(entry)]
  return ['Not included', entryError(entry) || 'This update could not be verified.']
}

function DiffPreview({ entry }) {
  const diff = typeof entry.prepared?.preview?.upstream_diff === 'string'
    ? entry.prepared.preview.upstream_diff : ''
  const files = useMemo(() => parseUnifiedDiff(diff), [diff])
  const insertions = files.reduce((sum, file) => sum + (file.insertions || 0), 0)
  const deletions = files.reduce((sum, file) => sum + (file.deletions || 0), 0)
  if (!files.length) return null
  return (
    <details className="st-update-review-files">
      <summary>{fileCountLabel(files.length)} · <span className="is-add">+{insertions}</span> <span className="is-del">−{deletions}</span></summary>
      <FileDiffList files={files} />
    </details>
  )
}

export function UpdateReviewModal({
  review,
  applying = false,
  agentReviewing = false,
  error = '',
  onClose,
  onConfirm,
  onRetry,
  onReviewWithAgent,
}) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const openerRef = useRef(null)
  const entries = review?.entries || []
  const issueEntries = entries.filter(isUpdateIssueEntry)
  const conflictEntries = issueEntries.filter(requiresAgent)
  const isChecking = review?.phase === 'checking'
  const isReview = review?.phase === 'review'
  const approvedCount = isReview
    ? entries.filter(entry => entry.disposition?.kind === 'ready' || isPermissionUpdateEntry(entry)).length
    : approvedUpdateEntries(entries).length
  const busy = applying || agentReviewing
  const isIssues = review?.phase === 'issues'
  const title = isChecking
    ? review?.mode === 'batch' ? 'Checking app updates' : 'Checking app update'
    : isIssues
    ? conflictEntries.length ? 'Updates need attention' : 'Update checks incomplete'
    : review?.mode === 'batch' ? 'Review app updates' : 'Review app update'

  const requestClose = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  useEffect(() => {
    openerRef.current = document.activeElement
    if (closeRef.current && !closeRef.current.disabled) closeRef.current.focus()
    else dialogRef.current?.focus()
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
      <div
        ref={dialogRef}
        className="st-update-review"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="st-update-review-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="st-update-review-head">
          <div>
            <h2 id="st-update-review-title" className="st-update-review-title">{title}</h2>
            <p className="st-update-review-subtitle">
              {isChecking
                ? 'Nothing has been applied yet.'
                : isReview
                ? `${entries.length} ${entries.length === 1 ? 'update is' : 'updates are'} ready to review. Nothing has changed yet.`
                : isIssues
                ? conflictEntries.length
                  ? `${issueEntries.length} ${issueEntries.length === 1 ? 'app needs' : 'apps need'} attention`
                  : `${issueEntries.length} ${issueEntries.length === 1 ? 'check needs' : 'checks need'} another try`
                : 'Finishing your confirmed updates.'}
            </p>
          </div>
          <button ref={closeRef} type="button" className="st-update-review-close" onClick={requestClose} disabled={busy} aria-label="Close update review">
            <X width="1em" height="1em" aria-hidden="true" />
          </button>
        </div>

        <div className="st-update-review-body">
          {error ? <div className="st-error-box st-selectable-error" role="alert">{error}</div> : null}
          {isChecking ? (
            <div className="st-update-review-checking" role="status" aria-live="polite" aria-busy="true">
              <span className="st-update-review-checking-indicator" aria-hidden="true" />
              <div>
                <strong>Checking changes</strong>
                <p>Comparing source and access before anything updates.</p>
              </div>
            </div>
          ) : null}
          {isReview ? (
            <>
              <div className="st-update-review-notice" role="status">
                Confirming applies every verified update below, approves the disclosed access changes, and lets Möbius start resolver agents if local edits overlap. Unverified updates stay unchanged.
              </div>
              <section className="st-update-review-list" aria-label="Updates ready for confirmation">
                {entries.map(entry => {
                  const [state, summary] = reviewState(entry)
                  const permission = isPermissionUpdateEntry(entry)
                  return (
                  <article className="st-update-review-app" key={entry.item.id}>
                    <div className="st-update-review-app-head">
                      <div>
                        <h3>{appName(entry)}</h3>
                        <p>{summary}</p>
                      </div>
                      <span className="st-update-review-app-state">{state}</span>
                    </div>
                    {permission ? <CapabilityContract review={entry.prepared?.capabilityReview} isInstalled updateReview /> : null}
                    <DiffPreview entry={entry} />
                  </article>
                  )
                })}
              </section>
            </>
          ) : null}

          {!isReview && issueEntries.length > 0 ? (
            <section className="st-update-review-list" aria-label="Update issues">
              <div className="st-update-review-notice is-error" role="alert">
                {conflictEntries.length
                  ? 'Confirmed updates with local overlap are being reconciled in place. Other failures can be retried directly.'
                  : 'Some checks or updates need another try. Completed apps will not be replayed.'}
              </div>
              {issueEntries.map(entry => (
                <article className="st-update-review-app is-issue" key={entry.item.id}>
                  <div className="st-update-review-app-head">
                    <div><h3>{appName(entry)}</h3><p>{entry.applyState === 'conflict' ? 'Local changes overlap this update.' : entryError(entry) || 'The update could not be completed.'}</p></div>
                    <span className="st-update-review-app-state">{requiresAgent(entry) ? 'Needs attention' : 'Try again'}</span>
                  </div>
                  <DiffPreview entry={entry} />
                  {requiresAgent(entry) ? (
                    <button type="button" className="st-btn st-btn-secondary" onClick={() => onReviewWithAgent(entry.item.id)} disabled={busy}>
                      {entry.agentState === 'requested' ? 'Agent working' : 'Try agent again'}
                    </button>
                  ) : (
                    <button type="button" className="st-btn st-btn-secondary" onClick={() => onRetry(entry.item.id)} disabled={busy}>
                      Try again
                    </button>
                  )}
                </article>
              ))}
            </section>
          ) : null}
        </div>

        <div className="st-update-review-actions">
          <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={busy}>Not now</button>
          {isChecking ? <span className="st-update-review-checking-label" aria-hidden="true">Checking…</span> : null}
          {isReview && approvedCount > 0 ? (
            <button type="button" className="st-btn st-btn-primary" onClick={onConfirm} disabled={busy}>
              {review?.mode === 'batch' ? `Confirm & update · ${approvedCount}` : 'Confirm update'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
