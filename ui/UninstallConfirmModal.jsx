import { useCallback, useEffect, useRef } from 'react'

export function UninstallConfirmModal({ app, busy, onConfirm, onCancel }) {
  // Browser modal dialogs don't render inside the AppCanvas iframe
  // (sandbox lacks `allow-modals`), so we ship our own confirmation.
  // A custom dialog has to carry its own focus contract — the platform gives
  // a real <dialog> these for free, but role="dialog" alone does not:
  //   - move focus into the dialog on open (Cancel, the non-destructive default)
  //   - keep Tab/Shift+Tab cycling WITHIN the dialog while it's open
  //   - close on Escape
  //   - return focus to whatever opened it when it closes
  const sheetRef = useRef(null)
  const cancelRef = useRef(null)
  // Capture the opener exactly once, at mount, before focus moves into the
  // dialog — this is the element focus returns to on close. A ref (not state)
  // because it must survive every render without being a dependency.
  const openerRef = useRef(null)

  // Focus the Cancel button on open and restore the opener's focus on close.
  // Cancel is the safe default for a destructive confirm, so keyboard/AT users
  // land on "back out", not "delete".
  useEffect(() => {
    openerRef.current = document.activeElement
    cancelRef.current?.focus()
    return () => {
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [])

  // Escape closes; Tab is trapped to the dialog's focusable elements so focus
  // can't wander to the inert grid behind the scrim. We compute the focusable
  // set per-keydown rather than caching it: the action labels (Cancel /
  // Uninstall ↔ Uninstalling…) and their disabled state change with `busy`, so
  // a cached list would trap against stale nodes.
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (!busy) onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = sheetRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) {
      // Everything is disabled (mid-uninstall) — keep focus pinned in-dialog.
      e.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }, [busy, onCancel])

  return (
    <div className="st-scrim" onClick={busy ? null : onCancel}
         role="dialog" aria-modal="true" aria-labelledby="st-uninstall-title"
         onKeyDown={onKeyDown}>
      <div className="st-sheet" ref={sheetRef} onClick={e => e.stopPropagation()}>
        <h3 className="st-sheet-title" id="st-uninstall-title">Uninstall {app.name}?</h3>
        <p className="st-sheet-body">
          This disables the app, removes its agent instructions, skills, and
          scheduled jobs, and hides it from Möbius. Its private files are kept
          temporarily for recovery; shared files it created are not erased
          automatically.
        </p>
        <div className="st-sheet-actions">
          <button className="st-btn st-btn-secondary" ref={cancelRef}
                  onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="st-btn st-btn-danger"
                  onClick={onConfirm} disabled={busy}>
            {busy ? 'Uninstalling…' : 'Uninstall'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Map the card's app-state variant to its modifier class. 'default' is the
// bare .st-card; the rest add the matching is-* modifier.
