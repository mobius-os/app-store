// Permission rows come from the platform (`access_rows` on every preview, built
// by the server's app_consent), so the Store carries no wording of its own for
// them and a new permission can never be missing here. What an app ships
// (instructions, skills, tools) is content, not permission wording, and is
// listed from the contract. `key` names one row stably across contract
// versions so an update review can pair the installed row with the proposed one.
const LEVEL_TAGS = {
  read: 'Read',
  write: 'Read + write',
  redacted: 'Redacted',
  'redacted+deleted': 'Redacted + deleted',
  apps: 'Other apps',
  public: 'Anyone',
}
const PROMPT_SCOPES = {
  all_agent_chats: ['All chats', 'every agent chat'],
  chats_started_while_installed: ['New chats', 'agent chats started while it is installed'],
}
const PROMPT_ACTIVATIONS = {
  next_turn: 'on its next turn',
  chat_start: 'when the chat starts',
}

function shippedRows(contract) {
  const agent = contract?.agent || {}
  const rows = []
  const prompt = agent.system_prompt
  if (prompt) {
    const [tag, chats] = PROMPT_SCOPES[prompt.scope] || ['Agent chats', `agent chats (scope ${prompt.scope})`]
    const when = PROMPT_ACTIVATIONS[prompt.activation] || `(activation ${prompt.activation})`
    rows.push({
      key: 'agent.system_prompt', label: 'Agent chats', tag,
      summary: `Adds system instructions to ${chats} ${when} (${prompt.file}).`,
    })
  }
  if (Array.isArray(agent.skills) && agent.skills.length) {
    rows.push({
      key: 'agent.skills', label: 'Bundled skills', tag: String(agent.skills.length),
      summary: `Installs ${agent.skills.join(', ')} while the app is active.`,
    })
  }
  // The platform rejects repeated tool names, so the name keys the row.
  for (const tool of Array.isArray(agent.tools) ? agent.tools : []) {
    if (!tool?.name) continue
    rows.push({
      key: `agent.tools:${tool.name}`, label: `Agent tool “${tool.name}”`, tag: 'Agent tool',
      summary: tool.description || 'Agents can call this app.',
    })
  }
  return rows
}

export function capabilityRows(accessRows, contract) {
  return [
    ...(Array.isArray(accessRows) ? accessRows : []).map(item => ({
      key: item.id, label: item.title, tag: LEVEL_TAGS[item.level] || '',
      summary: item.text, critical: Boolean(item.critical),
    })),
    ...shippedRows(contract),
  ]
}

export function changedCapabilityPaths(diff) {
  if (!diff || typeof diff !== 'object') return []
  return [...(diff.added || []), ...(diff.removed || []), ...(diff.changed || [])]
}

const rowText = item => (item.tag ? `${item.tag} · ${item.summary}` : item.summary)

// A readable summary of an update's access changes: the installed and
// proposed access rows paired by capability key, one Added, Removed or
// Changed row per capability whose words differ. It is only a summary; the
// review always lists every path the platform reports beside it.
export function capabilityChangeRows(preview) {
  if (preview?.capability_diff?.unknown_previous !== false || !preview.installed_contract) return []
  const before = new Map(capabilityRows(preview.installed_access_rows, preview.installed_contract).map(item => [item.key, item]))
  const after = new Map(capabilityRows(preview.access_rows, preview.capability_contract).map(item => [item.key, item]))
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

function CapabilityRows({ preview }) {
  // An older Möbius sends no rows; say so rather than claim nothing is requested.
  if (!Array.isArray(preview?.access_rows)) {
    return <div className="st-capability-state">Update Möbius to see what this app asks for.</div>
  }
  const rows = capabilityRows(preview.access_rows, preview.capability_contract)
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
          {item.tag ? <span className="st-perm-tag">{item.tag}</span> : null}
          {item.critical ? <span className="st-perm-critical" role="img" aria-label="Critical" title="Critical: can change your Möbius" /> : null}
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
          <CapabilityRows preview={preview} />
        </details>
      ) : <CapabilityRows preview={preview} />}
    </>
  )
}
