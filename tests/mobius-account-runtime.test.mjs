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

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function until(check, description) {
  const deadline = Date.now() + 2000
  while (!check()) {
    assert.ok(Date.now() < deadline, `Timed out waiting for ${description}`)
    await act(async () => { await new Promise(resolve => setImmediate(resolve)) })
  }
}

// A shared listing whose review gate asks this owner for a Möbius account.
const gatedListing = {
  id: 'shared-notes', name: 'Shared Notes', categories: ['Productivity'],
  latest_revision: { id: 'rev-1', manifest_url: 'https://example.test/notes/mobius.json', raw_base: 'https://example.test/notes/' },
  manifest: { id: 'shared-notes', name: 'Shared Notes', version: '1.0.0', description: 'Notes to share.' },
}

// Mounts the whole Store. `account` is the Möbius account (and GitHub
// connection) the platform reports right now; a test may change it between
// reads, or hold a read open with `account.hold`.
async function mountStore(account) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const keys = ['window', 'document', 'HTMLElement', 'ResizeObserver', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  const posted = []
  const reads = []
  let visibility = 'visible'
  Object.defineProperty(dom.window.document, 'visibilityState', { get: () => visibility })
  Object.defineProperty(dom.window.document, 'hidden', { get: () => visibility === 'hidden' })
  Object.defineProperty(dom.window, 'parent', {
    value: { postMessage: (message, origin) => posted.push({ message, origin }) },
  })
  // The shell's history owns each detail page as soon as it opens.
  const nav = {
    location: null,
    setLocation() {},
    open: () => ({ outcome: Promise.resolve({ status: 'owned' }), close() {} }),
  }
  dom.window.mobius = { signal() {}, nav }
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
        if (account.hold) await account.hold.promise
        return json({ linked: account.linked })
      }
      if (path.startsWith('/api/community/publications?')) {
        reads.push('/api/community/publications')
        return json({ items: [], viewer: account.handle ? { handle: account.handle } : null })
      }
      if (path === '/api/community/github-status') {
        reads.push(path)
        return json({ connected: account.github !== false, login: 'example-dev' })
      }
      if (path.startsWith('/api/community/apps?')) {
        return json({ items: [{ ...gatedListing, review_eligibility: account.eligibility }] })
      }
      if (path === `/api/community/apps/${gatedListing.id}`) {
        reads.push(path)
        return json({ ...gatedListing, review_eligibility: account.eligibility })
      }
      if (path === `/api/community/apps/${gatedListing.id}/reviews`) return json({ items: [] })
      return json({}, 404)
    },
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  const { default: App } = await appModule()
  await act(async () => root.render(React.createElement(App, { appId: 999, token: 'tok' })))
  const doc = dom.window.document
  const setVisibility = async (state) => {
    visibility = state
    await act(async () => doc.dispatchEvent(new dom.window.Event('visibilitychange')))
  }
  return {
    doc, posted, reads,
    signInButtons: () => [...doc.querySelectorAll('button')].filter(button => button.textContent === 'Sign in to Möbius'),
    // The shell hides the Store's frame while Settings is open and shows it
    // again on the way back; the frame sees only visibilitychange, no focus.
    async leaveForSettings() { await setVisibility('hidden') },
    async returnToStore() { await setVisibility('visible') },
    async focusWindow() {
      await act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')))
    },
    async close() {
      await act(async () => root.unmount())
      dom.window.close()
      Object.assign(globalThis, old)
    },
  }
}

async function openPublish(account) {
  const view = await mountStore(account)
  await act(async () => view.doc.querySelector('#st-tab-publish').click())
  return view
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

test('coming back from Settings after signing in to Möbius clears the Publish prompt without a reload', async () => {
  const account = { linked: false, handle: '' }
  const view = await openPublish(account)
  try {
    assert.equal(view.signInButtons().length, 2)
    await view.leaveForSettings()
    account.linked = true
    account.handle = 'example'
    await view.returnToStore()
    assert.equal(view.signInButtons().length, 0, 'the sign-in prompt is gone')
    assert.doesNotMatch(view.doc.body.textContent, /Sign in to your Möbius account/)
    assert.match(view.doc.body.textContent, /Publishing as example/)

    // Signed in with a handle: returning again reads nothing more.
    const settled = view.reads.length
    await view.leaveForSettings()
    await view.returnToStore()
    await view.focusWindow()
    assert.equal(view.reads.length, settled)
  } finally {
    await view.close()
  }
})

test('a return while the Möbius account is still being read does not read it again', async () => {
  const account = { linked: false, handle: '' }
  const view = await openPublish(account)
  try {
    account.hold = deferred()
    account.linked = true
    account.handle = 'example'
    const before = view.reads.filter(path => path === '/api/community/identity').length
    await view.leaveForSettings()
    await view.returnToStore()
    await view.focusWindow()
    await view.focusWindow()
    assert.equal(view.reads.filter(path => path === '/api/community/identity').length, before + 1)
    await act(async () => account.hold.resolve())
    await until(() => view.signInButtons().length === 0, 'the sign-in prompt to clear')
  } finally {
    await view.close()
  }
})

test('coming back from connecting GitHub re-reads the connection on Publish', async () => {
  const account = { linked: true, handle: 'example', github: false }
  const view = await openPublish(account)
  try {
    const githubReads = () => view.reads.filter(path => path === '/api/community/github-status').length
    const before = githubReads()
    account.github = true
    await view.leaveForSettings()
    await view.returnToStore()
    assert.equal(githubReads(), before + 1)
    await until(() => /Publishing as example/.test(view.doc.body.textContent), 'GitHub to read as connected')
  } finally {
    await view.close()
  }
})

test('coming back from Settings re-reads a detail page review gate that asked for sign-in', async () => {
  const account = { linked: false, handle: '', eligibility: 'account_required' }
  const view = await mountStore(account)
  try {
    await until(() => view.doc.querySelector('[aria-label="Shared Notes — open details"]'), 'the shared listing')
    await act(async () => view.doc.querySelector('[aria-label="Shared Notes — open details"]').click())
    await until(() => view.signInButtons().length === 1, 'the review gate')
    assert.match(view.doc.body.textContent, /Sign in to your Möbius account in Settings to rate or review this app\./)
    await act(async () => view.signInButtons()[0].click())
    assert.deepEqual(view.posted.at(-1)?.message, { type: 'moebius:open-settings', section: 'mobius-account' })

    await view.leaveForSettings()
    account.linked = true
    account.handle = 'example'
    account.eligibility = 'install_required'
    await view.returnToStore()
    await until(() => view.signInButtons().length === 0, 'the review gate to update')
    assert.match(view.doc.body.textContent, /Install this app to leave verified feedback\./)
    assert.ok(view.reads.includes(`/api/community/apps/${gatedListing.id}`))
  } finally {
    await view.close()
  }
})
