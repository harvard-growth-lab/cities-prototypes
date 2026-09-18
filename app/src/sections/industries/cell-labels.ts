/* Metroverse-style cell labels: the industry name wrapped by words at the
   top-left at the largest size that fits, its share of metro jobs centred
   along the bottom in lighter, larger numerals. A cell that cannot hold
   the whole name carries nothing. */
import { textWidth } from './text-measure'

export interface CellLabel {
  lines: string[]
  nameSize: number
  /** null when the share does not fit under the name */
  shareSize: number | null
  share: string
}

const PAD = 4
const LINE = 1.08

function wrap(words: string[], size: number, maxWidth: number): string[] | null {
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (textWidth(w, size) > maxWidth) return null
    const next = line ? `${line} ${w}` : w
    if (textWidth(next, size) <= maxWidth) line = next
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Fit `name` and `share` into a w×h cell. `min`/`max` bound the name size;
 * the share may run up to `shareMax`. Returns null when nothing fits.
 */
export function fitCellLabel(name: string, share: string, w: number, h: number, min: number, max: number, shareMax: number): CellLabel | null {
  const innerW = w - PAD * 2
  const innerH = h - PAD * 2
  if (innerW < min * 1.5 || innerH < min) return null
  const words = name.split(/\s+/)
  for (let size = max; size >= min; size -= 1) {
    const lines = wrap(words, size, innerW)
    if (!lines) continue
    const nameH = lines.length * size * LINE
    if (nameH > innerH) continue
    // the share sits under the name if there is room for it at ≥ min
    let shareSize: number | null = null
    for (let s = Math.min(shareMax, Math.round(size * 1.6)); s >= min; s -= 1) {
      if (textWidth(share, s, 300) <= innerW && nameH + s * 1.05 + 2 <= innerH) {
        shareSize = s
        break
      }
    }
    return { lines, nameSize: size, shareSize, share }
  }
  return null
}
