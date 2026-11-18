import { EDITORIAL_COLLECTIONS, STORE_CATEGORY_IDS } from './constants.js'
import { utf8Length } from './domain.js'

// The Store's place (tab, filters, open collection or detail), reported to the
// Möbius shell so a frame reload — a Store self-update, cache eviction or shell
// reload — reopens where the owner was. Platforms without
// window.mobius.nav.setLocation keep the previous start-at-Browse behavior.

const COLLECTION_IDS = new Set([...EDITORIAL_COLLECTIONS.map(({ id }) => id), ...STORE_CATEGORY_IDS])
const TABS = new Set(['browse', 'apps', 'games', 'search', 'library'])
const DISCOVERY_TABS = new Set(['browse', 'apps', 'games', 'search'])
const CATEGORY_IDS = new Set(STORE_CATEGORY_IDS)
const FILTERS = new Set(['all', 'needs', 'installed', 'update', 'saved', 'yours', 'setup'])
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
    collection: DISCOVERY_TABS.has(tab) ? activeCollection || null : null,
    detail: detailId || null,
  }
  // Never replace a real target with a truncated ID, or exceed the host codec.
  return utf8Length(JSON.stringify(location)) <= 4096 ? location : null
}

// The saved value is app data that came back through the shell: accept only
// the known shape and fall back to the start view for anything else.
export function restoredStoreLocation(value) {
  // The old Publish page is now Library's Your apps tab.
  if (value?.tab === 'publish') value = { ...value, tab: 'library', category: 'yours', detail: null }
  if (!value || typeof value !== 'object' || !TABS.has(value.tab)) return null
  return {
    tab: value.tab,
    category: value.tab === 'library' && FILTERS.has(value.category) ? value.category
      : (value.tab === 'apps' || value.tab === 'games') && CATEGORY_IDS.has(value.category) ? value.category
        : 'all',
    query: typeof value.query === 'string' ? value.query.slice(0, QUERY_MAX) : '',
    collection: DISCOVERY_TABS.has(value.tab) && (COLLECTION_IDS.has(value.collection) || /^dev:[^\u0000-\u001f]{1,100}$/.test(value.collection || ''))
      ? value.collection : null,
    detail: idOrNull(value.detail),
  }
}
