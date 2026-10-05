import { useEffect, useState } from 'react'
import { STORE_SELF } from '../constants.js'
import { createConflictResolverChat, fetchUpdateCheck, installApp, loadUpdateCandidatePreview, openChat } from '../api.js'
import { capabilityDiffNeedsReview } from '../domain.js'
import { CapabilityContract } from './CapabilityContract.jsx'

// Self-update banner. The store is bootstrapped separately from its catalog
// grid, so it checks for its OWN updates here: preview the published candidate
// commit, compare it with this app's recorded upstream source, and install that
// exact commit. The version remains a human label only. Renders null when
// current or verification is unavailable.
export function SelfUpdateBanner({ appId, token }) {
  const [review, setReview] = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [updateCheck, setUpdateCheck] = useState(null)
  const [phase, setPhase] = useState('idle')   // idle | updating | resolving | done | error
  const [msg, setMsg] = useState('')
  const [resolverChatId, setResolverChatId] = useState(null)
  const needsResolution = updateCheck?.pendingUpdateState === 'needs_resolution'

  // A transient unknown check must not erase a known conflict; a confirmed
  // non-conflict state clears it and forgets the resolver chat.
  const applyCheck = check => {
    setUpdateCheck(current => check.pendingUpdateState === 'unknown' && current?.pendingUpdateState === 'needs_resolution'
      ? current : check)
    if (check.pendingUpdateState !== 'needs_resolution' && check.pendingUpdateState !== 'unknown') {
      setResolverChatId(null)
    }
  }

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
      .then(check => { if (!cancelled && check) applyCheck(check) })
    return () => { cancelled = true }
  }, [appId, token])

  // While a conflict is showing, re-check on focus so the banner clears once it
  // is resolved. A check with a pending receipt only reads that receipt (no
  // upstream fetch), and nothing is re-checked when no conflict is showing.
  useEffect(() => {
    if (!needsResolution) return
    let cancelled = false
    const recheck = () => fetchUpdateCheck(appId, token, STORE_SELF.manifest_url)
      .then(check => { if (!cancelled && check) applyCheck(check) })
    window.addEventListener('focus', recheck)
    return () => { cancelled = true; window.removeEventListener('focus', recheck) }
  }, [appId, token, needsResolution])

  const latest = review?.preview?.manifest
  const hasUpdate = latest && updateCheck?.available === true
  const releaseName = latest?.version || updateCheck?.upstreamVersion
  // A pending conflict belongs to its receipt's version, which can be older
  // than the newest published release.
  const conflictVersion = updateCheck?.upstreamVersion || latest?.version
  const accessDiff = review?.preview?.capability_diff
  const needsAccessReview = capabilityDiffNeedsReview(accessDiff)
  const previousAccessUnrecorded = accessDiff?.unknown_previous === true
  if (phase !== 'done' && !needsResolution && !hasUpdate) return null

  const onResolve = async () => {
    if (resolverChatId) return openChat(resolverChatId)
    setPhase('resolving'); setMsg('')
    try {
      const resolver = await createConflictResolverChat(appId, 'preserve_local', token)
      setResolverChatId(resolver.chat_id)
      setPhase('idle')
      openChat(resolver.chat_id)
    } catch (e) {
      setPhase('idle')
      setMsg(e.message || 'The resolver agent could not start.')
    }
  }

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
        setUpdateCheck(current => ({ ...current, available: true, pendingUpdateState: 'needs_resolution' }))
        setPhase('idle')
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
    <div className={`st-banner${showReview ? ' is-reviewing' : ''}${phase !== 'done' && needsResolution ? ' is-conflict' : ''}`}>
      {phase === 'done' ? (
        // Möbius swaps in the new version by itself, and the Store reopens
        // where the owner was on platforms that keep its place.
        <div className="st-banner-msg">App Store updated to v{releaseName}.</div>
      ) : needsResolution ? (
        <>
          <div className="st-banner-msg">
            App Store {conflictVersion ? `v${conflictVersion} ` : ''}needs help merging changes. Your current version stays available.
            {msg ? ` ${msg}` : ''}
          </div>
          <button className="st-banner-btn" disabled={phase === 'resolving'} onClick={onResolve}>
            {phase === 'resolving' ? 'Starting agent…' : resolverChatId ? 'Open agent' : 'Resolve with agent'}
          </button>
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
