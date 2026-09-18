/* The three-up strip under a lede (`.q-stats`): a disc, a label over a
   value, each taking only the width it needs. */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'rise' | 'fall' | 'neutral'

export interface StatItem {
  icon: ReactNode
  label: string
  value: string
  /** colours the value (and tints the disc); neutral = ink on a teal disc */
  tone?: Tone
  title?: string
}

const DISC: Record<Tone, string> = {
  neutral: 'bg-teal text-white',
  rise: 'bg-rise/14 text-rise',
  fall: 'bg-fall/12 text-fall',
}
const VALUE: Record<Tone, string> = { neutral: 'text-ink', rise: 'text-rise', fall: 'text-fall' }

export function StatRow({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <dl className={cn('mt-4 flex flex-wrap gap-x-7 gap-y-2.5', className)}>
      {items.map((it, i) => {
        const tone = it.tone ?? 'neutral'
        return (
          <div key={i} className="grid grid-cols-[auto_auto] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-px" title={it.title}>
            <span className={cn('row-span-2 flex size-[26px] items-center justify-center rounded-full [&>svg]:size-[15px]', DISC[tone])}>{it.icon}</span>
            <dt className="text-xs leading-tight text-ink">{it.label}</dt>
            <dd className={cn('nums text-sm leading-tight font-bold whitespace-nowrap', VALUE[tone])}>{it.value}</dd>
          </div>
        )
      })}
    </dl>
  )
}
