import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MANIFEST_SNAPSHOTS } from '../manifest-snapshots.js'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-managed-event-runtime')
let modulePromise
async function appModule() {
  if (!modulePromise) modulePromise = (async () => {
    const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
    const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
    await mkdir(buildDir, { recursive: true })
    const build = await rolldown({
      input: join(here, '..', 'index.jsx'), platform: 'node', tsconfig: false,
      external: ['react', 'react/jsx-runtime'],
      resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
      transform: { jsx: 'react-jsx' },
    })
    const output = join(buildDir, 'app.mjs')
    await build.write({ file: output, format: 'es' })
    await build.close()
    return import(pathToFileURL(output).href)
  })()
  return modulePromise
}

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})
function installed(version = '1.0.0') {
  return [{
    id: 11, slug: 'voice', name: 'Voice', version,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main#manifest-id=voice',
    source_manifest: { id: 'voice', url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json' },
  }]
}

async function mount(fetchApps, { catalog = [], hidden = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const keys = ['window', 'document', 'HTMLElement', 'ResizeObserver', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const parent = {}
  Object.defineProperty(dom.window, 'parent', { value: parent })
  Object.defineProperty(dom.window.document, 'visibilityState', { value: 'hidden', configurable: true })
  dom.window.mobius = { signal() {} }
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url, options = {}) => {
      const path = String(url)
      if (path === '/api/apps/' || path === '/api/apps/install' || path.startsWith('/api/apps/11/update-candidate-preview')
        || (/^\/api\/apps\/\d+\/update-check/.test(path) && !path.startsWith('/api/apps/999/'))) return fetchApps(path, options)
      if (path.startsWith('/api/proxy?')) {
        const remote = decodeURIComponent(path.split('url=')[1] || '')
        if (remote.endsWith('/catalog.json')) return json({ schema: 1, apps: catalog })
        if (remote.includes('app-voice')) return json(MANIFEST_SNAPSHOTS.voice)
        if (remote.includes('app-maps')) return json(MANIFEST_SNAPSHOTS.maps)
      }
      return json({}, 404)
    },
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  const { default: App } = await appModule()
  await act(async () => root.render(React.createElement(App, { appId: 999, token: 'tok' })))
  Object.defineProperty(dom.window.document, 'visibilityState', { value: hidden ? 'hidden' : 'visible', configurable: true })
  return {
    dom,
    async message({ source = parent, type = 'moebius:managed-app-event', appId = '11' } = {}) {
      await act(async () => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        source, origin: 'https://shell.test', data: { type, event: { type: 'app_updated', appId } },
      })))
    },
    async batchMessages(ids) {
      await act(async () => {
        for (const appId of ids) dom.window.dispatchEvent(new dom.window.MessageEvent('message', { source: parent, data: { type: 'moebius:managed-app-event', event: { type: 'app_updated', appId } } }))
      })
    },
    async library() {
      await act(async () => dom.window.document.querySelector('#st-tab-library').click())
    },
    voiceAction() {
      return [...dom.window.document.querySelectorAll('.st-card-action')]
        .find(button => button.getAttribute('aria-label')?.endsWith(' Voice'))?.getAttribute('aria-label')
    },
    async close() {
      await act(async () => root.unmount())
      dom.window.close()
      Object.assign(globalThis, old)
      await rm(buildDir, { recursive: true, force: true })
    },
  }
}

test('resolver completion refreshes an open Store, including repeated events during a read', async () => {
  let reads = 0
  let checks = 0
  let resolved = false
  let release
  const view = await mount(async path => {
    if (path === '/api/apps/') {
      reads++
      if (reads === 4) return new Promise(resolve => { release = () => resolve(json(installed('2.0.0'))) })
      return json(installed(resolved ? '2.0.0' : '1.0.0'))
    }
    checks++
    return json({ update_available: !resolved, pending_update_state: resolved ? 'none' : 'needs_resolution' })
  })
  try {
    await view.library()
    assert.match(view.voiceAction(), /Resolve/)
    assert.equal(reads, 2)
    assert.equal(checks, 1)
    await view.message({ source: view.dom.window })
    await view.message({ type: 'unrelated-event' })
    assert.equal(reads, 2, 'only parent messages with the managed-app type invalidate state')

    resolved = true
    await view.message()
    assert.equal(reads, 3)
    assert.equal(checks, 2, 'completion bypasses the foreground-check debounce')
    assert.equal(view.voiceAction(), 'Open Voice', 'fresh pending state removes the resolver action')

    await view.message()
    assert.ok(release, 'the fourth installed read is still in flight')
    resolved = false
    await view.message()
    await act(async () => release())
    assert.equal(reads, 5, 'a newer event never waits for the in-flight installed read')
    assert.equal(checks, 3)
    assert.match(view.voiceAction(), /Resolve/)
  } finally {
    release?.()
    await view.close()
  }
})

test('a completion during mount cannot be overwritten by the older mount snapshot', async () => {
  let reads = 0
  let checks = 0
  let releaseMount
  const view = await mount(async path => {
    if (path === '/api/apps/') {
      reads++
      if (reads === 1) return new Promise(resolve => { releaseMount = () => resolve(json([])) })
      return json(installed('2.0.0'))
    }
    checks++
    return json({ update_available: false, pending_update_state: 'none' })
  })
  try {
    await view.message()
    assert.equal(reads, 2)
    await act(async () => releaseMount())
    await view.library()
    assert.equal(view.voiceAction(), 'Open Voice', 'mount must not erase the newly installed row')
    assert.equal(checks, 1, 'mount must not probe its stale installed-app snapshot')
  } finally {
    await view.close()
  }
})

test('completion never waits for a pre-event update check and ignores its stale outcome', async () => {
  let checks = 0
  let releaseCheck
  const view = await mount(async path => {
    if (path === '/api/apps/') return json(installed('2.0.0'))
    checks++
    if (checks === 1) return new Promise(resolve => {
      releaseCheck = () => resolve(json({ update_available: true, pending_update_state: 'needs_resolution' }))
    })
    return json({ update_available: false, pending_update_state: 'none' })
  })
  try {
    await view.message()
    assert.equal(checks, 2, 'a newer check starts even while the old check is hung')
    await act(async () => releaseCheck())
    await view.library()
    assert.equal(checks, 2)
    assert.equal(view.voiceAction(), 'Open Voice', 'the old resolver state cannot overwrite completion')
  } finally {
    await act(async () => releaseCheck?.())
    await view.close()
  }
})

test('managed-app events coalesce IDs and only probe affected installed apps; hidden frames defer', async () => {
  const calls = []
  let reads = 0
  const rows = [...installed(), { ...installed()[0], id: 12, slug: 'other' }, { ...installed()[0], id: 13, slug: 'third' }]
  const view = await mount(async path => {
    if (path === '/api/apps/') { reads++; return json(rows) }
    calls.push(Number(path.match(/apps\/(\d+)/)[1]))
    return json({ update_available: false, pending_update_state: 'none' })
  })
  try {
    calls.length = 0
    const initialReads = reads
    await view.batchMessages(['11', '11', '12', 'missing'])
    assert.deepEqual(calls.sort(), [11, 12], 'no unrelated Git fetches')
    assert.equal(reads, initialReads + 1, 'one cheap read for a burst')
    calls.length = 0
    await view.message({ appId: 'not-installed' })
    assert.deepEqual(calls, [])
    const beforeHidden = reads
    Object.defineProperty(view.dom.window.document, 'visibilityState', { value: 'hidden', configurable: true })
    await view.batchMessages(['11', '12', '11'])
    assert.equal(reads, beforeHidden)
    Object.defineProperty(view.dom.window.document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => view.dom.window.document.dispatchEvent(new view.dom.window.Event('visibilitychange')))
    assert.deepEqual(calls.sort(), [11, 12])
  } finally { await view.close() }
})

test('an event during startup still checks all apps using the live catalog URLs', async () => {
  let releaseMount
  let reads = 0
  const checks = []
  const liveUrl = 'https://raw.githubusercontent.com/mobius-os/app-voice/release/mobius.json'
  const rows = [...installed(), { ...installed()[0], id: 12, slug: 'other', source_manifest: { id: 'other' } }]
  const view = await mount(async path => {
    if (path === '/api/apps/') {
      if (++reads === 1) return new Promise(resolve => { releaseMount = () => resolve(json([])) })
      return json(rows)
    }
    checks.push(path)
    return json({ update_available: false, pending_update_state: 'none' })
  }, { catalog: [{ id: 'voice', manifest_url: liveUrl, raw_base: 'https://raw.githubusercontent.com/mobius-os/app-voice/release/' }] })
  try {
    await view.message()
    await act(async () => releaseMount())
    assert.equal(checks.length, 2, 'startup probes both apps, not just the event ID')
    const voice = checks.find(path => path.startsWith('/api/apps/11/'))
    assert.equal(new URL(voice, 'https://store.test').searchParams.get('manifest_url'), liveUrl)
    await view.library()
    assert.equal(view.voiceAction(), 'Open Voice')
  } finally { await view.close() }
})

test('a newer event retains IDs from a hung installed read without waiting for it', async () => {
  const checks = []
  let hold = false
  let releaseRead
  const rows = [...installed(), { ...installed()[0], id: 12, slug: 'other' }]
  const view = await mount(async path => {
    if (path === '/api/apps/') {
      if (hold) { hold = false; return new Promise(resolve => { releaseRead = () => resolve(json(rows)) }) }
      return json(rows)
    }
    checks.push(Number(path.match(/apps\/(\d+)/)[1]))
    return json({ update_available: false, pending_update_state: 'none' })
  })
  try {
    checks.length = 0
    hold = true
    await view.message({ appId: '11' })
    assert.ok(releaseRead)
    await view.message({ appId: '12' })
    assert.deepEqual(checks.sort(), [11, 12], 'the newer read covers both outstanding invalidations')
    await act(async () => releaseRead())
    assert.deepEqual(checks.sort(), [11, 12], 'the stale read never starts another check round')
  } finally { await act(async () => releaseRead?.()); await view.close() }
})

test('an event superseding the startup full read preserves checks for all installed apps', async () => {
  let reads = 0
  let releaseStartup
  const checks = []
  const rows = [...installed(), { ...installed()[0], id: 12, slug: 'other' }]
  const view = await mount(async path => {
    if (path === '/api/apps/') {
      if (++reads === 2) return new Promise(resolve => { releaseStartup = () => resolve(json(rows)) })
      return json(rows)
    }
    checks.push(Number(path.match(/apps\/(\d+)/)[1]))
    return json({ update_available: false, pending_update_state: 'none' })
  })
  try {
    assert.ok(releaseStartup)
    await view.message()
    assert.deepEqual(checks.sort(), [11, 12], 'the newest read inherits the startup full-check obligation')
    await act(async () => releaseStartup())
    assert.deepEqual(checks.sort(), [11, 12], 'the stale startup read launches no duplicate checks')
  } finally { await act(async () => releaseStartup?.()); await view.close() }
})

test('an installed-only foreground read consumes pending event checks when it supersedes their read', async () => {
  let hold = false
  let releaseEvent
  const checks = []
  const view = await mount(async path => {
    if (path === '/api/apps/') {
      if (hold) { hold = false; return new Promise(resolve => { releaseEvent = () => resolve(json(installed())) }) }
      return json(installed())
    }
    checks.push(path)
    return json({ update_available: false, pending_update_state: 'none' })
  })
  try {
    checks.length = 0
    hold = true
    await view.message()
    assert.ok(releaseEvent)
    await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
    assert.equal(checks.length, 1, 'the debounced installed-only read still fulfills the pending event')
    await act(async () => releaseEvent())
    assert.equal(checks.length, 1)
  } finally { await act(async () => releaseEvent?.()); await view.close() }
})

test('an event during hung startup checks probes only its app and preserves unrelated answers', async () => {
  let releaseMaps
  const checks = []
  const mapsUrl = 'https://raw.githubusercontent.com/mobius-os/app-maps/main/mobius.json'
  const rows = [...installed(), {
    id: 12, slug: 'maps', name: 'Maps', version: '1.0.0', manifest_url: mapsUrl,
    source_manifest: { id: 'maps', url: mapsUrl },
  }]
  const view = await mount(async path => {
    if (path === '/api/apps/') return json(rows)
    const id = Number(path.match(/apps\/(\d+)/)[1])
    checks.push(id)
    if (id === 12) return new Promise(resolve => {
      releaseMaps = () => resolve(json({ update_available: true, pending_update_state: 'needs_resolution' }))
    })
    return json({ update_available: checks.length === 1, pending_update_state: checks.length === 1 ? 'needs_resolution' : 'none' })
  })
  try {
    assert.ok(releaseMaps)
    await view.message()
    assert.deepEqual(checks, [11, 12, 11], 'the event does not fan out across the hung startup round')
    await act(async () => releaseMaps())
    await view.library()
    assert.equal(view.voiceAction(), 'Open Voice', 'older startup state cannot overwrite the event result')
    const mapsAction = [...view.dom.window.document.querySelectorAll('.st-card-action')]
      .find(button => button.getAttribute('aria-label')?.endsWith(' Maps'))?.getAttribute('aria-label')
    assert.match(mapsAction, /Resolve/, 'the unaffected startup answer is not discarded')
  } finally { await act(async () => releaseMaps?.()); await view.close() }
})

test('a local update supersedes an older background check without waiting for it', async () => {
  let checks = 0
  let releaseCheck
  let updated = false
  const view = await mount(async path => {
    if (path === '/api/apps/') return json(installed(updated ? '2.0.0' : '1.0.0'))
    if (path.startsWith('/api/apps/11/update-candidate-preview')) return json({
      app_id: 11, upstream_version: '2.0.0', upstream_diff: '', source_digest: 'a'.repeat(64),
      upstream_commit: 'b'.repeat(40), capability_preview: {
        capability_digest: 'c'.repeat(64), capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    })
    if (path === '/api/apps/install') {
      updated = true
      return json({ id: 11, slug: 'voice', name: 'Voice', version: '2.0.0', mode: 'update', divergence: 'fast_forward' })
    }
    if (++checks === 2) return new Promise(resolve => {
      releaseCheck = () => resolve(json({ update_available: true, pending_update_state: 'needs_resolution' }))
    })
    return json({ update_available: true, pending_update_state: 'none' })
  })
  try {
    await view.library()
    await view.message()
    assert.ok(releaseCheck)
    const update = [...view.dom.window.document.querySelectorAll('.st-card-action')]
      .find(button => button.getAttribute('aria-label') === 'Update Voice')
    assert.ok(update)
    await act(async () => update.click())
    const confirm = view.dom.window.document.querySelector('.st-update-review-actions button.st-btn-primary')
    assert.ok(confirm)
    await act(async () => confirm.click())
    assert.ok(updated)
    assert.equal(view.voiceAction(), 'Open Voice')
    await act(async () => releaseCheck())
    assert.equal(view.voiceAction(), 'Open Voice', 'the pre-install resolver answer cannot undo local success')
  } finally { await act(async () => releaseCheck?.()); await view.close() }
})
