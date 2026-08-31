import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from '@openai/apps-sdk-ui/components/Icon'
import { IconBox } from './IconBox.jsx'
import { StoreImage } from './StoreImage.jsx'

function manifestId(item) {
  return String(item?.manifest?.id || item?.id || '').toLowerCase()
}

function normalizedRows(rows) {
  return (rows || []).map((row) => ({
    app_id: String(row?.app_id || '').toLowerCase(),
    artwork_asset: row?.artwork_asset || null,
  }))
}

export function SpotlightEditor({
  catalog,
  feed,
  token,
  onUploadArtwork,
  onPublish,
}) {
  const candidates = useMemo(() => (catalog || [])
    .filter((item) => item?.manifest && manifestId(item))
    .sort((a, b) => String(a.manifest?.name || a.name).localeCompare(String(b.manifest?.name || b.name))),
  [catalog])
  const byId = useMemo(
    () => new Map(candidates.map((item) => [manifestId(item), item])),
    [candidates],
  )
  const [rows, setRows] = useState(() => normalizedRows(feed?.items))
  const [addId, setAddId] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setRows((feed?.items || []).map((row) => ({
      app_id: String(row?.app_id || '').toLowerCase(),
      artwork_asset: row?.artwork_asset || null,
      artwork_url: row?.artwork_url || '',
    })))
    setConfirmed(false)
  }, [feed?.revision])

  const current = JSON.stringify(normalizedRows(feed?.items))
  const draft = JSON.stringify(normalizedRows(rows))
  const changed = current !== draft
  const used = new Set(rows.map((row) => row.app_id))
  const available = candidates.filter((item) => !used.has(manifestId(item)))

  function move(index, delta) {
    setRows((value) => {
      const nextIndex = index + delta
      if (nextIndex < 0 || nextIndex >= value.length) return value
      const next = [...value]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
    setConfirmed(false)
  }

  async function upload(index, file) {
    if (!file) return
    setBusy(`artwork:${index}`)
    setError('')
    try {
      const result = await onUploadArtwork(file)
      const asset = result?.asset
      if (!asset?.id) throw new Error('The artwork upload returned no asset.')
      setRows((value) => value.map((row, rowIndex) => rowIndex === index ? {
        ...row,
        artwork_asset: asset.id,
        artwork_url: asset.url || '',
      } : row))
      setConfirmed(false)
    } catch (uploadError) {
      setError(uploadError?.message || 'Spotlight artwork could not be uploaded.')
    } finally {
      setBusy('')
    }
  }

  async function publish() {
    if (!changed || !confirmed || !rows.length) return
    setBusy('publish')
    setError('')
    try {
      await onPublish(normalizedRows(rows))
      setConfirmed(false)
    } catch (publishError) {
      setError(publishError?.message || 'Spotlight could not be published.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="st-spotlight-editor" aria-labelledby="st-spotlight-editor-title">
      <div className="st-spotlight-editor-head">
        <div>
          <h3 id="st-spotlight-editor-title">Spotlight lineup</h3>
          <p>Change the order or artwork without releasing a new App Store version.</p>
        </div>
        <span className="st-spotlight-revision">Edition {feed?.revision || 'draft'}</span>
      </div>

      <div className="st-spotlight-editor-list">
        {rows.map((row, index) => {
          const item = byId.get(row.app_id)
          return (
            <article className="st-spotlight-editor-row" key={`${row.app_id}:${index}`}>
              <div className="st-spotlight-editor-preview">
                {row.artwork_url ? (
                  <StoreImage item={item || {}} path={row.artwork_url} token={token} alt="" />
                ) : (
                  <IconBox item={item || { id: row.app_id, name: row.app_id }} token={token} />
                )}
              </div>
              <div className="st-spotlight-editor-copy">
                <strong>{item?.manifest?.name || item?.name || row.app_id}</strong>
                <span>{row.artwork_asset ? 'Hosted artwork' : 'Uses packaged artwork'}</span>
              </div>
              <div className="st-spotlight-editor-actions">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || !!busy} aria-label={`Move ${row.app_id} earlier`}><ArrowUp aria-hidden="true" /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1 || !!busy} aria-label={`Move ${row.app_id} later`}><ArrowDown aria-hidden="true" /></button>
                <label className="st-spotlight-upload">
                  <span>{busy === `artwork:${index}` ? 'Uploading…' : 'Artwork'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={!!busy} onChange={async (event) => {
                    const input = event.currentTarget
                    await upload(index, input.files?.[0])
                    input.value = ''
                  }} />
                </label>
                <button type="button" className="is-remove" disabled={!!busy} onClick={() => {
                  setRows((value) => value.filter((_, rowIndex) => rowIndex !== index))
                  setConfirmed(false)
                }}>Remove</button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="st-spotlight-editor-add">
        <select value={addId} onChange={(event) => setAddId(event.target.value)} disabled={rows.length >= 8 || !!busy} aria-label="Choose an app for Spotlight">
          <option value="">Choose an app…</option>
          {available.map((item) => <option key={manifestId(item)} value={manifestId(item)}>{item.manifest?.name || item.name}</option>)}
        </select>
        <button type="button" className="st-btn st-btn-secondary" disabled={!addId || rows.length >= 8 || !!busy} onClick={() => {
          setRows((value) => [...value, { app_id: addId, artwork_asset: null, artwork_url: '' }])
          setAddId('')
          setConfirmed(false)
        }}>Add to Spotlight</button>
      </div>

      {error ? <div className="st-notice is-warning" role="alert">{error}</div> : null}
      <div className="st-spotlight-editor-publish">
        <label className="st-publish-consent">
          <input type="checkbox" checked={confirmed} disabled={!changed || !rows.length || !!busy} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>I’m ready to update the shared Store for everyone.</span>
        </label>
        <button type="button" className="st-btn st-btn-primary" disabled={!changed || !confirmed || !rows.length || !!busy} onClick={publish}>
          {busy === 'publish' ? 'Publishing…' : 'Publish Spotlight'}
        </button>
      </div>
    </section>
  )
}
