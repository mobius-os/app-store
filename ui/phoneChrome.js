import { useCallback, useEffect, useRef, useState } from 'react'

// Phones get the Store's own compact layout: a bottom tab bar (with Search as
// its own tab) and a title row on each page instead of the desktop header.
export const PHONE_QUERY = '(max-width: 680px)'

export function usePhoneLayout() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia?.(PHONE_QUERY)
    if (!media) return undefined
    const sync = () => setPhone(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])
  return phone
}

// The compact layout follows the Store's own frame width, so a narrow desktop
// pane gets it too. Hiding Möbius's bars is different: Möbius answers by giving
// the Store the whole window, which on a desktop would cover the owner's other
// panes and then widen the Store out of its compact layout, so it would hand the
// window back and ask again in a loop. Only a phone-sized screen asks.
export function isPhoneScreen(screenValue = typeof window !== 'undefined' ? window.screen : null) {
  const width = Number(screenValue?.width)
  const height = Number(screenValue?.height)
  if (!(width > 0) || !(height > 0)) return false
  return Math.min(width, height) <= 680
}

// On a phone the Store asks Möbius to step its own bars aside, so the owner is
// not looking at two stacked toolbars. The request is made each time the Store
// comes on screen (Möbius drops it whenever the owner leaves). Tapping the
// Möbius button brings the bars back and the Store leaves them be until the
// owner's next visit. Wider screens always keep the Möbius bars.
export function useMobiusBars(compactLayout) {
  const phone = compactLayout && isPhoneScreen()
  const [barsHidden, setBarsHidden] = useState(false)
  const keptRef = useRef(false)
  useEffect(() => {
    const mobius = window.mobius
    const immersive = mobius?.immersive
    if (!immersive?.set) return undefined
    const stopBars = immersive.subscribe?.(setBarsHidden) || (() => {})
    if (!phone) {
      if (immersive.hidden) immersive.set(false)
      return stopBars
    }
    const request = () => { if (!keptRef.current && !immersive.hidden) immersive.set(true) }
    const stopVisibility = typeof mobius.onVisibilityChange === 'function'
      ? mobius.onVisibilityChange((visible) => {
          if (visible) request()
          else keptRef.current = false
        })
      : (request(), () => {})
    return () => { stopVisibility(); stopBars() }
  }, [phone])
  const showMobius = useCallback(() => {
    keptRef.current = true
    window.mobius?.immersive?.set(false)
  }, [])
  return { barsHidden, showMobius }
}
