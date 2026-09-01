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

const GITHUB_REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/

// The published revision's exact GitHub tree always carries the listing
// media, so it is the honest fallback when the registry mirror serves only
// the install closure. Pinned to the revision commit, never a moving branch.
function githubRawAssetUrl(item, source) {
  const repository = String(item?.repository || '').trim()
  const commit = String(item?.latest_revision?.commit_sha || '').trim().toLowerCase()
  if (!GITHUB_REPO_RE.test(repository) || !COMMIT_SHA_RE.test(commit)) return ''
  return `https://raw.githubusercontent.com/${repository}/${commit}/${source}`
}

// Ordered candidates for one listing asset: local install (asset route serves
// paths relative to static/), then the registry mirror, then the pinned
// GitHub revision tree.
export function storeAssetUrls(item, logicalPath) {
  const source = storeAssetSource(item?.manifest, logicalPath)
  if (!source) return []
  if (/^https:\/\//i.test(source)) {
    const hosted = hostedEditorialAssetUrl(source)
    return hosted ? [hosted] : []
  }
  const urls = []
  if (item?.local_asset_base) {
    // Two local layouts exist: installed apps materialize declared assets at
    // their full logical path, while an authored app's static/store media is
    // served relative to its static/ root. Try both.
    urls.push(`${item.local_asset_base}${logicalPath}`)
    if (source.startsWith('static/')) {
      urls.push(`${item.local_asset_base}${source.slice('static/'.length)}`)
    }
  }
  if (item?.raw_base) urls.push(`${item.raw_base}${source}`)
  const github = githubRawAssetUrl(item, source)
  if (github) urls.push(github)
  return urls
}

export function storeAssetUrl(item, logicalPath) {
  return storeAssetUrls(item, logicalPath)[0] || ''
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
  const urls = storeAssetUrls(item, path)
  const candidatesKey = urls.join('|')
  const [attempt, setAttempt] = useState(0)
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setAttempt(0)
    setSrc('')
    setFailed(false)
  }, [candidatesKey])

  const url = urls[attempt] || ''
  const external = /^https:\/\//i.test(url)

  useEffect(() => {
    if (!url) { setSrc(''); setFailed(true); return }
    if (!external) { setSrc(url); return }
    let active = true
    let objectUrl = ''
    remoteImage(url, token)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setSrc(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      })
      .catch(() => {
        if (!active) return
        if (attempt + 1 < urls.length) setAttempt((a) => a + 1)
        else setFailed(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // candidatesKey covers urls; attempt selects within them.
  }, [url, external, token, attempt, candidatesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    if (attempt + 1 < urls.length) { setSrc(''); setAttempt((a) => a + 1) }
    else setFailed(true)
  }

  if (!src || failed) return <span className={`${className} st-store-image-placeholder`} aria-hidden="true" />
  return <img src={src} alt={alt} className={className} loading={loading} decoding="async" onError={advance} />
}
