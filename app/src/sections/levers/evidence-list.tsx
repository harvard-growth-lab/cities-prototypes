/* The evidence on the table under the tree (the tree walk's `.tw-evidence`
   cards): label, value, a one-line reading. Tiles that speak to the lit
   branch carry a gold edge; the others stay quiet. */
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Evidence, Side } from './levers-data'

export interface EvidenceListProps {
  items: Evidence[]
  side: Side | null
  className?: string
}

export function EvidenceList({ items, side, className }: EvidenceListProps) {
  return (
    <ul className={cn('grid grid-cols-5 gap-2.5 max-narrow:grid-cols-3 max-sm:grid-cols-2', className)} aria-label="The evidence on the table">
      {items.map((e) => {
        const on = e.side === 'both' || e.side === side
        return (
          <li key={e.key} className="min-w-0">
            <Card
              size="sm"
              className={cn(
                'h-full gap-1.5 rounded-[8px] px-3 py-2.5 shadow-none ring-line [--card-spacing:0]',
                on ? 'border-l-[3px] border-l-[#c98500]' : 'opacity-70',
              )}
            >
              <p className="text-[11px] font-bold tracking-[1px] text-ink-soft uppercase">{e.label}</p>
              <p className="nums text-sm leading-[1.35] font-bold text-ink">
                {e.value.map((v, i) => (
                  <span key={i} className="block">
                    {v}
                  </span>
                ))}
              </p>
              <p className="text-xs leading-[1.4] text-ink-soft">{e.reading}</p>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
