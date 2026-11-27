import assert from 'node:assert/strict'
import test from 'node:test'
import { CSS } from '../theme.js'

test('detail screenshots keep natural proportions; only loading placeholders reserve a landscape shape', () => {
  const imageRule = CSS.match(/\.st-detail-gallery-image,\s*\.st-detail-gallery \.st-store-image-placeholder \{([^}]+)\}/)?.[1]
  assert.ok(imageRule, 'the shared gallery image rule exists')
  assert.match(imageRule, /aspect-ratio:\s*auto;/)
  assert.match(CSS, /\.st-detail-gallery \.st-store-image-placeholder \{ aspect-ratio: 5 \/ 3;/)
})

test('on desktop a loading or failed screenshot tile is as tall as the loaded image, so the page below does not move', () => {
  const desktop = CSS.split('@media (min-width: 681px) {').slice(1).map(block => block.split('\n}')[0])
    .find(block => block.includes('.st-shot .st-detail-gallery-image {'))
  assert.ok(desktop, 'the desktop block sizes gallery images')
  const imageHeight = desktop.match(/\.st-shot \.st-detail-gallery-image \{ height: ([^;]+);/)?.[1]
  const placeholder = desktop.match(/\.st-shot:not\(\[data-state="ready"\]\) \{([^}]+)\}/)?.[1]
  assert.ok(imageHeight && placeholder, 'both the image and the not-ready tile are sized on desktop')
  assert.match(placeholder, new RegExp(`height: ${imageHeight.replace(/[()]/g, '\\$&')};`))
  assert.match(placeholder, /aspect-ratio: auto;/)
})
