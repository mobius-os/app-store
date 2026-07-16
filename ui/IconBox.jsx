import { useEffect, useState } from 'react'
import { proxyUrl } from '../api.js'

// Process-lifetime cache of proxied external icons, keyed by the source
// (raw.githubusercontent) URL. Each entry is the in-flight (or settled)
// fetch promise resolving to a blob: object URL, so a card that mounts,
// unmounts, and re-mounts (store re-open, view switch, the card + the
// open-detail hero both showing the same app) reuses the one fetch instead
// of paying another proxy → GitHub round-trip. The backend /api/proxy route
// emits no Cache-Control and the body is consumed as a blob, so the browser
// can't HTTP-cache it for us — this Map is the only thing that stops the
// ~8-9 not-installed catalog icons re-fetching on every render pass.
//
// The object URL is deliberately NEVER revoked: the cache OWNS it for the
// life of the page, which is what lets it outlive component unmounts. The
// icon set is tiny + bounded by the catalog size, so the leak is negligible
// and bounded; revoking would defeat the cache. Failures are NOT cached
// (the rejected promise is dropped from the Map) so a transient proxy/GitHub
// hiccup retries on the next mount rather than pinning the card to its
// letter fallback forever.
const _iconBlobCache = new Map()

function loadIconBlob(srcUrl, token) {
  const cached = _iconBlobCache.get(srcUrl)
  if (cached) return cached
  const p = fetch(proxyUrl(srcUrl), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(r => {
      if (!r.ok) throw new Error(`icon ${r.status}`)
      return r.blob()
    })
    .then(blob => URL.createObjectURL(blob))
    .catch(err => {
      // Drop the failed promise so the next mount can retry.
      if (_iconBlobCache.get(srcUrl) === p) _iconBlobCache.delete(srcUrl)
      throw err
    })
  _iconBlobCache.set(srcUrl, p)
  return p
}

// Resolve the icon URL for an item, and flag whether it is an external
// (public-git-host) URL or a same-origin one. External icons can't be used
// as a direct <img src> under prod's img-src 'self' data: CSP — they have
// to be fetched through the server proxy and turned into a blob: object URL.
//
// Priority:
//  1. installed_icon_url — a same-origin, browser-cacheable downscaled icon.
//     This can be used as the <img> src on the FIRST render, so a refresh does
//     not briefly paint a letter while React fetches + blobs the remote copy.
//     App updates advance the icon route's ETag, so this remains fresh.
//  2. External catalog preview — raw_base + manifest.icon, fetched via proxy.
//     This remains the discovery path for apps that are not installed yet.
export function appIcon(item) {
  if (item.installed_icon_url) return { url: item.installed_icon_url, external: false }
  if (item.manifest && item.manifest.icon && item.raw_base) {
    return { url: item.raw_base + item.manifest.icon, external: true }
  }
  return { url: null, external: false }
}

export function IconBox({ item, size = 'normal', token }) {
  const { url, external } = appIcon(item)
  const [errored, setErrored] = useState(false)
  // For external icons, the blob: object URL the proxy fetch produced.
  // Same-origin icons render directly from `url`.
  const [blobUrl, setBlobUrl] = useState(null)
  // Letter-fallback variant: needs the surface tile so the letter reads
  // on an opaque background. Real icons sit on transparent.
  const isLetter = !((external ? blobUrl : url) && !errored)
  const wrapClass = size === 'hero'
    ? `st-hero-icon${isLetter ? ' is-letter' : ''}`
    : `st-icon-wrap${isLetter ? ' st-icon-wrap--letter' : ''}`
  const letterClass = size === 'hero' ? 'st-hero-icon-letter' : 'st-icon-letter'
  const name = (item.manifest && item.manifest.name) || item.name || '?'
  const letter = name.charAt(0).toUpperCase()

  // Fetch external icons through the proxy and expose them as a blob: URL,
  // routed through the process-lifetime cache so a remount (store re-open,
  // view switch, card + hero both showing the same app) reuses the one
  // fetch. The cache owns the object URL for the life of the page — this
  // effect must NOT revoke it on cleanup, only stop applying a late result
  // to a stale mount. A cache hit resolves synchronously-fast (already a
  // settled promise) so the icon paints without a second round-trip.
  useEffect(() => {
    if (!url || !external) { setBlobUrl(null); return }
    let cancelled = false
    setErrored(false)
    loadIconBlob(url, token)
      .then(objectUrl => { if (!cancelled) setBlobUrl(objectUrl) })
      .catch(() => { if (!cancelled) setErrored(true) })
    return () => { cancelled = true }
  }, [url, external, token])

  const src = external ? blobUrl : url
  if (src && !errored) {
    // wrapClass must be re-evaluated now that we know we have an image.
    const imgWrapClass = size === 'hero' ? 'st-hero-icon' : 'st-icon-wrap'
    return (
      <div className={imgWrapClass}>
        <img src={src} alt="" className="st-icon-img" loading="lazy" decoding="async"
             onError={() => setErrored(true)} />
      </div>
    )
  }
  const letterWrapClass = size === 'hero' ? 'st-hero-icon is-letter' : 'st-icon-wrap st-icon-wrap--letter'
  return (
    <div className={letterWrapClass}>
      <span className={letterClass}>{letter}</span>
    </div>
  )
}
