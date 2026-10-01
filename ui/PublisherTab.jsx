/* PublisherTab turns an accepted local app revision into one reviewable public listing. */
import { FileUpload, Search } from '@openai/apps-sdk-ui/components/Icon'
import React, { useRef, useState } from 'react'
import { listingDraftFromPreview, listingPayload } from '../domain.js'
import { ListingChecklist, ListingEditor } from './ListingEditor.jsx'
import { SpotlightEditor } from './SpotlightEditor.jsx'

// Preview preparation crosses an async boundary while the owner can navigate
// back and choose another app. Keep result acceptance explicit so a late
// response can never pair one app's accepted source with another app's
// publication action.
export function createPublicationPreviewGate() {
  let current = 0
  return {
    begin() {
      current += 1
      return current
    },
    invalidate() {
      current += 1
    },
    isCurrent(requestId) {
      return requestId === current
    },
  }
}

function publishableApps(installed) {
  return (installed || []).filter((app) => (
    app?.source_dir
    && app?.slug !== 'app-store'
    && (!app?.manifest_url || app?.hosted_publication)
  ))
}

function publicationLabel(state, hosted) {
  if (hosted?.has_unpublished_changes) return 'Draft changes'
  if (!state) return hosted ? 'Hosted' : 'Not listed'
  if (state.status === 'live') return 'Live'
  if (state.status === 'rejected' || state.status === 'failed') return 'Needs attention'
  if (state.status === 'checking') return 'Checking'
  return 'In review'
}

function assetUrl(preview, path) {
  return preview?.asset_root && path ? `${preview.asset_root}${path}` : ''
}

export function PublisherTab({
  installed,
  identity,
  identityError,
  viewer,
  onRefreshViewer,
  onPreviewLocal,
  onListingAgent,
  onSaveListing,
  onPrepareImage,
  onPublishLocal,
  onRegisterRepository,
  publishingId,
  publication,
  publicationError,
  contributeAvailable,
  onOpenContributions,
  publicationStates = {},
  publicationStatesError,
  onRefreshPublicationStates,
  onLogInToMobiusYou,
  onNavigate,
  catalog = [],
  spotlightFeed = null,
  token,
  onUploadSpotlightArtwork,
  onPublishSpotlight,
}) {
  const apps = publishableApps(installed).sort((left, right) => (
    Date.parse(right.updated_at || '') - Date.parse(left.updated_at || '')
    || String(left.name || '').localeCompare(String(right.name || ''))
  ))
  const identityReady = !!identity && !identityError
  const signedIn = identityReady && !!identity?.linked
  const githubReady = viewer?.github?.connected === true
  const githubLogin = String(viewer?.github?.login || '')
  const [candidate, setCandidate] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [askingAgent, setAskingAgent] = useState(false)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editing, setEditing] = useState(false)
  const [localRepositoryName, setLocalRepositoryName] = useState('')
  const [repository, setRepository] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [appQuery, setAppQuery] = useState('')
  const previewGateRef = useRef(null)
  if (!previewGateRef.current) previewGateRef.current = createPublicationPreviewGate()
  const repositoryValid = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.trim())
  const commitValid = /^[0-9a-fA-F]{40,64}$/.test(commitSha.trim())
  const localRepositoryValid = /^[A-Za-z0-9_.-]{1,100}$/.test(localRepositoryName.trim())
  const visibleApps = apps.filter((app) => {
    const needle = appQuery.trim().toLowerCase()
    return !needle || `${app.name || ''} ${app.slug || ''}`.toLowerCase().includes(needle)
  })

  function showPreview(app, result) {
    const nextDraft = listingDraftFromPreview(result, app)
    setPreview(result || null)
    setDraft(nextDraft)
    setDirty(false)
    setEditing(false)
    setConfirmed(false)
    if (result?.repository_name) setLocalRepositoryName(result.repository_name)
  }

  async function prepare(app) {
    const requestId = previewGateRef.current.begin()
    onNavigate?.()
    setCandidate(app)
    setConfirmed(false)
    setPreview(null)
    setPreviewError('')
    setSaveError('')
    setLocalRepositoryName(String(app.slug || app.name || 'mobius-app')
      .toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100))
    try {
      const result = await onPreviewLocal?.(app.id)
      if (!previewGateRef.current.isCurrent(requestId)) return
      showPreview(app, result)
    } catch (error) {
      if (!previewGateRef.current.isCurrent(requestId)) return
      setPreviewError(error instanceof Error ? error.message : 'This listing could not be prepared.')
    }
  }

  async function saveListing() {
    if (!candidate || !draft || saving) return
    const app = candidate
    const requestId = previewGateRef.current.begin()
    setSaving(true)
    setSaveError('')
    setConfirmed(false)
    try {
      await onSaveListing?.(app.id, listingPayload(draft))
      const result = await onPreviewLocal?.(app.id)
      if (!previewGateRef.current.isCurrent(requestId)) return
      showPreview(app, result)
    } catch (error) {
      if (!previewGateRef.current.isCurrent(requestId)) return
      setSaveError(error instanceof Error ? error.message : 'The listing could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  function closePreview({ force = false } = {}) {
    if (publishingId && !force) return
    previewGateRef.current.invalidate()
    onNavigate?.()
    setCandidate(null)
    setPreview(null)
    setPreviewError('')
    setConfirmed(false)
    setLocalRepositoryName('')
    setDraft(null)
    setSaveError('')
  }

  async function askAgent(problem, focus = '') {
    if (!candidate || askingAgent) return
    setAskingAgent(true)
    try {
      await onListingAgent?.(candidate, problem, focus)
    } finally {
      setAskingAgent(false)
    }
  }

  function askAgentForListing(focus) {
    const missing = (preview?.checklist || [])
      .filter((item) => !item.done && item.message)
      .map((item) => `${item.label}: ${item.message}`)
      .join(' ')
    askAgent(focus ? '' : missing, focus)
  }

  const listing = preview?.listing
  const renderApp = (app) => {
    const state = publicationStates[app.id]
    const label = publicationLabel(state, app.hosted_publication)
    return (
      <article className="st-publish-row" key={app.id}>
        <div className="st-publish-icon" aria-hidden="true">
          <span>{String(app.name || app.slug || '?').trim().slice(0, 1).toUpperCase()}</span>
          {app.icon_url ? (
            <img src={app.icon_url} alt="" width="48" height="48"
                 onError={(event) => { event.currentTarget.hidden = true }} />
          ) : null}
        </div>
        <div className="st-publish-row-copy"><h3>{app.name}</h3><span>{label}</span></div>
        <button type="button" className="st-btn st-btn-secondary"
                disabled={!!publishingId || !signedIn || !githubReady}
                onClick={() => prepare(app)}>
          {state?.status === 'live' ? 'Review update' : 'Prepare listing'}
        </button>
      </article>
    )
  }

  return (
    <div className={`st-publisher${candidate ? ' is-reviewing' : ''}`}>
      <section className="st-publish-heading">
        <div>
          <h2>Publish an app</h2>
          <p>Shape the public listing, check the exact source revision, then release when it is ready.</p>
          <ol className="st-publish-path" aria-label="Publishing steps">
            <li>Choose an app</li><li>Review its listing</li><li>Publish this version</li>
          </ol>
        </div>
        <div className="st-publish-heading-actions">
          {!signedIn ? (
            <button type="button" className="st-publish-connection st-publish-connection-action"
                    onClick={() => onLogInToMobiusYou?.()}>
              Log in to Möbius · You
            </button>
          ) : null}
          {signedIn && githubReady ? <span className="st-publish-account">Publishing as {githubLogin}</span> : null}
          {contributeAvailable ? (
            <button type="button" className="st-btn st-btn-ghost" onClick={() => onOpenContributions?.()}>
              Open contributions
            </button>
          ) : null}
        </div>
      </section>

      {publication ? (
        <div className="st-publish-result" role="status">
          <strong>{publication.name || 'Your app'} is {publication.status === 'live' ? 'live' : 'submitted'}</strong>
          <span>{publication.status === 'live' ? 'The exact release is now available in Browse.' : 'Checks are running.'}</span>
          {(publication.repository_url || publication.github?.url) ? (
            <a href={publication.repository_url || publication.github.url} target="_blank" rel="noopener noreferrer">Open source</a>
          ) : null}
        </div>
      ) : null}
      {publicationError ? <div className="st-notice is-warning" role="alert">{publicationError}</div> : null}
      {publicationStatesError ? (
        <div className="st-community-unavailable" role="status">
          <span>Live publishing status could not be refreshed.</span>
          <button type="button" className="st-btn st-btn-secondary" onClick={onRefreshPublicationStates}>Try again</button>
        </div>
      ) : null}
      {!signedIn ? (
        <div className="st-notice is-warning" role="status">
          <div className="st-notice-row">
            <span>{identityError
              ? 'Your Möbius · You identity is unavailable. Log in to publish.'
              : 'Log in to Möbius · You to publish an app.'}</span>
            <button type="button" className="st-btn st-btn-primary st-notice-action"
                    onClick={() => onLogInToMobiusYou?.()}>
              Log in to Möbius · You
            </button>
          </div>
        </div>
      ) : null}
      {signedIn && viewer?.error ? <div className="st-notice is-warning" role="alert">{viewer.error}</div> : null}
      {signedIn && viewer && !githubReady ? (
        <div className="st-publish-setup" role="status">
          <div><strong>Connect GitHub in Contribute</strong><span>The Store will inherit that connection without receiving your credential.</span></div>
          <button type="button" className="st-btn st-btn-secondary" onClick={onRefreshViewer}>Check again</button>
          {contributeAvailable ? <button type="button" className="st-btn st-btn-primary" onClick={() => onOpenContributions?.()}>Open Contribute</button> : null}
        </div>
      ) : null}

      {!candidate && spotlightFeed?.viewer?.can_edit ? (
        <SpotlightEditor
          catalog={catalog}
          feed={spotlightFeed}
          token={token}
          onUploadArtwork={onUploadSpotlightArtwork}
          onPublish={onPublishSpotlight}
        />
      ) : null}

      {candidate ? (
        <section className="st-listing-review" aria-label={`${candidate.name || 'App'} publishing review`}>
          <div className="st-listing-review-top">
            <button type="button" className="st-back-btn" onClick={closePreview} disabled={!!publishingId}>Back</button>
            <span>{preview ? (preview.ready ? 'Ready to publish' : 'Not ready yet') : 'Accepted source only'}</span>
          </div>
          {!preview && !previewError ? (
            <div className="st-listing-loading" role="status">Preparing {candidate.name}…</div>
          ) : previewError ? (
            <div className="st-listing-incomplete" role="alert">
              <FileUpload width="28" height="28" aria-hidden="true" />
              <div>
                <strong>This app isn’t ready to publish yet</strong>
                <span>{previewError}</span>
                {onListingAgent ? (
                  <button type="button" className="st-btn st-btn-primary st-listing-agent"
                          disabled={askingAgent} onClick={() => askAgent(previewError)}>
                    {askingAgent ? 'Opening agent…' : 'Get it ready with an agent'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : !preview.ready || editing ? (
            <div className="st-listing-work">
              <ListingChecklist checklist={preview.checklist || []} agentBusy={askingAgent}
                                onAgent={askAgentForListing} />
              {draft ? (
                <ListingEditor
                  key={`${candidate.id}:${preview.accepted_commit}`}
                  draft={draft}
                  setDraft={(change) => { setDirty(true); setDraft(change) }}
                  app={candidate}
                  detailsNeedAgent={(preview.checklist || []).some((item) => (
                    item.id === 'details' && !item.done && item.automatic === false
                  ))}
                  saving={saving}
                  saveError={saveError}
                  dirty={dirty}
                  onPrepareImage={onPrepareImage}
                  onSave={saveListing}
                />
              ) : null}
              {preview.ready ? (
                <button type="button" className="st-btn st-btn-secondary st-listing-agent"
                        disabled={saving} onClick={() => setEditing(false)}>
                  Back to publishing
                </button>
              ) : null}
            </div>
          ) : (
            <div className="st-listing-ready-layout">
              <div className="st-listing-hero">
                {listing?.hero?.path ? <img src={assetUrl(preview, listing.hero.path)} alt="" /> : null}
                <div className="st-listing-hero-shade" />
                <div className="st-listing-hero-copy">
                  <img src={preview.icon_url} alt="" width="64" height="64" />
                  <h3 id="st-listing-review-title">{preview.name}</h3>
                  <p>{listing?.tagline}</p>
                </div>
              </div>
              <aside className="st-listing-release-panel" aria-label="Release decision">
                <div className="st-listing-release-copy">
                  <h3>Publish this version</h3>
                  <p>The accepted source and this listing become public together. Later edits stay private until you publish again.</p>
                </div>
                <label className="st-publish-field">
                  <span>Public repository</span>
                  <div className="st-publisher-repository-name">
                    <span aria-hidden="true">{githubLogin}/</span>
                    <input value={localRepositoryName} autoCapitalize="none" autoCorrect="off"
                           onChange={(event) => setLocalRepositoryName(event.target.value)} disabled={!!publishingId} />
                  </div>
                </label>
                <label className="st-publish-consent">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  <span>I’ve reviewed this listing and want this exact source revision to become public.</span>
                </label>
                <button type="button" className="st-btn st-btn-primary"
                        disabled={!confirmed || !localRepositoryValid || !!publishingId || !signedIn || !githubReady}
                        onClick={async () => {
                          const ok = await onPublishLocal?.(candidate.id, localRepositoryName.trim())
                          if (ok) closePreview({ force: true })
                        }}>
                  {publishingId === candidate.id ? 'Publishing…' : 'Publish app'}
                </button>
                <div className="st-listing-revise">
                  <button type="button" className="st-btn st-btn-secondary"
                          disabled={!!publishingId} onClick={() => { setConfirmed(false); setEditing(true) }}>
                    Edit listing
                  </button>
                  {onListingAgent ? (
                    <button type="button" className="st-btn st-btn-ghost"
                            disabled={askingAgent || !!publishingId} onClick={() => askAgent('')}>
                      {askingAgent ? 'Starting agent…' : 'Revise with an agent'}
                    </button>
                  ) : null}
                </div>
              </aside>
              <div className="st-listing-body">
                <p>{listing?.description}</p>
                <div className="st-listing-gallery" aria-label="App screenshots">
                  {(listing?.screenshots || []).map((shot) => (
                    <figure key={shot.src}>
                      <img src={assetUrl(preview, shot.src)} alt={shot.alt} />
                      {shot.label ? <figcaption>{shot.label}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="st-publish-list-head">
            <div><h3>Choose an app</h3><p>{apps.length} local {apps.length === 1 ? 'app' : 'apps'} can be prepared for publishing.</p></div>
            <label className="st-publish-search">
              <span className="st-sr-only">Search your apps</span>
              <Search width="17" height="17" aria-hidden="true" />
              <input value={appQuery} onChange={(event) => setAppQuery(event.target.value)} placeholder="Search apps" />
            </label>
          </div>
          <div className="st-publish-list" aria-label="Apps ready to publish">
            {visibleApps.length ? visibleApps.map(renderApp) : apps.length ? (
              <div className="st-empty"><div className="st-empty-title">No matching apps</div><p className="st-empty-text">Try another name.</p></div>
            ) : (
              <div className="st-empty"><div className="st-empty-title">No local apps yet</div><p className="st-empty-text">Build an app, then return here to publish it.</p></div>
            )}
          </div>
        </>
      )}

      {!candidate ? (
        <details className="st-publish-advanced">
          <summary><span>Already on GitHub?</span><small>List one exact commit</small></summary>
          <section className="st-publish-review" aria-labelledby="st-register-release-title">
            <div><h3 id="st-register-release-title">List a GitHub release</h3><p>Choose a public repository with <code>mobius.json</code> at its root and an exact commit. Möbius adds a proof without moving your main branch.</p></div>
            <div className="st-publish-repository-grid">
              <label className="st-publish-field"><span>Repository</span><input value={repository} placeholder="owner/repository" autoCapitalize="none" autoCorrect="off" onChange={(event) => setRepository(event.target.value)} disabled={!!publishingId} /></label>
              <label className="st-publish-field"><span>Exact commit</span><input value={commitSha} placeholder="40-character Git commit" autoCapitalize="none" autoCorrect="off" onChange={(event) => setCommitSha(event.target.value)} disabled={!!publishingId} /></label>
            </div>
            <div className="st-publish-review-actions">
              <button type="button" className="st-btn st-btn-primary" disabled={!signedIn || !githubReady || !repositoryValid || !commitValid || !!publishingId}
                      onClick={async () => {
                        const ok = await onRegisterRepository({ repository: repository.trim(), commitSha: commitSha.trim().toLowerCase(), publicIdentity: 'github' })
                        if (ok) { setRepository(''); setCommitSha('') }
                      }}>
                {publishingId === 'github-release' ? 'Creating proof…' : 'Create proof & list'}
              </button>
            </div>
          </section>
        </details>
      ) : null}
    </div>
  )
}
