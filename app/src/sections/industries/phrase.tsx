/* A phrase in a lede that lights part of the figure (`.mi-hl`): dotted
   metro-hue underline, teal tint while lit. Hover or focus lights it; a
   click (or Enter / Space) pins it until the next click.

   It is a span with the button role, not a <button>: Chromium lays a
   <button> out as inline-block whatever its display, so a phrase longer
   than the line would drop to its own line instead of wrapping with the
   sentence. */
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PhraseProps {
  lit: boolean
  pinned: boolean
  onLit: (on: boolean) => void
  onPin: () => void
  children: ReactNode
}

export function Phrase({ lit, pinned, onLit, onPin, children }: PhraseProps) {
  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPin()
    }
  }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={pinned}
      onMouseEnter={() => onLit(true)}
      onMouseLeave={() => onLit(false)}
      onFocus={() => onLit(true)}
      onBlur={() => onLit(false)}
      onClick={onPin}
      onKeyDown={onKey}
      className={cn(
        'cursor-pointer rounded-[2px] underline decoration-geo-metro decoration-dotted underline-offset-[3px] transition-colors duration-150 [-webkit-box-decoration-break:clone] [box-decoration-break:clone]',
        lit && 'bg-teal-tint',
      )}
    >
      {children}
    </span>
  )
}
