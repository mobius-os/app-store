import test from 'node:test'
import assert from 'node:assert/strict'
import { newestPublications, communityCatalogItems } from '../domain.js'
import { watchCatalogFreshness } from '../catalog-freshness.js'

test('new arrivals use first publication dates, not revision updates, and exclude unknown dates', () => {
  const item = (id, published_at, updated_at) => ({id, community:{published_at, updated_at}})
  const rows = [item('old','2026-01-01','2026-09-09'), item('new','2026-09-01'), item('unknown','')]
  assert.deepEqual(newestPublications(rows).map(x=>x.id), ['new','old'])
  assert.equal(rows[0].id, 'old')
})
test('registry publication time and author handle survive normalization', () => {
  const [item] = communityCatalogItems({items:[{id:'test', created_at:'2026-09-07', publisher:{login:'author'}, latest_revision:{manifest_url:'https://test/mobius.json',raw_base:'https://test/'}}]})
  assert.equal(item.community.published_at,'2026-09-07')
  assert.equal(item.community.author.handle,'author')
})
test('silent refresh checks each minute and on return, skips hidden/offline, and cleans up', () => {
  const win = new EventTarget()
  const doc = new EventTarget()
  win.navigator = {onLine:true}
  doc.visibilityState = 'visible'
  let tick, cleared, count = 0
  win.setInterval = (fn, ms) => { assert.equal(ms,60000); tick=fn; return 7 }
  win.clearInterval = id => {cleared=id}
  const stop=watchCatalogFreshness(()=>count++,{win,doc})
  tick()
  win.dispatchEvent(new Event('focus'))
  assert.equal(count,2)
  doc.visibilityState='hidden'; tick()
  doc.visibilityState='visible'; win.navigator.onLine=false; tick()
  assert.equal(count,2)
  win.navigator.onLine=true; win.dispatchEvent(new Event('online'))
  doc.dispatchEvent(new Event('visibilitychange'))
  assert.equal(count,4)
  stop(); assert.equal(cleared,7)
  win.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('visibilitychange'))
  assert.equal(count,4)
})

test('refresh preserves a loaded window and follows the registry next offset', async () => {
  const { loadCommunityWindow } = await import('../catalog-freshness.js')
  const calls = []
  const row = id => ({id, created_at:'2026-09-01', latest_revision:{manifest_url:`https://example.test/${id}/mobius.json`,raw_base:`https://example.test/${id}/`}})
  const result = await loadCommunityWindow(async ({offset}) => {
    calls.push(offset)
    return offset === 0 ? {items:[row('one')],next_offset:30} : {items:[row('two')],next_offset:60}
  }, {target:48})
  assert.deepEqual(calls,[0,30])
  assert.equal(result.items.length,2)
  assert.equal(result.nextOffset,60)
  assert.equal(result.hasMore,true)
})
test('a failed later refresh page rejects the entire replacement rather than publishing partial data', async () => {
  const { loadCommunityWindow } = await import('../catalog-freshness.js')
  let calls=0
  await assert.rejects(loadCommunityWindow(async () => {
    if (++calls===2) throw new Error('offline')
    return {items:[{id:'first'}], next_offset:24}
  }, {target:48}), /offline/)
  assert.equal(calls,2)
})
test('refresh rejects a stuck cursor and aborts without requesting another page', async () => {
  const { loadCommunityWindow } = await import('../catalog-freshness.js')
  await assert.rejects(loadCommunityWindow(async () => ({items:[{id:'first'}], next_offset:0})), /did not advance/)
  let calls=0
  await assert.rejects(loadCommunityWindow(async () => {
    calls++
    throw new DOMException('Aborted','AbortError')
  }), {name:'AbortError'})
  assert.equal(calls,1)
})
