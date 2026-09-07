import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  storeDestinationFromIntent,
  storeDestinationFromMessage,
} from '../domain.js'

test('the update notification intent opens the Store update destination', () => {
  assert.deepEqual(storeDestinationFromIntent('updates'), { kind: 'updates' })
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
})

 test('Updates intent closes owned detail navigation before switching to Library', () => {
  const source = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
  const branch = source.slice(source.indexOf("if (intentDestination.kind === 'updates')"), source.indexOf('const resolution = resolveCatalogItemIntent(displayCatalog'))
  assert.ok(branch.indexOf('closeDetail()') >= 0)
  assert.ok(branch.indexOf('closeDetail()') < branch.indexOf("selectTab('library')"))
  assert.doesNotMatch(branch, /navDetailRef.current = null|setDetail\(null\)/)
})
