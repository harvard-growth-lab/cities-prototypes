/* The landing's right column (design-spec §2.1): pick a metro, read its two
   growth rates against the country, see the name the plane gives it, and
   go. Everything comes from index.json — the summary row of the metro. */
import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { CityBuildIcon, PayPictogram, PeoplePictogram, QuadrantIcon } from '@/components/chrome/icons'
import { MetroPicker } from '@/components/chrome/metro-picker'
import type { AtlasIndex, MetroSummary } from '@/data/types'
import { fmtSignedPct, fmtSignedPp } from '@/lib/format'
import { payWord, popWord, QUADRANTS } from '@/lib/quadrants'
import { cn } from '@/lib/utils'

interface Props {
  index: AtlasIndex
  metro: MetroSummary
  onChange: (m: MetroSummary) => void
}

function Stat({ kind, rate, national, label }: { kind: 'pop' | 'pay'; rate: number | null; national: number; label: string }) {
  const up = rate !== null && rate >= 0
  const word = rate === null ? 'no data' : kind === 'pop' ? popWord(rate, national) : payWord(rate, national)
  const ahead = rate !== null && rate >= national
  return (
    <div className={cn('rounded-lg px-3.5 pt-[13px] pb-3', up ? 'bg-[rgba(61,154,67,.09)]' : 'bg-[rgba(192,36,74,.07)]')}>
      <div className={cn('flex items-center gap-2', up ? 'text-rise' : 'text-fall')}>
        {kind === 'pop' ? <PeoplePictogram /> : <PayPictogram down={!up} />}
        <span className="text-xs font-bold text-ink">{word}</span>
      </div>
      <p className={cn('nums mt-1.5 text-[34px] leading-none font-bold tracking-[-1px] max-sm:text-[27px]', up ? 'text-rise' : 'text-fall')}>
        {fmtSignedPct(rate)}
      </p>
      <p className="mt-1.5 text-xs font-bold text-ink">{label}</p>
      <p className="nums mt-0.5 text-[11.5px] text-ink-soft" title={rate === null ? undefined : `${fmtSignedPp(rate - national)} against the national trend`}>
        {ahead ? '▲' : '▼'} national {fmtSignedPct(national)}
      </p>
    </div>
  )
}

export function DiagnosePanel({ index, metro, onChange }: Props) {
  const q = metro.quadrant ? QUADRANTS[metro.quadrant] : null
  return (
    <aside className="flex flex-col gap-[18px] rounded-[14px] border border-line bg-white p-[26px] pb-6 shadow-[0_18px_48px_rgba(37,88,98,.18)] max-narrow:p-5 max-sm:rounded-xl max-sm:px-4 max-sm:pt-[18px] max-sm:pb-4">
      <div>
        <label className="mb-1.5 block text-[15px] text-ink">Select a location</label>
        <MetroPicker size="lg" value={metro.id} onChange={onChange} />
      </div>

      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
        <Stat kind="pop" rate={metro.popCagr} national={index.national.popCagr} label="Population" />
        <Stat kind="pay" rate={metro.wageCagr} national={index.national.wageCagr} label="Wage" />
        <p className="col-span-2 text-[11.5px] text-ink-soft">
          per year, {index.window.start} to {index.window.end}
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-[10px] bg-teal-tint px-4 py-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-teal max-sm:size-11">
          {q ? <QuadrantIcon noun={q.noun} className="max-sm:size-7" /> : <span className="text-2xl font-bold">?</span>}
        </span>
        <div className="min-w-0">
          <h2 className="text-[25px] leading-[1.12] font-bold tracking-[-0.4px] text-ink max-sm:text-[20px]">
            {q ? (
              <>
                {metro.name} {metro.borderline ? 'leans toward' : 'is'} <em className="text-teal not-italic">{q.name}</em>
              </>
            ) : (
              <>Not enough data to place {metro.name}</>
            )}
          </h2>
          <p className="mt-1 text-[13.5px] leading-[1.45] text-ink">
            {q ? q.tagline : 'The atlas has no growth readings for this metro over the window.'}
          </p>
          {q && metro.borderline && (
            <p className="mt-1.5 text-xs text-ink-soft">Close to the typical US metro on both counts, so the verdict is a lean rather than a call.</p>
          )}
        </div>
      </div>

      <Link
        to="/city/$slug/fundamentals"
        params={{ slug: metro.slug }}
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-teal px-[18px] py-[15px] text-[17px] font-bold text-white shadow-[0_6px_18px_rgba(37,88,98,.28)] transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-[#1d4750] max-sm:text-base"
      >
        <CityBuildIcon />
        <span>Diagnose {metro.name}</span>
        <ChevronDown className="size-4" strokeWidth={2.2} />
      </Link>
    </aside>
  )
}
