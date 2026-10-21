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

// A stand-in for the platform's access_rows (backend app_consent.py, which
// owns the real wording): one row per enabled grant, enough to exercise the
// Store's mapping and pairing.
export function serverRows(contract) {
  if (!contract) return []
  const rows = Object.entries(contract.data || {})
    .filter(([, value]) => value === true)
    .map(([key]) => ({ id: key, title: `Use ${key}`, text: `Can use ${key}.`, level: null, rank: 1, critical: false }))
  for (const [capability, declaration] of Object.entries(contract.runtime || {})) {
    rows.push({ id: capability, title: declaration.title, text: declaration.description, level: null, rank: 1, critical: false })
  }
  if (contract.background) {
    rows.push({ id: 'background_job', title: 'Run a background job', text: `Runs ${contract.background.cron || 'on demand'}.`, level: null, rank: 1, critical: false })
  }
  if (Array.isArray(contract.data?.job_secret_read) && contract.data.job_secret_read.length) {
    rows.push({ id: 'job_secret_read', title: 'Read named secrets in its job', text: `Reads ${contract.data.job_secret_read.join(', ')}.`, level: null, rank: 1, critical: false })
  }
  if (contract.agent?.embeds_agent) {
    rows.push({ id: 'agent_start', title: 'Start agent chats on its own', text: 'Can start agent chats.', level: null, rank: 1, critical: false })
  }
  return rows
}

export function platformPreview(installed, candidate) {
  return {
    capability_digest: 'c'.repeat(64),
    installed_contract: installed,
    capability_contract: candidate,
    capability_diff: platformDiff(installed, candidate),
    access_rows: serverRows(candidate),
    installed_access_rows: serverRows(installed),
  }
}

