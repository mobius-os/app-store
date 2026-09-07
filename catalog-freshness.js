import { communityCatalogPage, mergeCommunityCatalog } from './domain.js'

// Only the visible Store polls; returning to the browser or reconnecting
// revalidates immediately. The owner of requests handles cancellation/errors.
export function watchCatalogFreshness(refresh, { win = window, doc = document } = {}) {
  const check = () => {
    if (doc.visibilityState !== 'hidden' && win.navigator.onLine !== false) refresh()
  }
  const timer = win.setInterval(check, 60_000)
  win.addEventListener('online', check)
  win.addEventListener('focus', check)
  doc.addEventListener('visibilitychange', check)
  return () => {
    win.clearInterval(timer)
    win.removeEventListener('online', check)
    win.removeEventListener('focus', check)
    doc.removeEventListener('visibilitychange', check)
  }
}

// Return one complete window; callers commit it only after every page succeeds.
export async function loadCommunityWindow(loadPage, { offset = 0, limit = 24, target = 24 } = {}) {
  let items = []
  let nextOffset = offset
  let page
  do {
    page = communityCatalogPage(await loadPage({ limit, offset: nextOffset }), limit)
    items = mergeCommunityCatalog(items, page.items)
    const following = page.nextCursor ? Number(page.nextCursor) : nextOffset + page.rowCount
    if (page.hasMore && following <= nextOffset) throw new Error('Community pagination did not advance.')
    nextOffset = following
  } while (page.hasMore && page.rowCount > 0 && nextOffset < target)
  return { items, nextOffset, hasMore: page.hasMore }
}
