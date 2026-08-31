// One module-level stylesheet rendered once at the app root as
// <style>{CSS}</style>. Style is via semantic `st-`-prefixed classNames;
// inline style={} is reserved for render-time dynamic values (the skeleton
// block dimensions, the installed-dot's update tint). App-driven variants
// (including every action button's state) ride is-* / variant classNames,
// never JS style helpers — the action buttons share the one canonical
// st-btn component so they're identical across the card and detail views.
// Shared chrome (root, segmented tabs, empty, sheet, buttons, toast) is
// fenced with mobius-ui markers so a
// future extraction into @mobius/ui is mechanical.
export const CSS = `
/* mobius-ui:Root v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-root {
  position: relative;        /* anchor for scrims / sheets / toasts (absolute, not fixed) */
  height: 100%; width: 100%; max-width: 100%; display: flex; flex-direction: column;
  background: var(--bg); color: var(--text);
  font-family: var(--font); overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
.st-scroll {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 16px max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  overscroll-behavior: contain;
  word-break: break-word; overflow-wrap: anywhere;
}
/* /mobius-ui:Root */

/* mobius-ui:Scrollskin v2 — keep in sync; hidden by default, content stays scrollable. */
.st-scroll,
.st-sheet {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.st-scroll::-webkit-scrollbar,
.st-sheet::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
/* /mobius-ui:Scrollskin */

/* mobius-ui:Focus v1 — keep in sync; library candidate. A single
   keyboard-focus ring for every interactive control, so no element can
   ship without a visible focus indicator. .st-btn and .st-card already
   declare matching rings below; this is the floor, not a doubled ring. */
:where(button, a, input, textarea, select, summary, [role="button"], [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

/* Honor reduced-motion: collapse every animation/transition to ~instant
   so the skeleton pulse, card lift, and active-state scales don't move
   for motion-sensitive users. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* App-specific header — title + a segmented tab bar, not the canonical
   brand-cluster header. Kept on the store's own values. */
.st-header {
  padding: max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left));
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.st-title-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(320px, 560px) minmax(120px, 1fr);
  align-items: center;
  gap: 20px;
}
.st-store-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.st-brand-icon {
  width: 34px; height: 34px; border-radius: 8px;
  object-fit: cover; flex-shrink: 0; display: block;
}
.st-brand-fallback {
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--accent-fg);
  font-size: 22px; font-weight: 700; line-height: 1;
}
.st-brand-name {
  overflow: hidden;
  color: var(--text);
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-header-balance { display: block; }

/* mobius-ui:Segmented v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-seg {
  display: inline-flex; gap: 2px; height: 44px;
  background: var(--surface2, var(--surface)); border: 0; border-radius: 10px;
  box-shadow: inset 0 0 0 1px var(--border);
}
.st-seg-btn {
  box-sizing: border-box; min-height: 44px; padding: 6px 14px; border: 0; border-radius: 7px;
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
.st-seg.is-accent .st-seg-btn.is-active { background: var(--accent-hover, var(--accent)); color: var(--accent-fg); box-shadow: none; }
/* /mobius-ui:Segmented */

/* The store's tab bar: segmented control shares the header row with the
   brand icon, taking the remaining width with each button splitting it
   equally. min-width:0 lets it shrink without overflowing on narrow phones. */
.st-tabs { display: flex; flex: 1; min-width: 0; gap: 4px; border-radius: 10px; }
.st-tabs .st-seg-btn {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.st-tab-count {
  min-width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 13%, var(--bg));
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.st-seg.is-accent .st-seg-btn.is-active .st-tab-count {
  color: var(--accent-hover, var(--accent));
  background: var(--accent-fg);
}

@media (max-width: 620px) {
  .st-title-row { grid-template-columns: auto minmax(0, 1fr); gap: 10px; }
  .st-brand-name,
  .st-header-balance { display: none; }
  .st-brand-icon,
  .st-brand-fallback { width: 32px; height: 32px; }
}

/* Discovery controls: compact search + category chips. This is an
   operational filter surface, not a hero — it sits in-flow above the grid and
   keeps the direct install/update card actions visible. */
.st-discovery {
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.st-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.st-search-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.st-search-input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  transition: border-color 150ms, box-shadow 150ms, background 150ms;
}
.st-search-input::placeholder { color: color-mix(in srgb, var(--muted) 88%, var(--text)); }
.st-search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
.st-search-clear {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2, var(--surface));
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
  font-family: var(--font);
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}
.st-search-clear svg { display: block; margin: auto; }
@media (hover: hover) {
  .st-search-clear:hover { color: var(--text); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-search-clear:active { opacity: 0.75; transform: scale(0.97); }
}
.st-result-count {
  flex-shrink: 0;
  min-width: 48px;
  text-align: right;
  color: var(--muted);
  font-size: 12px;
  font-family: var(--mono, monospace);
}
.st-category-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  overflow: visible;
  padding-bottom: 1px;
}
.st-category-strip::-webkit-scrollbar { display: none; width: 0; height: 0; }
.st-chip {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  transition: background 150ms, border-color 150ms, color 150ms;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.st-chip.is-active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  color: var(--text);
}
.st-chip-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--text) 12%, transparent);
  color: var(--text);
  font-size: 11px;
  line-height: 1;
  font-family: var(--mono, monospace);
}
.st-update-all-trigger {
  flex: 0 0 auto;
  min-height: 44px;
  margin-left: auto;
  padding: 7px 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-hover, var(--accent));
  color: var(--accent-fg);
  font: 650 13px/1 var(--font);
  cursor: pointer;
  touch-action: manipulation;
  transition: filter 150ms, transform 150ms, opacity 150ms;
}
.st-update-all-trigger:disabled { opacity: 0.52; cursor: default; }
.st-library-health {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  margin: 18px 0 26px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 16px;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}
.st-library-health.is-healthy {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: color-mix(in srgb, var(--green) 6%, var(--surface));
}
.st-library-health-mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--bg);
  background: var(--accent);
  font-weight: 800;
}
.st-library-health.is-healthy .st-library-health-mark { background: var(--green); }
.st-library-health-copy h2 { margin: 0 0 3px; font-size: 15px; letter-spacing: -0.01em; }
.st-library-health-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
.st-community-unavailable {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  margin: 16px 0; padding: 13px 15px; border-radius: 14px;
  color: var(--muted); background: var(--surface); border: 1px solid var(--border);
  font-size: 12px;
}
.st-registry-offline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 12px 0 18px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  font-size: 11px;
  line-height: 1.35;
}
.st-registry-offline strong { color: var(--text); font-weight: 700; }
.st-registry-offline button {
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  color: var(--accent);
  background: transparent;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}
.st-registry-offline button:hover { text-decoration: underline; }
.st-registry-offline button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 7px; }
.st-publisher { display: flex; flex-direction: column; gap: 22px; padding-bottom: 36px; }
.st-publisher-intro {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 28px;
  padding: 28px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border);
}
.st-publisher-intro h2 { margin: 0 0 9px; font-size: clamp(24px, 4vw, 38px); letter-spacing: -0.03em; }
.st-publisher-intro p { max-width: 66ch; margin: 0; color: var(--muted); line-height: 1.6; }
.st-publisher-identities { display: grid; justify-items: end; gap: 8px; flex: 0 0 auto; }
.st-publisher-identity {
  display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto;
  padding: 9px 12px; border-radius: 999px; color: var(--muted);
  background: var(--bg); border: 1px solid var(--border); font-size: 12px; font-weight: 650;
}
.st-publisher-identity-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.st-publisher-identity.is-linked .st-publisher-identity-dot { background: var(--green); }
.st-publisher-contributions { flex: 0 0 auto; }
.st-publish-result {
  display: grid; gap: 4px; padding: 16px; border-radius: 14px;
  color: var(--text); background: color-mix(in srgb, var(--green) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--green) 32%, var(--border));
}
.st-publish-result span { color: var(--muted); font-size: 12px; }
.st-publish-result a {
  width: fit-content; min-height: 44px; display: inline-flex; align-items: center;
  margin-top: 5px; color: var(--accent); font-size: 12px; font-weight: 700;
}
.st-publish-review {
  display: grid; gap: 16px; padding: 20px; border-radius: 16px;
  background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
}
.st-publish-review h3 { margin: 0 0 6px; font-size: 17px; }
.st-publish-review p { max-width: 70ch; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.st-publish-consent { display: flex; align-items: flex-start; gap: 10px; font-size: 12px; line-height: 1.45; cursor: pointer; }
.st-publish-consent input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
.st-publish-review-actions { display: flex; justify-content: flex-end; gap: 9px; }
.st-publisher-github-setup {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px;
  margin: 0; padding: 16px 18px; border-radius: 14px;
}
.st-publisher-github-setup strong,
.st-publisher-github-setup span { display: block; }
.st-publisher-github-setup strong { margin-bottom: 4px; font-size: 13px; }
.st-publisher-github-setup span { color: var(--muted); font-size: 12px; line-height: 1.5; }
.st-publisher-github-setup .st-btn { text-decoration: none; white-space: nowrap; }
.st-publish-advanced {
  margin: 0 0 18px; border: 1px solid var(--border); border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 78%, transparent); overflow: hidden;
}
.st-publish-advanced > summary {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 54px; padding: 12px 16px; cursor: pointer; list-style: none;
}
.st-publish-advanced > summary::-webkit-details-marker { display: none; }
.st-publish-advanced > summary span { color: var(--text); font-size: 13px; font-weight: 750; }
.st-publish-advanced > summary small { color: var(--muted); font-size: 11px; }
.st-publish-advanced[open] > summary { border-bottom: 1px solid var(--border); }
.st-publish-advanced .st-publish-review { margin: 0; border: 0; border-radius: 0; }
.st-community-provenance {
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  margin: 18px 0; padding: 14px 16px; border-radius: 14px;
  background: var(--surface); border: 1px solid var(--border);
}
.st-community-provenance strong, .st-community-provenance span { display: block; }
.st-community-provenance strong { margin-bottom: 3px; font-size: 13px; }
.st-community-provenance span { color: var(--muted); font-size: 11px; }
.st-community-provenance a {
  min-height: 44px; display: inline-flex; align-items: center;
  color: var(--accent); font-size: 12px; font-weight: 700; white-space: nowrap;
}
.st-community-actions { display: flex; align-items: center; gap: 10px; }
.st-community-actions .st-btn { min-height: 44px; padding: 7px 13px; }
.st-community-feedback { margin: 28px 0 8px; padding-top: 24px; border-top: 1px solid var(--border); }
.st-community-feedback-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.st-community-feedback h3 { margin: 0 0 5px; font-size: 18px; letter-spacing: -.02em; }
.st-community-feedback-head p { max-width: 64ch; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.st-rating-summary { flex-shrink: 0; text-align: right; font-variant-numeric: tabular-nums; }
.st-rating-summary strong { display: block; font-size: 22px; line-height: 1; }
.st-rating-summary span { color: var(--muted); font-size: 10px; }
.st-rating-picker { display: flex; align-items: center; gap: 3px; margin: 16px 0 18px; }
.st-rating-picker button {
  width: 44px; height: 44px; padding: 9px; border: 0; border-radius: 10px;
  color: var(--accent); background: transparent; cursor: pointer;
}
@media (hover: hover) { .st-rating-picker button:not(:disabled):hover { background: var(--surface2, var(--surface)); } }
.st-rating-picker button:disabled { opacity: .45; cursor: default; }
.st-rating-picker button svg { width: 100%; height: 100%; }
.st-rating-picker > span { margin-left: 7px; color: var(--muted); font-size: 11px; }
.st-review-eligibility { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.45; }
.st-review-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px; }
.st-review-form label { grid-column: 1 / -1; font-size: 12px; font-weight: 700; }
.st-review-form textarea {
  min-height: 88px; resize: vertical; padding: 12px 13px; border: 1px solid var(--border);
  border-radius: 13px; color: var(--text); background: var(--surface); font: inherit; line-height: 1.45;
}
.st-review-form .st-btn { align-self: end; }
.st-community-feedback-error { margin-top: 9px; color: var(--danger); font-size: 12px; }
.st-review-list { margin-top: 18px; border-top: 1px solid var(--border); }
.st-review-list article { padding: 14px 0; border-bottom: 1px solid var(--border); }
.st-review-list article strong { font-size: 12px; }
.st-review-list article p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.st-review-empty { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.st-publish-field { display: grid; gap: 7px; color: var(--muted); font-size: 12px; font-weight: 700; }
.st-publish-field input {
  width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 12px;
  color: var(--text); background: var(--bg); border: 1px solid var(--border); font: inherit;
}
.st-publisher-repository-name {
  display: flex; align-items: center; min-height: 46px; overflow: hidden;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg);
}
.st-publisher-repository-name > span {
  flex: none; padding: 0 0 0 12px; color: var(--muted); font-weight: 650;
}
.st-publisher-repository-name input {
  min-width: 0; border: 0; border-radius: 0; background: transparent;
}
.st-publisher-repository-name:focus-within {
  border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
.st-publisher-repository-name input:focus { outline: 0; }
.st-publish-repository-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr); gap: 12px; }
.st-publish-repository-grid .st-publish-field:last-child { grid-column: 1 / -1; }
.st-publish-source-note { color: var(--muted); font-size: 12px; margin-right: auto; }
@media (max-width: 680px) {
  .st-publish-repository-grid { grid-template-columns: 1fr; }
  .st-publish-repository-grid .st-publish-field:last-child { grid-column: auto; }
}
@media (max-width: 620px) {
  .st-community-unavailable, .st-publisher-intro, .st-community-provenance { align-items: stretch; flex-direction: column; }
  .st-community-feedback-head { align-items: stretch; flex-direction: column; }
  .st-rating-summary { text-align: left; }
  .st-review-form { grid-template-columns: 1fr; }
  .st-review-form .st-btn { width: 100%; }
  .st-publisher-intro { padding: 20px; }
  .st-publisher-identities { justify-items: start; }
  .st-publisher-identity { align-self: flex-start; }
  .st-publisher-github-setup { grid-template-columns: 1fr; }
}
.st-update-all-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-fg) 18%, transparent);
  font: 650 11px/1 var(--mono, monospace);
}
@media (hover: hover) {
  .st-update-all-trigger:not(:disabled):hover { filter: brightness(0.94); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-update-all-trigger:not(:disabled):active { transform: scale(0.97); }
}
@media (hover: hover) {
  .st-chip:hover { color: var(--text); border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); }
}
.st-notice {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2, var(--surface));
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
}
.st-notice.is-warning {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--text);
}
.st-notice-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.st-notice-row > span { min-width: 0; }
.st-notice-action {
  flex: 0 0 auto;
}

@media (max-width: 720px) {
  .st-category-strip {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin-right: -16px;
    padding-right: 16px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
}

@media (max-width: 520px) {
  .st-category-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
    margin-right: 0;
    padding-right: 0;
  }
  .st-chip { width: 100%; justify-content: center; }
  .st-update-all-trigger {
    grid-column: 1 / -1;
    width: 100%;
    margin-left: 0;
    border-radius: 12px;
  }
}

/* Curated collections keep very different kinds of apps discoverable without
   turning each category into a separate catalog. Search and lifecycle filters
   preserve the same shelves and simply hide empty ones. */
.st-catalog-sections {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.st-catalog-more {
  display: flex;
  justify-content: center;
  padding: 8px 0 20px;
}
.st-catalog-section { min-width: 0; }
.st-catalog-section-head { margin: 0 0 8px; }
.st-catalog-section-title {
  margin: 0;
  color: var(--text);
  font-size: 17px;
  font-weight: 720;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.st-catalog-section-desc {
  margin: 4px 0 0;
  max-width: 66ch;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

/* App-specific catalog grid + tiles. Browse cards keep visual proof in the
   detail description and spend their footprint on identity, value, and the
   current action. State rides is-* modifier classes. */
.st-catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 10px;
}
/* The card is a non-interactive container (not role=button). The open
   affordance is a real <button class="st-card-open"> whose ::after overlay
   stretches across the whole card, so hover/focus on it lifts the card and
   a click anywhere outside the action button opens details. The action
   button rides z-index:1 above that overlay. */
.st-card {
  position: relative;
  display: flex; flex-direction: column;
  align-items: center; text-align: center;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color 150ms, transform 150ms, box-shadow 150ms, background 150ms;
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
.st-card.is-update {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-color: var(--accent);
}
.st-card.is-conflict {
  background: color-mix(in srgb, var(--danger, #e5484d) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--danger, #e5484d) 70%, var(--border));
}
.st-card.is-unavailable {
  background: color-mix(in srgb, var(--text) 4%, var(--surface));
  border-color: color-mix(in srgb, var(--text) 22%, var(--border));
}
.st-card.is-installed {
  background: color-mix(in srgb, var(--text) 5%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--text) 22%, var(--border));
}
.st-card.is-error {
  border: 1px dashed var(--border);
}
.st-card.is-catalog {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  grid-template-rows: auto auto auto auto;
  align-items: center;
  column-gap: 10px;
  row-gap: 2px;
  text-align: left;
}
.st-card.is-loading-card { align-items: center; text-align: center; }
.st-card.is-catalog .st-icon-slot {
  grid-column: 1;
  grid-row: 1 / span 2;
  align-self: start;
  margin: 0;
}
.st-card.is-catalog .st-icon-wrap { width: 52px; height: 52px; border-radius: 13px; }
.st-card.is-catalog .st-icon-letter { font-size: 24px; }
.st-card.is-catalog .st-card-open {
  grid-column: 2;
  grid-row: 1;
  align-self: end;
  min-height: 0;
  margin: 0;
  text-align: left;
}
.st-card.is-catalog .st-card-state-row {
  grid-column: 2;
  grid-row: 2;
  min-height: 18px;
  margin: 0;
  justify-content: flex-start;
}
.st-card.is-catalog .st-card-desc {
  grid-column: 1 / -1;
  grid-row: 3;
  display: -webkit-box;
  min-height: 32px;
  margin: 8px 0 0;
  overflow: hidden;
  text-align: left;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.st-card.is-catalog .st-card-status-row {
  grid-column: 1 / -1;
  grid-row: 4;
  margin-top: 8px;
  padding-top: 10px;
}
.st-card.is-catalog .st-card-notice,
.st-card.is-catalog .st-card-inline-error { grid-column: 1 / -1; }
/* The app name is the card's open affordance. Its ::after overlay covers
   the whole card so the icon / name / description all open details. */
.st-card-open {
  position: static;
  border: 0; background: transparent; padding: 0; margin: 0 0 4px;
  font-family: var(--font); color: var(--text);
  font-size: 14px; font-weight: 600; line-height: 1.25;
  cursor: pointer;
  min-height: 44px;
  align-items: flex-start;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
  touch-action: manipulation; user-select: none;
}
.st-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.st-card-open::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
}
.st-card-open:focus-visible { outline: none; }
.st-card-open:focus-visible::after {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
/* Interaction lift — gated on hover:hover so touch devices don't get stuck hover states. */
@media (hover: hover) {
  .st-card:has(.st-card-open:hover) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px color-mix(in srgb, var(--accent) 14%, transparent);
    border-color: var(--accent);
  }
}
.st-card:has(.st-card-open:focus-visible) {
  transform: translateY(-1px);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
  border-color: var(--accent);
}
@media (prefers-reduced-motion: no-preference) {
  .st-card:has(.st-card-open:active) { transform: scale(0.98); opacity: 0.9; }
}
/* Icons float on the card with no tile or border — clean transparent
   presentation. Almost every catalog repo ships a transparent glossy-3D PNG
   (memory, reflection, news, atlas, notes, latex, …); the lone holdout still
   shipping an opaque baked-in square is cuberun (pending an imagegen regen).
   The slot only keeps overflow:hidden + the radius so that one opaque square
   gets its corners clipped to match. The letter fallback (no icon / load
   error) keeps a surface tile so an iconless app still reads as finished. */
.st-icon-wrap {
  width: 96px; height: 96px; border-radius: 22px;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
/* A relative anchor around the IconBox so the "installed" check dot can
   sit at the icon's bottom-right corner without leaking out of
   .st-icon-wrap's overflow: hidden. Spacing-below lives on this slot. */
.st-icon-slot { position: relative; margin-bottom: 12px; display: inline-block; }
.st-icon-img { width: 100%; height: 100%; object-fit: contain; }
/* Known remote icon still resolving. Never use the letter as a loading state:
   it creates a visible false identity immediately before the real icon. */
.st-icon-loading {
  background: color-mix(in srgb, var(--surface2) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}
/* Letter fallback (no icon / load error) gets a surface tile + border so the
   initial reads as a recognisable icon slot — real icons float transparent,
   but an iconless app still looks finished. */
.st-icon-wrap--letter {
  background: var(--surface2);
  border: 1px solid var(--border);
}
.st-icon-letter { font-size: 36px; font-weight: 700; color: var(--accent); }
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
  color: var(--accent-fg);
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
.st-card-state-row {
  width: 100%;
  min-height: 20px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.st-card-state-line {
  max-width: 100%;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-card-state-line.is-update { color: var(--accent); }
.st-card-state-line.is-conflict { color: var(--danger, #e5484d); }
.st-card-state-line.is-unavailable { color: var(--muted); }
.st-card-agent {
  flex: 0 0 auto;
  font-family: var(--font, inherit); font-weight: 600;
  font-size: 12px; letter-spacing: 0;
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  border-radius: 999px; padding: 1px 7px;
}
.st-card-source-update {
  display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border));
  border-radius: 999px; color: var(--accent); background: var(--accent-dim);
  font-size: 10px; font-weight: 800; letter-spacing: .01em; white-space: nowrap;
}
.st-repository-update {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin-top: 12px; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--accent) 44%, var(--border));
  border-radius: 14px; background: var(--accent-dim);
}
.st-repository-update strong, .st-repository-update span { display: block; }
.st-repository-update strong { color: var(--text); font-size: 13px; margin-bottom: 4px; }
.st-repository-update div > span { color: var(--muted); font-size: 12px; line-height: 1.45; }
.st-repository-update-sha { color: var(--accent); font-family: var(--mono); font-size: 11px; font-weight: 800; }
@media (max-width: 680px) { .st-repository-update { align-items: flex-start; flex-direction: column; } }
.st-source-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface-2);
}
.st-source-status > div { display: flex; flex-direction: column; gap: 4px; }
.st-source-status strong { font-size: 12px; }
.st-source-status span { color: var(--muted); font-size: 11px; line-height: 1.45; }
.st-source-status.is-preserved { border-color: color-mix(in srgb, var(--green) 36%, var(--border)); }
.st-source-status.is-preserved strong { color: var(--green); }
.st-card-desc {
  font-size: 12px; color: var(--muted); line-height: 1.35;
  margin-bottom: 12px;
  text-align: center;
  min-height: 49px;
}
/* Top-border separator between the description and the one card action.
   Each card reads as exactly one state/action: Install, Installed, or Update.
   z-index:1 lifts the action above the .st-card-open ::after overlay so it
   stays independently clickable. */
.st-card-status-row {
  position: relative;
  z-index: 1;
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
  min-height: 44px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 5px 12px;
  background: var(--accent-hover, var(--accent));
  color: var(--accent-fg);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font);
  touch-action: manipulation; user-select: none;
}
/* Install and Update share the accent primary look so the action button
   reads identically across every card; the card-level border + checkmark
   dot (see .st-card.is-update) carry the "update available" signal without
   an off-brand second button colour. Installed = a muted, lower-emphasis
   fill so the primary actions stay the eye-catchers in the grid. */
.st-card-action.is-update { background: var(--accent-hover, var(--accent)); }
.st-card-action.is-conflict {
  background: var(--danger, #e5484d);
  color: var(--accent-fg);
}
.st-card-action.is-unavailable {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 18%, var(--border));
}
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
  position: relative;
  z-index: 2;
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
.st-card-inline-error-text {
  user-select: text;
  cursor: text;
}
.st-card-inline-error-action {
  width: 100%;
  min-height: 38px;
  margin-top: 8px;
  padding: 7px 12px;
  user-select: none;
}
.st-card-notice {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--accent);
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  box-sizing: border-box;
}
.st-card-notice-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.st-card-notice-actions .st-big-btn,
.st-card-notice-actions .st-btn { width: 100%; }
/* Skeleton placeholder — same shape as a card so the grid doesn't reflow
   when the real manifests arrive. Per-block width/height stay inline. */
.st-skeleton-card {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 12px;
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
  min-height: 44px;
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
  box-sizing: border-box;
  margin-bottom: 12px;
  min-height: 44px;
  transition: border-color 150ms, box-shadow 150ms;
}
/* Focus ring — was JS focused state, now a real :focus pseudo-class.
   Same accent ring the catalog cards use. The shared :focus-visible block
   keeps a keyboard outline; this border+shadow is the always-on focus cue. */
.st-url-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
/* Suppress the UA outline only for pointer focus; keyboard focus keeps the
   shared :focus-visible accent ring on top of the border+shadow cue. */
.st-url-input:focus:not(:focus-visible) { outline: none; }
.st-primary-btn {
  padding: 12px 20px; border-radius: 10px; border: none;
  background: var(--accent-hover, var(--accent)); color: var(--accent-fg);
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font);
  min-height: 44px;
  transition: background 150ms;
  touch-action: manipulation; user-select: none;
  width: 100%;
}
.st-primary-btn:disabled { pointer-events: none; opacity: 0.65; }
@media (hover: hover) {
  .st-primary-btn:not(:disabled):hover { filter: brightness(0.94); }
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
.st-back-btn svg { width: 16px; height: 16px; }
@media (hover: hover) {
  .st-back-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-back-btn:active { opacity: 0.75; }
}
.st-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.st-hero-text { flex: 1; min-width: 0; }
/* Detail-view hero icon — clean transparent, same as the grid (see
   .st-icon-wrap); overflow-clip rounds the lone opaque (cuberun) icon. */
.st-hero-icon {
  width: 80px; height: 80px; border-radius: 18px;
  background: transparent;
  display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.st-hero-icon.is-letter { background: var(--surface2); border: 1px solid var(--border); }
.st-hero-icon-letter { font-size: 32px; font-weight: 700; color: var(--accent); }
.st-hero-name { font-size: 22px; font-weight: 700; margin: 0 0 4px; letter-spacing: 0; user-select: none; }
.st-hero-meta { font-size: 12px; color: var(--muted); font-family: var(--mono, monospace); user-select: none; }
.st-detail-desc { font-size: 14px; line-height: 1.55; color: var(--text); margin-bottom: 24px; }
.st-detail-preview {
  margin: 22px 0 28px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}
.st-detail-preview img {
  display: block;
  width: 100%;
  max-height: min(58vh, 560px);
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top center;
}
.st-detail-preview figcaption {
  padding: 10px 13px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  font-size: 11px;
  font-weight: 650;
}
.st-detail-section { margin-bottom: 24px; }
.st-section {
  font-size: 13px; font-weight: 700; color: var(--text);
  letter-spacing: 0; margin: 22px 0 14px;
  user-select: none;
}
.st-scroll > .st-section:first-child { margin-top: 0; }
.st-section-label {
  font-size: 12px; font-weight: 600; color: var(--muted);
  letter-spacing: 0;
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
.st-capability-state,
.st-capability-change {
  padding: 12px;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.45;
}
.st-capability-change { margin-bottom: 10px; color: var(--text); }
.st-capability-list { display: grid; gap: 8px; }
.st-perm-hint { color: var(--muted); font-size: 12px; margin-top: 4px; }

/* Progressive disclosure for the information that matters during review or
   troubleshooting but should not dominate everyday app browsing. Permission
   changes open this section automatically; stable access stays collapsed. */
.st-technical-details {
  margin: 8px 0 4px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}
.st-technical-details.is-attention {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}
.st-technical-summary {
  min-height: 58px;
  padding: 12px 14px;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}
.st-technical-summary-main {
  color: var(--text);
  font-size: 14px;
  font-weight: 650;
}
.st-technical-summary-meta {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-family: var(--mono, monospace);
  font-size: 11px;
  line-height: 1.35;
}
.st-technical-details.is-attention .st-technical-summary-meta { color: var(--accent); }
.st-technical-body {
  padding: 14px;
  border-top: 1px solid var(--border);
}
.st-technical-section + .st-technical-section { margin-top: 20px; }
/* A short capability tag next to each permission row. State (read / write /
   muted) rides is-* modifiers; 'no'/'none' both render muted. */
.st-perm-tag {
  flex-shrink: 0;
  padding: 2px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
  font-family: var(--font); letter-spacing: 0;
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
.st-setup-card {
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}
.st-setup-main { font-weight: 650; color: var(--text); }
.st-setup-note { color: var(--muted); margin-top: 4px; }
.st-setup-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}
.st-setup-meta {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent);
  font-size: 12px;
  font-weight: 650;
}
.st-setup-action {
  min-width: 0;
  white-space: nowrap;
  padding-inline: 12px;
}
@media (max-width: 520px) {
  .st-setup-bottom {
    align-items: flex-start;
    flex-direction: column;
  }
}
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
  display: flex; flex-direction: column; gap: 10px;
  flex-shrink: 0; background: var(--bg);
}
/* Footer CTAs: full-width canonical buttons. The shared .st-btn min-height
   (44px) keeps the primary's height fixed across every label/busy state, so
   "Open App" -> "Updating…" never shifts the row; the secondary "Uninstall"
   sits below as a real, muted button (not an underlined text link) so both
   actions read as one consistent control family. */
.st-detail-cta { width: 100%; font-size: 15px; }
/* Full-width solid accent button for the update-notice "Review in chat" /
   "Resolve in chat" action. (The detail-footer CTA and modal confirm both
   use the canonical st-btn now; this stays for the in-flow update notice.) */
.st-big-btn {
  width: 100%; padding: 12px 16px; border-radius: 10px;
  border: none; background: var(--accent-hover, var(--accent)); color: var(--accent-fg);
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
.st-update-notice-actions {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;
}
.st-update-notice-actions .st-btn { flex: 1 1 160px; min-width: 0; }

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
.st-banner-content { flex: 1; min-width: 0; }
.st-banner.is-reviewing { align-items: flex-start; }
.st-banner.is-reviewing .st-banner-msg { margin-bottom: 10px; }
.st-banner.is-reviewing .st-capability-list { gap: 6px; }
.st-banner.is-reviewing .st-permission-row { background: var(--bg); }
.st-banner-btn {
  flex-shrink: 0; border: none; border-radius: 8px; padding: 8px 16px;
  background: var(--accent-hover, var(--accent)); color: var(--accent-fg); font-weight: 600;
  font-size: 13px; cursor: pointer; font-family: var(--font);
  min-height: 44px;
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
.st-empty-title { font-size: 17px; font-weight: 700; color: var(--text); letter-spacing: 0; }
.st-empty-text { margin: 0; font-size: 14px; line-height: 1.6; }
/* /mobius-ui:Empty */

/* Read-only app-update review. Mirrors the platform updater's hierarchy: a
   compact file summary first, full unified diff on demand, explicit apply. */
.st-update-review-scrim {
  position: absolute; inset: 0; z-index: 150;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  overscroll-behavior: contain;
}
.st-update-review {
  width: min(640px, 100%);
  height: min(720px, calc(100% - 16px));
  min-height: 0;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px;
  padding: 18px;
  border: 1px solid var(--border); border-radius: 16px;
  background: var(--surface); color: var(--text);
  overflow: hidden;
}
.st-update-review-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
}
.st-update-review-title {
  margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; letter-spacing: 0;
}
.st-update-review-subtitle {
  margin: 3px 0 0; font-size: 13px; line-height: 1.45; color: var(--muted);
}
.st-update-review-close {
  flex: 0 0 auto; width: 36px; height: 36px; margin: -4px -4px 0 0;
  display: grid; place-items: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted);
  font: 400 22px/1 var(--font); cursor: pointer;
}
.st-update-review-close svg { width: 18px; height: 18px; }
.st-update-review-close:disabled { opacity: 0.5; cursor: default; }
@media (hover: hover) {
  .st-update-review-close:not(:disabled):hover { background: var(--surface2); color: var(--text); }
}
.st-update-review-body {
  min-height: 0; overflow-y: auto; overflow-x: hidden;
  display: flex; flex-direction: column; gap: 18px;
  padding-right: 2px; overscroll-behavior: contain;
  scrollbar-width: none;
}
.st-update-review-body::-webkit-scrollbar { display: none; }
.st-update-review-section { display: flex; flex-direction: column; gap: 9px; }
.st-update-review-section > h3,
.st-update-review-section-head h3 {
  margin: 0; font-size: 12px; line-height: 1.4; font-weight: 650; color: var(--muted);
}
.st-update-review-section-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.st-update-review-total {
  display: inline-flex; align-items: baseline; gap: 8px;
  font: 600 12px/1.3 var(--mono, monospace);
}
.st-update-review-total .is-add { color: var(--green); }
.st-update-review-total .is-del { color: var(--danger); }
.st-update-review-notice {
  padding: 12px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--surface2); color: var(--muted);
  font-size: 13px; line-height: 1.5;
}
.st-update-review-notice.is-error {
  border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
}
.st-update-review-error-text,
.st-selectable-error {
  user-select: text;
  cursor: text;
}
.st-update-review-error-text { margin-bottom: 6px; color: var(--danger); }
.st-banner-access-review { margin-top: 10px; }
.st-banner-access-note {
  max-width: 65ch;
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
.st-update-review-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding-top: 14px; border-top: 1px solid var(--border);
}
.st-update-review-actions .st-btn:first-child { margin-right: auto; }

@media (max-width: 520px) {
  .st-update-review-scrim { align-items: stretch; padding: 8px; }
  .st-update-review { height: calc(100% - 16px); padding: 16px; border-radius: 12px; }
  .st-update-review-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .st-update-review-actions .st-btn { width: 100%; margin: 0; }
  .st-update-review-actions .st-btn-primary { grid-column: 1 / -1; order: -2; }
  .st-update-review-actions .st-btn-secondary { order: -1; }
}

@media (max-width: 360px) {
  .st-update-review-actions { grid-template-columns: 1fr; }
  .st-update-review-actions .st-btn-primary { grid-column: auto; }
}

/* mobius-ui:Sheet v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-scrim {
  position: absolute; inset: 0; z-index: 100;   /* absolute → stays inside the app, never over shell chrome */
  display: flex; align-items: flex-end; justify-content: center;
  padding: 16px; background: rgba(0, 0, 0, 0.5);
}
.st-sheet {
  width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto;
  padding: 24px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px 16px 0 0; box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.28);
  overscroll-behavior: contain;
}
.st-sheet-title { margin: 0 0 12px; font-size: 16px; font-weight: 700; letter-spacing: 0; }
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
.st-btn-primary { background: var(--accent-hover, var(--accent)); border-color: var(--accent-hover, var(--accent)); color: var(--accent-fg); }
@media (hover: hover) {
  .st-btn-primary:hover { filter: brightness(0.94); }
  .st-btn-secondary:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
  .st-btn-ghost:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
.st-btn-secondary { background: var(--surface2, var(--surface)); }
.st-btn-ghost { background: transparent; border-color: transparent; color: var(--accent); }
.st-btn-danger { background: var(--danger); border-color: var(--danger); color: var(--accent-fg); }
.st-btn-icon { width: 44px; padding: 0; border-radius: 8px; font-size: 18px; }
/* /mobius-ui:Button */

/* mobius-ui:Toast v1 — keep in sync; library candidate. */
.st-toast {
  position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 200;   /* absolute → inside the app */
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: var(--surface); border: 1px solid var(--accent); border-radius: 12px;
  font-size: 14px; line-height: 1.5; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.32);
  box-sizing: border-box;
}
.st-toast.is-success { border-color: var(--green); }
.st-toast.is-error { border-color: var(--danger); }
.st-toast-msg { flex: 1; user-select: text; cursor: text; }
.st-toast-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.st-toast-btn {
  padding: 8px 16px; border-radius: 8px; border: none;
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font); flex-shrink: 0;
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
.st-toast-btn-primary { background: var(--accent-hover, var(--accent)); color: var(--accent-fg); }
.st-toast-btn-secondary {
  background: var(--surface2, var(--surface));
  color: var(--text);
  border: 1px solid var(--border);
}
@media (prefers-reduced-motion: no-preference) {
  .st-toast-btn:active { opacity: 0.8; transform: scale(0.97); }
}
@media (max-width: 520px) {
  .st-notice-row {
    align-items: stretch;
    flex-direction: column;
  }
  .st-notice-action {
    width: 100%;
  }
  .st-toast {
    flex-direction: column;
    align-items: stretch;
  }
  .st-toast-actions {
    justify-content: flex-end;
  }
  .st-toast-btn {
    flex: 1 1 0;
  }
}
/* /mobius-ui:Toast */

/* Desktop/web: the phone layout is fluid + left-aligned, which leaves a
   wide empty right gutter on a large window. Cap the content measure and
   center it so the grid, forms, banner, errors, and detail view stay
   comfortably sized and intentional on wide screens. The grid floor also
   bumps so cards don't get over-dense. */
@media (min-width: 720px) {
  .st-title-row {
    max-width: 1180px;
    margin-inline: auto;
  }
  .st-tabs {
    justify-self: center;
    width: 100%;
  }
  .st-scroll > * {
    max-width: 840px;
    margin-inline: auto;
  }
  .st-scroll.is-browse > * { max-width: 1180px; }
  .st-scroll.is-library > * { max-width: 960px; }
  .st-catalog-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
  .st-primary-btn {
    width: auto;
    min-width: 128px;
  }
  .st-detail-footer {
    width: 100%;
    max-width: 840px;
    margin-inline: auto;
    box-sizing: border-box;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
  }
  .st-detail-cta {
    width: auto;
    min-width: 148px;
  }
  .st-update-notice-actions {
    justify-content: flex-start;
  }
  .st-update-notice-actions .st-btn {
    flex: 0 0 auto;
    min-width: 136px;
  }
  .st-card-notice-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
  .st-card-notice-actions .st-big-btn,
  .st-card-notice-actions .st-btn {
    width: auto;
    min-width: 112px;
  }
  .st-sheet {
    border-radius: 16px;
  }
  .st-sheet-actions .st-btn {
    flex: 0 0 auto;
    min-width: 112px;
  }
  .st-toast {
    left: 50%;
    right: auto;
    width: max-content;
    min-width: min(420px, calc(100% - 32px));
    max-width: min(720px, calc(100% - 32px));
    transform: translateX(-50%);
  }
}

/* Publishing is one compact choose → review → publish journey. */
.st-publish-heading {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
  margin: 4px 0 22px; padding: 22px 0 18px; border-bottom: 1px solid var(--border);
}
.st-eyebrow { color: var(--accent); font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.st-publish-heading h2 { margin: 5px 0 6px; font-size: clamp(27px, 4vw, 40px); line-height: 1; letter-spacing: -.045em; }
.st-publish-heading p { margin: 0; max-width: 46ch; color: var(--muted); font-size: 14px; line-height: 1.5; }
.st-publish-heading-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
.st-publish-connection {
  min-height: 32px; display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px;
  color: var(--muted); background: var(--surface); border: 1px solid var(--border); font-size: 11px; font-weight: 700;
}
.st-publish-connection.is-ready { color: var(--green); border-color: color-mix(in srgb, var(--green) 32%, var(--border)); }
.st-publish-setup { display: flex; align-items: center; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.st-publish-setup > div { flex: 1; min-width: 0; display: grid; gap: 3px; }
.st-publish-setup span { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-publish-list-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 10px; }
.st-publish-list-head h3 { margin: 0; font-size: 14px; }
.st-publish-list-head p { margin: 0; color: var(--muted); font-size: 12px; }
.st-publish-list-head > span { flex: none; min-width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px; color: var(--muted); background: var(--surface); font-size: 11px; font-weight: 700; }
.st-publish-list { display: grid; gap: 8px; }
.st-publish-more { margin-top: 12px; }
.st-publish-more > summary {
  min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); font-size: 12px; font-weight: 700; cursor: pointer; list-style: none;
}
.st-publish-more > summary::-webkit-details-marker { display: none; }
.st-publish-more > summary small { min-width: 24px; height: 24px; display: grid; place-items: center; border-radius: 999px; background: var(--surface2, var(--bg)); }
.st-publish-more[open] > summary { margin-bottom: 8px; }
.st-publish-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 13px;
  min-height: 74px; padding: 12px; border: 1px solid var(--border); border-radius: 15px; background: var(--surface);
}
.st-publish-row-copy { min-width: 0; display: grid; gap: 4px; }
.st-publish-row-copy h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.st-publish-row-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-publish-row-copy span { color: var(--muted); font-size: 11px; }
.st-publish-row-copy .st-publish-row-message { display: block; margin-top: 4px; color: var(--danger); }
.st-publish-icon { position: relative; width: 48px; height: 48px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; color: var(--muted); background: var(--surface2, var(--bg)); font-weight: 800; }
.st-publish-icon img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-listing-review { overflow: hidden; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); }
.st-listing-review-top { min-height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; }
.st-listing-review-top > span { color: var(--muted); font-size: 11px; }
.st-listing-loading { min-height: 260px; display: grid; place-items: center; color: var(--muted); }
.st-listing-incomplete { min-height: 220px; padding: 28px; display: flex; align-items: center; justify-content: center; gap: 14px; color: var(--muted); text-align: left; }
.st-listing-incomplete > div { display: grid; gap: 5px; max-width: 440px; }
.st-listing-incomplete strong { color: var(--text); font-size: 16px; }
.st-listing-incomplete span { font-size: 13px; line-height: 1.45; }
.st-listing-hero { position: relative; min-height: clamp(280px, 46vw, 420px); overflow: hidden; background: var(--bg); }
.st-listing-hero > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-listing-hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(4, 6, 8, .88) 0%, rgba(4, 6, 8, .45) 48%, rgba(4, 6, 8, .05) 82%); }
.st-listing-hero-copy { position: absolute; z-index: 1; left: clamp(18px, 5vw, 48px); bottom: clamp(22px, 5vw, 48px); max-width: min(420px, 72%); color: white; }
.st-listing-hero-copy > img { width: 58px; height: 58px; margin-bottom: 14px; border-radius: 14px; object-fit: cover; box-shadow: 0 12px 30px #0007; }
.st-listing-hero-copy h3 { margin: 5px 0 7px; font-size: clamp(32px, 6vw, 58px); line-height: .94; letter-spacing: -.055em; }
.st-listing-hero-copy p { margin: 0; max-width: 32ch; font-size: clamp(14px, 2vw, 18px); line-height: 1.35; color: rgba(255,255,255,.82); }
.st-listing-body { padding: 22px; }
.st-listing-body > p { max-width: 64ch; margin: 0 0 18px; color: var(--muted); font-size: 14px; line-height: 1.6; }
.st-listing-gallery { display: grid; grid-auto-flow: column; grid-auto-columns: min(82%, 640px); gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.st-listing-gallery::-webkit-scrollbar { display: none; }
.st-listing-gallery figure { margin: 0; scroll-snap-align: start; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); }
.st-listing-gallery img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
.st-listing-gallery figcaption { padding: 9px 11px; color: var(--muted); font-size: 11px; }
.st-listing-publish-bar { display: grid; grid-template-columns: minmax(210px, 1fr) minmax(190px, auto) auto; align-items: end; gap: 12px; padding: 16px 22px; border-top: 1px solid var(--border); background: color-mix(in srgb, var(--surface2, var(--surface)) 70%, var(--surface)); }
.st-listing-publish-bar .st-publish-consent { align-self: center; margin: 0; }
.st-listing-source-note { margin: 0; padding: 0 22px 18px; color: var(--muted); font-size: 11px; line-height: 1.45; }
.st-publish-advanced { margin-top: 24px; }

@media (max-width: 680px) {
  .st-publish-heading { flex-direction: column; }
  .st-publish-heading-actions { justify-content: flex-start; }
  .st-publish-row { grid-template-columns: auto minmax(0, 1fr); }
  .st-publish-row > .st-btn { grid-column: 1 / -1; width: 100%; }
  .st-listing-publish-bar { grid-template-columns: 1fr; align-items: stretch; }
  .st-listing-publish-bar .st-btn { width: 100%; }
  .st-listing-hero-copy { max-width: 82%; }
  .st-listing-hero-shade { background: linear-gradient(0deg, rgba(4, 6, 8, .9) 0%, rgba(4, 6, 8, .15) 88%); }
}

/* Editorial discovery keeps the Möbius journey chrome and borrows the calm,
   story-led hierarchy of a focused marketplace: one deliberate feature at a
   time, followed by dense app rows. Spotlight is user-controlled and never
   advances on a timer. */
.st-spotlights { min-width: 0; }
.st-spotlights-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
}
.st-spotlights-head .st-catalog-section-desc { max-width: 54ch; }
.st-spotlight-pagination {
  display: flex; align-items: center; justify-content: flex-end;
  min-height: 44px;
}
.st-spotlight-pagination button {
  width: 44px; height: 44px; display: grid; place-items: center; padding: 0;
  border: 0; border-radius: 999px; background: transparent; cursor: pointer;
}
.st-spotlight-pagination button span {
  width: 7px; height: 7px; border-radius: 999px;
  background: color-mix(in srgb, var(--text) 24%, transparent);
  transition: transform 150ms ease, background 150ms ease;
}
.st-spotlight-pagination button.is-active span { transform: scaleX(3.4); background: var(--accent); }
.st-spotlight-pagination button:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; }
.st-spotlight-stage { min-width: 0; }
.st-spotlight-slide {
  position: relative; min-height: clamp(360px, 43vw, 520px); overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--text) 12%, var(--border));
  border-radius: 22px; background: var(--surface);
  box-shadow: 0 24px 70px rgba(0, 0, 0, .24);
}
.st-spotlight-slide-image,
.st-spotlight-slide > .st-store-image-placeholder {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
}
.st-spotlight-slide > .st-store-image-placeholder { background: var(--surface2, var(--surface)); }
.st-spotlight-slide-shade {
  position: absolute; inset: 0;
  background:
    linear-gradient(90deg, rgba(3,5,8,.9) 0%, rgba(3,5,8,.56) 44%, rgba(3,5,8,.06) 80%),
    linear-gradient(0deg, rgba(3,5,8,.72) 0%, rgba(3,5,8,.04) 64%);
}
.st-spotlight-slide-copy {
  position: absolute; z-index: 1;
  left: clamp(22px, 4vw, 48px); right: clamp(22px, 4vw, 48px); bottom: clamp(24px, 4vw, 48px);
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: end; gap: 16px;
  color: white;
}
.st-spotlight-slide-copy .st-icon-wrap { width: 60px; height: 60px; border-radius: 15px; box-shadow: 0 12px 30px #0009; }
.st-spotlight-kicker { display: block; margin-bottom: 7px; color: rgba(255,255,255,.68); font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.st-spotlight-slide-copy h3 { margin: 0 0 7px; font-size: clamp(34px, 5vw, 56px); line-height: .94; letter-spacing: -.05em; }
.st-spotlight-slide-copy p { margin: 0; max-width: 42ch; color: rgba(255,255,255,.8); font-size: clamp(13px, 1.5vw, 16px); line-height: 1.42; }
.st-spotlight-open {
  min-width: 108px; min-height: 44px; padding: 0 16px; border: 1px solid rgba(255,255,255,.3); border-radius: 999px;
  color: white; background: rgba(8,8,10,.5); backdrop-filter: blur(12px);
  font: 750 12px/1 var(--font); cursor: pointer;
}
@media (hover: hover) {
  .st-spotlight-open:hover { background: rgba(255,255,255,.14); }
}
.st-picks { min-width: 0; }
.st-picks-grid,
.st-catalog-sections.is-editorial .st-catalog-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;
}
.st-catalog-sections.is-editorial { gap: 28px; }
.st-catalog-sections.is-editorial .st-catalog-section-head { margin-bottom: 10px; }
.st-catalog-sections.is-editorial .st-catalog-section-title { font-size: 18px; }

/* Browse rows carry enough value copy to compare apps without spending the
   height of a tile. They are separate from Library's maintenance rows. */
.st-card.is-editorial-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto auto auto; align-items: center;
  min-height: 108px; padding: 14px; column-gap: 13px; row-gap: 2px; text-align: left;
}
.st-card.is-editorial-row .st-icon-slot { grid-column: 1; grid-row: 1 / span 3; margin: 0; }
.st-card.is-editorial-row .st-icon-wrap { width: 54px; height: 54px; border-radius: 14px; }
.st-card.is-editorial-row .st-card-open { grid-column: 2; grid-row: 1; align-self: end; min-height: 0; margin: 0; text-align: left; font-size: 15px; font-weight: 720; }
.st-card.is-editorial-row .st-card-desc {
  grid-column: 2; grid-row: 2; display: -webkit-box; min-height: 18px; margin: 2px 0 0;
  overflow: hidden; color: var(--muted); text-align: left; line-height: 1.35;
  -webkit-box-orient: vertical; -webkit-line-clamp: 1;
}
.st-card.is-editorial-row .st-card-state-row { grid-column: 2; grid-row: 3; justify-content: flex-start; min-height: 18px; margin: 2px 0 0; }
.st-card.is-editorial-row .st-card-status-row { grid-column: 3; grid-row: 1 / span 3; align-self: center; margin: 0; }
.st-card.is-editorial-row .st-card-action { min-width: 104px; border-radius: 999px; }
.st-card.is-editorial-row .st-card-notice,
.st-card.is-editorial-row .st-card-inline-error { grid-column: 1 / -1; grid-row: 4; }

/* Library rows scan like a system update centre rather than a second Store grid. */
.st-card.is-list {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto;
  align-items: center; column-gap: 14px; row-gap: 3px; min-height: 72px; padding: 11px 12px; text-align: left;
}
.st-catalog-sections.is-list { gap: 22px; }
.st-catalog-sections.is-list .st-catalog-grid { grid-template-columns: 1fr; gap: 8px; }
.st-card.is-list .st-icon-slot { grid-column: 1; grid-row: 1 / span 2; margin: 0; }
.st-card.is-list .st-icon-wrap { width: 52px; height: 52px; border-radius: 13px; }
.st-card.is-list .st-card-open { grid-column: 2; grid-row: 1; align-self: end; margin: 0; text-align: left; }
.st-card.is-list .st-card-state-row { grid-column: 2; grid-row: 2; justify-content: flex-start; min-height: 18px; margin: 0; }
.st-card.is-list .st-card-desc { display: none; }
.st-card.is-list .st-card-status-row { grid-column: 3; grid-row: 1 / span 2; align-self: center; margin: 0; }
.st-card.is-list .st-card-action { min-width: 92px; }
.st-card.is-list .st-card-notice,
.st-card.is-list .st-card-inline-error { grid-column: 1 / -1; grid-row: 3; }

/* Listing-led detail pages put imagery and product value before prose. */
.st-detail-editorial {
  position: relative; min-height: clamp(310px, 52vw, 480px); margin-bottom: 18px; overflow: hidden;
  border: 1px solid var(--border); border-radius: 22px; background: var(--surface);
}
.st-detail-editorial-image,
.st-detail-editorial > .st-store-image-placeholder { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-detail-editorial > .st-store-image-placeholder { background: var(--surface2, var(--surface)); }
.st-detail-editorial-shade { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(3,5,7,.94) 0%, rgba(3,5,7,.2) 78%); }
.st-detail-editorial-copy {
  position: absolute; z-index: 1; left: clamp(20px, 5vw, 46px); right: clamp(20px, 5vw, 46px); bottom: clamp(22px, 5vw, 46px);
  color: white;
}
.st-detail-editorial-copy .st-icon-wrap { width: 58px; height: 58px; margin-bottom: 13px; border-radius: 14px; box-shadow: 0 10px 28px #0008; }
.st-detail-editorial-copy h2 { margin: 6px 0 7px; font-size: clamp(36px, 7vw, 64px); line-height: .94; letter-spacing: -.055em; }
.st-detail-editorial-copy p { margin: 0; max-width: 38ch; color: rgba(255,255,255,.82); font-size: clamp(15px, 2vw, 19px); line-height: 1.38; }
.st-detail-gallery {
  display: grid; grid-auto-flow: column; grid-auto-columns: min(86%, 670px); gap: 12px;
  margin: 0 0 22px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
}
.st-detail-gallery.is-single { grid-auto-columns: 100%; }
.st-detail-gallery::-webkit-scrollbar { display: none; }
.st-detail-gallery figure { margin: 0; overflow: hidden; scroll-snap-align: start; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-detail-gallery-image,
.st-detail-gallery .st-store-image-placeholder { display: block; width: 100%; aspect-ratio: 5 / 3; object-fit: cover; object-position: top center; }
.st-detail-gallery .st-store-image-placeholder { background: var(--surface2, var(--surface)); }
.st-detail-gallery figcaption { padding: 9px 12px; color: var(--muted); border-top: 1px solid var(--border); font-size: 11px; font-weight: 650; }
.st-detail-byline { margin: -14px 0 26px; color: var(--muted); font: 11px/1.4 var(--mono, monospace); }
.st-detail-tagline { margin: 5px 0 0; color: var(--muted); font-size: 14px; line-height: 1.4; }

@media (max-width: 720px) {
  .st-spotlights-head { align-items: flex-start; flex-direction: column; gap: 4px; }
  .st-spotlight-pagination { align-self: center; }
  .st-spotlight-slide { min-height: 390px; }
  .st-spotlight-slide-copy { grid-template-columns: auto minmax(0, 1fr); align-items: center; }
  .st-spotlight-slide-copy .st-spotlight-open { grid-column: 1 / -1; width: 100%; }
  .st-picks-grid,
  .st-catalog-sections.is-editorial .st-catalog-grid { grid-template-columns: 1fr; }
}
@media (max-width: 460px) {
  .st-spotlight-slide { min-height: 372px; border-radius: 18px; }
  .st-spotlight-slide-shade {
    background: linear-gradient(0deg, rgba(3,5,8,.94) 0%, rgba(3,5,8,.54) 50%, rgba(3,5,8,.08) 100%);
  }
  .st-spotlight-slide-copy { left: 16px; right: 16px; bottom: 16px; gap: 10px; }
  .st-spotlight-slide-copy .st-icon-wrap { width: 50px; height: 50px; border-radius: 13px; }
  .st-card.is-editorial-row { grid-template-columns: 50px minmax(0, 1fr); min-height: 132px; padding: 12px; column-gap: 11px; }
  .st-card.is-editorial-row .st-icon-slot { grid-row: 1 / span 3; }
  .st-card.is-editorial-row .st-icon-wrap { width: 48px; height: 48px; border-radius: 12px; }
  .st-card.is-editorial-row .st-card-status-row { grid-column: 1 / -1; grid-row: 4; width: 100%; margin-top: 8px; }
  .st-card.is-editorial-row .st-card-action { width: 100%; }
  .st-card.is-editorial-row .st-card-notice,
  .st-card.is-editorial-row .st-card-inline-error { grid-row: 5; }
}

/* Hosted Spotlight editing stays inside publishing: the same reviewed GitHub
   identity that can publish apps can see this panel only when the Host grants
   its explicit Store-editor role. */
.st-spotlight-editor {
  display: grid; gap: 16px; padding: clamp(16px, 3vw, 24px);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border));
  border-radius: 20px; background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}
.st-spotlight-editor-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.st-spotlight-editor-head h3 { margin: 4px 0 6px; font-size: 21px; letter-spacing: -.025em; }
.st-spotlight-editor-head p { max-width: 58ch; margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.st-spotlight-revision {
  flex: 0 0 auto; padding: 7px 10px; border: 1px solid var(--border); border-radius: 999px;
  color: var(--muted); background: var(--bg); font: 650 10px/1 var(--mono, monospace);
}
.st-spotlight-editor-list { display: grid; gap: 8px; }
.st-spotlight-editor-row {
  display: grid; grid-template-columns: 76px minmax(0, 1fr) auto; align-items: center; gap: 12px;
  min-width: 0; padding: 9px; border: 1px solid var(--border); border-radius: 15px; background: var(--bg);
}
.st-spotlight-editor-preview {
  display: grid; place-items: center; width: 76px; height: 54px; overflow: hidden;
  border-radius: 10px; background: var(--surface2, var(--surface));
}
.st-spotlight-editor-preview > img,
.st-spotlight-editor-preview > .st-store-image-placeholder { width: 100%; height: 100%; object-fit: cover; }
.st-spotlight-editor-preview .st-icon-wrap { width: 42px; height: 42px; border-radius: 11px; }
.st-spotlight-editor-copy { min-width: 0; }
.st-spotlight-editor-copy strong,
.st-spotlight-editor-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-spotlight-editor-copy strong { margin-bottom: 3px; font-size: 13px; }
.st-spotlight-editor-copy span { color: var(--muted); font-size: 11px; }
.st-spotlight-editor-actions { display: flex; align-items: center; gap: 5px; }
.st-spotlight-editor-actions button,
.st-spotlight-upload {
  min-height: 44px; padding: 0 10px; border: 1px solid var(--border); border-radius: 9px;
  color: var(--text); background: var(--surface); font: 650 11px/1 var(--font); cursor: pointer;
}
.st-spotlight-editor-actions button svg { width: 16px; height: 16px; }
.st-spotlight-editor-actions button:disabled { opacity: .42; cursor: default; }
.st-spotlight-editor-actions .is-remove { color: var(--muted); }
.st-spotlight-upload { position: relative; display: inline-grid; place-items: center; overflow: hidden; }
.st-spotlight-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.st-spotlight-upload:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-spotlight-editor-add { display: flex; gap: 8px; }
.st-spotlight-editor-add select {
  min-width: 0; flex: 1; min-height: 40px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 10px; color: var(--text); background: var(--bg); font: 600 12px/1 var(--font);
}
.st-spotlight-editor-publish { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 4px; }
@media (hover: hover) {
  .st-spotlight-editor-actions button:not(:disabled):hover,
  .st-spotlight-upload:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
}
@media (max-width: 720px) {
  .st-spotlight-editor-head,
  .st-spotlight-editor-publish { align-items: stretch; flex-direction: column; }
  .st-spotlight-revision { align-self: flex-start; }
  .st-spotlight-editor-row { grid-template-columns: 64px minmax(0, 1fr); }
  .st-spotlight-editor-preview { width: 64px; height: 50px; }
  .st-spotlight-editor-actions { grid-column: 1 / -1; display: grid; grid-template-columns: auto auto 1fr auto; }
  .st-spotlight-editor-add { flex-direction: column; }
  .st-spotlight-editor-add select { font-size: 16px; }
  .st-spotlight-editor-publish .st-btn { width: 100%; }
}
/* mobius-ui:CenteredRail v1 */
@media (min-width: 900px) {
  .st-header { width: min(100%, 1120px); margin-inline: auto; }
}
/* /mobius-ui:CenteredRail */
`
