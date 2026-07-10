import { categoryLabel } from '../domain.js'

const PINNED_FILTERS = [
  { id: 'updates-pending', label: 'Updates pending' },
]

export function CatalogFilters({
  query,
  category,
  categories = [],
  totalCount,
  resultCount,
  onQueryChange,
  onCategoryChange,
}) {
  const selected = category || 'all'
  const filters = [
    ...categories.map((id) => ({ id, label: categoryLabel(id) })),
    ...PINNED_FILTERS,
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
        <div className="st-result-count" aria-live="polite">
          {resultCount}/{totalCount}
        </div>
      </div>
      <div className="st-category-strip" aria-label="Catalog filters">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`st-chip${selected === filter.id ? ' is-active' : ''}`}
            aria-pressed={selected === filter.id}
            onClick={() => onCategoryChange(selected === filter.id ? 'all' : filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  )
}
