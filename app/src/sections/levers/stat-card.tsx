/* One measure on the evidence board: label, the number, the typical metro
   where a median exists, the series as a sparkline, and where it came from.
   A missing measure prints '—' and keeps its place in the grid. */
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Sparkline, type SparkPoint } from './sparkline'

export interface StatCardProps {
  label: string
  value: string
  /** printed after the number, smaller */
  unit?: string
  /** "typical metro 7.3%" / "1.00 = national mix" */
  benchmark?: string | null
  /** the benchmark on the series' scale, for the dashed rule */
  benchmarkValue?: number | null
  series?: SparkPoint[]
  /** "2010–2023", printed under the sparkline */
  span?: string | null
  source: string
  children?: ReactNode
  className?: string
}

export function StatCard({ label, value, unit, benchmark, benchmarkValue = null, series, span, source, children, className }: StatCardProps) {
  const spark = series && series.filter((p) => p.value !== null).length >= 2 ? series : null
  return (
    <Card size="sm" className={cn('h-full gap-0 rounded-[10px] px-4 py-3.5 shadow-none ring-line [--card-spacing:0] max-sm:px-3', className)}>
      <p className="text-xs leading-tight font-semibold text-ink-soft">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="nums text-[26px] leading-none font-bold text-ink max-sm:text-[22px]">
          {value}
          {unit && value !== '—' && <span className="ml-1 text-sm font-semibold text-ink-soft">{unit}</span>}
        </p>
        {spark && (
          <div className="flex shrink-0 flex-col items-end">
            <Sparkline series={spark} benchmark={benchmarkValue} width={110} height={30} className="max-sm:w-[84px]" />
            {span && <span className="nums text-[10.5px] leading-none text-ink-soft/80">{span}</span>}
          </div>
        )}
      </div>
      {benchmark && <p className="nums mt-1.5 text-xs text-ink-soft">{benchmark}</p>}
      {children}
      <p className="mt-2 text-[11px] leading-snug text-ink-soft/80">{source}</p>
    </Card>
  )
}
