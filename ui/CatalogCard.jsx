import { findInstalled, installedVersionFor, semverCmp } from '../domain.js'
import { IconBox } from './IconBox.jsx'

function cardVariantClass(variant) {
  if (variant === 'update') return 'st-card is-update'
  if (variant === 'installed') return 'st-card is-installed'
  if (variant === 'error') return 'st-card is-error'
  return 'st-card'
}

// One catalog tile. The card is a non-interactive container; the open
// affordance is a real <button class="st-card-open"> (the app name) whose
// ::after overlay stretches over the card, and the action button is a
// sibling — two cleanly-separated AT targets, no nested role=button. The
// interactive lift (hover/focus) lives in CSS pseudo-classes via
// .st-card:has(.st-card-open:hover/:focus-visible), not JS state, so the
// grid no longer rerenders a tile on every pointer move.
export function CatalogCard({ item, installed, installedVersions, onPick, onRetry, onUpdate, busy, blocked, error, updateNotice, onReviewUpdate, onDismissNotice, token }) {
  const m = item.manifest

  if (!m) {
    // Manifest hasn't loaded (or failed). Two sub-states:
    //  - error → muted dashed border + a small "Try again" affordance
    //  - still loading → skeleton (handled at the grid level instead;
    //    this branch only runs after the load resolved with no manifest)
    if (item.error) {
      return (
        <div className={cardVariantClass('error')}>
          <div className="st-icon-wrap st-icon-wrap--letter" style={{ marginBottom: '12px' }}>
            <span className="st-icon-letter">{item.id.charAt(0).toUpperCase()}</span>
          </div>
          <div className="st-card-name">{item.id}</div>
          <div className="st-card-error-body">
            This app's manifest didn't load.
          </div>
          {onRetry && (
            <button
              className="st-card-retry"
              onClick={(e) => { e.stopPropagation(); onRetry(item) }}
            >
              Try again
            </button>
          )}
        </div>
      )
    }
    // Defensive — shouldn't render once skeletons land. Keep the slug
    // visible so a stuck card is still recognizable.
    return (
      <div className={cardVariantClass('default')}>
        <div className="st-icon-wrap st-icon-wrap--letter">
          <span className="st-icon-letter">{item.id.charAt(0).toUpperCase()}</span>
        </div>
        <div className="st-card-name">{item.id}</div>
        <div className="st-card-version">loading…</div>
      </div>
    )
  }

  // Match by manifest_url — the URL the app was installed from.
  // Slug is now pure routing (allocate_unique_slug on collision);
  // identity lives on manifest_url. A user-built app and a store-
  // installed app with the same slug coexist; the store can find
  // its own apps regardless of slug bumps.
  const storeInstalled = findInstalled(installed, item)
  const installedVer = installedVersionFor(item, installedVersions, storeInstalled)
  const hasUpdate = storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0
  // One footer action plus a card-level variant (border / installed-dot)
  // so the state is obvious before the user opens details.
  let statusLabel = 'Install'
  let cardVariant = 'default'
  if (item.core && hasUpdate) {
    // Platform core app with a newer published version — updatable in place.
    // It stays NON-uninstallable (see DetailView); the update keys on the
    // app's manifest identity, so the backend updates the existing row (no
    // dup), and install-core-apps skips store-managed apps so the deploy
    // re-sync won't fight it.
    statusLabel = 'Update'
    cardVariant = 'update'
  } else if (item.core) {
    // Platform core app, up to date — always present, never uninstallable.
    statusLabel = 'Built in'
    cardVariant = 'installed'
  } else if (storeInstalled && hasUpdate) {
    statusLabel = 'Update'
    cardVariant = 'update'
  } else if (storeInstalled) {
    statusLabel = 'Installed'
    cardVariant = 'installed'
  }
  const isActionable = cardVariant !== 'installed'
  const cardActionDisabled = busy || blocked || !isActionable
  const showUpdateNotice = updateNotice?.kind === 'conflict'
  const noticeDisabled = busy || blocked
  const actionLabel = busy
    ? cardVariant === 'update' ? 'Updating…' : 'Installing…'
    : statusLabel
  const onCardAction = () => {
    if (cardActionDisabled) return
    if (cardVariant === 'update') onUpdate?.(item)
    else onPick(item)
  }

  // The subtle hover/focus lift (translate + accent shadow/border) rides
  // CSS pseudo-classes via .st-card:has(.st-card-open:hover/:focus-visible)
  // — see the Card rules in CSS. The action button's variant + disabled
  // styling ride is-* / :disabled, not inline objects.
  const cardActionClass = cardVariant === 'update'
    ? 'st-card-action is-update'
    : cardVariant === 'installed'
    ? 'st-card-action is-installed'
    : 'st-card-action'

  // When the app is installed, use the raw transparent icon endpoint instead
  // of the external catalog URL — avoids the proxy round-trip and serves the
  // original PNG without any background flattening.
  const itemWithIcon = storeInstalled
    ? { ...item, installed_icon_url: `/api/apps/${storeInstalled.id}/icon` }
    : item

  // The card is a non-interactive container. Two cleanly-separated AT
  // targets sit inside it: the app name is a real <button> whose ::after
  // overlay stretches across the whole card to open details (so the icon /
  // version / desc region is still tappable), and the action button rides a
  // z-index layer above that overlay so it stays independently clickable.
  // No nested role=button, no stopPropagation gymnastics.
  return (
    <div className={cardVariantClass(cardVariant)}>
      <div className="st-icon-slot">
        <IconBox item={itemWithIcon} token={token} />
        {(cardVariant === 'installed' || cardVariant === 'update') && (
          <div className="st-installed-dot" aria-hidden="true">
            <div className={`st-installed-dot-inner${cardVariant === 'update' ? ' is-update' : ''}`}>
              ✓
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        className="st-card-open"
        onClick={() => onPick(item)}
        aria-label={`${m.name} — open details`}
      >
        {m.name}
      </button>
      <div className="st-card-version">
        v{m.version}
        {m.embeds_agent ? (
          <span className="st-card-agent" title="This app has a built-in agent">agent</span>
        ) : null}
      </div>
      {m.description ? (
        <div className="st-card-desc">{m.description}</div>
      ) : null}
      <div className="st-card-status-row">
        <button
          type="button"
          className={cardActionClass}
          disabled={cardActionDisabled}
          onClick={onCardAction}
          aria-label={
            cardVariant === 'update'
              ? `Update ${m.name} to v${m.version}`
              : cardVariant === 'installed'
              ? `${m.name} is installed`
              : `Review and install ${m.name}`
          }
        >
          {actionLabel}
        </button>
      </div>
      {showUpdateNotice ? (
        <div className="st-card-notice">
          <div>{updateNotice.message}</div>
          <div className="st-card-notice-actions">
            <button
              type="button"
              className="st-big-btn"
              onClick={() => onReviewUpdate(updateNotice)}
              disabled={noticeDisabled}
            >
              Reconcile & update
            </button>
            <button
              type="button"
              className="st-btn st-btn-secondary"
              onClick={onDismissNotice}
              disabled={noticeDisabled}
            >
              Not now
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="st-card-inline-error">{error}</div>
      ) : null}
    </div>
  )
}
