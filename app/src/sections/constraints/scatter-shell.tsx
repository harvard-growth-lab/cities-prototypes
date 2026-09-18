/* The box both scatters sit in: the figure column (880, left-aligned),
   the relative wrap the quadrant buttons and the tooltip position against,
   and the responsive rules of design-spec §5 — under 920 the block pans
   sideways with the plot floored at 660; under 640 the floor stands down
   and the SVG bleeds to the screen edges instead. */
import type { ReactNode, RefObject } from 'react'
import { QuadrantButtons } from './quadrant-buttons'

export interface ScatterShellProps {
  wrapRef: RefObject<HTMLDivElement | null>
  /** the tooltip node from useChartTooltip */
  tooltip: ReactNode
  /** what sits in the teal tray above the plot (a Replay button) */
  controls?: ReactNode
  children: ReactNode
}

export function ScatterShell({ wrapRef, tooltip, controls, children }: ScatterShellProps) {
  return (
    <>
      {controls && <div className="mt-5 mb-[18px] flex w-full max-w-[880px] items-center rounded-lg bg-teal-tint px-[18px] py-2.5">{controls}</div>}
      <div className="mt-2 max-narrow:overflow-x-auto max-sm:overflow-visible">
        <div
          ref={wrapRef}
          className="relative w-full max-w-[880px] max-narrow:min-w-[660px] max-sm:-mx-[14px] max-sm:w-[calc(100%+28px)] max-sm:min-w-0"
        >
          {children}
          {tooltip}
          <QuadrantButtons />
        </div>
      </div>
    </>
  )
}
