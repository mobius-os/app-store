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

async function bundle(input, name) {
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', input),
    platform: 'node',
    tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, `${name}.mjs`)
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}
const modalModule = () => bundle(join('ui', 'UpdateReviewModal.jsx'), 'modal')

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const capabilityPreview = { capability_digest: 'c'.repeat(64), capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] } }
const candidate = id => ({ app_id: id, upstream_version: '2.0.0', upstream_diff: '', source_digest: 'a'.repeat(64), upstream_commit: 'b'.repeat(40), capability_preview: capabilityPreview })
const voiceRow = { id: 11, slug: 'voice', name: 'Voice', manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main#manifest-id=voice', source_manifest: { id: 'voice', url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json' }, manifest: { id: 'voice', name: 'Voice', version: '1.0.0' } }
const memoryRow = { id: 12, slug: 'memory', name: 'Memory', manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main#manifest-id=memory', source_manifest: { id: 'memory', url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json' }, manifest: { id: 'memory', name: 'Memory', version: '1.0.0' } }

function useDom() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/' })
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch', 'ResizeObserver']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  dom.window.ResizeObserver = globalThis.ResizeObserver
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  dom.window.mobius = { signal() {} }
  dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
  return {
    dom,
    restore() { Object.assign(globalThis, old); dom.window.close() },
  }
}

// The whole Store, against a fetch fixture. `routes` answers first; the
// catalog and manifests are served from the bundled snapshots.
async function mountApp(dom, routes) {
  const { MANIFEST_SNAPSHOTS } = await import('../manifest-snapshots.js')
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url)
    const answer = await routes(path, options)
    if (answer) return answer
    if (path.startsWith('/api/proxy?')) {
      const remote = decodeURIComponent(path.split('url=')[1] || '')
      if (remote.endsWith('/catalog.json')) return json({ schema: 1, apps: [] })
      if (remote.includes('app-voice')) return json(MANIFEST_SNAPSHOTS.voice)
      if (remote.includes('app-memory')) return json(MANIFEST_SNAPSHOTS.memory)
    }
    return json({}, 404)
  }
  const { default: App } = await bundle('index.jsx', `app-${Math.random().toString(36).slice(2)}`)
  const root = createRoot(dom.window.document.getElementById('root'))
  await act(async () => root.render(React.createElement(App, { appId: 999, token: 'tok' })))
  await act(async () => { await wait(20) })
  await act(async () => dom.window.document.querySelector('#st-tab-library').click())
  return root
}

function entry(id, status = 'ready', extra = {}) {
  return {
    item: { id, manifest_url: `https://example.test/${id}/mobius.json`, manifest: { name: id, version: '2.0.0' } },
    status,
    error: '',
    prepared: {
      installedApp: { id: id.length },
      preview: { source_digest: 'a'.repeat(64), upstream_diff: '' },
      capabilityReview: { preview: capabilityPreview },
    },
    ...extra,
  }
}

test('failed entries offer Try again or Ask agent by retryability, and only confirmation applies', async () => {
  const { dom, restore } = useDom()
  const { UpdateReviewModal } = await modalModule()
  const root = createRoot(dom.window.document.getElementById('root'))
  const calls = { confirm: 0, retry: [], agent: [] }
  const props = { onClose() {}, onConfirm() { calls.confirm++ }, onRetry(id) { calls.retry.push(id) }, onAskAgent(entries) { calls.agent.push(entries.map(e => e.item.id)) }, onResolveOne() {}, onOpenChat() {} }
  const buttonsOf = id => [...dom.window.document.querySelectorAll('.st-update-review-section')]
    .find(section => section.querySelector('h3').textContent === id)
    .querySelectorAll('button')
  try {
    const review = { phase: 'review', batchId: 'b', entries: [
      entry('transient', 'failed', { error: 'Git transfer timed out', retryable: true, errorCode: 'git_transfer_timeout' }),
      entry('permanent', 'failed', { error: 'Repository not found', retryable: false, errorCode: 'git_update_unavailable' }),
      entry('legacy', 'failed', { error: 'Build failed', retryable: null }),
      entry('not-applied', 'failed', { error: 'Not applied', retryable: false, errorCode: 'update_not_applied' }),
    ] }
    await act(async () => root.render(React.createElement(UpdateReviewModal, { ...props, review })))
    assert.equal(dom.window.document.querySelector('button.st-btn-primary'), null, 'nothing is ready to confirm')
    assert.deepEqual([...buttonsOf('transient')].map(b => b.textContent), ['Try again'])
    assert.deepEqual([...buttonsOf('permanent')].map(b => b.textContent), ['Ask agent'])
    assert.deepEqual([...buttonsOf('legacy')].map(b => b.textContent), ['Try again', 'Ask agent'], 'an older platform that does not say gets both')
    assert.deepEqual([...buttonsOf('not-applied')].map(b => b.textContent), ['Try again'], 'a release that never ran can be reviewed again')
    await act(async () => buttonsOf('transient')[0].click())
    await act(async () => buttonsOf('permanent')[0].click())
    assert.deepEqual(calls.retry, ['transient'])
    assert.deepEqual(calls.agent, [['permanent']])
    assert.equal(calls.confirm, 0)
    await act(async () => root.render(React.createElement(UpdateReviewModal, { ...props, review: { ...review, entries: [entry('transient'), review.entries[1]] } })))
    assert.match(dom.window.document.body.textContent, /Repository not found/)
    assert.equal(calls.confirm, 0, 'a retried check cannot apply a release')
    await act(async () => dom.window.document.querySelector('button.st-btn-primary').click())
    assert.equal(calls.confirm, 1)
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('the dialog shows per-app progress and can be closed while the batch continues', async () => {
  const { dom, restore } = useDom()
  const { UpdateReviewModal } = await modalModule()
  const root = createRoot(dom.window.document.getElementById('root'))
  let closed = 0
  const doc = dom.window.document
  try {
    const review = { phase: 'applying', batchId: 'b', entries: [
      entry('one', 'updated'), entry('two', 'applying'), entry('three', 'queued'),
      entry('four', 'conflict', { resolver: { chat_id: 'old', message: 'Another chat is still resolving an earlier update of four; open or stop it there.' } }),
      entry('five', 'failed', { error: 'boom', retryable: true }),
    ] }
    await act(async () => root.render(React.createElement(UpdateReviewModal, { review, onClose() { closed++ }, onConfirm() {} })))
    assert.equal(doc.querySelector('#st-update-review-title').textContent, 'Updating apps')
    assert.match(doc.querySelector('.st-update-review-subtitle').textContent, /3 of 5 finished · 2 in progress/)
    const labels = [...doc.querySelectorAll('.st-update-status')].map(node => node.textContent)
    assert.deepEqual(labels, ['Updated', 'Updating…', 'Queued', 'Local edits need review', 'Could not update'])
    assert.match(doc.body.textContent, /still resolving an earlier update of four/, 'the server says why the chat is reused')
    assert.doesNotMatch(doc.body.textContent, /An agent is reconciling your edits/)
    assert.ok([...doc.querySelectorAll('.st-update-review-section button')].filter(button => button.textContent !== 'Open resolver chat').every(button => button.disabled), 'per-app actions wait for the batch')
    const close = doc.querySelector('.st-update-review-actions .st-btn-ghost')
    assert.equal(close.textContent, 'Continue in background')
    assert.equal(close.disabled, false)
    await act(async () => close.click())
    assert.equal(closed, 1)
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('update review leads with verified changes and keeps technical details collapsed', async () => {
  const { dom, restore } = useDom()
  const { UpdateReviewModal } = await modalModule()
  const root = createRoot(dom.window.document.getElementById('root'))
  const ready = entry('Pocket List')
  ready.prepared.preview.upstream_diff = 'diff --git a/index.jsx b/index.jsx\n--- a/index.jsx\n+++ b/index.jsx\n@@ -1 +1 @@\n-old\n+new\n'
  const props = { onClose() {}, onConfirm() {}, onAskAgent() {}, onResolveOne() {} }
  const render = (entries, extra = {}) => act(async () => root.render(React.createElement(UpdateReviewModal, { ...props, review: { phase: 'review', entries, ...extra } })))
  try {
    await render([ready])
    const details = dom.window.document.querySelector('details.st-update-technical')
    assert.ok(details)
    assert.equal(details.open, false)
    assert.match(dom.window.document.body.textContent, /What changed/)
    assert.match(dom.window.document.body.textContent, /1 file in this preview: 1 changed/)
    assert.match(dom.window.document.body.textContent, /Ready to update/)
    assert.match(dom.window.document.querySelector('button.st-btn-primary').textContent, /Confirm update/)
    await render([entry('Local edits', 'conflict')])
    assert.match(dom.window.document.body.textContent, /Local edits need review/)
    assert.match(dom.window.document.body.textContent, /Local changes must be reconciled before updating/)
    assert.deepEqual([...dom.window.document.querySelectorAll('.st-update-review-section button')].map(b => b.textContent), ['Resolve in chat'], 'a conflict offers only the resolver')
    assert.equal(dom.window.document.querySelector('button.st-btn-primary'), null)
    await render([entry('Pocket List', 'updated')], { batchId: 'b' })
    assert.match(dom.window.document.body.textContent, /Update results/)
    assert.match(dom.window.document.body.textContent, /1 updated · 0 need attention/)
    assert.equal(dom.window.document.querySelector('button.st-btn-primary'), null)
    assert.equal([...dom.window.document.querySelectorAll('button')].some(b => /agent/i.test(b.textContent)), false)
    assert.ok([...dom.window.document.querySelectorAll('button')].some(b => b.textContent === 'Done'))
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('an access change is reviewed as old and new values, with the full access one tap away', async () => {
  const { dom, restore } = useDom()
  const { UpdateReviewModal } = await modalModule()
  const root = createRoot(dom.window.document.getElementById('root'))
  const doc = dom.window.document
  const withAccess = (id, capability) => {
    const result = entry(id)
    result.prepared.capabilityReview = { status: 'changed', preview: { capability_digest: 'c'.repeat(64), ...capability } }
    return result
  }
  const props = { onClose() {}, onConfirm() {}, onAskAgent() {}, onResolveOne() {} }
  try {
    await act(async () => root.render(React.createElement(UpdateReviewModal, { ...props, review: { phase: 'review', entries: [withAccess('Planner', {
      installed_contract: { data: { manage_apps: false } },
      capability_contract: { data: { manage_apps: true, shared_memory: 'read' } },
      capability_diff: { unknown_previous: false, widens: true, added: ['data.shared_memory'], removed: [], changed: ['data.manage_apps'] },
    })] } })))
    const rows = [...doc.querySelectorAll('.st-capability-diff-row')].map(row => row.textContent)
    assert.deepEqual(rows, [
      'AddedShared memoryNot granted→readdata.shared_memory',
      'ChangedInstalled appsNot allowed→Alloweddata.manage_apps',
    ])
    const full = doc.querySelector('details.st-capability-full-access')
    assert.equal(full.open, false)
    assert.match(full.textContent, /Show full resulting access[\s\S]*Shared memory[\s\S]*Installed apps/)
    assert.doesNotMatch(doc.body.textContent, /This update changes:|Nothing was installed/)

    await act(async () => root.render(React.createElement(UpdateReviewModal, { ...props, review: { phase: 'review', entries: [withAccess('Planner', {
      capability_contract: { data: { manage_apps: true } },
      capability_diff: { unknown_previous: true, widens: true, added: [], removed: [], changed: [] },
    })] } })))
    assert.equal(doc.querySelector('.st-capability-diff-row'), null)
    assert.equal(doc.querySelector('details.st-capability-full-access'), null, 'with no earlier record the full access is shown openly')
    assert.match(doc.body.textContent, /Access review[\s\S]*Installed apps/)
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('App submits one server batch despite repeated confirmation; a retry needs a fresh check and batch', async () => {
  const { dom, restore } = useDom()
  const submitted = []
  const batchSnapshots = new Map()
  let root
  try {
    root = await mountApp(dom, async (path, options) => {
      if (path === '/api/apps/') return json([voiceRow, memoryRow])
      if (path === '/api/apps/update-batches' && options.method === 'POST') {
        const payload = JSON.parse(options.body)
        submitted.push(payload)
        const entries = payload.updates.map(update => ({
          app_id: update.app_id, name: update.app_id === 11 ? 'Voice' : 'Memory',
          status: submitted.length > 1 ? 'updated' : 'failed',
          error: submitted.length > 1 ? '' : update.app_id === 11 ? 'voice timed out' : 'memory failed',
          error_code: update.app_id === 11 ? 'git_transfer_timeout' : 'git_update_unavailable',
          retryable: update.app_id === 11, warnings: [], version: '2.0.0', resolver_chat_id: null,
        }))
        const snapshot = { id: payload.id, phase: 'complete', updated_at: new Date().toISOString(), entries }
        batchSnapshots.set(payload.id, snapshot)
        return json(snapshot)
      }
      if (path === '/api/apps/update-batches') return json({ batches: [...batchSnapshots.values()].reverse() })
      if (path.startsWith('/api/apps/update-batches/')) return batchSnapshots.has(path.split('/')[4]) ? json(batchSnapshots.get(path.split('/')[4])) : json({ detail: 'App update batch not found.' }, 404)
      if (/^\/api\/apps\/(11|12)\/update-check/.test(path)) return json({ update_available: true, pending_update_state: 'none' })
      if (/^\/api\/apps\/(11|12)\/update-candidate-preview/.test(path)) return json(candidate(Number(path.match(/apps\/(\d+)/)[1])))
      if (path === '/api/apps/install') throw new Error('A reviewed update must not be applied by the browser')
      return null
    })
    const doc = dom.window.document
    const modal = () => doc.querySelector('.st-update-review')
    const updateAll = doc.querySelector('button[aria-label^="Update all"]')
    assert.ok(updateAll, [...doc.querySelectorAll('button')].map(x => x.getAttribute('aria-label') || x.textContent).slice(0, 30).join(' | '))
    await act(async () => updateAll.click())
    const confirm = doc.querySelector('.st-update-review-actions button.st-btn-primary')
    assert.ok(confirm, doc.body.textContent.slice(-400))
    await act(async () => { confirm.click(); confirm.click(); await wait(20) })
    await act(async () => { await wait(30) })
    assert.equal(submitted.length, 1, 'one durable submission despite repeated confirmation')
    assert.deepEqual(submitted[0].updates.map(update => update.app_id).sort(), [11, 12])
    assert.deepEqual(Object.keys(submitted[0].updates[0]).sort(), ['app_id', 'capability_digest', 'manifest_url', 'source_digest', 'upstream_commit'])
    assert.match(submitted[0].id, /^[0-9a-f-]{36}$/)
    assert.match(modal()?.textContent || '', /voice timed out/)
    assert.match(modal()?.textContent || '', /memory failed/)
    const section = name => [...doc.querySelectorAll('.st-update-review-section')].find(node => node.querySelector('h3').textContent === name)
    assert.deepEqual([...section('Memory').querySelectorAll('button')].map(b => b.textContent), ['Ask agent'], 'a permanent failure is for an agent, not a retry')
    const retry = section('Voice').querySelector('button')
    assert.equal(retry.textContent, 'Try again')
    await act(async () => { retry.click(); await wait(20) })
    assert.match(modal()?.textContent || '', /memory failed/, 'a sibling result stays')
    assert.equal(submitted.length, 1, 'trying again only re-checks')
    const second = doc.querySelector('.st-update-review-actions button.st-btn-primary')
    assert.ok(second, 'the retried app needs a fresh confirmation')
    await act(async () => { second.click(); await wait(20) })
    assert.equal(submitted.length, 2, 'the retry is a new explicit batch')
    assert.deepEqual(submitted[1].updates.map(update => update.app_id), [11])
    assert.notEqual(submitted[1].id, submitted[0].id)
    assert.match(section('Voice').textContent, /This app was updated/)
    assert.match(modal().textContent, /memory failed/)
    await act(async () => doc.querySelector('.st-update-review-actions .st-btn-ghost').click())
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('focus')); await wait(20) })
    const listed = [...doc.querySelectorAll('.st-update-batch-list button')]
    assert.equal(listed.length, 2, 'each batch with results stays reachable from Library')
    await act(async () => { listed[1].click(); await wait(20) })
    assert.match(modal().textContent, /memory failed/)
    assert.equal(submitted.length, 2, 'opening an older batch never resubmits it')
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('closing an accepted batch keeps live progress; reopening shows it from the stream', async () => {
  const { dom, restore } = useDom()
  let submitted = 0
  let streamController
  let batch
  let listFails = true
  let root
  try {
    root = await mountApp(dom, async (path, options) => {
      if (path === '/api/apps/') return json([voiceRow])
      if (path === '/api/apps/update-batches' && options.method === 'POST') {
        submitted++
        const { id } = JSON.parse(options.body)
        // An older platform: no error_code, no retryable, no queued state.
        batch = { id, phase: 'applying', entries: [{ app_id: 11, name: 'Voice', status: 'pending', error: '', warnings: [], version: null }] }
        return json(batch)
      }
      if (path === '/api/apps/update-batches') return listFails
        ? json({ detail: 'App update progress is unavailable while the server restarts.' }, 503)
        : json({ batches: batch ? [batch] : [] })
      if (/^\/api\/apps\/update-batches\/[^/]+\/events$/.test(path)) {
        return new Response(new ReadableStream({ start(controller) { streamController = controller } }), { headers: { 'content-type': 'text/event-stream' } })
      }
      if (path.startsWith('/api/apps/update-batches/')) return json(batch)
      if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
      if (path.includes('/update-candidate-preview')) return json(candidate(11))
      if (path === '/api/apps/install') throw new Error('Browser must not apply an accepted batch')
      return null
    })
    const doc = dom.window.document
    assert.match(doc.querySelector('[role="alert"]')?.textContent || '', /Update progress could not be read: App update progress is unavailable/)
    listFails = false
    await act(async () => { doc.querySelector('[role="alert"] button').click(); await wait(10) })
    assert.equal(doc.querySelector('[role="alert"]'), null)
    await act(async () => doc.querySelector('button[aria-label^="Update all"]').click())
    await act(async () => doc.querySelector('.st-update-review-actions button.st-btn-primary').click())
    await act(async () => { await wait(20) })
    assert.ok(streamController, 'progress is followed over the event stream')
    assert.match(doc.querySelector('.st-update-review').textContent, /Queued/, 'an older "pending" entry reads as queued')
    const background = doc.querySelector('.st-update-review-actions .st-btn-ghost')
    assert.equal(background.textContent, 'Continue in background')
    await act(async () => background.click())
    assert.equal(doc.querySelector('.st-update-review'), null)
    assert.match(doc.querySelector('.st-update-batch-list').textContent, /View update progress · 0\/1 finished/)
    const frame = value => new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`)
    batch = { ...batch, entries: [{ ...batch.entries[0], status: 'applying' }] }
    // A keepalive comment, then a snapshot split across two chunks.
    await act(async () => {
      streamController.enqueue(new TextEncoder().encode(': keepalive\n\n'))
      const bytes = frame(batch)
      streamController.enqueue(bytes.slice(0, 9)); streamController.enqueue(bytes.slice(9))
      await wait(20)
    })
    await act(async () => { doc.querySelector('.st-update-batch-list button').click(); await wait(10) })
    assert.match(doc.querySelector('.st-update-review').textContent, /Updating apps/)
    assert.match(doc.querySelector('.st-update-review').textContent, /Applying this update/)
    batch = { ...batch, phase: 'complete', entries: [{ ...batch.entries[0], status: 'updated', version: '2.0.0' }] }
    await act(async () => { streamController.enqueue(frame(batch)); await wait(20) })
    assert.match(doc.querySelector('.st-update-review').textContent, /1 updated · 0 need attention/)
    assert.equal(submitted, 1)
    await act(async () => doc.querySelector('.st-update-review-actions .st-btn-ghost').click())
    assert.match(doc.querySelector('.st-update-batch-list').textContent, /View update results/)
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('a stale update-check meets a conflict-blocked preview: card and review both route to Resolve in chat', async () => {
  const { dom, restore } = useDom()
  const posts = []
  const openedChats = []
  dom.window.addEventListener('message', event => { if (event.data?.type === 'moebius:open-chat') openedChats.push(event.data.chatId) })
  let root
  try {
    root = await mountApp(dom, async (path, options) => {
      if (options.method === 'POST') posts.push(path)
      if (path === '/api/apps/') return json([voiceRow])
      if (path === '/api/apps/update-batches') return json({ batches: [] })
      // The update-check answer predates the conflict; only the preview knows.
      if (/^\/api\/apps\/11\/update-check/.test(path)) return json({ update_available: true, pending_update_state: 'none' })
      if (/^\/api\/apps\/11\/update-candidate-preview/.test(path)) return json({ ...candidate(11), pending_update_state: 'needs_resolution' })
      if (path === '/api/apps/conflict-resolver-batch') return json({ chat_id: 'resolver-chat', created: true })
      return null
    })
    const doc = dom.window.document
    const cardAction = () => doc.querySelector('.st-card-status-row button[aria-label$=" Voice"]')
    assert.equal(cardAction()?.getAttribute('aria-label'), 'Update Voice', 'the stale check offers an update')
    await act(async () => { cardAction().click(); await wait(20) })
    const modal = doc.querySelector('.st-update-review')
    assert.ok(modal, 'the update review opens')
    assert.match(modal.textContent, /Local edits need review/)
    const modalButtons = [...modal.querySelectorAll('.st-update-review-section button')].map(button => button.textContent)
    assert.deepEqual(modalButtons, ['Resolve in chat'], 'retrying would only meet the same conflict')
    assert.doesNotMatch(modal.textContent, /Access changes|Access review/)
    assert.equal(modal.querySelector('.st-update-review-actions button.st-btn-primary'), null, 'nothing can be confirmed')
    assert.equal(cardAction()?.getAttribute('aria-label'), 'Resolve in chat Voice', 'the card behind the review flips too')
    await act(async () => { modal.querySelector('.st-update-review-section button').click(); await wait(20) })
    assert.deepEqual(posts, ['/api/apps/conflict-resolver-batch'], 'resolving starts the resolver and installs nothing')
    await act(async () => { [...modal.querySelectorAll('button')].find(button => button.textContent === 'Open resolver chat').click() })
    assert.deepEqual(openedChats, ['resolver-chat'])
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('a candidate the platform would not apply says why on the card and in the review', async () => {
  const { dom, restore } = useDom()
  let root
  const moved = 'The catalog lists Voice in another repository. Reinstall it from the Store to follow the move.'
  try {
    root = await mountApp(dom, async path => {
      if (path === '/api/apps/') return json([voiceRow, memoryRow])
      if (path === '/api/apps/update-batches') return json({ batches: [] })
      if (/^\/api\/apps\/11\/update-check/.test(path)) return json({ update_available: null, pending_update_state: 'none', candidate_rejected: { code: 'repository_moved', message: moved } })
      if (/^\/api\/apps\/12\/update-check/.test(path)) return json({ update_available: true, pending_update_state: 'none' })
      if (/^\/api\/apps\/12\/update-candidate-preview/.test(path)) return json({ detail: { code: 'identity_mismatch', message: 'This release is a different app than the one installed.' } }, 409)
      return null
    })
    const doc = dom.window.document
    const card = name => [...doc.querySelectorAll('.st-card')].find(node => node.querySelector('.st-card-open')?.textContent === name)
    assert.match(card('Voice').textContent, /Repository moved/)
    assert.match(card('Voice').textContent, /another repository/)
    assert.equal(card('Voice').querySelector('.st-card-status-row button[aria-label$=" Voice"]').getAttribute('aria-label'), 'Open Voice')
    await act(async () => { card('Memory').querySelector('button[aria-label="Update Memory"]').click(); await wait(20) })
    const modal = doc.querySelector('.st-update-review')
    assert.match(modal.textContent, /different app than the one installed/)
    assert.deepEqual([...modal.querySelectorAll('.st-update-review-section button')].map(b => b.textContent), ['Ask agent'])
    assert.equal(doc.querySelector('.st-toast-msg'), null, 'the review shows the error once, without a toast')
    await act(async () => doc.querySelector('.st-update-review-actions .st-btn-ghost').click())
    assert.match(card('Memory').textContent, /Update not offered/)
    assert.match(card('Memory').textContent, /different app than the one installed/)
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('a card error the same action may get past offers Try again; others keep Ask agent', async () => {
  const { dom, restore } = useDom()
  const { CatalogCard } = await bundle(join('ui', 'CatalogCard.jsx'), 'card')
  const root = createRoot(dom.window.document.getElementById('root'))
  const item = { id: 'voice', manifest_url: 'https://example.test/voice/mobius.json', manifest: { id: 'voice', name: 'Voice', version: '1.0.0' } }
  const calls = { retry: 0, agent: 0 }
  const render = props => act(async () => root.render(React.createElement(CatalogCard, {
    item, installed: [], error: 'The Git transfer timed out.', onAskAgentError() { calls.agent++ }, layout: 'list', ...props,
  })))
  const errorButtons = () => [...dom.window.document.querySelectorAll('.st-card-inline-error button')].map(button => button.textContent)
  try {
    await render({ onRetryError: () => { calls.retry++ } })
    assert.deepEqual(errorButtons(), ['Try again'])
    await act(async () => dom.window.document.querySelector('.st-card-inline-error button').click())
    assert.equal(calls.retry, 1)
    await render({ onRetryError: null })
    assert.deepEqual(errorButtons(), ['Ask agent'])
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('a refusal after the dialog closed during Starting leaves no stuck placeholder', async () => {
  const { dom, restore } = useDom()
  let answer
  let root
  try {
    root = await mountApp(dom, async (path, options) => {
      if (path === '/api/apps/') return json([voiceRow])
      if (path === '/api/apps/update-batches' && options.method === 'POST') return new Promise(resolve => { answer = resolve })
      if (path === '/api/apps/update-batches') return json({ batches: [] })
      if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
      if (path.includes('/update-candidate-preview')) return json(candidate(11))
      return null
    })
    const doc = dom.window.document
    await act(async () => doc.querySelector('button[aria-label="Update Voice"]').click())
    await act(async () => doc.querySelector('.st-update-review-actions button.st-btn-primary').click())
    assert.ok(answer, 'the submission is in flight')
    await act(async () => doc.querySelector('.st-update-review-actions .st-btn-ghost').click())
    assert.match(doc.querySelector('.st-update-batch-list')?.textContent || '', /Check update status/)
    assert.equal(doc.querySelector('button[aria-label$=" Voice"].st-card-action')?.disabled, true, 'possibly accepted: shown as updating')
    await act(async () => { answer(json({ detail: { code: 'app_update_running', batch_id: 'other', message: 'Already running.' } }, 409)); await wait(20) })
    assert.equal(doc.querySelector('.st-update-batch-list'), null, 'a refused id leaves Library')
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('focus')); await wait(20) })
    assert.equal(doc.querySelector('.st-update-batch-list'), null)
    assert.equal(doc.querySelector('button[aria-label="Update Voice"]')?.disabled, false, 'the app is free to update again')
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('a temporary Git failure in the preview is an ordinary error with Try again, not a rejection', async () => {
  const { dom, restore } = useDom()
  let root
  try {
    root = await mountApp(dom, async path => {
      if (path === '/api/apps/') return json([voiceRow])
      if (path === '/api/apps/update-batches') return json({ batches: [] })
      if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
      if (path.includes('/update-candidate-preview')) return json({ detail: { code: 'git_transfer_timeout', message: 'The app\'s Git transfer timed out.', retryable: true } }, 409)
      return null
    })
    const doc = dom.window.document
    await act(async () => { doc.querySelector('button[aria-label="Update Voice"]').click(); await wait(20) })
    const modal = doc.querySelector('.st-update-review')
    assert.match(modal.textContent, /Git transfer timed out/)
    assert.deepEqual([...modal.querySelectorAll('.st-update-review-section button')].map(b => b.textContent), ['Try again'])
    await act(async () => doc.querySelector('.st-update-review-actions .st-btn-ghost').click())
    assert.doesNotMatch(doc.body.textContent, /Update not offered|Repository moved/)
    assert.ok(doc.querySelector('button[aria-label="Update Voice"]'), 'the update is still offered')
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('a Möbius without server batches still updates through the per-app reviewed install', async () => {
  const { dom, restore } = useDom()
  const installs = []
  let releaseInstall
  let updated = false
  let root
  try {
    root = await mountApp(dom, async (path, options) => {
      if (path === '/api/apps/') return json([{ ...voiceRow, version: updated ? '2.0.0' : '1.0.0' }])
      if (path.startsWith('/api/apps/update-batches')) return json({ detail: 'Not Found' }, 404)
      if (path.includes('/update-check')) return json({ update_available: !updated, pending_update_state: 'none' })
      if (path.includes('/update-candidate-preview')) return json(candidate(11))
      if (path === '/api/apps/install') {
        installs.push(JSON.parse(options.body))
        return new Promise(resolve => { releaseInstall = () => { updated = true; resolve(json({ id: 11, slug: 'voice', name: 'Voice', version: '2.0.0', mode: 'update', divergence: 'fast_forward' })) } })
      }
      return null
    })
    const doc = dom.window.document
    assert.equal(doc.querySelector('[role="alert"]'), null, 'a missing batch list is not an error')
    await act(async () => doc.querySelector('button[aria-label="Update Voice"]').click())
    await act(async () => { doc.querySelector('.st-update-review-actions button.st-btn-primary').click(); await wait(20) })
    assert.equal(installs.length, 1)
    assert.deepEqual(installs[0], {
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json',
      reviewed_capability_digest: 'c'.repeat(64), reviewed_source_digest: 'a'.repeat(64),
      update_app_id: 11, reviewed_upstream_commit: 'b'.repeat(40),
    })
    const close = doc.querySelector('.st-update-review-actions .st-btn-ghost')
    assert.equal(close.disabled, true, 'the Store applies these itself, so the dialog stays open')
    assert.match(doc.querySelector('.st-update-review-subtitle').textContent, /Keep the Store open/)
    await act(async () => { releaseInstall(); await wait(20) })
    assert.match(doc.querySelector('.st-update-review').textContent, /1 updated · 0 need attention/)
    await act(async () => doc.querySelector('.st-update-review-actions .st-btn-ghost').click())
    assert.equal(doc.querySelector('.st-update-review'), null)
    assert.ok(doc.querySelector('button[aria-label="Open Voice"]'))
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('an older Möbius whose app route answers 422 for the batch list shows no warning and still updates', async () => {
  const { dom, restore } = useDom()
  const installs = []
  let root
  try {
    root = await mountApp(dom, async (path, options) => {
      if (path === '/api/apps/') return json([voiceRow])
      // GET /api/apps/{app_id} reads "update-batches" as an app id.
      if (path === '/api/apps/update-batches' && options.method !== 'POST') return json({ detail: [{ type: 'int_parsing', loc: ['path', 'app_id'], msg: 'Input should be a valid integer, unable to parse string as an integer', input: 'update-batches' }] }, 422)
      if (path === '/api/apps/update-batches') return json({ detail: 'Method Not Allowed' }, 405)
      if (path.includes('/update-check')) return json({ update_available: installs.length === 0, pending_update_state: 'none' })
      if (path.includes('/update-candidate-preview')) return json(candidate(11))
      if (path === '/api/apps/install') {
        installs.push(JSON.parse(options.body))
        return json({ id: 11, slug: 'voice', name: 'Voice', version: '2.0.0', mode: 'update', divergence: 'fast_forward' })
      }
      return null
    })
    const doc = dom.window.document
    assert.equal(doc.querySelector('[role="alert"]'), null, 'no "Update progress could not be read" warning')
    await act(async () => doc.querySelector('button[aria-label="Update Voice"]').click())
    await act(async () => { doc.querySelector('.st-update-review-actions button.st-btn-primary').click(); await wait(20) })
    assert.equal(installs.length, 1, 'the per-app fallback applied the reviewed update')
    assert.match(doc.querySelector('.st-update-review').textContent, /1 updated · 0 need attention/)
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('on a Möbius with batches, an app removed after its check is reported, never installed one by one', async () => {
  const { dom, restore } = useDom()
  let installs = 0
  let root
  try {
    root = await mountApp(dom, async (path, options) => {
      if (path === '/api/apps/') return json([voiceRow])
      if (path === '/api/apps/update-batches' && options.method === 'POST') return json({ detail: 'App not found.' }, 404)
      if (path === '/api/apps/update-batches') return json({ batches: [] })
      if (path.includes('/update-check')) return json({ update_available: true, pending_update_state: 'none' })
      if (path.includes('/update-candidate-preview')) return json(candidate(11))
      if (path === '/api/apps/install') { installs++; return json({}, 500) }
      return null
    })
    const doc = dom.window.document
    await act(async () => doc.querySelector('button[aria-label="Update Voice"]').click())
    await act(async () => { doc.querySelector('.st-update-review-actions button.st-btn-primary').click(); await wait(20) })
    assert.equal(installs, 0)
    assert.match(doc.querySelector('.st-update-review').textContent, /App not found\./)
  } finally {
    if (root) await act(async () => root.unmount())
    restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})
