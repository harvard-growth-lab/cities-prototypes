/* Series for the index charts: one point per year over a common range, so
   a hole in the data stays a hole (Boston's wage has none for 2013–17) and
   every line answers the same hover year. Pure; no React. */
import { cagr } from '@/data/derive'
import { fmtRate } from '@/lib/format'

/** The charts start where the place panels do; the metro and national rows before it are not drawn. */
export const FIRST_YEAR = 2010

/** "▲ +0.6%/yr" with its tone; a rate that rounds to zero carries no arrow and reads as neutral. */
export function rateMark(rate: number | null): { text: string; tone: 'rise' | 'fall' | 'flat' } {
  const text = fmtRate(rate)
  const tone = rate === null ? 'flat' : text.startsWith('+') ? 'rise' : text.startsWith('−') ? 'fall' : 'flat'
  return { text: tone === 'rise' ? `▲ ${text}` : tone === 'fall' ? `▼ ${text}` : text, tone }
}

export interface SeriesPoint {
  year: number
  value: number | null
  /** a wage year with ≤ 1 observed year inside its 3-year mean */
  modelled?: boolean
}

export interface IndexedPoint extends SeriesPoint {
  index: number | null
}

export interface ChartSeries {
  id: string
  /** what the tooltip calls the line */
  name: string
  /** the right-hand label; omit to leave the line unlabelled */
  label?: string
  color: string
  /** label ink when the line is too pale to carry text (the metro) */
  labelColor?: string
  width: number
  dash?: string
  points: SeriesPoint[]
  /** printed under the label ("▲ +0.3%/yr"); the tooltip computes one when absent */
  rate?: number | null
  /** the subject: bigger end mark, the pre-window part dimmed */
  lead?: boolean
  /** draws itself in when the chart's drawKey changes */
  drawIn?: boolean
}

export const yearsBetween = (a: number, b: number): number[] =>
  b >= a ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : []

const isNum = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

/** One point per year of `years`; null where the source has no row or no value. */
export function toPoints<T extends { year: number }>(
  rows: T[],
  years: number[],
  value: (r: T) => number | null | undefined,
  modelled?: (r: T) => boolean,
): SeriesPoint[] {
  const byYear = new Map(rows.map((r) => [r.year, r] as const))
  return years.map((year) => {
    const r = byYear.get(year)
    const v = r ? value(r) : null
    return { year, value: isNum(v) ? v : null, modelled: r && modelled ? modelled(r) : false }
  })
}

/** The last year any source has a row for (the chart trims to the data). */
export function lastYear(sources: { year: number }[][]): number | null {
  let best: number | null = null
  for (const rows of sources) for (const r of rows) if (best === null || r.year > best) best = r.year
  return best
}

/** The point at `year`, or at the nearest year with a value (earlier wins a tie). */
function nearestPoint(points: SeriesPoint[], year: number): SeriesPoint | undefined {
  let best: SeriesPoint | undefined
  let bestD = Infinity
  for (const p of points) {
    if (p.value === null) continue
    const d = Math.abs(p.year - year)
    if (d < bestD || (d === bestD && best && p.year < best.year)) {
      best = p
      bestD = d
    }
  }
  return best
}

/** Re-base to 100 at the nearest year with data to `base`; nulls stay null. */
export function indexPoints(points: SeriesPoint[], base: number): IndexedPoint[] {
  const b = nearestPoint(points, base)
  const bv = b?.value ?? null
  return points.map((p) => ({ ...p, index: p.value !== null && bv !== null && bv > 0 ? (p.value / bv) * 100 : null }))
}

/** Growth per year across the band, from the nearest years with data. */
export function bandRate(points: SeriesPoint[], start: number, end: number): number | null {
  const a = nearestPoint(points, start)
  const b = nearestPoint(points, end)
  if (!a || !b || a.value === null || b.value === null || b.year <= a.year) return null
  const r = cagr(a.value, b.value, b.year - a.year)
  return Number.isFinite(r) ? r : null
}

/** First and last year with a value across the series, or null when there is none. */
export function dataExtent(series: { points: SeriesPoint[] }[]): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  for (const s of series)
    for (const p of s.points)
      if (p.value !== null) {
        if (p.year < lo) lo = p.year
        if (p.year > hi) hi = p.year
      }
  return Number.isFinite(lo) && hi > lo ? [lo, hi] : null
}
