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

async function selfUpdateModule() {
  const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'SelfUpdate.jsx'),
    platform: 'node',
    tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'self-update.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})

async function mount(fetchImpl, props = {}, { mobius } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  if (mobius) dom.window.mobius = mobius
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
    fetch: (url, options) => {
      if (url === '/api/models') return Promise.resolve(json({ providers: { codex: [{ id: 'test', label: 'Test agent' }] } }))
      if (url === '/api/owner/model-prefs') return Promise.resolve(json({ selected_agent: { provider: 'codex', model: 'test' } }))
      if (url === '/api/auth/providers/status') return Promise.resolve(json({ codex: { configured: true } }))
      return fetchImpl(url, options)
    },
  })
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new dom.window.Event('close')) }
  const root = createRoot(dom.window.document.getElementById('root'))
  const { useSelfUpdate, SelfUpdateRow, SelfUpdateSheet } = await selfUpdateModule()
  // The Store mounts one shared state behind the Library row and the update
  // sheet at its root.
  function Harness() {
    const self = useSelfUpdate({ appId: 1, token: 'test-token' })
    return React.createElement('div', null,
      React.createElement(SelfUpdateRow, { self, appId: 1 }),
      React.createElement(SelfUpdateSheet, { self, appId: 1 }))
  }
  await act(async () => root.render(React.createElement(Harness)))
  return {
    dom,
    async click(label) {
      const button = [...dom.window.document.querySelectorAll('button')]
        .find(node => node.textContent === label || node.getAttribute('aria-label') === label)
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
    assert.match(view.dom.window.document.body.textContent, /Fix with agent/)
    assert.doesNotMatch(view.dom.window.document.body.textContent, /Retry/)
    await view.click('Fix with agent')
    await view.click('Start agent')
    const resolverCalls = requests.filter(request => request.url.includes('/conflict-resolver-chat'))
    assert.equal(resolverCalls.length, 1)
    assert.deepEqual(JSON.parse(resolverCalls[0].options.body), { resolution_policy: 'preserve_local', agent: { provider: 'codex', model: 'test' } })
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
        manifest: { version: '1.21.4' }, capability_digest: 'c'.repeat(64), access_rows: [], installed_access_rows: [],
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
    assert.match(view.dom.window.document.body.textContent, /Fix with agent/)
    assert.doesNotMatch(view.dom.window.document.body.textContent, /Retry/)
    assert.equal(installs, 1)
    await view.click('Fix with agent')
    await view.click('Start agent')
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
    assert.match(view.dom.window.document.body.textContent, /Fix with agent/)
    await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
    assert.match(view.dom.window.document.body.textContent, /Fix with agent/)
    await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event('focus')))
    assert.equal(view.dom.window.document.querySelector('.st-selfupd-row'), null)
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
    assert.equal(view.dom.window.document.querySelector('.st-selfupd-row'), null)
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
        manifest: { version: '1.22.0' }, capability_digest: 'c'.repeat(64), access_rows: [], installed_access_rows: [],
        capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    })
    throw new Error(`Unexpected request: ${url}`)
  })
  try {
    const text = view.dom.window.document.body.textContent
    assert.match(text, /Update needs a hand/)
    assert.match(text, /Version 1\.21\.4/)
    assert.doesNotMatch(text, /1\.22\.0/)
    assert.ok(view.dom.window.document.querySelector('.st-selfupd-row.is-conflict'))
    assert.ok(view.dom.window.document.querySelector('button[aria-label="Fix the App Store update with an agent"]'))
  } finally {
    await view.close()
  }
})

test('the conflict layout class stays off an ordinary update row', async () => {
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
    if (path.includes('/update-candidate-preview')) return json({
      app_id: 1, source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40),
      capability_preview: {
        manifest: { version: '1.22.0' }, capability_digest: 'c'.repeat(64), access_rows: [], installed_access_rows: [],
        capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    })
    throw new Error(`Unexpected request: ${url}`)
  })
  try {
    assert.ok(view.dom.window.document.querySelector('button[aria-label="Update App Store"]'))
    assert.ok(view.dom.window.document.querySelector('.st-selfupd-row.is-update'))
    assert.equal(view.dom.window.document.querySelector('.st-selfupd-row.is-conflict'), null)
  } finally {
    await view.close()
  }
})

const preview = (diff = { unknown_previous: false, added: [], removed: [], changed: [] }) => ({
  app_id: 1, source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40),
  capability_preview: {
    manifest: { version: '1.22.0' }, capability_digest: 'c'.repeat(64),
    access_rows: [{ id: 'manage_apps', title: 'Install and remove apps' }], installed_access_rows: [],
    capability_diff: diff,
  },
})

test('a Store update is a Library row with a sheet, never a banner', async () => {
  let installs = 0
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
    if (path.includes('/update-candidate-preview')) return json(preview())
    if (path === '/api/apps/install') { installs++; return json({ id: 1, mode: 'updated' }) }
    throw new Error(`Unexpected request: ${url}`)
  })
  const doc = view.dom.window.document
  try {
    assert.equal(doc.querySelector('.st-banner'), null)
    assert.ok(doc.querySelector('.st-selfupd-row .st-card-state-line.is-update'))
    assert.equal(doc.querySelector('.st-selfupd-sheet'), null, 'the sheet waits for a tap')
    // What's new (from the Library row menu) opens the update sheet.
    await view.click('More for App Store')
    await view.click("What's new in the App Store update")
    const panel = doc.querySelector('.st-selfupd-sheet')
    assert.match(panel.textContent, /Version 1\.22\.0/)
    assert.match(panel.textContent, /Same as now/)
    assert.match(panel.textContent, /Install and remove apps/)
    await view.click('Later')
    assert.equal(doc.querySelector('.st-selfupd-sheet'), null, 'Later closes the popup')
    await view.click('More for App Store')
    await view.click("What's new in the App Store update")
    await act(async () => doc.dispatchEvent(new view.dom.window.KeyboardEvent('keydown', { key: 'Escape' })))
    assert.equal(doc.querySelector('.st-selfupd-sheet'), null, 'Escape closes the sheet')
    // The sheet's Update button installs.
    assert.equal(installs, 0)
    await view.click('More for App Store'); await view.click("What's new in the App Store update")
    assert.ok(doc.querySelector('.st-selfupd-sheet'))
    await view.click('Update App Store')
    assert.equal(installs, 1)
    assert.match(doc.querySelector('.st-selfupd-sheet').textContent, /You're on version 1\.22\.0/)
    assert.equal(doc.querySelector('.st-selfupd-row'), null, 'the Library row leaves once it is done')
  } finally {
    await view.close()
  }
})

test('a new App Store version waits in Library: no popup opens by itself', async () => {
  let installs = 0
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
    if (path.includes('/update-candidate-preview')) return json(preview())
    if (path === '/api/apps/install') { installs++; return json({ id: 1, mode: 'updated' }) }
    throw new Error(`Unexpected request: ${url}`)
  })
  const doc = view.dom.window.document
  try {
    assert.equal(doc.querySelectorAll('[role="dialog"]').length, 0, 'no popup')
    assert.ok(doc.querySelector('.st-selfupd-row'), 'the App Store row waits with the other updates')
    assert.equal(installs, 0)
  } finally {
    await view.close()
  }
})

test('a failed Store update opens the panel with the reason and keeps Update available', async () => {
  let installs = 0
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
    if (path.includes('/update-candidate-preview')) return json(preview())
    if (path === '/api/apps/install') { installs++; return json({ detail: 'The publisher is unreachable' }, 502) }
    throw new Error(`Unexpected request: ${url}`)
  })
  const doc = view.dom.window.document
  try {
    await view.click('Update App Store')
    assert.equal(installs, 1)
    const panel = doc.querySelector('.st-selfupd-sheet')
    assert.ok(panel, 'the sheet explains the failure')
    assert.match(panel.textContent, /unreachable/)
    assert.ok(doc.querySelector('button[aria-label="Update App Store"]'))
  } finally {
    await view.close()
  }
})

test('an access change is reviewed in the panel before the Library row can install it', async () => {
  let installs = 0
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
    if (path.includes('/update-candidate-preview')) return json(preview({ unknown_previous: false, added: [{ key: 'net' }], removed: [], changed: [], widens: true }))
    if (path === '/api/apps/install') { installs++; return json({ id: 1, mode: 'updated' }) }
    throw new Error(`Unexpected request: ${url}`)
  })
  const doc = view.dom.window.document
  try {
    await view.click('Review App Store access')
    assert.equal(installs, 0)
    assert.match(doc.querySelector('.st-selfupd-sheet').textContent, /changes what the App Store can access/)
    await view.click('Update App Store')
    assert.equal(installs, 1)
    assert.match(doc.querySelector('.st-selfupd-sheet')?.textContent || '', /You're on version/)
    assert.equal(doc.querySelector('.st-selfupd-row'), null, 'the Library row leaves once it is done')
  } finally {
    await view.close()
  }
})

test('the sheet lists the release changes read through the proxy, newest last, without merge commits', async () => {
  let compares = 0
  const view = await mount(async (url) => {
    const path = String(url)
    if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none', installed_source_revision: 'e'.repeat(40) })
    if (path.includes('/update-candidate-preview')) return json(preview())
    if (path.startsWith('/api/proxy?url=')) {
      compares++
      const target = decodeURIComponent(path.slice('/api/proxy?url='.length))
      assert.equal(target, `https://api.github.com/repos/mobius-os/app-store/compare/${'e'.repeat(40)}...${'b'.repeat(40)}`)
      return json({ commits: [
        { parents: [{}], commit: { message: 'Read the recoverable-apps list together with the installed apps\n\nLonger body.', committer: { date: '2026-10-30T10:00:00Z' } } },
        { parents: [{}, {}], commit: { message: 'Merge pull request #101', committer: { date: '2026-10-30T11:00:00Z' } } },
      ] })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  const doc = view.dom.window.document
  try {
    assert.equal(compares, 0, 'nothing is read until the sheet opens')
    await view.click('More for App Store'); await view.click("What's new in the App Store update")
    // The proxied read resolves over a few ticks; wait for the list to settle.
    for (let i = 0; i < 40 && /Reading the change list/.test(doc.body.textContent); i++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    }
    const sheet = doc.querySelector('.st-selfupd-sheet')
    assert.equal(compares, 1)
    const items = [...sheet.querySelectorAll('.st-selfupd-list li')].map(node => node.textContent)
    assert.deepEqual(items, ['Read the recoverable-apps list together with the installed apps'])
    assert.match(sheet.textContent, /30 Oct|Oct 30/)   // the date is local-format
    await act(async () => doc.dispatchEvent(new view.dom.window.KeyboardEvent('keydown', { key: 'Escape' })))
    await view.click('More for App Store'); await view.click("What's new in the App Store update")
    assert.equal(compares, 1, 'the change list is read once per Store load')
  } finally {
    await view.close()
  }
})
