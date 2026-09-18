/* Beat 3's first figure: every metro's home-value growth on one line, the
   median named as the typical metro, the home metro picked out. This is
   the split the atlas makes among supply-side metros: cost, or the place.
   On a phone the strip is drawn in a 440-unit frame instead of 880: a
   one-dimensional figure has no width to protect, and halving the frame
   keeps its dots and type at a readable size. */
import { useCallback, useMemo, useRef, useState, type PointerEvent } from 'react'
import { extent, scaleLinear } from 'd3'
import { AxisBottom } from '@/components/charts/axis'
import { ChartFrame } from '@/components/charts/chart-frame'
import { TipHead, TipRow, useChartTooltip } from '@/components/charts/chart-tooltip'
import type { MetroSummary } from '@/data/types'
import { fmtRate } from '@/lib/format'
import { CHROME, SCATTER } from '@/lib/palette'
import { useIsPhone } from '@/lib/use-media-query'
import { useToolState } from '@/lib/use-tool-state'
import { HALO, nearest, TYPE } from './frame'

const H = 120
const L = 30
const R = 30
const BAND = { y0: 40, y1: 86 }
const AXIS_Y = 96
/** in-SVG type for the phone frame, which needs no responsive step-up */
const PHONE_TYPE = { tick: 'fill-ink text-[13px]', typical: 'fill-ink-soft text-[12px] italic', home: 'text-[14px] font-semibold' } as const

interface CostPoint {
  m: MetroSummary
  x: number
  jitter: number
}

/** A deterministic scatter down the band, so the strip reads the same on every visit. */
const jitterOf = (i: number) => ((i * 7919) % 97) / 96

export function CostGrowthStrip() {
  const { index, summary } = useToolState()
  const phone = useIsPhone()
  const W = phone ? 440 : 880
  const type = phone ? PHONE_TYPE : TYPE
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tip = useChartTooltip(wrapRef)
  const [hover, setHover] = useState<CostPoint | null>(null)

  const { points, x, home } = useMemo(() => {
    const points: CostPoint[] = index.metros
      .filter((m) => m.costCagr !== null)
      .map((m, i) => ({ m, x: (m.costCagr ?? 0) * 100, jitter: jitterOf(i) }))
      .sort((a, b) => Number(a.m.id === summary.id) - Number(b.m.id === summary.id))
    const [lo, hi] = extent(points, (d) => d.x)
    const x = scaleLinear()
      .domain([lo ?? 0, hi ?? 10])
      .nice()
      .range([L, W - R])
    return { points, x, home: points.find((d) => d.m.id === summary.id) }
  }, [index, summary.id, W])

  const at = useCallback((d: CostPoint): [number, number, number] => [x(d.x), BAND.y0 + d.jitter * (BAND.y1 - BAND.y0), d.m.id === summary.id ? 6 : 3.5], [x, summary.id])

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const py = ((e.clientY - rect.top) / rect.height) * H
    const d = nearest(points, px, py, at, 10)
    if (!d) {
      if (hover) setHover(null)
      tip.hide()
      return
    }
    if (d !== hover) setHover(d)
    const content = (
      <>
        <TipHead>{d.m.displayName}</TipHead>
        <TipRow label="Home values" value={fmtRate(d.m.costCagr)} />
        <TipRow label="Typical metro" value={fmtRate(index.medians.costCagr)} />
      </>
    )
    if (tip.visible && d === hover) tip.move(e.clientX, e.clientY)
    else tip.show(e.clientX, e.clientY, content)
  }

  const medX = x(index.medians.costCagr * 100)
  const medLeft = medX > W / 2
  const years = `${index.window.start}–${index.window.end}`

  return (
    <div ref={wrapRef} className="relative mt-3 w-full max-w-[880px] max-sm:-mx-[14px] max-sm:w-[calc(100%+28px)]">
      <ChartFrame
        ref={svgRef}
        width={W}
        height={H}
        role="img"
        aria-label={`Every metro's annual home-value growth ${years} on one line, with the typical metro marked and ${summary.displayName} highlighted`}
        onPointerMove={onMove}
        onPointerLeave={() => {
          setHover(null)
          tip.hide()
        }}
        className="touch-pan-y"
      >
        <line x1={L} x2={W - R} y1={AXIS_Y} y2={AXIS_Y} stroke={CHROME.ink} />
        <AxisBottom scale={x} tickCount={phone ? 5 : 8} tickFormat={(t) => `${t}%`} line={false} y={AXIS_Y} className={type.tick} />
        <line x1={medX} x2={medX} y1={26} y2={AXIS_Y} stroke={CHROME.ink} strokeWidth={1.5} strokeDasharray="6 5" />
        <text x={medLeft ? medX - 8 : medX + 8} y={20} textAnchor={medLeft ? 'end' : 'start'} className={type.typical}>
          Typical home-value growth {fmtRate(index.medians.costCagr)}
        </text>
        <g>
          {points.map((d) => {
            const [cx, cy, r] = at(d)
            const isHome = d.m.id === summary.id
            const hot = d === hover
            return <circle key={d.m.id} cx={cx} cy={cy} r={hot ? r + 1.5 : r} fill={isHome ? SCATTER.home : SCATTER.field} opacity={isHome || hot ? 1 : 0.55} stroke={hot ? CHROME.ink : 'none'} strokeWidth={1.2} />
          })}
        </g>
        {home && (
          <text
            x={x(home.x) + (x(home.x) > W - 160 ? -10 : 10)}
            y={BAND.y0 + home.jitter * (BAND.y1 - BAND.y0) + 5}
            textAnchor={x(home.x) > W - 160 ? 'end' : 'start'}
            fill={SCATTER.home}
            className={type.home}
            style={HALO}
          >
            {summary.name} {fmtRate(home.m.costCagr)}
          </text>
        )}
      </ChartFrame>
      {tip.Tooltip}
    </div>
  )
}
