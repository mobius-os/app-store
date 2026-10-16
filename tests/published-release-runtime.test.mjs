import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPublicationListingReader, loadCommunityPublications } from '../api.js'
import { communityPublicationsByLocalApp, publishedAppView } from '../domain.js'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-published-release')
test('release details use the public manifest and revision date, not publication status dates', async () => {
  const old = globalThis.fetch
  globalThis.fetch = async url => Response.json(String(url).startsWith('/api/community/publications?')
    ? { items: [{ local_app_id: 'app:14:pocket-list', status: 'live', community_app_id: 'app_pocket-list', updated_at: '2026-10-12T00:00:00Z' }] }
    : { manifest: { version: '0.1.0' }, latest_revision: { created_at: '2025-01-15T00:00:00Z' }, rating_average: 3, rating_count: 1 })
  try {
    const payload = await loadCommunityPublications('test')
    const listings = {}
    await createPublicationListingReader('test', (id, listing) => { listings[id] = listing })(payload.items)
    const state = publishedAppView(communityPublicationsByLocalApp(payload)[14], listings['app_pocket-list'])
    assert.equal(state.published_version, '0.1.0')
    assert.equal(state.published_at, '2025-01-15T00:00:00Z')
    const unknown = communityPublicationsByLocalApp({ items: [{ local_app_id: 'app:14', updated_at: '2026-10-12' }] })[14]
    assert.equal(unknown.published_at, '')
    assert.equal(unknown.published_version, '')
  } finally { globalThis.fetch = old }
})

test('creator release details and public-listing action handle known, missing and withdrawn releases', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'ui', 'PublishedApps.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'], transform: { jsx: 'react-jsx' },
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } } })
  const output = join(buildDir, 'release.mjs'); await build.write({ file: output, format: 'es' }); await build.close()
  const { PublishedAppPage } = await import(pathToFileURL(output).href)
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const calls = []
  const props = { app: { id: 14, name: 'Pocket List', version: '9.9.9' }, onLoadReviews: async () => ({ items: [] }), onViewInStore: id => calls.push(id) }
  try {
    await act(async () => root.render(React.createElement(PublishedAppPage, { ...props,
      state: { status: 'live', community_app_id: 'app_pocket-list', published_version: '0.1.0', published_at: '2025-01-15T12:00:00Z', stats: { installs: 7 } } })))
    assert.equal(dom.window.document.querySelector('.st-mine-numbers b').textContent, '7')
    const panel = dom.window.document.querySelector('.st-mine-release')
    assert.match(panel.textContent, /Published version0.1.0/)
    assert.doesNotMatch(panel.textContent, /9.9.9/)
    assert.equal(panel.querySelector('time').dateTime, '2025-01-15T12:00:00.000Z')
    const view = [...dom.window.document.querySelectorAll('button')].find(b => b.textContent === 'View in Store')
    await act(async () => view.click()); assert.deepEqual(calls, ['app_pocket-list'])
    await act(async () => root.render(React.createElement(PublishedAppPage, { ...props,
      state: { status: 'withdrawn', community_app_id: 'app_pocket-list', published_at: 'not a date' } })))
    assert.equal(dom.window.document.querySelector('.st-mine-numbers'), null, 'a withdrawn app shows no blank stats')
    assert.match(dom.window.document.body.textContent, /Installs and ratings appear while the app is live/)
    assert.equal(dom.window.document.querySelector('time'), null)
    assert.match(dom.window.document.querySelector('.st-mine-release').textContent, /Not available/)
    assert.equal([...dom.window.document.querySelectorAll('button')].some(b => b.textContent === 'View in Store'), false)
    await act(async () => root.render(React.createElement(PublishedAppPage, { ...props,
      onLoadReviews: async () => ({ items: [{ id: 'review_example', stars: 4, review_text: 'Useful' }], next_offset: 20 }),
      state: { status: 'live', community_app_id: 'app_example' } })))
    assert.equal(dom.window.document.querySelectorAll('.st-mine-numbers b')[2].textContent, '–', 'one page is not a total')
    assert.match(dom.window.document.body.textContent, /Showing the latest reviews, not the full total/)
    await act(async () => root.render(React.createElement(PublishedAppPage, { ...props,
      state: { status: 'live', community_app_id: 'app_example', listing: 'unavailable', stats: { installs: 3 } } })))
    assert.equal(dom.window.document.querySelectorAll('.st-mine-numbers b')[1].textContent, 'Unavailable',
      'an unreadable listing is not shown as "no ratings"')
    assert.match(dom.window.document.body.textContent, /ratings and release details are unavailable/)

  } finally {
    await act(async () => root.unmount()); Object.assign(globalThis, old); dom.window.close()
    await rm(buildDir, { recursive: true, force: true })
  }
})
