import { MANIFEST_SNAPSHOTS } from './manifest-snapshots.js'

// Curated catalog. Each entry points at a public mobius-os repo on
// the main branch. The web registry can carry embedded manifest snapshots for
// fast first paint; Browse only fetches manifest_url for entries whose registry
// snapshot is missing or invalid.
export const CATALOG = [
  // First screen priority: agent-facing utilities, then broad everyday apps,
  // then specialist and playful apps. Memory and Reflection are ordinary
  // installable apps, kept first because they explain the platform's agent loop.
  {
      id: 'memory',
      repo: 'mobius-os/app-memory',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/',
      categories: ['system', 'agents'],
      keywords: ['memory graph', 'memory maintenance', 'scheduled consolidation', 'notes', 'knowledge base', 'agent context'],
      capabilities: ['browse memory graph', 'scheduled memory consolidation', 'inspect knowledge links'],
      setup: {
        required: true,
        scope: 'system',
        section: 'background-agents',
        label: 'Background agent',
        description: 'Connect at least one AI provider and set a primary/fallback background model in Möbius Settings so Memory can run its scheduled consolidation.',
        fields: ['provider', 'model', 'fallback'],
      },
    },
  {
      id: 'reflection',
      repo: 'mobius-os/app-reflection',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-reflection/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-reflection/main/',
      categories: ['system', 'agents'],
      keywords: ['reflection', 'morning brief', 'overnight', 'system improvement', 'background agent'],
      capabilities: ['scheduled background run', 'writes morning briefs', 'proposes system improvements'],
      setup: {
        required: true,
        scope: 'system',
        section: 'background-agents',
        label: 'Background agent',
        description: 'Connect at least one AI provider and set a primary/fallback background model in Möbius Settings. Reflection can override it inside the app.',
        fields: ['provider', 'model', 'fallback'],
      },
    },
  {
      id: 'skills',
      repo: 'mobius-os/app-skills',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-skills/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-skills/main/',
      categories: ['system', 'agents'],
      keywords: ['skills', 'agent instructions', 'docs', 'procedures', 'playbooks'],
      capabilities: ['browse skills', 'read agent procedures', 'search instructions'],
    },
  {
      id: 'tasks',
      repo: 'mobius-os/app-tasks',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-tasks/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-tasks/main/',
      categories: ['productivity'],
      keywords: ['tasks', 'todo', 'projects', 'planning', 'checklist'],
      capabilities: ['manage tasks', 'organize projects', 'track status'],
    },
  {
      id: 'contribute',
      repo: 'mobius-os/app-contribute',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-contribute/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-contribute/main/',
      categories: ['development', 'system'],
      keywords: ['contribute', 'github', 'pull request', 'submit app', 'publish'],
      capabilities: ['prepare contributions', 'connect github', 'submit app changes'],
      setup: {
        required: true,
        scope: 'app',
        label: 'GitHub connection',
        description: 'Connect GitHub in the app before submitting or publishing contribution work.',
        fields: ['github'],
      },
    },
  {
      id: 'notes',
      repo: 'mobius-os/app-notes',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
      categories: ['writing', 'productivity'],
      keywords: ['notes', 'markdown', 'checklists', 'attachments', 'keep', 'pins'],
      capabilities: ['write markdown notes', 'preview while editing', 'attach images and files'],
    },
  {
      id: 'news',
      repo: 'mobius-os/app-news',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-news/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-news/main/',
      categories: ['information', 'agents'],
      keywords: ['news', 'daily digest', 'research', 'articles', 'curator', 'scheduled'],
      capabilities: ['scheduled digest', 'source research', 'custom editorial brief'],
      setup: {
        required: true,
        scope: 'app',
        label: 'Digest setup',
        description: 'Choose the topics, schedule, and primary/fallback model in the app before relying on scheduled reports.',
        fields: ['topics', 'schedule', 'provider', 'model', 'fallback'],
      },
    },
  {
      id: 'editor',
      repo: 'mobius-os/app-editor',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-editor/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-editor/main/',
      categories: ['development', 'writing'],
      keywords: ['editor', 'code', 'markdown', 'files', 'text'],
      capabilities: ['edit files', 'write markdown', 'preview content'],
    },
  {
      id: 'webstudio',
      repo: 'mobius-os/app-webstudio',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-webstudio/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-webstudio/main/',
      categories: ['development', 'creative'],
      keywords: ['webstudio', 'website', 'html', 'css', 'preview', 'builder'],
      capabilities: ['build web pages', 'preview projects', 'edit site files'],
    },
  {
      id: 'gym',
      repo: 'mobius-os/app-workout',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-workout/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-workout/main/',
      categories: ['health', 'productivity'],
      keywords: ['workout', 'gym', 'sets', 'exercises', 'progress', 'training'],
      capabilities: ['log workouts', 'track progress', 'plan routines'],
    },
  {
      id: 'habits',
      repo: 'mobius-os/app-habits',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-habits/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-habits/main/',
      categories: ['productivity', 'health'],
      keywords: ['habits', 'streaks', 'reminders', 'calendar', 'daily routine'],
      capabilities: ['track streaks', 'schedule reminders', 'view habit calendar'],
    },
  {
      id: 'beat-machine',
      repo: 'mobius-os/app-beat-machine',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-beat-machine/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-beat-machine/main/',
      categories: ['creative'],
      keywords: ['beats', 'sequencer', 'step sequencer', 'patterns', 'music', 'audio', 'recording', 'effects'],
      capabilities: ['sequence 32-step patterns', 'record custom sounds', 'adjust bpm and effects'],
    },
  {
      id: 'atlas',
      repo: 'mobius-os/app-atlas',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-atlas/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-atlas/main/',
      categories: ['reference'],
      keywords: ['atlas', 'map', 'globe', 'earth', 'countries', 'geography'],
      capabilities: ['explore globe', 'select countries', 'inspect geography'],
    },
  {
      id: 'latex',
      repo: 'mobius-os/app-latex',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-latex/main/',
      categories: ['writing', 'development'],
      keywords: ['latex', 'pdf', 'math', 'paper', 'resume', 'typesetting'],
      capabilities: ['edit latex', 'compile pdf', 'manage document files'],
    },
  {
      id: 'tandem',
      repo: 'mobius-os/app-tandem',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-tandem/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-tandem/main/',
      categories: ['learning', 'writing', 'agents'],
      keywords: ['language', 'reader', 'translation', 'bilingual', 'story', 'generation'],
      capabilities: ['generate bilingual stories', 'sync reading panes', 'highlight translations'],
      setup: {
        required: true,
        scope: 'app',
        label: 'Generation model',
        description: 'Pick the language pair, reading level, and generation model inside the app before creating stories.',
        fields: ['languages', 'level', 'provider', 'model'],
      },
    },
  {
      id: 'cuberun',
      repo: 'mobius-os/app-cuberun',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/',
      categories: ['games'],
      keywords: ['game', 'runner', 'cube', '3d', 'arcade'],
      capabilities: ['play arcade runner', 'render 3d scene'],
    },
].map((entry) => ({
  ...entry,
  manifest: MANIFEST_SNAPSHOTS[entry.id] || null,
}))
// Web registry: the store fetches this at mount (via the server proxy) and uses
// it as the catalog source when it parses to a non-empty list, so a NEW app
// appears in every instance's store the moment catalog.json lands on main — no
// store-app redeploy, no per-instance store update. The CATALOG above is the
// baked FALLBACK, used only if this fetch fails or returns nothing usable; keep
// the two in sync when you add an app. Entries are validated (id + https
// manifest_url/raw_base; optional manifest snapshots must carry the required
// manifest strings) before use — the install confirm's trusted-host check and
// the backend SSRF defenses remain the real security boundary.
export const CATALOG_URL =
  'https://raw.githubusercontent.com/mobius-os/app-store/main/catalog.json'

// The store's OWN version — keep in lockstep with mobius.json on each release.
// The store is bootstrapped separately from the catalog grid; it self-updates
// via the banner below: fetch its published manifest and, when that version is
// newer than what's running, offer a one-tap update (the same install
// transaction every other app uses) followed by a reload so the freshly-patched
// code loads.
export const STORE_VERSION = '1.11.1'
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
