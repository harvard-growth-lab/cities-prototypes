/* The population/wage index chart (design-spec §3.1, `drawSpark`): lines
   re-based to 100 at the window's start, the window shaded, end labels at
   the right, a crosshair with a card on hover. Sized to its column: the
   viewBox is the column's width × clamp(236, 0.42·w, 330), so one unit is
   one pixel and type stays readable at every width. */
import { line as d3Line, scaleLinear } from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AxisBottom, AxisLeft } from '@/components/charts/axis'
import { ChartFrame, useMeasure } from '@/components/charts/chart-frame'
import { useChartTooltip } from '@/components/charts/chart-tooltip'
import { CHROME, SERIES } from '@/lib/palette'
import { useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { labelMargin, layoutLabels, xTicksFor, yBounds } from './index-layout'
import { IndexTip } from './index-tip'
import { bandRate, dataExtent, indexPoints, rateMark, type ChartSeries, type IndexedPoint } from './series'

export interface IndexChartProps {
  series: ChartSeries[]
  /** the window: shaded, labelled, and the base year of the index */
  band: [number, number]
  /** "Population change since 2014" */
  title: string
  /** the count in the tooltip: fmtInt, fmtMoney… */
  format: (v: number) => string
  ariaLabel: string
  /** bump to replay the draw-in of the `drawIn` series */
  drawKey?: number
  className?: string
}

interface Drawn extends ChartSeries {
  pts: IndexedPoint[]
  last: IndexedPoint | undefined
}

const clampH = (w: number) => Math.min(330, Math.max(236, Math.round(w * 0.42)))
const DRAW_EASE = 'cubic-bezier(.32,.72,.24,1)'

export function IndexChart({ series, band, title, format, ariaLabel, drawKey = 0, className }: IndexChartProps) {
  const [hostRef, { width }] = useMeasure<HTMLDivElement>()
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  const tip = useChartTooltip(hostRef)
  const reduced = useReducedMotion()
  const w = Math.max(280, Math.round(width))
  const h = clampH(w)
  const [bandStart, bandEnd] = band

  const drawn = useMemo<Drawn[]>(
    () =>
      series.map((s) => {
        const pts = indexPoints(s.points, bandStart)
        return { ...s, pts, last: [...pts].reverse().find((p) => p.index !== null) }
      }),
    [series, bandStart],
  )
  const ext = useMemo(() => dataExtent(series), [series])

  // the right margin holds the longest label
  const longest = Math.max(10, ...series.map((s) => s.label?.length ?? 0))
  const m = { t: 30, r: Math.min(Math.round(w * 0.34), Math.max(w < 420 ? 86 : 100, labelMargin(longest))), b: 30, l: 44 }
  const x0 = ext?.[0] ?? bandStart
  const x1 = ext?.[1] ?? bandEnd
  const x = useMemo(() => scaleLinear().domain([x0, x1]).range([m.l, w - m.r]), [x0, x1, m.l, m.r, w])

  const { y, yTicks } = useMemo(() => {
    const { lo, hi, ticks } = yBounds(drawn.map((d) => d.pts))
    return { y: scaleLinear().domain([lo, hi]).range([h - m.b, m.t]), yTicks: ticks }
  }, [drawn, h, m.b, m.t])

  const xTicks = useMemo(() => xTicksFor(x0, x1, band, x), [x0, x1, band, x])

  const labels = useMemo(
    () =>
      layoutLabels(
        drawn.filter((d) => d.label && d.last).map((d) => ({ id: d.id, label: d.label!, y: y(d.last!.index!), withRate: d.rate !== undefined })),
        m.r,
        m.t,
        h - m.b + 4,
      ),
    [drawn, y, h, m.b, m.t, m.r],
  )

  const path = useMemo(
    () =>
      d3Line<IndexedPoint>()
        .x((p) => x(p.year))
        .y((p) => y(p.index ?? 0)),
    [x, y],
  )

  // the draw-in: one series at most; hidden until its first entry, replayed on each
  const drawRef = useRef<SVGPathElement>(null)
  const drawEndRef = useRef<SVGGElement>(null)
  const drawnKey = useRef(-1)
  useEffect(() => {
    const el = drawRef.current
    const end = drawEndRef.current
    if (!el) return
    if (reduced) {
      el.style.strokeDasharray = ''
      el.style.strokeDashoffset = ''
      if (end) end.style.opacity = ''
      return
    }
    const len = el.getTotalLength()
    el.style.transition = 'none'
    el.style.strokeDasharray = `${len}`
    if (drawKey === 0) {
      el.style.strokeDashoffset = `${len}`
      if (end) end.style.opacity = '0'
      return
    }
    if (drawKey === drawnKey.current) {
      el.style.strokeDashoffset = '0'
      return
    }
    drawnKey.current = drawKey
    el.style.strokeDashoffset = `${len}`
    if (end) {
      end.style.transition = 'none'
      end.style.opacity = '0'
    }
    el.getBoundingClientRect() // commit the hidden state before the transition starts
    el.style.transition = `stroke-dashoffset 1150ms ${DRAW_EASE}`
    el.style.strokeDashoffset = '0'
    if (end) {
      end.style.transition = 'opacity 300ms ease 950ms'
      end.style.opacity = '1'
    }
  }, [drawKey, reduced, w, h, drawn])

  const hovered = hoverYear !== null ? drawn.map((d) => d.pts.find((p) => p.year === hoverYear)) : []

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * w
    const year = Math.max(x0, Math.min(x1, Math.round(x.invert(px))))
    setHoverYear(year)
    const rows = drawn.map((d) => ({
      color: d.color,
      label: d.name,
      point: d.pts.find((p) => p.year === year),
      rate: d.rate ?? bandRate(d.points, bandStart, bandEnd),
    }))
    tip.show(e.clientX, e.clientY, <IndexTip year={year} rows={rows} band={band} format={format} />)
  }
  const onLeave = () => {
    setHoverYear(null)
    tip.hide()
  }

  return (
    <div ref={hostRef} className={cn('relative w-full', className)} style={{ minHeight: 236 }}>
      {width > 0 && (
        <ChartFrame width={w} height={h} role="img" aria-label={ariaLabel} style={{ height: h }}>
          <rect x={x(Math.max(x0, bandStart))} y={m.t - 10} width={Math.max(0, x(Math.min(x1, bandEnd)) - x(Math.max(x0, bandStart)))} height={h - m.b - m.t + 10} fill={SERIES.band} />
          <text x={x(Math.min(x1, bandEnd)) - 4} y={m.t - 16} textAnchor="end" fontSize={11} fontWeight={700} letterSpacing={0.6} fill={SERIES.tick}>
            {bandStart} to {bandEnd}
          </text>
          <text x={m.l - 40} y={m.t - 16} fontSize={11.5} fontWeight={600} fill={CHROME.inkSoft}>
            {title}
          </text>
          <AxisLeft
            scale={y}
            ticks={yTicks}
            x={m.l}
            grid={w - m.r - m.l}
            fontSize={11}
            tickFormat={(v) => (v === 100 ? '0%' : `${v > 100 ? '+' : '−'}${Math.abs(v - 100)}%`)}
          />
          <line x1={m.l} x2={w - m.r} y1={y(100)} y2={y(100)} stroke={SERIES.base} strokeDasharray="2 3" />
          <AxisBottom scale={x} ticks={xTicks} y={h - m.b} fontSize={11} tickFormat={(v) => String(v)} />
          {xTicks
            .filter((v) => v === bandStart || v === bandEnd)
            .map((v) => (
              <text key={v} x={x(v)} y={h - m.b + 18} textAnchor="middle" fontSize={11} fontWeight={700} fill={CHROME.ink} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                {v}
              </text>
            ))}

          {drawn.map((d) => {
            const solid = (p: IndexedPoint) => p.index !== null && !p.modelled
            const pre = d.lead ? path.defined((p) => solid(p) && p.year <= bandStart)(d.pts) : null
            const main = path.defined((p) => solid(p) && (!d.lead || p.year >= bandStart))(d.pts)
            const modelled = d.pts.some((p) => p.modelled) ? path.defined((p, i) => p.index !== null && Boolean(p.modelled || d.pts[i + 1]?.modelled))(d.pts) : null
            const lone = d.pts.filter((p, i) => p.index !== null && (d.pts[i - 1]?.index ?? null) === null && (d.pts[i + 1]?.index ?? null) === null)
            const common = { fill: 'none', stroke: d.color, strokeWidth: d.width, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
            return (
              <g key={d.id}>
                {pre && <path d={pre} {...common} strokeDasharray={d.dash} opacity={0.38} />}
                {main && <path ref={d.drawIn ? drawRef : undefined} d={main} {...common} strokeDasharray={d.dash} />}
                {modelled && <path d={modelled} {...common} strokeDasharray="4 3" />}
                {lone.map((p) => (
                  <circle key={p.year} cx={x(p.year)} cy={y(p.index!)} r={2.2} fill={d.color} />
                ))}
              </g>
            )
          })}

          {drawn.map((d) => {
            if (!d.last) return null
            const lab = labels.find((l) => l.id === d.id)
            const mark = d.rate !== undefined ? rateMark(d.rate) : null
            return (
              <g key={d.id} ref={d.drawIn ? drawEndRef : undefined}>
                <circle cx={x(d.last.year)} cy={y(d.last.index!)} r={d.lead ? 4.5 : 3.2} fill={d.color} />
                {lab && (
                  <text x={w - m.r + 8} y={lab.y} dy="0.36em" fontSize={12.5} fontWeight={700} fill={d.labelColor ?? d.color}>
                    {lab.lines.map((line, i) => (
                      <tspan key={i} x={w - m.r + 8} dy={i === 0 ? 0 : '1.1em'}>
                        {line}
                      </tspan>
                    ))}
                    {mark && (
                      <tspan x={w - m.r + 8} dy="1.15em" fontSize={11.5} fill={mark.tone === 'rise' ? CHROME.rise : mark.tone === 'fall' ? CHROME.fall : CHROME.inkSoft}>
                        {mark.text}
                      </tspan>
                    )}
                  </text>
                )}
              </g>
            )
          })}

          {hoverYear !== null && (
            <g pointerEvents="none">
              <line x1={x(hoverYear)} x2={x(hoverYear)} y1={m.t - 6} y2={h - m.b} stroke={CHROME.inkSoft} strokeDasharray="3 3" />
              {drawn.map((d, i) => {
                const p = hovered[i]
                return p && p.index !== null ? <circle key={d.id} cx={x(p.year)} cy={y(p.index)} r={4} fill="#fff" stroke={d.color} strokeWidth={2} /> : null
              })}
            </g>
          )}
          <rect x={m.l} y={m.t - 10} width={Math.max(0, w - m.r - m.l)} height={h - m.b - m.t + 10} fill="transparent" style={{ cursor: 'crosshair', touchAction: 'pan-y' }} onPointerMove={onMove} onPointerLeave={onLeave} />
        </ChartFrame>
      )}
      {tip.Tooltip}
    </div>
  )
}
