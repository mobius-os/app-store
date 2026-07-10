import { PERM_EXPLAIN } from '../constants.js'
import { appLifecycleFor, isTrustedHost, scheduleSummary } from '../domain.js'
import { IconBox } from './IconBox.jsx'
import { PermissionRow } from './PermissionRow.jsx'

function detailBusyLabel(actionKind) {
  if (actionKind === 'update') return 'Updating...'
  if (actionKind === 'retry') return 'Retrying...'
  if (actionKind === 'resolve') return 'Opening chat...'
  if (actionKind === 'open') return 'Opening...'
  return 'Installing...'
}

function setupMetaText(setup, storeInstalled) {
  if (setup.scope === 'system') {
    return 'Configure platform providers and background agents in Settings'
  }
  return storeInstalled
    ? 'Configure inside the installed app'
    : 'Install first; setup appears on first open'
}

export function DetailView({ item, installed, installedVersions, onBack, onInstall, onUninstall, onOpenInstalled, onSetup, onRetryInstalled, busy, updateNotice, onReviewUpdate, onDismissNotice, token, installedUnavailable = false, setupCompletions = {}, systemSetupReady = false }) {
  const m = item.manifest
  const lifecycle = appLifecycleFor(item, {
    installed,
    installedVersions,
    updateNotice,
    installedUnavailable,
    setupCompletions,
    systemSetupReady,
  })
  const storeInstalled = lifecycle.installedApp
  const installedVer = lifecycle.installedVersion
  const hasUpdate = lifecycle.hasUpdate
  const blockedUpdate = lifecycle.key === 'conflict'
  const canRetryInstalled = typeof onRetryInstalled === 'function'
  const primaryActionDisabled =
    busy ||
    lifecycle.actionKind === 'none' ||
    (lifecycle.actionKind === 'open' && !storeInstalled) ||
    (lifecycle.actionKind === 'retry' && !canRetryInstalled) ||
    (lifecycle.actionKind === 'resolve' && !updateNotice)
  const ca = m.permissions?.cross_app_access || 'none'
  const sw = m.permissions?.share_with_apps || 'none'
  const ma = !!m.permissions?.manage_apps
  // Soft warn for unfamiliar hosts (paste-a-URL flow). Catalog entries
  // already resolve to trusted hosts, so they pass silently. Invalid
  // URLs fall through to the warn path on purpose. This is now the
  // last checkpoint before install — there is no second confirm modal.
  const unfamiliarHost = item.manifest_url && !isTrustedHost(item.manifest_url)
  let warnHost = ''
  if (unfamiliarHost) {
    try { warnHost = new URL(item.manifest_url).hostname } catch { warnHost = item.manifest_url }
  }
  const scheduleText = scheduleSummary(m.schedule)
  const setup = item.setup?.required ? item.setup : null
  const showSetup = !!setup && (
    setup.scope === 'system'
      ? lifecycle.setupNeedsAttention
      : (!storeInstalled || lifecycle.setupNeedsAttention)
  )
  const canOpenSetup = showSetup && (setup.scope === 'system' || storeInstalled)

  // When the app is installed, serve the raw transparent icon from the
  // same-origin API route rather than the external catalog source. Avoids the
  // proxy round-trip and ensures the icon's original transparency is preserved.
  const heroItemWithIcon = storeInstalled
    ? { ...item, installed_icon_url: `/api/apps/${storeInstalled.id}/icon` }
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
          <div className="st-section-label">What this app can do</div>
          <PermissionRow
            label="Other apps' data"
            level={ca}
            info={PERM_EXPLAIN.cross_app_access[ca]}
          />
          <PermissionRow
            label="Sharing with other apps"
            level={sw}
            info={PERM_EXPLAIN.share_with_apps[sw]}
          />
          {('manage_apps' in (m.permissions || {})) && (
            <PermissionRow
              label="Install authority"
              level={ma ? 'yes' : 'no'}
              info={PERM_EXPLAIN.manage_apps[String(ma)]}
            />
          )}
        </div>

        {scheduleText && (
          <div className="st-detail-section">
            <div className="st-section-label">Schedule</div>
            <div className="st-schedule-row">
              <div className="st-schedule-main">{scheduleText}</div>
              {m.schedule.user_configurable && (
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
                    {updateNotice.kind === 'conflict'
                      ? 'Resolve update'
                      : busy
                      ? 'Opening chat...'
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
          The Install/Update button commits directly — there is no second
          confirm modal. DetailView is the confirmation surface; the user
          already saw permissions, schedule, esm.sh deps and the host
          warning above before reaching this button.
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
            if (hasUpdate) onInstall(item, { isUpdate: true, existingId: storeInstalled.id })
            else if (storeInstalled) onOpenInstalled(storeInstalled.id)
            else onInstall(item, { isUpdate: false })
          }}
        >
          {busy ? detailBusyLabel(lifecycle.actionKind)
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
