import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  readStoreLocation,
  reportStoreLocation,
  restoredStoreLocation,
  storeLocation,
} from '../store-location.js'

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
  }), { tab: 'browse', category: 'update', query: 'notes', collection: 'play', detail: 'community:abc-1' })
})

test('platforms without the location contract neither restore nor report', () => {
  assert.equal(readStoreLocation({ location: { tab: 'library' } }), null)
  assert.equal(readStoreLocation(undefined), null)
  assert.doesNotThrow(() => reportStoreLocation({ open() {} }, { tab: 'browse' }))
})

async function mountStore(nav) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
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
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' },
  })
  const { MANIFEST_SNAPSHOTS } = await import('../manifest-snapshots.js')
  globalThis.fetch = async (url) => {
    const path = String(url)
    if (path === '/api/apps/') return json([])
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
  const root = createRoot(dom.window.document.getElementById('root'))
  await act(async () => root.render(React.createElement(App, { appId: 39, token: 'tok' })))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
  return {
    dom,
    async settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) }) },
    async close() {
      await act(async () => root.unmount())
      Object.assign(globalThis, old)
      dom.window.close()
      await rm(buildDir, { recursive: true, force: true })
    },
  }
}

function fakeNav(location) {
  const nav = {
    location,
    reports: [],
    opened: [],
    setLocation(value) { nav.reports.push(value) },
    open(label) {
      nav.opened.push(label)
      return { outcome: Promise.resolve({ status: 'owned' }), ready: Promise.resolve(true), close() {} }
    },
  }
  return nav
}

const selectedTab = dom => dom.window.document.querySelector('[role="tab"][aria-selected="true"]')?.id

test('the Store reopens a saved tab and filter and never reports Browse first', async () => {
  const nav = fakeNav({ tab: 'library', category: 'installed', query: '', collection: null, detail: null })
  const view = await mountStore(nav)
  try {
    assert.equal(selectedTab(view.dom), 'st-tab-library')
    assert.ok(nav.reports.length > 0)
    assert.ok(nav.reports.every(place => place.tab === 'library'), JSON.stringify(nav.reports))
    assert.equal(nav.reports.at(-1).category, 'installed')

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
    await view.settle()
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
