function permTagClass(level) {
  if (level === 'none' || level === 'no') return 'st-perm-tag is-muted'
  if (level === 'read') return 'st-perm-tag is-read'
  return 'st-perm-tag'
}

export function PermissionRow({ label, level, info }) {
  if (!info) return null
  return (
    <div className="st-permission-row" title={info.hint}>
      <div className="st-perm-row-main">
        <div className="st-perm-label">{label}</div>
        <div className="st-perm-detail">{info.summary}</div>
        <div className="st-perm-hint">
          {info.hint}
        </div>
      </div>
      <span className={permTagClass(level)}>{info.tag}</span>
    </div>
  )
}
