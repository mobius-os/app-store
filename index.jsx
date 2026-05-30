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
  {
    id: 'countries',
    repo: 'mobius-os/app-countries',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-countries/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-countries/main/',
  },
  {
    id: 'gym',
    repo: 'mobius-os/app-gym',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-gym/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-gym/main/',
  },
  {
    id: 'latex',
    repo: 'mobius-os/app-latex',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/',
  },
  {
    id: 'dreaming',
    repo: 'mobius-os/app-dreaming',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-dreaming/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-dreaming/main/',
  },
]

// Hosts we recognize as common public manifest sources. The paste-a-URL
// flow silently trusts these; anything else triggers a soft warning in
// the install confirm modal. This is UX-only — the backend's SSRF
// defenses are the actual security boundary.
const TRUSTED_HOSTS = new Set([
  'raw.githubusercontent.com',
  'codeberg.org',
  'git.sr.ht',
  'gitlab.com',
])

function isTrustedHost(url) {
  try {
    return TRUSTED_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

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
  catalogGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '14px',
  },
  card: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center',
    padding: '14px 10px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '12px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, transform 0.1s',
  },
  iconWrap: {
    width: '88px', height: '88px', borderRadius: '20px',
    background: 'var(--surface2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '10px', flexShrink: 0, overflow: 'hidden',
  },
  iconImg: { width: '100%', height: '100%', objectFit: 'cover' },
  iconLetter: {
    fontSize: '34px', fontWeight: 700, color: 'var(--accent)',
  },
  cardName: {
    fontSize: '14px', fontWeight: 600, lineHeight: 1.25,
    marginBottom: '4px',
    display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  cardVersion: {
    fontSize: '11px', color: 'var(--muted)',
    fontFamily: 'var(--mono, monospace)',
    marginBottom: '6px',
  },
  cardDesc: {
    fontSize: '12px', color: 'var(--muted)', lineHeight: 1.35,
    marginBottom: '10px',
    display: '-webkit-box', WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
    textAlign: 'center',
    minHeight: '48px',
  },
  cardBtn: (variant) => ({
    width: '100%',
    padding: '8px 12px', borderRadius: '8px',
    border: variant === 'secondary' ? '1px solid var(--border)' : 'none',
    background: variant === 'update' ? 'var(--green)'
              : variant === 'secondary' ? 'transparent'
              : variant === 'warn' ? 'var(--accent)'
              : 'var(--accent)',
    color: variant === 'secondary' ? 'var(--text)' : '#fff',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font)',
    transition: 'background 0.15s',
  }),
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
  hostWarn: {
    display: 'flex', gap: '10px', alignItems: 'flex-start',
    padding: '10px 12px', marginBottom: '12px',
    background: 'var(--accent-dim, rgba(139,108,247,0.15))',
    border: '1px solid var(--accent)', borderRadius: '8px',
    fontSize: '13px', lineHeight: 1.5,
  },
  hostWarnIcon: {
    fontSize: '16px', lineHeight: 1.2, color: 'var(--accent)',
    flexShrink: 0,
  },
  hostWarnHost: {
    fontWeight: 600, color: 'var(--text)',
    fontFamily: 'var(--mono, monospace)',
  },
  hostWarnBody: {
    color: 'var(--muted)', marginTop: '2px',
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
        <img src={url} alt="" style={s.iconImg} loading="lazy"
             onError={() => setErrored(true)} />
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

// Ask the shell to switch to the installed app via the
// `moebius:open-app` postMessage protocol (see Shell.jsx's handler).
// `id` is the numeric DB id from /api/apps/. If we're not embedded in
// the shell (mini-app run standalone), we can't navigate the parent
// shell — surface a hint via the caller's toast.
function openInstalledApp(id, onUnembedded) {
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

// Heart of the install flow. One call to POST /api/apps/install — the
// backend does fetch + validate + compile + source_dir + storage seeds
// + icon + cron in a single transaction with filesystem rollback on
// failure. See feature ticket 062 for the design rationale.
//
// On older Möbius builds without this endpoint, callers see a 404
// here. There's no client-side fallback to the multi-step flow on
// purpose — that path silently leaked partial installs on failure.
// Older containers should be updated before the store works.
async function installApp({ manifest_url, manifest, raw_base, token }) {
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
    warnings: out.warnings || [],
  }
}

function ConfirmModal({ manifest, raw_base, manifest_url, onConfirm, onCancel, busy, isUpdate }) {
  const ca = manifest.permissions?.cross_app_access || 'none'
  const sw = manifest.permissions?.share_with_apps || 'none'
  const hasSchedule = !!manifest.schedule
  const esmDeps = manifest.runtime?.esm_deps || []
  // Soft warn for unfamiliar hosts (paste-a-URL flow). Catalog entries
  // already resolve to trusted hosts, so they pass silently. Invalid
  // URLs fall through to the warn path on purpose.
  const unfamiliarHost = manifest_url && !isTrustedHost(manifest_url)
  let warnHost = ''
  if (unfamiliarHost) {
    try { warnHost = new URL(manifest_url).hostname } catch { warnHost = manifest_url }
  }
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

        {unfamiliarHost && (
          <div style={{ ...s.hostWarn, marginTop: '16px', marginBottom: 0 }}>
            <div style={s.hostWarnIcon} aria-hidden="true">⚠</div>
            <div>
              <div>Unfamiliar host: <span style={s.hostWarnHost}>{warnHost}</span></div>
              <div style={s.hostWarnBody}>
                You're installing from a host that isn't in the trusted list.
                Continue only if you trust the author.
              </div>
            </div>
          </div>
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

function UninstallConfirmModal({ app, busy, onConfirm, onCancel }) {
  // Browser confirm() doesn't render inside the AppCanvas iframe
  // (sandbox lacks `allow-modals`), so we ship our own confirmation.
  return (
    <div style={s.modalBackdrop} onClick={busy ? null : onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <h3 style={s.modalTitle}>Uninstall {app.name}?</h3>
        <p style={{ fontSize: '13px', lineHeight: 1.55, marginBottom: '16px', color: 'var(--muted)' }}>
          This removes the app and its stored data. You can reinstall
          it later from the store.
        </p>
        <div style={s.modalActions}>
          <button style={{ ...s.dangerBtn, color: 'var(--text)' }}
                  onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button style={{ ...s.bigBtn, background: 'var(--danger, #e5484d)' }}
                  onClick={onConfirm} disabled={busy}>
            {busy ? 'Uninstalling…' : 'Uninstall'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CatalogList({ items, installed, installedVersions, onPick, onOpenInstalled }) {
  if (items.length === 0) {
    return <div style={s.empty}>No apps in the catalog yet.</div>
  }
  return (
    <div style={s.catalogGrid}>
      {items.map(item => {
        if (!item.manifest) {
          return (
            <div key={item.id} style={{ ...s.card, opacity: 0.6 }}>
              <div style={s.iconWrap}>
                <span style={s.iconLetter}>{item.id.charAt(0).toUpperCase()}</span>
              </div>
              <div style={s.cardName}>{item.id}</div>
              <div style={s.cardVersion}>
                {item.error ? 'fetch failed' : 'loading…'}
              </div>
            </div>
          )
        }
        const m = item.manifest
        // Match by manifest_url — the URL the app was installed from.
        // Slug is now pure routing (allocate_unique_slug on collision);
        // identity lives on manifest_url. A user-built app and a store-
        // installed app with the same slug coexist; the store can find
        // its own apps regardless of slug bumps.
        const storeInstalled = installed.find(a => a.manifest_url === item.manifest_url)
        const installedVer = installedVersions[item.id]
        const hasUpdate = storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0
        let btnLabel = 'Install'
        let btnVariant = 'primary'
        if (storeInstalled && hasUpdate) { btnLabel = 'Update'; btnVariant = 'update' }
        else if (storeInstalled) { btnLabel = 'Open'; btnVariant = 'secondary' }
        // "Open" on an already-installed card should actually open the
        // app via the shell's moebius:open-app protocol — the previous
        // behavior dropped the user on the Detail view's dead-end
        // "Already installed" panel. Install / Update still route to
        // the confirmation flow via onPick.
        const handleBtnClick = (e) => {
          e.stopPropagation()
          if (storeInstalled && !hasUpdate) onOpenInstalled(storeInstalled.id)
          else onPick(item)
        }
        return (
          <div key={item.id} style={s.card} onClick={() => onPick(item)}>
            <IconBox item={item} />
            <div style={s.cardName}>{m.name}</div>
            <div style={s.cardVersion}>v{m.version}</div>
            {m.description ? (
              <div style={s.cardDesc}>{m.description}</div>
            ) : null}
            <button
              style={s.cardBtn(btnVariant)}
              onClick={handleBtnClick}
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

function DetailView({ item, installed, installedVersions, onBack, onInstall, onUninstall, onOpenInstalled }) {
  const m = item.manifest
  // Match by manifest_url — see CatalogList comment. Slug collisions
  // between user apps and store apps are resolved transparently by
  // allocate_unique_slug on the backend; the store reads its own
  // installed apps via manifest_url, never slug.
  const storeInstalled = installed.find(a => a.manifest_url === item.manifest_url)
  const installedVer = installedVersions[item.id]
  const hasUpdate = storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0
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

        {storeInstalled && (
          <div style={s.detailSection}>
            <div style={s.sectionLabel}>Installed</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Currently installed: v{installedVer || 'unknown'}.
            </div>
          </div>
        )}

      </div>

      <div style={s.detailFooter}>
        {storeInstalled && !hasUpdate && (
          <button style={s.dangerBtn} onClick={() => onUninstall(storeInstalled)}>
            Uninstall
          </button>
        )}
        {/* Three footer button states:
            - installed (no update): "Open App" → moebius:open-app via onOpenInstalled
            - installed + update available: "Update to vX" → onInstall(isUpdate)
            - not installed: "Install" → onInstall(isUpdate=false)
            The disabled "Already installed" pill is gone — it was a
            dead-end and the whole point of this view is that the user
            can act on the app. */}
        <button
          style={{
            ...s.bigBtn,
            background: hasUpdate ? 'var(--green)' : 'var(--accent)',
          }}
          onClick={() => {
            if (hasUpdate) onInstall(item, { isUpdate: true, existingId: storeInstalled.id })
            else if (storeInstalled) onOpenInstalled(storeInstalled.id)
            else onInstall(item, { isUpdate: false })
          }}
        >
          {hasUpdate ? 'Update to v' + m.version
            : storeInstalled ? 'Open App'
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
  const [pendingUninstall, setPendingUninstall] = useState(null)
  // pendingUninstall: the installed app row from /api/apps/.
  // Browser confirm() is silently no-op'd inside the AppCanvas
  // iframe (sandbox lacks `allow-modals`), so we stage the
  // confirmation as in-app state and render our own modal.
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

  // Wire the moebius:open-app postMessage with a toast fallback for
  // the (defensive) standalone case. The shell handler validates the
  // appId before navigating; we don't need an ack here.
  const handleOpenInstalled = useCallback((id) => {
    openInstalledApp(id, () => {
      setToast({
        kind: 'error',
        message: 'Open this app from the drawer.',
      })
    })
  }, [])

  const handleInstall = async (item, opts = {}) => {
    setPendingInstall({ item, ...opts })
  }

  const confirmInstall = async () => {
    if (!pendingInstall) return
    const { item } = pendingInstall
    setBusy(true)
    try {
      // The backend decides install vs update based on manifest.id ↔
      // App.slug match. We pass manifest + raw_base; the install endpoint
      // re-fetches nothing else from us.
      const result = await installApp({
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
      })
      // Record the version we just installed so update detection
      // works on the next browse render. The backend returns the
      // version it actually applied, which is authoritative.
      const nextVersions = { ...installedVersions, [item.id]: result.version }
      setInstalledVersions(nextVersions)
      await saveInstalledVersions(appId, token, nextVersions)
      await refreshInstalled()
      const verb = result.mode === 'update' ? 'updated' : 'installed'
      const warnSuffix = result.warnings.length
        ? ` (with notes: ${result.warnings.join('; ')})`
        : ''
      setToast({
        kind: 'success',
        message: `${result.name} ${verb}${warnSuffix}! Reload Möbius to see it in the drawer.`,
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

  // Stage the uninstall — DetailView's Uninstall button calls this,
  // and the modal's Confirm calls confirmUninstall to actually run
  // the DELETE. Splitting these out is required because the iframe
  // sandbox blocks window.confirm(); see pendingUninstall comment.
  const handleUninstall = (app) => {
    setPendingUninstall(app)
  }

  const confirmUninstall = async () => {
    const app = pendingUninstall
    if (!app) return
    setBusy(true)
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
      setPendingUninstall(null)
      setDetail(null)
    } catch (e) {
      setToast({ kind: 'error', message: e.message || String(e) })
      setPendingUninstall(null)
    } finally {
      setBusy(false)
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
          onOpenInstalled={handleOpenInstalled}
        />
        {pendingInstall && (
          <ConfirmModal
            manifest={pendingInstall.item.manifest}
            raw_base={pendingInstall.item.raw_base}
            manifest_url={pendingInstall.item.manifest_url}
            onConfirm={confirmInstall}
            onCancel={() => !busy && setPendingInstall(null)}
            busy={busy}
            isUpdate={pendingInstall.isUpdate}
          />
        )}
        {pendingUninstall && (
          <UninstallConfirmModal
            app={pendingUninstall}
            busy={busy}
            onConfirm={confirmUninstall}
            onCancel={() => !busy && setPendingUninstall(null)}
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
                onOpenInstalled={handleOpenInstalled}
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
          manifest_url={pendingInstall.item.manifest_url}
          onConfirm={confirmInstall}
          onCancel={() => !busy && setPendingInstall(null)}
          busy={busy}
          isUpdate={pendingInstall.isUpdate}
        />
      )}

      {pendingUninstall && (
        <UninstallConfirmModal
          app={pendingUninstall}
          busy={busy}
          onConfirm={confirmUninstall}
          onCancel={() => !busy && setPendingUninstall(null)}
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
