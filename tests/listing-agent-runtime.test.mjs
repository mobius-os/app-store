import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-listing-agent')

async function loadUi(file) {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'ui', file), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' } })
  const output = join(buildDir, file.replace(/\.jsx$/, '.mjs'))
  await build.write({ file: output, format: 'es' }); await build.close()
  return import(pathToFileURL(output).href)
}

async function withDom(run) {
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  // Loaded after the document exists, so React listens for real typing.
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    await run(dom, root)
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
  }
}

const checklist = (done) => ['description', 'screenshots', 'license'].map((id) => ({
  id, label: id[0].toUpperCase() + id.slice(1), done: done.includes(id), message: done.includes(id) ? '' : `Add ${id}`,
}))

test('one agent works the listing: rows lock, its parts fill the form, the owner’s edits stay', async () => {
  const { PublisherTab } = await loadUi('PublisherTab.jsx')
  await withDom(async (dom, root) => {
    mock.timers.enable({ apis: ['setInterval'] })
    const doc = dom.window.document
    const app = { id: 7, name: 'Scorekeeper', slug: 'scorekeeper', source_dir: '/data/apps/scorekeeper' }
    const requests = []
    const opened = []
    let status = null
    let previewReads = 0
    let preview = { ready: false, accepted_commit: 'a'.repeat(40),
      draft: { tagline: 'Keep score.', description: '', screenshots: [] }, checklist: checklist([]) }
    const buttons = (label) => [...doc.querySelectorAll('button')].filter(b => b.textContent.trim() === label)
    async function click(label) {
      const [button] = buttons(label)
      assert.ok(button, label)
      await act(async () => button.click())
    }
    async function poll() {
      await act(async () => {
        mock.timers.tick(5000)
        for (let i = 0; i < 20; i += 1) await Promise.resolve()
      })
    }
    const tagline = () => doc.querySelector('.st-edit-field > input')
    const save = () => buttons('Save listing')[0]
    async function typeTagline(value) {
      await act(async () => {
        const input = tagline()
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
      })
    }
    async function appUpdated(appId) {
      await act(async () => {
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', { source: dom.window,
          data: { type: 'moebius:managed-app-event', event: { type: 'app_updated', appId: String(appId) } } }))
        for (let i = 0; i < 20; i += 1) await Promise.resolve()
      })
    }
    try {
      await act(async () => root.render(React.createElement(PublisherTab, {
        installed: [app], identity: { linked: true }, viewer: { github: { connected: true, login: 'owner' } },
        onRefreshPublicationStates() {},
        onListingAgent: async (...args) => { requests.push(args); status = { id: 'c1', running: true }; return { chatId: 'c1' } },
        onListingAgentStatus: async () => status,
        onOpenChat: (id) => opened.push(id),
        onPreviewLocal: async () => { previewReads += 1; return preview },
      })))
      await click('Publish an app')
      await click('Prepare listing')
      assert.equal(buttons('Ask an agent').length, 2, 'the license is the owner’s choice, never an agent’s')

      await click('Ask an agent')
      assert.equal(requests[0][2], 'description')
      assert.equal(buttons('Ask an agent').length, 1, 'the part being worked on cannot be asked for twice')
      assert.equal(buttons('Agent working…').length, 1)
      await click('Agent working…')
      assert.deepEqual(opened, ['c1'], 'its row opens the agent’s chat')
      assert.equal(buttons('Do the rest too').length, 1)

      // The owner keeps editing while the agent works, but saving waits for it:
      // a save now would race the agent's own writes to the same source.
      await typeTagline('My tagline')
      assert.equal(tagline().value, 'My tagline')
      assert.equal(save().disabled, true)
      assert.match(doc.body.textContent, /The agent is still working\. Save when it finishes/)

      // Polls while the agent works read only its status, not the whole listing.
      const readsBefore = previewReads
      await poll()
      await poll()
      assert.equal(previewReads, readsBefore)

      // The agent applies the description (and its own tagline idea).
      preview = { ...preview, accepted_commit: 'b'.repeat(40),
        draft: { tagline: 'Agent tagline', description: 'A tiny score keeper.', screenshots: [] },
        checklist: checklist(['description']) }
      const editorBefore = doc.querySelector('.st-listing-editor')
      await appUpdated(8)
      assert.equal(previewReads, readsBefore, 'another app’s update is not this listing')
      await appUpdated(7)
      assert.equal(previewReads, readsBefore + 1)
      assert.equal(doc.querySelector('.st-listing-editor textarea').value, 'A tiny score keeper.', 'filled in without copy and paste')
      assert.equal(tagline().value, 'My tagline', 'the owner’s edit is never overwritten')
      assert.equal(doc.querySelector('.st-listing-editor'), editorBefore, 'the form is not remounted under the owner')
      assert.match(doc.querySelector('.st-agent-conflicts').textContent, /The agent wrote a new tagline/)
      assert.match(doc.querySelector('.st-agent-conflicts').textContent, /Agent tagline/)
      assert.equal(buttons('Agent working…').length, 0, 'a finished part shows done, not working')

      await click('Use the agent’s')
      assert.equal(tagline().value, 'Agent tagline')
      assert.equal(doc.querySelector('.st-agent-conflicts'), null)

      // Another part goes to the same agent.
      await click('Ask an agent')
      assert.equal(requests.length, 2)
      assert.equal(requests[1][2], 'screenshots')
      assert.equal(buttons('Agent working…').length, 1)

      // It finishes: the turn's end re-reads the listing once, and two quiet
      // polls end the working state.
      preview = { ...preview, accepted_commit: 'c'.repeat(40),
        asset_root: '/assets/',
        draft: { ...preview.draft, screenshots: [{ src: 'static/store/a.png', alt: 'Scores', label: '' }] },
        checklist: checklist(['description', 'screenshots']) }
      status = { id: 'c1', running: false, awaitingOwner: false }
      const readsAtEnd = previewReads
      await poll()
      assert.equal(previewReads, readsAtEnd + 1, 'a finished turn picks up parts the app events missed')
      assert.equal(doc.querySelectorAll('.st-edit-shot').length, 1)
      assert.equal(doc.querySelector('.st-edit-shot img')?.getAttribute('src'), '/assets/static/store/a.png',
        'the agent’s screenshot arrives as its image, not an empty slot')
      assert.equal(buttons('View agent work').length, 1)
      await poll()
      assert.equal(previewReads, readsAtEnd + 1)
      assert.equal(buttons('View agent work').length, 0)
      assert.equal(buttons('Do it all with an agent').length, 1)
      assert.equal(buttons('Ask an agent').length, 0)
      await typeTagline('Final tagline')
      assert.equal(save().disabled, false, 'saving is open again once the agent is done')
    } finally {
      mock.timers.reset()
    }
  })
})

test('publish consent names one revision: an agent’s new revision asks for it again', async () => {
  const { PublisherTab } = await loadUi('PublisherTab.jsx')
  await withDom(async (dom, root) => {
    const doc = dom.window.document
    const app = { id: 7, name: 'Scorekeeper', slug: 'scorekeeper', source_dir: '/data/apps/scorekeeper' }
    const commitA = 'a'.repeat(40)
    const commitB = 'b'.repeat(40)
    const published = []
    let status = null
    let preview = { ready: true, accepted_commit: commitA, name: 'Scorekeeper', icon_url: '',
      repository_name: 'scorekeeper', listing: { tagline: 'Keep score.', description: 'A score keeper.' },
      draft: { tagline: 'Keep score.', description: 'A score keeper.', screenshots: [] },
      checklist: checklist(['description', 'screenshots', 'license']) }
    const button = (label) => [...doc.querySelectorAll('button')].find(b => b.textContent.trim() === label)
    const consent = () => doc.querySelector('.st-publish-consent input')
    async function click(element) {
      assert.ok(element)
      await act(async () => element.click())
    }
    await act(async () => root.render(React.createElement(PublisherTab, {
      installed: [app], identity: { linked: true }, viewer: { github: { connected: true, login: 'owner' } },
      onRefreshPublicationStates() {},
      onListingAgent: async () => { status = { id: 'c1', running: true }; return { chatId: 'c1' } },
      onListingAgentStatus: async () => status,
      onPreviewLocal: async () => preview,
      onPublishLocal: async (...args) => { published.push(args); return false },
    })))
    await click(button('Publish an app'))
    await click(button('Prepare listing'))
    await click(button('Revise with an agent'))
    assert.ok(button('Agent working… View'), 'the agent works on the listing')

    // The owner reviews revision A and consents to it, up to the last step.
    await click(consent())
    assert.equal(consent().checked, true)
    await click(button('Publish…'))
    assert.ok(button('Publish'), 'the final confirmation is open')

    // The agent applies a part: revision B is now the accepted one.
    preview = { ...preview, accepted_commit: commitB,
      listing: { ...preview.listing, tagline: 'Agent tagline' },
      draft: { ...preview.draft, tagline: 'Agent tagline' } }
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', { source: dom.window,
        data: { type: 'moebius:managed-app-event', event: { type: 'app_updated', appId: '7' } } }))
      for (let i = 0; i < 20; i += 1) await Promise.resolve()
    })
    assert.match(doc.querySelector('.st-listing-hero-copy').textContent, /Agent tagline/, 'revision B is shown')
    assert.equal(consent().checked, false, 'consent given for A does not carry over to B')
    assert.equal(button('Publish'), undefined, 'the confirmation given for A is closed')
    assert.equal(button('Publish…').disabled, true, 'B cannot be published without fresh consent')
    assert.deepEqual(published, [])

    // Fresh consent publishes exactly the revision now shown.
    await click(consent())
    await click(button('Publish…'))
    await click(button('Publish'))
    assert.deepEqual(published, [[7, 'scorekeeper', commitB]])
  })
})

test('the License row leads to the owner’s picker and never shows agent work', async () => {
  const { ListingChecklist } = await loadUi('ListingEditor.jsx')
  await withDom(async (dom, root) => {
    let chosen = 0
    const asked = []
    await act(async () => root.render(React.createElement(ListingChecklist, {
      checklist: checklist([]), agentBusy: false,
      agent: { parts: ['all'], awaitingOwner: false },
      onAgent: (id) => asked.push(id), onViewAgent() {}, onChooseLicense: () => { chosen += 1 },
    })))
    const rows = [...dom.window.document.querySelectorAll('li')]
    const license = rows.find((row) => row.textContent.includes('License'))
    assert.equal(rows.filter((row) => /Agent working/.test(row.textContent)).length, 2, 'the agent works the other rows')
    assert.doesNotMatch(license.textContent, /Agent working|Ask an agent/)
    await act(async () => license.querySelector('button').click())
    assert.equal(chosen, 1)
    assert.deepEqual(asked, [])

    await act(async () => root.render(React.createElement(ListingChecklist, {
      checklist: checklist([]), agentBusy: false, agent: { parts: ['description'], awaitingOwner: true },
      onAgent: (id) => asked.push(id), onViewAgent() {}, onChooseLicense() {},
    })))
    const ask = [...dom.window.document.querySelectorAll('button')].filter((b) => /Ask an agent|Do the rest too/.test(b.textContent))
    assert.equal(ask.length, 2)
    assert.ok(ask.every((b) => b.disabled), 'no new request while the agent waits on the owner’s answer')

    await act(async () => root.render(React.createElement(ListingChecklist, {
      checklist: checklist([]), agentBusy: false, onAgent() {}, onViewAgent() {},
    })))
    const plain = [...dom.window.document.querySelectorAll('li')].find((row) => row.textContent.includes('License'))
    assert.equal(plain.querySelector('button'), null, 'no picker on this Möbius: nothing to hand off either')
  })
})

test.after(() => rm(buildDir, { recursive: true, force: true }))
