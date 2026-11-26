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
const buildDir = join(here, '.build-library-saved')

async function loadCatalogList() {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'ui', 'CatalogList.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' } })
  const output = join(buildDir, 'catalog.mjs')
  await build.write({ file: output, format: 'es' }); await build.close()
  return (await import(pathToFileURL(output).href)).CatalogList
}
test.after(() => rm(buildDir, { recursive: true, force: true }))

test('a saved app is a Library row like every other tab: Get with More beside it', async () => {
  const CatalogList = await loadCatalogList()
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(k => [k, globalThis[k]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const notes = { id: 'notes', repository: 'maker/notes', category: 'create', publisher: { login: 'maker' }, community: {},
    manifest: { id: 'notes', name: 'Notes', version: '1.0.0', description: 'Notes description' } }
  try {
    await act(async () => root.render(React.createElement(CatalogList, {
      view: 'library', layout: 'list', libraryTab: 'saved', items: [], savedItems: [notes], installed: [],
      pickOpensApp: true, token: 'test', onPick() {}, onUpdate() {},
    })))
    const row = dom.window.document.querySelector('.st-libpane.is-saved .st-lib-panel > .st-card.is-list')
    assert.ok(row, 'saved apps share the Library row and panel')
    const actions = row.querySelector('.st-card-status-row')
    assert.equal(actions.querySelector('.st-card-action').textContent, 'Get')
    assert.ok(actions.querySelector('.st-rowmenu-btn'), 'More sits beside the action, not under it')
  } finally {
    await act(async () => root.unmount()); Object.assign(globalThis, old); dom.window.close()
  }
})
