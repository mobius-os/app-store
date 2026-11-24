import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import {openDetailEntry, closeDetailEntry, backDetailEntry, detailOpenerOf, findDetailOpener, focusDetailTransition} from '../store-navigation.js'

function harness() {
  const current={current:null}
  let callbacks, finish, shown=null, opens=0, closes=0
  const nav={open:(_label, handlers) => {
    callbacks=handlers; opens++
    return {outcome:new Promise(resolve=>{finish=resolve}),close:()=>{closes++}}
  }}
  return {current, context:{nav,show:item=>{shown=item},prepare:()=>{}},
    own:()=>finish({status:'owned'}), reject:()=>finish({status:'rejected'}),
    back:()=>callbacks.onBack(), forward:()=>callbacks.onForward(),
    get shown(){return shown},get opens(){return opens},get closes(){return closes}}
}
const app=id=>({id,manifest:{name:id}})
test('an owned detail retargets without another push and Forward restores the latest target',async()=>{
  const h=harness(),first=app('first'),second=app('second')
  const pending=openDetailEntry(h.current,first,h.context);h.own();await pending
  await openDetailEntry(h.current,second,h.context)
  assert.equal(h.shown,second);assert.equal(h.opens,1)
  h.back();assert.equal(h.shown,null)
  h.forward();assert.equal(h.shown,second)
})
test('a pending detail retarget waits for ownership and opens the latest target',async()=>{
  const h=harness(),second=app('second')
  const pending=openDetailEntry(h.current,app('first'),h.context)
  await openDetailEntry(h.current,second,h.context)
  assert.equal(h.shown,null);assert.equal(h.opens,1)
  h.own();await pending;assert.equal(h.shown,second)
})
test('rejected or cancelled ownership never renders a stranded detail',async()=>{
  const rejected=harness()
  const first=openDetailEntry(rejected.current,app('first'),rejected.context)
  rejected.reject();await first
  assert.equal(rejected.current.current,null);assert.equal(rejected.shown,null)
  const cancelled=harness()
  const second=openDetailEntry(cancelled.current,app('second'),cancelled.context)
  closeDetailEntry(cancelled.current,cancelled.context.show)
  cancelled.own();await second
  assert.equal(cancelled.shown,null);assert.equal(cancelled.current.current,null)
})
test('a requested detail focus belongs to that open and never leaks into later details',async()=>{
  const h=harness(),shown=[],first=app('first'),second=app('second')
  h.context.show=(item,focus='')=>shown.push([item?.id??null,focus])
  const pending=openDetailEntry(h.current,first,{...h.context,focus:'reviews'});h.own();await pending
  await openDetailEntry(h.current,second,h.context)
  h.back();h.forward()
  closeDetailEntry(h.current,h.context.show)
  assert.deepEqual(shown,[['first','reviews'],['second',''],[null,''],['second',''],[null,'']])
})
test('Back then Forward restores a detail opened at its reviews',async()=>{
  const h=harness(),shown=[]
  h.context.show=(item,focus='')=>shown.push([item?.id??null,focus])
  const pending=openDetailEntry(h.current,app('rated'),{...h.context,focus:'reviews'});h.own();await pending
  h.back();h.forward()
  assert.deepEqual(shown,[['rated','reviews'],[null,''],['rated','reviews']])
})
test('an app opened from an app page is its own level: Back returns to the first app', async () => {
  const { backDetailEntry } = await import('../store-navigation.js')
  const h = harness(), first = app('first'), second = app('second')
  const one = openDetailEntry(h.current, first, h.context); h.own(); await one
  const two = openDetailEntry(h.current, second, { ...h.context, push: true }); h.own(); await two
  assert.equal(h.shown, second); assert.equal(h.opens, 2)
  assert.equal(h.current.current.prev.item, first)
  backDetailEntry(h.current, h.context.show)
  assert.equal(h.shown, first, 'on-screen Back goes one level')
  assert.equal(h.current.current.item, first)
  closeDetailEntry(h.current, h.context.show)
  assert.equal(h.shown, null); assert.equal(h.current.current, null)
})
test('a page between two apps is redrawn when Back leaves the second app', async () => {
  const { backDetailEntry } = await import('../store-navigation.js')
  const h = harness(); let category = 0
  const one = openDetailEntry(h.current, app('first'), h.context); h.own(); await one
  const two = openDetailEntry(h.current, app('second'), { ...h.context, push: true, below: () => { category++ } }); h.own(); await two
  backDetailEntry(h.current, h.context.show)
  assert.equal(h.shown, null, 'the first app stays beneath, hidden')
  assert.equal(category, 1, 'the category page between them is shown again')
  assert.equal(h.current.current.item.id, 'first')
})

test('screen Back and host Back restore their own opener, including after Forward', async () => {
  const h = harness(), shown = []
  h.context.show = (item, section, returnTo) => shown.push([item?.id ?? null, section, returnTo])
  const outer = { key: 'card:first', shelf: 'picks' }
  const inner = { key: 'card:second', shelf: 'similar' }
  const one = openDetailEntry(h.current, app('first'), { ...h.context, opener: outer, focus: 'reviews' }); h.own(); await one
  const two = openDetailEntry(h.current, app('second'), { ...h.context, opener: inner, push: true }); h.own(); await two
  h.back()
  h.forward()
  backDetailEntry(h.current, h.context.show)
  backDetailEntry(h.current, h.context.show)
  assert.deepEqual(shown, [
    ['first', 'reviews', undefined], ['second', '', undefined],
    ['first', 'reviews', inner], ['second', '', undefined],
    ['first', 'reviews', inner], [null, '', outer],
  ])
})

test('a detail opener resolves after remount without picking another shelf or action', () => {
  const dom = new JSDOM(`<main>
    <section aria-label="Recently updated"><button data-detail-opener="card:news">News</button></section>
    <section aria-labelledby="picks">
      <button data-detail-opener="card:news">News</button>
      <button data-detail-opener="more:news">More</button>
    </section>
  </main>`)
  const root = dom.window.document.querySelector('main')
  const original = root.querySelector('[aria-labelledby="picks"] [data-detail-opener="card:news"]')
  const replacement = original.cloneNode(true)
  const opener = detailOpenerOf(original)
  original.replaceWith(replacement)
  assert.equal(findDetailOpener(root, opener), replacement)
  replacement.remove()
  assert.equal(findDetailOpener(root, opener), null)
  dom.window.close()
})

test('focus enters the detail, then returns to the revived control or page heading', () => {
  const dom = new JSDOM(`<main>
    <div class="st-scroll">
      <h1 class="st-sr-only">Library</h1>
      <h1>Installed</h1>
      <div class="st-rowmenu">
        <button data-detail-opener="more:news">More</button>
        <div role="menu"><button role="menuitem">Details</button></div>
      </div>
    </div>
    <h1 id="st-detail-name" tabindex="-1">News</h1>
  </main>`)
  const { document } = dom.window
  const root = document.querySelector('main')
  const more = root.querySelector('[data-detail-opener]')
  const opener = detailOpenerOf(root.querySelector('[role="menuitem"]'))
  focusDetailTransition(root, app('news'), { section: '' })
  assert.equal(document.activeElement.id, 'st-detail-name')
  more.focus()
  focusDetailTransition(root, app('news'), { section: 'reviews' })
  assert.equal(document.activeElement, more, 'the existing review jump still owns this request')
  focusDetailTransition(root, null, { returnTo: opener })
  assert.equal(document.activeElement, more)
  more.remove()
  focusDetailTransition(root, null, { returnTo: opener })
  assert.equal(document.activeElement.textContent, 'Installed')
  dom.window.close()
})
