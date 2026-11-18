import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildListingAgentMessage,
  buildPublishCheckMessage,
  buildPublishFixMessage,
  buildUpdateFailureMessage,
  buildUpdateReviewMessage,
} from '../domain.js'

const manifest = JSON.parse(readFileSync(new URL('../mobius.json', import.meta.url), 'utf8'))

// Every agent the Store starts works on another app: its source directory and
// owner routes. A Tools, Read or Edit room reaches only the Store's own
// storage, so the Store declares Admin rather than a scope that silently fails.
test('the Store declares admin agent access with a short owner-facing reason', () => {
  assert.equal(manifest.embeds_agent, true)
  assert.equal(manifest.agent_role, undefined)
  assert.deepEqual(Object.keys(manifest.agent).sort(), ['reason', 'scope'])
  assert.equal(manifest.agent.scope, 'admin')
  assert.equal(manifest.agent.allow_tools, undefined, 'admin omits allow_tools')
  const reason = manifest.agent.reason.trim()
  assert.ok(reason.length >= 1 && reason.length <= 80, `reason is ${reason.length} characters`)
})

test('each agent brief sends the agent outside the Store storage folder', () => {
  const app = { id: 7, name: 'Scorekeeper', slug: 'scorekeeper', source_dir: '/data/apps/scorekeeper' }
  const item = { id: 'scorekeeper', manifest: { id: 'scorekeeper', name: 'Scorekeeper', version: '2.0.0' } }
  const installedApp = { id: 7, slug: 'scorekeeper' }
  const briefs = [
    buildUpdateReviewMessage({ item, installedApp, preview: { upstream_version: '2.0.0' } }),
    buildUpdateFailureMessage({ item, installedApp, preview: null, error: 'boom' }),
    buildListingAgentMessage({ app, problem: '', focus: 'icon' }),
    buildPublishCheckMessage({ app, acceptedCommit: 'a'.repeat(40), storeAppId: 1 }),
    buildPublishFixMessage({ app, issues: [{ title: 'Secret in code', path: 'api.js', fix: 'Remove it' }] }),
  ]
  for (const brief of briefs) {
    // Another app's source directory: not readable from a confined room.
    assert.match(brief, /\/data\/apps\/scorekeeper/)
  }
  // Owner routes and the platform's skills, refused to a confined agent key.
  assert.match(briefs[0], /GET \/api\/apps\/7\/update-candidate-preview/)
  assert.match(briefs[2], /\/data\/shared\/skills\/building-apps\.md/)
  assert.match(briefs[2], /\/api\/community\/publications\/github\/preview/)
  assert.match(briefs[4], /Apply the app/)
})
