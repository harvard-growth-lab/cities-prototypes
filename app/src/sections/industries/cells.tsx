/* The cell layer: one <g> per industry keyed by code, so a rect travels
   between states (CSS transition on its geometry), plus the Metroverse
   labels and the map furniture (tier cards, sector strips). */
import { useMemo, type MouseEvent } from 'react'
import { fmtPct } from '@/lib/format'
import { CHROME, SECTOR_COLOR, TIER_LABEL, inkOn } from '@/lib/palette'
import { fitCellLabel } from './cell-labels'
import { darken } from './hue'
import { textWidth } from './text-measure'
import type { CellGeom, Layout } from './treemap-layout'
import type { IndustryDatum } from './use-industry-data'

const TWEEN = 'cubic-bezier(.45,0,.55,1)'
const GEOM = ['x', 'y', 'width', 'height', 'rx', 'opacity', 'fill'] as const

export interface CellLayerProps {
  industries: IndustryDatum[]
  geoms: Map<string, CellGeom>
  fillOf: (d: IndustryDatum) => string
  dimOf: (d: IndustryDatum) => number
  motion: boolean
  interactive: boolean
  onEnter: (code: string, e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onLeave: () => void
}

export function CellLayer({ industries, geoms, fillOf, dimOf, motion, interactive, onEnter, onMove, onLeave }: CellLayerProps) {
  const rectTransition = motion ? GEOM.map((p) => `${p} 950ms ${TWEEN}`).join(', ') : 'none'
  const dimTransition = motion ? 'opacity 180ms' : 'none'
  return (
    <g>
      {industries.map((d) => {
        const g = geoms.get(d.code)
        if (!g) return null
        return (
          <g key={d.code} opacity={dimOf(d)} style={{ transition: dimTransition }}>
            <rect
              x={g.x}
              y={g.y}
              width={g.w}
              height={g.h}
              rx={g.rx}
              fill={fillOf(d)}
              opacity={g.visible ? 1 : 0}
              pointerEvents={interactive && g.visible ? 'auto' : 'none'}
              style={{ transition: rectTransition }}
              onMouseEnter={(e) => onEnter(d.code, e)}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
            />
          </g>
        )
      })}
    </g>
  )
}

export interface CellLabelsProps {
  industries: IndustryDatum[]
  geoms: Map<string, CellGeom>
  fillOf: (d: IndustryDatum) => string
  dimOf: (d: IndustryDatum) => number
  ts: number
  /** re-measure when the page fonts arrive */
  fontsReady: boolean
}

export function CellLabels({ industries, geoms, fillOf, dimOf, ts, fontsReady }: CellLabelsProps) {
  const labels = useMemo(
    () =>
      industries.flatMap((d) => {
        const g = geoms.get(d.code)
        if (!g || !g.visible) return []
        const fit = fitCellLabel(d.name, fmtPct(d.share * 100, 2), g.w, g.h, 11 * ts, 18 * ts, 26 * ts)
        return fit ? [{ d, g, fit }] : []
      }),
    // fontsReady only re-runs the measurement
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [industries, geoms, ts, fontsReady],
  )
  return (
    <g pointerEvents="none">
      {labels.map(({ d, g, fit }) => {
        const ink = inkOn(fillOf(d))
        return (
          <g key={d.code} opacity={dimOf(d)} fill={ink}>
            <text x={g.x + 4} y={g.y + 4} fontSize={fit.nameSize} fontWeight={400}>
              {fit.lines.map((line, i) => (
                <tspan key={i} x={g.x + 4} dy={i === 0 ? '0.92em' : '1.08em'}>
                  {line}
                </tspan>
              ))}
            </text>
            {fit.shareSize !== null && (
              <text x={g.x + g.w / 2} y={g.y + g.h - 4} textAnchor="middle" fontSize={fit.shareSize} fontWeight={300}>
                {fit.share}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

/** Tier card grounds and sector-name strips for the two map states. */
export function MapFurniture({ layout, ts }: { layout: Layout; ts: number }) {
  return (
    <g pointerEvents="none">
      {layout.cards.map((c) => (
        <g key={c.tier}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={8} fill="#eff0f0" />
          {textWidth(TIER_LABEL[c.tier], 15 * ts, 700) <= c.w - 20 && (
            <text x={c.x + 12} y={27} fontSize={15 * ts} fontWeight={700} fill={CHROME.ink}>
              {TIER_LABEL[c.tier]}
            </text>
          )}
        </g>
      ))}
      {layout.blocks
        .filter((b) => b.strip && textWidth(b.sector, 11 * ts, 700) <= b.w - 4)
        .map((b) => (
          <text key={`${b.x}-${b.y}-${b.sector}`} x={b.x + 2} y={b.y + 12.5} fontSize={11 * ts} fontWeight={700} fill={darken(SECTOR_COLOR[b.sector])}>
            {b.sector}
          </text>
        ))}
    </g>
  )
}
