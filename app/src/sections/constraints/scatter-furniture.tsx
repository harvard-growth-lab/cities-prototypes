/* The plane's furniture, drawn once for both scatters: the tinted quarter
   the section argues about, the hatched borderline band, dashed grid, ink
   axes, the two medians named in place ("typical" is what the crosshair
   means, and saying so beats a legend), and the axis titles. */
import { useId } from 'react'
import { AxisBottom, AxisLeft, Gridlines } from '@/components/charts/axis'
import type { Quadrant } from '@/data/types'
import { CHROME } from '@/lib/palette'
import { QUADRANT_CORNER } from '@/lib/quadrants'
import { cn } from '@/lib/utils'
import { H, PLOT, TYPE, type ScatterFrame } from './frame'

export interface ScatterFurnitureProps {
  frame: ScatterFrame
  /** the quarter to tint — the home metro's */
  quadrant: Quadrant | null
  /** "2014–2024" for each axis title */
  popSpan: string
  wageSpan: string
}

const GRID = 'stroke-line [stroke-dasharray:3_4]'

export function ScatterFurniture({ frame, quadrant, popSpan, wageSpan }: ScatterFurnitureProps) {
  const { x, y, med } = frame
  const hatch = useId()
  const mx = x(med.x)
  const my = y(med.y)
  const corner = quadrant ? QUADRANT_CORNER[quadrant] : null
  const tint = corner && {
    x: corner.endsWith('l') ? PLOT.x0 : mx,
    y: corner.startsWith('t') ? PLOT.y1 : my,
    width: corner.endsWith('l') ? mx - PLOT.x0 : PLOT.x1 - mx,
    height: corner.startsWith('t') ? my - PLOT.y1 : PLOT.y0 - my,
  }
  const band = {
    x: x(med.x - med.xBand),
    width: x(med.x + med.xBand) - x(med.x - med.xBand),
    y: y(med.y + med.yBand),
    height: y(med.y - med.yBand) - y(med.y + med.yBand),
  }

  return (
    <g aria-hidden>
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={CHROME.inkSoft} strokeWidth="0.8" />
        </pattern>
      </defs>
      {tint && <rect {...tint} fill={CHROME.orangeTint} opacity={0.55} />}
      <rect {...band} fill={`url(#${hatch})`} opacity={0.4} />

      {/* Gridlines run from the origin; shift them so they span the plot only */}
      <g transform={`translate(0,${PLOT.y1})`}>
        <Gridlines scale={x} orientation="vertical" length={PLOT.y0 - PLOT.y1} tickCount={6} className={GRID} />
      </g>
      <g transform={`translate(${PLOT.x0},0)`}>
        <Gridlines scale={y} orientation="horizontal" length={PLOT.x1 - PLOT.x0} tickCount={6} className={GRID} />
      </g>

      <AxisBottom scale={x} tickCount={6} tickFormat={(t) => `${t}%`} line={false} y={PLOT.y0} className={cn(TYPE.tick, '[&_line]:stroke-ink')} />
      <AxisLeft scale={y} tickCount={6} tickFormat={(t) => `${t.toFixed(1)}%`} line={false} x={PLOT.x0} className={TYPE.tick} />
      <line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y1} y2={PLOT.y0} stroke={CHROME.ink} />
      <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y0} y2={PLOT.y0} stroke={CHROME.ink} />

      <g stroke={CHROME.ink} strokeWidth={1.5} strokeDasharray="6 5">
        <line x1={mx} x2={mx} y1={PLOT.y1} y2={PLOT.y0} />
        <line x1={PLOT.x0} x2={PLOT.x1} y1={my} y2={my} />
      </g>
      <text x={mx} y={PLOT.y1 - 10} textAnchor="middle" className={TYPE.typical}>
        Typical population growth
      </text>
      <path d={`M${mx - 4} ${PLOT.y1 - 6}L${mx + 4} ${PLOT.y1 - 6}L${mx} ${PLOT.y1}Z`} fill={CHROME.inkSoft} />
      <text x={PLOT.x1 - 10} y={my - 8} textAnchor="end" className={TYPE.typical}>
        Typical wage growth
      </text>
      <path d={`M${PLOT.x1} ${my - 4}L${PLOT.x1} ${my + 4}L${PLOT.x1 - 5} ${my}Z`} fill={CHROME.inkSoft} />

      <text x={(PLOT.x0 + PLOT.x1) / 2} y={H - 14} textAnchor="middle" className={TYPE.title}>
        Population growth (annual rate, {popSpan})
      </text>
      <text transform="rotate(-90)" x={-(PLOT.y1 + PLOT.y0) / 2} y={24} textAnchor="middle" className={TYPE.title}>
        Wage growth (annual rate, {wageSpan})
      </text>
    </g>
  )
}
