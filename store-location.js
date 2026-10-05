// The Store's place (tab, filters, open collection or detail), reported to the
// Möbius shell so a frame reload — a Store self-update, cache eviction or shell
// reload — reopens where the owner was. Platforms without
// window.mobius.nav.setLocation keep the previous start-at-Browse behavior.

const TABS = new Set(['browse', 'library', 'publish'])
const QUERY_MAX = 200
const ID = /^[a-z0-9][a-z0-9:._-]{0,127}$/i

const idOrNull = value => (typeof value === 'string' && ID.test(value) ? value : null)

export function storeLocation({ tab, category, query, activeCollection, detailId }) {
  return {
    tab,
    category,
    query: String(query || '').slice(0, QUERY_MAX),
    collection: tab === 'browse' ? activeCollection || null : null,
    detail: detailId || null,
  }
}

// The saved value is app data that came back through the shell: accept only
// the known shape and fall back to the start view for anything else.
export function restoredStoreLocation(value) {
  if (!value || typeof value !== 'object' || !TABS.has(value.tab)) return null
  return {
    tab: value.tab,
    category: idOrNull(value.category) || 'all',
    query: typeof value.query === 'string' ? value.query.slice(0, QUERY_MAX) : '',
    collection: value.tab === 'browse' ? idOrNull(value.collection) : null,
    detail: idOrNull(value.detail),
  }
}

export function readStoreLocation(nav) {
  return typeof nav?.setLocation === 'function' ? restoredStoreLocation(nav.location) : null
}

export function reportStoreLocation(nav, place) {
  // Bounded fields keep this far below the platform's 4 KiB location limit.
  if (typeof nav?.setLocation === 'function') nav.setLocation(storeLocation(place))
}
