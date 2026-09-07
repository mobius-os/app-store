// Each history entry keeps its current detail target, including retargeting
// while host ownership is pending. Forward reconstructs that same target.
export async function openDetailEntry(current, item, { nav, show, prepare }) {
  if (!item?.manifest) return
  prepare(item)
  if (current.current) {
    current.current.item = item
    if (current.current.owned) show(item)
    return
  }
  const entry = { item, handle: null, owned: false }
  entry.handle = nav.open('app-store-detail', {
    onBack: () => { current.current = null; show(null) },
    onForward: () => { current.current = entry; show(entry.item) },
  })
  current.current = entry
  const { status } = await entry.handle.outcome
  if (current.current !== entry) { entry.handle.close(); return }
  if (status !== 'owned') { current.current = null; return }
  entry.owned = true
  show(entry.item)
}

export function closeDetailEntry(current, show) {
  current.current?.handle.close()
  current.current = null
  show(null)
}
