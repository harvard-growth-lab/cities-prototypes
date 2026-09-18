/* Economic Fundamentals' composition (design-spec §2.2): a reading column
   of beats beside one sticky map. Blocks dim to .35 except the one whose
   top has passed the viewport's midline. Under 920px the map becomes a
   band pinned under the chrome and the beats scroll beneath it. */
import { useRef, type ReactNode } from 'react'
import { getScroller, useScrollerEvent } from '@/lib/scroller'
import { useIsNarrow } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

export interface SplitLayoutProps {
  aside: ReactNode
  /** index of the `[data-beat]` block being read, as it changes */
  onActiveBlock?: (index: number) => void
  className?: string
  children: ReactNode
}

export function SplitLayout({ aside, onActiveBlock, className, children }: SplitLayoutProps) {
  const colRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(-1)
  const narrow = useIsNarrow()

  useScrollerEvent(() => {
    const root = getScroller()
    const col = colRef.current
    if (!root || !col) return
    const bandH = narrow ? (bandRef.current?.offsetHeight ?? 0) : 0
    const rootTop = root.getBoundingClientRect().top
    const mid = rootTop + bandH + (root.clientHeight - bandH) * 0.5
    const blocks = Array.from(col.querySelectorAll<HTMLElement>(':scope > [data-beat]'))
    let active = 0
    blocks.forEach((el, i) => {
      if (el.getBoundingClientRect().top <= mid) active = i
    })
    if (active === activeRef.current) return
    activeRef.current = active
    blocks.forEach((el, i) => {
      if (i === active) el.setAttribute('data-on', '')
      else el.removeAttribute('data-on')
    })
    onActiveBlock?.(active)
  }, [narrow, onActiveBlock])

  return (
    // items-stretch: the map column must run the full height of the reading
    // column, or its sticky child has nothing to stick inside
    <div className={cn('flex flex-row-reverse items-stretch max-narrow:flex-col', className)}>
      <div
        ref={bandRef}
        className="flex-[0_0_clamp(420px,42%,680px)] max-[1200px]:flex-[0_0_clamp(300px,32%,460px)] max-narrow:sticky max-narrow:top-chrome max-narrow:z-[12] max-narrow:flex-none"
      >
        <div className="sticky top-chrome h-[calc(100dvh-var(--spacing-chrome))] bg-[#eceef0] max-narrow:static max-narrow:h-[clamp(200px,46svh,380px)] max-narrow:border-b max-narrow:border-line max-sm:h-[clamp(170px,40svh,320px)]">
          {aside}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div
          ref={colRef}
          className={cn(
            'mr-[clamp(28px,3vw,56px)] ml-frame max-w-[760px] max-narrow:mx-frame',
            // each beat is one screen; the one being read carries the ink
            '[&>[data-beat]]:flex [&>[data-beat]]:min-h-[calc(100dvh-var(--spacing-chrome))] [&>[data-beat]]:flex-col [&>[data-beat]]:justify-center [&>[data-beat]]:opacity-35 [&>[data-beat]]:transition-opacity [&>[data-beat]]:duration-250',
            '[&>[data-beat]]:min-[1200px]:justify-start [&>[data-beat]]:min-[1200px]:pt-14 [&>[data-beat]]:min-[1200px]:pb-[72px]',
            '[&>[data-beat]]:max-narrow:min-h-[calc(54svh-var(--spacing-chrome))] [&>[data-beat]]:max-narrow:justify-start [&>[data-beat]]:max-narrow:pt-[26px] [&>[data-beat]]:max-narrow:pb-[34px] [&>[data-beat]]:max-sm:pt-5 [&>[data-beat]]:max-sm:pb-[30px]',
            // deep links (#b2) must land under the sticky map band, not behind it
            '[&>[data-beat]]:max-narrow:scroll-mt-[calc(var(--spacing-chrome)+clamp(200px,46svh,380px))] [&>[data-beat]]:max-sm:scroll-mt-[calc(var(--spacing-chrome)+clamp(170px,40svh,320px))]',
            '[&>[data-beat][data-on]]:opacity-100',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
