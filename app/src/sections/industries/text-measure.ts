/* Text widths in viewBox units, for fitting labels into cells and rows.
   A canvas measures the page font when one is available; otherwise an
   average-glyph estimate (Source Sans runs close to 0.5 em per character). */
import { useEffect, useState } from 'react'

const FONT = '"Source Sans 3", "Source Sans Pro", ui-sans-serif, system-ui, sans-serif'
const cache = new Map<string, number>()
let ctx: CanvasRenderingContext2D | null | undefined

function context() {
  if (ctx !== undefined) return ctx
  ctx = typeof document === 'undefined' ? null : (document.createElement('canvas').getContext('2d') ?? null)
  return ctx
}

export function textWidth(text: string, size: number, weight = 400): number {
  const key = `${weight}|${size}|${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const c = context()
  let w: number
  if (c) {
    c.font = `${weight} ${size}px ${FONT}`
    w = c.measureText(text).width
  } else {
    w = text.length * size * 0.5
  }
  cache.set(key, w)
  return w
}

/** Trim `text` with an ellipsis until it fits `maxWidth`. */
export function ellipsize(text: string, size: number, weight: number, maxWidth: number): string {
  if (textWidth(text, size, weight) <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (textWidth(text.slice(0, mid).trimEnd() + '…', size, weight) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo === 0 ? '…' : text.slice(0, lo).trimEnd() + '…'
}

/** Bumps once the page fonts have loaded, so measured layouts recompute. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => typeof document !== 'undefined' && document.fonts?.status === 'loaded')
  useEffect(() => {
    if (ready || typeof document === 'undefined' || !document.fonts) return
    let on = true
    void document.fonts.ready.then(() => {
      cache.clear()
      if (on) setReady(true)
    })
    return () => {
      on = false
    }
  }, [ready])
  return ready
}

/** Wrap by words into at most `maxLines` lines; the last line is ellipsized if it still overflows. */
export function wrapLines(text: string, size: number, weight: number, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const next = line ? `${line} ${w}` : w
    if (textWidth(next, size, weight) <= maxWidth) {
      line = next
      continue
    }
    if (lines.length === maxLines - 1) {
      line = words.slice(i - (line ? line.split(' ').length : 0)).join(' ')
      break
    }
    lines.push(line || w)
    line = line ? w : ''
  }
  if (line) lines.push(ellipsize(line, size, weight, maxWidth))
  return lines.slice(0, maxLines)
}
