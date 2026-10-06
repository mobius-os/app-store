import { CATALOG_COLLECTIONS, EDITORIAL_COLLECTIONS } from './constants.js'
import { utf8Length } from './domain.js'

// The Store's place (tab, filters, open collection or detail), reported to the
// Möbius shell so a frame reload — a Store self-update, cache eviction or shell
// reload — reopens where the owner was. Platforms without
// window.mobius.nav.setLocation keep the previous start-at-Browse behavior.

const COLLECTION_IDS = new Set([...CATALOG_COLLECTIONS, ...EDITORIAL_COLLECTIONS].map(({ id }) => id))
const TABS = new Set(['browse', 'library', 'publish'])
const FILTERS = new Set(['all', 'update', 'setup'])
const QUERY_MAX = 200
const ID = /^[a-z0-9][a-z0-9:._-]{0,127}$/i

const idOrNull = value => (
  typeof value === 'string' && ID.test(value) && !['community:.', 'community:..'].includes(value)
    ? value : null
)

export function storeLocation({ tab, category, query, activeCollection, detailId }) {
  const location = {
    tab,
    category,
    query: String(query || '').slice(0, QUERY_MAX),
    collection: tab === 'browse' ? activeCollection || null : null,
    detail: detailId || null,
  }
  // Never replace a real target with a truncated ID, or exceed the host codec.
  return utf8Length(JSON.stringify(location)) <= 4096 ? location : null
}

// The saved value is app data that came back through the shell: accept only
// the known shape and fall back to the start view for anything else.
export function restoredStoreLocation(value) {
  if (!value || typeof value !== 'object' || !TABS.has(value.tab)) return null
  return {
    tab: value.tab,
    category: value.tab === 'library' && FILTERS.has(value.category) ? value.category : 'all',
    query: typeof value.query === 'string' ? value.query.slice(0, QUERY_MAX) : '',
    collection: value.tab === 'browse' && COLLECTION_IDS.has(value.collection)
      ? value.collection : null,
    detail: idOrNull(value.detail),
  }
}
