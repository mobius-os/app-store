import { CatalogCard } from './CatalogCard.jsx'

export function CatalogList({
  items,
  installed,
  installedVersions,
  updateChecks,
  onPick,
  onRetry,
  onUpdate,
  onOpenInstalled,
  onRetryInstalled,
  busy,
  busyItemId,
  busyActionKind,
  checkingUpdateItemId = null,
  errors,
  onAskAgentError,
  agentErrorItemId = null,
  updateNotice,
  onReviewUpdate,
  onDismissNotice,
  token,
  installedUnavailable = false,
  setupCompletions = {},
  systemSetupReady = false,
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
      updateChecks={updateChecks}
      onPick={onPick}
      onRetry={onRetry}
      onUpdate={onUpdate}
      onOpenInstalled={onOpenInstalled}
      onRetryInstalled={onRetryInstalled}
      busy={busyItemId === item.id || checkingUpdateItemId === item.id}
      busyActionKind={busyItemId === item.id
        ? busyActionKind
        : checkingUpdateItemId === item.id ? 'checking_update' : null}
      blocked={(busy && busyItemId !== item.id) ||
        (checkingUpdateItemId !== null && checkingUpdateItemId !== item.id)}
      error={errors?.[item.id]}
      onAskAgentError={onAskAgentError}
      askingAgentAboutError={agentErrorItemId === item.id}
      updateNotice={updateNotice?.itemId === item.id ? updateNotice : null}
      onReviewUpdate={onReviewUpdate}
      onDismissNotice={onDismissNotice}
      token={token}
      installedUnavailable={installedUnavailable}
      setupCompletions={setupCompletions}
      systemSetupReady={systemSetupReady}
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
