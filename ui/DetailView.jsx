import { PERM_EXPLAIN } from '../constants.js'
import { findInstalled, installedVersionFor, isTrustedHost, scheduleSummary, semverCmp } from '../domain.js'
import { IconBox } from './IconBox.jsx'
import { PermissionRow } from './PermissionRow.jsx'

export function DetailView({ item, installed, installedVersions, onBack, onInstall, onUninstall, onOpenInstalled, busy, updateNotice, onReviewUpdate, onDismissNotice, token }) {
  const m = item.manifest
  // Match by manifest_url — see CatalogList comment. Slug collisions
  // between user apps and store apps are resolved transparently by
  // allocate_unique_slug on the backend; the store reads its own
  // installed apps via manifest_url, never slug.
  const storeInstalled = findInstalled(installed, item)
  const installedVer = installedVersionFor(item, installedVersions, storeInstalled)
  // Core apps (Reflection, Memory) are platform-managed: never offer a fresh
  // install or an uninstall (the Uninstall button below stays gated on
  // !isCore, so a platform app can't be removed). They ARE updatable in place
  // when the published version is newer — install-core-apps skips store-managed
  // apps so a store update doesn't fight the deploy re-sync, and the backend
  // updates the existing row by manifest identity (no dup).
  const isCore = !!item.core
  const hasUpdate = storeInstalled && installedVer && semverCmp(installedVer, m.version) < 0
  const blockedUpdate = updateNotice?.kind === 'conflict'
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
                      ? 'Reconcile & update'
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
          - update blocked (conflict):[ Reconcile & update ] (primary)
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
          disabled={busy}
          onClick={() => {
            if (busy) return
            if (blockedUpdate) {
              onReviewUpdate(updateNotice)
              return
            }
            if (hasUpdate) onInstall(item, { isUpdate: true, existingId: storeInstalled.id })
            else if (storeInstalled) onOpenInstalled(storeInstalled.id)
            else if (!isCore) onInstall(item, { isUpdate: false })
          }}
        >
          {blockedUpdate ? 'Reconcile & update'
            : busy ? (hasUpdate ? 'Updating…' : 'Installing…')
            : hasUpdate ? `Update to v${m.version}`
            : storeInstalled ? 'Open App'
            : 'Install'}
        </button>
        {storeInstalled && !isCore && (
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
