import { validateManifestUrl } from './domain.js'

export const SETUP_COMPLETIONS_KEY = 'mobius:setup-complete:v1'
export const SYSTEM_SETUP_READY_KEY = 'mobius:system-setup-ready:v1'

export function openInstalledApp(id, optsOrOnUnembedded, maybeOnUnembedded) {
  const opts = optsOrOnUnembedded && typeof optsOrOnUnembedded === 'object'
    ? optsOrOnUnembedded
    : {}
  const onUnembedded = typeof optsOrOnUnembedded === 'function'
    ? optsOrOnUnembedded
    : maybeOnUnembedded
  if (window.parent === window) {
    if (onUnembedded) onUnembedded()
    return
  }
  const msg = { type: 'moebius:open-app', appId: id }
  if (typeof opts.intent === 'string' && opts.intent) msg.intent = opts.intent
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
  return Object.values(status).some((value) => value && value.authenticated)
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
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    let r
    try {
      r = await fetch('/api/apps/', {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      lastError = err
      if (attempt < retries && retryableFetchError(err)) {
        await sleep(retryDelay(null, attempt, delayMs))
        continue
      }
      throw new Error(transientFetchMessage('Installed apps'))
    }

    if (r.ok) return await r.json()
    if (attempt < retries && retryableFetchStatus(r.status)) {
      await sleep(retryDelay(r, attempt, delayMs))
      continue
    }
    throw new Error(`Installed apps could not be loaded (${r.status}).`)
  }

  throw new Error(lastError?.message || 'Installed apps could not be loaded.')
}

// GET /api/apps/{id}/update-check — the backend's git-native "does the app
// repo's actual content differ from the recorded upstream?" probe. It is
// authoritative over the client-side semver compare precisely because it
// catches a release that shipped new content without bumping mobius.json's
// version. Returns the raw update_available tri-state as bool | null:
//   true  — upstream content changed → an update exists regardless of versions
//   false — git says nothing changed upstream → no update even if strings differ
//   null  — UNKNOWN: an older backend 404s this route, the app has no repo, or
//           the fetch failed. The caller falls back to the semver comparison,
//           i.e. exactly today's behavior. A 404 is treated as null on purpose.
// NEVER throws and NEVER retries: it runs from focus/visibility listeners whose
// callers have no rejection handler, so a read-only availability probe must
// degrade to null rather than let a rejection escape and strand the grid.
export async function fetchUpdateCheck(appId, token) {
  try {
    const r = await fetch(`/api/apps/${appId}/update-check`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    const body = await r.json()
    return typeof body?.update_available === 'boolean' ? body.update_available : null
  } catch {
    return null
  }
}

export async function loadProviderStatus(token, opts = {}) {
  const retries = opts.retries ?? 1
  const delayMs = opts.retryDelayMs ?? 250
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch('/api/auth/providers/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) return await r.json()
      if (!retryableFetchStatus(r.status) || attempt === retries) return null
    } catch (err) {
      if (!retryableFetchError(err) || attempt === retries) return null
    }
    await sleep(retryDelay(null, attempt, delayMs))
  }
  return null
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function transientFetchMessage(kind) {
  return `${kind} could not be reached. Check the connection and try again.`
}

export async function fetchManifest(url, token, opts = {}) {
  const manifestUrl = validateManifestUrl(url)
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 350
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    let r
    try {
      r = await fetch(proxyUrl(manifestUrl), {
        cache: 'no-cache',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch (error) {
      lastError = new Error(transientFetchMessage('Manifest'))
      if (!retryableFetchError(error) || attempt === retries) break
      await sleep(retryDelay(null, attempt, delayMs))
      continue
    }
    if (r.ok) return await r.json()

    if (r.status === 429) {
      lastError = new Error(rateLimitMessage(manifestUrl, r))
      break
    }

    lastError = new Error(`Manifest fetch failed: ${r.status}`)
    if (!retryableFetchStatus(r.status) || attempt === retries) break
    await sleep(retryDelay(r, attempt, delayMs))
  }

  throw lastError || new Error('Manifest fetch failed')
}

// Fetch the web registry (catalog.json) via the proxy and return a validated
// list of catalog entries, or throw. Accepts either a bare array or a
// `{ apps: [...] }` envelope. Each entry must carry a string id and https
// manifest_url + raw_base; malformed entries are dropped rather than trusted.
// Top-level `name`/`description` (sanitized) pass through as pre-hydration
// display hints — the discovery-index catalog shape carries them so a card can
// show a real name before its manifest_url resolves, instead of the bare id.
// A valid embedded `manifest` is preserved as a fast first-paint snapshot. Older
// registries without it still work: callers fall back to fetching manifest_url.
// The caller falls back to the baked CATALOG when this throws or yields nothing.
export async function fetchCatalog(url, token, opts = {}) {
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 350
  let r
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      r = await fetch(proxyUrl(url), {
        cache: 'no-cache',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch (error) {
      lastError = new Error(transientFetchMessage('Catalog'))
      if (!retryableFetchError(error) || attempt === retries) throw lastError
      await sleep(retryDelay(null, attempt, delayMs))
      continue
    }
    if (r.ok || !retryableFetchStatus(r.status) || attempt === retries) break
    lastError = new Error(`Catalog fetch failed: ${r.status}`)
    await sleep(retryDelay(r, attempt, delayMs))
  }
  if (!r) throw lastError || new Error('Catalog fetch failed')
  if (!r.ok) throw new Error(`Catalog fetch failed: ${r.status}`)
  const body = await r.json()
  const raw = Array.isArray(body) ? body : Array.isArray(body?.apps) ? body.apps : null
  if (!raw) throw new Error('Catalog is not a list')
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
  const normalizeManifest = (manifest) => {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null
    for (const key of ['id', 'name', 'version', 'description', 'entry']) {
      if (typeof manifest[key] !== 'string' || !manifest[key]) return null
    }
    return { ...manifest }
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
    entries.push({
      id: e.id,
      name: cleanString(e.name),
      description: cleanString(e.description),
      repo: typeof e.repo === 'string' ? e.repo : undefined,
      manifest_url: e.manifest_url,
      raw_base: e.raw_base,
      categories: cleanList(e.categories, 6),
      keywords: cleanList(e.keywords, 16),
      capabilities: cleanList(e.capabilities, 12),
      setup: normalizeSetup(e.setup),
      manifest: normalizeManifest(e.manifest),
    })
  }
  return entries
}

// Compare two semver strings. Returns -1 / 0 / 1. Bad input → 0.
// Compares the full numeric core (not just 3 segments, so a 4th segment isn't
// dropped) and honors SemVer pre-release precedence: 1.2.0-rc.1 < 1.2.0, so a
// pre-release never reads as "up to date" against its own release.
export async function installApp({ manifest_url, manifest, raw_base, token }) {
  const body = {}
  if (manifest_url) {
    body.manifest_url = manifest_url
  } else {
    if (manifest) body.manifest = manifest
    if (raw_base) body.raw_base = raw_base
  }
  const res = await fetch('/api/apps/install', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await readErrorDetail(res, `HTTP ${res.status}`))
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

export async function loadUpdatePreview(appId, token) {
  const res = await fetch(`/api/apps/${appId}/update-preview`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return await readJsonOrThrow(res, 'Update preview failed')
}

export async function createConflictResolverChat(appId, token) {
  const res = await fetch(`/api/apps/${appId}/conflict-resolver-chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
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
