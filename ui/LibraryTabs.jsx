// Library is five tabs under the page title: what needs you, everything
// installed, waiting updates, saved apps and the apps you publish. The strip
// is an underlined tab row that stays pinned under the Store header while the
// list scrolls.

export const LIBRARY_TABS = [
  // Only tabs that ask for action show how many things are waiting.
  { id: 'needs', label: 'Needs you', counted: true },
  { id: 'installed', label: 'Installed' },
  { id: 'update', label: 'Updates', counted: true },
  { id: 'saved', label: 'Saved' },
  // Publishing lives here: your published apps, and Publish an app.
  { id: 'yours', label: 'Your apps' },
]
const TAB_IDS = new Set(LIBRARY_TABS.map((tab) => tab.id))
const PANEL_ID = 'st-library-panel'
const tabId = id => `st-libtab-${id}`

// The panel's element is always rendered and only its tab-panel attributes
// follow `active`. Swapping between a bare fragment and a wrapper would change
// the root element type, and React would remount the whole Store body (the
// Library list, an update's progress, an open row menu) each time search or
// the Store tab toggles the Library tabs.
export function LibraryPanel({ active, children }) {
  const panel = active
    ? { id: PANEL_ID, role: 'tabpanel', 'aria-labelledby': tabId(active), tabIndex: 0 }
    : {}
  return <div {...panel}>{children}</div>
}

// `category` is the Library place the Store remembers. 'all' (the default
// when Library opens) lands on the first tab with something to act on: Needs
// you, then Updates, otherwise Installed. Older saved places ('setup') map
// onto the tab that now holds them.
export function libraryTabFor(category, counts = {}) {
  if (TAB_IDS.has(category)) return category
  if (category === 'setup') return 'needs'
  if (counts.needs > 0) return 'needs'
  if (counts.update > 0) return 'update'
  return 'installed'
}

export function LibraryTabs({ active, counts = {}, onChange }) {
  const onKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const i = LIBRARY_TABS.findIndex((tab) => tab.id === active)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = LIBRARY_TABS[(i + step + LIBRARY_TABS.length) % LIBRARY_TABS.length].id
    onChange(next)
    event.currentTarget.querySelector(`[data-library-tab="${next}"]`)?.focus()
  }
  return (
    <div className="st-libtabs" role="tablist" aria-label="Library" onKeyDown={onKeyDown}>
      {LIBRARY_TABS.map(({ id, label, counted }) => {
        const selected = id === active
        const count = counts[id] || 0
        return (
          <button key={id} type="button" role="tab" data-library-tab={id}
            id={tabId(id)} aria-selected={selected} aria-controls={PANEL_ID}
            tabIndex={selected ? 0 : -1} className="st-libtab" onClick={() => onChange(id)}>
            {label}
            {counted && count > 0 ? <span className="st-libtab-count" aria-label={`${count} waiting`}>{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
