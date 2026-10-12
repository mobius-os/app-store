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
const buildDir = join(here, '.build-publisher-editor')

test('unfinished listing opens the full existing editor with its AI-help actions', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'ui', 'PublisherTab.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' } })
  const output = join(buildDir, 'publisher.mjs')
  await build.write({ file: output, format: 'es' }); await build.close()
  const { PublisherTab } = await import(pathToFileURL(output).href)
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const aiRequests = []
  const app = { id: 42, name: 'Pocket List', slug: 'pocket-list', source_dir: '/data/apps/pocket-list' }
  async function click(label) {
    const button = [...dom.window.document.querySelectorAll('button')].find(b => b.textContent.trim() === label)
    assert.ok(button, label)
    await act(async () => button.click())
  }
  try {
    await act(async () => root.render(React.createElement(PublisherTab, {
      installed: [app], identity: { linked: true }, viewer: { github: { connected: true, login: 'owner' } },
      onRefreshPublicationStates() {}, onListingAgent: async (...args) => aiRequests.push(args),
      onPreviewLocal: async () => ({ ready: false, accepted_commit: 'a'.repeat(40),
        draft: { tagline: 'Keep this draft', description: '', screenshots: [] },
        checklist: [{ id: 'description', label: 'Description', done: false, message: 'Add a description' }] }),
    })))
    await click('Publish an app')
    await click('Prepare listing')
    assert.ok(dom.window.document.querySelector('.st-listing-editor'))
    assert.equal(dom.window.document.querySelector('.st-edit-field > input').value, 'Keep this draft')
    assert.ok(dom.window.document.querySelector('.st-listing-editor textarea'))
    assert.ok(dom.window.document.querySelector('input[aria-label="Add a screenshot"]'))
    assert.equal(dom.window.document.querySelector('.st-listing-incomplete'), null)
    await click('Ask an agent')
    assert.equal(aiRequests[0][0].id, 42)
    assert.equal(aiRequests[0][2], 'description')
    await click('Do it all with an agent')
    assert.equal(aiRequests.length, 2)
    assert.match(dom.window.document.body.textContent, /Save listing/)
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
    await rm(buildDir, { recursive: true, force: true })
  }
})
