import { X } from '@openai/apps-sdk-ui/components/Icon'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'installed', label: 'Installed' },
  { id: 'update', label: 'Update' },
  { id: 'setup', label: 'Setup' },
]

export function CatalogFilters({
  query,
  category,
  filterCounts = {},
  totalCount,
  resultCount,
  onQueryChange,
  onCategoryChange,
  updateAllCount = 0,
  updateAllState = 'idle',
  updateAllProgress = null,
  updateAllDisabled = false,
  onUpdateAll,
  mode = 'browse',
}) {
  const selected = category || 'all'
  const updateAllLabel = updateAllState === 'checking'
    ? 'Checking…'
    : updateAllState === 'updating' && updateAllProgress
    ? `Updating ${updateAllProgress.current}/${updateAllProgress.total}`
    : 'Update all'
  return (
    <div className="st-discovery">
      <div className="st-search-row">
        <label className="st-search-label" htmlFor="st-catalog-search">Search</label>
        <input
          id="st-catalog-search"
          className="st-search-input"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search apps"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className="st-search-clear"
            aria-label="Clear search"
            onClick={() => onQueryChange('')}
          >
            <X width="1em" height="1em" aria-hidden="true" />
          </button>
        )}
        <div className="st-result-count" aria-live="polite">
          {resultCount === totalCount ? `${totalCount} apps` : `${resultCount} of ${totalCount}`}
        </div>
      </div>
      {mode === 'library' ? (
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
        </div>
      ) : null}
    </div>
  )
}
