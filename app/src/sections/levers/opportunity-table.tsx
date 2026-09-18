/* The ten nearest absent industries, ranked by density × PCI — the same
   order that names the dots in the chart, in a form a screen reader and a
   phone can read. */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtCompact } from '@/lib/format'
import { SECTOR_COLOR, TIER_LABEL } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { fixed, type Opportunity } from './levers-data'

const NUM = 'nums text-right'
const HEAD = 'h-9 text-xs font-semibold text-ink-soft'

export interface OpportunityTableProps {
  opportunities: Opportunity[]
  n?: number
  className?: string
}

export function OpportunityTable({ opportunities, n = 10, className }: OpportunityTableProps) {
  const rows = opportunities.slice(0, n)
  if (!rows.length) return null
  return (
    <div className={cn('rounded-[8px] border border-line', className)}>
      <Table className="text-[13px]" aria-label={`Top ${rows.length} opportunities by density × PCI`}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(HEAD, 'w-8 pl-3')}>#</TableHead>
            <TableHead className={HEAD}>Industry</TableHead>
            <TableHead className={cn(HEAD, NUM)}>Density</TableHead>
            <TableHead className={cn(HEAD, NUM)}>PCI</TableHead>
            <TableHead className={HEAD}>Tier</TableHead>
            {/* the US-jobs column stands down on phones so the table fits without panning */}
            <TableHead className={cn(HEAD, NUM, 'pr-3 max-sm:hidden')}>US jobs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o, i) => (
            <TableRow key={o.code} className="hover:bg-teal-tint/60">
              <TableCell className="nums pl-3 text-ink-soft">{i + 1}</TableCell>
              <TableCell className="max-w-[360px] whitespace-normal">
                <span className="flex items-start gap-2">
                  <span className="mt-[5px] inline-block size-[9px] shrink-0 rounded-[2px]" style={{ background: SECTOR_COLOR[o.sector] }} aria-hidden />
                  <span>
                    <span className="block leading-tight font-semibold text-ink">{o.name}</span>
                    <span className="block text-xs text-ink-soft">{o.sector}</span>
                  </span>
                </span>
              </TableCell>
              <TableCell className={NUM}>{fixed(o.density, 2)}</TableCell>
              <TableCell className={NUM}>{fixed(o.pci, 2)}</TableCell>
              <TableCell className="text-ink-soft">{o.tier ? TIER_LABEL[o.tier] : '—'}</TableCell>
              <TableCell className={cn('pr-3 text-ink-soft max-sm:hidden', NUM)}>{fmtCompact(o.nationalJobs)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
