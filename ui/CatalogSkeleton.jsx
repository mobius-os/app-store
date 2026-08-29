export function CatalogSkeleton({ count = 5 }) {
  return (
    <div className="st-catalog-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="st-skeleton-card" aria-hidden="true">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <div className="st-skeleton-block" style={{ width: '52px', height: '52px', borderRadius: '13px', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="st-skeleton-block" style={{ width: '78%', height: '12px', marginBottom: '8px' }} />
              <div className="st-skeleton-block" style={{ width: '52%', height: '9px' }} />
            </div>
          </div>
          <div className="st-skeleton-block" style={{ width: '94%', height: '9px', marginTop: '12px' }} />
          <div className="st-skeleton-block" style={{ width: '76%', height: '9px', marginTop: '6px' }} />
          <div className="st-skeleton-block" style={{ width: '100%', height: '44px', borderRadius: '7px', marginTop: '12px' }} />
        </div>
      ))}
    </div>
  )
}

// Pull a hostname out of a possibly-incomplete URL string. Returns ''
// for blank or unparseable input so the live badge can simply skip
// rendering instead of throwing.
