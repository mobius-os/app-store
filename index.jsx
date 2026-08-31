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
import { CATALOG, CATALOG_URL } from './constants.js'
import { CSS } from './theme.js'
import {
  buildUpdateFailureMessage,
  buildUpdateReviewMessage,
  appLifecycleFor,
  busyLabelForAction,
  storeDestinationFromMessage,
  capabilityDiffNeedsReview,
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
  manifestCapabilityRows,
  resolveCatalogItemIntent,
  sourceBackedInstalledApps,
  shouldRefreshCatalogManifest,
  sortCatalogForDisplay,
  updateBatchDisposition,
} from './domain.js'
import {
  createAppChat,
  createConflictResolverChat,
  fetchCatalog,
  fetchManifest,
  fetchUpdateCheck,
  hasConnectedProvider,
  installApp,
  loadCommunityApps,
  loadCommunityIdentity,
  loadEditorialSpotlight,
  loadLocalGithubIdentity,
  loadCommunityPublications,
  loadLocalPublicationPreview,
  loadInstalledApps,
  loadProviderStatus,
  loadUpdateCandidatePreview,
  publishLocalAppToGithub,
  publishEditorialSpotlight,
  registerCommunityRevision,
  rateCommunityApp,
  commentOnCommunityRevision,
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
import { CatalogFilters } from './ui/CatalogFilters.jsx'
import { CatalogSkeleton } from './ui/CatalogSkeleton.jsx'
import { DetailView } from './ui/DetailView.jsx'
import { LibraryHealth } from './ui/LibraryHealth.jsx'
import { PublisherTab } from './ui/PublisherTab.jsx'
import { SelfUpdateBanner } from './ui/SelfUpdateBanner.jsx'
import { UninstallConfirmModal } from './ui/UninstallConfirmModal.jsx'
import { UpdateReviewModal } from './ui/UpdateReviewModal.jsx'

export {
  appLifecycleFor,
  busyLabelForAction,
  catalogItemIdFromIntent,
  catalogItemIdFromMessage,
  storeDestinationFromIntent,
  storeDestinationFromMessage,
  capabilityDiffNeedsReview,
  canonicalIdentityKey,
  CARD_DESCRIPTION_LIMIT,
  catalogAudience,
  catalogCardDescription,
  catalogCollection,
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
  manifestCapabilityRows,
  resolveCatalogItemIntent,
  humanCron,
  isTrustedHost,
  scheduleSummary,
  sourceBackedInstalledApps,
  shouldRefreshCatalogManifest,
  sortCatalogForDisplay,
  updateBatchDisposition,
  validateManifestUrl,
} from './domain.js'
export { STORE_VERSION } from './constants.js'
export {
  fetchCatalog,
  fetchManifest,
  fetchUpdateCheck,
  installApp,
  loadCommunityApps,
  loadCommunityIdentity,
  loadEditorialSpotlight,
  loadLocalGithubIdentity,
  loadCommunityPublications,
  loadLocalPublicationPreview,
  loadInstalledApps,
  publishLocalAppToGithub,
  publishEditorialSpotlight,
  registerCommunityRevision,
  rateCommunityApp,
  commentOnCommunityRevision,
  uploadEditorialArtwork,
  previewApp,
  proxyUrl,
  readErrorDetail,
} from './api.js'
export { capabilityRows, changedCapabilityPaths } from './ui/CapabilityContract.jsx'
export { appIcon, installedIconUrl } from './ui/IconBox.jsx'
export { catalogAssetFilename, catalogAssetUrl, storeAssetSource, storeAssetUrl } from './ui/StoreImage.jsx'
export { createPublicationPreviewGate } from './ui/PublisherTab.jsx'

// Snapshot-less catalogs (catalog.json is now a pure discovery index) hydrate
// every entry's manifest from its repo on open — ~16 fetches — so a 3-wide pool
// left first paint needlessly slow. 6 keeps concurrency modest against the raw
// CDN while roughly halving the hydrate wall time.
const MANIFEST_FETCH_CONCURRENCY = 6

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

async function mapWithConcurrency(items, limit, mapper) {
  const out = new Array(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    async () => {
      while (next < items.length) {
        const i = next
        next += 1
        out[i] = await mapper(items[i], i)
      }
    },
  )
  await Promise.all(workers)
  return out
}

// Probe GET /api/apps/{id}/update-check for the given installed rows and return
// a { [numericAppId]: source-provenance facts } map.
// Use the same bounded pool as manifest refetches. fetchUpdateCheck never
// throws; callers merge answered ids and leave unavailable rows unknown. Every
// source-backed installed row shares this authority.
async function fetchUpdateChecksFor(rows, token) {
  if (!rows.length) return {}
  const results = await mapWithConcurrency(rows, MANIFEST_FETCH_CONCURRENCY, async (app) => ({
    id: app.id,
    check: await fetchUpdateCheck(app.id, token),
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

export default function App({ appId, token }) {
  const [tab, setTab] = useState('browse')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [catalog, setCatalog] = useState(() =>
    CATALOG.map(c => ({ ...c, manifest: c.manifest || null, error: null }))
  )
  const [communityCatalog, setCommunityCatalog] = useState([])
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
  const [communityActionBusy, setCommunityActionBusy] = useState(false)
  const [communityActionError, setCommunityActionError] = useState({ key: '', message: '' })
  const [otherInstalledCatalog, setOtherInstalledCatalog] = useState([])
  const otherInstalledCatalogRef = useRef(otherInstalledCatalog)
  useEffect(() => { otherInstalledCatalogRef.current = otherInstalledCatalog }, [otherInstalledCatalog])
  // Mirror of the hydrated curated catalog for foreground cleanup. Keeping it
  // out of the refresh callback's dependencies avoids rebinding browser event
  // listeners after every manifest refresh.
  const catalogRef = useRef(catalog)
  useEffect(() => { catalogRef.current = catalog }, [catalog])
  const [installed, setInstalled] = useState([])
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
  const [intentDestination, setIntentDestination] = useState(null)
  const [capabilityReviews, setCapabilityReviews] = useState({})
  const navDetailRef = useRef(null)  // pending detail item during nav-push ack
  // B1: preserve the catalog grid's scroll across opening a detail and coming
  // back — the grid unmounts while a detail shows, so it would otherwise
  // re-mount scrolled to the top.
  const gridScrollRef = useRef(null)
  const savedGridScrollRef = useRef(0)
  const selectTab = useCallback((next) => {
    if (next === tab) return
    savedGridScrollRef.current = 0
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
    setTab(next)
  }, [tab])
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
  const checkingUpdateRef = useRef(null)
  const [checkingAllUpdates, setCheckingAllUpdates] = useState(false)
  const checkingAllUpdatesRef = useRef(false)
  const [toast, setToast] = useState(null)
  const [updateNotice, setUpdateNotice] = useState(null)
  // Individual updates still offer a read-only candidate diff. "Update all"
  // bypasses this state for exact, access-stable candidates.
  const [updateReview, setUpdateReview] = useState(null)
  const [batchProgress, setBatchProgress] = useState(null)
  const [agentReviewingUpdate, setAgentReviewingUpdate] = useState(false)
  const [agentErrorItemId, setAgentErrorItemId] = useState(null)
  const [cardErrors, setCardErrors] = useState({})
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
  const [installedLoadError, setInstalledLoadError] = useState('')
  // Guard against overlapping refreshes when several visibility/focus
  // events fire in quick succession (e.g. drawer-close + tab-focus on
  // mobile fire visibilitychange and focus a frame apart). A simple
  // boolean is enough — we only care that one refresh is in flight.
  const refreshingRef = useRef(false)
  // Last git-native update check. Seeded at mount so the first focus right
  // after open doesn't immediately duplicate the initial check.
  // A focus flap (visibilitychange + focus a frame apart) won't refetch
  // either: the second event lands well inside the debounce window.
  // Seed with mount time, not 0: the focus/pageshow listeners bind a frame
  // before the async mount hydration finishes, so a focus firing in that gap
  // would otherwise read a 0 timestamp, clear the debounce, and fire a
  // redundant duplicate update check alongside the in-flight mount one.
  // Stamping "now" makes that first focus a reliable no-op until the 50s
  // window elapses; the mount effect re-stamps once catalog hydration lands.
  const lastUpdateCheckRef = useRef(Date.now())
  const updateCheckingRef = useRef(false)

  useEffect(() => {
    function onIntent(event) {
      const destination = storeDestinationFromMessage(
        event,
        window.location.origin,
        window.parent,
      )
      if (destination) setIntentDestination(destination)
    }
    window.addEventListener('message', onIntent)
    return () => window.removeEventListener('message', onIntent)
  }, [])

  const clearSettledUpdateArtifacts = useCallback((itemIds) => {
    if (!itemIds?.size) return
    setCardErrors(prev => {
      let next = prev
      for (const id of itemIds) next = withoutKey(next, id)
      return next
    })
    setUpdateNotice(prev => (prev && itemIds.has(prev.itemId) ? null : prev))
  }, [])

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
        const installedResult = await loadInstalledApps(token)
          .then((apps) => ({ apps, error: '' }))
          .catch((err) => ({
            apps: null,
            error: err?.message || 'Installed apps could not be loaded.',
          }))
        if (cancelled) return
        const apps = installedResult.apps || []
        if (installedResult.apps) {
          setInstalled(apps)
          setInstalledLoadError('')
        } else {
          setInstalledLoadError(installedResult.error)
        }
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
        const entries = mergeCatalogEntries(CATALOG, remote)
        if (cancelled) return
        // A baked manifest gives every discovery card a fast first paint, but
        // it must not freeze an installed app at the last Store release. Fetch
        // the live manifest for installed apps as well so human-facing release
        // labels remain current beside the authoritative source check.
        const hydrated = await mapWithConcurrency(
          entries,
          MANIFEST_FETCH_CONCURRENCY,
          async (c) => {
            if (!shouldRefreshCatalogManifest(c, apps)) {
              return { ...c, error: null }
            }
            try {
              const manifest = await fetchManifest(c.manifest_url, token)
              return { ...c, manifest, error: null }
            } catch (e) {
              return { ...c, manifest: null, error: e.message || String(e) }
            }
          },
        )
        if (cancelled) return
        setCatalog(hydrated)
        lastUpdateCheckRef.current = Date.now()
        // Git-native update-checks for every manifest-backed app. Fire-and-
        // forget on purpose: a slow or absent (404) endpoint must never gate the
        // skeleton clear in `finally`, so we do NOT await it here. fetchUpdate
        // ChecksFor never rejects (fetchUpdateCheck degrades to null), so no
        // unhandled rejection escapes; until these land the app remains usable,
        // and when they land they are the sole update authority.
        const checkRows = sourceBackedInstalledApps(apps, { excludeAppIds: [appId] })
        fetchUpdateChecksFor(checkRows, token).then((map) => {
          if (cancelled) return
          setUpdateChecks((prev) => mergeUpdateChecks(prev, map))
          clearSettledUpdateArtifacts(itemIdsSettledByChecks(hydrated, apps, map))
        })
        window.mobius?.signal?.('app_ready', { installed_count: apps.length })
      } finally {
        if (!cancelled) setLoadingCatalog(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [appId, token, clearSettledUpdateArtifacts])

  const communityRequestRef = useRef(0)
  const refreshCommunity = useCallback(async ({ append = false } = {}) => {
    const requestId = communityRequestRef.current + 1
    communityRequestRef.current = requestId
    const limit = 24
    const offset = append ? communityOffset : 0
    setCommunityLoading(true)
    try {
      const payload = await loadCommunityApps(token, { query: query.trim(), limit, offset })
      if (communityRequestRef.current !== requestId) return
      const page = communityCatalogPage(payload, limit)
      setCommunityCatalog((current) => append
        ? mergeCommunityCatalog(current, page.items)
        : page.items)
      setCommunityOffset(offset + page.rowCount)
      setCommunityHasMore(page.hasMore)
      setCommunityError('')
    } catch (error) {
      if (communityRequestRef.current !== requestId) return
      setCommunityError(error?.message || 'Community apps are unavailable right now.')
    } finally {
      if (communityRequestRef.current === requestId) setCommunityLoading(false)
    }
  }, [token, query, communityOffset])

  const refreshPublicationStates = useCallback(async () => {
    try {
      const payload = await loadCommunityPublications(token)
      setPublicationStates(communityPublicationsByLocalApp(payload))
      setPublicationStatesError('')
    } catch (error) {
      setPublicationStatesError(error?.message || 'Publication status is unavailable right now.')
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      loadCommunityIdentity(token),
      loadCommunityPublications(token),
      loadLocalGithubIdentity(token),
      loadEditorialSpotlight(token),
    ]).then(([identityResult, publicationsResult, githubResult, spotlightResult]) => {
      if (cancelled) return
      if (identityResult.status === 'fulfilled') {
        setCommunityIdentity(identityResult.value)
        setCommunityIdentityError('')
      } else {
        setCommunityIdentityError(identityResult.reason?.message || 'Identity is unavailable right now.')
      }
      if (publicationsResult.status === 'fulfilled') {
        setPublicationStates(communityPublicationsByLocalApp(publicationsResult.value))
        setPublicationStatesError('')
      } else {
        setPublicationStatesError(publicationsResult.reason?.message || 'Publication status is unavailable right now.')
      }
      if (githubResult.status === 'fulfilled') {
        setGithubIdentity(githubResult.value)
        setGithubIdentityError('')
      } else {
        setGithubIdentity({ connected: false, login: '' })
        setGithubIdentityError(githubResult.reason?.message || 'GitHub connection is unavailable right now.')
      }
      if (spotlightResult.status === 'fulfilled') {
        setSpotlightFeed(spotlightResult.value)
      }
    })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (tab !== 'browse') return undefined
    const timer = window.setTimeout(() => {
      setCommunityOffset(0)
      refreshCommunity({ append: false })
    }, query ? 250 : 0)
    return () => window.clearTimeout(timer)
  // Pagination state changes after a page arrives; only query/tab changes or
  // an explicit Load more action should issue another request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token, query])

  const refreshGithubIdentity = useCallback(async () => {
    try {
      setGithubIdentity(await loadLocalGithubIdentity(token))
      setGithubIdentityError('')
    } catch (error) {
      setGithubIdentityError(error?.message || 'GitHub connection is unavailable right now.')
    }
  }, [token])

  // Contribute owns connection setup. Refresh the inherited status when the
  // owner comes back from it; App Store never starts a second OAuth flow.
  useEffect(() => {
    if (tab !== 'publish' || githubIdentity?.connected) return undefined
    const onFocus = () => { void refreshGithubIdentity() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [githubIdentity, refreshGithubIdentity, tab])

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

  const handlePublishLocal = useCallback(async (localAppId, repositoryName) => {
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

  const handleCommunityRate = useCallback(async (value) => {
    const feedback = detail?.community_feedback || detail?.community
    if (!feedback || communityActionBusy || !communityIdentity?.linked || !feedback.review_eligible) {
      return false
    }
    const feedbackKey = `${feedback.id}:${feedback.revision_id}`
    setCommunityActionBusy(true)
    setCommunityActionError({ key: feedbackKey, message: '' })
    try {
      const result = await rateCommunityApp(token, feedback.id, feedback.revision_id, value)
      updateCommunityFeedback(feedback.id, (current) => ({
        ...current,
        user_rating: value,
        rating_average: Number(result.rating_average ?? result.rating?.average ?? current.rating_average) || value,
        rating_count: Number(result.rating_count ?? result.rating?.count ?? current.rating_count) || Math.max(1, current.rating_count),
      }))
      return true
    } catch (error) {
      setCommunityActionError({
        key: feedbackKey,
        message: error?.message || 'Your rating could not be saved.',
      })
      return false
    } finally {
      setCommunityActionBusy(false)
    }
  }, [communityActionBusy, communityIdentity, detail, token, updateCommunityFeedback])

  const handleCommunityComment = useCallback(async (body) => {
    const feedback = detail?.community_feedback || detail?.community
    if (!feedback
      || communityActionBusy
      || !communityIdentity?.linked
      || !githubIdentity?.connected
      || !feedback.review_eligible) {
      return false
    }
    const feedbackKey = `${feedback.id}:${feedback.revision_id}`
    setCommunityActionBusy(true)
    setCommunityActionError({ key: feedbackKey, message: '' })
    try {
      const result = await commentOnCommunityRevision(token, feedback.id, feedback.revision_id, body)
      const comment = result.comment || result
      updateCommunityFeedback(feedback.id, (current) => ({
        ...current,
        comments: [comment, ...(current.comments || [])],
      }))
      return true
    } catch (error) {
      setCommunityActionError({
        key: feedbackKey,
        message: error?.message || 'Your review could not be posted.',
      })
      return false
    } finally {
      setCommunityActionBusy(false)
    }
  }, [communityActionBusy, communityIdentity, detail, githubIdentity, token, updateCommunityFeedback])

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

  // Published apps may exist outside the curated registry. Hydrate them from
  // the same canonical source the backend updates, while excluding this Store's
  // own row. A cancelled effect cannot replace a newer installed-state result
  // after focus refresh.
  const otherInstalledCatalogSources = useMemo(
    () => otherInstalledCatalogItems(installed, catalog, { excludeAppIds: [appId] }),
    [appId, installed, catalog],
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

  // Returns the fresh installed rows, null if a refresh was already in flight,
  // or null on a transport failure. A thrown fetch must NOT escape: this runs
  // from a focus/visibility listener whose `.then()` has no rejection handler,
  // so an unhandled rejection here would otherwise crash the refresh and could
  // leave the grid reading "up to date" off a half-applied state. On failure we
  // keep the prior `installed` state (a stale-but-present list beats blanking).
  const refreshInstalled = useCallback(async () => {
    if (refreshingRef.current) return null
    refreshingRef.current = true
    try {
      const apps = await loadInstalledApps(token)
      setInstalled(apps)
      setInstalledLoadError('')
      return apps
    } catch (err) {
      setInstalledLoadError(err?.message || 'Installed apps could not be loaded.')
      return null
    } finally {
      refreshingRef.current = false
    }
  }, [token])

  // Check installed app repos on foreground regain. This single git-native
  // probe is authoritative even when a release forgot to bump mobius.json,
  // and avoids repeatedly downloading/parsing every installed manifest from
  // GitHub. Catalog metadata refreshes from catalog.json on Store open; the
  // explicit per-card retry remains for a genuinely missing manifest.
  const REHYDRATE_DEBOUNCE_MS = 50_000
  const refreshUpdateChecks = useCallback(async (installedApps) => {
    if (updateCheckingRef.current) return
    if (Date.now() - lastUpdateCheckRef.current < REHYDRATE_DEBOUNCE_MS) return
    const apps = installedApps || []
    // Installed rows are the authoritative target list. This also covers apps
    // that arrived through a shared URL and therefore have no curated entry.
    const checkRows = sourceBackedInstalledApps(apps, { excludeAppIds: [appId] })
    if (checkRows.length === 0) {
      lastUpdateCheckRef.current = Date.now()
      return
    }
    updateCheckingRef.current = true
    try {
      const checks = await fetchUpdateChecksFor(checkRows, token)
      setUpdateChecks(prev => mergeUpdateChecks(prev, checks))
      clearSettledUpdateArtifacts(itemIdsSettledByChecks(
        [...catalogRef.current, ...otherInstalledCatalogRef.current], apps, checks,
      ))
      lastUpdateCheckRef.current = Date.now()
    } finally {
      updateCheckingRef.current = false
    }
  }, [appId, token, clearSettledUpdateArtifacts])

  const handleRetryInstalled = useCallback(async () => {
    const apps = await refreshInstalled()
    if (apps) await refreshUpdateChecks(apps)
  }, [refreshInstalled, refreshUpdateChecks])

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

  // The drawer-delete path lives in the shell, not here — when the user
  // uninstalls from the drawer and navigates back, our `installed`
  // state still shows the deleted row as "Installed" until something
  // re-fetches /api/apps/. Subscribe to the same trio of events the
  // storage shim already uses to drain its outbox: visibilitychange +
  // focus + pageshow. Polling would be wasteful — these three cover
  // every realistic path back into a foregrounded App Store iframe
  // (drawer dismiss, tab refocus, mobile bfcache restore). On the same
  // events we also run the debounced git-native update probe so a release
  // pushed while the iframe stayed mounted shows up as an Update.
  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== 'visible') return
      refreshSetupState().catch(() => {})
      refreshInstalled().then(apps => {
        // refreshInstalled returns null if a refresh was already in flight OR
        // on a transport failure; the in-flight one will land the rows, and the
        // update probe is independently debounced, so skipping is safe.
        if (apps) return refreshUpdateChecks(apps)
      }).catch(() => {
        // Belt-and-braces: refreshInstalled already swallows its own transport
        // errors and refreshUpdateChecks degrades per-app failures, but
        // this runs from a listener with no outer handler — never let a stray
        // rejection escape as an unhandled promise. The prior state is kept; a
        // later focus/visibility event retries.
      })
    }
    document.addEventListener('visibilitychange', maybeRefresh)
    window.addEventListener('focus', maybeRefresh)
    window.addEventListener('pageshow', maybeRefresh)
    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh)
      window.removeEventListener('focus', maybeRefresh)
      window.removeEventListener('pageshow', maybeRefresh)
    }
  }, [refreshInstalled, refreshUpdateChecks, refreshSetupState])

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

  const handleSetup = useCallback((item, installedApp) => {
    const setup = item?.setup || {}
    if (setup.scope === 'system') {
      openSystemSettings(setup.section || 'background-agents', () => {
        setToast({
          kind: 'error',
          message: 'Open Settings from the drawer.',
        })
      })
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
  }, [])

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

  // Installs run inline from DetailView; updates reach this only after the
  // candidate-diff review's explicit Apply action. `busy` keeps the initiating
  // surface dimensionally stable while the transaction is in flight.
  const handleInstall = async (item, _opts = {}) => {
    const isBatch = _opts.batch === true
    if (busy && !isBatch) return { ok: false, reason: 'busy' }
    if (!_opts.capabilityDigest) {
      reviewCapabilities(item)
      if (!isBatch) {
        setToast({ kind: 'error', message: 'Review this app’s live access before installing.' })
      }
      return { ok: false, reason: 'capability_review' }
    }
    const startedActionKind = _opts?.isUpdate ? 'update' : 'install'
    if (!isBatch) {
      setBusy(true)
      setBusyItemId(item?.id || null)
      setBusyActionKind(startedActionKind)
    }
    setCardErrors(prev => withoutKey(prev, item.id))
    setUpdateNotice(null)
    try {
      // GitHub-backed apps install/update from manifest_url so the backend
      // fetches the latest release at click time. The in-memory manifest is
      // only the preview/fallback path for entries without a durable URL.
      const result = await installApp({
        manifest_url: item.manifest_url,
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
        reviewed_capability_digest: _opts.capabilityDigest,
        reviewed_source_digest: _opts.sourceDigest,
      })
      const isConflict = result.mode === 'conflict'
      const isSeamlessUpdate = result.mode === 'update' &&
        (result.divergence === 'fast_forward' || result.divergence === 'none')
      const isCleanMerge = result.mode === 'update' && result.divergence === 'clean_merge'

      if (isConflict) {
        // Keep the current app live, select the preserving policy, and start
        // the durable resolver agent immediately. The exact-upstream path is
        // still available by an explicit owner instruction inside that chat.
        let resolver = null
        let resolverError = ''
        try {
          resolver = await createConflictResolverChat(result.id, 'preserve_local', token)
        } catch (error) {
          resolverError = error.message || 'The resolver agent could not be started.'
        }
        const notice = {
          kind: 'conflict',
          itemId: item.id,
          appId: result.id,
          message: resolver
            ? 'Local changes overlap this update. An agent is reconciling them while your current app stays live.'
            : 'Local changes overlap this update. Your current app stayed live, but the resolver agent could not start.',
          result,
          item,
          resolverChatId: resolver?.chat_id || null,
        }
        if (result.id) {
          setUpdateChecks(prev => mergeUpdateChecks(prev, {
            [result.id]: {
              available: true,
              pendingUpdateState: 'needs_resolution',
              upstreamVersion: result.upstream_version || null,
            },
          }))
        }
        setUpdateNotice(notice)
        if (resolverError) {
          setCardErrors(prev => ({ ...prev, [item.id]: resolverError }))
        }
        if (!isBatch) await refreshInstalled()
        if (!isBatch && resolver?.chat_id) openChat(resolver.chat_id)
        return { ok: false, conflict: true, result, notice, resolver, resolverError }
      }

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
      if (item.community?.id && item.community?.revision_id && result.id) {
        // Installation is already complete; receipt failure must never roll it
        // back. A later successful install/update retries with a fresh,
        // idempotent receipt so Host can keep this exact release available.
        void recordCommunityInstall(
          token,
          item.community.id,
          item.community.revision_id,
          `app:${result.id}:${result.slug || item.manifest?.id || 'community'}`,
        ).catch(() => {})
      }
      setCardErrors(prev => withoutKey(prev, item.id))
      setUpdateNotice(prev => (prev?.itemId === item.id ? null : prev))
      if (!isBatch) await refreshInstalled()
      const openAction = result.id
        ? {
            label: 'Open App',
            onClick: () => handleOpenInstalled(result.id),
          }
        : null
      const appName = result.name || item.manifest?.name || item.id
      const versionText = result.version || item.manifest?.version

      if (isSeamlessUpdate) {
        window.mobius?.signal?.('app_updated', { slug: result.id || item.id })
        if (!isBatch) {
          setToast({
            kind: 'success',
            message: `${appName} updated to v${versionText}.`,
            action: openAction,
          })
        }
        return { ok: true, result }
      }

      if (isCleanMerge) {
        // A clean merge means the update applied with no conflicts, so do not
        // nag the owner to "double-check" it. The backend's divergence check
        // over-reports "you edited this" for apps the owner never touched (a
        // re-seeded or line-ending-normalized on-disk tree diffs as a local
        // edit), which made this prompt fire on untouched apps like News. Only
        // a real conflict (handled above) is worth surfacing; a clean result
        // is just a quiet success.
        window.mobius?.signal?.('app_updated', { slug: result.id || item.id })
        if (!isBatch) {
          setToast({
            kind: 'success',
            message: `${appName} updated to v${versionText}.`,
            action: openAction,
          })
        }
        return { ok: true, result }
      }

      const verb = result.mode === 'update' ? 'updated' : 'installed'
      const warnSuffix = result.warnings.length
        ? ` (with notes: ${result.warnings.join('; ')})`
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
      if (!isBatch) {
        setToast({
          kind: 'success',
          message: `${appName} ${verb}${warnSuffix}.`,
          action: openAction,
        })
      }
      return { ok: true, result }
      // Stay on the detail view. Two reasons: (1) closing here would
      // bounce the user back to the catalog grid mid-action, which felt
      // like the app didn't acknowledge the tap. (2) after refreshInstalled
      // resolves the detail re-renders with the installed state — the
      // primary CTA flips from "Install" to "Open App", confirming the
      // commit on the same surface the user committed it from. The user
      // can use the back arrow / device-back to dismiss when ready.
    } catch (e) {
      if (e?.code === 'capability_changed') {
        let preview = e.preview
        try {
          preview = await previewApp({
            manifest_url: item.manifest_url,
            manifest: item.manifest,
            raw_base: item.raw_base,
            token,
          })
        } catch {
          // The 409 already carried the current server-derived contract. Keep
          // it visible even if the follow-up diff refresh is temporarily down.
        }
        setCapabilityReviews(prev => ({
          ...prev,
          [item.id]: { status: 'changed', preview, error: '' },
        }))
        if (!isBatch) {
          setToast({
            kind: 'error',
            message: 'This app changed its access after review. Nothing was installed; review the current access and click again.',
          })
        }
        return { ok: false, reason: 'capability_changed' }
      }
      if (e?.code === 'update_changed') {
        if (!isBatch) {
          setToast({
            kind: 'error',
            message: 'This update changed after review. The latest diff is being loaded.',
          })
        }
        return { ok: false, reason: 'update_changed' }
      }
      const message = e.message || String(e)
      setCardErrors(prev => ({ ...prev, [item.id]: message }))
      window.mobius?.signal?.('error', { message, source: 'install' })
      if (!isBatch) setToast({ kind: 'error', message })
      return { ok: false, reason: 'error', error: message }
    } finally {
      if (!isBatch) {
        setBusy(false)
        setBusyItemId(null)
        setBusyActionKind(null)
      }
    }
  }

  const handleReviewUpdate = async (notice) => {
    if (busy || !notice) return
    if (notice.resolverChatId) {
      openChat(notice.resolverChatId)
      return
    }
    setBusy(true)
    setBusyItemId(notice.itemId || null)
    setBusyActionKind('resolve')
    setCardErrors(prev => withoutKey(prev, notice.itemId))
    try {
      const resolver = await createConflictResolverChat(
        notice.appId,
        'preserve_local',
        token,
      )
      setUpdateNotice(current => current?.itemId === notice.itemId
        ? {
            ...current,
            resolverChatId: resolver.chat_id,
            message: 'Local changes overlap this update. An agent is reconciling them while your current app stays live.',
          }
        : current)
      openChat(resolver.chat_id)
    } catch (e) {
      const message = e.message || String(e)
      setCardErrors(prev => ({ ...prev, [notice.itemId]: message }))
      setToast({ kind: 'error', message })
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }

  const handleDismissNotice = () => setUpdateNotice(null)

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

  // Integrate with the shell's back-stack so device back / swipe-back
  // dismisses the detail view first instead of closing the whole app.
  // Same protocol prod's klix-filter uses (moebius:nav-push / nav-pop
  // / nav-back postMessages, validated by Shell.jsx). When the shell
  // tells us the user navigated back, we clear `detail` ourselves; the
  // shell has already popped its sentinel so we don't echo nav-pop.
  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin) return
      if (event.source !== window.parent) return
      if (event.data?.type === 'moebius:nav-back') {
        setDetail(null)
        navDetailRef.current = null
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // openDetail: ask the shell to push a back-sentinel BEFORE rendering
  // the detail view, so a swipe-back gesture snapshots the catalog as
  // the under-page. The ack/rejected pair (with requestId) keeps
  // concurrent pushes from cross-resolving.
  const openDetail = useCallback(async (item) => {
    if (!item || !item.manifest) return
    reviewCapabilities(item)
    savedGridScrollRef.current = gridScrollRef.current?.scrollTop || 0
    if (navDetailRef.current && !detail) return
    if (detail) {
      // Already in a detail view (defensive — UI shouldn't allow this).
      // Swap without a second nav-push.
      setDetail(item)
      return
    }
    const requestId = `np-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    navDetailRef.current = item
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          window.removeEventListener('message', onAck)
          reject(new Error('nav-push ack timeout'))
        }, 5000)
        function onAck(event) {
          if (event.origin !== window.location.origin) return
          if (event.source !== window.parent) return
          if (event.data?.requestId !== requestId) return
          if (event.data.type === 'moebius:nav-push-ack') {
            clearTimeout(timer)
            window.removeEventListener('message', onAck)
            resolve()
          } else if (event.data.type === 'moebius:nav-push-rejected') {
            clearTimeout(timer)
            window.removeEventListener('message', onAck)
            reject(new Error('rejected'))
          }
        }
        window.addEventListener('message', onAck)
        window.parent.postMessage(
          { type: 'moebius:nav-push', label: 'app-store-detail', requestId },
          window.location.origin,
        )
      })
      setDetail(item)
    } catch {
      // Older shell without ack support, or the host hung — fall back
      // to rendering the detail anyway. The back gesture will close the
      // whole app instead of the detail view, but the detail is still
      // usable.
      navDetailRef.current = null
      setDetail(item)
    }
  }, [detail, reviewCapabilities])

  const prepareCatalogUpdate = useCallback(async (item) => {
    const installedApp = findInstalled(installed, item)
    if (!installedApp) throw new Error('Installed app could not be matched for review.')
    const [capabilityPreview, candidate] = await Promise.all([
        previewApp({
          manifest_url: item.manifest_url,
          manifest: item.manifest,
          raw_base: item.raw_base,
          token,
        }),
        loadUpdateCandidatePreview(installedApp.id, item.manifest_url, token).then(
          (preview) => ({ preview, error: '' }),
          (error) => ({
            preview: null,
            error: error.message || 'Update changes could not be loaded.',
          }),
        ),
      ])
    const capabilityReview = {
      status: capabilityDiffNeedsReview(capabilityPreview.capability_diff)
        ? 'changed'
        : 'ready',
      preview: capabilityPreview,
      error: '',
    }
    return {
      item,
      installedApp,
      preview: candidate.preview || {
        upstream_version: item.manifest?.version,
        upstream_diff: '',
      },
      previewError: candidate.error,
      capabilityReview,
    }
  }, [installed, token])

  const openPreparedUpdateReview = useCallback((prepared) => {
    setCapabilityReviews(prev => ({
      ...prev,
      [prepared.item.id]: prepared.capabilityReview,
    }))
    setUpdateReview(prepared)
  }, [])

  // Individual updates keep their read-only review. The one Update all action
  // uses the same verification contract but applies safe candidates directly.
  const handleCatalogUpdate = useCallback(async (item, opts = {}) => {
    if (!opts.isUpdate) {
      openDetail(item)
      return
    }
    if (busy || checkingUpdateRef.current || checkingAllUpdatesRef.current) return
    checkingUpdateRef.current = item.id
    setCheckingUpdateItemId(item.id)
    setCardErrors(prev => withoutKey(prev, item.id))
    try {
      openPreparedUpdateReview(await prepareCatalogUpdate(item))
    } catch (error) {
      const message = error.message || 'This update could not be checked.'
      setCapabilityReviews(prev => ({
        ...prev,
        [item.id]: { status: 'error', preview: null, error: message },
      }))
      setCardErrors(prev => ({ ...prev, [item.id]: message }))
      setToast({ kind: 'error', message })
    } finally {
      checkingUpdateRef.current = null
      setCheckingUpdateItemId(null)
    }
  }, [busy, openDetail, openPreparedUpdateReview, prepareCatalogUpdate])

  const handleApplyReviewedUpdate = useCallback(async () => {
    if (!updateReview || busy || agentReviewingUpdate) return
    if (!updateReview.preview?.source_digest) {
      const message = updateReview.previewError || 'The update source could not be verified. Nothing was changed.'
      setCardErrors(prev => ({ ...prev, [updateReview.item.id]: message }))
      return
    }
    const outcome = await handleInstall(updateReview.item, {
      isUpdate: true,
      capabilityDigest: updateReview.capabilityReview.preview.capability_digest,
      sourceDigest: updateReview.preview.source_digest,
    })
    if (outcome?.ok) {
      setUpdateReview(null)
      return
    }
    if (outcome?.conflict) {
      // The current app stayed live and handleInstall already started the
      // preserving resolver agent. Retire the pre-apply review instead of
      // asking the owner to choose a second path for the same update.
      setUpdateReview(null)
      return
    }
    if (outcome?.reason === 'capability_changed' || outcome?.reason === 'update_changed') {
      await handleCatalogUpdate(updateReview.item, { isUpdate: true })
    }
  }, [agentReviewingUpdate, busy, handleCatalogUpdate, handleInstall, updateReview])

  const handleAgentUpdateReview = useCallback(async () => {
    if (!updateReview || busy || agentReviewingUpdate) return
    setAgentReviewingUpdate(true)
    setCardErrors(prev => withoutKey(prev, updateReview.item.id))
    try {
      const updateError = cardErrors[updateReview.item.id] || updateReview.previewError || ''
      const title = `${updateError ? 'Investigate' : 'Review'} ${updateReview.item.manifest?.name || updateReview.item.id} update`
      const chat = await createAppChat(title, token, { ownerVisible: true })
      const content = updateError
        ? buildUpdateFailureMessage({ ...updateReview, error: updateError })
        : buildUpdateReviewMessage(updateReview)
      await seedChatMessage(chat.id, content, token)
      openChat(chat.id)
    } catch (error) {
      const message = error.message || 'Could not open an agent review.'
      setCardErrors(prev => ({ ...prev, [updateReview.item.id]: message }))
      setToast({ kind: 'error', message })
    } finally {
      setAgentReviewingUpdate(false)
    }
  }, [agentReviewingUpdate, busy, cardErrors, token, updateReview])

  const handleAskAgentAboutError = useCallback(async (item, error) => {
    if (!item || !error || agentErrorItemId) return
    const installedApp = findInstalled(installed, item)
    setAgentErrorItemId(item.id)
    try {
      const title = `Investigate ${item.manifest?.name || item.id} update`
      const chat = await createAppChat(title, token, { ownerVisible: true })
      const content = buildUpdateFailureMessage({
        item,
        installedApp,
        preview: null,
        error,
      })
      await seedChatMessage(chat.id, content, token)
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

  // closeDetail: tell the shell to pop its sentinel, then clear our
  // own detail state. Idempotent — calling when detail is already
  // null is a no-op.
  const closeDetail = useCallback(() => {
    if (!detail) return
    window.parent.postMessage(
      { type: 'moebius:nav-pop' },
      window.location.origin,
    )
    setDetail(null)
    navDetailRef.current = null
  }, [detail])

  // B1: returning from a detail re-mounts the grid; restore its saved scroll.
  useLayoutEffect(() => {
    if (!detail && gridScrollRef.current && savedGridScrollRef.current) {
      gridScrollRef.current.scrollTop = savedGridScrollRef.current
    }
  }, [detail])

  // Roving tab navigation: ArrowLeft/ArrowRight move selection between the
  // tabs with wrap, and move DOM focus to the newly-selected tab (the
  // tablist's roving tabIndex keeps only the active tab in the Tab order).
  const onTabsKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const order = ['browse', 'library', 'publish']
    const i = order.indexOf(tab)
    const next = e.key === 'ArrowRight'
      ? order[(i + 1) % order.length]
      : order[(i - 1 + order.length) % order.length]
    selectTab(next)
    document.getElementById(`st-tab-${next}`)?.focus()
  }

  const displayCatalog = useMemo(
    () => sortCatalogForDisplay([
      ...mergeOfficialCommunityFeedback(catalog, communityCatalog),
      ...otherInstalledCatalog,
    ]),
    [catalog, communityCatalog, otherInstalledCatalog],
  )
  const detailCommunityFeedback = detail?.community_feedback || detail?.community || null
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
        updateNotice: updateNotice?.itemId === item.id ? updateNotice : null,
        installedUnavailable: !!installedLoadError,
        setupCompletions,
        systemSetupReady,
      }))
    }
    return byId
  }, [displayCatalog, installed, updateChecks, updateNotice, installedLoadError, setupCompletions, systemSetupReady])

  const filterCounts = useMemo(() => {
    let updates = 0
    let setup = 0
    let installedCount = 0
    for (const item of displayCatalog) {
      const lifecycle = lifecycleById.get(item.id)
      if (!lifecycle) continue
      if (lifecycle.key === 'update' || lifecycle.key === 'conflict') updates += 1
      if (lifecycle.installedApp) installedCount += 1
      if (lifecycle.setupNeedsAttention) setup += 1
    }
    return {
      update: updates,
      installed: installedCount,
      setup,
    }
  }, [displayCatalog, lifecycleById])

  const updateItems = useMemo(
    () => displayCatalog.filter((item) => lifecycleById.get(item.id)?.key === 'update'),
    [displayCatalog, lifecycleById],
  )

  const handleUpdateAll = async () => {
    if (
      !updateItems.length || busy || checkingUpdateRef.current ||
      checkingAllUpdatesRef.current || installedLoadError
    ) return
    checkingAllUpdatesRef.current = true
    setCheckingAllUpdates(true)
    setCategory('update')
    let checked = []
    try {
      checked = await mapWithConcurrency(updateItems, 4, async (item) => {
        try {
          const prepared = await prepareCatalogUpdate(item)
          return { item, prepared, disposition: updateBatchDisposition(prepared), error: '' }
        } catch (error) {
          const message = error.message || 'This update could not be checked.'
          return {
            item,
            prepared: null,
            disposition: updateBatchDisposition({ error: message }),
            error: message,
          }
        }
      })
    } finally {
      checkingAllUpdatesRef.current = false
      setCheckingAllUpdates(false)
    }

    const ready = checked.filter((entry) => entry.disposition.kind === 'ready')
    const attention = checked.filter((entry) => entry.disposition.kind !== 'ready')
    let completed = 0
    let failed = 0
    const resolverChats = []
    if (ready.length) {
      setBusy(true)
      setBusyActionKind('batch_update')
      try {
        for (let index = 0; index < ready.length; index += 1) {
          const entry = ready[index]
          const name = entry.item.manifest?.name || entry.item.id
          setBusyItemId(entry.item.id)
          setBatchProgress({ current: index + 1, total: ready.length, name })
          const outcome = await handleInstall(entry.item, {
            isUpdate: true,
            batch: true,
            capabilityDigest: entry.prepared.capabilityReview.preview.capability_digest,
            sourceDigest: entry.prepared.preview.source_digest,
          })
          if (outcome?.ok) completed += 1
          else if (outcome?.conflict && outcome.resolver?.chat_id) {
            resolverChats.push(outcome.resolver.chat_id)
          } else {
            failed += 1
          }
        }
        await refreshInstalled()
      } finally {
        setBusy(false)
        setBusyItemId(null)
        setBusyActionKind(null)
        setBatchProgress(null)
      }
    }

    const reviewCount = attention.length + failed
    const parts = []
    if (completed) parts.push(`${completed} ${completed === 1 ? 'app' : 'apps'} updated`)
    if (resolverChats.length) {
      parts.push(`${resolverChats.length} ${resolverChats.length === 1 ? 'conflict has' : 'conflicts have'} an agent review`)
    }
    if (reviewCount) parts.push(`${reviewCount} ${reviewCount === 1 ? 'update needs' : 'updates need'} your review`)
    setToast({
      kind: reviewCount ? 'error' : 'success',
      message: `${parts.join('; ') || 'Everything is already up to date'}.`,
      action: resolverChats.length === 1
        ? { label: 'Open agent', onClick: () => openChat(resolverChats[0]) }
        : null,
    })
  }

  const visibleCatalog = useMemo(() => {
    const specialFilters = new Set(['update', 'setup', 'installed'])
    const catalogCategory = specialFilters.has(category) ? 'all' : category
    const matches = filterCatalog(displayCatalog, { query, category: catalogCategory })
    if (category === 'update') {
      return matches.filter((item) => {
        const lifecycle = lifecycleById.get(item.id)
        return lifecycle?.key === 'update' || lifecycle?.key === 'conflict'
      })
    }
    if (category === 'setup') {
      return matches.filter((item) => lifecycleById.get(item.id)?.setupNeedsAttention)
    }
    if (category === 'installed') {
      return matches.filter((item) => !!lifecycleById.get(item.id)?.installedApp)
    }
    return matches
  }, [displayCatalog, query, category, lifecycleById])

  const libraryCatalog = useMemo(
    () => visibleCatalog.filter((item) => !!lifecycleById.get(item.id)?.installedApp),
    [visibleCatalog, lifecycleById],
  )

  const attentionCount = useMemo(
    () => displayCatalog.filter((item) => lifecycleById.get(item.id)?.key === 'conflict').length,
    [displayCatalog, lifecycleById],
  )

  useEffect(() => {
    if (!intentDestination || loadingCatalog) return
    if (intentDestination.kind === 'updates') {
      setIntentDestination(null)
      selectTab('library')
      setCategory('update')
      setQuery('')
      setDetail(null)
      navDetailRef.current = null
      return
    }
    const resolution = resolveCatalogItemIntent(displayCatalog, intentDestination.itemId)
    setIntentDestination(null)
    if (resolution.action === 'unavailable') {
      setToast(resolution.toast)
      return
    }
    selectTab('browse')
    setCategory('all')
    if (resolution.action === 'needs-connection') {
      const item = resolution.item
      setQuery(item.name || intentDestination.itemId)
      setToast(resolution.toast)
      return
    }
    const item = resolution.item
    void openDetail(item)
  }, [displayCatalog, intentDestination, loadingCatalog, openDetail])

  // Detail view replaces the main layout when set.
  if (detail) {
    return (
      <div className="st-root">
        <style>{CSS}</style>
        <DetailView
          storeAppId={appId}
          item={detail}
          capabilityReview={capabilityReviews[detail.id]}
          onRetryCapabilityReview={() => reviewCapabilities(detail)}
          installed={installed}
          onBack={closeDetail}
          onInstall={(item, opts) => opts?.isUpdate
            ? handleCatalogUpdate(item, opts)
            : handleInstall(item, opts)}
          onUninstall={handleUninstall}
          onOpenInstalled={handleOpenInstalled}
          onSetup={handleSetup}
          onRetryInstalled={handleRetryInstalled}
          busy={busy || checkingUpdateItemId === detail.id}
          busyActionKind={busyItemId === detail.id
            ? busyActionKind
            : checkingUpdateItemId === detail.id ? 'checking_update' : null}
          updateChecks={updateChecks}
          updateNotice={updateNotice?.itemId === detail.id ? updateNotice : null}
          onReviewUpdate={handleReviewUpdate}
          onDismissNotice={handleDismissNotice}
          onCommunityRate={handleCommunityRate}
          onCommunityComment={handleCommunityComment}
          communityBusy={communityActionBusy}
          communityError={communityActionError.key === detailCommunityFeedbackKey
            ? communityActionError.message
            : ''}
          communityIdentityLinked={!!communityIdentity?.linked}
          githubIdentityConnected={!!githubIdentity?.connected}
          token={token}
          installedUnavailable={!!installedLoadError}
          setupCompletions={setupCompletions}
          systemSetupReady={systemSetupReady}
        />
        {pendingUninstall && (
          <UninstallConfirmModal
            app={pendingUninstall}
            busy={busy}
            onConfirm={confirmUninstall}
            onCancel={() => !busy && setPendingUninstall(null)}
          />
        )}
        {updateReview && (
          <UpdateReviewModal
            review={updateReview}
            applying={busy && busyActionKind === 'update'}
            agentReviewing={agentReviewingUpdate}
            error={cardErrors[updateReview.item.id] || ''}
            onClose={() => setUpdateReview(null)}
            onApply={handleApplyReviewedUpdate}
            onReviewWithAgent={handleAgentUpdateReview}
          />
        )}
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    )
  }

  return (
    <div className="st-root">
      <style>{CSS}</style>
      <h1 className="st-sr-only">App Store</h1>
      <div className="st-header">
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
          <div className="st-seg is-accent st-tabs" role="tablist" aria-label="Browse mode"
               onKeyDown={onTabsKeyDown}>
            <button role="tab" id="st-tab-browse"
                    aria-selected={tab === 'browse'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'browse' ? 0 : -1}
                    className={`st-seg-btn${tab === 'browse' ? ' is-active' : ''}`}
                    onClick={() => selectTab('browse')}>
              Browse
            </button>
            <button role="tab" id="st-tab-library"
                    aria-selected={tab === 'library'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'library' ? 0 : -1}
                    className={`st-seg-btn${tab === 'library' ? ' is-active' : ''}`}
                    onClick={() => { selectTab('library'); setCategory('all') }}>
              Library
              {filterCounts.update > 0 && (
                <span
                  className="st-tab-count"
                  aria-label={`${filterCounts.update} updates available`}
                >
                  {filterCounts.update}
                </span>
              )}
            </button>
            <button role="tab" id="st-tab-publish"
                    aria-selected={tab === 'publish'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'publish' ? 0 : -1}
                    className={`st-seg-btn${tab === 'publish' ? ' is-active' : ''}`}
                    onClick={() => selectTab('publish')}>
              Publish
            </button>
          </div>
          <span className="st-header-balance" aria-hidden="true" />
        </div>
      </div>

      <div className={`st-scroll is-${tab}`} ref={gridScrollRef}
           id="st-tabpanel" role="tabpanel"
           aria-labelledby={`st-tab-${tab}`}>
        {(tab === 'browse' || tab === 'library') && (
          <>
            <SelfUpdateBanner appId={appId} token={token} />
            {loadingCatalog
              ? <CatalogSkeleton count={CATALOG.length} />
              : <>
                  <CatalogFilters
                    query={query}
                    category={category}
                    filterCounts={filterCounts}
                    totalCount={displayCatalog.length}
                    resultCount={tab === 'library' ? libraryCatalog.length : visibleCatalog.length}
                    onQueryChange={setQuery}
                    onCategoryChange={setCategory}
                    updateAllCount={updateItems.length}
                    updateAllState={checkingAllUpdates
                      ? 'checking'
                      : busyActionKind === 'batch_update' ? 'updating' : 'idle'}
                    updateAllProgress={batchProgress}
                    updateAllDisabled={busy || !!checkingUpdateItemId || !!installedLoadError}
                    onUpdateAll={handleUpdateAll}
                    mode={tab}
                  />
                  {tab === 'library' && (
                    <LibraryHealth
                      installedCount={filterCounts.installed}
                      updateCount={updateItems.length}
                      attentionCount={attentionCount}
                      updateChecks={updateChecks}
                    />
                  )}
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
                  {tab === 'browse' && communityError && (
                    <div className="st-registry-offline" role="status">
                      <span><strong>Built-in selection</strong> · Shared listings are offline.</span>
                      <button type="button" onClick={() => refreshCommunity({ append: false })}>Retry</button>
                    </div>
                  )}
                  <CatalogList
                    appId={appId}
                    items={tab === 'library' ? libraryCatalog : visibleCatalog}
                    installed={installed}
                    updateChecks={updateChecks}
                    onPick={(item) => item.manifest && openDetail(item)}
                    onRetry={retryCatalogItem}
                    onUpdate={handleCatalogUpdate}
                    onOpenInstalled={handleOpenInstalled}
                    onRetryInstalled={handleRetryInstalled}
                    busy={busy || checkingAllUpdates}
                    installedUnavailable={!!installedLoadError}
                    busyItemId={busyItemId}
                    busyActionKind={busyActionKind}
                    checkingUpdateItemId={checkingUpdateItemId}
                    errors={cardErrors}
                    onAskAgentError={handleAskAgentAboutError}
                    agentErrorItemId={agentErrorItemId}
                    updateNotice={updateNotice}
                    onReviewUpdate={handleReviewUpdate}
                    onDismissNotice={handleDismissNotice}
                    token={token}
                    emptyTitle={tab === 'library' ? 'No installed apps match' : 'No matches'}
                    emptyText={tab === 'library' ? 'Try another search, or browse the Store for something new.' : 'Try a different search or filter.'}
                    setupCompletions={setupCompletions}
                    systemSetupReady={systemSetupReady}
                    loadingMore={tab === 'browse' && communityLoading && communityOffset > 0}
                    searchLoading={tab === 'browse' && communityLoading && communityOffset === 0}
                    hasMore={tab === 'browse' && communityHasMore}
                    onLoadMore={() => refreshCommunity({ append: true })}
                    editorial={tab === 'browse' && !query && category === 'all'}
                    spotlightFeed={spotlightFeed}
                    layout={tab === 'library' ? 'list' : 'grid'}
                  />
                </>}
          </>
        )}
        {tab === 'publish' && (
          <PublisherTab
            installed={installed}
            identity={communityIdentity}
            identityError={communityIdentityError}
            viewer={{ github: githubIdentity, error: githubIdentityError }}
            onRefreshViewer={refreshGithubIdentity}
            onPublishLocal={handlePublishLocal}
            onPreviewLocal={(localAppId) => loadLocalPublicationPreview(token, localAppId)}
            onRegisterRepository={handleRegisterCommunity}
            publishingId={publishingId}
            publication={publication}
            publicationError={publicationError}
            publicationStates={publicationStates}
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
            contributeAvailable={!!contributeApp}
            onOpenContributions={(localAppId) => openInstalledApp(
              contributeApp.id,
              localAppId ? {} : { intent: 'reviews:queue' },
            )}
          />
        )}
      </div>

      {pendingUninstall && (
        <UninstallConfirmModal
          app={pendingUninstall}
          busy={busy}
          onConfirm={confirmUninstall}
          onCancel={() => !busy && setPendingUninstall(null)}
        />
      )}
      {updateReview && (
        <UpdateReviewModal
          review={updateReview}
          applying={busy && busyActionKind === 'update'}
          agentReviewing={agentReviewingUpdate}
          error={cardErrors[updateReview.item.id] || ''}
          onClose={() => setUpdateReview(null)}
          onApply={handleApplyReviewedUpdate}
          onReviewWithAgent={handleAgentUpdateReview}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
