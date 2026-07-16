import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const updateReview = readFileSync(new URL('../ui/UpdateReviewModal.jsx', import.meta.url), 'utf8')

test('update review restores its opener independently of busy-state effects', () => {
  assert.match(updateReview, /openerRef\.current = document\.activeElement/)
  assert.match(updateReview, /document\.contains\(opener\)/)
  assert.match(updateReview, /\}, \[\]\)\n\n  useEffect\(\(\) => \{/)
})
