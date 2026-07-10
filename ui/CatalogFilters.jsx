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
}) {
  const selected = category || 'all'
  return (
    <div className="st-discovery">
      <div className="st-search-row">
        <label className="st-search-label" htmlFor="st-catalog-search">
          Search
        </label>
        <input
          id="st-catalog-search"
          className="st-search-input"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Find apps, tools, agents..."
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
            ×
          </button>
        )}
        <div className="st-result-count" aria-live="polite">
          {resultCount}/{totalCount}
        </div>
      </div>
      <div className="st-category-strip" aria-label="Catalog filters">
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
      </div>
    </div>
  )
}
