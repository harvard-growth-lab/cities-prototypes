/* The metro's places ranked by jobs here per resident worker: one bar each,
   the admin city in its own hue, a dashed line at 1×. Clicking a bar points
   the dial at that place. The SVG is drawn 1 unit = 1 px (the width is
   measured) so a long metro simply scrolls inside its wrapper. */
import { scaleLinear } from 'd3'
import { useEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { ChartFrame, useMeasure } from '@/components/charts/chart-frame'
import { TipHead, TipRow, useChartTooltip } from '@/components/charts/chart-tooltip'
import { fmtInt } from '@/lib/format'
import { ADMIN, CHROME, SERIES } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { fmtX, shortName, type PlaceRatio } from './commute'

const ROW = 24
const BAR = 12
const TOP = 18
const NAME_W = 138
const VALUE_W = 54
/** every other place: a quiet grey (design-spec §1.1, "Admin Industries") */
const OTHER = '#c9ced2'
const CAP = 4

export interface PlacesRatioChartProps {
  places: PlaceRatio[]
  cityId: string
  selectedId: string
  onSelect: (id: string) => void
  /** the wrapper's max height in px; the chart scrolls inside it */
  maxHeight?: number
  className?: string
}

export function PlacesRatioChart({ places, cityId, selectedId, onSelect, maxHeight = 440, className }: PlacesRatioChartProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { show, move, hide, Tooltip } = useChartTooltip(ref)

  const W = Math.max(width, 280)
  const H = places.length * ROW + 6
  // the axis stops where the dial does (4×); a rarer place runs off it with a marker
  const x = useMemo(() => {
    const max = Math.min(CAP, Math.max(1.25, ...places.map((p) => p.ratio)))
    return scaleLinear().domain([0, max]).nice().range([NAME_W, W - VALUE_W])
  }, [places, W])
  const xEnd = x.range()[1]
  const ticks = x.ticks(Math.max(2, Math.min(6, Math.floor((W - NAME_W - VALUE_W) / 70))))

  // open with the admin city in view (it may sit far down a long metro); once only
  const scrolled = useRef(false)
  useEffect(() => {
    const el = scrollRef.current
    const i = places.findIndex((p) => p.id === cityId)
    if (scrolled.current || !el || i < 0) return
    scrolled.current = true
    el.scrollTop = Math.max(0, i * ROW - el.clientHeight / 2)
  }, [places, cityId])

  const tip = (p: PlaceRatio, e: MouseEvent) =>
    show(
      e.clientX,
      e.clientY,
      <>
        <TipHead>{p.name}</TipHead>
        <TipRow label="Jobs located here" value={fmtInt(p.jobsHere)} />
        <TipRow label="Held by residents" value={fmtInt(p.residentWorkers)} />
        <TipRow label="Jobs per resident worker" value={fmtX(p.ratio)} />
      </>,
    )

  const onKey = (id: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  if (!places.length) {
    return <p className="text-sm text-ink-soft">No place-level commuting data in this metro.</p>
  }

  return (
    <div ref={ref} className={cn('relative min-w-0', className)}>
      {/* the scale stays put while the rows scroll under it */}
      <ChartFrame width={W} height={TOP} preserveAspectRatio="none" aria-hidden style={{ height: TOP }}>
        <g fontSize={11} fill={SERIES.tick}>
          {ticks
            .filter((t) => t !== 1)
            .map((t) => (
              <text key={t} x={x(t)} y={12} textAnchor="middle">
                {t}×
              </text>
            ))}
          <text x={x(1)} y={12} textAnchor="middle" fill={CHROME.inkSoft} fontWeight={600}>
            1×
          </text>
        </g>
      </ChartFrame>
      <div ref={scrollRef} className="overflow-y-auto overscroll-contain" style={{ maxHeight }}>
        <ChartFrame
          width={W}
          height={H}
          preserveAspectRatio="none"
          role="group"
          aria-label={`${places.length} places ranked by jobs located there per job a resident holds; ${places[0].name} highest at ${fmtX(places[0].ratio)}, ${places[places.length - 1].name} lowest at ${fmtX(places[places.length - 1].ratio)}.`}
          style={{ height: H }}
        >
          {ticks.map((t) => (
            <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={H - 4} stroke={SERIES.grid} />
          ))}
          {/* 1×: as many jobs here as residents hold */}
          <line x1={x(1)} x2={x(1)} y1={0} y2={H - 4} stroke={CHROME.inkSoft} strokeWidth={1} strokeDasharray="3 3" />

          {places.map((p, i) => {
            const y = i * ROW
            const isCity = p.id === cityId
            const picked = p.id === selectedId
            return (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-pressed={picked}
                aria-label={`${p.name}, ${fmtX(p.ratio)}`}
                className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-teal [&:hover>rect:first-child]:fill-teal-tint"
                onClick={() => onSelect(p.id)}
                onKeyDown={onKey(p.id)}
                onMouseEnter={(e) => tip(p, e)}
                onMouseMove={(e) => move(e.clientX, e.clientY)}
                onMouseLeave={hide}
              >
                <rect x={0} y={y} width={W} height={ROW} fill={picked ? CHROME.tealTint : 'transparent'} stroke="none" strokeWidth={1.5} rx={3} />
                <text x={NAME_W - 10} y={y + ROW / 2} dy="0.35em" textAnchor="end" fontSize={12.5} fontWeight={isCity || picked ? 700 : 400} fill={isCity ? CHROME.geoCity : CHROME.ink}>
                  {shortName(p.name, 18)}
                </text>
                <rect
                  x={x(0)}
                  y={y + (ROW - BAR) / 2}
                  width={Math.max(1, Math.min(x(p.ratio), xEnd) - x(0))}
                  height={BAR}
                  fill={isCity ? ADMIN.jobsHere : OTHER}
                  stroke={picked ? CHROME.ink : 'none'}
                  strokeWidth={1.5}
                />
                {x(p.ratio) > xEnd && <path d={`M${xEnd + 1},${y + (ROW - BAR) / 2} l6,${BAR / 2} l-6,${BAR / 2}`} fill={isCity ? ADMIN.jobsHere : OTHER} />}
                <text x={Math.min(x(p.ratio), xEnd) + (x(p.ratio) > xEnd ? 10 : 6)} y={y + ROW / 2} dy="0.35em" fontSize={11.5} fontWeight={600} fill={CHROME.ink} className="nums">
                  {fmtX(p.ratio)}
                </text>
              </g>
            )
          })}
        </ChartFrame>
      </div>
      {Tooltip}
    </div>
  )
}
