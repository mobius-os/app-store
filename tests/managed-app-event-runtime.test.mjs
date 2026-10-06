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

async function mount(fetchApps) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const keys = ['window', 'document', 'HTMLElement', 'ResizeObserver', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const parent = {}
  Object.defineProperty(dom.window, 'parent', { value: parent })
  dom.window.mobius = { signal() {} }
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async url => {
      const path = String(url)
      if (path === '/api/apps/' || path.startsWith('/api/apps/11/update-check')) return fetchApps(path)
      if (path.startsWith('/api/proxy?')) {
        const remote = decodeURIComponent(path.split('url=')[1] || '')
        if (remote.endsWith('/catalog.json')) return json({ schema: 1, apps: [] })
        if (remote.includes('app-voice')) return json(MANIFEST_SNAPSHOTS.voice)
      }
      return json({}, 404)
    },
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  const { default: App } = await appModule()
  await act(async () => root.render(React.createElement(App, { appId: 999, token: 'tok' })))
  return {
    dom,
    async message({ source = parent, type = 'moebius:managed-app-event' } = {}) {
      await act(async () => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        source, origin: 'https://shell.test', data: { type, event: { type: 'app_updated', appId: '11' } },
      })))
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
      if (reads === 3) return new Promise(resolve => { release = () => resolve(json(installed('2.0.0'))) })
      return json(installed(resolved ? '2.0.0' : '1.0.0'))
    }
    checks++
    return json({ update_available: !resolved, pending_update_state: resolved ? 'none' : 'needs_resolution' })
  })
  try {
    await view.library()
    assert.match(view.voiceAction(), /Resolve/)
    assert.equal(reads, 1)
    assert.equal(checks, 1)
    await view.message({ source: view.dom.window })
    await view.message({ type: 'unrelated-event' })
    assert.equal(reads, 1, 'only parent messages with the managed-app type invalidate state')

    resolved = true
    await view.message()
    assert.equal(reads, 2)
    assert.equal(checks, 2, 'completion bypasses the foreground-check debounce')
    assert.equal(view.voiceAction(), 'Open Voice', 'fresh pending state removes the resolver action')

    await view.message()
    assert.ok(release, 'the third installed read is still in flight')
    resolved = false
    await view.message()
    await act(async () => release())
    assert.equal(reads, 4, 'an event arriving during a read triggers a subsequent authoritative read')
    assert.equal(checks, 4)
    assert.match(view.voiceAction(), /Resolve/)
  } finally {
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

test('completion waits for a pre-event update check before reading the new outcome', async () => {
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
    assert.equal(checks, 1, 'do not race a newer check against an older in-flight answer')
    await act(async () => releaseCheck())
    await view.library()
    assert.equal(checks, 2)
    assert.equal(view.voiceAction(), 'Open Voice', 'the old resolver state cannot overwrite completion')
  } finally {
    await view.close()
  }
})
