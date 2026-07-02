import { useState } from 'react'
import { TRUSTED_HOSTS } from '../constants.js'
import { hostnameOf, validateManifestUrl } from '../domain.js'
import { fetchManifest } from '../api.js'

export function FromUrlTab({ onPreview, token }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const host = hostnameOf(url)
  // Three live states for the badge: nothing typed yet (suppress),
  // trusted host (calm accent badge), unfamiliar host (muted badge).
  // Trusted does NOT mean "safe" — it just means "we recognize this
  // hosting service." The detail-page preview is where the actual
  // contents get reviewed before commit.
  let hostKind = null
  if (host) hostKind = TRUSTED_HOSTS.has(host) ? 'trusted' : 'unfamiliar'

  const handlePreview = async () => {
    const typed = url.trim()
    if (!typed) return
    setBusy(true)
    setError('')
    try {
      const trimmed = validateManifestUrl(typed)
      const manifest = await fetchManifest(trimmed, token)
      const missing = ['id', 'name', 'version', 'description', 'entry']
        .filter(k => !manifest[k])
      if (missing.length) {
        throw new Error(`Manifest is missing required fields: ${missing.join(', ')}`)
      }
      // Derive raw_base from the manifest URL: strip the trailing
      // filename so storage_seeds + icon + entry resolve relative
      // to the same directory.
      const raw_base = trimmed.replace(/[^/]+$/, '')
      onPreview({ id: manifest.id || 'custom', manifest, raw_base, manifest_url: trimmed })
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // The focus ring (accent border + glow) now lives in CSS via
  // .st-url-input:focus — same accent language the catalog cards use.

  return (
    <div className="st-url-form">
      <label className="st-url-label" htmlFor="app-store-manifest-url">Manifest URL</label>
      <div className="st-url-hint">
        Paste a public link to a <code>mobius.json</code> file. The store
        will fetch the manifest, show you what it declares, and let you
        review before installing.
      </div>
      <input
        id="app-store-manifest-url"
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://raw.githubusercontent.com/owner/app-foo/main/mobius.json"
        className="st-url-input"
        onKeyDown={e => e.key === 'Enter' && handlePreview()}
      />
      {hostKind && (
        <div className={`st-host-badge${hostKind === 'trusted' ? ' is-trusted' : ''}`}>
          <span className="st-host-badge-dot" aria-hidden="true" />
          {hostKind === 'trusted' ? (
            <>Recognized source · <span className="st-host-badge-host">{host}</span></>
          ) : (
            <>Unfamiliar host · <span className="st-host-badge-host">{host}</span></>
          )}
        </div>
      )}
      <button className="st-primary-btn" onClick={handlePreview} disabled={busy || !url.trim()}>
        {busy ? 'Loading…' : 'Preview'}
      </button>
      {error && <div className="st-error-box">{error}</div>}
    </div>
  )
}
