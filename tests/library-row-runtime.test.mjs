import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-library-row')

test('every Library row keeps Details, and only a ready app launches on tap', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'ui', 'CatalogCard.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' } })
  const output = join(buildDir, 'card.mjs')
  await build.write({ file: output, format: 'es' }); await build.close()
  const { CatalogCard } = await import(pathToFileURL(output).href)
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
  try {
    await show({})
    await tapRow()
    await act(async () => named('Details').click())
    assert.deepEqual(calls, [['open', 7], ['details', 'pocket']], 'a ready app launches; Details opens its page')
    assert.equal(named('Review'), undefined, 'an app without community ratings has no Review action')

    await show({ updateChecks: { 7: { available: true } } })
    await tapRow()
    await act(async () => named('Update').click())
    assert.deepEqual(calls, [['details', 'pocket'], ['update', 'pocket', true]],
      'a row with an update opens details instead of launching the old version')
    assert.ok(named('Details'))

    await show({ item: { ...item, setup: { required: true } } })
    await tapRow()
    assert.deepEqual(calls, [['details', 'pocket']], 'unfinished setup opens details')

    await show({ item: { ...item, community: { id: 'app_pocket' } } })
    await act(async () => named('Review').click())
    assert.deepEqual(calls, [['rate', 'pocket']])

    await show({ pickOpensApp: false, layout: 'grid' })
    await tapRow()
    assert.deepEqual(calls, [['details', 'pocket']], 'Browse cards still open details')
    assert.equal(named('Details'), undefined)
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
    await rm(buildDir, { recursive: true, force: true })
  }
})
