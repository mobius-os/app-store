import { createHash } from 'node:crypto'

const INSTALL_FLOOR_BYTES = 1024 * 1024

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(
      key => `${JSON.stringify(key)}:${stableJson(value[key])}`,
    ).join(',')}}`
  }
  return JSON.stringify(value)
}

function addDigestPart(digest, label, bytes) {
  const labelBytes = Buffer.from(label)
  const labelLength = Buffer.alloc(4)
  labelLength.writeUInt32BE(labelBytes.length)
  const contentLength = Buffer.alloc(8)
  contentLength.writeBigUInt64BE(BigInt(bytes.length))
  digest.update(labelLength)
  digest.update(labelBytes)
  digest.update(contentLength)
  digest.update(bytes)
}

function staticEntries(value) {
  if (Array.isArray(value)) return Object.fromEntries(value.map(path => [path, path]))
  return value && typeof value === 'object' ? value : {}
}

export async function calculatePackageFootprint(manifest, readPackageFile) {
  const cleanManifest = { ...manifest }
  delete cleanManifest.package_footprint

  const fileCache = new Map()
  const read = async path => {
    if (!fileCache.has(path)) {
      fileCache.set(path, Promise.resolve(readPackageFile(path)).then(Buffer.from))
    }
    return await fileCache.get(path)
  }

  const componentSpecs = [
    ['manifest', null, Buffer.from(stableJson(cleanManifest))],
    ['entry', cleanManifest.entry],
  ]
  if (cleanManifest.icon) componentSpecs.push(['icon', cleanManifest.icon])
  const job = cleanManifest.schedule?.job
  if (job) componentSpecs.push(['job', job])
  for (const path of cleanManifest.source_files || []) {
    componentSpecs.push([`source:${path}`, path])
  }
  for (const [destination, path] of Object.entries(staticEntries(cleanManifest.static_assets))) {
    componentSpecs.push([`static:${destination}`, path])
  }
  for (const [destination, value] of Object.entries(cleanManifest.storage_seeds || {})) {
    componentSpecs.push(typeof value === 'string'
      ? [`seed:${destination}`, value]
      : [`seed:${destination}`, null, Buffer.from(stableJson(value))])
  }

  const components = await Promise.all(componentSpecs.map(async ([label, path, inline]) => [
    label,
    inline || await read(path),
  ]))

  const digest = createHash('sha256')
  let payloadBytes = 0
  for (const [label, bytes] of components.sort(([a], [b]) => a.localeCompare(b))) {
    payloadBytes += bytes.length
    addDigestPart(digest, label, bytes)
  }
  return {
    schema: 1,
    version: cleanManifest.version,
    payload_bytes: payloadBytes,
    estimated_install_bytes: Math.max(
      INSTALL_FLOOR_BYTES,
      (payloadBytes + (cleanManifest.icon ? 256 * 1024 : 0)) * 3,
    ),
    content_sha256: digest.digest('hex'),
  }
}
