// Pure helpers for the pre-update review surface. The backend returns one
// unified diff; these helpers turn it into the compact file summary used by the
// modal while keeping all parsing side-effect-free and unit-testable.

function unquoteGitPath(value) {
  const path = String(value || '').trim()
  if (!(path.startsWith('"') && path.endsWith('"'))) return path
  try {
    return JSON.parse(path)
  } catch {
    return path.slice(1, -1)
  }
}

function diffHeaderPaths(line) {
  let match = line.match(/^diff --git "a\/(.*)" "b\/(.*)"$/)
  if (match) return [unquoteGitPath(`"${match[1]}"`), unquoteGitPath(`"${match[2]}"`)]
  match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
  return match ? [match[1], match[2]] : null
}

export function parseUpdateDiff(diff) {
  const files = []
  let current = null
  for (const line of String(diff || '').split('\n')) {
    const paths = diffHeaderPaths(line)
    if (paths) {
      current = {
        oldPath: paths[0],
        newPath: paths[1],
        path: paths[1] || paths[0],
        status: 'M',
        insertions: 0,
        deletions: 0,
      }
      files.push(current)
      continue
    }
    if (!current) continue
    if (line.startsWith('new file mode ')) {
      current.status = 'A'
    } else if (line.startsWith('deleted file mode ')) {
      current.status = 'D'
    } else if (line.startsWith('rename from ')) {
      current.status = 'R'
      current.oldPath = unquoteGitPath(line.slice('rename from '.length))
    } else if (line.startsWith('rename to ')) {
      current.status = 'R'
      current.newPath = unquoteGitPath(line.slice('rename to '.length))
      current.path = current.newPath
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      current.insertions += 1
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.deletions += 1
    }
  }
  return files
}

const STATUS_LABELS = {
  A: 'Added',
  M: 'Modified',
  D: 'Removed',
  R: 'Renamed',
}

export function updateFileStatusLabel(status) {
  return STATUS_LABELS[status] || 'Changed'
}

export function summarizeUpdateDiff(diff) {
  const files = parseUpdateDiff(diff)
  let insertions = 0
  let deletions = 0
  for (const file of files) {
    insertions += file.insertions
    deletions += file.deletions
  }
  return { files, fileCount: files.length, insertions, deletions }
}
