/* The tier donut in the second beat's text column: a 70px ring of the three
   tiers beside three rows. Hover, focus or click a row and the others
   fade while a card names the tier's three largest industries. */
import { arc, pie } from 'd3'
import { useEffect, useId, useRef, useState } from 'react'
import type { TradabilityClass } from '@/data/types'
import { fmtInt } from '@/lib/format'
import { TIER_COLOR, TIER_LABEL, TIER_ORDER } from '@/lib/palette'
import { useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { pct0 } from './copy'
import type { TierStat } from './use-industry-data'

export interface TierDonutProps {
  tiers: Record<TradabilityClass, TierStat>
  className?: string
}

const R_OUT = 34
const R_IN = 23

export function TierDonut({ tiers, className }: TierDonutProps) {
  const [hot, setHot] = useState<TradabilityClass | null>(null)
  const [pinned, setPinned] = useState<TradabilityClass | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const cardId = useId()
  const shown = pinned ?? hot

  // a pinned card closes on Escape or a tap elsewhere
  useEffect(() => {
    if (!pinned) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(null)
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPinned(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [pinned])

  const slices = pie<TierStat>()
    .value((d) => d.jobs)
    .sort(null)
    .padAngle(0.014)(TIER_ORDER.map((t) => tiers[t]))
  const path = arc<{ startAngle: number; endAngle: number; padAngle: number }>().innerRadius(R_IN).outerRadius(R_OUT)
  const fade = reduced ? undefined : 'opacity 150ms'
  const stat = shown ? tiers[shown] : null
  const top3 = stat ? stat.industries.slice(0, 3) : []

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="flex items-center gap-4">
        <svg width={70} height={70} viewBox="-35 -35 70 70" role="img" aria-label={`Share of metro jobs by tradability tier: ${TIER_ORDER.map((t) => `${TIER_LABEL[t]} ${pct0(tiers[t].share)}`).join(', ')}`} className="shrink-0">
          {slices.map((s) => (
            <path key={s.data.tier} d={path(s) ?? undefined} fill={TIER_COLOR[s.data.tier]} opacity={shown && shown !== s.data.tier ? 0.3 : 1} style={{ transition: fade }} />
          ))}
        </svg>
        <div className="flex flex-col gap-0.5">
          {TIER_ORDER.map((t) => {
            const on = shown === t
            return (
              <button
                key={t}
                type="button"
                aria-pressed={pinned === t}
                aria-controls={cardId}
                aria-expanded={on}
                onMouseEnter={() => setHot(t)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(t)}
                onBlur={() => setHot(null)}
                onClick={() => setPinned((p) => (p === t ? null : t))}
                className={cn('flex items-center gap-2.5 rounded-[4px] px-2 py-[3px] text-left text-[13.5px] text-ink', on && 'bg-teal-tint', shown && !on && 'opacity-45')}
                style={{ transition: fade }}
              >
                <span className="inline-block size-[11px] shrink-0 rounded-[2px]" style={{ background: TIER_COLOR[t] }} />
                <span className="font-semibold">{TIER_LABEL[t]}</span>
                <span className="nums text-ink-soft">{pct0(tiers[t].share)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div
        id={cardId}
        hidden={!stat}
        role="region"
        aria-live="polite"
        className="absolute top-full left-0 z-10 mt-2 w-[300px] max-w-[calc(100vw-40px)] rounded-[6px] border border-line-strong bg-white px-4 py-3 text-[13px] text-ink shadow-md"
      >
        {stat && shown && (
          <>
            <p className="font-semibold">
              {TIER_LABEL[shown]} <span className="nums">{pct0(stat.share)}</span> of metro jobs · <span className="nums">{fmtInt(Math.round(stat.jobs))}</span> jobs
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {top3.map((d) => (
                <li key={d.code} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate" title={d.name}>
                    {d.name}
                  </span>
                  <span className="nums shrink-0 font-semibold">{fmtInt(Math.round(d.employment))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">
              {top3.length === stat.industries.length ? `All ${stat.industries.length} industries in the tier` : `The ${top3.length === 3 ? 'three' : top3.length} largest of the ${stat.industries.length} industries in the tier`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
