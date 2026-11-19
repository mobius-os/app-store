import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React from 'react'
import { createRoot } from 'react-dom/client'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-progress-fill-runtime')

async function fillModule() {
  const requireFromFrontend = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'ProgressFill.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'], transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'fill.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}

// The fill drives itself by frame clock; plain waits let it run as it does in
// the Store (an act() scope around a frame loop never settles).
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('a fast install still plays the fill for a moment, then hands back the button label', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const old = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: false })
  const { ProgressFill, MIN_VISIBLE_MS } = await fillModule()
  const root = createRoot(dom.window.document.getElementById('root'))
  const render = async (busy, children) => {
    root.render(React.createElement('button', null, React.createElement(ProgressFill, { busy, label: 'Installing' }, children)))
    await wait(30)
  }
  const doc = dom.window.document
  try {
    await render(false, 'Get')
    assert.equal(doc.querySelector('[role="progressbar"]'), null)
    await render(true, 'Get')
    assert.ok(doc.querySelector('[role="progressbar"][aria-label="Installing"]'))
    // The tap-time label keeps the button's width while the fill covers it.
    assert.equal(doc.querySelector('.st-fillp-hold').textContent, 'Get')
    // The work finishes almost at once: the fill keeps playing anyway.
    await render(false, 'Open')
    await wait(300)
    assert.ok(doc.querySelector('[role="progressbar"]'), 'the fill does not snap away on a fast install')
    assert.equal(doc.querySelector('button').textContent.includes('Open'), false)
    await wait(MIN_VISIBLE_MS + 900)
    assert.equal(doc.querySelector('[role="progressbar"]'), null)
    assert.equal(doc.querySelector('button').textContent, 'Open')
  } finally {
    root.unmount()
    await wait(30)
    Object.assign(globalThis, old)
    dom.window.close()
    await rm(buildDir, { recursive: true, force: true })
  }
})
