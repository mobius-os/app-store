// The Store's one rule for keyboard focus when a view replaces another: an app
// page, a collection, a category or creator page, a publishing step.
//
// A control that opens a view is marked `data-focus-return="<kind>:<id>"`.
// Opening records it with focusReturnOf(document.activeElement); entering
// focuses the new view's destination, and Back returns to the recorded opener:
//   focusTransition(root, { destination })            entering a view
//   focusTransition(root, { destination, returnTo })  coming back to one
// Run it once per transition, after the view and its saved scroll position
// have committed. Applying it again on a data refresh pulls focus away from
// wherever the person has moved since.

const OPENERS = '[data-focus-return]'

// Views remount their lists, so the opener's DOM node is gone by the time Back
// returns. It is found again by key, scoped to its shelf, so a listing shown
// on two shelves returns to the copy that was used.
const openerScope = node => {
  const shelf = node.closest('section[aria-labelledby], section[aria-label]')
  return shelf?.getAttribute('aria-labelledby') ?? shelf?.getAttribute('aria-label') ?? null
}

export function focusReturnOf(node) {
  // A row menu item disappears on activation, so return to the menu's More.
  // Remove once the row menu restores focus to More before running an item.
  if (node?.matches?.('[role=menuitem]')) node = node.closest('.st-rowmenu')?.querySelector(OPENERS)
  if (!node?.matches?.(OPENERS)) return null
  return { key: node.dataset.focusReturn, scope: openerScope(node) }
}

export function findFocusReturn(root, opener) {
  if (!root || !opener) return null
  return [...root.querySelectorAll(OPENERS)].find(node =>
    node.dataset.focusReturn === opener.key && openerScope(node) === opener.scope && !node.disabled
  ) ?? null
}

// The view's main heading: the first visible h1 of the scrolling page.
export function viewHeading(root) {
  const page = root.querySelector('.st-scroll') ?? root
  return page.querySelector('h1:not(.st-sr-only)') ?? page.querySelector('h1')
}

// `destination` is an element or a function of `root` that finds one; it is
// where entering lands, and where Back lands when the opener is gone.
// `returnTo` is the opener recorded on the way in. Returns what it focused.
export function focusTransition(root, { destination = null, returnTo } = {}) {
  if (!root) return null
  // A control that outlived the swap keeps focus: the person chose it (another
  // Library tab, say), and only a removed control leaves focus with nowhere to go.
  const current = root.ownerDocument.activeElement
  if (current && current !== root.ownerDocument.body && current.isConnected) return null
  const opener = findFocusReturn(root, returnTo)
  if (opener) {
    opener.focus()
    return opener
  }
  const target = typeof destination === 'function' ? destination(root) : destination
  if (!target) return null
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  // An entered view starts at its top; a Back keeps its restored position.
  target.focus({ preventScroll: true })
  return target
}
