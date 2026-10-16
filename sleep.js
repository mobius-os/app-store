// A wait that ends early, or never starts, once `signal` aborts. Shared by
// the Store's read retries (api.js) and the batch controller's reconnects.
export function sleep(ms, signal) {
  if (signal?.aborted) return Promise.resolve()
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
  })
}
