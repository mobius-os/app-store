// Each history entry keeps its current detail target, including retargeting
// while host ownership is pending. Forward reconstructs that same target.
// `focus` (for example 'reviews') belongs to the entry that asked for it:
// Forward restores that same entry and its focus, while every other open or
// retarget states its own, so an unrelated detail never inherits the jump.
export async function openDetailEntry(current, item, { nav, show, prepare, signal, focus = '', push = false, below = null, opener = null, cancelPendingDestination = () => {} }) {
  if (!item?.manifest) return
  prepare(item)
  // An owned app page that opens another app from itself (More by, You may
  // also like) adds a level, so Back returns to it. Other opens retarget.
  if (current.current && !(push && current.current.owned)) {
    current.current.item = item
    current.current.focus = focus
    if (!current.current.owned && opener) current.current.opener = opener
    if (current.current.owned) show(item, focus)
    return
  }
  const prev = current.current
  // `below` redraws a page that sits between this app and the previous one
  // (a category or creator opened from that app), so Back returns to it.
  const entry = { item, focus, handle: null, owned: false, prev, below, opener }
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
  if (level.below) { show(null, '', level.opener); level.below(); return }
  show(level.prev?.item ?? null, level.prev?.focus ?? '', level.opener)
}

// The Store remounts its list after detail, so the DOM node itself is gone.
// Scope duplicate listings to their shelf rather than focusing another copy.
const detailOpeners = '[data-detail-opener]'
const openerShelf = node => {
  const shelf = node.closest('section[aria-labelledby], section[aria-label]')
  return shelf?.getAttribute('aria-labelledby') ?? shelf?.getAttribute('aria-label') ?? null
}

export function detailOpenerOf(node) {
  // On older menus the focused item disappears on activation; return to More.
  if (node?.matches('[role=menuitem]')) node = node.closest('.st-rowmenu')?.querySelector(detailOpeners)
  if (!node?.matches(detailOpeners)) return null
  return { key: node.dataset.detailOpener, shelf: openerShelf(node) }
}

export function findDetailOpener(root, opener) {
  if (!opener) return null
  return [...root.querySelectorAll(detailOpeners)].find(node =>
    node.dataset.detailOpener === opener.key && openerShelf(node) === opener.shelf
  ) ?? null
}

// Run after the destination and its saved scroll position have committed.
export function focusDetailTransition(root, detail, { section, returnTo }) {
  if (!root) return
  if (returnTo !== undefined) {
    const opener = findDetailOpener(root, returnTo)
    if (opener) {
      opener.focus({ preventScroll: !detail })
      return
    }
    if (!detail) {
      const heading = root.querySelector('.st-scroll h1:not(.st-sr-only)') ?? root.querySelector('.st-scroll h1')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus({ preventScroll: true })
      return
    }
  }
  if (detail && (section !== 'reviews' || returnTo)) root.querySelector('#st-detail-name')?.focus()
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
