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
const esbuildBin = process.env.ESBUILD_BIN || 'esbuild'

async function bundle() {
  await rm(buildDir, { recursive: true, force: true })
  await mkdir(buildDir, { recursive: true })
  await execFileAsync(esbuildBin, [
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

test('findInstalled ignores legacy platform rows without canonical identity', async () => {
  const { findInstalled } = await bundle()
  const memory = {
    id: 9,
    slug: 'memory',
    name: 'Memory',
    manifest_url: null,
    source_dir: '/data/platform/core-apps/memory',
    version: '1.6.3',
  }
  const custom = {
    id: 10,
    slug: 'notes',
    name: 'Notes',
    manifest_url: null,
    source_dir: '/data/platform/core-apps/notes',
    version: '0.1.0',
  }

  assert.equal(findInstalled([memory], {
    id: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json',
    manifest: { id: 'memory' },
  }), null)
  assert.equal(findInstalled([custom], {
    id: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    manifest: { id: 'notes' },
  }), null)
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

test('fetchManifest retries transient network errors with a friendly message', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) throw new TypeError('Failed to fetch')
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

test('readErrorDetail handles non-JSON update errors without rereading the body', async () => {
  const { readErrorDetail } = await bundle()
  const response = new Response('upstream returned an invalid manifest', { status: 502 })

  assert.equal(
    await readErrorDetail(response, 'Update failed'),
    'upstream returned an invalid manifest',
  )
})

test('readErrorDetail formats FastAPI validation payloads', async () => {
  const { readErrorDetail } = await bundle()
  const response = new Response(JSON.stringify({
    detail: [{ loc: ['body', 'manifest_url'], msg: 'Field required' }],
  }), {
    status: 422,
    headers: { 'content-type': 'application/json' },
  })

  assert.equal(
    await readErrorDetail(response, 'Update failed'),
    'body.manifest_url: Field required',
  )
})

test('loadInstalledApps retries transient app-list failures', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) {
      return new Response('temporarily unavailable', { status: 503 })
    }
    return new Response(JSON.stringify([{ id: 1, slug: 'notes' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { loadInstalledApps } = await bundle()
    const apps = await loadInstalledApps('tok', { retries: 1, retryDelayMs: 0 })
    assert.equal(calls, 2)
    assert.deepEqual(apps, [{ id: 1, slug: 'notes' }])
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('loadInstalledApps throws on non-retryable app-list failures', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    return new Response('unauthorized', { status: 401 })
  }
  try {
    const { loadInstalledApps } = await bundle()
    await assert.rejects(
      () => loadInstalledApps('tok', { retries: 2, retryDelayMs: 0 }),
      /Installed apps could not be loaded \(401\)/,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchCatalog retries transient failures and preserves app metadata', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) {
      return new Response('temporarily unavailable', { status: 503 })
    }
    return new Response(JSON.stringify({
    apps: [
      {
        id: 'notes',
        repo: 'mobius-os/app-notes',
        manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
        raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
        categories: ['productivity', 'writing', 'writing'],
        keywords: ['notes', 'markdown'],
        capabilities: ['write markdown notes'],
        setup: {
          required: true,
          scope: 'app',
          label: 'Notes setup',
          description: 'Configure notes.',
          fields: ['theme'],
        },
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
  }
  try {
    const { fetchCatalog } = await bundle()
    const entries = await fetchCatalog('https://example.test/catalog.json', 'tok', {
      retries: 1,
      retryDelayMs: 0,
    })
    assert.equal(calls, 2)
    assert.equal(entries.length, 2)
    assert.deepEqual(entries[0].categories, ['productivity', 'writing'])
    assert.deepEqual(entries[0].keywords, ['notes', 'markdown'])
    assert.deepEqual(entries[0].capabilities, ['write markdown notes'])
    assert.deepEqual(entries[0].setup, {
      required: true,
      scope: 'app',
      section: '',
      label: 'Notes setup',
      description: 'Configure notes.',
      action: 'Open app',
      fields: ['theme'],
    })
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

test('installApp prefers live manifest_url over embedded manifest snapshots', async () => {
  const oldFetch = globalThis.fetch
  const bodies = []
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, '/api/apps/install')
    bodies.push(JSON.parse(opts.body))
    return new Response(JSON.stringify({
      id: 12,
      slug: 'notes',
      name: 'Notes',
      version: '1.2.4',
      mode: 'update',
      divergence: 'fast_forward',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { installApp } = await bundle()
    const result = await installApp({
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
      manifest: { id: 'notes', name: 'Notes', version: '1.0.0', entry: 'index.jsx' },
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
      token: 'tok',
    })
    assert.equal(result.version, '1.2.4')
    assert.deepEqual(bodies, [{
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    }])
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('review digests bind capability and source previews to install', async () => {
  const oldFetch = globalThis.fetch
  const calls = []
  const digest = 'a'.repeat(64)
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) })
    if (url === '/api/apps/preview') {
      return new Response(JSON.stringify({
        manifest: { id: 'memory', name: 'Memory', version: '2.0.0', description: 'Memory', entry: 'index.jsx' },
        capability_contract: { schema: 1, system_app: true, agent: {}, data: {}, background: null },
        capability_digest: digest,
        installed_contract: null,
        capability_diff: { unknown_previous: true, added: [], removed: [], changed: [] },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({
      id: 57, slug: 'memory', name: 'Memory', version: '2.0.0', mode: 'install',
    }), { status: 201, headers: { 'content-type': 'application/json' } })
  }
  try {
    const { previewApp, installApp } = await bundle()
    const source = 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json'
    const preview = await previewApp({ manifest_url: source, token: 'tok' })
    await installApp({
      manifest_url: source,
      reviewed_capability_digest: preview.capability_digest,
      reviewed_source_digest: 'c'.repeat(64),
      token: 'tok',
    })
    assert.deepEqual(calls, [
      { url: '/api/apps/preview', body: { manifest_url: source } },
      {
        url: '/api/apps/install',
        body: {
          manifest_url: source,
          reviewed_capability_digest: digest,
          reviewed_source_digest: 'c'.repeat(64),
        },
      },
    ])
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('source-change 409 asks the UI to refresh instead of applying', async () => {
  const oldFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: {
    code: 'update_changed',
    message: 'Source changed.',
  } }), { status: 409, headers: { 'content-type': 'application/json' } })
  try {
    const { installApp } = await bundle()
    await assert.rejects(
      installApp({
        manifest_url: 'https://example.test/mobius.json',
        reviewed_source_digest: 'c'.repeat(64),
        token: 'tok',
      }),
      (error) => error.code === 'update_changed',
    )
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('capability-change 409 exposes the new contract without retrying install', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response(JSON.stringify({ detail: {
      code: 'capability_changed',
      message: 'Capabilities changed.',
      manifest: { id: 'memory', version: '2.0.1' },
      capability_contract: { schema: 1, system_app: true },
      capability_digest: 'b'.repeat(64),
    } }), { status: 409, headers: { 'content-type': 'application/json' } })
  }
  try {
    const { installApp } = await bundle()
    await assert.rejects(
      installApp({
        manifest_url: 'https://example.test/mobius.json',
        reviewed_capability_digest: 'a'.repeat(64),
        token: 'tok',
      }),
      (error) => {
        assert.equal(error.code, 'capability_changed')
        assert.equal(error.preview.capability_digest, 'b'.repeat(64))
        return true
      },
    )
    assert.equal(calls, 1, 'the failed install is never auto-retried')
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('capability rows describe system prompt, redacted logs, and scoped job generically', async () => {
  const { capabilityRows } = await bundle()
  const rows = capabilityRows({
    schema: 1,
    system_app: true,
    agent: {
      system_prompt: { file: 'memory-core.md', scope: 'all_agent_chats', activation: 'next_turn' },
      skills: ['memory.md'], embeds_agent: false,
    },
    data: {
      chat_logs: { effective: 'summary', redaction: 'structural' },
      shared_memory: 'write', cross_app_access: 'none', share_with_apps: 'read',
      filesystem_api: false, github_access: false, manage_apps: false,
    },
    background: {
      mode: 'scheduled', cron: '30 5 * * *', job: 'fetch.sh', agent: true,
      initialize_on_install: true, authority: 'scoped_system_job',
    },
  })
  assert.match(rows.find(row => row.label === 'Agent chats').summary, /every agent chat/)
  assert.match(rows.find(row => row.label === 'Chat history').summary, /structurally redacted/)
  assert.match(rows.find(row => row.label === 'Background work').summary, /initialization run/)
  assert.match(rows.find(row => row.label === 'Shares its data').summary, /read this app’s private data/)
  assert.ok(rows.every(row => !/Memory app/i.test(row.summary)), 'renderer has no app-specific branch')
})

test('ordinary background jobs disclose host process authority', async () => {
  const { capabilityRows } = await bundle()
  const rows = capabilityRows({
    agent: { skills: [] },
    data: {
      chat_logs: { effective: 'none' }, shared_memory: 'none',
      cross_app_access: 'none', share_with_apps: 'none',
    },
    background: {
      mode: 'scheduled', cron: '0 4 * * *', job: 'fetch.sh',
      agent: false, authority: 'app_job_process',
    },
  })
  const background = rows.find(row => row.label === 'Background work')
  assert.equal(background.tag, 'Host app job')
  assert.match(background.summary, /legacy host app process/)
  assert.match(background.summary, /filesystem-API restrictions do not confine/)
})

test('capability rows disclose embedded agents, provider credentials, and offline behavior', async () => {
  const { capabilityRows } = await bundle()
  const rows = capabilityRows({
    agent: { embeds_agent: true, skills: [] },
    data: {
      chat_logs: { effective: 'none' }, shared_memory: 'none',
      cross_app_access: 'none', share_with_apps: 'none',
    },
    background: {
      agent: true, mode: 'on_demand', authority: 'scoped_system_job',
      initialize_on_install: false,
    },
    offline: {
      capable: true,
      contract: { reads: true, writes: 'none', execution: 'partial' },
    },
  })
  assert.match(rows.find(row => row.label === 'Embedded agent').summary, /agent chat/)
  assert.match(rows.find(row => row.label === 'Background work').summary, /provider credentials/)
  assert.match(rows.find(row => row.label === 'Offline use').summary, /partial offline execution/)
})

test('catalog updates use fresh access and source guards without a second tap', async () => {
  const indexSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const cardSource = await readFile(join(root, '..', 'ui', 'CatalogCard.jsx'), 'utf8')
  const uninstallSource = await readFile(join(root, '..', 'ui', 'UninstallConfirmModal.jsx'), 'utf8')
  assert.ok(indexSource.includes('const handleCatalogUpdate = useCallback'))
  assert.ok(indexSource.includes('onUpdate={handleCatalogUpdate}'))
  assert.ok(indexSource.includes('loadUpdateCandidatePreview(installedApp.id, token)'))
  assert.ok(indexSource.includes('capabilityDiffNeedsReview('))
  assert.ok(indexSource.includes('capabilityDigest: capabilityPreview.capability_digest'))
  assert.ok(indexSource.includes('sourceDigest: candidate.source_digest'))
  assert.ok(indexSource.includes('This update changes app access. Open it to review'))
  assert.equal(indexSource.includes('setUpdateReview({'), false)
  assert.ok(indexSource.includes('reviewed_capability_digest: _opts.capabilityDigest'))
  assert.ok(indexSource.includes('reviewed_source_digest: _opts.sourceDigest'))
  assert.ok(detailSource.includes('<CapabilityContract'))
  assert.ok(detailSource.includes('capabilityReview.preview.capability_digest'))
  assert.ok(cardSource.includes("? 'Update'"))
  assert.match(uninstallSource, /kept\s+temporarily for recovery/)
  assert.match(uninstallSource, /shared files.*not erased/)
})

test('one-tap updates stop for changed or unknown capabilities', async () => {
  const { capabilityDiffNeedsReview } = await bundle()
  assert.equal(capabilityDiffNeedsReview(null), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: true, added: [], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: ['data.manage_apps'], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: [], removed: [], changed: ['background.agent'] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: [], removed: [], changed: [] }), false)
})

test('filterCatalog matches categories, descriptions, and setup metadata', async () => {
  const { collectCategories, filterCatalog } = await bundle()
  const items = [
    {
      id: 'news',
      categories: ['information', 'agents'],
      keywords: ['digest'],
      setup: { description: 'Choose the fallback model.' },
      manifest: { name: 'News', description: 'Daily digest' },
    },
    {
      id: 'atlas',
      categories: ['reference'],
      keywords: ['globe'],
      manifest: { name: 'Atlas', description: 'Explore Earth' },
    },
  ]
  assert.deepEqual(collectCategories(items), ['information', 'agents', 'reference'])
  assert.deepEqual(filterCatalog(items, { category: 'agents' }).map(i => i.id), ['news'])
  assert.deepEqual(filterCatalog(items, { query: 'fallback model' }).map(i => i.id), ['news'])
  assert.deepEqual(filterCatalog(items, { query: 'earth', category: 'reference' }).map(i => i.id), ['atlas'])
})

test('sortCatalogForDisplay promotes system apps without scrambling groups', async () => {
  const { collectCategories, sortCatalogForDisplay } = await bundle()
  const items = [
    { id: 'notes', categories: ['writing'] },
    { id: 'skills', categories: ['system', 'agents'] },
    { id: 'memory', categories: ['system', 'agents'] },
    { id: 'tasks', categories: ['productivity'] },
    { id: 'contribute', categories: ['development', 'system'] },
  ]
  const sorted = sortCatalogForDisplay(items)
  assert.deepEqual(sorted.map(i => i.id), ['skills', 'memory', 'contribute', 'notes', 'tasks'])
  assert.deepEqual(collectCategories(sorted).slice(0, 3), ['system', 'agents', 'development'])
})

test('manifestCapabilityRows makes agent-facing trust surfaces explicit', async () => {
  const { manifestCapabilityRows } = await bundle()
  const rows = manifestCapabilityRows({
    permissions: { chat_log_access: 'summary' },
    system_prompt: 'memory-core.md',
    skills: ['memory.md', 'reflection.md'],
    embeds_agent: true,
  })

  assert.deepEqual(rows.map(row => row.key), [
    'chat_log_access',
    'system_prompt',
    'skills',
    'embeds_agent',
  ])
  assert.equal(rows[0].info.tag, 'Redacted')
  assert.match(rows[0].info.hint, /tool calls/)
  assert.match(rows[2].info.summary, /2 reusable agent skills/)
  assert.match(rows[2].info.hint, /Uninstall deactivates/)
  assert.match(rows[1].info.hint, /next turn/)
})

test('manifestCapabilityRows shows no chat access and omits undeclared agent powers', async () => {
  const { manifestCapabilityRows } = await bundle()
  const rows = manifestCapabilityRows({})

  assert.deepEqual(rows.map(row => row.key), ['chat_log_access'])
  assert.equal(rows[0].level, 'none')
  assert.match(rows[0].info.summary, /Cannot read/)
})

test('manifestCapabilityRows explains that full chat access is not active yet', async () => {
  const { manifestCapabilityRows } = await bundle()
  const [row] = manifestCapabilityRows({
    permissions: { chat_log_access: 'full' },
  })

  assert.equal(row.info.tag, 'Full requested')
  assert.match(row.info.hint, /not yet enabled/)
})

test('manifestCapabilityRows exposes unsupported chat access instead of hiding it', async () => {
  const { manifestCapabilityRows } = await bundle()
  const [row] = manifestCapabilityRows({
    permissions: { chat_log_access: 'everything' },
  })

  assert.equal(row.level, 'everything')
  assert.equal(row.info.tag, 'Unsupported')
  assert.match(row.info.hint, /cannot be installed/)
})

test('appLifecycleFor chooses one primary action per catalog state', async () => {
  const { appLifecycleFor } = await bundle()
  const item = {
    id: 'news',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-news/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-news/main/',
    setup: { required: true, scope: 'app' },
    manifest: { id: 'news', name: 'News', version: '1.2.0' },
  }
  const installed = [{
    id: 3,
    slug: 'news',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-news/main#manifest-id=news',
    version: '1.1.0',
  }]

  assert.equal(appLifecycleFor(item).actionKind, 'install')
  assert.equal(appLifecycleFor(item, { installed }).actionKind, 'update')
  assert.equal(appLifecycleFor(item, {
    installed,
    updateNotice: { kind: 'conflict', itemId: 'news' },
  }).actionKind, 'resolve')
  assert.equal(appLifecycleFor(item, {
    installed,
    installedUnavailable: true,
  }).actionKind, 'retry')
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).actionKind, 'open')
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).setupRequired, true)
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).setupNeedsAttention, true)
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, {
    installed,
    setupCompletions: { 3: { completedAt: '2026-07-10T00:00:00.000Z' } },
  }).setupNeedsAttention, false)
  assert.equal(appLifecycleFor({
    ...item,
    setup: { required: true, scope: 'system' },
    manifest: { ...item.manifest, version: '1.1.0' },
  }, {
    installed,
    systemSetupReady: true,
  }).setupNeedsAttention, false)

  // Git-native update-check (keyed by the installed row's numeric id) is
  // additive to the package-version signal. A negative source-tree probe must
  // not hide a versioned release whose changes live in static assets, seeds,
  // icons, jobs, or manifest metadata.
  const upToDate = { ...item, manifest: { ...item.manifest, version: '1.1.0' } }
  // false + newer package version => update (e.g. a static-only release).
  assert.equal(appLifecycleFor(item, { installed, updateChecks: { 3: false } }).actionKind, 'update')
  // false + equal package version => open.
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: { 3: false } }).actionKind, 'open')
  // true => update even though the versions match (content changed, no bump).
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: { 3: true } }).actionKind, 'update')
  // null / absent => fall back to the semver compare (exactly today's behavior).
  assert.equal(appLifecycleFor(item, { installed, updateChecks: { 3: null } }).actionKind, 'update')
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: {} }).actionKind, 'open')
})

test('successful updates clear stale git update checks and inline errors', async () => {
  const { mergeUpdateChecks } = await bundle()
  const stale = { 61: true }
  const settled = mergeUpdateChecks(stale, { 61: false })
  assert.deepEqual(settled, { 61: false })
  assert.notEqual(settled, stale)

  const alreadySettled = { 61: false }
  assert.equal(mergeUpdateChecks(alreadySettled, { 61: false }), alreadySettled)

  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  assert.ok(source.includes('setUpdateChecks(prev => mergeUpdateChecks(prev, { [result.id]: false }))'))
  assert.ok(source.includes('setCardErrors(prev => withoutKey(prev, item.id))'))
  assert.ok(source.includes('clearSettledUpdateArtifacts(itemIdsSettledByChecks'))
})

test('busy labels stay tied to the action that started', async () => {
  const { appLifecycleFor, busyLabelForAction } = await bundle()
  const item = {
    id: 'cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/mobius.json',
    manifest: { id: 'cuberun', name: 'CubeRun', version: '1.0.2-mobius.17' },
  }
  const installedBefore = [{
    id: 60,
    slug: 'cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main#manifest-id=cuberun',
    version: '1.0.2-mobius.16',
  }]
  const installedAfter = [{ ...installedBefore[0], version: '1.0.2-mobius.17' }]

  assert.equal(appLifecycleFor(item, { installed: installedBefore }).actionKind, 'update')
  assert.equal(appLifecycleFor(item, {
    installed: installedAfter,
    updateChecks: { 60: false },
  }).actionKind, 'open')

  assert.equal(busyLabelForAction('update'), 'Updating…')
  assert.equal(busyLabelForAction('open'), 'Opening…')
  assert.equal(busyLabelForAction('checking_update'), 'Loading changes…')

  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const cardSource = await readFile(join(root, '..', 'ui', 'CatalogCard.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.ok(source.includes("const startedActionKind = _opts?.isUpdate ? 'update' : 'install'"))
  assert.ok(source.includes('setBusyActionKind(startedActionKind)'))
  assert.ok(cardSource.includes('busyActionKind || lifecycle.actionKind'))
  assert.ok(detailSource.includes('busyActionKind || lifecycle.actionKind'))
})

test('update diff summary parses file status and line counts', async () => {
  const { parseUpdateDiff, summarizeUpdateDiff, updateFileStatusLabel } = await bundle()
  const diff = [
    'diff --git a/index.jsx b/index.jsx',
    'index 123..456 100644',
    '--- a/index.jsx',
    '+++ b/index.jsx',
    '@@ -1,2 +1,2 @@',
    '-old line',
    '+new line',
    ' same',
    'diff --git a/new-file.js b/new-file.js',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/new-file.js',
    '@@ -0,0 +1 @@',
    '+export const ready = true',
  ].join('\n')

  assert.deepEqual(parseUpdateDiff(diff), [
    {
      oldPath: 'index.jsx', newPath: 'index.jsx', path: 'index.jsx',
      status: 'M', insertions: 1, deletions: 1,
    },
    {
      oldPath: 'new-file.js', newPath: 'new-file.js', path: 'new-file.js',
      status: 'A', insertions: 1, deletions: 0,
    },
  ])
  const summary = summarizeUpdateDiff(diff)
  assert.equal(summary.fileCount, 2)
  assert.equal(summary.insertions, 2)
  assert.equal(summary.deletions, 1)
  assert.equal(updateFileStatusLabel('A'), 'Added')
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

// Browse must remain useful when the external proxy is slow or unavailable.
// Snapshots are display/preview data only: installApp still sends manifest_url,
// and installed apps use the backend's git-native update check.
test('catalog carries valid resilient first-paint manifest snapshots', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  assert.ok(Array.isArray(catalog.apps) && catalog.apps.length > 0)
  for (const entry of catalog.apps) {
    assert.ok(entry.manifest, `${entry.id}: missing manifest snapshot`)
    for (const key of ['id', 'name', 'version', 'description', 'entry']) {
      assert.equal(typeof entry.manifest[key], 'string', `${entry.id}: invalid manifest.${key}`)
      assert.ok(entry.manifest[key], `${entry.id}: empty manifest.${key}`)
    }
    assert.match(entry.id, /^[a-z0-9-]+$/)
    assert.ok(entry.name, `${entry.id}: discovery entries carry a name`)
    assert.ok(entry.description, `${entry.id}: discovery entries carry a description`)
    assert.match(entry.manifest_url, /^https:\/\//)
    assert.match(entry.raw_base, /^https:\/\//)
    // The manifest is what the user reviews and trusts on install, so the
    // source + icon files it pulls must come from the SAME origin.
    assert.equal(new URL(entry.manifest_url).host, new URL(entry.raw_base).host,
      `${entry.id}: raw_base must share manifest_url's host`)
  }
})

test('Beat Machine discovery entry describes the sequencer', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const entry = catalog.apps.find((item) => item.id === 'beat-machine')

  assert.ok(entry, 'catalog contains Beat Machine')
  assert.match(entry.description, /32-step sequencer/i)
  assert.ok(entry.keywords.includes('sequencer'))
  assert.ok(entry.capabilities.some((capability) => /32-step/.test(capability)))
})
