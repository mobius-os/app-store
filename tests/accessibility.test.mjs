import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const updateReview = readFileSync(new URL('../ui/UpdateReviewModal.jsx', import.meta.url), 'utf8')
const updateAll = readFileSync(new URL('../ui/UpdateAllModal.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
const community = readFileSync(new URL('../ui/CommunityTab.jsx', import.meta.url), 'utf8')

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

test('Official and Community form one keyboard-navigable tab set', () => {
  assert.match(app, /const order = \['official', 'community'\]/)
  assert.match(app, /role="tab" id="st-tab-official"/)
  assert.match(app, /role="tab" id="st-tab-community"/)
  assert.match(app, /role="tabpanel"/)
})

test('App Store preserves its reviewed immersive hold gesture', () => {
  assert.match(app, /window\.mobius\.immersive\.holdToToggle/)
})

test('Community preserves the reviewed manifest preview flow', () => {
  assert.match(community, /<FromUrlTab onPreview=\{onPreview\} token=\{token\} \/>/)
  assert.match(community, /aria-label="Publish your apps"/)
  assert.match(community, /Coming soon/)
})
