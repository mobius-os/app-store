import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-self-update-runtime')

async function bannerModule() {
  const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'SelfUpdateBanner.jsx'),
    platform: 'node',
    tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'banner.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})

async function mount(fetchImpl) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const old = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    fetch: globalThis.fetch,
  }
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: fetchImpl,
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  const { SelfUpdateBanner } = await bannerModule()
  await act(async () => root.render(React.createElement(SelfUpdateBanner, { appId: 1, token: 'test-token' })))
  return {
    dom,
    async click(label) {
      const button = [...dom.window.document.querySelectorAll('button')]
        .find(node => node.textContent === label)
      assert.ok(button, `button ${label} is visible`)
      await act(async () => button.click())
    },
    async close() {
      await act(async () => root.unmount())
      Object.assign(globalThis, old)
      dom.window.close()
      await rm(buildDir, { recursive: true, force: true })
    },
  }
}

test('an existing self-update conflict offers the agent even when preview fails', async () => {
  const requests = []
  const posted = []
  const view = await mount(async (url, options = {}) => {
    requests.push({ url: String(url), options })
    if (String(url).includes('/update-check')) return json({
      update_available: true, pending_update_state: 'needs_resolution', upstream_version: '1.21.4',
    })
    if (String(url).includes('/update-candidate-preview')) return json({ detail: 'offline' }, 503)
    if (String(url).includes('/conflict-resolver-chat')) return json({ chat_id: 'resolver-chat' })
    throw new Error(`Unexpected request: ${url}`)
  })
  view.dom.window.postMessage = message => posted.push(message)
  try {
    assert.match(view.dom.window.document.body.textContent, /Resolve with agent/)
    assert.doesNotMatch(view.dom.window.document.body.textContent, /Retry/)
    await view.click('Resolve with agent')
    const resolverCalls = requests.filter(request => request.url.includes('/conflict-resolver-chat'))
    assert.equal(resolverCalls.length, 1)
    assert.deepEqual(JSON.parse(resolverCalls[0].options.body), { resolution_policy: 'preserve_local' })
    assert.equal(posted[0].chatId, 'resolver-chat')
    await view.click('Open agent')
    assert.equal(requests.filter(request => request.url.includes('/conflict-resolver-chat')).length, 1)
    assert.equal(posted.length, 2)
  } finally {
    await view.close()
  }
})

test('a new self-update conflict switches from Update to the agent, not Retry', async () => {
  let installs = 0
  let resolvers = 0
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
    if (path.includes('/update-candidate-preview')) return json({
      app_id: 1, source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40),
      capability_preview: {
        manifest: { version: '1.21.4' }, capability_digest: 'c'.repeat(64),
        capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    })
    if (path === '/api/apps/install') {
      installs++
      return json({ id: 1, mode: 'conflict', conflict_paths: ['mobius.json'] })
    }
    if (path.includes('/conflict-resolver-chat')) {
      resolvers++
      return json({ chat_id: 'resolver-chat' })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  try {
    await view.click('Update App Store')
    assert.match(view.dom.window.document.body.textContent, /Resolve with agent/)
    assert.doesNotMatch(view.dom.window.document.body.textContent, /Retry/)
    assert.equal(installs, 1)
    await view.click('Resolve with agent')
    assert.equal(resolvers, 1)
    assert.equal(installs, 1)
  } finally {
    await view.close()
  }
})

test('a transient unknown check keeps the agent offer until resolution is confirmed', async () => {
  let checks = 0
  const view = await mount(async (url) => {
    if (String(url).includes('/update-candidate-preview')) return json({ detail: 'offline' }, 503)
    if (String(url).includes('/update-check')) {
      checks++
      if (checks === 1) return json({ update_available: true, pending_update_state: 'needs_resolution' })
      if (checks === 2) return json({ update_available: null, pending_update_state: 'unknown' })
      return json({ update_available: false, pending_update_state: 'none' })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  try {
    assert.match(view.dom.window.document.body.textContent, /Resolve with agent/)
    await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
    assert.match(view.dom.window.document.body.textContent, /Resolve with agent/)
    await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
    assert.equal(view.dom.window.document.querySelector('.st-banner'), null)
  } finally {
    await view.close()
  }
})

test('focus does not re-check for a Store update unless a conflict is showing', async () => {
  let checks = 0
  const view = await mount(async (url) => {
    if (String(url).includes('/update-candidate-preview')) return json({ detail: 'offline' }, 503)
    if (String(url).includes('/update-check')) {
      checks++
      if (checks === 1) return json({ update_available: true, pending_update_state: 'needs_resolution' })
      return json({ update_available: false, pending_update_state: 'none' })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  const focus = () => act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
  try {
    assert.equal(checks, 1)
    await focus()
    assert.equal(checks, 2)
    assert.equal(view.dom.window.document.querySelector('.st-banner'), null)
    await focus()
    await focus()
    assert.equal(checks, 2)
  } finally {
    await view.close()
  }
})

test('focus never checks for a Store update when nothing is pending', async () => {
  let checks = 0
  const view = await mount(async (url) => {
    if (String(url).includes('/update-candidate-preview')) return json({ detail: 'offline' }, 503)
    if (String(url).includes('/update-check')) {
      checks++
      return json({ update_available: false, pending_update_state: 'none' })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  try {
    for (let i = 0; i < 5; i++) {
      await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
    }
    assert.equal(checks, 1)
  } finally {
    await view.close()
  }
})

test('a pending conflict names its receipt version, not a newer published release', async () => {
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({
      update_available: true, pending_update_state: 'needs_resolution', upstream_version: '1.21.4',
    })
    if (path.includes('/update-candidate-preview')) return json({
      app_id: 1, source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40),
      capability_preview: {
        manifest: { version: '1.22.0' }, capability_digest: 'c'.repeat(64),
        capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    })
    throw new Error(`Unexpected request: ${url}`)
  })
  try {
    const text = view.dom.window.document.body.textContent
    assert.match(text, /App Store v1\.21\.4 needs help/)
    assert.doesNotMatch(text, /1\.22\.0/)
    assert.ok(view.dom.window.document.querySelector('.st-banner.is-conflict'))
  } finally {
    await view.close()
  }
})

test('the conflict layout class stays off the existing update banner', async () => {
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
    if (path.includes('/update-candidate-preview')) return json({
      app_id: 1, source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40),
      capability_preview: {
        manifest: { version: '1.22.0' }, capability_digest: 'c'.repeat(64),
        capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    })
    throw new Error(`Unexpected request: ${url}`)
  })
  try {
    assert.match(view.dom.window.document.body.textContent, /Update App Store/)
    assert.equal(view.dom.window.document.querySelector('.st-banner').className, 'st-banner')
  } finally {
    await view.close()
  }
})
