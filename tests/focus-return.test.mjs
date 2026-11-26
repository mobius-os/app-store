import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { findFocusReturn, focusReturnOf, focusTransition, viewHeading } from '../focus-return.js'

const page = html => {
  const dom = new JSDOM(`<main class="st-root">${html}</main>`)
  return { dom, document: dom.window.document, root: dom.window.document.querySelector('main') }
}

test('an opener is found again after its list remounts, on its own shelf only', () => {
  const { dom, root } = page(`
    <section aria-label="Recently updated"><button data-focus-return="card:news">News</button></section>
    <section aria-labelledby="picks">
      <button data-focus-return="card:news">News</button>
      <button data-focus-return="more:news">More</button>
    </section>`)
  const original = root.querySelector('[aria-labelledby="picks"] [data-focus-return="card:news"]')
  const opener = focusReturnOf(original)
  const replacement = original.cloneNode(true)
  original.replaceWith(replacement)
  assert.equal(findFocusReturn(root, opener), replacement)
  replacement.remove()
  assert.equal(findFocusReturn(root, opener), null, 'the same app on another shelf is not a substitute')
  assert.equal(focusReturnOf(root.querySelector('section')), null, 'an unmarked control records nothing')
  dom.window.close()
})

test('a row menu item records the menu button it closes back to', () => {
  const { dom, root } = page(`<div class="st-rowmenu">
    <button data-focus-return="more:news">More</button>
    <div role="menu"><button role="menuitem">Details</button></div>
  </div>`)
  assert.deepEqual(focusReturnOf(root.querySelector('[role=menuitem]')), { key: 'more:news', scope: null })
  dom.window.close()
})

test('entering focuses the destination; Back returns to the opener, else the destination', () => {
  const { dom, document, root } = page(`<div class="st-scroll">
    <h1 class="st-sr-only">Library</h1>
    <h1>Installed</h1>
    <button data-focus-return="publish">Publish an app</button>
  </div>`)
  const heading = root.querySelector('h1:not(.st-sr-only)')
  const launcher = root.querySelector('button')
  const opener = focusReturnOf(launcher)
  // The swap removed whatever had focus, so the document holds it.
  const swap = () => document.activeElement.blur()
  assert.equal(viewHeading(root), heading, 'the visible page title, not the screen-reader one')
  assert.equal(focusTransition(root, { destination: viewHeading }), heading)
  assert.equal(document.activeElement, heading)
  assert.equal(heading.getAttribute('tabindex'), '-1', 'a heading becomes focusable without joining the Tab order')
  swap()
  assert.equal(focusTransition(root, { destination: viewHeading, returnTo: opener }), launcher)
  assert.equal(document.activeElement, launcher)
  swap()
  launcher.disabled = true
  assert.equal(focusTransition(root, { destination: viewHeading, returnTo: opener }), heading, 'a disabled opener is skipped')
  swap()
  launcher.remove()
  assert.equal(focusTransition(root, { destination: viewHeading, returnTo: opener }), heading)
  swap()
  assert.equal(focusTransition(root, { destination: null }), null, 'no destination leaves focus to the view')
  dom.window.close()
})

test('a control that outlived the swap keeps focus', () => {
  const { dom, document, root } = page(`<div class="st-scroll">
    <h1>Library</h1>
    <button data-focus-return="publish">Publish an app</button>
    <button role="tab">Installed</button>
  </div>`)
  const tab = root.querySelector('[role=tab]')
  tab.focus()
  assert.equal(focusTransition(root, { destination: viewHeading, returnTo: focusReturnOf(root.querySelector('button')) }), null)
  assert.equal(document.activeElement, tab)
  dom.window.close()
})
