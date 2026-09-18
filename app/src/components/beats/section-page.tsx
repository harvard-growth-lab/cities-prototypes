/* One section's page: the measure, the scroll-spy that marks beats visited
   and replaces the hash as the reader moves, and the deep link into a beat.
   Beats are the `[data-beat]` elements rendered inside. */
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { markVisited } from '@/lib/journey'
import { getScroller, useScrollerEvent } from '@/lib/scroller'
import { sectionBySlug, type SectionSlug } from '@/lib/sections'
import { useToolState } from '@/lib/use-tool-state'
import { cn } from '@/lib/utils'

export interface SectionPageProps {
  section: SectionSlug
  /** plain = the 976px reading measure; wide = the 1360px grid for scrollies;
   *  split = no measure at all (SplitLayout frames itself) */
  variant?: 'plain' | 'wide' | 'split'
  className?: string
  children: ReactNode
}

export function SectionPage({ section, variant = 'plain', className, children }: SectionPageProps) {
  const { summary } = useToolState()
  const navigate = useNavigate()
  const hash = useLocation({ select: (l) => l.hash })
  const ref = useRef<HTMLDivElement>(null)
  const current = useRef<string | null>(null)
  const initialHash = useRef(hash)
  const firstBeat = useRef<string | null>(null)

  // Deep link: scroll the named beat under the chrome once the page is in the DOM.
  useEffect(() => {
    const id = initialHash.current
    if (!id) return
    const el = document.getElementById(id)
    if (el) {
      current.current = id
      el.scrollIntoView({ block: 'start' })
    }
  }, [])

  // Scroll-spy: the last beat whose top has passed 40% of the viewport is
  // the one being read. Mark it visited and replace the hash (never push).
  useScrollerEvent(() => {
    const root = getScroller()
    const host = ref.current
    if (!root || !host) return
    const line = root.getBoundingClientRect().top + root.clientHeight * 0.4
    let active: string | null = null
    const beats = host.querySelectorAll<HTMLElement>('[data-beat]')
    firstBeat.current = beats[0]?.dataset.beat ?? null
    for (const el of beats) {
      if (el.getBoundingClientRect().top <= line) active = el.dataset.beat ?? null
    }
    if (!active || active === current.current) return
    const first = current.current === null
    current.current = active
    markVisited(summary.id, section, active)
    // the first beat at the top of a fresh page keeps the clean URL
    if (first && active === firstBeat.current) return
    void navigate({ to: '.', hash: active, search: true, replace: true, resetScroll: false, hashScrollIntoView: false })
  }, [summary.id, section])

  const s = sectionBySlug(section)
  return (
    <div
      ref={ref}
      data-section={section}
      aria-label={s?.name}
      className={cn(
        variant === 'plain' &&
          'mx-auto w-full max-w-[976px] px-12 pt-[52px] pb-[60px] max-[1200px]:px-10 max-[1200px]:pt-11 max-[1200px]:pb-[52px] max-narrow:px-7 max-narrow:pt-9 max-narrow:pb-11 max-sm:px-3.5 max-sm:pt-5 max-sm:pb-[30px]',
        variant === 'wide' &&
          'mx-auto w-full max-w-grid px-frame pt-[52px] pb-[60px] max-[1200px]:pt-11 max-[1200px]:pb-[52px] max-narrow:pt-9 max-narrow:pb-11 max-sm:pt-5 max-sm:pb-[30px]',
        variant === 'split' && 'w-full',
        className,
      )}
    >
      {children}
    </div>
  )
}
