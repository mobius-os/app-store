import { FileUpload } from '@openai/apps-sdk-ui/components/Icon'
import React, { useState } from 'react'

function publishableApps(installed) {
  return (installed || []).filter((app) => (
    app?.source_dir
    && app?.slug !== 'app-store'
    && (!app?.manifest_url || app?.hosted_publication)
  ))
}

function publicationLabel(state, hosted) {
  if (hosted?.has_unpublished_changes) return 'Draft changes'
  if (!state) return hosted ? 'Hosted snapshot live' : 'Not listed'
  if (state.status === 'live') return 'Live'
  if (state.status === 'rejected' || state.status === 'failed') return 'Needs attention'
  if (state.status === 'checking') return 'Checks running'
  return 'Pending review'
}

export function PublisherTab({
  installed,
  identity,
  identityError,
  viewer,
  onRefreshViewer,
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
}) {
  const apps = publishableApps(installed)
  const identityReady = !!identity && !identityError
  const signedIn = identityReady && !!identity?.linked
  const githubReady = viewer?.github?.connected === true
  const githubLogin = String(viewer?.github?.login || '')
  const [candidate, setCandidate] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [localRepositoryName, setLocalRepositoryName] = useState('')
  const [repository, setRepository] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [manifestPath, setManifestPath] = useState('mobius.json')
  const repositoryValid = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.trim())
  const commitValid = /^[0-9a-fA-F]{40,64}$/.test(commitSha.trim())
  const localRepositoryValid = /^[A-Za-z0-9_.-]{1,100}$/.test(localRepositoryName.trim())
  return (
    <div className="st-publisher">
      <section className="st-publisher-intro">
        <div>
          <h2>Share an app</h2>
          <p>
            Every app stays in its owner’s GitHub repository. Möbius verifies one exact release,
            indexes its listing for fast discovery, and keeps updates, remixes, and contributions
            connected to the original source.
          </p>
        </div>
        <div className="st-publisher-identities">
          <div className={`st-publisher-identity${signedIn ? ' is-linked' : ''}`}>
            <span className="st-publisher-identity-dot" aria-hidden="true" />
            {identityError
              ? 'Identity check unavailable'
              : !identityReady ? 'Checking your publishing identity…'
              : signedIn ? 'Möbius identity linked' : 'Link a Möbius identity to publish'}
          </div>
          {signedIn && (
            <div className={`st-publisher-identity${githubReady ? ' is-linked' : ''}`}>
              <span className="st-publisher-identity-dot" aria-hidden="true" />
              {viewer === null
                ? 'Checking your GitHub connection…'
                : githubReady ? `GitHub @${githubLogin} · inherited from Contribute` : 'Connect GitHub in Contribute'}
            </div>
          )}
        </div>
        {contributeAvailable && (
          <button type="button" className="st-btn st-btn-secondary st-publisher-contributions"
                  onClick={onOpenContributions}>
            Review contributions
          </button>
        )}
      </section>

      {publication && (
        <div className="st-publish-result" role="status">
          <strong>{publication.name || 'Your app'} is {publication.status === 'live' ? 'live' : 'submitted'}</strong>
          <span>{publication.status === 'rejected' || publication.status === 'failed'
            ? publication.message || 'The checks need attention before this listing can go live.'
            : publication.status === 'live'
              ? 'Its source and release metadata are now available in Browse.'
              : 'It will appear in Browse as soon as the automated checks finish.'}</span>
          {publication.distribution?.sha256 && (
            <span>Verified build cached · {publication.distribution.sha256.slice(0, 12)}</span>
          )}
          {(publication.repository_url || publication.github?.url) && (
            <a href={publication.repository_url || publication.github.url} target="_blank" rel="noopener noreferrer">
              Open source on GitHub
            </a>
          )}
        </div>
      )}
      {publicationError && <div className="st-notice is-warning" role="alert">{publicationError}</div>}
      {publicationStatesError && (
        <div className="st-community-unavailable" role="status">
          <span>Last-known publishing states are shown; Host status could not be refreshed.</span>
          <button type="button" className="st-btn st-btn-secondary" onClick={onRefreshPublicationStates}>Try again</button>
        </div>
      )}
      {!signedIn && identityReady && (
        <div className="st-notice is-warning" role="status">
          Publishing stays unavailable until an identity is linked, so every listing has an accountable creator.
        </div>
      )}
      {signedIn && viewer?.error && (
        <div className="st-notice is-warning" role="alert">{viewer.error}</div>
      )}
      {signedIn && viewer && !githubReady && (
        <div className="st-notice is-warning st-publisher-github-setup" role="status">
          <div>
            <strong>Connect GitHub once in Contribute</strong>
            <span>
              App Store inherits that local connection. Your credential stays inside this Möbius and is
              never copied to the Store Host.
            </span>
          </div>
          <div className="st-publish-review-actions">
            <button type="button" className="st-btn st-btn-secondary" onClick={onRefreshViewer}>
              Check connection
            </button>
            {contributeAvailable && (
              <button type="button" className="st-btn st-btn-primary" onClick={onOpenContributions}>
                Open Contribute
              </button>
            )}
          </div>
        </div>
      )}

      <details className="st-publish-advanced">
        <summary>
          <span>Already on GitHub?</span>
          <small>List an exact repository commit</small>
        </summary>
      <section className="st-publish-review" aria-labelledby="st-register-release-title">
        <div>
          <h3 id="st-register-release-title">List a GitHub release</h3>
          <p>
            Choose an exact public revision. Möbius adds a content-identical proof commit on a
            dedicated release branch, then the Host verifies and preserves that immutable source.
            Your main branch is never moved.
          </p>
        </div>
        <div className="st-publish-repository-grid">
          <label className="st-remix-field">
            <span>Repository</span>
            <input value={repository} placeholder="owner/repository" autoCapitalize="none" autoCorrect="off"
                   onChange={(event) => setRepository(event.target.value)} disabled={!!publishingId} />
          </label>
          <label className="st-remix-field">
            <span>Exact commit</span>
            <input value={commitSha} placeholder="40-character Git commit" autoCapitalize="none" autoCorrect="off"
                   onChange={(event) => setCommitSha(event.target.value)} disabled={!!publishingId} />
          </label>
          <label className="st-remix-field">
            <span>Manifest path</span>
            <input value={manifestPath} placeholder="mobius.json" autoCapitalize="none" autoCorrect="off"
                   onChange={(event) => setManifestPath(event.target.value)} disabled={!!publishingId} />
          </label>
        </div>
        <div className="st-publish-review-actions">
          <span className="st-publish-source-note">Creates a public proof branch; never rewrites your selected commit or main branch.</span>
          <button type="button" className="st-btn st-btn-primary"
                  disabled={!signedIn || !githubReady || !repositoryValid || !commitValid || !manifestPath.trim() || !!publishingId}
                  onClick={async () => {
                    const ok = await onRegisterRepository({
                      repository: repository.trim(),
                      commitSha: commitSha.trim().toLowerCase(),
                      manifestPath: manifestPath.trim(),
                      publicIdentity: 'github',
                    })
                    if (ok) { setRepository(''); setCommitSha(''); setManifestPath('mobius.json') }
                  }}>
            {publishingId === 'github-release' ? 'Publishing proof…' : 'Create proof & list'}
          </button>
        </div>
      </section>
      </details>

      {candidate && (
        <section className="st-publish-review" aria-labelledby="st-publish-review-title">
          <div>
            <h3 id="st-publish-review-title">
              {candidate.hosted_publication || publicationStates[candidate.id]?.status === 'live'
                ? `Publish the latest ${candidate.name}?`
                : `Publish ${candidate.name} publicly?`}
            </h3>
            <p>
              Möbius will publish the exact accepted app revision to a public GitHub repository,
              then list that immutable revision in the Store. Draft edits are excluded and your
              GitHub credential stays inside this Möbius.
            </p>
          </div>
          <label className="st-remix-field">
            <span>Public GitHub repository</span>
            <div className="st-publisher-repository-name">
              <span aria-hidden="true">{githubLogin}/</span>
              <input
                value={localRepositoryName}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(event) => setLocalRepositoryName(event.target.value)}
                disabled={!!publishingId}
              />
            </div>
          </label>
          <label className="st-publish-consent">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I want this accepted source revision to become public. Möbius may create this
              repository or fast-forward its existing Möbius-managed main branch.
            </span>
          </label>
          <div className="st-publish-review-actions">
            <button type="button" className="st-btn st-btn-secondary" onClick={() => { setCandidate(null); setConfirmed(false); setLocalRepositoryName('') }} disabled={!!publishingId}>
              Cancel
            </button>
            <button
              type="button"
              className="st-btn st-btn-primary"
              disabled={!confirmed || !localRepositoryValid || !!publishingId || !signedIn || !githubReady}
              onClick={async () => {
                const ok = await onPublishLocal?.(candidate.id, localRepositoryName.trim())
                if (ok) {
                  setCandidate(null)
                  setConfirmed(false)
                  setLocalRepositoryName('')
                }
              }}
            >
              {publishingId === candidate.id ? 'Publishing…' : 'Publish app'}
            </button>
          </div>
        </section>
      )}

      <div className="st-publish-list-head">
        <div>
          <h3>Your local apps</h3>
          <p>Choose one accepted version to publish or update.</p>
        </div>
        <span>{apps.length} {apps.length === 1 ? 'app' : 'apps'}</span>
      </div>
      <div className="st-publish-list" aria-label="Apps ready to publish">
        {apps.length ? apps.map((app) => {
          const state = publicationStates[app.id]
          const label = publicationLabel(state, app.hosted_publication)
          return <article className="st-publish-row" key={app.id}>
            <div className="st-publish-icon" aria-hidden="true">
              <span>{String(app.name || app.slug || '?').trim().slice(0, 1).toUpperCase()}</span>
              <img
                src={`/api/apps/${app.id}/icon?size=96`}
                alt=""
                width="48"
                height="48"
                onError={(event) => { event.currentTarget.hidden = true }}
              />
            </div>
            <div className="st-publish-row-copy">
              <h3>{app.name}</h3>
              <p>{app.description || 'A Möbius app ready to share.'}</p>
              <span>Local source · prepare a distributed repository · {label}</span>
              {state?.message && <span className="st-publish-row-message">{state.message}</span>}
            </div>
            <button
              type="button"
              className="st-btn st-btn-primary"
              disabled={!!publishingId || !signedIn || !githubReady}
              onClick={() => {
                setCandidate(app)
                setConfirmed(false)
                setLocalRepositoryName(String(app.slug || app.name || 'mobius-app')
                  .toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100))
              }}
            >
              {state?.status === 'live' || app.hosted_publication ? 'Publish update' : 'Publish'}
            </button>
          </article>
        }) : (
          <div className="st-empty">
            <div className="st-empty-title">No local apps are ready yet</div>
            <p className="st-empty-text">Build an app with a versioned source tree, then return here.</p>
          </div>
        )}
      </div>

    </div>
  )
}
