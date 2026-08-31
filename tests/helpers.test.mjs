import assert from 'node:assert/strict'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = dirname(fileURLToPath(import.meta.url))
const buildDir = join(root, '.build')
const bundled = join(buildDir, 'index.mjs')
const reactStub = join(root, 'react-stub.mjs')
const iconStub = join(root, 'sdk-icon-stub.mjs')

// Möbius compiles mini-apps with Rolldown, so the tests bundle the same way.
// CI points MOBIUS_FRONTEND_NODE_MODULES at the shell's installed frontend;
// outside CI, a local install resolves it normally.
async function loadRolldown() {
  const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
  if (!frontend) return import('rolldown')
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  return import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
}

async function bundle() {
  await rm(buildDir, { recursive: true, force: true })
  await mkdir(buildDir, { recursive: true })
  const { rolldown } = await loadRolldown()
  const build = await rolldown({
    input: join(root, '..', 'index.jsx'),
    platform: 'node',
    tsconfig: false,
    resolve: {
      alias: {
        'react/jsx-runtime': reactStub,
        react: reactStub,
        '@openai/apps-sdk-ui/components/Icon': iconStub,
      },
    },
    transform: { jsx: 'react-jsx' },
  })
  await build.write({ file: bundled, format: 'es' })
  await build.close()
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

test('store artwork resolves only through the accepted manifest mapping', async () => {
  const { catalogAssetFilename, catalogAssetUrl, storeAssetSource, storeAssetUrl } = await bundle()
  const imageSource = await readFile(join(root, '..', 'ui', 'StoreImage.jsx'), 'utf8')
  const manifest = {
    static_assets: {
      'listing/hero.png': 'listing-assets/hero.immutable.png',
    },
  }
  assert.equal(
    storeAssetSource(manifest, 'listing/hero.png'),
    'listing-assets/hero.immutable.png',
  )
  assert.equal(
    storeAssetUrl({ manifest, raw_base: 'https://raw.example/revision/' }, 'listing/hero.png'),
    'https://raw.example/revision/listing-assets/hero.immutable.png',
  )
  assert.equal(
    storeAssetUrl({ manifest, local_asset_base: '/app-assets/by-id/7/static/' }, 'listing/hero.png'),
    '/app-assets/by-id/7/static/listing/hero.png',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://www.mobius.you/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp',
    ),
    'https://www.mobius.you/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://attacker.test/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp',
    ),
    '',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://www.mobius.you/v1/community/editorial/assets/not-a-digest.webp',
    ),
    '',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://www.mobius.you/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp?mutable=1',
    ),
    '',
  )
  assert.equal(catalogAssetFilename('voice-screen.png'), 'voice-screen.png')
  assert.equal(catalogAssetFilename('../identity-screen.png'), '')
  assert.equal(catalogAssetFilename('https://attacker.test/hero.png'), '')
  assert.equal(catalogAssetUrl(39, 'voice-screen.png'), '/app-assets/by-id/39/previews/voice-screen.png')
  assert.equal(catalogAssetUrl(39, '../identity-screen.png'), '')
  assert.equal(catalogAssetUrl('not-an-app', 'voice-screen.png'), '')
  assert.match(imageSource, /URL\.revokeObjectURL\(objectUrl\)/)
  assert.doesNotMatch(imageSource, /const resolvedImages = new Map/)
})

test('catalog listing artwork is bounded and sanitized before it reaches the UI', async () => {
  const { fetchCatalog } = await bundle()
  const oldFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    schema: 1,
    apps: [{
      id: 'voice',
      manifest_url: 'https://raw.example/apps/voice/mobius.json',
      raw_base: 'https://raw.example/apps/voice/',
      listing: {
        hero: '../private.png',
        tagline: '  A private voice   for your agent.  ',
        screenshots: [
          { src: 'voice-screen.png', alt: ' Voice screen ', label: ' Choose a voice ' },
          { src: 'https://attacker.test/tracker.png', alt: 'Remote tracker' },
          { src: '../identity-screen.png', alt: 'Private data' },
        ],
        featured: true,
      },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  try {
    const [item] = await fetchCatalog('https://raw.example/catalog.json', 'owner-token')
    assert.deepEqual(item.listing, {
      screenshots: [{
        src: 'voice-screen.png',
        alt: 'Voice screen',
        label: 'Choose a voice',
      }],
      tagline: 'A private voice for your agent.',
      featured: true,
    })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('every curated listing asset is packaged by the App Store', async () => {
  const manifest = JSON.parse(await readFile(new URL('../mobius.json', import.meta.url), 'utf8'))
  const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'))
  const referenced = new Set()
  for (const item of catalog.apps) {
    if (item.listing?.hero) referenced.add(item.listing.hero)
    for (const shot of item.listing?.screenshots || []) referenced.add(shot.src)
  }
  assert.equal(referenced.size, 17)
  for (const filename of referenced) {
    assert.equal(
      manifest.static_assets[`previews/${filename}`],
      `listing-assets/${filename}`,
      `${filename} is missing from static_assets`,
    )
  }
})

test('community listings join the ordinary install path with source provenance', async () => {
  const { communityCatalogItems } = await bundle()
  const [item] = communityCatalogItems({ items: [{
    id: 'app_public_1234',
    manifest: {
      id: 'shared-notes',
      name: 'Shared Notes',
      description: 'Notes made together.',
      store: { tagline: 'Notes made together.', description: 'Shared notes.' },
    },
    latest_revision: {
      id: 'rev_public_1234',
      manifest_url: 'https://raw.githubusercontent.com/example/shared-notes/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/example/shared-notes/main/',
      cache: { kind: 'content_addressed', revision_id: 'rev_public_1234' },
    },
    publisher: { kind: 'github', login: 'octo-owner' },
    repository_url: 'https://github.com/example/shared-notes',
    repository_update: {
      commit_sha: 'd'.repeat(40),
      ref: 'refs/heads/main',
      status: 'available_for_review',
    },
    rating: { average: 4.6, count: 12 },
    user_rating: 5,
    review_eligible: true,
    comments: [{ id: 'comment_public_1', body: 'Excellent.' }],
  }] })
  assert.equal(item.id, 'community:app_public_1234')
  assert.equal(item.collection, 'community')
  assert.equal(item.community.revision_id, 'rev_public_1234')
  assert.equal(item.community.author.handle, 'octo-owner')
  assert.equal(item.community.verified_repository_url, 'https://github.com/example/shared-notes')
  assert.equal(item.community.repository_update.commit_sha, 'd'.repeat(40))
  assert.equal(item.community.repository_update.status, 'available_for_review')
  assert.equal(item.community.cache.kind, 'content_addressed')
  assert.equal(item.community.publication_status, 'live')
  assert.equal(item.community.rating_average, 4.6)
  assert.equal(item.community.rating_count, 12)
  assert.equal(item.community.user_rating, 5)
  assert.equal(item.community.review_eligible, true)
  assert.deepEqual(item.community.comments, [{ id: 'comment_public_1', body: 'Excellent.' }])
})

test('official catalog apps absorb only Host-verified matching feedback', async () => {
  const { communityCatalogItems, mergeOfficialCommunityFeedback } = await bundle()
  const official = {
    id: 'voice',
    repo: 'mobius-os/app-voice',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json',
    manifest: { id: 'voice', author: 'mobius-os', name: 'Voice' },
  }
  const duplicate = {
    id: 'community:app_voice',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json',
    manifest: { id: 'voice', author: 'mobius-os', name: 'Voice' },
    community: {
      id: 'app_voice', revision_id: 'revision_voice', rating_average: 4.8,
      repository_url: 'https://github.com/mobius-os/app-voice',
      verified_repository_url: 'https://github.com/mobius-os/app-voice',
    },
  }
  const [impersonatingFork] = communityCatalogItems({ items: [{
    id: 'app_voice_fork',
    manifest: {
      id: 'voice', author: 'mobius-os', name: 'Voice fork',
      homepage: 'https://github.com/mobius-os/app-voice',
    },
    latest_revision: {
      id: 'revision_voice_fork',
      manifest_url: 'https://raw.githubusercontent.com/other-publisher/app-voice/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/other-publisher/app-voice/main/',
    },
    rating: { average: 1.2, count: 1 },
  }] })
  assert.equal(impersonatingFork.community.repository_url, 'https://github.com/mobius-os/app-voice')
  assert.equal(impersonatingFork.community.verified_repository_url, '')
  const unrelated = {
    id: 'community:app_notes',
    manifest: { id: 'notes', author: 'octo-owner' },
    community: { id: 'app_notes', revision_id: 'revision_notes' },
  }

  const merged = mergeOfficialCommunityFeedback([official], [duplicate, impersonatingFork, unrelated])
  assert.deepEqual(merged.map((item) => item.id), [
    'voice', 'community:app_voice_fork', 'community:app_notes',
  ])
  assert.equal(merged[0].manifest_url, official.manifest_url)
  assert.equal(merged[0].community, undefined)
  assert.equal(merged[0].community_feedback.rating_average, 4.8)
  assert.equal(merged[1].community.rating_average, 1.2)
})

test('community catalog pages preserve source offsets and deduplicate appended apps', async () => {
  const { communityCatalogPage, mergeCommunityCatalog } = await bundle()
  const listing = (id) => ({
    id,
    manifest: { id, name: id, description: id },
    latest_revision: {
      id: `revision-${id}`,
      manifest_url: `https://example.test/${id}/mobius.json`,
      raw_base: `https://example.test/${id}/`,
    },
  })
  const first = communityCatalogPage({
    items: [listing('one')],
    next_offset: 1,
    viewer: { github: { connected: true, login: 'octo-owner' } },
  }, 24)
  const second = communityCatalogPage({ items: [listing('one'), listing('two')], next_offset: null }, 24)
  assert.equal(first.hasMore, true)
  assert.equal(first.rowCount, 1)
  assert.deepEqual(first.viewer, {
    github: { connected: true, login: 'octo-owner' },
  })
  assert.equal(second.hasMore, false)
  assert.deepEqual(
    mergeCommunityCatalog(first.items, second.items).map((item) => item.id),
    ['community:one', 'community:two'],
  )
  const partial = communityCatalogPage({
    items: [listing('valid'), { id: 'invalid' }],
    next_offset: 2,
  }, 24)
  assert.equal(partial.items.length, 1)
  assert.equal(partial.rowCount, 2)
})

test('community publication state and source links stay truthful', async () => {
  const { communityPublicationStatus, communityRepositoryUrl } = await bundle()
  assert.equal(communityPublicationStatus({ status: 'checking' }), 'checking')
  assert.equal(communityPublicationStatus({ latest_revision: { id: 'rev_1' } }), 'live')
  assert.equal(communityPublicationStatus({}), 'pending')
  assert.equal(
    communityRepositoryUrl('https://github.com/example/shared-notes.git'),
    'https://github.com/example/shared-notes',
  )
  assert.equal(communityRepositoryUrl('javascript:alert(1)'), '')
  assert.equal(communityRepositoryUrl('https://example.test/example/shared-notes'), '')
})

test('source availability distinguishes the immutable Host cache from a repository revision', async () => {
  const { sourceAvailabilityStatus } = await bundle()
  assert.equal(sourceAvailabilityStatus().key, 'repository')
  assert.equal(sourceAvailabilityStatus({ kind: 'content_addressed' }).key, 'preserved')
})

test('switching Store journeys resets the shared scroll surface', async () => {
  const source = await readFile(new URL('../index.jsx', import.meta.url), 'utf8')
  assert.match(source, /const selectTab = useCallback\(\(next\) => \{[\s\S]*gridScrollRef\.current\.scrollTop = 0[\s\S]*setTab\(next\)/)
  assert.match(source, /onClick=\{\(\) => selectTab\('publish'\)\}/)
  assert.match(source, /onClick=\{\(\) => \{ selectTab\('library'\)/)
})

test('the Store uses shared listings rather than a raw link-install tab', async () => {
  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  assert.match(source, /Publish/)
  assert.doesNotMatch(source, />Install from link</)
  assert.match(source, /loadCommunityApps/)
  assert.match(source, /registerCommunityRevision/)
  assert.match(source, /rateCommunityApp/)
  assert.match(source, /commentOnCommunityRevision/)
  assert.doesNotMatch(source, /remixCommunityApp/)
})

test('ratings and written reviews use exact identity-bound community mutations', async () => {
  const { rateCommunityApp, commentOnCommunityRevision } = await bundle()
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await rateCommunityApp('owner-token', 'app_public_notes', 'revision_public_notes', 5)
    await commentOnCommunityRevision(
      'owner-token', 'app_public_notes', 'revision_public_notes', 'Clear and useful.',
    )
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls[0].url, '/api/community/apps/app_public_notes/rating')
  assert.equal(calls[0].options.method, 'PUT')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    revision_id: 'revision_public_notes', value: 5,
  })
  assert.match(calls[0].options.headers['Idempotency-Key'], /^store:rating:/)
  assert.equal(
    calls[1].url,
    '/api/community/apps/app_public_notes/revisions/revision_public_notes/comments',
  )
  assert.equal(calls[1].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    body: 'Clear and useful.', public_identity: 'github',
  })
  assert.match(calls[1].options.headers['Idempotency-Key'], /^store:comment:/)
})

test('ratings and public reviews use distinct identity gates and scoped errors', async () => {
  const appSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const feedbackSource = await readFile(join(root, '..', 'ui', 'CommunityFeedback.jsx'), 'utf8')

  assert.match(appSource, /!communityIdentity\?\.linked[\s\S]*!githubIdentity\?\.connected/)
  assert.match(appSource, /communityActionError\.key === detailCommunityFeedbackKey/)
  assert.match(detailSource, /canRate=\{!!storeInstalled && communityIdentityLinked/)
  assert.match(detailSource, /canComment=\{!!storeInstalled[\s\S]*githubIdentityConnected/)
  assert.match(feedbackSource, /disabled=\{busy \|\| !canRate\}/)
  assert.match(feedbackSource, /Connect GitHub to post a public written review\./)
})

test('distributed publishing submits one immutable GitHub revision', async () => {
  const { registerCommunityRevision } = await bundle()
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ id: 'app_public_notes' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await registerCommunityRevision('owner-token', {
      repository: 'example/notes',
      commitSha: 'a'.repeat(40),
      manifestPath: 'apps/notes/mobius.json',
      publicIdentity: 'github',
    })
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/community/apps')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    repository: 'example/notes',
    commit_sha: 'a'.repeat(40),
    manifest_path: 'apps/notes/mobius.json',
    public_identity: 'github',
  })
  assert.match(calls[0].options.headers['Idempotency-Key'], /^store:register:/)
})

test('local publishing is one reviewed action through the inherited GitHub account', async () => {
  const { publishLocalAppToGithub } = await bundle()
  const publisherSource = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ id: 'app_public_notes' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await publishLocalAppToGithub('owner-token', 42, 'pocket-list')
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/community/publications/github')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    app_id: 42,
    repository_name: 'pocket-list',
    confirm_source_public: true,
    public_identity: 'github',
  })
  assert.match(calls[0].options.headers['Idempotency-Key'], /^store:publish-local:/)
  assert.match(publisherSource, /I want this accepted source revision to become public/)
  assert.match(publisherSource, /onPublishLocal/)
  assert.match(publisherSource, /app\.icon_url/)
  assert.doesNotMatch(publisherSource, /\/api\/apps\/\$\{app\.id\}\/icon/)
  assert.doesNotMatch(publisherSource, /Return here with the repository and exact commit/)
  assert.equal(
    publisherSource.match(/onClick=\{\(\) => onOpenContributions\?\.\(\)\}/g)?.length,
    2,
    'Contribute buttons must not forward click events as local app ids',
  )
})

test('hosted Spotlight reads and publishes an ordered app-and-artwork feed', async () => {
  const { loadEditorialSpotlight, publishEditorialSpotlight } = await bundle()
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ revision: 2, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await loadEditorialSpotlight('owner-token')
    await publishEditorialSpotlight('owner-token', [
      { app_id: 'voice', artwork_asset: 'a'.repeat(64) + '.webp' },
      { app_id: 'maps', artwork_asset: null },
    ])
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls[0].url, '/api/community/editorial/spotlight')
  assert.equal(calls[1].url, '/api/community/editorial/spotlight')
  assert.equal(calls[1].options.method, 'PUT')
  assert.deepEqual(JSON.parse(calls[1].options.body), { items: [
    { app_id: 'voice', artwork_asset: 'a'.repeat(64) + '.webp' },
    { app_id: 'maps', artwork_asset: null },
  ] })
  assert.match(calls[1].options.headers['Idempotency-Key'], /^store:editorial-feed:/)
})

test('publisher preview accepts only the latest app after back navigation', async () => {
  const { createPublicationPreviewGate } = await bundle()
  const publisherSource = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  const gate = createPublicationPreviewGate()
  const accepted = []
  let finishFirst
  let finishSecond
  const first = new Promise((resolve) => { finishFirst = resolve })
  const second = new Promise((resolve) => { finishSecond = resolve })

  async function prepare(label, result) {
    const requestId = gate.begin()
    const preview = await result
    if (gate.isCurrent(requestId)) accepted.push({ label, preview })
  }

  const firstRun = prepare('first app', first)
  gate.invalidate() // The owner navigates back while the first preview is pending.
  const secondRun = prepare('second app', second)
  finishSecond({ name: 'Second listing' })
  await secondRun
  finishFirst({ name: 'First listing' })
  await firstRun

  assert.deepEqual(accepted, [{
    label: 'second app',
    preview: { name: 'Second listing' },
  }])
  assert.match(publisherSource, /const requestId = previewGateRef\.current\.begin\(\)/)
  assert.equal(
    publisherSource.match(/if \(!previewGateRef\.current\.isCurrent\(requestId\)\) return/g)?.length,
    2,
    'both fulfilled and rejected stale previews must be ignored',
  )
  assert.match(publisherSource, /function closePreview[\s\S]*previewGateRef\.current\.invalidate\(\)/)
})

test('the centered Store header preserves the full desktop brand rail', async () => {
  const source = await readFile(join(root, '..', 'theme.js'), 'utf8')
  assert.match(
    source,
    /grid-template-columns: minmax\(120px, 1fr\) minmax\(320px, 560px\) minmax\(120px, 1fr\)/,
  )
  assert.match(source, /\.st-header \{ width: min\(100%, 1120px\); margin-inline: auto; \}/)
})

test('agent productivity apps share a dedicated discovery collection', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  for (const id of ['skills', 'tasks']) {
    const entry = catalog.apps.find((item) => item.id === id)
    assert.equal(entry.collection, 'productivity')
    assert.ok(entry.categories.includes('productivity'))
  }
})

test('publisher lifecycle records bind back to their local app', async () => {
  const { communityPublicationsByLocalApp } = await bundle()
  const states = communityPublicationsByLocalApp({ items: [{
    id: 'publication_public_1',
    local_app_id: 'app:41:shared-notes',
    status: 'checking',
    repository_url: 'https://github.com/example/shared-notes',
  }] })
  assert.equal(states[41].status, 'checking')
  assert.equal(states[41].repository_url, 'https://github.com/example/shared-notes')
})

test('catalog app intents preserve origin checks and resolve one safe action', async () => {
  const {
    catalogItemIdFromIntent,
    catalogItemIdFromMessage,
    resolveCatalogItemIntent,
  } = await import(
    pathToFileURL(join(root, '..', 'domain.js'))
  )

  assert.equal(catalogItemIdFromIntent('app:voice'), 'voice')
  assert.equal(catalogItemIdFromIntent('  app:NEWS  '), 'news')
  assert.equal(catalogItemIdFromIntent('setup'), null)
  assert.equal(catalogItemIdFromIntent('app:../voice'), null)
  assert.equal(catalogItemIdFromIntent(null), null)

  const parent = {}
  const message = {
    origin: 'https://mobius.test',
    source: parent,
    data: { type: 'moebius:app-intent', intent: 'app:voice' },
  }
  assert.equal(catalogItemIdFromMessage(message, 'https://mobius.test', parent), 'voice')
  assert.equal(catalogItemIdFromMessage(
    { ...message, origin: 'https://attacker.test' },
    'https://mobius.test',
    parent,
  ), null)
  assert.equal(catalogItemIdFromMessage(
    { ...message, source: {} },
    'https://mobius.test',
    parent,
  ), null)
  assert.equal(catalogItemIdFromMessage(
    { ...message, data: { type: 'unrelated', intent: 'app:voice' } },
    'https://mobius.test',
    parent,
  ), null)

  const voice = { id: 'voice', name: 'Voice', manifest: { id: 'voice' } }
  assert.deepEqual(resolveCatalogItemIntent([voice], 'voice'), {
    action: 'open',
    item: voice,
  })
  assert.deepEqual(resolveCatalogItemIntent([{ id: 'maps', name: 'Maps' }], 'maps'), {
    action: 'needs-connection',
    item: { id: 'maps', name: 'Maps' },
    query: 'Maps',
    toast: {
      kind: 'info',
      message: 'Maps needs a connection before its details can load.',
    },
  })
  assert.deepEqual(resolveCatalogItemIntent([], 'missing'), {
    action: 'unavailable',
    toast: { kind: 'error', message: 'That app is not available in this catalog.' },
  })

  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  assert.match(source, /setQuery\(item\.name \|\| intentDestination\.itemId\)/)
  assert.match(source, /void openDetail\(item\)/)
})

test('live catalog metadata preserves baked snapshots and appends new entries', async () => {
  const { mergeCatalogEntries } = await bundle()
  const bakedManifest = { id: 'notes', version: '1.2.3' }
  const merged = mergeCatalogEntries([
    { id: 'notes', summary: 'Old copy', manifest: bakedManifest },
  ], [
    { id: 'notes', summary: 'Fresh copy' },
    { id: 'new-app', summary: 'New app' },
  ])

  assert.deepEqual(merged, [
    { id: 'notes', summary: 'Fresh copy', manifest: bakedManifest },
    { id: 'new-app', summary: 'New app' },
  ])
})

test('openInstalledApp has one options contract for intent and fallback', async () => {
  const { openInstalledApp } = await import(pathToFileURL(join(root, '..', 'api.js')))
  const oldWindow = globalThis.window
  try {
    const messages = []
    const parent = { postMessage: (...args) => messages.push(args) }
    globalThis.window = { parent, location: { origin: 'https://mobius.test' } }
    openInstalledApp(34, { intent: 'setup' })
    assert.deepEqual(messages, [[
      { type: 'moebius:open-app', appId: 34, intent: 'setup' },
      'https://mobius.test',
    ]])

    let fellBack = false
    globalThis.window = { location: { origin: 'https://mobius.test' } }
    globalThis.window.parent = globalThis.window
    openInstalledApp(34, { onUnembedded: () => { fellBack = true } })
    assert.equal(fellBack, true)
  } finally {
    globalThis.window = oldWindow
  }
})

test('published apps outside the catalog stay usable and updatable without false provenance', async () => {
  const {
    appLifecycleFor,
    otherInstalledCatalogItems,
    sourceBackedInstalledApps,
  } = await bundle()
  const linked = {
    id: 34,
    name: 'Linked App',
    description: 'Installed from a shared source.',
    version: '1.1.2',
    manifest_url: 'https://example.test/apps/linked#manifest-id=linked-app',
    source_manifest: {
      id: 'linked-app',
      url: 'https://example.test/apps/linked/mobius.json',
    },
  }
  const curated = {
    id: 8,
    name: 'Notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main#manifest-id=notes',
    source_manifest: {
      id: 'notes',
      url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    },
  }
  const catalog = [{
    id: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    manifest: { id: 'notes' },
  }]

  assert.deepEqual(otherInstalledCatalogItems([linked, curated], catalog), [{
    id: 'other-installed-34',
    source_manifest: {
      id: 'linked-app',
      url: 'https://example.test/apps/linked/mobius.json',
    },
    collection: 'other-installed',
    manifest_url: 'https://example.test/apps/linked/mobius.json',
    raw_base: 'https://example.test/apps/linked/',
    name: 'Linked App',
    manifest: {
      id: 'linked-app',
      name: 'Linked App',
      version: '1.1.2',
      description: 'Installed from a shared source.',
    },
    error: null,
  }])
  assert.deepEqual(otherInstalledCatalogItems([{ id: 99, source_manifest: null }], []), [])
  assert.deepEqual(sourceBackedInstalledApps([linked, { id: 99 }], {
    excludeAppIds: ['34'],
  }), [])
  assert.deepEqual(otherInstalledCatalogItems([linked], [], {
    // App ids arrive from the route as text while installed rows use numbers.
    excludeAppIds: ['34'],
  }), [])

  const hydrated = {
    ...otherInstalledCatalogItems([linked], [])[0],
    manifest: { id: 'linked-app', name: 'Linked App', version: '1.1.3' },
  }
  const lifecycle = appLifecycleFor(hydrated, {
    installed: [linked],
    updateChecks: { 34: { available: true, pendingUpdateState: 'none' } },
  })
  assert.equal(lifecycle.key, 'update')
  assert.equal(lifecycle.actionKind, 'update')

  const unavailable = appLifecycleFor(otherInstalledCatalogItems([linked], [])[0], {
    installed: [linked],
    updateChecks: { 34: { available: null, pendingUpdateState: 'none' } },
  })
  assert.equal(unavailable.key, 'unverified')
  assert.equal(unavailable.actionKind, 'open')

  const renamedManifest = {
    ...hydrated,
    manifest: { ...hydrated.manifest, id: 'linked-app-next' },
  }
  assert.equal(appLifecycleFor(renamedManifest, {
    installed: [linked],
    updateChecks: { 34: { available: true, pendingUpdateState: 'none' } },
  }).key, 'update')
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

test('findInstalled treats trusted catalog commit pins as the same installed app', async () => {
  const { findInstalled } = await bundle()
  const pinned = {
    id: 7,
    slug: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/0123456789abcdef0123456789abcdef01234567#manifest-id=memory',
    version: '1.0.0',
  }
  const catalogItem = {
    id: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json',
    manifest: { id: 'memory' },
  }

  assert.equal(findInstalled([pinned], catalogItem), pinned)
  assert.equal(findInstalled([{
    ...pinned,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-reflection/main#manifest-id=memory',
  }], catalogItem), null)
  assert.equal(findInstalled([{
    ...pinned,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/examples#manifest-id=memory',
  }], catalogItem), null)
})

test('findInstalled matches a trusted mobius-os app across any manifest-id skew', async () => {
  const { findInstalled } = await bundle()
  const installedRow = {
    id: 102,
    slug: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main#manifest-id=subagents',
    version: '0.4.1',
  }

  // A stale baked snapshot still advertises the pre-rename id `codex` because
  // the live manifest refresh has not landed. The installed row already carries
  // the renamed id `subagents`. Repo identity matches regardless of the skew, so
  // the app is not mislabeled "Not installed" and is not duplicated.
  const staleSnapshotItem = {
    id: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    manifest: { id: 'codex', version: '0.4.1' },
  }
  assert.equal(findInstalled([installedRow], staleSnapshotItem), installedRow)

  // The reverse skew is symmetric: a pre-rename installed row (`codex`) matches
  // a catalog entry advertising the renamed id.
  const legacyRow = {
    ...installedRow,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main#manifest-id=codex',
  }
  const renamedItem = {
    id: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    manifest: { id: 'subagents' },
  }
  assert.equal(findInstalled([legacyRow], renamedItem), legacyRow)

  // Repo-scoped: the same manifest-id string in a different mobius-os repo is a
  // different app and must never be adopted.
  const foreignRow = {
    ...installedRow,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-other/main#manifest-id=subagents',
  }
  assert.equal(findInstalled([foreignRow], renamedItem), null)
})

test('otherInstalledCatalogItems does not duplicate a curated app under id skew', async () => {
  const { otherInstalledCatalogItems } = await bundle()
  // The installed row carries the renamed id and a source_manifest, so it is a
  // candidate for an "other installed" card. The curated catalog entry still
  // shows the stale pre-rename snapshot id. It must still be recognized as
  // represented by the catalog, so no second card is emitted for it.
  const installed = [{
    id: 102,
    slug: 'subagents',
    name: 'Subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main#manifest-id=subagents',
    source_manifest: {
      id: 'subagents',
      url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    },
    version: '0.4.1',
  }]
  const catalog = [{
    id: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    manifest: { id: 'codex', version: '0.4.1' },
  }]

  assert.deepEqual(otherInstalledCatalogItems(installed, catalog), [])
})

test('installed catalog apps refresh their live manifest for update detection', async () => {
  const { shouldRefreshCatalogManifest } = await bundle()
  const item = {
    id: 'beat-machine',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-beat-machine/main/mobius.json',
    manifest: { id: 'beat-machine', version: '1.0.16' },
  }
  const installed = [{
    id: 55,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-beat-machine/main#manifest-id=beat-machine',
    version: '1.0.14',
  }]

  assert.equal(shouldRefreshCatalogManifest(item, installed), true)
  assert.equal(shouldRefreshCatalogManifest(item, []), false)
  assert.equal(shouldRefreshCatalogManifest({ ...item, manifest: null }, []), true)
})

test('appIcon paints installed icons directly and keeps remote icons as discovery fallback', async () => {
  const { appIcon } = await bundle()
  const catalogItem = {
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
    manifest: { icon: 'icon.png' },
  }

  assert.deepEqual(appIcon({
    ...catalogItem,
    installed_icon_url: '/api/apps/66/icon?size=128',
  }), {
    url: '/api/apps/66/icon?size=128',
    external: false,
  })
  assert.deepEqual(appIcon(catalogItem), {
    url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/icon.png',
    external: true,
  })
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

test('findInstalled rejects a catalog item without canonical source identity', async () => {
  const { findInstalled } = await bundle()
  const installed = [{
    id: 11,
    slug: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main#manifest-id=notes',
  }]

  assert.equal(findInstalled(installed, {
    id: '',
    manifest_url: null,
    manifest: null,
  }), null)
  assert.equal(findInstalled(installed, {
    id: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    manifest: { id: 'notes' },
  }), installed[0])
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
    schema: 1,
    apps: [
      {
        id: 'notes',
        audience: 'general',
        collection: 'everyday',
        summary: 'Capture notes without losing your train of thought.',
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
      },
      {
        id: 'bad-snapshot',
        manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-bad/main/mobius.json',
        raw_base: 'https://raw.githubusercontent.com/mobius-os/app-bad/main/',
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
    assert.equal(entries[0].audience, 'general')
    assert.equal(entries[0].collection, 'everyday')
    assert.equal(entries[0].summary, 'Capture notes without losing your train of thought.')
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
    assert.equal(Object.hasOwn(entries[0], 'manifest'), false)
    assert.equal(Object.hasOwn(entries[1], 'manifest'), false)
    assert.equal(Object.hasOwn(entries[1], 'audience'), false)
    assert.equal(Object.hasOwn(entries[1], 'collection'), false)
    assert.equal(Object.hasOwn(entries[1], 'summary'), false)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchCatalog rejects pre-schema and unknown registry shapes', async () => {
  const oldFetch = globalThis.fetch
  try {
    const { fetchCatalog } = await bundle()
    for (const body of [[], { apps: [] }, { schema: 2, apps: [] }]) {
      globalThis.fetch = async () => new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
      await assert.rejects(
        () => fetchCatalog('https://example.test/catalog.json', 'tok', { retries: 0 }),
        /Catalog schema is unsupported/,
      )
    }
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

test('capability rows describe system prompt, redacted logs, and a server job generically', async () => {
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
  const background = rows.find(row => row.label === 'Background work')
  assert.equal(background.tag, 'Server job')
  assert.match(background.summary, /initialization run/)
  assert.match(background.summary, /reviewed owner-installed code/)
  assert.match(background.summary, /short-lived app token/)
  assert.match(rows.find(row => row.label === 'Shares its data').summary, /read this app’s private data/)
  assert.ok(rows.every(row => !/Memory app/i.test(row.summary)), 'renderer has no app-specific branch')
})

test('retired receipt fields do not create a second server-job tier', async () => {
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
  assert.equal(background.tag, 'Server job')
  assert.match(background.summary, /Möbius process access/)
  assert.doesNotMatch(background.summary, /legacy|filesystem-confined/)
})

test('capability rows disclose embedded agents, server jobs, and offline behavior', async () => {
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
  assert.equal(rows.find(row => row.label === 'Background work').tag, 'Server job')
  assert.match(rows.find(row => row.label === 'Offline use').summary, /partial offline execution/)
})

test('capability rows disclose GitHub connection and skill management separately', async () => {
  const { capabilityRows } = await bundle()
  const rows = capabilityRows({
    agent: { skills: [] },
    data: {
      chat_logs: { effective: 'none' },
      shared_memory: 'none',
      cross_app_access: 'none',
      share_with_apps: 'none',
      github_access: true,
      github_connect: true,
      manage_skills: true,
    },
  })

  assert.match(
    rows.find(row => row.label === 'GitHub data').summary,
    /connected GitHub account/,
  )
  assert.match(
    rows.find(row => row.label === 'GitHub connection').summary,
    /disconnect the owner’s GitHub connection/,
  )
  assert.match(
    rows.find(row => row.label === 'Agent skills' && row.tag === 'Manages').summary,
    /install and remove agent skills/,
  )
})

test('capability rows fail visibly for a future data grant', async () => {
  const { capabilityRows } = await bundle()
  const rows = capabilityRows({
    agent: { skills: [] },
    data: {
      chat_logs: { effective: 'none' },
      shared_memory: 'none',
      cross_app_access: 'none',
      share_with_apps: 'none',
      future_owner_control: true,
    },
  })

  const future = rows.find(row => row.label === 'Future Owner Control')
  assert.equal(future.tag, 'Review')
  assert.match(future.summary, /unrecognized “future_owner_control” data grant/)
  assert.equal(future.tone, 'write')
})

test('individual catalog updates keep a read-only review with bound digests', async () => {
  const indexSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const cardSource = await readFile(join(root, '..', 'ui', 'CatalogCard.jsx'), 'utf8')
  const uninstallSource = await readFile(join(root, '..', 'ui', 'UninstallConfirmModal.jsx'), 'utf8')
  assert.ok(indexSource.includes('const handleCatalogUpdate = useCallback'))
  assert.ok(indexSource.includes('onUpdate={handleCatalogUpdate}'))
  assert.ok(indexSource.includes(
    'loadUpdateCandidatePreview(installedApp.id, item.manifest_url, token)',
  ))
  assert.ok(indexSource.includes('capabilityDiffNeedsReview('))
  // An individual update still opens a review. Update all intentionally uses
  // the same prepared contract without duplicating this modal flow.
  assert.ok(indexSource.includes('setUpdateReview(prepared)'))
  assert.equal(indexSource.includes('This update changes app access. Open it to review'), false)
  // Applying is a separate, explicit step that binds exactly the digests shown
  // in the review the owner just approved.
  assert.ok(indexSource.includes('const handleApplyReviewedUpdate = useCallback'))
  assert.ok(indexSource.includes('capabilityDigest: updateReview.capabilityReview.preview.capability_digest'))
  assert.ok(indexSource.includes('sourceDigest: updateReview.preview.source_digest'))
  assert.ok(indexSource.includes('onApply={handleApplyReviewedUpdate}'))
  assert.ok(indexSource.includes('reviewed_capability_digest: _opts.capabilityDigest'))
  assert.ok(indexSource.includes('reviewed_source_digest: _opts.sourceDigest'))
  assert.ok(detailSource.includes('<CapabilityContract'))
  assert.ok(detailSource.includes('capabilityReview.preview.capability_digest'))
  assert.ok(cardSource.includes("? 'Update'"))
  assert.match(uninstallSource, /kept\s+temporarily for recovery/)
  assert.match(uninstallSource, /shared files.*not erased/)
})

test('candidate review requests the exact catalog manifest selected by the user', async () => {
  const { loadUpdateCandidatePreview } = await import(
    pathToFileURL(join(root, '..', 'api.js'))
  )
  const oldFetch = globalThis.fetch
  let requested = ''
  globalThis.fetch = async (url) => {
    requested = String(url)
    return new Response(JSON.stringify({
      app_id: 80,
      upstream_version: '2.0.0',
      upstream_diff: '',
      source_digest: 'a'.repeat(64),
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const manifestUrl = (
      'https://raw.githubusercontent.com/mobius-os/' +
      'app-contribute/main/mobius.json'
    )
    await loadUpdateCandidatePreview(80, manifestUrl, 'token')
    assert.equal(
      requested,
      '/api/apps/80/update-candidate-preview?manifest_url=' +
        encodeURIComponent(manifestUrl),
    )
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('resolver chat request binds the selected whole-tree policy', async () => {
  const { createConflictResolverChat } = await import(
    pathToFileURL(join(root, '..', 'api.js'))
  )
  const oldFetch = globalThis.fetch
  let request = null
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options }
    return new Response(JSON.stringify({
      chat_id: 'resolver-chat', created: true, started: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    await createConflictResolverChat(80, 'preserve_local', 'token')
    assert.equal(request.url, '/api/apps/80/conflict-resolver-chat')
    assert.equal(request.options.method, 'POST')
    assert.equal(request.options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(request.options.body), {
      resolution_policy: 'preserve_local',
    })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('a conflicting apply starts a preserving resolver agent automatically', async () => {
  const indexSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const modalSource = await readFile(join(root, '..', 'ui', 'UpdateReviewModal.jsx'), 'utf8')

  assert.match(indexSource, /if \(isConflict\)[\s\S]*createConflictResolverChat\(result\.id, 'preserve_local', token\)/)
  assert.match(indexSource, /if \(!isBatch && resolver\?\.chat_id\) openChat\(resolver\.chat_id\)/)
  assert.match(indexSource, /return \{ ok: false, conflict: true, result, notice, resolver, resolverError \}/)
  assert.match(indexSource, /if \(outcome\?\.conflict\)[\s\S]*setUpdateReview\(null\)/)
  assert.match(indexSource, /const handleReviewUpdate[\s\S]*'preserve_local'[\s\S]*openChat\(resolver\.chat_id\)/)
  assert.doesNotMatch(modalSource, /blockedNotice|onResolve|accept_reviewed_upstream_exact/)
})

test('Update all applies verified stable-access releases and stops for access changes', async () => {
  const { capabilityDiffNeedsReview, updateBatchDisposition } = await bundle()
  assert.equal(capabilityDiffNeedsReview(null), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: true, added: [], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: ['data.manage_apps'], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: [], removed: [], changed: ['background.agent'] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: [], removed: [], changed: [] }), false)

  const verified = {
    preview: { source_digest: 'a'.repeat(64) },
    capabilityReview: {
      preview: {
        capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    },
  }
  assert.deepEqual(updateBatchDisposition(verified), { kind: 'ready', reason: null })
  assert.deepEqual(
    updateBatchDisposition({ ...verified, preview: {} }),
    { kind: 'review', reason: 'source_unverified' },
  )
  assert.deepEqual(
    updateBatchDisposition({
      ...verified,
      capabilityReview: {
        preview: {
          capability_diff: { unknown_previous: true, added: [], removed: [], changed: [] },
        },
      },
    }),
    { kind: 'review', reason: 'access_unrecorded' },
  )
  assert.deepEqual(
    updateBatchDisposition({
      ...verified,
      capabilityReview: {
        preview: {
          capability_diff: { unknown_previous: false, added: ['data.manage_apps'], removed: [], changed: [] },
        },
      },
    }),
    { kind: 'review', reason: 'access_changed' },
  )
})

test('automatic updates have no duplicate trust preference path', async () => {
  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detail = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.doesNotMatch(source, /trusted-updates\.json|trustedUpdate|toggleTrusted/)
  assert.doesNotMatch(detail, /Trust routine updates|Require review|Review every update/)
  assert.match(source, /updateBatchDisposition\(prepared\)/)
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

test('catalog cards prefer concise discovery copy and use stable browse collections', async () => {
  const {
    CARD_DESCRIPTION_LIMIT,
    catalogAudience,
    catalogCardDescription,
    catalogCollection,
  } = await bundle()
  const description = catalogCardDescription({
    summary: 'A concise promise for everyday browsing.',
    manifest: {
      description: 'A longer technical description that belongs in app information.',
    },
  })
  assert.equal(description, 'A concise promise for everyday browsing.')

  const truncated = catalogCardDescription({
    manifest: {
      description: 'Build, use, and share agent-powered tools without reading a long technical description that belongs in app information.',
    },
  })
  assert.ok(truncated.length <= CARD_DESCRIPTION_LIMIT)
  assert.match(truncated, /…$/)
  assert.equal(catalogAudience({ categories: ['system', 'agents'] }), 'developer')
  assert.equal(catalogAudience({ categories: ['writing'] }), 'general')
  assert.equal(catalogCollection({ collection: 'play' }), 'play')
  assert.equal(catalogCollection({ community: { source_url: 'https://example.test/app' }, collection: 'everyday' }), 'community')
  assert.equal(catalogCollection({ id: 'skills', collection: 'developer' }), 'productivity')
  assert.equal(catalogCollection({ id: 'tasks', collection: 'developer' }), 'productivity')
  assert.equal(catalogCollection({ categories: ['reference'] }), 'explore')
  assert.equal(catalogCollection({
    audience: 'general',
    categories: ['development', 'system'],
  }), 'developer')
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
  // A changed version label cannot manufacture an update.
  assert.equal(appLifecycleFor(item, { installed }).actionKind, 'open')
  assert.equal(appLifecycleFor(item, {
    installed,
    updateNotice: { kind: 'conflict', itemId: 'news' },
  }).actionKind, 'resolve')
  assert.equal(appLifecycleFor(item, {
    installed,
    installedUnavailable: true,
    updateChecks: { 3: { available: true, pendingUpdateState: 'none' } },
  }).actionKind, 'retry')
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).actionKind, 'open')
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).statusLabel, 'Installed')
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

  // Git-native update-check (keyed by the installed row's numeric id) is the
  // sole authority. Version labels cannot hide or manufacture an update.
  const upToDate = { ...item, manifest: { ...item.manifest, version: '1.1.0' } }
  // false + newer package label => open.
  assert.equal(appLifecycleFor(item, { installed, updateChecks: {
    3: { available: false, pendingUpdateState: 'none' },
  } }).actionKind, 'open')
  // false + equal package label => open.
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: {
    3: { available: false, pendingUpdateState: 'none' },
  } }).actionKind, 'open')
  // true => update even though the labels match (source changed, no bump).
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: {
    3: { available: true, pendingUpdateState: 'none' },
  } }).actionKind, 'update')
  // null / absent never falls back to a label comparison.
  assert.equal(appLifecycleFor(item, { installed, updateChecks: { 3: null } }).actionKind, 'open')
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: {} }).actionKind, 'open')

  // A pending receipt is not synonymous with an unresolved conflict. Only the
  // click-gated conflict opens a resolver; marker-free committed source is a
  // replay/update retry and the resolver endpoint correctly rejects it.
  const unresolved = appLifecycleFor(upToDate, {
    installed,
    updateChecks: { 3: {
      available: true,
      pendingUpdateState: 'needs_resolution',
    } },
  })
  assert.equal(unresolved.actionKind, 'resolve')
  assert.equal(unresolved.statusLabel, 'Update blocked')
  assert.deepEqual(unresolved.resolutionNotice, {
    kind: 'conflict',
    itemId: 'news',
    appId: 3,
    message: 'This copy has local changes, so updating needs a quick reconcile.',
  })
  const replayPending = appLifecycleFor(upToDate, {
    installed,
    updateChecks: { 3: {
      available: true,
      pendingUpdateState: 'replay_pending',
    } },
    updateNotice: { kind: 'conflict', itemId: 'news', appId: 3 },
  })
  assert.equal(replayPending.actionKind, 'update')
  assert.equal(replayPending.pendingUpdateState, 'replay_pending')
  const unknownPending = appLifecycleFor(upToDate, {
    installed,
    updateChecks: { 3: {
      available: true,
      pendingUpdateState: 'unknown',
    } },
    updateNotice: { kind: 'conflict', itemId: 'news', appId: 3 },
  })
  assert.equal(unknownPending.actionKind, 'update')
  assert.equal(unknownPending.pendingUpdateState, 'unknown')
})

test('fetchUpdateCheck maps the current backend contract', async () => {
  const { fetchUpdateCheck } = await bundle()
  const oldFetch = globalThis.fetch
  const replies = [
    {
      update_available: true,
      pending_update_state: 'replay_pending',
      upstream_version: '2.0.0',
      installed_source_revision: 'a'.repeat(40),
      candidate_source_digest: 'b'.repeat(64),
      checked_at: '2026-08-07T12:00:00Z',
    },
    { update_available: true, pending_update_state: 'unknown', upstream_version: '2.0.0' },
    { update_available: false, pending_update_state: 'none', upstream_version: '1.0.0' },
  ]
  globalThis.fetch = async () => new Response(JSON.stringify(replies.shift()), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
  try {
    assert.deepEqual(await fetchUpdateCheck(1, 'token'), {
      available: true,
      pendingUpdateState: 'replay_pending',
      upstreamVersion: '2.0.0',
      installedSourceRevision: 'a'.repeat(40),
      candidateSourceDigest: 'b'.repeat(64),
      checkedAt: '2026-08-07T12:00:00Z',
    })
    assert.deepEqual(await fetchUpdateCheck(1, 'token'), {
      available: true,
      pendingUpdateState: 'unknown',
      upstreamVersion: '2.0.0',
      installedSourceRevision: null,
      candidateSourceDigest: null,
      checkedAt: null,
    })
    assert.deepEqual(await fetchUpdateCheck(1, 'token'), {
      available: false,
      pendingUpdateState: 'none',
      upstreamVersion: '1.0.0',
      installedSourceRevision: null,
      candidateSourceDigest: null,
      checkedAt: null,
    })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('successful updates clear stale git update checks and inline errors', async () => {
  const { mergeUpdateChecks } = await bundle()
  const stale = { 61: { available: true, pendingUpdateState: 'replay_pending' } }
  const current = {
    available: false,
    pendingUpdateState: 'none',
    upstreamVersion: '2.0.0',
  }
  const settled = mergeUpdateChecks(stale, { 61: current })
  assert.deepEqual(settled, { 61: current })
  assert.notEqual(settled, stale)

  const alreadySettled = { 61: current }
  assert.equal(mergeUpdateChecks(alreadySettled, { 61: { ...current } }), alreadySettled)

  const priorConflict = {
    61: {
      available: true,
      pendingUpdateState: 'needs_resolution',
      upstreamVersion: '2.0.0',
    },
  }
  const uncertain = mergeUpdateChecks(priorConflict, {
    61: {
      available: true,
      pendingUpdateState: 'unknown',
      upstreamVersion: '2.0.1',
    },
  })
  assert.deepEqual(uncertain[61], {
    available: true,
    pendingUpdateState: 'needs_resolution',
    upstreamVersion: '2.0.1',
  })
  assert.equal(mergeUpdateChecks({}, {
    61: { available: true, pendingUpdateState: 'unknown', upstreamVersion: null },
  })[61].pendingUpdateState, 'unknown')
  const previouslyClear = mergeUpdateChecks({
    61: { available: false, pendingUpdateState: 'none', upstreamVersion: '2.0.0' },
  }, {
    61: { available: true, pendingUpdateState: 'unknown', upstreamVersion: '2.0.1' },
  })
  assert.deepEqual(previouslyClear[61], {
    available: true,
    pendingUpdateState: 'unknown',
    upstreamVersion: '2.0.1',
  })

  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  assert.ok(source.includes("pendingUpdateState: 'none'"))
  assert.ok(source.includes("pendingUpdateState: 'needs_resolution'"))
  assert.ok(source.includes('if (r.check !== null) out[r.id] = r.check'))
  assert.ok(source.includes('setCardErrors(prev => withoutKey(prev, item.id))'))
  assert.ok(source.includes('clearSettledUpdateArtifacts(itemIdsSettledByChecks'))
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.ok(detailSource.includes('!blockedUpdate && (!storeInstalled || hasUpdate)'))
})

test('app details keep stable access information in a bottom disclosure', async () => {
  const source = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const disclosure = source.indexOf('className={`st-technical-details')
  const capability = source.indexOf('<CapabilityContract', disclosure)
  const footer = source.indexOf('className="st-detail-footer"', disclosure)
  assert.ok(disclosure >= 0)
  assert.ok(capability > disclosure)
  assert.ok(footer > capability)
  assert.match(source, /Privacy, access & technical details/)
  assert.match(source, /Update source/)
  assert.match(source, /Installed source revision/)
  assert.match(source, /Last verified/)
  assert.doesNotMatch(source, /Access and agent integration/)
  const selfUpdateSource = await readFile(join(root, '..', 'ui', 'SelfUpdateBanner.jsx'), 'utf8')
  assert.match(selfUpdateSource, /fetchUpdateCheck\(appId, token\)/)
  assert.doesNotMatch(selfUpdateSource, /semverCmp/)
  assert.match(selfUpdateSource, /if \(needsAccessReview && !showReview\)/)
  assert.match(selfUpdateSource, /'Update App Store'/)
  assert.match(selfUpdateSource, /later updates stop only when access changes/)
})

test('desktop measure applies to every direct scroll child without a class allowlist', async () => {
  const theme = await readFile(join(root, '..', 'theme.js'), 'utf8')

  assert.match(theme, /\.st-scroll > \* \{\s*\n\s*max-width: 840px;\s*\n\s*margin-inline: auto;/)
  assert.doesNotMatch(theme, /\.st-scroll > \.st-[a-z-]+,\s*$/m)
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

  assert.equal(appLifecycleFor(item, {
    installed: installedBefore,
    updateChecks: { 60: { available: true, pendingUpdateState: 'none' } },
  }).actionKind, 'update')
  assert.equal(appLifecycleFor(item, {
    installed: installedAfter,
    updateChecks: { 60: { available: false, pendingUpdateState: 'none' } },
  }).actionKind, 'open')

  assert.equal(busyLabelForAction('update'), 'Updating…')
  assert.equal(busyLabelForAction('batch_update'), 'Updating all…')
  assert.equal(busyLabelForAction('open'), 'Opening…')
  assert.equal(busyLabelForAction('checking_update'), 'Loading changes…')

  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const cardSource = await readFile(join(root, '..', 'ui', 'CatalogCard.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.ok(source.includes("const startedActionKind = _opts?.isUpdate ? 'update' : 'install'"))
  assert.ok(source.includes('setBusyActionKind(startedActionKind)'))
  assert.ok(cardSource.includes('busyActionKind || lifecycle.actionKind'))
  assert.ok(cardSource.includes("? 'Review & Install'"))
  assert.ok(!cardSource.includes("'Review & install'"))
  assert.ok(detailSource.includes('busyActionKind || lifecycle.actionKind'))
})

test('scheduleSummary handles cron and on-demand jobs', async () => {
  const { scheduleSummary } = await bundle()

  assert.equal(scheduleSummary({ default: '0 6 * * *' }), 'Runs daily at 06:00 UTC')
  assert.equal(scheduleSummary({ job: 'build.sh' }), 'Runs on demand from inside the app')
  assert.equal(scheduleSummary(null), '')
})

test('STORE_VERSION stays in lockstep with mobius.json', async () => {
  const manifest = JSON.parse(await readFile(join(root, '..', 'mobius.json'), 'utf8'))
  const { STORE_VERSION } = await bundle()
  assert.equal(STORE_VERSION, manifest.version)
})

test('offline contract preserves bundled browsing without claiming network actions', async () => {
  const manifest = JSON.parse(await readFile(join(root, '..', 'mobius.json'), 'utf8'))
  assert.equal(manifest.offline_capable, true)
  assert.equal(manifest.offline.reads, true)
  assert.equal(manifest.offline.writes, 'none')
  assert.equal(manifest.offline.execution, 'partial')
  assert.match(manifest.offline.reads_detail, /bundled catalog/i)
})

// Browse must remain useful when the external proxy is slow or unavailable,
// without coupling the live discovery index to every app release. The generated
// fallback still carries first-paint manifests; install/update always resolves
// the live manifest_url.
test('catalog is a release-independent discovery index with a baked snapshot floor', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const constants = await readFile(join(root, '..', 'constants.js'), 'utf8')
  const snapshots = await readFile(join(root, '..', 'manifest-snapshots.js'), 'utf8')
  const refresh = await readFile(join(root, '..', 'scripts', 'refresh-manifest-snapshots.mjs'), 'utf8')
  const collections = new Set(['productivity', 'everyday', 'create', 'explore', 'play', 'developer'])

  assert.ok(Array.isArray(catalog.apps) && catalog.apps.length > 0)
  for (const entry of catalog.apps) {
    assert.equal(entry.manifest, undefined,
      `${entry.id}: live discovery entries must not carry release snapshots`)
    assert.match(entry.id, /^[a-z0-9-]+$/)
    assert.ok(entry.name, `${entry.id}: discovery entries carry a name`)
    assert.ok(entry.description, `${entry.id}: discovery entries carry a description`)
    assert.ok(entry.summary, `${entry.id}: discovery entries carry a concise summary`)
    assert.ok(entry.summary.length <= 52, `${entry.id}: summary stays within 52 characters`)
    assert.ok(collections.has(entry.collection), `${entry.id}: discovery collection is known`)
    assert.match(entry.manifest_url, /^https:\/\//)
    assert.match(entry.raw_base, /^https:\/\//)
    assert.equal(new URL(entry.manifest_url).host, new URL(entry.raw_base).host,
      `${entry.id}: raw_base must share manifest_url's host`)
  }
  assert.match(constants, /import CATALOG_REGISTRY from '.\/catalog\.json'/)
  assert.match(constants, /CATALOG_REGISTRY\.apps\.map/)
  assert.match(constants, /manifest: MANIFEST_SNAPSHOTS\[entry\.id\] \|\| null/)
  assert.doesNotMatch(constants, /id:\s*'voice'/,
    'catalog entries must not be copied into constants.js')
  assert.match(snapshots, /export const MANIFEST_SNAPSHOTS = \{/)
  assert.doesNotMatch(refresh, /entry\.manifest\s*=/)
  assert.doesNotMatch(refresh, /writeFile\(catalogPath/)
})

test('catalog publication requires one complete baked snapshot per entry', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const { MANIFEST_SNAPSHOTS } = await import(
    pathToFileURL(join(root, '..', 'manifest-snapshots.js'))
  )
  const { assertCompleteCatalogSnapshots } = await import(
    pathToFileURL(join(root, '..', 'scripts', 'catalog-snapshot-contract.mjs'))
  )

  assert.doesNotThrow(() => assertCompleteCatalogSnapshots(catalog, MANIFEST_SNAPSHOTS))

  const missingVoice = { ...MANIFEST_SNAPSHOTS }
  delete missingVoice.voice
  assert.throws(
    () => assertCompleteCatalogSnapshots(catalog, missingVoice),
    /voice: snapshot is missing/,
  )

  assert.throws(
    () => assertCompleteCatalogSnapshots(catalog, {
      ...MANIFEST_SNAPSHOTS,
      voice: { ...MANIFEST_SNAPSHOTS.voice, version: '' },
    }),
    /voice: snapshot is missing version/,
  )
})

test('app publication requires a complete source_files import tree', async () => {
  const manifest = JSON.parse(await readFile(join(root, '..', 'mobius.json'), 'utf8'))
  const { assertCompleteSourceManifest } = await import(
    pathToFileURL(join(root, '..', 'scripts', 'source-manifest-contract.mjs'))
  )

  await assert.doesNotReject(() => assertCompleteSourceManifest(join(root, '..'), manifest))

  await assert.rejects(
    () => assertCompleteSourceManifest(join(root, '..'), {
      ...manifest,
      source_files: manifest.source_files.filter((path) => path !== 'ui/UpdateReviewModal.jsx'),
    }),
    /index\.jsx: relative import \.\/ui\/UpdateReviewModal\.jsx is not declared in source_files/,
  )
})

test('Beat Machine discovery entry sells beat-making in one short promise', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const entry = catalog.apps.find((item) => item.id === 'beat-machine')

  assert.ok(entry, 'catalog contains Beat Machine')
  assert.match(entry.summary, /make beats/i)
  assert.match(entry.summary, /32 steps/i)
  assert.ok(entry.summary.length <= 52)
  assert.ok(entry.keywords.includes('sequencer'))
  assert.ok(entry.capabilities.some((capability) => /32-step/.test(capability)))
})

test('Maps discovery entry exposes saved-map and skill capabilities', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const entry = catalog.apps.find((item) => item.id === 'maps')

  assert.ok(entry, 'catalog contains Maps')
  assert.equal(entry.repo, 'mobius-os/app-maps')
  assert.ok(entry.keywords.includes('geocoding'))
  assert.ok(entry.capabilities.some((capability) => /source chats/.test(capability)))
  assert.equal(entry.manifest, undefined)
})

test('Subagents discovery entry exposes guarded provider delegation', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const entry = catalog.apps.find((item) => item.id === 'subagents')

  assert.ok(entry, 'catalog contains Subagents')
  assert.equal(entry.repo, 'mobius-os/app-subagents')
  assert.equal(entry.collection, 'developer')
  assert.ok(entry.keywords.includes('claude'))
  assert.ok(entry.keywords.includes('codex'))
  assert.ok(entry.capabilities.some((capability) => /guarded subagent delegation/.test(capability)))
  assert.equal(entry.manifest, undefined)
})
