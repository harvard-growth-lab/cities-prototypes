/* Axes as React SVG over d3 scales. Colours from the population chart's
   furniture (palette.SERIES): grid #e9e9eb, axis #8e9196, ticks #72767b. */
import { SERIES } from '@/lib/palette'

type Domain = number | string | Date

/** What the axes need from a d3 scale (linear, time, point or band). */
export interface AxisScale<D extends Domain> {
  (d: D): number | undefined
  domain(): D[]
  range(): number[]
  ticks?(count?: number): D[]
  bandwidth?(): number
}

interface AxisProps<D extends Domain> {
  scale: AxisScale<D>
  ticks?: D[]
  tickCount?: number
  tickFormat?: (d: D, i: number) => string
  /** draw gridlines this far across the plot (bottom: up; left: right) */
  grid?: number
  /** the axis line itself */
  line?: boolean
  fontSize?: number
  className?: string
}

function tickValues<D extends Domain>(scale: AxisScale<D>, ticks?: D[], count?: number): D[] {
  if (ticks) return ticks
  if (scale.ticks) return scale.ticks(count)
  return scale.domain()
}

function pos<D extends Domain>(scale: AxisScale<D>, d: D) {
  const v = scale(d) ?? 0
  return scale.bandwidth ? v + scale.bandwidth() / 2 : v
}

const fmt = <D extends Domain>(d: D, i: number, f?: (d: D, i: number) => string) => (f ? f(d, i) : String(d))

/** Ticks along the bottom edge; place with `y` (the baseline). */
export function AxisBottom<D extends Domain>({ scale, ticks, tickCount, tickFormat, grid, line = true, fontSize = 11.5, className, y = 0 }: AxisProps<D> & { y?: number }) {
  const [r0, r1] = scale.range()
  return (
    <g transform={`translate(0,${y})`} className={className} fontSize={fontSize} fill={SERIES.tick}>
      {line && <line x1={r0} x2={r1} stroke={SERIES.axis} />}
      {tickValues(scale, ticks, tickCount).map((d, i) => {
        const x = pos(scale, d)
        return (
          <g key={i} transform={`translate(${x},0)`}>
            {grid !== undefined && <line y1={0} y2={-grid} stroke={SERIES.grid} />}
            <line y1={0} y2={5} stroke={SERIES.axis} />
            <text y={18} textAnchor="middle">
              {fmt(d, i, tickFormat)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Ticks along the left edge; place with `x`. */
export function AxisLeft<D extends Domain>({ scale, ticks, tickCount, tickFormat, grid, line = false, fontSize = 11.5, className, x = 0 }: AxisProps<D> & { x?: number }) {
  const [r0, r1] = scale.range()
  return (
    <g transform={`translate(${x},0)`} className={className} fontSize={fontSize} fill={SERIES.tick}>
      {line && <line y1={r0} y2={r1} stroke={SERIES.axis} />}
      {tickValues(scale, ticks, tickCount).map((d, i) => {
        const y = pos(scale, d)
        return (
          <g key={i} transform={`translate(0,${y})`}>
            {grid !== undefined && <line x1={0} x2={grid} stroke={SERIES.grid} />}
            <text x={-8} dy="0.32em" textAnchor="end">
              {fmt(d, i, tickFormat)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Gridlines alone (e.g. behind bars), horizontal for a y scale, vertical for an x scale. */
export function Gridlines<D extends Domain>({ scale, orientation, length, ticks, tickCount, dashed, className }: { scale: AxisScale<D>; orientation: 'horizontal' | 'vertical'; length: number; ticks?: D[]; tickCount?: number; dashed?: boolean; className?: string }) {
  return (
    <g className={className} stroke={SERIES.grid} strokeDasharray={dashed ? '2 3' : undefined}>
      {tickValues(scale, ticks, tickCount).map((d, i) => {
        const p = pos(scale, d)
        return orientation === 'horizontal' ? <line key={i} x1={0} x2={length} y1={p} y2={p} /> : <line key={i} x1={p} x2={p} y1={0} y2={length} />
      })}
    </g>
  )
}
