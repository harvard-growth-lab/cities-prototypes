/* Jobs here per resident worker, year by year: a sparkline that says
   whether the reading is settled or drifting. First and last years label
   the ends; a dashed rule marks 1× when the line runs near it. */
import { line, scaleLinear } from 'd3'
import { useMemo } from 'react'
import { ChartFrame } from '@/components/charts/chart-frame'
import { CHROME, SERIES } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { fmtX, ratioKind, zoneStroke, type RatioPoint } from './commute'

const W = 260
const H = 64
const PAD = { l: 8, r: 46, t: 10, b: 16 }

export interface RatioSparklineProps {
  series: RatioPoint[]
  cityName: string
  className?: string
}

export function RatioSparkline({ series, cityName, className }: RatioSparklineProps) {
  const geom = useMemo(() => {
    if (series.length < 2) return null
    const years = series.map((d) => d.year)
    const vals = series.map((d) => d.ratio)
    const lo = Math.min(...vals, 1)
    const hi = Math.max(...vals, 1)
    const pad = (hi - lo) * 0.15 || 0.1
    const x = scaleLinear().domain([years[0], years[years.length - 1]]).range([PAD.l, W - PAD.r])
    const y = scaleLinear().domain([lo - pad, hi + pad]).range([H - PAD.b, PAD.t])
    const path = line<RatioPoint>()
      .x((d) => x(d.year))
      .y((d) => y(d.ratio))(series)
    return { x, y, path, first: series[0], last: series[series.length - 1] }
  }, [series])

  if (!geom) return null
  const { x, y, path, first, last } = geom
  const colour = zoneStroke(ratioKind(last.ratio))
  const drift = last.ratio - first.ratio
  // the 1× label gives way when the last value's label sits on the rule
  const ruleLabel = Math.abs(y(1) - y(last.ratio)) > 9

  return (
    <figure className={cn('min-w-0', className)}>
      <ChartFrame
        width={W}
        height={H}
        className="max-w-[300px]"
        role="img"
        aria-label={`${cityName}'s jobs per resident worker, ${first.year} to ${last.year}: from ${fmtX(first.ratio)} to ${fmtX(last.ratio)}.`}
      >
        <line x1={PAD.l} x2={W - PAD.r} y1={y(1)} y2={y(1)} stroke={SERIES.base} strokeDasharray="2 3" />
        {ruleLabel && (
          <text x={W - PAD.r + 4} y={y(1)} dy="0.35em" fontSize={9.5} fill={CHROME.inkSoft}>
            1×
          </text>
        )}
        {path && <path d={path} fill="none" stroke={colour} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />}
        <circle cx={x(last.year)} cy={y(last.ratio)} r={3} fill={colour} />
        <text x={x(last.year) + 6} y={y(last.ratio)} dy="0.35em" fontSize={10} fontWeight={700} fill={CHROME.ink} className="nums">
          {fmtX(last.ratio)}
        </text>
        <text x={PAD.l} y={H - 3} fontSize={9.5} fill={CHROME.inkSoft}>
          {first.year}
        </text>
        <text x={W - PAD.r} y={H - 3} textAnchor="end" fontSize={9.5} fill={CHROME.inkSoft}>
          {last.year}
        </text>
      </ChartFrame>
      <figcaption className="mt-0.5 text-xs text-ink-soft">
        {cityName}, {first.year}–{last.year}: {Math.abs(drift) < 0.1 ? 'roughly flat' : drift > 0 ? `up from ${fmtX(first.ratio)}` : `down from ${fmtX(first.ratio)}`}
      </figcaption>
    </figure>
  )
}
