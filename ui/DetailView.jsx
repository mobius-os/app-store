import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Code, Flag, SavedFilledXs, SavedXs, Share, X } from '@openai/apps-sdk-ui/components/Icon'
import { appLifecycleFor, busyLabelForAction, catalogCategory, catalogPublisher, communityFeedbackOf, formatDownloadSize, storeCategory, hasAccessRows, isTrustedHost, recoveryNote, scheduleSummary, showsSnapshotManifest, sourceAvailabilityStatus, shortDate } from '../domain.js'
import { CapabilityContract } from './CapabilityContract.jsx'
import { CategoryIcon } from './CategoryBrowse.jsx'
import { IconBox, installedIconUrl } from './IconBox.jsx'
import { CommunityFeedback } from './CommunityFeedback.jsx'
import { CatalogStoreImage, StoreImage, catalogAssetUrl } from './StoreImage.jsx'
import { SectionHead } from './StoreSections.jsx'
import { progressStageFor } from './CatalogCard.jsx'
import { ProgressFill } from './ProgressFill.jsx'

function setupMetaText(setup, storeInstalled) {
  if (setup.scope === 'system') {
    return 'Configure platform providers and background agents in Settings'
  }
  return storeInstalled
    ? 'Configure inside the installed app'
    : 'Install first; setup appears on first open'
}

function shortRevision(value, length = 12) {
  return typeof value === 'string' && value
    ? value.slice(0, length)
    : null
}

function checkedAtText(value) {
  const parsed = typeof value === 'string' ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export function DetailView({ item, storeAppId, capabilityReview, onRetryCapabilityReview, uninstalledApp, installed, updateChecks = {}, onBack, onInstall, onUninstall, onOpenInstalled, onSetup, onRetryInstalled, busy, busyActionKind, onReviewUpdate, onCommunityFeedback, onCommunityWithdraw, onOpenMobiusAccount, canCommunityWithdraw = false, communityBusy = false, communityError = '', mobiusAccount = 'loading', token, installedUnavailable = false, setupCompletions = {}, systemSetupReady = false, focusSection = '', related = null, renderRow = null, onOpenDeveloper = null, onOpenCategory = null, saved = false, onToggleSaved = null, onShare = null, updateStage = null }) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  // The recovery note must not outlive its deadline: re-read the clock whenever the deadline changes (the
  // list can arrive after the page opened) and again when it passes.
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    setClock(new Date())
    const left = Date.parse(uninstalledApp?.expires_at) - Date.now()
    if (!(left > 0)) return undefined
    const timer = setTimeout(() => setClock(new Date()), left + 50)
    return () => clearTimeout(timer)
  }, [uninstalledApp?.expires_at])
  const recovery = recoveryNote(uninstalledApp, clock)
  const m = capabilityReview?.preview?.manifest || item.manifest
  const reviewedItem = m === item.manifest ? item : { ...item, manifest: m }
  const downloadSize = formatDownloadSize(capabilityReview?.preview?.download_bytes)
  const detailCategory = storeCategory(catalogCategory(item))
  const detailFeedback = communityFeedbackOf(item)
  const lifecycle = appLifecycleFor(reviewedItem, {
    installed,
    updateChecks,
    installedUnavailable,
    setupCompletions,
    systemSetupReady,
  })
  const storeInstalled = lifecycle.installedApp
  const installedVer = lifecycle.installedVersion
  const hasUpdate = lifecycle.hasUpdate
  const blockedUpdate = lifecycle.key === 'conflict'
  const resolutionNotice = lifecycle.resolutionNotice
  // Conflict resolution reuses the candidate already reviewed and journaled by
  // the backend. Do not disable its durable resolver action just because a new
  // read-only capability preview is temporarily unavailable.
  // Only an update waits for the access check: it shows what changes. A fresh install does not, because
  // an app asks what it may do the first time it opens.
  const requiresCapabilityReview = !blockedUpdate && hasUpdate
  const capabilityReviewReady = ['ready', 'changed', 'refused'].includes(capabilityReview?.status)
    && hasAccessRows(capabilityReview?.preview)
  const canRetryInstalled = typeof onRetryInstalled === 'function'
  const primaryActionDisabled =
    busy ||
    lifecycle.actionKind === 'none' ||
    (lifecycle.actionKind === 'open' && !storeInstalled) ||
    (lifecycle.actionKind === 'retry' && !canRetryInstalled) ||
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
  const accessChanged = capabilityReview?.status === 'changed' || capabilityReview?.status === 'refused'
  const sourceCheck = storeInstalled ? updateChecks[storeInstalled.id] : null
  const installedRevision = shortRevision(
    sourceCheck?.installedSourceRevision || storeInstalled?.upstream_commit,
  )
  const candidateDigest = shortRevision(sourceCheck?.candidateSourceDigest)
  const checkedAt = checkedAtText(sourceCheck?.checkedAt)
  // Until a live manifest arrives (the access preview reads one), the bundled
  // snapshot's version must not look authoritative.
  const catalogVersion = m === item.manifest && showsSnapshotManifest(item)
    ? `v${m.version} (cached)`
    : `v${m.version}`
  const releaseSummary = storeInstalled && installedVer && installedVer !== m.version
    ? `Installed label v${installedVer} · catalog label ${catalogVersion}`
    : `Version label ${catalogVersion}`
  const sourceAvailability = item.community
    ? sourceAvailabilityStatus(item.community.cache)
    : null
  const communityFeedback = communityFeedbackOf(item)
  // Library's Review action opens the app straight at its ratings form.
  useEffect(() => {
    if (focusSection !== 'reviews' || !communityFeedback?.id) return
    const target = document.getElementById('st-community-feedback-title')
    target?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    target?.closest('section')?.querySelector('.st-rating-picker button:not(:disabled), button')?.focus({ preventScroll: true })
  }, [focusSection, item?.id, communityFeedback?.id])
  // The service decides eligibility per app from any verified install, so an
  // owner who reviewed and later uninstalled can still edit their review.
  const verifiedCommunityInstall = mobiusAccount === 'signed_in'
    && communityFeedback?.review_eligibility === 'eligible'
  const previewUrl = item.preview && storeAppId
    ? catalogAssetUrl(storeAppId, item.preview)
    : ''
  const catalogListing = !item.community && item.listing && typeof item.listing === 'object'
    ? item.listing
    : null
  const manifestListing = m.store && typeof m.store === 'object' ? m.store : null
  const listing = catalogListing || manifestListing
  const listingScreenshots = Array.isArray(listing?.screenshots) ? listing.screenshots : []
  const listingTagline = catalogListing?.tagline || manifestListing?.tagline || item.summary || m.description
  const listingDescription = catalogListing?.description || manifestListing?.description || m.description
  const listingImage = (path, alt, className, loading = 'lazy') => catalogListing
    ? <CatalogStoreImage storeAppId={storeAppId} path={path} alt={alt} className={className} loading={loading} />
    : <StoreImage item={reviewedItem} path={path} token={token} alt={alt} className={className} loading={loading} />

  // Use the same first-paint, browser-cacheable installed icon as the grid.
  const heroItemWithIcon = storeInstalled
    ? { ...item, installed_icon_url: installedIconUrl(storeInstalled) }
    : item

  const primaryLabel = busy ? busyLabelForAction(busyActionKind || lifecycle.actionKind)
    : requiresCapabilityReview && !capabilityReviewReady
      ? (capabilityReview?.preview ? 'Access unavailable' : 'Checking access…')
    : blockedUpdate ? 'Fix update'
    : lifecycle.actionKind === 'retry' ? 'Retry'
    : hasUpdate ? 'Update'
    : storeInstalled ? 'Open'
    : lifecycle.actionKind === 'install' ? 'Get'
    : lifecycle.actionLabel
  const runPrimary = () => {
    if (primaryActionDisabled) return
    if (blockedUpdate) { onReviewUpdate(resolutionNotice); return }
    if (lifecycle.actionKind === 'retry') { onRetryInstalled?.(); return }
    if (hasUpdate) onInstall(item, {
      isUpdate: true,
      existingId: storeInstalled.id,
      capabilityDigest: capabilityReview.preview.capability_digest,
    })
    else if (storeInstalled) onOpenInstalled(storeInstalled.id)
    else onInstall(item)
  }
  const developer = catalogPublisher(item)
  const releasedAt = detailFeedback?.released_at || detailFeedback?.published_at || item.published_at || ''
  const publishedAt = detailFeedback?.published_at || item.published_at || ''
  const sourceUrl = item.community?.repository_url || m.homepage || ''
  const [viewer, setViewer] = useState(-1)
  const shots = listingScreenshots.map((shot, index) => ({
    path: typeof shot === 'string' ? shot : shot.src,
    alt: typeof shot === 'string' ? `${m.name} screenshot ${index + 1}` : shot.alt,
    label: typeof shot === 'object' ? shot.label : '',
  }))
  const infoRow = (label, value) => value ? (
    <div className="st-info-row"><dt>{label}</dt><dd>{value}</dd></div>
  ) : null

  return (
    <div className="st-detail-v2">
      <div className="st-lnav">
        <button type="button" className="st-backlink" onClick={onBack}>
          <ChevronLeft width={18} height={18} aria-hidden="true" /> Back
        </button>
      </div>
      <div className="st-scroll is-detail">
        <header className="st-dh">
          <IconBox item={heroItemWithIcon} size="hero" token={token} />
          <div className="st-dh-text">
            <h1 id="st-detail-name" className="st-dh-name">{m.name}</h1>
            {onOpenDeveloper ? (
              <button type="button" className="st-dh-dev" onClick={() => onOpenDeveloper(developer)}>{developer}</button>
            ) : <span className="st-dh-dev">{developer}</span>}
            <p className="st-dh-sub">{listingTagline}</p>
            {!storeInstalled && recovery && (
              <div className="st-detail-note" role="status">
                <strong>{recovery.title}</strong>
                <span>{recovery.detail}</span>
              </div>
            )}
            <div className="st-dh-acts">
              {/* One main action (Get, Update or Open); Uninstall is a quiet
                  link at the end rather than its peer. */}
              <button type="button" className="st-dbtn is-primary"
                disabled={primaryActionDisabled} onClick={runPrimary}>
                <ProgressFill busy={busy} label={progressStageFor(busyActionKind || lifecycle.actionKind, updateStage).label}>{primaryLabel}</ProgressFill>
              </button>
              {onToggleSaved ? (
                <button type="button" className="st-icon-btn" onClick={() => onToggleSaved(item)}
                  aria-pressed={!!saved} aria-label={saved ? 'Remove from saved' : 'Save for later'}>
                  {saved ? <SavedFilledXs width={20} height={20} aria-hidden="true" /> : <SavedXs width={20} height={20} aria-hidden="true" />}
                </button>
              ) : null}
              {onShare ? (
                <button type="button" className="st-icon-btn" onClick={() => onShare(item)} aria-label={`Share ${m.name}`}>
                  <Share width={20} height={20} aria-hidden="true" />
                </button>
              ) : null}
              {storeInstalled ? (
                <button type="button" className="st-dbtn is-link" onClick={() => onUninstall(storeInstalled)} disabled={busy}>Uninstall</button>
              ) : null}
            </div>
          </div>
        </header>

        {detailFeedback?.rating_count || detailCategory || releasedAt ? (
        <div className="st-strip">
          {/* Facts only when they say something: no "—" placeholders, and the
              developer is already named under the title. */}
          {detailFeedback?.rating_count ? (
            <div>
              <small>{`${detailFeedback.rating_count} ${detailFeedback.rating_count === 1 ? 'rating' : 'ratings'}`}</small>
              <b>{Number(detailFeedback.rating_average).toFixed(1)}</b>
              <span>{'★'.repeat(Math.round(detailFeedback.rating_average))}</span>
            </div>
          ) : null}
          {detailCategory ? (
            <button type="button" className="st-strip-cell" onClick={() => onOpenCategory?.(detailCategory.id)}>
              <small>Category</small><b><CategoryIcon category={detailCategory} size="sm" /></b><span>{detailCategory.title}</span>
            </button>
          ) : null}
          {releasedAt ? (
            <div>
              <small>Updated</small><b>{shortDate(releasedAt)}</b><span>Latest version</span>
            </div>
          ) : null}
        </div>
        ) : null}

        {installedUnavailable && (
          <div className="st-notice is-warning st-notice-row" role="status">
            <span>Installed apps could not be refreshed. Install and update actions are paused until this reconnects.</span>
            <button type="button" className="st-btn st-btn-secondary st-notice-action" onClick={onRetryInstalled} disabled={busy || !canRetryInstalled}>Retry</button>
          </div>
        )}
        {unfamiliarHost && (
          <div className="st-host-warn">
            <div className="st-host-warn-icon" aria-hidden="true">⚠</div>
            <div>
              <div>Unfamiliar host: <span className="st-host-warn-host">{warnHost}</span></div>
              <div className="st-host-warn-body">You're installing from a host that isn't in the trusted list. Continue only if you trust the author.</div>
            </div>
          </div>
        )}
        {showSetup && (
          <section className="st-sec">
            <SectionHead id="st-detail-setup" title="Setup" />
            <div className="st-setup-card">
              <div className="st-setup-main">{setup.label || (setup.scope === 'system' ? 'System setup required' : 'Setup required')}</div>
              {setup.description && <div className="st-setup-note">{setup.description}</div>}
              <div className="st-setup-bottom">
                <div className="st-setup-meta">{setupMetaText(setup, storeInstalled)}</div>
                {canOpenSetup && (
                  <button type="button" className="st-btn st-btn-secondary st-setup-action" onClick={() => onSetup?.(item, storeInstalled)} disabled={busy}>
                    {setup.action || (setup.scope === 'system' ? 'Open Settings' : 'Open app')}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {shots.length ? (
          <section className="st-sec" aria-labelledby="st-detail-preview">
            <SectionHead id="st-detail-preview" title="Preview" />
            <div className="st-detail-gallery" aria-label={`${m.name} screenshots`}>
              {shots.map((shot, index) => (
                <button key={`${shot.path}-${index}`} type="button" className="st-shot" onClick={() => setViewer(index)}
                  aria-label={`View ${shot.alt || `screenshot ${index + 1}`} full screen`}>
                  {listingImage(shot.path, '', 'st-detail-gallery-image')}
                </button>
              ))}
            </div>
          </section>
        ) : previewUrl ? (
          <figure className="st-detail-preview">
            <img src={previewUrl} alt={`${m.name} app preview`} />
          </figure>
        ) : null}

        <section className="st-sec" aria-labelledby="st-detail-new">
          <SectionHead id="st-detail-new" title="What's new" />
          <div className="st-wn">
            {/* One quiet line: the version and when it arrived. No card around a
                sentence that only says there are no notes. */}
            <div className="st-wn-top"><b>Version {catalogVersion}</b>{shortDate(releasedAt) ? <span>· {shortDate(releasedAt)}</span> : null}</div>
            {item.community ? null : <p>Arrives with Möbius updates.</p>}
            {storeInstalled && installedVer && installedVer !== m.version ? <p>You have version {installedVer}.</p> : null}
            {item.community?.repository_update ? (
              <p className="st-wn-note">A newer repository change ({item.community.repository_update.commit_sha.slice(0, 7)}) is waiting; this release stays until its owner lists it.</p>
            ) : null}
          </div>
        </section>

        <section className="st-sec" aria-labelledby="st-detail-about">
          <SectionHead id="st-detail-about" title="About" />
          <div className="st-detail-desc-wrap"><p className="st-detail-desc">{listingDescription}</p></div>
        </section>

        <section className={`st-sec${accessChanged ? ' is-attention' : ''}`} aria-labelledby="st-detail-access">
          <SectionHead id="st-detail-access" title="What it can access"
            sub={accessChanged ? 'This version asks for different access.' : 'Checked by your Möbius before anything is installed.'} />
          <div className="st-access">
            <CapabilityContract review={capabilityReview} onRetry={onRetryCapabilityReview} isInstalled={!!storeInstalled} />
            {scheduleText ? (
              <p className="st-access-note">Runs in the background: {scheduleText}.{capabilityReview.preview.capability_contract.background.user_configurable ? ' You can change the time in the app.' : ''}</p>
            ) : null}
            {m.runtime?.esm_deps?.length > 0 ? (
              <p className="st-access-note">Loads {m.runtime.esm_deps.length === 1 ? 'one library' : `${m.runtime.esm_deps.length} libraries`} from esm.sh on first open: {m.runtime.esm_deps.join(', ')}.</p>
            ) : null}
          </div>
        </section>

        {communityFeedback ? (
          <CommunityFeedback
            key={communityFeedback.revision_id}
            feedback={communityFeedback}
            account={mobiusAccount}
            canRate={verifiedCommunityInstall}
            onSubmitFeedback={onCommunityFeedback}
            onOpenMobiusAccount={onOpenMobiusAccount}
            busy={communityBusy}
            error={communityError}
          />
        ) : null}

        <section className="st-sec" aria-labelledby="st-detail-info">
          <SectionHead id="st-detail-info" title="Information" />
          <dl className="st-info">
            {infoRow('Developer', onOpenDeveloper
              ? <button type="button" className="st-lnk" onClick={() => onOpenDeveloper(developer)}>{developer}</button>
              : developer)}
            {infoRow('Version', catalogVersion)}
            {infoRow('Category', detailCategory ? (onOpenCategory
              ? <button type="button" className="st-lnk" onClick={() => onOpenCategory(detailCategory.id)}>{detailCategory.title}</button>
              : detailCategory.title) : '')}
            {infoRow('Works offline', m.offline_capable ? 'Yes' : 'Needs a connection')}
            {infoRow('License', m.license || 'Not stated')}
            {infoRow('Size', downloadSize)}
            {infoRow(publishedAt ? 'Published' : 'Ships with', publishedAt ? shortDate(publishedAt) : 'Möbius')}
            {sourceAvailability ? infoRow('Release source', sourceAvailability.label) : null}
          </dl>
          <div className="st-info-links">
            {sourceUrl ? (
              <a className="st-lnk" href={sourceUrl} target="_blank" rel="noopener noreferrer"><Code width={16} height={16} aria-hidden="true" /> Source code</a>
            ) : null}
            {item.community?.repository_url ? (
              <a className="st-lnk" href={`${item.community.repository_url.replace(/\/$/, '')}/issues`} target="_blank" rel="noopener noreferrer"><Flag width={16} height={16} aria-hidden="true" /> Report a problem</a>
            ) : null}
          </div>
          {storeInstalled ? (
            <details className="st-technical-details">
              <summary className="st-technical-summary"><span className="st-technical-summary-main">Update source</span><span className="st-technical-summary-meta">{releaseSummary}</span></summary>
              <div className="st-technical-body">
                <div className="st-esm-note">
                  {sourceCheck?.available === null ? 'Source verification was unavailable on the last check.'
                    : sourceCheck ? (sourceCheck.available ? 'A different upstream source was verified.' : 'Installed source matches the verified upstream source.')
                      : 'Source verification has not completed yet.'}
                  {installedRevision && <div className="st-esm-dep-list">Installed source revision: {installedRevision}</div>}
                  {candidateDigest && <div className="st-esm-dep-list">Checked source digest: {candidateDigest}</div>}
                  {checkedAt && <div className="st-esm-dep-list">Last verified: {checkedAt}</div>}
                </div>
              </div>
            </details>
          ) : null}
        </section>

        {canCommunityWithdraw && (
          <div className="st-community-withdraw" role="group" aria-label="Manage your community listing">
            {!confirmWithdraw ? (
              <button type="button" className="st-community-withdraw-btn" disabled={communityBusy} onClick={() => setConfirmWithdraw(true)}>Withdraw from community</button>
            ) : (
              <div className="st-community-withdraw-confirm">
                <span>Remove this listing from the community store? People will no longer find or install it. You can republish later.</span>
                <div className="st-community-withdraw-actions">
                  <button type="button" className="st-community-withdraw-confirm-btn" disabled={communityBusy}
                    onClick={async () => { const ok = await onCommunityWithdraw?.(); if (!ok) setConfirmWithdraw(false) }}>
                    {communityBusy ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                  <button type="button" disabled={communityBusy} onClick={() => setConfirmWithdraw(false)}>Cancel</button>
                </div>
                {communityError && <span className="st-community-withdraw-error" role="alert">{communityError}</span>}
              </div>
            )}
          </div>
        )}

        {related?.byDeveloper?.length && renderRow ? (
          <section className="st-sec" aria-labelledby="st-detail-moreby">
            <SectionHead id="st-detail-moreby" title={`More by ${developer}`}
              onSeeAll={related.byDeveloper.length > 3 && onOpenDeveloper ? () => onOpenDeveloper(developer) : undefined} />
            <div className="st-grid3">{related.byDeveloper.slice(0, 3).map(renderRow)}</div>
          </section>
        ) : null}
        {related?.similar?.length && renderRow ? (
          <section className="st-sec" aria-labelledby="st-detail-similar">
            <SectionHead id="st-detail-similar" title="You may also like"
              onSeeAll={detailCategory && onOpenCategory ? () => onOpenCategory(detailCategory.id) : undefined} />
            <div className="st-grid3">{related.similar.slice(0, 6).map(renderRow)}</div>
          </section>
        ) : null}
      </div>
      {viewer >= 0 && shots[viewer] ? (
        <ScreenshotViewer shots={shots} index={viewer} onIndex={setViewer} onClose={() => setViewer(-1)}
          render={(shot) => listingImage(shot.path, shot.alt, 'st-viewer-image', 'eager')} />
      ) : null}
    </div>
  )
}

// Full-screen screenshots: arrows, arrow keys, Escape, and a clear close.
function ScreenshotViewer({ shots, index, onIndex, onClose, render }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const key = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndex((index + 1) % shots.length)
      if (event.key === 'ArrowLeft') onIndex((index - 1 + shots.length) % shots.length)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [index, shots.length, onClose, onIndex])
  return (
    <div className="st-viewer" role="dialog" aria-modal="true" aria-label="Screenshots" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <button ref={closeRef} type="button" className="st-viewer-close" onClick={onClose} aria-label="Close"><X width={18} height={18} /></button>
      {render(shots[index])}
      {shots.length > 1 ? (
        <div className="st-viewer-bar">
          <button type="button" onClick={() => onIndex((index - 1 + shots.length) % shots.length)} aria-label="Previous screenshot"><ChevronLeft width={18} height={18} /></button>
          <span>{index + 1} of {shots.length}</span>
          <button type="button" onClick={() => onIndex((index + 1) % shots.length)} aria-label="Next screenshot"><ChevronRight width={18} height={18} /></button>
        </div>
      ) : null}
    </div>
  )
}
