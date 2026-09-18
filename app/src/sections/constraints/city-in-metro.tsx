/* Beat 2's figure: the same plane, but the metro dot breaks apart into the
   places that make it up. The field of other metros clears out, the dot
   collapses into a dashed ring on its spot (the metro as a whole, so every
   place can still be read against it), and the places spill out of that
   point to their own rates. Geometry moves on CSS transitions, staged by
   delay; under reduced motion the final frame is shown at once. */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { max, scaleSqrt } from 'd3'
import { ChartFrame } from '@/components/charts/chart-frame'
import { useChartTooltip } from '@/components/charts/chart-tooltip'
import { Button } from '@/components/ui/button'
import type { PlaceRow } from '@/data/types'
import { CHROME, SCATTER } from '@/lib/palette'
import { getScroller } from '@/lib/scroller'
import { useReducedMotion } from '@/lib/use-media-query'
import { useToolState } from '@/lib/use-tool-state'
import { clampInPlot, H, HALO, nearest, PLOT, spanLabel, toUnits, TYPE, useScatterFrame, W, type MetroPoint, type ScatterFrame } from './frame'
import { PointTip } from './point-tip'
import { ScatterFurniture } from './scatter-furniture'
import { ScatterShell } from './scatter-shell'

const EASE = 'cubic-bezier(0.215, 0.61, 0.355, 1)'
const FLIGHT = 900
/** the field of other metros, the home label, the dot shrinking, the ring: the stages before any place moves */
const FIRST = { home: 560, rest: 660 }

interface PlaceDot {
  p: PlaceRow
  x: number
  y: number
  r: number
  home: boolean
  delay: number
}

export interface CityInMetroBurstProps {
  /** the places to burst into (rows with both readings) */
  places: PlaceRow[]
}

/** The metro field, memoised: it only ever fades as a group. */
const Field = memo(function Field({ points, frame }: { points: MetroPoint[]; frame: ScatterFrame }) {
  return (
    <>
      {points.map((d) => (
        <circle key={d.m.id} cx={frame.x(d.x)} cy={frame.y(d.y)} r={frame.r(d.m.population ?? 0)} fill={SCATTER.field} opacity={0.55} />
      ))}
    </>
  )
})

export function CityInMetroBurst({ places }: CityInMetroBurstProps) {
  const { index, summary, placeId, metroName, cityName } = useToolState()
  const frame = useScatterFrame(index, summary.id)
  const { x, y, r, home } = frame
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tip = useChartTooltip(wrapRef)

  const [phase, setPhase] = useState<'start' | 'run'>(reduced ? 'run' : 'start')
  const [still, setStill] = useState(false)
  const [settled, setSettled] = useState(reduced)
  const [hover, setHover] = useState<PlaceDot | null>(null)
  const timers = useRef<number[]>([])

  const field = useMemo(() => frame.points.filter((d) => !d.home), [frame])
  // the metro's own point; a metro without rates bursts from the plot's centre
  const mx = home ? x(home.x) : (PLOT.x0 + PLOT.x1) / 2
  const my = home ? y(home.y) : (PLOT.y0 + PLOT.y1) / 2
  const mr = home ? r(home.m.population ?? 0) : 6

  const dots = useMemo<PlaceDot[]>(() => {
    const pr = scaleSqrt()
      .domain([0, max(places, (p) => p.population ?? 0) ?? 1])
      .range([2.5, 13])
    const rows = [...places].sort((a, b) => Number(a.id === placeId) - Number(b.id === placeId) || (b.population ?? 0) - (a.population ?? 0))
    // 16ms between places, squeezed so a metro of hundreds still lands inside ~1.3s
    const step = Math.min(16, 640 / Math.max(1, rows.length))
    return rows.map((p, i) => ({
      p,
      x: clampInPlot(x, (p.popCagr ?? 0) * 100),
      y: clampInPlot(y, (p.wageCagr ?? 0) * 100),
      r: pr(p.population ?? 0),
      home: p.id === placeId,
      delay: p.id === placeId ? FIRST.home : FIRST.rest + i * step,
    }))
  }, [places, placeId, x, y])
  const city = dots.find((d) => d.home)
  const lastLanding = dots.reduce((t, d) => Math.max(t, d.delay), FIRST.rest) + FLIGHT
  // the ring stands for the metro; it also encloses any place that lands on the metro's own point
  const ringR = dots.reduce((rr, d) => {
    const dist = Math.hypot(d.x - mx, d.y - my)
    return dist < mr + 7 ? Math.max(rr, dist + d.r + 4) : rr
  }, mr + 7)

  const run = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t)
    timers.current = []
    setHover(null)
    if (reduced) {
      setPhase('run')
      setSettled(true)
      return
    }
    setStill(true)
    setPhase('start')
    setSettled(false)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setStill(false)
        setPhase('run')
      }),
    )
    timers.current.push(window.setTimeout(() => setSettled(true), lastLanding + 80))
  }, [reduced, lastLanding])

  // play once when the figure first scrolls into view, then on each Replay
  useEffect(() => {
    const el = wrapRef.current
    if (!el || reduced) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        timers.current.push(window.setTimeout(run, 350))
      },
      { root: getScroller(), threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [run, reduced])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const at = useCallback((d: PlaceDot): [number, number, number] => [d.x, d.y, d.r], [])
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || !settled) return
    const [px, py] = toUnits(svg, e.clientX, e.clientY)
    const d = nearest(dots, px, py, at)
    if (!d) {
      if (hover) setHover(null)
      tip.hide()
      return
    }
    if (d !== hover) setHover(d)
    if (tip.visible && d === hover) tip.move(e.clientX, e.clientY)
    else tip.show(e.clientX, e.clientY, <PointTip name={d.p.name} popCagr={d.p.popCagr} wageCagr={d.p.wageCagr} quadrant={d.p.quadrant} borderline={d.p.borderline} />)
  }

  const on = phase === 'run'
  const tr = (spec: string) => (still || reduced ? 'none' : spec)
  const homeLeft = mx + mr + 10 + 110 > PLOT.x1
  const labelLeft = mx + ringR + 8 + 100 > PLOT.x1
  // when the admin city lands beside the ring, the ring's label moves above or
  // below it (whichever side the city is not) and the city's label goes on
  // whichever side the ring is not
  const nearRing = city ? Math.hypot(city.x - mx, city.y - my) < 60 : false
  const ringLabelY = !nearRing ? my + 4 : city && city.y > my ? my - ringR - 6 : my + ringR + 15
  const cityLeft = city ? (nearRing && mx > city.x) || city.x + city.r + 10 + 100 > PLOT.x1 : false

  return (
    <ScatterShell
      wrapRef={wrapRef}
      tooltip={tip.Tooltip}
      controls={
        <Button type="button" variant="outline" size="sm" onClick={run} className="ml-auto rounded-[4px] border-teal bg-transparent px-3 text-xs font-semibold text-teal hover:bg-teal hover:text-white">
          Replay
        </Button>
      }
    >
      <ChartFrame
        ref={svgRef}
        width={W}
        height={H}
        role="img"
        aria-label={`The ${summary.displayName} metro dot breaking apart into the ${dots.length} places inside it, plotted by population growth against wage growth`}
        onPointerMove={onMove}
        onPointerLeave={() => {
          setHover(null)
          tip.hide()
        }}
        className="touch-pan-y"
      >
        <ScatterFurniture frame={frame} quadrant={summary.quadrant} popSpan={spanLabel(index.window, summary.popYears)} wageSpan={spanLabel(index.window, summary.wageYears)} />
        <g style={{ opacity: on ? 0 : 1, transition: tr('opacity 520ms ease') }}>
          <Field points={field} frame={frame} />
        </g>
        {home && (
          <g style={{ opacity: on ? 0 : 1, transition: tr('opacity 340ms ease 320ms') }}>
            <circle cx={mx} cy={my} r={mr + 4} fill="none" stroke={SCATTER.home} strokeWidth={1.2} opacity={0.55} />
            <circle cx={mx} cy={my} r={mr} fill={SCATTER.home} style={{ r: on ? 0 : mr, transition: tr('r 340ms ease 320ms') }} />
            <text
              x={homeLeft ? mx - mr - 10 : mx + mr + 10}
              y={my + 5}
              textAnchor={homeLeft ? 'end' : 'start'}
              fill={SCATTER.home}
              className={TYPE.home}
              style={{ ...HALO, opacity: on ? 0 : 1, transition: tr('opacity 320ms ease') }}
            >
              {summary.name}
            </text>
          </g>
        )}
        <g>
          {dots.map((d) => {
            const hot = d === hover
            return (
              <circle
                key={d.p.id}
                cx={mx}
                cy={my}
                r={0}
                fill={d.home ? SCATTER.home : SCATTER.place}
                stroke={hot ? CHROME.ink : 'none'}
                strokeWidth={1.2}
                style={{
                  cx: on ? d.x : mx,
                  cy: on ? d.y : my,
                  r: on ? d.r + (hot ? 1.5 : 0) : 0,
                  opacity: on ? 1 : 0,
                  transition: settled
                    ? tr('r 120ms ease')
                    : tr(`cx ${FLIGHT}ms ${EASE} ${d.delay}ms, cy ${FLIGHT}ms ${EASE} ${d.delay}ms, r ${FLIGHT}ms ${EASE} ${d.delay}ms, opacity ${FLIGHT}ms ${EASE} ${d.delay}ms`),
                }}
              />
            )
          })}
        </g>
        <g pointerEvents="none" style={{ opacity: on ? 1 : 0, transition: tr('opacity 300ms ease 520ms') }}>
          <circle cx={mx} cy={my} r={ringR} fill="none" stroke={CHROME.geoMetro} strokeWidth={1.4} strokeDasharray="4 4" />
          <text
            x={nearRing ? mx : labelLeft ? mx - ringR - 8 : mx + ringR + 8}
            y={ringLabelY}
            textAnchor={nearRing ? 'middle' : labelLeft ? 'end' : 'start'}
            fill={CHROME.geoMetro}
            className={TYPE.label}
            style={HALO}
          >
            {metroName} metro
          </text>
        </g>
        {city && (
          <text
            x={cityLeft ? city.x - city.r - 10 : city.x + city.r + 10}
            y={city.y + 5}
            textAnchor={cityLeft ? 'end' : 'start'}
            fill={SCATTER.home}
            className={TYPE.home}
            style={{ ...HALO, opacity: on ? 1 : 0, transition: tr('opacity 400ms ease 1400ms') }}
          >
            {cityName}
          </text>
        )}
      </ChartFrame>
    </ScatterShell>
  )
}
