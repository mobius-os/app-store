import { appLifecycleFor, busyLabelForAction, catalogCardDescription } from '../domain.js'
import { Check } from '@openai/apps-sdk-ui/components/Icon'
import { IconBox, installedIconUrl } from './IconBox.jsx'

function cardVariantClass(variant) {
  if (variant === 'update') return 'st-card is-update'
  if (variant === 'conflict') return 'st-card is-conflict'
  if (variant === 'unavailable') return 'st-card is-unavailable'
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
export function CatalogCard({ item, installed, updateChecks = {}, onPick, onRetry, onUpdate, onOpenInstalled, onRetryInstalled, busy, busyActionKind, blocked, error, updateNotice, onReviewUpdate, onDismissNotice, onAskAgentError, askingAgentAboutError = false, token, installedUnavailable = false, setupCompletions = {}, systemSetupReady = false, selected = false, onSelectionToggle }) {
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
          <div className="st-card-name">{item.name || item.id}</div>
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
        <div className="st-card-name">{item.name || item.id}</div>
        <div className="st-card-version">loading…</div>
      </div>
    )
  }

  const lifecycle = appLifecycleFor(item, {
    installed,
    updateChecks,
    updateNotice,
    installedUnavailable,
    setupCompletions,
    systemSetupReady,
  })
  const storeInstalled = lifecycle.installedApp
  const cardVariant = lifecycle.cardVariant
  const canOpenInstalledApp = !!storeInstalled && typeof onOpenInstalled === 'function'
  const canRetryInstalled = typeof onRetryInstalled === 'function'
  const canResolveUpdate = lifecycle.actionKind !== 'resolve' || !!lifecycle.resolutionNotice
  const isActionable =
    lifecycle.actionKind !== 'none' &&
    (lifecycle.actionKind !== 'open' || canOpenInstalledApp) &&
    (lifecycle.actionKind !== 'retry' || canRetryInstalled) &&
    canResolveUpdate
  const cardActionDisabled = busy || blocked || !isActionable
  const canSelect = lifecycle.actionKind === 'install' && !installedUnavailable && !busy
  const showUpdateNotice = lifecycle.actionKind === 'resolve' &&
    updateNotice?.kind === 'conflict'
  const noticeDisabled = busy || blocked
  const reviewLabel = lifecycle.actionKind === 'install'
    ? 'Review & Install'
    : lifecycle.actionKind === 'update'
    ? 'Update'
    : lifecycle.actionLabel
  const actionLabel = busy ? busyLabelForAction(busyActionKind || lifecycle.actionKind) : reviewLabel
  const onCardAction = () => {
    if (cardActionDisabled) return
    if (lifecycle.actionKind === 'open') {
      onOpenInstalled?.(storeInstalled.id)
      return
    }
    if (lifecycle.actionKind === 'resolve') {
      onReviewUpdate?.(lifecycle.resolutionNotice)
      return
    }
    if (lifecycle.actionKind === 'retry') {
      onRetryInstalled?.()
      return
    }
    onUpdate?.(item, { isUpdate: lifecycle.actionKind === 'update' })
  }

  // The subtle hover/focus lift (translate + accent shadow/border) rides
  // CSS pseudo-classes via .st-card:has(.st-card-open:hover/:focus-visible)
  // — see the Card rules in CSS. The action button's variant + disabled
  // styling ride is-* / :disabled, not inline objects.
  const cardActionClass = cardVariant === 'update'
    ? 'st-card-action is-update'
    : cardVariant === 'conflict'
    ? 'st-card-action is-conflict'
    : cardVariant === 'unavailable'
    ? 'st-card-action is-unavailable'
    : cardVariant === 'installed'
    ? 'st-card-action is-installed'
    : 'st-card-action'

  // Installed icons are same-origin, downscaled, and browser-cacheable. IconBox
  // prioritises this URL over the remote catalog copy so it is available as an
  // image URL on the first render instead of popping in after an effect.
  const itemWithIcon = storeInstalled
    ? { ...item, installed_icon_url: installedIconUrl(storeInstalled) }
    : item
  const description = catalogCardDescription(item)
  // The card is a non-interactive container. Two cleanly-separated AT
  // targets sit inside it: the app name is a real <button> whose ::after
  // overlay stretches across the whole card to open details (so the icon /
  // description region is still tappable), and the action button rides a
  // z-index layer above that overlay so it stays independently clickable.
  // No nested role=button, no stopPropagation gymnastics.
  return (
    <div className={`${cardVariantClass(cardVariant)}${selected ? ' is-selected' : ''}`}>
      {canSelect ? (
        <label className="st-card-select" title={`Select ${m.name} for batch install`}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelectionToggle?.(item)}
            aria-label={`Select ${m.name} for batch install`}
          />
          <span aria-hidden="true">✓</span>
        </label>
      ) : null}
      <div className="st-icon-slot">
        <IconBox item={itemWithIcon} token={token} />
        {(cardVariant === 'installed' || cardVariant === 'update') && (
          <div className="st-installed-dot" aria-hidden="true">
            <div className={`st-installed-dot-inner${cardVariant === 'update' ? ' is-update' : ''}`}>
              <Check width={10} height={10} aria-hidden="true" />
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
      <div className="st-card-state-row">
        <div className={`st-card-state-line is-${lifecycle.key}`}>
          {lifecycle.statusLabel}
        </div>
        {m.embeds_agent ? (
          <span className="st-card-agent" title="This app includes an in-app agent">Agent</span>
        ) : null}
      </div>
      {description ? (
        <div className="st-card-desc">{description}</div>
      ) : null}
      <div className="st-card-status-row">
        <button
          type="button"
          className={cardActionClass}
          disabled={cardActionDisabled}
          onClick={onCardAction}
          aria-label={`${reviewLabel} ${m.name}`}
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
              className="st-btn st-btn-secondary"
              onClick={onDismissNotice}
              disabled={noticeDisabled}
            >
              Not now
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="st-card-inline-error" role="alert">
          <div className="st-card-inline-error-text">{error}</div>
          {onAskAgentError ? (
            <button
              type="button"
              className="st-btn st-btn-secondary st-card-inline-error-action"
              onClick={() => onAskAgentError(item, error)}
              disabled={askingAgentAboutError}
            >
              {askingAgentAboutError ? 'Opening agent…' : 'Ask agent'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
