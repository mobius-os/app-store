import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'

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
    id: 'cuberun',
    repo: 'mobius-os/app-cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/',
  },
  {
    id: 'latex',
    repo: 'mobius-os/app-latex',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/',
  },
  {
    id: 'notes',
    repo: 'mobius-os/app-notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
  },
  {
    id: 'editor',
    repo: 'mobius-os/app-editor',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-editor/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-editor/main/',
  },
  {
    id: 'webstudio',
    repo: 'mobius-os/app-webstudio',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-webstudio/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-webstudio/main/',
  },
  // Dreaming + Mind are platform CORE apps (installed by install-core-apps and
  // re-synced on every deploy), not store-installable. `core: true` surfaces
  // them as "Built in" — discoverable + openable, but with no install / update
  // / uninstall path, so there is no row to fork into a dup and no store
  // update to fight the deploy re-sync. findInstalled() resolves them by slug.
  {
    id: 'dreaming',
    repo: 'mobius-os/app-dreaming',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-dreaming/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-dreaming/main/',
    core: true,
  },
  {
    id: 'mind',
    repo: 'mobius-os/app-mind',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-mind/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-mind/main/',
    core: true,
  },
]

// The store's OWN version — keep in lockstep with mobius.json on each release.
// The store is a core app, so it isn't in installed-versions.json or the
// catalog grid; it self-updates via the banner below: fetch its published
// manifest and, when that version is newer than what's running, offer a
// one-tap update (the same install transaction every other app uses) followed
// by a reload so the freshly-patched code loads.
const STORE_VERSION = '1.4.16'
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
export function findInstalled(installed, item) {
  const manifestId = item.manifest?.id || item.id
  const canonical = canonicalIdentityKey(item.manifest_url, manifestId)
  const byCanonical = installed.find(a => a.manifest_url === canonical)
  if (byCanonical) return byCanonical
  // Core apps (Dreaming, Mind) are installed by the platform, not the store, so
  // a fresh instance's row may carry no manifest_url to canonicalise against.
  // Fall back to the stable core slug so the store still recognises + opens them.
  if (item.core) return installed.find(a => a.slug === item.id) || null
  return null
}

function installedVersionFor(item, installedVersions, installedApp) {
  return installedVersions[item.id] ||
    installedApp?.version ||
    installedApp?.manifest?.version ||
    ''
}

// One module-level stylesheet rendered once at the app root as
// <style>{CSS}</style>. Style is via semantic `st-`-prefixed classNames;
// inline style={} is reserved for render-time dynamic values (the footer
// CTA's state-driven background, the skeleton block dimensions, the
// installed-dot's update tint). App-driven variants ride is-* modifier
// classes, never JS style helpers. Shared chrome (root, segmented tabs,
// empty, sheet, buttons, toast) is fenced with mobius-ui markers so a
// future extraction into @mobius/ui is mechanical.
const CSS = `
/* mobius-ui:Root v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-root {
  position: relative;        /* anchor for scrims / sheets / toasts (absolute, not fixed) */
  height: 100%; display: flex; flex-direction: column;
  background: var(--bg); color: var(--text);
  font-family: var(--font); overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.st-scroll { flex: 1; overflow: auto; padding: 16px; overscroll-behavior: contain; }
/* /mobius-ui:Root */

/* App-specific header — title + a segmented tab bar, not the canonical
   brand-cluster header. Kept on the store's own values. */
.st-header {
  padding: 16px 16px 12px; flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.st-title-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.st-title { font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }

/* mobius-ui:Segmented v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-seg {
  display: inline-flex; gap: 2px; padding: 3px;
  background: var(--surface2, var(--surface)); border: 1px solid var(--border); border-radius: 10px;
}
.st-seg-btn {
  min-height: 44px; padding: 6px 14px; border: 0; border-radius: 7px;
  background: transparent; color: var(--muted); font-family: var(--font);
  font-size: 13px; font-weight: 650; cursor: pointer; transition: background 0.15s, color 0.15s;
  touch-action: manipulation; user-select: none;
}
@media (hover: hover) {
  .st-seg-btn:hover { color: var(--text); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-seg-btn:active { opacity: 0.75; }
}
.st-seg-btn.is-active { background: var(--bg); color: var(--text); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }
.st-seg.is-accent .st-seg-btn.is-active { background: var(--accent); color: #fff; box-shadow: none; }
/* /mobius-ui:Segmented */

/* The store's full-width tab bar: segmented control stretched across the
   header, each button sharing the row equally. */
.st-tabs { display: flex; width: 100%; gap: 4px; border-radius: 10px; }
.st-tabs .st-seg-btn { flex: 1; }

/* App-specific catalog grid + tiles. The vertical-tile card diverges
   structurally from the canonical horizontal list Card, so it keeps the
   store's own values + class names. State rides is-* modifier classes. */
.st-catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}
.st-card {
  position: relative;
  display: flex; flex-direction: column;
  align-items: center; text-align: center;
  padding: 16px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 150ms, transform 150ms, box-shadow 150ms, background 150ms;
  min-height: 44px;
  outline: none;
  touch-action: manipulation; user-select: none;
}
.st-card.is-update {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-color: var(--accent);
}
.st-card.is-installed {
  background: color-mix(in srgb, var(--text) 5%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--text) 22%, var(--border));
}
.st-card.is-error {
  border: 1px dashed var(--border);
  cursor: default;
}
/* Interaction lift — gated on hover:hover so touch devices don't get stuck hover states. */
@media (hover: hover) {
  .st-card[role="button"]:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 14%, transparent);
    border-color: var(--accent);
  }
}
.st-card[role="button"]:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
  border-color: var(--accent);
}
@media (prefers-reduced-motion: no-preference) {
  .st-card[role="button"]:active { transform: scale(0.98); opacity: 0.9; }
}
.st-icon-wrap {
  width: 88px; height: 88px; border-radius: 20px;
  background: var(--surface2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
/* A relative anchor around the IconBox so the "installed" check dot can
   sit at the icon's bottom-right corner without leaking out of
   .st-icon-wrap's overflow: hidden. Spacing-below lives on this slot. */
.st-icon-slot { position: relative; margin-bottom: 12px; display: inline-block; }
.st-icon-img { width: 100%; height: 100%; object-fit: cover; }
.st-icon-letter { font-size: 34px; font-weight: 700; color: var(--accent); }
/* A tiny check dot sits at the icon's bottom-right when the app is
   already installed. Quicker to read than the pill text, lets the grid
   double as an "at a glance" inventory. */
.st-installed-dot {
  position: absolute;
  bottom: -2px; right: -2px;
  width: 22px; height: 22px; border-radius: 999px;
  background: var(--surface);
  border: 2px solid var(--surface);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
.st-installed-dot-inner {
  width: 18px; height: 18px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 80%, var(--surface));
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; line-height: 1;
}
.st-installed-dot-inner.is-update { background: var(--accent); }
.st-card-name {
  font-size: 14px; font-weight: 600; line-height: 1.25;
  margin-bottom: 4px;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.st-card-version {
  font-size: 12px; color: var(--muted);
  font-family: var(--mono, monospace);
  margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px;
}
.st-card-agent {
  font-family: var(--font, inherit); font-weight: 600;
  font-size: 12px; letter-spacing: 0.02em;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  border-radius: 999px; padding: 1px 7px;
}
.st-card-desc {
  font-size: 12px; color: var(--muted); line-height: 1.35;
  margin-bottom: 12px;
  display: -webkit-box; -webkit-line-clamp: 3;
  -webkit-box-orient: vertical; overflow: hidden;
  text-align: center;
  min-height: 48px;
}
/* Top-border separator between the description and the one card action.
   Each card reads as exactly one state/action: Install, Installed, or Update. */
.st-card-status-row {
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 8px;
}
.st-card-action {
  width: 100%;
  min-height: 34px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 5px 12px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font);
  touch-action: manipulation; user-select: none;
}
.st-card-action.is-update { background: var(--green, var(--accent)); }
.st-card-action.is-installed {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 18%, var(--border));
}
.st-card-action:disabled { opacity: 0.65; cursor: default; pointer-events: none; }
@media (prefers-reduced-motion: no-preference) {
  .st-card-action:not(:disabled):active { opacity: 0.8; transform: scale(0.97); }
}
.st-card-inline-error {
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger, #e5484d) 10%, transparent);
  color: var(--danger);
  font-size: 12px;
  line-height: 1.35;
  border: 1px solid color-mix(in srgb, var(--danger, #e5484d) 30%, transparent);
  box-sizing: border-box;
}
/* Skeleton placeholder — same shape as a card so the grid doesn't reflow
   when the real manifests arrive. Per-block width/height stay inline. */
.st-skeleton-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 16px 12px;
  background: var(--surface);
  border: 1px solid var(--border); border-radius: 12px;
  min-height: 44px;
  opacity: 0.7;
}
.st-skeleton-block {
  border-radius: 6px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  animation: mobius-store-pulse 1.4s ease-in-out infinite;
}
@keyframes mobius-store-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
}
.st-card-error-body {
  font-size: 12px; color: var(--muted); line-height: 1.4;
  margin-top: 4px; margin-bottom: 12px;
  text-align: center;
}
.st-card-retry {
  padding: 6px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text); font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: var(--font);
  min-height: 32px;
  transition: background 150ms;
  touch-action: manipulation; user-select: none;
}
@media (prefers-reduced-motion: no-preference) {
  .st-card-retry:active { opacity: 0.75; }
}

/* App-specific "From URL" tab. */
.st-url-form {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px;
}
.st-url-label { font-size: 14px; font-weight: 600; margin-bottom: 8px; display: block; }
.st-url-hint { font-size: 12px; color: var(--muted); margin-bottom: 12px; line-height: 1.5; }
.st-url-input {
  width: 100%; padding: 12px;
  background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; font-family: var(--mono, monospace);
  outline: none; box-sizing: border-box;
  margin-bottom: 12px;
  min-height: 44px;
  transition: border-color 150ms, box-shadow 150ms;
}
/* Focus ring — was JS focused state, now a real :focus pseudo-class.
   Same accent ring the catalog cards use. */
.st-url-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
.st-primary-btn {
  padding: 12px 20px; border-radius: 10px; border: none;
  background: var(--accent); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font);
  min-height: 44px;
  transition: background 150ms;
  touch-action: manipulation; user-select: none;
}
.st-primary-btn:disabled { pointer-events: none; opacity: 0.65; }
@media (hover: hover) {
  .st-primary-btn:not(:disabled):hover { filter: brightness(1.08); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-primary-btn:not(:disabled):active { opacity: 0.82; transform: scale(0.98); }
}
/* Live host indicator below the URL input — switches between "trusted
   source" (calm accent badge) and "unfamiliar host" (muted, not red —
   a personal repo is legitimate; inform, don't alarm). State = is-*. */
.st-host-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 500;
  font-family: var(--font);
  background: color-mix(in srgb, var(--text) 6%, transparent);
  color: var(--muted);
  border: 1px solid var(--border);
  margin-bottom: 12px;
}
.st-host-badge.is-trusted {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border-color: var(--accent);
}
.st-host-badge-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 60%, transparent);
  flex-shrink: 0;
}
.st-host-badge.is-trusted .st-host-badge-dot { background: var(--accent); }
.st-host-badge-host { font-family: var(--mono, monospace); font-size: 12px; }
.st-error-box {
  background: color-mix(in srgb, var(--danger, #e5484d) 12%, transparent);
  color: var(--danger); padding: 12px;
  border-radius: 8px; font-size: 14px;
  margin-top: 12px; line-height: 1.5;
  border: 1px solid color-mix(in srgb, var(--danger, #e5484d) 40%, transparent);
}

/* App-specific detail view. */
.st-detail-header {
  padding: 12px 16px; display: flex; align-items: center;
  gap: 8px; border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.st-back-btn {
  background: none; border: none; color: var(--accent);
  font-size: 14px; cursor: pointer; padding: 8px 12px;
  font-family: var(--font); font-weight: 500;
  min-height: 44px;
  display: inline-flex; align-items: center; gap: 4px;
  margin: -8px -8px;  /* compensate so the visible affordance still aligns */
  border-radius: 8px;
  transition: background 150ms;
  touch-action: manipulation; user-select: none;
}
@media (hover: hover) {
  .st-back-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-back-btn:active { opacity: 0.75; }
}
.st-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.st-hero-text { flex: 1; min-width: 0; }
.st-hero-icon {
  width: 72px; height: 72px; border-radius: 16px;
  background: var(--surface2); display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.st-hero-icon-letter { font-size: 32px; font-weight: 700; color: var(--accent); }
.st-hero-name { font-size: 22px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.01em; user-select: none; }
.st-hero-meta { font-size: 12px; color: var(--muted); font-family: var(--mono, monospace); user-select: none; }
.st-detail-desc { font-size: 14px; line-height: 1.55; color: var(--text); margin-bottom: 24px; }
.st-detail-section { margin-bottom: 24px; }
.st-section-label {
  font-size: 12px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 8px;
  user-select: none;
}
.st-permission-row {
  display: flex; gap: 12px;
  padding: 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
  margin-bottom: 8px; font-size: 14px; line-height: 1.5;
}
.st-perm-row-main { flex: 1; min-width: 0; }
.st-perm-label { font-weight: 600; color: var(--text); }
.st-perm-detail { color: var(--muted); }
.st-perm-hint { color: var(--muted); font-size: 12px; margin-top: 4px; }
/* A short capability tag next to each permission row. State (read / write /
   muted) rides is-* modifiers; 'no'/'none' both render muted. */
.st-perm-tag {
  flex-shrink: 0;
  padding: 2px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
  font-family: var(--font); letter-spacing: 0.02em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent);
  border: 1px solid var(--accent);
  align-self: flex-start;
}
.st-perm-tag.is-read { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.st-perm-tag.is-muted {
  background: color-mix(in srgb, var(--muted) 14%, transparent);
  color: var(--muted);
  border-color: var(--border);
}
.st-schedule-row {
  padding: 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 14px; line-height: 1.5;
}
.st-schedule-main { font-weight: 600; color: var(--text); }
.st-schedule-note { color: var(--muted); margin-top: 4px; font-size: 12px; }
/* External-libs disclosure — a quiet note on a muted surface, dep list
   mono-formatted (not an alarming panel). */
.st-esm-note {
  padding: 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 14px; line-height: 1.5;
  color: var(--muted);
}
.st-esm-dep-list {
  font-family: var(--mono, monospace);
  font-size: 12px;
  color: var(--text);
  margin-top: 6px;
  word-break: break-all;
}
.st-host-warn {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px; margin-bottom: 12px;
  background: var(--accent-dim, rgba(139, 108, 247, 0.15));
  border: 1px solid var(--accent); border-radius: 8px;
  font-size: 14px; line-height: 1.5;
}
.st-host-warn-icon { font-size: 16px; line-height: 1.2; color: var(--accent); flex-shrink: 0; }
.st-host-warn-host { font-weight: 600; color: var(--text); font-family: var(--mono, monospace); }
.st-host-warn-body { color: var(--muted); margin-top: 2px; }
.st-link { color: var(--accent); text-decoration: none; }
.st-installed-note { font-size: 14px; color: var(--muted); user-select: none; }
.st-detail-footer {
  padding: 16px; border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 8px;
  flex-shrink: 0; background: var(--bg);
}
/* The detail-footer primary CTA + the modal's confirm button share this
   full-width solid look. The footer CTA overrides background inline
   because the colour is state-driven (accent / green / blocked). */
.st-big-btn {
  width: 100%; padding: 12px 16px; border-radius: 10px;
  border: none; background: var(--accent); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font);
  min-height: 44px;
  transition: background 150ms, transform 150ms;
  touch-action: manipulation; user-select: none;
}
.st-big-btn:disabled { cursor: default; pointer-events: none; opacity: 0.65; }
@media (prefers-reduced-motion: no-preference) {
  .st-big-btn:not(:disabled):active { opacity: 0.82; transform: scale(0.98); }
}
.st-danger-btn {
  padding: 12px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: transparent;
  color: var(--danger); font-size: 14px; font-weight: 600;
  cursor: pointer; font-family: var(--font);
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
@media (hover: hover) {
  .st-danger-btn:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-danger-btn:not(:disabled):active { opacity: 0.8; }
}
.st-danger-btn:disabled { pointer-events: none; opacity: 0.65; }
/* Subordinate link-style "Uninstall" when the primary CTA is "Open App". */
.st-secondary-link {
  align-self: center;
  padding: 12px 16px; border-radius: 8px;
  border: none; background: transparent;
  color: var(--muted); font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: var(--font);
  text-decoration: underline;
  text-underline-offset: 2px;
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
.st-secondary-link:disabled { pointer-events: none; opacity: 0.5; }
/* Update notice on the detail view (clean-merge / conflict). App-specific. */
.st-update-notice {
  margin-top: 12px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.45;
}
.st-update-notice-actions { display: flex; gap: 8px; margin-top: 12px; }
.st-update-notice-actions .st-big-btn,
.st-update-notice-actions .st-danger-btn { flex: 1; }
.st-update-notice-actions .st-danger-btn { color: var(--muted); }

/* Self-update banner — the store checks for its own newer published
   version and offers a one-tap update + reload. App-specific. */
.st-banner {
  display: flex; align-items: center; gap: 12px;
  margin: 0 0 16px; padding: 12px 16px;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  border: 1px solid var(--accent); border-radius: 12px;
  font-size: 14px; line-height: 1.4;
}
.st-banner-msg { flex: 1; }
.st-banner-btn {
  flex-shrink: 0; border: none; border-radius: 8px; padding: 8px 16px;
  background: var(--accent); color: #fff; font-weight: 600;
  font-size: 13px; cursor: pointer; font-family: var(--font);
  min-height: 36px;
  touch-action: manipulation; user-select: none;
}
@media (prefers-reduced-motion: no-preference) {
  .st-banner-btn:not(:disabled):active { opacity: 0.8; transform: scale(0.97); }
}

/* mobius-ui:Empty v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
  max-width: 440px; margin: 0 auto; padding: 48px 24px; color: var(--muted);
}
.st-empty-title { font-size: 17px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.st-empty-text { margin: 0; font-size: 14px; line-height: 1.6; }
/* /mobius-ui:Empty */

/* mobius-ui:Sheet v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-scrim {
  position: absolute; inset: 0; z-index: 100;   /* absolute → stays inside the app, never over shell chrome */
  display: flex; align-items: flex-end; justify-content: center;
  padding: 16px; background: rgba(0, 0, 0, 0.5);
}
.st-sheet {
  width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto;
  padding: 24px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px 16px 0 0; box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
  overscroll-behavior: contain;
}
.st-sheet-title { margin: 0 0 12px; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.st-sheet-body { margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: var(--muted); }
.st-sheet-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
.st-sheet-actions .st-btn { flex: 1; }
/* /mobius-ui:Sheet */

/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 10px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  font-family: var(--font); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
  touch-action: manipulation; user-select: none;
}
@media (prefers-reduced-motion: no-preference) {
  .st-btn:not(:disabled):active { transform: scale(0.97); }
}
.st-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-btn:disabled { opacity: 0.5; cursor: default; pointer-events: none; }
.st-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
@media (hover: hover) {
  .st-btn-primary:hover { filter: brightness(1.06); }
  .st-btn-secondary:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
  .st-btn-ghost:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
.st-btn-secondary { background: var(--surface2, var(--surface)); }
.st-btn-ghost { background: transparent; border-color: transparent; color: var(--accent); }
.st-btn-danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.st-btn-icon { width: 44px; padding: 0; border-radius: 8px; font-size: 18px; }
/* /mobius-ui:Button */

/* mobius-ui:Toast v1 — keep in sync; library candidate. */
.st-toast {
  position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 200;   /* absolute → inside the app */
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: var(--surface); border: 1px solid var(--accent); border-radius: 12px;
  font-size: 14px; line-height: 1.5; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.st-toast.is-success { border-color: var(--green); }
.st-toast.is-error { border-color: var(--danger); }
.st-toast-msg { flex: 1; }
.st-toast-btn {
  padding: 8px 16px; border-radius: 8px; border: none;
  background: var(--accent); color: #fff;
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font); flex-shrink: 0;
  min-height: 32px;
  touch-action: manipulation; user-select: none;
}
@media (prefers-reduced-motion: no-preference) {
  .st-toast-btn:active { opacity: 0.8; transform: scale(0.97); }
}
/* /mobius-ui:Toast */
`

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
  const wrapClass = size === 'hero' ? 'st-hero-icon' : 'st-icon-wrap'
  const letterClass = size === 'hero' ? 'st-hero-icon-letter' : 'st-icon-letter'
  const name = (item.manifest && item.manifest.name) || item.name || '?'
  const letter = name.charAt(0).toUpperCase()
  if (url && !errored) {
    return (
      <div className={wrapClass}>
        <img src={url} alt="" className="st-icon-img" loading="lazy"
             onError={() => setErrored(true)} />
      </div>
    )
  }
  return (
    <div className={wrapClass}>
      <span className={letterClass}>{letter}</span>
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
// Map a permission level to the capability-tag modifier. 'no'/'none' both
// render muted; 'read' gets the lighter accent; granted write/yes uses the
// base (bolder accent) .st-perm-tag look.
function permTagClass(level) {
  if (level === 'none' || level === 'no') return 'st-perm-tag is-muted'
  if (level === 'read') return 'st-perm-tag is-read'
  return 'st-perm-tag'
}

function PermissionRow({ label, level, info }) {
  if (!info) return null
  return (
    <div className="st-permission-row" title={info.hint}>
      <div className="st-perm-row-main">
        <div className="st-perm-label">{label}</div>
        <div className="st-perm-detail">{info.summary}</div>
        <div className="st-perm-hint">
          {info.hint}
        </div>
      </div>
      <span className={permTagClass(level)}>{info.tag}</span>
    </div>
  )
}

function UninstallConfirmModal({ app, busy, onConfirm, onCancel }) {
  // Browser modal dialogs don't render inside the AppCanvas iframe
  // (sandbox lacks `allow-modals`), so we ship our own confirmation.
  return (
    <div className="st-scrim" onClick={busy ? null : onCancel}
         role="dialog" aria-modal="true" aria-label="Confirm uninstall">
      <div className="st-sheet" onClick={e => e.stopPropagation()}>
        <h3 className="st-sheet-title">Uninstall {app.name}?</h3>
        <p className="st-sheet-body">
          This removes the app and its stored data. You can reinstall
          it later from the store.
        </p>
        <div className="st-sheet-actions">
          <button className="st-btn st-btn-secondary"
                  onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="st-btn st-btn-danger"
                  onClick={onConfirm} disabled={busy}>
            {busy ? 'Uninstalling…' : 'Uninstall'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Map the card's app-state variant to its modifier class. 'default' is the
// bare .st-card; the rest add the matching is-* modifier.
function cardVariantClass(variant) {
  if (variant === 'update') return 'st-card is-update'
  if (variant === 'installed') return 'st-card is-installed'
  if (variant === 'error') return 'st-card is-error'
  return 'st-card'
}

// One catalog tile. The interactive lift (hover/focus) now lives in CSS
// pseudo-classes on .st-card[role="button"] rather than JS state, so the
// grid no longer rerenders a tile on every pointer move.
function CatalogCard({ item, installed, installedVersions, onPick, onRetry, onUpdate, busy, blocked, error }) {
  const m = item.manifest

  if (!m) {
    // Manifest hasn't loaded (or failed). Two sub-states:
    //  - error → muted dashed border + a small "Try again" affordance
    //  - still loading → skeleton (handled at the grid level instead;
    //    this branch only runs after the load resolved with no manifest)
    if (item.error) {
      return (
        <div className={cardVariantClass('error')}>
          <div className="st-icon-wrap" style={{ marginBottom: '12px' }}>
            <span className="st-icon-letter">{item.id.charAt(0).toUpperCase()}</span>
          </div>
          <div className="st-card-name">{item.id}</div>
          <div className="st-card-error-body">
            This app's manifest didn't load.
          </div>
          {onRetry && (
            <button
              className="st-card-retry"
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
      <div className={cardVariantClass('default')}>
        <div className="st-icon-wrap">
          <span className="st-icon-letter">{item.id.charAt(0).toUpperCase()}</span>
        </div>
        <div className="st-card-name">{item.id}</div>
        <div className="st-card-version">loading…</div>
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
  // A resolved installed version (now persisted as App.version) means there
  // is nothing to sync; only offer the sync affordance when no version is
  // known at all and the catalog hasn't reported a genuine update.
  const needsVersionSync = storeInstalled && !installedVer && !recordedVer
  const hasUpdate = storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0
  // One footer action plus a card-level variant (border / installed-dot)
  // so the state is obvious before the user opens details.
  let statusLabel = 'Install'
  let cardVariant = 'default'
  if (item.core) {
    // Platform core app — always present, never store-installable.
    statusLabel = 'Built in'
    cardVariant = 'installed'
  } else if (storeInstalled && hasUpdate) {
    statusLabel = 'Update'
    cardVariant = 'update'
  } else if (needsVersionSync) {
    statusLabel = 'Update'
    cardVariant = 'update'
  } else if (storeInstalled) {
    statusLabel = 'Installed'
    cardVariant = 'installed'
  }
  const isActionable = cardVariant !== 'installed'
  const cardActionDisabled = busy || blocked || !isActionable
  const actionLabel = busy
    ? cardVariant === 'update' ? 'Updating…' : 'Installing…'
    : statusLabel
  const stopCardEvent = (event) => event.stopPropagation()
  const onCardActionKeyDown = (event) => {
    event.stopPropagation()
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (cardActionDisabled) return
    if (cardVariant === 'update') onUpdate?.(item)
    else onPick(item)
  }
  const onCardAction = (event) => {
    event.stopPropagation()
    if (cardActionDisabled) return
    if (cardVariant === 'update') onUpdate?.(item)
    else onPick(item)
  }

  // The subtle hover/focus lift (translate + accent shadow/border) now
  // rides CSS pseudo-classes on .st-card[role="button"] — see the Card
  // rules in CSS. The action button's variant + disabled styling ride
  // is-* / :disabled, not inline objects.
  const cardActionClass = cardVariant === 'update'
    ? 'st-card-action is-update'
    : cardVariant === 'installed'
    ? 'st-card-action is-installed'
    : 'st-card-action'

  return (
    <div
      role="button"
      tabIndex={0}
      className={cardVariantClass(cardVariant)}
      onClick={() => onPick(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(item) } }}
      aria-label={`${m.name} — ${statusLabel}. Tap for details.`}
    >
      <div className="st-icon-slot">
        <IconBox item={item} />
        {(cardVariant === 'installed' || cardVariant === 'update') && (
          <div className="st-installed-dot" aria-hidden="true">
            <div className={`st-installed-dot-inner${cardVariant === 'update' ? ' is-update' : ''}`}>
              ✓
            </div>
          </div>
        )}
      </div>
      <div className="st-card-name">{m.name}</div>
      <div className="st-card-version">
        v{m.version}
        {m.embeds_agent ? (
          <span className="st-card-agent" title="This app has a built-in agent">agent</span>
        ) : null}
      </div>
      {m.description ? (
        <div className="st-card-desc">{m.description}</div>
      ) : null}
      <div className="st-card-status-row">
        <button
          type="button"
          className={cardActionClass}
          disabled={cardActionDisabled}
          onPointerDown={stopCardEvent}
          onMouseDown={stopCardEvent}
          onKeyDown={onCardActionKeyDown}
          onClick={onCardAction}
          aria-label={
            cardVariant === 'update'
              ? `Update ${m.name} to v${m.version}`
              : cardVariant === 'installed'
              ? `${m.name} is installed`
              : `Review and install ${m.name}`
          }
        >
          {actionLabel}
        </button>
      </div>
      {error && <div className="st-card-inline-error">{error}</div>}
    </div>
  )
}

function CatalogList({ items, installed, installedVersions, onPick, onRetry, onUpdate, busy, busyItemId, errors }) {
  if (items.length === 0) {
    return (
      <div className="st-empty">
        <p className="st-empty-text">No apps in the catalog yet.</p>
      </div>
    )
  }
  return (
    <div className="st-catalog-grid">
      {items.map(item => (
        <CatalogCard
          key={item.id}
          item={item}
          installed={installed}
          installedVersions={installedVersions}
          onPick={onPick}
          onRetry={onRetry}
          onUpdate={onUpdate}
          busy={busyItemId === item.id}
          blocked={busy && busyItemId !== item.id}
          error={errors?.[item.id]}
        />
      ))}
    </div>
  )
}

// Skeleton grid shown while catalog manifests are being fetched. Same
// card footprint as the real grid, so the layout doesn't shift when
// manifests resolve. Per-block width/height stay inline (dynamic
// dimensions); the pulse animation lives in CSS.
function CatalogSkeleton({ count = 5 }) {
  return (
    <div className="st-catalog-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="st-skeleton-card" aria-hidden="true">
          <div className="st-skeleton-block" style={{ width: '88px', height: '88px', borderRadius: '20px', marginBottom: '12px' }} />
          <div className="st-skeleton-block" style={{ width: '72%', height: '12px', marginBottom: '6px' }} />
          <div className="st-skeleton-block" style={{ width: '40%', height: '10px', marginBottom: '12px' }} />
          <div className="st-skeleton-block" style={{ width: '90%', height: '8px', marginBottom: '6px' }} />
          <div className="st-skeleton-block" style={{ width: '80%', height: '8px', marginBottom: '6px' }} />
          <div className="st-skeleton-block" style={{ width: '60%', height: '8px' }} />
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

  // The focus ring (accent border + glow) now lives in CSS via
  // .st-url-input:focus — same accent language the catalog cards use.

  return (
    <div className="st-url-form">
      <label className="st-url-label" htmlFor="app-store-manifest-url">Manifest URL</label>
      <div className="st-url-hint">
        Paste a public link to a <code>mobius.json</code> file. The store
        will fetch the manifest, show you what it declares, and let you
        review before installing.
      </div>
      <input
        id="app-store-manifest-url"
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://raw.githubusercontent.com/owner/app-foo/main/mobius.json"
        className="st-url-input"
        onKeyDown={e => e.key === 'Enter' && handlePreview()}
      />
      {hostKind && (
        <div className={`st-host-badge${hostKind === 'trusted' ? ' is-trusted' : ''}`}>
          <span className="st-host-badge-dot" aria-hidden="true" />
          {hostKind === 'trusted' ? (
            <>Recognized source · <span className="st-host-badge-host">{host}</span></>
          ) : (
            <>Unfamiliar host · <span className="st-host-badge-host">{host}</span></>
          )}
        </div>
      )}
      <button className="st-primary-btn" onClick={handlePreview} disabled={busy || !url.trim()}>
        {busy ? 'Loading…' : 'Preview'}
      </button>
      {error && <div className="st-error-box">{error}</div>}
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
  // A resolved installed version (now persisted as App.version) means there
  // is nothing to sync; only offer the sync affordance when no version is
  // known at all and the catalog hasn't reported a genuine update.
  // Core apps (Dreaming, Mind) are platform-managed: never offer install /
  // update / uninstall, only Open. The deploy re-syncs them, so a store update
  // would fight that — suppress the update + sync affordances here.
  const isCore = !!item.core
  const needsVersionSync = !isCore && storeInstalled && !installedVer && !recordedVer
  const hasUpdate = !isCore && storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0
  const blockedUpdate = updateNotice?.kind === 'conflict'
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
      <div className="st-detail-header">
        <button className="st-back-btn" onClick={onBack}>← Back</button>
      </div>
      <div className="st-scroll">
        <div className="st-hero">
          <IconBox item={item} size="hero" />
          <div className="st-hero-text">
            <h2 className="st-hero-name">{m.name}</h2>
            <div className="st-hero-meta">
              v{m.version}{m.author ? ` · ${m.author}` : ''}{m.license ? ` · ${m.license}` : ''}
            </div>
          </div>
        </div>

        <p className="st-detail-desc">{m.description}</p>

        <div className="st-detail-section">
          <div className="st-section-label">What this app can do</div>
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
          <div className="st-detail-section">
            <div className="st-section-label">Schedule</div>
            <div className="st-schedule-row">
              <div className="st-schedule-main">{scheduleText}</div>
              {m.schedule.user_configurable && (
                <div className="st-schedule-note">
                  Time is configurable from the app's settings after install.
                </div>
              )}
            </div>
          </div>
        )}

        {m.runtime?.esm_deps?.length > 0 && (
          <div className="st-detail-section">
            <div className="st-section-label">External libraries</div>
            <div className="st-esm-note">
              Loads {m.runtime.esm_deps.length === 1 ? 'one library' : `${m.runtime.esm_deps.length} libraries`}
              {' '}from esm.sh on first open. Fetched once and cached locally afterwards.
              <div className="st-esm-dep-list">{m.runtime.esm_deps.join(', ')}</div>
            </div>
          </div>
        )}

        {m.homepage && (
          <div className="st-detail-section">
            <div className="st-section-label">Source</div>
            <a href={m.homepage} target="_blank" rel="noopener noreferrer" className="st-link">
              {m.homepage}
            </a>
          </div>
        )}

        {storeInstalled && (
          <div className="st-detail-section">
            <div className="st-section-label">Installed</div>
            <div className="st-installed-note">
              Currently installed: {installedVer ? `v${installedVer}` : 'version unknown'}.
              {needsVersionSync ? ' Run an update check to sync the store’s version record.' : ''}
            </div>
            {updateNotice && (
              <div className="st-update-notice">
                <div>{updateNotice.message}</div>
                <div className="st-update-notice-actions">
                  <button
                    type="button"
                    className="st-big-btn"
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
                    className="st-danger-btn"
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
          <div className="st-detail-section">
            <div className="st-host-warn">
              <div className="st-host-warn-icon" aria-hidden="true">⚠</div>
              <div>
                <div>Unfamiliar host: <span className="st-host-warn-host">{warnHost}</span></div>
                <div className="st-host-warn-body">
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
      <div className="st-detail-footer">
        <button
          className="st-big-btn"
          style={{
            // State-driven CTA tint: green for an available update / sync,
            // accent otherwise — kept inline because it's computed per render.
            background: blockedUpdate
              ? 'var(--accent)'
              : (hasUpdate || needsVersionSync) ? 'var(--green)' : 'var(--accent)',
          }}
          disabled={busy}
          onClick={() => {
            if (busy) return
            if (blockedUpdate) {
              onReviewUpdate(updateNotice)
              return
            }
            if (hasUpdate || needsVersionSync) onInstall(item, { isUpdate: true, existingId: storeInstalled.id })
            else if (storeInstalled) onOpenInstalled(storeInstalled.id)
            else if (!isCore) onInstall(item, { isUpdate: false })
          }}
        >
          {busy
            ? (hasUpdate ? 'Updating…' : needsVersionSync ? 'Checking…' : 'Installing…')
            : blockedUpdate ? 'Resolve update'
            : hasUpdate ? `Update to v${m.version}`
            : needsVersionSync ? 'Check for updates'
            : storeInstalled ? 'Open App'
            : 'Install'}
        </button>
        {storeInstalled && !isCore && (
          <button className="st-secondary-link" onClick={() => onUninstall(storeInstalled)} disabled={busy}>
            Uninstall
          </button>
        )}
      </div>
    </>
  )
}

// Self-update banner. The store is a core app and not in its own catalog grid,
// so it checks for its OWN updates here: fetch the published manifest once, and
// when that version is newer than the running STORE_VERSION, offer a one-tap
// update that runs the same install transaction every other app uses, then
// prompt a reload so the freshly-patched code loads. Renders null when current.
function SelfUpdateBanner({ token }) {
  const [latest, setLatest] = useState(null)   // manifest of the published store
  const [phase, setPhase] = useState('idle')   // idle | updating | done | conflict | error
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchManifest(STORE_SELF.manifest_url)
      .then(m => { if (!cancelled) setLatest(m) })
      .catch(() => {})   // a failed self-check is silent — never block the grid
    return () => { cancelled = true }
  }, [])

  const hasUpdate = latest && semverCmp(STORE_VERSION, latest.version) < 0
  if (phase !== 'done' && phase !== 'conflict' && !hasUpdate) return null

  const onUpdate = async () => {
    setPhase('updating'); setMsg('')
    try {
      const result = await installApp({ manifest_url: STORE_SELF.manifest_url, token })
      if (result.mode === 'conflict') {
        const paths = result.conflict_paths?.length
          ? ` Conflicts: ${result.conflict_paths.join(', ')}.`
          : ''
        setPhase('conflict')
        setMsg(`Blocked by local App Store edits.${paths}`)
        return
      }
      setPhase('done')
    } catch (e) {
      setPhase('error'); setMsg(e.message || String(e))
    }
  }

  return (
    <div className="st-banner">
      {phase === 'done' ? (
        <>
          <div className="st-banner-msg">App Store updated to v{latest.version}. Reload to apply.</div>
          <button className="st-banner-btn" onClick={() => window.location.reload()}>Reload</button>
        </>
      ) : phase === 'conflict' ? (
        <>
          <div className="st-banner-msg">
            App Store v{latest.version} is available, but the update is blocked. {msg}
          </div>
          <button className="st-banner-btn" onClick={onUpdate}>Retry</button>
        </>
      ) : (
        <>
          <div className="st-banner-msg">
            App Store v{latest.version} is available{phase === 'error' && msg ? ` — ${msg}` : ''}.
          </div>
          <button className="st-banner-btn" disabled={phase === 'updating'} onClick={onUpdate}>
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
  // B1: preserve the catalog grid's scroll across opening a detail and coming
  // back — the grid unmounts while a detail shows, so it would otherwise
  // re-mount scrolled to the top.
  const gridScrollRef = useRef(null)
  const savedGridScrollRef = useRef(0)
  const [pendingUninstall, setPendingUninstall] = useState(null)
  // pendingUninstall: the installed app row from /api/apps/.
  // Browser modal dialogs are silently no-op'd inside the AppCanvas
  // iframe (sandbox lacks `allow-modals`), so we stage the
  // confirmation as in-app state and render our own modal.
  const [busy, setBusy] = useState(false)
  const [busyItemId, setBusyItemId] = useState(null)
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
    setBusyItemId(item?.id || null)
    setCardErrors(prev => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    setUpdateNotice(null)
    try {
      // The backend decides install vs update from the canonical manifest
      // identity, not the installed slug (slugs can be suffixed on collision).
      // We pass manifest + raw_base; the install endpoint re-fetches nothing
      // else from us.
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
        const name = result.name || item.manifest?.name || item.id
        const paths = result.conflict_paths?.length
          ? ` Conflicts: ${result.conflict_paths.join(', ')}.`
          : ''
        const message = `${name} update needs review before it can apply.${paths}`
        const notice = {
          kind: 'conflict',
          itemId: item.id,
          appId: result.id,
          message,
          result,
          item,
        }
        setUpdateNotice(notice)
        setCardErrors(prev => ({ ...prev, [item.id]: message }))
        setToast({ kind: 'error', message })
        await refreshInstalled()
        // A conflict needs review, but don't yank the user to the detail
        // view — the error toast + the persisted updateNotice (which drives
        // the "Resolve in chat" affordance on the card) are enough in place.
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
        // Stay on the grid and surface the outcome inline — the update
        // already applied, so auto-opening the detail view was an unwanted
        // yank. The notice persists, so the "Review in chat" affordance is
        // still there if the user opens detail themselves.
        setToast({ kind: 'success', message: notice.message })
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
      setBusyItemId(null)
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
      if (event.source !== window.parent) return
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
    savedGridScrollRef.current = gridScrollRef.current?.scrollTop || 0
    if (navDetailRef.current && !detail) return
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
          if (event.source !== window.parent) return
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

  // B1: returning from a detail re-mounts the grid; restore its saved scroll.
  useLayoutEffect(() => {
    if (!detail && gridScrollRef.current && savedGridScrollRef.current) {
      gridScrollRef.current.scrollTop = savedGridScrollRef.current
    }
  }, [detail])

  // Detail view replaces the main layout when set.
  if (detail) {
    return (
      <div className="st-root">
        <style>{CSS}</style>
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
          <div className={`st-toast${toast.kind === 'success' ? ' is-success' : toast.kind === 'error' ? ' is-error' : ''}`}>
            <div className="st-toast-msg">{toast.message}</div>
            <button className="st-toast-btn" onClick={() => setToast(null)}>OK</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="st-root">
      <style>{CSS}</style>
      <div className="st-header">
        <div className="st-title-row">
          <h1 className="st-title">App Store</h1>
        </div>
        <div className="st-seg is-accent st-tabs" role="tablist" aria-label="Browse mode">
          <button role="tab" aria-selected={tab === 'browse'}
                  className={`st-seg-btn${tab === 'browse' ? ' is-active' : ''}`}
                  onClick={() => setTab('browse')}>
            Browse
          </button>
          <button role="tab" aria-selected={tab === 'url'}
                  className={`st-seg-btn${tab === 'url' ? ' is-active' : ''}`}
                  onClick={() => setTab('url')}>
            From URL
          </button>
        </div>
      </div>

      <div className="st-scroll" ref={gridScrollRef}>
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
                  busyItemId={busyItemId}
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
        <div className={`st-toast${toast.kind === 'success' ? ' is-success' : toast.kind === 'error' ? ' is-error' : ''}`}>
          <div className="st-toast-msg">{toast.message}</div>
          <button className="st-toast-btn" onClick={() => setToast(null)}>OK</button>
        </div>
      )}
    </div>
  )
}
