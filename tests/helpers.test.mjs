import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import test from 'node:test'

const execFileAsync = promisify(execFile)
const root = dirname(fileURLToPath(import.meta.url))
const buildDir = join(root, '.build')
const bundled = join(buildDir, 'index.mjs')

async function bundle() {
  await rm(buildDir, { recursive: true, force: true })
  await mkdir(buildDir, { recursive: true })
  await execFileAsync('/home/hmzmrzx/projects/mobius/frontend/node_modules/.bin/esbuild', [
    join(root, '..', 'index.jsx'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    '--jsx=automatic',
    `--outfile=${bundled}`,
  ])
  return import(pathToFileURL(bundled))
}

test('canonicalIdentityKey matches backend-style manifest identities', async () => {
  const { canonicalIdentityKey } = await bundle()

  assert.equal(
    canonicalIdentityKey('https://raw.githubusercontent.com/mobius-os/app-news/main/mobius.json?cache=1#old', 'news'),
    'https://raw.githubusercontent.com/mobius-os/app-news/main#manifest-id=news',
  )
  assert.equal(
    canonicalIdentityKey('https://example.test/apps/custom/manifest.json', 'custom'),
    'https://example.test/apps/custom#manifest-id=custom',
  )
})

test('validateManifestUrl only accepts http(s) manifest URLs', async () => {
  const { validateManifestUrl } = await bundle()

  assert.equal(validateManifestUrl(' https://example.test/mobius.json '), 'https://example.test/mobius.json')
  assert.equal(validateManifestUrl('http://localhost:3000/mobius.json'), 'http://localhost:3000/mobius.json')
  assert.throws(() => validateManifestUrl('file:///tmp/mobius.json'), /http/)
  assert.throws(() => validateManifestUrl('/mobius.json'), /valid/)
})

test('scheduleSummary handles cron and on-demand jobs', async () => {
  const { scheduleSummary } = await bundle()

  assert.equal(scheduleSummary({ default: '0 6 * * *' }), 'Runs daily at 06:00 UTC')
  assert.equal(scheduleSummary({ job: 'build.sh' }), 'Runs on demand from inside the app')
  assert.equal(scheduleSummary(null), '')
})

test('normalizeInstalledVersions keeps only catalog version strings', async () => {
  const { normalizeInstalledVersions } = await bundle()

  assert.deepEqual(
    normalizeInstalledVersions('{"news":"1.2.0","gym":4,"":"","atlas":"0.3.0"}'),
    { news: '1.2.0', atlas: '0.3.0' },
  )
  assert.deepEqual(normalizeInstalledVersions(['news']), {})
  assert.deepEqual(normalizeInstalledVersions('{bad'), {})
  assert.deepEqual(normalizeInstalledVersions(null), {})
})

test('semverCmp handles releases and pre-releases', async () => {
  const { semverCmp } = await bundle()

  assert.equal(semverCmp('1.2.0-rc.1', '1.2.0'), -1)
  assert.equal(semverCmp('1.2.1', '1.2.0'), 1)
  assert.equal(semverCmp('1.2.0+build.2', '1.2.0'), 0)
  // SemVer §11: numeric pre-release identifiers compare numerically, so
  // rc.2 < rc.10 (a plain lexical compare gets this backwards).
  assert.equal(semverCmp('1.2.0-rc.2', '1.2.0-rc.10'), -1)
  assert.equal(semverCmp('1.2.0-rc.10', '1.2.0-rc.2'), 1)
  // Numeric identifiers rank below alphanumeric; fewer identifiers rank lower.
  assert.equal(semverCmp('1.0.0-alpha', '1.0.0-alpha.1'), -1)
  assert.equal(semverCmp('1.0.0-1', '1.0.0-alpha'), -1)
})
