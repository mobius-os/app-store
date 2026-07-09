import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import test from 'node:test'

const execFileAsync = promisify(execFile)
const root = dirname(fileURLToPath(import.meta.url))
const buildDir = join(root, '.build')
const bundled = join(buildDir, 'index.mjs')
const reactStub = join(root, 'react-stub.mjs')

async function bundle() {
  await rm(buildDir, { recursive: true, force: true })
  await mkdir(buildDir, { recursive: true })
  await execFileAsync('/home/hmzmrzx/projects/mobius/frontend/node_modules/.bin/esbuild', [
    join(root, '..', 'index.jsx'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    '--jsx=automatic',
    `--alias:react=${reactStub}`,
    `--alias:react/jsx-runtime=${reactStub}`,
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

test('findInstalled matches canonical manifest identity, not slug', async () => {
  const { findInstalled } = await bundle()
  const installed = [
    {
      id: 55,
      slug: 'cuberun-2',
      name: 'CubeRun',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main#manifest-id=cuberun',
      version: '1.0.0-mobius.4',
    },
  ]
  const item = {
    id: 'cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/mobius.json',
    manifest: { id: 'cuberun' },
  }

  assert.equal(findInstalled(installed, item), installed[0])
})

test('validateManifestUrl only accepts http(s) manifest URLs', async () => {
  const { validateManifestUrl } = await bundle()

  assert.equal(validateManifestUrl(' https://example.test/mobius.json '), 'https://example.test/mobius.json')
  assert.equal(validateManifestUrl('http://localhost:3000/mobius.json'), 'http://localhost:3000/mobius.json')
  assert.throws(() => validateManifestUrl('file:///tmp/mobius.json'), /http/)
  assert.throws(() => validateManifestUrl('/mobius.json'), /valid/)
})

test('fetchManifest retries transient manifest failures', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) {
      return new Response('temporarily unavailable', { status: 503 })
    }
    return new Response(JSON.stringify({ id: 'notes', version: '1.0.0' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { fetchManifest } = await bundle()
    const manifest = await fetchManifest('https://example.test/mobius.json', 'tok', {
      retries: 1,
      retryDelayMs: 0,
    })
    assert.equal(calls, 2)
    assert.deepEqual(manifest, { id: 'notes', version: '1.0.0' })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchManifest does not rapidly retry upstream rate limits', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    return new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '60' },
    })
  }
  try {
    const { fetchManifest } = await bundle()
    await assert.rejects(
      () => fetchManifest('https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json', 'tok', {
        retries: 2,
        retryDelayMs: 0,
      }),
      /GitHub rate-limited.*60 seconds/,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchCatalog preserves valid embedded manifests only', async () => {
  const oldFetch = globalThis.fetch
  globalThis.fetch = async (_url, _opts) => new Response(JSON.stringify({
    apps: [
      {
        id: 'notes',
        repo: 'mobius-os/app-notes',
        manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
        raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
        manifest: {
          id: 'notes',
          name: 'Notes',
          version: '1.2.3',
          description: 'Capture notes.',
          entry: 'index.jsx',
        },
      },
      {
        id: 'bad-snapshot',
        manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-bad/main/mobius.json',
        raw_base: 'https://raw.githubusercontent.com/mobius-os/app-bad/main/',
        manifest: { id: 'bad-snapshot', name: 'Bad' },
      },
    ],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
  try {
    const { fetchCatalog } = await bundle()
    const entries = await fetchCatalog('https://example.test/catalog.json', 'tok')
    assert.equal(entries.length, 2)
    assert.deepEqual(entries[0].manifest, {
      id: 'notes',
      name: 'Notes',
      version: '1.2.3',
      description: 'Capture notes.',
      entry: 'index.jsx',
    })
    assert.equal(entries[1].manifest, null)
  } finally {
    globalThis.fetch = oldFetch
  }
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

test('STORE_VERSION stays in lockstep with mobius.json', async () => {
  const manifest = JSON.parse(await readFile(join(root, '..', 'mobius.json'), 'utf8'))
  const { STORE_VERSION } = await bundle()
  assert.equal(STORE_VERSION, manifest.version)
})
