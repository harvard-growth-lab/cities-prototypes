/* The places table (`.plc-table`): the admin place beside the metro and
   up to two picked places; five measures, each with its change per year
   and its rank among the metro's places. Scrolls sideways inside its own
   frame; the row labels stay put on phones. */
import { X } from 'lucide-react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { METRICS, type MetricId, type Rank, type TableColumn } from './place-metrics'

export interface PlacesTableProps {
  columns: TableColumn[]
  ranks: Map<MetricId, Map<string, Rank>>
  onRemove: (column: TableColumn) => void
  className?: string
}

const DASH = '—'
// the row-label column takes only what its longest label needs; on phones it wraps instead
const LABEL_COL = 'sticky left-0 z-[1] w-0 bg-white pl-0 whitespace-nowrap max-sm:min-w-[84px] max-sm:max-w-[112px] max-sm:whitespace-normal'
const INK: Record<TableColumn['kind'], string> = { admin: 'text-geo-city', metro: 'text-geo-metro', place: 'text-ink' }

export function PlacesTable({ columns, ranks, onRemove, className }: PlacesTableProps) {
  return (
    <ScrollArea className={cn('w-full', className)}>
      <table className="w-full min-w-max text-sm" aria-label="The admin place, its metro and picked places compared">
        <TableHeader>
          <TableRow className="border-line hover:bg-transparent">
            <TableHead className={cn(LABEL_COL, 'h-9')}>
              <span className="sr-only">Measure</span>
            </TableHead>
            {columns.map((c) => (
              <TableHead key={c.id} scope="col" className={cn('h-auto min-w-[128px] py-2 pr-3 pl-2 align-bottom text-[13px] font-semibold whitespace-normal', INK[c.kind])}>
                <span className="inline-flex items-start gap-1">
                  <span className="leading-5">
                    {c.name}
                    {c.note && <span className="block text-[11px] leading-4 font-normal text-ink-soft">{c.note}</span>}
                  </span>
                  {c.kind !== 'admin' && (
                    <button
                      type="button"
                      aria-label={`Remove ${c.name} from the table`}
                      title="Remove"
                      onClick={() => onRemove(c)}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-teal-tint hover:text-teal"
                    >
                      <X className="size-3.5" strokeWidth={2.2} aria-hidden />
                    </button>
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {METRICS.map((m) => (
            <TableRow key={m.id} className="border-line hover:bg-transparent">
              <th scope="row" className={cn(LABEL_COL, 'py-3 pr-4 text-left align-middle text-[13px] font-semibold text-ink')} title={m.title}>
                {m.label}
              </th>
              {columns.map((c) => {
                const v = m.value(c)
                const ch = m.change?.(c) ?? null
                const r = c.kind === 'metro' ? undefined : ranks.get(m.id)?.get(c.id)
                return (
                  <TableCell key={c.id} className="py-3 pr-3 pl-2 align-top">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn('nums text-[15px]', v === null ? 'text-ink-soft' : 'text-ink')}>{v === null ? DASH : m.format(v)}</span>
                      {v !== null && ch !== null && m.formatChange && (
                        <span className={cn('nums text-[11px] font-semibold', ch >= 0 ? 'text-rise' : 'text-fall')}>{m.formatChange(ch)}</span>
                      )}
                    </div>
                    {c.kind !== 'metro' && (
                      <div className="nums mt-0.5 text-xs text-ink-soft">
                        {r ? (
                          <>
                            <b className="font-bold text-ink">{r.rank}</b> of {r.of}
                          </>
                        ) : (
                          <span aria-hidden>&nbsp;</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
