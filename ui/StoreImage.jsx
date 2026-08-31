/* StoreImage renders accepted listing artwork from local or remote app packages. */
import { useEffect, useState } from 'react'
import { proxyUrl } from '../api.js'

const remoteImages = new Map()
const CATALOG_ASSET_RE = /^[a-z0-9][a-z0-9._-]*\.(?:png|webp|jpe?g)$/i
const EDITORIAL_ASSET_PATH_RE = /^\/v1\/community\/editorial\/assets\/[0-9a-f]{64}\.(?:png|webp|jpe?g|avif)$/

function hostedEditorialAssetUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:'
      && url.hostname === 'www.mobius.you'
      && !url.search
      && !url.hash
      && EDITORIAL_ASSET_PATH_RE.test(url.pathname)
      ? url.toString()
      : ''
  } catch {
    return ''
  }
}

function remoteImage(url, token) {
  if (remoteImages.has(url)) return remoteImages.get(url)
  const request = fetch(proxyUrl(url), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then((response) => {
      if (!response.ok) throw new Error(`listing image ${response.status}`)
      return response.blob()
    })
    .finally(() => {
      if (remoteImages.get(url) === request) remoteImages.delete(url)
    })
  remoteImages.set(url, request)
  return request
}

export function storeAssetSource(manifest, logicalPath) {
  const value = String(logicalPath || '').trim()
  if (!value) return ''
  const mapped = manifest?.static_assets?.[value]
  return typeof mapped === 'string' && mapped ? mapped : value
}

export function storeAssetUrl(item, logicalPath) {
  const source = storeAssetSource(item?.manifest, logicalPath)
  if (!source) return ''
  if (/^https:\/\//i.test(source)) return hostedEditorialAssetUrl(source)
  if (item?.local_asset_base) return `${item.local_asset_base}${logicalPath}`
  return item?.raw_base ? `${item.raw_base}${source}` : ''
}

export function catalogAssetFilename(value) {
  const filename = String(value || '').trim()
  return CATALOG_ASSET_RE.test(filename) ? filename : ''
}

export function catalogAssetUrl(storeAppId, filename) {
  const id = Number(storeAppId)
  const safeFilename = catalogAssetFilename(filename)
  if (!Number.isInteger(id) || id <= 0 || !safeFilename) return ''
  return `/app-assets/by-id/${id}/previews/${encodeURIComponent(safeFilename)}`
}

// Curated official artwork belongs to the App Store package rather than the
// app it depicts. Keeping this route separate from StoreImage means community
// artwork remains bound to the exact app revision the owner reviews.
export function CatalogStoreImage({ storeAppId, path, alt = '', className = '', loading = 'lazy' }) {
  const url = catalogAssetUrl(storeAppId, path)
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [url])

  if (!url || failed) return <span className={`${className} st-store-image-placeholder`} aria-hidden="true" />
  return <img src={url} alt={alt} className={className} loading={loading} decoding="async" onError={() => setFailed(true)} />
}

export function StoreImage({ item, path, token, alt = '', className = '', loading = 'lazy' }) {
  const url = storeAssetUrl(item, path)
  const external = /^https:\/\//i.test(url)
  const [src, setSrc] = useState(() => external ? '' : url)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (!url) { setSrc(''); return }
    if (!external) { setSrc(url); return }
    let active = true
    let objectUrl = ''
    remoteImage(url, token)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setSrc(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      })
      .catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, external, token])

  if (!src || failed) return <span className={`${className} st-store-image-placeholder`} aria-hidden="true" />
  return <img src={src} alt={alt} className={className} loading={loading} decoding="async" onError={() => setFailed(true)} />
}
