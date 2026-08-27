import { Check } from '@openai/apps-sdk-ui/components/Icon'

function UpdateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path d="M12 19V5m0 0-5 5m5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function checkedLabel(updateChecks) {
  const times = Object.values(updateChecks || {})
    .map((check) => check?.checkedAt)
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
  if (!times.length) return 'Update status is still being checked'
  const ageSeconds = Math.max(0, Math.round((Date.now() - Math.max(...times)) / 1000))
  if (ageSeconds < 60) return 'Checked just now'
  const minutes = Math.round(ageSeconds / 60)
  if (minutes < 60) return `Checked ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  return 'Checked earlier today'
}

export function LibraryHealth({ installedCount, updateCount, attentionCount, updateChecks, onReviewUpdates, busy }) {
  const healthy = updateCount === 0 && attentionCount === 0
  const title = healthy
    ? `${installedCount} ${installedCount === 1 ? 'app' : 'apps'} up to date`
    : updateCount > 0
      ? `${updateCount} ${updateCount === 1 ? 'update' : 'updates'} ready to review`
      : `${attentionCount} ${attentionCount === 1 ? 'app needs' : 'apps need'} attention`
  const detail = healthy
    ? checkedLabel(updateChecks)
    : attentionCount > 0
      ? `${attentionCount} ${attentionCount === 1 ? 'update needs' : 'updates need'} an individual look before anything changes.`
      : 'You will see every change before choosing what to apply.'

  return (
    <section className={`st-library-health${healthy ? ' is-healthy' : ''}`} aria-labelledby="st-library-health-title">
      <div className="st-library-health-mark" aria-hidden="true">
        {healthy ? <Check width="1em" height="1em" /> : <UpdateIcon />}
      </div>
      <div className="st-library-health-copy">
        <h2 id="st-library-health-title">{title}</h2>
        <p>{detail}</p>
      </div>
      {updateCount > 0 && (
        <button type="button" className="st-btn st-btn-primary" onClick={onReviewUpdates} disabled={busy}>
          Review updates
        </button>
      )}
    </section>
  )
}
