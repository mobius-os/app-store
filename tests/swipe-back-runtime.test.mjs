import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-swipe-back-runtime')

async function swipeModule() {
  const requireFromFrontend = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const iconStub = join(buildDir, 'icons.mjs')
  await writeFile(iconStub, [
    "import { createElement } from 'react'",
    "export const ChevronLeft = (props) => createElement('svg', { ...props, 'data-icon': 'ChevronLeft' })",
  ].join('\n'))
  const build = await rolldown({
    input: join(here, '..', 'ui', 'SwipeBack.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': iconStub } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'swipe-back.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}

async function mountPage(body) {
  const dom = new JSDOM(`<div id="page">${body}</div><div id="root"></div>`, { url: 'https://store.test/', pretendToBeVisual: true })
  const keys = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map((key) => [key, globalThis[key]]))
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // jsdom has no layout: treat everything not display:none as on screen.
  dom.window.Element.prototype.getClientRects = function () {
    return this.closest('[style*="display: none"]') ? [] : [{}]
  }
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { SwipeBack } = await swipeModule()
  const root = createRoot(dom.window.document.getElementById('root'))
  await React.act(async () => root.render(React.createElement(SwipeBack)))
  const restore = async () => {
    await React.act(async () => root.unmount())
    for (const key of keys) {
      if (key === 'navigator') Object.defineProperty(globalThis, 'navigator', { value: old.navigator, configurable: true, writable: true })
      else globalThis[key] = old[key]
    }
  }
  return { dom, restore }
}

function swipe(dom, points, { endMs = 300 } = {}) {
  const { window } = dom
  const target = window.document.getElementById('page')
  const fire = (type, x, y, t) => {
    const touch = { identifier: 1, target, clientX: x, clientY: y }
    const event = new window.Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, {
      touches: type === 'touchend' ? [] : [touch],
      changedTouches: [touch],
    })
    Object.defineProperty(event, 'timeStamp', { value: t })
    target.dispatchEvent(event)
    return event
  }
  const [first, ...rest] = points
  fire('touchstart', first[0], first[1], 0)
  const moves = rest.map(([x, y], i) => fire('touchmove', x, y, (i + 1) * (endMs / rest.length)))
  const last = rest.at(-1) || first
  fire('touchend', last[0], last[1], endMs)
  return moves
}

test('swiping right from the left edge presses the page Back control', async () => {
  const { dom, restore } = await mountPage('<button class="st-backlink">Back</button>')
  try {
    let backs = 0
    dom.window.document.querySelector('.st-backlink').addEventListener('click', () => { backs += 1 })
    const moves = swipe(dom, [[6, 300], [30, 302], [70, 305], [110, 306]])
    assert.equal(backs, 1)
    assert.ok(moves.slice(1).every((event) => event.defaultPrevented), 'the page does not scroll while swiping back')
  } finally { await restore() }
})

test('a short slow drag, a vertical scroll, or a mid-screen swipe stays put', async () => {
  const { dom, restore } = await mountPage('<button class="st-backlink">Back</button>')
  try {
    let backs = 0
    dom.window.document.querySelector('.st-backlink').addEventListener('click', () => { backs += 1 })
    swipe(dom, [[6, 300], [20, 300], [40, 301]], { endMs: 600 })
    swipe(dom, [[6, 300], [10, 340], [12, 420]])
    swipe(dom, [[200, 300], [260, 300], [330, 300]])
    assert.equal(backs, 0)
  } finally { await restore() }
})

test('a quick flick goes back even when short', async () => {
  const { dom, restore } = await mountPage('<button class="st-back-btn">Your apps</button>')
  try {
    let backs = 0
    dom.window.document.querySelector('.st-back-btn').addEventListener('click', () => { backs += 1 })
    swipe(dom, [[4, 200], [20, 200], [44, 201]], { endMs: 60 })
    assert.equal(backs, 1)
  } finally { await restore() }
})

test('no Back on screen, a disabled Back, or an open dialog leaves the edge alone', async () => {
  for (const body of [
    '<p>Discover</p>',
    '<button class="st-back-btn" disabled>Back</button>',
    '<button class="st-backlink" style="display: none">Back</button>',
    '<button class="st-backlink">Back</button><div role="dialog" aria-modal="true">Update review</div>',
  ]) {
    const { dom, restore } = await mountPage(body)
    try {
      let backs = 0
      dom.window.document.querySelector('button')?.addEventListener('click', () => { backs += 1 })
      const moves = swipe(dom, [[6, 300], [40, 300], [120, 300]])
      assert.equal(backs, 0, body)
      assert.ok(moves.every((event) => !event.defaultPrevented), `scrolling stays native: ${body}`)
    } finally { await restore() }
  }
})

test.after(() => rm(buildDir, { recursive: true, force: true }))
