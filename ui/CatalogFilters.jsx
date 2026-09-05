const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'installed', label: 'Installed' },
  { id: 'update', label: 'Update' },
  { id: 'setup', label: 'Setup' },
]

export function CatalogFilters({
  category,
  filterCounts = {},
  onCategoryChange,
  updateAllCount = 0,
  updateAllState = 'idle',
  updateAllProgress = null,
  updateAllDisabled = false,
  onUpdateAll,
  conflictCount = 0,
  onResolveAll,
  resolveAllDisabled = false,
  resolveAllState = 'idle',
  mode = 'browse',
}) {
  const selected = category || 'all'
  const updateAllLabel = updateAllState === 'checking'
    ? 'Checking…'
    : updateAllState === 'updating' && updateAllProgress
    ? `Updating ${updateAllProgress.current}/${updateAllProgress.total}`
    : 'Update all'
  const resolveAllLabel = resolveAllState === 'resolving' ? 'Starting…' : 'Resolve all'
  return (
    mode === 'library' ? (
      <div className="st-discovery">
        <div className="st-category-strip" aria-label="Library filters">
        {FILTERS.map((filter) => {
          const count = filterCounts[filter.id]
          return (
            <button
              key={filter.id}
              type="button"
              className={`st-chip${selected === filter.id ? ' is-active' : ''}`}
              aria-pressed={selected === filter.id}
              onClick={() => onCategoryChange(filter.id === 'all' || selected === filter.id ? 'all' : filter.id)}
            >
              <span>{filter.label}</span>
              {Number.isFinite(count) && count > 0 ? (
                <span className="st-chip-count">{count}</span>
              ) : null}
            </button>
          )
        })}
        {updateAllCount > 0 && onUpdateAll ? (
          <button
            type="button"
            className="st-update-all-trigger"
            onClick={onUpdateAll}
            disabled={updateAllDisabled || updateAllState !== 'idle'}
            aria-label={`Update all ${updateAllCount} ${updateAllCount === 1 ? 'app' : 'apps'}`}
          >
            <span>{updateAllLabel}</span>
            {updateAllState === 'idle' ? <span className="st-update-all-count">{updateAllCount}</span> : null}
          </button>
        ) : null}
        {conflictCount > 0 && onResolveAll ? (
          <button
            type="button"
            className="st-update-all-trigger st-resolve-all-trigger"
            onClick={onResolveAll}
            disabled={resolveAllDisabled || resolveAllState !== 'idle'}
            aria-label={`Resolve all ${conflictCount} ${conflictCount === 1 ? 'app with a conflict' : 'apps with conflicts'}`}
          >
            <span>{resolveAllLabel}</span>
            {resolveAllState === 'idle' ? <span className="st-update-all-count">{conflictCount}</span> : null}
          </button>
        ) : null}
        </div>
      </div>
    ) : null
  )
}
