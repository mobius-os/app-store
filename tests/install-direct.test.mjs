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

test('a fresh install is available at once and installs with no access check or digest', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const installs = []
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    // No capability review has loaded (or it failed): a fresh install must not wait for it.
    await act(async () => root.render(React.createElement(DetailView, {
      item, installed: [], capabilityReview: undefined, onBack() {}, onInstall: (...args) => installs.push(args), token: 't',
    })))
    const cta = dom.window.document.querySelector('.st-detail-cta')
    assert.ok(cta, 'the primary button renders')
    assert.equal(cta.disabled, false)
    assert.doesNotMatch(cta.textContent, /Reviewing access|Access unavailable/)
    await act(async () => cta.click())
    assert.deepEqual(installs, [[item]])
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})
