import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const updateReview = readFileSync(new URL('../ui/UpdateReviewModal.jsx', import.meta.url), 'utf8')
const updateAll = readFileSync(new URL('../ui/UpdateAllModal.jsx', import.meta.url), 'utf8')

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
