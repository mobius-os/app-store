export function CatalogSkeleton({ count = 5 }) {
  return (
    <div className="st-catalog-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="st-skeleton-card" aria-hidden="true">
          <div className="st-skeleton-block" style={{ width: '96px', height: '96px', borderRadius: '22px', marginBottom: '12px' }} />
          <div className="st-skeleton-block" style={{ width: '72%', height: '12px', marginBottom: '6px' }} />
          <div className="st-skeleton-block" style={{ width: '40%', height: '10px', marginBottom: '12px' }} />
          <div className="st-skeleton-block" style={{ width: '90%', height: '8px', marginBottom: '6px' }} />
          <div className="st-skeleton-block" style={{ width: '80%', height: '8px', marginBottom: '6px' }} />
          <div className="st-skeleton-block" style={{ width: '60%', height: '8px' }} />
        </div>
      ))}
    </div>
  )
}

// Pull a hostname out of a possibly-incomplete URL string. Returns ''
// for blank or unparseable input so the live badge can simply skip
// rendering instead of throwing.
