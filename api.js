import { validateManifestUrl } from './domain.js'

export const SETUP_COMPLETIONS_KEY = 'mobius:setup-complete:v1'
export const SYSTEM_SETUP_READY_KEY = 'mobius:system-setup-ready:v1'

function communityHeaders(token, idempotencyKey = '') {
  return {
    Authorization: `Bearer ${token}`,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  }
}

function communityRequestKey(action) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `store:${action}:${random}`.slice(0, 127)
}

async function communityResponse(response, fallback) {
  if (response.ok) return response.status === 204 ? {} : response.json()
  const detail = await readErrorDetail(response, fallback)
  throw new Error(detail)
}

export async function loadCommunityIdentity(token) {
  const response = await fetch('/api/community/identity', {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Community identity could not be loaded.')
}

// App Store inherits the platform-owned GitHub connection through the same
// read-only capability used by Contribute. The stored credential never enters
// the iframe; this endpoint returns only GitHub's public user profile.
export async function loadLocalGithubIdentity(token) {
  const response = await fetch('/api/community/github-status', {
    headers: communityHeaders(token),
  })
  if (!response.ok) {
    const detail = await readErrorDetail(response, 'GitHub connection could not be checked.')
    throw new Error(detail)
  }
  const profile = await response.json()
  return {
    connected: profile?.connected === true && !!profile?.login,
    login: String(profile?.login || ''),
  }
}

export async function loadCommunityApps(token, { query = '', limit = 50, offset = 0, signal } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) })
  const response = await fetch(`/api/community/apps?${params}`, {
    signal,
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Community apps could not be loaded.')
}

export async function loadCommunityApp(token, appId) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}`, {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'This app could not be refreshed.')
}

export async function loadCommunityReviews(token, appId) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}/reviews`, {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Ratings and reviews could not be loaded.')
}

export async function loadEditorialSpotlight(token) {
  const response = await fetch('/api/community/editorial/spotlight', {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Spotlight could not be refreshed.')
}

function fileDataBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That image could not be read.'))
    reader.onload = () => {
      const encoded = String(reader.result || '').split(',', 2)[1]
      if (!encoded) reject(new Error('That image is empty.'))
      else resolve(encoded)
    }
    reader.readAsDataURL(file)
  })
}

export async function uploadEditorialArtwork(token, file) {
  if (!file || file.size <= 0) throw new Error('Choose an artwork image.')
  if (file.size > 1_350_000) throw new Error('Artwork must be 1.35 MB or smaller.')
  const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
  if (!supported.has(file.type)) throw new Error('Use PNG, JPEG, WebP, or AVIF artwork.')
  const response = await fetch('/api/community/editorial/assets', {
    method: 'POST',
    headers: {
      ...communityHeaders(token, communityRequestKey('editorial-artwork')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mime_type: file.type,
      data_base64: await fileDataBase64(file),
    }),
  })
  return communityResponse(response, 'Spotlight artwork could not be uploaded.')
}

export async function publishEditorialSpotlight(token, items) {
  const response = await fetch('/api/community/editorial/spotlight', {
    method: 'PUT',
    headers: {
      ...communityHeaders(token, communityRequestKey('editorial-feed')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  })
  return communityResponse(response, 'Spotlight could not be published.')
}

export async function loadCommunityPublications(token, { limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const response = await fetch(`/api/community/publications?${params}`, {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Publication status could not be loaded.')
}

export async function loadLocalPublicationPreview(token, appId) {
  const params = new URLSearchParams({ app_id: String(appId) })
  const response = await fetch(`/api/community/publications/github/preview?${params}`, {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'This app listing could not be prepared.')
}

export async function saveLocalListing(token, appId, listing) {
  const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/store-listing`, {
    method: 'PUT',
    headers: { ...communityHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(listing),
  })
  return communityResponse(response, 'The listing could not be saved.')
}

const LISTING_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const LISTING_IMAGE_MAX_SIDE = 2400
const LISTING_IMAGE_KEEP_BYTES = 1_500_000

// Read one chosen listing image as base64, shrinking a large photo or phone
// screenshot so a full listing stays a small upload. Small PNGs are sent
// untouched so interface screenshots stay pixel-exact.
export async function prepareListingImage(file) {
  if (!file || file.size <= 0) throw new Error('That image is empty.')
  if (!LISTING_IMAGE_TYPES.has(file.type)) throw new Error('Use a PNG, JPEG, or WebP image.')
  let bitmap = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That image could not be read.')
  }
  const longest = Math.max(bitmap.width, bitmap.height)
  if (file.size <= LISTING_IMAGE_KEEP_BYTES && longest <= LISTING_IMAGE_MAX_SIDE) {
    bitmap.close?.()
    return { data: await fileDataBase64(file), url: URL.createObjectURL(file) }
  }
  const scale = Math.min(1, LISTING_IMAGE_MAX_SIDE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('That image could not be prepared.')
  return { data: await fileDataBase64(blob), url: URL.createObjectURL(blob) }
}

export async function registerCommunityRevision(
  token,
  { repository, commitSha, publicIdentity = 'github' },
) {
  const response = await fetch('/api/community/apps', {
    method: 'POST',
    headers: {
      ...communityHeaders(token, communityRequestKey('register')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repository,
      commit_sha: commitSha,
      public_identity: publicIdentity,
    }),
  })
  return communityResponse(response, 'This GitHub release could not be listed.')
}

export async function publishLocalAppToGithub(token, appId, repositoryName) {
  const response = await fetch('/api/community/publications/github', {
    method: 'POST',
    headers: {
      ...communityHeaders(token, communityRequestKey('publish-local')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: appId,
      repository_name: repositoryName,
      confirm_source_public: true,
      public_identity: 'github',
    }),
  })
  return communityResponse(response, 'This local app could not be published.')
}

export async function saveCommunityReview(token, appId, stars, reviewText = null) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}/review`, {
    method: 'PUT',
    headers: {
      ...communityHeaders(token, communityRequestKey('review')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stars, review_text: reviewText }),
  })
  return communityResponse(response, 'Your rating or review could not be saved.')
}

export async function withdrawCommunityApp(token, appId) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}/withdraw`, {
    method: 'POST',
    headers: communityHeaders(token, communityRequestKey('withdraw')),
  })
  return communityResponse(response, 'This app could not be withdrawn.')
}

export async function recordCommunityInstall(token, appId, revisionId, localAppId) {
  const response = await fetch(
    `/api/community/apps/${encodeURIComponent(appId)}/revisions/${encodeURIComponent(revisionId)}/installs`,
    {
      method: 'POST',
      headers: {
        ...communityHeaders(token, communityRequestKey('install')),
        'Content-Type': 'application/json',
      },
      // The owner may open the newly installed app before Store's iframe settles.
      keepalive: true,
      body: JSON.stringify({ local_app_id: localAppId }),
    },
  )
  return communityResponse(response, 'This exact release could not be preserved.')
}

export async function confirmCommunityInstallReceipt(token, appId, revisionId, localAppId) {
  await recordCommunityInstall(token, appId, revisionId, localAppId)
  return loadCommunityApp(token, appId)
}

export function openInstalledApp(id, { intent, onUnembedded } = {}) {
  if (window.parent === window) {
    if (onUnembedded) onUnembedded()
    return
  }
  const msg = { type: 'moebius:open-app', appId: id }
  if (typeof intent === 'string' && intent) msg.intent = intent
  window.parent.postMessage(
    msg,
    window.location.origin,
  )
}

export function readSetupCompletions() {
  if (typeof window === 'undefined' || !window.localStorage) return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETUP_COMPLETIONS_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function hasConnectedProvider(status) {
  if (!status || typeof status !== 'object') return false
  return Object.values(status).some((value) => value && value.configured)
}

export function readSystemSetupReady() {
  if (typeof window === 'undefined' || !window.localStorage) return false
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SYSTEM_SETUP_READY_KEY) || 'null')
    return !!(parsed && typeof parsed === 'object' && parsed.completedAt)
  } catch {
    return false
  }
}

export function openSystemSettings(section = 'ai-providers', onUnembedded) {
  if (window.parent === window) {
    if (onUnembedded) onUnembedded()
    return
  }
  window.parent.postMessage(
    { type: 'moebius:open-settings', section },
    window.location.origin,
  )
}

// GET /api/apps/ returns the full app list. Catalog matching happens by
// canonical manifest identity in domain.js; this helper keeps the existing
// state intact on transient failures by throwing instead of returning [].
export async function loadInstalledApps(token, opts = {}) {
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 250
  const deadline = requestDeadline(opts)
  let lastError = null

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      let r
      try {
        r = await fetch('/api/apps/', {
          signal: deadline.signal,
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        lastError = err
        if (!deadline.signal.aborted && attempt < retries && retryableFetchError(err)) {
          if (!await deadline.wait(retryDelay(null, attempt, delayMs))) break
          continue
        }
        throw new Error(transientFetchMessage('Installed apps'))
      }

      if (r.ok) return await r.json()
      if (!deadline.signal.aborted && attempt < retries && retryableFetchStatus(r.status)) {
        if (!await deadline.wait(retryDelay(r, attempt, delayMs))) break
        continue
      }
      throw new Error(`Installed apps could not be loaded (${r.status}).`)
    }
  } finally {
    deadline.dispose()
  }

  throw new Error(lastError?.message || 'Installed apps could not be loaded.')
}

// GET /api/apps/{id}/update-check — the backend's git-native "does the app
// repo's actual content differ from the recorded upstream?" probe. It is
// authoritative over the client-side semver compare precisely because it
// catches a release that shipped new content without bumping mobius.json's
// version. Returns source-provenance facts or null:
//   available true/false — the authoritative content comparison
//   pendingUpdateState  — none, needs_resolution, replay_pending, or unknown
//   null                — UNKNOWN: the app has no repo or the fetch failed. The
//                         caller keeps it usable and never guesses from version.
// NEVER throws and NEVER retries: it runs from focus/visibility listeners whose
// callers have no rejection handler, so a read-only availability probe must
// degrade to null rather than let a rejection escape and strand the grid.
export async function fetchUpdateCheck(appId, token, candidateManifestUrl = '', opts = {}) {
  const deadline = requestDeadline(opts)
  try {
    const query = candidateManifestUrl
      ? `?manifest_url=${encodeURIComponent(validateManifestUrl(candidateManifestUrl))}`
      : ''
    const r = await fetch(`/api/apps/${appId}/update-check${query}`, {
      signal: deadline.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    const body = await r.json()
    return {
      available: typeof body?.update_available === 'boolean'
        ? body.update_available
        : null,
      pendingUpdateState: body.pending_update_state,
      upstreamVersion: body?.upstream_version || null,
      installedSourceRevision: body?.installed_source_revision || null,
      candidateSourceDigest: body?.candidate_source_digest || null,
      checkedAt: body?.checked_at || null,
    }
  } catch {
    return null
  } finally {
    deadline.dispose()
  }
}

export async function loadProviderStatus(token, opts = {}) {
  const retries = opts.retries ?? 1
  const delayMs = opts.retryDelayMs ?? 250
  const deadline = requestDeadline(opts)
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await fetch('/api/auth/providers/status', {
          signal: deadline.signal,
          headers: { Authorization: `Bearer ${token}` },
        })
        if (r.ok) return await r.json()
        if (!retryableFetchStatus(r.status) || attempt === retries) return null
      } catch (err) {
        if (deadline.signal.aborted || !retryableFetchError(err) || attempt === retries) return null
      }
      if (!await deadline.wait(retryDelay(null, attempt, delayMs))) return null
    }
    return null
  } finally {
    deadline.dispose()
  }
}

// External resources (catalog manifests + icons) live on public git hosts
// (raw.githubusercontent.com etc). Prod's CSP is connect-src 'self' /
// img-src 'self' data:, so a direct fetch() or <img src="https://…"> to
// those hosts is BLOCKED. Everything external goes through the same-origin
// server proxy instead, which is authenticated (Bearer) and same-origin
// (so it clears the connect-src 'self' rule). The proxy streams the raw
// upstream body back with the upstream status + content-type, so callers
// treat the response exactly like a direct fetch.
export function proxyUrl(extUrl) {
  return `/api/proxy?url=${encodeURIComponent(extUrl)}`
}

function retryableFetchStatus(status) {
  return status === 408 || (status >= 500 && status < 600)
}

function retryableFetchError(error) {
  if (!error) return false
  if (error.name === 'AbortError') return true
  const msg = String(error.message || error)
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)
}

function retryDelay(_res, attempt, fallbackMs) {
  return fallbackMs * (attempt + 1)
}

function rateLimitMessage(url, res) {
  let host = 'upstream'
  try { host = new URL(url).hostname } catch {}
  const service = host.includes('github') ? 'GitHub' : host
  const retryAfter = Number(res.headers?.get?.('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    const seconds = Math.ceil(retryAfter)
    return `${service} rate-limited this request. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
  }
  return `${service} rate-limited this request. Please wait a minute and try again.`
}

// One deadline owns the whole logical read, including every retry and retry
// delay. A fresh timeout per attempt turns three retries into a much longer
// wait than the caller asked for.
function requestDeadline(opts = {}, fallbackMs = 8_000) {
  const controller = new AbortController()
  const parentSignal = opts.signal
  const deadlineMs = Math.max(1, Number(opts.deadlineMs ?? fallbackMs) || fallbackMs)
  const abortFromParent = () => controller.abort(parentSignal?.reason)
  if (parentSignal?.aborted) abortFromParent()
  else parentSignal?.addEventListener?.('abort', abortFromParent, { once: true })
  const timer = setTimeout(() => controller.abort(), deadlineMs)

  return {
    signal: controller.signal,
    async wait(ms) {
      if (controller.signal.aborted) return false
      return await new Promise(resolve => {
        let settled = false
        const finish = value => {
          if (settled) return
          settled = true
          clearTimeout(waitTimer)
          controller.signal.removeEventListener('abort', onAbort)
          resolve(value)
        }
        const onAbort = () => finish(false)
        const waitTimer = setTimeout(() => finish(true), Math.max(0, ms))
        controller.signal.addEventListener('abort', onAbort, { once: true })
      })
    },
    dispose() {
      clearTimeout(timer)
      parentSignal?.removeEventListener?.('abort', abortFromParent)
    },
  }
}

function transientFetchMessage(kind) {
  return `${kind} could not be reached. Check the connection and try again.`
}

export async function fetchManifest(url, token, opts = {}) {
  const manifestUrl = validateManifestUrl(url)
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 350
  const deadline = requestDeadline(opts)
  let lastError = null
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      let r
      try {
        r = await fetch(proxyUrl(manifestUrl), {
          cache: 'no-cache',
          signal: deadline.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      } catch (error) {
        lastError = new Error(transientFetchMessage('Manifest'))
        if (deadline.signal.aborted || !retryableFetchError(error) || attempt === retries) break
        if (!await deadline.wait(retryDelay(null, attempt, delayMs))) break
        continue
      }
      if (r.ok) return await r.json()

      if (r.status === 429) {
        lastError = new Error(rateLimitMessage(manifestUrl, r))
        break
      }

      lastError = new Error(`Manifest fetch failed: ${r.status}`)
      if (!retryableFetchStatus(r.status) || attempt === retries) break
      if (!await deadline.wait(retryDelay(r, attempt, delayMs))) break
    }
  } finally {
    deadline.dispose()
  }

  throw lastError || new Error('Manifest fetch failed')
}

// Fetch the web registry (catalog.json) via the proxy and return a validated
// list of catalog entries, or throw. Schema 1 is the only supported contract;
// each entry must carry a string id and https
// manifest_url + raw_base; malformed entries are dropped rather than trusted.
// Top-level `name`/`description`/`summary` (sanitized) pass through as
// discovery copy. `collection` gives curated catalogs a stable browse shelf;
// callers derive a shelf from categories when it is absent.
// Release manifests never belong in the live registry. The caller merges these
// discovery fields over the checked-in CATALOG, preserving its generated
// snapshot for known apps and fetching only genuinely new entries.
export async function fetchCatalog(url, token, opts = {}) {
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 350
  const deadline = requestDeadline(opts)
  let r
  let body
  let lastError = null
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        r = await fetch(proxyUrl(url), {
          cache: 'no-cache',
          signal: deadline.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      } catch (error) {
        lastError = new Error(transientFetchMessage('Catalog'))
        if (deadline.signal.aborted || !retryableFetchError(error) || attempt === retries) break
        if (!await deadline.wait(retryDelay(null, attempt, delayMs))) break
        continue
      }
      if (r.ok || !retryableFetchStatus(r.status) || attempt === retries) break
      lastError = new Error(`Catalog fetch failed: ${r.status}`)
      if (!await deadline.wait(retryDelay(r, attempt, delayMs))) break
    }
    if (!r) throw lastError || new Error('Catalog fetch failed')
    if (!r.ok) throw new Error(`Catalog fetch failed: ${r.status}`)
    try {
      body = await r.json()
    } catch (error) {
      if (deadline.signal.aborted) throw new Error(transientFetchMessage('Catalog'))
      throw error
    }
  } finally {
    deadline.dispose()
  }
  if (body?.schema !== 1 || !Array.isArray(body.apps)) {
    throw new Error('Catalog schema is unsupported')
  }
  const raw = body.apps
  const httpsStr = (v) => typeof v === 'string' && /^https:\/\//.test(v)
  const sameHost = (a, b) => { try { return new URL(a).host === new URL(b).host } catch { return false } }
  const cleanList = (list, limit = 8) => {
    if (!Array.isArray(list)) return []
    const seen = new Set()
    const out = []
    for (const raw of list) {
      if (typeof raw !== 'string') continue
      const value = raw.trim().replace(/\s+/g, ' ').slice(0, 48)
      const key = value.toLowerCase()
      if (!value || seen.has(key)) continue
      seen.add(key)
      out.push(value)
      if (out.length >= limit) break
    }
    return out
  }
  const cleanString = (value, max = 140) => {
    if (typeof value !== 'string') return undefined
    const out = value.trim().replace(/\s+/g, ' ').slice(0, max)
    return out || undefined
  }
  const normalizeSetup = (setup) => {
    if (!setup || typeof setup !== 'object' || Array.isArray(setup)) return null
    const scope = ['system', 'app', 'none'].includes(setup.scope) ? setup.scope : 'app'
    const rawSection = cleanString(setup.section, 32)
    const section = ['ai-providers', 'background-agents', 'image-generation', 'models'].includes(rawSection)
      ? rawSection
      : (scope === 'system' ? 'background-agents' : '')
    const fields = cleanList(setup.fields, 6)
    return {
      required: setup.required === true,
      scope,
      section,
      label: cleanString(setup.label, 48) || (scope === 'system' ? 'System setup' : 'Setup'),
      description: cleanString(setup.description, 220) || '',
      action: cleanString(setup.action, 48) || (scope === 'system' ? 'Open Settings' : 'Open app'),
      fields,
    }
  }
  const cleanAsset = (value) => typeof value === 'string'
    && /^[a-z0-9][a-z0-9._-]*\.(?:png|webp|jpe?g)$/i.test(value.trim())
    ? value.trim()
    : undefined
  const normalizeListing = (listing) => {
    if (!listing || typeof listing !== 'object' || Array.isArray(listing)) return null
    const hero = cleanAsset(typeof listing.hero === 'string' ? listing.hero : listing.hero?.path)
    const screenshots = []
    if (Array.isArray(listing.screenshots)) {
      for (const rawShot of listing.screenshots.slice(0, 6)) {
        const src = cleanAsset(typeof rawShot === 'string' ? rawShot : rawShot?.src)
        if (!src) continue
        screenshots.push({
          src,
          alt: cleanString(rawShot?.alt, 140) || '',
          label: cleanString(rawShot?.label, 72) || '',
        })
      }
    }
    const tagline = cleanString(listing.tagline, 96)
    const description = cleanString(listing.description, 480)
    if (!hero && screenshots.length === 0 && !tagline && !description) return null
    return {
      ...(hero ? { hero } : {}),
      ...(screenshots.length ? { screenshots } : {}),
      ...(tagline ? { tagline } : {}),
      ...(description ? { description } : {}),
      featured: listing.featured === true,
    }
  }
  const seen = new Set()
  const entries = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    if (typeof e.id !== 'string' || !e.id) continue
    if (!httpsStr(e.manifest_url) || !httpsStr(e.raw_base)) continue
    // raw_base MUST share the manifest's host. The manifest is what the user
    // reviews and trusts on install, so the source + icon files it pulls must
    // come from the SAME origin — otherwise a registry could show a benign,
    // trusted-host manifest while sourcing code from an attacker origin.
    if (!sameHost(e.manifest_url, e.raw_base)) continue
    // First id wins; drop later duplicates so card / update / version state
    // can't collide on a repeated React key.
    if (seen.has(e.id)) continue
    seen.add(e.id)
    const audience = e.audience === 'developer' || e.audience === 'general'
      ? e.audience
      : null
    const collection = [
      'productivity', 'everyday', 'create', 'explore', 'play', 'developer',
    ].includes(e.collection) ? e.collection : null
    const summary = cleanString(e.summary, 96)
    const preview = typeof e.preview === 'string' && /^[a-z0-9][a-z0-9._-]*\.png$/i.test(e.preview)
      ? e.preview
      : undefined
    const listing = normalizeListing(e.listing)
    entries.push({
      id: e.id,
      name: cleanString(e.name),
      description: cleanString(e.description),
      ...(summary ? { summary } : {}),
      ...(preview ? { preview } : {}),
      ...(listing ? { listing } : {}),
      repo: typeof e.repo === 'string' ? e.repo : undefined,
      manifest_url: e.manifest_url,
      raw_base: e.raw_base,
      ...(audience ? { audience } : {}),
      ...(collection ? { collection } : {}),
      categories: cleanList(e.categories, 6),
      keywords: cleanList(e.keywords, 16),
      capabilities: cleanList(e.capabilities, 12),
      setup: normalizeSetup(e.setup),
    })
  }
  return entries
}

function installRequestBody({ manifest_url, manifest, raw_base, reviewed_capability_digest, reviewed_source_digest, update_app_id, reviewed_upstream_commit }) {
  const body = {}
  if (manifest_url) {
    body.manifest_url = manifest_url
  } else {
    if (manifest) body.manifest = manifest
    if (raw_base) body.raw_base = raw_base
  }
  if (reviewed_capability_digest) {
    body.reviewed_capability_digest = reviewed_capability_digest
  }
  if (reviewed_source_digest) {
    body.reviewed_source_digest = reviewed_source_digest
  }
  // An update installs exactly the commit its review showed, already fetched
  // on the instance, instead of fetching the branch again.
  if (update_app_id && reviewed_upstream_commit) {
    body.update_app_id = update_app_id
    body.reviewed_upstream_commit = reviewed_upstream_commit
  }
  return body
}

export async function previewApp({ manifest_url, manifest, raw_base, token }) {
  const res = await fetch('/api/apps/preview', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(installRequestBody({ manifest_url, manifest, raw_base })),
  })
  return await readJsonOrThrow(res, 'Capability preview failed')
}

export class CapabilityChangedError extends Error {
  constructor(detail) {
    super(detail?.message || 'The app capabilities changed. Review them and try again.')
    this.name = 'CapabilityChangedError'
    this.code = 'capability_changed'
    this.preview = {
      manifest: detail?.manifest,
      capability_contract: detail?.capability_contract,
      capability_digest: detail?.capability_digest,
      installed_contract: null,
      capability_diff: { unknown_previous: true, added: [], removed: [], changed: [] },
    }
  }
}

export class UpdateChangedError extends Error {
  constructor(detail = {}) {
    super(detail.message || 'The app source changed after review.')
    this.name = 'UpdateChangedError'
    this.code = 'update_changed'
  }
}

export async function installApp({ manifest_url, manifest, raw_base, token, reviewed_capability_digest, reviewed_source_digest, update_app_id, reviewed_upstream_commit }) {
  const body = installRequestBody({
    manifest_url, manifest, raw_base, reviewed_capability_digest,
    reviewed_source_digest, update_app_id, reviewed_upstream_commit,
  })
  const res = await fetch('/api/apps/install', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch {}
    const detail = parsed?.detail ?? parsed
    if (res.status === 409 && detail?.code === 'capability_changed') {
      throw new CapabilityChangedError(detail)
    }
    if (res.status === 409 && detail?.code === 'update_changed') {
      throw new UpdateChangedError(detail)
    }
    throw new Error(formatErrorDetail(detail) || text || `HTTP ${res.status}`)
  }
  const out = await res.json()
  return {
    id: out.id,
    slug: out.slug,
    name: out.name,
    version: out.version,
    mode: out.mode,
    divergence: out.divergence,
    conflict_paths: out.conflict_paths || [],
    warnings: out.warnings || [],
    updated_at: out.updated_at,
  }
}

function formatErrorDetail(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((entry) => {
      if (typeof entry === 'string') return entry
      const location = Array.isArray(entry?.loc) ? entry.loc.join('.') : ''
      const message = typeof entry?.msg === 'string' ? entry.msg : ''
      return [location, message].filter(Boolean).join(': ')
    }).filter(Boolean)
    if (messages.length) return messages.join('; ')
  }
  if (detail && typeof detail === 'object') {
    // Structured errors ({code, message}) carry their owner-facing sentence.
    if (typeof detail.message === 'string' && detail.message.trim()) {
      return detail.message.trim()
    }
    try { return JSON.stringify(detail) } catch {}
  }
  return ''
}

/** Read a failed response body exactly once, then decode JSON when possible. */
export async function readErrorDetail(res, fallback) {
  const text = await res.text()
  if (!text) return fallback || `HTTP ${res.status}`
  try {
    const body = JSON.parse(text)
    return formatErrorDetail(body?.detail ?? body) || fallback || `HTTP ${res.status}`
  } catch {
    return text
  }
}

export async function readJsonOrThrow(res, fallback) {
  if (res.ok) return await res.json()
  throw new Error(await readErrorDetail(res, fallback || `HTTP ${res.status}`))
}

// Read-only preview of the currently published candidate. This fetches the
// incoming release before anything is applied.
export async function loadUpdateCandidatePreview(appId, manifestUrl, token, opts = {}) {
  const query = manifestUrl
    ? `?manifest_url=${encodeURIComponent(manifestUrl)}`
    : ''
  const deadline = requestDeadline(opts, 12_000)
  try {
    const res = await fetch(`/api/apps/${appId}/update-candidate-preview${query}`, {
      signal: deadline.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
    return await readJsonOrThrow(res, 'Update changes could not be loaded')
  } catch (error) {
    if (opts.signal?.aborted) {
      throw new DOMException('Update check cancelled', 'AbortError')
    }
    if (deadline.signal.aborted) {
      throw new Error('This update check took too long. Please try again.')
    }
    throw error
  } finally {
    deadline.dispose()
  }
}

export async function createConflictResolverChat(appId, resolutionPolicy, token) {
  const res = await fetch(`/api/apps/${appId}/conflict-resolver-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resolution_policy: resolutionPolicy }),
  })
  return await readJsonOrThrow(res, 'Could not open resolver chat')
}

// Batch escalation has one owner-visible chat for the selected apps. The
// backend owns deduplication and the actual resolver turn; Store only supplies
// app ids and the explicit whole-tree policy.
export async function createConflictResolverBatch(appIds, resolutionPolicy, token) {
  const res = await fetch('/api/apps/conflict-resolver-batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ app_ids: appIds, resolution_policy: resolutionPolicy }),
  })
  return await readJsonOrThrow(res, 'Could not open resolver chat')
}

export async function createAppChat(title, token, { ownerVisible = false } = {}) {
  const res = await fetch('/api/app-chats', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, owner_visible: ownerVisible }),
  })
  return await readJsonOrThrow(res, 'Could not create review chat')
}

export async function seedChatMessage(chatId, content, token) {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    await readJsonOrThrow(res, 'Could not seed chat message')
  }
}

export function openChat(chatId) {
  window.parent.postMessage(
    { type: 'moebius:open-chat', chatId },
    window.location.origin,
  )
}
