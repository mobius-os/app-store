import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  storeDestinationFromIntent,
  storeDestinationFromMessage,
} from '../domain.js'

test('Store update intents open the Library or the selected app review', () => {
  assert.deepEqual(storeDestinationFromIntent('updates'), { kind: 'updates' })
  assert.deepEqual(storeDestinationFromIntent('update:42'), {
    kind: 'review-update', appId: '42',
  })
  assert.equal(storeDestinationFromIntent('update:0'), null)
  assert.equal(storeDestinationFromIntent('update:app'), null)
  assert.deepEqual(storeDestinationFromIntent(' app:Voice '), {
    kind: 'app', itemId: 'voice',
  })
  assert.equal(storeDestinationFromIntent('update-now'), null)
})

test('Store intents accept only the mounted parent and current origin', () => {
  const source = {}
  const event = {
    origin: 'https://mobius.test',
    source,
    data: { type: 'moebius:app-intent', intent: 'updates' },
  }
  assert.deepEqual(
    storeDestinationFromMessage(event, 'https://mobius.test', source),
    { kind: 'updates' },
  )
  assert.equal(storeDestinationFromMessage(event, 'https://evil.test', source), null)
  assert.equal(storeDestinationFromMessage(event, 'https://mobius.test', {}), null)
  event.data.intent = 'update:42'
  assert.deepEqual(
    storeDestinationFromMessage(event, 'https://mobius.test', source),
    { kind: 'review-update', appId: '42' },
  )
})

test('per-app update intent opens the existing update review path without applying', () => {
  const source = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
  const start = source.indexOf("if (intentDestination.kind === 'review-update')")
  const end = source.indexOf("if (intentDestination.kind === 'updates')", start)
  assert.ok(start >= 0 && end > start)
  const branch = source.slice(start, end)
  assert.match(branch, /selectTab\('library'\)/)
  assert.match(branch, /setCategory\('update'\)/)
  assert.match(branch, /handleCatalogUpdate\(item, \{ isUpdate: true \}\)/)
  assert.doesNotMatch(branch, /handleApplyReviewedUpdate|handleInstall\(/)
})

 test('Updates intent closes owned detail navigation before switching to Library', () => {
  const source = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
  const branch = source.slice(source.indexOf("if (intentDestination.kind === 'updates')"), source.indexOf('const resolution = resolveCatalogItemIntent(displayCatalog'))
  assert.ok(branch.indexOf('closeDetail()') >= 0)
  assert.ok(branch.indexOf('closeDetail()') < branch.indexOf("selectTab('library')"))
  assert.doesNotMatch(branch, /navDetailRef.current = null|setDetail\(null\)/)
})
