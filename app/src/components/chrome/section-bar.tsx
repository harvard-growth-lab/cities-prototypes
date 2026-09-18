/* The row that never leaves (design-spec §2.2): the location chip, then the
   five sections as chips — a check where the reader has been, the current
   one lifted on a tint, the ones ahead numbered and quiet. A seam splits
   "describe the place" (1–3) from "diagnose it" (4–5). */
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { SEAM_BEFORE, SECTIONS, sectionPath } from '@/lib/sections'
import { useActiveSection, useToolState } from '@/lib/use-tool-state'
import { cn } from '@/lib/utils'
import { CheckMark } from './icons'
import { MetroPicker } from './metro-picker'

export function SectionBar() {
  const { summary } = useToolState()
  const active = useActiveSection()
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)

  // when the row overflows (phones), keep the active chip in the middle of it
  useEffect(() => {
    const nav = navRef.current
    const chip = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !chip || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollTo({ left: chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
  }, [active.slug])

  return (
    <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-line bg-white px-[max(var(--spacing-frame),calc((100%_-_var(--container-grid))_/_2))] shadow-[0_1px_0_rgba(37,88,98,.04)] max-[1200px]:h-14 max-narrow:h-13 max-sm:h-12">
      <MetroPicker
        size="bar"
        value={summary.id}
        onChange={(m) => navigate({ to: sectionPath(active.slug), params: { slug: m.slug } })}
      />
      <nav
        ref={navRef}
        aria-label="Sections"
        className="relative ml-14 flex h-full min-w-0 flex-1 items-center justify-between gap-1 overflow-x-auto [scrollbar-width:none] max-[1200px]:ml-6 max-sm:ml-3 max-sm:gap-0"
      >
        {SECTIONS.map((s) => {
          const isActive = s.slug === active.slug
          const isDone = s.n < active.n
          const seam = s.slug === SEAM_BEFORE
          const connector = s.n === 1 || s.n === 2 || s.n === 4
          return (
            <Link
              key={s.slug}
              to={sectionPath(s.slug)}
              params={{ slug: summary.slug }}
              search={true}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13.5px] font-semibold whitespace-nowrap text-ink-soft transition-colors hover:text-ink max-[1200px]:text-[13px] max-sm:h-full max-sm:rounded-none max-sm:px-2.5 max-sm:text-[12.5px]',
                isDone && 'text-teal',
                isActive && 'bg-[#f4f6f5] font-bold text-ink max-sm:bg-transparent max-sm:shadow-[inset_0_-2px_0_var(--color-teal)]',
                // the seam: a hairline 11px to the left, and air
                seam &&
                  "ml-[19px] before:absolute before:top-1/2 before:-left-[11px] before:h-[26px] before:w-px before:-translate-y-1/2 before:bg-line-strong before:content-[''] max-sm:ml-2 max-sm:before:-left-[4px]",
                // connectors to the next chip; hidden with the labels ≤1439
                connector && "after:ml-1 after:h-[1.5px] after:w-2 after:bg-line-strong after:content-[''] max-[1440px]:after:hidden",
              )}
            >
              <span
                className={cn(
                  'inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-current text-[11px] font-bold max-[1200px]:size-5',
                  isDone && 'border-transparent bg-[#e2ebec]',
                  isActive && 'border-teal bg-teal text-white',
                )}
              >
                {isDone ? <CheckMark /> : s.n}
              </span>
              <span className={cn(!isActive && 'max-[1440px]:hidden')}>{s.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
