import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { communityCatalogItems, creatorPictureUrl, creatorStorefront } from '../domain.js'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-creator-storefront')
const item = (id, kind = 'apps', publisher = 'maker') => ({
  id, repository: `${publisher}/${id}`, category: kind === 'games' ? 'worlds' : 'create',
  publisher: { login: publisher }, community: {},
  manifest: { id, name: id, version: '1.0.0', description: `${id} description`, store: { tagline: `${id} tagline` } },
})

test('creator portfolios contain only that creator, with real category summaries and no fictional biography', () => {
  const own = item('world', 'games'); own.manifest.store.hero = 'static/store/hero.png'
  const result = creatorStorefront([own, item('tool'), item('stranger', 'apps', 'elsewhere')], 'maker')
  assert.equal(result.items.length, 2)
  assert.equal(result.featured.id, 'world')
  assert.deepEqual(result.categories.sort(), ['Create', 'Worlds'])
  assert.equal(result.githubUrl, 'https://github.com/maker')
  assert.equal(result.picture, '')
  assert.equal(creatorStorefront([own], 'maker').featured, null, 'one app does not need duplicate featured content')
  assert.equal(creatorStorefront([own], 'missing').items.length, 0)
})

test('a creator photo requires the registry-linked Möbius handle, never an inferred GitHub match', () => {
  const url = 'https://www.mobius.you/avatars/example.webp'
  assert.equal(creatorPictureUrl({ login: 'maker', avatar_url: url }), '')
  assert.equal(creatorPictureUrl({ handle: 'maker', avatar_url: 'https://avatars.githubusercontent.com/1' }), '')
  assert.equal(creatorPictureUrl({ handle: 'maker', avatar_url: 'https://www.mobius.you.evil.test/avatar' }), '')
  assert.equal(creatorPictureUrl({ handle: 'maker', avatar_url: 'http://www.mobius.you/avatar' }), '')
  assert.equal(creatorPictureUrl({ handle: 'maker', avatar_url: 'https://x@www.mobius.you/avatar' }), '')
  assert.equal(creatorPictureUrl({ handle: 'maker', avatar_url: url }), url)
  assert.equal(creatorPictureUrl({ handle: 'maker', avatar_url: 'https://lh3.googleusercontent.com/photo' }), 'https://lh3.googleusercontent.com/photo')
  const rows = communityCatalogItems([{ id: 'id', repository: 'github-login/app', manifest: {},
    publisher: { login: 'github-login', handle: 'mobius-handle', avatar_url: url },
    latest_revision: { manifest_url: 'https://example.test/mobius.json', raw_base: 'https://example.test/' } }])
  const result = creatorStorefront(rows, 'mobius-handle')
  assert.equal(result.picture, url)
  assert.equal(result.githubUrl, 'https://github.com/github-login')
})

async function modules() {
  const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
  const require = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const result = {}
  for (const [name, file] of [['catalog', 'CatalogList.jsx'], ['images', 'StoreImage.jsx']]) {
    const build = await rolldown({ input: join(here, '..', 'ui', file), platform: 'node', tsconfig: false,
      external: ['react', 'react/jsx-runtime'],
      resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
      transform: { jsx: 'react-jsx' } })
    const output = join(buildDir, `${name}.mjs`)
    await build.write({ file: output, format: 'es' }); await build.close()
    result[name] = await import(pathToFileURL(output).href)
  }
  return result
}

test('creator navigation owns the full portfolio from search, filters, explores and resets between creators', async () => {
  const { catalog: { CatalogList } } = await modules()
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(k => [k, globalThis[k]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root')); const picks = []
  const list = [item('world', 'games'), item('tool'), item('other', 'apps', 'elsewhere')]
  function Harness({ name }) {
    const [creatorFilter, setCreatorFilter] = React.useState({ name: '', value: 'all' })
    return React.createElement(CatalogList, {
    creatorFilter, onCreatorFilter: (name, value) => setCreatorFilter({ name, value }),
    activeCollection: `dev:${name}`, view: 'search', items: [list[0]], allItems: list, token: 'test',
    onPick: x => picks.push(x.id),
  })
  }
  const render = name => act(async () => root.render(React.createElement(Harness, { name })))
  try {
    await render('maker')
    const doc = dom.window.document
    const buttons = () => [...doc.querySelectorAll('button')]
    assert.equal(doc.querySelectorAll('.st-creator-card').length, 2)
    await act(async () => buttons().find(b => b.textContent === 'Games').click())
    assert.equal(doc.querySelectorAll('.st-creator-card').length, 1)
    await act(async () => doc.querySelector('.st-creator-card').click())
    assert.deepEqual(picks, ['world'])
    await render('elsewhere')
    assert.equal(doc.querySelectorAll('.st-creator-card').length, 1, 'new creator never inherits the Games filter')
    assert.match(doc.querySelector('.st-creator-card').textContent, /other/)
    assert.equal(doc.querySelector('.st-creator-filters'), null, 'irrelevant filters do not crowd a single-kind portfolio')
    assert.equal(doc.querySelector('.st-backlink'), null, 'the page bar above owns Back, as on an app page')
    await render('missing')
    assert.equal(doc.querySelectorAll('.st-creator-card').length, 0)
    assert.match(doc.body.textContent, /No published apps/)
  } finally {
    await act(async () => root.unmount()); Object.assign(globalThis, old); dom.window.close()
  }
})

test('creator pictures fall back on failed reads and discard late images for a previous creator', async () => {
  const { images: { CreatorPicture } } = await modules()
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT', 'fetch', 'FileReader']
  const old = Object.fromEntries(keys.map(k => [k, globalThis[k]])); const readers = []; let complete
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => new Promise(resolve => { complete = resolve }),
    FileReader: class { readAsDataURL() { readers.push(this) } abort() {} },
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  const render = url => act(async () => root.render(React.createElement('div', null, 'M', React.createElement(CreatorPicture, {url, token:'test', name:'maker'}))))
  try {
    await render('https://www.mobius.you/first-photo.png')
    await act(async () => complete(new Response('image', {headers:{'content-type':'image/png'}})))
    assert.equal(readers.length, 1)
    await render('')
    await act(async () => { readers[0].result='data:image/png;base64,AA=='; readers[0].onload() })
    assert.equal(dom.window.document.querySelector('img'), null, 'a stale creator image must never appear')
    await render('https://www.mobius.you/second-photo.png')
    await act(async () => complete(new Response('no photo', { status:404 })))
    assert.equal(dom.window.document.body.textContent, 'M')
    await render('https://www.mobius.you/third-photo.png')
    await act(async () => complete(new Response('image', {headers:{'content-type':'image/png'}})))
    await act(async () => { readers[1].result='data:image/png;base64,AA=='; readers[1].onload() })
    const img=dom.window.document.querySelector('img'); assert.ok(img)
    await act(async () => img.dispatchEvent(new dom.window.Event('error')))
    assert.equal(dom.window.document.querySelector('img'), null)
    assert.equal(dom.window.document.body.textContent, 'M')
  } finally {
    await act(async () => root.unmount()); Object.assign(globalThis, old); dom.window.close()
    await rm(buildDir, {recursive:true, force:true})
  }
})


test('category and collection pages offer the community listings beyond the loaded window', async () => {
  const { catalog: { CatalogList } } = await modules()
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(k => [k, globalThis[k]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  let loads = 0
  const list = [item('tool'), item('sketch')]
  const render = (props) => act(async () => root.render(React.createElement(CatalogList, {
    items: list, allItems: list, token: 'test', hasMore: true, onLoadMore: () => { loads++ }, ...props,
  })))
  const loadMore = () => [...dom.window.document.querySelectorAll('button')]
    .find(button => button.textContent === 'Load more community apps')
  try {
    await render({ view: 'apps', shelfCategory: 'create' })
    assert.ok(loadMore(), 'a category page reached from the Apps tab')
    await act(async () => loadMore().click())
    assert.equal(loads, 1)

    await render({ view: 'discover', activeCollection: 'create' })
    assert.ok(loadMore(), 'a category opened from Discover')
    assert.match(dom.window.document.querySelector('.st-pagehead-sub').textContent, /2 apps loaded/)

    await render({ view: 'discover', activeCollection: 'arrivals' })
    assert.ok(loadMore(), 'an editorial collection')

    await render({ view: 'apps', shelfCategory: 'create', hasMore: false })
    assert.equal(loadMore(), undefined, 'nothing more to load')
  } finally {
    await act(async () => root.unmount()); Object.assign(globalThis, old); dom.window.close()
  }
})
