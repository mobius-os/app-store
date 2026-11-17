// Each history entry keeps its current detail target, including retargeting
// while host ownership is pending. Forward reconstructs that same target.
// `focus` (for example 'reviews') belongs to the entry that asked for it:
// Forward restores that same entry and its focus, while every other open or
// retarget states its own, so an unrelated detail never inherits the jump.
export async function openDetailEntry(current, item, { nav, show, prepare, signal, focus = '', push = false, below = null, cancelPendingDestination = () => {} }) {
  if (!item?.manifest) return
  prepare(item)
  // An owned app page that opens another app from itself (More by, You may
  // also like) adds a level, so Back returns to it. Other opens retarget.
  if (current.current && !(push && current.current.owned)) {
    current.current.item = item
    current.current.focus = focus
    if (current.current.owned) show(item, focus)
    return
  }
  const prev = current.current
  // `below` redraws a page that sits between this app and the previous one
  // (a category or creator opened from that app), so Back returns to it.
  const entry = { item, focus, handle: null, owned: false, prev, below }
  entry.handle = nav.open('app-store-detail', {
    onBack: () => { cancelPendingDestination(); current.current = entry.prev; showBelow(entry, show) },
    onForward: () => { cancelPendingDestination(); current.current = entry; show(entry.item, entry.focus) },
  })
  current.current = entry
  const cancel = () => {
    if (current.current === entry) current.current = prev
    entry.handle.close()
  }
  signal?.addEventListener('abort', cancel, { once: true })
  const { status } = await entry.handle.outcome
  signal?.removeEventListener('abort', cancel)
  if (current.current !== entry) { entry.handle.close(); return }
  if (status !== 'owned') { current.current = prev; return }
  entry.owned = true
  show(entry.item, entry.focus)
}

function showBelow(level, show) {
  if (level.below) { show(null); level.below(); return }
  show(level.prev ? level.prev.item : null, level.prev ? level.prev.focus : '')
}

// The on-screen Back: one level.
export function backDetailEntry(current, show) {
  const level = current.current
  if (!level) { show(null); return }
  level.handle.close()
  current.current = level.prev
  showBelow(level, show)
}

// Leaving the app pages altogether (to a creator, a category, another tab).
export function closeDetailEntry(current, show) {
  for (let level = current.current; level; level = level.prev) level.handle.close()
  current.current = null
  show(null)
}
