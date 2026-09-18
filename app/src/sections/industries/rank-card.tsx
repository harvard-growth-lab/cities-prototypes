/* The complexity rank card (`.rank-card`), shown in the first beat when
   the figure is coloured by complexity. */
import { ordinal } from '@/data/derive'
import { fmtInt } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface RankCardProps {
  rank: number
  /** how many metros carry an ECI */
  of: number
  year: number
  className?: string
}

const PodiumIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 20h18" />
    <path d="M4 20v-6h5v6" />
    <path d="M9.5 20V9h5v11" />
    <path d="M15 20v-4h5v4" />
  </svg>
)

export function RankCard({ rank, of, year, className }: RankCardProps) {
  const word = ordinal(rank)
  const n = String(rank)
  const suffix = word.slice(n.length)
  return (
    <div className={cn('flex items-center gap-5 rounded-[10px] border border-line bg-[#f4f6f7] py-4 pr-[22px] pl-5', className)}>
      <p className="nums text-[34px] leading-none font-bold text-teal">
        {n}
        <sup className="text-[15px] font-semibold">{suffix}</sup>
      </p>
      <div>
        <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
          <span className="flex size-[27px] items-center justify-center rounded-full bg-geo-city text-white">
            <PodiumIcon />
          </span>
          of {fmtInt(of)} US metros
        </p>
        <p className="mt-0.5 text-[13px] text-ink-soft">Complexity rank, {year}</p>
      </div>
    </div>
  )
}
