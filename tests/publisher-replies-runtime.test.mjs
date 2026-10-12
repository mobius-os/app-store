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
const buildDir = join(here, '.build-publisher-replies')
test('reviews and ratings remain visible while all publisher reply UI is removed', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const modules = {}
  for (const name of ['PublishedApps', 'CommunityFeedback']) {
    const build = await rolldown({ input: join(here, '..', 'ui', `${name}.jsx`), platform: 'node', tsconfig: false,
      external: ['react', 'react/jsx-runtime'],
      resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
      transform: { jsx: 'react-jsx' } })
    const output = join(buildDir, `${name}.mjs`)
    await build.write({ file: output, format: 'es' }); await build.close()
    modules[name] = await import(pathToFileURL(output).href)
  }
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  let root = createRoot(dom.window.document.getElementById('root'))
  const review = { id: `rvw_${'a'.repeat(32)}`, stars: 4, author_handle: 'reader', review_text: 'Useful app',
    reply: { text: 'Legacy reply remains stored but hidden' } }
  const props = { app: { id: 42, name: 'Test app' }, state: { community_app_id: 'app_12345678',
    stats: { rating_average: 4, rating_count: 1, review_count: 1 } },
    onLoadReviews: async () => ({ items: [review] }) }
  const text = () => dom.window.document.body.textContent
  try {
    await act(async () => root.render(React.createElement(modules.PublishedApps.PublishedAppPage, props)))
    assert.match(text(), /Useful app/)
    assert.match(text(), /1 rating/)
    assert.equal(dom.window.document.querySelector('textarea'), null)
    assert.equal([...dom.window.document.querySelectorAll('button')].some(b => /reply/i.test(b.textContent)), false)
    assert.doesNotMatch(text(), /Legacy reply|Your reply/)
    await act(async () => root.render(React.createElement(modules.CommunityFeedback.CommunityFeedback, {
      canRate: true,
      feedback: { id: 'app_12345678', revision_id: 'rev_12345678', rating_average: 4, rating_count: 1,
        reviews_loaded: true, reviews: [review] },
    })))
    assert.match(text(), /Useful app/)
    assert.match(text(), /1 rating/)
    assert.ok(dom.window.document.querySelector('textarea'), 'review composer stays')
    assert.equal(dom.window.document.querySelector('[aria-label="Publisher reply"]'), null)
    assert.doesNotMatch(text(), /Legacy reply|Publisher reply/)
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
    await rm(buildDir, { recursive: true, force: true })
  }
})
