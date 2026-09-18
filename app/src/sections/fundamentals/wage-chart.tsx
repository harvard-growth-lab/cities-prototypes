/* The nominal wage index: the admin place's IRS wage per return (a 3-year
   centred mean) against all US metros. Years with one or no observed
   returns inside the mean are modelled and drawn dashed. */
import { useMemo } from 'react'
import type { PanelYear } from '@/data/types'
import { fmtMoney } from '@/lib/format'
import { SERIES } from '@/lib/palette'
import { useToolState } from '@/lib/use-tool-state'
import { IndexChart } from './index-chart'
import { FIRST_YEAR, lastYear, toPoints, yearsBetween, type ChartSeries } from './series'

export interface WageChartProps {
  panel: PanelYear[]
  label: string
  rate?: number | null
  band: [number, number]
  className?: string
}

const modelled = (r: PanelYear) => r.wage !== null && r.wageObs !== null && r.wageObs <= 1

export function WageChart({ panel, label, rate, band, className }: WageChartProps) {
  const { national } = useToolState()

  const series = useMemo<ChartSeries[]>(() => {
    const years = yearsBetween(FIRST_YEAR, lastYear([panel, national.allMetros]) ?? band[1])
    return [
      {
        id: 'place',
        name: label,
        label,
        color: SERIES.city,
        width: 3,
        points: toPoints(panel, years, (r) => r.wage, modelled),
        rate,
        lead: true,
      },
      {
        id: 'nation',
        name: 'All US metros',
        label: 'All US metros',
        color: SERIES.nation,
        width: 1.8,
        dash: '5 4',
        points: toPoints(national.allMetros, years, (r) => r.wage),
      },
    ]
  }, [panel, label, rate, band, national.allMetros])

  const anyModelled = panel.some(modelled)
  return (
    <div className={className}>
      <IndexChart
        series={series}
        band={band}
        title={`Wage change since ${band[0]}`}
        format={(v) => fmtMoney(v)}
        ariaLabel={`Average wage per tax return indexed to 100 in ${band[0]}: ${label} and all US metros.`}
      />
      {anyModelled && (
        <p className="mt-1 text-xs text-ink-soft">
          Dashed: modelled years — the 3-year mean has fewer than two observed years inside it.
        </p>
      )}
    </div>
  )
}
