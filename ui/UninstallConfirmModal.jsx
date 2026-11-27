import { useRef } from 'react'
import { useSheetFocus } from './sheetFocus.js'

export function UninstallConfirmModal({ app, busy, failure, onConfirm, onCheckStatus, onCancel }) {
  // Browser modal dialogs don't render inside the AppCanvas iframe
  // (sandbox lacks `allow-modals`), so we ship our own confirmation.
  // Cancel is the safe default for a destructive confirm, so keyboard/AT users
  // land on "back out", not "delete"; useSheetFocus owns the rest of the
  // dialog's focus contract.
  const sheetRef = useRef(null)
  const cancelRef = useRef(null)
  useSheetFocus({ sheetRef, initialRef: cancelRef, onClose: onCancel, busy })
  const unknown = failure?.outcome === 'unknown'

  return (
    <div className="st-scrim" onClick={busy ? null : onCancel}
         role="dialog" aria-modal="true" aria-labelledby="st-uninstall-title">
      <div className="st-sheet" ref={sheetRef} onClick={e => e.stopPropagation()}>
        <h3 className="st-sheet-title" id="st-uninstall-title">Uninstall {app.name}?</h3>
        <p className="st-sheet-body">
          This disables the app, removes its agent instructions, skills, and
          scheduled jobs, and hides it from Möbius. You can recover its private
          files by reinstalling within 7 days; shared files it created are not erased
          automatically.
        </p>
        {failure ? (
          <div className="st-detail-note">
            <strong role="alert">{unknown ? 'Couldn’t confirm whether the app was removed.' : `${app.name} is still installed.`}</strong>
            {unknown ? <span>Check its status before trying to uninstall again.</span> : null}
            {failure.detail ? <details><summary>Details</summary><span>{failure.detail}</span></details> : null}
          </div>
        ) : null}
        <div className="st-sheet-actions">
          <button className="st-btn st-btn-secondary" ref={cancelRef}
                  onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className={`st-btn ${unknown ? 'st-btn-primary' : 'st-btn-danger'}`}
                  onClick={unknown ? onCheckStatus : onConfirm} disabled={busy}>
            {unknown ? (busy ? 'Checking…' : 'Check status')
              : busy ? 'Uninstalling…' : failure ? 'Try uninstall again' : 'Uninstall'}
          </button>
        </div>
      </div>
    </div>
  )
}
