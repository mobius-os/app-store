import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { PUBLISH_CHECK_TIMEOUT_MS } from '../domain.js'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-publish-check')
const COMMIT = 'a'.repeat(40)
const app = { id: 42, name: 'Pocket List', slug: 'pocket-list', source_dir: '/data/apps/pocket-list' }
const readyPreview = (commit = COMMIT, tagline = 'Lists') => ({
  ready: true, accepted_commit: commit, name: 'Pocket List', icon_url: '', repository_name: 'pocket-list',
  listing: { tagline, description: 'A list app', screenshots: [] },
  draft: { tagline, description: 'A list app', screenshots: [] }, checklist: [],
})
const verdict = (result, issues = []) => ({ version: 1, local_app_id: '42', accepted_commit: COMMIT, result, issues })

let PublisherTab
let createRoot
test.before(async () => {
  // react-dom decides at import whether text inputs fire `input` events, so
  // load it with a DOM present; typing into the listing editor depends on it.
  const bootstrap = new JSDOM('')
  const previous = { window: globalThis.window, document: globalThis.document }
  Object.assign(globalThis, { window: bootstrap.window, document: bootstrap.window.document })
  ;({ createRoot } = await import('react-dom/client'))
  Object.assign(globalThis, previous)
  bootstrap.window.close()
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'ui', 'PublisherTab.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' } })
  const output = join(buildDir, 'publisher.mjs')
  await build.write({ file: output, format: 'es' }); await build.close()
  ;({ PublisherTab } = await import(pathToFileURL(output).href))
})
test.after(() => rm(buildDir, { recursive: true, force: true }))

// Renders the Publish tab at one app's ready release panel. `stored` is the
// Store storage the agent writes into; `storage: false` models a Möbius
// without app storage.
async function openReleasePanel({ stored = {}, storage = true, read, props = {} } = {}) {
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  dom.window.mobius = storage ? { storage: { get: read || (async key => stored[key] ?? null) } } : {}
  const root = createRoot(dom.window.document.getElementById('root'))
  const calls = { publish: [], checks: [], saves: [] }
  const doc = dom.window.document
  const buttons = () => [...doc.querySelectorAll('button')]
  const button = label => buttons().find(b => b.textContent.trim() === label)
  async function click(label) {
    const target = button(label)
    assert.ok(target, `${label} in: ${buttons().map(b => b.textContent.trim()).join(' | ')}`)
    await act(async () => target.click())
  }
  await act(async () => root.render(React.createElement(PublisherTab, {
    installed: [app], identity: { linked: true }, viewer: { github: { connected: true, login: 'owner' } },
    onRefreshPublicationStates() {},
    onPreviewLocal: async () => readyPreview(),
    onPublishLocal: async (...args) => { calls.publish.push(args); return false },
    onRunCheck: async (...args) => { calls.checks.push(args); return true },
    ...props,
  })))
  await click('Publish an app')
  await click('Prepare listing')
  await act(async () => { await new Promise(resolve => setImmediate(resolve)) })
  async function consent() {
    await act(async () => doc.querySelector('.st-publish-consent input').click())
  }
  async function close() {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
  }
  async function settle() { await act(async () => { await new Promise(resolve => setImmediate(resolve)) }) }
  return { dom, doc, calls, click, button, consent, close, settle, text: () => doc.body.textContent }
}

test('without app storage the check is skipped and publishing stays available', async () => {
  const view = await openReleasePanel({ storage: false })
  try {
    assert.match(view.text(), /Agent checks aren’t available on this Möbius/)
    assert.equal(view.button('Check with agent'), undefined)
    await view.consent()
    await view.click('Publish…')
    assert.match(view.text(), /Publish without a check\?/)
    await view.click('Publish')
    assert.deepEqual(view.calls.publish, [[42, 'pocket-list', COMMIT]])
  } finally { await view.close() }
})

test('an unchecked version is published through a plain "without a check" step', async () => {
  const view = await openReleasePanel()
  try {
    assert.equal(view.button('Publish anyway…'), undefined, 'a never-checked app is not called risky')
    await view.consent()
    await view.click('Publish…')
    assert.match(view.text(), /Publish without a check\?/)
    assert.match(view.text(), /Your agent hasn’t checked this version/)
    await view.click('Publish')
    assert.equal(view.calls.publish.length, 1)
  } finally { await view.close() }
})

test('a flagged version needs one explicit confirmation that takes and returns keyboard focus', async () => {
  const view = await openReleasePanel({ stored: { 'publish-checks/42.json': verdict('must_fix', [
    { severity: 'must_fix', title: 'Sends data to an unlisted server' },
  ]) } })
  try {
    assert.match(view.text(), /Your agent flagged 1 thing to fix/)
    assert.match(view.text(), /AI opinion/)
    assert.equal(view.button('Publish app'), undefined, 'no plain publish without a passing check')
    assert.equal(view.button('Publish anyway…').disabled, true, 'consent is still required')
    await view.consent()
    await view.click('Publish anyway…')
    const heading = view.doc.getElementById('st-publish-anyway-title')
    assert.equal(heading.textContent, 'Publish without fixing it?')
    assert.equal(view.doc.activeElement, heading, 'focus moves into the confirmation')
    assert.match(view.doc.querySelector('.st-publish-anyway').getAttribute('aria-describedby'), /st-publish-anyway-reason/)
    assert.equal(view.calls.publish.length, 0, 'opening the confirmation publishes nothing')
    await view.click('Keep reviewing')
    assert.equal(view.button('Publish anyway'), undefined)
    assert.equal(view.doc.activeElement, view.button('Publish anyway…'), 'focus returns to the Publish button')
    await view.click('Publish anyway…')
    await view.click('Publish anyway')
    assert.deepEqual(view.calls.publish, [[42, 'pocket-list', COMMIT]])
  } finally { await view.close() }
})

test('a passing check is labelled as the agent’s opinion and publishes directly', async () => {
  const view = await openReleasePanel({ stored: { 'publish-checks/42.json': verdict('ready') } })
  try {
    assert.match(view.text(), /Your agent found nothing that needs fixing/)
    assert.match(view.text(), /not a Store review or a guarantee/)
    assert.doesNotMatch(view.text(), /Agent check passed/)
    await view.consent()
    await view.click('Publish app')
    assert.equal(view.calls.publish.length, 1)
  } finally { await view.close() }
})

test('a check that never reports times out into a retryable error, not the older verdict', async () => {
  const view = await openReleasePanel({ stored: { 'publish-checks/42.json': verdict('ready') } })
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() })
  try {
    await view.click('Check again')
    assert.deepEqual(view.calls.checks.map(([target, commit]) => [target.id, commit]), [[42, COMMIT]])
    assert.match(view.text(), /Your agent is checking the app/)
    assert.equal(view.button('Check again'), undefined, 'no duplicate request while waiting')
    await act(async () => { mock.timers.tick(PUBLISH_CHECK_TIMEOUT_MS - 1000) })
    assert.match(view.text(), /Your agent is checking the app/)
    await act(async () => { mock.timers.tick(2000) })
    assert.match(view.text(), /The agent check didn’t finish/)
    assert.doesNotMatch(view.text(), /found nothing that needs fixing/, 'the older verdict is not restored as current')
    assert.ok(view.button('Publish…'), 'publishing still asks for confirmation')
    await view.click('Check again')
    assert.equal(view.calls.checks.length, 2)
    assert.match(view.text(), /Your agent is checking the app/)
    await view.click('Stop waiting')
    assert.match(view.text(), /The agent check didn’t finish/)
  } finally { mock.timers.reset(); await view.close() }
})

test('reopening an app mid-check keeps waiting instead of flashing an error', async () => {
  let release = null
  const older = verdict('ready')
  const view = await openReleasePanel({ read: async () => {
    if (release) await new Promise(resolve => { release = resolve })
    return older
  } })
  try {
    await view.click('Check again')
    assert.match(view.text(), /Your agent is checking the app/)
    await view.click('Back')
    release = true // storage answers slowly after reopening
    await view.click('Prepare listing')
    await view.settle()
    assert.doesNotMatch(view.text(), /didn’t finish/)
    assert.match(view.text(), /Your agent is checking the app/)
    await act(async () => { release() })
    await view.settle()
    assert.match(view.text(), /Your agent is checking the app/, 'the unchanged older verdict still is not the answer')
  } finally { await view.close() }
})

async function typeTagline(view, value) {
  await view.click('Edit listing')
  const input = view.doc.querySelector('.st-edit-field > input')
  const setValue = Object.getOwnPropertyDescriptor(view.dom.window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setValue.call(input, value)
    input.dispatchEvent(new view.dom.window.Event('input', { bubbles: true }))
  })
}

test('saving a listing never overwrites a revision accepted after the editor opened', async () => {
  let commit = COMMIT
  let tagline = 'Lists'
  const saves = []
  const view = await openReleasePanel({ props: {
    onPreviewLocal: async () => readyPreview(commit, tagline),
    onSaveListing: async (...args) => { saves.push(args); tagline = args[1].tagline; commit = 'c'.repeat(40) },
  } })
  try {
    await typeTagline(view, 'My new tagline')
    commit = 'b'.repeat(40) // An agent accepts another revision meanwhile.
    await view.click('Save listing')
    assert.equal(saves.length, 0, 'the older draft is not written onto the newer revision')
    assert.match(view.text(), /This app changed since you opened its listing/)
    assert.equal(view.doc.querySelector('.st-edit-field > input').value, 'My new tagline', 'the owner keeps their edits')
    await view.click('Save listing')
    assert.equal(saves.length, 1)
    assert.equal(saves[0][0], 42)
    assert.equal(saves[0][1].tagline, 'My new tagline')
    assert.equal('expected_commit' in saves[0][1], false, 'only fields the save route accepts are sent')
    assert.doesNotMatch(view.text(), /changed since you opened/, 'a clean save reports no conflict')
  } finally { await view.close() }
})

test('a save whose text did not survive a racing revision keeps the draft and says so', async () => {
  const saves = []
  const view = await openReleasePanel({ props: {
    // The write lands, but another revision replaces the listing text before
    // the Store reads it back.
    onPreviewLocal: async () => readyPreview(saves.length ? 'd'.repeat(40) : COMMIT, 'Lists'),
    onSaveListing: async (...args) => { saves.push(args) },
  } })
  try {
    await typeTagline(view, 'My new tagline')
    await view.click('Save listing')
    assert.equal(saves.length, 1)
    assert.match(view.text(), /This app changed since you opened its listing/)
    assert.equal(view.doc.querySelector('.st-edit-field > input').value, 'My new tagline')
  } finally { await view.close() }
})

test('a release that published a newer revision than the one reviewed says so', async () => {
  const view = await openReleasePanel({ props: { publication: { name: 'Pocket List', status: 'live', revision_moved: true } } })
  try {
    assert.match(view.text(), /a newer version than the one you reviewed was published/)
  } finally { await view.close() }
})
