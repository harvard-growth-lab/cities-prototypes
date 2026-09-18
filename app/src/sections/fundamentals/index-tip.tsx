/* The crosshair card (`.pc-tip`): the year, each line's count and index,
   then every line's growth over the window. */
import { TipHead } from '@/components/charts/chart-tooltip'
import { cn } from '@/lib/utils'
import { rateMark, type IndexedPoint } from './series'

export interface TipRowData {
  color: string
  label: string
  point: IndexedPoint | undefined
  rate: number | null
}

const DASH = '—'
const idx = (p: IndexedPoint | undefined) => {
  if (!p || p.index === null) return DASH
  const d = p.index - 100
  return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`
}

export function IndexTip({ year, rows, band, format }: { year: number; rows: TipRowData[]; band: [number, number]; format: (v: number) => string }) {
  return (
    <div>
      <TipHead>{year}</TipHead>
      <dl className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-x-2.5 gap-y-0.5 text-[13px]">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <span className="inline-block size-2.5 self-center rounded-[2px]" style={{ background: r.color }} aria-hidden />
            <dt className="text-ink">{r.label}</dt>
            <dd className="nums text-right font-semibold text-ink">{r.point?.value !== null && r.point?.value !== undefined ? format(r.point.value) : DASH}</dd>
            <dd className="nums text-right text-ink-soft">{idx(r.point)}{r.point?.modelled ? '*' : ''}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 border-t border-line pt-1.5 text-[11px] font-semibold tracking-[0.8px] text-ink-soft uppercase">
        Change over {band[0]}–{band[1]}
      </p>
      <dl className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[13px]">
        {rows.map((r) => {
          const mark = rateMark(r.rate)
          return (
            <div key={r.label} className="contents">
              <dt className="text-ink-soft">{r.label}</dt>
              <dd className={cn('nums text-right font-semibold', mark.tone === 'rise' ? 'text-rise' : mark.tone === 'fall' ? 'text-fall' : 'text-ink-soft')}>{mark.text}</dd>
            </div>
          )
        })}
      </dl>
      {rows.some((r) => r.point?.modelled) && <p className="mt-1.5 text-[11px] text-ink-soft">* modelled year</p>}
    </div>
  )
}
