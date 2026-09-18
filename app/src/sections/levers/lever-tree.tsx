/* The diagnostic tree (design-spec §3.0 Q6's mini-tree, 800×250): the
   growth question forks into labor demand / supply, then into what kind,
   then into what exactly. The path the evidence lights is gold; the next
   fork's options are ringed; the rest of the tree dims. */
import { useEffect, useRef } from 'react'
import { ChartFrame } from '@/components/charts/chart-frame'
import { CHROME } from '@/lib/palette'
import { useIsNarrow, useReducedMotion } from '@/lib/use-media-query'
import { NODE_NAME, type DiagnosisPath, type TreeNodeId } from './levers-data'

/* Instrument gold (design-spec §1.1): the palette module carries no
   instrument colours, so the tree keeps them here. */
const GOLD_FILL = '#e8b84b'
const GOLD_STROKE = '#c98500'

const W = 800
const H = 250
const NODE_H = 34
const NODE_W = 122
const SLOT = W / 6
const ROW_Y = [6, 68, 130, 192]

interface Node {
  id: TreeNodeId
  parent: TreeNodeId | null
  cx: number
  row: number
  w: number
}

const slot = (i: number) => SLOT * (i + 0.5)
const NODES: Node[] = [
  { id: 'root', parent: null, cx: (slot(1.25) + slot(4.25)) / 2, row: 0, w: 150 },
  { id: 'demand', parent: 'root', cx: slot(1.25), row: 1, w: NODE_W },
  { id: 'supply', parent: 'root', cx: slot(4.25), row: 1, w: NODE_W },
  { id: 'existing', parent: 'demand', cx: slot(0.5), row: 2, w: NODE_W },
  { id: 'newact', parent: 'demand', cx: slot(2), row: 2, w: NODE_W },
  { id: 'cost', parent: 'supply', cx: slot(3.5), row: 2, w: NODE_W },
  { id: 'amenity', parent: 'supply', cx: slot(5), row: 2, w: NODE_W },
  { id: 'shocks', parent: 'existing', cx: slot(0), row: 3, w: NODE_W },
  { id: 'inputs', parent: 'existing', cx: slot(1), row: 3, w: NODE_W },
  { id: 'coord', parent: 'newact', cx: slot(2), row: 3, w: NODE_W },
  { id: 'housing', parent: 'cost', cx: slot(3), row: 3, w: NODE_W },
  { id: 'transport', parent: 'cost', cx: slot(4), row: 3, w: NODE_W },
]
const byId = new Map(NODES.map((n) => [n.id, n]))

/** Two lines when the label would not sit inside the box (≈0.475 em a glyph). */
function lines(label: string, w: number, font: number): string[] {
  if (label.length * font * 0.475 + 14 <= w) return [label]
  const words = label.split(' ')
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

/** An elbow from the parent's bottom edge to the child's top edge. */
function link(p: Node, c: Node) {
  const y0 = ROW_Y[p.row] + NODE_H
  const y1 = ROW_Y[c.row]
  const ym = (y0 + y1) / 2
  return `M${p.cx},${y0} V${ym} H${c.cx} V${y1}`
}

export interface LeverTreeProps {
  path: DiagnosisPath
  metroName: string
}

export function LeverTree({ path, metroName }: LeverTreeProps) {
  const reduced = useReducedMotion()
  // under 920px the tree draws at ≤712px, so its type steps up to hold near 10px (design-spec §5)
  const font = useIsNarrow() ? 13 : 12
  const lit = new Set(path.lit)
  const cand = new Set(path.candidates)
  const last = path.lit[path.lit.length - 1]
  const litNames = path.lit.map((id) => NODE_NAME[id]).join(' → ')
  const candNames = path.candidates.map((id) => NODE_NAME[id]).join(' and ')
  const label = `Diagnostic tree for the ${metroName} metro: the evidence lights ${litNames}${candNames ? `; ${candNames} remain the candidates below it` : ''}.`
  const fade = reduced ? undefined : 'opacity 350ms ease, fill 350ms ease, stroke 350ms ease'
  const scrollRef = useRef<HTMLDivElement>(null)

  // when the tree pans (phone), start with the lit end in view
  useEffect(() => {
    const el = scrollRef.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    const end = byId.get(last)
    if (!end) return
    el.scrollLeft = (end.cx / W) * el.scrollWidth - el.clientWidth / 2
  }, [last])

  return (
    // under 640px the tree pans sideways at a 640px floor so its labels hold near 10px
    <div ref={scrollRef} className="overflow-x-auto max-sm:-mx-3.5 max-sm:px-3.5">
      <ChartFrame width={W} height={H} role="img" aria-label={label} className="mx-auto max-w-[800px] max-sm:min-w-[640px]">
        <g fill="none">
          {NODES.filter((n) => n.parent).map((n) => {
            const p = byId.get(n.parent as TreeNodeId) as Node
            const onPath = lit.has(n.id) && lit.has(p.id)
            const toCand = cand.has(n.id) && p.id === last
            return (
              <path
                key={n.id}
                d={link(p, n)}
                stroke={onPath || toCand ? GOLD_STROKE : CHROME.lineStrong}
                strokeWidth={onPath ? 2 : 1.2}
                strokeDasharray={toCand ? '4 3' : undefined}
                opacity={onPath || toCand ? 1 : 0.35}
                style={{ transition: fade }}
              />
            )
          })}
        </g>
        {NODES.map((n) => {
          const isLit = lit.has(n.id)
          const isCand = cand.has(n.id)
          const y = ROW_Y[n.row]
          const ls = lines(NODE_NAME[n.id], n.w, font)
          return (
            <g key={n.id} opacity={isLit || isCand ? 1 : 0.3} style={{ transition: fade }}>
              <rect
                x={n.cx - n.w / 2}
                y={y}
                width={n.w}
                height={NODE_H}
                rx={6}
                fill={isLit ? GOLD_FILL : '#ffffff'}
                stroke={isLit || isCand ? GOLD_STROKE : CHROME.lineStrong}
                strokeWidth={isLit ? 1.5 : 1.2}
                strokeDasharray={isCand ? '4 3' : undefined}
                style={{ transition: fade }}
              />
              <text
                x={n.cx}
                y={y + NODE_H / 2}
                textAnchor="middle"
                fontSize={font}
                fontWeight={isLit || n.id === last ? 600 : 500}
                fill={CHROME.ink}
              >
                {ls.length === 1 ? (
                  <tspan dy="0.35em">{ls[0]}</tspan>
                ) : (
                  ls.map((t, i) => (
                    <tspan key={i} x={n.cx} dy={i === 0 ? '-0.25em' : '1.15em'}>
                      {t}
                    </tspan>
                  ))
                )}
              </text>
            </g>
          )
        })}
      </ChartFrame>
    </div>
  )
}
