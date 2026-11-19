import { MANIFEST_SNAPSHOTS } from './manifest-snapshots.js'
import CATALOG_REGISTRY from './catalog.json' with { type: 'json' }

// The checked-in registry is the sole authority for catalog membership and
// discovery copy. Generated manifest snapshots add only the version-coupled
// first-paint floor; install and update still resolve each live manifest URL.
export const CATALOG = CATALOG_REGISTRY.apps.map((entry) => ({

  ...entry,
  manifest: MANIFEST_SNAPSHOTS[entry.id] || null,
}))
// Store-assigned categories for community listings published before creators
// could choose one, keyed by lowercase GitHub owner/repo. A creator's own
// `store.category` always wins.
export const COMMUNITY_CATEGORIES = Object.freeze({ ...(CATALOG_REGISTRY.community_categories || {}) })
// The Store fetches the same registry URL at mount so newly published entries
// can appear without a Store release. This checked-in import is its offline
// floor; the remote copy may be newer but never defines a second schema.
export const CATALOG_URL =
  'https://raw.githubusercontent.com/mobius-os/app-store/main/catalog.json'

// Human-facing release label for diagnostics. The Store's self-update banner
// uses verified source provenance, not this value, to decide availability.
export const STORE_VERSION = '1.28.0'
export const STORE_SELF = {
  manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-store/main/mobius.json',
  raw_base: 'https://raw.githubusercontent.com/mobius-os/app-store/main/',
}

// Which free licenses publishing offers, their names and their order
// (recommended first) are the platform's: its listing review returns them as
// `license_options`. The Store adds only a plain-language meaning per SPDX id;
// a license it has no words for yet shows by name alone.
export const LICENSE_SUMMARIES = Object.freeze({
  MIT: 'Anyone can use, change and share your app, even commercially, as long as your name stays on it.',
  'Apache-2.0': 'Just as open as MIT, and also promises people can use any patents in your app.',
  'GPL-3.0-or-later': 'Anyone can use and change it, but anything they share built from it must stay open under the same license.',
})

// What a Möbius that requires a license but predates `license_options`
// accepts. Remove once every supported platform sends the list.
export const FALLBACK_LICENSE_OPTIONS = Object.freeze([
  Object.freeze({ spdx: 'MIT', name: 'MIT License' }),
  Object.freeze({ spdx: 'Apache-2.0', name: 'Apache License 2.0' }),
  Object.freeze({ spdx: 'GPL-3.0-or-later', name: 'GNU GPL v3.0 or later' }),
])

// The platform's Store listing contract, in UTF-8 bytes as the publisher
// checks it. Catalog text is bounded here, never at a display width: cards and
// banners shorten it when they render, and the detail view shows it whole.
export const LISTING_LIMITS = Object.freeze({
  taglineBytes: 120,
  descriptionBytes: 4000,
  altBytes: 300,
  captionBytes: 120,
  screenshots: 5,
})

// Hosts we recognize as common public manifest sources. The paste-a-URL
// flow silently trusts these; anything else triggers a soft warning in
// the install confirm modal. This is UX-only — the backend's SSRF
// defenses are the actual security boundary.
export const TRUSTED_HOSTS = new Set([
  'raw.githubusercontent.com',
  'www.mobius.you',
  'codeberg.org',
  'git.sr.ht',
  'gitlab.com',
])


// Human-language explanations for the permission strings. `tag` is the
// 1-word badge that sits next to each row's title; `summary` is the
// short user-facing prose; `hint` is the muted helper line that spells
// out the practical consequence the user is actually granting.
export const PERM_EXPLAIN = {
  chat_log_access: {
    none: {
      tag: 'None',
      summary: 'Cannot read your chat history.',
      hint: 'The app cannot use the chat-history API.',
    },
    summary: {
      tag: 'Redacted',
      summary: 'Reads a redacted view of your chats.',
      hint: 'Conversation text can be read, but tool calls, hidden reasoning, attachments, file paths, and detected secrets are removed by the platform.',
    },
    full: {
      tag: 'Full requested',
      summary: 'Requests full chat-history access.',
      hint: 'Möbius currently serves only the redacted view; unredacted access is reserved and not yet enabled.',
    },
    unknown: {
      tag: 'Unsupported',
      summary: 'Requests an unrecognized chat-history access level.',
      hint: 'This manifest is invalid and cannot be installed until its publisher uses a supported access level.',
    },
  },
  system_prompt: {
    true: {
      tag: 'Every chat',
      summary: 'Adds instructions the agent follows in every chat.',
      hint: 'These app-provided instructions become part of the agent’s system prompt while the app is live. Install or removal applies on the next turn.',
    },
  },
  skills: {
    true: {
      tag: 'Shared',
      summary: 'Adds reusable instructions to the shared skills library.',
      hint: 'The agent can load these guides for relevant work while the app is active. Uninstall deactivates app-owned copies without discarding user edits.',
    },
  },
  embeds_agent: {
    true: {
      tag: 'In app',
      summary: 'Includes an agent experience inside this app.',
      hint: 'The app can start and continue agent chats through its own interface.',
    },
  },
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

// One discovery taxonomy for the Apps and Games tabs. `id` is the stable value
// a creator writes in `mobius.json` `store.category`; `kind` picks the tab;
// `color` is the category's icon hue, shown Google Play style as a colored
// glyph on a soft tint of itself. Titles and copy may change freely, ids never.
export const STORE_CATEGORIES = Object.freeze([
  { id: 'productivity', kind: 'apps', title: 'Productivity', color: '#3b82f6',
    description: 'Tasks, notes and boards that keep your work moving.' },
  { id: 'everyday', kind: 'apps', title: 'Everyday', color: '#16a34a',
    description: 'Habits, health and helpers for ordinary days.' },
  { id: 'create', kind: 'apps', title: 'Create', color: '#db2777',
    description: 'Make websites, documents, audio and games with your agent.' },
  { id: 'explore', kind: 'apps', title: 'Learn & explore', color: '#d97706',
    description: 'Maps, history and curious things to discover.' },
  { id: 'money', kind: 'apps', title: 'Money & work', color: '#0d9488',
    description: 'Markets, careers and business research.' },
  { id: 'news', kind: 'apps', title: 'News & social', color: '#ea580c',
    description: 'Stay informed and do things together.' },
  { id: 'agent', kind: 'apps', title: 'Agent tools', color: '#65a30d',
    description: 'Community tools that extend what your agent can do.' },
  // Categories below stay out of browsing until an app is filed under one;
  // creators can pick them when they publish.
  { id: 'health', kind: 'apps', title: 'Health & fitness', color: '#ef4444',
    description: 'Workouts, sleep, food and feeling better.' },
  { id: 'photo', kind: 'apps', title: 'Photo & video', color: '#8b5cf6',
    description: 'Shoot, edit and organize pictures and clips.' },
  { id: 'audio', kind: 'apps', title: 'Music & audio', color: '#ec4899',
    description: 'Listen, record, podcast and make sound.' },
  { id: 'travel', kind: 'apps', title: 'Travel & places', color: '#0ea5e9',
    description: 'Plan trips, find places and get around.' },
  { id: 'home', kind: 'apps', title: 'Home & family', color: '#f59e0b',
    description: 'Run the house, plan meals and keep everyone in sync.' },
  { id: 'shopping', kind: 'apps', title: 'Shopping', color: '#14b8a6',
    description: 'Lists, deals and keeping track of what you buy.' },
  { id: 'utilities', kind: 'apps', title: 'Utilities', color: '#64748b',
    description: 'Small tools that do one job well.' },
  { id: 'developer', kind: 'apps', title: 'Build & run Möbius', color: '#7c5cf0',
    description: 'Official Möbius apps that shape how Möbius thinks, works, and evolves.' },
  { id: 'action', kind: 'games', title: 'Action', color: '#e11d48',
    description: 'Fast reflexes, arenas and boss fights.' },
  { id: 'puzzle', kind: 'games', title: 'Puzzle & brain', color: '#ca8a04',
    description: 'Quizzes, guessing games and things that make you think.' },
  { id: 'worlds', kind: 'games', title: 'Worlds', color: '#0891b2',
    description: 'Walk around, hang out and explore shared places.' },
  { id: 'music', kind: 'games', title: 'Music', color: '#c026d3',
    description: 'Play notes, make beats, chase the rhythm.' },
  { id: 'strategy', kind: 'games', title: 'Strategy', color: '#2563eb',
    description: 'Plan ahead, build up and outthink the other side.' },
  { id: 'racing', kind: 'games', title: 'Racing', color: '#f97316',
    description: 'Tracks, laps and beating the clock.' },
  { id: 'sports', kind: 'games', title: 'Sports', color: '#16a34a',
    description: 'Ball games, matches and tournaments.' },
  { id: 'board', kind: 'games', title: 'Cards & board', color: '#b45309',
    description: 'Card games, board games and tabletop classics.' },
  { id: 'adventure', kind: 'games', title: 'Adventure', color: '#0d9488',
    description: 'Stories, quests and places to discover.' },
  { id: 'word', kind: 'games', title: 'Word', color: '#7c3aed',
    description: 'Letters, spelling and word puzzles.' },
  { id: 'party', kind: 'games', title: 'Party & casual', color: '#db2777',
    description: 'Quick rounds to play with friends.' },
])
export const STORE_CATEGORY_IDS = Object.freeze(STORE_CATEGORIES.map(({ id }) => id))

export const EDITORIAL_COLLECTIONS = [
  { id: 'trending', title: 'Trending this week', description: 'Most new installs in the last 7 days.' },
  { id: 'most-downloaded', title: 'Most downloaded', description: 'Installed by the most people across Möbius.' },
  { id: 'picks', title: 'Our picks', description: 'Hand-picked by the Möbius team.' },
  { id: 'top-rated', title: 'Top rated', description: 'Highest rated by people who installed them.' },
  { id: 'updated', title: 'Recently updated', description: 'Creators shipping improvements.' },
  { id: 'arrivals', title: 'New arrivals', description: 'Freshly published, newest first.' },
  { id: 'uncategorized', title: 'More apps', description: 'Apps whose creators have not picked a category yet.' },
]
