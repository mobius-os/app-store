import { MANIFEST_SNAPSHOTS } from './manifest-snapshots.js'
import CATALOG_REGISTRY from './catalog.json' with { type: 'json' }

// The checked-in registry is the sole authority for catalog membership and
// discovery copy. Generated manifest snapshots add only the version-coupled
// first-paint floor; install and update still resolve each live manifest URL.
export const CATALOG = CATALOG_REGISTRY.apps.map((entry) => ({

  ...entry,
  manifest: MANIFEST_SNAPSHOTS[entry.id] || null,
}))
// The Store fetches the same registry URL at mount so newly published entries
// can appear without a Store release. This checked-in import is its offline
// floor; the remote copy may be newer but never defines a second schema.
export const CATALOG_URL =
  'https://raw.githubusercontent.com/mobius-os/app-store/main/catalog.json'

// Human-facing release label for diagnostics. The Store's self-update banner
// uses verified source provenance, not this value, to decide availability.
export const STORE_VERSION = '1.18.0'
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
