import { useEffect, useState } from 'react'
import { proxyUrl } from '../api.js'
import { useNearView } from './nearView.js'

// Process-lifetime cache of proxied external icons, keyed by the source
// (raw.githubusercontent) URL. Each entry is the in-flight (or settled)
// fetch promise resolving to a blob: object URL, so a card that mounts,
// unmounts, and re-mounts (store re-open, view switch, the card + the
// open-detail hero both showing the same app) reuses the one fetch instead
// of paying another proxy → GitHub round-trip. The shell service worker also
// keeps proxy image responses across document reloads; this Map is the faster
// same-document tier that avoids even recreating the object URL.
//
// The object URL is deliberately NEVER revoked: the cache OWNS it for the
// life of the page, which is what lets it outlive component unmounts. The
// icon set is tiny + bounded by the catalog size, so the leak is negligible
// and bounded; revoking would defeat the cache. Failures are NOT cached
// (the rejected promise is dropped from the Map) so a transient proxy/GitHub
// hiccup retries on the next mount rather than pinning the card to its
// letter fallback forever.
const _iconBlobCache = new Map()
const _resolvedIconBlobCache = new Map()

// Icons render at 44-128px, so the proxy is asked for a small copy.
const ICON_WIDTH = 256

function loadIconBlob(srcUrl, token) {
  const cached = _iconBlobCache.get(srcUrl)
  if (cached) return cached
  const p = fetch(proxyUrl(srcUrl, { width: ICON_WIDTH }), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(r => {
      if (!r.ok) throw new Error(`icon ${r.status}`)
      return r.blob()
    })
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob)
      _resolvedIconBlobCache.set(srcUrl, objectUrl)
      return objectUrl
    })
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

// Installed icon URLs are immutable identities, not merely endpoints. The app
// row's updated_at changes whenever an install/update can replace the stored
// icon, so including it in the URL lets the browser keep the bytes indefinitely
// while a changed app naturally requests a new URL.
export function installedIconUrl(app) {
  if (!app?.id) return null
  const version = app.updated_at ? `&v=${encodeURIComponent(app.updated_at)}` : ''
  return `/api/apps/${app.id}/icon?size=128${version}`
}

// Real stores show every icon as the same rounded square. Many Möbius icons
// are cut-out illustrations on a transparent background, so those get a tile
// behind them; full-bleed square icons are shown as they are. The answer is
// read once from the icon's corner pixels and cached per image.
const _cutoutCache = new Map()

function isCutoutIcon(img) {
  try {
    const size = 24
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    const alphaAt = (x, y) => data[(y * size + x) * 4 + 3]
    const probes = [[1, 1], [size - 2, 1], [1, size - 2], [size - 2, size - 2], [size >> 1, 0], [0, size >> 1]]
    return probes.filter(([x, y]) => alphaAt(x, y) < 200).length >= 3
  } catch {
    return false
  }
}

export function IconBox({ item, size = 'normal', token }) {
  const { url, external } = appIcon(item)
  const [errored, setErrored] = useState(false)
  // For external icons, the blob: object URL the proxy fetch produced.
  // Same-origin icons render directly from `url`.
  const [blobUrl, setBlobUrl] = useState(() => (
    external && url ? (_resolvedIconBlobCache.get(url) || null) : null
  ))
  // A remote icon already fetched this session paints at once; otherwise it
  // waits until its spot is about to scroll into view.
  const [viewRef, near] = useNearView(!!(external && url && !blobUrl))
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
    if (!near) return
    let cancelled = false
    setErrored(false)
    loadIconBlob(url, token)
      .then(objectUrl => { if (!cancelled) setBlobUrl(objectUrl) })
      .catch(() => { if (!cancelled) setErrored(true) })
    return () => { cancelled = true }
  }, [url, external, token, near])

  const src = external ? blobUrl : url
  const [cutout, setCutout] = useState(() => (src ? _cutoutCache.get(src) : undefined))
  useEffect(() => { setCutout(src ? _cutoutCache.get(src) : undefined) }, [src])
  if (src && !errored) {
    // wrapClass must be re-evaluated now that we know we have an image.
    const imgWrapClass = `${size === 'hero' ? 'st-hero-icon' : 'st-icon-wrap'}${cutout ? ' is-cutout' : ''}`
    return (
      <div className={imgWrapClass}>
        <img src={src} alt="" className="st-icon-img" loading="lazy" decoding="async"
             onLoad={(event) => {
               // Every copy of an icon reads the shared answer, measured once.
               if (!_cutoutCache.has(src)) _cutoutCache.set(src, isCutoutIcon(event.currentTarget))
               setCutout(_cutoutCache.get(src))
             }}
             onError={() => setErrored(true)} />
      </div>
    )
  }

  // A known icon that is still resolving is not an iconless app. Previously
  // this branch painted the letter first and replaced it a frame later even on
  // a warm cache hit, making the cache visibly useless. Keep the final icon's
  // footprint reserved instead; letters are now only the true no-icon/error
  // fallback.
  if (url && external && !errored) {
    const loadingWrapClass = size === 'hero'
      ? 'st-hero-icon st-icon-loading'
      : 'st-icon-wrap st-icon-loading'
    return <div ref={viewRef} className={loadingWrapClass} aria-hidden="true" />
  }
  const letterWrapClass = size === 'hero' ? 'st-hero-icon is-letter' : 'st-icon-wrap st-icon-wrap--letter'
  return (
    <div className={letterWrapClass}>
      <span className={letterClass}>{letter}</span>
    </div>
  )
}
