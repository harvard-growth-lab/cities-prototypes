/* The industry space, read for one metro (880×520): every industry the
   metro does not yet have, by how related it is to what the metro already
   does (x) and how complex it is (y); dot area = national employment,
   colour = sector. The top eight by density × PCI are named. */
import { extent, scaleLinear, scaleSqrt } from 'd3'
import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { AxisBottom, AxisLeft } from '@/components/charts/axis'
import { ChartFrame } from '@/components/charts/chart-frame'
import { TipHead, TipRow, useChartTooltip } from '@/components/charts/chart-tooltip'
import { Legend } from '@/components/charts/legend'
import { SECTORS } from '@/data/sectors'
import { fmtInt } from '@/lib/format'
import { CHROME, SECTOR_COLOR, TIER_LABEL } from '@/lib/palette'
import { useIsNarrow, useIsPhone, useReducedMotion } from '@/lib/use-media-query'
import { fixed, type Opportunity } from './levers-data'
import { Seg } from './seg'

const W = 880
const H = 520
const M = { top: 18, right: 22, bottom: 62, left: 64 }
const X0 = M.left
const X1 = W - M.right
const Y0 = M.top
const Y1 = H - M.bottom
const LABELS = 8
const FONT = 11.5

export type Show = 'all' | 'traded'

interface Dot extends Opportunity {
  x: number
  y: number
  r: number
}

interface Placed {
  dot: Dot
  x: number
  y: number
  anchor: 'start' | 'end'
  text: string
}

const fx1 = (d: number) => fixed(d, 1)
/** Long NAICS names lose their tail at a word break; the tooltip and the table keep the whole name. */
const shorten = (s: string, max = 44) => {
  if (s.length <= max) return s
  const cut = s.lastIndexOf(' ', max - 1)
  return `${s.slice(0, cut > 16 ? cut : max - 1)}…`
}

/** Right of the dot, else left, else above or below (one or two lines away); skip when nothing fits. */
function placeLabels(dots: Dot[], font: number): Placed[] {
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = []
  const out: Placed[] = []
  for (const dot of dots) {
    const text = shorten(dot.name)
    const w = text.length * font * 0.5
    const h = font
    const tries: { x: number; y: number; anchor: 'start' | 'end' }[] = [
      { x: dot.x + dot.r + 4, y: dot.y + 4, anchor: 'start' },
      { x: dot.x - dot.r - 4, y: dot.y + 4, anchor: 'end' },
      { x: dot.x, y: dot.y - dot.r - 4, anchor: 'start' },
      { x: dot.x, y: dot.y + dot.r + h, anchor: 'start' },
      { x: dot.x, y: dot.y - dot.r - 4, anchor: 'end' },
      { x: dot.x, y: dot.y + dot.r + h, anchor: 'end' },
      { x: dot.x, y: dot.y - dot.r - 4 - h, anchor: 'start' },
      { x: dot.x, y: dot.y + dot.r + 2 * h, anchor: 'start' },
    ]
    for (const t of tries) {
      const x0 = t.anchor === 'start' ? t.x : t.x - w
      const x1 = x0 + w
      const y0 = t.y - h
      const y1 = t.y + 2
      if (x0 < X0 || x1 > X1 || y0 < Y0 || y1 > Y1) continue
      if (boxes.some((b) => x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0)) continue
      boxes.push({ x0, x1, y0, y1 })
      out.push({ dot, ...t, text })
      break
    }
  }
  return out
}

export interface OpportunityChartProps {
  opportunities: Opportunity[]
  metroName: string
}

export function OpportunityChart({ opportunities, metroName }: OpportunityChartProps) {
  const [show, setShow] = useState<Show>('all')
  const [hover, setHover] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tip = useChartTooltip(wrapRef)
  const reduced = useReducedMotion()
  // in-SVG type steps up as the plot narrows (design-spec §5): ×1.2 once the
  // measure drops under 920px, ×1.3 under 640px where the plot pans at a 660px floor
  const phone = useIsPhone()
  const narrow = useIsNarrow()
  const k = phone ? 1.3 : narrow ? 1.2 : 1
  const font = FONT * k

  // scales are fixed on the whole absent set so the toggle never rescales the plot
  const { x, y, r } = useMemo(() => {
    const [p0, p1] = extent(opportunities, (d) => d.pci)
    const maxJobs = Math.max(1, ...opportunities.map((d) => d.nationalJobs ?? 0))
    return {
      x: scaleLinear().domain([0, Math.max(1, ...opportunities.map((d) => d.density))]).range([X0, X1]),
      y: scaleLinear().domain([p0 ?? -1, p1 ?? 1]).nice().range([Y1, Y0]),
      r: scaleSqrt().domain([0, maxJobs]).range([2.5, 22]),
    }
  }, [opportunities])

  const dots = useMemo<Dot[]>(
    () =>
      opportunities
        .filter((d) => show === 'all' || d.tier === 'traded')
        .map((d) => ({ ...d, x: x(d.density), y: y(d.pci), r: d.nationalJobs === null ? 3 : r(d.nationalJobs) })),
    [opportunities, show, x, y, r],
  )
  const drawn = useMemo(() => [...dots].sort((a, b) => b.r - a.r), [dots])
  const labels = useMemo(() => placeLabels(dots.slice(0, LABELS), font), [dots, font])
  const named = useMemo(() => new Set(labels.map((l) => l.dot.code)), [labels])
  const sectors = useMemo(() => SECTORS.filter((s) => dots.some((d) => d.sector === s)), [dots])

  // the nearest dot within 24 screen px (or under the pointer inside a big dot);
  // fires on move for a mouse and on pointerdown so a tap inspects a dot too
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const box = svg.getBoundingClientRect()
    const scale = box.width / W
    const vx = (e.clientX - box.left) / scale
    const vy = (e.clientY - box.top) / scale
    let best: Dot | null = null
    let bestD = Infinity
    for (const d of dots) {
      const dist = Math.hypot(d.x - vx, d.y - vy)
      if (dist < bestD) {
        bestD = dist
        best = d
      }
    }
    if (best && (bestD * scale <= 24 || bestD <= best.r)) {
      setHover(best.code)
      tip.show(e.clientX, e.clientY, <DotTip d={best} />)
    } else {
      setHover(null)
      tip.hide()
    }
  }
  const onLeave = () => {
    setHover(null)
    tip.hide()
  }

  const yTicks = y.ticks(6)
  const zero = y(0)
  const label = `${dots.length} industries the ${metroName} metro does not yet have${show === 'traded' ? ' (traded only)' : ''}, by relatedness density (x) and complexity (y); dot area is national employment, colour is sector. Named: ${labels.map((l) => l.dot.name).join(', ')}.`

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Seg<Show>
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: 'All' },
            { value: 'traded', label: 'Traded only' },
          ]}
        />
        <span className="nums text-xs text-ink-soft">
          {dots.length} absent industries · dot area = national jobs · the top {Math.min(LABELS, dots.length)} by density × PCI are named
        </span>
      </div>
      <div ref={wrapRef} className="relative">
        <div className="overflow-x-auto max-sm:-mx-3.5 max-sm:px-3.5">
          <ChartFrame
            ref={svgRef}
            width={W}
            height={H}
            role="img"
            aria-label={label}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={onLeave}
            className="select-none max-sm:min-w-[660px]"
          >
            <AxisLeft scale={y} ticks={yTicks} tickFormat={fx1} grid={X1 - X0} x={X0} fontSize={12 * k} />
            <AxisBottom scale={x} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormat={fx1} y={Y1} fontSize={12 * k} />
            {zero >= Y0 && zero <= Y1 && (
              <g>
                <line x1={X0} x2={X1} y1={zero} y2={zero} stroke={CHROME.lineStrong} strokeWidth={1} />
                <text x={X1} y={zero - 4} textAnchor="end" fontSize={11 * k} fill={CHROME.inkSoft}>
                  PCI 0 = average complexity
                </text>
              </g>
            )}
            <text x={(X0 + X1) / 2} y={H - 14} textAnchor="middle" fontSize={13 * k} fontWeight={600} fill={CHROME.ink}>
              Relatedness density →
            </text>
            <text transform={`translate(16,${(Y0 + Y1) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13 * k} fontWeight={600} fill={CHROME.ink}>
              Complexity (PCI) ↑
            </text>
            <g>
              {drawn.map((d) => {
                const on = hover === d.code
                return (
                  <circle
                    key={d.code}
                    cx={d.x}
                    cy={d.y}
                    r={on ? d.r + 2 : d.r}
                    fill={SECTOR_COLOR[d.sector]}
                    fillOpacity={hover && !on ? 0.35 : 0.78}
                    stroke={on || named.has(d.code) ? CHROME.ink : '#ffffff'}
                    strokeWidth={on ? 1.6 : 1}
                    style={{ transition: reduced ? undefined : 'r 150ms ease, fill-opacity 150ms ease' }}
                  />
                )
              })}
            </g>
            <g fontSize={font} fontWeight={600} fill={CHROME.ink} stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke" pointerEvents="none">
              {labels.map((l) => (
                <text key={l.dot.code} x={l.x} y={l.y} textAnchor={l.anchor}>
                  {l.text}
                </text>
              ))}
            </g>
          </ChartFrame>
        </div>
        {tip.Tooltip}
      </div>
      <Legend items={sectors.map((s) => ({ color: SECTOR_COLOR[s], label: s }))} className="mt-2" />
    </div>
  )
}

function DotTip({ d }: { d: Opportunity }) {
  return (
    <>
      <TipHead>{d.name}</TipHead>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
        <span className="inline-block size-2.5 rounded-[2px]" style={{ background: SECTOR_COLOR[d.sector] }} />
        {d.sector} · NAICS {d.code}
      </p>
      <TipRow label="Relatedness density" value={fixed(d.density, 2)} />
      <TipRow label="Complexity (PCI)" value={fixed(d.pci, 2)} />
      <TipRow label="Tradability" value={d.tier ? TIER_LABEL[d.tier] : '—'} />
      <TipRow label="National jobs" value={fmtInt(d.nationalJobs)} />
      <TipRow label="Jobs here" value={d.employment > 0 ? `${fmtInt(d.employment)} (RCA ${d.rca === null ? '—' : d.rca.toFixed(2)})` : 'none'} />
    </>
  )
}
