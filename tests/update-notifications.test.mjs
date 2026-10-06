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
