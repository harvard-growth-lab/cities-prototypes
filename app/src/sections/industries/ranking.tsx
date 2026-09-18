/* State 2's furniture: column heads, the concentration axis, rank badges,
   the brace over the top three, and one row of name / value / tier word /
   jobs per ranked industry. The bars themselves are the shared cells. */
import type { MouseEvent } from 'react'
import { fmtCompact } from '@/lib/format'
import { BAR_GREY, CHROME, SERIES, TIER_LABEL } from '@/lib/palette'
import { textWidth, wrapLines } from './text-measure'
import { COL, RANK_PITCH, type Layout } from './treemap-layout'
import type { RankRow } from './use-industry-data'

export interface RankingFurnitureProps {
  rows: RankRow[]
  layout: Layout
  /** whether the brace and rank emphasis apply (Concentration sort) */
  braced: boolean
  ts: number
  litCode: string | null
  hoverCode: string | null
  motion: boolean
  onEnter: (code: string, e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onLeave: () => void
}

const HAIR = '#b3bcbf'
const TICK = '#9aa3a6'

export function RankingFurniture({ rows, layout, braced, ts, litCode, hoverCode, motion, onEnter, onMove, onLeave }: RankingFurnitureProps) {
  const scale = layout.scale
  if (!scale || !rows.length) return null
  const bottom = COL.row0 + (rows.length - 1) * RANK_PITCH + RANK_PITCH / 2
  const axisTop = scale.domain()[1]
  const ticks = [1, ...scale.ticks(Math.min(8, Math.max(2, Math.floor(axisTop)))).filter((t) => t > 1 && t <= axisTop)]
  const maxJobs = Math.max(...rows.map((r) => r.employment))
  const y3 = COL.row0 + 2 * RANK_PITCH
  const bs = Math.min(ts, 1.5)
  const badgeR = 9 * bs
  const braceLabel = textWidth('Most specialized tradable industries', 11.5 * ts, 700) <= COL.name + 10 ? 'Most specialized tradable industries' : 'Most specialized'
  const rowTransition = motion ? 'transform 950ms cubic-bezier(.45,0,.55,1)' : 'none'

  return (
    <g>
      <g fontSize={12 * ts} fontWeight={600} fill={CHROME.inkSoft}>
        <text x={COL.bar0} y={COL.head}>
          Times more concentrated
        </text>
        <text x={COL.trad} y={COL.head} textAnchor="end">
          Tradability
        </text>
        <text x={COL.jobs} y={COL.head} textAnchor="end">
          Jobs
        </text>
      </g>
      <g stroke={HAIR}>
        <line x1={COL.bar0} x2={COL.plotR} y1={COL.head + 8} y2={COL.head + 8} />
        <line x1={COL.trad - 66} x2={COL.trad} y1={COL.head + 8} y2={COL.head + 8} />
        <line x1={COL.jobs - 50} x2={COL.jobs} y1={COL.head + 8} y2={COL.head + 8} />
      </g>
      {ticks.map((t) => {
        const x = scale(t)
        return (
          <g key={t}>
            <line x1={x} x2={x} y1={COL.ticks + 6} y2={bottom} stroke={t === 1 ? SERIES.axis : SERIES.grid} strokeDasharray={t === 1 ? '3 3' : undefined} />
            <text x={x} y={COL.ticks} textAnchor="middle" fontSize={11 * ts} fontWeight={500} fill={TICK}>
              {t}×
            </text>
          </g>
        )
      })}
      {braced && rows.length >= 3 && (
        <g fill={CHROME.teal} stroke={CHROME.teal}>
          <text x={3} y={COL.row0 - 24} fontSize={11.5 * ts} fontWeight={700} stroke="none">
            {braceLabel}
          </text>
          <path d={`M9 ${COL.row0 - 13} H3 V${y3 + 13} H9`} fill="none" strokeWidth={1.5} />
        </g>
      )}
      {rows.map((r) => {
        const geom = layout.rows.find((g) => g.code === r.code)
        if (!geom) return null
        const top = r.rank <= 3
        const lit = r.code === litCode
        const hover = r.code === hoverCode
        const barEnd = scale(r.rca)
        const lines = wrapLines(r.name, 13 * ts, top || lit ? 700 : 400, COL.name - 40, ts > 1 ? 1 : 2)
        const jobsW = maxJobs > 0 ? (58 * r.employment) / maxJobs : 0
        return (
          <g key={r.code} style={{ transform: `translate(0px, ${geom.y}px)`, transition: rowTransition }}>
            {r.rank <= 3 && (
              <g>
                <circle cx={badgeR + 5} cy={0} r={badgeR} fill={CHROME.teal} />
                <text x={badgeR + 5} y={0} dy="0.36em" textAnchor="middle" fontSize={11 * bs} fontWeight={700} fill="#fff">
                  {r.rank}
                </text>
              </g>
            )}
            <text x={COL.name} y={0} textAnchor="end" fontSize={13 * ts} fontWeight={top || lit ? 700 : 400} fill={hover ? CHROME.tealDark : CHROME.ink}>
              {lines.map((line, i) => (
                <tspan key={i} x={COL.name} dy={i === 0 ? (lines.length === 2 ? '-0.2em' : '0.35em') : '1.05em'}>
                  {line}
                </tspan>
              ))}
            </text>
            <text x={barEnd + 6} y={0} dy="0.35em" fontSize={12.5 * ts} fontWeight={top ? 700 : 600} fill={top || lit ? CHROME.teal : CHROME.ink}>
              {r.rca.toFixed(1)}×
            </text>
            <text x={COL.trad} y={0} dy="0.35em" textAnchor="end" fontSize={12.5 * ts} fontWeight={500} fill={hover ? CHROME.tealDark : CHROME.inkSoft}>
              {TIER_LABEL[r.tier]}
            </text>
            <text x={COL.jobs} y={0} dy="0.1em" textAnchor="end" fontSize={13 * ts} fontWeight={600} fill={hover ? CHROME.tealDark : CHROME.ink}>
              {fmtCompact(r.employment)}
            </text>
            <rect x={COL.jobs - jobsW} y={7} width={jobsW} height={4} fill={BAR_GREY} opacity={0.85} />
            <rect x={0} y={-RANK_PITCH / 2} width={880} height={RANK_PITCH} fill="transparent" onMouseEnter={(e) => onEnter(r.code, e)} onMouseMove={onMove} onMouseLeave={onLeave} />
          </g>
        )
      })}
    </g>
  )
}

/** The hover / lit bands behind the rows — drawn under the cells so the bars stay on top. */
export function RowBands({ layout, pitch, codes, motion }: { layout: Layout; pitch: number; codes: (string | null)[]; motion: boolean }) {
  const on = new Set(codes.filter((c): c is string => c !== null))
  return (
    <g pointerEvents="none">
      {layout.rows.map((g) => (
        <rect
          key={g.code}
          x={0}
          y={-pitch / 2}
          width={880}
          height={pitch}
          fill={CHROME.tealTint}
          opacity={on.has(g.code) ? 1 : 0}
          style={{ transform: `translate(0px, ${g.y}px)`, transition: motion ? 'opacity 150ms, transform 950ms cubic-bezier(.45,0,.55,1)' : 'none' }}
        />
      ))}
    </g>
  )
}
