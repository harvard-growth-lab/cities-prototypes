/* The cursor-following card (`.rca-tip` / `.row-tip`): 14px right and 10px
   above the pointer, flipped to stay inside its container. Rendered by the
   chart's wrapper — give the wrapper `position: relative` and the ref. */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { cn } from '@/lib/utils'

interface TipState {
  x: number
  y: number
  content: ReactNode
}

export function useChartTooltip(containerRef: RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<TipState | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  const show = useCallback((clientX: number, clientY: number, content: ReactNode) => setTip({ x: clientX, y: clientY, content }), [])
  const move = useCallback((clientX: number, clientY: number) => setTip((t) => (t ? { ...t, x: clientX, y: clientY } : t)), [])
  const hide = useCallback(() => setTip(null), [])

  // position after paint, once the card's size is known; flip when it would leave the wrapper
  useLayoutEffect(() => {
    const el = tipRef.current
    const host = containerRef.current
    if (!el || !host || !tip) return
    const box = host.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = tip.x - box.left + 14
    let top = tip.y - box.top - 10 - h
    if (left + w > box.width - 4) left = Math.max(4, tip.x - box.left - 14 - w)
    if (top < 4) top = Math.min(box.height - h - 4, tip.y - box.top + 16)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [tip, containerRef])

  const Tooltip = tip ? (
    <div
      ref={tipRef}
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-[250px] max-w-[min(330px,calc(100vw-48px))] rounded-[4px] border border-line-strong bg-white px-3.5 py-3 text-sm text-ink shadow-md"
    >
      {tip.content}
    </div>
  ) : null

  return { show, move, hide, Tooltip, visible: tip !== null }
}

/** A label/value line inside the card. */
export function TipRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 text-[13px] leading-[1.5]', className)}>
      <span className="text-ink-soft">{label}</span>
      <span className="nums font-semibold text-ink">{value}</span>
    </div>
  )
}

/** The big number with its caption. */
export function TipLead({ value, caption, className }: { value: ReactNode; caption: ReactNode; className?: string }) {
  return (
    <p className={cn('my-1.5 leading-tight', className)}>
      <b className="nums text-[21px] font-bold text-ink">{value}</b>{' '}
      <span className="text-[13px] text-ink-soft">{caption}</span>
    </p>
  )
}

/** The bold first line. */
export function TipHead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mb-1 text-sm font-semibold text-ink', className)}>{children}</p>
}
