function row(label, tag, summary, tone = '') {
  return { label, tag, summary, tone }
}

function accessText(level, subject) {
  if (level === 'write') return `Can read and write ${subject}.`
  if (level === 'read') return `Can read ${subject}, but cannot change it.`
  return `Cannot access ${subject}.`
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
  const offline = contract.offline || {}
  const runtime = contract.runtime || {}
  const prompt = agent.system_prompt
  const logs = data.chat_logs || {}
  const rows = [
    prompt
      ? row(
          'Agent chats', 'All chats',
          `Adds system instructions to every agent chat on its next turn (${prompt.file}).`,
          'write',
        )
      : row('Agent chats', 'None', 'Does not add system instructions to agent chats.', 'muted'),
    logs.effective === 'summary'
      ? row(
          'Chat history', 'Redacted',
          'Can request structurally redacted chat text; tool calls, hidden reasoning, errors, and secret-like values are removed.',
          'read',
        )
      : row('Chat history', 'None', 'Cannot read chat history.', 'muted'),
    row(
      'Shared memory', data.shared_memory === 'write' ? 'Read + write' : data.shared_memory === 'read' ? 'Read' : 'None',
      accessText(data.shared_memory, 'the shared memory area'),
      data.shared_memory === 'none' ? 'muted' : data.shared_memory,
    ),
    row(
      'Other apps’ data', data.cross_app_access === 'write' ? 'Read + write' : data.cross_app_access === 'read' ? 'Read' : 'None',
      accessText(data.cross_app_access, 'other apps’ private data'),
      data.cross_app_access === 'none' ? 'muted' : data.cross_app_access,
    ),
    row(
      'Shares its data', data.share_with_apps === 'write' ? 'Read + write' : data.share_with_apps === 'read' ? 'Read' : 'None',
      data.share_with_apps === 'write'
        ? 'Allows authorized apps to read and change this app’s private data.'
        : data.share_with_apps === 'read'
        ? 'Allows authorized apps to read this app’s private data.'
        : 'Does not share its private data with other apps.',
      data.share_with_apps === 'none' ? 'muted' : data.share_with_apps,
    ),
  ]
  if (agent.embeds_agent) {
    rows.push(row(
      'Embedded agent', 'Included',
      'Mounts an agent chat inside the app experience.',
      'read',
    ))
  }
  if (background) {
    const timing = background.mode === 'scheduled'
      ? `Runs on schedule ${background.cron || ''}`.trim()
      : 'Runs only on demand'
    const init = background.initialize_on_install
      ? ' and starts an initialization run immediately after install'
      : ''
    const authority = background.authority === 'scoped_system_job'
      ? ' It is filesystem-confined to its reviewed data scope, can use the configured agent provider credentials, and receives an app token—not the owner token.'
      : ' It runs as a legacy host app process; the iframe and filesystem-API restrictions do not confine that process.'
    rows.push(row(
      'Background work', background.agent ? 'Scoped agent' : 'Host app job',
      `${timing}${init}.${authority}`,
      'write',
    ))
  } else {
    rows.push(row('Background work', 'None', 'Does not run a background job.', 'muted'))
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
  rows.push(
    offline.capable
      ? row(
          'Offline use', offline.contract?.execution || 'Declared',
          `Declares offline reads ${offline.contract?.reads ? 'available' : 'unavailable'}, writes ${offline.contract?.writes || 'none'}, and ${offline.contract?.execution || 'partial'} offline execution.`,
          'read',
        )
      : row('Offline use', 'None', 'Does not declare offline operation.', 'muted'),
  )
  return rows
}

export function changedCapabilityPaths(diff) {
  if (!diff || typeof diff !== 'object') return []
  return [...(diff.added || []), ...(diff.removed || []), ...(diff.changed || [])]
}

export function CapabilityContract({ review, onRetry, isInstalled = false }) {
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
  const changes = changedCapabilityPaths(preview?.capability_diff)
  const unknownPrevious = preview?.capability_diff?.unknown_previous === true
  return (
    <>
      {review.status === 'changed' && (
        <div className="st-notice is-warning" role="alert">
          {unknownPrevious
            ? 'This app was installed before access receipts were recorded, so the old and new access cannot be compared automatically. Nothing was installed. Review the complete access below.'
            : 'The publisher changed this app’s capabilities after your last review. Nothing was installed. Review the current access below, then click again.'}
        </div>
      )}
      {isInstalled && (changes.length > 0 || unknownPrevious) && (
        <div className="st-capability-change" role="status">
          {unknownPrevious
            ? 'This warning does not mean the update asked for new access; Möbius simply has no older receipt to compare against.'
            : `This update changes: ${changes.join(', ')}.`}
        </div>
      )}
      <div className="st-capability-list">
        {capabilityRows(preview?.capability_contract).map((item) => (
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
    </>
  )
}
