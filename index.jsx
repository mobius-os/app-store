import React, { useState, useEffect, useCallback } from 'react'

// Curated catalog. Each entry points at a public mobius-os repo on
// the main branch. The Browse view fetches each manifest URL at
// mount time and merges the parsed JSON into the card data, so the
// catalog always reflects the repo's current name/version/description.
const CATALOG = [
  {
    id: 'news',
    repo: 'mobius-os/app-news',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-news/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-news/main/',
  },
]

const s = {
  root: {
    height: '100%', display: 'flex', flexDirection: 'column',
    background: 'var(--bg)', color: 'var(--text)',
    fontFamily: 'var(--font)', overflow: 'hidden',
  },
  header: {
    padding: '16px 16px 12px', flexShrink: 0,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  titleRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '12px',
  },
  title: {
    fontSize: '22px', fontWeight: 700, margin: 0,
    letterSpacing: '-0.01em',
  },
  tabs: {
    display: 'flex', gap: '4px', background: 'var(--surface)',
    borderRadius: '10px', padding: '3px',
    border: '1px solid var(--border)',
  },
  tab: (active) => ({
    flex: 1, padding: '8px 16px', borderRadius: '8px', border: 'none',
    cursor: 'pointer', fontSize: '13px', fontWeight: 500,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--muted)',
    transition: 'all 0.15s', fontFamily: 'var(--font)',
  }),
  scroll: {
    flex: 1, overflow: 'auto', padding: '16px',
  },
  card: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '8px',
    marginBottom: '10px', cursor: 'pointer',
    transition: 'border-color 0.15s, transform 0.1s',
  },
  iconWrap: {
    width: '48px', height: '48px', borderRadius: '10px',
    background: 'var(--surface2)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  iconImg: { width: '100%', height: '100%', objectFit: 'cover' },
  iconLetter: {
    fontSize: '22px', fontWeight: 700, color: 'var(--accent)',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: {
    fontSize: '15px', fontWeight: 600, marginBottom: '2px',
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  cardVersion: {
    fontSize: '11px', color: 'var(--muted)',
    fontWeight: 400, fontFamily: 'var(--mono, monospace)',
  },
  cardDesc: {
    fontSize: '13px', color: 'var(--muted)', lineHeight: 1.4,
    display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  cardBtn: (variant) => ({
    padding: '8px 16px', borderRadius: '10px',
    border: variant === 'secondary' ? '1px solid var(--border)' : 'none',
    background: variant === 'update' ? 'var(--green)'
              : variant === 'secondary' ? 'transparent'
              : 'var(--accent)',
    color: variant === 'secondary' ? 'var(--text)' : '#fff',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    flexShrink: 0, fontFamily: 'var(--font)',
    transition: 'background 0.15s',
  }),
  updateBadge: {
    display: 'inline-block', padding: '2px 6px',
    borderRadius: '4px', background: 'var(--green)',
    color: '#fff', fontSize: '10px', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  // From URL tab
  urlForm: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '16px',
  },
  urlLabel: {
    fontSize: '13px', fontWeight: 600, marginBottom: '8px',
    display: 'block',
  },
  urlHint: {
    fontSize: '12px', color: 'var(--muted)', marginBottom: '12px',
    lineHeight: 1.5,
  },
  urlInput: {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '13px', fontFamily: 'var(--mono, monospace)',
    outline: 'none', boxSizing: 'border-box',
    marginBottom: '12px',
  },
  primaryBtn: {
    padding: '10px 20px', borderRadius: '10px', border: 'none',
    background: 'var(--accent)', color: '#fff',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
  errorBox: {
    background: 'var(--accent-dim, rgba(255,80,80,0.1))',
    color: 'var(--danger)', padding: '12px',
    borderRadius: '8px', fontSize: '13px',
    marginTop: '12px', lineHeight: 1.5,
  },
  // Detail view
  detailHeader: {
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    gap: '8px', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--accent)',
    fontSize: '15px', cursor: 'pointer', padding: '6px 8px',
    fontFamily: 'var(--font)',
  },
  hero: {
    display: 'flex', alignItems: 'center', gap: '16px',
    marginBottom: '20px',
  },
  heroIcon: {
    width: '72px', height: '72px', borderRadius: '14px',
    background: 'var(--surface2)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  heroIconLetter: {
    fontSize: '32px', fontWeight: 700, color: 'var(--accent)',
  },
  heroName: {
    fontSize: '22px', fontWeight: 700, margin: '0 0 4px',
    letterSpacing: '-0.01em',
  },
  heroMeta: {
    fontSize: '12px', color: 'var(--muted)',
    fontFamily: 'var(--mono, monospace)',
  },
  detailDesc: {
    fontSize: '14px', lineHeight: 1.55, color: 'var(--text)',
    marginBottom: '24px',
  },
  detailSection: { marginBottom: '20px' },
  sectionLabel: {
    fontSize: '11px', fontWeight: 600, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: '8px',
  },
  permissionRow: {
    padding: '10px 12px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '8px',
    marginBottom: '6px', fontSize: '13px', lineHeight: 1.5,
  },
  permLabel: {
    fontWeight: 600, color: 'var(--text)',
  },
  permDetail: { color: 'var(--muted)' },
  scheduleRow: {
    padding: '10px 12px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '13px', lineHeight: 1.5,
  },
  esmWarn: {
    padding: '10px 12px',
    background: 'var(--accent-dim, rgba(139,108,247,0.15))',
    border: '1px solid var(--accent)', borderRadius: '8px',
    fontSize: '13px', lineHeight: 1.5,
  },
  link: {
    color: 'var(--accent)', textDecoration: 'none',
  },
  detailFooter: {
    padding: '16px', borderTop: '1px solid var(--border)',
    display: 'flex', gap: '8px', flexShrink: 0,
    background: 'var(--bg)',
  },
  bigBtn: {
    flex: 1, padding: '12px 16px', borderRadius: '10px',
    border: 'none', background: 'var(--accent)', color: '#fff',
    fontSize: '15px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
  dangerBtn: {
    padding: '12px 16px', borderRadius: '10px',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--danger)', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font)',
  },
  // Modal
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--surface)', borderRadius: '14px 14px 0 0',
    width: '100%', maxWidth: '480px', padding: '20px',
    maxHeight: '85vh', overflowY: 'auto',
    borderTop: '1px solid var(--border)',
  },
  modalTitle: {
    fontSize: '18px', fontWeight: 700, margin: '0 0 12px',
  },
  modalActions: {
    display: 'flex', gap: '8px', marginTop: '20px',
  },
  toast: {
    position: 'fixed', bottom: '16px', left: '16px', right: '16px',
    padding: '14px 16px', background: 'var(--surface)',
    border: '1px solid var(--accent)', borderRadius: '10px',
    fontSize: '13px', lineHeight: 1.5,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', gap: '12px',
    zIndex: 200,
  },
  toastBtn: {
    padding: '6px 12px', borderRadius: '8px', border: 'none',
    background: 'var(--accent)', color: '#fff',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font)', flexShrink: 0,
  },
  empty: {
    textAlign: 'center', padding: '40px 20px',
    color: 'var(--muted)', fontSize: '14px',
  },
  spinner: {
    textAlign: 'center', padding: '40px 20px',
    color: 'var(--muted)', fontSize: '13px',
  },
}

// Human-language explanations for the permission strings.
const PERM_EXPLAIN = {
  cross_app_access: {
    none: 'Cannot touch other apps\' data.',
    read: 'Can read other apps\' stored data.',
    write: 'Can read and write other apps\' stored data.',
  },
  share_with_apps: {
    none: 'Other apps cannot access this app\'s data.',
    read: 'Other apps can read (but not modify) this app\'s data.',
    write: 'Other apps can read and write this app\'s data.',
  },
}

// Turn a cron expression into something readable. Falls back to
// the raw expression for anything non-trivial.
function humanCron(expr) {
  if (!expr || typeof expr !== 'string') return ''
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr
  const [min, hr, dom, mon, dow] = parts
  const hh = String(hr).padStart(2, '0')
  const mm = String(min).padStart(2, '0')
  if (dom === '*' && mon === '*' && dow === '*' && !min.includes('*') && !hr.includes('*')) {
    return `Runs daily at ${hh}:${mm} UTC`
  }
  if (dom === '*' && mon === '*' && dow !== '*' && !min.includes('*') && !hr.includes('*')) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const d = days[parseInt(dow, 10)] || dow
    return `Runs every ${d} at ${hh}:${mm} UTC`
  }
  return `Cron: ${expr}`
}

function appIcon(item) {
  // Catalog cards use raw_base + manifest.icon for the preview.
  // Installed apps surface the in-Möbius icon endpoint.
  if (item.installed_icon_url) return item.installed_icon_url
  if (item.manifest && item.manifest.icon && item.raw_base) {
    return item.raw_base + item.manifest.icon
  }
  return null
}

function IconBox({ item, size = 'normal' }) {
  const url = appIcon(item)
  const [errored, setErrored] = useState(false)
  const wrapStyle = size === 'hero' ? s.heroIcon : s.iconWrap
  const letterStyle = size === 'hero' ? s.heroIconLetter : s.iconLetter
  const name = (item.manifest && item.manifest.name) || item.name || '?'
  const letter = name.charAt(0).toUpperCase()
  if (url && !errored) {
    return (
      <div style={wrapStyle}>
        <img src={url} alt="" style={s.iconImg} onError={() => setErrored(true)} />
      </div>
    )
  }
  return (
    <div style={wrapStyle}>
      <span style={letterStyle}>{letter}</span>
    </div>
  )
}

// Read the store's own record of which catalog id maps to which
// installed slug + version. Used so we can detect "update available"
// without baking version into description prose.
async function loadInstalledVersions(appId, token) {
  try {
    const r = await fetch(`/api/storage/apps/${appId}/installed-versions.json`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (r.status === 404) return {}
    const data = await r.json()
    return typeof data === 'string' ? JSON.parse(data) : (data || {})
  } catch {
    return {}
  }
}

async function saveInstalledVersions(appId, token, map) {
  await fetch(`/api/storage/apps/${appId}/installed-versions.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(map),
  })
}

// GET /api/apps/ returns the full app list. We use slug + name to
// find which catalog entries are already installed.
async function loadInstalledApps(token) {
  const r = await fetch('/api/apps/', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return []
  return await r.json()
}

async function fetchManifest(url) {
  const r = await fetch(url, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`Manifest fetch failed: ${r.status}`)
  return await r.json()
}

// Compare two semver strings. Returns -1 / 0 / 1. Bad input → 0.
function semverCmp(a, b) {
  if (!a || !b) return 0
  const pa = String(a).split('.').map(n => parseInt(n, 10))
  const pb = String(b).split('.').map(n => parseInt(n, 10))
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}

// Pull bytes from a raw URL. Used for icons + entry JSX + seed files.
async function fetchRaw(url) {
  const r = await fetch(url, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${url}`)
  return r
}

// Heart of the install flow. Takes a fully-resolved manifest +
// raw_base and walks the spec'd install lifecycle. Returns the
// new app's {id, slug, name}. Throws on any step that fails so
// the UI can surface the message.
async function installApp({ manifest, raw_base, token, isUpdate, existingId }) {
  // Step 1: fetch entry JSX bytes.
  const entryUrl = raw_base + (manifest.entry || 'index.jsx')
  const entryRes = await fetchRaw(entryUrl)
  const jsxSource = await entryRes.text()

  let appId, slug
  if (isUpdate && existingId) {
    // Update path: PATCH the existing row's jsx_source. Server
    // recompiles + the file watcher picks up the change. We keep
    // permissions on what the manifest currently declares so a
    // permissions bump in the new version actually lands.
    const patchRes = await fetch(`/api/apps/${existingId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: manifest.name,
        description: manifest.description,
        jsx_source: jsxSource,
        cross_app_access: manifest.permissions?.cross_app_access || 'none',
        share_with_apps: manifest.permissions?.share_with_apps || 'none',
      }),
    })
    if (!patchRes.ok) {
      const text = await patchRes.text()
      throw new Error(`PATCH /api/apps/${existingId} failed (${patchRes.status}): ${text}`)
    }
    const out = await patchRes.json()
    appId = out.id
    slug = out.slug
  } else {
    // Fresh install. POST /api/apps/.
    const postRes = await fetch('/api/apps/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: manifest.name,
        description: manifest.description,
        jsx_source: jsxSource,
        cross_app_access: manifest.permissions?.cross_app_access || 'none',
        share_with_apps: manifest.permissions?.share_with_apps || 'none',
      }),
    })
    if (!postRes.ok) {
      const text = await postRes.text()
      throw new Error(`POST /api/apps/ failed (${postRes.status}): ${text}`)
    }
    const out = await postRes.json()
    appId = out.id
    slug = out.slug
  }

  // Step 2: storage seeds. For updates, only PUT keys that don't
  // already exist — we don't want to clobber user data on upgrade.
  if (manifest.storage_seeds && typeof manifest.storage_seeds === 'object') {
    for (const [key, value] of Object.entries(manifest.storage_seeds)) {
      const storageUrl = `/api/storage/apps/${appId}/${key}`
      if (isUpdate) {
        const probe = await fetch(storageUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (probe.ok) continue  // already there, leave user data alone
      }
      try {
        if (typeof value === 'string') {
          // String value = path in repo. Fetch + PUT raw bytes.
          const seedRes = await fetchRaw(raw_base + value)
          const seedText = await seedRes.text()
          await fetch(storageUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'text/plain',
            },
            body: seedText,
          })
        } else {
          // JSON literal — encode + PUT as JSON.
          await fetch(storageUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(value),
          })
        }
      } catch (e) {
        // A seed failure shouldn't abort the whole install — log
        // and continue. The app will fall back to its in-code
        // defaults on first run.
        console.warn(`Seed ${key} failed:`, e)
      }
    }
  }

  // Step 3: icon. Skip on updates unless the manifest icon path
  // changed (we don't track that — keep it simple: install only).
  if (manifest.icon && !isUpdate) {
    try {
      const iconRes = await fetchRaw(raw_base + manifest.icon)
      const blob = await iconRes.blob()
      const fd = new FormData()
      fd.append('icon', blob, manifest.icon.split('/').pop() || 'icon.png')
      await fetch(`/api/apps/${appId}/icon`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
    } catch (e) {
      console.warn('Icon upload failed:', e)
    }
  }

  // Step 4: schedule. We can't actually register cron from inside
  // a mini-app — that needs shell access. We write a marker file
  // so the agent (or a future shell-bridge endpoint) can pick it
  // up and finish the registration.
  if (manifest.schedule && !isUpdate) {
    try {
      await fetch(`/api/storage/apps/${appId}/.cron-pending.json`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule: manifest.schedule,
          slug,
          requested_at: new Date().toISOString(),
          note: 'App Store cannot register cron from inside the sandbox. Ask the agent to run /app/scripts/init-cron-scaffold.sh for this app.',
        }),
      })
    } catch (e) {
      console.warn('Cron marker write failed:', e)
    }
  }

  return { id: appId, slug, name: manifest.name }
}

function ConfirmModal({ manifest, raw_base, onConfirm, onCancel, busy, isUpdate }) {
  const ca = manifest.permissions?.cross_app_access || 'none'
  const sw = manifest.permissions?.share_with_apps || 'none'
  const hasSchedule = !!manifest.schedule
  const esmDeps = manifest.runtime?.esm_deps || []
  return (
    <div style={s.modalBackdrop} onClick={busy ? null : onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <h3 style={s.modalTitle}>
          {isUpdate ? 'Update' : 'Install'} {manifest.name}?
        </h3>
        <div style={{ ...s.heroMeta, marginBottom: '12px' }}>
          v{manifest.version} {manifest.author ? `· by ${manifest.author}` : ''}
        </div>
        <p style={{ fontSize: '13px', lineHeight: 1.55, marginBottom: '16px', color: 'var(--muted)' }}>
          {manifest.description}
        </p>

        <div style={s.sectionLabel}>What this app can do</div>
        <div style={s.permissionRow}>
          <div style={s.permLabel}>Other apps' data</div>
          <div style={s.permDetail}>{PERM_EXPLAIN.cross_app_access[ca]}</div>
        </div>
        <div style={s.permissionRow}>
          <div style={s.permLabel}>Sharing with other apps</div>
          <div style={s.permDetail}>{PERM_EXPLAIN.share_with_apps[sw]}</div>
        </div>

        {hasSchedule && (
          <>
            <div style={{ ...s.sectionLabel, marginTop: '16px' }}>Schedule</div>
            <div style={s.scheduleRow}>
              {humanCron(manifest.schedule.default)}
              {manifest.schedule.user_configurable && (
                <div style={{ ...s.permDetail, marginTop: '4px' }}>
                  You'll be able to change the time from the app's settings.
                </div>
              )}
              <div style={{ ...s.permDetail, marginTop: '6px', fontSize: '11px' }}>
                Note: cron registration is a manual step today. The store
                will record the request; ask the Möbius agent to register it.
              </div>
            </div>
          </>
        )}

        {esmDeps.length > 0 && (
          <>
            <div style={{ ...s.sectionLabel, marginTop: '16px' }}>External libraries</div>
            <div style={s.esmWarn}>
              This app loads code from esm.sh on first run:
              <div style={{ fontFamily: 'var(--mono, monospace)', marginTop: '6px', fontSize: '12px' }}>
                {esmDeps.join(', ')}
              </div>
            </div>
          </>
        )}

        <div style={s.modalActions}>
          <button style={{ ...s.dangerBtn, color: 'var(--text)' }}
                  onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button style={s.bigBtn} onClick={onConfirm} disabled={busy}>
            {busy ? (isUpdate ? 'Updating…' : 'Installing…') : (isUpdate ? 'Update' : 'Install')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CatalogList({ items, installed, installedVersions, onPick }) {
  if (items.length === 0) {
    return <div style={s.empty}>No apps in the catalog yet.</div>
  }
  return (
    <div>
      {items.map(item => {
        if (!item.manifest) {
          return (
            <div key={item.id} style={{ ...s.card, opacity: 0.6 }}>
              <div style={s.iconWrap}>
                <span style={s.iconLetter}>{item.id.charAt(0).toUpperCase()}</span>
              </div>
              <div style={s.cardBody}>
                <div style={s.cardName}>{item.id}</div>
                <div style={s.cardDesc}>
                  {item.error ? `Couldn't fetch manifest: ${item.error}` : 'Loading…'}
                </div>
              </div>
            </div>
          )
        }
        const m = item.manifest
        // Match by manifest.id → app.slug — name can be edited by the user
        // and would silently divorce update detection from the catalog entry.
        const installedApp = installed.find(a => a.slug === m.id)
        const installedVer = installedVersions[item.id]
        const hasUpdate = installedApp && installedVer && semverCmp(installedVer, m.version) < 0
        const isInstalled = !!installedApp
        let btnLabel = 'Install'
        let btnVariant = 'primary'
        if (hasUpdate) { btnLabel = 'Update'; btnVariant = 'update' }
        else if (isInstalled) { btnLabel = 'Open'; btnVariant = 'secondary' }
        return (
          <div key={item.id} style={s.card} onClick={() => onPick(item)}>
            <IconBox item={item} />
            <div style={s.cardBody}>
              <div style={s.cardName}>
                {m.name}
                <span style={s.cardVersion}>v{m.version}</span>
                {hasUpdate && <span style={s.updateBadge}>Update</span>}
              </div>
              <div style={s.cardDesc}>{m.description}</div>
            </div>
            <button
              style={s.cardBtn(btnVariant)}
              onClick={e => { e.stopPropagation(); onPick(item) }}
            >
              {btnLabel}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function FromUrlTab({ onPreview }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handlePreview = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      const manifest = await fetchManifest(trimmed)
      const missing = ['id', 'name', 'version', 'description', 'entry']
        .filter(k => !manifest[k])
      if (missing.length) {
        throw new Error(`Manifest is missing required fields: ${missing.join(', ')}`)
      }
      // Derive raw_base from the manifest URL: strip the trailing
      // filename so storage_seeds + icon + entry resolve relative
      // to the same directory.
      const raw_base = trimmed.replace(/[^/]+$/, '')
      onPreview({ id: manifest.id || 'custom', manifest, raw_base, manifest_url: trimmed })
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.urlForm}>
      <label style={s.urlLabel}>Manifest URL</label>
      <div style={s.urlHint}>
        Paste a public URL to a <code>mobius.json</code> file (typically a
        raw.githubusercontent.com link). The store will fetch the manifest,
        show you what the app declares, and let you install.
      </div>
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://raw.githubusercontent.com/owner/app-foo/main/mobius.json"
        style={s.urlInput}
        onKeyDown={e => e.key === 'Enter' && handlePreview()}
      />
      <button style={s.primaryBtn} onClick={handlePreview} disabled={busy || !url.trim()}>
        {busy ? 'Loading…' : 'Preview'}
      </button>
      {error && <div style={s.errorBox}>{error}</div>}
    </div>
  )
}

function DetailView({ item, installed, installedVersions, onBack, onInstall, onUninstall }) {
  const m = item.manifest
  // Match by manifest.id → app.slug (see comment in BrowseView).
  const installedApp = installed.find(a => a.slug === m.id)
  const installedVer = installedVersions[item.id]
  const hasUpdate = installedApp && installedVer && semverCmp(installedVer, m.version) < 0
  const isInstalled = !!installedApp
  const ca = m.permissions?.cross_app_access || 'none'
  const sw = m.permissions?.share_with_apps || 'none'

  return (
    <>
      <div style={s.detailHeader}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
      </div>
      <div style={s.scroll}>
        <div style={s.hero}>
          <IconBox item={item} size="hero" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={s.heroName}>{m.name}</h2>
            <div style={s.heroMeta}>
              v{m.version}{m.author ? ` · ${m.author}` : ''}{m.license ? ` · ${m.license}` : ''}
            </div>
          </div>
        </div>

        <p style={s.detailDesc}>{m.description}</p>

        <div style={s.detailSection}>
          <div style={s.sectionLabel}>What this app can do</div>
          <div style={s.permissionRow}>
            <div style={s.permLabel}>Other apps' data</div>
            <div style={s.permDetail}>{PERM_EXPLAIN.cross_app_access[ca]}</div>
          </div>
          <div style={s.permissionRow}>
            <div style={s.permLabel}>Sharing with other apps</div>
            <div style={s.permDetail}>{PERM_EXPLAIN.share_with_apps[sw]}</div>
          </div>
        </div>

        {m.schedule && (
          <div style={s.detailSection}>
            <div style={s.sectionLabel}>Schedule</div>
            <div style={s.scheduleRow}>{humanCron(m.schedule.default)}</div>
          </div>
        )}

        {m.runtime?.esm_deps?.length > 0 && (
          <div style={s.detailSection}>
            <div style={s.sectionLabel}>External libraries</div>
            <div style={s.esmWarn}>
              Loads from esm.sh on first run: {m.runtime.esm_deps.join(', ')}
            </div>
          </div>
        )}

        {m.homepage && (
          <div style={s.detailSection}>
            <div style={s.sectionLabel}>Source</div>
            <a href={m.homepage} target="_blank" rel="noopener noreferrer" style={s.link}>
              {m.homepage}
            </a>
          </div>
        )}

        {isInstalled && (
          <div style={s.detailSection}>
            <div style={s.sectionLabel}>Installed</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Currently installed: v{installedVer || 'unknown'}.
              Open this app from the Möbius drawer.
            </div>
          </div>
        )}
      </div>

      <div style={s.detailFooter}>
        {isInstalled && !hasUpdate && (
          <button style={s.dangerBtn} onClick={() => onUninstall(installedApp)}>
            Uninstall
          </button>
        )}
        <button
          style={{
            ...s.bigBtn,
            background: hasUpdate ? 'var(--green)'
                      : isInstalled ? 'var(--surface2)'
                      : 'var(--accent)',
            color: isInstalled && !hasUpdate ? 'var(--muted)' : '#fff',
            cursor: isInstalled && !hasUpdate ? 'default' : 'pointer',
          }}
          disabled={isInstalled && !hasUpdate}
          onClick={() => {
            if (hasUpdate) onInstall(item, { isUpdate: true, existingId: installedApp.id })
            else if (!isInstalled) onInstall(item, { isUpdate: false })
          }}
        >
          {hasUpdate ? 'Update to v' + m.version
            : isInstalled ? 'Already installed'
            : 'Install'}
        </button>
      </div>
    </>
  )
}

export default function App({ appId, token }) {
  const [tab, setTab] = useState('browse')
  const [catalog, setCatalog] = useState(() =>
    CATALOG.map(c => ({ ...c, manifest: null, error: null }))
  )
  const [installed, setInstalled] = useState([])
  const [installedVersions, setInstalledVersions] = useState({})
  const [detail, setDetail] = useState(null)  // {id, manifest, raw_base}
  const [pendingInstall, setPendingInstall] = useState(null)
  // pendingInstall: {item, isUpdate, existingId}
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  // Initial fetch: catalog manifests + installed apps + version map.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [apps, versions] = await Promise.all([
        loadInstalledApps(token),
        loadInstalledVersions(appId, token),
      ])
      if (cancelled) return
      setInstalled(apps)
      setInstalledVersions(versions)
      // Hydrate each catalog entry.
      const hydrated = await Promise.all(
        CATALOG.map(async (c) => {
          try {
            const manifest = await fetchManifest(c.manifest_url)
            return { ...c, manifest, error: null }
          } catch (e) {
            return { ...c, manifest: null, error: e.message || String(e) }
          }
        })
      )
      if (cancelled) return
      setCatalog(hydrated)
      setLoadingCatalog(false)
    }
    load()
    return () => { cancelled = true }
  }, [appId, token])

  const refreshInstalled = useCallback(async () => {
    const apps = await loadInstalledApps(token)
    setInstalled(apps)
  }, [token])

  const handleInstall = async (item, opts = {}) => {
    setPendingInstall({ item, ...opts })
  }

  const confirmInstall = async () => {
    if (!pendingInstall) return
    const { item, isUpdate, existingId } = pendingInstall
    setBusy(true)
    try {
      const result = await installApp({
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
        isUpdate,
        existingId,
      })
      // Record the version we just installed so update detection
      // works on the next browse render.
      const nextVersions = { ...installedVersions, [item.id]: item.manifest.version }
      setInstalledVersions(nextVersions)
      await saveInstalledVersions(appId, token, nextVersions)
      await refreshInstalled()
      setToast({
        kind: 'success',
        message: `${result.name} ${isUpdate ? 'updated' : 'installed'}! Reload Möbius to see it in the drawer.`,
      })
      setPendingInstall(null)
      setDetail(null)
    } catch (e) {
      setToast({ kind: 'error', message: e.message || String(e) })
      setPendingInstall(null)
    } finally {
      setBusy(false)
    }
  }

  const handleUninstall = async (app) => {
    if (!confirm(`Uninstall ${app.name}? This removes the app and its data.`)) return
    try {
      const r = await fetch(`/api/apps/${app.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok && r.status !== 204) {
        const text = await r.text()
        throw new Error(`Uninstall failed: ${r.status} ${text}`)
      }
      // Drop the version record too. We key by catalog id (or
      // 'custom' for paste-a-URL), which matches what install wrote.
      // Match by manifest.id ↔ app.slug (not name — see install path).
      const next = { ...installedVersions }
      for (const item of catalog) {
        if (item.manifest && item.manifest.id === app.slug) {
          delete next[item.id]
        }
      }
      setInstalledVersions(next)
      await saveInstalledVersions(appId, token, next)
      await refreshInstalled()
      setToast({ kind: 'success', message: `${app.name} uninstalled.` })
      setDetail(null)
    } catch (e) {
      setToast({ kind: 'error', message: e.message || String(e) })
    }
  }

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // Detail view replaces the main layout when set.
  if (detail) {
    return (
      <div style={s.root}>
        <DetailView
          item={detail}
          installed={installed}
          installedVersions={installedVersions}
          onBack={() => setDetail(null)}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
        />
        {pendingInstall && (
          <ConfirmModal
            manifest={pendingInstall.item.manifest}
            raw_base={pendingInstall.item.raw_base}
            onConfirm={confirmInstall}
            onCancel={() => !busy && setPendingInstall(null)}
            busy={busy}
            isUpdate={pendingInstall.isUpdate}
          />
        )}
        {toast && (
          <div style={s.toast}>
            <div style={{ flex: 1 }}>{toast.message}</div>
            <button style={s.toastBtn} onClick={() => setToast(null)}>OK</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.titleRow}>
          <h1 style={s.title}>App Store</h1>
        </div>
        <div style={s.tabs}>
          <button style={s.tab(tab === 'browse')} onClick={() => setTab('browse')}>
            Browse
          </button>
          <button style={s.tab(tab === 'url')} onClick={() => setTab('url')}>
            From URL
          </button>
        </div>
      </div>

      <div style={s.scroll}>
        {tab === 'browse' && (
          loadingCatalog
            ? <div style={s.spinner}>Loading catalog…</div>
            : <CatalogList
                items={catalog}
                installed={installed}
                installedVersions={installedVersions}
                onPick={(item) => item.manifest && setDetail(item)}
              />
        )}
        {tab === 'url' && (
          <FromUrlTab onPreview={(item) => setDetail(item)} />
        )}
      </div>

      {pendingInstall && (
        <ConfirmModal
          manifest={pendingInstall.item.manifest}
          raw_base={pendingInstall.item.raw_base}
          onConfirm={confirmInstall}
          onCancel={() => !busy && setPendingInstall(null)}
          busy={busy}
          isUpdate={pendingInstall.isUpdate}
        />
      )}

      {toast && (
        <div style={s.toast}>
          <div style={{ flex: 1 }}>{toast.message}</div>
          <button style={s.toastBtn} onClick={() => setToast(null)}>OK</button>
        </div>
      )}
    </div>
  )
}
