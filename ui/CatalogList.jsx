import { CatalogCard } from './CatalogCard.jsx'

export function CatalogList({ items, installed, installedVersions, onPick, onRetry, onUpdate, busy, busyItemId, errors, updateNotice, onReviewUpdate, onDismissNotice, token }) {
  if (items.length === 0) {
    return (
      <div className="st-empty">
        <p className="st-empty-text">No apps in the catalog yet.</p>
      </div>
    )
  }
  // Core apps (Memory / Reflection) ship with the platform — group them under
  // a "Built in" header, ahead of the store-installable apps. CATALOG already
  // lists the core entries first, so each partition keeps its catalog order.
  const renderCard = (item) => (
    <CatalogCard
      key={item.id}
      item={item}
      installed={installed}
      installedVersions={installedVersions}
      onPick={onPick}
      onRetry={onRetry}
      onUpdate={onUpdate}
      busy={busyItemId === item.id}
      blocked={busy && busyItemId !== item.id}
      error={errors?.[item.id]}
      updateNotice={updateNotice?.itemId === item.id ? updateNotice : null}
      onReviewUpdate={onReviewUpdate}
      onDismissNotice={onDismissNotice}
      token={token}
    />
  )
  const core = items.filter(it => it.core)
  const rest = items.filter(it => !it.core)
  return (
    <>
      {core.length > 0 && (
        <>
          <h2 className="st-section">Built in</h2>
          <div className="st-catalog-grid">{core.map(renderCard)}</div>
        </>
      )}
      {rest.length > 0 && (
        <>
          {core.length > 0 && <h2 className="st-section">Apps</h2>}
          <div className="st-catalog-grid">{rest.map(renderCard)}</div>
        </>
      )}
    </>
  )
}

// Skeleton grid shown while catalog manifests are being fetched. Same
// card footprint as the real grid, so the layout doesn't shift when
// manifests resolve. Per-block width/height stay inline (dynamic
// dimensions); the pulse animation lives in CSS.
