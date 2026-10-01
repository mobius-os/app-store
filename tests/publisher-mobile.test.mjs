import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const publisher = readFileSync(new URL('../ui/PublisherTab.jsx', import.meta.url), 'utf8')
const theme = readFileSync(new URL('../theme.js', import.meta.url), 'utf8')

test('phone publishing puts the release decision before the long listing details', () => {
  const readyLayout = publisher.slice(
    publisher.indexOf('<div className="st-listing-ready-layout">'),
    publisher.indexOf('</section>', publisher.indexOf('<div className="st-listing-ready-layout">')),
  )

  assert.ok(readyLayout.indexOf('className="st-listing-hero"') >= 0)
  assert.ok(readyLayout.indexOf('className="st-listing-release-panel"') > readyLayout.indexOf('className="st-listing-hero"'))
  assert.ok(readyLayout.indexOf('className="st-listing-body"') > readyLayout.indexOf('className="st-listing-release-panel"'))
  assert.match(theme, /grid-template-areas:\s*"hero"\s*"release"\s*"body"/)
  assert.match(theme, /\.st-listing-release-panel > \.st-btn-primary \{ min-height: 48px; \}/)
})
