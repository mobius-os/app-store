import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from '@openai/apps-sdk-ui/components/Icon'
import { catalogCategory, storeCategory } from '../domain.js'
import { IconBox } from './IconBox.jsx'
import { CatalogStoreImage, StoreImage } from './StoreImage.jsx'

export function listingFor(item) {
  return item.community
    ? item.manifest?.store
    : item.listing || item.manifest?.store
}

export function listingHero(item) {
  const hero = listingFor(item)?.hero
  return typeof hero === 'string' ? hero : hero?.path
}

// The Store's top carousel. Each slide plays for six seconds, shown by its
// progress segment filling; the segment's animation end is what advances, so
// pausing and resuming continue exactly where they were. It pauses for hover,
// touch, keyboard focus, a hidden page, reduced motion, or the owner's pause.
// Swipe, the arrows, or a segment jump straight to an entry.
const SWIPE_MIN_PX = 40

export function Spotlight({ appId, token, spotlights, onPick, title = 'Spotlight', paused = false }) {
  const [spotlightIndex, setSpotlightIndex] = useState(0)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const [touchPaused, setTouchPaused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const touchStart = useRef(null)
  const count = spotlights.length
  const activeIndex = count ? Math.min(spotlightIndex, count - 1) : 0
  const active = spotlights[activeIndex]
  const playing = count > 1 && !reducedMotion
  const autoPaused = paused || hoverPaused || focusPaused || touchPaused || userPaused || !pageVisible

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setReducedMotion(!!media?.matches)
    const syncVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    syncMotion()
    syncVisibility()
    media?.addEventListener?.('change', syncMotion)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      media?.removeEventListener?.('change', syncMotion)
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  if (!active) return null
  const go = (index) => setSpotlightIndex(((index % count) + count) % count)
  const headingId = title === 'Spotlight' ? 'st-spotlights-title' : `st-spotlights-title-${title.replace(/\W+/g, '-').toLowerCase()}`
  const category = storeCategory(catalogCategory(active))
  const name = active.manifest?.name || active.name
  const image = (item, path) => (item.community || item.editorial_artwork_url) ? (
    <StoreImage item={item} path={path} token={token} alt="" className="st-spotlight-slide-image" loading="eager" />
  ) : (
    <CatalogStoreImage storeAppId={appId} path={path} alt="" className="st-spotlight-slide-image" loading="eager" />
  )
  return (
    <section
      className="st-spotlights"
      aria-labelledby={headingId}
      aria-roledescription="carousel"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusPaused(false)
      }}
    >
      {/* The page title already introduces the carousel; its name stays for
          screen readers so the carousel region is still labelled. */}
      <h2 id={headingId} className="st-sr-only">{title}</h2>
      <div
        className="st-spotlight-stage"
        aria-label={`${title} app ${activeIndex + 1} of ${count}`}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null
          setTouchPaused(true)
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          const end = event.changedTouches[0]?.clientX
          touchStart.current = null
          setTouchPaused(false)
          if (count < 2 || start == null || end == null || Math.abs(end - start) < SWIPE_MIN_PX) return
          go(activeIndex + (end < start ? 1 : -1))
        }}
      >
        <article className="st-spotlight-slide" key={active.id} aria-labelledby={`st-spotlight-${active.id}`}
          aria-roledescription="slide">
          {image(active, active.editorial_artwork_url || listingHero(active))}
          <div className="st-spotlight-slide-shade" />
          <div className="st-spotlight-slide-copy">
            <IconBox item={active} token={token} />
            <div className="st-spotlight-slide-text">
              <span className="st-spotlight-kicker">{category ? category.title : 'Featured story'}</span>
              <h3 id={`st-spotlight-${active.id}`}>{name}</h3>
              <p>{listingFor(active)?.tagline || active.summary || active.description}</p>
            </div>
            <button type="button" className="st-spotlight-open" onClick={() => onPick(active)}
              aria-label={`Explore ${name}`}>
              Explore
            </button>
          </div>
        </article>
        {count > 1 ? (
          <>
            <button type="button" className="st-spotlight-arrow is-prev" aria-label="Previous spotlight app"
              onClick={() => go(activeIndex - 1)}>
              <ChevronLeft width={20} height={20} aria-hidden="true" />
            </button>
            <button type="button" className="st-spotlight-arrow is-next" aria-label="Next spotlight app"
              onClick={() => go(activeIndex + 1)}>
              <ChevronRight width={20} height={20} aria-hidden="true" />
            </button>
            <div className="st-spotlight-pagination" role="group" aria-label={`Choose a ${title.toLowerCase()} app`}>
              {spotlights.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className={index === activeIndex ? 'is-active' : index < activeIndex ? 'is-seen' : ''}
                  aria-label={`Show ${item.manifest?.name || item.name}`}
                  aria-current={index === activeIndex ? 'true' : undefined}
                  onClick={() => go(index)}
                >
                  <span className="st-spotlight-track" aria-hidden="true">
                    {index === activeIndex && playing ? (
                      <span
                        key={`${item.id}-${activeIndex}`}
                        className={`st-spotlight-fill${autoPaused ? ' is-paused' : ''}`}
                        onAnimationEnd={() => go(activeIndex + 1)}
                      />
                    ) : null}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="st-spotlight-toggle"
                aria-label={userPaused ? `Resume ${title.toLowerCase()}` : `Pause ${title.toLowerCase()}`}
                aria-pressed={userPaused}
                onClick={() => setUserPaused((value) => !value)}
              >
                {userPaused
                  ? <Play width={14} height={14} aria-hidden="true" />
                  : <Pause width={14} height={14} aria-hidden="true" />}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
