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
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left));
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
/* Single header row: the brand icon sits left, the Browse / From URL
   segmented control fills the rest of the same row (no second row). */
.st-title-row {
  display: flex; align-items: center; gap: 12px;
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
.st-tabs .st-seg-btn { flex: 1; min-width: 0; }

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
@media (max-width: 520px) {
  .st-update-all-trigger { margin-left: 0; }
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

/* Curated collections keep very different kinds of apps discoverable without
   turning each category into a separate catalog. Search and lifecycle filters
   preserve the same shelves and simply hide empty ones. */
.st-catalog-sections {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.st-catalog-section { min-width: 0; }
.st-catalog-section-head { margin: 0 0 12px; }
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

/* App-specific catalog grid + tiles. The vertical-tile card diverges
   structurally from the canonical horizontal list Card, so it keeps the
   store's own values + class names. State rides is-* modifier classes. */
.st-catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
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
  padding: 16px 12px;
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
.st-card.is-selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, var(--surface));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent);
}
.st-card-select {
  position: absolute; z-index: 3; top: 4px; right: 4px;
  width: 44px; height: 44px; border-radius: 999px;
  display: grid; place-items: center;
  cursor: pointer; touch-action: manipulation;
}
.st-card-select input {
  position: absolute; inset: 0; width: 100%; height: 100%; margin: 0;
  opacity: 0; cursor: pointer;
}
.st-card-select span {
  width: 24px; height: 24px; border-radius: 7px;
  display: grid; place-items: center;
  border: 1px solid color-mix(in srgb, var(--text) 34%, var(--border));
  background: var(--surface); color: transparent;
  font-size: 14px; font-weight: 800; line-height: 1;
  box-shadow: 0 1px 3px rgba(0,0,0,.12);
}
.st-card-select input:checked + span {
  background: var(--accent); border-color: var(--accent); color: var(--accent-fg);
}
.st-card-select input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
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
.st-update-review.is-result {
  height: auto;
  max-width: 560px;
  grid-template-rows: auto auto auto;
}
.st-update-all-review {
  height: auto;
  max-height: min(720px, calc(100% - 16px));
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
.st-update-review-notice.is-blocked {
  border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
  background: color-mix(in srgb, var(--accent) 9%, var(--surface));
}
.st-update-review-result-title {
  margin-bottom: 7px; color: var(--text); font-size: 16px; font-weight: 700;
}
.st-update-resolution-options { display: grid; gap: 9px; margin-top: 14px; }
.st-update-resolution-options > div {
  display: grid; gap: 2px; padding-left: 11px;
  border-left: 2px solid color-mix(in srgb, var(--accent) 55%, var(--border));
}
.st-update-resolution-options strong { color: var(--text); font-size: 13px; }
.st-update-resolution-options span { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-update-exact {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 55%, var(--border));
}
.st-update-review-error-text,
.st-selectable-error {
  user-select: text;
  cursor: text;
}
.st-update-review-error-text { margin-bottom: 6px; color: var(--danger); }
.st-update-all-intro {
  padding: 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 9%, var(--surface2));
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
}
.st-update-all-list {
  border-block: 1px solid var(--border);
}
.st-update-all-item,
.st-update-all-attention {
  border-bottom: 1px solid var(--border);
}
.st-update-all-item:last-child,
.st-update-all-attention:last-child { border-bottom: 0; }
.st-update-all-item > summary {
  min-height: 56px;
  padding: 10px 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  cursor: pointer;
  list-style: none;
}
.st-update-all-item > summary::-webkit-details-marker { display: none; }
.st-update-all-item > summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 6px;
}
.st-update-all-item-main {
  min-width: 0;
  display: grid;
  gap: 3px;
}
.st-update-all-item-main strong {
  color: var(--text);
  font-size: 14px;
  line-height: 1.35;
}
.st-update-all-item-main > span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
.st-update-all-state {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}
.st-update-all-state.is-ready { color: var(--green); }
.st-update-all-files {
  margin: -2px 0 10px;
  padding: 10px 12px;
  display: grid;
  gap: 5px;
  border-radius: 8px;
  background: var(--surface2);
  color: var(--muted);
  font: 11px/1.45 var(--mono, monospace);
  overflow-wrap: anywhere;
}
.st-update-all-attention {
  min-height: 64px;
  padding: 10px 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.st-update-all-attention .st-btn { flex: 0 0 auto; min-height: 40px; }
.st-update-all-progress {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}
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
  .st-update-review.is-result { height: auto; align-self: center; }
  .st-update-review-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .st-update-review-actions .st-btn { width: 100%; margin: 0; }
  .st-update-review-actions .st-btn-primary { grid-column: 1 / -1; order: -2; }
  .st-update-review-actions .st-btn-secondary { order: -1; }
  .st-update-review.is-result .st-update-review-actions .st-btn-primary {
    grid-column: auto; order: initial;
  }
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

/* Batch install: selection remains in-flow; review becomes one bounded dialog. */
.st-batch-bar {
  flex: 0 0 auto; z-index: 20;
  display: flex; align-items: center; gap: 8px;
  padding: 10px max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: 0 -5px 18px rgba(0,0,0,.12);
}
.st-batch-count { flex: 1; min-width: 0; color: var(--muted); font-size: 13px; }
.st-batch-count strong { color: var(--text); font-size: 16px; }
.st-batch-scrim {
  position: absolute; inset: 0; z-index: 130;
  display: grid; place-items: center;
  padding: 16px; background: rgba(0,0,0,.56);
}
.st-batch-review {
  width: min(680px, 100%); max-height: min(860px, calc(100% - 4px));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg); border: 1px solid var(--border); border-radius: 18px;
  box-shadow: 0 18px 55px rgba(0,0,0,.34);
}
.st-batch-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 20px 20px 14px; border-bottom: 1px solid var(--border);
}
.st-batch-title { margin: 0; font-size: 20px; line-height: 1.2; }
.st-batch-subtitle { margin: 5px 0 0; color: var(--muted); font-size: 13px; }
.st-batch-close {
  width: 44px; height: 44px; flex: 0 0 auto; border: 0; border-radius: 10px;
  display: grid; place-items: center; background: transparent; color: var(--muted);
  font-size: 20px; cursor: pointer;
}
.st-batch-body { min-height: 0; overflow-y: auto; padding: 16px 20px; scrollbar-width: none; }
.st-batch-body::-webkit-scrollbar { display: none; }
.st-batch-guidance, .st-batch-loading {
  margin-bottom: 14px; padding: 11px 12px; border-radius: 10px;
  background: var(--surface2, var(--surface)); color: var(--muted);
  font-size: 13px; line-height: 1.45;
}
.st-batch-list { display: grid; gap: 10px; }
.st-batch-item { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: clip; }
.st-batch-item.is-installed { border-color: color-mix(in srgb, var(--green) 50%, var(--border)); }
.st-batch-item.is-error { border-color: color-mix(in srgb, var(--danger) 50%, var(--border)); }
.st-batch-item.is-over-quota { opacity: .48; filter: grayscale(.72); }
.st-batch-flat { padding: 10px 12px 12px; }
.st-batch-row { min-height: 50px; display: flex; align-items: center; gap: 11px; }
.st-batch-item summary {
  min-height: 66px; padding: 10px 12px; display: flex; align-items: center; gap: 11px;
  cursor: pointer; list-style: none; user-select: none;
}
.st-batch-item summary::-webkit-details-marker { display: none; }
.st-batch-icon { width: 42px; height: 42px; flex: 0 0 auto; display: block; }
.st-batch-icon .st-icon-wrap { width: 42px; height: 42px; border-radius: 10px; }
.st-batch-icon .st-icon-letter { font-size: 18px; }
.st-batch-item-copy { min-width: 0; flex: 1; display: grid; gap: 3px; }
.st-batch-item-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.st-batch-item-copy small { color: var(--muted); font-size: 12px; }
.st-batch-chevron { color: var(--muted); font-size: 24px; transform: rotate(90deg); transition: transform .15s; }
.st-batch-item[open] .st-batch-chevron { transform: rotate(-90deg); }
.st-batch-remove {
  width: 36px; height: 36px; flex: 0 0 auto; z-index: 2;
  border: 1px solid var(--border); border-radius: 9px; background: var(--surface2, var(--surface));
  color: var(--muted); font: 20px/1 var(--font); cursor: pointer;
}
.st-batch-access { padding: 0 12px 12px; border-top: 1px solid var(--border); }
.st-batch-access .st-capability-list { margin-top: 12px; }
.st-batch-actions {
  flex: 0 0 auto; display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 20px max(14px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border);
  background: var(--surface);
}
.st-quota-panel {
  margin-bottom: 14px; padding: 12px; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: 12px; background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}
.st-quota-panel.is-exceeded { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 9%, var(--surface)); }
.st-quota-head { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.st-quota-head span, .st-quota-panel small { color: var(--muted); }
.st-quota-track, .st-item-progress {
  height: 5px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--border) 72%, transparent);
}
.st-quota-track { margin: 10px 0 8px; }
.st-quota-track span, .st-item-progress span { display: block; width: 0; height: 100%; background: var(--accent); border-radius: inherit; }
.st-quota-panel.is-exceeded .st-quota-track span { background: var(--danger); }
.st-item-progress { margin: 0 12px 10px; }
.st-batch-flat .st-item-progress { margin: 4px 0 0; }
.st-item-progress.is-complete span, .st-item-progress.is-error span { width: 100%; }
.st-item-progress.is-complete span { background: var(--green); }
.st-item-progress.is-error span { background: var(--danger); }
.st-item-progress.is-active span { width: 42%; animation: st-progress-slide 1.05s ease-in-out infinite; }
@keyframes st-progress-slide { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
@media (prefers-reduced-motion: reduce) { .st-item-progress.is-active span { width: 100%; animation: none; } }
.st-card.is-selection-disabled { opacity: .5; filter: grayscale(.5); }
.st-card-select input:disabled + span { cursor: not-allowed; }
@media (max-width: 520px) {
  .st-batch-scrim { padding: 0; place-items: end stretch; }
  .st-batch-review { width: 100%; max-height: 92%; border-radius: 18px 18px 0 0; }
  .st-batch-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .st-batch-actions .st-btn-primary { grid-column: 1 / -1; order: -1; }
  .st-batch-bar .st-btn { padding-inline: 12px; }
}
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
    position: relative;
    max-width: 840px;
    margin-inline: auto;
  }
  .st-brand-icon,
  .st-brand-fallback {
    position: absolute;
    left: -46px;
    top: 50%;
    transform: translateY(-50%);
  }
  .st-tabs {
    flex: 0 0 auto;
    width: 100%;
  }
  .st-scroll > * {
    max-width: 840px;
    margin-inline: auto;
  }
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
`
