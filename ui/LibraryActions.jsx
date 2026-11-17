import { ProgressFill } from './ProgressFill.jsx'

// Library's two bulk actions. Each lives in the tab it belongs to: Update all
// above the Updates list, Resolve all above the Needs you list.

export function UpdateAllButton({ count, state = 'idle', progress = null, disabled = false, onUpdateAll }) {
  if (!(count > 0) || !onUpdateAll) return null
  const label = state === 'checking'
    ? 'Checking…'
    : state === 'updating' && progress
    ? `Updating ${progress.current}/${progress.total}`
    : 'Update all'
  return (
    <button
      type="button"
      className="st-update-all-trigger"
      onClick={onUpdateAll}
      disabled={disabled || state !== 'idle'}
      aria-label={`Update all ${count} ${count === 1 ? 'app' : 'apps'}`}
    >
      <ProgressFill busy={state !== 'idle'} label={label}
        value={state === 'updating' && progress?.total ? progress.current / progress.total : null}>
        <span>{label}</span>
        <span className="st-update-all-count">{count}</span>
      </ProgressFill>
    </button>
  )
}

export function ResolveAllButton({ count, onResolveAll, disabled = false, state = 'idle' }) {
  if (!(count > 0) || !onResolveAll) return null
  return (
    <button
      type="button"
      className="st-update-all-trigger st-resolve-all-trigger"
      onClick={onResolveAll}
      disabled={disabled || state !== 'idle'}
      aria-label={`Fix all ${count} ${count === 1 ? 'app that needs you' : 'apps that need you'}`}
    >
      <span>{state === 'resolving' ? 'Starting…' : 'Fix all'}</span>
      {state === 'idle' ? <span className="st-update-all-count">{count}</span> : null}
    </button>
  )
}
