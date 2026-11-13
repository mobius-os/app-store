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
const buildDir = join(here, '.build-mobius-account-runtime')

async function appModule() {
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
}

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})

test('the Publish tab sends a signed-out owner to Settings › Accounts › Möbius', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const keys = ['window', 'document', 'HTMLElement', 'ResizeObserver', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const posted = []
  Object.defineProperty(dom.window, 'parent', {
    value: { postMessage: (message, origin) => posted.push({ message, origin }) },
  })
  dom.window.mobius = { signal() {} }
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url) => {
      const path = String(url)
      if (path === '/api/apps/' || path === '/api/apps/uninstalled') return json([])
      if (path === '/api/community/identity') return json({ linked: false })
      return json({}, 404)
    },
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    const { default: App } = await appModule()
    await act(async () => root.render(React.createElement(App, { appId: 999, token: 'tok' })))
    const doc = dom.window.document
    await act(async () => doc.querySelector('#st-tab-publish').click())
    assert.match(doc.body.textContent, /Sign in to your Möbius account in Settings to publish an app\./)
    assert.doesNotMatch(doc.body.textContent, /Möbius · You/)

    const signIn = [...doc.querySelectorAll('button')].filter(button => button.textContent === 'Sign in to Möbius')
    assert.equal(signIn.length, 2, 'the heading and the notice each offer sign-in')
    for (const button of signIn) await act(async () => button.click())
    assert.deepEqual(posted, [
      { message: { type: 'moebius:open-settings', section: 'mobius-account' }, origin: 'https://store.test' },
      { message: { type: 'moebius:open-settings', section: 'mobius-account' }, origin: 'https://store.test' },
    ])
    assert.equal(doc.querySelector('#st-tab-publish').getAttribute('aria-selected'), 'true',
      'the Store stays on Publish instead of opening another listing')
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    Object.assign(globalThis, old)
    await rm(buildDir, { recursive: true, force: true })
  }
})
