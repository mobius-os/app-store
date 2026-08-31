import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const updateReview = readFileSync(new URL('../ui/UpdateReviewModal.jsx', import.meta.url), 'utf8')
const catalogList = readFileSync(new URL('../ui/CatalogList.jsx', import.meta.url), 'utf8')
const catalogCard = readFileSync(new URL('../ui/CatalogCard.jsx', import.meta.url), 'utf8')
const catalogFilters = readFileSync(new URL('../ui/CatalogFilters.jsx', import.meta.url), 'utf8')
const libraryHealth = readFileSync(new URL('../ui/LibraryHealth.jsx', import.meta.url), 'utf8')
const detailView = readFileSync(new URL('../ui/DetailView.jsx', import.meta.url), 'utf8')

const app = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')

test('update review restores its opener independently of busy-state effects', () => {
  assert.match(updateReview, /openerRef\.current = document\.activeElement/)
  assert.match(updateReview, /document\.contains\(opener\)/)
  assert.match(updateReview, /\}, \[\]\)\n\n  useEffect\(\(\) => \{/)
})

test('Browse, Library, and Publish form one keyboard-navigable tab set', () => {
  assert.match(app, /const order = \['browse', 'library', 'publish'\]/)
  assert.match(app, /role="tablist" aria-label="Browse mode"/)
  for (const destination of ['browse', 'library', 'publish']) {
    assert.match(app, new RegExp(`id="st-tab-${destination}"`))
    assert.match(app, new RegExp(`aria-selected=\{tab === '${destination}'\}`))
  }
  assert.match(app, /role="tabpanel"/)
  assert.match(app, /aria-labelledby=\{`st-tab-\$\{tab\}`\}/)
})

test('provider setup status never gates the baked catalog first paint', () => {
  const initialLoadStart = app.indexOf('const remoteCatalogPromise = fetchCatalog')
  const catalogMergeStart = app.indexOf('// Resolve the catalog SOURCE', initialLoadStart)
  const initialPaint = app.slice(initialLoadStart, catalogMergeStart)

  assert.ok(initialLoadStart >= 0 && catalogMergeStart > initialLoadStart)
  assert.match(initialPaint, /const providerStatusPromise = loadProviderStatus\(token\)/)
  assert.doesNotMatch(initialPaint, /await providerStatusPromise/)
  assert.match(initialPaint, /setLoadingCatalog\(false\)[\s\S]*providerStatusPromise\.then/)
})

test('App Store preserves its reviewed immersive hold gesture', () => {
  assert.match(app, /window\.mobius\.immersive\.holdToToggle/)
})

test('Browse presents a user-controlled spotlight while keeping ordinary category rows', () => {
  assert.match(catalogList, /filter\(\(item\) => listingHero\(item\)\)\.slice\(0, 3\)/)
  assert.match(catalogList, /Array\.isArray\(spotlightFeed\?\.items\)/)
  assert.match(catalogList, /hostedSpotlights\.length/)
  assert.match(catalogList, /className="st-spotlight-stage"/)
  assert.match(catalogList, /className="st-spotlight-pagination"/)
  assert.match(catalogList, /aria-current=\{index === activeSpotlightIndex/)
  assert.doesNotMatch(catalogList, /setInterval|autoPlay|autoplay/)
  assert.match(catalogList, /className="st-spotlight-open"/)
  assert.match(catalogList, /const groupedItems = items/)
  assert.match(catalogList, /editorial \? 'editorial' : layout/)
  assert.doesNotMatch(catalogList, /items\.filter\(\(item\) => !editorialIds\.has/)
  assert.doesNotMatch(catalogList, /role="button"/)
})

test('shared-listing refresh stays accessible without inserting a visible progress row', () => {
  assert.match(catalogList, /aria-busy=\{searchLoading \|\| undefined\}/)
  assert.match(catalogList, /className="st-sr-only" role="status" aria-live="polite"/)
  assert.doesNotMatch(catalogList, /st-registry-progress/)
  assert.doesNotMatch(catalogList, />Searching shared listings…</)
})

test('browse cards reserve accepted screenshots for the app description', () => {
  assert.doesNotMatch(catalogCard, /StoreImage|st-card-preview|listingScreenshot/)
  assert.match(detailView, /<p className="st-detail-desc">\{listingDescription\}<\/p>[\s\S]*st-detail-gallery/)
  assert.match(detailView, /listingScreenshots\.map/)
})

test('Browse keeps update controls in Library instead of spending discovery space', () => {
  assert.match(catalogFilters, /mode === 'library' \? \(/)
  assert.match(catalogFilters, /aria-label="Library filters"/)
})

test('Library exposes one Update all action instead of duplicate review controls', () => {
  assert.match(catalogFilters, /: 'Update all'/)
  assert.match(catalogFilters, /aria-label=\{`Update all/)
  assert.doesNotMatch(libraryHealth, /<button/)
  assert.doesNotMatch(libraryHealth, /Review updates/)
})
