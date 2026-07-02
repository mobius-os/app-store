import { useEffect, useState } from 'react'
import { STORE_SELF, STORE_VERSION } from '../constants.js'
import { semverCmp } from '../domain.js'
import { fetchManifest, installApp } from '../api.js'

// Self-update banner. The store is a core app and not in its own catalog grid,
// so it checks for its OWN updates here: fetch the published manifest once, and
// when that version is newer than the running STORE_VERSION, offer a one-tap
// update that runs the same install transaction every other app uses, then
// prompt a reload so the freshly-patched code loads. Renders null when current.
export function SelfUpdateBanner({ appId, token }) {
  const [latest, setLatest] = useState(null)   // manifest of the published store
  const [installedVer, setInstalledVer] = useState(null) // DB version of THIS app row
  const [phase, setPhase] = useState('idle')   // idle | updating | done | conflict | error
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchManifest(STORE_SELF.manifest_url, token)
      .then(m => { if (!cancelled) setLatest(m) })
      .catch(() => {})   // a failed self-check is silent — never block the grid
    // The DB row's version is the ground truth for "what is installed".
    // The baked STORE_VERSION constant is only what is RUNNING — comparing
    // the constant against the manifest loops forever if a release ever
    // bumps mobius.json without the constant (which happened: 1.4.22
    // shipped carrying STORE_VERSION '1.4.21', so every update "succeeded"
    // and the banner came right back). DB-vs-manifest cannot loop: a
    // successful install makes them equal.
    fetch(`/api/apps/${appId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(a => { if (!cancelled && a && a.version) setInstalledVer(a.version) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [appId, token])

  const runningOrInstalled = installedVer || STORE_VERSION
  const hasUpdate = latest && semverCmp(runningOrInstalled, latest.version) < 0
  if (phase !== 'done' && phase !== 'conflict' && !hasUpdate) return null

  const onUpdate = async () => {
    setPhase('updating'); setMsg('')
    try {
      const result = await installApp({ manifest_url: STORE_SELF.manifest_url, token })
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
      setPhase('error'); setMsg(e.message || String(e))
    }
  }

  return (
    <div className="st-banner">
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
          <div className="st-banner-msg">
            App Store v{latest.version} is available{phase === 'error' && msg ? ` — ${msg}` : ''}.
          </div>
          <button className="st-banner-btn" disabled={phase === 'updating'} onClick={onUpdate}>
            {phase === 'updating' ? 'Updating…' : 'Update'}
          </button>
        </>
      )}
    </div>
  )
}
