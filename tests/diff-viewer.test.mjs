import assert from 'node:assert/strict'
import test from 'node:test'
import { parseUnifiedDiff } from '../ui/diff/parseUnifiedDiff.js'

// The update-review surface renders these parsed entries with the canonical
// per-file diff viewer (ui/diff). These tests pin the behaviour the old
// hand-rolled update-review.js parser got wrong, so the summary counts the
// modal shows over an Apply decision stay honest.

test('parses status and per-file line counts', () => {
  const diff = [
    'diff --git a/index.jsx b/index.jsx',
    'index 123..456 100644',
    '--- a/index.jsx',
    '+++ b/index.jsx',
    '@@ -1,2 +1,2 @@',
    '-old line',
    '+new line',
    ' same',
    'diff --git a/new-file.js b/new-file.js',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/new-file.js',
    '@@ -0,0 +1 @@',
    '+export const ready = true',
  ].join('\n')

  const files = parseUnifiedDiff(diff)
  assert.equal(files.length, 2)
  assert.deepEqual(
    files.map((f) => [f.path, f.status, f.insertions, f.deletions]),
    [['index.jsx', 'M', 1, 1], ['new-file.js', 'A', 1, 0]],
  )
})

test('counts hunk lines whose content itself begins with -- / ++', () => {
  // A removed source line "-- old" renders as the diff body line "--- old", and
  // an added "++ new" as "+++ new". The old parser mistook these for ---/+++
  // file headers, clobbering the path and dropping both lines (0/0). The
  // canonical parser gates header detection on being outside a hunk.
  const diff = [
    'diff --git a/q.sql b/q.sql',
    'index 111..222 100644',
    '--- a/q.sql',
    '+++ b/q.sql',
    '@@ -1,2 +1,2 @@',
    '--- old comment',
    '+++ new comment',
    ' unchanged',
  ].join('\n')

  const files = parseUnifiedDiff(diff)
  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'q.sql')
  assert.equal(files[0].insertions, 1)
  assert.equal(files[0].deletions, 1)
  const hunkLines = files[0].hunks[0].lines
  assert.equal(hunkLines[0].type, 'del')
  assert.equal(hunkLines[0].text, '-- old comment')
  assert.equal(hunkLines[1].type, 'add')
  assert.equal(hunkLines[1].text, '++ new comment')
})

test('a binary file has no textual insertions or deletions', () => {
  const diff = [
    'diff --git a/icon.png b/icon.png',
    'index 111..222 100644',
    'Binary files a/icon.png and b/icon.png differ',
  ].join('\n')

  const files = parseUnifiedDiff(diff)
  assert.equal(files.length, 1)
  assert.equal(files[0].binary, true)
  assert.equal(files[0].insertions, 0)
  assert.equal(files[0].deletions, 0)
  assert.deepEqual(files[0].hunks, [])
})
