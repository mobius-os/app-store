import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const updateReview = readFileSync(new URL('../ui/UpdateReviewModal.jsx', import.meta.url), 'utf8')
const updateAll = readFileSync(new URL('../ui/UpdateAllModal.jsx', import.meta.url), 'utf8')

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

const batchReview = readFileSync(new URL('../ui/BatchInstallModal.jsx', import.meta.url), 'utf8')
const catalogCard = readFileSync(new URL('../ui/CatalogCard.jsx', import.meta.url), 'utf8')
const indexSource = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
const theme = readFileSync(new URL('../theme.js', import.meta.url), 'utf8')

test('batch installs keep selection, review, and approval accessible', () => {
  assert.match(catalogCard, /type="checkbox"/)
  assert.match(catalogCard, /aria-label={`Select \${m\.name} for batch install`}/)
  assert.match(theme, /\.st-card-select \{[\s\S]*width: 44px; height: 44px;/)
  assert.match(batchReview, /role="dialog"/)
  assert.match(batchReview, /aria-modal="true"/)
  assert.match(batchReview, /Review selected apps/)
  assert.match(indexSource, /reviewed_capability_digest: batchReview\.reviews\[item\.id\]\.preview\.capability_digest/)
  assert.match(indexSource, /currentItemIndex: itemIndex/)
})
