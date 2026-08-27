/* StoreImage renders accepted listing artwork from local or remote app packages. */
import { useEffect, useState } from 'react'
import { proxyUrl } from '../api.js'

const remoteImages = new Map()

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
  if (item?.local_asset_base) return `${item.local_asset_base}${logicalPath}`
  return item?.raw_base ? `${item.raw_base}${source}` : ''
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
