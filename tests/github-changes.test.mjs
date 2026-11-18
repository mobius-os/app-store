import assert from 'node:assert/strict'
import test from 'node:test'
import { commitChanges, fetchRecentChanges, fetchReleaseNotes } from '../api.js'

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})
const commit = (message, date, parents = 1) => ({
  parents: Array.from({ length: parents }, () => ({})),
  commit: { message, committer: { date } },
})

// Records every GitHub URL the proxy is asked for and answers with `reply`.
function stubProxy(reply) {
  const targets = []
  const old = globalThis.fetch
  globalThis.fetch = async (url) => {
    const path = String(url)
    assert.ok(path.startsWith('/api/proxy?url='), `only the proxy is read: ${path}`)
    const target = decodeURIComponent(path.slice('/api/proxy?url='.length))
    targets.push(target)
    return reply(target)
  }
  return { targets, restore: () => { globalThis.fetch = old } }
}

test('a commit run reads as plain changes without merges or Möbius bookkeeping', () => {
  const changes = commitChanges([
    commit('feat(detail): show the release notes (#12)\n\nBody.', '2026-11-02T10:00:00Z'),
    commit('Merge pull request #11 from someone/branch', '2026-11-01T12:00:00Z', 2),
    commit('Apply app source', '2026-11-01T11:00:00Z'),
    commit('Initialize app repo', '2026-11-01T10:30:00Z'),
    commit('fix: keep the cursor in place', '2026-11-01T10:00:00Z'),
  ])
  assert.deepEqual(changes, [
    { text: 'Show the release notes', date: '2026-11-02T10:00:00Z' },
    { text: 'Keep the cursor in place', date: '2026-11-01T10:00:00Z' },
  ])
})

test("the Store's own release notes leave out bookkeeping commits like the app page does", async () => {
  const proxy = stubProxy(() => json({ commits: [
    commit('Initialize app repo', '2026-11-01T09:00:00Z'),
    commit('fix: read the update check once', '2026-11-01T10:00:00Z'),
    commit('Apply app source', '2026-11-01T11:00:00Z'),
  ] }))
  try {
    const notes = await fetchReleaseNotes({
      manifestUrl: 'https://raw.githubusercontent.com/example/notes-app/main/mobius.json',
      fromCommit: 'a'.repeat(40), toCommit: 'b'.repeat(40), token: 't',
    })
    assert.deepEqual(notes, { notes: ['Read the update check once'], releasedAt: '2026-11-01T11:00:00Z' })
  } finally {
    proxy.restore()
  }
})

test('commit ids from the update check are escaped in the GitHub URL', async () => {
  const proxy = stubProxy(() => json({ commits: [] }))
  try {
    await fetchReleaseNotes({
      manifestUrl: 'https://raw.githubusercontent.com/example/escaped-app/main/mobius.json',
      fromCommit: '../../users/x?y', toCommit: 'c'.repeat(40), token: 't',
    })
    assert.deepEqual(proxy.targets, [
      `https://api.github.com/repos/example/escaped-app/compare/..%2F..%2Fusers%2Fx%3Fy...${'c'.repeat(40)}`,
    ])
  } finally {
    proxy.restore()
  }
})

test('each change list is read from GitHub once per session, and a failed read is tried again', async () => {
  let fail = true
  const proxy = stubProxy(() => {
    if (fail) return json({ message: 'API rate limit exceeded' }, 403)
    return json([commit('Add dark mode', '2026-11-03T10:00:00Z')])
  })
  const read = () => fetchRecentChanges({
    manifestUrl: 'https://raw.githubusercontent.com/example/once-app/main/mobius.json', token: 't',
  })
  try {
    assert.equal(await read(), null, 'a rate-limited read hides the section')
    fail = false
    const first = await read()
    assert.deepEqual(first.items, [{ text: 'Add dark mode', date: '2026-11-03T10:00:00Z' }])
    assert.equal(await read(), first)
    assert.equal(proxy.targets.length, 2, 'the failed read was retried, the good answer was kept')
  } finally {
    proxy.restore()
  }
})
