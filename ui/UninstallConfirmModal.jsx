import { useRef } from 'react'
import { useSheetFocus } from './sheetFocus.js'

export function UninstallConfirmModal({ app, busy, onConfirm, onCancel }) {
  // Browser modal dialogs don't render inside the AppCanvas iframe
  // (sandbox lacks `allow-modals`), so we ship our own confirmation.
  // Cancel is the safe default for a destructive confirm, so keyboard/AT users
  // land on "back out", not "delete"; useSheetFocus owns the rest of the
  // dialog's focus contract.
  const sheetRef = useRef(null)
  const cancelRef = useRef(null)
  useSheetFocus({ sheetRef, initialRef: cancelRef, onClose: onCancel, busy })

  return (
    <div className="st-scrim" onClick={busy ? null : onCancel}
         role="dialog" aria-modal="true" aria-labelledby="st-uninstall-title">
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
