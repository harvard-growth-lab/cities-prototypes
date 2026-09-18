/* The tool scrolls inside <main id="pages">, never the window. Everything
   that watches scroll position (scroll-spies, sticky stages, the hash
   replacer) listens here. */
import { useEffect } from 'react'

export const SCROLLER_ID = 'pages'
export const getScroller = () => document.getElementById(SCROLLER_ID)

/** Run `fn` rAF-throttled on the scroller's scroll and on window resize; once on mount. */
export function useScrollerEvent(fn: () => void, deps: readonly unknown[]) {
  useEffect(() => {
    const el = getScroller()
    if (!el) return
    let raf = 0
    const tick = () => {
      raf = 0
      fn()
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
