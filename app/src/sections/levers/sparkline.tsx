/* A small line of the series behind a stat card's number, with the latest
   point marked and, when there is one, the benchmark as a dashed rule. */
import { extent, line as d3line, scaleLinear } from 'd3'
import { useMemo } from 'react'
import { CHROME } from '@/lib/palette'

export interface SparkPoint {
  year: number
  value: number | null
}

export interface SparklineProps {
  series: SparkPoint[]
  /** a horizontal dashed rule, when on the same scale as the series */
  benchmark?: number | null
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ series, benchmark = null, width = 120, height = 32, className }: SparklineProps) {
  const pts = useMemo(() => series.filter((p): p is { year: number; value: number } => p.value !== null && Number.isFinite(p.value)), [series])
  const geo = useMemo(() => {
    if (pts.length < 2) return null
    const [y0, y1] = extent(pts, (p) => p.year) as [number, number]
    const vals = pts.map((p) => p.value)
    if (benchmark !== null) vals.push(benchmark)
    let [v0, v1] = extent(vals) as [number, number]
    if (v0 === v1) {
      v0 -= 1
      v1 += 1
    }
    const x = scaleLinear().domain([y0, y1]).range([3, width - 5])
    const y = scaleLinear().domain([v0, v1]).range([height - 4, 4])
    const path = d3line<{ year: number; value: number }>()
      .x((p) => x(p.year))
      .y((p) => y(p.value))(pts)
    const last = pts[pts.length - 1]
    return { path: path ?? '', lx: x(last.year), ly: y(last.value), by: benchmark === null ? null : y(benchmark) }
  }, [pts, benchmark, width, height])

  if (!geo) return null
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} aria-hidden>
      {geo.by !== null && <line x1={0} x2={width} y1={geo.by} y2={geo.by} stroke={CHROME.lineStrong} strokeDasharray="3 3" />}
      <path d={geo.path} fill="none" stroke={CHROME.teal} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={geo.lx} cy={geo.ly} r={2.6} fill={CHROME.teal} />
    </svg>
  )
}
