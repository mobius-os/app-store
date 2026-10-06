// Each history entry keeps its current detail target, including retargeting
// while host ownership is pending. Forward reconstructs that same target.
export async function openDetailEntry(current, item, { nav, show, prepare, signal, cancelPendingDestination = () => {} }) {
  if (!item?.manifest) return
  prepare(item)
  if (current.current) {
    current.current.item = item
    if (current.current.owned) show(item)
    return
  }
  const entry = { item, handle: null, owned: false }
  entry.handle = nav.open('app-store-detail', {
    onBack: () => { cancelPendingDestination(); current.current = null; show(null) },
    onForward: () => { cancelPendingDestination(); current.current = entry; show(entry.item) },
  })
  current.current = entry
  const cancel = () => {
    if (current.current === entry) current.current = null
    entry.handle.close()
  }
  signal?.addEventListener('abort', cancel, { once: true })
  const { status } = await entry.handle.outcome
  signal?.removeEventListener('abort', cancel)
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
