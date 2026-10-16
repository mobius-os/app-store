// `key` names one capability stably across contract versions, so an update
// review can pair the installed row with the proposed one.
function row(key, label, tag, summary, tone = '') {
  return { key, label, tag, summary, tone }
}

function accessText(level, subject) {
  if (level === 'write') return `Can read and write ${subject}.`
  return `Can read ${subject}, but cannot change it.`
}

// Boolean data capabilities belong in one disclosure registry. Keeping their
// owner-facing copy next to the contract key makes a newly introduced grant
// difficult to wire into the backend while accidentally hiding it in review.
const BOOLEAN_DATA_CAPABILITIES = [
  {
    key: 'filesystem_api',
    label: 'Owner files',
    tag: 'Access',
    summary: 'Can use the guarded owner-filesystem API.',
  },
  {
    key: 'github_access',
    label: 'GitHub data',
    tag: 'Access',
    summary: 'Can use the connected GitHub account.',
  },
  {
    key: 'github_connect',
    label: 'GitHub connection',
    tag: 'Manages',
    summary:
      'Can start, resume, refresh, cancel, or disconnect the owner’s GitHub connection.',
  },
  {
    key: 'manage_apps',
    label: 'Installed apps',
    tag: 'Manages',
    summary: 'Can install and uninstall apps.',
  },
  {
    key: 'manage_skills',
    label: 'Agent skills',
    tag: 'Manages',
    summary: 'Can install and remove agent skills.',
  },
]
const DISCLOSED_DATA_KEYS = new Set([
  'chat_logs',
  'shared_memory',
  'cross_app_access',
  'share_with_apps',
  ...BOOLEAN_DATA_CAPABILITIES.map(capability => capability.key),
])

function readableCapabilityKey(key) {
  return String(key || '')
    .split('_')
    .filter(Boolean)
    .map(word => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

function isActiveUnknownGrant(value) {
  return value !== false
    && value !== null
    && value !== undefined
    && value !== ''
    && value !== 'none'
}

function limitValueText(key, value) {
  if (!key.endsWith('_bytes') || !Number.isFinite(value)) return String(value)
  const units = ['bytes', 'KiB', 'MiB', 'GiB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1 }
  return `${Math.round(size * 10) / 10} ${units[unit]}`
}

const PROMPT_SCOPES = {
  all_agent_chats: ['All chats', 'every agent chat'],
  chats_started_while_installed: ['New chats', 'agent chats started while it is installed'],
}
const PROMPT_ACTIVATIONS = {
  next_turn: 'on its next turn',
  chat_start: 'when the chat starts',
}

export function capabilityRows(contract) {
  if (!contract || typeof contract !== 'object') return []
  const agent = contract.agent || {}
  const data = contract.data || {}
  const background = contract.background
  const runtime = contract.runtime || {}
  const prompt = agent.system_prompt
  const logs = data.chat_logs || {}
  const rows = []
  if (prompt) {
    const [tag, chats] = PROMPT_SCOPES[prompt.scope] || ['Agent chats', `agent chats (scope ${prompt.scope})`]
    const when = PROMPT_ACTIVATIONS[prompt.activation] || `(activation ${prompt.activation})`
    rows.push(row(
      'agent.system_prompt', 'Agent chats', tag,
      `Adds system instructions to ${chats} ${when} (${prompt.file}).`,
      'write',
    ))
  }
  if (logs.effective === 'summary' || logs.effective === 'summary_with_deleted') rows.push(row(
    'data.chat_logs', 'Chat history', 'Redacted',
    `Can request structurally redacted chat text${logs.effective === 'summary_with_deleted' ? ', including recoverable deleted chats' : ''}; tool calls, hidden reasoning, errors, and secret-like values are removed.`,
    'read',
  ))
  if (data.shared_memory === 'read' || data.shared_memory === 'write') rows.push(row(
    'data.shared_memory', 'Shared memory', data.shared_memory === 'write' ? 'Read + write' : 'Read',
    accessText(data.shared_memory, 'the shared memory area'),
    data.shared_memory,
  ))
  if (data.cross_app_access === 'read' || data.cross_app_access === 'write') rows.push(row(
    'data.cross_app_access', 'Other apps’ data', data.cross_app_access === 'write' ? 'Read + write' : 'Read',
    accessText(data.cross_app_access, 'other apps’ private data'),
    data.cross_app_access,
  ))
  if (data.share_with_apps === 'read' || data.share_with_apps === 'write') rows.push(row(
    'data.share_with_apps', 'Shares its data', data.share_with_apps === 'write' ? 'Read + write' : 'Read',
    data.share_with_apps === 'write'
      ? 'Allows authorized apps to read and change this app’s private data.'
      : 'Allows authorized apps to read this app’s private data.',
    data.share_with_apps,
  ))
  if (background) {
    const timing = background.mode === 'scheduled'
      ? `Runs on schedule ${background.cron || ''}`.trim()
      : 'Runs only on demand'
    const init = background.initialize_on_install
      ? ' and starts an initialization run immediately after install'
      : ''
    rows.push(row(
      'background', 'Background work', 'Server job',
      `${timing}${init}. It runs as reviewed owner-installed code with Möbius process access and receives a short-lived app token for API calls.`,
      'write',
    ))
  }
  if (Array.isArray(agent.skills) && agent.skills.length) {
    rows.push(row(
      'agent.skills', 'Bundled skills', String(agent.skills.length),
      `Installs ${agent.skills.join(', ')} while the app is active.`,
      'read',
    ))
  }
  // The platform rejects repeated tool names, so the name keys the row.
  for (const tool of Array.isArray(agent.tools) ? agent.tools : []) {
    if (!tool?.name) continue
    rows.push(row(
      `agent.tools:${tool.name}`, `Agent tool “${tool.name}”`, 'Agent tool',
      tool.description || 'Agents can call this app.', 'read',
    ))
  }
  for (const capability of BOOLEAN_DATA_CAPABILITIES) {
    if (data[capability.key]) {
      rows.push(row(
        `data.${capability.key}`,
        capability.label,
        capability.tag,
        capability.summary,
        'write',
      ))
    }
  }
  // Platform and App Store can ship independently. Never hide a newly added
  // data grant just because this Store version lacks its polished copy.
  for (const [key, value] of Object.entries(data).sort()) {
    if (!DISCLOSED_DATA_KEYS.has(key) && isActiveUnknownGrant(value)) {
      rows.push(row(
        `data.${key}`,
        readableCapabilityKey(key) || 'Additional data grant',
        'Review',
        `The platform reports the unrecognized “${key}” data grant. Update App Store for a detailed explanation.`,
        'write',
      ))
    }
  }
  for (const [capability, declaration] of Object.entries(runtime).sort()) {
    const { max_duration_ms: maxDuration, ...otherLimits } = declaration?.limits || {}
    const duration = Number(maxDuration)
    const durationText = Number.isFinite(duration)
      ? ` for up to ${Math.round(duration / 100) / 10} seconds per request`
      : ''
    // Every other reviewed limit is listed too, so raising one is visible.
    const limitsText = Object.keys(otherLimits).length
      ? ` Limits: ${Object.entries(otherLimits).sort().map(([key, value]) => `${key} ${limitValueText(key, value)}`).join(', ')}.`
      : ''
    rows.push(row(
      `runtime.${capability}`,
      declaration?.title || capability,
      `v${declaration?.version || '?'}`,
      `${declaration?.description || capability}${durationText}${limitsText}${
        declaration?.reason ? ` Reason: ${declaration.reason}` : ''
      }`,
      declaration?.risk === 'device' ? 'write' : 'read',
    ))
  }
  return rows
}

export function changedCapabilityPaths(diff) {
  if (!diff || typeof diff !== 'object') return []
  return [...(diff.added || []), ...(diff.removed || []), ...(diff.changed || [])]
}

const rowText = item => `${item.tag} · ${item.summary}`

// A readable summary of an update's access changes: the installed and
// proposed access rows paired by capability key, one Added, Removed or
// Changed row per capability whose words differ. It is only a summary; the
// review always lists every path the platform reports beside it.
export function capabilityChangeRows(preview) {
  if (preview?.capability_diff?.unknown_previous !== false || !preview.installed_contract) return []
  const before = new Map(capabilityRows(preview.installed_contract).map(item => [item.key, item]))
  const after = new Map(capabilityRows(preview.capability_contract).map(item => [item.key, item]))
  const rows = []
  for (const [key, next] of after) {
    const prior = before.get(key)
    if (!prior) rows.push({ kind: 'Added', key, label: next.label, proposed: rowText(next) })
    else if (rowText(prior) !== rowText(next)) {
      rows.push({ kind: 'Changed', key, label: next.label, previous: rowText(prior), proposed: rowText(next) })
    }
  }
  for (const [key, prior] of before) {
    if (!after.has(key)) rows.push({ kind: 'Removed', key, label: prior.label, previous: rowText(prior) })
  }
  return rows
}

function CapabilityRows({ contract }) {
  const rows = capabilityRows(contract)
  return (
    <div className="st-capability-list">
      {rows.length === 0 && (
        <div className="st-capability-state">No special permissions requested.</div>
      )}
      {rows.map((item) => (
        <div className="st-permission-row" key={item.key}>
          <div className="st-perm-row-main">
            <div className="st-perm-label">{item.label}</div>
            <div className="st-perm-detail">{item.summary}</div>
          </div>
          <span className={`st-perm-tag${item.tone === 'muted' ? ' is-muted' : item.tone === 'read' ? ' is-read' : ''}`}>
            {item.tag}
          </span>
        </div>
      ))}
    </div>
  )
}

function CapabilityChangeRows({ rows }) {
  return (
    <div className="st-capability-list" aria-label="Access changes">
      {rows.map(item => (
        <div className={`st-permission-row st-capability-diff-row is-${item.kind.toLowerCase()}`} key={item.key}>
          <div className="st-perm-row-main">
            <div className="st-perm-label"><span className="st-capability-diff-kind">{item.kind}</span>{item.label}</div>
            <div className="st-capability-diff-values">
              {item.previous ? <span className={item.proposed ? 'st-capability-diff-before' : undefined}>{item.previous}</span> : null}
              {item.previous && item.proposed ? <span className="st-capability-diff-arrow" aria-hidden="true">→</span> : null}
              {item.proposed ? <span>{item.proposed}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// `updateReview` is an update's pre-apply review: with a recorded previous
// contract it summarises each changed capability, old and new, beside the
// full list of changed paths, and keeps the full resulting access one tap
// away. Elsewhere, and when no earlier record exists, the complete access is
// shown with the changed paths.
export function CapabilityContract({ review, onRetry, isInstalled = false, updateReview = false }) {
  if (!review || review.status === 'loading') {
    return (
      <div className="st-capability-state" role="status">
        Checking the app’s live capabilities…
      </div>
    )
  }
  if (review.status === 'error') {
    return (
      <div className="st-notice is-warning st-notice-row" role="alert">
        <span>{review.error || 'Capabilities could not be checked.'}</span>
        <button type="button" className="st-btn st-btn-secondary st-notice-action" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }
  const preview = review.preview
  const unknownPrevious = preview?.capability_diff?.unknown_previous === true
  // `refused`: an install or update was refused because access changed after
  // review, so nothing was installed. `changed`: a review of a release whose
  // access differs from what is installed.
  const notice = review.status === 'refused'
    ? `${!isInstalled
      ? 'This app’s access changed after your review.'
      : unknownPrevious
        ? 'This app was installed before access receipts were recorded, so the old and new access cannot be compared automatically.'
        : 'The publisher changed this app’s capabilities after your last review.'} Nothing was installed. Review the current access below, then click again.`
    : review.status === 'changed'
      ? unknownPrevious
        ? 'Möbius has no earlier access record for this app, so the old and new access cannot be compared automatically. Review the complete access below.'
        : 'This version changes the app’s access. Review the permissions below before approving.'
      : ''
  const changeRows = updateReview ? capabilityChangeRows(preview) : []
  const paths = changedCapabilityPaths(preview?.capability_diff)
  return (
    <>
      {notice ? <div className="st-notice is-warning" role="alert">{notice}</div> : null}
      {changeRows.length ? <CapabilityChangeRows rows={changeRows} /> : null}
      {isInstalled && (paths.length > 0 || unknownPrevious) && (
        <div className="st-capability-change" role="status">
          {unknownPrevious
            ? 'This warning does not mean the update asked for new access; Möbius simply has no older receipt to compare against.'
            : `This update changes: ${paths.join(', ')}.`}
        </div>
      )}
      {changeRows.length ? (
        <details className="st-capability-full-access">
          <summary>Show full resulting access</summary>
          <CapabilityRows contract={preview.capability_contract} />
        </details>
      ) : <CapabilityRows contract={preview?.capability_contract} />}
    </>
  )
}
