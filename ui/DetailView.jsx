import { appLifecycleFor, busyLabelForAction, isTrustedHost, scheduleSummary } from '../domain.js'
import { CapabilityContract } from './CapabilityContract.jsx'
import { IconBox } from './IconBox.jsx'

function setupMetaText(setup, storeInstalled) {
  if (setup.scope === 'system') {
    return 'Configure platform providers and background agents in Settings'
  }
  return storeInstalled
    ? 'Configure inside the installed app'
    : 'Install first; setup appears on first open'
}

export function DetailView({ item, capabilityReview, onRetryCapabilityReview, installed, installedVersions, updateChecks = {}, onBack, onInstall, onUninstall, onOpenInstalled, onSetup, onRetryInstalled, busy, busyActionKind, updateNotice, onReviewUpdate, onDismissNotice, token, installedUnavailable = false, setupCompletions = {}, systemSetupReady = false }) {
  const m = capabilityReview?.preview?.manifest || item.manifest
  const reviewedItem = m === item.manifest ? item : { ...item, manifest: m }
  const lifecycle = appLifecycleFor(reviewedItem, {
    installed,
    installedVersions,
    updateChecks,
    updateNotice,
    installedUnavailable,
    setupCompletions,
    systemSetupReady,
  })
  const storeInstalled = lifecycle.installedApp
  const installedVer = lifecycle.installedVersion
  const hasUpdate = lifecycle.hasUpdate
  const blockedUpdate = lifecycle.key === 'conflict'
  const requiresCapabilityReview = !storeInstalled || hasUpdate
  const capabilityReviewReady = capabilityReview?.status === 'ready' || capabilityReview?.status === 'changed'
  const canRetryInstalled = typeof onRetryInstalled === 'function'
  const primaryActionDisabled =
    busy ||
    lifecycle.actionKind === 'none' ||
    (lifecycle.actionKind === 'open' && !storeInstalled) ||
    (lifecycle.actionKind === 'retry' && !canRetryInstalled) ||
    (lifecycle.actionKind === 'resolve' && !updateNotice) ||
    (requiresCapabilityReview && !capabilityReviewReady)
  // Soft warn for unfamiliar hosts (paste-a-URL flow). Catalog entries
  // already resolve to trusted hosts, so they pass silently. Invalid
  // URLs fall through to the warn path on purpose. This is now the
  // last checkpoint before install — there is no second confirm modal.
  const unfamiliarHost = item.manifest_url && !isTrustedHost(item.manifest_url)
  let warnHost = ''
  if (unfamiliarHost) {
    try { warnHost = new URL(item.manifest_url).hostname } catch { warnHost = item.manifest_url }
  }
  const scheduleText = capabilityReviewReady && capabilityReview.preview?.capability_contract?.background
    ? scheduleSummary({
        default: capabilityReview.preview.capability_contract.background.cron,
        job: capabilityReview.preview.capability_contract.background.job,
      })
    : ''
  const setup = item.setup?.required ? item.setup : null
  const showSetup = !!setup && (
    setup.scope === 'system'
      ? lifecycle.setupNeedsAttention
      : (!storeInstalled || lifecycle.setupNeedsAttention)
  )
  const canOpenSetup = showSetup && (setup.scope === 'system' || storeInstalled)

  // Use the same first-paint, browser-cacheable installed icon as the grid.
  const heroItemWithIcon = storeInstalled
    ? { ...item, installed_icon_url: `/api/apps/${storeInstalled.id}/icon?size=128` }
    : item

  return (
    <>
      <div className="st-detail-header">
        <button className="st-back-btn" onClick={onBack}>← Back</button>
      </div>
      <div className="st-scroll">
        <div className="st-hero">
          <IconBox item={heroItemWithIcon} size="hero" token={token} />
          <div className="st-hero-text">
            <h2 className="st-hero-name">{m.name}</h2>
            <div className="st-hero-meta">
              v{m.version}{m.author ? ` · ${m.author}` : ''}{m.license ? ` · ${m.license}` : ''}
            </div>
          </div>
        </div>

        <p className="st-detail-desc">{m.description}</p>

        {installedUnavailable && (
          <div className="st-notice is-warning st-notice-row" role="status">
            <span>Installed apps could not be refreshed. Install and update actions are paused until this reconnects.</span>
            <button
              type="button"
              className="st-btn st-btn-secondary st-notice-action"
              onClick={onRetryInstalled}
              disabled={busy || !canRetryInstalled}
            >
              Retry
            </button>
          </div>
        )}

        <div className="st-detail-section">
          <div className="st-section-label">Access and agent integration</div>
          <CapabilityContract
            review={capabilityReview}
            onRetry={onRetryCapabilityReview}
            isInstalled={!!storeInstalled}
          />
        </div>

        {scheduleText && (
          <div className="st-detail-section">
            <div className="st-section-label">Schedule</div>
            <div className="st-schedule-row">
              <div className="st-schedule-main">{scheduleText}</div>
              {capabilityReview.preview.capability_contract.background.user_configurable && (
                <div className="st-schedule-note">
                  Time is configurable from the app's settings after install.
                </div>
              )}
            </div>
          </div>
        )}

        {showSetup && (
          <div className="st-detail-section">
            <div className="st-section-label">Setup</div>
            <div className="st-setup-card">
              <div className="st-setup-main">
                {setup.label || (setup.scope === 'system' ? 'System setup required' : 'Setup required')}
              </div>
              {setup.description && (
                <div className="st-setup-note">{setup.description}</div>
              )}
              <div className="st-setup-bottom">
                <div className="st-setup-meta">{setupMetaText(setup, storeInstalled)}</div>
                {canOpenSetup && (
                  <button
                    type="button"
                    className="st-btn st-btn-secondary st-setup-action"
                    onClick={() => onSetup?.(item, storeInstalled)}
                    disabled={busy}
                  >
                    {setup.action || (setup.scope === 'system' ? 'Open Settings' : 'Open app')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {m.runtime?.esm_deps?.length > 0 && (
          <div className="st-detail-section">
            <div className="st-section-label">External libraries</div>
            <div className="st-esm-note">
              Loads {m.runtime.esm_deps.length === 1 ? 'one library' : `${m.runtime.esm_deps.length} libraries`}
              {' '}from esm.sh on first open. Fetched once and cached locally afterwards.
              <div className="st-esm-dep-list">{m.runtime.esm_deps.join(', ')}</div>
            </div>
          </div>
        )}

        {m.homepage && (
          <div className="st-detail-section">
            <div className="st-section-label">Source</div>
            <a href={m.homepage} target="_blank" rel="noopener noreferrer" className="st-link">
              {m.homepage}
            </a>
          </div>
        )}

        {storeInstalled && (
          <div className="st-detail-section">
            <div className="st-section-label">Installed</div>
            <div className="st-installed-note">
              Currently installed: {installedVer ? `v${installedVer}` : 'version unknown'}.
            </div>
            {updateNotice && (
              <div className="st-update-notice">
                <div>{updateNotice.message}</div>
                <div className="st-update-notice-actions">
                  <button
                    type="button"
                    className="st-btn st-btn-primary"
                    onClick={() => onReviewUpdate(updateNotice)}
                    disabled={busy}
                  >
                    {busy
                      ? busyLabelForAction('resolve')
                      : updateNotice.kind === 'conflict'
                      ? 'Resolve update'
                      : 'Review in chat'}
                  </button>
                  <button
                    type="button"
                    className="st-btn st-btn-secondary"
                    onClick={onDismissNotice}
                    disabled={busy}
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {unfamiliarHost && (
          <div className="st-detail-section">
            <div className="st-host-warn">
              <div className="st-host-warn-icon" aria-hidden="true">⚠</div>
              <div>
                <div>Unfamiliar host: <span className="st-host-warn-host">{warnHost}</span></div>
                <div className="st-host-warn-body">
                  You're installing from a host that isn't in the trusted
                  list. Continue only if you trust the author.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer action row. One button system (the canonical st-btn) across
          every state so the CTA never changes shape or colour family on a
          state flip — only its label:
          - not installed:            [ Install ]            (primary)
          - installed, up to date:    [ Open App ]           (primary)
          - installed, update ready:  [ Update to vX ]       (primary)
                                      [ Uninstall ]          (secondary)
          - update blocked (conflict):[ Resolve update ]     (primary)
          - app list fetch failed:    [ Retry ]              (primary)
          Install commits from this reviewed detail surface. Update opens the
          source-diff review first; only that review's Apply action mutates the
          installed app.
          The primary CTA holds a fixed min-height (via .st-btn) and the row
          reserves space for the secondary action, so the busy label swap
          ("Open App" -> "Updating…") never reflows the surrounding layout. */}
      <div className="st-detail-footer">
        <button
          className="st-btn st-btn-primary st-detail-cta"
          disabled={primaryActionDisabled}
          onClick={() => {
            if (primaryActionDisabled) return
            if (blockedUpdate) {
              onReviewUpdate(updateNotice)
              return
            }
            if (lifecycle.actionKind === 'retry') {
              onRetryInstalled?.()
              return
            }
            if (hasUpdate) onInstall(item, {
              isUpdate: true,
              existingId: storeInstalled.id,
              capabilityDigest: capabilityReview.preview.capability_digest,
            })
            else if (storeInstalled) onOpenInstalled(storeInstalled.id)
            else onInstall(item, {
              isUpdate: false,
              capabilityDigest: capabilityReview.preview.capability_digest,
            })
          }}
        >
          {busy ? busyLabelForAction(busyActionKind || lifecycle.actionKind)
            : requiresCapabilityReview && !capabilityReviewReady ? 'Reviewing access…'
            : blockedUpdate ? 'Resolve update'
            : lifecycle.actionKind === 'retry' ? 'Retry'
            : hasUpdate ? `Update to v${m.version}`
            : storeInstalled ? 'Open App'
            : lifecycle.actionLabel}
        </button>
        {storeInstalled && (
          <button
            className="st-btn st-btn-secondary st-detail-cta"
            onClick={() => onUninstall(storeInstalled)}
            disabled={busy}
          >
            Uninstall
          </button>
        )}
      </div>
    </>
  )
}
