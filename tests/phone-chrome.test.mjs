import assert from 'node:assert/strict'
import test from 'node:test'
import { isPhoneScreen } from '../ui/phoneChrome.js'

test('a narrow desktop pane never asks Möbius to hide its bars', () => {
  // The Store frame can be phone-narrow inside a desktop split; the screen is not.
  assert.equal(isPhoneScreen({ width: 2560, height: 1440 }), false)
  assert.equal(isPhoneScreen({ width: 1280, height: 720 }), false)
})

test('a phone screen asks in either orientation', () => {
  assert.equal(isPhoneScreen({ width: 390, height: 844 }), true)
  assert.equal(isPhoneScreen({ width: 844, height: 390 }), true)
})

test('an unknown screen keeps the Möbius bars', () => {
  assert.equal(isPhoneScreen(null), false)
  assert.equal(isPhoneScreen({ width: 0, height: 0 }), false)
})
