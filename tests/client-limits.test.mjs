import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { mock } from 'node:test'
import {
  fetchCatalog, fetchManifest, fetchUpdateCheck, loadInstalledApps, loadProviderStatus,
  loadUpdateCandidatePreview, READ_DEADLINE_MS, UPDATE_CHECK_DEADLINE_MS,
} from '../api.js'
import { sleep } from '../sleep.js'
import { LISTING_LIMITS } from '../constants.js'
import { filterCatalog, isSystemCatalogItem, textWithinByteLimit, utf8Length } from '../domain.js'

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
  const description = `  ${words(3950)}\n\nUnchanged  paragraphs. `
  const tagline = ` ${words(110, 'café')}  `
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

  assert.equal(item.description, description.trim())
  assert.equal(item.summary, tagline.trim())
  assert.equal(item.listing.tagline, tagline.trim())
  assert.equal(item.listing.description, description.trim())
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
  for (const entry of registry.apps) {
    const item = byId.get(entry.id)
    for (const field of ['name', 'description', 'summary', 'categories', 'keywords', 'capabilities', 'setup', 'listing', 'preview', 'audience', 'collection']) {
      if (entry[field] === undefined) continue
      if (field === 'setup' || field === 'listing') {
        for (const [key, value] of Object.entries(entry[field])) {
          assert.deepEqual(item[field][key], value, `${entry.id} ${field}.${key}`)
        }
      } else if (Array.isArray(entry[field])) {
        for (const value of entry[field]) assert.ok(item[field].includes(value), `${entry.id} ${field}: ${value}`)
      } else assert.deepEqual(item[field], entry[field], `${entry.id} ${field}`)
    }
  }
})

test('catalog omits over-limit metadata without fabricating shortened copy', async () => {
  const tooLong = bytes => 'é'.repeat(Math.floor(bytes / 2) + 1)
  const [item] = await withFetch(async () => jsonResponse({
    schema: 1,
    apps: [catalogEntry('invalid', {
      name: 'n'.repeat(141),
      description: tooLong(LISTING_LIMITS.descriptionBytes),
      summary: tooLong(LISTING_LIMITS.taglineBytes),
      categories: ['valid', 'x'.repeat(49)],
      listing: {
        tagline: tooLong(LISTING_LIMITS.taglineBytes),
        description: tooLong(LISTING_LIMITS.descriptionBytes),
        screenshots: [{ src: 'shot.png', alt: tooLong(LISTING_LIMITS.altBytes), label: tooLong(LISTING_LIMITS.captionBytes) }],
      },
    })],
  }), () => fetchCatalog('https://raw.example/catalog.json', 'owner-token'))
  assert.equal(item.name, 'n'.repeat(141))
  assert.equal(item.description, undefined)
  assert.equal(item.summary, undefined)
  assert.deepEqual(item.categories, ['valid', 'x'.repeat(49)])
  assert.equal(item.listing.tagline, undefined)
  assert.equal(item.listing.description, undefined)
  assert.deepEqual(item.listing.screenshots, [{ src: 'shot.png', alt: '', label: '' }])
})

test('accepted text trims padding and retains internal whitespace and UTF-8 boundaries', () => {
  const text = '  café\n\nwith  space '
  assert.equal(textWithinByteLimit(text, utf8Length(text.trim())), text.trim())
  assert.equal(textWithinByteLimit(text, utf8Length(text.trim()) - 1), undefined)
  assert.equal(textWithinByteLimit(' ', 10), undefined)
  assert.equal(textWithinByteLimit(42, 10), undefined)
})

test('reviewing an update has no client deadline', async () => {
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
  } finally {
    mock.timers.reset()
  }
})

test('a background update check that outlives its wall-clock deadline is unknown, not an error', async () => {
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

// A connection that never answers: it settles only when its signal aborts.
function stalledFetch(seen = []) {
  return (url, init) => {
    seen.push(init.signal)
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })
  }
}

test('slow Store reads end at one shared deadline with a clear error', async () => {
  const signals = []
  await withFetch(stalledFetch(signals), async () => {
    await assert.rejects(
      loadInstalledApps('owner-token', { deadlineMs: 20 }),
      /Installed apps could not be reached/,
    )
    await assert.rejects(
      fetchManifest('https://raw.example/apps/x/mobius.json', 'owner-token', { deadlineMs: 20 }),
      /Manifest could not be reached/,
    )
    await assert.rejects(
      fetchCatalog('https://raw.example/catalog.json', 'owner-token', { deadlineMs: 20 }),
      /Catalog could not be reached/,
    )
    assert.equal(await loadProviderStatus('owner-token', { deadlineMs: 20 }), null)
  })
  // A timed-out attempt is not retried: each read made exactly one request.
  assert.equal(signals.length, 4)
  assert.ok(signals.every(signal => signal.aborted))
  assert.ok(READ_DEADLINE_MS > 0 && READ_DEADLINE_MS <= 10_000)
})

test('a retry that cannot fit before the deadline reports the server answer at once', async () => {
  const started = Date.now()
  let answered = 0
  await withFetch(async (url, init) => {
    if (init.signal.aborted) throw init.signal.reason
    answered += 1
    return new Response('busy', { status: 503 })
  }, async () => {
    await assert.rejects(
      loadInstalledApps('owner-token', { deadlineMs: 5_000, retries: 2, retryDelayMs: 60_000 }),
      /Installed apps could not be loaded \(503\)/,
    )
    await assert.rejects(
      fetchManifest('https://raw.example/apps/x/mobius.json', 'owner-token', {
        deadlineMs: 5_000, retries: 2, retryDelayMs: 60_000,
      }),
      /Manifest fetch failed: 503/,
    )
    await assert.rejects(
      fetchCatalog('https://raw.example/catalog.json', 'owner-token', { deadlineMs: 5_000, retries: 2, retryDelayMs: 60_000 }),
      /Catalog fetch failed: 503/,
    )
    assert.equal(await loadProviderStatus('owner-token', { deadlineMs: 5_000, retryDelayMs: 60_000 }), null)
  })
  assert.equal(answered, 4, 'no read waited for a retry it could not make')
  assert.ok(Date.now() - started < 1_000)

  // A retry that fits still happens.
  let calls = 0
  await withFetch(async () => (++calls === 1 ? new Response('busy', { status: 503 }) : jsonResponse([])), async () => {
    assert.deepEqual(await loadInstalledApps('owner-token', { deadlineMs: 5_000, retryDelayMs: 1 }), [])
  })
  assert.equal(calls, 2)
})

test('a wait ends at once when its signal has already aborted, and early when it aborts', async () => {
  const started = Date.now()
  await sleep(60_000, AbortSignal.abort())
  const controller = new AbortController()
  const waiting = sleep(60_000, controller.signal)
  controller.abort()
  await waiting
  await sleep(1)
  assert.ok(Date.now() - started < 1_000)

  // A wait that finishes removes its abort listener: one long-lived signal
  // (a batch's watch) is shared by many waits.
  const shared = new AbortController()
  const added = [], removed = []
  const { addEventListener, removeEventListener } = shared.signal
  shared.signal.addEventListener = (type, listener, options) => { added.push(listener); addEventListener.call(shared.signal, type, listener, options) }
  shared.signal.removeEventListener = (type, listener, options) => { removed.push(listener); removeEventListener.call(shared.signal, type, listener, options) }
  for (let i = 0; i < 3; i++) await sleep(1, shared.signal)
  assert.equal(added.length, 3)
  assert.deepEqual(removed, added)
})

test('a response body that stalls past the deadline reads as unreachable', async () => {
  await withFetch(async (url, init) => new Response(new ReadableStream({
    start(controller) {
      init.signal.addEventListener('abort', () => controller.error(init.signal.reason), { once: true })
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }), async () => {
    await assert.rejects(
      fetchCatalog('https://raw.example/catalog.json', 'owner-token', { deadlineMs: 20, retries: 0 }),
      /Catalog could not be reached/,
    )
    await assert.rejects(
      loadInstalledApps('owner-token', { deadlineMs: 20, retries: 0 }),
      /Installed apps could not be reached/,
    )
  })
})

test('catalog search retains every capability string, including Workflows lifecycle', async () => {
  const registry = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'))
  const items = await withFetch(async () => jsonResponse(registry), () => fetchCatalog('https://raw.example/catalog.json', 'tok'))
  assert.ok(filterCatalog(items, { query: 'lifecycle' }).some(item => item.id === 'workflows'))
  for (const entry of registry.apps) {
    for (const capability of entry.capabilities || []) {
      assert.ok(filterCatalog(items, { query: capability }).some(item => item.id === entry.id), `${entry.id}: ${capability}`)
    }
  }
})

test('catalog trims and deduplicates categories and setup without guessed non-Latin byte caps', async () => {
  const name = '界'.repeat(140)
  const setup = { required: true, scope: 'system', section: ' models ', label: '界'.repeat(48), description: '界'.repeat(220), action: '界'.repeat(48), fields: [' 模型 ', '模型', '界'.repeat(48)] }
  const [item] = await withFetch(async () => jsonResponse({ schema: 1, apps: [catalogEntry('padded', {
    name: ` ${name} `, categories: [' System ', 'System', ' system '], setup,
  })] }), () => fetchCatalog('https://raw.example/catalog.json', 'tok'))
  assert.equal(item.name, name)
  assert.deepEqual(item.categories, ['System'])
  assert.ok(isSystemCatalogItem(item))
  assert.deepEqual(item.setup, { ...setup, section: 'models', fields: ['模型', '界'.repeat(48)] })
})
