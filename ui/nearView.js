import { useEffect, useRef, useState } from 'react'

// Remote listing art is fetched through the proxy at full size, so the Store
// only starts a fetch once its spot is within about a screen of view. One
// observer per scroll container (the Store page, an app page) reads ahead
// vertically; sideways shelves load as they scroll. Where there is no
// IntersectionObserver the image simply loads at once.
const observers = new Map()
const pending = new WeakMap()
const LOOKAHEAD = '900px 0px'

function observerFor(root) {
  if (typeof IntersectionObserver !== 'function') return null
  let observer = observers.get(root)
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const reveal = pending.get(entry.target)
        pending.delete(entry.target)
        observer.unobserve(entry.target)
        reveal?.()
      }
    }, { root, rootMargin: LOOKAHEAD })
    observers.set(root, observer)
  }
  return observer
}

export function useNearView(enabled = true) {
  const ref = useRef(null)
  const [near, setNear] = useState(() => !enabled || typeof IntersectionObserver !== 'function')
  useEffect(() => {
    if (near) return undefined
    if (!enabled) { setNear(true); return undefined }
    const element = ref.current
    if (!element) return undefined
    const root = element.closest('.st-scroll') || null
    const observer = observerFor(root)
    if (!observer) { setNear(true); return undefined }
    pending.set(element, () => setNear(true))
    observer.observe(element)
    return () => { pending.delete(element); observer.unobserve(element) }
  }, [near, enabled])
  return [ref, near]
}
