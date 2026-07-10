import { CatalogCard } from './CatalogCard.jsx'

export function CatalogList({
  items,
  installed,
  installedVersions,
  onPick,
  onRetry,
  onUpdate,
  onOpenInstalled,
  onRetryInstalled,
  busy,
  busyItemId,
  errors,
  updateNotice,
  onReviewUpdate,
  onDismissNotice,
  token,
  installedUnavailable = false,
  emptyTitle = 'No apps',
  emptyText = 'No apps in the catalog yet.',
}) {
  if (items.length === 0) {
    return (
      <div className="st-empty">
        <div className="st-empty-title">{emptyTitle}</div>
        <p className="st-empty-text">{emptyText}</p>
      </div>
    )
  }
  const renderCard = (item) => (
    <CatalogCard
      key={item.id}
      item={item}
      installed={installed}
      installedVersions={installedVersions}
      onPick={onPick}
      onRetry={onRetry}
      onUpdate={onUpdate}
      onOpenInstalled={onOpenInstalled}
      onRetryInstalled={onRetryInstalled}
      busy={busyItemId === item.id}
      blocked={busy && busyItemId !== item.id}
      error={errors?.[item.id]}
      updateNotice={updateNotice?.itemId === item.id ? updateNotice : null}
      onReviewUpdate={onReviewUpdate}
      onDismissNotice={onDismissNotice}
      token={token}
      installedUnavailable={installedUnavailable}
    />
  )
  return (
    <div className="st-catalog-grid">{items.map(renderCard)}</div>
  )
}

// Skeleton grid shown while catalog manifests are being fetched. Same
// card footprint as the real grid, so the layout doesn't shift when
// manifests resolve. Per-block width/height stay inline (dynamic
// dimensions); the pulse animation lives in CSS.
