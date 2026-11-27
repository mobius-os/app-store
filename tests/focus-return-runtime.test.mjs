// The whole Store, mounted: each view swap moves focus once, into the new
// view, and Back returns it to the control that opened the view.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-focus-return-runtime')

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
test.after(() => rm(buildDir, { recursive: true, force: true }))

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})

async function until(check, description) {
  const deadline = Date.now() + 5000
  while (!check()) {
    assert.ok(Date.now() < deadline, `Timed out waiting for ${description}`)
    await act(async () => { await new Promise(resolve => setImmediate(resolve)) })
  }
}

const sharedListing = {
  id: 'shared-notes', name: 'Shared Notes', categories: ['Productivity'],
  latest_revision: { id: 'rev-1', manifest_url: 'https://example.test/notes/mobius.json', raw_base: 'https://example.test/notes/' },
  manifest: { id: 'shared-notes', name: 'Shared Notes', version: '1.0.0', description: 'Notes to share.' },
}

// `reviews` holds the shared listing's reviews read until the test resolves it.
async function mountStore({ reviews = null } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/', pretendToBeVisual: true })
  const keys = ['window', 'document', 'HTMLElement', 'ResizeObserver', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  // The shell's history owns every entry at once; tests call its callbacks.
  const entries = []
  const nav = {
    location: null,
    setLocation() {},
    open(label, callbacks) {
      const entry = { label, callbacks, closed: false, outcome: Promise.resolve({ status: 'owned' }), close() { entry.closed = true } }
      entries.push(entry)
      return entry
    },
  }
  dom.window.mobius = { signal() {}, nav }
  dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  // jsdom reports the frame unfocused once the focused node is removed; a
  // browser keeps the frame focused, which is what a view swap relies on.
  let frameFocused = true
  dom.window.document.hasFocus = () => frameFocused
  const { MANIFEST_SNAPSHOTS } = await import('../manifest-snapshots.js')
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url) => {
      const path = String(url)
      if (path === '/api/apps/') return json([])
      if (path.startsWith('/api/community/apps?')) return json({ items: [sharedListing] })
      if (path === `/api/community/apps/${sharedListing.id}/reviews`) {
        if (reviews) await reviews.promise
        return json({ items: [{ id: 'r1', stars: 5, review_text: 'Useful.', author_handle: 'someone' }] })
      }
      if (path === `/api/community/apps/${sharedListing.id}`) return json(sharedListing)
      if (path.startsWith('/api/proxy?')) {
        const remote = decodeURIComponent(path.split('url=')[1] || '')
        if (remote.endsWith('/catalog.json')) return json({ schema: 1, apps: [] })
        if (remote.includes('app-voice')) return json(MANIFEST_SNAPSHOTS.voice)
      }
      return json({}, 404)
    },
  })
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(dom.window.document.getElementById('root'))
  const { default: App } = await appModule()
  await act(async () => root.render(React.createElement(App, { appId: 39, token: 'tok' })))
  const doc = dom.window.document
  const find = (selector, description) => until(() => doc.querySelector(selector), description).then(() => doc.querySelector(selector))
  return {
    doc, entries, find,
    focused: () => doc.activeElement,
    // The person is in the shell (a host Back gesture), not in the Store.
    leaveFrame() { frameFocused = false },
    // A keyboard user moves focus to a control, then activates it.
    async activate(element) {
      await act(async () => { element.focus(); element.click() })
    },
    async hostBack(label) {
      const entry = entries.findLast(candidate => candidate.label === label && !candidate.closed)
      await act(async () => { entry.closed = true; entry.callbacks.onBack() })
    },
    async settle() {
      for (let turn = 0; turn < 10; turn += 1) {
        await act(async () => { await new Promise(resolve => setImmediate(resolve)) })
      }
    },
    async close() {
      await act(async () => root.unmount())
      dom.window.close()
      Object.assign(globalThis, old)
    },
  }
}

const tabNamed = (doc, name) => [...doc.querySelectorAll('button.st-tab')].find(button => button.textContent.startsWith(name))

test('an app page takes focus once, so reviews arriving later leave focus where the person moved it', async () => {
  let release
  const reviews = { promise: new Promise(resolve => { release = resolve }) }
  const view = await mountStore({ reviews })
  try {
    await act(async () => tabNamed(view.doc, 'Apps').click())
    const card = await view.find('[aria-label="Shared Notes — open details"]', 'the shared listing')
    const key = card.dataset.focusReturn
    await view.activate(card)
    await until(() => view.focused()?.id === 'st-detail-name', 'the app title to take focus')
    const back = view.doc.querySelector('.st-detail-v2 .st-backlink')
    back.focus()
    await act(async () => release())
    await until(() => /Useful\./.test(view.doc.body.textContent), 'the reviews to arrive')
    await view.settle()
    assert.equal(view.focused(), back, 'updating the open page does not pull focus back to the title')

    await view.hostBack('app-store-detail')
    assert.equal(view.focused()?.dataset.focusReturn, key, 'Back returns to the card that opened the page')
    assert.equal(view.focused()?.getAttribute('aria-label'), 'Shared Notes — open details')
  } finally { await view.close() }
})

test('See all opens a collection at its title, and either Back returns to that See all', async () => {
  const view = await mountStore()
  try {
    const seeAll = await view.find('[aria-label="See all New arrivals"]', 'the New arrivals shelf')
    await view.activate(seeAll)
    await until(() => view.focused()?.matches('.st-collection-view h1'), 'the collection title to take focus')
    assert.equal(view.focused().textContent, 'New arrivals')

    await view.hostBack('app-store-collection')
    assert.equal(view.focused()?.getAttribute('aria-label'), 'See all New arrivals', 'host Back')

    await view.activate(view.doc.querySelector('[aria-label="See all New arrivals"]'))
    await until(() => view.focused()?.matches('.st-collection-view h1'), 'the collection title again')
    await act(async () => view.doc.querySelector('.st-collection-view .st-backlink').click())
    assert.equal(view.focused()?.getAttribute('aria-label'), 'See all New arrivals', 'the page Back link')
  } finally { await view.close() }
})

test('a category page takes focus at its title and Back returns to the category row', async () => {
  const view = await mountStore()
  try {
    await act(async () => tabNamed(view.doc, 'Apps').click())
    const row = await view.find('.st-catrow', 'a category row')
    const key = row.dataset.focusReturn
    await view.activate(row)
    await until(() => view.focused()?.matches('h1.st-pagehead-title'), 'the category title to take focus')
    await act(async () => view.doc.querySelector('.st-backlink').click())
    assert.equal(view.focused()?.dataset.focusReturn, key)
  } finally { await view.close() }
})

test('a creator page opened from an app page returns focus to the developer link', async () => {
  const view = await mountStore()
  try {
    await act(async () => tabNamed(view.doc, 'Apps').click())
    await view.activate(await view.find('[aria-label="Shared Notes — open details"]', 'the shared listing'))
    const developer = await view.find('.st-dh-dev[data-focus-return]', 'the developer link')
    await view.activate(developer)
    await until(() => view.focused()?.matches('.st-creator h1'), 'the creator name to take focus')
    await view.hostBack('app-store-creator')
    await until(() => view.doc.querySelector('#st-detail-name'), 'the app page to return')
    assert.ok(view.focused()?.matches('.st-dh-dev'), 'focus is back on the developer link in the header')
  } finally { await view.close() }
})
