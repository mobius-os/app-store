import { useEffect, useState } from 'react'
import { Pause, Play } from '@openai/apps-sdk-ui/components/Icon'
import { CatalogCard } from './CatalogCard.jsx'
import { catalogCollection } from '../domain.js'
import { IconBox } from './IconBox.jsx'
import { CatalogStoreImage, StoreImage } from './StoreImage.jsx'

const CATALOG_COLLECTIONS = [
  {
    id: 'productivity',
    title: 'Productivity',
    description: 'Understand how your agent works and keep work organized.',
  },
  {
    id: 'everyday',
    title: 'Everyday',
    description: 'Plan your day, stay informed, and build routines that stick.',
  },
  {
    id: 'create',
    title: 'Create',
    description: 'Make websites, documents, and interactive ideas with your agent.',
  },
  {
    id: 'explore',
    title: 'Explore & learn',
    description: 'Travel the world and learn something new along the way.',
  },
  {
    id: 'play',
    title: 'Play',
    description: 'Make some noise or chase a high score.',
  },
  {
    id: 'developer',
    title: 'Build & run Möbius',
    description: 'Shape how Möbius thinks, works, and evolves.',
  },
  {
    id: 'community',
    title: 'From the community',
    description: 'Open-source apps you can inspect, install, and improve together.',
  },
  {
    id: 'other-installed',
    title: 'Other installed apps',
    description: 'Published apps outside the main catalog, with updates checked at their source.',
  },
]

const CURATED_PICK_IDS = [
  'artifacts',
  'news',
  'notes',
  'tasks',
  'reflection',
  'connections',
]

function listingFor(item) {
  return item.community
    ? item.manifest?.store
    : item.listing || item.manifest?.store
}

function listingHero(item) {
  const hero = listingFor(item)?.hero
  return typeof hero === 'string' ? hero : hero?.path
}

function listingScreenshot(item) {
  const screenshot = listingFor(item)?.screenshots?.[0]
  return typeof screenshot === 'string' ? screenshot : screenshot?.src || screenshot?.path
}

function editorialArtworkUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && url.hostname === 'www.mobius.you'
      ? url.toString()
      : ''
  } catch {
    return ''
  }
}

function itemManifestId(item) {
  return String(item?.manifest?.id || item?.id || '').toLowerCase()
}

export function CatalogList({
  appId,
  items,
  installed,
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
  loadingMore = false,
  searchLoading = false,
  hasMore = false,
  onLoadMore,
  editorial = false,
  spotlightFeed = null,
  layout = 'grid',
}) {
  const hostedSpotlights = editorial && Array.isArray(spotlightFeed?.items)
    ? spotlightFeed.items.flatMap((entry) => {
        const item = items.find((candidate) => itemManifestId(candidate) === String(entry?.app_id || '').toLowerCase())
        if (!item) return []
        return [{
          ...item,
          editorial_artwork_url: editorialArtworkUrl(entry?.artwork_url),
        }]
      })
    : []
  const spotlights = hostedSpotlights.length
    ? hostedSpotlights
    : editorial ? items.filter((item) => listingHero(item)).slice(0, 3) : []
  const [spotlightIndex, setSpotlightIndex] = useState(0)
  const [spotlightHoverPaused, setSpotlightHoverPaused] = useState(false)
  const [spotlightFocusPaused, setSpotlightFocusPaused] = useState(false)
  const [spotlightUserPaused, setSpotlightUserPaused] = useState(false)
  const [spotlightReducedMotion, setSpotlightReducedMotion] = useState(false)
  const [spotlightPageVisible, setSpotlightPageVisible] = useState(true)
  const activeSpotlightIndex = spotlights.length
    ? Math.min(spotlightIndex, spotlights.length - 1)
    : 0
  const activeSpotlight = spotlights[activeSpotlightIndex]
  const spotlightAutoPaused = spotlightHoverPaused
    || spotlightFocusPaused
    || spotlightUserPaused
    || spotlightReducedMotion
    || !spotlightPageVisible

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setSpotlightReducedMotion(!!media?.matches)
    const syncVisibility = () => setSpotlightPageVisible(document.visibilityState !== 'hidden')
    syncMotion()
    syncVisibility()
    media?.addEventListener?.('change', syncMotion)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      media?.removeEventListener?.('change', syncMotion)
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  useEffect(() => {
    if (spotlights.length < 2 || spotlightAutoPaused) return undefined
    const timer = window.setTimeout(() => {
      setSpotlightIndex((current) => (
        Math.min(current, spotlights.length - 1) + 1
      ) % spotlights.length)
    }, 6000)
    return () => window.clearTimeout(timer)
  }, [activeSpotlightIndex, spotlightAutoPaused, spotlights.length])

  if (items.length === 0) {
    return (
      <div className="st-empty">
        <div className="st-empty-title">{emptyTitle}</div>
        <p className="st-empty-text">{emptyText}</p>
      </div>
    )
  }
  const renderCard = (item, cardLayout = layout) => (
    <CatalogCard
      key={item.id}
      item={item}
      installed={installed}
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
      layout={cardLayout}
    />
  )
  const spotlightIds = new Set(spotlights.map((item) => item.id))
  const pickPool = editorial ? items.filter((item) => !spotlightIds.has(item.id)) : []
  const pickRank = new Map(CURATED_PICK_IDS.map((id, index) => [id, index]))
  const picks = editorial
    ? [...pickPool].sort((a, b) => {
        const aRank = pickRank.has(a.id) ? pickRank.get(a.id) : CURATED_PICK_IDS.length
        const bRank = pickRank.has(b.id) ? pickRank.get(b.id) : CURATED_PICK_IDS.length
        if (aRank !== bRank) return aRank - bRank
        const screenshotDelta = Number(!!listingScreenshot(b)) - Number(!!listingScreenshot(a))
        if (screenshotDelta !== 0) return screenshotDelta
        return items.indexOf(a) - items.indexOf(b)
      }).slice(0, 6)
    : []
  // Editorial placements are discovery lenses, not separate catalogs. Every
  // highlighted app remains an ordinary card in its stable category below.
  const groupedItems = items
  const groups = CATALOG_COLLECTIONS
    .map((group) => ({
      ...group,
      items: groupedItems.filter((item) => catalogCollection(item) === group.id),
    }))
    .filter((group) => group.items.length > 0)
  const renderGroup = (group) => (
    <section className="st-catalog-section" key={group.id} aria-labelledby={`st-group-${group.id}`}>
      <div className="st-catalog-section-head">
        <h2 id={`st-group-${group.id}`} className="st-catalog-section-title">{group.title}</h2>
        {!editorial && layout !== 'list' ? <p className="st-catalog-section-desc">{group.description}</p> : null}
      </div>
      <div className="st-catalog-grid">
        {group.items.map((item) => renderCard(item, editorial ? 'editorial' : layout))}
      </div>
    </section>
  )
  const spotlightImage = (item, path, className, loading = 'lazy') => (item.community || item.editorial_artwork_url) ? (
    <StoreImage item={item} path={path} token={token} alt="" className={className} loading={loading} />
  ) : (
    <CatalogStoreImage storeAppId={appId} path={path} alt="" className={className} loading={loading} />
  )

  return (
    <div
      className={`st-catalog-sections${layout === 'list' ? ' is-list' : ''}${editorial ? ' is-editorial' : ''}`}
      aria-busy={searchLoading || undefined}
    >
      <span className="st-sr-only" role="status" aria-live="polite">
        {searchLoading ? 'Refreshing shared listings.' : ''}
      </span>
      {activeSpotlight ? (
        <section
          className="st-spotlights"
          aria-labelledby="st-spotlights-title"
          onMouseEnter={() => setSpotlightHoverPaused(true)}
          onMouseLeave={() => setSpotlightHoverPaused(false)}
          onFocusCapture={() => setSpotlightFocusPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setSpotlightFocusPaused(false)
            }
          }}
        >
          <div className="st-catalog-section-head st-spotlights-head">
            <div>
              <h2 id="st-spotlights-title" className="st-catalog-section-title">Spotlight</h2>
              <p className="st-catalog-section-desc">A closer look at apps that change what Möbius can do.</p>
            </div>
            {spotlights.length > 1 ? (
              <div className="st-spotlight-pagination" role="group" aria-label="Choose a spotlight app">
                {spotlights.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={index === activeSpotlightIndex ? 'is-active' : ''}
                    aria-label={`Show ${item.manifest?.name || item.name}`}
                    aria-current={index === activeSpotlightIndex ? 'true' : undefined}
                    onClick={() => setSpotlightIndex(index)}
                  >
                    <span aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  className="st-spotlight-toggle"
                  aria-label={spotlightUserPaused ? 'Resume spotlight' : 'Pause spotlight'}
                  aria-pressed={spotlightUserPaused}
                  onClick={() => setSpotlightUserPaused((paused) => !paused)}
                >
                  {spotlightUserPaused
                    ? <Play width={15} height={15} aria-hidden="true" />
                    : <Pause width={15} height={15} aria-hidden="true" />}
                </button>
              </div>
            ) : null}
          </div>
          <div className="st-spotlight-stage" aria-label={`Spotlight app ${activeSpotlightIndex + 1} of ${spotlights.length}`}>
              <article className="st-spotlight-slide" key={activeSpotlight.id} aria-labelledby={`st-spotlight-${activeSpotlight.id}`}>
                {spotlightImage(
                  activeSpotlight,
                  activeSpotlight.editorial_artwork_url || listingHero(activeSpotlight),
                  'st-spotlight-slide-image',
                  'eager',
                )}
                <div className="st-spotlight-slide-shade" />
                <div className="st-spotlight-slide-copy">
                  <IconBox item={activeSpotlight} token={token} />
                  <div>
                    <span className="st-spotlight-kicker">Featured story</span>
                    <h3 id={`st-spotlight-${activeSpotlight.id}`}>
                      {activeSpotlight.manifest?.name || activeSpotlight.name}
                    </h3>
                    <p>{listingFor(activeSpotlight)?.tagline || activeSpotlight.summary || activeSpotlight.description}</p>
                  </div>
                  <button type="button" className="st-spotlight-open" onClick={() => onPick(activeSpotlight)}>
                    Explore app
                  </button>
                </div>
              </article>
          </div>
        </section>
      ) : null}
      {picks.length ? (
        <section className="st-picks" aria-labelledby="st-picks-title">
          <div className="st-catalog-section-head"><h2 id="st-picks-title" className="st-catalog-section-title">Our picks</h2></div>
          <div className="st-picks-grid">{picks.map((item) => renderCard(item, 'editorial'))}</div>
        </section>
      ) : null}
      {groups.map(renderGroup)}
      {hasMore && onLoadMore ? (
        <div className="st-catalog-more">
          <button type="button" className="st-btn st-btn-secondary" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading more…' : 'Load more community apps'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

// Skeleton grid shown while catalog manifests are being fetched. Same
// card footprint as the real grid, so the layout doesn't shift when
// manifests resolve. Per-block width/height stay inline (dynamic
// dimensions); the pulse animation lives in CSS.
