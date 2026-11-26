import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-library-row')

const builds = {}
function buildUi(file) {
  builds[file] ||= (async () => {
    const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
    const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
    await mkdir(buildDir, { recursive: true })
    const build = await rolldown({ input: join(here, '..', 'ui', file), platform: 'node', tsconfig: false,
      external: ['react', 'react/jsx-runtime'],
      resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
      transform: { jsx: 'react-jsx' } })
    const output = join(buildDir, file.replace(/\.jsx$/, '.mjs'))
    await build.write({ file: output, format: 'es' }); await build.close()
    return import(pathToFileURL(output).href)
  })()
  return builds[file]
}
const catalogCard = async () => (await buildUi('CatalogCard.jsx')).CatalogCard
test.after(() => rm(buildDir, { recursive: true, force: true }))

test('every Library row keeps Details in its More menu, only a ready app launches on tap, and only an app not installed yet keeps Get', async () => {
  const CatalogCard = await catalogCard()
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const doc = dom.window.document
  const item = { id: 'pocket', manifest: { id: 'pocket', name: 'Pocket', package_id: 'pkg.pocket' } }
  const installed = [{ id: 7, slug: 'pocket', name: 'Pocket', package_id: 'pkg.pocket' }]
  let calls = []
  const props = {
    item, installed, layout: 'list', pickOpensApp: true,
    onPick: picked => calls.push(['details', picked.id]),
    onOpenInstalled: id => calls.push(['open', id]),
    onUpdate: (picked, opts) => calls.push(['update', picked.id, opts.isUpdate]),
    onRateApp: picked => calls.push(['rate', picked.id]),
  }
  async function show(extra) {
    calls = []
    await act(async () => root.render(React.createElement(CatalogCard, { ...props, ...extra })))
  }
  const named = label => [...doc.querySelectorAll('button')].find(b => b.textContent.trim() === label)
  const tapRow = () => act(async () => doc.querySelector('.st-card-open').click())
  // Details and Review live behind the row's More menu.
  const menu = async (label) => {
    const more = doc.querySelector('.st-rowmenu-btn')
    if (!more) return undefined
    await act(async () => more.click())
    const item = named(label)
    if (!item) await act(async () => more.click())
    return item
  }
  try {
    await show({})
    await tapRow()
    await act(async () => (await menu('Details')).click())
    assert.deepEqual(calls, [['open', 7], ['details', 'pocket']], 'a ready app launches; Details opens its page')
    assert.equal(await menu('Review'), undefined, 'an app without community ratings has no Review action')

    await show({ updateChecks: { 7: { available: true } } })
    await tapRow()
    await act(async () => named('Update').click())
    assert.deepEqual(calls, [['details', 'pocket'], ['update', 'pocket', true]],
      'a row with an update opens details instead of launching the old version')
    assert.ok(await menu('Details'))
    await act(async () => doc.querySelector('.st-rowmenu-btn').click())

    await show({ item: { ...item, setup: { required: true } } })
    await tapRow()
    assert.deepEqual(calls, [['details', 'pocket']], 'unfinished setup opens details')

    await show({ item: { ...item, community: { id: 'app_pocket' } } })
    await act(async () => (await menu('Review')).click())
    assert.deepEqual(calls, [['rate', 'pocket']])

    // A saved app that is not installed yet keeps Get on its Library row.
    await show({ installed: [] })
    await tapRow()
    await act(async () => named('Get').click())
    assert.deepEqual(calls, [['details', 'pocket'], ['update', 'pocket', false]], 'the row opens the page; Get installs')
    assert.equal(doc.querySelector('.st-installed-dot'), null)

    await show({ blocked: true })
    await tapRow()
    assert.deepEqual(calls, [['open', 7]], 'another app installing does not stop a launch')

    await show({ busy: true, busyActionKind: 'checking_update' })
    await tapRow()
    assert.deepEqual(calls, [['details', 'pocket']], 'an app busy with its own action opens its page')

    // Browse rows have no Get or Open button: a tap opens the app page, even
    // for an installed app, so its reviews and what's new stay one tap away.
    for (const layout of ['row', 'grid']) {
      await show({ pickOpensApp: false, layout })
      assert.equal(doc.querySelector('.st-card-open').getAttribute('aria-label'), 'Pocket — open details')
      await tapRow()
      assert.deepEqual(calls, [['details', 'pocket']], `an installed ${layout} card opens its page, not the app`)
      assert.equal(doc.querySelector('.st-card-action'), null, 'no Open button')
      assert.ok(doc.querySelector('.st-installed-dot'), 'installed apps carry the icon seal')
      assert.equal(doc.querySelector('.st-card-status-row'), null, 'and nothing at the end of the row')
      assert.equal(doc.querySelector('.st-rowmenu-btn'), null, 'Browse cards have no More menu')
      assert.equal(named('Details'), undefined)

      await show({ pickOpensApp: false, layout, installed: [] })
      await tapRow()
      assert.deepEqual(calls, [['details', 'pocket']], 'an app not yet installed opens its page, which owns Get')
      assert.equal(doc.querySelector('.st-card-action'), null, 'no Get button')
      assert.equal(doc.querySelector('.st-installed-dot'), null)
    }
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
  }
})

test('a featured card and a browse row agree on what a tap does, whether a button shows and the installed seal', async () => {
  const CatalogCard = await catalogCard()
  const { FeatureCard } = await buildUi('StoreSections.jsx')
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const doc = dom.window.document
  const item = { id: 'pocket', manifest: { id: 'pocket', name: 'Pocket', package_id: 'pkg.pocket' } }
  const ready = [{ id: 7, slug: 'pocket', name: 'Pocket', package_id: 'pkg.pocket' }]
  let calls = []
  const handlers = {
    onOpenInstalled: id => calls.push(['open', id]),
    onUpdate: picked => calls.push(['update', picked.id]),
    onReviewUpdate: () => calls.push(['resolve']),
  }
  const onPick = picked => calls.push(['details', picked.id])
  // What a person sees and gets on one surface: the tap's result, a button, the seal.
  async function observe(surface, state) {
    calls = []
    const props = { installed: ready, updateChecks: {}, ...handlers, ...state }
    await act(async () => root.render(surface === 'row'
      ? React.createElement(CatalogCard, { item, layout: 'row', onPick, ...props })
      : React.createElement(FeatureCard, { item, kicker: 'Pick', appId: 1, token: 't', onPick, actionProps: props })))
    const open = doc.querySelector(surface === 'row' ? '.st-card-open' : '.st-fcard-open')
    const label = open.getAttribute('aria-label')
    await act(async () => open.click())
    return {
      tap: label.replace('Pocket — ', ''), calls,
      button: !!doc.querySelector(surface === 'row' ? '.st-card-action' : '.st-pill'),
      seal: !!doc.querySelector('.st-installed-dot'),
    }
  }
  const states = {
    // Browse surfaces never launch: an installed app opens its page and keeps the seal.
    ready: [{}, { tap: 'open details', calls: [['details', 'pocket']], button: false, seal: true }],
    'ready while another app installs': [{ blocked: true }, { tap: 'open details', calls: [['details', 'pocket']], button: false, seal: true }],
    'busy with its own action': [{ busy: true, busyActionKind: 'checking_update' },
      { tap: 'open details', calls: [['details', 'pocket']], button: true, seal: true }],
    'with an update': [{ updateChecks: { 7: { available: true } } },
      { tap: 'open details', calls: [['details', 'pocket']], button: true, seal: true }],
    'in conflict': [{ updateChecks: { 7: { available: true, pendingUpdateState: 'needs_resolution' } } },
      { tap: 'open details', calls: [['details', 'pocket']], button: true, seal: true }],
    'not installed': [{ installed: [] }, { tap: 'open details', calls: [['details', 'pocket']], button: false, seal: false }],
  }
  try {
    for (const [name, [state, expected]] of Object.entries(states)) {
      assert.deepEqual(await observe('row', state), expected, `row, ${name}`)
      assert.deepEqual(await observe('feature', state), expected, `featured card, ${name}`)
    }
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
  }
})

test('a card for an app with a built-in agent shows a labelled Agent badge in every card layout', async () => {
  const CatalogCard = await catalogCard()
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const doc = dom.window.document
  const app = embedsAgent => ({ id: 'brief', manifest: { id: 'brief', name: 'Brief', embeds_agent: embedsAgent } })
  try {
    for (const layout of ['row', 'list']) {
      await act(async () => root.render(React.createElement(CatalogCard, { item: app(true), installed: [], layout, onPick() {} })))
      const badge = doc.querySelector('.st-card-agent')
      assert.ok(badge, `a ${layout} card shows the Agent badge`)
      assert.equal(badge.textContent, 'Agent')
      assert.equal(badge.getAttribute('role'), 'img')
      assert.equal(badge.getAttribute('aria-label'), 'Includes an agent')
      await act(async () => root.render(React.createElement(CatalogCard, { item: app(false), installed: [], layout, onPick() {} })))
      assert.equal(doc.querySelector('.st-card-agent'), null, `a ${layout} card without an agent has no badge`)
    }
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
  }
  // No layout or screen width hides the badge or the line that carries it.
  const css = readFileSync(join(here, '..', 'theme.js'), 'utf8')
  const hiding = [...css.matchAll(/([^{}]*)\{[^{}]*display:\s*none[^{}]*\}/g)]
    .map(match => match[1].trim())
    .filter(selector => /st-card-agent|st-card-state-row(?!:empty)\b/.test(selector))
  assert.deepEqual(hiding, [])
})
