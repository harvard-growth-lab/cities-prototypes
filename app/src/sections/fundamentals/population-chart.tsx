/* The population index: the admin place against all US metros, and — in
   the second beat — the metro drawn in between them. */
import { useMemo } from 'react'
import type { PanelYear } from '@/data/types'
import { fmtInt } from '@/lib/format'
import { SERIES } from '@/lib/palette'
import { useToolState } from '@/lib/use-tool-state'
import { IndexChart } from './index-chart'
import { FIRST_YEAR, lastYear, toPoints, yearsBetween, type ChartSeries } from './series'

export interface PopulationLine {
  panel: PanelYear[]
  label: string
  /** printed under the label when given (undefined = no rate line) */
  rate?: number | null
}

export interface PopulationChartProps {
  /** the admin place; null when it has no population series (a CDP) */
  place: PopulationLine | null
  /** the metro line, beat 2 */
  metro?: PopulationLine
  /** the nation's label; omit to leave it unlabelled */
  nationLabel?: string
  band: [number, number]
  drawKey?: number
  className?: string
}

export function PopulationChart({ place, metro, nationLabel, band, drawKey, className }: PopulationChartProps) {
  const { national } = useToolState()

  const series = useMemo<ChartSeries[]>(() => {
    const sources: { year: number }[][] = [national.allMetros]
    if (place) sources.push(place.panel)
    if (metro) sources.push(metro.panel)
    const years = yearsBetween(FIRST_YEAR, lastYear(sources) ?? band[1])
    const out: ChartSeries[] = []
    if (place)
      out.push({
        id: 'place',
        name: place.label,
        label: place.label,
        color: SERIES.city,
        width: 3,
        points: toPoints(place.panel, years, (r) => r.population),
        rate: place.rate,
        lead: true,
      })
    if (metro)
      out.push({
        id: 'metro',
        name: metro.label,
        label: metro.label,
        color: SERIES.metro,
        labelColor: SERIES.metroInk,
        width: 2.8,
        points: toPoints(metro.panel, years, (r) => r.population),
        rate: metro.rate,
        drawIn: true,
      })
    out.push({
      id: 'nation',
      name: 'All US metros',
      label: nationLabel,
      color: SERIES.nation,
      width: 1.8,
      dash: '5 4',
      points: toPoints(national.allMetros, years, (r) => r.population),
    })
    return out
  }, [place, metro, nationLabel, national.allMetros, band])

  const names = series.map((s) => s.name).join(', ')
  return (
    <IndexChart
      series={series}
      band={band}
      title={`Population change since ${band[0]}`}
      format={fmtInt}
      ariaLabel={`Population indexed to 100 in ${band[0]}: ${names}, ${FIRST_YEAR} to the latest year.`}
      drawKey={drawKey}
      className={className}
    />
  )
}
