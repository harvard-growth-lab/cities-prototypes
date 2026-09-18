/* Layout math for the index chart: the y domain in 5-point steps through
   100, the x ticks that stand clear of one another, and the right-hand
   labels wrapped and pushed apart. Pure; no React. */
import type { IndexedPoint } from './series'

/** Index bounds in steps of 5 (10, 15… when the range is wide), always through 100, with a little air. */
export function yBounds(pts: IndexedPoint[][]): { lo: number; hi: number; ticks: number[] } {
  let lo = Infinity
  let hi = -Infinity
  for (const series of pts)
    for (const p of series)
      if (p.index !== null) {
        lo = Math.min(lo, p.index)
        hi = Math.max(hi, p.index)
      }
  if (!Number.isFinite(lo)) {
    lo = 95
    hi = 105
  }
  let step = 5
  while ((hi - lo) / step > 7) step += 5
  lo = 100 - Math.ceil(Math.max(0, 100 - lo + (lo < 100 ? step * 0.2 : 0)) / step) * step
  hi = 100 + Math.ceil(Math.max(0, hi - 100 + (hi > 100 ? step * 0.2 : 0)) / step) * step
  if (hi === lo) hi = lo + step
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-6; v += step) ticks.push(v)
  return { lo, hi, ticks }
}

/** The data's ends and the window's edges, plus the 5-year marks that stand clear of them. */
export function xTicksFor(x0: number, x1: number, band: [number, number], x: (v: number) => number): number[] {
  const anchors = [...new Set([x0, x1, band[0], band[1]])].filter((v) => v >= x0 && v <= x1)
  const set = new Set<number>(anchors)
  for (let v = Math.ceil(x0 / 5) * 5; v <= x1; v += 5) if (anchors.every((a) => Math.abs(a - v) >= 3)) set.add(v)
  const keep: number[] = []
  for (const v of [...set].sort((a, b) => a - b)) {
    const prev = keep[keep.length - 1]
    if (prev !== undefined && x(v) - x(prev) < 34) {
      if (v === band[0] || v === band[1]) keep.pop()
      else continue
    }
    keep.push(v)
  }
  return keep
}

export interface LabelIn {
  id: string
  label: string
  y: number
  /** a rate line follows the name */
  withRate: boolean
}
export interface LabelOut extends LabelIn {
  lines: string[]
  height: number
}

/** Source Sans runs ≈ 0.55em per glyph at 12.5px bold. */
const GLYPH = 6.9
/** the gap between the plot's edge and a label, plus a little air after it */
const LABEL_GAP = 12

/** The right margin that holds a label of `chars` glyphs on one line. */
export const labelMargin = (chars: number) => LABEL_GAP + Math.ceil(chars * GLYPH)

/** Wrap the labels that overflow `width`, then push them apart within [top, bottom]. */
export function layoutLabels(items: LabelIn[], width: number, top: number, bottom: number): LabelOut[] {
  const fit = Math.max(4, Math.floor((width - LABEL_GAP) / GLYPH + 1e-6))
  const wrap = (label: string): string[] => {
    if (label.length <= fit) return [label]
    const lines: string[] = []
    let cur = ''
    for (const word of label.split(' ')) {
      if (cur && (cur + ' ' + word).length > fit) {
        lines.push(cur)
        cur = word
      } else cur = cur ? cur + ' ' + word : word
    }
    if (cur) lines.push(cur)
    return lines
  }
  const out = items
    .map((it) => {
      const lines = wrap(it.label)
      return { ...it, lines, height: lines.length * 14 + (it.withRate ? 13 : 0) + 3 }
    })
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < out.length; i++) {
    const min = out[i - 1].y + out[i - 1].height
    if (out[i].y < min) out[i].y = min
  }
  for (let i = out.length - 1; i >= 0; i--) {
    const max = (i === out.length - 1 ? bottom : out[i + 1].y) - out[i].height
    if (out[i].y > max) out[i].y = Math.max(top, max)
  }
  return out
}
