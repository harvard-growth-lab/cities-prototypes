/* "Boston is the anchor of its metro": a ring that fills to the admin
   place's share of the metro's population, its rank among the places that
   have one. Rendered only when the place has a population. */
import { Anchor } from 'lucide-react'
import { useRef } from 'react'
import { ordinal } from '@/data/derive'
import { CHROME } from '@/lib/palette'
import { useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { useInView } from './use-in-view'

export interface AnchorCardProps {
  cityName: string
  /** fraction of the metro's population, latest common year */
  share: number
  rank: number
  /** places with a population */
  of: number
  className?: string
}

const SIZE = 92
const STROKE = 11
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

export function AnchorCard({ cityName, share, rank, of, className }: AnchorCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, 0.4) > 0
  const reduced = useReducedMotion()
  const fill = seen || reduced ? Math.max(0, Math.min(1, share)) : 0
  const pct = `${(share * 100).toFixed(1)}%`
  const anchor = rank === 1

  return (
    <div ref={ref} className={cn('flex items-center gap-5 rounded-[10px] border border-line bg-[#f4f6f7] py-[18px] pr-[22px] pl-5 max-sm:gap-4 max-sm:px-4', className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-[92px] shrink-0 max-sm:size-[68px]"
        role="img"
        aria-label={`${pct} of the metro's population lives in ${cityName}`}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#e1e6e8" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={CHROME.geoCity}
          strokeWidth={STROKE}
          strokeDasharray={`${fill * C} ${C}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: reduced ? 'none' : 'stroke-dasharray 900ms cubic-bezier(.32,.72,.24,1)' }}
        />
        <text x="50%" y="50%" dy="0.36em" textAnchor="middle" fontSize={15} fontWeight={700} fill={CHROME.ink}>
          {pct}
        </text>
      </svg>
      <div className="min-w-0">
        <p className="flex items-center gap-2.5 text-[16.5px] leading-tight font-bold text-ink">
          <span className="flex size-[27px] shrink-0 items-center justify-center rounded-full bg-geo-city text-white">
            <Anchor className="size-[15px]" strokeWidth={2.2} aria-hidden />
          </span>
          <span>
            <b className="font-bold">{cityName}</b> {anchor ? 'is the anchor of its metro' : `is one of ${of} places in its metro`}
          </span>
        </p>
        <dl className="mt-2.5 grid grid-cols-[auto_auto] gap-x-5 gap-y-1 text-[13px] text-ink">
          <dt>Share of metro population</dt>
          <dd className="nums text-[14.5px] font-bold">{pct}</dd>
          <dt>Rank among the metro’s {of} {of === 1 ? 'place' : 'places'}</dt>
          <dd className="nums text-[14.5px] font-bold">
            {ordinal(rank)} of {of}
          </dd>
        </dl>
      </div>
    </div>
  )
}
