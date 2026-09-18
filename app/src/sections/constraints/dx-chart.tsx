/* The explainer's small plane: four flat quarters, a dashed crosshair for
   the typical city, and a black dot you can drag. Setting the dials moves
   the dot to a quarter's centre; dragging the dot sets the dials. */
import { useRef, useState, type PointerEvent } from 'react'
import type { Quadrant } from '@/data/types'
import { QUADRANT_TINT } from '@/lib/palette'
import { QUADRANT_CORNER } from '@/lib/quadrants'
import { useReducedMotion } from '@/lib/use-media-query'

const S = 300
const PAD = 26
const MID = S / 2
const OFF = 52
const CORNER_XY: Record<'tl' | 'tr' | 'bl' | 'br', [number, number]> = {
  tl: [PAD, PAD],
  tr: [MID, PAD],
  bl: [PAD, MID],
  br: [MID, MID],
}
const ORDER: Quadrant[] = ['supply_negative', 'demand_positive', 'demand_negative', 'supply_positive']

export interface DxChartProps {
  quadrant: Quadrant | null
  /** where the dot is when it was dragged there, in viewBox units */
  dot: [number, number] | null
  onDrag: (dot: [number, number], quadrant: Quadrant) => void
}

const quadrantAt = (px: number, py: number): Quadrant =>
  py < MID ? (px < MID ? 'supply_negative' : 'demand_positive') : px < MID ? 'demand_negative' : 'supply_positive'

export function DxChart({ quadrant, dot, onDrag }: DxChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const reduced = useReducedMotion()

  // the dot rests at the selected quarter's centre unless a drag put it elsewhere
  const rest: [number, number] = quadrant
    ? [QUADRANT_CORNER[quadrant].endsWith('r') ? MID + OFF : MID - OFF, QUADRANT_CORNER[quadrant].startsWith('t') ? MID - OFF : MID + OFF]
    : [MID, MID]
  const [dx, dy] = dot ?? rest

  const place = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = Math.max(PAD, Math.min(S - PAD, ((e.clientX - rect.left) / rect.width) * S))
    const py = Math.max(PAD, Math.min(S - PAD, ((e.clientY - rect.top) / rect.height) * S))
    onDrag([px, py], quadrantAt(px, py))
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${S} ${S}`}
      role="img"
      aria-label="Four-quadrant diagram; drag the dot to place a city"
      className="block h-auto w-full max-w-[380px] cursor-grab touch-none select-none active:cursor-grabbing max-sm:mx-auto max-sm:max-w-[340px]"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
        place(e)
        e.preventDefault()
      }}
      onPointerMove={(e) => dragging && place(e)}
      onPointerUp={(e) => {
        setDragging(false)
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => setDragging(false)}
    >
      {ORDER.map((q) => {
        const [qx, qy] = CORNER_XY[QUADRANT_CORNER[q]]
        return (
          <rect
            key={q}
            x={qx}
            y={qy}
            width={MID - PAD}
            height={MID - PAD}
            fill={QUADRANT_TINT[q]}
            opacity={quadrant && quadrant !== q ? 0.4 : 1}
            style={{ transition: reduced ? undefined : 'opacity .2s ease' }}
          />
        )
      })}
      <g stroke="#c9c5bf" strokeWidth={1.2} strokeDasharray="4 4">
        <line x1={MID} x2={MID} y1={PAD} y2={S - PAD} />
        <line x1={PAD} x2={S - PAD} y1={MID} y2={MID} />
      </g>
      <g fontSize={13} fontWeight={600} fill="#a8a49e">
        <text x={S - PAD - 4} y={MID - 9} textAnchor="end">
          People →
        </text>
        <text x={MID + 9} y={PAD + 16}>
          Pay ↑
        </text>
      </g>
      <g
        style={{
          transform: `translate(${dx}px, ${dy}px)`,
          transition: reduced || dragging ? undefined : 'transform 260ms ease',
        }}
        pointerEvents="none"
      >
        <circle r={16} fill="none" stroke="#cbc7c1" strokeWidth={1.5} strokeDasharray="2 2" />
        <circle r={9} fill="#111" stroke="#fff" strokeWidth={3} />
      </g>
    </svg>
  )
}
