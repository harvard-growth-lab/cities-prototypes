/* The workplace-or-dormitory dial (design-spec §3.3, `.am2-dial`): a half
   ring on a log scale from 0.4× to 4×, four zones, and a needle that takes
   the zone's colour. A dashed ghost marks the admin city's own reading when
   the needle points at another place. */
import { arc } from 'd3'
import { useId } from 'react'
import { ChartFrame } from '@/components/charts/chart-frame'
import { ADMIN, CHROME } from '@/lib/palette'
import { useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { fmtX, KIND_LABEL, ratioKind, zoneStroke, type RatioKind } from './commute'

const W = 260
const H = 188
const CX = 130
const CY = 140
const R_IN = 74
const R_OUT = 100
const R_LABEL = 111
const DOMAIN: [number, number] = [0.4, 4]

const ZONES: { kind: RatioKind; from: number; to: number }[] = [
  { kind: 'dormitory', from: 0.4, to: 0.8 },
  { kind: 'balanced', from: 0.8, to: 1.25 },
  { kind: 'importer', from: 1.25, to: 2 },
  { kind: 'hub', from: 2, to: 4 },
]
const TICKS = [0.5, 1, 2, 4]

/** Degrees from 12 o'clock: −90 at 0.4×, +90 at 4×, clamped. */
function angleOf(v: number) {
  const t = Math.log(v / DOMAIN[0]) / Math.log(DOMAIN[1] / DOMAIN[0])
  return -90 + 180 * Math.min(1, Math.max(0, t))
}
const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (deg: number, r: number) => ({ x: CX + r * Math.sin(rad(deg)), y: CY - r * Math.cos(rad(deg)) })

const zoneArc = arc<{ from: number; to: number }>()
  .innerRadius(R_IN)
  .outerRadius(R_OUT)
  .startAngle((z) => rad(angleOf(z.from)))
  .endAngle((z) => rad(angleOf(z.to)))
  .padAngle(0.012)

export interface DormitoryGaugeProps {
  /** jobs here per resident worker for the place the needle points at */
  value: number | null
  /** the place the needle points at */
  name: string
  /** the admin city's own reading, drawn as a ghost when the needle is elsewhere */
  ghost?: number | null
  className?: string
}

export function DormitoryGauge({ value, name, ghost, className }: DormitoryGaugeProps) {
  const reduced = useReducedMotion()
  const pathId = useId()
  const kind = ratioKind(value)
  const colour = zoneStroke(kind)
  const angle = value === null || !Number.isFinite(value) ? -90 : angleOf(value)
  const ghostV = typeof ghost === 'number' && Number.isFinite(ghost) && ghost !== value ? ghost : null
  const labelArc = `M ${polar(-90, R_LABEL).x} ${polar(-90, R_LABEL).y} A ${R_LABEL} ${R_LABEL} 0 0 1 ${polar(90, R_LABEL).x} ${polar(90, R_LABEL).y}`

  return (
    <ChartFrame
      width={W}
      height={H}
      role="img"
      aria-label={`${name}: ${fmtX(value)} jobs here per resident worker${kind ? `, in the ${KIND_LABEL[kind].toLowerCase()} zone` : ''}. The dial runs from 0.4× to 4×.`}
      className={cn('mx-auto max-w-[420px]', className)}
    >
      <defs>
        <path id={pathId} d={labelArc} fill="none" />
      </defs>
      {/* zones */}
      {ZONES.map((z) => (
        <path key={z.kind} d={zoneArc(z) ?? undefined} transform={`translate(${CX},${CY})`} fill={ADMIN.zones[z.kind]} opacity={kind === z.kind ? 1 : 0.55} />
      ))}
      {/* zone names ride the outside of the ring */}
      {ZONES.map((z) => {
        const mid = (angleOf(z.from) + angleOf(z.to)) / 2
        return (
          <text key={z.kind} fontSize={9.5} fontWeight={kind === z.kind ? 700 : 600} fill={kind === z.kind ? CHROME.ink : CHROME.inkSoft} letterSpacing={0.4}>
            <textPath href={`#${pathId}`} startOffset={`${((mid + 90) / 180) * 100}%`} textAnchor="middle">
              {KIND_LABEL[z.kind]}
            </textPath>
          </text>
        )
      })}
      {/* the admin city's own reading, when the needle is elsewhere */}
      {ghostV !== null && (
        <line
          x1={polar(angleOf(ghostV), R_IN - 2).x}
          y1={polar(angleOf(ghostV), R_IN - 2).y}
          x2={polar(angleOf(ghostV), R_OUT + 3).x}
          y2={polar(angleOf(ghostV), R_OUT + 3).y}
          stroke={CHROME.ink}
          strokeWidth={1.2}
          strokeDasharray="3 2"
          opacity={0.7}
        />
      )}
      {/* needle */}
      <g
        style={{
          transform: `translate(${CX}px, ${CY}px) rotate(${angle}deg)`,
          transition: reduced ? 'none' : 'transform 800ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <line y1={6} y2={-(R_OUT - 4)} stroke={colour} strokeWidth={2.5} strokeLinecap="round" style={{ transition: reduced ? 'none' : 'stroke 400ms ease' }} />
        <circle r={4} fill="#fff" stroke={colour} strokeWidth={2.5} style={{ transition: reduced ? 'none' : 'stroke 400ms ease' }} />
      </g>
      {/* ticks inside, over the needle so a reading near one keeps its label */}
      {TICKS.map((t) => {
        const a = angleOf(t)
        const p1 = polar(a, R_IN - 1)
        const p2 = polar(a, R_IN - 6)
        const pt = polar(a, R_IN - 15)
        return (
          <g key={t}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={CHROME.inkSoft} strokeWidth={1} />
            <text x={pt.x} y={pt.y} dy="0.35em" textAnchor="middle" fontSize={9} fill={CHROME.inkSoft} paintOrder="stroke" stroke="#fff" strokeWidth={3} strokeLinejoin="round">
              {t}×
            </text>
          </g>
        )
      })}
      {/* the reading */}
      <text x={CX} y={CY + 30} textAnchor="middle" fontSize={24} fontWeight={700} fill={CHROME.ink} className="nums">
        {fmtX(value)}
      </text>
      <text x={CX} y={CY + 43} textAnchor="middle" fontSize={9.5} fill={CHROME.inkSoft}>
        {name} · jobs here per resident worker
      </text>
    </ChartFrame>
  )
}
