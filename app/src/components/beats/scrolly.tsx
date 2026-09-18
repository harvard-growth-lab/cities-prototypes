/* A reading column beside one figure the scroll drives (design-spec §2.2,
   "Scrolly sections"). Steps fade in as they pass 45% of the viewport; the
   stage is sticky under the chrome. Under 920px the column stacks and the
   stage pins to the bottom of the viewport as a band. */
import { useRef, useState, type ReactNode } from 'react'
import { getScroller, useScrollerEvent } from '@/lib/scroller'
import { useIsNarrow, useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

export interface ScrollyStep {
  id: string
  node: ReactNode
}

export interface ScrollyProps {
  steps: ScrollyStep[]
  /** the stage's content, given the active step's index */
  renderStage: (activeIndex: number) => ReactNode
  /** keeps the panel from resizing between beats */
  stageMinHeight?: number | string
  className?: string
}

export function Scrolly({ steps, renderStage, stageMinHeight, className }: ScrollyProps) {
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const stepsRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const narrow = useIsNarrow()
  const reduced = useReducedMotion()

  useScrollerEvent(() => {
    const root = getScroller()
    const host = stepsRef.current
    if (!root || !host) return
    // the reference line sits at 45% of what the reader can see: the whole
    // viewport, or the part above the bottom-pinned stage when stacked
    const stageH = narrow ? (stageRef.current?.offsetHeight ?? 0) : 0
    const line = root.getBoundingClientRect().top + (root.clientHeight - stageH) * 0.45
    let best = 0
    let bestD = Infinity
    host.querySelectorAll<HTMLElement>('[data-step]').forEach((el, i) => {
      const r = el.getBoundingClientRect()
      const d = Math.abs((r.top + r.bottom) / 2 - line)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best !== activeRef.current) {
      activeRef.current = best
      setActive(best)
    }
  }, [steps.length, narrow])

  return (
    <div
      className={cn(
        'grid grid-cols-[clamp(236px,27vw,392px)_minmax(0,1fr)] items-start gap-14 max-[1200px]:gap-7 max-narrow:flex max-narrow:flex-col max-narrow:items-stretch',
        className,
      )}
    >
      <div ref={stepsRef} className="min-w-0 pb-[16vh] max-narrow:pb-4">
        {steps.map((s, i) => (
          <div
            key={s.id}
            data-step={s.id}
            data-active={i === active || undefined}
            className={cn(
              'flex min-h-[82vh] flex-col items-start justify-center opacity-35 data-active:opacity-100 max-narrow:min-h-[70vh] max-narrow:justify-start max-narrow:pt-[4vh] max-sm:min-h-[64vh]',
              !reduced && 'transition-opacity duration-250',
            )}
          >
            {s.node}
          </div>
        ))}
      </div>
      <div
        ref={stageRef}
        className="sticky top-chrome flex min-h-[calc(100dvh-var(--spacing-chrome))] min-w-0 flex-col justify-center max-narrow:top-auto max-narrow:bottom-0 max-narrow:z-[12] max-narrow:-mx-frame max-narrow:min-h-0 max-narrow:border-t max-narrow:border-line max-narrow:bg-white max-narrow:shadow-[0_-6px_18px_rgba(37,88,98,.08)]"
      >
        <div
          className="rounded-[10px] border border-line bg-white px-8 pt-7 pb-6 max-[1200px]:px-4 max-[1200px]:pt-[18px] max-[1200px]:pb-4 max-narrow:rounded-none max-narrow:border-0 max-narrow:px-2.5 max-narrow:pt-2.5 max-narrow:pb-2 max-sm:px-1"
          style={{ minHeight: stageMinHeight }}
        >
          {renderStage(active)}
        </div>
      </div>
    </div>
  )
}
