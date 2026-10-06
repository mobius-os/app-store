import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { mock } from 'node:test'
import {
  fetchCatalog, fetchUpdateCheck, loadUpdateCandidatePreview, UPDATE_CHECK_DEADLINE_MS,
} from '../api.js'
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
