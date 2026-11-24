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

test('Get waits for access, supports retry, and binds a low-impact one-tap install', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const installs = []
  let retries = 0
  const root = createRoot(dom.window.document.getElementById('root'))
  const show = review => act(async () => root.render(React.createElement(DetailView, {
    item: { ...item, manifest_url: undefined }, installed: [], capabilityReview: review, onBack() {},
    onInstall: (...args) => installs.push(args), onRetryCapabilityReview: () => retries++, token: 't',
  })))
  try {
    await show(undefined)
    const cta = dom.window.document.querySelector('.st-dh-acts .st-dbtn.is-primary')
    assert.equal(cta.disabled, true)
    assert.equal(cta.textContent, 'Checking access…')
    await act(async () => cta.click())
    assert.equal(installs.length, 0)
    await show({ status: 'error' })
    assert.equal(cta.textContent, 'Retry access check')
    await act(async () => cta.click())
    assert.deepEqual([retries, installs.length], [1, 0])
    await show({ status: 'ready', preview: { capability_digest: 'a'.repeat(64), access_rows: [] } })
    assert.equal(cta.textContent, 'Retry access check', 'incomplete preview does not certify zero access')
    await show({ status: 'ready', preview: {
      capability_digest: 'a'.repeat(64), capability_contract: {}, access_rows: [], installed_access_rows: [],
    } })
    assert.equal(cta.textContent, 'Get')
    assert.equal(cta.disabled, false)
    await act(async () => cta.click())
    assert.deepEqual(installs.map(([, opts]) => opts), [{ capabilityDigest: 'a'.repeat(64) }])
    assert.equal(dom.window.document.querySelector('[aria-modal]'), null)
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('scheduled and broad access require centered confirmation; cancel restores Get', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const installs = []
  const doc = dom.window.document
  const root = createRoot(doc.getElementById('root'))
  const daily = { id: 'background_job', title: 'Run on a schedule', text: 'Runs daily at 10:00.', critical: false }
  const show = (rows, background = null) => act(async () => root.render(React.createElement(DetailView, {
    item: { ...item, manifest_url: undefined }, installed: [], onBack() {}, onInstall: (...args) => installs.push(args),
    capabilityReview: { status: 'ready', preview: { capability_digest: 'c'.repeat(64), installed_access_rows: [],
      capability_contract: { background }, access_rows: rows } }, token: 't',
  })))
  const cta = () => doc.querySelector('.st-dh-acts .st-dbtn.is-primary')
  const review = () => doc.querySelector('[aria-modal=true]')
  try {
    await show([daily, { id: 'agent_role', title: 'Run AI agents', text: 'Runs agents.' }], { job: 'report.py', cron: '0 10 * * *' })
    assert.match(doc.querySelector('.st-dh .st-detail-note').textContent, /Runs daily at 10:00 UTC and can run AI agents/)
    const access = doc.getElementById('st-detail-access')
    const region = doc.getElementById('st-detail-access-body')
    const jumpStates = []
    access.scrollIntoView = () => jumpStates.push(region.hidden)
    const jump = () => act(async () => doc.querySelector('.st-install-access-link').click())
    assert.equal(region.hidden, true)
    await jump()
    assert.ok(doc.activeElement === access)
    assert.equal(region.hidden, false)
    assert.deepEqual(jumpStates, [false], 'scroll measures the expanded listing, not the folded one')
    await jump()
    assert.deepEqual(jumpStates, [false, false], 'the shortcut also scrolls when access is already open')
    await act(async () => access.click())
    assert.equal(region.hidden, true)
    assert.deepEqual(jumpStates, [false, false], 'using the disclosure itself does not replay the jump')
    await act(async () => cta().click())
    assert.equal(installs.length, 0)
    assert.match(review().textContent, /Run on a schedule/)
    assert.match(review().textContent, /first open/)
    assert.equal(doc.activeElement.textContent, 'Cancel')
    await act(async () => doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(review(), null)
    assert.equal(doc.activeElement, cta())
    await show([{ id: 'shared_memory', title: 'Use shared memory', text: 'Can change it.', level: 'write' }])
    await act(async () => cta().click())
    assert.equal(installs.length, 0)
    await act(async () => review().querySelector('.st-btn-primary').click())
    assert.deepEqual(installs.map(([, opts]) => opts), [{ capabilityDigest: 'c'.repeat(64), confirmed: true }])
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
