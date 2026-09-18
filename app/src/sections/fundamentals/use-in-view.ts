/* How many times an element has entered the scroller's view (0 = never).
   Figures that draw themselves in key their animation on the count so it
   replays on every re-entry; one-shot users just test `> 0`. */
import { useEffect, useState, type RefObject } from 'react'
import { getScroller } from '@/lib/scroller'

export function useInView(ref: RefObject<Element | null>, threshold = 0.35): number {
  const [entries, setEntries] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setEntries((n) => n + 1)
      },
      { root: getScroller() ?? null, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, threshold])
  return entries
}
