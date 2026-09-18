/* The frame both metro-scale scatters share: one viewBox, one set of
   margins, scales fitted to the whole metro field, the medians that split
   the plane. The burst (beat 2) must read as beat 1 carrying on, so nothing
   here may differ between them. Pure math — no React rendering. */
import { extent, max, scaleLinear, scaleSqrt, type ScaleLinear, type ScalePower } from 'd3'
import { useMemo, type CSSProperties } from 'react'
import type { AtlasIndex, MetroSummary } from '@/data/types'

export const W = 880
export const H = 560
/** room for the "typical" caption above, ticks and axis titles left and below */
export const M = { top: 46, right: 30, bottom: 82, left: 92 } as const
export const PLOT = { x0: M.left, x1: W - M.right, y0: H - M.bottom, y1: M.top } as const

export interface MetroPoint {
  m: MetroSummary
  /** population growth, %/yr */
  x: number
  /** wage growth, %/yr */
  y: number
  home: boolean
}

export interface ScatterFrame {
  /** every metro with both rates, the home metro last so it paints on top */
  points: MetroPoint[]
  home: MetroPoint | undefined
  x: ScaleLinear<number, number>
  y: ScaleLinear<number, number>
  /** radius on population */
  r: ScalePower<number, number>
  /** the medians and the borderline band, in %/yr */
  med: { x: number; y: number; xBand: number; yBand: number }
}

export function useScatterFrame(index: AtlasIndex, homeId: string): ScatterFrame {
  return useMemo(() => {
    const points: MetroPoint[] = index.metros
      .filter((m) => m.popCagr !== null && m.wageCagr !== null)
      .map((m) => ({ m, x: (m.popCagr ?? 0) * 100, y: (m.wageCagr ?? 0) * 100, home: m.id === homeId }))
      .sort((a, b) => Number(a.home) - Number(b.home))
    const [x0, x1] = extent(points, (d) => d.x)
    const [y0, y1] = extent(points, (d) => d.y)
    const x = scaleLinear().domain([x0 ?? -1, x1 ?? 3]).nice().range([PLOT.x0, PLOT.x1])
    const y = scaleLinear().domain([y0 ?? 1, y1 ?? 7]).nice().range([PLOT.y0, PLOT.y1])
    const r = scaleSqrt().domain([0, max(points, (d) => d.m.population ?? 0) ?? 1]).range([1.3, 12])
    return {
      points,
      home: points.find((d) => d.home),
      x,
      y,
      r,
      med: {
        x: index.medians.popCagr * 100,
        y: index.medians.wageCagr * 100,
        xBand: index.medians.popBand * 100,
        yBand: index.medians.wageBand * 100,
      },
    }
  }, [index, homeId])
}

/** Keep a mark this far inside the axes however wild its rate. */
export const clampInPlot = (scale: ScaleLinear<number, number>, v: number, inset = 12) => {
  const [a, b] = scale.range()
  return Math.max(Math.min(a, b) + inset, Math.min(Math.max(a, b) - inset, scale(v)))
}

/** Pointer position → viewBox units (the SVG keeps its aspect, so one scale). */
export function toUnits(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const rect = svg.getBoundingClientRect()
  return [((clientX - rect.left) / rect.width) * W, ((clientY - rect.top) / rect.height) * H]
}

/** The mark nearest the pointer within `reach` units of its edge — a hover
 *  target wider than any dot, without an invisible circle per point. */
export function nearest<T>(items: T[], px: number, py: number, at: (d: T) => [number, number, number], reach = 12): T | undefined {
  let best: T | undefined
  let bestD = Infinity
  for (const d of items) {
    const [cx, cy, r] = at(d)
    const dist = Math.hypot(cx - px, cy - py) - r
    if (dist < bestD && dist <= reach) {
      bestD = dist
      best = d
    }
  }
  return best
}

/* In-SVG type. The viewBox scales the text with the width, so the unit sizes
   step up as the frame narrows (design-spec §5): rendered type holds near
   9px on a phone where the 880 frame is drawn at ~420px. */
export const TYPE = {
  tick: 'fill-ink text-[13px] max-narrow:text-[15px] max-sm:text-[clamp(14px,calc(38px_-_4.1vw),20px)]',
  title: 'fill-ink text-[14px] max-narrow:text-[16px] max-sm:text-[clamp(14px,calc(37px_-_4.1vw),19px)]',
  typical: 'fill-ink-soft text-[12px] italic max-narrow:text-[14px] max-sm:text-[clamp(13px,calc(36px_-_4.1vw),18px)]',
  label: 'text-[12px] font-semibold max-narrow:text-[14px] max-sm:text-[clamp(13px,calc(36px_-_4.1vw),18px)]',
  home: 'text-[15px] font-semibold max-narrow:text-[17px] max-sm:text-[clamp(16px,calc(40px_-_4.1vw),22px)]',
} as const

/** A white halo behind a label that lands on the dot field, so it stays
 *  legible where the places crowd the metro's own point. */
export const HALO: CSSProperties = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.5, strokeLinejoin: 'round' }

/** "2014–2024", or the years a series actually read when they differ. */
export const spanLabel = (window: { start: number; end: number }, years?: [number, number] | null) =>
  years && (years[0] !== window.start || years[1] !== window.end) ? `${years[0]}–${years[1]}` : `${window.start}–${window.end}`
