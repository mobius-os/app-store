/* PublishCheck shows the creator-run agent check for the exact revision being
   published. The agent writes its verdict into the Store's own storage; this
   panel only reads it. */
import { Check, X } from '@openai/apps-sdk-ui/components/Icon'
import React from 'react'

export function PublishCheck({ state, check, busy, onRun, onFix }) {
  const issues = check?.issues || []
  const mustFix = issues.filter((issue) => issue.severity === 'must_fix')
  const suggestions = issues.filter((issue) => issue.severity === 'suggestion')
  const current = state === 'ready' || state === 'must_fix'

  return (
    <div className={`st-check is-${state}`} aria-live="polite">
      <div className="st-check-head">
        <span className="st-check-mark" aria-hidden="true">
          {state === 'ready' ? <Check width="14" height="14" /> : state === 'must_fix' ? <X width="14" height="14" /> : null}
        </span>
        <div>
          <strong>
            {state === 'ready' ? 'Agent check passed'
              : state === 'must_fix' ? `Fix ${mustFix.length} ${mustFix.length === 1 ? 'thing' : 'things'} before publishing`
                : state === 'running' ? 'Your agent is checking the app…'
                  : state === 'stale' ? 'The app changed since the last check'
                    : 'Check the app before publishing'}
          </strong>
          <span>
            {state === 'running' ? 'This usually takes a minute or two. You can keep working.'
              : current ? 'Your own agent read the code and listing.'
                : 'Your agent reads the code and listing and points out anything users should know.'}
          </span>
        </div>
      </div>

      {current && issues.length ? (
        <ul className="st-check-issues">
          {[...mustFix, ...suggestions].map((issue, index) => (
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

      <div className="st-check-actions">
        {state === 'must_fix' ? (
          <button type="button" className="st-btn st-btn-primary" disabled={busy}
                  onClick={() => onFix(mustFix)}>
            {busy ? 'Opening agent…' : 'Fix with agent'}
          </button>
        ) : null}
        {state !== 'running' ? (
          <button type="button" className={`st-btn ${current ? 'st-btn-ghost' : 'st-btn-secondary'}`}
                  disabled={busy} onClick={onRun}>
            {busy && state !== 'must_fix' ? 'Starting…' : current ? 'Check again' : 'Check with agent'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
