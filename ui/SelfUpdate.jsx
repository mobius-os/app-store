import { useCallback, useEffect, useRef, useState } from 'react'
import { RowMenu } from './CatalogCard.jsx'
import { Check, X } from '@openai/apps-sdk-ui/components/Icon'
import { STORE_SELF } from '../constants.js'
import { createConflictResolverChat, fetchReleaseNotes, fetchUpdateCheck, installApp, loadUpdateCandidatePreview, openChat } from '../api.js'
import { capabilityDiffNeedsReview, hasAccessRows, MISSING_ACCESS_ROWS, shortDate } from '../domain.js'
import { useSheetFocus } from './sheetFocus.js'
import { CapabilityContract } from './CapabilityContract.jsx'
import { UpdateAgentChooser } from './UpdateReviewModal.jsx'
import { ProgressFill } from './ProgressFill.jsx'

// The Store's own update. The store is bootstrapped separately from its
// catalog grid, so it checks for its OWN updates here: preview the published
// candidate commit, compare it with this app's recorded upstream source, and
// install that exact commit. The version remains a human label only.
//
// It shows as an ordinary row in Library (Updates, or Needs you for a
// conflict) and counts toward Update all. Nothing shows while the Store is
// current or the check fails. The row installs directly; its What's new opens
// the update sheet with the release details (version, date, changes, access).
export function useSelfUpdate({ appId, token }) {
  const [review, setReview] = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [updateCheck, setUpdateCheck] = useState(null)
  const [phase, setPhase] = useState('idle')   // idle | updating | resolving | done | error
  const [msg, setMsg] = useState('')
  const [resolverChatId, setResolverChatId] = useState(null)
  const [choosingAgent, setChoosingAgent] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [notes, setNotes] = useState({ status: 'idle', items: [], releasedAt: '' })
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

  // While a conflict is showing, re-check on focus so it clears once it is
  // resolved. A check with a pending receipt only reads that receipt (no
  // upstream fetch), and nothing is re-checked when no conflict is showing.
  useEffect(() => {
    if (!needsResolution) return
    let cancelled = false
    const recheck = () => fetchUpdateCheck(appId, token, STORE_SELF.manifest_url)
      .then(check => { if (!cancelled && check) applyCheck(check) })
    window.addEventListener('focus', recheck)
    return () => { cancelled = true; window.removeEventListener('focus', recheck) }
  }, [appId, token, needsResolution])

  // The change list is read once, the first time the sheet opens: it is a
  // courtesy from GitHub's public API, so it is never fetched on every load.
  const upstreamCommit = review?.candidate?.upstream_commit || null
  const installedRevision = updateCheck?.installedSourceRevision || null
  const notesStartedRef = useRef(false)
  useEffect(() => {
    if (!panelOpen || !upstreamCommit || notesStartedRef.current) return
    notesStartedRef.current = true
    setNotes({ status: 'loading', items: [], releasedAt: '' })
    fetchReleaseNotes({ manifestUrl: STORE_SELF.manifest_url, fromCommit: installedRevision, toCommit: upstreamCommit, token })
      .then(result => {
        setNotes(result ? { status: 'ready', items: result.notes, releasedAt: result.releasedAt } : { status: 'error', items: [], releasedAt: '' })
      })
  }, [panelOpen, upstreamCommit, installedRevision, token])

  const latest = review?.preview?.manifest
  const hasUpdate = !!latest && updateCheck?.available === true
  const releaseName = latest?.version || updateCheck?.upstreamVersion
  // A pending conflict belongs to its receipt's version, which can be older
  // than the newest published release.
  const conflictVersion = updateCheck?.upstreamVersion || latest?.version
  const accessDiff = review?.preview?.capability_diff
  const accessRowsMissing = review?.preview ? !hasAccessRows(review.preview) : false
  const needsAccessReview = capabilityDiffNeedsReview(accessDiff) || accessRowsMissing
  const kind = phase === 'done' ? 'done' : needsResolution ? 'conflict' : hasUpdate ? 'update' : null

  // The owner chooses the agent first; the chooser calls back with it.
  const resolve = async (agent = null) => {
    if (resolverChatId) return openChat(resolverChatId)
    if (!agent) { setChoosingAgent(true); return }
    setPhase('resolving'); setMsg('')
    try {
      const resolver = await createConflictResolverChat(appId, 'preserve_local', token, agent)
      setResolverChatId(resolver.chat_id)
      setPhase('idle')
      openChat(resolver.chat_id)
    } catch (e) {
      setPhase('idle')
      setMsg(e.message || 'The resolver agent could not start.')
      setPanelOpen(true)
    }
  }

  // An access change is reviewed in the panel first, wherever Update was
  // pressed; the second press installs the reviewed contract.
  const update = async () => {
    if (needsAccessReview && !showReview) {
      setShowReview(true)
      setPanelOpen(true)
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
        let next = { status: 'refused', preview: e.preview, candidate: review.candidate, error: '' }
        try {
          const candidate = await loadUpdateCandidatePreview(appId, STORE_SELF.manifest_url, token)
          next = { status: 'refused', preview: candidate.capability_preview, candidate, error: '' }
        } catch {}
        setReview(next)
        setShowReview(true)
        setPanelOpen(true)
        setPhase('error')
        setMsg('Access changed after review. Review the current contract and click Update again.')
        return
      }
      setPhase('error'); setMsg(e.message || String(e))
      setPanelOpen(true)
    }
  }

  return {
    kind, phase, msg, review, releaseName, conflictVersion, resolverChatId,
    needsAccessReview, accessRowsMissing, showReview,
    previousAccessUnrecorded: accessDiff?.unknown_previous === true,
    // Counted with the other Library updates while it still needs a tap.
    pending: kind === 'update' || kind === 'conflict',
    notes, panelOpen, setPanelOpen, update, resolve, choosingAgent, setChoosingAgent, token,
    // The sheet shows the access contract whenever it needs reviewing, so
    // opening it counts as the review and the next Update press installs.
    openPanel: () => { setPanelOpen(true); if (needsAccessReview) setShowReview(true) },
  }
}

// What one tap on the Library row's button does right now.
function selfAction(self) {
  if (self.kind === 'conflict') {
    const starting = self.phase === 'resolving'
    return {
      run: self.resolve, busy: false, disabled: starting,
      label: starting ? 'Starting agent…' : self.resolverChatId ? 'Open agent' : 'Fix with agent',
      ariaLabel: self.resolverChatId ? 'Open the agent fixing the App Store update' : 'Fix the App Store update with an agent',
    }
  }
  const updating = self.phase === 'updating'
  const reviewFirst = self.needsAccessReview && !self.showReview
  return {
    run: self.update, busy: updating, disabled: updating || self.accessRowsMissing,
    label: reviewFirst ? 'Review access' : 'Update',
    ariaLabel: updating ? 'Updating App Store' : reviewFirst ? 'Review App Store access' : 'Update App Store',
  }
}

function SelfAction({ self, className }) {
  const action = selfAction(self)
  const conflict = self.kind === 'conflict'
  return (
    <button type="button" className={className || `st-card-action ${conflict ? 'is-conflict' : 'is-update'}`}
      disabled={action.disabled} onClick={() => action.run()} aria-label={action.ariaLabel}>
      {conflict ? action.label : <ProgressFill busy={action.busy} label="Updating">{action.label}</ProgressFill>}
    </button>
  )
}

// The same list row every other app uses in Library.
export function SelfUpdateRow({ self, appId }) {
  if (!self.pending) return null
  const conflict = self.kind === 'conflict'
  return (
    <div className={`st-card is-list ${conflict ? 'is-conflict' : 'is-update'} st-selfupd-row`}>
      <div className="st-icon-slot"><div className="st-icon-wrap">
        <img className="st-icon-img" src={`/api/apps/${appId}/icon?size=128`} alt="" />
      </div></div>
      <span className="st-card-open">App Store</span>
      <div className="st-card-state-row">
        <div className={`st-card-state-line is-${conflict ? 'conflict' : 'update'}`}>
          {conflict ? 'Update needs a hand' : 'Update available'}
        </div>
        {self.msg ? <div className="st-card-state-detail">{self.msg}</div> : null}
      </div>
      <div className="st-card-desc">
        {conflict
          ? 'The update overlaps your changes. Your current version stays available.'
          : 'Discover, install, and update Möbius apps.'}
      </div>
      <div className="st-card-byline">
        <span className="st-card-cat">Version {conflict ? self.conflictVersion : self.releaseName}</span>
        <span className="st-card-publisher">mobius-os</span>
      </div>
      <div className="st-card-status-row">
        <SelfAction self={self} />
        {/* Every Library row carries the same menu, so actions share one column. */}
        <RowMenu name="App Store" items={[{ label: "What's new", ariaLabel: "What's new in the App Store update", run: self.openPanel }]} />
      </div>
    </div>
  )
}

// The update popup: the Store's own release, laid out like an app page in
// miniature and centred on every screen. Rendered once at the Store root so
// its scrim covers the app; updating happens inside it.
export function SelfUpdateSheet({ self, appId }) {
  const { panelOpen, setPanelOpen } = self
  const close = useCallback(() => setPanelOpen(false), [setPanelOpen])
  // The agent chooser for a conflict belongs to the shared state, so it opens
  // from the Library row as well as from the sheet.
  const chooser = self.choosingAgent ? (
    <UpdateAgentChooser token={self.token} title="Resolve App Store update"
      onStart={self.resolve} onCancel={() => self.setChoosingAgent(false)} />
  ) : null
  // The chooser replaces the sheet while it is open, so its own focus and
  // Escape handling are the only ones listening.
  if (self.choosingAgent || !panelOpen || !self.kind) return chooser
  return <>{chooser}<SelfUpdateSheetBody self={self} appId={appId} close={close} /></>
}

function SelfUpdateSheetBody({ self, appId, close }) {
  const sheetRef = useRef(null)
  const busy = self.phase === 'updating' || self.phase === 'resolving'
  // Focus starts on the popup itself, so no focus ring lands on a button
  // the owner never touched; Tab still moves through its buttons.
  useSheetFocus({ sheetRef, initialRef: sheetRef, onClose: close, busy })
  const done = self.kind === 'done'
  const conflict = self.kind === 'conflict'
  const version = conflict ? self.conflictVersion : self.releaseName
  const released = shortDate(self.notes.releasedAt)
  const accessWord = conflict ? 'Needs you' : self.accessRowsMissing ? 'Unknown' : self.needsAccessReview ? 'Changes' : 'Same'
  const accessRows = self.review?.preview?.access_rows || []
  return (
    <div className="st-scrim st-selfupd-scrim" onClick={busy ? null : close} role="dialog" aria-modal="true" aria-labelledby="st-selfupd-title">
      <div className="st-sheet st-selfupd-sheet" ref={sheetRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="st-selfupd-head">
          <img src={`/api/apps/${appId}/icon?size=128`} alt="" width={56} height={56} />
          <div className="st-selfupd-head-text">
            <h3 className="st-sheet-title" id="st-selfupd-title">App Store</h3>
            <div className="st-selfupd-sub">{done ? `You're on version ${self.releaseName}` : `Version ${version} · by mobius-os`}</div>
          </div>
          <button type="button" className="st-selfupd-close" onClick={close} disabled={busy} aria-label="Close">
            <X width={16} height={16} aria-hidden="true" />
          </button>
        </div>
        {done ? (
          <>
            <p className="st-sheet-body st-selfupd-donebody">
              The update is installed. The Store reloads by itself.
            </p>
            <div className="st-selfupd-cta">
              <button type="button" className="st-btn st-btn-primary" onClick={close}>Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="st-selfupd-facts">
              <div><b>{version}</b><span>Version</span></div>
              <div><b>{released || '—'}</b><span>Released</span></div>
              <div><b>{accessWord}</b><span>Access</span></div>
            </div>
            <div className="st-selfupd-k">What's new</div>
            {self.notes.status === 'loading' ? (
              <p className="st-selfupd-muted" role="status">Reading the change list…</p>
            ) : self.notes.items.length ? (
              <ul className="st-selfupd-list">
                {self.notes.items.map((line, index) => <li key={index}>{line}</li>)}
              </ul>
            ) : (
              <p className="st-selfupd-muted">No notes for this release.</p>
            )}
            <div className="st-selfupd-k">Access</div>
            {conflict ? (
              <p className="st-selfupd-muted">The update overlaps your changes. Your current version keeps working while Möbius combines the two.</p>
            ) : self.accessRowsMissing ? (
              <p className="st-selfupd-muted">{MISSING_ACCESS_ROWS}</p>
            ) : self.needsAccessReview ? (
              <>
                <p className="st-selfupd-muted">
                  {self.previousAccessUnrecorded
                    ? 'Möbius has no earlier access record for the Store. Confirm it once; later updates stop only when access changes.'
                    : 'This update changes what the App Store can access. Review the changes, then update.'}
                </p>
                <div className="st-selfupd-review"><CapabilityContract review={self.review} isInstalled updateReview /></div>
              </>
            ) : (
              <>
                <div className="st-selfupd-access"><Check width={18} height={18} aria-hidden="true" /> Same as now — installs right away</div>
                {accessRows.length ? (
                  <div className="st-selfupd-chips">{accessRows.map(row => <span key={row.id || row.title}>{row.title}</span>)}</div>
                ) : null}
              </>
            )}
            {self.msg ? <p className="st-selfupd-err" role="alert">{self.msg}</p> : null}
            <div className="st-selfupd-cta"><SelfAction self={self} className={`st-btn ${conflict ? 'st-btn-secondary' : 'st-btn-primary'}`} /></div>
            {self.kind === 'update' && !busy ? (
              <button type="button" className="st-selfupd-later" onClick={close}>Later</button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
