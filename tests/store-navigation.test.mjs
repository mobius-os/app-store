import test from 'node:test'
import assert from 'node:assert/strict'
import {openDetailEntry, closeDetailEntry} from '../store-navigation.js'

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
