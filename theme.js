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
  /* One content rail for every section, matching the other official apps
     (Pages' column) so their edges line up when you switch between them. */
  --st-rail: 1110px;
  /* One gold for every star in the Store. */
  --st-star: #f2c14e;
  /* Filled purple controls carry white text; a slightly deeper fill keeps that
     text readable (4.5:1 or better) while following the theme's accent. */
  --st-accent-fill: color-mix(in srgb, var(--accent) 86%, black);
  /* Purple text on a neutral surface (Get), lifted for 4.5:1 contrast. */
  --st-accent-text: color-mix(in srgb, var(--accent) 78%, #fff);
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
  padding: max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left));
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.st-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "brand search" "tabs tabs";
  align-items: center;
  gap: 4px 20px;
}
.st-store-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.st-brand-icon {
  width: 34px; height: 34px; border-radius: 8px;
  object-fit: cover; flex-shrink: 0; display: block;
}
.st-brand-fallback {
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--st-accent-fill); color: var(--accent-fg);
  font-size: 22px; font-weight: 700; line-height: 1;
}
.st-brand-name {
  overflow: hidden;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* /mobius-ui:Segmented */

/* Store sections: Discover · Apps · Games · Library as underline tabs under
   the brand row on phones, and inline between brand and search on wide panes. */
.st-store-brand { grid-area: brand; }
.st-tabs {
  grid-area: tabs; display: flex; gap: 2px; min-width: 0;
  overflow-x: auto; scrollbar-width: none;
}
.st-tabs::-webkit-scrollbar { display: none; }
.st-tablist { display: flex; flex: 1 1 auto; gap: 2px; min-width: 0; }
.st-tab {
  position: relative; flex: 1 1 0; min-width: max-content; min-height: 46px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 0 12px; border: 0; background: transparent; color: var(--muted);
  font: 600 15px/1 var(--font); cursor: pointer; touch-action: manipulation;
}
.st-tab::after {
  content: ""; position: absolute; left: 14px; right: 14px; bottom: 0; height: 3px;
  border-radius: 3px 3px 0 0; background: transparent; transition: background .15s;
}
.st-tab.is-active { color: var(--text); }
.st-tab.is-active::after { background: var(--text); }
.st-tab:focus-visible { outline-offset: -5px; border-radius: 12px; }
@media (hover: hover) { .st-tab:not(.is-active):hover { color: var(--text); } }
@media (max-width: 620px) { .st-tab { padding: 0 8px; font-size: 15px; } }
@media (min-width: 900px) {
  .st-title-row { grid-template-columns: minmax(160px, 1fr) auto minmax(160px, 1fr); grid-template-areas: "brand tabs search"; }
  .st-tabs { justify-self: center; }
  .st-tab { flex: 0 0 auto; padding: 0 16px; min-height: 56px; }
}
.st-tab-count {
  min-width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  color: var(--accent-fg, #fff);
  background: var(--st-accent-fill);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 620px) {
  .st-brand-icon,
  .st-brand-fallback { width: 32px; height: 32px; }
}

/* Discovery controls now contain only Library filters. Search lives in the
   header and opens over content, keeping Browse focused on discovery. */
.st-search-input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  transition: border-color 150ms, box-shadow 150ms, background 150ms;
}
.st-search-input::placeholder { color: color-mix(in srgb, var(--muted) 88%, var(--text)); }
.st-search-input:focus {
  box-shadow: none;
}
.st-update-all-trigger {
  flex: 0 0 auto;
  min-height: 44px;
  margin-left: auto;
  padding: 7px 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-hover, var(--accent));
  color: var(--accent-fg);
  font: 600 13px/1 var(--font);
  cursor: pointer;
  touch-action: manipulation;
  transition: filter 150ms, transform 150ms, opacity 150ms;
}
.st-update-all-trigger:disabled { opacity: 0.52; cursor: default; }
.st-resolve-all-trigger {
  margin-left: auto;
  background: transparent;
  color: var(--text);
}
.st-update-all-trigger + .st-resolve-all-trigger { margin-left: 8px; }
.st-resolve-all-trigger .st-update-all-count {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--text);
}
.st-community-unavailable {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin: 16px 0; padding: 13px 15px; border-radius: 16px;
  color: var(--muted); background: var(--surface); border: 1px solid var(--border);
  font-size: 12px;
}
.st-publisher { display: flex; flex-direction: column; gap: 24px; padding-bottom: 36px; }
.st-publisher-intro {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 32px;
  padding: 28px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border);
}
.st-publisher-intro h2 { margin: 0 0 9px; font-size: clamp(24px, 4vw, 38px); letter-spacing: -0.03em; }
.st-publisher-intro p { max-width: 66ch; margin: 0; color: var(--muted); line-height: 1.6; }
.st-publisher-identities { display: grid; justify-items: end; gap: 8px; flex: 0 0 auto; }
.st-publisher-identity {
  display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto;
  padding: 9px 12px; border-radius: 999px; color: var(--muted);
  background: var(--bg); border: 1px solid var(--border); font-size: 12px; font-weight: 600;
}
.st-publisher-identity-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.st-publisher-identity.is-linked .st-publisher-identity-dot { background: var(--green); }
.st-publisher-contributions { flex: 0 0 auto; }
.st-publish-result {
  display: grid; gap: 4px; padding: 16px; border-radius: 16px;
  color: var(--text); background: color-mix(in srgb, var(--green) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--green) 32%, var(--border));
}
.st-publish-result span { color: var(--muted); font-size: 12px; }
.st-publish-result a {
  width: fit-content; min-height: 44px; display: inline-flex; align-items: center;
  margin-top: 5px; color: var(--text); font-size: 12px; font-weight: 700;
}
.st-publish-review {
  display: grid; gap: 16px; padding: 20px; border-radius: 16px;
  background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
}
.st-publish-review h3 { margin: 0 0 6px; font-size: 18px; }
.st-publish-review p { max-width: 70ch; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.st-publish-consent { display: flex; align-items: flex-start; gap: 12px; font-size: 12px; line-height: 1.45; cursor: pointer; }
.st-publish-consent input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
.st-publish-review-actions { display: flex; justify-content: flex-end; gap: 8px; }
.st-publisher-github-setup {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 20px;
  margin: 0; padding: 16px 18px; border-radius: 16px;
}
.st-publisher-github-setup strong,
.st-publisher-github-setup span { display: block; }
.st-publisher-github-setup strong { margin-bottom: 4px; font-size: 13px; }
.st-publisher-github-setup span { color: var(--muted); font-size: 12px; line-height: 1.5; }
.st-publisher-github-setup .st-btn { text-decoration: none; white-space: nowrap; }
.st-publish-advanced {
  margin: 0 0 18px; border: 1px solid var(--border); border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 78%, transparent); overflow: hidden;
}
.st-publish-advanced > summary {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 54px; padding: 12px 16px; cursor: pointer; list-style: none;
}
.st-publish-advanced > summary::-webkit-details-marker { display: none; }
.st-publish-advanced > summary span { color: var(--text); font-size: 13px; font-weight: 700; }
.st-publish-advanced > summary small { color: var(--muted); font-size: 12px; }
.st-publish-advanced[open] > summary { border-bottom: 1px solid var(--border); }
.st-publish-advanced .st-publish-review { margin: 0; border: 0; border-radius: 0; }
.st-community-withdraw { margin-top: 12px; }
.st-community-withdraw-btn {
  min-height: 40px; padding: 7px 13px; border-radius: 8px; cursor: pointer;
  background: transparent; color: var(--danger, #d05a5a);
  border: 1px solid color-mix(in srgb, var(--danger, #d05a5a) 45%, var(--border));
  font: inherit; font-size: 12px; font-weight: 600;
}
.st-community-withdraw-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--danger, #d05a5a) 12%, transparent); }
.st-community-withdraw-btn:disabled { opacity: 0.55; cursor: default; }
.st-community-withdraw-confirm {
  display: flex; flex-direction: column; gap: 12px; padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--danger, #d05a5a) 40%, var(--border));
  border-radius: 12px; background: color-mix(in srgb, var(--danger, #d05a5a) 7%, transparent);
}
.st-community-withdraw-confirm > span { font-size: 12px; color: var(--muted); line-height: 1.45; }
.st-community-withdraw-actions { display: flex; gap: 12px; }
.st-community-withdraw-actions button {
  min-height: 40px; padding: 7px 15px; border-radius: 8px; cursor: pointer;
  font: inherit; font-size: 12px; font-weight: 600;
  border: 1px solid var(--border); background: var(--surface, transparent); color: var(--text);
}
.st-community-withdraw-confirm-btn {
  background: var(--danger, #d05a5a) !important; color: #fff !important;
  border-color: var(--danger, #d05a5a) !important;
}
.st-community-withdraw-actions button:disabled { opacity: 0.55; cursor: default; }
.st-community-withdraw-error { font-size: 12px; color: var(--danger, #d05a5a); }
.st-community-feedback { margin: 28px 0 8px; padding-top: 24px; border-top: 1px solid var(--border); }
.st-community-feedback-head { display: grid; gap: 4px; }
.st-community-feedback h3 { margin: 0 0 5px; font-size: 18px; letter-spacing: -.02em; }
.st-community-feedback-head p { max-width: 64ch; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.st-rating-summary { display: flex; align-items: center; gap: 16px; margin-top: 18px; font-variant-numeric: tabular-nums; }
.st-rating-summary strong { font-size: 44px; line-height: 1; font-weight: 700; letter-spacing: -.02em; }
.st-rating-summary > div { display: grid; gap: 4px; }
.st-rating-summary span:not(.st-stars) { color: var(--muted); font-size: 13px; }
/* Read-only stars: gold for the score, outline for the rest. */
.st-stars { display: inline-flex; gap: 2px; color: var(--st-star); }
.st-stars svg { width: 16px; height: 16px; }
.st-stars path:not([fill="currentColor"]) { stroke: var(--muted); }
.st-rating-picker { display: flex; align-items: center; gap: 4px; margin: 20px 0 16px; }
.st-rating-picker button {
  width: 44px; height: 44px; padding: 9px; border: 0; border-radius: 12px;
  color: var(--st-star); background: transparent; cursor: pointer;
}
.st-rating-picker button path:not([fill="currentColor"]) { stroke: var(--muted); }
@media (hover: hover) { .st-rating-picker button:not(:disabled):hover { background: var(--surface-2, var(--surface)); } }
.st-rating-picker button:disabled { opacity: .45; cursor: default; }
.st-rating-picker button svg { width: 100%; height: 100%; }
.st-rating-picker > span { margin-right: 8px; color: var(--text); font-size: 14px; font-weight: 600; }
.st-review-eligibility { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.45; }
.st-review-gate { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.st-review-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.st-review-form label { grid-column: 1 / -1; font-size: 14px; font-weight: 600; }
.st-review-form textarea {
  min-height: 88px; resize: vertical; padding: 12px 13px; border: 1px solid var(--border);
  border-radius: 12px; color: var(--text); background: var(--surface); font: inherit; line-height: 1.45;
}
.st-review-form .st-btn { align-self: end; }
.st-community-feedback-error { margin-top: 9px; color: var(--danger); font-size: 12px; }
.st-review-list { margin-top: 18px; border-top: 1px solid var(--border); }
.st-review-list article { padding: 14px 0; border-bottom: 1px solid var(--border); }
.st-review-who { display: flex; align-items: center; gap: 10px; }
.st-review-who strong { font-size: 14px; font-weight: 600; }
.st-review-who .st-stars svg { width: 14px; height: 14px; }
.st-review-list article p { margin: 6px 0 0; color: var(--text); font-size: 14px; line-height: 1.55; }
.st-review-list article p.is-quiet { color: var(--muted); font-size: 13px; }
.st-review-empty { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.st-publish-field { display: grid; gap: 8px; color: var(--muted); font-size: 12px; font-weight: 700; }
.st-publish-field input {
  width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 12px;
  color: var(--text); background: var(--bg); border: 1px solid var(--border); font: inherit;
}
.st-publisher-repository-name {
  display: flex; align-items: center; min-height: 46px; overflow: hidden;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg);
}
.st-publisher-repository-name > span {
  flex: none; padding: 0 0 0 12px; color: var(--muted); font-weight: 600;
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
.st-publish-source-note { color: var(--muted); font-size: 12px; margin-right: auto; }
@media (max-width: 680px) {
  .st-publish-repository-grid { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .st-community-unavailable, .st-publisher-intro { align-items: stretch; flex-direction: column; }
  .st-review-form { grid-template-columns: 1fr; }
  .st-review-form .st-btn { width: 100%; }
  .st-review-gate .st-btn { width: 100%; }
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
  font: 600 12px/1 var(--mono, monospace);
}
@media (hover: hover) {
  .st-update-all-trigger:not(:disabled):hover { filter: brightness(0.94); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-update-all-trigger:not(:disabled):active { transform: scale(0.97); }
}
.st-notice {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2, var(--surface));
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

@media (max-width: 520px) {
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
  gap: 24px;
}
.st-catalog-more {
  display: flex;
  justify-content: center;
  padding: 8px 0 20px;
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
.st-card.is-catalog .st-icon-wrap { width: 52px; height: 52px; border-radius: 12px; }
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
  align-items: flex-end;
}
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
  .st-card:not(.is-row):not(.is-list):has(.st-card-open:hover) {
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
  width: 96px; height: 96px; border-radius: 20px;
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
  background: color-mix(in srgb, var(--surface-2) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}
/* Letter fallback (no icon / load error) gets a surface tile + border so the
   initial reads as a recognisable icon slot — real icons float transparent,
   but an iconless app still looks finished. */
.st-icon-wrap--letter {
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.st-icon-letter { font-size: 34px; font-weight: 700; color: var(--text); }
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
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-card-state-line.is-update { color: var(--text); }
.st-card-state-line.is-conflict { color: var(--orange, #e8b45a); }
.st-card-state-line.is-unavailable { color: var(--muted); }
.st-card-state-line.is-rejected { color: var(--orange, #e8b45a); }
.st-card-state-detail {
  flex-basis: 100%; max-width: 100%; color: var(--muted);
  font-size: 12px; line-height: 1.4; overflow-wrap: anywhere;
}
.st-card-state-row:has(.st-card-state-detail) { flex-wrap: wrap; row-gap: 2px; }
.st-card-state-row:has(.st-card-agent) { flex-wrap: wrap; row-gap: 4px; }
.st-card-source-update {
  display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border));
  border-radius: 999px; color: var(--text); background: var(--accent-dim);
  font-size: 12px; font-weight: 700; letter-spacing: .01em; white-space: nowrap;
}
.st-card-agent {
  display: inline-flex; align-items: center; min-height: 20px; padding: 0 8px;
  border-radius: 999px; color: var(--st-accent-text); background: var(--accent-dim, color-mix(in srgb, var(--accent) 15%, transparent));
  font-size: 11px; font-weight: 700; letter-spacing: .02em; white-space: nowrap;
}
.st-card-desc {
  font-size: 12px; color: var(--muted); line-height: 1.35;
  margin-bottom: 12px;
  text-align: center;
  min-height: 49px;
}
/* The single icon action stays visually quiet while preserving a full 44px
   touch target. Its accessible label and native tooltip carry the action name. */
.st-card-status-row {
  position: relative;
  z-index: 1;
  width: auto;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
}
.st-card-action {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0;
  background: var(--accent-hover, var(--accent));
  color: var(--accent-fg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation; user-select: none;
}
/* Install and Update share the accent primary look so the action button
   reads identically across every card; the card-level border + checkmark
   dot (see .st-card.is-update) carry the "update available" signal without
   an off-brand second button colour. Installed = a muted, lower-emphasis
   fill so the primary actions stay the eye-catchers in the grid. */
.st-card-action.is-update { background: var(--st-accent-fill); }
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
.st-card-action:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
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
/* Skeleton placeholder — same shape as a card so the grid doesn't reflow
   when the real manifests arrive. Per-block width/height stay inline. */
.st-skeleton-block {
  border-radius: 8px;
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
  padding: 12px 20px; border-radius: 12px; border: none;
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
  color: var(--text);
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
.st-back-btn {
  background: none; border: none; color: var(--text);
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
/* Detail-view hero icon — clean transparent, same as the grid (see
   .st-icon-wrap); overflow-clip rounds the lone opaque (cuberun) icon. */
.st-hero-icon {
  width: 80px; height: 80px; border-radius: 20px;
  background: transparent;
  display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.st-hero-icon.is-letter { background: var(--surface-2); border: 1px solid var(--border); }
.st-hero-icon-letter { font-size: 34px; font-weight: 700; color: var(--text); }
.st-hero-meta { font-size: 12px; color: var(--muted); font-family: var(--mono, monospace); user-select: none; }
.st-detail-desc { max-width: 72ch; font-size: 14px; line-height: 1.55; color: var(--text); margin-bottom: 24px; }
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
  font-size: 12px;
  font-weight: 600;
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
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.45;
}
.st-capability-change { margin-bottom: 10px; color: var(--text); }
.st-capability-list { display: grid; gap: 8px; }
.st-perm-hint { color: var(--muted); font-size: 12px; margin-top: 4px; }
.st-capability-diff-row.is-added { border-color: color-mix(in srgb, var(--green) 45%, var(--border)); }
.st-capability-diff-row.is-removed { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
.st-capability-diff-kind {
  display: inline-block; margin-right: 7px; color: var(--muted);
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
}
.st-capability-diff-values {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
  margin-top: 5px; color: var(--text); font-size: 13px; line-height: 1.4;
}
.st-capability-diff-arrow { color: var(--muted); }
.st-capability-diff-before { color: var(--muted); }
.st-capability-full-access {
  margin-top: 8px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
}
.st-capability-full-access summary {
  min-height: 44px; padding: 12px; cursor: pointer; color: var(--muted);
  font-size: 13px; font-weight: 600; touch-action: manipulation;
}
.st-capability-full-access[open] summary { border-bottom: 1px solid var(--border); color: var(--text); }
.st-capability-full-access > .st-capability-list { padding: 10px; }

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
  font-weight: 600;
}
.st-technical-summary-meta {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-family: var(--mono, monospace);
  font-size: 12px;
  line-height: 1.35;
}
.st-technical-details.is-attention .st-technical-summary-meta { color: var(--text); }
.st-technical-body {
  padding: 14px;
  border-top: 1px solid var(--border);
}
/* A short capability tag next to each permission row. State (read / write /
   muted) rides is-* modifiers; 'no'/'none' both render muted. */
.st-perm-tag {
  flex-shrink: 0;
  padding: 2px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
  font-family: var(--font); letter-spacing: 0;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--text);
  border: 1px solid var(--accent);
  align-self: flex-start;
}
/* The platform marks the few rows that can change Möbius itself or act for
   the owner; the Store names that plainly instead of an unexplained dot. */
.st-perm-critical {
  flex-shrink: 0; align-self: flex-start; padding: 2px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 600; white-space: nowrap;
  color: var(--danger, #f87171); background: color-mix(in srgb, var(--danger, #f87171) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger, #f87171) 70%, transparent);
}
.st-perm-tag.is-read { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.st-perm-tag.is-muted {
  background: color-mix(in srgb, var(--muted) 14%, transparent);
  color: var(--muted);
  border-color: var(--border);
}
.st-setup-card {
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}
.st-setup-main { font-weight: 600; color: var(--text); }
.st-setup-note { color: var(--muted); margin-top: 4px; }
.st-setup-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}
.st-setup-meta {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
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
.st-host-warn-icon { font-size: 16px; line-height: 1.2; color: var(--text); flex-shrink: 0; }
.st-host-warn-host { font-weight: 600; color: var(--text); font-family: var(--mono, monospace); }
.st-host-warn-body { color: var(--muted); margin-top: 2px; }
.st-link { color: var(--text); text-decoration: none; }
.st-installed-note { font-size: 14px; color: var(--muted); user-select: none; }
/* The "you uninstalled this app" note sits with the primary action; on a wide window it fills the space to its left. */
.st-detail-note { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: 13px; line-height: 1.4; }
.st-detail-note strong { color: var(--text); font-weight: 600; }
.st-detail-note span { color: var(--muted); }
/* Full-width solid accent button for the update-notice "Review in chat" /
   "Resolve in chat" action. (The detail-footer CTA and modal confirm both
   use the canonical st-btn now; this stays for the in-flow update notice.) */
.st-big-btn {
  width: 100%; padding: 12px 16px; border-radius: 12px;
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
  padding: 12px 16px; border-radius: 12px;
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
/* mobius-ui:Empty v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
  max-width: 440px; margin: 0 auto; padding: 48px 24px; color: var(--muted);
}
.st-empty-title { font-size: 18px; font-weight: 700; color: var(--text); letter-spacing: 0; }
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
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 16px;
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
  flex: 0 0 auto; width: 44px; height: 44px; margin: -4px -4px 0 0;
  display: grid; place-items: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted);
  font: 400 22px/1 var(--font); cursor: pointer;
}
.st-update-review-close svg { width: 18px; height: 18px; }
.st-update-review-close:disabled { opacity: 0.5; cursor: default; }
@media (hover: hover) {
  .st-update-review-close:not(:disabled):hover { background: var(--surface-2); color: var(--text); }
}
.st-update-review-body {
  min-height: 0; overflow-y: auto; overflow-x: hidden;
  display: flex; flex-direction: column; gap: 20px;
  padding-right: 2px; overscroll-behavior: contain;
  scrollbar-width: none;
}
.st-update-review-body::-webkit-scrollbar { display: none; }
.st-update-review-section { display: flex; flex-direction: column; gap: 16px; padding: 18px; border: 1px solid var(--border); border-radius: 16px; }
.st-update-review-section-head { flex-wrap: wrap; }
.st-update-review-section-head h3 { color: var(--text); font-size: 16px; }
.st-update-version { display: block; color: var(--muted); font-size: 12px; margin-top: 4px; }
.st-update-status { padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--surface-2); }
.st-update-status.is-success { color: var(--green); }
.st-update-status.is-attention { color: var(--orange, #e8b45a); }
.st-update-status.is-error { color: var(--danger); }
.st-update-change-summary h4 { margin: 0 0 7px; font-size: 14px; }
.st-update-change-summary p { margin: 0; font-size: 13px; line-height: 1.6; }
.st-update-change-summary .st-update-summary-note { color: var(--muted); margin-top: 7px; }
.st-update-technical { border-top: 1px solid var(--border); padding-top: 4px; }
.st-update-technical > summary { min-height: 44px; padding: 12px 0; cursor: pointer; font-size: 13px; }
.st-update-technical > summary span { margin-left: 8px; color: var(--muted); }
.st-update-technical > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-update-review-notice p { margin: 0 0 12px; }
.st-update-review-notice.is-success { color: var(--text); border-color: color-mix(in srgb, var(--green) 40%, var(--border)); }
.st-update-review-section > h3 {
  margin: 0; font-size: 12px; line-height: 1.4; font-weight: 600; color: var(--muted);
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
  padding: 12px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface-2); color: var(--muted);
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
.st-update-review-notice .st-btn + .st-btn { margin-left: 8px; }
.st-update-review-warnings { margin: 0; padding-left: 18px; color: var(--muted); font-size: 13px; line-height: 1.5; }
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
  min-height: 44px; padding: 10px 16px; border-radius: 12px;
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
.st-btn-secondary { background: var(--surface-2, var(--surface)); }
.st-btn-ghost { background: transparent; border-color: transparent; color: var(--text); }
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
  background: var(--surface-2, var(--surface));
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
    max-width: var(--st-rail);
    margin-inline: auto;
  }
  .st-scroll > * {
    max-width: 840px;
    margin-inline: auto;
  }
  .st-scroll.is-browse > * { max-width: var(--st-rail); }
  .st-scroll.is-library > * { max-width: var(--st-rail); }
  .st-scroll.is-detail > * { max-width: var(--st-rail); }
  .st-primary-btn {
    width: auto;
    min-width: 128px;
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
/* Publishing shares the Store's content rail, one left edge. */
.st-publisher { width: min(100%, var(--st-rail)); max-width: none !important; margin-inline: auto; }
.st-publish-heading {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
  margin: 4px 0 22px; padding: 22px 0 18px; border-bottom: 1px solid var(--border);
}
.st-publish-heading h2 { margin: 0 0 8px; font-size: clamp(27px, 4vw, 40px); line-height: 1; letter-spacing: -.045em; }
.st-publish-heading p { margin: 0; max-width: 46ch; color: var(--muted); font-size: 14px; line-height: 1.5; }
.st-publish-path { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 16px 0 0; padding: 0; list-style: none; color: var(--text); font-size: 12px; font-weight: 600; counter-reset: publish-step; }
.st-publish-path li { position: relative; counter-increment: publish-step; }
.st-publish-path li::before { content: counter(publish-step); display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: 7px; border: 1px solid var(--border); border-radius: 50%; color: var(--muted); font-size: 12px; }
.st-publish-heading-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
/* In Library's Your apps tab the tab names the page, so its actions are one
   quiet row under the tabs rather than a second page heading. */
.st-publish-connection {
  min-height: 32px; display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px;
  color: var(--muted); background: var(--surface); border: 1px solid var(--border); font-size: 12px; font-weight: 700;
}
.st-publish-connection.is-ready { color: var(--green); border-color: color-mix(in srgb, var(--green) 32%, var(--border)); }
.st-publish-connection-action { cursor: pointer; color: var(--text); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); font-family: inherit; }
.st-publish-connection-action:hover { background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.st-publish-setup { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-publish-setup > div { flex: 1; min-width: 0; display: grid; gap: 4px; }
.st-publish-setup span { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-publish-search { width: min(260px, 42vw); min-height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; color: var(--muted); background: var(--surface); }
.st-publish-search:focus-within { border-color: var(--accent); outline: 2px solid color-mix(in srgb, var(--accent) 18%, transparent); }
.st-publish-search input { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--text); background: transparent; font: inherit; font-size: 13px; }
.st-publish-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 22px; }
.st-publish-more { margin-top: 12px; }
.st-publish-more > summary {
  min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); font-size: 12px; font-weight: 700; cursor: pointer; list-style: none;
}
.st-publish-more > summary::-webkit-details-marker { display: none; }
.st-publish-more > summary small { min-width: 24px; height: 24px; display: grid; place-items: center; border-radius: 999px; background: var(--surface-2, var(--bg)); }
.st-publish-more[open] > summary { margin-bottom: 8px; }
.st-publish-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px;
  min-height: 78px; padding: 12px 0; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; background: transparent;
}
.st-publish-row-copy { min-width: 0; display: grid; gap: 4px; }
.st-publish-row-copy h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.st-publish-row-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-publish-row-copy span { color: var(--muted); font-size: 12px; }
.st-publish-row-copy .st-publish-row-message { display: block; margin-top: 4px; color: var(--danger); }
.st-publish-icon { position: relative; width: 48px; height: 48px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; color: var(--muted); background: var(--surface-2, var(--bg)); font-weight: 700; }
.st-publish-icon img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-listing-review { overflow: hidden; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); }
.st-listing-review-top { min-height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; }
.st-listing-review-top > span { color: var(--muted); font-size: 12px; }
.st-listing-loading { min-height: 260px; display: grid; place-items: center; color: var(--muted); }
.st-listing-incomplete { min-height: 220px; padding: 28px; display: flex; align-items: center; justify-content: center; gap: 16px; color: var(--muted); text-align: left; }
.st-listing-incomplete > div { display: grid; gap: 4px; max-width: 440px; }
.st-listing-incomplete strong { color: var(--text); font-size: 16px; }
.st-listing-agent { justify-self: start; margin-top: 8px; }
.st-listing-review > .st-listing-agent { margin: 0 22px 18px; }
.st-listing-incomplete span { font-size: 13px; line-height: 1.45; }
.st-listing-hero { grid-area: hero; position: relative; min-height: clamp(280px, 46vw, 420px); overflow: hidden; background: var(--bg); border-right: 1px solid var(--border); }
.st-listing-hero > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-listing-hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(4, 6, 8, .88) 0%, rgba(4, 6, 8, .45) 48%, rgba(4, 6, 8, .05) 82%); }
.st-listing-hero-copy { position: absolute; z-index: 1; left: clamp(18px, 5vw, 48px); bottom: clamp(22px, 5vw, 48px); max-width: min(420px, 72%); color: white; }
.st-listing-hero-copy > img { width: 58px; height: 58px; margin-bottom: 14px; border-radius: 16px; object-fit: cover; box-shadow: 0 12px 30px #0007; }
.st-listing-hero-copy h3 { margin: 5px 0 7px; font-size: clamp(34px, 6vw, 58px); line-height: .94; letter-spacing: -.055em; }
.st-listing-hero-copy p { margin: 0; max-width: 32ch; font-size: clamp(14px, 2vw, 18px); line-height: 1.35; color: rgba(255,255,255,.82); }
.st-listing-body { grid-area: body; min-width: 0; padding: 22px; border-right: 1px solid var(--border); }
.st-listing-body > p { max-width: 64ch; margin: 0 0 18px; color: var(--muted); font-size: 14px; line-height: 1.6; }
.st-listing-gallery { display: grid; grid-auto-flow: column; grid-auto-columns: min(82%, 640px); gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.st-listing-gallery::-webkit-scrollbar { display: none; }
.st-listing-gallery figure { margin: 0; scroll-snap-align: start; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: var(--bg); }
.st-listing-gallery img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
.st-listing-gallery figcaption { padding: 9px 11px; color: var(--muted); font-size: 12px; }
.st-listing-ready-layout {
  display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, .75fr);
  grid-template-areas: "hero release" "body release"; align-items: start;
}
.st-listing-release-panel { grid-area: release; position: sticky; top: 0; display: grid; gap: 20px; padding: 24px; }
.st-listing-release-copy h3 { margin: 0 0 7px; font-size: 18px; letter-spacing: -.02em; }
.st-listing-release-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.st-listing-release-panel > .st-btn-primary { width: 100%; }
.st-listing-revise { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; border-top: 1px solid var(--border); }
.st-listing-work { display: grid; gap: 20px; padding: 4px 18px 22px; }
.st-listing-work > .st-listing-agent { margin: 0; }

.st-checklist { border: 1px solid var(--border); border-radius: 16px; background: var(--bg); overflow: hidden; }
.st-checklist-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.st-checklist-head > div { display: grid; gap: 4px; }
.st-checklist-head strong { font-size: 15px; }
.st-checklist-head span { color: var(--muted); font-size: 12px; }
.st-checklist-head .st-btn { display: inline-flex; align-items: center; gap: 8px; }
.st-checklist ul { list-style: none; margin: 0; padding: 4px 0; }
.st-checklist li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 10px 16px; }
.st-check-icon { color: var(--muted); margin-top: 1px; }
.st-check-icon.is-done { color: var(--accent); }
.st-checklist li > div { display: grid; gap: 2px; min-width: 0; }
.st-check-label { font-size: 14px; font-weight: 600; }
.st-check-label small { color: var(--muted); font-weight: 500; }
.st-checklist li.is-done .st-check-label { color: var(--muted); font-weight: 600; }
.st-check-note { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-check-agent {
  min-height: 36px; padding: 6px 11px; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 600;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); cursor: pointer; white-space: nowrap;
}
.st-check-agent:disabled { opacity: .55; cursor: default; }
.st-checklist-head > .st-checklist-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.st-agent-status { display: inline-flex; align-items: center; gap: 8px; }
.st-check-agent.is-working { display: inline-flex; align-items: center; gap: 7px; color: var(--text); border-style: dashed; }
.st-agent-pulse {
  flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  .st-agent-pulse { animation: st-agent-pulse 1.6s ease-out infinite; }
}
@keyframes st-agent-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); }
  100% { box-shadow: 0 0 0 8px transparent; }
}
.st-agent-conflicts { display: grid; gap: 10px; }
.st-agent-conflict {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 14px; border-radius: 14px; background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
}
.st-agent-conflict > div:first-child { display: grid; gap: 3px; min-width: 0; flex: 1 1 260px; }
.st-agent-conflict strong { font-size: 14px; }
.st-agent-conflict span { color: var(--muted); font-size: 12px; }
.st-agent-conflict q { font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
.st-agent-conflict-actions { display: flex; align-items: center; gap: 12px; }

.st-listing-editor { display: grid; gap: 20px; }
.st-edit-identity { display: flex; align-items: center; gap: 16px; }
.st-edit-identity > div:last-child { display: grid; gap: 2px; }
.st-edit-identity strong { font-size: 18px; }
.st-edit-icon { width: 60px; height: 60px; flex: none; display: grid; place-items: center; overflow: hidden; border-radius: 16px; border: 1px solid var(--border); background: var(--bg); color: var(--muted); }
.st-edit-icon img { width: 100%; height: 100%; object-fit: cover; }
.st-link-btn { justify-self: start; display: inline-flex; align-items: center; min-height: 32px; padding: 0; border: 0; background: none; color: var(--accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.st-link-btn:disabled { opacity: .55; cursor: default; }
.st-edit-field { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.st-edit-label { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; padding: 0; font-size: 13px; font-weight: 700; }
.st-edit-label small { color: var(--muted); font-weight: 500; margin-right: auto; margin-left: 6px; }
.st-edit-count { color: var(--muted); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.st-edit-count.is-over { color: var(--danger, #d05a5a); }
.st-edit-field input, .st-edit-field textarea, .st-edit-shot input {
  width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 12px; font: inherit; font-size: 14px;
  color: var(--text); background: var(--bg); border: 1px solid var(--border);
}
.st-edit-field textarea { resize: vertical; line-height: 1.5; min-height: 120px; }
.st-edit-field input:focus-visible, .st-edit-field textarea:focus-visible, .st-edit-shot input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 1px; border-color: var(--accent);
}
.st-edit-hint { margin: -2px 0 2px; color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-edit-shots { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(200px, 240px); gap: 12px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x proximity; }
.st-edit-shot { display: grid; gap: 8px; align-content: start; scroll-snap-align: start; }
.st-edit-shot input { min-height: 40px; font-size: 13px; }
.st-edit-shot-image, .st-edit-hero { position: relative; overflow: hidden; border-radius: 12px; border: 1px solid var(--border); background: var(--bg); }
.st-edit-shot-image { aspect-ratio: 10 / 16; display: grid; place-items: center; }
.st-edit-shot-image img, .st-edit-hero img { display: block; width: 100%; height: 100%; object-fit: cover; }
.st-edit-shot-image span { padding: 12px; color: var(--muted); font-size: 12px; text-align: center; }
.st-edit-hero { aspect-ratio: 16 / 7; }
.st-edit-remove {
  position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; display: grid; place-items: center;
  border-radius: 999px; border: 0; color: #fff; background: rgba(0, 0, 0, .55); cursor: pointer;
}
.st-edit-remove:disabled { opacity: .5; cursor: default; }
.st-edit-add {
  min-height: 120px; display: grid; place-items: center; align-content: center; gap: 6px; padding: 12px;
  aspect-ratio: 10 / 16; border-radius: 12px; border: 1.5px dashed var(--border); background: transparent;
  color: var(--muted); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
}
.st-edit-add.is-wide { aspect-ratio: 16 / 5; width: 100%; }
.st-edit-add:disabled { opacity: .55; cursor: default; }
.st-visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.st-file-picker { position: relative; cursor: pointer; }
.st-file-picker.is-disabled { opacity: .55; cursor: default; }
.st-file-picker:focus-within { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
.st-edit-error { margin: 0; color: var(--danger, #d05a5a); font-size: 13px; }
.st-edit-actions {
  position: sticky; bottom: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 0 -18px -22px; padding: 12px 18px; border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(8px);
}
.st-edit-actions > span { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-edit-actions .st-btn { flex: none; }

/* Publish: the listing's license choice. Whole-card radios, so each is an
   easy target and its one-line meaning reads with the name. */
.st-license-options { display: grid; gap: 8px; margin-top: 8px; }
.st-license-option {
  position: relative; display: flex; align-items: flex-start; gap: 12px; min-height: 44px; padding: 12px 14px;
  border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease;
}
.st-license-option input { flex: 0 0 auto; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--accent); cursor: pointer; }
.st-license-option:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-license-option.is-active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
@media (hover: hover) { .st-license-option:not(.is-active):hover { background: var(--surface-2, var(--surface)); } }
.st-license-copy { display: grid; gap: 3px; min-width: 0; }
.st-license-title { display: flex; align-items: center; gap: 8px; font: 650 15px/1.3 var(--font); }
.st-license-badge { padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--st-accent-text, var(--accent)); font: 650 11px/1.5 var(--font); }
.st-license-summary { color: var(--muted); font: 400 13px/1.45 var(--font); }
.st-edit-hint.is-needed { color: var(--text); font-weight: 600; }
.st-license-refusal { display: grid; gap: 4px; margin-top: 8px; }
.st-edit-license .st-edit-hint { overflow-wrap: anywhere; }
.st-publish-license { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
.st-publish-license > span { color: var(--muted); font-size: 12px; font-weight: 700; }
.st-publish-license > strong { flex: 1 1 auto; color: var(--text); font-weight: 650; }
@media (prefers-reduced-motion: reduce) { .st-license-option { transition: none; } }

@media (hover: hover) {
  .st-check-agent:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .st-edit-add:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
}
@media (max-width: 680px) {
  .st-listing-work { padding: 4px 12px 18px; }
  .st-checklist-head .st-btn { width: 100%; justify-content: center; }
  .st-checklist-actions { width: 100%; }
  .st-edit-actions { margin: 0 -12px -18px; padding: 12px; }
}
.st-publish-advanced { margin-top: 24px; }

@media (max-width: 680px) {
  .st-publish-heading { flex-direction: column; }
  .st-publisher.is-reviewing .st-publish-heading { gap: 16px; margin-bottom: 18px; padding: 12px 0 14px; }
  .st-publisher.is-reviewing .st-publish-heading h2 { font-size: 28px; }
  .st-publisher.is-reviewing .st-publish-path { gap: 8px 16px; margin-top: 12px; }
  .st-publish-heading-actions { justify-content: flex-start; }
  .st-publish-search { width: 100%; }
  .st-publish-list { grid-template-columns: 1fr; }
  .st-publish-row { grid-template-columns: auto minmax(0, 1fr); }
  .st-publish-row > .st-btn { grid-column: 1 / -1; width: 100%; }
  .st-listing-ready-layout { grid-template-columns: 1fr; grid-template-areas: "hero" "release" "body"; }
  .st-listing-hero { min-height: 280px; border-right: 0; border-bottom: 1px solid var(--border); }
  .st-listing-body { padding: 18px 16px; border-top: 1px solid var(--border); border-right: 0; }
  .st-listing-release-panel { position: static; gap: 16px; padding: 20px 16px; }
  .st-listing-release-panel > .st-btn-primary { min-height: 48px; }
  .st-listing-revise { display: grid; grid-template-columns: 1fr 1fr; }
  .st-listing-revise .st-btn { min-height: 44px; }
  .st-listing-hero-copy { max-width: 82%; }
  .st-listing-hero-shade { background: linear-gradient(0deg, rgba(4, 6, 8, .9) 0%, rgba(4, 6, 8, .15) 88%); }
}

/* Spotlight: the Store's top carousel. One app at a time, story-style
   progress segments inside the art (the running segment's end advances it),
   pausable, swipeable, and still under
   reduced motion. */
.st-spotlights { min-width: 0; }
.st-spotlight-stage { position: relative; min-width: 0; touch-action: pan-y; }
.st-spotlight-slide {
  position: relative; min-height: clamp(300px, 30vw, 400px); overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 20px; background: var(--surface);
}
.st-spotlight-slide-image,
.st-spotlight-slide > .st-store-image-placeholder { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-spotlight-slide > .st-store-image-placeholder { background: var(--surface-2, var(--surface)); }
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
.st-spotlight-slide-copy .st-icon-wrap { width: 60px; height: 60px; border-radius: 16px; box-shadow: 0 12px 30px #0009; }
.st-spotlight-slide-text { min-width: 0; }
.st-spotlight-kicker {
  display: block; margin-bottom: 7px; color: color-mix(in srgb, var(--accent) 72%, #fff);
  font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
}
.st-spotlight-slide-copy h3 { margin: 0 0 7px; font-size: clamp(34px, 5vw, 56px); line-height: .94; letter-spacing: -.05em; }
.st-spotlight-slide-copy p { margin: 0; max-width: 42ch; color: rgba(255,255,255,.8); font-size: clamp(13px, 1.5vw, 16px); line-height: 1.42; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.st-spotlight-open {
  align-self: end; min-height: 40px; padding: 0 20px; border: 0; border-radius: 999px;
  color: #0c0c10; background: #fff; font: 700 14px/1 var(--font); cursor: pointer;
  box-shadow: 0 6px 18px rgba(0,0,0,.35);
}
@media (hover: hover) { .st-spotlight-open:hover { background: color-mix(in srgb, #fff 86%, var(--accent)); } }
@media (prefers-reduced-motion: no-preference) {
  .st-spotlight-slide-image { animation: st-spot-in .55s ease both; }
  .st-spotlight-slide-copy { animation: st-spot-copy .45s ease .08s both; }
}
@keyframes st-spot-in { from { opacity: 0; transform: scale(1.04); } to { opacity: 1; transform: none; } }
@keyframes st-spot-copy { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.st-spotlight-pagination {
  position: absolute; z-index: 2; top: 12px; left: 16px; right: 12px;
  display: flex; align-items: center; gap: 6px;
}
.st-spotlight-pagination > button:not(.st-spotlight-toggle) {
  flex: 1 1 0; min-width: 0; height: 32px; padding: 0; display: flex; align-items: center;
  border: 0; border-radius: 8px; background: transparent; cursor: pointer;
}
.st-spotlight-pagination button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
.st-spotlight-track {
  position: relative; display: block; width: 100%; height: 3px; overflow: hidden;
  border-radius: 4px; background: rgba(255,255,255,.28);
}
.st-spotlight-pagination .is-seen .st-spotlight-track,
.st-spotlight-pagination .is-active .st-spotlight-track:not(:has(.st-spotlight-fill)) { background: rgba(255,255,255,.9); }
.st-spotlight-fill {
  position: absolute; inset: 0; display: block; border-radius: 4px; background: #fff; transform-origin: left center;
  animation: st-spot-fill 6s linear forwards;
}
.st-spotlight-fill.is-paused { animation-play-state: paused; }
@keyframes st-spot-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.st-spotlight-toggle {
  flex: 0 0 auto; width: 32px; height: 32px; margin-left: 4px; display: grid; place-items: center; padding: 0;
  border: 0; border-radius: 50%; color: #fff; background: rgba(8,8,12,.5); backdrop-filter: blur(10px); cursor: pointer;
}
.st-spotlight-toggle:hover { background: rgba(8,8,12,.72); }
.st-spotlight-toggle[aria-pressed="true"] { color: #0c0c10; background: #fff; }
.st-spotlight-arrow {
  position: absolute; z-index: 2; top: 50%; width: 42px; height: 42px; margin-top: -21px; display: grid; place-items: center;
  border: 0; border-radius: 50%; color: #fff; background: rgba(8,8,12,.5); backdrop-filter: blur(10px);
  cursor: pointer; opacity: 0; transition: opacity .2s ease, background .2s ease;
}
.st-spotlight-arrow.is-prev { left: 12px; }
.st-spotlight-arrow.is-next { right: 12px; }
.st-spotlight-stage:hover .st-spotlight-arrow,
.st-spotlight-arrow:focus-visible { opacity: 1; }
.st-spotlight-arrow:hover { background: rgba(8,8,12,.75); }
@media (hover: none) { .st-spotlight-arrow { display: none; } }
@media (max-width: 720px) {
  .st-spotlight-slide { min-height: 340px; }
}
@media (max-width: 460px) {
  .st-spotlight-slide { min-height: 320px; border-radius: 20px; }
  .st-spotlight-slide-shade { background: linear-gradient(0deg, rgba(3,5,8,.94) 0%, rgba(3,5,8,.54) 50%, rgba(3,5,8,.08) 100%); }
  .st-spotlight-slide-copy {
    left: 16px; right: 16px; bottom: 16px; gap: 12px;
    grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "icon text" "open open";
  }
  .st-spotlight-slide-copy > .st-icon-wrap { grid-area: icon; align-self: end; width: 50px; height: 50px; border-radius: 12px; }
  .st-spotlight-slide-text { grid-area: text; }
  .st-spotlight-slide-copy .st-spotlight-open { grid-area: open; justify-self: start; }
  .st-spotlight-slide-copy h3 { font-size: 30px; margin-bottom: 5px; }
  .st-spotlight-slide-copy p { -webkit-line-clamp: 2; font-size: 14px; }
}

.st-picks { min-width: 0; }
.st-picks-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;
}
.st-catalog-sections.is-editorial { gap: 32px; }

/* Browse rows carry enough value copy to compare apps without spending the
   height of a tile. They are separate from Library's maintenance rows. */
.st-card.is-editorial-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto auto auto; align-items: center;
  min-height: 108px; padding: 14px; column-gap: 13px; row-gap: 2px; text-align: left;
}
.st-card.is-editorial-row .st-icon-slot { grid-column: 1; grid-row: 1 / span 3; margin: 0; }
.st-card.is-editorial-row .st-icon-wrap { width: 54px; height: 54px; border-radius: 16px; }
.st-card.is-editorial-row .st-card-open { grid-column: 2; grid-row: 1; align-self: end; min-height: 0; margin: 0; text-align: left; font-size: 15px; font-weight: 700; }
.st-card.is-editorial-row .st-card-desc {
  grid-column: 2; grid-row: 2; display: -webkit-box; min-height: 18px; margin: 2px 0 0;
  overflow: hidden; color: var(--muted); text-align: left; line-height: 1.35;
  -webkit-box-orient: vertical; -webkit-line-clamp: 2;
}
.st-card.is-editorial-row .st-card-state-row { grid-column: 2; grid-row: 3; justify-content: flex-start; min-height: 18px; margin: 2px 0 0; }
.st-card.is-editorial-row .st-card-status-row { grid-column: 3; grid-row: 1 / span 3; align-self: center; margin: 0; }
.st-card.is-editorial-row .st-card-inline-error { grid-column: 1 / -1; grid-row: 4; }

/* Library rows scan like a system update centre rather than a second Store grid. */
.st-card.is-list {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto;
  align-items: center; column-gap: 14px; row-gap: 3px; min-height: 72px; padding: 11px 12px; text-align: left;
}
.st-catalog-sections.is-list { gap: 24px; }
.st-card.is-list .st-icon-slot { grid-column: 1; grid-row: 1 / span 2; margin: 0; }
.st-card.is-list .st-icon-wrap { width: 52px; height: 52px; border-radius: 12px; }
.st-card.is-list .st-card-open { grid-column: 2; grid-row: 1; align-self: end; margin: 0; text-align: left; }
.st-card.is-list .st-card-state-row { grid-column: 2; grid-row: 2; justify-content: flex-start; min-height: 18px; margin: 0; }
.st-card.is-list .st-card-desc { display: none; }
.st-card.is-list .st-card-status-row { grid-column: 3; grid-row: 1 / span 2; align-self: center; margin: 0; }
.st-card.is-list .st-card-status-row { display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
.st-card.is-list .st-card-inline-error { grid-column: 1 / -1; grid-row: 3; }

/* Listing-led detail pages put imagery and product value before prose. */
.st-detail-gallery {
  display: grid; grid-auto-flow: column; grid-auto-columns: min(86%, 670px); gap: 12px;
  margin-block: 0 22px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
}
.st-detail-gallery.is-single { grid-auto-columns: 100%; }
.st-detail-gallery::-webkit-scrollbar { display: none; }
.st-detail-gallery figure { margin: 0; overflow: hidden; scroll-snap-align: start; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-detail-gallery-image,
.st-detail-gallery .st-store-image-placeholder { display: block; width: 100%; aspect-ratio: auto; object-fit: cover; object-position: top center; }
.st-detail-gallery .st-store-image-placeholder { aspect-ratio: 5 / 3; background: var(--surface-2, var(--surface)); }
.st-detail-gallery figcaption { padding: 9px 12px; color: var(--muted); border-top: 1px solid var(--border); font-size: 12px; font-weight: 600; }

@media (max-width: 720px) {
  .st-picks-grid { grid-template-columns: 1fr; }
}
@media (max-width: 460px) {
  .st-card.is-editorial-row { grid-template-columns: 50px minmax(0, 1fr) auto; min-height: 108px; padding: 12px; column-gap: 11px; }
  .st-card.is-editorial-row .st-icon-slot { grid-row: 1 / span 3; }
  .st-card.is-editorial-row .st-icon-wrap { width: 48px; height: 48px; border-radius: 12px; }
  .st-card.is-editorial-row .st-card-status-row { grid-column: 3; grid-row: 1 / span 3; width: auto; margin: 0; }
  .st-card.is-editorial-row .st-card-inline-error { grid-row: 4; }
}

/* Hosted Spotlight editing stays inside publishing: the same reviewed GitHub
   identity that can publish apps can see this panel only when the Host grants
   its explicit Store-editor role. */
.st-spotlight-editor {
  display: grid; gap: 16px; padding: clamp(16px, 3vw, 24px);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border));
  border-radius: 20px; background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}
.st-spotlight-editor-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.st-spotlight-editor-head h3 { margin: 4px 0 6px; font-size: 22px; letter-spacing: -.025em; }
.st-spotlight-editor-head p { max-width: 58ch; margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.st-spotlight-revision {
  flex: 0 0 auto; padding: 7px 10px; border: 1px solid var(--border); border-radius: 999px;
  color: var(--muted); background: var(--bg); font: 600 12px/1 var(--mono, monospace);
}
.st-spotlight-editor-list { display: grid; gap: 8px; }
.st-spotlight-editor-row {
  display: grid; grid-template-columns: 76px minmax(0, 1fr) auto; align-items: center; gap: 12px;
  min-width: 0; padding: 9px; border: 1px solid var(--border); border-radius: 16px; background: var(--bg);
}
.st-spotlight-editor-preview {
  display: grid; place-items: center; width: 76px; height: 54px; overflow: hidden;
  border-radius: 12px; background: var(--surface-2, var(--surface));
}
.st-spotlight-editor-preview > img,
.st-spotlight-editor-preview > .st-store-image-placeholder { width: 100%; height: 100%; object-fit: cover; }
.st-spotlight-editor-preview .st-icon-wrap { width: 42px; height: 42px; border-radius: 12px; }
.st-spotlight-editor-copy { min-width: 0; }
.st-spotlight-editor-copy strong,
.st-spotlight-editor-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-spotlight-editor-copy strong { margin-bottom: 3px; font-size: 13px; }
.st-spotlight-editor-copy span { color: var(--muted); font-size: 12px; }
.st-spotlight-editor-actions { display: flex; align-items: center; gap: 4px; }
.st-spotlight-editor-actions button,
.st-spotlight-upload {
  min-height: 44px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); background: var(--surface); font: 600 12px/1 var(--font); cursor: pointer;
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
  border-radius: 12px; color: var(--text); background: var(--bg); font: 600 12px/1 var(--font);
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
  .st-header { width: min(100%, calc(var(--st-rail) + 32px)); margin-inline: auto; padding-inline: 16px; }
}
/* /mobius-ui:CenteredRail */

/* Compact catalogue grammar: shared by each discovery shelf and full view. */
.st-card.is-compact, .st-card.is-list {
  display: grid; grid-template-columns: 62px minmax(0,1fr) auto;
  grid-template-rows: auto auto auto auto; gap: 2px 12px;
  align-items: center; min-width: 0; min-height: 92px;
  padding: 10px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; text-align: left;
}
.st-card.is-compact:hover, .st-card.is-list:hover { transform: none; box-shadow: none; background: transparent; }
.st-card.is-compact .st-icon-slot, .st-card.is-list .st-icon-slot { grid-column: 1; grid-row: 1 / span 4; margin: 0; }
.st-card.is-compact .st-icon-wrap, .st-card.is-list .st-icon-wrap { width: 62px; height: 62px; }
.st-card.is-compact .st-card-open, .st-card.is-list .st-card-open { grid-column: 2; grid-row: 1; align-self: end; text-align: left; font-size: 15px; line-height: 1.35; margin: 0; min-height: 0; }
.st-card.is-compact .st-card-desc, .st-card.is-list .st-card-desc { grid-column: 2; grid-row: 2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; line-height: 1.4; min-height: 0; margin: 0; color: var(--muted); text-align: left; }
.st-card-byline { grid-column: 2; grid-row: 3; color: var(--muted); font-size: 12px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-card.is-compact .st-card-state-row, .st-card.is-list .st-card-state-row { grid-column: 2; grid-row: 4; margin: 0; min-height: 0; justify-content: flex-start; }
.st-card.is-compact .st-card-status-row, .st-card.is-list .st-card-status-row { grid-column: 3; grid-row: 1 / span 4; margin: 0; align-self: center; }
.st-card.is-compact .st-card-action, .st-card.is-list .st-card-action { width: auto; min-width: 60px; min-height: 44px; height: auto; padding: 8px 13px; border: 0; border-radius: 999px; background: var(--surface); color: var(--text); font: 600 12px/1.3 var(--font); }
.st-card.is-compact .st-card-action.is-update, .st-card.is-list .st-card-action.is-update { background: var(--st-accent-fill); color: var(--accent-fg, #fff); }
.st-card.is-compact .st-card-inline-error, .st-card.is-list .st-card-inline-error { grid-column: 1 / -1; grid-row: auto; }
.st-catalog-sections.is-list .st-card + .st-card { border-top: 1px solid var(--border); }
@media (max-width: 620px) {
  .st-card.is-compact, .st-card.is-list { grid-template-columns: 52px minmax(0,1fr) auto; gap: 2px 12px; }
  .st-card.is-compact .st-icon-wrap, .st-card.is-list .st-icon-wrap { width: 52px; height: 52px; }
  .st-card.is-compact .st-card-action, .st-card.is-list .st-card-action { padding: 8px 10px; min-width: 54px; }
}

/* Library keeps maintenance controls compact, leaving room for the apps. */
.st-scroll.is-library .st-update-all-trigger { width: auto; min-height: 44px; margin-left: 0; padding: 8px 16px; }
.st-scroll.is-library .st-update-batch-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.st-scroll.is-library .st-update-batch-list .st-update-all-trigger {
  margin-left: 0; background: var(--surface); color: var(--text); border-color: var(--border);
}
@media (max-width: 520px) {
  .st-scroll.is-library .st-update-batch-list .st-update-all-trigger { width: 100%; }
}

/* Publish tab: your published apps, one app page, and the agent check. */
.st-publish-heading .st-back-btn { margin-bottom: 10px; }
.st-mine-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); overflow: hidden; margin: 0; padding: 0; list-style: none; }
/* Rows match Library's: divider inset past the icon, 76px tall, one action. */
.st-mine-list > li + li { background: linear-gradient(var(--border), var(--border)) no-repeat 78px 0 / calc(100% - 78px) 1px; }
.st-mine-row {
  display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; column-gap: 14px; align-items: center;
  width: 100%; min-height: 76px; padding: 12px 16px; border: 0;
  background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer;
}
.st-mine-row:hover { background: color-mix(in srgb, var(--text) 4%, var(--surface)); }
.st-mine-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.st-mine-row .st-publish-icon { width: 48px !important; height: 48px !important; border-radius: 12px; }
.st-mine-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.st-mine-copy strong { font-size: 15px; font-weight: 600; line-height: 1.3; }
.st-mine-facts { color: var(--muted); font-size: 14px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-mine-status { color: var(--muted); font-size: 13px; }
.st-mine-facts .st-mine-status { font-size: 14px; }
.st-mine-status.is-accent { color: var(--accent); }
.st-mine-rating { display: inline-flex; align-items: center; gap: 3px; }
.st-mine-rating svg { width: 13px; height: 13px; color: var(--st-star); }
.st-mine-status.is-warning { color: var(--orange, #e8b45a); }
.st-mine-view { display: inline-grid; place-items: center; min-width: 84px; height: 34px; padding: 0 16px; border-radius: 999px; background: var(--surface-2); color: var(--text); font: 600 13px var(--font); }
.st-mine-page { display: flex; flex-direction: column; gap: 6px; }
.st-mine-page > .st-back-btn { align-self: flex-start; }
.st-mine-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
.st-mine-title { display: flex; flex-direction: column; gap: 4px; margin-right: auto; }
.st-mine-title h2 { margin: 0; font-size: clamp(24px, 4vw, 30px); letter-spacing: -.03em; }
.st-mine-release { display: flex; flex-wrap: wrap; gap: 16px 40px; margin: 18px 0 0; padding: 16px 0; border-bottom: 1px solid var(--border); }
.st-mine-release > div { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.st-mine-release dt { color: var(--muted); font-size: 12px; }
.st-mine-release dd { margin: 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.st-mine-numbers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 22px 0 8px; }
.st-mine-numbers div { display: flex; flex-direction: column; }
.st-mine-numbers b { font-size: 28px; letter-spacing: -.03em; }
.st-mine-numbers span { color: var(--muted); font-size: 13px; }
.st-mine-section { margin: 20px 0 6px; font-size: 16px; }
.st-mine-reviews { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-mine-empty { padding: 20px 18px; color: var(--muted); font-size: 14px; }
.st-mine-review { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.st-mine-review:last-child { border-bottom: 0; }
.st-mine-review p { margin: 0; line-height: 1.5; }
.st-mine-review-top { display: flex; align-items: center; gap: 8px; }
.st-mine-stars { display: inline-flex; gap: 2px; color: #f2c14e; }
.st-mine-stars svg { width: 13px; height: 13px; }
.st-check { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--bg); }
.st-check-head { display: flex; gap: 12px; align-items: flex-start; }
.st-check-head strong { display: block; font-size: 14px; }
.st-check-head span { display: block; color: var(--muted); font-size: 12px; line-height: 1.45; margin-top: 2px; }
.st-check-mark { flex: 0 0 auto; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--border); }
.st-check.is-ready .st-check-mark { border: 0; background: color-mix(in srgb, var(--green) 18%, transparent); color: var(--green); }
.st-check.is-must_fix .st-check-mark { border: 0; background: color-mix(in srgb, var(--red, #f0776a) 18%, transparent); color: var(--red, #f0776a); }
.st-check.is-error .st-check-mark { border: 0; background: color-mix(in srgb, var(--orange, #e8b45a) 18%, transparent); color: var(--orange, #e8b45a); }
.st-check.is-running .st-check-mark { border-color: var(--accent); border-top-color: transparent; animation: st-check-spin .9s linear infinite; }
@keyframes st-check-spin { to { transform: rotate(360deg); } }
.st-check-issues { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.st-check-issues li { padding: 8px 10px; border-radius: 12px; background: var(--surface); font-size: 13px; }
.st-check-issues li.is-must { box-shadow: inset 3px 0 0 var(--red, #f0776a); }
.st-check-issues strong { display: block; }
.st-check-issues summary { cursor: pointer; font-weight: 700; list-style-position: inside; }
.st-check-issues details[open] summary { margin-bottom: 4px; }
.st-check-issues span { display: block; color: var(--muted); margin-top: 2px; }
.st-check-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.st-publish-anyway { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid color-mix(in srgb, var(--orange, #e8b45a) 45%, var(--border)); border-radius: 16px; }
.st-publish-anyway strong { font-size: 14px; }
.st-publish-anyway strong:focus { outline: none; }
.st-publish-anyway strong:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.st-publish-result .st-publish-result-warning { color: var(--orange, #e8b45a); }
.st-publish-anyway > span { color: var(--muted); font-size: 13px; line-height: 1.45; }
@media (max-width: 640px) {
  .st-mine-view { min-width: 64px; padding: 0 13px; }
  .st-mine-head .st-btn { width: 100%; }
}
.st-card.is-list .st-card-status-row { flex-direction: row; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
@media (max-width: 640px) { .st-card.is-list .st-card-status-row { justify-content: flex-start; } }
.st-agent-choice { box-sizing: border-box; width: min(440px, calc(100% - 24px)); max-height: 85dvh; margin: auto; padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); box-shadow: 0 16px 48px rgb(0 0 0 / .3); }
.st-agent-choice::backdrop { background: rgb(0 0 0 / .55); }
.st-agent-choice-inner { display: grid; gap: 10px; padding: 24px; }
.st-agent-choice h2 { margin: 0; font-size: 19px; }
.st-agent-choice p { margin: 0 0 4px; color: var(--muted); font-size: 13px; line-height: 1.5; }
.st-agent-choice label { margin-top: 5px; font-size: 13px; font-weight: 650; }
.st-agent-choice-current { display: flex; width: 100%; text-align: left; font: inherit; background: var(--surface-2); color: var(--text); align-items: center; gap: 12px; min-height: 54px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; }
.st-agent-choice-current > span:first-child { display: grid; gap: 3px; min-width: 0; flex: 1; }
.st-agent-choice-current strong { font-size: 14px; overflow-wrap: anywhere; }
.st-agent-choice-caption, .st-agent-choice-provider { color: var(--muted); font-size: 12px; }
.st-agent-choice-current > svg { flex-shrink: 0; }
.st-agent-choice-badge { border-radius: 999px; padding: 3px 7px; font-size: 12px; color: var(--muted); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.st-agent-choice-list { display: grid; max-height: min(270px, 40dvh); overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; overscroll-behavior: contain; }
.st-agent-choice-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 48px; width: 100%; padding: 8px 12px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.st-agent-choice-row:last-child { border-bottom: 0; }
.st-agent-choice-row.is-selected { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.st-agent-choice-row > span:first-child { display: grid; gap: 2px; }
.st-agent-choice-model { font-size: 14px; font-weight: 650; }
.st-agent-choice-check { color: var(--accent-text); font-weight: 700; }
.st-agent-choice-effort { display: grid; gap: 8px; }
.st-agent-choice-effort label { display: flex; justify-content: space-between; }
.st-agent-choice-effort input { width: 100%; min-height: 44px; accent-color: var(--accent); }
.st-agent-choice-effort-scale { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; text-transform: capitalize; }
.st-agent-choice button:focus-visible, .st-agent-choice input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-agent-choice .st-agent-choice-error { color: var(--danger-text); }
.st-agent-choice-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

@media (min-width: 720px) {
  .st-scroll.is-apps > *, .st-scroll.is-games > * { max-width: var(--st-rail); }
}

/* Categories, Google Play style: a colored glyph on a soft tint of its own
   hue. The tint mixes into the theme surface, so it reads in light and dark. */
.st-cat-icon {
  display: inline-grid; place-items: center; flex: 0 0 auto; width: 44px; height: 44px; border-radius: 50%;
  color: var(--cat, var(--accent)); background: color-mix(in srgb, var(--cat, var(--accent)) 20%, transparent);
  font-size: 22px;
}
.st-cat-icon.is-lg { width: 56px; height: 56px; font-size: 28px; }
.st-cat-icon.is-sm { width: 20px; height: 20px; font-size: 12px; background: transparent; }

.st-cat-chips { display: flex; gap: 8px; margin: 0 0 20px; padding: 4px 3px; overflow-x: auto; scrollbar-width: none; }
.st-cat-chips::-webkit-scrollbar { display: none; }
.st-cat-chip {
  display: inline-flex; flex: 0 0 auto; align-items: center; gap: 8px; min-height: 36px; padding: 0 14px;
  border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text);
  font: 600 14px/1 var(--font); white-space: nowrap; cursor: pointer;
}
.st-cat-chip.is-active {
  border-color: color-mix(in srgb, var(--cat, var(--text)) 55%, var(--border));
  background: color-mix(in srgb, var(--cat, var(--text)) 16%, var(--surface));
}
@media (hover: hover) { .st-cat-chip:not(.is-active):hover { background: var(--surface-2, var(--surface)); } }
.st-cat-sort { display: inline-flex; align-self: flex-start; gap: 2px; margin: 12px 0 2px; padding: 3px; border-radius: 12px; background: var(--surface-2, var(--surface)); }
.st-cat-sort button { min-height: 32px; padding: 0 14px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font: 600 13px/1 var(--font); cursor: pointer; }
.st-cat-sort button.is-active { color: var(--text); background: var(--surface); }

/* Ranked rows (Top rated, Trending, a category's Top order). */
.st-ranked { display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: center; gap: 4px; min-width: 0; scroll-snap-align: start; }
.st-rank { color: var(--muted); font: 700 18px/1 var(--font); text-align: center; font-variant-numeric: tabular-nums; }

/* The row's quiet detail line: category, rating, publisher. */
.st-card-byline { display: flex; align-items: center; gap: 6px; min-width: 0; }
.st-card-byline > span { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.st-card-byline > span + span::before { content: "·"; margin-right: 6px; color: var(--muted); opacity: .7; }
.st-card-byline .st-card-publisher { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.st-card-rating { color: var(--text); font-weight: 600; }
.st-card-rating svg { color: #e8a317; }

/* Library's way into publishing, and the way back. */

/* Focus rings stay inside the scrolling tab and chip rows instead of clipping. */
.st-cat-chips { padding: 4px 3px; }
/* Library rows are about your own apps; their category would only crowd them. */
.st-card.is-list .st-card-cat { display: none; }
.st-card.is-list .st-card-cat + span::before { content: none; }

/* Publish: the listing's category picker. */
.st-edit-category .st-cat-chips.is-wrap { flex-wrap: wrap; overflow: visible; margin: 8px 0 0; }
.st-edit-kind { display: inline-flex; gap: 4px; padding: 3px; margin-top: 8px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.st-edit-kind button { min-height: 38px; padding: 0 18px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font: 600 14px/1 var(--font); cursor: pointer; }
.st-edit-kind button.is-active { background: var(--surface-2, var(--bg)); color: var(--text); }

/* Publish: the listing's license choice. Whole-card radios, so each is an
   easy target and its one-line meaning reads with the name. */
.st-license-options { display: grid; gap: 8px; margin-top: 8px; }
.st-license-option {
  position: relative; display: flex; align-items: flex-start; gap: 12px; min-height: 44px; padding: 12px 14px;
  border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease;
}
.st-license-option input { flex: 0 0 auto; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--accent); cursor: pointer; }
.st-license-option:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-license-option.is-active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
@media (hover: hover) { .st-license-option:not(.is-active):hover { background: var(--surface-2, var(--surface)); } }
.st-license-copy { display: grid; gap: 3px; min-width: 0; }
.st-license-title { display: flex; align-items: center; gap: 8px; font: 650 15px/1.3 var(--font); }
.st-license-badge { padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--st-accent-text, var(--accent)); font: 650 11px/1.5 var(--font); }
.st-license-summary { color: var(--muted); font: 400 13px/1.45 var(--font); }
.st-edit-hint.is-needed { color: var(--text); font-weight: 600; }
.st-publish-license { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
.st-publish-license > span { color: var(--muted); font-size: 12px; font-weight: 700; }
.st-publish-license > strong { flex: 1 1 auto; color: var(--text); font-weight: 650; }
@media (prefers-reduced-motion: reduce) { .st-license-option { transition: none; } }


/* Row actions: Get is purple text on the neutral pill, Open is plain text on
   the same pill, Update stays solid. The word and the tint tell them apart
   without filling every row with purple. */
.st-card.is-compact .st-card-action:not([class*=" is-"]), .st-card.is-list .st-card-action:not([class*=" is-"]) {
  color: var(--st-accent-text); background: var(--surface-2, var(--surface));
}
@media (hover: hover) {
  .st-card.is-compact .st-card-action:not([class*=" is-"]):not(:disabled):hover,
  .st-card.is-list .st-card-action:not([class*=" is-"]):not(:disabled):hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface-2, var(--surface))); }
}
.st-card.is-compact .st-card-action.is-installed, .st-card.is-list .st-card-action.is-installed { color: var(--text); background: var(--surface-2, var(--surface)); }

/* Phone Library rows: the actions sit under the text, so names, descriptions
   and status are never cut short by two buttons. */
@media (max-width: 620px) {
  .st-card.is-list { grid-template-rows: none; grid-auto-rows: auto; align-content: start; min-height: 0; }
  .st-card.is-list .st-card-status-row { grid-column: 2 / -1; grid-row: auto; justify-content: flex-start; gap: 8px; margin-top: 6px; }
  .st-card.is-list .st-card-status-row > button { min-height: 38px; }
}

/* Loading placeholder shaped like the page that is coming. */
.st-skeleton-page { display: flex; flex-direction: column; gap: 16px; }
.st-skeleton-title { width: 160px; height: 18px; margin-top: 8px; }
.st-skeleton-spotlight { width: 100%; height: clamp(300px, 30vw, 400px); border-radius: 20px; }
.st-skeleton-shelf { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 24px; }
.st-skeleton-list { display: grid; grid-template-columns: 1fr; gap: 4px 32px; }
.st-skeleton-row { display: grid; grid-template-columns: 56px minmax(0, 1fr) 64px; align-items: center; gap: 12px; padding: 12px 0; }
.st-skeleton-icon { width: 56px; height: 56px; border-radius: 16px; }
.st-skeleton-lines { display: grid; gap: 8px; }
.st-skeleton-pill { width: 64px; height: 34px; border-radius: 999px; }
@media (max-width: 1100px) { .st-skeleton-shelf { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .st-skeleton-shelf { grid-template-columns: 1fr; } .st-skeleton-spotlight { height: 320px; } }

/* Wide Library: two columns of rows instead of one stretched list. */
@media (min-width: 1100px) {
  .st-catalog-sections.is-list .st-card + .st-card { border-top: 0; }
  .st-catalog-sections.is-list .st-card { border-bottom: 1px solid var(--border); }
  .st-skeleton-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* App page: one quiet line of facts under the name. */
.st-card-installed { color: var(--muted); }
.st-card-installed.is-update { color: var(--accent); font-weight: 600; }

/* Every app icon reads as an app icon: cut-out illustrations sit on the same
   rounded-square tile that full-bleed icons already are. */
.st-icon-wrap.is-cutout, .st-hero-icon.is-cutout { background: var(--surface-2, var(--surface)); }
/* In shelves the tile takes a soft wash of the app's category color, so a row
   of icons is not a row of grey boxes on black. */
.st-icon-wrap.is-cutout .st-icon-img, .st-hero-icon.is-cutout .st-icon-img {
  width: 80%; height: 80%; object-fit: contain;
}
.st-icon-wrap:not(.is-cutout) .st-icon-img { border-radius: inherit; }

/* ===== Store layout =======================================================
   Möbius shell look: shell colours, Inter, bordered panels, one violet
   accent for actions. Later sections override the older rules above. */

/* Header: brand · tabs · search + Publish. Phones move tabs to a bottom bar. */
.st-title-row { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "brand tools" "tabs tabs"; }
.st-header-tools { grid-area: tools; display: flex; align-items: center; gap: 12px; justify-content: flex-end; min-width: 0; }
.st-searchbox {
  display: flex; align-items: center; gap: 8px; flex: 0 1 300px; min-width: 0; height: 38px;
  padding: 0 8px 0 12px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); color: var(--muted); cursor: text;
  transition: border-color .15s, box-shadow .15s;
}
.st-searchbox > svg { width: 16px; height: 16px; flex: none; }
.st-searchbox:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); }
.st-searchbox:focus-within > svg { color: var(--accent); }
.st-searchbox .st-search-input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; padding: 0; background: none; color: var(--text); font: 15px var(--font); }
.st-searchbox .st-search-input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.st-search-clear { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--muted); cursor: pointer; }
.st-search-clear svg { width: 13px; height: 13px; }
.st-tab.is-active::after { background: var(--accent); }
@media (min-width: 900px) {
  .st-title-row { grid-template-columns: auto 1fr auto; grid-template-areas: "brand tabs tools"; }
  .st-tabs { justify-self: center; }
}
@media (max-width: 1060px) and (min-width: 900px) { .st-searchbox { flex-basis: 220px; } .st-tab { padding: 0 10px; } }

/* Big page titles inside the scroll area. */
.st-pagehead { padding: 18px 0 4px; }
.st-pagehead-eyebrow { display: block; color: var(--accent); font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.st-pagehead-title { margin: 4px 0 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -.03em; }

/* Phone bottom tab bar. */
.st-bottombar { display: none; }
@media (max-width: 680px) {
  .st-tabs { display: none; }
  .st-title-row { grid-template-areas: "brand tools"; }
  .st-brand-name { display: none; }
  .st-header-tools { gap: 8px; }
  .st-searchbox { flex: 1 1 auto; height: 40px; }
  .st-searchbox .st-search-input { font-size: 16px; }
  .st-header { padding-bottom: 10px; }
  .st-pagehead-title { font-size: 30px; }
  .st-bottombar {
    display: flex; flex-shrink: 0; border-top: 1px solid var(--border); background: var(--bg);
    padding: 6px 4px max(10px, env(safe-area-inset-bottom));
  }
  .st-bottombar-tab {
    position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
    min-height: 48px; padding: 4px 0 0; border: 0; background: none; color: var(--muted);
    font: 500 11px var(--font); cursor: pointer;
  }
  .st-bottombar-tab svg { width: 24px; height: 24px; transition: transform .12s; }
  .st-bottombar-tab:active svg { transform: scale(.85); }
  .st-bottombar-tab.is-active { color: var(--accent); }
  .st-bottombar-count {
    position: absolute; top: 0; left: calc(50% + 8px); min-width: 18px; height: 18px; padding: 0 5px;
    display: grid; place-items: center; border-radius: 999px; background: var(--st-accent-fill); color: var(--accent-fg, #fff);
    font-size: 12px; font-weight: 700;
  }
}

/* Rows, panels, featured cards, shelves, categories. */
.st-catalog-sections.is-v2 { display: block; }
.st-sec { margin-top: 40px; }
.st-sh { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.st-sh-title { margin: 0; font-size: 22px; line-height: 1.2; font-weight: 700; letter-spacing: -.02em; }
.st-sh-sub { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
.st-sh-tools { display: flex; align-items: center; gap: 8px; flex: none; }
.st-see { min-height: 36px; padding: 0 2px; border: 0; background: none; color: var(--accent); font: 500 15px var(--font); cursor: pointer; }
.st-see:hover { text-decoration: underline; }
.st-arrow { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 50%; background: none; color: var(--text); cursor: pointer; }
.st-arrow:disabled { opacity: .35; cursor: default; }
.st-arrow:hover:not(:disabled) { background: var(--surface-2); }
.st-backlink { display: inline-flex; align-items: center; gap: 2px; min-height: 40px; margin-top: 10px; padding: 0; border: 0; background: none; color: var(--accent); font: 500 16px var(--font); cursor: pointer; }
.st-pagehead-sub { margin: 6px 0 0; color: var(--muted); }

/* One app row: icon, name, one line, and its action. */
.st-card.is-row { grid-template-columns: 60px minmax(0, 1fr) auto; grid-template-rows: auto auto; min-height: 84px; padding: 12px 0; gap: 2px 16px; }
.st-card.is-row .st-icon-slot { grid-row: 1 / span 2; }
.st-card.is-row .st-icon-wrap { width: 60px; height: 60px; border-radius: 16px; }
.st-card.is-row .st-installed-dot { display: none; }
.st-card.is-row .st-card-byline { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* An app's name is never cut short: a long one wraps onto a second line. */
.st-card.is-row .st-card-open { align-self: end; font-size: 15px; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.st-card.is-row .st-card-desc { grid-row: 2; align-self: start; -webkit-line-clamp: 1; font-size: 13px; }
.st-card.is-row .st-card-byline { display: none; }
.st-ranked .st-card.is-row .st-card-desc { display: none; }
.st-ranked .st-card.is-row .st-card-byline { display: flex; flex-wrap: nowrap; overflow: hidden; grid-row: 2; align-self: start; font-size: 13px; }
/* The category gives way first, so the rating stays readable. */
.st-ranked .st-card.is-row .st-card-byline .st-card-publisher { flex: 0 20 auto; }
.st-ranked .st-card.is-row .st-card-byline .st-card-cat { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
/* In a row the Open button already says the app is installed. */
.st-card.is-row .st-card-installed:not(.is-update) { display: none; }
.st-card.is-row .st-card-status-row { grid-row: 1 / span 2; }
.st-card.is-row .st-card-state-row { grid-column: 2; grid-row: 3; }
.st-card.is-row .st-card-action {
  min-width: 80px; min-height: 32px; height: 32px; padding: 0 14px; border-radius: 12px;
  background: var(--surface-2); color: var(--st-accent-text); font: 700 14px var(--font);
  transition: transform .12s, filter .15s;
}
.st-card.is-row .st-card-action.is-installed { background: var(--surface-2); color: var(--text); }
.st-card.is-row .st-card-action.is-update { background: var(--st-accent-fill); color: var(--accent-fg, #fff); }
.st-card.is-row .st-card-action:active:not(:disabled) { transform: scale(.94); }
.st-card.is-row:has(.st-card-open:hover) .st-card-open { color: var(--accent); }

.st-ranked { grid-template-columns: 20px minmax(0, 1fr); gap: 12px; }
.st-rank { font: 600 16px/1 var(--font); }

/* Rows in a three-column grid; dividers only between rows. */
.st-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 32px; }
.st-grid3 > :nth-child(n+4) { border-top: 1px solid var(--border); }
/* Medium widths (split panes, small windows): two columns, like the shelves,
   so app names keep room instead of collapsing to a few letters. */
@media (max-width: 1100px) {
  .st-grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .st-grid3 > :nth-child(n+3) { border-top: 1px solid var(--border); }
}
/* Sideways shelf, three rows deep. Columns never shrink below the room a
   row needs for its name (icon + name + button); a narrower pane shows two
   columns with the next one peeking in instead of cutting names short. */
.st-rowshelf {
  display: grid; grid-auto-flow: column; grid-template-rows: repeat(3, auto);
  grid-auto-columns: max(320px, calc((100% - 56px) / 3)); gap: 0 32px;
  overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
}
.st-rowshelf::-webkit-scrollbar { display: none; }
.st-rowshelf > * { scroll-snap-align: start; }
.st-rowshelf > :not(:nth-child(3n+1)) { border-top: 1px solid var(--border); }
/* A short shelf (six apps or fewer) would fill only one or two of its three
   columns, leaving the rest of the width empty. Lay it out left to right
   across the full width instead; phones keep the swipeable shelf. */
@media (min-width: 681px) {
  .st-rowshelf.is-fit {
    grid-auto-flow: row; grid-template-rows: none; grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow-x: visible; scroll-snap-type: none;
  }
  .st-rowshelf.is-fit > * { border-top: 0; }
  .st-rowshelf.is-fit > :nth-child(n+4) { border-top: 1px solid var(--border); }
}
@media (min-width: 681px) and (max-width: 1100px) {
  .st-rowshelf.is-fit { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .st-rowshelf.is-fit > :nth-child(3) { border-top: 1px solid var(--border); }
}

/* Panels: Highest rated, Our picks. */
.st-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr)); gap: 20px; margin-top: 40px; }
.st-panel { padding: 20px 20px 6px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-panel-title { margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
.st-panel-rows > * + * { border-top: 1px solid var(--border); }

/* Featured cards on real listing art. */
.st-today { display: grid; grid-template-columns: 1.7fr 1fr; gap: 20px; margin-top: 20px; }
.st-fcard { position: relative; min-height: 400px; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; color: #fff; background: #111; isolation: isolate; }
.st-fcard-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: right center; z-index: -2; transition: transform 1.2s cubic-bezier(.2,.7,.2,1); }
.st-fcard::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: linear-gradient(180deg, rgba(13,13,13,0) 38%, rgba(13,13,13,.45) 58%, rgba(13,13,13,.86) 76%, rgba(13,13,13,.96) 100%); }
@media (hover: hover) { .st-fcard:hover .st-fcard-art { transform: scale(1.04); } }
.st-fcard-open { position: absolute; inset: 0; z-index: 0; border: 0; background: none; cursor: pointer; }
.st-fcard-copy { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 22px 22px; z-index: 1; pointer-events: none; }
.st-fcard-copy .st-pill { pointer-events: auto; }
.st-fcard-who { display: flex; align-items: flex-end; gap: 16px; }
.st-fcard-tile { width: 56px; height: 56px; flex: none; display: grid; place-items: center; overflow: hidden; border-radius: 16px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.16); }
.st-fcard-tile .st-icon-wrap { width: 100%; height: 100%; border-radius: 0; }
.st-fcard-kicker { color: #c4b5fd; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.st-fcard-name { margin: 3px 0 0; font-size: 28px; line-height: 1.1; font-weight: 700; letter-spacing: -.025em; }
.st-fcard-row { display: flex; align-items: center; gap: 16px; margin-top: 12px; }
.st-fcard-tag { flex: 1; min-width: 0; margin: 0; font-size: 15px; opacity: .88; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-pill { min-width: 80px; height: 32px; padding: 0 14px; border: 0; border-radius: 12px; font: 700 14px var(--font); cursor: pointer; display: inline-grid; place-items: center; transition: transform .12s; }
.st-pill.is-light { background: #fff; color: #0d0d0d; }
.st-pill:active:not(:disabled) { transform: scale(.94); }
.st-pill:disabled { opacity: .6; cursor: default; }

/* Categories as a tidy three-column list. */
.st-catlist { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 24px; }
.st-catlist > :nth-child(n+4) { border-top: 1px solid var(--border); }
.st-catrow { display: flex; align-items: center; gap: 16px; min-height: 52px; padding: 0; border: 0; background: none; color: var(--text); font: 400 16px var(--font); text-align: left; cursor: pointer; }
.st-catrow .st-cat-icon.is-sm { width: 32px; height: 32px; font-size: 18px; border-radius: 8px; background: var(--surface-2); }
.st-catrow-name { flex: 1; min-width: 0; }
.st-catrow:hover .st-catrow-name { color: var(--accent); }
.st-catrow-count { color: var(--muted); font-size: 14px; }
.st-catrow-chev { color: var(--muted); }
.st-catlist-more { margin-top: 8px; }

@media (max-width: 1060px) {
  .st-today { grid-template-columns: 1fr 1fr; }
  .st-fcard-name { font-size: 24px; }
}
@media (max-width: 680px) {
  .st-sec { margin-top: 30px; }
  .st-sh-title { font-size: 20px; }
  .st-panels { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  /* Phones: featured cards form one short swipeable row (the next card peeks
     in), so the app lists start on the first screen instead of two
     screen-tall pictures. */
  .st-today {
    display: flex; gap: 12px; margin-inline: -16px; padding: 0 16px 4px;
    overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; scrollbar-width: none;
  }
  .st-today::-webkit-scrollbar { display: none; }
  .st-fcard { flex: 0 0 86%; min-height: 0; height: 260px; scroll-snap-align: start; }
  .st-fcard:only-child { flex-basis: 100%; }
  .st-fcard-copy { padding: 0 16px 16px; }
  .st-fcard-name { font-size: 22px; }
  .st-fcard-tile { width: 48px; height: 48px; border-radius: 12px; }
  .st-grid3, .st-catlist { grid-template-columns: minmax(0, 1fr); }
  .st-grid3 > :nth-child(n+2), .st-catlist > :nth-child(n+2) { border-top: 1px solid var(--border); }
  .st-rowshelf { grid-auto-columns: 88%; gap: 0 16px; }
}

/* The app page. */
.st-detail-v2 { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; animation: st-push .36s cubic-bezier(.2,.85,.2,1); }
@keyframes st-push { from { transform: translateX(48px); opacity: 0; } to { transform: none; opacity: 1; } }
.st-scroll.is-returning { animation: st-pop .32s cubic-bezier(.2,.85,.2,1); }
@keyframes st-pop { from { transform: translateX(-28px); opacity: .55; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .st-detail-v2, .st-scroll.is-returning { animation: st-fade .2s ease; } }
@keyframes st-fade { from { opacity: 0; } to { opacity: 1; } }
.st-lnav { flex-shrink: 0; display: flex; align-items: center; min-height: 52px; padding: 0 max(16px, env(safe-area-inset-left)); border-bottom: 1px solid var(--border); background: var(--bg); }
.st-lnav .st-backlink { margin: 0; }
@media (min-width: 720px) { .st-lnav { padding-inline: max(16px, calc((100% - var(--st-rail)) / 2 + 16px)); } }

.st-dh { display: flex; gap: 22px; align-items: center; margin-top: 12px; }
.st-dh .st-hero-icon { width: 104px; height: 104px; border-radius: 24px; flex: none; box-shadow: 0 0 0 1px var(--border); }
.st-dh-text { min-width: 0; flex: 1; }
.st-dh .st-detail-note { margin-top: 12px; grid-column: 1 / -1; }
.st-dh-name { margin: 0; font-size: 30px; line-height: 1.1; font-weight: 700; letter-spacing: -.035em; }
.st-dh-meta { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin: 4px 0 2px; min-height: 30px; grid-column: 2; }
.st-dh-meta .st-dh-dev { display: inline-flex; align-items: center; min-height: 30px; margin: 0; font-size: 13px; }
.st-dh-separator { color: var(--muted); font-size: 12px; }
.st-dh-category { display: inline-flex; align-items: center; gap: 6px; padding: 0; min-height: 30px; border: 0; background: none; color: var(--muted); font: 400 13px var(--font); cursor: pointer; }
.st-dh-category .st-cat-icon { width: 17px; height: 17px; font-size: 17px; background: none; border-radius: 0; }
.st-dh-category:hover { color: var(--accent); }
.st-detail-v2 .st-dh + .st-sec { margin-top: 24px; }
.st-dh-dev { display: block; margin-top: 4px; padding: 0; min-height: 30px; border: 0; background: none; color: var(--accent); font: 500 15px var(--font); text-align: left; cursor: pointer; }
button.st-dh-dev:hover { text-decoration: underline; }
.st-dh-sub { margin: 2px 0 0; color: var(--muted); font-size: 15px; line-height: 1.5; }
.st-dh-acts { display: flex; align-items: center; gap: 10px; margin-top: 13px; }
.st-dbtn { min-width: 120px; height: 40px; padding: 0 18px; border: 0; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--font); cursor: pointer; transition: transform .12s, filter .15s; }
.st-dbtn.is-primary { background: var(--st-accent-fill); color: var(--accent-fg, #fff); border-radius: 10px; }
.st-dbtn.is-neutral { background: var(--surface-2); color: var(--text); }
.st-dbtn.is-quiet { background: none; color: var(--muted); border: 1px solid var(--border); }
.st-dbtn.is-link { min-width: 0; padding: 0 10px; background: none; color: var(--muted); }
@media (hover: hover) { .st-dbtn.is-link:not(:disabled):hover { color: var(--text); } }
.st-dbtn:active:not(:disabled) { transform: scale(.95); }
.st-dbtn:disabled { opacity: .55; cursor: default; }
.st-icon-btn { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: var(--accent); cursor: pointer; }
.st-icon-btn:hover { background: var(--surface-2); }
.st-icon-btn[aria-pressed="true"] { color: var(--accent); }

.st-strip { display: flex; justify-content: flex-start; margin-top: 24px; padding: 14px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.st-strip > div, .st-strip-cell { flex: 0 1 200px; min-width: 0; padding: 0 10px; border: 0; border-left: 1px solid var(--border); background: none; color: inherit; font: inherit; text-align: center; }
.st-strip > :first-child { border-left: 0; }
.st-strip-cell { cursor: pointer; }
.st-strip-cell:hover span { color: var(--accent); }
.st-strip small { display: block; color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
.st-strip b { display: flex; align-items: center; justify-content: center; min-height: 30px; margin: 4px 0 2px; color: var(--muted); font-size: 20px; font-weight: 700; }
.st-strip b .st-cat-icon.is-sm { width: 26px; height: 26px; font-size: 20px; background: none; }
.st-strip span { display: block; color: var(--muted); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.st-detail-gallery { display: flex; align-items: start; gap: 16px; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x mandatory; }
.st-detail-gallery::-webkit-scrollbar { display: none; }
.st-shot { flex: none; padding: 0; border: 0; border-radius: 12px; background: none; cursor: zoom-in; scroll-snap-align: start; }
.st-shot .st-detail-gallery-image { display: block; height: clamp(320px, 32vw, 440px); width: auto; max-width: 100%; object-fit: contain; object-position: left center; border-radius: 12px; border: 1px solid var(--border); }
.st-shot:not([data-state="ready"]) {
  position: relative; display: grid; place-items: center; width: min(100%, 520px); aspect-ratio: 5 / 3;
  border: 1px solid var(--border); background: var(--surface); cursor: default;
}
.st-shot[data-state="failed"] { cursor: pointer; }
.st-shot:not([data-state="ready"]) > .st-detail-gallery-image,
.st-viewer-stage:not([data-state="ready"]) > .st-viewer-image {
  position: absolute; inset: 0; width: 100%; height: 100%; visibility: hidden;
}
.st-shot-status { display: grid; gap: 8px; padding: 16px; color: var(--muted); font: 500 14px var(--font); text-align: center; }
.st-shot-status > span { color: var(--accent-text, var(--accent)); font-weight: 650; }
.st-shot:focus-visible { outline-offset: -3px; }
/* Native release-notes disclosure shares the access summary's appearance. */
.st-whats-new > summary { list-style: none; }
.st-whats-new > summary::-webkit-details-marker { display: none; }
.st-whats-new[open] > summary { border-bottom-color: transparent; }
.st-whats-new[open] .st-access-chev { transform: rotate(180deg); }
.st-whats-new > .st-wn { padding: 4px 0 8px; }
.st-wn-top { display: flex; align-items: baseline; gap: 8px; }
.st-wn-top b { font-size: 15px; font-weight: 600; }
.st-wn-top span { color: var(--muted); font-size: 14px; }
.st-wn p { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
.st-wn .st-wn-lead { margin-top: 10px; color: var(--text); font-weight: 600; }
.st-wn-list { display: grid; gap: 6px; margin: 8px 0 0; padding: 0 0 0 18px; color: var(--muted); font-size: 14px; line-height: 1.45; }
.st-wn-list li { padding-left: 2px; }
.st-wn-list li::marker { color: var(--border); }
.st-wn-list time { margin-left: 8px; color: var(--muted); font-size: 12px; opacity: .8; white-space: nowrap; }
.st-wn-all { margin-top: 10px; font-size: 14px; }
.st-detail-v2 .st-detail-desc { font-size: 15px; color: var(--muted); margin: 0; }
/* What it can access: one divided list, not cards inside a box. A change
   to an app's access keeps a highlighted outline so it is not missed. */
.st-access { padding: 0; }
.st-access .st-capability-list { gap: 0; }
.st-access .st-permission-row { margin: 0; padding: 12px 0; border: 0; border-top: 1px solid var(--border); border-radius: 0; background: none; }
.st-access .st-capability-list > .st-permission-row:first-child { border-top: 0; }
.st-sec.is-attention .st-access { padding: 6px 20px 14px; border: 1px solid #d97706; border-radius: 16px; }
.st-access-note { margin: 10px 0 0; color: var(--muted); font-size: 14px; }
.st-access-note.is-lead { margin: 0 0 4px; }
/* Permissions fold at the end of the app page; the button is the section head. */
.st-access-head { margin: 0; font: inherit; }
.st-access-summary {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 44px; padding: 14px 0; border: 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer;
}
.st-access-summary-text { display: grid; gap: 2px; min-width: 0; }
.st-access-summary .st-sh-title { display: block; font-size: 18px; }
.st-access-chev { flex: none; color: var(--muted); transition: transform .2s ease; }
.st-access-sec.is-open .st-access-summary { border-bottom-color: transparent; }
.st-access-sec.is-open .st-access-chev { transform: rotate(180deg); }
.st-access-sec.is-open > .st-access { padding-top: 4px; padding-bottom: 8px; }
.st-access[hidden] { display: none; }
@media (hover: hover) { .st-access-summary:hover .st-sh-title { color: var(--accent); } }
.st-access-summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.st-access-sec.is-attention .st-access-summary .st-sh-sub { color: #d97706; }
@media (prefers-reduced-motion: reduce) { .st-access-chev { transition: none; } }
.st-detail-v2 .st-community-feedback { margin-top: 40px; padding-top: 0; border-top: 0; }
.st-detail-v2 .st-community-feedback h3 { font-size: 22px; }
.st-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 32px; margin: 0; padding: 4px 20px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-info-row { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; font-size: 15px; }
.st-info > :nth-child(n+3) { border-top: 1px solid var(--border); }
.st-info dt { color: var(--muted); }
.st-info dd { margin: 0; text-align: right; font-weight: 500; }
.st-lnk { display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; color: var(--accent); font: 500 15px var(--font); text-decoration: none; cursor: pointer; }
.st-lnk:hover { text-decoration: underline; }
.st-info-links { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 14px; }
.st-detail-v2 .st-technical-details { margin-top: 14px; }
.st-detail-foot { margin-top: 20px; }
.st-detail-foot > .st-info-links:first-child { margin-top: 0; }

.st-viewer {
  position: fixed; inset: 0; z-index: 100; display: grid; grid-template-rows: auto minmax(0, 1fr) auto;
  gap: clamp(8px, 2vh, 16px); padding: clamp(12px, 2vh, 24px) 16px; background: rgba(8,8,8,.92);
}
.st-viewer-stage { position: relative; display: grid; place-items: center; min-width: 0; min-height: 0; }
.st-viewer-image {
  position: absolute; inset: 0; margin: auto; display: block;
  width: auto; height: auto; max-width: min(1100px, 100%); max-height: 100%;
  object-fit: contain; border-radius: 16px; border: 1px solid rgba(255,255,255,.1);
}
.st-viewer-close { justify-self: end; }
.st-viewer-close, .st-viewer-bar button {
  width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 50%;
  background: rgba(255,255,255,.12); color: #fff; cursor: pointer;
}
.st-viewer-bar { justify-self: center; display: flex; align-items: center; gap: 16px; color: #ccc; font-size: 14px; }
.st-viewer-bar > span { min-width: 8ch; text-align: center; font-variant-numeric: tabular-nums; }
.st-viewer-status { max-height: 100%; overflow: auto; padding: 8px 12px; color: #fff; text-align: center; font-size: 15px; }
.st-viewer-status p { margin: 0; }
.st-viewer-retry {
  min-height: 44px; margin-top: 12px; padding: 0 16px; border: 0; border-radius: 999px;
  background: rgba(255,255,255,.16); color: #fff; font: 650 14px var(--font); cursor: pointer;
}

@media (max-width: 680px) {
  .st-dh { display: grid; grid-template-columns: 88px minmax(0, 1fr); grid-template-rows: min-content min-content 1fr; column-gap: 16px; row-gap: 6px; align-items: start; }
  .st-dh .st-hero-icon { grid-row: 1 / 4; width: 88px; height: 88px; border-radius: 20px; }
  .st-dh-text { display: contents; }
  .st-dh-name, .st-dh-meta, .st-dh-sub { grid-column: 2; }
  .st-dh-meta { gap: 7px; margin: 0; align-self: start; }
  .st-dh-meta .st-dh-dev, .st-dh-category { font-size: 12px; min-height: 44px; }
  .st-dh-name { font-size: 28px; }
  .st-dh-sub { font-size: 14px; margin-top: 0; }
  .st-dh-acts { grid-column: 1 / -1; margin-top: 10px; }
  .st-dbtn.is-primary { min-height: 44px; }
  .st-detail-v2 .st-dh + .st-sec { margin-top: 20px; }
  .st-dh-acts .st-dbtn { flex: 1; min-width: 0; }
  .st-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 14px; }
  .st-strip > *:nth-child(3n+1) { border-left: 0; }
  .st-shot .st-detail-gallery-image { height: auto; max-height: 380px; max-width: calc(100vw - 32px); width: auto; }
  .st-info { grid-template-columns: minmax(0, 1fr); }
  .st-info > :nth-child(n+2) { border-top: 1px solid var(--border); }
}

/* Library. */
.st-lib-panel { padding: 0 16px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-lib-panel > * + * { border-top: 1px solid var(--border); }
.st-catalog-sections.is-list .st-lib-panel .st-card + .st-card { border-top: 1px solid var(--border); }
.st-lib-panel .st-card.is-list { min-height: 84px; padding: 12px 0; }
.st-lib-panel .st-card.is-list .st-icon-wrap { width: 52px; height: 52px; border-radius: 12px; }
.st-lib-panel .st-card.is-list { grid-template-columns: 52px minmax(0, 1fr) auto; }
.st-lib-panel .st-card.is-list .st-card-desc { -webkit-line-clamp: 1; }
.st-lib-panel .st-installed-dot { display: none; }
.st-lib-panel .st-card-action { min-height: 32px; height: 32px; padding: 0 12px; border-radius: 12px; font: 600 13px var(--font); }
.st-lib-panel .st-card-action.is-installed { background: var(--surface-2); color: var(--text); }
.st-lib-panel .st-card-action.is-update { background: var(--st-accent-fill); color: var(--accent-fg, #fff); }


/* Search. */
.st-qhead { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; padding-top: 18px; }
.st-qhead span { color: var(--muted); }
.st-qhead .st-pagehead-title { font-size: 30px; }
.st-chips2 { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.st-chips2 button { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font: 500 14px var(--font); cursor: pointer; }
.st-chips2 button:hover { border-color: var(--accent); }
.st-chips2 .st-cat-icon.is-sm { width: 18px; height: 18px; font-size: 16px; background: none; }
.st-qempty { margin-top: 28px; padding: 32px; text-align: center; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-qempty b { display: block; font-size: 18px; }
.st-qempty p { margin: 6px 0 0; color: var(--muted); }
.st-qempty .st-chips2 { justify-content: center; margin-top: 18px; }
@media (max-width: 680px) { .st-qhead .st-pagehead-title { font-size: 24px; } }

.st-header-tools { position: relative; }
.st-qdrop { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 30; min-width: 280px; max-height: 70vh; overflow: auto; padding: 6px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: 0 16px 40px rgba(0,0,0,.28); }
.st-qdrop-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 8px 4px; color: var(--muted); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
.st-qdrop-head b { font-weight: 600; }
.st-qdrop-head button { border: 0; background: none; color: var(--accent); font: 500 13px var(--font); text-transform: none; letter-spacing: 0; cursor: pointer; }
.st-qdrop-row { display: flex; align-items: center; }
.st-qdrop-item { flex: 1; min-width: 0; width: 100%; display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 8px; border: 0; border-radius: 8px; background: none; color: var(--text); font: 15px var(--font); text-align: left; cursor: pointer; }
.st-qdrop-item:hover, .st-qdrop-item:focus-visible { background: var(--surface-2); }
.st-qdrop-item > svg { color: var(--muted); flex: none; }
.st-qdrop-item span:not(.st-cat-icon) { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-qdrop-item em { font-style: normal; color: var(--muted); font-size: 13px; }
.st-qdrop-item .st-cat-icon.is-sm { flex: none; width: 28px; height: 28px; border-radius: 8px; font-size: 16px; background: var(--surface-2); }
.st-qdrop-x { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: var(--muted); cursor: pointer; }
.st-qdrop-x:hover { background: var(--surface-2); color: var(--text); }
.st-search-cancel { display: none; border: 0; background: none; color: var(--accent); font: 500 15px var(--font); min-height: 38px; cursor: pointer; }
@media (max-width: 680px) {
  .st-search-cancel { display: block; }
  .st-qdrop { min-width: 0; }
  .st-title-row:has(.st-search-cancel) { grid-template-columns: minmax(0, 1fr); grid-template-areas: "tools"; }
  .st-title-row:has(.st-search-cancel) .st-store-brand { display: none; }
}

.st-searchwrap { position: relative; flex: 0 1 300px; min-width: 0; display: flex; }
.st-searchwrap .st-searchbox { flex: 1 1 auto; }
.st-searchbox .st-search-input { -webkit-appearance: none; appearance: none; }
.st-searchbox .st-search-input::-webkit-search-cancel-button,
.st-searchbox .st-search-input::-webkit-search-decoration,
.st-searchbox .st-search-input::-webkit-search-results-button,
.st-searchbox .st-search-input::-webkit-search-results-decoration { -webkit-appearance: none; display: none; }
@media (max-width: 1060px) and (min-width: 900px) { .st-searchwrap { flex-basis: 220px; } }
@media (max-width: 680px) { .st-searchwrap { flex: 1 1 auto; } }

.st-search-clear { width: 32px; height: 32px; }
.st-info-links .st-lnk { min-height: 40px; }

/* In-place progress (install, update, Update all): the button fills up.
   See ui/ProgressFill.jsx. The layer covers the button; the button keeps the
   width it had on tap, and wide enough minimums mean the busy words fit. */
.st-card-action, .st-pill, .st-dbtn, .st-update-all-trigger { position: relative; }
.st-card-action:has(.st-fillp), .st-pill:has(.st-fillp), .st-dbtn:has(.st-fillp), .st-update-all-trigger:has(.st-fillp) { opacity: 1 !important; cursor: default; }
.st-fillp-hold { visibility: hidden; display: contents; }
.st-fillp {
  --p: 0; position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none;
  background: color-mix(in srgb, var(--accent) 22%, var(--surface)); color: var(--text);
}
.st-fillp-bar { position: absolute; inset: 0; background: var(--st-accent-fill); transform-origin: left center; transform: scaleX(var(--p)); }
.st-fillp-text { position: absolute; inset: 0; display: grid; place-items: center; font-size: 13px; font-weight: 600; letter-spacing: 0; }
.st-fillp-text > span { grid-area: 1 / 1; max-width: 100%; padding: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-fillp-text > .is-on { color: var(--accent-fg, #fff); clip-path: inset(-2px calc((1 - var(--p)) * 100%) -2px -2px); }
.st-dbtn .st-fillp-text { font-size: 14px; }
.st-card.is-row .st-card-action, .st-pill { min-width: 84px; }
.st-card.is-list .st-card-action { min-width: 96px; }
/* Phones: keep row text room; the busy words step down to fit. */
@media (max-width: 680px) {
  .st-card.is-row .st-card-action { min-width: 72px; padding: 0 10px; }
  .st-card.is-row .st-fillp-text { font-size: 12px; }
  .st-card.is-row .st-fillp-text > span { padding: 0 3px; }
  .st-ranked .st-card.is-row .st-card-byline .st-card-publisher { display: none; }
}
.st-update-batch-list .st-update-all-trigger { position: relative; overflow: hidden; }
.st-batch-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: color-mix(in srgb, var(--accent) 20%, transparent); }
.st-batch-bar i { display: block; height: 100%; background: var(--accent); transition: width .4s; }

/* ===== The Store's own update ==========================================
   A quiet button beside search (styled like the search box) whose panel is
   the search-suggestion dropdown holding an ordinary list row. */
.st-selfupd { position: relative; flex: none; }
/* The Store's own update sheet: an app page in miniature. */
.st-selfupd-sheet { padding: 20px; }
.st-selfupd-sheet:focus { outline: none; }
.st-selfupd-head { display: flex; align-items: center; gap: 14px; }
.st-selfupd-head img { width: 56px; height: 56px; border-radius: 14px; flex: none; }
.st-selfupd-head-text { min-width: 0; }
.st-selfupd-head .st-sheet-title { margin: 0; font-size: 18px; letter-spacing: -.01em; }
.st-selfupd-sub { margin-top: 2px; color: var(--muted); font-size: 13px; }
.st-selfupd-close { margin-left: auto; align-self: flex-start; width: 32px; height: 32px; flex: none; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--muted); display: grid; place-items: center; cursor: pointer; }
.st-selfupd-close:hover { color: var(--text); }
.st-selfupd-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-selfupd-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.st-selfupd-facts > div { min-width: 0; padding: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); }
.st-selfupd-facts b { display: block; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-selfupd-facts span { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.st-selfupd-k { margin: 18px 0 6px; color: var(--muted); font-size: 11.5px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; }
.st-selfupd-list { margin: 0; padding: 0; list-style: none; }
.st-selfupd-list li { position: relative; padding: 4px 0 4px 18px; font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
.st-selfupd-list li::before { content: ''; position: absolute; left: 4px; top: 11px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.st-selfupd-muted { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.45; }
.st-selfupd-access { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.st-selfupd-access svg { color: var(--accent); flex: none; }
.st-selfupd-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.st-selfupd-chips span { padding: 5px 9px; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); font-size: 12px; }
.st-selfupd-review { margin-top: 10px; }
.st-selfupd-err { margin: 12px 0 0; color: var(--danger, #e5484d); font-size: 13px; line-height: 1.4; }
.st-selfupd-donebody { margin: 14px 0 0; }
.st-selfupd-cta { margin-top: 18px; }
.st-selfupd-cta .st-btn { width: 100%; min-height: 46px; position: relative; overflow: hidden; font-size: 15px; }
.st-selfupd-cta .st-btn:has(.st-fillp) { opacity: 1 !important; cursor: default; }
.st-selfupd-later { display: block; width: 100%; min-height: 44px; margin-top: 6px; border: 0; background: none; color: var(--muted); font: 600 14px var(--font); cursor: pointer; }
.st-selfupd-later:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 12px; }
/* The update popup sits in the middle of the screen on every size. */
/* light-dark() follows the theme's color-scheme: a soft dim on light, a deep one on dark. */
.st-scrim.st-selfupd-scrim { align-items: center; padding: 20px; background: light-dark(rgba(0,0,0,.42), rgba(0,0,0,.72)); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.st-selfupd-scrim .st-selfupd-sheet { max-width: 420px; max-height: calc(100% - 40px); border-radius: 24px; border-color: var(--border); background: var(--surface); box-shadow: light-dark(0 24px 64px rgba(0,0,0,.22), 0 24px 64px rgba(0,0,0,.6)); }
.st-selfupd-row .st-card-open { cursor: default; }

/* Creator storefronts: identity, one featured work, then a quiet portfolio. */
.st-creator-profile { display: flex; align-items: flex-start; gap: 24px; padding: 32px 0 28px; }
.st-creator-avatar { position: relative; flex: none; width: 88px; height: 88px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 20px; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); font: 600 44px/1 var(--font); }
.st-creator-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-creator-identity { flex: 1; min-width: 0; }
.st-creator-kicker { display: block; font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--muted); }
.st-creator-identity h1 { margin: 8px 0 0; font-size: clamp(28px, 4vw, 38px); line-height: 1.12; letter-spacing: -.04em; overflow-wrap: anywhere; }
.st-creator-identity p { margin: 10px 0 0; color: var(--muted); font-size: 15px; line-height: 1.5; }
.st-creator-meta { display: block; margin-top: 12px; color: var(--muted); font-size: 12px; }
.st-creator-source { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font-size: 13px; text-decoration: none; }
.st-creator-source:hover { border-color: var(--accent); }
.st-creator-feature { position: relative; isolation: isolate; display: flex; align-items: flex-end; min-height: 330px; overflow: hidden; border: 1px solid var(--border); border-radius: 20px; background: #141419; color: #fff; }
.st-creator-feature-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 70% 40%; z-index: -2; }
.st-creator-feature::after { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgba(6,8,18,.94), rgba(6,8,18,.72) 43%, rgba(6,8,18,.1) 90%); }
.st-creator-feature-copy { padding: 32px; max-width: 530px; }
.st-creator-feature .st-creator-kicker { color: #d5c6ff; }
.st-creator-feature h2 { margin: 9px 0 10px; font-size: 34px; letter-spacing: -.04em; line-height: 1.12; }
.st-creator-feature p { margin: 0; max-width: 34ch; color: #e3dfea; font-size: 15px; line-height: 1.55; }
.st-creator-feature button { display: inline-flex; align-items: center; gap: 16px; min-height: 44px; margin-top: 21px; padding: 0 17px; border: 0; border-radius: 8px; background: #fff; color: #16131d; font: 600 13px var(--font); cursor: pointer; }
.st-creator-feature-copy > span:last-child { display: block; margin-top: 15px; font-size: 12px; color: #d4ccdf; }
.st-creator-work { margin-top: 32px; }
.st-creator-work-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 18px; }
.st-creator-work h2 { margin: 0; font-size: 22px; letter-spacing: -.025em; }
.st-creator-filters { display: flex; flex-wrap: wrap; gap: 4px; }
.st-creator-filters button { min-height: 44px; padding: 0 13px; border: 1px solid transparent; border-radius: 8px; color: var(--muted); background: none; font: 500 13px var(--font); cursor: pointer; }
.st-creator-filters button[aria-pressed="true"] { border-color: var(--border); background: var(--surface-2, var(--surface)); color: var(--text); }
.st-creator-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px 24px; }
.st-creator-card { display: block; min-width: 0; padding: 0; border: 0; border-radius: 16px; text-align: left; color: var(--text); background: none; font: inherit; cursor: pointer; }
.st-creator-art { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2, var(--surface)); }
.st-creator-card-art { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .2s; }
.st-creator-card:hover .st-creator-card-art { transform: scale(1.025); }
.st-creator-no-art { height: 100%; display: grid; place-items: center; }
.st-creator-no-art .st-hero-icon { width: 88px; height: 88px; }
.st-creator-card-info { display: flex; align-items: flex-start; gap: 12px; padding: 13px 0 4px; }
.st-creator-card-info > .st-icon-wrap { flex: none; width: 46px; height: 46px; border-radius: 12px; }
.st-creator-card-info > div:last-child { min-width: 0; }
.st-creator-card h3 { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.35; }
.st-creator-card-info span { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-creator-card p { margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.st-creator button:focus-visible, .st-creator a:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
@media (max-width: 680px) {
  .st-creator-profile { padding: 24px 0; gap: 16px; flex-wrap: wrap; }
  .st-creator-avatar { width: 65px; height: 65px; border-radius: 20px; font-size: 34px; }
  .st-creator-identity { flex-basis: calc(100% - 80px); }
  .st-creator-identity h1 { font-size: 30px; }
  .st-creator-identity p { font-size: 14px; }
  .st-creator-source { margin: -8px 0 0 80px; }
  .st-creator-feature { min-height: 340px; }
  .st-creator-feature-copy { padding: 24px; }
  .st-creator-feature h2 { font-size: 28px; }
  .st-creator-feature::after { background: linear-gradient(0deg, rgba(6,8,18,.98), rgba(6,8,18,.72) 47%, rgba(6,8,18,.04)); }
  .st-creator-feature-art { object-position: 65% center; }
  .st-creator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 16px; }
  .st-creator-art { aspect-ratio: 1.25; }
  .st-creator-card-info { gap: 8px; }
  .st-creator-card-info > .st-icon-wrap { width: 36px; height: 36px; border-radius: 12px; }
  .st-creator-card h3 { font-size: 13px; }
  .st-creator-card-info span { font-size: 12px; }
  .st-creator-work-head h2 { width: 100%; font-size: 22px; }
  .st-creator-filters { margin-left: -10px; }
}
@media (prefers-reduced-motion: reduce) { .st-creator-card-art { transition: none; } }

/* Library status card actions and folded update results. */
.st-update-batch-list { display: flex; flex-direction: column; gap: 8px; }
.st-update-batch-live { display: flex; flex-wrap: wrap; gap: 8px; }
.st-update-batch-past > summary { display: inline-flex; list-style: none; cursor: pointer; padding: 6px 0; }
.st-update-batch-past > summary::-webkit-details-marker { display: none; }
.st-update-batch-past-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }

/* Row hover: rows only have a divider above them, so hover is a
   soft rounded highlight behind the whole row rather than a coloured line,
   and the first row of a list highlights like every other. Shelves get a
   little side room so the highlight is not clipped by their scroller. */
@media (hover: hover) {
  .st-card.is-row, .st-card.is-list { isolation: isolate; }
  .st-card.is-row::before, .st-card.is-list::before {
    content: ""; position: absolute; inset: 4px -10px; border-radius: 16px; z-index: -1;
    background: color-mix(in srgb, var(--text) 6%, transparent);
    opacity: 0; transition: opacity .15s; pointer-events: none;
  }
  .st-card.is-row:has(.st-card-open:hover)::before, .st-card.is-list:has(.st-card-open:hover)::before { opacity: 1; }
}
.st-rowshelf { padding-inline: 12px; margin-inline: -12px; scroll-padding-inline: 12px; }

/* ===== Library as tabs =====================================================
   Title row with Publish an app, an underlined tab strip pinned under the
   Store header while the list scrolls, one focused list per tab. */
.st-pagehead-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.st-upload-btn {
  display: inline-flex; align-items: center; gap: 8px; flex: none; height: 40px; padding: 0 16px 0 12px;
  border: 0; border-radius: 999px; background: var(--st-accent-fill); color: var(--accent-fg, #fff);
  font: 600 14px var(--font); cursor: pointer; transition: filter .15s, transform .12s;
}
.st-upload-btn:hover { filter: brightness(1.07); }
.st-upload-btn:active { transform: scale(.96); }
.st-upload-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-libtabs {
  /* The scroller's 16px top padding would leave a gap above a top:0 strip. */
  position: sticky; top: -16px; z-index: 4; display: flex; gap: 4px; margin-block: 18px 22px;
  background: var(--bg); overflow-x: auto; scrollbar-width: none;
}
.st-libtabs::-webkit-scrollbar { display: none; }
.st-libtabs::after { content: ""; position: absolute; left: -100vmax; right: -100vmax; bottom: 0; border-bottom: 1px solid var(--border); pointer-events: none; }
.st-libtab {
  position: relative; display: inline-flex; align-items: center; gap: 8px; flex: none; height: 46px; padding: 0 14px;
  border: 0; background: none; color: var(--muted); font: 600 15px var(--font); cursor: pointer; white-space: nowrap;
}
.st-libtab:hover, .st-libtab[aria-selected="true"] { color: var(--text); }
.st-libtab[aria-selected="true"]::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 0; z-index: 1; height: 3px; border-radius: 3px 3px 0 0; background: var(--accent); }
.st-libtab:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; border-radius: 12px; }
.st-libtab { line-height: 1; }
.st-libtab-count { color: var(--muted); font: inherit; line-height: 1; font-variant-numeric: tabular-nums; }
.st-libtab[aria-selected="true"] .st-libtab-count { color: var(--text); }
.st-libbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 40px; margin-block: 0 14px; }
.st-libbar p { margin: 0; max-width: 62ch; color: var(--muted); font-size: 14px; line-height: 1.45; }
.st-scroll.is-library .st-update-batch-list { margin-block: -2px 14px; }
.st-libempty { display: grid; justify-items: center; gap: 6px; padding: 56px 20px; border: 1px dashed var(--border); border-radius: 16px; text-align: center; }
.st-libempty b { font-size: 16px; }
.st-libempty span { max-width: 40ch; color: var(--muted); font-size: 14px; }
/* Rows: icon, name, one-line description, details line; one action and More. */
.st-libpane .st-lib-panel { padding: 0; overflow: visible; }
.st-libpane .st-lib-panel > * + * { border-top: 0; }
.st-libpane .st-lib-panel .st-card + .st-card { background: linear-gradient(var(--border), var(--border)) no-repeat 78px 0 / calc(100% - 78px) 1px; }
/* Row hover fills the row inside the panel; an open More menu lifts its row. */
.st-libpane .st-card.is-list::before { inset: 0; border-radius: inherit; }
.st-libpane .st-card.is-list:has(.st-rowmenu-btn[aria-expanded="true"]) { z-index: 5; }
.st-libpane .st-card.is-list {
  position: relative; grid-template-columns: 48px minmax(0, 1fr) auto; grid-template-rows: auto auto auto auto;
  column-gap: 14px; row-gap: 2px; min-height: 76px; padding: 12px 16px; border: 0; border-radius: 0; background: none;
}
.st-libpane .st-lib-panel .st-card:first-child { border-radius: 16px 16px 0 0; }
.st-libpane .st-lib-panel .st-card:last-child { border-radius: 0 0 16px 16px; }
.st-libpane .st-lib-panel .st-card:only-child { border-radius: 16px; }
.st-libpane .st-card.is-list .st-icon-slot { grid-row: 1 / -1; align-self: center; }
.st-libpane .st-card.is-list .st-icon-wrap { width: 48px; height: 48px; border-radius: 12px; }
.st-libpane .st-card.is-list .st-card-open { grid-row: 1; align-self: end; font-size: 15px; font-weight: 600; line-height: 1.3; }
.st-libpane .st-card.is-list .st-card-desc { display: block; grid-column: 2; grid-row: 2; margin: 0; color: var(--muted); font-size: 14px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; -webkit-line-clamp: unset; }
.st-libpane .st-card.is-list .st-card-byline { grid-column: 2; grid-row: 3; font-size: 12px; }
.st-libpane .st-card.is-list .st-card-state-row { grid-column: 2; grid-row: 4; min-height: 0; margin-top: 2px; gap: 6px; }
.st-libpane .st-card.is-list .st-card-state-row:empty { display: none; }
.st-libpane .st-card-state-line { padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; background: color-mix(in srgb, currentColor 14%, transparent); }
.st-libpane.is-needs .st-card-state-line.is-conflict, .st-libpane.is-update .st-card-state-line.is-update { display: none; }
.st-libpane .st-card.is-list .st-card-status-row { grid-column: 3; grid-row: 1 / -1; flex-wrap: nowrap; gap: 6px; }
.st-libpane .st-card-action { min-width: 84px; height: 34px; min-height: 34px; padding: 0 16px; border-radius: 999px; font: 600 13px var(--font); }
.st-libpane .st-card-action:not(.is-installed):not(.is-conflict) { background: var(--st-accent-fill); color: var(--accent-fg, #fff); }
.st-libpane .st-card-action.is-conflict { background: var(--st-accent-fill); color: var(--accent-fg, #fff); }
.st-rowmenu { position: relative; z-index: 2; }
.st-rowmenu-btn { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: none; color: var(--muted); cursor: pointer; }
.st-rowmenu-btn:hover, .st-rowmenu-btn[aria-expanded="true"] { background: var(--surface-2); color: var(--text); }
.st-rowmenu-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.st-rowmenu-pop { position: absolute; top: calc(100% + 6px); right: 0; z-index: 20; min-width: 160px; padding: 6px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: 0 14px 34px rgba(0,0,0,.32); }
.st-rowmenu-pop button { display: block; width: 100%; height: 38px; padding: 0 12px; border: 0; border-radius: 8px; background: none; color: var(--text); font: 500 14px var(--font); text-align: left; cursor: pointer; }
.st-rowmenu-pop button:hover, .st-rowmenu-pop button:focus-visible { background: var(--surface-2); outline: none; }
@media (max-width: 680px) {
  .st-upload-btn { height: 38px; padding: 0 14px 0 10px; font-size: 14px; }
  .st-libtabs { margin: 14px 0 16px; gap: 0; }
  .st-libtab { padding: 0 10px; font-size: 14px; }
  .st-libbar { flex-direction: column; align-items: flex-start; gap: 12px; }
  .st-libpane .st-card.is-list { grid-template-columns: 44px minmax(0, 1fr) auto; column-gap: 12px; padding: 12px; }
  .st-libpane .st-card.is-list .st-icon-wrap { width: 44px; height: 44px; }
  .st-libpane .st-lib-panel .st-card + .st-card { background-position: 68px 0; background-size: calc(100% - 68px) 1px; }
  .st-libpane .st-card-action { min-width: 0; padding: 0 14px; }
}

/* Phone title rows and the Search tab (after the base rules they adjust). */
@media (max-width: 680px) {
  /* Each tab's title row carries the tools the desktop header holds. */
  .st-pagehead-row { align-items: center; gap: 8px; justify-content: flex-start; }
  .st-pagehead-row .st-pagehead-title { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st-scroll .st-pagehead { padding-top: 0; }
  .st-mobius-back {
    display: inline-flex; align-items: center; gap: 2px; height: 40px; padding: 0 10px 0 2px; margin-left: -6px;
    border: 0; border-radius: 12px; background: none; color: var(--accent); font: 600 16px var(--font); cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .st-mobius-back:active { opacity: .6; }
  .st-mobius-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .st-phone-search { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
  .st-phone-search .st-searchwrap { flex: 1; min-width: 0; }
  .st-phone-search .st-searchbox { width: 100%; height: 44px; }
  .st-search-landing { margin-top: 10px; }
  .st-search-landing .st-qdrop-head { padding-inline: 0; margin-top: 12px; }
  .st-search-landing .st-qdrop-item { padding-inline: 0; height: 48px; }
  .st-search-landing .st-qdrop-item .st-cat-icon.is-sm { width: 34px; height: 34px; font-size: 18px; }
}

/* Phones: every small control gets a 44px tap area without changing its look. */
@media (max-width: 680px) {
  .st-card-action, .st-rowmenu-btn, .st-mobius-back,
  .st-spotlight-pagination > button, .st-spotlight-toggle, .st-spotlight-open { position: relative; }
  .st-card-action::before, .st-rowmenu-btn::before, .st-mobius-back::before,
  .st-spotlight-pagination > button::before, .st-spotlight-toggle::before, .st-spotlight-open::before {
    content: ""; position: absolute; top: 50%; left: 50%;
    width: max(100%, 44px); height: max(100%, 44px); transform: translate(-50%, -50%);
  }
}

/* Phones: the App Store's own bar. Back on the left, the Store centered,
   your profile on the right; an App Store update shows as one slim line. */
@media (max-width: 680px) {
  .st-phonebar { flex-shrink: 0; padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); background: var(--bg); }
  .st-phonebar + .st-scroll { padding-top: 8px; }
  .st-phonebar + .st-scroll .st-libtabs { top: -8px; }
  .st-phonebar { overflow: hidden; }
  .st-storebar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 52px; transition: margin-top .22s ease, opacity .18s ease; }
  /* Scrolling down tucks the bar away; the update line below stays. */
  .st-phonebar.is-tucked .st-storebar { margin-top: -52px; opacity: 0; pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .st-storebar { transition: none; } }
  .st-storebar-start { justify-self: start; }
  .st-storebar-end { justify-self: end; }
  .st-storebar-brand { display: flex; align-items: center; gap: 8px; font: 700 17px var(--font); letter-spacing: -.01em; }
  .st-storebar-brand img { width: 26px; height: 26px; border-radius: 8px; }
}

/* Phones: a clear Publish an app button at the top of Library. */
.st-upload-wide {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 46px; margin: 4px 0 2px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border)); border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--text); font: 600 15px var(--font); cursor: pointer;
}
.st-upload-wide svg { color: var(--accent); }
.st-upload-wide:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-rowmenu-pop button.is-danger { color: var(--danger, #f87171); }


/* New App Store version: a centred alert over the Store, once per visit. */

/* Publish an app picker: one quiet heading, then one card of apps, each with
   a status dot and a single Store pill — the same shape as Our picks. */
.st-publish-heading.is-choose { align-items: flex-end; margin: 0 0 20px; padding: 22px 0 0; border-bottom: 0; }
.st-publish-heading.is-choose h2 { font-size: clamp(28px, 4vw, 34px); line-height: 1.1; letter-spacing: -.035em; }
.st-publish-heading.is-choose p { margin-top: 2px; }
.st-publish-list.is-card { column-gap: 40px; padding: 6px 24px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); }
.st-publish-list.is-card .st-publish-row { grid-template-columns: auto minmax(0, 1fr) auto; gap: 16px; min-height: 0; padding: 14px 0; border-bottom: 0; border-top: 1px solid var(--border); }
.st-publish-list.is-card .st-publish-row:nth-child(-n+2) { border-top: 0; }
.st-publish-list.is-card .st-publish-icon { width: 52px; height: 52px; border-radius: 12px; }
.st-publish-list.is-card .st-publish-row-copy h3 { font-size: 15px; font-weight: 600; }
.st-publish-status { display: inline-flex; align-items: center; gap: 7px; }
.st-publish-row-copy .st-publish-status { font-size: 13px; }
.st-publish-status::before { content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%; background: color-mix(in srgb, var(--muted) 70%, transparent); }
.st-publish-status.is-live::before { background: var(--green); }
.st-publish-status.is-pending::before { background: var(--st-star); }
.st-publish-status.is-problem::before { background: var(--danger); }
.st-publish-pill {
  min-width: 76px; min-height: 44px; padding: 8px 16px; border: 0; border-radius: 999px;
  color: var(--st-accent-text); background: var(--surface-2, var(--surface));
  font: 600 13px/1.3 var(--font); cursor: pointer; white-space: nowrap; touch-action: manipulation;
  transition: background 0.14s ease, transform 0.1s ease;
}
@media (hover: hover) { .st-publish-pill:not(:disabled):hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface-2, var(--surface))); } }
@media (prefers-reduced-motion: no-preference) { .st-publish-pill:not(:disabled):active { transform: scale(0.97); } }
.st-publish-pill:disabled { opacity: 0.5; cursor: default; }
.st-publish-advanced { margin-top: -12px; border: 0; background: transparent; overflow: visible; }
.st-publish-advanced > summary { display: inline-flex; justify-content: flex-start; gap: 6px; min-height: 44px; padding: 0; color: var(--muted); font-size: 14px; font-weight: 500; cursor: pointer; list-style: none; }
.st-publish-advanced > summary span { color: var(--st-accent-text); font-size: 14px; font-weight: 600; }
.st-publish-advanced[open] > summary { border-bottom: 0; }
.st-publish-advanced .st-publish-review { margin-top: 8px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
@media (max-width: 760px) {
  .st-publish-list.is-card { grid-template-columns: 1fr; padding: 2px 16px; border-radius: 18px; }
  .st-publish-list.is-card .st-publish-row:nth-child(2) { border-top: 1px solid var(--border); }
}
@media (max-width: 680px) {
  .st-publish-heading.is-choose { align-items: stretch; gap: 14px; }
  .st-publish-heading.is-choose .st-publish-heading-actions { width: 100%; }
  .st-publish-list.is-card .st-publish-row { grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; }
  .st-publish-pill { min-width: 64px; padding: 8px 13px; }
}

/* Desktop rhythm, in line with the other Möbius apps: sections 32px apart,
   rows a little over a 44px tap target with room around them, and a shorter
   spotlight than phones. Phones keep their own spacing above. */
@media (min-width: 681px) {
  .st-sec { margin-top: 32px; }
  .st-sh { margin-bottom: 12px; }
  .st-sh-title { font-size: 20px; }
  .st-pagehead { padding: 16px 0 12px; }
  .st-catalog-sections { gap: 24px; }
  .st-spotlight-slide { min-height: clamp(280px, 26vw, 360px); }
  .st-panels { margin-top: 32px; gap: 20px; }
  .st-panel { padding: 18px 20px 6px; }
  .st-panel-title { margin-bottom: 4px; font-size: 20px; }
  .st-today { margin-top: 20px; gap: 20px; }
  .st-card.is-row { grid-template-columns: 56px minmax(0, 1fr) auto; min-height: 76px; padding: 10px 0; column-gap: 16px; }
  .st-card.is-row .st-icon-wrap { width: 56px; height: 56px; border-radius: 15px; }
  .st-catrow { min-height: 50px; }
  .st-lib-panel .st-card.is-list { min-height: 76px; padding: 10px 0; }
  .st-dh { margin-top: 12px; gap: 22px; }
  .st-dh .st-hero-icon { width: 104px; height: 104px; border-radius: 24px; }
  .st-dh-acts { margin-top: 13px; }
  .st-strip { margin-top: 20px; padding: 12px 0; }
  .st-shot .st-detail-gallery-image { height: clamp(320px, 32vw, 440px); }
  .st-detail-v2 .st-community-feedback { margin-top: 32px; }
  .st-info-row { padding: 11px 0; }
  .st-info-links { margin-top: 12px; }
  .st-access .st-permission-row { padding: 12px 0; }
  .st-scroll.is-detail { padding-bottom: 40px; }
}
`
