import React, { useState, useEffect, useCallback, useRef } from 'react'

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
    id: 'atlas',
    repo: 'mobius-os/app-atlas',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-atlas/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-atlas/main/',
  },
  {
    id: 'gym',
    repo: 'mobius-os/app-workout',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-workout/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-workout/main/',
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
  {
    id: 'mind',
    repo: 'mobius-os/app-mind',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-mind/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-mind/main/',
  },
  {
    id: 'notes',
    repo: 'mobius-os/app-notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
  },
]

// The store's OWN version — keep in lockstep with mobius.json on each release.
// The store is a core app, so it isn't in installed-versions.json or the
// catalog grid; it self-updates via the banner below: fetch its published
// manifest and, when that version is newer than what's running, offer a
// one-tap update (the same install transaction every other app uses) followed
// by a reload so the freshly-patched code loads.
const STORE_VERSION = '1.4.0'
const STORE_SELF = {
  manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-store/main/mobius.json',
  raw_base: 'https://raw.githubusercontent.com/mobius-os/app-store/main/',
}

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

export function isTrustedHost(url) {
  try {
    return TRUSTED_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

export function validateManifestUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) throw new Error('Enter a manifest URL.')
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a valid manifest URL.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Manifest URL must start with http:// or https://.')
  }
  return url.toString()
}

// Client-side mirror of the backend's _canonical_identity_key in
// backend/app/install.py. The backend rewrites every
// installed App row's manifest_url to this shape, so the catalog grid
// must compare against the SAME shape — comparing the catalog's raw
// `.../main/mobius.json` to a stored `.../main#manifest-id=<id>`
// silently misses every match and the grid renders "Not installed"
// for apps that ARE installed.
//
// Rules (keep aligned with backend):
//   1. strip the URL fragment ("#...")
//   2. drop a trailing "/*.json" manifest filename if present
//   3. strip trailing "/"
//   4. append "#manifest-id=<manifest_id>"
export function canonicalIdentityKey(url, manifestId) {
  if (!url || !manifestId) return ''
  // Strip BOTH fragment AND query string — match the backend's
  // _canonical_identity_key in install.py. Without ?-strip, two
  // paste-a-URL flows for the same app (with vs without a tracking
  // param) would canonicalise to different keys.
  let base = String(url).split('#', 1)[0].split('?', 1)[0]
  base = base.replace(/\/[^/]+\.json$/i, '')
  base = base.replace(/\/+$/, '')
  return `${base}#manifest-id=${manifestId}`
}

// Look up an installed App row that corresponds to the catalog entry.
// Every installed row carries the canonical identity key (the backend
// canonicalises on every install + update path); matching by canonical
// key is the single source of truth.
function findInstalled(installed, item) {
  const manifestId = item.manifest?.id || item.id
  const canonical = canonicalIdentityKey(item.manifest_url, manifestId)
  return installed.find(a => a.manifest_url === canonical) || null
}

function installedVersionFor(item, installedVersions, installedApp) {
  return installedVersions[item.id] ||
    installedApp?.version ||
    installedApp?.manifest?.version ||
    ''
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
    flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none',
    cursor: 'pointer', fontSize: '14px', fontWeight: 500,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--muted)',
    transition: 'background 150ms, color 150ms', fontFamily: 'var(--font)',
    minHeight: '44px',
  }),
  scroll: {
    flex: 1, overflow: 'auto', padding: '16px',
  },
  catalogGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '16px',
  },
  // Card variants:
  //  - 'default'  — not installed: standard border
  //  - 'installed' — already installed: same border + a check dot in the icon corner
  //  - 'update'    — installed-but-old: accent border so the card itself signals
  //                  "you should look at this" before the user reads the pill
  //  - 'error'     — manifest fetch failed: dashed muted border, no hover lift
  card: (variant = 'default') => ({
    position: 'relative',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center',
    padding: '16px 12px', background: 'var(--surface)',
    border: variant === 'update'
      ? '1px solid var(--accent)'
      : variant === 'error'
      ? '1px dashed var(--border)'
      : '1px solid var(--border)',
    borderRadius: '12px',
    cursor: variant === 'error' ? 'default' : 'pointer',
    transition: 'border-color 150ms, transform 150ms, box-shadow 150ms, background 150ms',
    minHeight: '44px',
    outline: 'none',
  }),
  iconWrap: {
    width: '88px', height: '88px', borderRadius: '20px',
    background: 'var(--surface2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  // A relative anchor around the IconBox so the "installed" check dot
  // can sit at the icon's bottom-right corner without leaking out of
  // IconBox's `overflow: hidden`. Spacing-below lives on this slot.
  iconSlot: {
    position: 'relative',
    marginBottom: '12px',
    display: 'inline-block',
  },
  iconImg: { width: '100%', height: '100%', objectFit: 'cover' },
  iconLetter: {
    fontSize: '34px', fontWeight: 700, color: 'var(--accent)',
  },
  // A tiny check dot sits at the icon's bottom-right when the app is
  // already installed. Quicker to read than the pill text, lets the
  // grid double as an "at a glance" inventory.
  installedDot: {
    position: 'absolute',
    bottom: '-2px', right: '-2px',
    width: '22px', height: '22px', borderRadius: '999px',
    background: 'var(--surface)',
    border: '2px solid var(--surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
  },
  installedDotInner: {
    width: '18px', height: '18px', borderRadius: '999px',
    background: 'color-mix(in srgb, var(--accent) 80%, var(--surface))',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: 700, lineHeight: 1,
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
    marginBottom: '8px',
  },
  cardDesc: {
    fontSize: '12px', color: 'var(--muted)', lineHeight: 1.35,
    marginBottom: '12px',
    display: '-webkit-box', WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
    textAlign: 'center',
    minHeight: '48px',
  },
  // Top-border separator between the description and the status pill —
  // gives the pill a visual ground line so it reads as a footer caption
  // rather than another floating chip.
  cardStatusRow: {
    width: '100%',
    paddingTop: '8px',
    borderTop: '1px solid var(--border)',
    marginTop: 'auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
  cardUpdateBtn: {
    flexShrink: 0,
    border: 'none',
    borderRadius: '7px',
    padding: '5px 12px',
    background: 'var(--green, var(--accent))',
    color: '#fff',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
  },
  cardInlineError: {
    width: '100%',
    marginTop: '8px',
    padding: '8px',
    borderRadius: '8px',
    background: 'color-mix(in srgb, var(--danger, #e5484d) 10%, transparent)',
    color: 'var(--danger)',
    fontSize: '12px',
    lineHeight: 1.35,
    border: '1px solid color-mix(in srgb, var(--danger, #e5484d) 30%, transparent)',
    boxSizing: 'border-box',
  },
  // Grid-card status pill — readonly. The card itself takes the tap
  // to the detail view; the detail view owns the Install / Update /
  // Open action button so the user sees permissions before committing.
  cardStatus: (variant) => ({
    fontSize: '11px', fontWeight: 600,
    padding: '4px 10px', borderRadius: '999px',
    fontFamily: 'var(--font)', letterSpacing: '0.01em',
    border: '1px solid',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: variant === 'update'
      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
      : variant === 'installed'
      ? 'color-mix(in srgb, var(--text) 6%, transparent)'
      : 'transparent',
    color: variant === 'update' ? 'var(--accent)'
         : variant === 'installed' ? 'var(--text)'
         : 'var(--muted)',
    borderColor: variant === 'update' ? 'var(--accent)'
               : variant === 'installed' ? 'var(--border)'
               : 'var(--border)',
  }),
  cardStatusDot: (variant) => ({
    width: '6px', height: '6px', borderRadius: '999px',
    background: variant === 'update' ? 'var(--accent)'
              : variant === 'installed'
              ? 'color-mix(in srgb, var(--text) 50%, transparent)'
              : 'color-mix(in srgb, var(--muted) 60%, transparent)',
    flexShrink: 0,
  }),
  // Skeleton placeholder — same shape as a card so the grid doesn't
  // reflow when the real manifests arrive.
  skeletonCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '16px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '12px',
    minHeight: '44px',
    opacity: 0.7,
  },
  skeletonBlock: (w, h) => ({
    width: w, height: h, borderRadius: '6px',
    background: 'color-mix(in srgb, var(--text) 8%, transparent)',
    animation: 'mobius-store-pulse 1.4s ease-in-out infinite',
  }),
  cardErrorBody: {
    fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4,
    marginTop: '4px', marginBottom: '12px',
    textAlign: 'center',
  },
  cardRetryBtn: {
    padding: '6px 12px', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text)', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font)',
    minHeight: '32px',
    transition: 'background 150ms',
  },
  // From URL tab
  urlForm: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '16px',
  },
  urlLabel: {
    fontSize: '14px', fontWeight: 600, marginBottom: '8px',
    display: 'block',
  },
  urlHint: {
    fontSize: '12px', color: 'var(--muted)', marginBottom: '12px',
    lineHeight: 1.5,
  },
  urlInput: {
    width: '100%', padding: '12px',
    background: 'var(--bg)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '13px', fontFamily: 'var(--mono, monospace)',
    outline: 'none', boxSizing: 'border-box',
    marginBottom: '12px',
    minHeight: '44px',
    transition: 'border-color 150ms, box-shadow 150ms',
  },
  primaryBtn: {
    padding: '12px 20px', borderRadius: '10px', border: 'none',
    background: 'var(--accent)', color: '#fff',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font)',
    minHeight: '44px',
    transition: 'background 150ms',
  },
  // Live host indicator below the URL input — switches between
  // "trusted source" (calm accent badge) and "unfamiliar host"
  // (amber-toned, but not red — installing from a personal repo is
  // legitimate; the framing should inform, not alarm).
  hostBadge: (kind) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '4px 10px', borderRadius: '999px',
    fontSize: '12px', fontWeight: 500,
    fontFamily: 'var(--font)',
    background: kind === 'trusted'
      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
      : 'color-mix(in srgb, var(--text) 6%, transparent)',
    color: kind === 'trusted' ? 'var(--accent)' : 'var(--muted)',
    border: '1px solid',
    borderColor: kind === 'trusted' ? 'var(--accent)' : 'var(--border)',
    marginBottom: '12px',
  }),
  hostBadgeDot: (kind) => ({
    width: '6px', height: '6px', borderRadius: '999px',
    background: kind === 'trusted' ? 'var(--accent)'
              : 'color-mix(in srgb, var(--muted) 60%, transparent)',
    flexShrink: 0,
  }),
  hostBadgeHost: {
    fontFamily: 'var(--mono, monospace)', fontSize: '11px',
  },
  errorBox: {
    background: 'color-mix(in srgb, var(--danger, #e5484d) 12%, transparent)',
    color: 'var(--danger)', padding: '12px',
    borderRadius: '8px', fontSize: '14px',
    marginTop: '12px', lineHeight: 1.5,
    border: '1px solid color-mix(in srgb, var(--danger, #e5484d) 40%, transparent)',
  },
  // Detail view
  detailHeader: {
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    gap: '8px', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--accent)',
    fontSize: '14px', cursor: 'pointer', padding: '8px 12px',
    fontFamily: 'var(--font)', fontWeight: 500,
    minHeight: '44px',
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    margin: '-8px -8px',  // compensate so the visible affordance still aligns
    borderRadius: '8px',
    transition: 'background 150ms',
  },
  hero: {
    display: 'flex', alignItems: 'center', gap: '16px',
    marginBottom: '24px',
  },
  heroIcon: {
    width: '72px', height: '72px', borderRadius: '16px',
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
  detailSection: { marginBottom: '24px' },
  sectionLabel: {
    fontSize: '11px', fontWeight: 600, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: '8px',
  },
  permissionRow: {
    display: 'flex', gap: '12px',
    padding: '12px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '8px',
    marginBottom: '8px', fontSize: '14px', lineHeight: 1.5,
  },
  permRowMain: { flex: 1, minWidth: 0 },
  permLabel: {
    fontWeight: 600, color: 'var(--text)',
  },
  permDetail: { color: 'var(--muted)' },
  // A muted helper line under the permission summary — explains, in
  // plain language, what the manifest value actually grants. The
  // detail prose comes from PERM_EXPLAIN; this row prefixes a short
  // capability tag so "Read" / "Write" / "None" reads at a glance.
  permTag: (level) => {
    // Treat 'no' the same as 'none' so the manage_apps row's "off"
    // state renders with the muted styling rather than the accent
    // colour used for granted permissions.
    const muted = level === 'none' || level === 'no'
    return {
      flexShrink: 0,
      padding: '2px 8px', borderRadius: '999px',
      fontSize: '11px', fontWeight: 600,
      fontFamily: 'var(--font)', letterSpacing: '0.02em',
      textTransform: 'uppercase',
      background: muted
        ? 'color-mix(in srgb, var(--muted) 14%, transparent)'
        : level === 'read'
        ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
        : 'color-mix(in srgb, var(--accent) 22%, transparent)',
      color: muted ? 'var(--muted)' : 'var(--accent)',
      border: '1px solid',
      borderColor: muted ? 'var(--border)' : 'var(--accent)',
      alignSelf: 'flex-start',
    }
  },
  scheduleRow: {
    padding: '12px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '14px', lineHeight: 1.5,
  },
  scheduleMain: {
    fontWeight: 600, color: 'var(--text)',
  },
  scheduleNote: {
    color: 'var(--muted)', marginTop: '4px', fontSize: '12px',
  },
  // External-libs disclosure — was an alarming purple-bordered panel.
  // The info is useful; the framing isn't. Now reads as a quiet note
  // anchored on a muted surface, with the dep list mono-formatted.
  esmNote: {
    padding: '12px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: '14px', lineHeight: 1.5,
    color: 'var(--muted)',
  },
  esmDepList: {
    fontFamily: 'var(--mono, monospace)',
    fontSize: '12px',
    color: 'var(--text)',
    marginTop: '6px',
    wordBreak: 'break-all',
  },
  hostWarn: {
    display: 'flex', gap: '12px', alignItems: 'flex-start',
    padding: '12px', marginBottom: '12px',
    background: 'var(--accent-dim, rgba(139,108,247,0.15))',
    border: '1px solid var(--accent)', borderRadius: '8px',
    fontSize: '14px', lineHeight: 1.5,
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
    display: 'flex', flexDirection: 'column', gap: '8px',
    flexShrink: 0, background: 'var(--bg)',
  },
  bigBtn: {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    border: 'none', background: 'var(--accent)', color: '#fff',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font)',
    minHeight: '44px',
    transition: 'background 150ms, transform 150ms',
  },
  dangerBtn: {
    padding: '12px 16px', borderRadius: '10px',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--danger)', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font)',
    minHeight: '44px',
  },
  // Subordinate link-style button for "Uninstall" when the primary CTA
  // is already "Open App". Avoids the visual equal-weight of two solid
  // buttons stacked — Uninstall is rare and not the user's main path.
  secondaryLink: {
    alignSelf: 'center',
    padding: '12px 16px', borderRadius: '8px',
    border: 'none', background: 'transparent',
    color: 'var(--muted)', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    minHeight: '44px',
  },
  // Modal
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--surface)', borderRadius: '16px 16px 0 0',
    width: '100%', maxWidth: '480px', padding: '24px',
    maxHeight: '85vh', overflowY: 'auto',
    borderTop: '1px solid var(--border)',
  },
  modalTitle: {
    fontSize: '16px', fontWeight: 700, margin: '0 0 12px',
    letterSpacing: '-0.01em',
  },
  // Side-by-side action buttons in modals. Children get `flex: 1`
  // applied directly (via the helper below) since the canonical
  // `bigBtn` and `dangerBtn` styles are also used full-width in the
  // detail footer — flex:1 only belongs in the modal context.
  modalActions: {
    display: 'flex', gap: '8px', marginTop: '24px',
  },
  modalBtn: { flex: 1, width: 'auto' },
  toast: {
    position: 'fixed', bottom: '16px', left: '16px', right: '16px',
    padding: '12px 16px', background: 'var(--surface)',
    border: '1px solid var(--accent)', borderRadius: '12px',
    fontSize: '14px', lineHeight: 1.5,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', gap: '12px',
    zIndex: 200,
  },
  toastBtn: {
    padding: '8px 16px', borderRadius: '8px', border: 'none',
    background: 'var(--accent)', color: '#fff',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font)', flexShrink: 0,
    minHeight: '32px',
  },
  updateNotice: {
    marginTop: '12px',
    padding: '12px',
    background: 'var(--surface)',
    border: '1px solid var(--accent)',
    borderRadius: '10px',
    fontSize: '14px',
    lineHeight: 1.45,
  },
  updateNoticeActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  empty: {
    textAlign: 'center', padding: '40px 20px',
    color: 'var(--muted)', fontSize: '14px',
  },
}

// Human-language explanations for the permission strings. `tag` is the
// 1-word badge that sits next to each row's title; `summary` is the
// short user-facing prose; `hint` is the muted helper line that spells
// out the practical consequence the user is actually granting.
const PERM_EXPLAIN = {
  cross_app_access: {
    none: {
      tag: 'None',
      summary: 'Cannot read or write other apps\' data.',
      hint: 'Keeps this app entirely sandboxed — it only sees its own files.',
    },
    read: {
      tag: 'Read',
      summary: 'Reads other apps\' stored data.',
      hint: 'Can browse files written by your other mini-apps, but cannot change them.',
    },
    write: {
      tag: 'Read + write',
      summary: 'Reads and writes other apps\' stored data.',
      hint: 'Can edit, add, or delete files belonging to your other mini-apps.',
    },
  },
  manage_apps: {
    true: {
      tag: 'Manages apps',
      summary: 'Can install and uninstall apps on your behalf.',
      hint: 'Lets the app call Install and Uninstall directly — grant only to apps you trust to manage your install set (e.g. the App Store itself).',
    },
    false: {
      tag: 'No',
      summary: 'Cannot install or uninstall apps.',
      hint: 'This app cannot add or remove apps from your install set.',
    },
  },
  share_with_apps: {
    none: {
      tag: 'Private',
      summary: 'Other apps cannot access this app\'s data.',
      hint: 'Anything this app stores stays inside this app.',
    },
    read: {
      tag: 'Readable',
      summary: 'Other apps can read this app\'s data.',
      hint: 'Other mini-apps you install can see this app\'s files but cannot modify them.',
    },
    write: {
      tag: 'Read + write',
      summary: 'Other apps can read and write this app\'s data.',
      hint: 'Other mini-apps can change or delete files this app stores.',
    },
  },
}

// Turn a cron expression into something readable. Falls back to
// the raw expression for anything non-trivial.
export function humanCron(expr) {
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

export function scheduleSummary(schedule) {
  if (!schedule) return ''
  if (schedule.default) return humanCron(schedule.default)
  if (schedule.job) return 'Runs on demand from inside the app'
  return ''
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
function runtimeStorage() {
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

async function loadInstalledVersions(appId, token) {
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

async function saveInstalledVersions(appId, token, map) {
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
  const manifestUrl = validateManifestUrl(url)
  const r = await fetch(manifestUrl, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`Manifest fetch failed: ${r.status}`)
  return await r.json()
}

// Compare two semver strings. Returns -1 / 0 / 1. Bad input → 0.
// Compares the full numeric core (not just 3 segments, so a 4th segment isn't
// dropped) and honors SemVer pre-release precedence: 1.2.0-rc.1 < 1.2.0, so a
// pre-release never reads as "up to date" against its own release.
export function semverCmp(a, b) {
  if (!a || !b) return 0
  const core = (v) => String(v).split('+')[0].split('-')[0]
  const pre = (v) => { const m = String(v).split('+')[0].split('-').slice(1).join('-'); return m || '' }
  const pa = core(a).split('.').map(n => parseInt(n, 10) || 0)
  const pb = core(b).split('.').map(n => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length, 3)
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  // Equal numeric core: a release (no pre-release) outranks a pre-release; two
  // pre-releases compare by dot-separated identifiers per SemVer §11 — numeric
  // ones numerically (so rc.2 < rc.10, not the lexical reverse), numeric ranks
  // below alphanumeric, and a smaller set of identifiers ranks lower when all
  // the preceding ones are equal.
  const ra = pre(a), rb = pre(b)
  if (ra === rb) return 0
  if (!ra) return 1
  if (!rb) return -1
  const ida = ra.split('.'), idb = rb.split('.')
  for (let i = 0; i < Math.max(ida.length, idb.length); i++) {
    if (i >= ida.length) return -1
    if (i >= idb.length) return 1
    const x = ida[i], y = idb[i]
    if (x === y) continue
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y)
    if (xn && yn) return parseInt(x, 10) < parseInt(y, 10) ? -1 : 1
    if (xn !== yn) return xn ? -1 : 1
    return x < y ? -1 : 1
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
    divergence: out.divergence,
    conflict_paths: out.conflict_paths || [],
    warnings: out.warnings || [],
  }
}

async function readJsonOrThrow(res, fallback) {
  if (res.ok) return await res.json()
  let detail = fallback || `HTTP ${res.status}`
  try {
    const errBody = await res.json()
    if (errBody && errBody.detail) detail = errBody.detail
  } catch {
    detail = await res.text() || detail
  }
  throw new Error(detail)
}

async function loadUpdatePreview(appId, token) {
  const res = await fetch(`/api/apps/${appId}/update-preview`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return await readJsonOrThrow(res, 'Update preview failed')
}

async function createAppChat(title, token) {
  const res = await fetch('/api/app-chats', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })
  return await readJsonOrThrow(res, 'Could not create review chat')
}

async function seedChatMessage(chatId, content, token) {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    await readJsonOrThrow(res, 'Could not seed chat message')
  }
}

function openChat(chatId) {
  window.parent.postMessage(
    { type: 'moebius:open-chat', chatId },
    window.location.origin,
  )
}

function firstConflictFiles(preview) {
  return preview.conflict_files || preview.conflicts || []
}

function compactExcerpt(text, limit = 150) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim()
  return compact.length > limit ? `${compact.slice(0, limit)}...` : compact
}

function buildCleanMergeReviewMessage({ item, result, preview }) {
  const name = result.name || item.manifest?.name || item.id
  const version = preview.upstream_version || result.version || item.manifest?.version || 'latest'
  const diff = preview.upstream_diff ? preview.upstream_diff.trim() : '(No upstream diff was returned.)'
  return [
    `Please review the clean update merge for ${name} to v${version}.`,
    '',
    'The App Store applied the update because the upstream changes merged cleanly with my local edits. Please double-check the result and call out anything that needs follow-up.',
    '',
    'Upstream diff:',
    diff,
  ].join('\n')
}

function buildConflictResolveMessage({ item, result, preview }) {
  const name = result.name || item.manifest?.name || item.id
  const slug = result.slug || item.manifest?.id || item.id
  const version = preview.upstream_version || result.version || item.manifest?.version || 'latest'
  const files = firstConflictFiles(preview)
  const conflictList = files.length
    ? files.map(file => `- ${file.path}`).join('\n')
    : (result.conflict_paths || []).map(path => `- ${path}`).join('\n') || '- (No conflict paths were returned.)'
  const excerpts = files.length
    ? files.map(file => `- ${file.path}: ${compactExcerpt(file.merged_with_markers) || '(No marker excerpt returned.)'}`).join('\n')
    : '- (No marker excerpts were returned.)'
  return [
    `Please resolve the blocked update for ${name} to v${version}.`,
    '',
    'The update was NOT applied because my local edits conflict with upstream.',
    '',
    'Conflict files:',
    conflictList,
    '',
    'Marker excerpts:',
    excerpts,
    '',
    `The full conflict markers are in /data/apps/${slug} and are also available from GET /api/apps/${result.id}/update-preview.`,
  ].join('\n')
}

// One permission row used in the detail view. Builds a flex layout
// with the title + summary on the left and a small capability tag on
// the right; the hint line under the summary spells out what the user
// is actually granting in plain language.
function PermissionRow({ label, level, info }) {
  if (!info) return null
  return (
    <div style={s.permissionRow} title={info.hint}>
      <div style={s.permRowMain}>
        <div style={s.permLabel}>{label}</div>
        <div style={s.permDetail}>{info.summary}</div>
        <div style={{ ...s.permDetail, fontSize: '12px', marginTop: '4px' }}>
          {info.hint}
        </div>
      </div>
      <span style={s.permTag(level)}>{info.tag}</span>
    </div>
  )
}

function UninstallConfirmModal({ app, busy, onConfirm, onCancel }) {
  // Browser modal dialogs don't render inside the AppCanvas iframe
  // (sandbox lacks `allow-modals`), so we ship our own confirmation.
  return (
    <div style={s.modalBackdrop} onClick={busy ? null : onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <h3 style={s.modalTitle}>Uninstall {app.name}?</h3>
        <p style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: '16px', color: 'var(--muted)' }}>
          This removes the app and its stored data. You can reinstall
          it later from the store.
        </p>
        <div style={s.modalActions}>
          <button style={{ ...s.dangerBtn, ...s.modalBtn, color: 'var(--text)' }}
                  onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button style={{ ...s.bigBtn, ...s.modalBtn, background: 'var(--danger, #e5484d)' }}
                  onClick={onConfirm} disabled={busy}>
            {busy ? 'Uninstalling…' : 'Uninstall'}
          </button>
        </div>
      </div>
    </div>
  )
}

// One catalog tile. Pulled out so the focus/hover styles can live in
// local state without rerendering the whole grid on every pointer move.
function CatalogCard({ item, installed, installedVersions, onPick, onRetry, onUpdate, busy, error }) {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const m = item.manifest

  if (!m) {
    // Manifest hasn't loaded (or failed). Two sub-states:
    //  - error → muted dashed border + a small "Try again" affordance
    //  - still loading → skeleton (handled at the grid level instead;
    //    this branch only runs after the load resolved with no manifest)
    if (item.error) {
      return (
        <div style={s.card('error')}>
          <div style={{ ...s.iconWrap, marginBottom: '12px' }}>
            <span style={s.iconLetter}>{item.id.charAt(0).toUpperCase()}</span>
          </div>
          <div style={s.cardName}>{item.id}</div>
          <div style={s.cardErrorBody}>
            This app's manifest didn't load.
          </div>
          {onRetry && (
            <button
              style={s.cardRetryBtn}
              onClick={(e) => { e.stopPropagation(); onRetry(item) }}
            >
              Try again
            </button>
          )}
        </div>
      )
    }
    // Defensive — shouldn't render once skeletons land. Keep the slug
    // visible so a stuck card is still recognizable.
    return (
      <div style={s.card('default')}>
        <div style={s.iconWrap}>
          <span style={s.iconLetter}>{item.id.charAt(0).toUpperCase()}</span>
        </div>
        <div style={s.cardName}>{item.id}</div>
        <div style={s.cardVersion}>loading…</div>
      </div>
    )
  }

  // Match by manifest_url — the URL the app was installed from.
  // Slug is now pure routing (allocate_unique_slug on collision);
  // identity lives on manifest_url. A user-built app and a store-
  // installed app with the same slug coexist; the store can find
  // its own apps regardless of slug bumps.
  const storeInstalled = findInstalled(installed, item)
  const recordedVer = installedVersions[item.id]
  const installedVer = installedVersionFor(item, installedVersions, storeInstalled)
  const needsVersionSync = storeInstalled && !recordedVer
  const hasUpdate = storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0

  // Pill text + the accent dot prefix. Card-level variant (border /
  // installed-dot) is computed alongside so the visual signal lands
  // before the user finishes parsing the pill text.
  let statusLabel = 'Not installed'
  let statusVariant = 'available'
  let cardVariant = 'default'
  if (storeInstalled && hasUpdate) {
    statusLabel = `Update available · v${m.version}`
    statusVariant = 'update'
    cardVariant = 'update'
  } else if (needsVersionSync) {
    statusLabel = 'Installed · version unknown'
    statusVariant = 'installed'
    cardVariant = 'installed'
  } else if (storeInstalled) {
    statusLabel = 'Installed'
    statusVariant = 'installed'
    cardVariant = 'installed'
  }

  // Subtle lift on hover/focus so the tap target reads as interactive.
  // Update-available cards already carry an accent border, so we only
  // shadow + bump them rather than swapping border colour.
  const elevated = hover || focus
  const cardStyle = {
    ...s.card(cardVariant),
    ...(elevated ? {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 14%, transparent)',
      borderColor: cardVariant === 'update' ? 'var(--accent)' : 'var(--accent)',
    } : null),
    ...(focus ? {
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent)',
    } : null),
  }

  return (
    <div
      role="button"
      tabIndex={0}
      style={cardStyle}
      onClick={() => onPick(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(item) } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      aria-label={`${m.name} — ${statusLabel}. Tap for details.`}
    >
      <div style={s.iconSlot}>
        <IconBox item={item} />
        {cardVariant === 'installed' && (
          <div style={s.installedDot} aria-hidden="true">
            <div style={s.installedDotInner}>✓</div>
          </div>
        )}
      </div>
      <div style={s.cardName}>{m.name}</div>
      <div style={s.cardVersion}>v{m.version}</div>
      {m.description ? (
        <div style={s.cardDesc}>{m.description}</div>
      ) : null}
      <div style={s.cardStatusRow}>
        <span style={s.cardStatus(statusVariant)}>
          <span style={s.cardStatusDot(statusVariant)} aria-hidden="true" />
          {statusLabel}
        </span>
        {cardVariant === 'update' && onUpdate && (
          <button
            type="button"
            style={{ ...s.cardUpdateBtn, opacity: busy ? 0.65 : 1 }}
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); if (!busy) onUpdate(item) }}
            aria-label={`Update ${m.name} to v${m.version}`}
          >
            {busy ? 'Updating...' : 'Update'}
          </button>
        )}
      </div>
      {error && <div style={s.cardInlineError}>{error}</div>}
    </div>
  )
}

function CatalogList({ items, installed, installedVersions, onPick, onRetry, onUpdate, busy, errors }) {
  if (items.length === 0) {
    return <div style={s.empty}>No apps in the catalog yet.</div>
  }
  return (
    <div style={s.catalogGrid}>
      {items.map(item => (
        <CatalogCard
          key={item.id}
          item={item}
          installed={installed}
          installedVersions={installedVersions}
          onPick={onPick}
          onRetry={onRetry}
          onUpdate={onUpdate}
          busy={busy}
          error={errors?.[item.id]}
        />
      ))}
    </div>
  )
}

// Skeleton grid shown while catalog manifests are being fetched. Same
// card footprint as the real grid, so the layout doesn't shift when
// manifests resolve. Pulse keyframe is registered globally at root.
function CatalogSkeleton({ count = 5 }) {
  return (
    <div style={s.catalogGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={s.skeletonCard} aria-hidden="true">
          <div style={{ ...s.skeletonBlock('88px', '88px'), borderRadius: '20px', marginBottom: '12px' }} />
          <div style={{ ...s.skeletonBlock('72%', '12px'), marginBottom: '6px' }} />
          <div style={{ ...s.skeletonBlock('40%', '10px'), marginBottom: '12px' }} />
          <div style={{ ...s.skeletonBlock('90%', '8px'), marginBottom: '6px' }} />
          <div style={{ ...s.skeletonBlock('80%', '8px'), marginBottom: '6px' }} />
          <div style={{ ...s.skeletonBlock('60%', '8px') }} />
        </div>
      ))}
    </div>
  )
}

// Pull a hostname out of a possibly-incomplete URL string. Returns ''
// for blank or unparseable input so the live badge can simply skip
// rendering instead of throwing.
function hostnameOf(raw) {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try { return new URL(trimmed).hostname } catch { return '' }
}

function FromUrlTab({ onPreview }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)

  const host = hostnameOf(url)
  // Three live states for the badge: nothing typed yet (suppress),
  // trusted host (calm accent badge), unfamiliar host (muted badge).
  // Trusted does NOT mean "safe" — it just means "we recognize this
  // hosting service." The detail-page preview is where the actual
  // contents get reviewed before commit.
  let hostKind = null
  if (host) hostKind = TRUSTED_HOSTS.has(host) ? 'trusted' : 'unfamiliar'

  const handlePreview = async () => {
    const typed = url.trim()
    if (!typed) return
    setBusy(true)
    setError('')
    try {
      const trimmed = validateManifestUrl(typed)
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

  // Focus ring without :focus pseudo (inline styles can't express it).
  // Same accent ring the catalog cards use, so the visual language is
  // consistent across tabs.
  const inputStyle = {
    ...s.urlInput,
    ...(focused ? {
      borderColor: 'var(--accent)',
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)',
    } : null),
  }

  return (
    <div style={s.urlForm}>
      <label style={s.urlLabel} htmlFor="app-store-manifest-url">Manifest URL</label>
      <div style={s.urlHint}>
        Paste a public link to a <code>mobius.json</code> file. The store
        will fetch the manifest, show you what it declares, and let you
        review before installing.
      </div>
      <input
        id="app-store-manifest-url"
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="https://raw.githubusercontent.com/owner/app-foo/main/mobius.json"
        style={inputStyle}
        onKeyDown={e => e.key === 'Enter' && handlePreview()}
      />
      {hostKind && (
        <div style={s.hostBadge(hostKind)}>
          <span style={s.hostBadgeDot(hostKind)} aria-hidden="true" />
          {hostKind === 'trusted' ? (
            <>Recognized source · <span style={s.hostBadgeHost}>{host}</span></>
          ) : (
            <>Unfamiliar host · <span style={s.hostBadgeHost}>{host}</span></>
          )}
        </div>
      )}
      <button style={s.primaryBtn} onClick={handlePreview} disabled={busy || !url.trim()}>
        {busy ? 'Loading…' : 'Preview'}
      </button>
      {error && <div style={s.errorBox}>{error}</div>}
    </div>
  )
}

function DetailView({ item, installed, installedVersions, onBack, onInstall, onUninstall, onOpenInstalled, busy, updateNotice, onReviewUpdate, onDismissNotice }) {
  const m = item.manifest
  // Match by manifest_url — see CatalogList comment. Slug collisions
  // between user apps and store apps are resolved transparently by
  // allocate_unique_slug on the backend; the store reads its own
  // installed apps via manifest_url, never slug.
  const storeInstalled = findInstalled(installed, item)
  const recordedVer = installedVersions[item.id]
  const installedVer = installedVersionFor(item, installedVersions, storeInstalled)
  const needsVersionSync = storeInstalled && !recordedVer
  const hasUpdate = storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0
  const ca = m.permissions?.cross_app_access || 'none'
  const sw = m.permissions?.share_with_apps || 'none'
  const ma = !!m.permissions?.manage_apps
  // Soft warn for unfamiliar hosts (paste-a-URL flow). Catalog entries
  // already resolve to trusted hosts, so they pass silently. Invalid
  // URLs fall through to the warn path on purpose. This is now the
  // last checkpoint before install — there is no second confirm modal.
  const unfamiliarHost = item.manifest_url && !isTrustedHost(item.manifest_url)
  let warnHost = ''
  if (unfamiliarHost) {
    try { warnHost = new URL(item.manifest_url).hostname } catch { warnHost = item.manifest_url }
  }
  const scheduleText = scheduleSummary(m.schedule)

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
          <PermissionRow
            label="Other apps' data"
            level={ca}
            info={PERM_EXPLAIN.cross_app_access[ca]}
          />
          <PermissionRow
            label="Sharing with other apps"
            level={sw}
            info={PERM_EXPLAIN.share_with_apps[sw]}
          />
          {('manage_apps' in (m.permissions || {})) && (
            <PermissionRow
              label="Install authority"
              level={ma ? 'yes' : 'no'}
              info={PERM_EXPLAIN.manage_apps[String(ma)]}
            />
          )}
        </div>

        {scheduleText && (
          <div style={s.detailSection}>
            <div style={s.sectionLabel}>Schedule</div>
            <div style={s.scheduleRow}>
              <div style={s.scheduleMain}>{scheduleText}</div>
              {m.schedule.user_configurable && (
                <div style={s.scheduleNote}>
                  Time is configurable from the app's settings after install.
                </div>
              )}
            </div>
          </div>
        )}

        {m.runtime?.esm_deps?.length > 0 && (
          <div style={s.detailSection}>
            <div style={s.sectionLabel}>External libraries</div>
            <div style={s.esmNote}>
              Loads {m.runtime.esm_deps.length === 1 ? 'one library' : `${m.runtime.esm_deps.length} libraries`}
              {' '}from esm.sh on first open. Fetched once and cached locally afterwards.
              <div style={s.esmDepList}>{m.runtime.esm_deps.join(', ')}</div>
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
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
              Currently installed: {installedVer ? `v${installedVer}` : 'version unknown'}.
              {needsVersionSync ? ' Run an update check to sync the store’s version record.' : ''}
            </div>
            {updateNotice && (
              <div style={s.updateNotice}>
                <div>{updateNotice.message}</div>
                <div style={s.updateNoticeActions}>
                  <button
                    type="button"
                    style={{ ...s.bigBtn, flex: 1 }}
                    onClick={() => onReviewUpdate(updateNotice)}
                    disabled={busy}
                  >
                    {busy
                      ? 'Opening chat...'
                      : updateNotice.kind === 'conflict'
                      ? 'Resolve in chat'
                      : 'Review in chat'}
                  </button>
                  <button
                    type="button"
                    style={{ ...s.dangerBtn, flex: 1, color: 'var(--muted)' }}
                    onClick={onDismissNotice}
                    disabled={busy}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {unfamiliarHost && (
          <div style={s.detailSection}>
            <div style={s.hostWarn}>
              <div style={s.hostWarnIcon} aria-hidden="true">⚠</div>
              <div>
                <div>Unfamiliar host: <span style={s.hostWarnHost}>{warnHost}</span></div>
                <div style={s.hostWarnBody}>
                  You're installing from a host that isn't in the trusted
                  list. Continue only if you trust the author.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer hierarchy by state:
          - not installed: single "Install" primary
          - installed + update available: "Update to vX" primary (green tint)
            on top, "Uninstall" muted text link below
          - installed (up-to-date): "Open App" primary on top, "Uninstall"
            muted text link below — Open is the user's main path, Uninstall
            shouldn't compete visually for the tap.
          The Install/Update button commits directly — there is no second
          confirm modal. DetailView is the confirmation surface; the user
          already saw permissions, schedule, esm.sh deps and the host
          warning above before reaching this button. */}
      <div style={s.detailFooter}>
        <button
          style={{
            ...s.bigBtn,
            background: (hasUpdate || needsVersionSync) ? 'var(--green)' : 'var(--accent)',
          }}
          disabled={busy}
          onClick={() => {
            if (busy) return
            if (hasUpdate || needsVersionSync) onInstall(item, { isUpdate: true, existingId: storeInstalled.id })
            else if (storeInstalled) onOpenInstalled(storeInstalled.id)
            else onInstall(item, { isUpdate: false })
          }}
        >
          {busy
            ? (hasUpdate ? 'Updating…' : needsVersionSync ? 'Checking…' : 'Installing…')
            : hasUpdate ? `Update to v${m.version}`
            : needsVersionSync ? 'Check for updates'
            : storeInstalled ? 'Open App'
            : 'Install'}
        </button>
        {storeInstalled && (
          <button style={s.secondaryLink} onClick={() => onUninstall(storeInstalled)} disabled={busy}>
            Uninstall
          </button>
        )}
      </div>
    </>
  )
}

// One small `<style>` injected at the root so we can use keyframes
// (inline `style` props don't support @keyframes). Kept tightly scoped
// to this app's class names so it can't bleed into the shell.
function GlobalKeyframes() {
  return (
    <style>{`
      @keyframes mobius-store-pulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 0.95; }
      }
    `}</style>
  )
}

// Self-update banner. The store is a core app and not in its own catalog grid,
// so it checks for its OWN updates here: fetch the published manifest once, and
// when that version is newer than the running STORE_VERSION, offer a one-tap
// update that runs the same install transaction every other app uses, then
// prompt a reload so the freshly-patched code loads. Renders null when current.
function SelfUpdateBanner({ token }) {
  const [latest, setLatest] = useState(null)   // manifest of the published store
  const [phase, setPhase] = useState('idle')   // idle | updating | done | error
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchManifest(STORE_SELF.manifest_url)
      .then(m => { if (!cancelled) setLatest(m) })
      .catch(() => {})   // a failed self-check is silent — never block the grid
    return () => { cancelled = true }
  }, [])

  const hasUpdate = latest && semverCmp(STORE_VERSION, latest.version) < 0
  if (phase !== 'done' && !hasUpdate) return null

  const bannerStyle = {
    display: 'flex', alignItems: 'center', gap: '12px',
    margin: '0 0 16px', padding: '12px 16px',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
    border: '1px solid var(--accent)', borderRadius: '12px',
    fontSize: '14px', lineHeight: 1.4,
  }
  const btnStyle = {
    flexShrink: 0, border: 'none', borderRadius: '8px', padding: '8px 16px',
    background: 'var(--accent)', color: '#fff', fontWeight: 600,
    fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font)',
    minHeight: '36px',
  }

  const onUpdate = async () => {
    setPhase('updating'); setMsg('')
    try {
      await installApp({ manifest: latest, raw_base: STORE_SELF.raw_base, token })
      setPhase('done')
    } catch (e) {
      setPhase('error'); setMsg(e.message || String(e))
    }
  }

  return (
    <div style={bannerStyle}>
      {phase === 'done' ? (
        <>
          <div style={{ flex: 1 }}>App Store updated to v{latest.version}. Reload to apply.</div>
          <button style={btnStyle} onClick={() => window.location.reload()}>Reload</button>
        </>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            App Store v{latest.version} is available{phase === 'error' && msg ? ` — ${msg}` : ''}.
          </div>
          <button style={btnStyle} disabled={phase === 'updating'} onClick={onUpdate}>
            {phase === 'updating' ? 'Updating…' : 'Update'}
          </button>
        </>
      )}
    </div>
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
  const navDetailRef = useRef(null)  // pending detail item during nav-push ack
  const [pendingUninstall, setPendingUninstall] = useState(null)
  // pendingUninstall: the installed app row from /api/apps/.
  // Browser modal dialogs are silently no-op'd inside the AppCanvas
  // iframe (sandbox lacks `allow-modals`), so we stage the
  // confirmation as in-app state and render our own modal.
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [updateNotice, setUpdateNotice] = useState(null)
  const [cardErrors, setCardErrors] = useState({})
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  // Guard against overlapping refreshes when several visibility/focus
  // events fire in quick succession (e.g. drawer-close + tab-focus on
  // mobile fire visibilitychange and focus a frame apart). A simple
  // boolean is enough — we only care that one refresh is in flight.
  const refreshingRef = useRef(false)

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
    if (refreshingRef.current) return
    refreshingRef.current = true
    try {
      const apps = await loadInstalledApps(token)
      setInstalled(apps)
    } finally {
      refreshingRef.current = false
    }
  }, [token])

  // The drawer-delete path lives in the shell, not here — when the user
  // uninstalls from the drawer and navigates back, our `installed`
  // state still shows the deleted row as "Installed" until something
  // re-fetches /api/apps/. Subscribe to the same trio of events the
  // storage shim already uses to drain its outbox: visibilitychange +
  // focus + pageshow. Polling would be wasteful — these three cover
  // every realistic path back into a foregrounded App Store iframe
  // (drawer dismiss, tab refocus, mobile bfcache restore).
  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== 'visible') return
      refreshInstalled()
    }
    document.addEventListener('visibilitychange', maybeRefresh)
    window.addEventListener('focus', maybeRefresh)
    window.addEventListener('pageshow', maybeRefresh)
    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh)
      window.removeEventListener('focus', maybeRefresh)
      window.removeEventListener('pageshow', maybeRefresh)
    }
  }, [refreshInstalled])

  // Re-fetch a single catalog manifest. Wired into CatalogCard's
  // "Try again" affordance — replaces the previous behavior where a
  // failed manifest stayed dead until the whole app reloaded.
  const retryCatalogItem = useCallback(async (item) => {
    setCatalog(prev => prev.map(c =>
      c.id === item.id ? { ...c, manifest: null, error: null, _retrying: true } : c
    ))
    try {
      const manifest = await fetchManifest(item.manifest_url)
      setCatalog(prev => prev.map(c =>
        c.id === item.id ? { ...c, manifest, error: null, _retrying: false } : c
      ))
    } catch (e) {
      setCatalog(prev => prev.map(c =>
        c.id === item.id ? { ...c, manifest: null, error: e.message || String(e), _retrying: false } : c
      ))
    }
  }, [])

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

  // Install / update runs inline from DetailView's primary button.
  // There is no intermediate confirm modal — DetailView is the
  // confirmation surface (permissions, schedule, esm.sh deps and the
  // unfamiliar-host warning are all rendered there). `busy` flips so
  // the button can disable + show "Installing…" while in flight.
  const handleInstall = async (item, _opts = {}) => {
    if (busy) return
    setBusy(true)
    setCardErrors(prev => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    setUpdateNotice(null)
    try {
      // The backend decides install vs update based on manifest.id ↔
      // App.slug match. We pass manifest + raw_base; the install endpoint
      // re-fetches nothing else from us.
      const result = await installApp({
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
      })
      const isConflict = result.mode === 'conflict'
      const isSeamlessUpdate = result.mode === 'update' &&
        (result.divergence === 'fast_forward' || result.divergence === 'none')
      const isCleanMerge = result.mode === 'update' && result.divergence === 'clean_merge'

      if (isConflict) {
        const notice = {
          kind: 'conflict',
          itemId: item.id,
          appId: result.id,
          message: `A clean update to v${result.version || item.manifest?.version} isn't possible — your edits conflict.`,
          result,
          item,
        }
        setUpdateNotice(notice)
        await refreshInstalled()
        if (!detail) await openDetail(item)
        return
      }

      // Record the version we just installed so update detection
      // works on the next browse render. The backend returns the
      // version it actually applied, which is authoritative.
      const nextVersions = { ...installedVersions, [item.id]: result.version }
      setInstalledVersions(nextVersions)
      await saveInstalledVersions(appId, token, nextVersions)
      await refreshInstalled()

      if (isSeamlessUpdate) {
        setToast({
          kind: 'success',
          message: `Updated to v${result.version || item.manifest?.version}.`,
        })
        return
      }

      if (isCleanMerge) {
        const notice = {
          kind: 'clean_merge',
          itemId: item.id,
          appId: result.id,
          message: `Updated to v${result.version || item.manifest?.version}. You'd edited this app; double-check the merge?`,
          result,
          item,
        }
        setUpdateNotice(notice)
        if (!detail) await openDetail(item)
        return
      }

      const verb = result.mode === 'update' ? 'updated' : 'installed'
      const warnSuffix = result.warnings.length
        ? ` (with notes: ${result.warnings.join('; ')})`
        : ''
      // No "reload to see it in the drawer" hint — the backend emits an
      // app_updated SSE event after install/update, and the shell listens
      // for that and refreshes its drawer automatically. The toast just
      // confirms what happened.
      setToast({
        kind: 'success',
        message: `${result.name} ${verb}${warnSuffix}.`,
      })
      // Stay on the detail view. Two reasons: (1) closing here would
      // bounce the user back to the catalog grid mid-action, which felt
      // like the app didn't acknowledge the tap. (2) after refreshInstalled
      // resolves the detail re-renders with the installed state — the
      // primary CTA flips from "Install" to "Open App", confirming the
      // commit on the same surface the user committed it from. The user
      // can use the back arrow / device-back to dismiss when ready.
    } catch (e) {
      const message = e.message || String(e)
      setCardErrors(prev => ({ ...prev, [item.id]: message }))
      setToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }

  const handleReviewUpdate = async (notice) => {
    if (busy || !notice) return
    setBusy(true)
    setCardErrors(prev => {
      const next = { ...prev }
      delete next[notice.itemId]
      return next
    })
    try {
      const preview = await loadUpdatePreview(notice.appId, token)
      const title = notice.kind === 'conflict'
        ? `Resolve ${notice.result.name || notice.item.manifest?.name || notice.item.id} update`
        : `Review ${notice.result.name || notice.item.manifest?.name || notice.item.id} update`
      const chat = await createAppChat(title, token)
      const content = notice.kind === 'conflict'
        ? buildConflictResolveMessage({ item: notice.item, result: notice.result, preview })
        : buildCleanMergeReviewMessage({ item: notice.item, result: notice.result, preview })
      await seedChatMessage(chat.id, content, token)
      openChat(chat.id)
    } catch (e) {
      const message = e.message || String(e)
      setCardErrors(prev => ({ ...prev, [notice.itemId]: message }))
      setToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }

  // Stage the uninstall — DetailView's Uninstall button calls this,
  // and the modal's Confirm calls confirmUninstall to actually run
  // the DELETE. Splitting these out is required because the iframe
  // sandbox blocks browser modal dialogs; see pendingUninstall comment.
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
      // Drop the version record too, matched by the canonical identity key the
      // backend stamps on every install — NOT slug == manifest.id. A slug can be
      // suffixed on collision (e.g. "news-2"), so a slug match would miss it and
      // leave a stale version entry that fakes an "update available" on reinstall.
      const next = { ...installedVersions }
      for (const item of catalog) {
        const manifestId = item.manifest?.id || item.id
        if (app.manifest_url &&
            canonicalIdentityKey(item.manifest_url, manifestId) === app.manifest_url) {
          delete next[item.id]
        }
      }
      setInstalledVersions(next)
      await saveInstalledVersions(appId, token, next)
      await refreshInstalled()
      setToast({ kind: 'success', message: `${app.name} uninstalled.` })
      setPendingUninstall(null)
      closeDetail()
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

  // Integrate with the shell's back-stack so device back / swipe-back
  // dismisses the detail view first instead of closing the whole app.
  // Same protocol prod's klix-filter uses (moebius:nav-push / nav-pop
  // / nav-back postMessages, validated by Shell.jsx). When the shell
  // tells us the user navigated back, we clear `detail` ourselves; the
  // shell has already popped its sentinel so we don't echo nav-pop.
  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'moebius:nav-back') {
        setDetail(null)
        navDetailRef.current = null
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // openDetail: ask the shell to push a back-sentinel BEFORE rendering
  // the detail view, so a swipe-back gesture snapshots the catalog as
  // the under-page. The ack/rejected pair (with requestId) keeps
  // concurrent pushes from cross-resolving.
  const openDetail = useCallback(async (item) => {
    if (!item || !item.manifest) return
    if (detail) {
      // Already in a detail view (defensive — UI shouldn't allow this).
      // Swap without a second nav-push.
      setDetail(item)
      return
    }
    const requestId = `np-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    navDetailRef.current = item
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          window.removeEventListener('message', onAck)
          reject(new Error('nav-push ack timeout'))
        }, 5000)
        function onAck(event) {
          if (event.origin !== window.location.origin) return
          if (event.data?.requestId !== requestId) return
          if (event.data.type === 'moebius:nav-push-ack') {
            clearTimeout(timer)
            window.removeEventListener('message', onAck)
            resolve()
          } else if (event.data.type === 'moebius:nav-push-rejected') {
            clearTimeout(timer)
            window.removeEventListener('message', onAck)
            reject(new Error('rejected'))
          }
        }
        window.addEventListener('message', onAck)
        window.parent.postMessage(
          { type: 'moebius:nav-push', label: 'app-store-detail', requestId },
          window.location.origin,
        )
      })
      setDetail(item)
    } catch {
      // Older shell without ack support, or the host hung — fall back
      // to rendering the detail anyway. The back gesture will close the
      // whole app instead of the detail view, but the detail is still
      // usable.
      navDetailRef.current = null
      setDetail(item)
    }
  }, [detail])

  // closeDetail: tell the shell to pop its sentinel, then clear our
  // own detail state. Idempotent — calling when detail is already
  // null is a no-op.
  const closeDetail = useCallback(() => {
    if (!detail) return
    window.parent.postMessage(
      { type: 'moebius:nav-pop' },
      window.location.origin,
    )
    setDetail(null)
    navDetailRef.current = null
  }, [detail])

  // Detail view replaces the main layout when set.
  if (detail) {
    return (
      <div style={s.root}>
        <GlobalKeyframes />
        <DetailView
          item={detail}
          installed={installed}
          installedVersions={installedVersions}
          onBack={closeDetail}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          onOpenInstalled={handleOpenInstalled}
          busy={busy}
          updateNotice={updateNotice?.itemId === detail.id ? updateNotice : null}
          onReviewUpdate={handleReviewUpdate}
          onDismissNotice={() => setUpdateNotice(null)}
        />
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
      <GlobalKeyframes />
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
          <>
            <SelfUpdateBanner token={token} />
            {loadingCatalog
              ? <CatalogSkeleton count={CATALOG.length} />
              : <CatalogList
                  items={catalog}
                  installed={installed}
                  installedVersions={installedVersions}
                  onPick={(item) => item.manifest && openDetail(item)}
                  onRetry={retryCatalogItem}
                  onUpdate={handleInstall}
                  busy={busy}
                  errors={cardErrors}
                />}
          </>
        )}
        {tab === 'url' && (
          <FromUrlTab onPreview={openDetail} />
        )}
      </div>

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
