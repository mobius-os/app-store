import { appLifecycleFor, busyLabelForAction, catalogCardDescription, catalogCategory, catalogPublisher, communityFeedbackOf, installsLabel, storeCategory } from '../domain.js'
import { ProgressFill } from './ProgressFill.jsx'
import { useEffect, useRef, useState } from 'react'
import { ArrowRotateCw, ArrowUpRight, Chat, Check, DotsVertical, Download, StarFilled } from '@openai/apps-sdk-ui/components/Icon'
import { IconBox, installedIconUrl } from './IconBox.jsx'

// The one primary action for an app wherever it is shown: install, open,
// update, retry or resolve. Cards, featured cards and the app page share it,
// together with what tapping the listing itself does (tapOpensApp), whether
// the listing keeps a visible button (showsButton) and whether it carries the
// installed seal (installed), so no surface decides those on its own.
// inLibrary marks the Library's own rows: the owner's shelf, where a ready
// installed app launches on tap and a saved app that is not installed yet
// keeps its Get button. Everywhere else a tap opens the app page.
export function appPrimaryAction(item, { installed, updateChecks = {}, installedUnavailable = false, setupCompletions = {}, systemSetupReady = false, onOpenInstalled, onReviewUpdate, onRetryInstalled, onUpdate, busy = false, blocked = false, busyActionKind = null, inLibrary = false }) {
  const lifecycle = appLifecycleFor(item, { installed, updateChecks, installedUnavailable, setupCompletions, systemSetupReady })
  const storeInstalled = lifecycle.installedApp
  const canOpen = !!storeInstalled && typeof onOpenInstalled === 'function'
  const actionable = lifecycle.actionKind !== 'none'
    && (lifecycle.actionKind !== 'open' || canOpen)
    && (lifecycle.actionKind !== 'retry' || typeof onRetryInstalled === 'function')
  const disabled = busy || blocked || !actionable
  const reviewLabel = lifecycle.actionKind === 'install' ? 'Install'
    : lifecycle.actionKind === 'update' ? 'Update' : lifecycle.actionLabel
  const shortLabel = lifecycle.actionKind === 'install' ? 'Get'
    : lifecycle.actionKind === 'open' ? 'Open' : reviewLabel
  const run = () => {
    if (disabled) return
    if (lifecycle.actionKind === 'open') return onOpenInstalled?.(storeInstalled.id)
    if (lifecycle.actionKind === 'resolve') return onReviewUpdate?.(lifecycle.resolutionNotice)
    if (lifecycle.actionKind === 'retry') return onRetryInstalled?.()
    return onUpdate?.(item, { isUpdate: lifecycle.actionKind === 'update' })
  }
  // In the Library, tapping a ready installed app launches it. Browse
  // surfaces open the app page, where its reviews, what's new and Uninstall
  // live. An update, conflict, retry or unfinished setup opens the page too,
  // so an old version never launches silently, and so does an app with its
  // own action in progress. Another app's install or update (blocked) does
  // not stop a launch.
  const tapOpensApp = inLibrary && canOpen && lifecycle.actionKind === 'open'
    && !lifecycle.setupNeedsAttention && !busy
  const launch = () => onOpenInstalled(storeInstalled.id)
  // Open is the Library row's tap and Get belongs to the app page, so only
  // maintenance actions (update, retry, resolve) and progress keep a button.
  const showsButton = busy || lifecycle.actionKind === 'update' || lifecycle.actionKind === 'retry'
    || lifecycle.actionKind === 'resolve' || (inLibrary && lifecycle.actionKind === 'install')
  return {
    lifecycle, storeInstalled, canOpen, disabled, run, reviewLabel, shortLabel,
    busyLabel: busy ? busyLabelForAction(busyActionKind || lifecycle.actionKind) : '',
    tapOpensApp, launch, showsButton, installed: !!storeInstalled,
  }
}

// The in-place progress bar an action button becomes while it works. Möbius
// reports stages, not bytes, so a running step is an indeterminate bar and a
// queued one waits; nothing invents a percentage.
export function progressStageFor(busyActionKind, updateStage) {
  if (busyActionKind === 'checking_update') return { stage: 'checking', label: 'Checking' }
  if (updateStage === 'queued') return { stage: 'waiting', label: 'Waiting' }
  if (busyActionKind === 'update' || busyActionKind === 'batch_update' || updateStage === 'applying') return { stage: 'running', label: 'Updating' }
  if (busyActionKind === 'uninstall') return { stage: 'running', label: 'Removing' }
  if (busyActionKind === 'open') return { stage: 'running', label: 'Opening' }
  if (busyActionKind === 'resolve' || busyActionKind === 'retry') return { stage: 'running', label: busyActionKind === 'retry' ? 'Retrying' : 'Opening' }
  return { stage: 'running', label: 'Installing' }
}

// A Library row keeps one visible action; Details and Review sit behind a
// small "More" menu, so a long list stays calm and every row reads the same.
export function RowMenu({ name, items }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (!wrapRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      wrapRef.current?.querySelector('.st-rowmenu-btn')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  if (!items.length) return null
  return (
    <div className="st-rowmenu" ref={wrapRef}>
      <button type="button" className="st-rowmenu-btn" aria-label={`More for ${name}`} aria-haspopup="menu"
        aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <DotsVertical width={18} height={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="st-rowmenu-pop" role="menu">
          {items.map(({ label, ariaLabel, run, danger }) => (
            <button key={label} type="button" role="menuitem" aria-label={ariaLabel} className={danger ? 'is-danger' : undefined}
              onClick={() => { setOpen(false); run() }}>{label}</button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

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
export function CatalogCard({ item, installed, updateChecks = {}, onPick, onRetry, onUpdate, onOpenInstalled, onRateApp, onUninstall, pickOpensApp = false, onRetryInstalled, busy, busyActionKind, blocked, error, onRetryError = null, onReviewUpdate, onAskAgentError, askingAgentAboutError = false, token, installedUnavailable = false, setupCompletions = {}, systemSetupReady = false, layout = 'grid', updateStage = null }) {
  const m = item.manifest

  if (!m) {
    // Manifest hasn't loaded (or failed). Two sub-states:
    //  - error → muted dashed border + a small "Try again" affordance
    //  - still loading → skeleton (handled at the grid level instead;
    //    this branch only runs after the load resolved with no manifest)
    if (item.error) {
      return (
        <div className={`${cardVariantClass('error')} is-loading-card`}>
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
      <div className={`${cardVariantClass('default')} is-loading-card`}>
        <div className="st-icon-wrap st-icon-wrap--letter">
          <span className="st-icon-letter">{item.id.charAt(0).toUpperCase()}</span>
        </div>
        <div className="st-card-name">{item.name || item.id}</div>
        <div className="st-card-version">loading…</div>
      </div>
    )
  }

  const primary = appPrimaryAction(item, {
    installed, updateChecks, installedUnavailable, setupCompletions, systemSetupReady,
    onOpenInstalled, onReviewUpdate, onRetryInstalled, onUpdate, busy, blocked, busyActionKind,
    inLibrary: pickOpensApp,
  })
  const { lifecycle, storeInstalled, tapOpensApp, showsButton } = primary
  const cardVariant = lifecycle.cardVariant
  const cardActionDisabled = primary.disabled
  const actionLabel = busy ? primary.busyLabel
    : layout === 'row' || layout === 'list' ? primary.shortLabel : primary.reviewLabel
  const ActionIcon = busy
    ? ArrowRotateCw
    : lifecycle.actionKind === 'install'
    ? Download
    : lifecycle.actionKind === 'update' || lifecycle.actionKind === 'retry'
    ? ArrowRotateCw
    : lifecycle.actionKind === 'resolve'
    ? Chat
    : ArrowUpRight
  // Routine lifecycle state is already carried by the one action and the
  // installed badge. Keep text only when it tells the owner about an actual
  // problem that the icon alone cannot explain.
  const showLifecycleStatus = ['unavailable', 'conflict', 'rejected', 'unverified'].includes(lifecycle.key)
  const onCardAction = primary.run

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
    <div className={`${cardVariantClass(cardVariant)}${layout === 'row' ? ' is-compact is-row' : layout === 'compact' ? ' is-compact' : layout === 'list' ? ' is-list' : layout === 'editorial' ? ' is-editorial-row' : ' is-catalog'}`}>
      <div className="st-icon-slot">
        <IconBox item={itemWithIcon} token={token} />
        {primary.installed ? <InstalledSeal /> : null}
      </div>
      <button
        type="button"
        className="st-card-open"
        onClick={() => (tapOpensApp ? primary.launch() : onPick(item))}
        aria-label={tapOpensApp ? `${m.name} — open app` : `${m.name} — open details`}
      >
        {m.name}
      </button>
      {(showLifecycleStatus || lifecycle.setupNeedsAttention || m.embeds_agent || item.community?.repository_update) && (
      <div className="st-card-state-row">
        {showLifecycleStatus ? (
          <div className={`st-card-state-line is-${lifecycle.key}`}>
            {lifecycle.statusLabel}
          </div>
        ) : null}
        {lifecycle.statusDetail ? (
          <div className="st-card-state-detail">{lifecycle.statusDetail}</div>
        ) : null}
        {lifecycle.setupNeedsAttention ? <span className="st-card-state-line">Setup needed</span> : null}
        {m.embeds_agent ? (
          <span className="st-card-agent" role="img" aria-label="Includes an agent" title="This app includes an in-app agent">Agent</span>
        ) : null}
        {item.community?.repository_update ? (
          <span className="st-card-source-update" title="The repository changed. Its next release has not been admitted yet.">
            Source changed
          </span>
        ) : null}
      </div>
      )}
      {description ? (
        <div className="st-card-desc">{description}</div>
      ) : null}
      {(layout === 'compact' || layout === 'list' || layout === 'row') ? (
        <CardByline item={item} state={layout === 'compact' || layout === 'row' ? lifecycle.cardVariant : ''} />
      ) : null}
      {/* A browse row opens the app page, which owns the one Get button; a
          ready installed app launches from its Library row. Maintenance
          actions stay, and Library rows keep their More menu. */}
      {layout === 'compact' || (!showsButton && !pickOpensApp) ? null : (
      <div className="st-card-status-row">
        {showsButton ? <button
          type="button"
          className={cardActionClass}
          disabled={cardActionDisabled}
          onClick={onCardAction}
          aria-label={`${actionLabel} ${m.name}`}
          title={actionLabel}
        >
          {(layout === 'compact' || layout === 'list' || layout === 'row')
            ? <ProgressFill busy={busy} label={progressStageFor(busyActionKind, updateStage).label}>{actionLabel}</ProgressFill>
            : <ActionIcon width={20} height={20} aria-hidden="true" />}
        </button> : null}
        {pickOpensApp ? (
          <RowMenu name={m.name} items={[
            { label: 'Details', ariaLabel: `${m.name} details`, run: () => onPick(item) },
            ...(layout === 'list' && storeInstalled && typeof onRateApp === 'function' && communityFeedbackOf(item)?.id
              ? [{ label: 'Review', ariaLabel: `Rate and review ${m.name}`, run: () => onRateApp(item) }]
              : []),
            // Library rows can be removed from where they are listed; the
            // confirmation step still asks first.
            ...(layout === 'list' && storeInstalled && typeof onUninstall === 'function'
              ? [{ label: 'Uninstall', ariaLabel: `Uninstall ${m.name}`, run: () => onUninstall(storeInstalled), danger: true }]
              : []),
          ]} />
        ) : null}
      </div>
      )}
      {error ? (
        <div className="st-card-inline-error" role="alert">
          <div className="st-card-inline-error-text">{error}</div>
          {onRetryError ? (
            // A transient failure: the same action may succeed now.
            <button
              type="button"
              className="st-btn st-btn-secondary st-card-inline-error-action"
              onClick={onRetryError}
              disabled={busy || blocked}
            >
              Try again
            </button>
          ) : onAskAgentError ? (
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

// The one installed marker: a small check seal on the app icon's corner.
// Rows carry no label, so it is the same at every width.
export function InstalledSeal() {
  return (
    <div className="st-installed-dot" aria-hidden="true">
      <div className="st-installed-dot-inner">
        <Check width={10} height={10} aria-hidden="true" />
      </div>
    </div>
  )
}

// One quiet line under a row: the app's category, its rating and installs when
// there are real numbers, whether it is installed, and who publishes it.
function CardByline({ item, state = '' }) {
  const category = storeCategory(catalogCategory(item))
  const feedback = communityFeedbackOf(item)
  const count = feedback?.rating_count || 0
  return (
    <div className="st-card-byline">
      {category ? (
        <span className="st-card-cat">{category.title}</span>
      ) : null}
      {count > 0 ? (
        <span className="st-card-rating" aria-label={`Rated ${Number(feedback.rating_average).toFixed(1)} out of 5 by ${count} ${count === 1 ? 'person' : 'people'}`}>
          <StarFilled width={11} height={11} aria-hidden="true" />{Number(feedback.rating_average).toFixed(1)}
        </span>
      ) : null}
      {installsLabel(item) ? <span className="st-card-installs">{installsLabel(item)}</span> : null}
      {state === 'update' ? <span className="st-card-installed is-update">Update available</span>
        : state === 'installed' ? <span className="st-card-installed">Installed</span>
          : <span className="st-card-publisher">{catalogPublisher(item)}</span>}
    </div>
  )
}
