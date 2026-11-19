import assert from 'node:assert/strict'
import test from 'node:test'
import { CSS } from '../theme.js'

test('detail screenshots keep natural proportions; only loading placeholders reserve a landscape shape', () => {
  const imageRule = CSS.match(/\.st-detail-gallery-image,\s*\.st-detail-gallery \.st-store-image-placeholder \{([^}]+)\}/)?.[1]
  assert.ok(imageRule, 'the shared gallery image rule exists')
  assert.match(imageRule, /aspect-ratio:\s*auto;/)
  assert.match(CSS, /\.st-detail-gallery \.st-store-image-placeholder \{ aspect-ratio: 5 \/ 3;/)
})
