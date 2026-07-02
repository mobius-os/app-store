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
