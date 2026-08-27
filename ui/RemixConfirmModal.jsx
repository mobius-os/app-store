import { useCallback, useEffect, useRef, useState } from 'react'

export function RemixConfirmModal({ item, busy, error, onConfirm, onCancel }) {
  const [name, setName] = useState(`${item.manifest?.name || item.name} Remix`)
  const [confirmed, setConfirmed] = useState(false)
  const sheetRef = useRef(null)
  const nameRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    openerRef.current = document.activeElement
    nameRef.current?.focus()
    nameRef.current?.select()
    return () => openerRef.current?.focus?.()
  }, [])

  const onKeyDown = useCallback((event) => {
    if (event.key === 'Escape' && !busy) return onCancel()
    if (event.key !== 'Tab') return
    const focusable = sheetRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable?.length) return event.preventDefault()
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus()
    }
  }, [busy, onCancel])

  const valid = name.trim().length > 0 && confirmed
  return (
    <div className="st-scrim" role="dialog" aria-modal="true" aria-labelledby="st-remix-title"
         onKeyDown={onKeyDown} onClick={busy ? null : onCancel}>
      <div className="st-sheet" ref={sheetRef} onClick={(event) => event.stopPropagation()}>
        <h3 className="st-sheet-title" id="st-remix-title">Make this app yours</h3>
        <p className="st-sheet-body">
          Using the GitHub connection from Contribute, Möbius will create a new public repository
          from this preserved release and record its exact lineage. The credential stays local;
          you’ll still review the remix’s access before installing it.
        </p>
        <label className="st-remix-field">
          <span>Remix name</span>
          <input ref={nameRef} value={name} maxLength={120}
                 onChange={(event) => setName(event.target.value)} disabled={busy} />
        </label>
        <label className="st-publish-consent">
          <input type="checkbox" checked={confirmed} disabled={busy}
                 onChange={(event) => setConfirmed(event.target.checked)} />
          <span>I want this remix’s source and lineage to be public on GitHub.</span>
        </label>
        {error && <div className="st-community-feedback-error" role="alert">{error}</div>}
        <div className="st-sheet-actions">
          <button className="st-btn st-btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="st-btn st-btn-primary" onClick={() => onConfirm(name.trim())}
                  disabled={busy || !valid}>{busy ? 'Creating remix…' : 'Create remix'}</button>
        </div>
      </div>
    </div>
  )
}
