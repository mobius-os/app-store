import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const updateReview = readFileSync(new URL('../ui/UpdateReviewModal.jsx', import.meta.url), 'utf8')
const updateAll = readFileSync(new URL('../ui/UpdateAllModal.jsx', import.meta.url), 'utf8')
const catalogList = readFileSync(new URL('../ui/CatalogList.jsx', import.meta.url), 'utf8')
const catalogCard = readFileSync(new URL('../ui/CatalogCard.jsx', import.meta.url), 'utf8')
const catalogFilters = readFileSync(new URL('../ui/CatalogFilters.jsx', import.meta.url), 'utf8')

const app = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')

test('update review restores its opener independently of busy-state effects', () => {
  assert.match(updateReview, /openerRef\.current = document\.activeElement/)
  assert.match(updateReview, /document\.contains\(opener\)/)
  assert.match(updateReview, /\}, \[\]\)\n\n  useEffect\(\(\) => \{/)
})

test('update all traps focus and restores its opener', () => {
  assert.match(updateAll, /aria-modal="true"/)
  assert.match(updateAll, /openerRef\.current = document\.activeElement/)
  assert.match(updateAll, /document\.contains\(opener\)/)
  assert.match(updateAll, /event\.key === 'Escape'/)
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

test('Browse presents several explicit spotlight actions without turning cards into buttons', () => {
  assert.match(catalogList, /filter\(\(item\) => listingHero\(item\)\)\.slice\(0, 3\)/)
  assert.match(catalogList, /className="st-spotlight-open"/)
  assert.match(catalogList, /className="st-btn st-btn-primary"/)
  assert.doesNotMatch(catalogList, /role="button"/)
})

test('official and community cards render their accepted listing screenshots', () => {
  assert.match(catalogCard, /listing\?\.screenshots\?\.\[0\]/)
  assert.match(catalogCard, /<CatalogStoreImage storeAppId=\{appId\}/)
  assert.match(catalogCard, /<StoreImage item=\{item\}/)
})

test('Browse keeps update controls in Library instead of spending discovery space', () => {
  assert.match(catalogFilters, /mode === 'library' \? \(/)
  assert.match(catalogFilters, /aria-label="Library filters"/)
})
