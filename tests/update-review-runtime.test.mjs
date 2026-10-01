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
const buildDir = join(here, '.build-review-runtime')
const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES

async function modalModule() {
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'UpdateReviewModal.jsx'),
    platform: 'node',
    tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'modal.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}

function reviewed(id, outcome = undefined) {
  return {
    item: { id, manifest: { name: id, version: '2.0.0' } },
    preview: { source_digest: 'a'.repeat(64), upstream_diff: '' },
    capabilityReview: { preview: { capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] } } },
    ...(outcome ? { outcome } : {}),
  }
}

test('a retried app requires confirmation while preserving a sibling error and agent review', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const old = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const { UpdateReviewModal } = await modalModule()
  const root = createRoot(dom.window.document.getElementById('root'))
  let confirms = 0
  let retries = []
  let agentReviews = 0
  const props = { onClose() {}, onApply() { confirms++ }, onRetry(item) { retries.push(item.id) }, onReviewWithAgent() { agentReviews++ } }
  try {
    await act(async () => root.render(React.createElement(UpdateReviewModal, { ...props, review: { entries: [reviewed('a', { error: 'failed' }), reviewed('b', { error: 'failed' })] } })))
    assert.equal(dom.window.document.querySelectorAll('button.st-btn-primary').length, 0)
    assert.equal(dom.window.document.querySelectorAll('button').length > 0, true)
    await act(async () => dom.window.document.querySelectorAll('button')[1].click())
    assert.deepEqual(retries, ['a'])
    assert.equal(confirms, 0)
    await act(async () => root.render(React.createElement(UpdateReviewModal, { ...props, review: { entries: [reviewed('a'), reviewed('b', { error: 'failed' })] } })))
    assert.match(dom.window.document.body.textContent, /failed/)
    assert.match(dom.window.document.body.textContent, /Confirm update|Confirm & update/)
    assert.equal(confirms, 0, 'retry preparation itself cannot apply a release')
    await act(async () => dom.window.document.querySelector('button.st-btn-primary').click())
    assert.equal(confirms, 1)
    const agentButton = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent.includes('Ask agent about error'))
    await act(async () => agentButton.click())
    assert.equal(agentReviews, 1)
  } finally {
    await act(async () => root.unmount())
    Object.assign(globalThis, old)
    dom.window.close()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('App gates repeated batch confirmation synchronously', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const old = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT, fetch: globalThis.fetch, ResizeObserver: globalThis.ResizeObserver }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  dom.window.ResizeObserver = globalThis.ResizeObserver
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  dom.window.mobius = { signal() {} }
  dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
  const installed = [{ id: 11, slug: 'voice', name: 'Voice', manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main#manifest-id=voice', source_manifest: { id: 'voice', url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json' }, manifest: { id: 'voice', name: 'Voice', version: '1.0.0' } }, { id: 12, slug: 'memory', name: 'Memory', manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main#manifest-id=memory', source_manifest: { id: 'memory', url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json' }, manifest: { id: 'memory', name: 'Memory', version: '1.0.0' } }]
  const { MANIFEST_SNAPSHOTS } = await import('../manifest-snapshots.js')
  let installs = 0
  const installIds = []
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url)
    if (path === '/api/apps/') return json(installed)
    if (/^\/api\/apps\/(11|12)\/update-check/.test(path)) return json({ update_available: true, pending_update_state: 'none' })
    if (/^\/api\/apps\/(11|12)\/update-candidate-preview/.test(path)) return json({ app_id: Number(path.match(/apps\/(\d+)/)[1]), upstream_version: '2.0.0', upstream_diff: '', source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40), capability_preview: { capability_digest: 'c'.repeat(64), capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] } } })
    if (path === '/api/apps/install') { installs++; const id = JSON.parse(options.body).update_app_id; installIds.push(id); if (id === 12 || installs <= 2) return json({ detail: id === 12 ? 'memory failed' : 'voice failed' }, 400); return json({ id: 11, slug: 'voice', name: 'Voice', version: '2.0.0', mode: 'update', divergence: 'fast_forward' }) }
    if (path.startsWith('/api/proxy?')) {
      const remote = decodeURIComponent(path.split('url=')[1] || '')
      if (remote.endsWith('/catalog.json')) return json({ schema: 1, apps: [] })
      if (remote.includes('app-voice')) return json(MANIFEST_SNAPSHOTS.voice)
      if (remote.includes('app-memory')) return json(MANIFEST_SNAPSHOTS.memory)
      return json({}, 404)
    }
    return json({}, 404)
  }
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'index.jsx'), platform: 'node', tsconfig: false, external: ['react', 'react/jsx-runtime'], resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } }, transform: { jsx: 'react-jsx' } })
  const output = join(buildDir, 'app.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  const { default: App } = await import(pathToFileURL(output).href)
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    await act(async () => root.render(React.createElement(App, { appId: 999, token: 'tok' })))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    await act(async () => dom.window.document.querySelector('#st-tab-library').click())
    const updateAll = dom.window.document.querySelector('button[aria-label^="Update all"]')
    assert.ok(updateAll, [...dom.window.document.querySelectorAll('button')].map(x => x.getAttribute('aria-label') || x.textContent).slice(0, 30).join(' | '))
    await act(async () => updateAll.click())
    const confirm = dom.window.document.querySelector('.st-update-review-actions button.st-btn-primary')
    assert.ok(confirm, dom.window.document.body.textContent.slice(-400))
    await act(async () => { confirm.click(); confirm.click(); await new Promise(resolve => setTimeout(resolve, 20)) })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    assert.deepEqual([...installIds].sort(), [11, 12], 'one install attempt per app despite repeated confirmation')
    assert.match(dom.window.document.querySelector('.st-update-review')?.textContent || '', /voice failed/)
    assert.match(dom.window.document.querySelector('.st-update-review')?.textContent || '', /memory failed/)
    const retry = [...dom.window.document.querySelectorAll('.st-update-review-section')].find(section => section.textContent.includes('Voice')).querySelector('button')
    await act(async () => { retry.click(); await new Promise(resolve => setTimeout(resolve, 20)) })
    assert.match(dom.window.document.querySelector('.st-update-review')?.textContent || '', /memory failed/)
    assert.equal(installs, 2, 'rechecking is read-only')
    const secondConfirm = dom.window.document.querySelector('.st-update-review-actions button.st-btn-primary')
    assert.ok(secondConfirm, 'the retried app needs a fresh confirmation')
    await act(async () => { secondConfirm.click(); await new Promise(resolve => setTimeout(resolve, 20)) })
    assert.equal(installs, 3, 'only the retried app was applied')
    assert.equal(installIds[2], 11)
    assert.match(dom.window.document.querySelector('.st-update-review')?.textContent || '', /memory failed/)
  } finally {
    await act(async () => root.unmount())
    Object.assign(globalThis, old)
    dom.window.close()
    await rm(buildDir, { recursive: true, force: true })
  }
})
