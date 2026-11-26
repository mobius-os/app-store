import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const updateReview = readFileSync(new URL('../ui/UpdateReviewModal.jsx', import.meta.url), 'utf8')
const catalogList = readFileSync(new URL('../ui/CatalogList.jsx', import.meta.url), 'utf8')
const spotlight = readFileSync(new URL('../ui/Spotlight.jsx', import.meta.url), 'utf8')
const theme = readFileSync(new URL('../theme.js', import.meta.url), 'utf8')
const categoryBrowse = readFileSync(new URL('../ui/CategoryBrowse.jsx', import.meta.url), 'utf8')
const catalogCard = readFileSync(new URL('../ui/CatalogCard.jsx', import.meta.url), 'utf8')
const libraryActions = readFileSync(new URL('../ui/LibraryActions.jsx', import.meta.url), 'utf8')
const libraryTabs = readFileSync(new URL('../ui/LibraryTabs.jsx', import.meta.url), 'utf8')
const detailView = readFileSync(new URL('../ui/DetailView.jsx', import.meta.url), 'utf8')

const app = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')

test('update review restores its opener independently of busy-state effects', () => {
  assert.match(updateReview, /openerRef\.current = document\.activeElement/)
  assert.match(updateReview, /document\.contains\(opener\)/)
  assert.match(updateReview, /\}, \[\]\)\n\n  useEffect\(\(\) => \{/)
})

test('a retry needs a fresh check and confirmation; agent review stays available', () => {
  const controller = readFileSync(new URL('../update-batch.js', import.meta.url), 'utf8')
  // Try again re-checks the release (read-only) and never resubmits it.
  assert.match(controller, /async retry\(id\) \{[\s\S]*?await check\(\[entry\.item\]\)/)
  assert.match(controller, /const approved = state\.entries\.filter\(entry => entry\.status === 'ready'\)/)
  assert.match(updateReview, /onClick=\{onConfirm\} disabled=\{locked\}/)
  assert.match(updateReview, /Review with agent/)
  assert.match(app, /onAskAgent=\{handleAgentUpdateReview\}/)
  assert.match(app, /buildUpdateReviewMessage\(context\)/)
  assert.match(app, /buildUpdateFailureMessage\(\{ \.\.\.context, error: entry\.error \}\)/)
})

test('Discover, Apps, Games and Library form one keyboard-navigable tab set', () => {
  assert.match(app, /const order = \['browse', 'apps', 'games', 'library'\]/)
  assert.match(app, /role="tablist" aria-label="Store sections"/)
  for (const [id, label] of [['browse', 'Discover'], ['apps', 'Apps'], ['games', 'Games'], ['library', 'Library']]) {
    assert.match(app, new RegExp(`\\{ id: '${id}', label: '${label}' \\}`))
  }
  assert.match(app, /id=\{`st-tab-\$\{id\}`\}/)
  assert.match(app, /aria-selected=\{selected\}/)
  // Publishing is Library's Your apps tab, so there is no separate page.
  assert.doesNotMatch(app, /tab === 'publish'/)
  assert.match(app, /className="st-upload-btn" onClick=\{\(\) => openYourApps\('choose'\)\}/)
  // The panel is a tabpanel only while tabs are shown: a creator page hides them.
  assert.match(app, /role=\{creatorOpen \? undefined : 'tabpanel'\}/)
  // Wider screens label the panel by its header tab; phones (no header tabs)
  // name it directly, and the bottom bar adds Search.
  assert.match(app, /aria-labelledby=\{phone \|\| creatorOpen \? undefined : `st-tab-\$\{tab\}`\}/)
  assert.match(app, /aria-label=\{phone && !creatorOpen \? PHONE_TABS\.find/)
  assert.match(app, /const PHONE_TABS = \[\.\.\.STORE_TABS, \{ id: 'search', label: 'Search' \}\]/)
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

test('Discover keeps its pausable auto-advancing spotlight carousel at the top', () => {
  assert.match(catalogList, /hostedSpotlights\.length \? hostedSpotlights : bundledSpotlights\(items\)/)
  assert.match(catalogList, /Array\.isArray\(spotlightFeed\?\.items\)/)
  assert.match(spotlight, /className="st-spotlight-stage"/)
  assert.match(spotlight, /className="st-spotlight-pagination"/)
  assert.match(spotlight, /aria-current=\{index === activeIndex/)
  // The visible six-second progress segment is the clock: its end advances,
  // and pausing pauses the same animation, so the two can never disagree.
  assert.match(spotlight, /onAnimationEnd=\{\(\) => go\(activeIndex \+ 1\)\}/)
  assert.match(spotlight, /st-spotlight-fill\$\{autoPaused \? ' is-paused' : ''\}/)
  assert.match(theme, /animation: st-spot-fill 6s linear forwards/)
  assert.match(theme, /\.st-spotlight-fill\.is-paused \{ animation-play-state: paused/)
  // Reduced motion renders no running segment, so nothing advances by itself.
  assert.match(spotlight, /const playing = count > 1 && !reducedMotion/)
  assert.match(spotlight, /prefers-reduced-motion: reduce/)
  assert.match(spotlight, /document\.visibilityState !== 'hidden'/)
  assert.match(spotlight, /onMouseEnter=/)
  assert.match(spotlight, /onFocusCapture=/)
  assert.match(spotlight, /onTouchStart=/)
  assert.match(spotlight, /`Pause \$\{title\.toLowerCase\(\)\}`/)
  assert.match(spotlight, /`Resume \$\{title\.toLowerCase\(\)\}`/)
  assert.doesNotMatch(spotlight, /setInterval|autoPlay|autoplay/)
  assert.match(spotlight, /className="st-spotlight-open"/)
  assert.match(catalogList, /renderCard\(item, 'row'\)/)
  assert.doesNotMatch(catalogList, /role="button"/)
  assert.doesNotMatch(categoryBrowse, /role="button"/)
})

test('shared-listing refresh stays accessible without inserting a visible progress row', () => {
  assert.match(catalogList, /aria-busy=\{searchLoading \|\| undefined\}/)
  assert.match(catalogList, /className="st-sr-only" role="status" aria-live="polite"/)
  assert.doesNotMatch(catalogList, /st-registry-progress/)
  assert.doesNotMatch(catalogList, />Searching shared listings…</)
})

test('browse cards reserve accepted screenshots for the app description', () => {
  assert.doesNotMatch(catalogCard, /StoreImage|st-card-preview|listingScreenshot/)
  assert.match(detailView, /st-detail-gallery[\s\S]*<p className="st-detail-desc">\{listingDescription\}<\/p>/)
  assert.match(detailView, /listingScreenshots\.map/)
  assert.match(detailView, /function ScreenshotViewer/)
})

test('catalog cards use one labelled icon action without repeating routine lifecycle text', () => {
  assert.match(catalogCard, /ArrowRotateCw, ArrowUpRight, Chat, Check, DotsVertical, Download/)
  assert.match(catalogCard, /aria-label=\{`\$\{actionLabel\} \$\{m\.name\}`\}/)
  assert.match(catalogCard, /title=\{actionLabel\}/)
  assert.match(catalogCard, /\['unavailable', 'conflict', 'rejected', 'unverified'\]\.includes\(lifecycle\.key\)/)
  assert.doesNotMatch(catalogCard, />\s*\{actionLabel\}\s*<\/button>/)
})

test('Browse keeps update controls in Library instead of spending discovery space', () => {
  // Update all lives only above the Library Updates tab: not in the header and
  // never inside Discover's content. The Library tab's count says updates wait.
  assert.equal(app.match(/<UpdateAllButton /g)?.length, 1)
  assert.match(app, /libraryTab === 'update' && updateAllCount > 0 \? \(\s*<div className="st-libbar">/)
  assert.doesNotMatch(app, /st-tab-updateall/)
  assert.match(app, /<div className="st-tablist" role="tablist" aria-label="Store sections"/)
})

test('Library exposes one Update all action and keyboard-reachable tabs', () => {
  assert.match(libraryActions, /: 'Update all'/)
  assert.match(libraryActions, /aria-label=\{`Update all/)
  assert.match(libraryTabs, /role="tablist" aria-label="Library"/)
  assert.match(libraryTabs, /aria-selected=\{selected\}/)
  assert.match(libraryTabs, /tabIndex=\{selected \? 0 : -1\}/)
  assert.match(libraryTabs, /event\.key !== 'ArrowLeft' && event\.key !== 'ArrowRight'/)
})

test('Discover leads with the Spotlight carousel, then featured cards, rated and picked panels, rankings, honest shelves and categories', () => {
  const home = catalogList.slice(catalogList.indexOf('if (discover) {'))
  const order = ['<Spotlight ', 'title="Highest rated"', 'title="Our picks"', "rankedShelf('trending'", "rankedShelf('most-downloaded'", 'id="updated"', 'id="arrivals"', '<CategoryList ']
    .map(marker => home.indexOf(marker))
  assert.ok(order.every(index => index >= 0), String(order))
  assert.deepEqual([...order].sort((a, b) => a - b), order)
})
