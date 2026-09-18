/* The four corners of the plane, as real buttons layered over the scatter
   (focusable, with a genuine border) and positioned in % so they track the
   responsive viewBox. Each names the quarter and spells out what the two
   dials are doing, in words as well as arrows; hover, focus or tap opens
   the card that says what the quarter means (a positioned card of our
   own, as design-spec §6 asks, flipped above the button when there is no
   room below). Under 640px they leave the plot and sit beneath it two by
   two. */
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type SVGProps } from 'react'
import type { Quadrant } from '@/data/types'
import { QUADRANT_CORNER, QUADRANTS } from '@/lib/quadrants'
import { cn } from '@/lib/utils'
import { H, M, W } from './frame'

const PAD = 1.4
const ORDER: Quadrant[] = ['supply_negative', 'demand_positive', 'demand_negative', 'supply_positive']

const POS: Record<'tl' | 'tr' | 'bl' | 'br', CSSProperties> = {
  tl: { left: `${(M.left / W) * 100 + PAD}%`, top: `${(M.top / H) * 100 + PAD}%` },
  tr: { right: `${(M.right / W) * 100 + PAD}%`, top: `${(M.top / H) * 100 + PAD}%` },
  bl: { left: `${(M.left / W) * 100 + PAD}%`, bottom: `${(M.bottom / H) * 100 + PAD}%` },
  br: { right: `${(M.right / W) * 100 + PAD}%`, bottom: `${(M.bottom / H) * 100 + PAD}%` },
}

/** A group of people, solid. */
const PopIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 18" width={16} height={12} fill="currentColor" aria-hidden {...p}>
    <circle cx="5" cy="5.4" r="3" />
    <circle cx="19" cy="5.4" r="3" />
    <circle cx="12" cy="4.4" r="3.7" />
    <path d="M0.5 17v-2.1a4.5 4.5 0 0 1 7.1-3.7 6 6 0 0 0-1.6 4.1V17Z" />
    <path d="M23.5 17v-2.1a4.5 4.5 0 0 0-7.1-3.7 6 6 0 0 1 1.6 4.1V17Z" />
    <path d="M6.5 17v-2.3a5.5 5.5 0 0 1 11 0V17Z" />
  </svg>
)
/** A coin marked with a dollar sign. */
const PayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 18 18" width={13} height={13} fill="currentColor" aria-hidden {...p}>
    <circle cx="9" cy="9" r="8" />
    <path d="M9 3.5v11" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M11.6 6.2c-.6-.8-1.6-1.2-2.6-1.2-1.5 0-2.6.8-2.6 1.9 0 1.2 1 1.6 2.6 1.9 1.6.3 2.6.7 2.6 1.9 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.4-2.7-1.2" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)
const Arrow = ({ dir }: { dir: 'up' | 'down' }) => (
  <svg viewBox="0 0 10 10" width={9} height={9} aria-hidden className={dir === 'up' ? 'fill-rise' : 'fill-fall'}>
    <path d={dir === 'up' ? 'M5 1 9 9 1 9Z' : 'M5 9 1 1 9 1Z'} />
  </svg>
)

interface CardPos {
  q: Quadrant
  left: number
  top: number
}

/** Anchors the card under (or, without room, over) the button, inside the
 *  wrap, flush with the button's outer edge so it opens into the plot. */
function placeCard(btn: HTMLButtonElement, card: HTMLDivElement, corner: 'tl' | 'tr' | 'bl' | 'br'): { left: number; top: number } {
  const wrap = btn.offsetParent as HTMLElement | null
  if (!wrap) return { left: 0, top: 0 }
  const w = wrap.getBoundingClientRect()
  const r = btn.getBoundingClientRect()
  const flush = corner.endsWith('l') ? r.left - w.left : r.right - w.left - card.offsetWidth
  const left = Math.max(6, Math.min(flush, w.width - card.offsetWidth - 6))
  const below = r.bottom - w.top + 8
  const fits = below + card.offsetHeight <= w.height
  return { left, top: fits ? below : r.top - w.top - card.offsetHeight - 8 }
}

export function QuadrantButtons() {
  const [open, setOpen] = useState<Quadrant | null>(null)
  const [pos, setPos] = useState<CardPos | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Partial<Record<Quadrant, HTMLButtonElement | null>>>({})
  const openedAt = useRef(0)
  const cardId = useId()

  const show = (q: Quadrant, at: number) => {
    openedAt.current = at
    setOpen(q)
  }
  const hide = (q: Quadrant) => setOpen((o) => (o === q ? null : o))
  // a tap (or a focusing click) opens through hover/focus first; the click
  // that follows within a beat must not close what it just opened
  const toggle = (q: Quadrant, at: number) => {
    if (open === q && at - openedAt.current < 400) return
    if (open === q) setOpen(null)
    else show(q, at)
  }

  // position after paint, once the card has a size
  useLayoutEffect(() => {
    const btn = open ? btnRefs.current[open] : null
    const card = cardRef.current
    if (!open || !btn || !card) {
      setPos(null)
      return
    }
    setPos({ q: open, ...placeCard(btn, card, QUADRANT_CORNER[open]) })
  }, [open])

  const copy = open ? QUADRANTS[open] : null
  return (
    <div className="contents max-sm:mx-[14px] max-sm:mt-2 max-sm:flex max-sm:flex-wrap max-sm:gap-2">
      {ORDER.map((q) => {
        const c = QUADRANTS[q]
        const on = open === q
        return (
          <button
            key={q}
            ref={(el) => {
              btnRefs.current[q] = el
            }}
            type="button"
            aria-expanded={on}
            aria-describedby={on ? cardId : undefined}
            aria-label={`${c.scatterLabel}: population ${c.pop}, pay ${c.pay}`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && show(q, e.timeStamp)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && hide(q)}
            onFocus={(e) => show(q, e.timeStamp)}
            onBlur={() => hide(q)}
            onClick={(e) => toggle(q, e.timeStamp)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(null)}
            style={POS[QUADRANT_CORNER[q]]}
            className={cn(
              'absolute z-[2] flex max-w-[210px] flex-col items-start gap-[5px] rounded-[4px] border border-line-strong bg-white/92 px-3 py-[9px] text-left transition-[border-color,box-shadow] hover:border-teal hover:shadow-sm aria-expanded:border-teal aria-expanded:shadow-sm',
              'max-narrow:max-w-[170px] max-narrow:px-[9px] max-narrow:py-[7px]',
              'max-sm:static max-sm:max-w-none max-sm:flex-[1_1_calc(50%-4px)]',
            )}
          >
            <span className="text-sm font-semibold text-ink max-narrow:text-[13px]">{c.scatterLabel}</span>
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-[3px] text-xs whitespace-nowrap text-ink max-narrow:text-[11px]">
                <PopIcon />
                Population
                <Arrow dir={c.pop} />
              </span>
              <span className="inline-flex items-center gap-[3px] text-xs whitespace-nowrap text-ink max-narrow:text-[11px]">
                <PayIcon />
                Pay
                <Arrow dir={c.pay} />
              </span>
            </span>
          </button>
        )
      })}
      {copy && (
        <div
          ref={cardRef}
          id={cardId}
          role="tooltip"
          style={pos && pos.q === open ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
          className="pointer-events-none absolute z-[6] w-[270px] rounded-[4px] border border-line-strong bg-white px-3.5 py-3 shadow-md"
        >
          <strong className="mb-1.5 block text-sm font-semibold text-ink">{copy.shock}</strong>
          <p className="text-[13px] leading-[1.5] text-ink-soft">{copy.tip}</p>
        </div>
      )}
    </div>
  )
}
