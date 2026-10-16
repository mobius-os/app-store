function row(label, tag, summary, tone = '') {
  return { label, tag, summary, tone }
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

export function capabilityRows(contract) {
  if (!contract || typeof contract !== 'object') return []
  const agent = contract.agent || {}
  const data = contract.data || {}
  const background = contract.background
  const runtime = contract.runtime || {}
  const prompt = agent.system_prompt
  const logs = data.chat_logs || {}
  const rows = []
  if (prompt) rows.push(row(
    'Agent chats', 'All chats',
    `Adds system instructions to every agent chat on its next turn (${prompt.file}).`,
    'write',
  ))
  if (logs.effective === 'summary') rows.push(row(
    'Chat history', 'Redacted',
    'Can request structurally redacted chat text; tool calls, hidden reasoning, errors, and secret-like values are removed.',
    'read',
  ))
  if (data.shared_memory === 'read' || data.shared_memory === 'write') rows.push(row(
    'Shared memory', data.shared_memory === 'write' ? 'Read + write' : 'Read',
    accessText(data.shared_memory, 'the shared memory area'),
    data.shared_memory,
  ))
  if (data.cross_app_access === 'read' || data.cross_app_access === 'write') rows.push(row(
    'Other apps’ data', data.cross_app_access === 'write' ? 'Read + write' : 'Read',
    accessText(data.cross_app_access, 'other apps’ private data'),
    data.cross_app_access,
  ))
  if (data.share_with_apps === 'read' || data.share_with_apps === 'write') rows.push(row(
    'Shares its data', data.share_with_apps === 'write' ? 'Read + write' : 'Read',
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
      'Background work', 'Server job',
      `${timing}${init}. It runs as reviewed owner-installed code with Möbius process access and receives a short-lived app token for API calls.`,
      'write',
    ))
  }
  if (Array.isArray(agent.skills) && agent.skills.length) {
    rows.push(row(
      'Agent skills', String(agent.skills.length),
      `Installs ${agent.skills.join(', ')} while the app is active.`,
      'read',
    ))
  }
  for (const capability of BOOLEAN_DATA_CAPABILITIES) {
    if (data[capability.key]) {
      rows.push(row(
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
        readableCapabilityKey(key) || 'Additional data grant',
        'Review',
        `The platform reports the unrecognized “${key}” data grant. Update App Store for a detailed explanation.`,
        'write',
      ))
    }
  }
  for (const [capability, declaration] of Object.entries(runtime).sort()) {
    const limits = declaration?.limits || {}
    const duration = Number(limits.max_duration_ms)
    const durationText = Number.isFinite(duration)
      ? ` for up to ${Math.round(duration / 100) / 10} seconds per request`
      : ''
    rows.push(row(
      declaration?.title || capability,
      `v${declaration?.version || '?'}`,
      `${declaration?.description || capability}${durationText}${
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

const MISSING = Symbol('missing')

function valueAtPath(contract, path) {
  let value = contract
  for (const part of String(path || '').split('.').filter(Boolean)) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return MISSING
    value = value[part]
  }
  return value
}

const PATH_LABELS = {
  'data.chat_logs': 'Chat history',
  'data.shared_memory': 'Shared memory',
  'data.cross_app_access': 'Other apps’ data',
  'data.share_with_apps': 'Shares its data',
  'agent.system_prompt': 'Agent chats',
  'agent.embeds_agent': 'Embedded agent',
  'agent.skills': 'Agent skills',
  ...Object.fromEntries(BOOLEAN_DATA_CAPABILITIES.map(capability => [`data.${capability.key}`, capability.label])),
}

function capabilityPathLabel(path, contract) {
  const parts = String(path || '').split('.').filter(Boolean)
  const label = PATH_LABELS[parts.slice(0, 2).join('.')]
  if (label) return label
  if (parts[0] === 'background') return 'Background work'
  if (parts[0] === 'runtime') return contract?.runtime?.[parts[1]]?.title || 'Runtime capability'
  return parts.map(readableCapabilityKey).join(' · ')
}

function capabilityValueText(value) {
  if (value === MISSING) return 'Not granted'
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'Allowed' : 'Not allowed'
  if (typeof value === 'string') return value || 'Not set'
  if (Array.isArray(value)) {
    if (!value.length) return 'None'
    return value.map(item => item && typeof item === 'object'
      ? String(item.id || item.name || JSON.stringify(item))
      : capabilityValueText(item)).join(', ')
  }
  return JSON.stringify(value)
}

// The platform's capability diff names changed paths only. The same preview
// carries the installed and proposed contracts, so an update review can show
// each change as its old and new value instead of an opaque path list.
export function capabilityChangeRows(preview) {
  const diff = preview?.capability_diff
  if (diff?.unknown_previous !== false) return []
  const previous = preview.installed_contract || {}
  const proposed = preview.capability_contract || {}
  return [['Added', diff.added], ['Removed', diff.removed], ['Changed', diff.changed]]
    .flatMap(([kind, paths]) => (Array.isArray(paths) ? paths : []).map(path => ({
      kind,
      path,
      label: capabilityPathLabel(path, proposed),
      previous: capabilityValueText(valueAtPath(previous, path)),
      proposed: capabilityValueText(valueAtPath(proposed, path)),
    })))
}

function CapabilityRows({ contract }) {
  const rows = capabilityRows(contract)
  return (
    <div className="st-capability-list">
      {rows.length === 0 && (
        <div className="st-capability-state">No special permissions requested.</div>
      )}
      {rows.map((item) => (
        <div className="st-permission-row" key={item.label}>
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
        <div className={`st-permission-row st-capability-diff-row is-${item.kind.toLowerCase()}`} key={`${item.kind}:${item.path}`}>
          <div className="st-perm-row-main">
            <div className="st-perm-label"><span className="st-capability-diff-kind">{item.kind}</span>{item.label}</div>
            <div className="st-capability-diff-values">
              <span>{item.previous}</span><span className="st-capability-diff-arrow" aria-hidden="true">→</span><span>{item.proposed}</span>
            </div>
            <div className="st-perm-hint">{item.path}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// `updateReview` is an update's pre-apply review: with a recorded previous
// contract it lists each access change with its old and new value and keeps
// the full resulting access one tap away. Elsewhere, and when no earlier
// record exists, the complete access is shown.
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
  const changeRows = updateReview ? capabilityChangeRows(preview) : []
  if (changeRows.length) {
    return (
      <>
        <CapabilityChangeRows rows={changeRows} />
        <details className="st-capability-full-access">
          <summary>Show full resulting access</summary>
          <CapabilityRows contract={preview.capability_contract} />
        </details>
      </>
    )
  }
  const changes = changedCapabilityPaths(preview?.capability_diff)
  return (
    <>
      {review.status === 'changed' && (
        <div className="st-notice is-warning" role="alert">
          {unknownPrevious
            ? 'This app was installed before access receipts were recorded, so the old and new access cannot be compared automatically. Nothing was installed. Review the complete access below.'
            : 'This version changes the app’s access. Review the permissions below before approving.'}
        </div>
      )}
      {isInstalled && (changes.length > 0 || unknownPrevious) && (
        <div className="st-capability-change" role="status">
          {unknownPrevious
            ? 'This warning does not mean the update asked for new access; Möbius simply has no older receipt to compare against.'
            : `This update changes: ${changes.join(', ')}.`}
        </div>
      )}
      <CapabilityRows contract={preview?.capability_contract} />
    </>
  )
}
