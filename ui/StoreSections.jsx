import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight } from '@openai/apps-sdk-ui/components/Icon'
import { catalogCategory, catalogKind, creatorStorefront, storeCategory } from '../domain.js'
import { InstalledSeal, appPrimaryAction, progressStageFor } from './CatalogCard.jsx'
import { ProgressFill } from './ProgressFill.jsx'
import { CategoryIcon } from './CategoryBrowse.jsx'
import { IconBox } from './IconBox.jsx'
import { listingFor, listingHero } from './Spotlight.jsx'
import { CatalogStoreImage, CreatorPicture, StoreImage } from './StoreImage.jsx'

// The Store's building blocks: one section heading grammar, featured
// cards on real listing art, sideways rows of app rows, panels and the
// category list. Every app action goes through appPrimaryAction, so a
// featured card and a row can never disagree about Get, Open or Update.

export function SectionHead({ id, title, sub, seeAll, onSeeAll, arrows }) {
  return (
    <div className="st-sh">
      <div className="st-sh-text">
        <h2 id={id} className="st-sh-title">{title}</h2>
        {sub ? <p className="st-sh-sub">{sub}</p> : null}
      </div>
      <div className="st-sh-tools">
        {arrows}
        {onSeeAll ? (
          <button type="button" className="st-see" onClick={onSeeAll} aria-label={`${seeAll || 'See all'} ${title}`}>
            {seeAll || 'See all'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

// A sideways shelf of app rows, three rows deep, with real scroll arrows.
export function RowShelf({ id, title, sub, items, renderRow, onSeeAll }) {
  const rowRef = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: true })
  useEffect(() => {
    const row = rowRef.current
    if (!row) return undefined
    const measure = () => setEdges({ start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 })
    const resize = new ResizeObserver(measure)
    resize.observe(row)
    measure()
    row.addEventListener('scroll', measure, { passive: true })
    return () => { resize.disconnect(); row.removeEventListener('scroll', measure) }
  }, [items.length])
  if (!items.length) return null
  const move = (direction) => rowRef.current?.scrollBy({
    left: direction * rowRef.current.clientWidth * 0.9,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
  const arrows = edges.start && edges.end ? null : (
    <>
      <button type="button" className="st-arrow" aria-label={`Previous ${title}`} disabled={edges.start} onClick={() => move(-1)}><ChevronLeft width={16} height={16} /></button>
      <button type="button" className="st-arrow" aria-label={`Next ${title}`} disabled={edges.end} onClick={() => move(1)}><ChevronRight width={16} height={16} /></button>
    </>
  )
  return (
    <section className="st-sec" aria-labelledby={`st-sh-${id}`}>
      <SectionHead id={`st-sh-${id}`} title={title} sub={sub} onSeeAll={onSeeAll} arrows={arrows} />
      <div className={`st-rowshelf${items.length <= 6 ? ' is-fit' : ''}`} ref={rowRef}>{items.map(renderRow)}</div>
    </section>
  )
}

// A titled panel of a few rows (Highest rated, Our picks).
export function Panel({ id, title, children }) {
  return (
    <section className="st-panel" aria-labelledby={`st-panel-${id}`}>
      <h2 id={`st-panel-${id}`} className="st-panel-title">{title}</h2>
      <div className="st-panel-rows">{children}</div>
    </section>
  )
}

// Featured cards use the listing's banner art only; a screenshot of an app's
// screen is too busy behind a title.
function artFor(item) {
  const hero = listingFor(item)?.hero
  return (typeof hero === 'string' ? hero : hero?.path) || ''
}
export function hasFeatureArt(item) { return !!artFor(item) }

// A featured card on the app's real listing art: icon tile, label, name,
// one line and the app's own action.
export function FeatureCard({ item, kicker, appId, token, onPick, actionProps }) {
  const art = artFor(item)
  const name = item.manifest?.name || item.name
  const primary = appPrimaryAction(item, actionProps)
  // Same rule as catalog rows: the card itself opens a ready installed app or
  // the app page; only maintenance actions and progress keep a button.
  const { lifecycle } = primary
  const opensApp = primary.canOpen && lifecycle.actionKind === 'open' && !lifecycle.setupNeedsAttention && !primary.disabled
  const showAction = !!primary.busyLabel || !['install', 'open'].includes(lifecycle.actionKind)
  const tagline = listingFor(item)?.tagline || item.summary || item.manifest?.description || ''
  return (
    <article className="st-fcard">
      {art ? (item.community
        ? <StoreImage item={item} path={art} token={token} alt="" className="st-fcard-art" />
        : <CatalogStoreImage storeAppId={appId} path={art} alt="" className="st-fcard-art" />) : null}
      <button type="button" className="st-fcard-open" onClick={() => (opensApp ? primary.run() : onPick(item))}
        aria-label={opensApp ? `${name} — open app` : `${name} — open details`} />
      <div className="st-fcard-copy">
        <div className="st-fcard-who">
          <span className="st-fcard-tile-slot">
            <span className="st-fcard-tile"><IconBox item={item} token={token} /></span>
            {primary.storeInstalled ? <InstalledSeal /> : null}
          </span>
          <div>
            <div className="st-fcard-kicker">{kicker}</div>
            <h3 className="st-fcard-name">{name}</h3>
          </div>
        </div>
        <div className="st-fcard-row">
          <p className="st-fcard-tag">{tagline}</p>
          {showAction ? (
            <button type="button" className="st-pill is-light" disabled={primary.disabled} onClick={primary.run}
              aria-label={`${primary.busyLabel || primary.shortLabel} ${name}`}>
              <ProgressFill busy={!!primary.busyLabel} label={progressStageFor(actionProps.busyActionKind, actionProps.updateStage).label}>{primary.shortLabel}</ProgressFill>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

// Categories as a tidy list: tinted glyph, name, how many apps, chevron.
export function CategoryList({ groups, onSelect, limit = 0, expanded = false, onToggle }) {
  const shown = limit && !expanded ? groups.slice(0, limit) : groups
  return (
    <>
      <div className="st-catlist">
        {shown.map(({ category, items }) => (
          <button key={category.id} type="button" className="st-catrow" onClick={() => onSelect(category.id)}
            style={{ '--cat': category.color }}>
            <CategoryIcon category={category} size="sm" />
            <span className="st-catrow-name">{category.title}</span>
            <span className="st-catrow-count">{items.length}</span>
            <ChevronRight width={15} height={15} aria-hidden="true" className="st-catrow-chev" />
          </button>
        ))}
      </div>
      {limit && groups.length > limit && onToggle ? (
        <button type="button" className="st-see st-catlist-more" onClick={onToggle}>
          {expanded ? 'Show fewer' : `All ${groups.length} categories`}
        </button>
      ) : null}
    </>
  )
}



// Creator portfolios reuse the catalog's real identity, artwork and detail
// navigation. No install action lives here: exploring always opens the app page.
export function CreatorStorefront({ name, items, appId, token, onPick, onBack, hasMore, loadingMore, onLoadMore, filter = 'all', onFilter }) {
  const creator = creatorStorefront(items, name)
  const work = creator.items.filter(item => filter === 'all' || catalogKind(item) === filter)
  const hasGames = creator.items.some(item => catalogKind(item) === 'games')
  const hasApps = creator.items.some(item => catalogKind(item) === 'apps')
  const art = item => {
    const listing = listingFor(item)
    const shot = listing?.screenshots?.[0]
    return listingHero(item) || (typeof shot === 'string' ? shot : shot?.src || shot?.path) || ''
  }
  const picture = (item, path, className, loading = 'lazy') => item.community
    ? <StoreImage item={item} path={path} token={token} alt="" className={className} loading={loading} />
    : <CatalogStoreImage storeAppId={appId} path={path} alt="" className={className} loading={loading} />
  const featured = creator.featured
  return (
    <div className="st-creator">
      <button type="button" className="st-backlink" onClick={onBack}><ChevronLeft width={18} height={18} aria-hidden="true" /> Back</button>
      <header className="st-creator-profile">
        <div className="st-creator-avatar"><span aria-hidden="true">{Array.from(name)[0]?.toUpperCase() || '?'}</span><CreatorPicture url={creator.picture} token={token} name={name} /></div>
        <div className="st-creator-identity">
          <span className="st-creator-kicker">{creator.handle ? 'Möbius creator' : 'Creator'}</span>
          <h1>{name}</h1>
          {creator.categories.length ? <p>{creator.categories.slice(0, 3).join(' · ')}</p> : null}
          <span className="st-creator-meta">{creator.items.length} {creator.items.length === 1 ? 'published app' : 'published apps'}{hasMore ? ' loaded' : ''}</span>
        </div>
        {creator.githubUrl ? <a className="st-creator-source" href={creator.githubUrl} target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight width={16} height={16} aria-hidden="true" /></a> : null}
      </header>
      {featured ? (
        <section className="st-creator-feature" aria-labelledby="st-creator-feature-title">
          {picture(featured, listingHero(featured), 'st-creator-feature-art', 'eager')}
          <div className="st-creator-feature-copy">
            <span className="st-creator-kicker">Explore their work</span>
            <h2 id="st-creator-feature-title">{featured.manifest.name}</h2>
            <p>{listingFor(featured)?.tagline || featured.summary || featured.manifest.description}</p>
            <button type="button" onClick={() => onPick(featured)}>Explore the app <ArrowUpRight width={18} height={18} aria-hidden="true" /></button>
            <span>{storeCategory(catalogCategory(featured))?.title}{featured.manifest.version ? ` · v${featured.manifest.version}` : ''}</span>
          </div>
        </section>
      ) : null}
      <section className="st-creator-work" aria-labelledby="st-creator-work-title">
        <div className="st-creator-work-head">
          <h2 id="st-creator-work-title">Made by {name}</h2>
          {hasApps && hasGames ? (
            <div className="st-creator-filters" role="group" aria-label="Filter creator apps">
              {[['all', 'All work'], ['games', 'Games'], ['apps', 'Apps & tools']].map(([id, label]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => onFilter(id)}>{label}</button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="st-sr-only" role="status">{work.length} {work.length === 1 ? 'app' : 'apps'}</p>
        <div className="st-creator-grid">
          {work.map(item => (
            <button type="button" key={item.id} className="st-creator-card" onClick={() => onPick(item)} aria-label={`${item.manifest.name} — open details`}>
              <div className="st-creator-art">{art(item) ? picture(item, art(item), 'st-creator-card-art') : <div className="st-creator-no-art"><IconBox item={item} size="hero" token={token} /></div>}</div>
              <div className="st-creator-card-info"><IconBox item={item} token={token} /><div><h3>{item.manifest.name}</h3><span>{storeCategory(catalogCategory(item))?.title || (catalogKind(item) === 'games' ? 'Game' : 'App')}{item.manifest.version ? ` · v${item.manifest.version}` : ''}</span></div></div>
              <p>{listingFor(item)?.tagline || item.summary || item.manifest.description}</p>
            </button>
          ))}
        </div>
        {!work.length ? <p className="st-empty-text">No published apps to show yet.</p> : null}
        {hasMore && onLoadMore ? <div className="st-catalog-more"><button type="button" className="st-btn st-btn-secondary" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Loading more…' : 'Load more community apps'}</button></div> : null}
      </section>
    </div>
  )
}

