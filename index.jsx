// App Store — thin app shell. The module tree is declared in mobius.json's
// source_files; the multi-file installer fetches each path and esbuild bundles
// from this entry, resolving the relative imports below at compile time.
//
//   constants.js  — curated catalog, self-update constants, trusted hosts,
//                    and permission explanation tables
//   theme.js      — the single app stylesheet (CSS)
//   domain.js     — pure + DOM-level URL, version, schedule, and update-message logic
//   storage.js    — installed-version storage layer
//   api.js        — catalog fetch, install/update, app list, and chat API helpers
//   ui/*.jsx      — one React component per file
//
// Only App lives here: it owns top-level catalog/install/navigation state and
// mounts the browse grid, From URL tab, detail view, modal, banner, and toast.
import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { CATALOG, CATALOG_URL } from './constants.js'
import { CSS } from './theme.js'
import {
  buildCleanMergeReviewMessage,
  appLifecycleFor,
  busyLabelForAction,
  canonicalIdentityKey,
  collectCategories,
  filterCatalog,
  findInstalled,
  isSystemCatalogItem,
  semverCmp,
  sortCatalogForDisplay,
} from './domain.js'
import {
  createAppChat,
  createConflictResolverChat,
  fetchCatalog,
  fetchManifest,
  fetchUpdateCheck,
  hasConnectedProvider,
  installApp,
  loadInstalledApps,
  loadProviderStatus,
  loadUpdatePreview,
  openChat,
  openInstalledApp,
  openSystemSettings,
  readSetupCompletions,
  readSystemSetupReady,
  seedChatMessage,
  SETUP_COMPLETIONS_KEY,
  SYSTEM_SETUP_READY_KEY,
} from './api.js'
import { loadInstalledVersions, saveInstalledVersions } from './storage.js'
import { CatalogList } from './ui/CatalogList.jsx'
import { CatalogFilters } from './ui/CatalogFilters.jsx'
import { CatalogSkeleton } from './ui/CatalogSkeleton.jsx'
import { DetailView } from './ui/DetailView.jsx'
import { FromUrlTab } from './ui/FromUrlTab.jsx'
import { SelfUpdateBanner } from './ui/SelfUpdateBanner.jsx'
import { UninstallConfirmModal } from './ui/UninstallConfirmModal.jsx'

export {
  appLifecycleFor,
  busyLabelForAction,
  canonicalIdentityKey,
  collectCategories,
  filterCatalog,
  findInstalled,
  isSystemCatalogItem,
  humanCron,
  isTrustedHost,
  scheduleSummary,
  semverCmp,
  sortCatalogForDisplay,
  validateManifestUrl,
} from './domain.js'
export { STORE_VERSION } from './constants.js'
export { normalizeInstalledVersions } from './storage.js'
export {
  fetchCatalog,
  fetchManifest,
  installApp,
  loadInstalledApps,
  proxyUrl,
  readErrorDetail,
} from './api.js'

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
// a { [numericAppId]: update_available } map (true | false | null). Same
// bounded pool as the manifest refetch. fetchUpdateCheck never throws — it
// degrades to null — so this resolves cleanly even when the endpoint 404s on an
// older backend; callers merge the answered ids and leave the rest on the
// semver path. Scoped by the caller to installed catalog apps: only those show
// a badge, so only their ids are worth checking.
async function fetchUpdateChecksFor(rows, token) {
  if (!rows.length) return {}
  const results = await mapWithConcurrency(rows, MANIFEST_FETCH_CONCURRENCY, async (app) => ({
    id: app.id,
    available: await fetchUpdateCheck(app.id, token),
  }))
  const out = {}
  for (const r of results) out[r.id] = r.available
  return out
}

// Merge fresh update-check answers into the prior map, but return the SAME
// reference when nothing changed so React bails out of the re-render — an
// up-to-date store must not re-render its grid on every focus regain (mirrors
// the manifest-refetch skip). Only newly-answered or flipped ids force a new
// object.
export function mergeUpdateChecks(prev, incoming) {
  let changed = false
  for (const k in incoming) {
    if (prev[k] !== incoming[k]) { changed = true; break }
  }
  return changed ? { ...prev, ...incoming } : prev
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
    if (app && checks?.[app.id] === false) settled.add(item.id)
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
  // Mirror of `catalog` so the focus/visibility refresh can read the HYDRATED
  // entries (each carrying its real fetched manifest.id) without taking a
  // `catalog` dependency — that dependency would churn the event listeners on
  // every manifest update. The update-check identity must key on the published
  // manifest id, NOT the raw CATALOG id: an entry whose CATALOG id differs from
  // its manifest id (e.g. CATALOG `gym` / manifest `workout`) canonicalises to
  // `#manifest-id=gym` off the raw id but the installed row is stored under
  // `#manifest-id=workout`, so keying off the raw id never matches and that app
  // is silently never update-checked. The hydrated manifest.id is the only
  // value that matches the stored row for ANY id/slug-stem mismatch.
  const catalogRef = useRef(catalog)
  useEffect(() => { catalogRef.current = catalog }, [catalog])
  const [installed, setInstalled] = useState([])
  const [installedVersions, setInstalledVersions] = useState({})
  // Git-native update-availability per installed app, keyed by numeric app id:
  // true/false as answered by GET /api/apps/{id}/update-check; a missing key
  // (or a null value) means unknown, so appLifecycleFor falls back to the semver
  // compare. Refreshed on mount + debounced focus/visibility, never in an
  // unbounded loop.
  const [updateChecks, setUpdateChecks] = useState({})
  const [setupCompletions, setSetupCompletions] = useState(() => readSetupCompletions())
  const [systemSetupComplete, setSystemSetupComplete] = useState(() => readSystemSetupReady())
  const [providerStatus, setProviderStatus] = useState(null)
  const [detail, setDetail] = useState(null)  // {id, manifest, raw_base}
  const navDetailRef = useRef(null)  // pending detail item during nav-push ack
  // B1: preserve the catalog grid's scroll across opening a detail and coming
  // back — the grid unmounts while a detail shows, so it would otherwise
  // re-mount scrolled to the top.
  const gridScrollRef = useRef(null)
  const savedGridScrollRef = useRef(0)
  const [pendingUninstall, setPendingUninstall] = useState(null)
  // pendingUninstall: the installed app row from /api/apps/.
  // Browser modal dialogs are silently no-op'd inside the AppCanvas
  // iframe (sandbox lacks `allow-modals`), so we stage the
  // confirmation as in-app state and render our own modal.
  const [busy, setBusy] = useState(false)
  const [busyItemId, setBusyItemId] = useState(null)
  const [busyActionKind, setBusyActionKind] = useState(null)
  const [toast, setToast] = useState(null)
  const [updateNotice, setUpdateNotice] = useState(null)
  const [cardErrors, setCardErrors] = useState({})
  // A complete baked snapshot is usable on the very first render. Installed
  // state and the remote registry hydrate independently; neither should make a
  // healthy catalog flash a skeleton or feel network-bound.
  const [loadingCatalog, setLoadingCatalog] = useState(
    () => !CATALOG.every((entry) => entry.manifest),
  )
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

  const clearSettledUpdateArtifacts = useCallback((itemIds) => {
    if (!itemIds?.size) return
    setCardErrors(prev => {
      let next = prev
      for (const id of itemIds) next = withoutKey(next, id)
      return next
    })
    setUpdateNotice(prev => (prev && itemIds.has(prev.itemId) ? null : prev))
  }, [])

  // Initial fetch: catalog manifests + installed apps + version map.
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
        // complete, usable floor; same-origin installed/setup state should be
        // the only work that can delay the initial cards.
        const remoteCatalogPromise = fetchCatalog(CATALOG_URL, token)
          .catch(() => null)
        const [installedResult, versions, nextProviderStatus] = await Promise.all([
          loadInstalledApps(token)
            .then((apps) => ({ apps, error: '' }))
            .catch((err) => ({
              apps: null,
              error: err?.message || 'Installed apps could not be loaded.',
            })),
          loadInstalledVersions(appId, token),
          loadProviderStatus(token),
        ])
        if (cancelled) return
        const apps = installedResult.apps || []
        if (installedResult.apps) {
          setInstalled(apps)
          setInstalledLoadError('')
        } else {
          setInstalledLoadError(installedResult.error)
        }
        setInstalledVersions(versions)
        setSetupCompletions(readSetupCompletions())
        setSystemSetupComplete(readSystemSetupReady())
        if (nextProviderStatus) setProviderStatus(nextProviderStatus)
        if (CATALOG.every((entry) => entry.manifest)) {
          setLoadingCatalog(false)
        }
        // Resolve the catalog SOURCE by MERGING the web registry (catalog.json,
        // fetched via the proxy) OVER the baked CATALOG — never replacing it.
        // Baked is the floor: an app in the baked list can never vanish because
        // the registry is stale/partial (which would drop it from Browse + its
        // update/rehydrate flows). The registry overrides a known app's URL
        // fields and can ADD new apps. This is what lets a newly-published app
        // appear without a store-app redeploy — appending it to catalog.json on
        // main is enough. On fetch failure /
        // empty result, the baked CATALOG carries the store untouched.
        let entries = CATALOG
        const remote = await remoteCatalogPromise
        if (Array.isArray(remote) && remote.length) {
          const merged = new Map(CATALOG.map((c) => [c.id, c]))
          for (const r of remote) merged.set(r.id, { ...(merged.get(r.id) || {}), ...r })
          entries = [...merged.values()]
        }
        if (cancelled) return
        // Hydrate entries that do not already carry a validated manifest
        // snapshot from catalog.json. The registry is the hot path; per-app
        // manifest fetches are the backwards-compatible fallback for older or
        // partial registries. Installed apps get a live re-check below so stale
        // snapshots cannot hide an update after a release lands.
        const hydrated = await mapWithConcurrency(
          entries,
          MANIFEST_FETCH_CONCURRENCY,
          async (c) => {
            if (c.manifest) return { ...c, error: null }
            try {
              const manifest = await fetchManifest(c.manifest_url, token)
              return { ...c, manifest, error: null }
            } catch (e) {
              return { ...c, manifest: null, error: e.message || String(e) }
            }
          },
        )
        if (cancelled) return
        const installedTargets = apps.length
          ? hydrated.filter((c) => findInstalled(apps, c))
          : []
        setCatalog(hydrated)
        lastUpdateCheckRef.current = Date.now()
        // Git-native update-checks for the installed catalog apps. Fire-and-
        // forget on purpose: a slow or absent (404) endpoint must never gate the
        // skeleton clear in `finally`, so we do NOT await it here. fetchUpdate
        // ChecksFor never rejects (fetchUpdateCheck degrades to null), so no
        // unhandled rejection escapes; until these land the semver compare drives
        // the badge, and when they land they refine it in place.
        const checkRows = installedTargets
          .map((c) => findInstalled(apps, c))
          .filter(Boolean)
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
    // Targets come from the HYDRATED catalog (read via catalogRef so this
    // callback keeps a stable [token] dep), NOT the raw CATALOG: findInstalled
    // canonicalises on `item.manifest?.id || item.id`, and only the hydrated
    // entry carries the real fetched manifest.id. Off the raw CATALOG, an entry
    // whose id differs from its manifest id (e.g. `gym` → manifest `workout`)
    // would canonicalise to a `#manifest-id` the installed row was never stored
    // under, so it would never match and never be update-checked. Entries not
    // yet hydrated (manifest null) fall back to their raw id; that only means
    // they wait for the next refresh after mount hydration lands, never a silent
    // permanent miss.
    const targets = catalogRef.current.filter(c => findInstalled(apps, c))
    if (targets.length === 0) {
      lastUpdateCheckRef.current = Date.now()
      return
    }
    updateCheckingRef.current = true
    try {
      const checkRows = targets.map(c => findInstalled(apps, c)).filter(Boolean)
      const checks = await fetchUpdateChecksFor(checkRows, token)
      setUpdateChecks(prev => mergeUpdateChecks(prev, checks))
      clearSettledUpdateArtifacts(itemIdsSettledByChecks(targets, apps, checks))
      lastUpdateCheckRef.current = Date.now()
    } finally {
      updateCheckingRef.current = false
    }
  }, [token, clearSettledUpdateArtifacts])

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
    openInstalledApp(id, () => {
      setToast({
        kind: 'error',
        message: 'Open this app from the drawer.',
      })
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
      openInstalledApp(installedApp.id, { intent: 'setup' }, () => {
        setToast({
          kind: 'error',
          message: 'Open this app from the drawer.',
        })
      })
    }
  }, [])

  // Install / update runs inline from DetailView's primary button.
  // There is no intermediate confirm modal — DetailView is the
  // confirmation surface (permissions, schedule, esm.sh deps and the
  // unfamiliar-host warning are all rendered there). `busy` flips so
  // the button can disable + show "Installing…" while in flight.
  const handleInstall = async (item, _opts = {}) => {
    if (busy) return
    const startedActionKind = _opts?.isUpdate ? 'update' : 'install'
    setBusy(true)
    setBusyItemId(item?.id || null)
    setBusyActionKind(startedActionKind)
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
      })
      const isConflict = result.mode === 'conflict'
      const isSeamlessUpdate = result.mode === 'update' &&
        (result.divergence === 'fast_forward' || result.divergence === 'none')
      const isCleanMerge = result.mode === 'update' && result.divergence === 'clean_merge'

      if (isConflict) {
        // Friendly, non-alarming framing: the owner edited the app, and those
        // edits overlap the new release so they can't be combined
        // automatically. Offer the agent's help rather than surfacing raw
        // conflict files (the resolver chat carries the file-level detail).
        const message = 'This copy has local changes, so updating needs a quick reconcile.'
        const notice = {
          kind: 'conflict',
          itemId: item.id,
          appId: result.id,
          message,
          result,
          item,
        }
        setUpdateNotice(notice)
        await refreshInstalled()
        // A conflict needs review, but don't yank the user to the detail
        // view — the persisted updateNotice drives the reconcile affordance
        // in place on whichever surface the owner is using.
        return
      }

      // Record the version we just installed so update detection
      // works on the next browse render. The backend returns the
      // version it actually applied, which is authoritative.
      const nextVersions = { ...installedVersions, [item.id]: result.version }
      setInstalledVersions(nextVersions)
      if (result.id) {
        // A successful install/update just made this app current. The
        // git-native probe is authoritative over version strings, so leaving a
        // stale `true` here keeps the card/detail CTA on "Update" until the
        // next debounced recheck. Clear it optimistically; later focus checks
        // can flip it back if upstream moves again.
        setUpdateChecks(prev => mergeUpdateChecks(prev, { [result.id]: false }))
      }
      setCardErrors(prev => withoutKey(prev, item.id))
      setUpdateNotice(prev => (prev?.itemId === item.id ? null : prev))
      await saveInstalledVersions(appId, token, nextVersions)
      await refreshInstalled()
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
        setToast({
          kind: 'success',
          message: `${appName} updated to v${versionText}.`,
          action: openAction,
        })
        return
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
        setToast({
          kind: 'success',
          message: `${appName} updated to v${versionText}.`,
          action: openAction,
        })
        return
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
      setToast({
        kind: 'success',
        message: `${appName} ${verb}${warnSuffix}.`,
        action: openAction,
      })
      // Stay on the detail view. Two reasons: (1) closing here would
      // bounce the user back to the catalog grid mid-action, which felt
      // like the app didn't acknowledge the tap. (2) after refreshInstalled
      // resolves the detail re-renders with the installed state — the
      // primary CTA flips from "Install" to "Open App", confirming the
      // commit on the same surface the user committed it from. The user
      // can use the back arrow / device-back to dismiss when ready.
    } catch (e) {
      const message = e.message || String(e)
      setCardErrors(prev => ({ ...prev, [item.id]: message }))
      window.mobius?.signal?.('error', { message, source: 'install' })
      setToast({ kind: 'error', message })
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }

  const handleReviewUpdate = async (notice) => {
    if (busy || !notice) return
    setBusy(true)
    setBusyItemId(notice.itemId || null)
    setBusyActionKind('resolve')
    setCardErrors(prev => withoutKey(prev, notice.itemId))
    try {
      if (notice.kind === 'conflict') {
        const resolver = await createConflictResolverChat(notice.appId, token)
        openChat(resolver.chat_id)
        return
      }
      const preview = await loadUpdatePreview(notice.appId, token)
      const title = `Review ${notice.result.name || notice.item.manifest?.name || notice.item.id} update`
      const chat = await createAppChat(title, token, { ownerVisible: true })
      const content = buildCleanMergeReviewMessage({
        item: notice.item, result: notice.result, preview,
      })
      await seedChatMessage(chat.id, content, token)
      openChat(chat.id)
    } catch (e) {
      const message = e.message || String(e)
      // Drop the calm conflict notice so the card's precedence (notice
      // over inline error) can't hide this real failure — the item
      // falls back to its Update affordance with the red error shown.
      setUpdateNotice(prev => (prev?.itemId === notice.itemId ? null : prev))
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
      // Drop the version record too, matched by the canonical identity key the
      // backend stamps on every install — NOT slug == manifest.id. A slug can be
      // suffixed on collision (e.g. "news-2"), so a slug match would miss it and
      // leave a stale version entry that fakes an "update available" on reinstall.
      const next = { ...installedVersions }
      for (const item of catalog) {
        const manifestId = item.manifest?.id || item.id
        if (app.manifest_url &&
            canonicalIdentityKey(item.manifest_url, manifestId) === app.manifest_url) {
          delete next[item.id]
        }
      }
      setInstalledVersions(next)
      await saveInstalledVersions(appId, token, next)
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
  }, [detail])

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
  // two tabs with wrap, and move DOM focus to the newly-selected tab (the
  // tablist's roving tabIndex keeps only the active tab in the Tab order).
  const onTabsKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const order = ['browse', 'url']
    const i = order.indexOf(tab)
    const next = e.key === 'ArrowRight'
      ? order[(i + 1) % order.length]
      : order[(i - 1 + order.length) % order.length]
    setTab(next)
    document.getElementById(next === 'browse' ? 'st-tab-browse' : 'st-tab-url')?.focus()
  }

  const displayCatalog = useMemo(() => sortCatalogForDisplay(catalog), [catalog])
  const systemSetupReady = useMemo(
    () => systemSetupComplete || hasConnectedProvider(providerStatus),
    [systemSetupComplete, providerStatus],
  )
  const lifecycleById = useMemo(() => {
    const byId = new Map()
    for (const item of displayCatalog) {
      byId.set(item.id, appLifecycleFor(item, {
        installed,
        installedVersions,
        updateChecks,
        updateNotice: updateNotice?.itemId === item.id ? updateNotice : null,
        installedUnavailable: !!installedLoadError,
        setupCompletions,
        systemSetupReady,
      }))
    }
    return byId
  }, [displayCatalog, installed, installedVersions, updateChecks, updateNotice, installedLoadError, setupCompletions, systemSetupReady])

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

  // Detail view replaces the main layout when set.
  if (detail) {
    return (
      <div className="st-root">
        <style>{CSS}</style>
        <DetailView
          item={detail}
          installed={installed}
          installedVersions={installedVersions}
          onBack={closeDetail}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onOpenInstalled={handleOpenInstalled}
          onSetup={handleSetup}
          onRetryInstalled={handleRetryInstalled}
          busy={busy}
          busyActionKind={busyItemId === detail.id ? busyActionKind : null}
          updateChecks={updateChecks}
          updateNotice={updateNotice?.itemId === detail.id ? updateNotice : null}
          onReviewUpdate={handleReviewUpdate}
          onDismissNotice={handleDismissNotice}
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
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    )
  }

  return (
    <div className="st-root">
      <style>{CSS}</style>
      <div className="st-header">
        <div className="st-title-row">
          {/* Brand mark: the app's real glossy icon (downscaled + cached),
              no name text. Falls back to an accent dot when this install
              has no custom icon and the route 404s. */}
          <img
            src={`/api/apps/${appId}/icon?size=64`}
            alt=""
            width={40}
            height={40}
            className="st-brand-icon"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const f = e.currentTarget.nextElementSibling
              if (f) f.style.display = 'flex'
            }}
          />
          <span className="st-brand-fallback" style={{ display: 'none' }} aria-hidden="true">·</span>
          <div className="st-seg is-accent st-tabs" role="tablist" aria-label="Browse mode"
               onKeyDown={onTabsKeyDown}>
            <button role="tab" id="st-tab-browse"
                    aria-selected={tab === 'browse'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'browse' ? 0 : -1}
                    className={`st-seg-btn${tab === 'browse' ? ' is-active' : ''}`}
                    onClick={() => setTab('browse')}>
              Browse
            </button>
            <button role="tab" id="st-tab-url"
                    aria-selected={tab === 'url'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'url' ? 0 : -1}
                    className={`st-seg-btn${tab === 'url' ? ' is-active' : ''}`}
                    onClick={() => setTab('url')}>
              From URL
            </button>
          </div>
        </div>
      </div>

      <div className="st-scroll" ref={gridScrollRef}
           id="st-tabpanel" role="tabpanel"
           aria-labelledby={tab === 'browse' ? 'st-tab-browse' : 'st-tab-url'}>
        {tab === 'browse' && (
          <>
            <SelfUpdateBanner appId={appId} token={token} />
            {loadingCatalog
              ? <CatalogSkeleton count={CATALOG.length} />
              : <>
                  <CatalogFilters
                    query={query}
                    category={category}
                    filterCounts={filterCounts}
                    totalCount={catalog.length}
                    resultCount={visibleCatalog.length}
                    onQueryChange={setQuery}
                    onCategoryChange={setCategory}
                  />
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
                  <CatalogList
                    items={visibleCatalog}
                    installed={installed}
                    installedVersions={installedVersions}
                    updateChecks={updateChecks}
                    onPick={(item) => item.manifest && openDetail(item)}
                    onRetry={retryCatalogItem}
                    onUpdate={handleInstall}
                    onOpenInstalled={handleOpenInstalled}
                    onRetryInstalled={handleRetryInstalled}
                    busy={busy}
                    installedUnavailable={!!installedLoadError}
                    busyItemId={busyItemId}
                    busyActionKind={busyActionKind}
                    errors={cardErrors}
                    updateNotice={updateNotice}
                    onReviewUpdate={handleReviewUpdate}
                    onDismissNotice={handleDismissNotice}
                    token={token}
                    emptyTitle="No matches"
                    emptyText="Try a different search or filter."
                    setupCompletions={setupCompletions}
                    systemSetupReady={systemSetupReady}
                  />
                </>}
          </>
        )}
        {tab === 'url' && (
          <FromUrlTab onPreview={openDetail} token={token} />
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

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
