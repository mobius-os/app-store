// Release invariant for the App Store's offline-safe first-paint catalog.

export const REQUIRED_SNAPSHOT_FIELDS = [
  'id', 'name', 'version', 'description', 'entry',
]

export function assertCompleteCatalogSnapshots(catalog, snapshots) {
  if (!Array.isArray(catalog?.apps) || catalog.apps.length === 0) {
    throw new Error('catalog.json has no apps')
  }
  if (!snapshots || typeof snapshots !== 'object' || Array.isArray(snapshots)) {
    throw new Error('manifest snapshots must be an object')
  }

  const catalogIds = catalog.apps.map((entry) => String(entry?.id || ''))
  const duplicate = catalogIds.find((id, index) => catalogIds.indexOf(id) !== index)
  if (duplicate) throw new Error(`${duplicate}: duplicate catalog entry`)

  const known = new Set(catalogIds)
  for (const id of Object.keys(snapshots)) {
    if (!known.has(id)) throw new Error(`${id}: snapshot has no catalog entry`)
  }

  for (const entry of catalog.apps) {
    const id = String(entry.id || '')
    const manifest = snapshots[id]
    if (!manifest) throw new Error(`${id || '(missing id)'}: snapshot is missing`)
    if (manifest.id !== id && manifest.previous_id !== id) {
      throw new Error(
        `${id}: snapshot identity is ${String(manifest.id || '(missing)')}`,
      )
    }
    for (const key of REQUIRED_SNAPSHOT_FIELDS) {
      if (typeof manifest[key] !== 'string' || !manifest[key]) {
        throw new Error(`${id}: snapshot is missing ${key}`)
      }
    }
  }
}

// Snapshots are a first-paint floor, not a release record, so they drift
// whenever an app ships. Report each app whose snapshot no longer matches its
// live manifest, naming the top-level fields that differ.
export function catalogSnapshotDrift(current, live) {
  const drift = []
  const ids = new Set([...Object.keys(current || {}), ...Object.keys(live || {})])
  for (const id of [...ids].sort()) {
    const before = current?.[id]
    const after = live?.[id]
    if (!before || !after) {
      drift.push({ id, fields: [before ? 'removed' : 'added'] })
      continue
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const fields = [...keys].sort().filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    if (fields.length) {
      drift.push({ id, fields, from: before.version, to: after.version })
    }
  }
  return drift
}
