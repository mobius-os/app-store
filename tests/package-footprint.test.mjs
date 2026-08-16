import test from 'node:test'
import assert from 'node:assert/strict'

import { calculatePackageFootprint } from '../scripts/package-footprint.mjs'

const manifest = {
  id: 'weighted-app',
  name: 'Weighted app',
  version: '2.4.0',
  description: 'test',
  entry: 'index.jsx',
  icon: 'icon.png',
  source_files: ['helper.js'],
  static_assets: { 'images/hero.txt': 'assets/hero.txt' },
  storage_seeds: { 'settings.json': { enabled: true } },
}

const files = new Map([
  ['index.jsx', Buffer.from('export default 1')],
  ['icon.png', Buffer.from('icon')],
  ['helper.js', Buffer.from('export const helper = 1')],
  ['assets/hero.txt', Buffer.from('hero')],
])

test('package footprint is versioned, deterministic, and ignores its generated field', async () => {
  const read = async path => files.get(path)
  const first = await calculatePackageFootprint(manifest, read)
  const stamped = await calculatePackageFootprint({
    ...manifest,
    package_footprint: { ...first, estimated_install_bytes: 99 },
  }, read)

  assert.deepEqual(stamped, first)
  assert.equal(first.schema, 1)
  assert.equal(first.version, manifest.version)
  assert.match(first.content_sha256, /^[0-9a-f]{64}$/)
  assert.ok(first.payload_bytes > 0)
  assert.equal(first.estimated_install_bytes, 1024 * 1024)
})

test('package footprint changes when declared package bytes change', async () => {
  const first = await calculatePackageFootprint(manifest, path => files.get(path))
  const second = await calculatePackageFootprint(manifest, path => (
    path === 'helper.js' ? Buffer.from('export const helper = 2') : files.get(path)
  ))

  assert.notEqual(second.content_sha256, first.content_sha256)
})
