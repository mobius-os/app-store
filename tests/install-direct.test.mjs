import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-install-direct')
const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES

async function bundleDetailView() {
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'DetailView.jsx'),
    platform: 'node',
    tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'detail.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}

function useDom() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'ResizeObserver']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  dom.window.ResizeObserver = globalThis.ResizeObserver
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
  return { dom, restore() { Object.assign(globalThis, old); dom.window.close() } }
}

const item = {
  id: 'maps',
  manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-maps/main/mobius.json',
  manifest: { id: 'maps', name: 'Maps', version: '1.0.0', description: 'Find places.', author: 'mobius-os', license: 'MIT' },
}

test('a fresh install is available at once and installs with no access check or digest', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const installs = []
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    // No capability review has loaded (or it failed): a fresh install must not wait for it.
    await act(async () => root.render(React.createElement(DetailView, {
      item, installed: [], capabilityReview: undefined, onBack() {}, onInstall: (...args) => installs.push(args), token: 't',
    })))
    const cta = dom.window.document.querySelector('.st-dh-acts .st-dbtn.is-primary')
    assert.ok(cta, 'the primary button renders')
    assert.equal(cta.disabled, false)
    assert.doesNotMatch(cta.textContent, /Reviewing access|Access unavailable/)
    await act(async () => cta.click())
    assert.deepEqual(installs, [[item]])
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('a lone category shares the creator line without losing category navigation or real release facts', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const doc = dom.window.document
  const root = createRoot(doc.getElementById('root'))
  const opened = []
  const base = { ...item, manifest_url: undefined, category: 'create' }
  const props = { installed: [], onBack() {}, onInstall() {}, token: 't',
    onOpenDeveloper: developer => opened.push(['developer', developer]),
    onOpenCategory: category => opened.push(['category', category]) }
  const show = next => act(async () => root.render(React.createElement(DetailView, { ...props, item: next })))
  try {
    await show(base)
    assert.equal(doc.querySelector('.st-strip'), null, 'one category never reserves a whole facts section')
    const category = doc.querySelector('.st-dh-meta .st-dh-category')
    assert.equal(category.getAttribute('aria-label'), 'Category: Create')
    await act(async () => category.click())
    await act(async () => doc.querySelector('.st-dh-dev').click())
    assert.deepEqual(opened.map(([kind]) => kind), ['category', 'developer'])
    assert.equal(opened[0][1], 'create')

    await show({ ...base, published_at: '2026-11-01T12:00:00Z' })
    assert.equal(doc.querySelector('.st-dh-category'), null, 'the category stays with other facts when a release date exists')
    assert.match(doc.querySelector('.st-strip').textContent, /Category.*Create.*Updated/s)

    await show({ ...base, community_feedback: { id: 'example', revision_id: 'v1', rating_count: 2, rating_average: 4.5, reviews: [] } })
    assert.equal(doc.querySelector('.st-dh-category'), null)
    assert.match(doc.querySelector('.st-strip').textContent, /2 ratings.*4.5.*Create/s,
      'real ratings remain visible rather than being removed with the empty strip')
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test("What's new starts folded, keeps the notes and history link, and resets for another app", async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const oldFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => [
    { parents: [{}], commit: { message: 'Improve screenshot proportions', committer: { date: '2026-11-18T10:00:00Z' } } },
  ] })
  const doc = dom.window.document
  const root = createRoot(doc.getElementById('root'))
  const props = { installed: [], onBack() {}, onInstall() {}, token: 't' }
  const show = next => act(async () => root.render(React.createElement(DetailView, { ...props, item: next })))
  try {
    await show({ ...item, id: 'release-notes', manifest_url: 'https://raw.githubusercontent.com/mobius-os/release-notes-fixture/main/mobius.json' })
    let disclosure = doc.querySelector('.st-whats-new')
    assert.ok(disclosure)
    assert.equal(disclosure.open, false)
    assert.match(disclosure.querySelector('summary').textContent, /What.s new.*Version/s)
    await act(async () => disclosure.querySelector('summary').click())
    assert.equal(disclosure.open, true)
    assert.match(disclosure.querySelector('.st-wn-list').textContent, /Improve screenshot proportions/)
    assert.equal(disclosure.querySelector('.st-wn-all').href, 'https://github.com/mobius-os/release-notes-fixture/commits/main')
    await act(async () => disclosure.querySelector('summary').click())
    assert.equal(disclosure.open, false)
    await act(async () => disclosure.querySelector('summary').click())
    await show({ ...item, id: 'another-app', manifest_url: undefined,
      community: { repository_update: { commit_sha: '1234567890abcdef' } } })
    disclosure = doc.querySelector('.st-whats-new')
    assert.equal(disclosure.open, false, 'a new app does not inherit the previous app’s expanded section')
    assert.match(disclosure.querySelector('.st-wn-note').textContent, /1234567/)
    await show({ ...item, id: 'no-notes', manifest_url: undefined })
    assert.equal(doc.querySelector('.st-whats-new'), null, 'no empty dropdown when no release notes are available')
  } finally {
    await act(async () => root.unmount()); globalThis.fetch = oldFetch; restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('screenshot viewers keep keyboard focus inside and return it to the opening screenshot', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const doc = dom.window.document
  const root = createRoot(doc.getElementById('root'))
  const press = async (element, key, shiftKey = false) => {
    const event = new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
    await act(async () => element.dispatchEvent(event))
    return event
  }
  try {
    for (const count of [1, 2]) {
      await act(async () => root.render(React.createElement(DetailView, {
        key: count, item: { ...item, manifest_url: undefined,
          listing: { screenshots: Array.from({ length: count }, (_, n) => ({ src: 'screen-' + n + '.png', alt: 'Screen ' + (n + 1) })) } },
        installed: [], storeAppId: 1, onBack() {}, onInstall() {}, token: 't',
      })))
      const opener = doc.querySelector('.st-shot')
      await act(async () => opener.querySelector('img').dispatchEvent(new dom.window.Event('load')))
      opener.focus()
      await act(async () => opener.click())
      const dialog = doc.querySelector('.st-viewer')
      const close = dialog.querySelector('.st-viewer-close')
      const last = [...dialog.querySelectorAll('button')].at(-1)
      assert.equal(doc.activeElement, close, 'Close is focused on open')
      assert.equal((await press(close, 'Tab', true)).defaultPrevented, true)
      assert.equal(doc.activeElement, last, 'Shift+Tab wraps inside the viewer')
      assert.equal((await press(last, 'Tab')).defaultPrevented, true)
      assert.equal(doc.activeElement, close, 'Tab wraps back to Close')
      if (count > 1) {
        const next = dialog.querySelector('[aria-label="Next screenshot"]')
        next.focus()
        await act(async () => next.click())
        assert.match(dialog.querySelector('.st-viewer-bar').textContent, /2 of 2/)
        assert.equal(doc.activeElement, next, 'changing screenshot does not reset focus')
        await press(next, 'ArrowLeft')
        assert.match(dialog.querySelector('.st-viewer-bar').textContent, /1 of 2/)
        assert.equal(doc.activeElement, next)
        // A mouse click on the image or counter leaves focus on the page body;
        // the arrow keys must still change screenshots.
        next.blur()
        assert.equal(doc.activeElement, doc.body)
        assert.equal((await press(doc.body, 'ArrowRight')).defaultPrevented, true)
        assert.match(dialog.querySelector('.st-viewer-bar').textContent, /2 of 2/)
        next.focus()
      }
      await press(doc.activeElement, 'Escape')
      assert.equal(doc.querySelector('.st-viewer'), null)
      assert.equal(doc.activeElement, opener, 'closing restores the opening screenshot')
    }
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('failed screenshots retry in place in the thumbnail and viewer without losing focus', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const doc = dom.window.document
  const root = createRoot(doc.getElementById('root'))
  const imageEvent = (container, kind) => act(async () =>
    container.querySelector('img').dispatchEvent(new dom.window.Event(kind)))
  try {
    await act(async () => root.render(React.createElement(DetailView, {
      item: { ...item, manifest_url: undefined, listing: { screenshots: ['one.png'] } },
      storeAppId: 1, installed: [], onBack() {}, onInstall() {}, token: 't',
    })))
    const thumb = doc.querySelector('.st-shot')
    const viewer = () => doc.querySelector('.st-viewer')
    assert.equal(thumb.getAttribute('aria-disabled'), 'true')
    await act(async () => thumb.click())
    assert.equal(viewer(), null, 'loading does not open a blank viewer')
    await imageEvent(thumb, 'error')
    assert.equal(thumb.dataset.state, 'failed')
    assert.match(thumb.textContent, /Screenshot couldn’t load.*Try again/s)
    thumb.focus()
    await act(async () => thumb.click())
    assert.equal(thumb.dataset.state, 'loading')
    assert.match(thumb.querySelector('img').src, /one\.png\?image_retry=1$/)
    assert.equal(doc.activeElement, thumb)
    await imageEvent(thumb, 'load')
    assert.equal(thumb.dataset.state, 'ready')
    await act(async () => thumb.click())
    await imageEvent(viewer(), 'error')
    assert.match(viewer().querySelector('[role="status"]').textContent, /couldn’t load/)
    const retry = viewer().querySelector('.st-viewer-retry')
    retry.focus()
    await act(async () => retry.click())
    assert.equal(doc.activeElement, viewer().querySelector('.st-viewer-close'))
    assert.match(viewer().querySelector('img').src, /one\.png\?image_retry=1$/)
    await imageEvent(viewer(), 'load')
    assert.equal(viewer().querySelector('[data-state]').dataset.state, 'ready')
    await act(async () => viewer().querySelector('.st-viewer-close').click())
    assert.equal(viewer(), null)
    assert.equal(doc.activeElement, thumb)
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('retrying a proxied screenshot rechecks the source instead of reusing its failed response', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const doc = dom.window.document
  const root = createRoot(doc.getElementById('root'))
  const calls = []
  const before = globalThis.fetch
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ source: new URL(url, 'https://store.test').searchParams.get('url'), cache: options.cache })
      return calls.length === 1 ? new Response(null, { status: 503 })
        : new Response('image fixture', { headers: { 'content-type': 'image/png' } })
    }
    await act(async () => root.render(React.createElement(DetailView, {
      item: { ...item, manifest_url: undefined, raw_base: 'https://example.com/sample/',
        manifest: { ...item.manifest, store: { screenshots: ['remote.png'] } } },
      storeAppId: 1, installed: [], onBack() {}, onInstall() {}, token: 't',
    })))
    const thumb = doc.querySelector('.st-shot')
    assert.equal(thumb.dataset.state, 'failed')
    await act(async () => thumb.click())
    assert.deepEqual(calls, [
      { source: 'https://example.com/sample/remote.png', cache: undefined },
      { source: 'https://example.com/sample/remote.png', cache: 'reload' },
    ])
    const loaded = thumb.querySelector('img')
    assert.match(loaded.src, /^blob:/)
    await act(async () => loaded.dispatchEvent(new dom.window.Event('load')))
    assert.equal(thumb.dataset.state, 'ready')
  } finally {
    await act(async () => root.unmount()); globalThis.fetch = before; restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})
