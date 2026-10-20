import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatDownloadSize } from '../domain.js'

const root = dirname(fileURLToPath(import.meta.url))

test('download size reads in whole KB below a megabyte and one-decimal MB above', () => {
  assert.equal(formatDownloadSize(415_369), '415 KB')
  assert.equal(formatDownloadSize(4_557_924), '4.6 MB')
  assert.equal(formatDownloadSize(999_600), '1.0 MB')
  assert.equal(formatDownloadSize(0), '1 KB')
})

test('an unknown download size shows nothing rather than a guess', () => {
  for (const unknown of [null, undefined, -1, Number.NaN, '4557924']) {
    assert.equal(formatDownloadSize(unknown), '')
  }
})

test('the listing byline shows the reviewed download size', async () => {
  const detail = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.match(detail, /formatDownloadSize\(capabilityReview\?\.preview\?\.download_bytes\)/)
  assert.match(detail, /`\$\{downloadSize\} download`/)
})
