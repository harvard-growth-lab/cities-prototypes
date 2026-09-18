/* Geometry for the industry figure's states, all in one 880×500 viewBox so
   a cell can travel from one state to the next. d3 does the tiling and the
   scales; nothing here touches the DOM. (The d3 modules are not hoisted in
   this workspace, so the named functions come from the 'd3' bundle.) */
import { hierarchy, scaleLinear, treemap, treemapSquarify, type ScaleLinear } from 'd3'
import type { Sector, TradabilityClass } from '@/data/types'
import { TIER_ORDER } from '@/lib/palette'
import type { IndustryData, IndustryDatum, RankRow } from './use-industry-data'

export const VB = { w: 880, h: 500 } as const

/* the ranking's and the bar list's columns (viewBox units) */
export const COL = { name: 282, bar0: 304, plotR: 712, barR: 658, trad: 796, jobs: 874, row0: 62, head: 16, ticks: 48 } as const
export const RANK_PITCH = 34
const RANK_BAR_H = 17
const BARS_N = 25
const BARS_BAR_H = 12
export const BARS_PITCH = (VB.h - COL.row0 - 6) / BARS_N

export interface CellGeom {
  x: number
  y: number
  w: number
  h: number
  rx: number
  visible: boolean
}

export interface SectorBlock {
  sector: Sector
  x: number
  y: number
  w: number
  h: number
  /** whether the block carries the 17-unit name strip */
  strip: boolean
}

export interface TierCard {
  tier: TradabilityClass
  x: number
  y: number
  w: number
  h: number
}

export interface RowGeom {
  code: string
  y: number
}

export interface Layout {
  kind: 'map' | 'cards' | 'bars' | 'ranking'
  cells: Map<string, CellGeom>
  blocks: SectorBlock[]
  cards: TierCard[]
  rows: RowGeom[]
  scale: ScaleLinear<number, number> | null
}

const STRIP = 17
const GUTTER = 8

interface SectorNode {
  sector: Sector
  children: IndustryDatum[]
}
interface Root {
  children: SectorNode[]
}
type Node = Root | SectorNode | IndustryDatum
const isLeaf = (n: Node): n is IndustryDatum => 'code' in n
const isSector = (n: Node): n is SectorNode => 'sector' in n

/** A sector-grouped squarified treemap of `items` inside a rect. */
function sectorTreemap(items: IndustryDatum[], x0: number, y0: number, w: number, h: number, outer: number): { cells: Map<string, CellGeom>; blocks: SectorBlock[] } {
  const cells = new Map<string, CellGeom>()
  const blocks: SectorBlock[] = []
  if (!items.length || w <= 0 || h <= 0) return { cells, blocks }
  const bySector = new Map<Sector, IndustryDatum[]>()
  for (const d of items) bySector.set(d.sector, [...(bySector.get(d.sector) ?? []), d])
  const root: Root = { children: [...bySector.entries()].map(([sector, children]) => ({ sector, children })) }
  const tree = hierarchy<Node>(root, (n) => (isLeaf(n) ? undefined : n.children))
    .sum((n) => (isLeaf(n) ? n.employment : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  // strips only on blocks tall and wide enough to carry the name
  const stripOf = (n: { depth: number; x0: number; x1: number; y0: number; y1: number }) => (n.depth === 1 && n.y1 - n.y0 >= 48 && n.x1 - n.x0 >= 40 ? STRIP : 0)
  const laid = treemap<Node>()
    .size([w, h])
    .tile(treemapSquarify)
    .paddingInner((n) => (n.depth === 0 ? GUTTER : 1))
    .paddingOuter((n) => (n.depth === 0 ? outer : 0))
    .paddingTop((n) => (n.depth === 0 ? outer : stripOf(n)))(tree)
  for (const n of laid.descendants()) {
    if (n.depth === 1 && isSector(n.data)) {
      blocks.push({ sector: n.data.sector, x: x0 + n.x0, y: y0 + n.y0, w: n.x1 - n.x0, h: n.y1 - n.y0, strip: stripOf(n) > 0 })
    } else if (n.depth === 2 && isLeaf(n.data)) {
      cells.set(n.data.code, { x: x0 + n.x0, y: y0 + n.y0, w: Math.max(0, n.x1 - n.x0), h: Math.max(0, n.y1 - n.y0), rx: 0, visible: true })
    }
  }
  return { cells, blocks }
}

/** State 0: the traded tier over the whole viewBox. */
export function layoutTradedMap(data: IndustryData): Layout {
  const { cells, blocks } = sectorTreemap(data.tiers.traded.industries, 0, 0, VB.w, VB.h, 3.5)
  return { kind: 'map', cells, blocks, cards: [], rows: [], scale: null }
}

/** State 1: three tier cards, widths ∝ share (min 36), each a treemap. */
export function layoutTierCards(data: IndustryData): Layout {
  const avail = VB.w - GUTTER * (TIER_ORDER.length - 1)
  const MIN = 36
  const raw = TIER_ORDER.map((t) => data.tiers[t].share * avail)
  const clamped = raw.map((v) => Math.max(MIN, v))
  const fixed = clamped.reduce((s, v, i) => s + (raw[i] < MIN ? v : 0), 0)
  const freeRaw = raw.reduce((s, v) => s + (v >= MIN ? v : 0), 0)
  const widths = clamped.map((v, i) => (raw[i] < MIN ? v : freeRaw > 0 ? (v / freeRaw) * (avail - fixed) : v))
  const cells = new Map<string, CellGeom>()
  const blocks: SectorBlock[] = []
  const cards: TierCard[] = []
  let x = 0
  TIER_ORDER.forEach((tier, i) => {
    const w = widths[i]
    cards.push({ tier, x, y: 0, w, h: VB.h })
    const inner = sectorTreemap(data.tiers[tier].industries, x + 9, 44, w - 18, VB.h - 44 - 9, 0)
    for (const [k, v] of inner.cells) cells.set(k, v)
    blocks.push(...inner.blocks)
    x += w + GUTTER
  })
  return { kind: 'cards', cells, blocks, cards, rows: [], scale: null }
}

/** "Ordered by jobs": the largest of `pool` as horizontal bars on a jobs axis. */
export function layoutBars(pool: IndustryDatum[]): Layout {
  const top = [...pool].sort((a, b) => b.employment - a.employment).slice(0, BARS_N)
  const max = top[0]?.employment ?? 1
  // the longest bar stops short of the plot's edge so its value label clears the tier word
  const scale = scaleLinear().domain([0, max]).nice().range([COL.bar0, COL.barR])
  const cells = new Map<string, CellGeom>()
  const rows: RowGeom[] = top.map((d, i) => {
    const y = COL.row0 + i * BARS_PITCH
    cells.set(d.code, { x: COL.bar0, y: y - BARS_BAR_H / 2, w: Math.max(0, scale(d.employment) - COL.bar0), h: BARS_BAR_H, rx: 3, visible: true })
    return { code: d.code, y }
  })
  return { kind: 'bars', cells, blocks: [], cards: [], rows, scale }
}

/** State 2: the ranking, rows in the order given, bars from 1× on a linear scale. */
export function layoutRanking(rows: RankRow[]): Layout {
  const max = Math.max(1.5, ...rows.map((r) => r.rca))
  // nice the top of the axis only: 1× stays the base line
  const niced = scaleLinear().domain([1, max]).nice()
  const scale = scaleLinear().domain([1, niced.domain()[1]]).range([COL.bar0, COL.barR])
  const cells = new Map<string, CellGeom>()
  const geoms: RowGeom[] = rows.map((r, i) => {
    const y = COL.row0 + i * RANK_PITCH
    cells.set(r.code, { x: COL.bar0, y: y - RANK_BAR_H / 2, w: Math.max(0, scale(r.rca) - COL.bar0), h: RANK_BAR_H, rx: 0, visible: true })
    return { code: r.code, y }
  })
  return { kind: 'ranking', cells, blocks: [], cards: [], rows: geoms, scale }
}
