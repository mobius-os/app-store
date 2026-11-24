// Swipe right from the left edge to go back, like a phone's own back gesture.
//
// The swipe is a shortcut for the Back control the current page already shows,
// so it inherits that control's exact behavior, including the host Back entry
// it closes. Where there is no visible Back (a tab's home page), or a dialog
// is open, the edge stays an ordinary touch.
import { useEffect, useRef } from 'react'
import { ChevronLeft } from '@openai/apps-sdk-ui/components/Icon'

// A touch must start this close to the left edge to become a back swipe, so
// sideways shelves, the spotlight and screenshot strips keep their own swipes.
export const EDGE_PX = 28
// Release past this distance, or a quick flick past FLICK_PX, goes back.
export const COMMIT_PX = 72
export const FLICK_PX = 32
export const FLICK_SPEED = 0.45 // px per ms
const DECIDE_PX = 8
const SIDEWAYS_DOMINANCE = 1.2
const TRAVEL_PX = 56 // how far the arrow follows the finger

const BACK_CONTROLS = '.st-backlink, .st-back-btn'

function shown(el) {
  if (!el?.isConnected || el.disabled || el.closest('[inert], [aria-hidden="true"], [hidden]')) return false
  return el.getClientRects().length > 0
}

// The page's own Back control, or null when the page has none (or a dialog
// sits above it, which owns its own way out).
export function findBackControl(doc) {
  if (doc.querySelector('[role="dialog"][aria-modal="true"]')) return null
  for (const el of doc.querySelectorAll(BACK_CONTROLS)) if (shown(el)) return el
  return null
}

// Whether a released swipe goes back.
export function swipeCommits(dx, dy, ms) {
  if (dx <= 0 || dx < Math.abs(dy)) return false
  if (dx >= COMMIT_PX) return true
  return dx >= FLICK_PX && dx / Math.max(ms, 1) >= FLICK_SPEED
}

const CSS = `
.st-swipeback {
  position: fixed; left: 0; top: 0; z-index: 2147483000;
  width: 44px; height: 44px; margin: -22px 0 0 -48px;
  display: grid; place-items: center; border-radius: 50%;
  color: var(--text); background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.18);
  pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity 160ms ease, transform 200ms cubic-bezier(.2,.8,.2,1), background 120ms ease, color 120ms ease;
}
.st-swipeback.is-live { visibility: visible; transition: background 120ms ease, color 120ms ease; }
.st-swipeback.is-ready { background: var(--accent); color: var(--accent-fg, #fff); border-color: transparent; }
.st-swipeback svg { width: 22px; height: 22px; }
@media (prefers-reduced-motion: reduce) { .st-swipeback { transition: none; } }
`

// Mount once inside the Store's root. It renders only the arrow that follows
// the finger; the listeners live on the document.
export function SwipeBack() {
  const arrowRef = useRef(null)
  useEffect(() => {
    const doc = document
    let swipe = null

    const place = (dx, y) => {
      const el = arrowRef.current
      if (!el) return
      const progress = Math.min(dx / COMMIT_PX, 1)
      el.classList.add('is-live')
      el.classList.toggle('is-ready', progress >= 1)
      el.style.top = `${y}px`
      el.style.opacity = String(Math.min(1, 0.25 + progress))
      el.style.transform = `translateX(${Math.min(dx, COMMIT_PX) / COMMIT_PX * TRAVEL_PX}px) scale(${0.8 + 0.2 * progress})`
    }
    const hide = () => {
      const el = arrowRef.current
      if (!el) return
      el.classList.remove('is-live', 'is-ready')
      el.style.opacity = '0'
      el.style.transform = 'translateX(0) scale(0.8)'
    }

    const onStart = (event) => {
      swipe = null
      if (event.touches.length !== 1) { hide(); return }
      const touch = event.touches[0]
      if (touch.clientX > EDGE_PX || !findBackControl(doc)) return
      swipe = { x: touch.clientX, y: touch.clientY, t: event.timeStamp, sideways: false }
    }
    const onMove = (event) => {
      if (!swipe) return
      if (event.touches.length !== 1) { swipe = null; hide(); return }
      const touch = event.touches[0]
      const dx = touch.clientX - swipe.x
      const dy = touch.clientY - swipe.y
      if (!swipe.sideways) {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return
        // Anything but a clear rightward drag is the page's own scroll.
        if (dx <= 0 || dx < Math.abs(dy) * SIDEWAYS_DOMINANCE) { swipe = null; return }
        swipe.sideways = true
      }
      if (event.cancelable) event.preventDefault()
      place(dx, touch.clientY)
    }
    const onEnd = (event) => {
      const current = swipe
      swipe = null
      if (!current?.sideways) return
      hide()
      const touch = event.changedTouches[0]
      if (!touch) return
      if (event.cancelable) event.preventDefault() // no stray tap under the finger
      if (!swipeCommits(touch.clientX - current.x, touch.clientY - current.y, event.timeStamp - current.t)) return
      // Read the control again: the page may have changed under the finger.
      findBackControl(doc)?.click()
    }
    const onCancel = () => { swipe = null; hide() }

    const passive = { passive: true, capture: true }
    const active = { passive: false, capture: true }
    doc.addEventListener('touchstart', onStart, passive)
    doc.addEventListener('touchmove', onMove, active)
    doc.addEventListener('touchend', onEnd, active)
    doc.addEventListener('touchcancel', onCancel, passive)
    return () => {
      doc.removeEventListener('touchstart', onStart, passive)
      doc.removeEventListener('touchmove', onMove, active)
      doc.removeEventListener('touchend', onEnd, active)
      doc.removeEventListener('touchcancel', onCancel, passive)
    }
  }, [])

  return (
    <div ref={arrowRef} className="st-swipeback" aria-hidden="true">
      <style>{CSS}</style>
      <ChevronLeft aria-hidden="true" />
    </div>
  )
}
