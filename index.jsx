import { mapWithConcurrency, createUpdateBatch, updateBatchBusy, newestBatchSnapshot, normalizeBatchSnapshot, batchProgress as batchProgressOf } from './update-batch.js'
import { openDetailEntry, closeDetailEntry, backDetailEntry } from './store-navigation.js'
import { restoredStoreLocation, storeLocation } from './store-location.js'
import { watchCatalogFreshness, loadCommunityWindow } from './catalog-freshness.js'
// App Store — thin app shell. The module tree is declared in mobius.json's
// source_files; the multi-file installer fetches each path and Rolldown bundles
// from this entry, resolving the relative imports below at compile time.
//
//   constants.js  — curated catalog, self-update constants, trusted hosts,
//                    and permission explanation tables
//   theme.js      — the single app stylesheet (CSS)
//   domain.js     — pure + DOM-level URL, version, schedule, and update-message logic
//   api.js        — catalog fetch, install/update, app list, and chat API helpers
//   ui/*.jsx      — one React component per file
//
// Only App lives here: it owns top-level catalog/install/navigation state and
// mounts marketplace browsing, publishing, app details, update review, and toast.
import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { CATALOG, CATALOG_URL, COMMUNITY_CATEGORIES } from './constants.js'
import { CSS } from './theme.js'
import {
  buildUpdateFailureMessage,
  buildUpdateReviewMessage,
  buildListingAgentMessage,
  listingAgentScope,
  buildPublishCheckMessage,
  buildPublishFixMessage,
  listingDraftFromPreview,
  listingPayload,
  utf8Length,
  appLifecycleFor,
  busyLabelForAction,
  storeDestinationFromMessage,
  capabilityDiffNeedsReview,
  updateBatchDisposition,
  hasAccessRows,
  catalogUpdateItemForInstalled,
  collectCategories,
  sourceAvailabilityStatus,
  communityCatalogPage,
  communityRanking,
  COMMUNITY_RANKINGS,
  communityCatalogItems,
  communityPublicationStatus,
  communityPublicationsByLocalApp,
  publicationViewerHandle,
  communityRepositoryUrl,
  filterCatalog,
  findInstalled,
  isSystemCatalogItem,
  mergeCatalogEntries,
  storeCategory,
  libraryCollections,
  catalogCategory,
  catalogPublisher,
  withAssignedCategories,
  mergeCommunityCatalog,
  mergeOfficialCommunityFeedback,
  otherInstalledCatalogItems,
  communityFeedbackOf,
  mobiusAccountStatus,
  reviewAccountAction,
  communityRatingAggregate,
  communityReceiptAfterInstall,
  communityReceiptToReconcile,
  rememberCommunityInstallRevision,
  installedCommunityRevision,
  attemptCommunityReceiptOnce,
  manifestCapabilityRows,
  resolveCatalogItemIntent,
  setInstalledMatchViewer,
  sourceBackedInstalledApps,
  needsLiveManifestFirst,
  showsSnapshotManifest,
  sortCatalogForDisplay,
  storeListingLink,
  updateCandidateUrlsByInstalledId,
} from './domain.js'
import {
  createAppChat,
  latestScopedAppChat,
  sendToScopedAgentChat,
  createConflictResolverChat,
  createConflictResolverBatch,
  submitUpdateBatch,
  batchRoutesMissing,
  randomUuid,
  loadUpdateBatches,
  loadUpdateBatch,
  watchUpdateBatch,
  fetchCatalog,
  fetchManifest,
  fetchUninstalledApps,
  fetchUpdateCheck,
  hasConnectedProvider,
  installApp,
  loadCommunityApps,
  loadCommunityApp,
  loadCommunityReviews,
  loadCommunityIdentity,
  loadEditorialSpotlight,
  loadLocalGithubIdentity,
  loadCommunityPublications,
  loadLocalPublicationPreview,
  createPublicationListingReader,
  prepareListingImage,
  saveLocalListing,
  loadInstalledApps,
  loadProviderStatus,
  loadUpdateCandidatePreview,
  publishLocalAppToGithub,
  publishEditorialSpotlight,
  registerCommunityRevision,
  saveCommunityReview,
  withdrawCommunityApp,
  recordCommunityInstall,
  uploadEditorialArtwork,
  openChat,
  openInstalledApp,
  openSystemSettings,
  previewApp,
  readSetupCompletions,
  readSystemSetupReady,
  seedChatMessage,
  SETUP_COMPLETIONS_KEY,
  SYSTEM_SETUP_READY_KEY,
} from './api.js'
import { CatalogList } from './ui/CatalogList.jsx'
import { CatalogCard } from './ui/CatalogCard.jsx'
import { ResolveAllButton, UpdateAllButton } from './ui/LibraryActions.jsx'
import { LibraryTabs, libraryTabFor } from './ui/LibraryTabs.jsx'
import { CatalogSkeleton } from './ui/CatalogSkeleton.jsx'
import { DetailView } from './ui/DetailView.jsx'
import { PublisherTab } from './ui/PublisherTab.jsx'
import { SelfUpdateSheet, useSelfUpdate } from './ui/SelfUpdate.jsx'
import { UninstallConfirmModal } from './ui/UninstallConfirmModal.jsx'
import { UpdateReviewModal, UpdateAgentChooser } from './ui/UpdateReviewModal.jsx'
import { useMobiusBars, usePhoneLayout } from './ui/phoneChrome.js'
import { ChevronLeft, Compass, Grid, Plus, Search, Stack, X } from '@openai/apps-sdk-ui/components/Icon'
import { CategoryIcon, Gamepad } from './ui/CategoryBrowse.jsx'

export {
  appLifecycleFor,
  buildListingAgentMessage,
  listingDraftFromPreview,
  listingPayload,
  savedListingSurvived,
  utf8Length,
  busyLabelForAction,
  catalogItemIdFromIntent,
  catalogItemIdFromMessage,
  storeDestinationFromIntent,
  storeDestinationFromMessage,
  capabilityDiffNeedsReview,
  hasAccessRows,
  catalogUpdateItemForInstalled,
  canonicalIdentityKey,
  CARD_DESCRIPTION_LIMIT,
  catalogAudience,
  catalogCardDescription,
  catalogCategory,
  catalogKind,
  installsLabel,
  rankedApps,
  recentlyUpdatedApps,
  recentUpdates,
  newArrivals,
  highestRated,
  sortCategoryApps,
  topRatedApps,
  communityRanking,
  withAssignedCategories,
  collectCategories,
  sourceAvailabilityStatus,
  communityCatalogPage,
  communityCatalogItems,
  communityPublicationStatus,
  communityPublicationsByLocalApp,
  communityRepositoryUrl,
  filterCatalog,
  findInstalled,
  isSystemCatalogItem,
  mergeCatalogEntries,
  mergeCommunityCatalog,
  mergeOfficialCommunityFeedback,
  otherInstalledCatalogItems,
  communityFeedbackOf,
  communityRatingAggregate,
  communityReceiptAfterInstall,
  communityReceiptToReconcile,
  rememberCommunityInstallRevision,
  installedCommunityRevision,
  attemptCommunityReceiptOnce,
  manifestCapabilityRows,
  resolveCatalogItemIntent,
  humanCron,
  isTrustedHost,
  scheduleSummary,
  sourceBackedInstalledApps,
  needsLiveManifestFirst,
  showsSnapshotManifest,
  sortCatalogForDisplay,
  updateBatchDisposition,
  updateCandidateUrlsByInstalledId,
  validateManifestUrl,
} from './domain.js'
export { STORE_VERSION } from './constants.js'
export {
  fetchCatalog,
  fetchManifest,
  fetchUpdateCheck,
  installApp,
  loadCommunityApps,
  loadCommunityApp,
  loadCommunityReviews,
  loadCommunityIdentity,
  loadEditorialSpotlight,
  loadLocalGithubIdentity,
  loadCommunityPublications,
  loadLocalPublicationPreview,
  loadInstalledApps,
  publishLocalAppToGithub,
  publishEditorialSpotlight,
  registerCommunityRevision,
  saveCommunityReview,
  recordCommunityInstall,
  withdrawCommunityApp,
  uploadEditorialArtwork,
  previewApp,
  proxyUrl,
  readErrorDetail,
} from './api.js'
export { capabilityChangeRows, capabilityRows, changedCapabilityPaths } from './ui/CapabilityContract.jsx'
export { appIcon, installedIconUrl } from './ui/IconBox.jsx'
export { catalogAssetFilename, catalogAssetUrl, storeAssetSource, storeAssetUrl } from './ui/StoreImage.jsx'
export { createPublicationPreviewGate } from './ui/PublisherTab.jsx'

// Snapshot-less catalogs (catalog.json is now a pure discovery index) hydrate
// every entry's manifest from its repo on open — ~16 fetches — so a 3-wide pool
// left first paint needlessly slow. 6 keeps concurrency modest against the raw
// CDN while roughly halving the hydrate wall time.
const MANIFEST_FETCH_CONCURRENCY = 6
const DISCOVERY_TABS = new Set(['browse', 'apps', 'games', 'search'])
// Bottom-bar icons for phones; the same sections as the header tabs. The SDK
// has no controller glyph, so Games reuses the Store's own Gamepad.
const TAB_ICONS = { browse: Compass, apps: Grid, games: Gamepad, library: Stack, search: Search }
const STORE_TABS = [
  { id: 'browse', label: 'Discover' },
  { id: 'apps', label: 'Apps' },
  { id: 'games', label: 'Games' },
  { id: 'library', label: 'Library' },
]
// Phones search from their own tab, like the iPhone App Store; wider screens
// keep the search field in the header.
const PHONE_TABS = [...STORE_TABS, { id: 'search', label: 'Search' }]
// The first window of community listings behind Discover, categories and the
// ranked shelves; their pages offer Load more for the rest.
const COMMUNITY_BROWSE_WINDOW = 96
// How many apps each registry ranking returns for its shelf.
const RANKED_SHELF_SIZE = 50

function Toast({ toast, onDismiss }) {
  if (!toast) return null
  const className = `st-toast${toast.kind === 'success' ? ' is-success' : toast.kind === 'error' ? ' is-error' : ''}`
  return (
    <div
      className={className}
      role="status"
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
    >
      <div className="st-toast-msg">{toast.message}</div>
      <div className="st-toast-actions">
        {toast.action && (
          <button
            className="st-toast-btn st-toast-btn-primary"
            onClick={() => {
              onDismiss()
              toast.action.onClick?.()
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button className="st-toast-btn st-toast-btn-secondary" onClick={onDismiss}>
          OK
        </button>
      </div>
    </div>
  )
}

// Why the platform refuses a candidate for an installed app (the update
// preview's 409 detail, as update-check's `candidate_rejected`).
const CANDIDATE_REJECTION_CODES = new Set(['identity_mismatch', 'repository_moved'])

// Probe GET /api/apps/{id}/update-check for the given installed rows and return
// a { [numericAppId]: source-provenance facts } map.
// Use the same bounded pool as manifest refetches. fetchUpdateCheck never
// throws; callers merge answered ids and leave unavailable rows unknown. Every
// source-backed installed row shares this authority.
async function fetchUpdateChecksFor(rows, token, catalogItems = []) {
  if (!rows.length) return {}
  const candidateUrls = updateCandidateUrlsByInstalledId(rows, catalogItems)
  const results = await mapWithConcurrency(rows, MANIFEST_FETCH_CONCURRENCY, async (app) => ({
    id: app.id,
    check: await fetchUpdateCheck(app.id, token, candidateUrls[app.id]),
  }))
  const out = {}
  for (const r of results) {
    // A transport/404 failure is not a fresh state answer. Preserve any prior
    // durable conflict/replay state until a later successful check replaces it;
    // a first-load miss has no key and never invents an update from semver.
    if (r.check !== null) out[r.id] = r.check
  }
  return out
}

function sameUpdateCheck(left, right) {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false
  }
  return left.available === right.available &&
    left.pendingUpdateState === right.pendingUpdateState &&
    left.upstreamVersion === right.upstreamVersion &&
    left.installedSourceRevision === right.installedSourceRevision &&
    left.candidateSourceDigest === right.candidateSourceDigest &&
    left.candidateRejected?.code === right.candidateRejected?.code &&
    left.candidateRejected?.message === right.candidateRejected?.message &&
    left.checkedAt === right.checkedAt
}

function knownPendingUpdateState(check) {
  if (!check || typeof check !== 'object') return null
  if (
    check.pendingUpdateState === 'needs_resolution' ||
    check.pendingUpdateState === 'replay_pending'
  ) return check.pendingUpdateState
  return null
}

// Merge fresh update-check answers into the prior map, but return the SAME
// reference when nothing changed so React bails out of the re-render — an
// up-to-date store must not re-render its grid on every focus regain (mirrors
// the manifest-refetch skip). Only newly-answered or flipped ids force a new
// object.
export function mergeUpdateChecks(prev, incoming) {
  let next = prev
  for (const k in incoming) {
    let value = incoming[k]
    if (value?.pendingUpdateState === 'unknown') {
      // Git could not classify the current receipt. Keep the new availability
      // and provenance facts, but never let uncertainty erase a previously known
      // durable resolution/replay phase.
      const priorState = knownPendingUpdateState(prev[k])
      if (priorState) value = { ...value, pendingUpdateState: priorState }
    }
    if (sameUpdateCheck(prev[k], value)) continue
    if (next === prev) next = { ...prev }
    next[k] = value
  }
  return next
}

function withoutKey(prev, key) {
  if (!key || !Object.prototype.hasOwnProperty.call(prev, key)) return prev
  const next = { ...prev }
  delete next[key]
  return next
}

function itemIdsSettledByChecks(items, apps, checks) {
  const settled = new Set()
  for (const item of items || []) {
    const app = findInstalled(apps || [], item)
    const check = app ? checks?.[app.id] : undefined
    const available = check?.available
    if (app && available === false) settled.add(item.id)
  }
  return settled
}

// Runs `recheck` each time the owner comes back to the Store while `active`.
// Inside the shell, returning from Settings or another app only makes the
// frame's document visible again (app-frame.html turns the shell's verdict
// into visibilitychange; the frame is not focused); a browser tab also gets
// focus. A return while a recheck is still running joins it.
function useOwnerReturn(active, recheck) {
  const recheckRef = useRef(recheck)
  useLayoutEffect(() => { recheckRef.current = recheck })
  useEffect(() => {
    if (!active) return undefined
    let running = null
    const onReturn = () => {
      if (document.visibilityState === 'hidden' || running) return
      running = Promise.resolve(recheckRef.current()).finally(() => { running = null })
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [active])
}

// Newest read wins. Several readers refresh the same resource (startup, a
// return from Settings, an install receipt's follow-up read) and their
// responses can settle in any order. A read takes a turn for its resource when
// it is issued, and only the resource's latest turn may commit, so a response
// that settles late never overwrites a newer one.
function useNewestRead() {
  const latestRef = useRef(new Map())
  return useCallback((resource) => {
    const turn = {}
    latestRef.current.set(resource, turn)
    return () => latestRef.current.get(resource) === turn
  }, [])
}

export default function App({ appId, token }) {
  const [savedLocation] = useState(() => {
    const nav = window.mobius?.nav
    return typeof nav?.setLocation === 'function' ? restoredStoreLocation(nav.location) : null
  })
  const [tab, setTab] = useState(savedLocation?.tab || 'browse')
  // Which publishing step Library's Your apps tab shows: home, choose or app.
  const [publishView, setPublishView] = useState('home')
  // Discover, Apps and Games share one community window; Library never needs it.
  const discoveryTab = DISCOVERY_TABS.has(tab)
  const [query, setQuery] = useState(savedLocation?.query || '')
  const [activeCollection, setActiveCollection] = useState(null)
  const collectionNavRef = useRef(null)
  // A category or creator page opened from an app page is a layer above it.
  // The app's own Back step stays in place, so Back peels the layer off and the
  // app is still there; closing and reopening Back steps at once is unreliable.
  const overlaysRef = useRef([])        // [{ kind, handle, show, restore }]
  const [overlay, setOverlay] = useState(null)   // top layer, for its Back label
  // A category page, and a publishing step past Library's Your apps, are
  // Back steps too.
  const categoryNavRef = useRef(null)
  const publishNavRef = useRef(null)
  const leaveCategoryRef = useRef(null)
  const closeLayersRef = useRef(null)
  const closeTopLayerRef = useRef(null)
  const shelfScrollRef = useRef({})
  const homeScrollRef = useRef(0)
  const [category, setCategory] = useState(savedLocation?.tab === 'library' ? savedLocation.category : 'all')
  // The selected category in the Apps and Games tabs; each tab keeps its own.
  const [shelfCategories, setShelfCategories] = useState(() => ({
    apps: savedLocation?.tab === 'apps' ? savedLocation.category : 'all',
    games: savedLocation?.tab === 'games' ? savedLocation.category : 'all',
  }))
  const [categorySort, setCategorySort] = useState('top')
  const [creatorFilter, setCreatorFilter] = useState({ name: '', value: 'all' })
  const [communityCategories, setCommunityCategories] = useState(COMMUNITY_CATEGORIES)
  const [catalog, setCatalog] = useState(() =>
    CATALOG.map(c => ({ ...c, manifest: c.manifest || null, error: null }))
  )
  const [communityCatalog, setCommunityCatalog] = useState([])
  const [communityRankings, setCommunityRankings] = useState({})
  const communityCatalogRef = useRef(communityCatalog)
  useEffect(() => { communityCatalogRef.current = communityCatalog }, [communityCatalog])
  const [communityError, setCommunityError] = useState('')
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityHasMore, setCommunityHasMore] = useState(false)
  const [communityOffset, setCommunityOffset] = useState(0)
  const [communityIdentity, setCommunityIdentity] = useState(null)
  const [communityIdentityError, setCommunityIdentityError] = useState('')
  const [spotlightFeed, setSpotlightFeed] = useState(null)
  const [githubIdentity, setGithubIdentity] = useState(null)
  const [githubIdentityError, setGithubIdentityError] = useState('')
  const [publishingId, setPublishingId] = useState(null)
  const [publication, setPublication] = useState(null)
  const [publicationError, setPublicationError] = useState('')
  const [publicationStates, setPublicationStates] = useState({})
  const [publicationStatesError, setPublicationStatesError] = useState('')
  const [publisherHandle, setPublisherHandle] = useState('')
  // Public listing facts (ratings, release) per community app id; see
  // createPublicationListingReader.
  const [publicationListings, setPublicationListings] = useState({})
  const [communityActionBusy, setCommunityActionBusy] = useState(false)
  const [communityActionError, setCommunityActionError] = useState({ key: '', message: '' })
  // Retry an old interrupted install receipt once when its detail opens.
  const communityReceiptAttemptsRef = useRef(new Set())
  const [otherInstalledCatalog, setOtherInstalledCatalog] = useState([])
  const otherInstalledCatalogRef = useRef(otherInstalledCatalog)
  useEffect(() => { otherInstalledCatalogRef.current = otherInstalledCatalog }, [otherInstalledCatalog])
  // Mirror of the hydrated curated catalog for foreground cleanup. Keeping it
  // out of the refresh callback's dependencies avoids rebinding browser event
  // listeners after every manifest refresh.
  const catalogRef = useRef(catalog)
  useEffect(() => { catalogRef.current = catalog }, [catalog])
  const [installed, setInstalled] = useState([])
  const installedRef = useRef(installed)
  installedRef.current = installed
  const contributeApp = useMemo(
    () => installed.find((app) => app?.slug === 'contribute') || null,
    [installed],
  )
  // Git-native update state per installed app, keyed by numeric app id. Each
  // answered check carries availability and the pending resolution/replay
  // phase; a missing/null answer is unknown and never becomes a version-based
  // update guess.
  const [updateChecks, setUpdateChecks] = useState({})
  const [setupCompletions, setSetupCompletions] = useState(() => readSetupCompletions())
  const [systemSetupComplete, setSystemSetupComplete] = useState(() => readSystemSetupReady())
  const [providerStatus, setProviderStatus] = useState(null)
  const [detail, setDetail] = useState(null)  // {id, manifest, raw_base}
  // Apps still recoverable after an uninstall. Read together with the installed apps (see refreshInstalled), so
  // both lists change on the same triggers and a note never outlives its app.
  const [uninstalledApps, setUninstalledApps] = useState([])
  // A section the open detail should scroll to ('reviews'), owned by the
  // navigation entry that requested it; see openDetailEntry.
  const [detailFocus, setDetailFocus] = useState('')
  // Apps the owner saved for later, kept in this app's own storage.
  const [savedIds, setSavedIds] = useState([])
  useEffect(() => {
    const store = window.mobius?.storage
    if (!store?.get) return undefined
    let live = true
    store.get('saved.json').then((value) => { if (live && Array.isArray(value)) setSavedIds(value) }).catch(() => {})
    return () => { live = false }
  }, [])
  // Storage and the toast stay outside the state updater, which React may run
  // twice.
  const toggleSaved = useCallback((item) => {
    const saved = savedIds.includes(item.id)
    const next = saved ? savedIds.filter((id) => id !== item.id) : [item.id, ...savedIds]
    setSavedIds(next)
    window.mobius?.storage?.set?.('saved.json', next)?.catch?.(() => {})
    setToast({ kind: 'success', message: saved ? 'Removed from Saved' : 'Saved for later · find it in Library' })
  }, [savedIds])
  // iOS Safari applies :active press styles only once a touch listener exists.
  useEffect(() => {
    const noop = () => {}
    document.addEventListener('touchstart', noop, { passive: true })
    return () => document.removeEventListener('touchstart', noop)
  }, [])
  // Search suggestions: recent searches (kept in app storage) and top categories.
  const [searchFocused, setSearchFocused] = useState(false)
  const phone = usePhoneLayout()
  const { barsHidden, showMobius } = useMobiusBars(phone)
  // Search is a phone-only tab; a screen that grows past phone width lands on
  // Discover with the header search field.
  useEffect(() => { if (!phone && tab === 'search') setTab('browse') }, [phone, tab])
  const [recentSearches, setRecentSearches] = useState([])
  useEffect(() => {
    let live = true
    window.mobius?.storage?.get?.('recent-searches.json')
      ?.then((value) => { if (live && Array.isArray(value)) setRecentSearches(value.slice(0, 5)) })?.catch?.(() => {})
    return () => { live = false }
  }, [])
  const rememberSearch = useCallback((value) => {
    const text = String(value || '').trim()
    if (text.length < 2) return
    setRecentSearches((current) => {
      const next = [text, ...current.filter((entry) => entry !== text)].slice(0, 5)
      window.mobius?.storage?.set?.('recent-searches.json', next)?.catch?.(() => {})
      return next
    })
  }, [])
  const forgetSearch = useCallback((value) => {
    setRecentSearches((current) => {
      const next = value === null ? [] : current.filter((entry) => entry !== value)
      window.mobius?.storage?.set?.('recent-searches.json', next)?.catch?.(() => {})
      return next
    })
  }, [])
  // Coming back from an app page slides the store back in.
  const [returning, setReturning] = useState(false)
  const showDetail = useCallback((item, focus = '') => {
    if (!item) setReturning(true)
    setDetail(item)
    setDetailFocus(item ? focus : '')
  }, [])
  // Only nested destinations need data and host Back ownership. Scalars are
  // already restored on first paint, without waiting for network hydration.
  const [intentDestination, setIntentDestination] = useState(() =>
    savedLocation?.collection || savedLocation?.detail
      ? savedLocation.collection
        ? { kind: 'collection', collectionId: savedLocation.collection, itemId: savedLocation.detail, restored: true }
        : { kind: 'app', itemId: savedLocation.detail, restored: true } : null
  )
  // Cancel synchronously before an owner action can reuse a pending Back entry.
  const cancelDestinationRef = useRef(null)
  const cancelPendingDestination = useCallback(() => {
    const cancel = cancelDestinationRef.current
    cancelDestinationRef.current = null
    cancel?.()
    setIntentDestination(null)
  }, [])
  const [capabilityReviews, setCapabilityReviews] = useState({})
  const navDetailRef = useRef(null)  // host-owned reversible detail entry
  // B1: preserve the catalog grid's scroll across opening a detail and coming
  // back — the grid unmounts while a detail shows, so it would otherwise
  // re-mount scrolled to the top.
  const gridScrollRef = useRef(null)
  // Phones: the Store bar slides away while you scroll down and comes back on
  // any scroll up, like Google Play; the App Store update line stays in view.
  const [barTucked, setBarTucked] = useState(false)
  useEffect(() => {
    setBarTucked(false)
    const el = gridScrollRef.current
    if (!phone || !el) return undefined
    let anchor = el.scrollTop
    let tucked = false
    const onScroll = () => {
      const y = el.scrollTop
      if (y < 24) { tucked = false; anchor = y }
      else if (!tucked && y > anchor + 12) { tucked = true; anchor = y }
      else if (tucked && y < anchor - 12) { tucked = false; anchor = y }
      else if ((tucked && y > anchor) || (!tucked && y < anchor)) anchor = y
      setBarTucked(tucked)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [phone, tab, detail])
  const savedGridScrollRef = useRef(0)
  // A tab press always lands on that tab's own page, like a phone's tab bar:
  // pressing the current tab again leaves a category or collection open in it.
  const selectTab = useCallback((next) => {
    if (next !== 'library') setCategory('all')
    closeLayersRef.current?.()
    collectionNavRef.current?.close()
    collectionNavRef.current = null
    categoryNavRef.current?.close()
    categoryNavRef.current = null
    publishNavRef.current?.close()
    publishNavRef.current = null
    setPublishView('home')
    setActiveCollection(null)
    setShelfCategories((current) => (current[next] && current[next] !== 'all' ? { ...current, [next]: 'all' } : current))
    savedGridScrollRef.current = 0
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
    setTab(next)
  }, [])
  const [pendingUninstall, setPendingUninstall] = useState(null)
  // pendingUninstall: the installed app row from /api/apps/.
  // Browser modal dialogs are silently no-op'd inside the AppCanvas
  // iframe (sandbox lacks `allow-modals`), so we stage the
  // confirmation as in-app state and render our own modal.
  const [busy, setBusy] = useState(false)
  const [busyItemId, setBusyItemId] = useState(null)
  const [busyActionKind, setBusyActionKind] = useState(null)
  // Candidate loading state for the pre-apply update review. The review opens
  // from either a catalog card or DetailView, so this stays item-scoped.
  const [checkingUpdateItemId, setCheckingUpdateItemId] = useState(null)
  const [checkingAllUpdates, setCheckingAllUpdates] = useState(false)
  const [resolvingAll, setResolvingAll] = useState(false)
  const [toast, setToast] = useState(null)
  // Single and batch updates share one reviewed transaction: read-only checks,
  // one explicit confirmation, then a server-run batch the dialog follows.
  const [updateTransaction, setUpdateTransaction] = useState(null)
  const updateBatchRef = useRef(null)
  // Recent server batches (running, or with results to act on) and every
  // controller following one, keyed by batch id.
  const [updateBatches, setUpdateBatches] = useState([])
  const [batchLoadError, setBatchLoadError] = useState(null)
  const reloadUpdateBatchesRef = useRef(null)
  const batchControllersRef = useRef(new Map())
  useEffect(() => () => {
    updateBatchRef.current?.dispose()
    for (const controller of batchControllersRef.current.values()) controller.dispose()
  }, [])
  const [agentReviewingUpdate, setAgentReviewingUpdate] = useState(false)
  const [updateAgentRequest, setUpdateAgentRequest] = useState(null)
  const chooseUpdateAgent = (title, run) => setUpdateAgentRequest({ title, run })
  const [agentErrorItemId, setAgentErrorItemId] = useState(null)
  const [cardErrors, setCardErrors] = useState({})
  // A card error the same action may get past offers "Try again" (keyed by
  // item id) instead of "Ask agent".
  const [cardErrorRetries, setCardErrorRetries] = useState({})
  // Covers every control, including assistive clicks, before it can reuse a
  // restore-owned Back entry. Programmatic restoration dispatches no DOM events.
  const ownerInteraction = {
    onPointerDownCapture: cancelPendingDestination,
    onKeyDownCapture: cancelPendingDestination,
    onClickCapture: cancelPendingDestination,
  }
  const searchInputRef = useRef(null)
  // A complete baked snapshot is usable on the very first render. Installed
  // state and the remote registry hydrate independently; neither should make a
  // healthy catalog flash a skeleton or feel network-bound. Catalog releases
  // are required to carry a snapshot for every entry (guarded in CI).
  // Do not expose catalog cards until installed identity has resolved. The
  // previous snapshot fast path rendered every app as "not installed" for one
  // pass, which selected the asynchronous remote-icon path and visibly painted
  // letters before the same-origin installed icons replaced them. A stable
  // skeleton for this one local read gives the first real card render its final,
  // browser-cached icon URL on its first meaningful paint.
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [catalogHydrated, setCatalogHydrated] = useState(false)
  const [catalogLoadError, setCatalogLoadError] = useState(false)
  const [installedLoadError, setInstalledLoadError] = useState('')
  // Seed the foreground debounce at mount so focus/pageshow cannot duplicate
  // the startup check before catalog hydration finishes.
  const lastUpdateCheckRef = useRef(Date.now())
  const installedReadGenerationRef = useRef(0)
  const latestInstalledReadRef = useRef(null)
  // Local mutations and targeted events supersede only their own check answers,
  // independently of installed reads and unrelated probes in a full round.
  const checkGenerationRef = useRef(0)
  const checkGenerationsRef = useRef(new Map())
  const fullCheckRoundRef = useRef(null)
  const catalogReadyRef = useRef(false)
  const pendingCheckIdsRef = useRef(new Set())
  const fullCheckPendingRef = useRef(false)

  useEffect(() => {
    function onIntent(event) {
      const destination = storeDestinationFromMessage(
        event,
        window.location.origin,
        window.parent,
      )
      if (destination) {
        cancelPendingDestination()
        setIntentDestination(destination)
      }
    }
    window.addEventListener('message', onIntent)
    return () => window.removeEventListener('message', onIntent)
  }, [cancelPendingDestination])

  const clearSettledUpdateArtifacts = useCallback((itemIds) => {
    if (!itemIds?.size) return
    const clear = prev => {
      let next = prev
      for (const id of itemIds) next = withoutKey(next, id)
      return next
    }
    setCardErrors(clear)
    setCardErrorRetries(clear)
  }, [])

  // `force` checks exactly `apps` now, for a caller that needs the answer
  // (a resolver that finished in its own chat).
  const refreshUpdateChecks = useCallback((apps, { force = false } = {}) => {
    const pendingIds = pendingCheckIdsRef.current
    const fullCheck = fullCheckPendingRef.current
    if (!catalogReadyRef.current || (!force && !fullCheck && document.visibilityState !== 'visible')) return
    // A forced check of a few apps leaves any due full round pending.
    if (!force) fullCheckPendingRef.current = false
    // Reuse a slow full round, but still let events replace only their own
    // probes immediately. Never invalidate unrelated answers in that round.
    const startFullCheck = !force && fullCheck && !fullCheckRoundRef.current
    if (!force && !startFullCheck && !pendingIds.size) return fullCheckRoundRef.current
    const rows = sourceBackedInstalledApps(apps, { excludeAppIds: [appId] })
      .filter(app => force || startFullCheck || pendingIds.has(String(app.id)))
    if (force) for (const app of rows) pendingIds.delete(String(app.id))
    else pendingIds.clear()
    const generation = ++checkGenerationRef.current
    for (const app of rows) checkGenerationsRef.current.set(String(app.id), generation)
    const round = fetchUpdateChecksFor(rows, token, [
      ...catalogRef.current, ...communityCatalogRef.current, ...otherInstalledCatalogRef.current,
    ]).then(checks => {
      const currentChecks = Object.fromEntries(Object.entries(checks)
        .filter(([id]) => checkGenerationsRef.current.get(id) === generation))
      setUpdateChecks(prev => mergeUpdateChecks(prev, currentChecks))
      clearSettledUpdateArtifacts(itemIdsSettledByChecks(
        [...catalogRef.current, ...otherInstalledCatalogRef.current], apps, currentChecks,
      ))
      return currentChecks
    }).finally(() => {
      if (fullCheckRoundRef.current === round) fullCheckRoundRef.current = null
    })
    if (startFullCheck) {
      lastUpdateCheckRef.current = Date.now()
      fullCheckRoundRef.current = round
    }
    return round
  }, [appId, token, clearSettledUpdateArtifacts])

  // Every caller follows the latest authoritative read. Supersession is not a
  // failure, and a newer read never waits for an older read or background checks.
  const refreshInstalled = useCallback(({ checkAll = false } = {}) => {
    if (checkAll) fullCheckPendingRef.current = true
    const generation = ++installedReadGenerationRef.current
    const invalidation = ++checkGenerationRef.current
    for (const id of pendingCheckIdsRef.current) checkGenerationsRef.current.set(id, invalidation)
    const read = (async () => {
      let apps
      try {
        apps = await loadInstalledApps(token)
      } catch (err) {
        if (generation !== installedReadGenerationRef.current) return latestInstalledReadRef.current
        setInstalledLoadError(err?.message || 'Installed apps could not be loaded.')
        return null
      }
      if (generation !== installedReadGenerationRef.current) return latestInstalledReadRef.current
      setInstalled(apps)
      setInstalledLoadError('')
      void fetchUninstalledApps(token).then(rows => {
        if (generation === installedReadGenerationRef.current) setUninstalledApps(rows)
      }).catch(() => {})
      void refreshUpdateChecks(apps)
      return apps
    })()
    latestInstalledReadRef.current = read
    return read
  }, [token, refreshUpdateChecks])

  // Initial fetch: catalog manifests + installed apps.
  // Every await is guarded so a single failing network call can't leave the
  // grid stuck on the skeleton: loadInstalledApps rejects (not just returns
  // []) on a transport-level error, and the per-manifest hydrate already
  // catches per-item — so the only thing that could strand loadingCatalog
  // is an unguarded reject. The finally clears the skeleton unconditionally.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // Start the dynamic registry immediately, but do not put it on the
        // first-paint critical path. The baked snapshot catalog is already a
        // complete, usable floor; only the installed-app list may delay the
        // initial cards. Provider setup status decorates actions after paint
        // and must not hold the whole catalog behind its retry path.
        const remoteCatalogPromise = fetchCatalog(CATALOG_URL, token)
          .catch(() => null)
        const providerStatusPromise = loadProviderStatus(token)
        const apps = await refreshInstalled() || []
        if (cancelled) return
        setSetupCompletions(readSetupCompletions())
        setSystemSetupComplete(readSystemSetupReady())
        if (CATALOG.every((entry) => entry.manifest)) {
          setLoadingCatalog(false)
        }
        providerStatusPromise.then((nextProviderStatus) => {
          if (!cancelled && nextProviderStatus) setProviderStatus(nextProviderStatus)
        })
        // Resolve the catalog SOURCE by MERGING the web registry (catalog.json,
        // fetched via the proxy) OVER the baked CATALOG — never replacing it.
        // Baked is the floor: an app in the baked list can never vanish because
        // the registry is stale/partial (which would drop it from Browse + its
        // update/rehydrate flows). The registry overrides a known app's URL
        // fields and can ADD new apps. This is what lets a newly-published app
        // appear without a store-app redeploy — appending it to catalog.json on
        // main is enough. On fetch failure /
        // empty result, the baked CATALOG carries the store untouched.
        const remote = await remoteCatalogPromise
        if (cancelled) return
        setCatalogLoadError(remote === null)
        if (remote?.communityCategories) {
          setCommunityCategories({ ...COMMUNITY_CATEGORIES, ...remote.communityCategories })
        }
        const entries = mergeCatalogEntries(CATALOG, remote?.apps)
        // A baked manifest gives every discovery card a fast first paint, but
        // it must not freeze a listing at the last Store release. Installed
        // apps refresh here, before the startup source check; every other
        // listing refreshes in the background once the catalog has settled.
        const hydrated = await mapWithConcurrency(
          entries,
          MANIFEST_FETCH_CONCURRENCY,
          async (c) => {
            if (!needsLiveManifestFirst(c, apps)) {
              return { ...c, error: null }
            }
            try {
              const manifest = await fetchManifest(c.manifest_url, token)
              return { ...c, manifest, error: null }
            } catch (e) {
              // A failed live read keeps the baked manifest: the card stays as
              // it painted. Only an entry with nothing to show reports it.
              // The trade-off: a permanent failure (a 404 for a moved or
              // deleted repository) is not shown here either. For an installed
              // app the update check still reports its source; installing a
              // listing reports the failure when it fetches the release.
              return c.manifest
                ? { ...c, error: null }
                : { ...c, manifest: null, error: e.message || String(e) }
            }
          },
        )
        if (cancelled) return
        catalogRef.current = hydrated
        catalogReadyRef.current = true
        setCatalog(hydrated)
        lastUpdateCheckRef.current = Date.now()
        // Always run the startup check with the live catalog and a fresh
        // installed list, even if an event superseded the first-paint read.
        void refreshInstalled({ checkAll: true })
        void refreshSnapshotListings(entries.filter((c) => !needsLiveManifestFirst(c, apps)))
      } finally {
        if (!cancelled) {
          setLoadingCatalog(false)
          setCatalogHydrated(true)
        }
      }
    }
    // Replace each remaining snapshot with its live manifest in one commit, so
    // the grid re-renders once; an open detail page takes it in place. A
    // failed read keeps the snapshot, which the detail view labels as cached.
    async function refreshSnapshotListings(listings) {
      const live = new Map()
      await mapWithConcurrency(listings, MANIFEST_FETCH_CONCURRENCY, async (c) => {
        try {
          live.set(c.id, await fetchManifest(c.manifest_url, token))
        } catch {
          // Keep the snapshot; the next Store open tries again.
        }
      })
      if (cancelled || live.size === 0) return
      const withLive = (c) => (
        c && live.has(c.id) && showsSnapshotManifest(c) ? { ...c, manifest: live.get(c.id) } : c
      )
      setCatalog((current) => current.map(withLive))
      setDetail(withLive)
    }
    load()
    return () => {
      cancelled = true
      installedReadGenerationRef.current += 1
      latestInstalledReadRef.current = null
      fullCheckRoundRef.current = null
      checkGenerationsRef.current.clear()
      catalogReadyRef.current = false
      pendingCheckIdsRef.current.clear()
      fullCheckPendingRef.current = false
    }
  }, [appId, token, refreshInstalled])

  // Reflection counts real opens from app_ready, so it fires once the first
  // usable catalog has painted, not after the background registry refresh,
  // which a slow upstream can hold open long after the Store is in use.
  // It also fires after a failed installed-apps read: the Store is open and
  // shows its reconnect state, which is still a real open.
  const appReadySignalledRef = useRef(false)
  useEffect(() => {
    if (loadingCatalog || appReadySignalledRef.current) return
    appReadySignalledRef.current = true
    window.mobius?.signal?.('app_ready', { installed_count: installed.length })
  }, [loadingCatalog, installed.length])

  const communityRequestRef = useRef(0)
  const communityAbortRef = useRef(null)
  const communityBusyRef = useRef(false)
  const refreshCommunity = useCallback(async ({ append = false, background = false } = {}) => {
    if (background && communityBusyRef.current) return
    communityAbortRef.current?.abort()
    const controller = new AbortController()
    communityAbortRef.current = controller
    communityBusyRef.current = true
    const requestId = communityRequestRef.current + 1
    communityRequestRef.current = requestId
    const limit = 24
    const offset = append ? communityOffset : 0
    if (!background) setCommunityLoading(true)
    try {
      // Refresh the loaded window atomically: do not discard pages the owner
      // already loaded, or replace them with a partial failed refresh.
      // Category pages and shelves group whatever is loaded, so an unsearched
      // window starts wide; a search stays one page.
      const firstWindow = query.trim() ? limit : COMMUNITY_BROWSE_WINDOW
      const target = background ? Math.max(firstWindow, communityOffset) : firstWindow
      // The shelves' rankings refresh with the browse window. A failed
      // ranking keeps the last one rather than hiding its shelf.
      const rankingsRequest = append || query.trim() ? null : Promise.all(
        COMMUNITY_RANKINGS.map((sort) => loadCommunityApps(token, {
          sort, limit: RANKED_SHELF_SIZE, signal: controller.signal,
        }).then((payload) => [sort, communityRanking(payload, sort)], () => null)),
      )
      const page = await loadCommunityWindow(
        params => loadCommunityApps(token, { ...params, query: query.trim(), signal: controller.signal }),
        { offset, limit, target: append ? offset + limit : target },
      )
      const rankings = rankingsRequest ? (await rankingsRequest).filter(Boolean) : []
      if (communityRequestRef.current !== requestId) return
      if (rankings.length) {
        setCommunityRankings((current) => ({ ...current, ...Object.fromEntries(rankings) }))
      }
      setCommunityCatalog((current) => append
        ? mergeCommunityCatalog(current, page.items)
        : page.items)
      setCommunityOffset(page.nextOffset)
      setCommunityHasMore(page.hasMore)
      setCommunityError('')
    } catch (error) {
      if (communityRequestRef.current !== requestId || controller.signal.aborted) return
      setCommunityError(error?.message || 'Community apps are unavailable right now.')
    } finally {
      if (communityRequestRef.current === requestId) {
        communityBusyRef.current = false
        setCommunityLoading(false)
      }
    }
  }, [token, query, communityOffset])

  const refreshPublicationListings = useMemo(() => createPublicationListingReader(
    token, (id, listing) => setPublicationListings((current) => ({ ...current, [id]: listing })),
  ), [token])

  const showPublications = useCallback((payload) => {
    setPublicationStates(communityPublicationsByLocalApp(payload))
    setPublisherHandle(publicationViewerHandle(payload))
    setPublicationStatesError('')
    refreshPublicationListings(payload?.items)
  }, [refreshPublicationListings])

  const newestRead = useNewestRead()

  // The publications viewer also carries the owner's handle.
  const refreshPublicationStates = useCallback(async () => {
    const isNewest = newestRead('publications')
    try {
      const payload = await loadCommunityPublications(token)
      if (isNewest()) showPublications(payload)
    } catch (error) {
      if (isNewest()) setPublicationStatesError(error?.message || 'Publication status is unavailable right now.')
    }
  }, [token, newestRead, showPublications])

  // A failed read keeps the last known account; see mobiusAccountStatus.
  const refreshCommunityIdentity = useCallback(async () => {
    const isNewest = newestRead('identity')
    try {
      const identity = await loadCommunityIdentity(token)
      if (!isNewest()) return
      setCommunityIdentity(identity)
      setCommunityIdentityError('')
    } catch (error) {
      if (isNewest()) setCommunityIdentityError(error?.message || 'Identity is unavailable right now.')
    }
  }, [token, newestRead])

  // Library › Saved also needs the community listings its saved apps come from.
  const savedOpen = tab === 'library' && category === 'saved' && savedIds.length > 0
  useEffect(() => {
    if (!DISCOVERY_TABS.has(tab) && !savedOpen) return undefined
    const timer = window.setTimeout(() => {
      setCommunityOffset(0)
      refreshCommunity({ append: false })
    }, query ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      communityAbortRef.current?.abort()
      communityRequestRef.current += 1
      communityBusyRef.current = false
    }
  // Pagination state changes after a page arrives; only query changes, entering
  // discovery, or an explicit Load more action should issue another request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryTab, savedOpen, token, query])

  const refreshCommunityRef = useRef(refreshCommunity)
  useLayoutEffect(() => { refreshCommunityRef.current = refreshCommunity }, [refreshCommunity])
  useEffect(() => {
    if (!DISCOVERY_TABS.has(tab)) return undefined
    return watchCatalogFreshness(() => refreshCommunityRef.current({ background: true }))
  }, [discoveryTab])


  const refreshGithubIdentity = useCallback(async () => {
    const isNewest = newestRead('github')
    try {
      const identity = await loadLocalGithubIdentity(token)
      if (!isNewest()) return
      setGithubIdentity(identity)
      setGithubIdentityError('')
    } catch (error) {
      if (isNewest()) setGithubIdentityError(error?.message || 'GitHub connection is unavailable right now.')
    }
  }, [token, newestRead])

  // Contribute owns connection setup. Refresh the inherited status when the
  // owner comes back from it; App Store never starts a second OAuth flow.
  useOwnerReturn(tab === 'library' && category === 'yours' && !githubIdentity?.connected, refreshGithubIdentity)

  // Settings › Accounts › Möbius owns sign-in and the handle; the handle
  // arrives with the publications viewer, so a re-read takes both.
  const refreshMobiusAccount = useCallback(
    () => Promise.allSettled([refreshCommunityIdentity(), refreshPublicationStates()]),
    [refreshCommunityIdentity, refreshPublicationStates],
  )

  // Startup reads each resource through the same reader a later refresh uses,
  // so whichever was issued last wins; Spotlight holds nothing else back.
  useEffect(() => {
    void refreshMobiusAccount()
    void refreshGithubIdentity()
    let cancelled = false
    loadEditorialSpotlight(token).then((feed) => {
      if (!cancelled) setSpotlightFeed(feed)
    }, () => {})
    return () => { cancelled = true }
  }, [token, refreshMobiusAccount, refreshGithubIdentity])

  useEffect(() => {
    setInstalledMatchViewer(githubIdentity?.login || '')
  }, [githubIdentity])

  const handleRegisterCommunity = useCallback(async (release) => {
    if (publishingId) return false
    setPublishingId('github-release')
    setPublication(null)
    setPublicationError('')
    try {
      const result = await registerCommunityRevision(token, release)
      const listed = result?.app || result
      setPublication({
        ...listed,
        name: listed?.manifest?.name || release.repository,
        status: communityPublicationStatus(listed),
        repository_url: communityRepositoryUrl(
          listed?.repository_url || `https://github.com/${release.repository}`,
        ),
      })
      await Promise.allSettled([refreshCommunity(), refreshPublicationStates()])
      return true
    } catch (error) {
      setPublicationError(error?.message || 'This GitHub release could not be listed.')
      return false
    } finally {
      setPublishingId(null)
    }
  }, [publishingId, refreshCommunity, refreshPublicationStates, token])

  const handlePublishLocal = useCallback(async (localAppId, repositoryName, reviewedCommit = '') => {
    if (publishingId) return false
    setPublishingId(localAppId)
    setPublication(null)
    setPublicationError('')
    try {
      const result = await publishLocalAppToGithub(token, localAppId, repositoryName)
      const listed = result?.app || result
      setPublication({
        ...listed,
        name: listed?.manifest?.name || repositoryName,
        status: communityPublicationStatus(listed),
        repository_url: communityRepositoryUrl(listed?.repository_url || (
          githubIdentity?.login ? `https://github.com/${githubIdentity.login}/${repositoryName}` : ''
        )),
        // Publishing takes whatever revision is accepted at that moment.
        revision_moved: !!(reviewedCommit && result?.published_commit
          && result.published_commit !== String(reviewedCommit).toLowerCase()),
      })
      await Promise.allSettled([refreshCommunity(), refreshPublicationStates()])
      return true
    } catch (error) {
      setPublicationError(error?.message || 'This local app could not be published.')
      return false
    } finally {
      setPublishingId(null)
    }
  }, [githubIdentity, publishingId, refreshCommunity, refreshPublicationStates, token])

  const updateCommunityFeedback = useCallback((communityId, updater) => {
    setCommunityCatalog((items) => items.map((item) => (
      item.community?.id === communityId
        ? { ...item, community: updater(item.community) }
        : item
    )))
    setDetail((item) => {
      if (item?.community?.id === communityId) {
        return { ...item, community: updater(item.community) }
      }
      if (item?.community_feedback?.id === communityId) {
        return { ...item, community_feedback: updater(item.community_feedback) }
      }
      return item
    })
  }, [])

  // A listing's review eligibility for this owner. The return from Settings
  // and an install receipt both re-read it here; the newest read wins.
  const refreshReviewEligibility = useCallback(async (communityId) => {
    const isNewest = newestRead(`listing:${communityId}`)
    const row = await loadCommunityApp(token, communityId)
    if (!isNewest()) return
    updateCommunityFeedback(communityId, (current) => ({
      ...current,
      review_eligibility: String(row.review_eligibility || current.review_eligibility),
      has_verified_install: row.has_verified_install === true,
      user_review: row.user_review || null,
    }))
  }, [token, newestRead, updateCommunityFeedback])

  const confirmCommunityInstall = useCallback(async (item, installedApp, revisionId) => {
    const feedback = communityFeedbackOf(item)
    if (!feedback?.id || !revisionId || !installedApp?.id) return false
    const feedbackKey = `${feedback.id}:${feedback.revision_id}`
    try {
      await recordCommunityInstall(
        token,
        feedback.id,
        revisionId,
        `app:${installedApp.id}:${installedApp.slug || item.manifest?.id || 'community'}`,
      )
      // Read only after the receipt lands, so a read issued before it is older.
      await refreshReviewEligibility(feedback.id)
      setCommunityActionError((current) => (
        current.key === feedbackKey ? { key: feedbackKey, message: '' } : current
      ))
      return true
    } catch (error) {
      setCommunityActionError({
        key: feedbackKey,
        message: error?.message || 'Your installation could not be verified for rating.',
      })
      return false
    }
  }, [token, refreshReviewEligibility])

  // Reconcile a missed receipt when an installed app's detail opens; see
  // communityReceiptToReconcile for when one is due and which revision it names.
  useEffect(() => {
    const receipt = communityReceiptToReconcile(detail, installed, communityIdentity)
    if (!receipt) return
    void attemptCommunityReceiptOnce(
      communityReceiptAttemptsRef.current,
      receipt.attemptKey,
      () => confirmCommunityInstall(detail, receipt.installedApp, receipt.revisionId),
    )
  }, [communityIdentity, confirmCommunityInstall, detail, installed])

  useEffect(() => {
    const communityId = communityFeedbackOf(detail)?.id
    if (!communityId) return undefined
    let active = true
    loadCommunityReviews(token, communityId).then((result) => {
      if (!active) return
      updateCommunityFeedback(communityId, (current) => ({
        ...current,
        reviews: Array.isArray(result.items) ? result.items : [],
        reviews_loaded: true,
        reviews_error: '',
      }))
    }).catch((error) => {
      if (!active) return
      updateCommunityFeedback(communityId, (current) => ({
        ...current,
        reviews_loaded: true,
        reviews_error: error?.message || 'Ratings and reviews could not be loaded.',
      }))
    })
    return () => { active = false }
  }, [detail?.community?.id, detail?.community_feedback?.id, token, updateCommunityFeedback])

  // Publish without an account or handle, and a detail page's review gate,
  // both send the owner to Settings › Accounts › Möbius. Coming back re-reads
  // the account, and a gated listing's eligibility, until the prompt clears:
  // the gate stays while either reading still asks for the account.
  const mobiusAccount = mobiusAccountStatus(communityIdentity, communityIdentityError)
  const detailFeedback = communityFeedbackOf(detail)
  const reviewGateId = detailFeedback?.id
    && reviewAccountAction(detailFeedback.review_eligibility, mobiusAccount) ? detailFeedback.id : ''
  const mobiusAccountPending = tab === 'library' && category === 'yours' && !(mobiusAccount === 'signed_in' && publisherHandle)
  useOwnerReturn(mobiusAccountPending || !!reviewGateId, () => Promise.allSettled([
    refreshMobiusAccount(),
    reviewGateId && refreshReviewEligibility(reviewGateId),
  ]))

  const handleCommunityFeedback = useCallback(async (stars, body) => {
    const feedback = communityFeedbackOf(detail)
    if (!feedback
      || communityActionBusy
      || !communityIdentity?.linked
      || feedback.review_eligibility !== 'eligible'
      || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      return false
    }
    const feedbackKey = `${feedback.id}:${feedback.revision_id}`
    setCommunityActionBusy(true)
    setCommunityActionError({ key: feedbackKey, message: '' })
    try {
      const result = await saveCommunityReview(token, feedback.id, stars, body)
      // Only this app's rating changed; re-read its listing if it is one of yours.
      if (Object.values(publicationStates).some((state) => state.community_app_id === feedback.id)) {
        refreshPublicationListings([{ status: 'live', community_app_id: feedback.id }], { force: true })
      }
      updateCommunityFeedback(feedback.id, (current) => ({
        ...current,
        user_review: result.user_review || null,
        // The registry may return the aggregate flat, nested under `rating`, or
        // not at all; never let a missing or nested shape render NaN.
        ...communityRatingAggregate(result, current),
        review_eligibility: String(result.review_eligibility || current.review_eligibility),
      }))
      try {
        const reviews = await loadCommunityReviews(token, feedback.id)
        updateCommunityFeedback(feedback.id, (current) => ({
          ...current,
          reviews: Array.isArray(reviews.items) ? reviews.items : [],
          reviews_loaded: true,
          reviews_error: '',
        }))
      } catch (readError) {
        updateCommunityFeedback(feedback.id, (current) => ({
          ...current,
          reviews_error: readError?.message || 'Review saved, but the list could not refresh.',
        }))
      }
      return true
    } catch (error) {
      setCommunityActionError({
        key: feedbackKey,
        message: error?.message || 'Your rating or review could not be saved.',
      })
      return false
    } finally {
      setCommunityActionBusy(false)
    }
  }, [communityActionBusy, communityIdentity, detail, token, updateCommunityFeedback, publicationStates, refreshPublicationListings])

  const handleUploadSpotlightArtwork = useCallback(
    (file) => uploadEditorialArtwork(token, file),
    [token],
  )

  const handlePublishSpotlight = useCallback(async (items) => {
    const next = await publishEditorialSpotlight(token, items)
    setSpotlightFeed(next)
    setToast({ kind: 'success', message: 'The shared Spotlight lineup is live.' })
    return next
  }, [token])

  const listedCatalog = useMemo(
    () => mergeOfficialCommunityFeedback(catalog, communityCatalog),
    [catalog, communityCatalog],
  )

  // Published apps may exist outside both the curated registry and the live
  // community catalog. Hydrate only those genuinely unrepresented installs,
  // while excluding this Store's own row. A cancelled effect cannot replace a
  // newer installed-state result after focus refresh.
  const otherInstalledCatalogSources = useMemo(
    () => otherInstalledCatalogItems(installed, listedCatalog, { excludeAppIds: [appId] }),
    [appId, installed, listedCatalog],
  )
  useEffect(() => {
    let cancelled = false
    if (!otherInstalledCatalogSources.length) {
      setOtherInstalledCatalog([])
      return () => { cancelled = true }
    }
    mapWithConcurrency(otherInstalledCatalogSources, MANIFEST_FETCH_CONCURRENCY, async (item) => {
      try {
        const manifest = await fetchManifest(item.manifest_url, token)
        return { ...item, manifest, error: null }
      } catch (error) {
        return { ...item, error: error.message || String(error) }
      }
    }).then((items) => {
      if (!cancelled) setOtherInstalledCatalog(items)
    })
    return () => { cancelled = true }
  }, [otherInstalledCatalogSources, token])

  const REHYDRATE_DEBOUNCE_MS = 50_000
  const handleRetryInstalled = useCallback(() => refreshInstalled({ checkAll: true }), [refreshInstalled])

  const refreshSetupState = useCallback(async () => {
    setSetupCompletions(readSetupCompletions())
    setSystemSetupComplete(readSystemSetupReady())
    const nextProviderStatus = await loadProviderStatus(token)
    if (nextProviderStatus) setProviderStatus(nextProviderStatus)
  }, [token])

  useEffect(() => {
    function onStorage(e) {
      if (e.key === SETUP_COMPLETIONS_KEY) setSetupCompletions(readSetupCompletions())
      if (e.key === SYSTEM_SETUP_READY_KEY) setSystemSetupComplete(readSystemSetupReady())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Parent events only invalidate IDs; installed state always comes from the
  // API. Coalesce a message burst in one microtask and defer hidden-frame work
  // until foreground return. No polling, and no waiting for older requests.
  useEffect(() => {
    let active = true
    let queued = false
    let foreground = false
    function scheduleRefresh() {
      if (queued || document.visibilityState !== 'visible') return
      queued = true
      queueMicrotask(() => {
        queued = false
        if (!active || document.visibilityState !== 'visible') return
        const checkAll = foreground
          && Date.now() - lastUpdateCheckRef.current >= REHYDRATE_DEBOUNCE_MS
        foreground = false
        void refreshInstalled({ checkAll })
      })
    }
    function onForeground() {
      if (document.visibilityState !== 'visible') return
      foreground = true
      refreshSetupState().catch(() => {})
      scheduleRefresh()
    }
    function onManagedAppEvent(event) {
      if (event.source !== window.parent || event.data?.type !== 'moebius:managed-app-event') return
      const id = event.data.event?.appId
      if (typeof id !== 'string' && typeof id !== 'number') return
      pendingCheckIdsRef.current.add(String(id))
      scheduleRefresh()
    }
    window.addEventListener('message', onManagedAppEvent)
    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('focus', onForeground)
    window.addEventListener('pageshow', onForeground)
    return () => {
      active = false
      window.removeEventListener('message', onManagedAppEvent)
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('focus', onForeground)
      window.removeEventListener('pageshow', onForeground)
    }
  }, [refreshInstalled, refreshSetupState])

  // Re-fetch a single catalog manifest. Wired into CatalogCard's
  // "Try again" affordance — replaces the previous behavior where a
  // failed manifest stayed dead until the whole app reloaded.
  const retryCatalogItem = useCallback(async (item) => {
    setCatalog(prev => prev.map(c =>
      c.id === item.id ? { ...c, manifest: null, error: null, _retrying: true } : c
    ))
    try {
      const manifest = await fetchManifest(item.manifest_url, token)
      setCatalog(prev => prev.map(c =>
        c.id === item.id ? { ...c, manifest, error: null, _retrying: false } : c
      ))
    } catch (e) {
      setCatalog(prev => prev.map(c =>
        c.id === item.id ? { ...c, manifest: null, error: e.message || String(e), _retrying: false } : c
      ))
    }
  }, [token])

  // Wire the moebius:open-app postMessage with a toast fallback for
  // the (defensive) standalone case. The shell handler validates the
  // appId before navigating; we don't need an ack here.
  const handleOpenInstalled = useCallback((id) => {
    openInstalledApp(id, {
      onUnembedded: () => {
        setToast({
          kind: 'error',
          message: 'Open this app from the drawer.',
        })
      },
    })
  }, [])

  const openSettings = useCallback((section) => {
    openSystemSettings(section, () => {
      setToast({ kind: 'error', message: 'Open Settings from the drawer.' })
    })
  }, [])

  const handleSetup = useCallback((item, installedApp) => {
    const setup = item?.setup || {}
    if (setup.scope === 'system') {
      openSettings(setup.section || 'background-agents')
      return
    }
    if (installedApp?.id) {
      openInstalledApp(installedApp.id, {
        intent: 'setup',
        onUnembedded: () => {
          setToast({
            kind: 'error',
            message: 'Open this app from the drawer.',
          })
        },
      })
    }
  }, [openSettings])

  const reviewCapabilities = useCallback(async (item) => {
    if (!item?.id) return
    setCapabilityReviews(prev => ({
      ...prev,
      [item.id]: { status: 'loading', preview: null, error: '' },
    }))
    try {
      const preview = await previewApp({
        manifest_url: item.manifest_url,
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
      })
      setCapabilityReviews(prev => ({
        ...prev,
        [item.id]: { status: 'ready', preview, error: '' },
      }))
    } catch (error) {
      setCapabilityReviews(prev => ({
        ...prev,
        [item.id]: {
          status: 'error', preview: null,
          error: error.message || 'Capabilities could not be checked.',
        },
      }))
    }
  }, [token])

  // Fresh installs run inline from DetailView, with no access check first. Reviewed updates never come here:
  // they run as batches (see createBatchController). `busy` keeps the
  // initiating surface dimensionally stable while the install is in flight.
  const handleInstall = async item => {
    if (busy) return { ok: false, reason: 'busy' }
    setBusy(true)
    setBusyItemId(item?.id || null)
    setBusyActionKind('install')
    setCardErrors(prev => withoutKey(prev, item.id))
    setCardErrorRetries(prev => withoutKey(prev, item.id))
    try {
      // GitHub-backed apps install from manifest_url so the backend fetches
      // the latest release at click time. The in-memory manifest is only the
      // preview/fallback path for entries without a durable URL.
      const result = await installApp({
        manifest_url: item.manifest_url,
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
      })
      // A local mutation is newer than any background probe already in flight.
      // Invalidate only this app's answer; unrelated checks can still finish.
      if (result.id) checkGenerationsRef.current.set(String(result.id), ++checkGenerationRef.current)

      if (result.id) {
        // A successful install/update just made this app current. The
        // git-native probe is authoritative over version strings, so leaving a
        // stale `true` here keeps the card/detail CTA on "Update" until the
        // next debounced recheck. Clear it optimistically; later focus checks
        // can flip it back if upstream moves again.
        setUpdateChecks(prev => mergeUpdateChecks(prev, {
          [result.id]: {
            available: false,
            pendingUpdateState: 'none',
            upstreamVersion: result.version || null,
          },
        }))
      }
      const communityFeedback = communityFeedbackOf(item)
      if (communityFeedback?.id && communityFeedback?.revision_id && result.id) {
        rememberCommunityInstallRevision(result, communityFeedback)
      }
      setCardErrors(prev => withoutKey(prev, item.id))
      await refreshInstalled()
      // Only a linked mobius.you identity gets a receipt (and its failure
      // message): an unlinked owner can still install a public listing.
      const receipt = communityReceiptAfterInstall(item, result, communityIdentity)
      if (receipt) {
        // Do not hold the completed install UI on an external community call.
        // The receipt request itself uses keepalive if the owner opens the app.
        void attemptCommunityReceiptOnce(
          communityReceiptAttemptsRef.current,
          receipt.attemptKey,
          () => confirmCommunityInstall(item, result, receipt.revisionId),
        )?.then((confirmed) => {
          if (!confirmed) setToast({
            kind: 'error',
            message: 'App installed, but rating access could not be verified. Reopen Store to retry.',
          })
        })
      }
      const openAction = result.id
        ? {
            label: 'Open App',
            onClick: () => handleOpenInstalled(result.id),
          }
        : null
      const appName = result.name || item.manifest?.name || item.id
      const versionText = result.version || item.manifest?.version

      const verb = result.mode === 'update' ? 'updated' : 'installed'
      const installNotes = result.warnings || []
      const warnSuffix = installNotes.length
        ? ` (with notes: ${installNotes.join('; ')})`
        : ''
      if (result.mode === 'update') {
        window.mobius?.signal?.('app_updated', { slug: result.id || item.id })
      } else {
        window.mobius?.signal?.('app_installed', { slug: result.id || item.id })
      }
      // No "reload to see it in the drawer" hint — the backend emits an
      // app_updated SSE event after install/update, and the shell listens
      // for that and refreshes its drawer automatically. The toast just
      // confirms what happened.
      setToast({
        kind: 'success',
        message: `${appName} ${verb}${warnSuffix}.`,
        action: openAction,
      })
      return { ok: true, result }
      // Stay on the detail view. Two reasons: (1) closing here would
      // bounce the user back to the catalog grid mid-action, which felt
      // like the app didn't acknowledge the tap. (2) after refreshInstalled
      // resolves the detail re-renders with the installed state — the
      // primary CTA flips from "Install" to "Open App", confirming the
      // commit on the same surface the user committed it from. The user
      // can use the back arrow / device-back to dismiss when ready.
    } catch (e) {
      const message = e.message || String(e)
      // A transient failure (the platform says `retryable`, or the request
      // never got an answer) offers the same reviewed install again.
      const retry = e?.retryable === true || !e?.status
        ? () => { void handleInstallRef.current(item) }
        : null
      setCardErrors(prev => ({ ...prev, [item.id]: message }))
      setCardErrorRetries(prev => retry ? { ...prev, [item.id]: retry } : withoutKey(prev, item.id))
      window.mobius?.signal?.('error', { message, source: 'install' })
      // Installs start from DetailView, where no card shows this error.
      setToast({ kind: 'error', message, action: retry ? { label: 'Try again', onClick: retry } : null })
      return { ok: false, reason: 'error', error: message }
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }
  const handleInstallRef = useRef(handleInstall)
  handleInstallRef.current = handleInstall

  const handleReviewUpdate = async (notice, agent = null) => {
    if (!agent) {
      chooseUpdateAgent('Resolve update with agent', choice => handleReviewUpdateRef.current(notice, choice))
      return
    }
    if (busy || !notice) return
    setBusy(true)
    setBusyItemId(notice.itemId || null)
    setBusyActionKind('resolve')
    setCardErrors(prev => withoutKey(prev, notice.itemId))
    setCardErrorRetries(prev => withoutKey(prev, notice.itemId))
    try {
      const resolver = await createConflictResolverChat(
        notice.appId,
        'preserve_local',
        token,
        agent,
      )
      openChat(resolver.chat_id)
    } catch (e) {
      const message = e.message || String(e)
      const retry = e?.retryable === true || !e?.status
        ? () => { void handleReviewUpdateRef.current(notice, agent) }
        : null
      setCardErrors(prev => ({ ...prev, [notice.itemId]: message }))
      if (retry) setCardErrorRetries(prev => ({ ...prev, [notice.itemId]: retry }))
      // A card shows this error; the detail page has no card, so it gets a toast.
      if (detail) setToast({ kind: 'error', message, action: retry ? { label: 'Try again', onClick: retry } : null })
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }
  const handleReviewUpdateRef = useRef(handleReviewUpdate)
  handleReviewUpdateRef.current = handleReviewUpdate

  // Stage the uninstall — DetailView's Uninstall button calls this,
  // and the modal's Confirm calls confirmUninstall to actually run
  // the DELETE. Splitting these out is required because the iframe
  // sandbox blocks browser modal dialogs; see pendingUninstall comment.
  const handleUninstall = (app) => {
    setPendingUninstall(app)
  }

  const confirmUninstall = async () => {
    const app = pendingUninstall
    if (!app) return
    setBusy(true)
    setBusyItemId(detail?.id || null)
    setBusyActionKind('uninstall')
    try {
      const r = await fetch(`/api/apps/${app.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok && r.status !== 204) {
        const text = await r.text()
        throw new Error(`Uninstall failed: ${r.status} ${text}`)
      }
      checkGenerationsRef.current.set(String(app.id), ++checkGenerationRef.current)
      await refreshInstalled()
      window.mobius?.signal?.('app_uninstalled', { slug: app.slug || app.id })
      setToast({ kind: 'success', message: `${app.name} uninstalled.` })
      setPendingUninstall(null)
      closeDetail()
    } catch (e) {
      setToast({ kind: 'error', message: e.message || String(e) })
      setPendingUninstall(null)
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // Each nested level owns one reversible host entry. No iframe history or
  // timeout fallback: an unowned view would strand the device's Back gesture.
  const openDetail = useCallback((item, signal, { focus = '', push = false, below = null } = {}) => openDetailEntry(navDetailRef, item, {
    nav: window.mobius.nav,
    show: showDetail,
    signal,
    focus,
    push,
    below,
    cancelPendingDestination,
    prepare: target => {
      reviewCapabilities(target)
      if (!navDetailRef.current) savedGridScrollRef.current = gridScrollRef.current?.scrollTop || 0
    },
  }), [reviewCapabilities, cancelPendingDestination, showDetail])

  const openCollection = useCallback(async (id, signal) => {
    if (collectionNavRef.current) return
    const fromTab = DISCOVERY_TABS.has(tab) ? tab : 'browse'
    homeScrollRef.current = gridScrollRef.current?.scrollTop || 0
    const leave = () => {
      cancelPendingDestination()
      collectionNavRef.current = null
      savedGridScrollRef.current = homeScrollRef.current
      setActiveCollection(null)
    }
    let handle
    handle = window.mobius.nav.open('app-store-collection', {
      onBack: leave,
      onForward: () => {
        setTab(fromTab)
        cancelPendingDestination()
        setCategory('all')
        collectionNavRef.current = handle
        savedGridScrollRef.current = 0
        setActiveCollection(id)
      },
    })
    collectionNavRef.current = handle
    const cancel = () => {
      if (collectionNavRef.current === handle) collectionNavRef.current = null
      handle.close()
    }
    signal?.addEventListener('abort', cancel, { once: true })
    const {status} = await handle.outcome
    signal?.removeEventListener('abort', cancel)
    if (collectionNavRef.current !== handle) { handle.close(); return }
    if (status !== 'owned') { collectionNavRef.current = null; return }
    savedGridScrollRef.current = 0
    setActiveCollection(id)
  }, [cancelPendingDestination, tab])

  const closeCollection = useCallback(() => {
    if (closeTopLayerRef.current?.('creator')) return
    collectionNavRef.current?.close()
    collectionNavRef.current = null
    savedGridScrollRef.current = homeScrollRef.current
    setActiveCollection(null)
  }, [])

  useEffect(() => () => {
    cancelDestinationRef.current?.()
    cancelDestinationRef.current = null
    navDetailRef.current?.handle.close()
    collectionNavRef.current?.close()
  }, [])

  const prepareCatalogUpdate = useCallback(async (item, { signal } = {}) => {
    const installedApp = findInstalled(installed, item)
    if (!installedApp) throw new Error('Installed app could not be matched for review.')
    const updateItem = catalogUpdateItemForInstalled(item, installedApp)
    let candidate
    try {
      candidate = await loadUpdateCandidatePreview(
        installedApp.id, updateItem.manifest_url, token, { signal },
      )
    } catch (error) {
      if (error?.status === 409 && CANDIDATE_REJECTION_CODES.has(error.code)) {
        // The platform would not apply this candidate to the installed app
        // (a moved repository, or another package). The card says why too.
        // Other coded 409s (a Git source that could not be read) are ordinary
        // failures, with Try again when they are retryable.
        checkGenerationsRef.current.set(String(installedApp.id), ++checkGenerationRef.current)
        setUpdateChecks(prev => mergeUpdateChecks(prev, {
          [installedApp.id]: {
            ...prev[installedApp.id],
            available: null,
            candidateRejected: { code: error.code, message: error.message },
          },
        }))
      }
      throw error
    }
    if (candidate?.pending_update_state === 'needs_resolution') {
      // The update-check that offered "Update" was stale. The preview is newer
      // than any probe in flight, so record the conflict and let the card
      // offer "Resolve in chat" instead of another Update that hits it again.
      checkGenerationsRef.current.set(String(installedApp.id), ++checkGenerationRef.current)
      setUpdateChecks(prev => mergeUpdateChecks(prev, {
        [installedApp.id]: {
          ...prev[installedApp.id],
          available: true,
          pendingUpdateState: 'needs_resolution',
        },
      }))
    }
    const capabilityPreview = candidate.capability_preview
    const capabilityReview = {
      status: capabilityDiffNeedsReview(capabilityPreview?.capability_diff)
        ? 'changed'
        : 'ready',
      preview: capabilityPreview,
      error: '',
    }
    if (capabilityPreview) setCapabilityReviews(prev => ({ ...prev, [item.id]: capabilityReview }))
    return {
      item: updateItem,
      installedApp,
      preview: candidate,
      capabilityReview,
    }
  }, [installed, token])
  const prepareCatalogUpdateRef = useRef(prepareCatalogUpdate)
  prepareCatalogUpdateRef.current = prepareCatalogUpdate

  // Mirror one controller's state into the open dialog.
  const showTransaction = (review) => {
    setUpdateTransaction(review)
    setCheckingAllUpdates(review.phase === 'checking')
    setCheckingUpdateItemId(review.phase === 'checking' && review.entries.length === 1
      ? review.entries[0].item.id : null)
  }

  // A batch outcome updates its card only when this Store saw the entry
  // still running: an old finished batch must not hide a newer release.
  const runningBatchEntriesRef = useRef(new Set())
  const reportBatchOutcomes = useCallback((snapshot) => {
    const running = runningBatchEntriesRef.current
    const changes = {}
    for (const entry of snapshot.entries) {
      const key = `${snapshot.id}:${entry.app_id}`
      if (entry.status === 'queued' || entry.status === 'applying') { running.add(key); continue }
      if (!running.delete(key) || !['updated', 'conflict'].includes(entry.status)) continue
      // The server's outcome is newer than any check in flight for this app.
      checkGenerationsRef.current.set(String(entry.app_id), ++checkGenerationRef.current)
      changes[entry.app_id] = entry.status === 'updated'
        ? { available: false, pendingUpdateState: 'none', upstreamVersion: entry.version || null }
        : { available: true, pendingUpdateState: 'needs_resolution', upstreamVersion: entry.version || null }
    }
    if (Object.keys(changes).length) setUpdateChecks(prev => mergeUpdateChecks(prev, changes))
  }, [])

  // A Möbius without server batches (no mobius#1843) gets the per-app
  // reviewed update the Store used before: the same /install request, bound
  // to the reviewed source and access digests, one app at a time.
  const applyReviewedUpdate = async (entry) => {
    const { item, installedApp, preview, capabilityReview } = entry.prepared
    // A failure throws: the batch controller records it like any other.
    const result = await installApp({
      manifest_url: item.manifest_url,
      manifest: item.manifest,
      raw_base: item.raw_base,
      token,
      reviewed_capability_digest: capabilityReview.preview.capability_digest,
      reviewed_source_digest: preview.source_digest,
      update_app_id: installedApp.id,
      reviewed_upstream_commit: preview.upstream_commit,
    })
    const conflict = result.mode === 'conflict'
    const id = result.id || installedApp.id
    checkGenerationsRef.current.set(String(id), ++checkGenerationRef.current)
    setUpdateChecks(prev => mergeUpdateChecks(prev, {
      [id]: conflict
        ? { available: true, pendingUpdateState: 'needs_resolution', upstreamVersion: result.version || null }
        : { available: false, pendingUpdateState: 'none', upstreamVersion: result.version || null },
    }))
    if (!conflict) window.mobius?.signal?.('app_updated', { slug: id })
    return { status: conflict ? 'conflict' : 'updated', version: result.version || null, warnings: result.warnings || [] }
  }

  // Whether this Möbius has server batches, decided in one place: from the
  // batch list (or, before it answers, the same generic route-missing answer
  // on submit). 'unknown' | 'supported' | 'missing'.
  const batchSupportRef = useRef('unknown')
  const batchesMissing = (error) => {
    if (batchSupportRef.current === 'unknown' && batchRoutesMissing(error)) batchSupportRef.current = 'missing'
    return batchSupportRef.current === 'missing'
  }

  // Store-standard updates: Update applies at once
  // when every candidate keeps the same access. The server still verifies each
  // exact source and access digest. The review dialog appears only when access
  // widens or is unknown, a check fails, a conflict needs resolving, or this
  // Möbius lacks server batches.
  const quickUpdateRef = useRef(false)
  const autoApplyRef = useRef(false)
  const [quickUpdate, setQuickUpdate] = useState(false)
  const startQuickUpdate = () => { quickUpdateRef.current = true; autoApplyRef.current = false; setQuickUpdate(true) }
  const showReviewDialog = () => { quickUpdateRef.current = false; autoApplyRef.current = false; setQuickUpdate(false) }

  const createBatchController = (entries = []) => {
    const batch = createUpdateBatch({
      prepare: (item, options) => prepareCatalogUpdateRef.current(item, options),
      submit: payload => submitUpdateBatch(payload, token),
      read: (id, options) => loadUpdateBatch(id, token, options),
      watch: (id, onSnapshot, options) => watchUpdateBatch(id, token, onSnapshot, options),
      newId: randomUuid,
      resolve: (appIds, agent) => createConflictResolverBatch(appIds, 'preserve_local', token, agent),
      refresh: () => refreshInstalled(),
      applyOne: applyReviewedUpdate,
      batchesMissing,
      // The platform refused this id, so nothing runs under it: drop the
      // Library placeholder a closed dialog may have left.
      onRefused: id => {
        if (batchControllersRef.current.get(id) === batch) batchControllersRef.current.delete(id)
        setUpdateBatches(previous => previous.filter(item => !(item.id === id && item.phase === 'unknown')))
      },
      onSnapshot: snapshot => {
        for (const [id, controller] of batchControllersRef.current) {
          if (controller === batch && id !== snapshot.id) batchControllersRef.current.delete(id)
        }
        const previous = batchControllersRef.current.get(snapshot.id)
        if (previous && previous !== batch && previous !== updateBatchRef.current) previous.dispose()
        batchControllersRef.current.set(snapshot.id, batch)
        reportBatchOutcomes(snapshot)
        setUpdateBatches(previous => {
          const current = previous.find(item => item.id === snapshot.id)
          return [newestBatchSnapshot(current, snapshot), ...previous.filter(item => item.id !== snapshot.id)]
        })
      },
      onChange: review => {
        if (review.phase === 'submitting' && review.batchId) {
          // This Store is submitting these entries: their outcome is news.
          for (const entry of review.entries) {
            if (entry.status === 'ready') runningBatchEntriesRef.current.add(`${review.batchId}:${entry.prepared.installedApp.id}`)
          }
        }
        if (updateBatchRef.current === batch) showTransaction(review)
        if (updateBatchRef.current !== batch) return
        if (quickUpdateRef.current && review.phase === 'review') {
          quickUpdateRef.current = false
          const plain = review.entries.length > 0 && review.entries.every(entry =>
            entry.status === 'ready' && updateBatchDisposition(entry.prepared).kind === 'ready')
          if (plain && !batchesMissing()) { autoApplyRef.current = true; Promise.resolve().then(() => batch.confirm()) }
          else showReviewDialog()
        } else if (autoApplyRef.current) {
          if (review.phase === 'applying' && !review.local) {
            autoApplyRef.current = false
            Promise.resolve().then(() => { if (updateBatchRef.current === batch) closeUpdateTransaction() })
          } else if (review.phase === 'review' || review.local || review.error) showReviewDialog()
        }
      },
    }, entries)
    return batch
  }

  const openUpdateBatch = (entries = []) => {
    if (updateBatchRef.current) return null
    const batch = createBatchController(entries)
    updateBatchRef.current = batch
    showTransaction(batch.state)
    return batch
  }

  // Closing the dialog never cancels server work. A batch the server has (or
  // may have) accepted keeps its controller, so Library can show its progress.
  const closeUpdateTransaction = () => {
    const batch = updateBatchRef.current
    quickUpdateRef.current = false
    autoApplyRef.current = false
    setQuickUpdate(false)
    if (!batch) return
    updateBatchRef.current = null
    const { batchId, phase, entries } = batch.state
    // A review closed before anything was sent also drops the Store's own
    // update that Update all queued behind it.
    if (!batchId) { batch.dispose(); selfAfterBatchRef.current = false }
    else {
      batchControllersRef.current.set(batchId, batch)
      if (phase === 'submitting' || batch.uncertain) {
        // Accepted or not, this id may be running: keep a placeholder until
        // the server lists it.
        setUpdateBatches(previous => previous.some(item => item.id === batchId) ? previous : [{
          id: batchId, phase: 'unknown', entries: entries.filter(entry => entry.status === 'ready').map(entry => ({
            app_id: entry.prepared.installedApp.id, status: 'queued',
          })),
        }, ...previous])
      }
    }
    setCheckingAllUpdates(false)
    setCheckingUpdateItemId(null)
    setUpdateTransaction(null)
  }

  useEffect(() => {
    if (!token) return undefined
    let live = true
    let generation = 0
    // One read at a time: events that arrive during a read coalesce into one
    // more read after it.
    let inFlight = null
    let again = false
    const readOnce = () => {
      const requestGeneration = ++generation
      return loadUpdateBatches(token).then(result => {
        if (!live || requestGeneration !== generation) return
        batchSupportRef.current = 'supported'
        const batches = (Array.isArray(result?.batches) ? result.batches : []).map(normalizeBatchSnapshot).filter(Boolean)
        setBatchLoadError(null)
        setUpdateBatches(previous => [
          ...batches.map(snapshot => newestBatchSnapshot(previous.find(item => item.id === snapshot.id), snapshot)),
          // A placeholder stays only while its controller still holds that
          // possibly accepted id.
          ...previous.filter(item => item.phase === 'unknown' && !batches.some(current => current.id === item.id)
            && batchControllersRef.current.get(item.id)?.state.batchId === item.id),
        ])
        for (const snapshot of batches) reportBatchOutcomes(snapshot)
        // Only a submission that may or may not have started needs its own
        // read; listed batches already came with their snapshot.
        for (const [id, controller] of batchControllersRef.current) {
          if (controller.uncertain && !batches.some(item => item.id === id)) void controller.refreshSnapshot().catch(() => {})
        }
        for (const snapshot of batches) {
          const controller = batchControllersRef.current.get(snapshot.id)
          if (controller) {
            controller.offer(snapshot)
          } else if (snapshot.phase === 'applying') {
            // Started elsewhere or before this Store opened: follow it live.
            const background = createBatchController()
            batchControllersRef.current.set(snapshot.id, background)
            background.recover(snapshot)
          }
        }
      }).catch(error => {
        if (!live || requestGeneration !== generation) return
        if (batchRoutesMissing(error)) {
          // This Möbius predates server batches: nothing to show, and updates
          // use the per-app fallback.
          batchSupportRef.current = 'missing'
          setBatchLoadError(null)
          return
        }
        setBatchLoadError({ message: error?.message || 'Update progress is unavailable.', status: error?.status || 0 })
      })
    }
    const reload = () => {
      if (inFlight) { again = true; return inFlight }
      inFlight = readOnce().finally(() => {
        inFlight = null
        if (again && live) { again = false; void reload() }
      })
      return inFlight
    }
    reloadUpdateBatchesRef.current = reload
    void reload()
    const foreground = () => { if (document.visibilityState === 'visible') void reload() }
    const managed = event => {
      if (event.source !== window.parent || event.data?.type !== 'moebius:managed-app-event') return
      void reload()
    }
    window.addEventListener('focus', foreground)
    document.addEventListener('visibilitychange', foreground)
    window.addEventListener('message', managed)
    return () => {
      live = false
      if (reloadUpdateBatchesRef.current === reload) reloadUpdateBatchesRef.current = null
      window.removeEventListener('focus', foreground)
      document.removeEventListener('visibilitychange', foreground)
      window.removeEventListener('message', managed)
    }
  }, [token, reportBatchOutcomes])

  const catalogItemForAppId = (appId) => displayCatalog.find(
    candidate => lifecycleById.get(candidate.id)?.installedApp?.id === Number(appId),
  )

  // Reopen a batch's progress or results. Reading it never resubmits it.
  const openingBatchRef = useRef(false)
  const openStoredUpdateBatch = async (id) => {
    if (!id || updateBatchRef.current || openingBatchRef.current) return
    const seed = appIds => appIds.flatMap(appId => {
      const item = catalogItemForAppId(appId)
      return item ? [{ item, prepared: { installedApp: { id: Number(appId) } } }] : []
    })
    const existing = batchControllersRef.current.get(id)
    if (existing?.state.batchId === id) {
      existing.seedEntries(seed(existing.state.entries.map(entry => entry.prepared?.installedApp?.id)))
      updateBatchRef.current = existing
      showTransaction(existing.state)
      void existing.refreshSnapshot().catch(() => {})
      return
    }
    // One open at a time: a double click or a background reload during the
    // read cannot create a second controller for this batch.
    openingBatchRef.current = true
    try {
      const snapshot = normalizeBatchSnapshot(await loadUpdateBatch(id, token))
      if (!snapshot) throw new Error('Update progress could not be read.')
      if (updateBatchRef.current) return
      let batch = batchControllersRef.current.get(id)
      if (batch?.state.batchId === id) {
        batch.seedEntries(seed(snapshot.entries.map(row => row.app_id)))
        batch.offer(snapshot)
      } else {
        batch?.dispose()
        batch = createBatchController(seed(snapshot.entries.map(row => row.app_id))
          .map(entry => ({ ...entry, status: 'queued' })))
        batchControllersRef.current.set(id, batch)
        batch.recover(snapshot)
      }
      updateBatchRef.current = batch
      showTransaction(batch.state)
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Update progress could not be read.' })
    } finally {
      openingBatchRef.current = false
    }
  }

  const handleOpenRunningBatch = (id) => {
    closeUpdateTransaction()
    void openStoredUpdateBatch(id)
  }

  // Individual and batch updates use the same read-only candidate contract.
  // A row's Get opens the app page the same way tapping its name does.
  const handleCatalogUpdate = async (item, opts = {}, openPage = openDetailFromPage) => {
    if (!opts.isUpdate) {
      openPage(item)
      return
    }
    if (busy || updateBatchRef.current) return
    setCardErrors(prev => withoutKey(prev, item.id))
    setCardErrorRetries(prev => withoutKey(prev, item.id))
    startQuickUpdate()
    await openUpdateBatch()?.check([item])
  }

  // A resolver agent finishes in its own chat, outside this iframe. When the
  // shell reports an app change (or the owner returns to the Store), read the
  // resolving apps' state so the open results settle by themselves.
  const resolvingAppKey = (updateTransaction?.phase === 'review' ? updateTransaction.entries : [])
    .filter(entry => entry.status === 'conflict' && entry.resolver)
    .map(entry => entry.prepared?.installedApp?.id)
    .filter(id => id != null)
    .join(',')
  useEffect(() => {
    if (!resolvingAppKey) return undefined
    const ids = resolvingAppKey.split(',').map(Number)
    let active = true
    const settle = async () => {
      if (!active) return
      const rows = installedRef.current.filter(app => ids.includes(app.id))
      const checks = await refreshUpdateChecks(rows, { force: true })
      if (!active || !checks) return
      updateBatchRef.current?.reconcile(checks)
      if (ids.some(id => checks[id]?.available === false)) refreshInstalled().catch(() => {})
    }
    const onManagedAppEvent = (event) => {
      if (event.source !== window.parent || event?.data?.type !== 'moebius:managed-app-event') return
      const changed = Number(event.data.event?.appId)
      if (!Number.isFinite(changed) || ids.includes(changed)) settle()
    }
    const onReturn = () => {
      if (document.visibilityState === 'visible') settle()
    }
    window.addEventListener('message', onManagedAppEvent)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    settle()
    return () => {
      active = false
      window.removeEventListener('message', onManagedAppEvent)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [resolvingAppKey, refreshInstalled, refreshUpdateChecks])

  // One owner-visible chat reviews the selected updates: ready releases are
  // reviewed before anything applies, failed ones are investigated.
  const handleAgentUpdateReview = async (entries, agent = null) => {
    const pending = (entries || []).filter(entry => entry.status === 'ready' || entry.status === 'failed')
    if (!pending.length || agentReviewingUpdate) return
    if (!agent) {
      chooseUpdateAgent('Choose review agent', choice => handleAgentUpdateReview(pending, choice))
      return
    }
    setAgentReviewingUpdate(true)
    try {
      const title = pending.length === 1
        ? `${pending[0].status === 'failed' ? 'Investigate' : 'Review'} ${pending[0].item.manifest?.name || pending[0].item.name || pending[0].item.id} update`
        : `Review ${pending.length} app updates`
      const chat = await createAppChat(title, token, { ownerVisible: true, agent, archiveOnGoalComplete: true })
      const content = pending.map(entry => {
        const context = {
          item: entry.item,
          installedApp: findInstalled(installed, entry.item) || entry.prepared?.installedApp,
          preview: entry.prepared?.preview || null,
        }
        return entry.status === 'failed'
          ? buildUpdateFailureMessage({ ...context, error: entry.error })
          : buildUpdateReviewMessage(context)
      }).join('\n\n---\n\n')
      await seedChatMessage(chat.id, `/goal ${content}`, token)
      openChat(chat.id)
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not open an agent review.' })
    } finally {
      setAgentReviewingUpdate(false)
    }
  }

  // Publishing stays in the Store while an owner-visible agent works. The
  // conversation remains available as optional detail rather than navigation.
  // Each app's listing has one agent chat: later requests, for the same part
  // or another, continue it instead of starting a parallel agent.
  const handleListingAgent = useCallback(async (app, problem, focus = '') => {
    if (!app?.id) return null
    const name = app.name || app.slug
    const scope = listingAgentScope(app.id)
    try {
      const { chatId, reused } = await sendToScopedAgentChat(token, {
        title: `Get ${name} ready to publish`,
        scope,
        scopeLabel: name,
        first: buildListingAgentMessage({ app, problem, focus }),
        followUp: buildListingAgentMessage({ app, problem, focus, followUp: true }),
      })
      setToast({
        kind: 'success',
        message: reused
          ? `Sent to the agent for the ${name} listing. You can keep working here.`
          : `An agent is preparing ${name}. You can keep working here.`,
        action: { label: 'View work', onClick: () => openChat(chatId) },
      })
      return { chatId }
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not open an agent chat.' })
      return null
    }
  }, [token])

  const handleListingAgentStatus = useCallback((app) => (
    app?.id ? latestScopedAppChat(listingAgentScope(app.id), token) : Promise.resolve(null)
  ), [token])

  // The creator-run agent check: an owner-visible agent reads the exact
  // accepted revision and writes its verdict into this Store's storage, which
  // the Publish tab follows live.
  const handlePublishCheck = useCallback(async (app, acceptedCommit) => {
    if (!app?.id || !acceptedCommit) return false
    try {
      const chat = await createAppChat(`Check ${app.name || app.slug} before publishing`, token, { ownerVisible: true })
      await seedChatMessage(chat.id, buildPublishCheckMessage({ app, acceptedCommit, storeAppId: appId }), token)
      setToast({
        kind: 'success',
        message: `Your agent is checking ${app.name || app.slug}. The result appears here.`,
        action: { label: 'View work', onClick: () => openChat(chat.id) },
      })
      return true
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not start the agent check.' })
      return false
    }
  }, [appId, token])

  const handlePublishFix = useCallback(async (app, issues) => {
    if (!app?.id) return false
    try {
      const chat = await createAppChat(`Fix ${app.name || app.slug} before publishing`, token, { ownerVisible: true })
      await seedChatMessage(chat.id, buildPublishFixMessage({ app, issues }), token)
      setToast({
        kind: 'success',
        message: `An agent is fixing ${app.name || app.slug}. Check again when it's done.`,
        action: { label: 'View work', onClick: () => openChat(chat.id) },
      })
      return true
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not open an agent chat.' })
      return false
    }
  }, [token])

  const loadPublisherReviews = useCallback((communityAppId) => (
    loadCommunityReviews(token, communityAppId)
  ), [token])

  const handleAskAgentAboutError = useCallback(async (item, error, agent = null) => {
    if (!item || !error || agentErrorItemId) return
    if (!agent) {
      chooseUpdateAgent('Investigate update failure', choice => handleAskAgentAboutError(item, error, choice))
      return
    }
    const installedApp = findInstalled(installed, item)
    setAgentErrorItemId(item.id)
    try {
      const title = `Investigate ${item.manifest?.name || item.id} update`
      const chat = await createAppChat(title, token, { ownerVisible: true, agent, archiveOnGoalComplete: true })
      const content = buildUpdateFailureMessage({
        item,
        installedApp,
        preview: null,
        error,
      })
      await seedChatMessage(chat.id, `/goal ${content}`, token)
      openChat(chat.id)
    } catch (askError) {
      setToast({
        kind: 'error',
        message: askError.message || 'Could not open an agent chat.',
      })
    } finally {
      setAgentErrorItemId(null)
    }
  }, [agentErrorItemId, installed, token])

  const closeDetail = useCallback(() => closeDetailEntry(navDetailRef, showDetail), [showDetail])
  const backDetail = useCallback(() => backDetailEntry(navDetailRef, showDetail), [showDetail])

  // Layers above an app page (see overlaysRef). `show` draws the layer,
  // `restore` returns to exactly what was beneath it.
  const openLayer = (kind, show, restore, label) => {
    const layer = { kind, show, restore, label, handle: null }
    const enter = () => { showDetail(null); show(); setOverlay({ kind, label }) }
    layer.handle = window.mobius.nav.open(`app-store-${kind}`, {
      onBack: () => {
        overlaysRef.current = overlaysRef.current.filter((entry) => entry !== layer)
        setOverlay(overlaysRef.current.at(-1) || null)
        restore()
      },
      onForward: () => { overlaysRef.current = [...overlaysRef.current, layer]; enter() },
    })
    overlaysRef.current = [...overlaysRef.current, layer]
    enter()
    layer.handle.outcome.then(({ status }) => {
      if (status === 'owned' || !overlaysRef.current.includes(layer)) return
      overlaysRef.current = overlaysRef.current.filter((entry) => entry !== layer)
      setOverlay(overlaysRef.current.at(-1) || null)
    })
  }
  // The on-screen Back of a layer page: peel the top layer off.
  closeTopLayerRef.current = (kind) => {
    const layer = overlaysRef.current.at(-1)
    if (!layer || (kind && layer.kind !== kind) || detail) return false
    overlaysRef.current = overlaysRef.current.slice(0, -1)
    setOverlay(overlaysRef.current.at(-1) || null)
    layer.handle.close()
    layer.restore()
    return true
  }
  // Moving to another tab leaves every layer and the app pages under them.
  closeLayersRef.current = () => {
    if (!overlaysRef.current.length) return
    for (const layer of [...overlaysRef.current].reverse()) layer.handle.close()
    overlaysRef.current = []
    setOverlay(null)
    closeDetailEntry(navDetailRef, showDetail)
  }
  // An app opened from a layer page goes above it, and Back returns to it.
  const openDetailFromPage = (item) => {
    const layer = !detail ? overlaysRef.current.at(-1) : null
    return layer ? openDetail(item, undefined, { push: true, below: () => { layer.show(); setOverlay({ kind: layer.kind, label: layer.label }) } })
      : openDetail(item)
  }

  const handleCommunityWithdraw = useCallback(async () => {
    const community = detail?.community
    if (!community?.id || communityActionBusy || !communityIdentity?.linked) {
      return false
    }
    setCommunityActionBusy(true)
    setCommunityActionError({ key: community.id, message: '' })
    try {
      await withdrawCommunityApp(token, community.id)
      closeDetail()
      await refreshCommunity()
      setToast({
        kind: 'success',
        message: `${detail?.name || 'Your app'} was withdrawn from the community.`,
      })
      return true
    } catch (error) {
      setCommunityActionError({
        key: community.id,
        message: error?.message || 'This app could not be withdrawn.',
      })
      return false
    } finally {
      setCommunityActionBusy(false)
    }
  }, [communityActionBusy, communityIdentity, detail, token, closeDetail, refreshCommunity])

  useLayoutEffect(() => {
    if (!detail && gridScrollRef.current) {
      gridScrollRef.current.scrollTop = savedGridScrollRef.current
    }
  }, [detail, activeCollection])

  // Roving tab navigation: ArrowLeft/ArrowRight move selection between the
  // tabs with wrap, and move DOM focus to the newly-selected tab (the
  // tablist's roving tabIndex keeps only the active tab in the Tab order).
  const onTabsKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const order = ['browse', 'apps', 'games', 'library']
    const i = order.indexOf(tab)
    const next = e.key === 'ArrowRight'
      ? order[(i + 1) % order.length]
      : order[(i - 1 + order.length) % order.length]
    selectTab(next)
    document.getElementById(`st-tab-${next}`)?.focus()
  }

  const displayCatalog = useMemo(() => {
    const remainingInstalledIds = new Set(otherInstalledCatalogSources.map((item) => item.id))
    return withAssignedCategories(sortCatalogForDisplay([
      ...listedCatalog,
      ...otherInstalledCatalog.filter((item) => remainingInstalledIds.has(item.id)),
    ]), communityCategories)
  }, [listedCatalog, otherInstalledCatalog, otherInstalledCatalogSources, communityCategories])
  const detailCommunityFeedback = communityFeedbackOf(detail)
  const detailCommunityFeedbackKey = detailCommunityFeedback
    ? `${detailCommunityFeedback.id}:${detailCommunityFeedback.revision_id}`
    : ''
  const systemSetupReady = useMemo(
    () => systemSetupComplete || hasConnectedProvider(providerStatus),
    [systemSetupComplete, providerStatus],
  )
  const lifecycleById = useMemo(() => {
    const byId = new Map()
    for (const item of displayCatalog) {
      byId.set(item.id, appLifecycleFor(item, {
        installed,
        updateChecks,
        installedUnavailable: !!installedLoadError,
        setupCompletions,
        systemSetupReady,
      }))
    }
    return byId
  }, [displayCatalog, installed, updateChecks, installedLoadError, setupCompletions, systemSetupReady])

  // The Store's own update: a Library row, counted in Update all.
  const selfUpdate = useSelfUpdate({ appId, token })
  const filterCounts = useMemo(() => {
    let updates = selfUpdate.pending ? 1 : 0
    for (const item of displayCatalog) {
      const lifecycle = lifecycleById.get(item.id)
      if (lifecycle?.key === 'update' || lifecycle?.key === 'conflict') updates += 1
    }
    return { update: updates }
  }, [selfUpdate.pending, displayCatalog, lifecycleById])

  // Publishing and reviews need a linked mobius.you account with a handle.
  // Signing in and choosing the handle happen in Settings › Accounts › Möbius.
  const openMobiusAccount = useCallback(() => openSettings('mobius-account'), [openSettings])

  // Apps a server batch is applying (or may be, for an unconfirmed
  // submission) show as updating and stay out of another "Update all".
  const runningBatches = useMemo(
    () => updateBatches.filter(batch => batch.phase === 'applying' || batch.phase === 'unknown'),
    [updateBatches],
  )
  const updatingItemIds = useMemo(() => {
    const appIds = new Set(runningBatches.flatMap(batch => batch.entries
      .filter(entry => entry.status === 'queued' || entry.status === 'applying')
      .map(entry => Number(entry.app_id))))
    return displayCatalog.filter(item => appIds.has(lifecycleById.get(item.id)?.installedApp?.id)).map(item => item.id)
  }, [runningBatches, displayCatalog, lifecycleById])
  // Per-app stage of a running server batch (queued or applying), for the
  // in-place progress bars on cards and the app page.
  const updateStages = useMemo(() => {
    const byAppId = new Map()
    for (const batch of runningBatches) for (const entry of batch.entries) {
      if (entry.status === 'queued' || entry.status === 'applying') byAppId.set(Number(entry.app_id), entry.status)
    }
    const stages = {}
    for (const item of displayCatalog) {
      const stage = byAppId.get(lifecycleById.get(item.id)?.installedApp?.id)
      if (stage) stages[item.id] = stage
    }
    return stages
  }, [runningBatches, displayCatalog, lifecycleById])
  // Updates applying on the server after their dialog closed: real counts.
  const backgroundProgress = (() => {
    const entries = runningBatches.flatMap(batch => batch.entries)
    if (!entries.some(entry => entry.status === 'queued' || entry.status === 'applying')) return null
    const { finished, total } = batchProgressOf(entries)
    return total ? { current: finished, total } : null
  })()
  const transactionProgress = updateBatchBusy(updateTransaction)
    ? batchProgressOf(updateTransaction.entries)
    : null

  const updateItems = useMemo(
    () => displayCatalog.filter((item) => lifecycleById.get(item.id)?.key === 'update' && !updatingItemIds.includes(item.id)),
    [displayCatalog, lifecycleById, updatingItemIds],
  )

  const conflictItems = useMemo(
    () => displayCatalog.filter((item) => lifecycleById.get(item.id)?.key === 'conflict'),
    [displayCatalog, lifecycleById],
  )

  // Shared "Resolve all" action: start the preserving resolver for every
  // conflicting app at once. The backend spawn is idempotent per app+upstream,
  // so this never duplicates a resolver already started from a card.
  const handleResolveAllConflicts = async (agent = null) => {
    if (busy || resolvingAll || !conflictItems.length) return
    if (!agent) {
      chooseUpdateAgent('Resolve all conflicts', choice => handleResolveAllConflicts(choice))
      return
    }
    setResolvingAll(true)
    setCategory('needs')
    let started = 0
    let failed = 0
    let firstChatId = null
    try {
      for (const item of conflictItems) {
        const appId = lifecycleById.get(item.id)?.installedApp?.id
        if (!appId) { failed += 1; continue }
        try {
          const resolver = await createConflictResolverChat(appId, 'preserve_local', token, agent)
          if (resolver?.chat_id) {
            started += 1
            if (!firstChatId) firstChatId = resolver.chat_id
          }
        } catch (e) {
          failed += 1
          setCardErrors(prev => ({ ...prev, [item.id]: e.message || String(e) }))
        }
      }
    } finally {
      setResolvingAll(false)
    }
    await refreshInstalled()
    const parts = []
    if (started) parts.push(`${started} ${started === 1 ? 'app is' : 'apps are'} being reconciled`)
    if (failed) parts.push(`${failed} could not start`)
    setToast({
      kind: failed ? 'error' : 'success',
      message: `${parts.join('; ') || 'Nothing to fix'}.`,
      action: firstChatId ? { label: 'Open agent', onClick: () => openChat(firstChatId) } : null,
    })
  }

  // Update all covers the App Store too, like any other app. It goes last:
  // installing it reloads the Store, so the other apps' updates start first
  // (they finish on the server either way).
  const selfInUpdateAll = selfUpdate.kind === 'update' && selfUpdate.phase === 'idle'
  const updateAllCount = updateItems.length + (selfInUpdateAll ? 1 : 0)
  const selfAfterBatchRef = useRef(false)
  const runSelfUpdate = () => {
    selfUpdate.openPanel()
    if (!selfUpdate.needsAccessReview && !selfUpdate.accessRowsMissing) selfUpdate.update()
  }
  const handleUpdateAll = async () => {
    if (!updateAllCount || busy || updateBatchRef.current || installedLoadError) return
    if (tab !== 'library' || libraryTab !== 'update') { closeDetail(); selectTab('library'); setCategory('update') }
    if (!updateItems.length) { runSelfUpdate(); return }
    selfAfterBatchRef.current = selfInUpdateAll
    startQuickUpdate()
    await openUpdateBatch()?.check(updateItems)
  }
  useEffect(() => {
    if (!selfAfterBatchRef.current || updateTransaction || runningBatches.length || checkingAllUpdates) return
    selfAfterBatchRef.current = false
    if (selfUpdate.kind === 'update') runSelfUpdate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTransaction, runningBatches.length, checkingAllUpdates])


  const visibleCatalog = useMemo(
    () => filterCatalog(displayCatalog, { query }),
    [displayCatalog, query],
  )

  const libraryCatalog = useMemo(
    () => visibleCatalog.filter((item) => !!lifecycleById.get(item.id)?.installedApp),
    [visibleCatalog, lifecycleById],
  )
  // Library's tabs: what needs a decision, waiting updates, everything
  // installed and saved apps. The Store's own update counts where it shows.
  const libraryGroups = useMemo(
    () => libraryCollections(libraryCatalog, lifecycleById),
    [libraryCatalog, lifecycleById],
  )
  const groupCount = (id) => libraryGroups.find((group) => group.id === id)?.items.length || 0
  const libraryCounts = {
    needs: groupCount('attention') + (selfUpdate.kind === 'conflict' && selfUpdate.pending ? 1 : 0),
    update: groupCount('updates') + (selfUpdate.kind === 'update' && selfUpdate.pending ? 1 : 0),
    installed: libraryCatalog.length,
    saved: savedIds.length,
  }
  const libraryTab = query.trim() ? 'installed' : libraryTabFor(category, libraryCounts)

  useEffect(() => {
    const nav = window.mobius?.nav
    if (!intentDestination && typeof nav?.setLocation === 'function') {
      const location = storeLocation({
        tab,
        category: tab === 'apps' || tab === 'games' ? shelfCategories[tab] : category,
        query, activeCollection, detailId: detail?.id,
      })
      if (location) nav.setLocation(location)
    }
  }, [intentDestination, tab, category, shelfCategories, query, activeCollection, detail?.id])

  const destinationResolution = useMemo(() =>
    resolveCatalogItemIntent(displayCatalog, intentDestination?.itemId, installed),
  [displayCatalog, intentDestination?.itemId, installed])

  useEffect(() => {
    // An intent is a one-shot command. Metadata refreshes may make a waiting
    // target ready, but must not restart an ownership request already sent.
    if (!intentDestination || cancelDestinationRef.current) return
    const destination = intentDestination
    const resolution = destinationResolution
    const lookup = !resolution.item && destination.itemId?.startsWith('community:')
    if (destination.kind === 'app') {
      if (loadingCatalog || (!resolution.item && !catalogHydrated)) return
      if (destination.restored && !lookup && (
        resolution.item ? !resolution.item.manifest && (!destination.collectionId || !catalogHydrated)
          : ((!destination.collectionId && (installedLoadError || catalogLoadError))
          || otherInstalledCatalogSources.some(item => item.id === destination.itemId))
      )) return
    }
    const controller = new AbortController()
    const { signal } = controller
    cancelDestinationRef.current = () => controller.abort()
    const finish = next => {
      if (signal.aborted) return
      cancelDestinationRef.current = null
      setIntentDestination(next)
    }
    async function openDestination() {
      if (destination.kind === 'updates') {
        closeDetail()
        closeCollection()
        selectTab('library')
        setCategory('update')
        setQuery('')
      } else if (destination.kind === 'collection') {
        await openCollection(destination.collectionId, signal)
        finish(destination.itemId
          ? { kind: 'app', itemId: destination.itemId, restored: true, collectionId: destination.collectionId }
          : null)
        return
      } else {
        let item = resolution.item
        if (lookup) {
          try {
            const row = await loadCommunityApp(token, destination.itemId.slice('community:'.length), { signal })
            item = communityCatalogItems([row]).find(candidate => candidate.id === destination.itemId)
            if (!item?.manifest && !destination.collectionId) return
          } catch (error) {
            if (signal.aborted || (error.status !== 404 && !destination.collectionId)) return
          }
        }
        if (signal.aborted) return
        // A community listing found by lookup was never actually unavailable.
        const found = lookup && item?.manifest
        if (!destination.restored && resolution.toast && !found) setToast(resolution.toast)
        if (!destination.restored && resolution.action !== 'unavailable') {
          selectTab('browse')
          setCategory('all')
          if (resolution.action === 'needs-connection') setQuery(resolution.query)
        }
        if (item?.manifest) {
          await openDetail(item, signal)
          // A retargeted entry may still be awaiting its original host push.
          await navDetailRef.current?.handle.outcome
          if (destination.restored && !destination.collectionId && !navDetailRef.current?.owned) return
        }
      }
      finish(null)
    }
    void openDestination()
  }, [intentDestination, destinationResolution, loadingCatalog, catalogHydrated,
    installedLoadError, catalogLoadError, otherInstalledCatalogSources, token,
    closeDetail, closeCollection, selectTab, openCollection, openDetail])

  // Detail view replaces the main layout when set.
  const topCategories = (() => {
    const counts = new Map()
    for (const item of displayCatalog) { const id = catalogCategory(item); counts.set(id, (counts.get(id) || 0) + 1) }
    return [...counts].map(([id, count]) => ({ category: storeCategory(id), count }))
      .filter((entry) => entry.category).sort((a, b) => b.count - a.count)
  })()
  // A category page in Apps or Games is its own Back step.
  const showCategory = (kind, id) => {
    if (tab !== kind) selectTab(kind)
    setShelfCategories((current) => ({ ...current, [kind]: id }))
    setCategorySort('top')
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
    if (categoryNavRef.current) return
    const handle = window.mobius.nav.open('app-store-category', {
      onBack: () => { categoryNavRef.current = null; leaveCategoryRef.current?.(kind, true) },
      onForward: () => {
        categoryNavRef.current = handle
        if (tab !== kind) setTab(kind)
        setShelfCategories((current) => ({ ...current, [kind]: id }))
      },
    })
    categoryNavRef.current = handle
    handle.outcome.then(({ status }) => {
      if (status !== 'owned' && categoryNavRef.current === handle) categoryNavRef.current = null
    })
  }
  const leaveCategory = (kind, entryClosed = false) => {
    if (!entryClosed && closeTopLayerRef.current?.('category')) return
    if (!entryClosed) { categoryNavRef.current?.close(); categoryNavRef.current = null }
    setShelfCategories((current) => ({ ...current, [kind]: 'all' }))
  }
  leaveCategoryRef.current = leaveCategory
  const browseCategory = (id) => {
    const kind = storeCategory(id)?.kind
    if (!kind) return
    setQuery('')
    showCategory(kind, id)
  }
  // Publishing lives in Library's Your apps tab. Its steps past that list
  // (choosing an app, one published app, a listing review) share one Back
  // step that returns to Your apps.
  const showPublishStep = (next) => {
    setPublishView(next)
    if (next === 'home') { publishNavRef.current?.close(); publishNavRef.current = null; return }
    if (publishNavRef.current) return
    const handle = window.mobius.nav.open('app-store-publish', {
      onBack: () => { publishNavRef.current = null; setPublishView('home') },
      onForward: () => { publishNavRef.current = handle; setTab('library'); setCategory('yours'); setPublishView(next) },
    })
    publishNavRef.current = handle
    handle.outcome.then(({ status }) => {
      if (status !== 'owned' && publishNavRef.current === handle) publishNavRef.current = null
    })
  }
  // Publish an app opens Your apps from any Library tab.
  const openYourApps = (step = 'home') => {
    if (tab !== 'library') selectTab('library')
    setQuery('')
    setCategory('yours')
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
    showPublishStep(step)
  }
  // Related apps for an app page: more by its developer, then others in its
  // category from other developers.
  const relatedFor = (item) => {
    if (!item) return null
    const developer = catalogPublisher(item)
    const category = catalogCategory(item)
    const others = displayCatalog.filter((entry) => entry.id !== item.id && entry.manifest)
    return {
      byDeveloper: others.filter((entry) => catalogPublisher(entry) === developer),
      similar: others.filter((entry) => catalogCategory(entry) === category && catalogPublisher(entry) !== developer),
    }
  }
  const renderDetailRow = (item) => (
    <CatalogCard key={item.id} item={item} installed={installed} updateChecks={updateChecks}
      onPick={(next) => { if (next.manifest) openDetail(next, undefined, { push: true }) }}
      onUpdate={(next, opts) => handleCatalogUpdate(next, opts, page => openDetail(page, undefined, { push: true }))} onOpenInstalled={handleOpenInstalled} onRetryInstalled={handleRetryInstalled}
      onReviewUpdate={handleReviewUpdate} busy={busyItemId === item.id || updatingItemIds.includes(item.id)}
      busyActionKind={busyItemId === item.id ? busyActionKind : updatingItemIds.includes(item.id) ? 'update' : null}
      blocked={busy && busyItemId !== item.id} token={token} installedUnavailable={!!installedLoadError}
      setupCompletions={setupCompletions} systemSetupReady={systemSetupReady} layout="row" />
  )
  // What is beneath a layer opened from the current app page.
  const pageBeneath = () => ({ tab, collection: activeCollection, level: navDetailRef.current })
  const restorePage = (under) => {
    setTab(under.tab)
    setActiveCollection(under.collection)
    if (under.level) showDetail(under.level.item, under.level.focus)
  }
  const openDeveloper = (name) => {
    const under = pageBeneath()
    openLayer('creator', () => {
      if (!DISCOVERY_TABS.has(under.tab)) setTab('browse')
      setActiveCollection(`dev:${name}`)
      if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
    }, () => restorePage(under), under.level?.item?.manifest?.name)
  }
  const openCategoryFromApp = (kind, id) => {
    const under = pageBeneath()
    openLayer('category', () => {
      setTab(kind)
      setActiveCollection(null)
      setShelfCategories((current) => ({ ...current, [kind]: id }))
      setCategorySort('top')
      if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
    }, () => {
      setShelfCategories((current) => ({ ...current, [kind]: 'all' }))
      restorePage(under)
    }, under.level?.item?.manifest?.name)
  }
  const shareApp = async (item) => {
    const name = item.manifest?.name || item.name
    // The app's Store page on this Möbius, not its source repository.
    const url = storeListingLink(item, window.location.origin, appId)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: name, text: `${name} on the Möbius App Store`, url: url || undefined })
        return
      } catch (error) {
        // Closing the share sheet is a choice, not a failure. Anything else
        // (no sheet on this device, or the frame was refused) falls back to copying.
        if (error?.name === 'AbortError') return
      }
    }
    // The app frame is sandboxed: copy through the runtime's clipboard broker,
    // which can hand the write to the shell when the frame itself is denied.
    const copied = await window.mobius?.clipboard?.writeText(url || name)
    setToast(copied
      ? { kind: 'success', message: url ? 'Link copied' : 'Name copied' }
      : { kind: 'error', message: "Couldn't share or copy this app's link." })
  }

  if (detail) {
    return (
      <div className="st-root" {...ownerInteraction}>
        <style>{CSS}</style>
        <DetailView
          storeAppId={appId}
          item={detail}
          focusSection={detailFocus}
          capabilityReview={capabilityReviews[detail.id]}
          uninstalledApp={findInstalled(uninstalledApps, detail)}
          onRetryCapabilityReview={() => reviewCapabilities(detail)}
          installed={installed}
          onBack={backDetail}
          onInstall={(item, opts) => opts?.isUpdate
            ? handleCatalogUpdate(item, opts)
            : handleInstall(item)}
          onUninstall={handleUninstall}
          onOpenInstalled={handleOpenInstalled}
          onSetup={handleSetup}
          onRetryInstalled={handleRetryInstalled}
          busy={busy || checkingUpdateItemId === detail.id || updatingItemIds.includes(detail.id)}
          busyActionKind={busyItemId === detail.id
            ? busyActionKind
            : checkingUpdateItemId === detail.id ? 'checking_update'
              : updatingItemIds.includes(detail.id) ? 'update' : null}
          updateChecks={updateChecks}
          onReviewUpdate={handleReviewUpdate}
          onCommunityFeedback={handleCommunityFeedback}
          onCommunityWithdraw={handleCommunityWithdraw}
          canCommunityWithdraw={!!(
            githubIdentity?.login
            && detail?.community
            && detail?.publisher?.login
            && String(githubIdentity.login).toLowerCase()
              === String(detail.publisher.login).toLowerCase()
          )}
          communityBusy={communityActionBusy}
          communityError={communityActionError.key === detailCommunityFeedbackKey
            ? communityActionError.message
            : ''}
          mobiusAccount={mobiusAccount}
          onOpenMobiusAccount={openMobiusAccount}
          token={token}
          installedUnavailable={!!installedLoadError}
          setupCompletions={setupCompletions}
          systemSetupReady={systemSetupReady}
          related={relatedFor(detail)}
          renderRow={renderDetailRow}
          onOpenDeveloper={openDeveloper}
          onOpenCategory={(id) => {
            const kind = storeCategory(id)?.kind
            if (kind) openCategoryFromApp(kind, id)
          }}
          saved={savedIds.includes(detail.id)}
          onToggleSaved={toggleSaved}
          onShare={shareApp}
          updateStage={updateStages[detail.id] || null}
        />
        {pendingUninstall && (
          <UninstallConfirmModal
            app={pendingUninstall}
            busy={busy}
            onConfirm={confirmUninstall}
            onCancel={() => !busy && setPendingUninstall(null)}
          />
        )}
        {updateTransaction && !quickUpdate && (
          <UpdateReviewModal
            review={updateTransaction}
            agentReviewing={agentReviewingUpdate}
            onClose={closeUpdateTransaction}
            onConfirm={() => updateBatchRef.current?.confirm()}
            onRetry={itemId => updateBatchRef.current?.retry(itemId)}
            onResolveAll={() => chooseUpdateAgent('Resolve update conflicts', agent => updateBatchRef.current?.resolveAll(agent))}
            onResolveOne={id => chooseUpdateAgent('Resolve update conflict', agent => updateBatchRef.current?.resolveOne(id, agent))}
            onOpenChat={openChat}
            onAskAgent={handleAgentUpdateReview}
            onOpenBatch={handleOpenRunningBatch}
          />
        )}
        {updateAgentRequest && <UpdateAgentChooser token={token} title={updateAgentRequest.title} onStart={updateAgentRequest.run} onCancel={() => setUpdateAgentRequest(null)} />}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    )
  }

  // Recent searches and categories to browse: the header field's dropdown on
  // wider screens, the Search tab's own page on phones.
  const searchSuggestions = (categoryCount) => (
    <>
                {recentSearches.length ? (
                  <>
                    <div className="st-qdrop-head"><b>Recent</b><button type="button" onClick={() => forgetSearch(null)}>Clear</button></div>
                    {recentSearches.map((entry) => (
                      <div className="st-qdrop-row" key={entry}>
                        <button type="button" className="st-qdrop-item" onClick={() => setQuery(entry)}>
                          <Search width={16} height={16} aria-hidden="true" /><span>{entry}</span>
                        </button>
                        <button type="button" className="st-qdrop-x" aria-label={`Remove ${entry}`} onClick={() => forgetSearch(entry)}><X width={12} height={12} /></button>
                      </div>
                    ))}
                  </>
                ) : null}
                <div className="st-qdrop-head"><b>Browse</b></div>
                {topCategories.slice(0, categoryCount).map(({ category, count }) => (
                  <button key={category.id} type="button" className="st-qdrop-item"
                    onClick={() => { searchInputRef.current?.blur(); browseCategory(category.id) }}>
                    <CategoryIcon category={category} size="sm" /><span>{category.title}</span><em>{count}</em>
                  </button>
                ))}
    </>
  )
  const searchBox = (
    <>
            {/* Focus anywhere in the field or its suggestions keeps them open,
                so Tab can move from the field into a suggestion. */}
            <div className="st-searchwrap" onFocus={() => setSearchFocused(true)}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false) }}>
            <label className="st-searchbox" htmlFor="st-catalog-search">
              <Search width="1em" height="1em" aria-hidden="true" />
              <span className="st-sr-only">Search apps and games</span>
              <input
                ref={searchInputRef}
                id="st-catalog-search"
                className="st-search-input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') rememberSearch(query); if (event.key === 'Escape') event.currentTarget.blur() }}
                placeholder="Search apps and games"
                autoComplete="off"
                spellCheck={false}
              />
              {query ? (
                <button type="button" className="st-search-clear" aria-label="Clear search"
                  onClick={() => { setQuery(''); searchInputRef.current?.focus() }}>
                  <X width="1em" height="1em" aria-hidden="true" />
                </button>
              ) : null}
            </label>
            {searchFocused && !query.trim() && !phone ? (
              <div className="st-qdrop" role="group" aria-label="Search suggestions" onMouseDown={(event) => event.preventDefault()}>
                {searchSuggestions(5)}
              </div>
            ) : null}
            </div>
            {searchFocused || query ? (
              <button type="button" className="st-search-cancel"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { setQuery(''); searchInputRef.current?.blur(); setSearchFocused(false) }}>Cancel</button>
            ) : null}
    </>
  )
  // A category page in Apps or Games has its own heading and Back link, so
  // the tab's big title gives way to it.
  const inCategory = (tab === 'apps' || tab === 'games') && (shelfCategories[tab] || 'all') !== 'all'
  const yourAppsOpen = tab === 'library' && libraryTab === 'yours'

  return (
    <div className="st-root" {...ownerInteraction}>
      <style>{CSS}</style>
      <h1 className="st-sr-only">App Store</h1>
      {/* Phones: the App Store's own bar, fixed above the page so it stays put
          while you scroll. The way back to Möbius on the left, the Store's
          name in the middle, your profile (and publishing) on the right. */}
      {phone ? (
        <div className={`st-phonebar${barTucked ? ' is-tucked' : ''}`}>
          <div className="st-storebar">
            <div className="st-storebar-start">
              {barsHidden ? (
                <button type="button" className="st-mobius-back" onClick={showMobius}>
                  <ChevronLeft width={22} height={22} aria-hidden="true" /> Möbius
                </button>
              ) : null}
            </div>
            <div className="st-storebar-brand" aria-hidden="true">
              <img src={`/api/apps/${appId}/icon?size=64`} alt="" width={26} height={26} />
              <span>App Store</span>
            </div>
            <div className="st-storebar-end" />
          </div>
        </div>
      ) : null}
      {phone ? null : <div className="st-header">
        <div className="st-title-row">
          <div className="st-store-brand">
            <img
              src={`/api/apps/${appId}/icon?size=64`}
              alt=""
              width={40}
              height={40}
              className="st-brand-icon" ref={(el) => el && window.mobius.immersive && window.mobius.immersive.holdToToggle(el)}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const f = e.currentTarget.nextElementSibling
                if (f) f.style.display = 'flex'
              }}
            />
            <span className="st-brand-fallback" style={{ display: 'none' }} aria-hidden="true">·</span>
            <span className="st-brand-name">App Store</span>
          </div>
          <div className="st-tabs">
          <div className="st-tablist" role="tablist" aria-label="Store sections"
               onKeyDown={onTabsKeyDown}>
            {STORE_TABS.map(({ id, label }) => {
              const selected = tab === id
              return (
                <button role="tab" id={`st-tab-${id}`} key={id}
                        aria-selected={selected}
                        aria-controls="st-tabpanel"
                        tabIndex={selected ? 0 : -1}
                        className={`st-tab${selected ? ' is-active' : ''}`}
                        onClick={() => { selectTab(id); if (id === 'library') setCategory('all') }}>
                  {label}
                  {id === 'library' && filterCounts.update > 0 && (
                    <span
                      className="st-tab-count"
                      aria-label={`${filterCounts.update} updates available`}
                    >
                      {filterCounts.update}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          </div>
          <div className="st-header-tools">
            {searchBox}
          </div>
        </div>
      </div>}

      <div className={`st-scroll is-${tab}${returning ? ' is-returning' : ''}`} ref={gridScrollRef}
           onAnimationEnd={(event) => { if (event.target === event.currentTarget) setReturning(false) }}
           id="st-tabpanel" role="tabpanel"
           aria-labelledby={phone ? undefined : `st-tab-${tab}`}
           aria-label={phone ? PHONE_TABS.find((entry) => entry.id === tab)?.label : undefined}>
        {(((discoveryTab || tab === 'library') && !activeCollection && !query.trim()) || (phone && tab === 'search'))
          && (!inCategory || phone) ? (
          <div className="st-pagehead">
            {phone ? (
              <>
                {inCategory ? null : <h1 className="st-sr-only">{PHONE_TABS.find((entry) => entry.id === tab)?.label}</h1>}
              </>
            ) : inCategory ? null : tab === 'library' ? (
              <div className="st-pagehead-row">
                <h1 className="st-pagehead-title">Library</h1>
                {/* One Publish an app for every Library tab, Your apps included. */}
                <button type="button" className="st-upload-btn" onClick={() => openYourApps('choose')}>
                  <Plus width={18} height={18} aria-hidden="true" /> Publish an app
                </button>
              </div>
            ) : (
              <h1 className="st-pagehead-title">{STORE_TABS.find((entry) => entry.id === tab)?.label}</h1>
            )}
            {phone && tab === 'search' ? <div className="st-phone-search">{searchBox}</div> : null}
          </div>
        ) : null}
        {tab === 'search' && !query.trim() ? (
          <div className="st-search-landing">{searchSuggestions(8)}</div>
        ) : null}
        {/* Phones: publishing in plain sight, at the top of Library. */}
        {phone && tab === 'library' && !query.trim() ? (
          <button type="button" className="st-upload-wide" onClick={() => openYourApps('choose')}>
            <Plus width={18} height={18} aria-hidden="true" /> Publish an app
          </button>
        ) : null}
        {tab === 'library' && !query.trim() ? (
          <LibraryTabs active={libraryTab} counts={libraryCounts}
            onChange={(next) => {
              setCategory(next)
              showPublishStep('home')
              if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
            }} />
        ) : null}
        {(discoveryTab || (tab === 'library' && !yourAppsOpen)) && !(tab === 'search' && !query.trim()) && (
          <>
            {loadingCatalog
              ? <CatalogSkeleton layout={tab === 'library' ? 'list' : 'discover'} count={tab === 'library' ? 8 : 6} />
              : <>
                  {tab === 'library' && batchLoadError ? (
                    <div className="st-notice is-warning st-notice-row" role="alert">
                      <span>Update progress could not be read: {batchLoadError.message} Updates already running continue on the server.</span>
                      <button type="button" className="st-btn st-btn-secondary st-notice-action" onClick={() => reloadUpdateBatchesRef.current?.()}>
                        Try again
                      </button>
                    </div>
                  ) : null}
                  {tab === 'library' && libraryTab === 'needs' && libraryCounts.needs > 0 ? (
                    <div className="st-libbar">
                      <p>{conflictItems.length > 0
                        ? 'You changed these apps yourself, so updating them takes one extra step. Tap Fix and Möbius keeps your changes.'
                        : 'These apps need a little setup or a decision before they are ready.'}</p>
                      <ResolveAllButton count={conflictItems.length} onResolveAll={() => handleResolveAllConflicts()}
                        disabled={busy || resolvingAll || checkingAllUpdates || !!installedLoadError}
                        state={resolvingAll ? 'resolving' : 'idle'} />
                    </div>
                  ) : null}
                  {tab === 'library' && libraryTab === 'update' && updateAllCount > 0 ? (
                    <div className="st-libbar">
                      <p>Updates keep the access each app already has; any change to what an app can do still asks you first.</p>
                      <UpdateAllButton count={updateAllCount}
                        state={checkingAllUpdates ? 'checking' : (transactionProgress || backgroundProgress) ? 'updating' : 'idle'}
                        progress={transactionProgress
                          ? { current: transactionProgress.finished, total: transactionProgress.total }
                          : backgroundProgress}
                        disabled={busy || resolvingAll || !!checkingUpdateItemId || !!installedLoadError || !!updateTransaction}
                        onUpdateAll={handleUpdateAll} />
                    </div>
                  ) : null}
                  {tab === 'library' && updateBatches.some(batch => libraryTab === 'update' || batch.phase === 'applying' || batch.phase === 'unknown') ? (
                    <section className="st-update-batch-list" aria-label="Update progress and results">
                      {/* Running or unknown batches stay in view; finished results fold
                          behind one link, every batch still one click away. */}
                      {[updateBatches.filter(batch => batch.phase === 'applying' || batch.phase === 'unknown'),
                        libraryTab === 'update' ? updateBatches.filter(batch => batch.phase !== 'applying' && batch.phase !== 'unknown') : []].map((group, folded) => {
                        if (!group.length) return null
                        const buttons = group.map(batch => {
                        const progress = batchProgressOf(batch.entries)
                        const toResolve = batch.entries.filter(entry => entry.status === 'conflict' && !entry.resolver_chat_id).length
                        return (
                          <button key={batch.id} type="button" className="st-update-all-trigger"
                            onClick={() => openStoredUpdateBatch(batch.id)} disabled={!!updateTransaction}>
                            {batch.phase === 'applying' && progress.total ? (
                              <span className="st-batch-bar" aria-hidden="true"><i style={{ width: `${Math.max(4, progress.finished / progress.total * 100)}%` }} /></span>
                            ) : null}
                            {batch.phase === 'unknown' ? 'Check update status'
                              : batch.phase === 'applying' ? `View update progress · ${progress.finished}/${progress.total} finished`
                                : toResolve ? `Review update results · ${toResolve} to fix` : 'View update results'}
                          </button>
                        )
                        })
                        return folded ? (
                          <details key="past" className="st-update-batch-past">
                            <summary className="st-see">Past update results{group.length > 1 ? ` (${group.length})` : ''}</summary>
                            <div className="st-update-batch-past-list">{buttons}</div>
                          </details>
                        ) : <div key="live" className="st-update-batch-live">{buttons}</div>
                      })}
                    </section>
                  ) : null}

                  {installedLoadError && (
                    <div className="st-notice is-warning st-notice-row" role="status">
                      <span>{installedLoadError} Install and update actions are paused until this refreshes.</span>
                      <button
                        type="button"
                        className="st-btn st-btn-secondary st-notice-action"
                        onClick={handleRetryInstalled}
                        disabled={busy}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {discoveryTab && communityError ? (
                    <div className="st-sr-only" role="status">
                      Shared listings are temporarily unavailable. The Store will retry automatically.
                    </div>
                  ) : null}
                  <CatalogList
                    selfUpdate={tab === 'library' && !query.trim() ? selfUpdate : null}
                    libraryTab={tab === 'library' ? libraryTab : null}
                    appId={appId}
                    items={tab === 'library' ? libraryCatalog : visibleCatalog}
                    installed={installed}
                    updateChecks={updateChecks}
                    onPick={item => { if (!item.manifest) return; if (query.trim()) rememberSearch(query); openDetailFromPage(item) }}
                    pickOpensApp={tab === 'library'}
                    onRateApp={tab === 'library' ? (item => { if (item.manifest) openDetail(item, undefined, { focus: 'reviews' }) }) : undefined}
                    onUninstall={tab === 'library' ? handleUninstall : undefined}
                    onRetry={retryCatalogItem}
                    onUpdate={handleCatalogUpdate}
                    onOpenInstalled={handleOpenInstalled}
                    onRetryInstalled={handleRetryInstalled}
                    busy={busy || checkingAllUpdates}
                    installedUnavailable={!!installedLoadError}
                    busyItemId={busyItemId}
                    updatingItemIds={updatingItemIds}
                    busyActionKind={busyActionKind}
                    checkingUpdateItemId={checkingUpdateItemId}
                    errors={cardErrors}
                    errorRetries={cardErrorRetries}
                    onAskAgentError={handleAskAgentAboutError}
                    agentErrorItemId={agentErrorItemId}
                    onReviewUpdate={handleReviewUpdate}
                    token={token}
                    emptyTitle={tab === 'library' ? 'No installed apps match' : 'No matches'}
                    emptyText={tab === 'library' ? 'Try another search, or browse the Store for something new.' : 'Try a different search or filter.'}
                    setupCompletions={setupCompletions}
                    systemSetupReady={systemSetupReady}
                    loadingMore={discoveryTab && communityLoading && communityOffset > 0}
                    searchLoading={discoveryTab && communityLoading && communityOffset === 0}
                    hasMore={discoveryTab && communityHasMore}
                    onLoadMore={() => refreshCommunity({ append: true })}
                    view={tab === 'library' ? 'library' : query.trim() ? 'search' : tab === 'browse' ? 'discover' : tab}
                    shelfCategory={shelfCategories[tab] || 'all'}
                    communityRankings={communityRankings}
                    onShelfCategory={(id) => (id === 'all' ? leaveCategory(tab) : showCategory(tab, id))}
                    categoryBackLabel={overlay?.kind === 'category' ? overlay.label : null}
                    categorySort={categorySort}
                    onCategorySort={setCategorySort}
                    onOpenTab={selectTab}
                    onBrowseCategory={browseCategory}
                    spotlightFeed={spotlightFeed}
                    activeCollection={discoveryTab ? activeCollection : null}
                    onOpenCollection={openCollection}
                    onCloseCollection={closeCollection}
                    shelfScrollRef={shelfScrollRef}
                    lifecycleById={lifecycleById}
                    layout={tab === 'library' ? 'list' : 'grid'}
                    searchQuery={query}
                    allItems={displayCatalog}
                    creatorFilter={creatorFilter}
                    onCreatorFilter={(name, value) => setCreatorFilter({ name, value })}
                    updateStages={updateStages}
                    savedItems={tab === 'library' && !query.trim()
                      ? savedIds.map((id) => displayCatalog.find((item) => item.id === id)).filter((item) => item?.manifest)
                      : []}
                    savedCount={tab === 'library' && !query.trim() ? savedIds.length : 0}
                  />
                </>}
          </>
        )}
        {yourAppsOpen && (
          <PublisherTab
            view={publishView}
            onViewChange={showPublishStep}
            installed={installed}
            identity={communityIdentity}
            identityError={communityIdentityError}
            viewer={{ github: githubIdentity, error: githubIdentityError }}
            onRefreshViewer={refreshGithubIdentity}
            onPublishLocal={handlePublishLocal}
            onPreviewLocal={(localAppId) => loadLocalPublicationPreview(token, localAppId)}
            onSaveListing={(localAppId, listing) => saveLocalListing(token, localAppId, listing)}
            onPrepareImage={prepareListingImage}
            onListingAgent={handleListingAgent}
            onListingAgentStatus={handleListingAgentStatus}
            onOpenChat={openChat}
            onRunCheck={handlePublishCheck}
            onFixCheck={handlePublishFix}
            onLoadReviews={loadPublisherReviews}
            onViewInStore={(communityId) => {
              cancelPendingDestination()
              setIntentDestination({ kind: 'app', itemId: `community:${communityId}` })
            }}
            onRegisterRepository={handleRegisterCommunity}
            publishingId={publishingId}
            publication={publication}
            publicationError={publicationError}
            publicationStates={publicationStates}
            publicationListings={publicationListings}
            publicationStatesError={publicationStatesError}
            onRefreshPublicationStates={refreshPublicationStates}
            onNavigate={() => {
              if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
            }}
            catalog={displayCatalog}
            spotlightFeed={spotlightFeed}
            token={token}
            onUploadSpotlightArtwork={handleUploadSpotlightArtwork}
            onPublishSpotlight={handlePublishSpotlight}
            onOpenMobiusAccount={openMobiusAccount}
            contributeAvailable={!!contributeApp}
            onOpenContributions={(localAppId) => openInstalledApp(
              contributeApp.id,
              localAppId ? {} : { intent: 'reviews:queue' },
            )}
          />
        )}
      </div>

      <nav className="st-bottombar" aria-label="Store sections">
        {PHONE_TABS.map(({ id, label }) => {
          const selected = tab === id
          const TabIcon = TAB_ICONS[id]
          return (
            <button key={id} type="button" className={`st-bottombar-tab${selected ? ' is-active' : ''}`}
              aria-current={selected ? 'page' : undefined}
              onClick={() => {
                // A search belongs to the Search tab; other tabs show their own pages.
                if (id !== 'search' && query) setQuery('')
                selectTab(id)
                if (id === 'library') setCategory('all')
                if (id === 'search' && !query) requestAnimationFrame(() => searchInputRef.current?.focus())
              }}>
              <TabIcon aria-hidden="true" />
              <span>{label}</span>
              {id === 'library' && filterCounts.update > 0 ? <span className="st-bottombar-count">{filterCounts.update}</span> : null}
            </button>
          )
        })}
      </nav>

      <SelfUpdateSheet self={selfUpdate} appId={appId} />
      {pendingUninstall && (
        <UninstallConfirmModal
          app={pendingUninstall}
          busy={busy}
          onConfirm={confirmUninstall}
          onCancel={() => !busy && setPendingUninstall(null)}
        />
      )}
      {updateTransaction && !quickUpdate && (
        <UpdateReviewModal
          review={updateTransaction}
          agentReviewing={agentReviewingUpdate}
          onClose={closeUpdateTransaction}
          onConfirm={() => updateBatchRef.current?.confirm()}
          onRetry={itemId => updateBatchRef.current?.retry(itemId)}
          onResolveAll={() => chooseUpdateAgent('Resolve update conflicts', agent => updateBatchRef.current?.resolveAll(agent))}
          onResolveOne={id => chooseUpdateAgent('Resolve update conflict', agent => updateBatchRef.current?.resolveOne(id, agent))}
          onOpenChat={openChat}
          onAskAgent={handleAgentUpdateReview}
          onOpenBatch={handleOpenRunningBatch}
        />
      )}

      {updateAgentRequest && <UpdateAgentChooser token={token} title={updateAgentRequest.title} onStart={updateAgentRequest.run} onCancel={() => setUpdateAgentRequest(null)} />}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
