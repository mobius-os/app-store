// Read the store's own record of which catalog id maps to which
// installed slug + version. Used so we can detect "update available"
// without baking version into description prose.
export function runtimeStorage() {
  return (typeof window !== 'undefined' && window.mobius && window.mobius.storage) || null
}

export function normalizeInstalledVersions(data) {
  if (data == null) return {}
  let parsed = data
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data)
    } catch {
      return {}
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const clean = {}
  for (const [id, version] of Object.entries(parsed)) {
    if (!id || typeof version !== 'string') continue
    clean[id] = version
  }
  return clean
}

export async function loadInstalledVersions(appId, token) {
  const storage = runtimeStorage()
  if (storage?.get) {
    try {
      return normalizeInstalledVersions(await storage.get('installed-versions.json'))
    } catch {
      // Fall through to the raw storage API; older shells or transient
      // IndexedDB failures should not break update detection.
    }
  }

  try {
    const r = await fetch(`/api/storage/apps/${appId}/installed-versions.json`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (r.status === 404) return {}
    if (!r.ok) return {}
    return normalizeInstalledVersions(await r.json())
  } catch {
    return {}
  }
}

export async function saveInstalledVersions(appId, token, map) {
  const clean = normalizeInstalledVersions(map)
  const storage = runtimeStorage()
  if (storage?.set) {
    try {
      await storage.set('installed-versions.json', clean)
      return true
    } catch {
      // Continue to the raw API fallback below.
    }
  }

  try {
    const r = await fetch(`/api/storage/apps/${appId}/installed-versions.json`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clean),
    })
    return r.ok
  } catch {
    return false
  }
}

// Ask the shell to switch to the installed app via the
// `moebius:open-app` postMessage protocol (see Shell.jsx's handler).
// `id` is the numeric DB id from /api/apps/. If we're not embedded in
// the shell (mini-app run standalone), we can't navigate the parent
// shell — surface a hint via the caller's toast.
