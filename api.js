import { validateManifestUrl } from './domain.js'

export function openInstalledApp(id, onUnembedded) {
  if (window.parent === window) {
    if (onUnembedded) onUnembedded()
    return
  }
  window.parent.postMessage(
    { type: 'moebius:open-app', appId: id },
    window.location.origin,
  )
}

// GET /api/apps/ returns the full app list. We use slug + name to
// find which catalog entries are already installed.
export async function loadInstalledApps(token) {
  const r = await fetch('/api/apps/', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return []
  return await r.json()
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

export async function fetchManifest(url, token) {
  const manifestUrl = validateManifestUrl(url)
  const r = await fetch(proxyUrl(manifestUrl), {
    cache: 'no-cache',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error(`Manifest fetch failed: ${r.status}`)
  return await r.json()
}

// Fetch the web registry (catalog.json) via the proxy and return a validated
// list of catalog entries, or throw. Accepts either a bare array or a
// `{ apps: [...] }` envelope. Each entry must carry a string id and https
// manifest_url + raw_base; malformed entries are dropped rather than trusted.
// The caller falls back to the baked CATALOG when this throws or yields nothing.
export async function fetchCatalog(url, token) {
  const r = await fetch(proxyUrl(url), {
    cache: 'no-cache',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error(`Catalog fetch failed: ${r.status}`)
  const body = await r.json()
  const raw = Array.isArray(body) ? body : Array.isArray(body?.apps) ? body.apps : null
  if (!raw) throw new Error('Catalog is not a list')
  const httpsStr = (v) => typeof v === 'string' && /^https:\/\//.test(v)
  const sameHost = (a, b) => { try { return new URL(a).host === new URL(b).host } catch { return false } }
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
    // `core` (platform) status is deliberately NOT carried from the registry —
    // it's baked policy, re-applied at the merge site. A registry can never make
    // a platform app installable, nor drop a platform app's protection.
    entries.push({
      id: e.id,
      repo: typeof e.repo === 'string' ? e.repo : undefined,
      manifest_url: e.manifest_url,
      raw_base: e.raw_base,
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
  if (manifest_url) body.manifest_url = manifest_url
  if (manifest) body.manifest = manifest
  if (raw_base) body.raw_base = raw_base
  const res = await fetch('/api/apps/install', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const errBody = await res.json()
      if (errBody && errBody.detail) detail = errBody.detail
    } catch (e) {
      detail = await res.text() || detail
    }
    throw new Error(detail)
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

export async function readJsonOrThrow(res, fallback) {
  if (res.ok) return await res.json()
  let detail = fallback || `HTTP ${res.status}`
  try {
    const errBody = await res.json()
    if (errBody && errBody.detail) detail = errBody.detail
  } catch {
    detail = await res.text() || detail
  }
  throw new Error(detail)
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

export async function createAppChat(title, token) {
  const res = await fetch('/api/app-chats', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
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
