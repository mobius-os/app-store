import React, { useState } from 'react'

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

export function CommunityFeedback({ community, canReview = false, onRate, onComment, busy, error }) {
  const [rating, setRating] = useState(community.user_rating || 0)
  const [draft, setDraft] = useState('')
  if (!community?.id || !community?.revision_id) return null
  const average = community.rating_average > 0 ? community.rating_average.toFixed(1) : 'New'
  return (
    <section className="st-community-feedback" aria-labelledby="st-community-feedback-title">
      <div className="st-community-feedback-head">
        <div>
          <h3 id="st-community-feedback-title">Community reviews</h3>
          <p>Ratings stay tied to real Möbius identities and the version you used.</p>
        </div>
        <div className="st-rating-summary" aria-label={`${average} from ${community.rating_count} ratings`}>
          <strong>{average}</strong>
          <span>{community.rating_count} {community.rating_count === 1 ? 'rating' : 'ratings'}</span>
        </div>
      </div>

      {!canReview && (
        <div className="st-review-eligibility">Verified reviews unlock after Möbius confirms your identity and use of this exact version.</div>
      )}
      <div className="st-rating-picker" role="group" aria-label="Rate this app">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
            aria-pressed={rating === value}
            disabled={busy || !canReview}
            onClick={async () => {
              if (await onRate(value)) setRating(value)
            }}
          >
            <StarIcon filled={value <= rating} />
          </button>
        ))}
        <span>{rating ? 'Your rating' : 'Rate this version'}</span>
      </div>

      {canReview && <form
        className="st-review-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!draft.trim()) return
          if (await onComment(draft.trim())) setDraft('')
        }}
      >
        <label htmlFor="st-review-draft">Write a review</label>
        <textarea
          id="st-review-draft"
          value={draft}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What worked well? What should the creator improve?"
          disabled={busy}
        />
        <button type="submit" className="st-btn st-btn-secondary" disabled={busy || !draft.trim()}>
          {busy ? 'Posting…' : 'Post review'}
        </button>
      </form>}
      {error && <div className="st-community-feedback-error" role="alert">{error}</div>}

      {community.comments.length > 0 && (
        <div className="st-review-list">
          {community.comments.slice(0, 6).map((comment, index) => (
            <article key={comment.id || index}>
              <strong>{comment.author?.handle || comment.author_handle || 'Möbius user'}</strong>
              <p>{comment.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
