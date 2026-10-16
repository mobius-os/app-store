/* PublishCheck shows the creator-run agent check for the exact revision being
   published. The agent writes its verdict into the Store's own storage; this
   panel only reads it. The verdict is advice from the owner's own agent, not a
   Store review: it never blocks publishing on its own. */
import { Check, X } from '@openai/apps-sdk-ui/components/Icon'
import React from 'react'

const HEADLINES = {
  ready: 'Your agent found nothing that needs fixing',
  running: 'Your agent is checking the app…',
  error: 'The agent check didn’t finish',
  stale: 'The app changed since the last check',
  unavailable: 'Agent checks aren’t available on this Möbius',
  none: 'Check the app before publishing',
}

const DETAILS = {
  running: 'This usually takes a minute or two. You can keep working.',
  error: 'No result arrived for this version. Your agent may have stopped or hit a problem.',
  unavailable: 'Update Möbius to ask your agent for a check. You can still publish.',
}

export function PublishCheck({ state, check, busy, onRun, onFix, onStop }) {
  const issues = check?.issues || []
  const mustFixCount = check?.must_fix_count || 0
  const mustFix = issues.filter((issue) => issue.severity === 'must_fix')
  const current = state === 'ready' || state === 'must_fix'
  const headline = state === 'must_fix'
    ? `Your agent flagged ${mustFixCount} ${mustFixCount === 1 ? 'thing' : 'things'} to fix`
    : HEADLINES[state] || HEADLINES.none
  const detail = DETAILS[state] || (current
    ? 'This is an AI opinion from your own agent after reading the code and listing. It is not a Store review or a guarantee.'
    : 'Your agent reads the code and listing and points out anything users should know. Its answer is an AI opinion, not a Store review.')

  return (
    <div className={`st-check is-${state}`} aria-live="polite">
      <div className="st-check-head">
        <span className="st-check-mark" aria-hidden="true">
          {state === 'ready' ? <Check width="14" height="14" /> : state === 'must_fix' || state === 'error' ? <X width="14" height="14" /> : null}
        </span>
        <div>
          <strong>{headline}</strong>
          <span>{detail}</span>
        </div>
      </div>

      {current && issues.length ? (
        <ul className="st-check-issues">
          {issues.map((issue, index) => (
            <li key={`${issue.title}:${index}`} className={issue.severity === 'must_fix' ? 'is-must' : ''}>
              {issue.detail ? (
                <details>
                  <summary>{issue.title}</summary>
                  <span>{issue.detail}</span>
                </details>
              ) : <strong>{issue.title}</strong>}
            </li>
          ))}
        </ul>
      ) : null}

      {state === 'running' && onStop ? (
        <div className="st-check-actions">
          <button type="button" className="st-btn st-btn-ghost" onClick={onStop}>Stop waiting</button>
        </div>
      ) : null}
      {state !== 'running' && state !== 'unavailable' ? (
        <div className="st-check-actions">
          {state === 'must_fix' ? (
            <button type="button" className="st-btn st-btn-primary" disabled={busy}
                    onClick={() => onFix(mustFix)}>
              {busy ? 'Opening agent…' : 'Fix with agent'}
            </button>
          ) : null}
          <button type="button" className={`st-btn ${current ? 'st-btn-ghost' : 'st-btn-secondary'}`}
                  disabled={busy} onClick={onRun}>
            {busy && state !== 'must_fix' ? 'Starting…' : current || state === 'error' ? 'Check again' : 'Check with agent'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
