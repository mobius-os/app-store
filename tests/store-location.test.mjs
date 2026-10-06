import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { restoredStoreLocation, storeLocation } from '../store-location.js'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-store-location')

test('the reported place keeps only bounded navigation fields', () => {
  assert.deepEqual(storeLocation({
    tab: 'browse', category: 'all', query: 'q'.repeat(300),
    activeCollection: 'play', detailId: 'voice',
  }), { tab: 'browse', category: 'all', query: 'q'.repeat(200), collection: 'play', detail: 'voice' })
  assert.equal(storeLocation({ tab: 'library', activeCollection: 'play' }).collection, null)
})

test('a restored place is validated and anything unknown falls back', () => {
  assert.equal(restoredStoreLocation(null), null)
  assert.equal(restoredStoreLocation({ tab: 'settings' }), null)
  assert.deepEqual(restoredStoreLocation({
    tab: 'library', category: '<img onerror>', query: 7, collection: 'play', detail: '../x',
  }), { tab: 'library', category: 'all', query: '', collection: null, detail: null })
  assert.deepEqual(restoredStoreLocation({
    tab: 'browse', category: 'update', query: 'notes', collection: 'play', detail: 'community:abc-1',
  }), { tab: 'browse', category: 'all', query: 'notes', collection: 'play', detail: 'community:abc-1' })
})

test('restoration accepts only reachable filters and known collection IDs', () => {
  for (const category of ['all', 'update', 'setup']) {
    assert.equal(restoredStoreLocation({ tab: 'library', category }).category, category)
  }
  for (const category of ['installed', 'personal finance', 'nonexistent']) {
    assert.equal(restoredStoreLocation({ tab: 'browse', category }).category, 'all')
  }
  assert.equal(restoredStoreLocation({ tab: 'browse', collection: 'nonexistent' }).collection, null)
  for (const collection of ['picks', 'arrivals', 'play', 'other-installed']) {
    assert.equal(restoredStoreLocation({ tab: 'browse', collection }).collection, collection)
  }
})

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})
const deferred = () => {
  let resolve
  const promise = new Promise(finish => { resolve = finish })
  return { promise, resolve }
}

// Flush React and actual task queues until the observable contract completes.
// A timeout is a failure bound, not an assumed network/ownership duration.
async function until(condition, description = 'Store completion') {
  const deadline = Date.now() + 5000
  while (!condition()) {
    assert.ok(Date.now() < deadline, `Timed out waiting for ${description}`)
    await act(async () => { await new Promise(resolve => setImmediate(resolve)) })
  }
}

async function mountStore(nav, respond = () => undefined) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/', pretendToBeVisual: true })
  const old = {
    window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, fetch: globalThis.fetch,
    ResizeObserver: globalThis.ResizeObserver,
  }
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  dom.window.ResizeObserver = globalThis.ResizeObserver
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  dom.window.matchMedia = () => ({
    matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  })
  dom.window.mobius = { signal() {}, nav }
  const { MANIFEST_SNAPSHOTS } = await import('../manifest-snapshots.js')
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url)
    const response = respond(path, options)
    if (response !== undefined) return response
    if (path === '/api/apps/') return json([])
    if (path.startsWith('/api/community/apps?')) return json({ items: [] })
    if (path.startsWith('/api/proxy?')) {
      const remote = decodeURIComponent(path.split('url=')[1] || '')
      if (remote.endsWith('/catalog.json')) return json({ schema: 1, apps: [] })
      if (remote.includes('app-voice')) return json(MANIFEST_SNAPSHOTS.voice)
      return json({}, 404)
    }
    return json({}, 404)
  }
  const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'index.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, `app-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
  await build.write({ file: output, format: 'es' })
  await build.close()
  const { default: App } = await import(pathToFileURL(output).href)
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(dom.window.document.getElementById('root'))
  await act(async () => root.render(React.createElement(App, { appId: 39, token: 'tok' })))
  return {
    dom,
    async intent(intent) {
      await act(async () => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        origin: dom.window.location.origin, source: dom.window.parent,
        data: { type: 'moebius:app-intent', intent },
      })))
    },
    async close() {
      await act(async () => root.unmount())
      Object.assign(globalThis, old)
      dom.window.close()
      await rm(buildDir, { recursive: true, force: true })
    },
  }
}

function fakeNav(location, { delayed = false } = {}) {
  const nav = {
    location,
    reports: [],
    opened: [],
    entries: [],
    setLocation(value) { nav.reports.push(value) },
    open(label, callbacks) {
      nav.opened.push(label)
      const result = deferred()
      const entry = {
        label, callbacks, outcome: result.promise, closed: false,
        own() { result.resolve({ status: 'owned' }) },
        reject() { result.resolve({ status: 'rejected' }) },
        close() { entry.closed = true; result.resolve({ status: 'cancelled' }) },
      }
      nav.entries.push(entry)
      if (!delayed) entry.own()
      return entry
    },
  }
  return nav
}

const selectedTab = dom => dom.window.document.querySelector('[role="tab"][aria-selected="true"]')?.id

test('the Store reopens a saved tab and filter and never reports Browse first', async () => {
  const nav = fakeNav({ tab: 'library', category: 'setup', query: '', collection: null, detail: null })
  const view = await mountStore(nav)
  try {
    await until(() => nav.reports.length > 0)
    assert.equal(selectedTab(view.dom), 'st-tab-library')
    assert.ok(nav.reports.every(place => place.tab === 'library'), JSON.stringify(nav.reports))
    assert.equal(nav.reports.at(-1).category, 'setup')

    await act(async () => view.dom.window.document.querySelector('#st-tab-browse').click())
    assert.equal(nav.reports.at(-1).tab, 'browse')
  } finally {
    await view.close()
  }
})

test('the Store reopens a saved detail page with a real Back entry', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', query: '', collection: null, detail: 'voice' })
  const view = await mountStore(nav)
  try {
    await until(() => nav.reports.at(-1)?.detail === 'voice')
    assert.deepEqual(nav.opened, ['app-store-detail'])
    assert.equal(nav.reports.at(-1).detail, 'voice')
    assert.equal(nav.reports.some(place => place.detail === null), false, JSON.stringify(nav.reports))
  } finally {
    await view.close()
  }
})

test('without the platform contract the Store starts at Browse as before', async () => {
  const nav = fakeNav(undefined)
  delete nav.setLocation
  const view = await mountStore(nav)
  try {
    assert.equal(selectedTab(view.dom), 'st-tab-browse')
    assert.deepEqual(nav.opened, [])
  } finally {
    await view.close()
  }
})

test('delayed collection ownership precedes detail ownership and Back unwinds both levels', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', collection: 'play', detail: 'voice' }, { delayed: true })
  const view = await mountStore(nav)
  try {
    await until(() => nav.entries.length === 1, 'collection request')
    assert.deepEqual(nav.opened, ['app-store-collection'])
    assert.deepEqual(nav.reports, [])
    await act(async () => nav.entries[0].own())
    await until(() => nav.entries.length === 2, 'detail request')
    assert.equal(view.dom.window.document.querySelector('.st-collection-heading h2')?.textContent, 'Play')
    assert.deepEqual(nav.reports, [])
    await act(async () => nav.entries[1].own())
    await until(() => nav.reports.at(-1)?.detail === 'voice', 'full restore')
    assert.ok(nav.reports.every(place => place.collection === 'play' && place.detail === 'voice'))
    await act(async () => nav.entries[1].callbacks.onBack())
    assert.equal(nav.reports.at(-1).detail, null)
    assert.equal(nav.reports.at(-1).collection, 'play')
    assert.equal(view.dom.window.document.querySelector('.st-collection-heading h2')?.textContent, 'Play')
    await act(async () => nav.entries[0].callbacks.onBack())
    assert.equal(nav.reports.at(-1).collection, null)
  } finally { await view.close() }
})

test('a missing detail falls back only after remote registry hydration finishes', async () => {
  const registry = deferred()
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'gone', collection: 'nonexistent' })
  const view = await mountStore(nav, path => path.startsWith('/api/proxy?') && path.includes('catalog.json')
    ? registry.promise : undefined)
  try {
    assert.deepEqual(nav.reports, [])
    await act(async () => registry.resolve(json({ schema: 1, apps: [] })))
    await until(() => nav.reports.length > 0)
    assert.deepEqual(nav.opened, [])
    assert.equal(nav.reports.at(-1).detail, null)
    assert.equal(nav.reports.at(-1).collection, null)
  } finally { await view.close() }
})

const communityRow = {
  id: 'beyond-page-one', name: 'Distant app', categories: ['Personal Finance'],
  latest_revision: { id: 'revision', manifest_url: 'https://example.test/distant/mobius.json', raw_base: 'https://example.test/distant/' },
  manifest: { id: 'distant', name: 'Distant app', version: '1.0.0', description: 'A shared app.' },
}

test('a community detail resolves by identity beyond the first catalog page', async () => {
  const target = deferred()
  let requested = false
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'community:beyond-page-one' })
  const view = await mountStore(nav, path => {
    if (path === '/api/community/apps/beyond-page-one') { requested = true; return target.promise }
    if (path.startsWith('/api/community/apps?')) return json({
      items: Array.from({ length: 24 }, (_, index) => ({ ...communityRow, id: `first-page-${index}` })),
      next_offset: 24,
    })
  })
  try {
    await until(() => requested, 'identity lookup')
    assert.deepEqual(nav.reports, [])
    await act(async () => target.resolve(json(communityRow)))
    await until(() => nav.reports.at(-1)?.detail === 'community:beyond-page-one')
    assert.deepEqual(nav.opened, ['app-store-detail'])
    assert.equal(nav.reports.at(-1).category, 'all')
    assert.equal(view.dom.window.document.querySelector('.st-hero-name')?.textContent, 'Distant app')
    assert.ok(nav.reports.every(place => place.detail === 'community:beyond-page-one'))
  } finally { await view.close() }
})

test('a removed community target completes with the list fallback', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'community:removed' })
  const view = await mountStore(nav)
  try {
    await until(() => nav.reports.length > 0)
    assert.deepEqual(nav.opened, [])
    assert.equal(nav.reports.at(-1).detail, null)
  } finally { await view.close() }
})

test('installed-only detail waits for its manifest hydration', async () => {
  const manifest = deferred()
  let requested = false
  const nav = fakeNav({ tab: 'library', category: 'setup', detail: 'other-installed-34' })
  const view = await mountStore(nav, path => {
    if (path === '/api/apps/') return json([{
      id: 34, slug: 'linked', name: 'Linked App', version: '1.0.0',
      manifest_url: 'https://example.test/linked#manifest-id=linked',
      source_manifest: { id: 'linked', url: 'https://example.test/linked/mobius.json' },
    }])
    if (path.startsWith('/api/proxy?') && path.includes('example.test')) { requested = true; return manifest.promise.then(value => json(value)) }
  })
  try {
    await until(() => requested, 'installed manifest lookup')
    assert.deepEqual(nav.reports, [])
    await act(async () => manifest.resolve({ id: 'linked', name: 'Hydrated app', version: '2.0.0' }))
    await until(() => nav.reports.at(-1)?.detail === 'other-installed-34')
    assert.deepEqual(nav.opened, ['app-store-detail'])
    assert.equal(view.dom.window.document.querySelector('.st-hero-name')?.textContent, 'Hydrated app')
  } finally { await view.close() }
})

test('a newer intent cancels pending collection ownership and never opens the stale detail', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', collection: 'play', detail: 'voice' }, { delayed: true })
  const view = await mountStore(nav)
  try {
    await until(() => nav.entries.length === 1)
    await view.intent('updates')
    await until(() => nav.reports.at(-1)?.tab === 'library')
    assert.equal(nav.entries[0].closed, true)
    await act(async () => nav.entries[0].own())
    assert.deepEqual(nav.opened, ['app-store-collection'])
    assert.equal(nav.reports.at(-1).collection, null)
    assert.equal(nav.reports.at(-1).detail, null)
    assert.equal(nav.reports.at(-1).category, 'update')
  } finally { await view.close() }
})

test('a newer detail intent cancels stale ownership before opening its own entry', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'voice' }, { delayed: true })
  const view = await mountStore(nav)
  try {
    await until(() => nav.entries.length === 1)
    await view.intent('app:notes')
    await until(() => nav.entries.length === 2)
    assert.equal(nav.entries[0].closed, true)
    assert.deepEqual(nav.reports, [])
    await act(async () => nav.entries[1].own())
    await until(() => nav.reports.at(-1)?.detail === 'notes')
    assert.ok(nav.reports.every(place => place.detail === 'notes'))
  } finally { await view.close() }
})

test('superseding a community lookup aborts it and ignores a late response', async () => {
  const target = deferred()
  let signal
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'community:beyond-page-one' })
  const view = await mountStore(nav, (path, options) => {
    if (path === '/api/community/apps/beyond-page-one') { signal = options.signal; return target.promise }
  })
  try {
    await until(() => signal)
    await view.intent('updates')
    await until(() => nav.reports.at(-1)?.tab === 'library')
    assert.equal(signal.aborted, true)
    await act(async () => target.resolve(json(communityRow)))
    assert.deepEqual(nav.opened, [])
    assert.equal(nav.reports.at(-1).detail, null)
  } finally { await view.close() }
})

test('unmount closes pending restored ownership without reporting an incomplete place', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'voice' }, { delayed: true })
  const view = await mountStore(nav)
  try { await until(() => nav.entries.length === 1) }
  finally { await view.close() }
  assert.equal(nav.entries[0].closed, true)
  assert.deepEqual(nav.reports, [])
})

for (const collection of [null, 'play']) {
  test(`refused detail ownership ${collection ? 'leaves the collection visible and finishes' : 'preserves the saved place'}`, async () => {
    const nav = fakeNav({ tab: 'browse', collection, detail: 'voice' }, { delayed: true })
    const view = await mountStore(nav)
    try {
      await until(() => nav.entries.length === 1)
      if (collection) {
        await act(async () => nav.entries[0].own())
        await until(() => nav.entries.length === 2)
      }
      await act(async () => nav.entries.at(-1).reject())
      if (!collection) assert.deepEqual(nav.reports, [])
      else assert.equal(nav.reports.at(-1)?.collection, 'play')
      await act(async () => view.dom.window.document.querySelector('.st-brand-name')
        .dispatchEvent(new view.dom.window.Event('pointerdown', { bubbles: true })))
      assert.equal(nav.reports.at(-1).collection, collection)
      if (collection) assert.equal(nav.entries[0].closed, false)
    } finally { await view.close() }
  })
}

test('Updates intent closes an owned detail and collection before showing Library', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', collection: 'play', detail: 'voice' })
  const view = await mountStore(nav)
  try {
    await until(() => nav.reports.at(-1)?.detail === 'voice')
    await view.intent('updates')
    await until(() => nav.reports.at(-1)?.tab === 'library')
    assert.ok(nav.entries.every(entry => entry.closed))
    assert.equal(selectedTab(view.dom), 'st-tab-library')
    assert.equal(nav.reports.at(-1).detail, null)
    assert.equal(nav.reports.at(-1).collection, null)
    assert.equal(nav.reports.at(-1).category, 'update')
  } finally { await view.close() }
})

test('an app intent whose manifest is unavailable searches for the named app without a stranded detail', async () => {
  const nav = fakeNav({ tab: 'library', category: 'setup' })
  const view = await mountStore(nav, path => path.startsWith('/api/proxy?') && path.includes('catalog.json')
    ? json({ schema: 1, apps: [{
      id: 'network-app', name: 'Network app',
      manifest_url: 'https://example.test/network/mobius.json', raw_base: 'https://example.test/network/',
    }] }) : undefined)
  try {
    await until(() => nav.reports.at(-1)?.tab === 'library')
    await view.intent('app:network-app')
    await until(() => nav.reports.at(-1)?.query === 'Network app')
    assert.equal(selectedTab(view.dom), 'st-tab-browse')
    assert.deepEqual(nav.opened, [])
    assert.equal(nav.reports.at(-1).detail, null)
  } finally { await view.close() }
})


test('an app intent retargets an owned detail without replacing its Back entry', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'voice' })
  const view = await mountStore(nav)
  try {
    await until(() => nav.reports.at(-1)?.detail === 'voice')
    await view.intent('app:notes')
    await until(() => nav.reports.at(-1)?.detail === 'notes')
    assert.deepEqual(nav.opened, ['app-store-detail'])
    assert.equal(nav.entries[0].closed, false)
    await act(async () => nav.entries[0].callbacks.onBack())
    assert.equal(nav.reports.at(-1).detail, null)
    await act(async () => nav.entries[0].callbacks.onForward())
    assert.equal(nav.reports.at(-1).detail, 'notes')
  } finally { await view.close() }
})

test('saved scalars are visible and reported before registry hydration', async () => {
  const registry = deferred()
  const nav = fakeNav({ tab: 'library', category: 'setup', query: 'voice' })
  const view = await mountStore(nav, path => path.includes('catalog.json') ? registry.promise : undefined)
  try {
    assert.equal(selectedTab(view.dom), 'st-tab-library')
    assert.equal(nav.reports.at(-1)?.category, 'setup')
    assert.equal(nav.reports.at(-1)?.query, 'voice')
  } finally { registry.resolve(json({ schema: 1, apps: [] })); await view.close() }
})

test('owner tab selection cancels a destination waiting for the registry', async () => {
  const registry = deferred()
  const nav = fakeNav({ tab: 'library', category: 'setup', detail: 'gone' })
  const view = await mountStore(nav, path => path.includes('catalog.json') ? registry.promise : undefined)
  try {
    await act(async () => view.dom.window.document.querySelector('#st-tab-publish').click())
    await act(async () => registry.resolve(json({ schema: 1, apps: [] })))
    await until(() => nav.reports.length > 0)
    assert.equal(selectedTab(view.dom), 'st-tab-publish')
    assert.equal(nav.reports.at(-1).tab, 'publish')
    assert.deepEqual(nav.opened, [])
  } finally { await view.close() }
})

test('opening a card cancels a slow community restore without closing the owner entry', async () => {
  const target = deferred()
  let signal
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'community:beyond-page-one' })
  const view = await mountStore(nav, (path, options) => {
    if (path === '/api/community/apps/beyond-page-one') { signal = options.signal; return target.promise }
  })
  try {
    await until(() => signal)
    await act(async () => view.dom.window.document.querySelector('[aria-label="Voice — open details"]').click())
    const ownerEntry = nav.entries.at(-1)
    await act(async () => target.resolve(json(communityRow)))
    await until(() => nav.reports.length > 0)
    assert.equal(signal.aborted, true)
    assert.equal(ownerEntry.closed, false)
    assert.equal(nav.reports.at(-1).detail, 'voice')
    assert.deepEqual(nav.opened, ['app-store-detail'])
  } finally { await view.close() }
})

for (const restored of [false, true]) {
  test(`a ${restored ? 'restored detail' : 'shell app intent'} waits for installed identity, not registry hydration`, async () => {
    const registry = deferred(), apps = deferred()
    const nav = fakeNav(restored ? { tab: 'browse', detail: 'voice' } : undefined)
    const view = await mountStore(nav, path => path.includes('catalog.json') ? registry.promise
      : path === '/api/apps/' ? apps.promise : undefined)
    try {
      if (!restored) await view.intent('app:voice')
      assert.deepEqual(nav.opened, [])
      const source_manifest = { id: 'voice', url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json' }
      await act(async () => apps.resolve(json([{ id: 12, slug: 'voice', source_manifest }])))
      await until(() => nav.reports.at(-1)?.detail === 'voice')
      assert.deepEqual(nav.opened, ['app-store-detail'])
      assert.equal(view.dom.window.document.querySelector('.st-detail-cta')?.textContent.trim(), 'Open App')
    } finally { registry.resolve(json({ schema: 1, apps: [] })); apps.resolve(json([])); await view.close() }
  })
}

test('an installed alias restores its current registry representative and reports the canonical id', async () => {
  const nav = fakeNav({ tab: 'library', category: 'all', detail: 'other-installed-34' })
  const view = await mountStore(nav, path => {
    if (path === '/api/apps/') return json([{
      id: 34, slug: 'linked', name: 'Linked App', version: '1.0.0',
      manifest_url: 'https://example.test/linked#manifest-id=linked',
      source_manifest: { id: 'linked', url: 'https://example.test/linked/mobius.json' },
    }])
    if (path.includes('catalog.json')) return json({ schema: 1, apps: [{
      id: 'linked', name: 'Linked App', manifest_url: 'https://example.test/linked/mobius.json',
      raw_base: 'https://example.test/linked/',
    }] })
    if (path.startsWith('/api/proxy?') && path.includes('example.test')) return json({
      id: 'linked', name: 'Linked App', version: '1.0.0',
    })
  })
  try {
    await until(() => nav.reports.length > 0)
    assert.equal(view.dom.window.document.querySelector('.st-hero-name')?.textContent, 'Linked App')
    assert.equal(nav.reports.at(-1).detail, 'linked')
    await act(async () => nav.entries[0].callbacks.onBack())
    await view.intent('app:other-installed-34')
    await until(() => nav.reports.at(-1)?.detail === 'linked')
    assert.equal(nav.entries.length, 2)
    assert.equal(nav.entries[1].closed, false)
  } finally { await view.close() }
})

test('a loaded community detail survives an unavailable identity endpoint without a refetch', async () => {
  const registry = deferred()
  let identityRequests = 0
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'community:beyond-page-one' })
  const view = await mountStore(nav, path => {
    if (path.includes('catalog.json')) return registry.promise
    if (path.startsWith('/api/community/apps?')) return json({ items: [communityRow] })
    if (path === '/api/community/apps/beyond-page-one') { identityRequests++; return json({}, 503) }
  })
  try {
    await act(async () => registry.resolve(json({ schema: 1, apps: [] })))
    await until(() => nav.reports.length > 0)
    assert.equal(identityRequests, 0)
    assert.equal(nav.reports.at(-1).detail, 'community:beyond-page-one')
  } finally { await view.close() }
})

test('owner card selection cancels pending restored ownership before opening its own entry', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'voice' }, { delayed: true })
  const view = await mountStore(nav)
  try {
    await until(() => nav.entries.length === 1)
    await act(async () => view.dom.window.document.querySelector('[aria-label="Notes — open details"]').click())
    assert.equal(nav.entries.length, 2)
    assert.equal(nav.entries[0].closed, true)
    assert.equal(nav.entries[1].closed, false)
    await act(async () => { nav.entries[0].own(); nav.entries[1].own() })
    await until(() => nav.reports.at(-1)?.detail === 'notes')
    assert.equal(nav.entries[1].closed, false)
    assert.equal(nav.reports.some(place => place.detail === 'voice'), false)
  } finally { await view.close() }
})

test('collection Back cancels a pending detail without undoing owned history', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', collection: 'play', detail: 'voice' }, { delayed: true })
  const view = await mountStore(nav)
  try {
    await until(() => nav.entries.length === 1)
    await act(async () => nav.entries[0].own())
    await until(() => nav.entries.length === 2)
    await act(async () => nav.entries[0].callbacks.onBack())
    await act(async () => nav.entries[1].own())
    await until(() => nav.reports.length > 0)
    assert.equal(nav.entries[0].closed, false)
    assert.equal(nav.entries[1].closed, true)
    assert.equal(nav.reports.at(-1).collection, null)
    assert.equal(nav.reports.at(-1).detail, null)
  } finally { await view.close() }
})

test('a saved Browse query is visible and can be cleared in one click', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', query: 'voice' })
  const view = await mountStore(nav)
  try {
    assert.equal(view.dom.window.document.querySelector('#st-catalog-search')?.value, 'voice')
    await act(async () => view.dom.window.document.querySelector('.st-header-search-toggle').click())
    assert.equal(nav.reports.at(-1).query, '')
  } finally { await view.close() }
})

test('Browse never retains a Library-only filter', async () => {
  const nav = fakeNav({ tab: 'library', category: 'setup' })
  const view = await mountStore(nav)
  try {
    await act(async () => view.dom.window.document.querySelector('#st-tab-browse').click())
    assert.equal(nav.reports.at(-1).category, 'all')
    assert.equal(restoredStoreLocation({ tab: 'browse', category: 'update' }).category, 'all')
  } finally { await view.close() }
})

test('a saved collection opens without waiting for registry or installed data', async () => {
  const registry = deferred()
  const apps = deferred()
  const nav = fakeNav({ tab: 'browse', category: 'all', collection: 'play' })
  const view = await mountStore(nav, path => path.includes('catalog.json') ? registry.promise
    : path === '/api/apps/' ? apps.promise : undefined)
  try {
    assert.deepEqual(nav.opened, ['app-store-collection'])
    assert.equal(nav.reports.at(-1)?.collection, 'play')
  } finally {
    registry.resolve(json({ schema: 1, apps: [] })); apps.resolve(json([]))
    await view.close()
  }
})

test('a transient community lookup failure preserves the saved detail until owner navigation', async () => {
  const lookup = deferred()
  let requested = false
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'community:beyond-page-one' })
  const view = await mountStore(nav, path => {
    if (path === '/api/community/apps/beyond-page-one') { requested = true; return lookup.promise }
  })
  try {
    await until(() => requested)
    await act(async () => lookup.resolve(json({}, 503)))
    assert.deepEqual(nav.reports, [])
    await act(async () => view.dom.window.document.querySelector('#st-tab-library').click())
    assert.equal(nav.reports.at(-1).tab, 'library')
  } finally { await view.close() }
})

test('community dot segments are not restored as app identities', () => {
  for (const detail of ['community:.', 'community:..']) {
    assert.equal(restoredStoreLocation({ tab: 'browse', detail }).detail, null)
  }
})

test('an oversized reported target is skipped, never truncated or sent above 4 KiB', () => {
  assert.equal(storeLocation({ tab: 'browse', detailId: 'x'.repeat(4096) }), null)
  assert.equal(storeLocation({ tab: 'browse', detailId: '😀'.repeat(1024) }), null)
  const detailId = 'x'.repeat(3900)
  assert.equal(storeLocation({ tab: 'browse', detailId }).detail, detailId)
})

test('keyboard interaction in the search box cancels a pending restored detail', async () => {
  const lookup = deferred()
  let signal
  const nav = fakeNav({ tab: 'browse', category: 'all', query: 'voice', detail: 'community:beyond-page-one' })
  const view = await mountStore(nav, (path, options) => {
    if (path === '/api/community/apps/beyond-page-one') { signal = options.signal; return lookup.promise }
  })
  try {
    await until(() => signal)
    const input = view.dom.window.document.querySelector('#st-catalog-search')
    assert.ok(input)
    await act(async () => input.dispatchEvent(new view.dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' })))
    assert.equal(signal.aborted, true)
    await act(async () => lookup.resolve(json(communityRow)))
    assert.equal(nav.reports.at(-1).query, 'voice')
    assert.equal(nav.reports.at(-1).detail, null)
    assert.deepEqual(nav.opened, [])
  } finally { await view.close() }
})

test('a Library filter chip cancels a pending restored detail before setting the filter', async () => {
  const lookup = deferred()
  let signal
  const nav = fakeNav({ tab: 'library', category: 'all', detail: 'community:beyond-page-one' })
  const view = await mountStore(nav, (path, options) => {
    if (path === '/api/community/apps/beyond-page-one') { signal = options.signal; return lookup.promise }
  })
  try {
    await until(() => signal)
    const chip = [...view.dom.window.document.querySelectorAll('.st-chip')].find(node => node.querySelector('span')?.textContent === 'Setup')
    assert.ok(chip)
    await act(async () => chip.click())
    assert.equal(signal.aborted, true)
    await act(async () => lookup.resolve(json(communityRow)))
    assert.equal(nav.reports.at(-1).category, 'setup')
    assert.equal(nav.reports.at(-1).detail, null)
    assert.deepEqual(nav.opened, [])
  } finally { await view.close() }
})

test('a pointer interaction without its own navigation handler still cancels restoration', async () => {
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'voice' }, { delayed: true })
  const view = await mountStore(nav)
  try {
    await until(() => nav.entries.length === 1)
    await act(async () => view.dom.window.document.querySelector('.st-brand-name')
      .dispatchEvent(new view.dom.window.Event('pointerdown', { bubbles: true })))
    assert.equal(nav.entries[0].closed, true)
    await act(async () => nav.entries[0].own())
    assert.equal(nav.reports.at(-1).detail, null)
    assert.equal(nav.reports.some(place => place.detail === 'voice'), false)
  } finally { await view.close() }
})

test('superseding an intent that reuses an owner detail never closes the owner entry', async () => {
  const registry = deferred()
  const nav = fakeNav(undefined, { delayed: true })
  const view = await mountStore(nav, path => path.includes('catalog.json') ? registry.promise : undefined)
  try {
    await until(() => view.dom.window.document.querySelector('[aria-label="Voice — open details"]'))
    await act(async () => view.dom.window.document.querySelector('[aria-label="Voice — open details"]').click())
    const ownerEntry = nav.entries[0]
    await view.intent('app:notes')
    assert.equal(nav.entries.length, 1)
    await view.intent('app:gone')
    assert.equal(ownerEntry.closed, false)
    await act(async () => ownerEntry.own())
    assert.equal(view.dom.window.document.querySelector('.st-hero-name')?.textContent, 'Notes')
    await act(async () => registry.resolve(json({ schema: 1, apps: [] })))
    await until(() => nav.reports.at(-1)?.detail === 'notes')
    assert.equal(ownerEntry.closed, false)
  } finally {
    registry.resolve(json({ schema: 1, apps: [] }))
    await view.close()
  }
})

test('an installed-list failure preserves a saved installed alias until background recovery', async () => {
  const apps = deferred()
  let recovered = false
  const nav = fakeNav({ tab: 'library', category: 'all', detail: 'other-installed-34' })
  const view = await mountStore(nav, path => {
    if (path === '/api/apps/') return recovered ? json([{
      id: 34, slug: 'linked', name: 'Linked App', version: '1.0.0',
      manifest_url: 'https://example.test/linked#manifest-id=linked',
      source_manifest: { id: 'linked', url: 'https://example.test/linked/mobius.json' },
    }]) : apps.promise
    if (path.startsWith('/api/proxy?') && path.includes('example.test')) return json({
      id: 'linked', name: 'Linked App', version: '1.0.0',
    })
  })
  try {
    await act(async () => apps.resolve(json({}, 503)))
    await until(() => view.dom.window.document.querySelector('.st-notice.is-warning'))
    assert.deepEqual(nav.reports, [])
    recovered = true
    await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
    await until(() => nav.reports.at(-1)?.detail === 'other-installed-34')
    assert.ok(nav.reports.every(place => place.detail === 'other-installed-34'))
  } finally { await view.close() }
})

for (const collection of [null, 'play']) {
  test(`a failed detail manifest ${collection ? 'leaves the collection visible' : 'preserves the saved place'}`, async () => {
    const manifest = deferred()
    let requested = false
    const nav = fakeNav({ tab: 'browse', category: 'all', collection, detail: 'network-app' })
    const view = await mountStore(nav, path => {
      if (path.includes('catalog.json')) return json({ schema: 1, apps: [{
        id: 'network-app', name: 'Network app', manifest_url: 'https://example.test/network/mobius.json',
        raw_base: 'https://example.test/network/',
      }] })
      if (path.startsWith('/api/proxy?') && path.includes('example.test')) { requested = true; return manifest.promise }
    })
    try {
      await until(() => requested)
      await act(async () => manifest.resolve(json({}, 404)))
      await until(() => collection ? nav.reports.at(-1)?.collection === collection
        : view.dom.window.document.querySelector('.st-card.is-error'))
      if (collection) assert.equal(nav.reports.at(-1)?.collection, collection)
      else assert.deepEqual(nav.reports, [])
      assert.deepEqual(nav.opened, collection ? ['app-store-collection'] : [])
      await act(async () => view.dom.window.document.querySelector('#st-tab-library').click())
      assert.equal(nav.reports.at(-1).detail, null)
    } finally { await view.close() }
  })
}

for (const row of [{ ...communityRow, manifest: null }, {}]) {
  test(`an incomplete community response preserves the saved target (${row.id || 'malformed'})`, async () => {
    const lookup = deferred()
    let requested = false
    const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'community:beyond-page-one' })
    const view = await mountStore(nav, path => {
      if (path === '/api/community/apps/beyond-page-one') { requested = true; return lookup.promise }
    })
    try {
      await until(() => requested)
      await act(async () => lookup.resolve(json(row)))
      assert.deepEqual(nav.reports, [])
      await act(async () => view.dom.window.document.querySelector('#st-tab-library').click())
      assert.equal(nav.reports.at(-1).detail, null)
    } finally { await view.close() }
  })
}

test('a registry failure cannot establish that a saved target is missing', async () => {
  const registry = deferred()
  const nav = fakeNav({ tab: 'browse', category: 'all', detail: 'remote-target' })
  const view = await mountStore(nav, path => path.includes('catalog.json') ? registry.promise : undefined)
  try {
    await act(async () => registry.resolve(json({}, 404)))
    assert.deepEqual(nav.reports, [])
    await act(async () => view.dom.window.document.querySelector('#st-tab-library').click())
    assert.equal(nav.reports.at(-1).tab, 'library')
  } finally { await view.close() }
})

test('opening an oversized community detail does not report a replacement bookmark', async () => {
  const nav = fakeNav(undefined)
  const view = await mountStore(nav, path => path.startsWith('/api/community/apps?')
    ? json({ items: [{ ...communityRow, id: 'x'.repeat(4096) }] }) : undefined)
  try {
    await until(() => view.dom.window.document.querySelector('[aria-label="Distant app — open details"]'))
    const reportsBefore = nav.reports.length
    await act(async () => view.dom.window.document.querySelector('[aria-label="Distant app — open details"]').click())
    assert.equal(view.dom.window.document.querySelector('.st-hero-name')?.textContent, 'Distant app')
    assert.equal(nav.reports.length, reportsBefore)
  } finally { await view.close() }
})

test('detail host Back cancels a waiting app intent', async () => {
  const registry = deferred()
  const nav = fakeNav({ tab: 'browse', detail: 'voice' })
  const view = await mountStore(nav, path => path.includes('catalog.json') ? registry.promise : undefined)
  try {
    await until(() => nav.reports.at(-1)?.detail === 'voice')
    await view.intent('app:remote-target')
    await act(async () => nav.entries[0].callbacks.onBack())
    assert.equal(nav.reports.at(-1).detail, null)
    await act(async () => registry.resolve(json({ schema: 1, apps: [{ id: 'remote-target', name: 'Remote',
      manifest_url: 'https://example.test/remote/mobius.json', raw_base: 'https://example.test/remote/' }] })))
    assert.deepEqual(nav.opened, ['app-store-detail'])
  } finally { registry.resolve(json({ schema: 1, apps: [] })); await view.close() }
})
