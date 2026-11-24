import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-spotlight-pause-runtime')

async function spotlightModule() {
  const requireFromFrontend = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const iconStub = join(buildDir, 'icons.mjs')
  await writeFile(iconStub, [
    "import { createElement } from 'react'",
    "const icon = (name) => (props) => createElement('svg', { ...props, 'data-icon': name })",
    ...['ChevronLeft', 'ChevronRight', 'PauseSm', 'PlaySm'].map((name) => `export const ${name} = icon('${name}')`),
  ].join('\n'))
  const build = await rolldown({
    input: join(here, '..', 'ui', 'Spotlight.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': iconStub } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'spotlight.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  return import(pathToFileURL(output).href)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('pressing Play resumes the spotlight even while the pointer is still over it', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://store.test/', pretendToBeVisual: true })
  const keys = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map((key) => [key, globalThis[key]]))
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: false })
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { Spotlight } = await spotlightModule()
  const doc = dom.window.document
  const root = createRoot(doc.getElementById('root'))
  const spotlights = [
    { id: 'one', name: 'One', editorial_artwork_url: 'https://store.test/one.png', manifest: { name: 'One' } },
    { id: 'two', name: 'Two', editorial_artwork_url: 'https://store.test/two.png', manifest: { name: 'Two' } },
  ]
  const fill = () => doc.querySelector('.st-spotlight-fill')
  const toggle = () => doc.querySelector('.st-spotlight-toggle')
  const pointer = (type, target, relatedTarget) => target.dispatchEvent(
    new dom.window.MouseEvent(type, { bubbles: true, relatedTarget }))
  try {
    root.render(React.createElement(Spotlight, { appId: 1, token: 't', spotlights, onPick: () => {} }))
    await wait(30)
    assert.ok(fill(), 'the active segment is running')
    assert.ok(!fill().classList.contains('is-paused'))

    // The pointer enters the carousel: hovering pauses as before.
    pointer('mouseover', toggle(), doc.body)
    await wait(10)
    assert.ok(fill().classList.contains('is-paused'), 'hover pauses')

    // Click Pause, then Play, without the pointer ever leaving.
    toggle().focus()
    toggle().click()
    await wait(10)
    assert.equal(toggle().getAttribute('aria-pressed'), 'true')
    assert.ok(toggle().querySelector('[data-icon="PlaySm"]'), 'paused shows the solid play glyph')
    assert.ok(fill().classList.contains('is-paused'))
    toggle().click()
    await wait(10)
    assert.equal(toggle().getAttribute('aria-pressed'), 'false')
    assert.ok(!fill().classList.contains('is-paused'), 'Play resumes despite hover and focus')

    // After the pointer and focus leave and the pointer returns, hover pauses again.
    toggle().blur()
    pointer('mouseout', toggle(), doc.body)
    await wait(10)
    pointer('mouseover', toggle(), doc.body)
    await wait(10)
    assert.ok(fill().classList.contains('is-paused'), 'hover pausing is restored once the pointer has left')
  } finally {
    root.unmount()
    await rm(buildDir, { recursive: true, force: true })
    for (const key of keys) {
      if (key === 'navigator') Object.defineProperty(globalThis, 'navigator', { value: old.navigator, configurable: true, writable: true })
      else globalThis[key] = old[key]
    }
  }
})
