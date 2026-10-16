/* PublishedApps is the creator's view of apps they have already published:
   one simple list, then one page per app with its numbers and reviews. */
import { ChevronLeft, ChevronRight } from '@openai/apps-sdk-ui/components/Icon'
import React, { useEffect, useState } from 'react'
import { formatCount, publishedStatusLine } from '../domain.js'
import { StarIcon } from './CommunityFeedback.jsx'

function AppIcon({ app, size = 48 }) {
  return (
    <div className="st-publish-icon" aria-hidden="true" style={{ width: size, height: size }}>
      <span>{String(app?.name || app?.slug || '?').trim().slice(0, 1).toUpperCase()}</span>
      {app?.icon_url ? (
        <img src={app.icon_url} alt="" width={size} height={size}
             onError={(event) => { event.currentTarget.hidden = true }} />
      ) : null}
    </div>
  )
}

function StatusLine({ state, hosted }) {
  const line = publishedStatusLine(state, hosted)
  return <span className={`st-mine-status${line.tone ? ` is-${line.tone}` : ''}`}>{line.text}</span>
}

function Stars({ value }) {
  const stars = Math.max(0, Math.min(5, Math.round(Number(value) || 0)))
  return (
    <span className="st-mine-stars" role="img" aria-label={`${stars} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => <StarIcon key={value} filled={value <= stars} />)}
    </span>
  )
}

// A rating from the public listing: a value, "…" while loading, or an honest
// "Unavailable" when the listing could not be read.
function ratingText(state) {
  if (state?.listing === 'loading') return '…'
  if (state?.listing === 'unavailable') return 'Unavailable'
  return state?.stats?.rating_average ?? '–'
}

function RatingCount({ count }) {
  if (!Number.isInteger(count)) return null
  return <span>{formatCount(count)} {count === 1 ? 'rating' : 'ratings'}</span>
}

export function YourAppsList({ entries, onOpen }) {
  return (
    <ul className="st-mine-list" aria-label="Your published apps">
      {entries.map(({ app, state }) => (
        <li key={app.id}>
          <button type="button" className="st-mine-row" onClick={() => onOpen(app)}>
            <AppIcon app={app} />
            <span className="st-mine-copy">
              <strong>{app.name}</strong>
              <StatusLine state={state} hosted={app.hosted_publication} />
            </span>
            {state?.status === 'live' ? (
              <>
                <span className="st-mine-num"><b>{formatCount(state.stats?.installs)}</b><small>Installs</small></span>
                <span className="st-mine-num"><b>{ratingText(state)}</b><small>Average Rating</small></span>
              </>
            ) : (
              <span className="st-mine-num is-wide"><small>Stats appear while the app is live</small></span>
            )}
            <ChevronRight width="16" height="16" aria-hidden="true" className="st-mine-chevron" />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function PublishedAppPage({
  app, state, onBack, onPublishUpdate, publishDisabled, onLoadReviews, onViewInStore,
}) {
  const stats = state?.stats
  const live = state?.status === 'live'
  const listingUnavailable = state?.listing === 'unavailable'
  const communityId = state?.community_app_id || ''
  const publishedDate = state?.published_at ? new Date(state.published_at) : null
  const dateKnown = publishedDate && Number.isFinite(publishedDate.getTime())
  const [reviews, setReviews] = useState(null)
  const [reviewsError, setReviewsError] = useState('')
  const [hasMoreReviews, setHasMoreReviews] = useState(false)
  useEffect(() => {
    let cancelled = false
    setReviews(null)
    setReviewsError('')
    setHasMoreReviews(false)
    if (!communityId) { setReviews([]); return undefined }
    onLoadReviews(communityId).then((payload) => {
      if (cancelled) return
      const items = Array.isArray(payload?.items) ? payload.items : []
      setReviews(items)
      setHasMoreReviews(payload?.next_offset != null)
    }).catch((error) => {
      if (!cancelled) setReviewsError(error?.message || 'Reviews could not be loaded.')
    })
    return () => { cancelled = true }
  }, [communityId, onLoadReviews])

  const written = (reviews || []).filter((review) => review.review_text)

  return (
    <section className="st-mine-page" aria-label={app.name}>
      <button type="button" className="st-back-btn" onClick={onBack}>
        <ChevronLeft width="16" height="16" aria-hidden="true" />Your apps
      </button>
      <header className="st-mine-head">
        <AppIcon app={app} size={64} />
        <div className="st-mine-title">
          <h2>{app.name}</h2>
          <StatusLine state={state} hosted={app.hosted_publication} />
        </div>
        {communityId && state?.status === 'live' && onViewInStore ? (
          <button type="button" className="st-btn st-btn-secondary" onClick={() => onViewInStore(communityId)}>View in Store</button>
        ) : null}
        <button type="button" className="st-btn st-btn-primary" disabled={publishDisabled}
                onClick={onPublishUpdate}>
          Publish update
        </button>
      </header>

      <dl className="st-mine-release">
        <div><dt>Published version</dt><dd>{state?.published_version || (state?.listing === 'loading' ? 'Loading…' : 'Not available')}</dd></div>
        <div><dt>Last published</dt><dd>{dateKnown ? <time dateTime={publishedDate.toISOString()} title={publishedDate.toLocaleString('en')}>{publishedDate.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</time> : 'Not available'}</dd></div>
      </dl>
      {listingUnavailable ? (
        <p className="st-mine-status is-warning" role="status">The public listing couldn’t be read right now, so ratings and release details are unavailable.</p>
      ) : null}
      {live ? (
        <div className="st-mine-numbers">
          <div><b>{formatCount(stats?.installs)}</b><span>installs</span></div>
          <div><b>{ratingText(state)}</b><span>average rating</span><RatingCount count={stats?.rating_count} /></div>
          <div><b>{formatCount(stats?.review_count ?? (reviews && !hasMoreReviews ? written.length : null))}</b><span>written reviews</span></div>
        </div>
      ) : (
        <p className="st-mine-status">Installs and ratings appear while the app is live.</p>
      )}

      <h3 className="st-mine-section">Written reviews</h3>
      {hasMoreReviews ? <p className="st-mine-status">Showing the latest reviews, not the full total.</p> : null}
      <div className="st-mine-reviews">
        {reviewsError ? (
          <div className="st-mine-empty" role="alert">{reviewsError}</div>
        ) : reviews === null ? (
          <div className="st-mine-empty" role="status">Loading reviews…</div>
        ) : !written.length ? (
          <div className="st-mine-empty">{hasMoreReviews ? 'No written reviews on this page.' : 'No written reviews yet. Star ratings count toward the average even without a written review.'}</div>
        ) : written.map((review) => (
          <article className="st-mine-review" key={review.id}>
            <div className="st-mine-review-top">
              <strong>{review.author_handle || 'Möbius user'}</strong>
              <Stars value={review.stars} />
            </div>
            <p>{review.review_text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
