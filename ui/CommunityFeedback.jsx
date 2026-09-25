import React, { useEffect, useState } from 'react'

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 2.8 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9L12 2.8Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CommunityFeedback({ feedback, canRate = false, onSubmitFeedback, busy, error }) {
  const [rating, setRating] = useState(feedback?.user_review?.stars || 0)
  const [draft, setDraft] = useState(feedback?.user_review?.review_text || '')
  useEffect(() => {
    setRating(feedback?.user_review?.stars || 0)
  }, [feedback?.user_review?.stars])
  useEffect(() => {
    setDraft(feedback?.user_review?.review_text || '')
  }, [feedback?.user_review?.review_text])
  if (!feedback?.id || !feedback?.revision_id) return null
  const reviews = Array.isArray(feedback.reviews) ? feedback.reviews : []
  const average = feedback.rating_average > 0 ? feedback.rating_average.toFixed(1) : '—'
  return (
    <section className="st-community-feedback" aria-labelledby="st-community-feedback-title">
      <div className="st-community-feedback-head">
        <div>
          <h3 id="st-community-feedback-title">Ratings &amp; reviews</h3>
          <p>Rate with your mobius.you account after installing this app. Written reviews are optional.</p>
        </div>
        <div className="st-rating-summary" aria-label={`${average} from ${feedback.rating_count} ratings`}>
          <strong>{average}</strong>
          <span>{feedback.rating_count} {feedback.rating_count === 1 ? 'rating' : 'ratings'}</span>
        </div>
      </div>

      {!canRate ? (
        <div className="st-review-eligibility">
          {feedback.review_eligibility === 'handle_required'
            ? 'Choose a mobius.you handle to rate or review this app.'
            : feedback.review_eligibility === 'install_required'
              ? 'Install this app to leave verified feedback.'
              : 'Sign in to mobius.you to rate or review this app.'}
        </div>
      ) : null}
      <form
        className="st-review-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!canRate || !rating || busy) return
          const body = draft.trim()
          if (await onSubmitFeedback?.(rating, body || null)) setDraft(body)
        }}
      >
        <div className="st-rating-picker" role="group" aria-label="Rate this app">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              key={value}
              aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
              aria-pressed={rating === value}
              disabled={busy || !canRate}
              onClick={() => setRating(value)}
            >
              <StarIcon filled={value <= rating} />
            </button>
          ))}
          <span>{rating ? 'Your rating' : feedback.rating_count ? 'Add your rating' : 'Not rated yet'}</span>
        </div>
        {canRate ? <>
          <label htmlFor="st-review-draft">Add a written review (optional)</label>
          <textarea
            id="st-review-draft"
            value={draft}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What was useful? What should improve?"
            disabled={busy}
          />
          <button type="submit" className="st-btn st-btn-secondary" disabled={busy || !rating}>
            {busy ? 'Saving…' : feedback.user_review ? 'Update' : 'Post'}
          </button>
        </> : null}
      </form>
      {error ? <div className="st-community-feedback-error" role="alert">{error}</div> : null}

      {feedback.reviews_error ? (
        <p className="st-review-empty" role="alert">{feedback.reviews_error}</p>
      ) : !feedback.reviews_loaded ? (
        <p className="st-review-empty">Loading ratings &amp; reviews…</p>
      ) : reviews.length ? (
        <div className="st-review-list">
          {reviews.slice(0, 6).map((review, index) => (
            <article key={review.id || index}>
              <strong>@{review.author_handle || 'mobius-user'} · {review.stars}/5</strong>
              {review.review_text ? <p>{review.review_text}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="st-review-empty">No public feedback entries to show.</p>
      )}
    </section>
  )
}
