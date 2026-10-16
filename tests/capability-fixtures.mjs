// Capability contracts and diffs shaped like the platform's own
// contract_from_manifest and diff_contracts (backend app_capabilities.py), so
// review tests see the real leaf paths, including dotted runtime ids.

export const MICROPHONE = {
  version: 1, kind: 'session', title: 'Record audio',
  description: 'Use the device microphone while this app is visible.',
  risk: 'device', lifecycle: 'active_frame', reason: 'Voice notes',
  limits: { max_duration_ms: 30_000 },
}

export const ASSET_CACHE = {
  version: 1, kind: 'session', title: 'Store large files on this device',
  description: 'Download verified app assets into this browser’s private storage.',
  risk: 'storage', lifecycle: 'active_frame', reason: null,
  limits: { max_bytes: 256 * 1024 * 1024 },
}

export function platformContract({ tools = [], skills = [], data = {}, runtime = {}, embedsAgent = false, network = [], systemPrompt = null, background = null } = {}) {
  return {
    schema: 1,
    agent: { system_prompt: systemPrompt, skills, embeds_agent: embedsAgent, tools },
    data: {
      chat_logs: { requested: 'none', effective: 'none', redaction: 'none' },
      filesystem_api: false, shared_memory: 'none', cross_app_access: 'none', share_with_apps: 'none',
      manage_apps: false, manage_skills: false, github_access: false, github_connect: false,
      connections_manage: false, connect_manage: false, identity_manage: false, railway_manage: false,
      ...data,
    },
    background,
    offline: { capable: false, contract: null },
    runtime,
    public: { network, storage: { read: false, write_prefix: null } },
  }
}

function leaves(value, prefix = '', out = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value).sort()) leaves(value[key], prefix ? `${prefix}.${key}` : key, out)
  } else out[prefix] = value
  return out
}

// diff_contracts over the semantic projection: schema and offline dropped,
// closed values (false, null, empty lists) pruned.
function semantic(contract) {
  const { schema, offline, ...rest } = structuredClone(contract)
  if (rest.data?.chat_logs) delete rest.data.chat_logs.redaction
  const prune = value => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const kept = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, prune(item)]).filter(([, item]) => item !== undefined))
      return Object.keys(kept).length ? kept : undefined
    }
    if (value === false || value === null || (Array.isArray(value) && !value.length)) return undefined
    return value
  }
  return prune(rest) || {}
}

export function platformDiff(installed, candidate) {
  const before = leaves(semantic(installed))
  const after = leaves(semantic(candidate))
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  return {
    unknown_previous: false,
    widens: true,
    added: Object.keys(after).filter(key => !(key in before)).sort(),
    removed: Object.keys(before).filter(key => !(key in after)).sort(),
    changed: Object.keys(before).filter(key => key in after && !same(before[key], after[key])).sort(),
  }
}

export function platformPreview(installed, candidate) {
  return {
    capability_digest: 'c'.repeat(64),
    installed_contract: installed,
    capability_contract: candidate,
    capability_diff: platformDiff(installed, candidate),
  }
}

// The review invariant: every path the platform reports lies under a row the
// review shows as changed, or is listed by path.
export function hiddenPaths(preview, { rows, otherPaths }) {
  const slices = rows.map(row => row.key.split(':')[0])
  return preview.capability_diff.added.concat(preview.capability_diff.removed, preview.capability_diff.changed)
    .filter(path => !otherPaths.includes(path) && !slices.some(slice => path === slice || path.startsWith(`${slice}.`)))
}
