// Loading placeholder in the shape of the page that is coming: the Spotlight
// and a shelf of rows for discovery, plain rows for Library, so nothing jumps
// when the catalog arrives.
function SkeletonRow() {
  return (
    <div className="st-skeleton-row" aria-hidden="true">
      <div className="st-skeleton-block st-skeleton-icon" />
      <div className="st-skeleton-lines">
        <div className="st-skeleton-block" style={{ width: '58%', height: '12px' }} />
        <div className="st-skeleton-block" style={{ width: '86%', height: '9px' }} />
        <div className="st-skeleton-block" style={{ width: '40%', height: '9px' }} />
      </div>
      <div className="st-skeleton-block st-skeleton-pill" />
    </div>
  )
}

export function CatalogSkeleton({ count = 6, layout = 'discover' }) {
  const rows = Array.from({ length: count }, (_, index) => <SkeletonRow key={index} />)
  if (layout === 'list') return <div className="st-skeleton-list">{rows}</div>
  return (
    <div className="st-skeleton-page" aria-hidden="true">
      <div className="st-skeleton-block st-skeleton-title" />
      <div className="st-skeleton-block st-skeleton-spotlight" />
      <div className="st-skeleton-block st-skeleton-title" />
      <div className="st-skeleton-shelf">{rows}</div>
    </div>
  )
}
