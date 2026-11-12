import assert from 'node:assert/strict'
import test from 'node:test'
import { latestScopedAppChat, sendToScopedAgentChat } from '../api.js'
import {
  buildListingAgentMessage,
  LISTING_AGENT_START_GRACE_MS,
  listingAgentRunAfterStatus,
  listingAgentScope,
  mergeListingUpdate,
  observedListingAgentRun,
  startedListingAgentRun,
} from '../domain.js'

const app = { id: 7, name: 'Scorekeeper', slug: 'scorekeeper', source_dir: '/data/apps/scorekeeper' }

function listing(overrides = {}) {
  return {
    tagline: '', description: '', license: null,
    icon: { path: 'icon.png', url: '/r/icon.png' }, iconChanged: false, hero: null, screenshots: [],
    ...overrides,
  }
}

test('every listing request for one app shares one agent chat scope', () => {
  assert.equal(listingAgentScope(7), 'store-listing:7')
  assert.notEqual(listingAgentScope(7), listingAgentScope(8))
})

test('a follow-up carries the whole brief, so a chat picked up weeks later still has it', () => {
  const first = buildListingAgentMessage({ app, problem: '', focus: 'description' })
  assert.match(first, /Please get Scorekeeper ready to publish/)
  assert.match(first, /may ask for more parts of this listing in this same chat/)
  const next = buildListingAgentMessage({ app, problem: '', focus: 'screenshots', followUp: true })
  assert.match(next, /Another request from the App Store for the Scorekeeper listing/)
  assert.match(next, /Finish anything you are already doing for it first/)
  assert.match(next, /1–5 truthful screenshots/)
  assert.match(next, /source is in \/data\/apps\/scorekeeper \(app id 7\)/)
  assert.match(next, /Follow "Store listing" in \/data\/shared\/skills\/building-apps\.md/)
  assert.match(next, /never the owner's own data/)
  assert.match(next, /preview\?app_id=7/)
  assert.match(next, /Do not publish/)
  assert.doesNotMatch(next, /Same rules as before/)
  assert.doesNotMatch(next, /Please get Scorekeeper ready/)
})

test('every brief leaves the license to the owner, including "do it all"', () => {
  for (const brief of [
    buildListingAgentMessage({ app, problem: 'License: Choose a free license.' }),
    buildListingAgentMessage({ app, problem: '', focus: 'description' }),
    buildListingAgentMessage({ app, problem: '', followUp: true }),
  ]) {
    assert.match(brief, /Leave the license to the owner; they choose it in the Store's listing editor\./)
    assert.doesNotMatch(brief, /LICENSE file|question card/)
  }
  const license = buildListingAgentMessage({ app, problem: '', focus: 'license' })
  assert.doesNotMatch(license, /one part of the App Store listing/, 'the license is never a task for an agent')
})

test('an agent part fills untouched fields and never overwrites the owner’s edits', () => {
  const base = listing({ tagline: 'Keep score.' })
  const mine = listing({ tagline: 'Keep score with friends.' })
  const theirs = listing({ tagline: 'Keep score.', description: 'A tiny score keeper.', license: 'MIT' })
  const merged = mergeListingUpdate(base, mine, theirs)
  assert.equal(merged.draft.description, 'A tiny score keeper.')
  assert.equal(merged.draft.license, 'MIT')
  assert.equal(merged.draft.tagline, 'Keep score with friends.', 'an edit only the owner made stays')
  assert.deepEqual(merged.conflicts, {})
  assert.equal(merged.dirty, true)
})

test('when owner and agent both changed a field, the owner’s stays and the agent’s is offered', () => {
  const base = listing()
  const mine = listing({ description: 'My own words.' })
  const theirs = listing({ description: 'The agent’s words.' })
  const merged = mergeListingUpdate(base, mine, theirs)
  assert.equal(merged.draft.description, 'My own words.')
  assert.deepEqual(merged.conflicts, { description: 'The agent’s words.' })

  const same = mergeListingUpdate(base, mine, listing({ description: 'My own words.' }))
  assert.deepEqual(same.conflicts, {}, 'the same text is no conflict')
  assert.equal(same.dirty, false, 'the draft now matches what is saved')
})

test('new screenshots and images arrive by path; only real changes count', () => {
  const shot = { key: 'kept-0-static/store/a.png', path: 'static/store/a.png', url: '/r1/static/store/a.png', alt: 'Bird', label: '' }
  const base = listing()
  const theirs = listing({ screenshots: [{ ...shot, url: '/r2/static/store/a.png', key: 'other' }] })
  const merged = mergeListingUpdate(base, base, theirs)
  assert.equal(merged.draft.screenshots[0].path, 'static/store/a.png')
  assert.equal(merged.dirty, false)
  assert.equal(mergeListingUpdate(listing({ screenshots: [shot] }), listing({ screenshots: [shot] }), theirs).dirty, false,
    'a new asset root for the same file is not a change')
})

test('the agent counts as finished only after it started and stayed quiet twice', () => {
  const now = 1_000_000
  let run = startedListingAgentRun(null, { appId: 7, chatId: 'c1', focus: 'description', now })
  assert.deepEqual(run.parts, ['description'])
  run = startedListingAgentRun(run, { appId: 7, chatId: 'c1', focus: 'screenshots', now })
  assert.deepEqual(run.parts, ['description', 'screenshots'])

  const quiet = { id: 'c1', running: false, awaitingOwner: false }
  run = listingAgentRunAfterStatus(run, quiet, now + 5000)
  run = listingAgentRunAfterStatus(run, quiet, now + 10000)
  assert.equal(run.active, true, 'a request the agent has not picked up yet is not finished')

  run = listingAgentRunAfterStatus(run, { id: 'c1', running: true }, now + 15000)
  run = listingAgentRunAfterStatus(run, quiet, now + 20000)
  assert.equal(run.active, true, 'one quiet poll may be the gap between two queued requests')
  run = listingAgentRunAfterStatus(run, { id: 'c1', running: false, awaitingOwner: true }, now + 25000)
  assert.equal(run.active, true)
  assert.equal(run.awaitingOwner, true, 'a question card keeps the agent active and asks for the owner')
  run = listingAgentRunAfterStatus(run, quiet, now + 30000)
  run = listingAgentRunAfterStatus(run, quiet, now + 35000)
  assert.equal(run.active, false)
  assert.deepEqual(run.parts, [])

  let late = startedListingAgentRun(null, { appId: 7, chatId: 'c1', focus: '', now })
  assert.deepEqual(late.parts, ['all'])
  late = listingAgentRunAfterStatus(late, quiet, now + LISTING_AGENT_START_GRACE_MS)
  late = listingAgentRunAfterStatus(late, quiet, now + LISTING_AGENT_START_GRACE_MS + 5000)
  assert.equal(late.active, false, 'a request that never started stops waiting after the grace period')
})

test('a form opened while the app’s agent works follows it', () => {
  assert.equal(observedListingAgentRun(7, null), null)
  assert.equal(observedListingAgentRun(7, { id: 'c1', running: false, awaitingOwner: false }), null)
  const run = observedListingAgentRun(7, { id: 'c1', running: true, awaitingOwner: false })
  assert.equal(run.active, true)
  assert.equal(run.chatId, 'c1')
  assert.deepEqual(run.parts, [])
})

test('only a chat in this listing’s own scope is reused', async () => {
  const oldFetch = globalThis.fetch
  const rows = [
    { id: 'review', scope: null, running: true },
    { id: 'listing', scope: 'store-listing:7', running: false, awaiting_owner: true },
  ]
  let asked = ''
  globalThis.fetch = async (url) => { asked = url; return new Response(JSON.stringify(rows), { status: 200 }) }
  try {
    assert.deepEqual(await latestScopedAppChat('store-listing:7', 't'),
      { id: 'listing', running: false, awaitingOwner: true })
    assert.match(asked, /scope=store-listing%3A7/)
    assert.equal(await latestScopedAppChat('store-listing:8', 't'), null,
      'a Möbius that ignores the scope filter never hands back another chat')
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('two panes asking at once reach one agent: every request goes through the scoped start', async () => {
  const oldFetch = globalThis.fetch
  const calls = []
  let outcome = 'started'
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null })
    if (url === '/api/app-chats/start') {
      return new Response(JSON.stringify({ chat_id: 'c1', outcome, response: null }), { status: 200 })
    }
    return new Response(JSON.stringify({ status: 'queued' }), { status: 202 })
  }
  const request = { title: 'Get Scorekeeper ready to publish', scope: 'store-listing:7', scopeLabel: 'Scorekeeper',
    first: 'first brief', followUp: 'follow-up brief' }
  try {
    assert.deepEqual(await sendToScopedAgentChat('t', request), { chatId: 'c1', reused: false })
    assert.deepEqual(calls.map((call) => call.url), ['/api/app-chats/start'], 'a new scope admits the first brief itself')
    assert.deepEqual(calls[0].body, { title: request.title, scope: 'store-listing:7', scope_label: 'Scorekeeper',
      owner_visible: true, content: 'first brief' })

    calls.length = 0
    outcome = 'reused'
    assert.deepEqual(await sendToScopedAgentChat('t', request), { chatId: 'c1', reused: true })
    assert.deepEqual(calls.map((call) => call.url), ['/api/app-chats/start', '/api/chats/c1/messages'])
    assert.equal(calls[1].body.content, 'follow-up brief', 'the existing agent gets the follow-up, not a second first brief')
    assert.ok(!calls.some((call) => call.url === '/api/app-chats'), 'never a check-then-create from the client')
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('a cancelled scope is reported, not retried into a parallel agent', async () => {
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return new Response(JSON.stringify({ detail: { code: 'scope_cancelled', chat_id: 'c1', message: 'cancelled' } }), { status: 409 })
  }
  try {
    await assert.rejects(sendToScopedAgentChat('t', { title: 'x', scope: 'store-listing:7', first: 'a', followUp: 'b' }),
      (error) => error.code === 'scope_cancelled' && /cannot take new requests/.test(error.message))
    assert.deepEqual(calls, ['/api/app-chats/start'])
  } finally {
    globalThis.fetch = oldFetch
  }
})
