import { useEffect } from 'react'

// The focus contract every hand-rolled sheet owes, because browser <dialog>
// modals don't render inside the sandboxed app frame:
//   - move focus into the sheet on open (initialRef, the safe default)
//   - keep Tab / Shift+Tab cycling within the sheet
//   - close on Escape (unless busy)
//   - return focus to whatever opened it on close
// Listeners sit on the document so Escape works wherever focus is.
export function useSheetFocus({ sheetRef, initialRef, onClose, busy = false }) {
  useEffect(() => {
    const opener = document.activeElement
    initialRef?.current?.focus()
    return () => {
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
    }
    // Runs once per open: the sheet mounts when it opens and unmounts when it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (!busy) onClose()
        return
      }
      if (event.key !== 'Tab') return
      // Computed per keydown: labels and disabled states change while busy.
      const focusable = sheetRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = sheetRef.current?.contains(active)
      if (!inside) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sheetRef, onClose, busy])
}
