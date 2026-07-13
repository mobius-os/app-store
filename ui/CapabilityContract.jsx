function row(label, tag, summary, tone = '') {
  return { label, tag, summary, tone }
}

function accessText(level, subject) {
  if (level === 'write') return `Can read and write ${subject}.`
  if (level === 'read') return `Can read ${subject}, but cannot change it.`
  return `Cannot access ${subject}.`
}

export function capabilityRows(contract) {
  if (!contract || typeof contract !== 'object') return []
  const agent = contract.agent || {}
  const data = contract.data || {}
  const background = contract.background
  const offline = contract.offline || {}
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
  if (data.filesystem_api) {
    rows.push(row('Owner files', 'Access', 'Can use the guarded owner-filesystem API.', 'write'))
  }
  if (data.github_access) {
    rows.push(row('GitHub', 'Access', 'Can use the connected GitHub account.', 'write'))
  }
  if (data.manage_apps) {
    rows.push(row('Installed apps', 'Manages', 'Can install and uninstall apps.', 'write'))
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
  return (
    <>
      {review.status === 'changed' && (
        <div className="st-notice is-warning" role="alert">
          The publisher changed this app’s capabilities after your last review.
          Nothing was installed. Review the current access below, then click again.
        </div>
      )}
      {isInstalled && (changes.length > 0 || preview?.capability_diff?.unknown_previous) && (
        <div className="st-capability-change" role="status">
          {preview.capability_diff?.unknown_previous
            ? 'The installed version predates capability receipts; review the complete contract.'
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
