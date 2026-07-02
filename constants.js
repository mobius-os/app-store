// Curated catalog. Each entry points at a public mobius-os repo on
// the main branch. The Browse view fetches each manifest URL at
// mount time and merges the parsed JSON into the card data, so the
// catalog always reflects the repo's current name/version/description.
export const CATALOG = [
  // Memory + Reflection are platform CORE apps (installed by
  // install-core-apps), not store-INSTALLABLE — but they ARE store-UPDATABLE.
  // `core: true` surfaces them under "Built in": discoverable, openable, and
  // (when the published catalog version is newer than what's installed) an
  // Update affordance — but NEVER an install or uninstall path, so a platform
  // app can't be removed and there's no row to fork into a dup. The update
  // keys on the app's manifest identity (findInstalled resolves them by slug,
  // still 'memory' / 'reflection'), so the existing row is updated in place;
  // install-core-apps SKIPS store-managed apps (manifest_url set), so the
  // deploy re-sync won't fight a store update.
  {
    id: 'memory',
    repo: 'mobius-os/app-memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/',
    core: true,
  },
  {
    id: 'reflection',
    repo: 'mobius-os/app-reflection',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-reflection/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-reflection/main/',
    core: true,
  },
  // --- Store-installable apps below ---
  {
    id: 'habits',
    repo: 'mobius-os/app-habits',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-habits/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-habits/main/',
  },
  {
    id: 'notes',
    repo: 'mobius-os/app-notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
  },
  {
    id: 'news',
    repo: 'mobius-os/app-news',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-news/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-news/main/',
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
  {
    id: 'gym',
    repo: 'mobius-os/app-workout',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-workout/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-workout/main/',
  },
  {
    id: 'atlas',
    repo: 'mobius-os/app-atlas',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-atlas/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-atlas/main/',
  },
  {
    id: 'tandem',
    repo: 'mobius-os/app-tandem',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-tandem/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-tandem/main/',
  },
  {
    id: 'latex',
    repo: 'mobius-os/app-latex',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/',
  },
  {
    id: 'cuberun',
    repo: 'mobius-os/app-cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/',
  },
]

// The store's OWN version — keep in lockstep with mobius.json on each release.
// The store is a core app, so it isn't in installed-versions.json or the
// catalog grid; it self-updates via the banner below: fetch its published
// manifest and, when that version is newer than what's running, offer a
// one-tap update (the same install transaction every other app uses) followed
// by a reload so the freshly-patched code loads.
export const STORE_VERSION = '1.7.2'
export const STORE_SELF = {
  manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-store/main/mobius.json',
  raw_base: 'https://raw.githubusercontent.com/mobius-os/app-store/main/',
}

// Hosts we recognize as common public manifest sources. The paste-a-URL
// flow silently trusts these; anything else triggers a soft warning in
// the install confirm modal. This is UX-only — the backend's SSRF
// defenses are the actual security boundary.
export const TRUSTED_HOSTS = new Set([
  'raw.githubusercontent.com',
  'codeberg.org',
  'git.sr.ht',
  'gitlab.com',
])


// Human-language explanations for the permission strings. `tag` is the
// 1-word badge that sits next to each row's title; `summary` is the
// short user-facing prose; `hint` is the muted helper line that spells
// out the practical consequence the user is actually granting.
export const PERM_EXPLAIN = {
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
