import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { mock } from 'node:test'
import {
  fetchCatalog, fetchUpdateCheck, loadUpdateCandidatePreview, UPDATE_CHECK_DEADLINE_MS,
} from '../api.js'
import { LISTING_LIMITS } from '../constants.js'
import { boundText, utf8Length } from '../domain.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function withFetch(impl, run) {
  const oldFetch = globalThis.fetch
  globalThis.fetch = impl
  try {
    return await run()
  } finally {
    globalThis.fetch = oldFetch
  }
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

function catalogEntry(id, extra) {
  return {
    id,
    manifest_url: `https://raw.example/apps/${id}/mobius.json`,
    raw_base: `https://raw.example/apps/${id}/`,
    ...extra,
  }
}

function words(bytes, word = 'listing') {
  return Array.from({ length: Math.floor(bytes / (utf8Length(word) + 1)) }, () => word).join(' ')
}

test('catalog text within the platform listing contract reaches the UI whole', async () => {
  const description = words(3990)
  const tagline = words(118, 'café')
  const alt = words(298)
  const label = words(118)
  const screenshots = Array.from({ length: 6 }, (_, index) => ({
    src: `shot-${index}.png`, alt, label,
  }))
  const [item] = await withFetch(async () => jsonResponse({
    schema: 1,
    apps: [catalogEntry('long', {
      description, summary: tagline, listing: { tagline, description, screenshots },
    })],
  }), () => fetchCatalog('https://raw.example/catalog.json', 'owner-token'))

  assert.equal(item.description, description)
  assert.equal(item.summary, tagline)
  assert.equal(item.listing.tagline, tagline)
  assert.equal(item.listing.description, description)
  assert.equal(item.listing.screenshots.length, LISTING_LIMITS.screenshots)
  for (const shot of item.listing.screenshots) {
    assert.equal(shot.alt, alt)
    assert.equal(shot.label, label)
  }
})

test('the checked-in catalog is never shortened by the Store sanitizer', async () => {
  const registry = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'))
  const items = await withFetch(
    async () => jsonResponse(registry),
    () => fetchCatalog('https://raw.example/catalog.json', 'owner-token'),
  )
  const byId = new Map(items.map(item => [item.id, item]))
  const normalize = value => value?.trim().replace(/\s+/g, ' ') || undefined
  for (const entry of registry.apps) {
    const item = byId.get(entry.id)
    assert.equal(item.description, normalize(entry.description), `${entry.id} description`)
    assert.equal(item.summary, normalize(entry.summary), `${entry.id} summary`)
    if (entry.listing?.tagline) assert.equal(item.listing.tagline, normalize(entry.listing.tagline), `${entry.id} tagline`)
    if (entry.listing?.description) {
      assert.equal(item.listing.description, normalize(entry.listing.description), `${entry.id} listing description`)
    }
  }
})

test('text over the listing contract ends at a whole word within the byte budget', () => {
  const source = words(5000, 'naïve')
  const bounded = boundText(source, LISTING_LIMITS.descriptionBytes)
  assert.ok(utf8Length(bounded) <= LISTING_LIMITS.descriptionBytes)
  assert.ok(bounded.endsWith('…'))
  const kept = bounded.slice(0, -1)
  assert.ok(source.startsWith(kept))
  assert.equal(source[kept.length], ' ', 'the cut falls between words')

  assert.equal(boundText('  short   text ', 10), 'short text')
  assert.equal(boundText('x'.repeat(20), 10), undefined, 'one oversized token is dropped, not split')
  assert.equal(boundText(42, 10), undefined)
})

test('reviewing an update has no client deadline and can be cancelled by the caller', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const seen = []
    let respond
    const pending = withFetch((url, init) => {
      seen.push({ url, init })
      return new Promise(resolve => { respond = resolve })
    }, () => loadUpdateCandidatePreview(7, 'https://raw.example/apps/x/mobius.json', 'owner-token'))
    await Promise.resolve()
    assert.equal(seen[0].init.signal, undefined, 'no client-side abort signal without a caller')
    mock.timers.tick(30 * 60 * 1000)
    respond(jsonResponse({ source_digest: 'digest' }))
    assert.deepEqual(await pending, { source_digest: 'digest' })

    const controller = new AbortController()
    await withFetch(async (url, init) => {
      assert.equal(init.signal, controller.signal)
      return jsonResponse({})
    }, () => loadUpdateCandidatePreview(7, '', 'owner-token', { signal: controller.signal }))
  } finally {
    mock.timers.reset()
  }
})

test('a background update check that outlives the shared deadline is unknown, not an error', async () => {
  assert.ok(UPDATE_CHECK_DEADLINE_MS >= 60_000, 'the deadline outlasts a slow but progressing fetch')
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let signal
    const pending = withFetch((url, init) => {
      signal = init.signal
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }, () => fetchUpdateCheck(7, 'owner-token'))
    await Promise.resolve()
    mock.timers.tick(UPDATE_CHECK_DEADLINE_MS - 1)
    assert.equal(signal.aborted, false)
    mock.timers.tick(1)
    assert.equal(signal.aborted, true)
    assert.equal(await pending, null)
  } finally {
    mock.timers.reset()
  }
})

test('the Store and its scheduled notifier share one update-check deadline', async () => {
  const notifier = await readFile(join(root, 'notify-updates.py'), 'utf8')
  const match = /^UPDATE_CHECK_TIMEOUT_SECONDS = (\d+)$/m.exec(notifier)
  assert.ok(match, 'notify-updates.py names its update-check deadline')
  assert.equal(Number(match[1]) * 1000, UPDATE_CHECK_DEADLINE_MS)
})
