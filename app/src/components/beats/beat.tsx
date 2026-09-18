/* The standard beat anatomy (design-spec §2.2): counter → title → the
   Viewing badge → lede → whatever the beat shows. `data-beat` is what the
   section's scroll-spy and the journey read. */
import type { ReactNode } from 'react'
import { sectionBySlug, type SectionSlug } from '@/lib/sections'
import { cn } from '@/lib/utils'
import { GeoBadge } from './geo-badge'

export interface BeatProps {
  id: string
  section: SectionSlug
  /** "1/3" */
  n: number
  of: number
  title: ReactNode
  badge?: 'city' | 'metro'
  lede?: ReactNode
  className?: string
  children?: ReactNode
}

export function BeatCounter({ section, n, of, className }: Pick<BeatProps, 'section' | 'n' | 'of' | 'className'>) {
  return (
    <span className={cn('nums block text-xs font-medium text-ink-soft', className)}>
      {sectionBySlug(section)?.name}{' '}
      <b className="font-semibold text-ink">
        {n}/{of}
      </b>
    </span>
  )
}

export function BeatTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-h3 font-semibold tracking-[-0.3px] text-ink', className)}>{children}</h2>
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-4 mb-2 max-w-[760px] text-base leading-[1.6] text-ink', className)}>{children}</p>
}

export function Beat({ id, section, n, of, title, badge, lede, className, children }: BeatProps) {
  return (
    <section id={id} data-beat={id} className={cn('scroll-mt-chrome', className)}>
      <BeatCounter section={section} n={n} of={of} className="mb-3.5" />
      <BeatTitle>{title}</BeatTitle>
      {badge && (
        <div className="mt-3 border-b border-line pb-3.5">
          <GeoBadge geo={badge} />
        </div>
      )}
      {lede && <Lede>{lede}</Lede>}
      {children}
    </section>
  )
}
