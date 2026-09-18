/* Beat 1's figure: every US metro by population growth (x) against wage
   growth (y), sized by population, split into four quarters by the medians.
   The home metro is the one coloured dot; its quarter carries the tint. */
import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { ChartFrame } from '@/components/charts/chart-frame'
import { useChartTooltip } from '@/components/charts/chart-tooltip'
import { CHROME, SCATTER } from '@/lib/palette'
import { useToolState } from '@/lib/use-tool-state'
import { H, HALO, nearest, PLOT, spanLabel, toUnits, TYPE, useScatterFrame, W, type MetroPoint } from './frame'
import { PointTip } from './point-tip'
import { ScatterFurniture } from './scatter-furniture'
import { ScatterShell } from './scatter-shell'

export function MetroScatter() {
  const { index, summary } = useToolState()
  const frame = useScatterFrame(index, summary.id)
  const { points, home, x, y, r } = frame
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tip = useChartTooltip(wrapRef)
  const [hover, setHover] = useState<MetroPoint | null>(null)

  const at = useCallback((d: MetroPoint): [number, number, number] => [x(d.x), y(d.y), r(d.m.population ?? 0)], [x, y, r])

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const [px, py] = toUnits(svg, e.clientX, e.clientY)
    const d = nearest(points, px, py, at)
    if (!d) {
      if (hover) setHover(null)
      tip.hide()
      return
    }
    if (d !== hover) setHover(d)
    const note = d.m.wageYears && spanLabel(index.window, d.m.wageYears) !== spanLabel(index.window) ? `wages read ${spanLabel(index.window, d.m.wageYears)}` : undefined
    const content = <PointTip name={d.m.displayName} popCagr={d.m.popCagr} wageCagr={d.m.wageCagr} quadrant={d.m.quadrant} borderline={d.m.borderline} note={note} />
    if (tip.visible && d === hover) tip.move(e.clientX, e.clientY)
    else tip.show(e.clientX, e.clientY, content)
  }
  const onLeave = () => {
    setHover(null)
    tip.hide()
  }

  // the home label flips to the left when the dot sits near the right edge
  const homeR = home ? r(home.m.population ?? 0) : 0
  const homeRight = home ? x(home.x) + homeR + 10 + 110 > PLOT.x1 : false

  return (
    <ScatterShell wrapRef={wrapRef} tooltip={tip.Tooltip}>
      <ChartFrame
        ref={svgRef}
        width={W}
        height={H}
        role="img"
        aria-label={`US metros plotted by population growth against wage growth, ${spanLabel(index.window)}, with ${summary.displayName} highlighted`}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="touch-pan-y"
      >
        <ScatterFurniture frame={frame} quadrant={summary.quadrant} popSpan={spanLabel(index.window, summary.popYears)} wageSpan={spanLabel(index.window, summary.wageYears)} />
        <g>
          {points.map((d) => {
            const [cx, cy, rad] = at(d)
            const on = d === hover
            return (
              <circle
                key={d.m.id}
                cx={cx}
                cy={cy}
                r={on ? rad + 1.5 : rad}
                fill={d.home ? SCATTER.home : SCATTER.field}
                opacity={d.home || on ? 1 : 0.55}
                stroke={on ? CHROME.ink : 'none'}
                strokeWidth={1.2}
              />
            )
          })}
        </g>
        {home && (
          <>
            {/* a small metro's dot is a speck; the ring makes it findable without inflating it */}
            <circle cx={x(home.x)} cy={y(home.y)} r={homeR + 4} fill="none" stroke={SCATTER.home} strokeWidth={1.2} opacity={0.55} pointerEvents="none" />
            <text
              x={homeRight ? x(home.x) - homeR - 10 : x(home.x) + homeR + 10}
              y={y(home.y) + 5}
              textAnchor={homeRight ? 'end' : 'start'}
              fill={SCATTER.home}
              className={TYPE.home}
              style={HALO}
            >
              {summary.name}
            </text>
          </>
        )}
      </ChartFrame>
    </ScatterShell>
  )
}
