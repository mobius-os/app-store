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
import { recoveryNote } from '../domain.js'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-uninstalled-note')
const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES

const uninstalled = { id: 5, name: 'Maps', deleted_at: '2026-10-27T10:00:00Z', expires_at: '2026-11-03T10:00:00Z' }

test('the note stops at the deadline: shown before it, gone at and after it', () => {
  const before = new Date('2026-11-03T09:59:59Z')
  assert.ok(recoveryNote(uninstalled, before))
  assert.equal(recoveryNote(uninstalled, new Date('2026-11-03T10:00:00Z')), null)
  assert.equal(recoveryNote(uninstalled, new Date('2026-11-04T00:00:00Z')), null)
})

test('the note is a full sentence with the dates written out, and the year only when it is not this year', () => {
  const now = new Date('2026-10-28T09:00:00Z')
  const note = recoveryNote(uninstalled, now)
  assert.equal(note.title, 'Previously installed')
  assert.match(note.detail, /^You uninstalled this app on .+\. Möbius keeps the data of uninstalled apps/)
  assert.doesNotMatch(note.detail, /\b(Oct|Nov)\b\.?\s/, 'the month is written out, not abbreviated')
  assert.match(note.detail, /Möbius keeps the data of uninstalled apps for 7 days, so reinstalling this app by .+ brings everything back\.$/)
  assert.doesNotMatch(note.detail, /;/)
  assert.doesNotMatch(note.detail, /2026/, 'no year within the same year')
  const newYear = new Date('2026-01-02T09:00:00Z')
  const lastYear = recoveryNote({ deleted_at: '2025-12-30T10:00:00Z', expires_at: '2026-01-06T10:00:00Z' }, newYear)
  assert.match(lastYear.detail, /2025/, 'a date from another year carries its year')
  assert.equal(recoveryNote(null), null)
  assert.equal(recoveryNote({ deleted_at: 'nonsense', expires_at: 'nonsense' }), null)
})

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

test('the app page shows the note above Install only for an app that can still be recovered', async () => {
  const { dom, restore } = useDom()
  const { DetailView } = await bundleDetailView()
  const root = createRoot(dom.window.document.getElementById('root'))
  const render = uninstalledApp => act(async () => root.render(React.createElement(DetailView, {
    item, installed: [], uninstalledApp, onBack() {}, onInstall() {}, token: 't',
  })))
  try {
    await render(uninstalled)
    const note = dom.window.document.querySelector('.st-detail-note')
    assert.ok(note, 'the note renders')
    assert.match(note.textContent, /Previously installed.*You uninstalled this app on .+brings everything back\./)
    await render(null)
    assert.equal(dom.window.document.querySelector('.st-detail-note'), null)
  } finally {
    await act(async () => root.unmount()); restore()
    await rm(buildDir, { recursive: true, force: true })
  }
})
