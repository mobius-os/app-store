import { useEffect, useState } from 'react'
import { STORE_SELF } from '../constants.js'
import { fetchUpdateCheck, installApp, loadUpdateCandidatePreview } from '../api.js'
import { capabilityDiffNeedsReview } from '../domain.js'
import { CapabilityContract } from './CapabilityContract.jsx'
import { IconBox, installedIconUrl } from './IconBox.jsx'

// Self-update banner. The store is bootstrapped separately from its catalog
// grid, so it checks for its OWN updates here: preview the published candidate
// commit, compare it with this app's recorded upstream source, and install that
// exact commit. The version remains a human label only. Renders null when
// current or verification is unavailable.
export function SelfUpdateBanner({ appId, app, token }) {
  const [review, setReview] = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [updateCheck, setUpdateCheck] = useState(null)
  const [phase, setPhase] = useState('idle')   // idle | updating | done | conflict | error
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    loadUpdateCandidatePreview(appId, STORE_SELF.manifest_url, token)
      .then(candidate => {
        if (!cancelled) {
          setReview({
            status: 'ready', preview: candidate.capability_preview, candidate, error: '',
          })
        }
      })
      .catch(() => {})   // a failed self-check is silent — never block the grid
    fetchUpdateCheck(appId, token, STORE_SELF.manifest_url)
      .then(check => { if (!cancelled) setUpdateCheck(check) })
    return () => { cancelled = true }
  }, [appId, token])

  const latest = review?.preview?.manifest
  const hasUpdate = latest && updateCheck?.available === true
  const accessDiff = review?.preview?.capability_diff
  const needsAccessReview = capabilityDiffNeedsReview(accessDiff)
  const previousAccessUnrecorded = accessDiff?.unknown_previous === true
  const iconItem = app?.icon_url
    ? { ...app, installed_icon_url: installedIconUrl(app) }
    : null
  if (phase !== 'done' && phase !== 'conflict' && !hasUpdate) return null

  const onUpdate = async () => {
    if (needsAccessReview && !showReview) {
      setShowReview(true)
      return
    }
    setPhase('updating'); setMsg('')
    try {
      const result = await installApp({
        manifest_url: STORE_SELF.manifest_url,
        token,
        reviewed_capability_digest: review.preview.capability_digest,
        reviewed_source_digest: review.candidate.source_digest,
        update_app_id: review.candidate.app_id,
        reviewed_upstream_commit: review.candidate.upstream_commit,
      })
      if (result.mode === 'conflict') {
        const paths = result.conflict_paths?.length
          ? ` Conflicts: ${result.conflict_paths.join(', ')}.`
          : ''
        setPhase('conflict')
        setMsg(`Blocked by local App Store edits.${paths}`)
        return
      }
      setPhase('done')
    } catch (e) {
      if (e?.code === 'capability_changed') {
        let next = { status: 'changed', preview: e.preview, candidate: review.candidate, error: '' }
        try {
          const candidate = await loadUpdateCandidatePreview(appId, STORE_SELF.manifest_url, token)
          next = { status: 'changed', preview: candidate.capability_preview, candidate, error: '' }
        } catch {}
        setReview(next)
        setPhase('error')
        setMsg('Access changed after review. Review the current contract and click Update again.')
        return
      }
      setPhase('error'); setMsg(e.message || String(e))
    }
  }

  return (
    <div className={`st-banner${showReview ? ' is-reviewing' : ''}`}>
      {iconItem ? (
        <IconBox item={iconItem} size="banner" token={token} />
      ) : (
        <span className="st-banner-logo st-banner-logo--empty" aria-hidden="true" />
      )}
      {phase === 'done' ? (
        <>
          <div className="st-banner-content">
            <div className="st-banner-msg">
              <span className="st-banner-title">App Store updated</span>
              <span className="st-banner-meta">Version {latest.version} · Reload to apply</span>
            </div>
          </div>
          <button className="st-banner-btn" onClick={() => window.location.reload()}>Reload</button>
        </>
      ) : phase === 'conflict' ? (
        <>
          <div className="st-banner-content">
            <div className="st-banner-msg">
              <span className="st-banner-title">App Store update blocked</span>
              <span className="st-banner-meta">Version {latest.version} is available. {msg}</span>
            </div>
          </div>
          <button className="st-banner-btn" onClick={onUpdate}>Retry</button>
        </>
      ) : (
        <>
          <div className="st-banner-content">
            <div className="st-banner-msg">
              <span className="st-banner-title">App Store has an update</span>
              <span className="st-banner-meta">Version {latest.version} · Update available</span>
              {phase === 'error' && msg ? (
                <span className="st-banner-error">{msg}</span>
              ) : null}
            </div>
            {showReview && needsAccessReview ? (
              <div className="st-banner-access-review">
                <p className="st-banner-access-note">
                  {previousAccessUnrecorded
                    ? 'Möbius does not have an earlier access record for this app. Confirm it once; later updates stop only when access changes.'
                    : 'This update changes what the App Store can access. Review the changes before updating.'}
                </p>
                <CapabilityContract review={review} isInstalled />
              </div>
            ) : null}
          </div>
          <button className="st-banner-btn" disabled={phase === 'updating'} onClick={onUpdate}>
            {phase === 'updating'
              ? 'Updating…'
              : needsAccessReview && !showReview
              ? 'Review access'
              : 'Update App Store'}
          </button>
        </>
      )}
    </div>
  )
}
