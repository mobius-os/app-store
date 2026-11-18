import { useState } from 'react'
import { ChevronLeft } from '@openai/apps-sdk-ui/components/Icon'
import { EDITORIAL_COLLECTIONS, STORE_CATEGORIES } from '../constants.js'
import { CatalogCard } from './CatalogCard.jsx'
import {
  catalogCategory, catalogKind, newArrivals, libraryCollections, bundledSpotlights,
  rankedApps, recentUpdates, sortCategoryApps, storeCategory, highestRated,
} from '../domain.js'
import { CategoryIcon, CategorySort } from './CategoryBrowse.jsx'
import { CategoryList, CreatorStorefront, FeatureCard, Panel, RowShelf, SectionHead, hasFeatureArt } from './StoreSections.jsx'
import { Spotlight, listingFor } from './Spotlight.jsx'
import { SelfUpdateRow } from './SelfUpdate.jsx'

// Editorial shelves appear only with enough apps to be a real selection.
const MIN_SHELF_APPS = 3

const CURATED_PICK_IDS = [
  'pages',
  'news',
  'notes',
  'tasks',
  'reflection',
  'integrations',
]

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
  selfUpdate = null,
  libraryTab = null,
  categoryBackLabel = null,
  items,
  installed,
  updateChecks,
  onPick,
  onRetry,
  onUpdate,
  onOpenInstalled,
  onRateApp,
  onUninstall,
  pickOpensApp = false,
  onRetryInstalled,
  busy,
  busyItemId,
  // Apps a server update batch is applying right now.
  updatingItemIds = [],
  busyActionKind,
  checkingUpdateItemId = null,
  errors,
  errorRetries,
  onAskAgentError,
  agentErrorItemId = null,
  onReviewUpdate,
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
  // discover | apps | games | search | library
  view = 'discover',
  spotlightFeed = null,
  activeCollection = null,
  onOpenCollection,
  onCloseCollection,
  shelfScrollRef,
  lifecycleById = new Map(),
  layout = 'grid',
  savedItems = [],
  savedCount = 0,
  updateStages = {},
  searchQuery = '',
  allItems = [],
  creatorFilter = { name: '', value: 'all' },
  onCreatorFilter,
  shelfCategory = 'all',
  // Registry rankings by sort ('trending', 'installs'): ordered community ids.
  communityRankings = {},
  onShelfCategory,
  categorySort = 'top',
  onCategorySort,
  onBrowseCategory,
  onOpenTab,
}) {
  const [showAllCategories, setShowAllCategories] = useState(false)
  const discover = view === 'discover'
  const shelves = discover || view === 'apps' || view === 'games'
  const hostedSpotlights = discover && Array.isArray(spotlightFeed?.items)
    ? spotlightFeed.items.flatMap((entry) => {
        const item = items.find((candidate) => itemManifestId(candidate) === String(entry?.app_id || '').toLowerCase())
        if (!item) return []
        return [{
          ...item,
          editorial_artwork_url: editorialArtworkUrl(entry?.artwork_url),
        }]
      })
    : []
  const spotlights = !discover ? []
    : hostedSpotlights.length ? hostedSpotlights : bundledSpotlights(items)

  // A creator is a destination, not a filter on the tab beneath it. Use the
  // full loaded catalog even when reached from a search or the Games tab.
  if (String(activeCollection || '').startsWith('dev:')) {
    const name = activeCollection.slice(4)
    return <CreatorStorefront key={name} name={name} items={allItems} appId={appId} token={token}
      filter={creatorFilter.name === name ? creatorFilter.value : 'all'} onFilter={value => onCreatorFilter?.(name, value)}
      onPick={onPick} onBack={onCloseCollection} hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} />
  }

  if (items.length === 0 && !activeCollection && view !== 'search' && !libraryTab) {
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
      onRateApp={onRateApp}
      onUninstall={onUninstall}
      pickOpensApp={pickOpensApp}
      onRetryInstalled={onRetryInstalled}
      busy={busyItemId === item.id || checkingUpdateItemId === item.id || updatingItemIds.includes(item.id)}
      busyActionKind={busyItemId === item.id
        ? busyActionKind
        : checkingUpdateItemId === item.id ? 'checking_update'
          : updatingItemIds.includes(item.id) ? 'update' : null}
      blocked={(busy && busyItemId !== item.id) ||
        (checkingUpdateItemId !== null && checkingUpdateItemId !== item.id)}
      error={errors?.[item.id]}
      onRetryError={errorRetries?.[item.id] || null}
      onAskAgentError={onAskAgentError}
      askingAgentAboutError={agentErrorItemId === item.id}
      onReviewUpdate={onReviewUpdate}
      token={token}
      installedUnavailable={installedUnavailable}
      setupCompletions={setupCompletions}
      systemSetupReady={systemSetupReady}
      layout={cardLayout}
      updateStage={updateStages[item.id] || null}
    />
  )
  // Every featured card and row shares the same action wiring as CatalogCard.
  const actionPropsFor = (item) => ({
    installed, updateChecks, installedUnavailable, setupCompletions, systemSetupReady,
    onOpenInstalled, onReviewUpdate, onRetryInstalled, onUpdate,
    busy: busyItemId === item.id || checkingUpdateItemId === item.id || updatingItemIds.includes(item.id),
    blocked: (busy && busyItemId !== item.id) || (checkingUpdateItemId !== null && checkingUpdateItemId !== item.id),
    busyActionKind: busyItemId === item.id ? busyActionKind
      : checkingUpdateItemId === item.id ? 'checking_update'
        : updatingItemIds.includes(item.id) ? 'update' : null,
    updateStage: updateStages[item.id] || null,
  })
  const row = (item) => renderCard(item, 'row')
  const grid3 = (list) => <div className="st-grid3">{list.map(row)}</div>
  const feature = (item, kicker) => item ? (
    <FeatureCard key={item.id} item={item} kicker={kicker} appId={appId} token={token} onPick={onPick}
      actionProps={actionPropsFor(item)} />
  ) : null
  const loadMore = hasMore && onLoadMore ? (
    <div className="st-catalog-more">
      <button type="button" className="st-btn st-btn-secondary" onClick={onLoadMore} disabled={loadingMore}>
        {loadingMore ? 'Loading more…' : 'Load more community apps'}
      </button>
    </div>
  ) : null

  if (layout === 'list') {
    // Library: one focused list per tab. Search shows every match in one list.
    const groups = libraryCollections(items, lifecycleById)
    const groupItems = (id) => groups.find((group) => group.id === id)?.items || []
    const tab = libraryTab || 'installed'
    const selfHere = selfUpdate?.pending
      && ((tab === 'needs' && selfUpdate.kind === 'conflict') || (tab === 'update' && selfUpdate.kind === 'update'))
    const listed = tab === 'needs' ? groupItems('attention')
      : tab === 'update' ? groupItems('updates')
        : tab === 'saved' ? []
          : [...items].sort((a, b) => (a.manifest?.name || a.name || a.id).localeCompare(b.manifest?.name || b.name || b.id))
    const EMPTY = {
      needs: ['Nothing needs you', 'Apps that need setup or a decision about an update show up here.'],
      update: ['Everything is up to date', 'New versions of your apps show up here.'],
      // Saved community apps appear once their listings have loaded.
      saved: savedCount > 0
        ? ['Finding your saved apps', 'They show here as soon as the Store’s listings load.']
        : ['Nothing saved yet', 'Use the bookmark on any app page to keep it here for later.'],
      installed: [emptyTitle, emptyText],
    }
    if (tab === 'saved' && savedItems.length) {
      return <div className={`st-libpane is-${tab}`} aria-busy={searchLoading || undefined}>{grid3(savedItems)}</div>
    }
    if (!listed.length && !selfHere) {
      const [title, text] = EMPTY[tab]
      return (
        <div className={`st-libpane is-${tab}`}>
          <div className="st-libempty"><b>{title}</b><span>{text}</span></div>
        </div>
      )
    }
    return (
      <div className={`st-libpane is-${tab}`} aria-busy={searchLoading || undefined}>
        <div className="st-lib-panel">
          {selfHere ? <SelfUpdateRow self={selfUpdate} appId={appId} /> : null}
          {listed.map((item) => renderCard(item, 'list'))}
        </div>
      </div>
    )
  }

  if (view === 'search') {
    const q = String(searchQuery || '').trim()
    const lower = q.toLowerCase()
    const allGroups = STORE_CATEGORIES.map((category) => ({ category, items: [] }))
    const counts = new Map()
    for (const item of allItems) counts.set(catalogCategory(item), (counts.get(catalogCategory(item)) || 0) + 1)
    const usedCategories = allGroups.filter(({ category }) => counts.get(category.id))
      .map((group) => ({ ...group, items: { length: counts.get(group.category.id) } }))
    const matchingCategories = usedCategories.filter(({ category }) => category.title.toLowerCase().includes(lower))
    const suggestions = [...usedCategories].sort((a, b) => b.items.length - a.items.length).slice(0, 6)
    const chips = (groups) => (
      <div className="st-chips2">
        {groups.map(({ category }) => (
          <button key={category.id} type="button" onClick={() => onBrowseCategory(category.id)} style={{ '--cat': category.color }}>
            <CategoryIcon category={category} size="sm" />{category.title}
          </button>
        ))}
      </div>
    )
    return (
      <div className="st-catalog-sections is-v2" aria-busy={searchLoading || undefined}>
        <span className="st-sr-only" role="status" aria-live="polite">
          {searchLoading ? 'Refreshing shared listings.' : `${items.length} results`}
        </span>
        <div className="st-qhead">
          <h1 className="st-pagehead-title">Results for “{q}”</h1>
          <span>{items.length} {items.length === 1 ? 'app' : 'apps'}</span>
        </div>
        {matchingCategories.length ? chips(matchingCategories) : null}
        {items.length ? (
          <section className="st-sec" style={{ marginTop: 20 }} aria-label="Results">{grid3(items)}</section>
        ) : (
          <div className="st-qempty">
            <b>Nothing matches “{q}”</b>
            <p>Try a shorter word, or browse a category.</p>
            {chips(suggestions)}
          </div>
        )}
        {loadMore}
      </div>
    )
  }

  // Each app has one category; a tab shows only its own kind of app.
  const byCategory = new Map(STORE_CATEGORIES.map((category) => [category.id, []]))
  const uncategorized = []
  for (const item of items) {
    const id = catalogCategory(item)
    if (byCategory.has(id)) byCategory.get(id).push(item)
    else uncategorized.push(item)
  }
  const categoryGroups = (kind) => STORE_CATEGORIES
    .filter((category) => !kind || category.kind === kind)
    .map((category) => ({ category, items: sortCategoryApps(byCategory.get(category.id), 'top') }))
    .filter((group) => group.items.length > 0)
  const pool = view === 'apps' || view === 'games'
    ? items.filter((item) => catalogKind(item) === view)
    : items

  const spotlightIds = new Set(spotlights.map((item) => item.id))
  const pickPool = discover ? items.filter((item) => !spotlightIds.has(item.id) && itemManifestId(item) !== 'connect') : []
  const pickRank = new Map(CURATED_PICK_IDS.map((id, index) => [id, index]))
  const picks = discover
    ? [...pickPool].sort((a, b) => {
        const aRank = pickRank.has(a.id) ? pickRank.get(a.id) : CURATED_PICK_IDS.length
        const bRank = pickRank.has(b.id) ? pickRank.get(b.id) : CURATED_PICK_IDS.length
        if (aRank !== bRank) return aRank - bRank
        const screenshotDelta = Number(!!listingScreenshot(b)) - Number(!!listingScreenshot(a))
        if (screenshotDelta !== 0) return screenshotDelta
        return items.indexOf(a) - items.indexOf(b)
      })
    : []
  // Our picks are the hand-picked apps; others only top up a short list.
  const pickedCount = pickPool.filter((item) => pickRank.has(item.id)).length
  const ourPicks = picks.slice(0, Math.max(4, pickedCount))
  // Editorial placements are discovery lenses, not separate catalogs: every
  // highlighted app also stays in its category.
  const editorialItems = {
    trending: rankedApps(pool, communityRankings.trending),
    'most-downloaded': rankedApps(pool, communityRankings.installs),
    picks: ourPicks,
    'top-rated': highestRated(pool),
    updated: recentUpdates(pool),
    arrivals: newArrivals(pool),
    uncategorized,
  }
  const collectionFor = (id) => {
    const editorial = EDITORIAL_COLLECTIONS.find((group) => group.id === id)
    if (editorial) return { ...editorial, items: editorialItems[id] || [] }
    const category = storeCategory(id)
    if (category) return { id, title: category.title, description: category.description, items: sortCategoryApps(byCategory.get(id), 'top') }
    return { id, title: 'Apps', items: [] }
  }

  // The Store reads community listings a window at a time, so a collection or
  // category page offers the rest instead of stopping at the loaded window.
  if (activeCollection) {
    const selected = collectionFor(activeCollection)
    return (
      <div className="st-collection-view">
        <button type="button" className="st-backlink" onClick={onCloseCollection}>
          <ChevronLeft width={18} height={18} aria-hidden="true" /> Back
        </button>
        <div className="st-pagehead">
          {selected.kicker ? <small className="st-pagehead-eyebrow">{selected.kicker}</small> : null}
          <h1 className="st-pagehead-title">{selected.title}</h1>
          <p className="st-pagehead-sub">{selected.items.length} apps{hasMore ? ' loaded' : ''}</p>
        </div>
        {selected.items.length ? grid3(selected.items) : <p className="st-empty-text">No apps match in this collection.</p>}
        {loadMore}
      </div>
    )
  }

  const tabCategories = view === 'games' ? categoryGroups('games') : categoryGroups('apps')
  const selectedCategory = (view === 'apps' || view === 'games') ? storeCategory(shelfCategory) : null
  const sectionBusy = (
    <span className="st-sr-only" role="status" aria-live="polite">
      {searchLoading ? 'Refreshing shared listings.' : ''}
    </span>
  )
  const rankedShelf = (id, title) => {
    const list = collectionFor(id).items
    if (list.length < MIN_SHELF_APPS) return null
    return (
      <RowShelf key={id} id={id} title={title} items={list.slice(0, 12)}
        renderRow={(item) => <div className="st-ranked" key={item.id}><span className="st-rank" aria-hidden="true">{list.indexOf(item) + 1}</span>{row(item)}</div>}
        onSeeAll={() => onOpenCollection(id)} />
    )
  }

  if (discover) {
    const shown = new Set()
    // The two panels sit side by side, so they show the same number of rows.
    const ratedRows = editorialItems['top-rated'].slice(0, 4)
    const pickRows = editorialItems.picks.slice(0, 4)
    const panelRows = ratedRows.length && pickRows.length ? Math.max(3, Math.min(ratedRows.length, pickRows.length)) : 4
    const topRated = ratedRows.slice(0, panelRows)
    const picks = pickRows.slice(0, panelRows)
    topRated.concat(picks).forEach((item) => shown.add(item.id))
    const updated = editorialItems.updated.filter((item) => !shown.has(item.id)).slice(0, 12)
    updated.forEach((item) => shown.add(item.id))
    const arrivals = editorialItems.arrivals.filter((item) => !shown.has(item.id)).slice(0, 12)
    const allCategories = categoryGroups()
      .sort((a, b) => b.items.length - a.items.length || STORE_CATEGORIES.indexOf(a.category) - STORE_CATEGORIES.indexOf(b.category))
    return (
      <div className="st-catalog-sections is-v2" aria-busy={searchLoading || undefined}>
        {sectionBusy}
        <Spotlight appId={appId} token={token} spotlights={spotlights} onPick={onPick} />
        {topRated.length || picks.length ? (
          <div className="st-panels">
            {topRated.length ? (
              <Panel id="top" title="Highest rated">
                {topRated.map((item, index) => (
                  <div className="st-ranked" key={item.id}><span className="st-rank" aria-hidden="true">{index + 1}</span>{row(item)}</div>
                ))}
              </Panel>
            ) : null}
            {picks.length ? <Panel id="picks" title="Our picks">{picks.map(row)}</Panel> : null}
          </div>
        ) : null}
        {rankedShelf('trending', 'Trending')}
        {rankedShelf('most-downloaded', 'Most downloaded')}
        <RowShelf id="updated" title="Recently updated" sub="Fresh versions from their creators." items={updated}
          renderRow={row} onSeeAll={() => onOpenCollection('updated')} />
        <RowShelf id="arrivals" title="New arrivals" sub="Just published to the Store." items={arrivals}
          renderRow={row} onSeeAll={() => onOpenCollection('arrivals')} />
        <section className="st-sec" aria-labelledby="st-sh-cats">
          <SectionHead id="st-sh-cats" title="Top categories" />
          <CategoryList groups={allCategories} onSelect={onBrowseCategory} limit={9}
            expanded={showAllCategories} onToggle={() => setShowAllCategories((value) => !value)} />
        </section>
        {loadMore}
      </div>
    )
  }

  if (!shelves) return null
  const kindLabel = view === 'games' ? 'games' : 'apps'
  if (selectedCategory) {
    const categoryItems = sortCategoryApps(byCategory.get(selectedCategory.id), categorySort)
    return (
      <div className="st-catalog-sections is-v2" aria-busy={searchLoading || undefined}>
        {sectionBusy}
        <button type="button" className="st-backlink" onClick={() => onShelfCategory('all')}>
          <ChevronLeft width={18} height={18} aria-hidden="true" /> {categoryBackLabel || (view === 'games' ? 'Games' : 'Apps')}
        </button>
        <div className="st-pagehead">
          <h1 className="st-pagehead-title">{selectedCategory.title}</h1>
          {selectedCategory.description ? <p className="st-pagehead-sub">{selectedCategory.description}</p> : null}
        </div>
        <CategorySort value={categorySort} onChange={onCategorySort} />
        {categoryItems.length ? grid3(categoryItems) : <p className="st-empty-text">No {kindLabel} in this category yet.</p>}
        {loadMore}
      </div>
    )
  }
  const featured = pool.filter(hasFeatureArt)
  return (
    <div className="st-catalog-sections is-v2" aria-busy={searchLoading || undefined}>
      {sectionBusy}
      {featured.length >= 2 ? (
        <div className="st-today">{feature(featured[0], view === 'games' ? 'Play now' : 'Featured')}{feature(featured[1], 'Featured')}</div>
      ) : null}
      <section className="st-sec" aria-labelledby={`st-sh-${view}-cats`}>
        <SectionHead id={`st-sh-${view}-cats`} title="Top categories" />
        <CategoryList groups={tabCategories} onSelect={onShelfCategory} />
      </section>
      {rankedShelf('trending', 'Trending')}
      {rankedShelf('most-downloaded', 'Most downloaded')}
      {tabCategories.map(({ category, items: categoryItems }) => (
        <section className="st-sec" key={category.id} aria-labelledby={`st-sh-${category.id}`}>
          <SectionHead id={`st-sh-${category.id}`} title={category.title}
            onSeeAll={categoryItems.length > 6 ? () => onShelfCategory(category.id) : undefined} />
          {grid3(categoryItems.slice(0, 6))}
        </section>
      ))}
      {view === 'apps' && editorialItems.uncategorized.length ? (
        <section className="st-sec" aria-labelledby="st-sh-uncategorized">
          <SectionHead id="st-sh-uncategorized" title="More apps" />
          {grid3(editorialItems.uncategorized)}
        </section>
      ) : null}
      {loadMore}
    </div>
  )
}
