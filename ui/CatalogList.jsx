import { CatalogCard } from './CatalogCard.jsx'
import { catalogCollection } from '../domain.js'
import { IconBox } from './IconBox.jsx'
import { CatalogStoreImage, StoreImage } from './StoreImage.jsx'

const CATALOG_COLLECTIONS = [
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
    description: 'Open-source apps you can install, review, remix, and improve together.',
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
  layout = 'grid',
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
      appId={appId}
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
      layout={layout}
    />
  )
  const spotlights = editorial
    ? items.filter((item) => listingHero(item)).slice(0, 3)
    : []
  const feature = spotlights[0] || null
  const supportingSpotlights = spotlights.slice(1)
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
  const editorialIds = new Set([...spotlightIds, ...picks.map((item) => item.id)])
  const groupedItems = editorial ? items.filter((item) => !editorialIds.has(item.id)) : items
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
      <div className="st-catalog-grid">{group.items.map(renderCard)}</div>
    </section>
  )
  const spotlightImage = (item, path, className, loading = 'lazy') => item.community ? (
    <StoreImage item={item} path={path} token={token} alt="" className={className} loading={loading} />
  ) : (
    <CatalogStoreImage storeAppId={appId} path={path} alt="" className={className} loading={loading} />
  )

  return (
    <div className={`st-catalog-sections${layout === 'list' ? ' is-list' : ''}`}>
      {searchLoading ? <div className="st-registry-progress" role="status">Searching shared listings…</div> : null}
      {feature ? (
        <section className="st-spotlights" aria-labelledby="st-spotlights-title">
          <div className="st-catalog-section-head st-spotlights-head">
            <h2 id="st-spotlights-title" className="st-catalog-section-title">Spotlight</h2>
            <p className="st-catalog-section-desc">A closer look at apps that change what Möbius can do.</p>
          </div>
          <div className={`st-spotlight-grid${supportingSpotlights.length ? '' : ' is-single'}`}>
            <article className="st-editorial-hero" aria-labelledby={`st-spotlight-${feature.id}`}>
              {spotlightImage(feature, listingHero(feature), 'st-editorial-hero-image', 'eager')}
              <div className="st-editorial-hero-shade" />
              <div className="st-editorial-hero-copy">
                <div className="st-editorial-title-row">
                  <IconBox item={feature} token={token} />
                  <div>
                    <h3 id={`st-spotlight-${feature.id}`}>{feature.manifest?.name || feature.name}</h3>
                    <p>{listingFor(feature)?.tagline || feature.summary || feature.description}</p>
                  </div>
                </div>
                <button type="button" className="st-btn st-btn-primary" onClick={() => onPick(feature)}>View app</button>
              </div>
            </article>
            {supportingSpotlights.length ? (
              <div className="st-spotlight-stack">
                {supportingSpotlights.map((item) => (
                  <article className="st-spotlight-card" key={item.id} aria-labelledby={`st-spotlight-${item.id}`}>
                    {spotlightImage(item, listingHero(item), 'st-spotlight-card-image')}
                    <div className="st-spotlight-card-shade" />
                    <div className="st-spotlight-card-copy">
                      <IconBox item={item} token={token} />
                      <div>
                        <h3 id={`st-spotlight-${item.id}`}>{item.manifest?.name || item.name}</h3>
                        <p>{listingFor(item)?.tagline || item.summary || item.description}</p>
                      </div>
                      <button type="button" className="st-spotlight-open" onClick={() => onPick(item)}>View</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {picks.length ? (
        <section className="st-picks" aria-labelledby="st-picks-title">
          <div className="st-catalog-section-head"><h2 id="st-picks-title" className="st-catalog-section-title">Our picks</h2></div>
          <div className="st-picks-grid">{picks.map(renderCard)}</div>
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
