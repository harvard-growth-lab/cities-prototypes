/* The card a hovered dot opens, on either scatter: who it is, its two
   rates, and the quarter it lands in. */
import { TipHead, TipRow } from '@/components/charts/chart-tooltip'
import type { Quadrant } from '@/data/types'
import { fmtRate } from '@/lib/format'
import { QUADRANTS } from '@/lib/quadrants'

export interface PointTipProps {
  name: string
  popCagr: number | null
  wageCagr: number | null
  quadrant: Quadrant | null
  borderline?: boolean
  /** "wages read 2014–2021", when the series stops short of the window */
  note?: string
}

export function PointTip({ name, popCagr, wageCagr, quadrant, borderline, note }: PointTipProps) {
  return (
    <>
      <TipHead>{name}</TipHead>
      <TipRow label="People" value={fmtRate(popCagr)} />
      <TipRow label="Pay" value={fmtRate(wageCagr)} />
      <p className="mt-1.5 border-t border-line pt-1.5 text-xs text-ink-soft">
        {quadrant ? (
          <>
            <b className="font-semibold text-ink">{QUADRANTS[quadrant].scatterLabel}</b>
            {borderline && ' · borderline'}
          </>
        ) : (
          'Not enough readings to place'
        )}
        {note && <span className="block">{note}</span>}
      </p>
    </>
  )
}
