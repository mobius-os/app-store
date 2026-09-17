import { useEffect, useState } from 'react'
import { STORE_SELF } from '../constants.js'
import { fetchUpdateCheck, installApp, previewApp } from '../api.js'
import { capabilityDiffNeedsReview } from '../domain.js'
import { CapabilityContract } from './CapabilityContract.jsx'

// Self-update banner. The store is bootstrapped separately from its catalog
// grid, so it checks for its OWN updates here: fetch the published manifest,
// then compare it with this app's recorded upstream source. The version remains
// a human label only. Renders null when current or verification is unavailable.
export function SelfUpdateBanner({ appId, token }) {
  const [review, setReview] = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [updateCheck, setUpdateCheck] = useState(null)
  const [phase, setPhase] = useState('idle')   // idle | updating | done | conflict | error
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    previewApp({ manifest_url: STORE_SELF.manifest_url, token })
      .then(preview => {
        if (!cancelled) setReview({ status: 'ready', preview, error: '' })
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
        let preview = e.preview
        try {
          preview = await previewApp({ manifest_url: STORE_SELF.manifest_url, token })
        } catch {}
        setReview({ status: 'changed', preview, error: '' })
        setPhase('error')
        setMsg('Access changed after review. Review the current contract and click Update again.')
        return
      }
      setPhase('error'); setMsg(e.message || String(e))
    }
  }

  return (
    <div className={`st-banner${showReview ? ' is-reviewing' : ''}`}>
      {phase === 'done' ? (
        <>
          <div className="st-banner-msg">App Store updated to v{latest.version}. Reload to apply.</div>
          <button className="st-banner-btn" onClick={() => window.location.reload()}>Reload</button>
        </>
      ) : phase === 'conflict' ? (
        <>
          <div className="st-banner-msg">
            App Store v{latest.version} is available, but the update is blocked. {msg}
          </div>
          <button className="st-banner-btn" onClick={onUpdate}>Retry</button>
        </>
      ) : (
        <>
          <div className="st-banner-content">
            <div className="st-banner-msg">
              App Store v{latest.version} is ready{phase === 'error' && msg ? ` — ${msg}` : ''}.
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
