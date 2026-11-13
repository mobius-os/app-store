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

let modulePromise
async function appModule() {
  if (!modulePromise) modulePromise = (async () => {
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
  })()
  return modulePromise
}
test.after(() => rm(buildDir, { recursive: true, force: true }))

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})

// Mounts the whole Store on its Publish tab. `account` is the Möbius account
// the platform reports right now; a test may change it between reads.
async function openPublish(account) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const keys = ['window', 'document', 'HTMLElement', 'ResizeObserver', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const posted = []
  const reads = []
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
      if (path === '/api/community/identity') {
        reads.push(path)
        return json({ linked: account.linked })
      }
      if (path.startsWith('/api/community/publications?')) {
        reads.push('/api/community/publications')
        return json({ items: [], viewer: account.handle ? { handle: account.handle } : null })
      }
      if (path === '/api/community/github-status') return json({ connected: true, login: 'example-dev' })
      return json({}, 404)
    },
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  const { default: App } = await appModule()
  await act(async () => root.render(React.createElement(App, { appId: 999, token: 'tok' })))
  const doc = dom.window.document
  await act(async () => doc.querySelector('#st-tab-publish').click())
  return {
    doc, posted, reads,
    signInButtons: () => [...doc.querySelectorAll('button')].filter(button => button.textContent === 'Sign in to Möbius'),
    async returnToStore() {
      await act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')))
    },
    async close() {
      await act(async () => root.unmount())
      dom.window.close()
      Object.assign(globalThis, old)
    },
  }
}

test('the Publish tab sends a signed-out owner to Settings › Accounts › Möbius', async () => {
  const view = await openPublish({ linked: false, handle: '' })
  try {
    assert.match(view.doc.body.textContent, /Sign in to your Möbius account in Settings to publish an app\./)
    assert.doesNotMatch(view.doc.body.textContent, /Möbius · You/)

    const signIn = view.signInButtons()
    assert.equal(signIn.length, 2, 'the heading and the notice each offer sign-in')
    for (const button of signIn) await act(async () => button.click())
    assert.deepEqual(view.posted, [
      { message: { type: 'moebius:open-settings', section: 'mobius-account' }, origin: 'https://store.test' },
      { message: { type: 'moebius:open-settings', section: 'mobius-account' }, origin: 'https://store.test' },
    ])
    assert.equal(view.doc.querySelector('#st-tab-publish').getAttribute('aria-selected'), 'true',
      'the Store stays on Publish instead of opening another listing')
  } finally {
    await view.close()
  }
})

test('coming back after signing in to Möbius in Settings clears the Publish prompt without a reload', async () => {
  const account = { linked: false, handle: '' }
  const view = await openPublish(account)
  try {
    assert.equal(view.signInButtons().length, 2)
    account.linked = true
    account.handle = 'example'
    await view.returnToStore()
    assert.equal(view.signInButtons().length, 0, 'the sign-in prompt is gone')
    assert.doesNotMatch(view.doc.body.textContent, /Sign in to your Möbius account/)
    assert.match(view.doc.body.textContent, /Publishing as example/)

    // Signed in with a handle: returning again reads nothing more.
    const settled = view.reads.length
    await view.returnToStore()
    assert.equal(view.reads.length, settled)
  } finally {
    await view.close()
  }
})
