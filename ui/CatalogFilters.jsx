import { categoryLabel } from '../domain.js'

const PINNED_FILTERS = [
  { id: 'updates-pending', label: 'Updates' },
  { id: 'needs-setup', label: 'Needs setup' },
  { id: 'installed', label: 'Installed' },
]

export function CatalogFilters({
  query,
  category,
  categories = [],
  filterCounts = {},
  totalCount,
  resultCount,
  onQueryChange,
  onCategoryChange,
}) {
  const selected = category || 'all'
  const filters = [
    { id: 'all', label: 'All' },
    ...PINNED_FILTERS,
    ...categories.map((id) => ({ id, label: categoryLabel(id) })),
  ]
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
        {filters.map((filter) => {
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
