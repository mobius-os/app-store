import React, { useCallback, useEffect, useRef } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { IconBox } from './IconBox.jsx'

function rowStatus(batch, item) {
  const result = batch.results?.[item.id]
  if (result?.status === 'uninstalled') return 'Uninstalled'
  if (result?.status === 'error') return 'Needs attention'
  if (batch.phase === 'uninstalling' && batch.currentItemId === item.id) return 'Uninstalling…'
  return 'Ready to uninstall'
}

export function BatchUninstallModal({ batch, token, onClose, onConfirm }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const busy = batch.phase === 'uninstalling'
  const done = batch.phase === 'done'
  const completed = Object.values(batch.results || {}).filter(row => row.status === 'uninstalled').length
  const failed = Object.values(batch.results || {}).filter(row => row.status === 'error').length
  const requestClose = useCallback(() => { if (!busy) onClose() }, [busy, onClose])

  useEffect(() => {
    closeRef.current?.focus()
    const key = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [requestClose])

  return (
    <div className="st-batch-scrim" role="presentation" onClick={requestClose}>
      <div ref={dialogRef} className="st-batch-review" role="dialog" aria-modal="true" aria-labelledby="st-uninstall-title" onClick={event => event.stopPropagation()}>
        <div className="st-batch-head">
          <div>
            <h2 id="st-uninstall-title" className="st-batch-title">{done ? 'Uninstall complete' : 'Review apps to uninstall'}</h2>
            <p className="st-batch-subtitle">{done ? `${completed} uninstalled${failed ? ` · ${failed} need attention` : ''}` : `${batch.items.length} selected · one final confirmation`}</p>
          </div>
          <button ref={closeRef} type="button" className="st-batch-close" onClick={requestClose} disabled={busy} aria-label="Close uninstall review"><X width="1em" height="1em" /></button>
        </div>
        <div className="st-batch-body">
          {!done ? <div className="st-batch-guidance is-warning">These apps will disappear from your workspace. Their saved data remains recoverable for 7 days.</div> : null}
          <div className="st-batch-list">
            {batch.items.map(item => {
              const result = batch.results?.[item.id]
              const active = busy && batch.currentItemId === item.id
              const complete = result?.status === 'uninstalled'
              return (
                <div className={`st-batch-item st-batch-flat${result ? ` is-${result.status}` : ''}`} key={item.id}>
                  <div className="st-batch-row">
                    <span className="st-batch-icon"><IconBox item={item} token={token} /></span>
                    <span className="st-batch-item-copy"><strong>{item.manifest?.name || item.name || item.id}</strong><small>{rowStatus(batch, item)}</small></span>
                  </div>
                  <div className={`st-item-progress${active ? ' is-active' : ''}${complete ? ' is-complete' : ''}${result?.status === 'error' ? ' is-error' : ''}`} role="progressbar" aria-label={`${item.manifest?.name || item.id} uninstall progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={complete || result?.status === 'error' ? 100 : active ? undefined : 0}><span /></div>
                  {result?.status === 'error' ? <div className="st-error-box" role="alert">{result.error}</div> : null}
                </div>
              )
            })}
          </div>
        </div>
        <div className="st-batch-actions">
          {done ? <button type="button" className="st-btn st-btn-primary" onClick={requestClose}>Done</button> : <>
            <button type="button" className="st-btn st-btn-ghost" onClick={requestClose} disabled={busy}>Back</button>
            <button type="button" className="st-btn st-btn-danger" onClick={onConfirm} disabled={busy}>{busy ? `Uninstalling ${(batch.currentItemIndex ?? 0) + 1} of ${batch.items.length}…` : `Uninstall ${batch.items.length} ${batch.items.length === 1 ? 'app' : 'apps'}`}</button>
          </>}
        </div>
      </div>
    </div>
  )
}
