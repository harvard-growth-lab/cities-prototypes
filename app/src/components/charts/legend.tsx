/* Swatch keys (`.sector-key`): a 13px mark and a name, wrapping. */
import { cn } from '@/lib/utils'

export type LegendKind = 'swatch' | 'line' | 'dot' | 'dashed' | 'ring'

export interface LegendItem {
  color: string
  label: string
  kind?: LegendKind
}

function Mark({ color, kind = 'swatch' }: { color: string; kind?: LegendKind }) {
  switch (kind) {
    case 'swatch':
      return <span className="inline-block size-[13px] shrink-0 rounded-[3px]" style={{ background: color }} />
    case 'dot':
      return <span className="inline-block size-[9px] shrink-0 rounded-full" style={{ background: color }} />
    case 'ring':
      return <span className="inline-block size-[10px] shrink-0 rounded-full border-2" style={{ borderColor: color }} />
    case 'line':
      return <span className="inline-block h-[3px] w-[18px] shrink-0 rounded-sm" style={{ background: color }} />
    case 'dashed':
      return (
        <svg width="18" height="4" aria-hidden className="shrink-0">
          <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      )
  }
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink', className)}>
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <Mark color={it.color} kind={it.kind} />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  )
}
