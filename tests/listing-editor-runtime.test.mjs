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
const buildDir = join(here, '.build-listing-editor-runtime')

test('listing editor explains disabled Save for over-limit UTF-8 caption and alt text', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'ListingEditor.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'editor.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  const { ListingEditor } = await import(pathToFileURL(output).href)
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const draft = { tagline: 'A tagline', description: 'A description', icon: null, hero: null }
  let saves = 0
  async function render(alt, label) {
    await act(async () => root.render(React.createElement(ListingEditor, {
      draft: { ...draft, screenshots: [{ key: 'shot', url: '/shot.png', alt, label }] },
      dirty: true, app: { name: 'Example' }, setDraft() {}, onSave() { saves++ },
    })))
  }
  try {
    for (const [field, max, other] of [['caption', 120, 'What it shows'], ['what it shows', 300, 'Caption']]) {
      const value = 'é'.repeat(max / 2 + 1)
      await render(field === 'caption' ? other : value, field === 'caption' ? value : other)
      const input = dom.window.document.querySelector(`input[aria-label="Screenshot 1: ${field}"]`)
      const counter = dom.window.document.getElementById(input.getAttribute('aria-describedby'))
      assert.ok(counter, `${field} has a visible, accessible byte-limit reason`)
      assert.equal(counter.textContent, `${max + 2}/${max} bytes`)
      assert.ok(counter.classList.contains('is-over'))
      assert.equal(input.getAttribute('aria-invalid'), 'true')
      assert.equal(input.maxLength, -1, 'byte constraints must not silently truncate accepted characters')
      assert.equal(dom.window.document.querySelector('button[type="submit"]').disabled, true)
      await render(field === 'caption' ? other : `  ${value.slice(1)} `, field === 'caption' ? `  ${value.slice(1)} ` : other)
      assert.equal(dom.window.document.querySelector('button[type="submit"]').disabled, false, 'trimmed values at the byte boundary can be saved')
      await act(async () => dom.window.document.querySelector('button[type="submit"]').click())
    }
    assert.equal(saves, 2)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    Object.assign(globalThis, old)
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('the license picker offers the platform’s licenses, says what the app declares, and shows a refusal', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  const dir = `${buildDir}-license`
  await mkdir(dir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'ListingEditor.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(dir, 'editor.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  const { ListingEditor } = await import(pathToFileURL(output).href)
  const { listingLicensing } = await import('../domain.js')
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  let draft = { tagline: 'T', description: 'D', icon: null, hero: null, screenshots: [], license: '' }
  let licensing = {
    ...listingLicensing({
      license_options: [{ spdx: 'MIT', name: 'MIT License' }, { spdx: 'Apache-2.0', name: 'Apache License 2.0' },
        { spdx: 'MPL-2.0', name: 'Mozilla Public License 2.0' }],
      draft: { declared_license: 'BSD-3-Clause' },
    }),
    refusal: '',
  }
  const render = () => act(async () => root.render(React.createElement(ListingEditor, {
    draft, dirty: true, app: { name: 'Example' }, onSave() {}, licensing,
    setDraft(change) { draft = typeof change === 'function' ? change(draft) : change },
  })))
  const picker = () => dom.window.document.querySelector('.st-edit-license')
  try {
    await render()
    const radios = [...picker().querySelectorAll('input[type="radio"]')]
    assert.deepEqual(radios.map((radio) => radio.value), ['MIT', 'Apache-2.0', 'MPL-2.0'])
    assert.ok(radios.every((radio) => !radio.checked))
    assert.equal(picker().querySelectorAll('.st-license-badge').length, 1)
    assert.match(picker().querySelector('.st-license-option').textContent, /MIT License\s*Recommended/)
    assert.match(radios[2].closest('label').textContent, /^Mozilla Public License 2\.0$/)
    assert.match(picker().textContent, /currently declares BSD-3-Clause, which the Store doesn’t offer\. Choosing one of these changes the app’s license\./)
    assert.match(picker().textContent, /Pick a license to publish/)
    await act(async () => radios[1].click())
    assert.equal(draft.license, 'Apache-2.0')
    await render()
    assert.equal(picker().querySelector('input[value="Apache-2.0"]').checked, true)
    assert.match(picker().textContent, /Saving changes it to Apache License 2\.0\./)
    assert.doesNotMatch(picker().textContent, /Pick a license to publish/)

    // The platform kept license text it did not write: the refusal shows at
    // the picker, which can go back to the license the app has now.
    const message = 'This app already has license text (LICENSE). Change it in the source, or ask an agent to, keeping any notices it must carry.'
    licensing = { ...licensing, refusal: message }
    await render()
    assert.equal(picker().querySelector('[role="alert"] .st-edit-error').textContent, message)
    const keep = [...picker().querySelectorAll('button')].find((button) => button.textContent === 'Keep the current license')
    assert.ok(keep)
    await act(async () => keep.click())
    assert.equal(draft.license, '')
    await render()
    assert.equal(picker().querySelector('[role="alert"]'), null)

    // An offered license the app already has is selected and says nothing more.
    licensing = { ...licensing, declared: 'MIT', refusal: message }
    draft = { ...draft, license: 'MIT' }
    await render()
    assert.equal(picker().querySelector('input[value="MIT"]').checked, true)
    assert.doesNotMatch(picker().textContent, /currently|Saving changes/)
    assert.equal(picker().querySelector('[role="alert"]'), null)
    await act(async () => picker().querySelector('input[value="MPL-2.0"]').click())
    await render()
    assert.match(picker().textContent, /license is currently MIT License\. Saving changes it to Mozilla Public License 2\.0\./)
    const keepMit = [...picker().querySelectorAll('button')].find((button) => button.textContent === 'Keep MIT License')
    assert.ok(keepMit)

    // A Möbius that does not require a license yet gets no picker.
    draft = { ...draft, license: null }
    await render()
    assert.equal(picker(), null)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    Object.assign(globalThis, old)
    await rm(dir, { recursive: true, force: true })
  }
})
