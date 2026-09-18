/* "Ordered by jobs": the furniture around the bar list — a jobs axis,
   names, values and a tradability column (the 0–1 score with a track on
   the traded beat, the tier word on the all-tiers beat). The bars are the
   shared cells. */
import type { MouseEvent } from 'react'
import { fmtCompact } from '@/lib/format'
import { CHROME, SERIES, TIER_LABEL } from '@/lib/palette'
import { ellipsize } from './text-measure'
import { BARS_PITCH, COL, type Layout } from './treemap-layout'
import type { IndustryDatum } from './use-industry-data'

export interface BarsFurnitureProps {
  items: Map<string, IndustryDatum>
  layout: Layout
  ts: number
  /** what the tradability column prints */
  tradCol: 'score' | 'tier'
  litSector: string | null
  hoverCode: string | null
  onEnter: (code: string, e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onLeave: () => void
}

const HAIR = '#b3bcbf'
const TICK = '#9aa3a6'
const TRACK_W = 40

/** The 0–1 tradability score with a track and notches at the tier cuts (0.2, 0.8). */
function ScoreTrack({ score, ts }: { score: number | null; ts: number }) {
  const x0 = COL.trad - TRACK_W
  return (
    <g>
      <text x={x0 - 6} y={0} dy="0.35em" textAnchor="end" fontSize={11 * ts} fontWeight={500} fill={CHROME.inkSoft}>
        {score === null ? '—' : score.toFixed(2)}
      </text>
      <rect x={x0} y={-1.5} width={TRACK_W} height={3} fill={SERIES.grid} />
      {score !== null && <rect x={x0} y={-1.5} width={TRACK_W * score} height={3} fill={CHROME.teal} />}
      {[0.2, 0.8].map((c) => (
        <line key={c} x1={x0 + TRACK_W * c} x2={x0 + TRACK_W * c} y1={-4} y2={4} stroke={CHROME.inkSoft} strokeWidth={1} />
      ))}
    </g>
  )
}

export function BarsFurniture({ items, layout, ts, tradCol, litSector, hoverCode, onEnter, onMove, onLeave }: BarsFurnitureProps) {
  const scale = layout.scale
  if (!scale || !layout.rows.length) return null
  const bottom = COL.row0 + (layout.rows.length - 1) * BARS_PITCH + BARS_PITCH / 2
  const ticks = scale.ticks(5)
  return (
    <g>
      <g fontSize={12 * ts} fontWeight={600} fill={CHROME.inkSoft}>
        <text x={COL.bar0} y={COL.head}>
          Jobs in the metro
        </text>
        <text x={COL.trad} y={COL.head} textAnchor="end">
          Tradability
        </text>
      </g>
      <g stroke={HAIR}>
        <line x1={COL.bar0} x2={COL.plotR} y1={COL.head + 8} y2={COL.head + 8} />
        <line x1={COL.trad - (tradCol === 'score' ? 86 : 66)} x2={COL.trad} y1={COL.head + 8} y2={COL.head + 8} />
      </g>
      {ticks.map((t) => {
        const x = scale(t)
        return (
          <g key={t}>
            <line x1={x} x2={x} y1={COL.ticks + 6} y2={bottom} stroke={t === 0 ? SERIES.axis : SERIES.grid} />
            <text x={x} y={COL.ticks} textAnchor="middle" fontSize={11 * ts} fontWeight={500} fill={TICK}>
              {t === 0 ? '0' : fmtCompact(t)}
            </text>
          </g>
        )
      })}
      {layout.rows.map((g) => {
        const d = items.get(g.code)
        if (!d) return null
        const hover = d.code === hoverCode
        const dim = litSector !== null && d.sector !== litSector
        const name = ellipsize(d.name, 11.5 * ts, 400, COL.name - 40)
        return (
          <g key={d.code} style={{ transform: `translate(0px, ${g.y}px)` }} opacity={dim ? 0.3 : 1}>
            <text x={COL.name} y={0} dy="0.35em" textAnchor="end" fontSize={11.5 * ts} fill={hover ? CHROME.tealDark : CHROME.ink}>
              {name}
            </text>
            <text x={scale(d.employment) + 5} y={0} dy="0.35em" fontSize={11 * ts} fontWeight={600} fill={CHROME.ink}>
              {fmtCompact(d.employment)}
            </text>
            {tradCol === 'score' ? (
              <ScoreTrack score={d.tradability} ts={ts} />
            ) : (
              <text x={COL.trad} y={0} dy="0.35em" textAnchor="end" fontSize={11 * ts} fontWeight={500} fill={CHROME.inkSoft}>
                {TIER_LABEL[d.tier]}
              </text>
            )}
            <rect x={0} y={-BARS_PITCH / 2} width={880} height={BARS_PITCH} fill="transparent" onMouseEnter={(e) => onEnter(d.code, e)} onMouseMove={onMove} onMouseLeave={onLeave} />
          </g>
        )
      })}
    </g>
  )
}
