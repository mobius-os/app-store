import { useEffect, useRef, useState } from 'react'

// Download and update progress: the action button itself
// fills in place. It always plays: it starts on tap, stays at least
// MIN_VISIBLE_MS however fast the work is, then completes the fill and hands
// back to the button's own label. Installs report no real percentage, so the
// fill eases toward 90% and keeps slowing; a real fraction (Update all) steers
// it instead. The button keeps the size it had on tap, so nothing shifts.
export const MIN_VISIBLE_MS = 1000

const RUNNING = { target: 0.9, rate: 1 / 2600 }
// Frames when the page paints them; a timer where there is no frame clock.
const nextFrame = (cb) => (typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame(cb) : setTimeout(() => cb(performance.now()), 16))
const cancelFrame = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id))
const FINISHING = { target: 1.02, rate: 1 / 140 }

export function ProgressFill({ busy, label, value = null, children }) {
  const [phase, setPhase] = useState(busy ? 'running' : 'idle')   // idle | running | finishing
  const startedRef = useRef(busy ? performance.now() : 0)
  const heldRef = useRef(busy ? children : null)
  const labelRef = useRef(label)
  const layerRef = useRef(null)
  const motion = useRef({ p: 0, ...RUNNING })
  if (busy && label) labelRef.current = label

  if (busy && phase === 'idle') {
    // Freeze what the button showed on tap; it keeps the button's width.
    heldRef.current = children
  }

  useEffect(() => {
    if (busy) {
      if (phase !== 'running') {
        if (phase === 'idle') {
          startedRef.current = performance.now()
          motion.current = { p: 0, ...RUNNING }
        } else {
          Object.assign(motion.current, RUNNING)
        }
        setPhase('running')
      }
      return undefined
    }
    if (phase !== 'running') return undefined
    const wait = Math.max(0, startedRef.current + MIN_VISIBLE_MS - performance.now())
    const timer = setTimeout(() => {
      Object.assign(motion.current, FINISHING)
      setPhase('finishing')
    }, wait)
    return () => clearTimeout(timer)
  }, [busy, phase])

  useEffect(() => {
    if (phase === 'running' && value != null) {
      motion.current.target = Math.min(0.95, Math.max(0.08, value))
    }
  }, [phase, value])

  useEffect(() => {
    if (phase === 'idle') return undefined
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let last = performance.now()
    let doneTimer = 0
    const tick = (now) => {
      const m = motion.current
      const dt = Math.min(64, now - last)
      last = now
      m.p = reduced ? m.target : m.p + (m.target - m.p) * (1 - Math.exp(-dt * m.rate))
      layerRef.current?.style.setProperty('--p', Math.min(1, m.p).toFixed(4))
      if (phase === 'finishing' && m.p > 0.995) {
        doneTimer = setTimeout(() => setPhase('idle'), 120)
        return
      }
      frame = nextFrame(tick)
    }
    frame = nextFrame(tick)
    return () => { cancelFrame(frame); clearTimeout(doneTimer) }
  }, [phase])

  if (phase === 'idle' && !busy) return children
  const shown = labelRef.current
  return (
    <>
      <span className="st-fillp-hold" aria-hidden="true">{heldRef.current}</span>
      <span className="st-fillp" ref={layerRef} role="progressbar" aria-label={shown}>
        <span className="st-fillp-bar" />
        <span className="st-fillp-text">
          <span>{shown}</span>
          <span className="is-on" aria-hidden="true">{shown}</span>
        </span>
      </span>
    </>
  )
}
