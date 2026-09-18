/* Beat 2 — "Is your city pulling with the metro?": the lede, a Replay
   tray, the burst, its key, and a computed reading of where the metro's
   places fall and whether the admin city moves with its metro. */
import { useMemo, type ReactNode } from 'react'
import { Beat } from '@/components/beats/beat'
import { BuildingIcon, MetroIcon } from '@/components/chrome/icons'
import { placesOf, quadrantOf } from '@/data/derive'
import type { PlaceRow, Quadrant } from '@/data/types'
import { CHROME, SCATTER } from '@/lib/palette'
import { QUADRANTS } from '@/lib/quadrants'
import { useToolState } from '@/lib/use-tool-state'
import { CityInMetroBurst } from './city-in-metro'

const ORDER: Quadrant[] = ['supply_negative', 'demand_positive', 'supply_positive', 'demand_negative']

function Key({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      {children}
      {label}
    </span>
  )
}

export function BeatCity({ n, of }: { n: number; of: number }) {
  const { index, metro, summary, place, metroName, cityName } = useToolState()

  const places = useMemo(() => placesOf(metro).filter((p) => p.popCagr !== null && p.wageCagr !== null), [metro])
  // the atlas's quadrant, or the rule re-applied when a row with both rates lacks one
  const qOf = (p: PlaceRow): Quadrant | null =>
    p.popCagr === null || p.wageCagr === null ? null : (p.quadrant ?? quadrantOf(p.popCagr, p.wageCagr, index.medians))
  const counts = useMemo(() => {
    const c: Record<Quadrant, number> = { supply_negative: 0, demand_positive: 0, supply_positive: 0, demand_negative: 0 }
    for (const p of places) c[p.quadrant ?? quadrantOf(p.popCagr ?? 0, p.wageCagr ?? 0, index.medians)]++
    return c
  }, [places, index.medians])

  const cityQ = qOf(place)
  const metroQ = summary.quadrant
  const nPlaces = places.length
  const inList = ORDER.filter((q) => counts[q] > 0).map((q, i, arr) => (
    <span key={q}>
      {i > 0 && (i === arr.length - 1 ? ' and ' : ', ')}
      <span className="nums">{counts[q]}</span> in <b className="font-semibold">{QUADRANTS[q].scatterLabel}</b>
    </span>
  ))

  return (
    <Beat
      id="b2"
      section="constraints"
      n={n}
      of={of}
      title="Is your city pulling with the metro?"
      badge="city"
      lede={
        <>
          That single {metroName} dot is not one economy. Watch it break apart into the places inside the metro, with {cityName} itself picked out. The dashed
          lines stay where they were, because they are still the typical US metro, so every place can be read against two benchmarks at once: its own metro,
          marked by the dashed ring, and the typical metro.
        </>
      }
    >
      <CityInMetroBurst places={places} />

      <div className="mt-3 flex w-full max-w-[880px] flex-wrap items-center gap-x-[26px] gap-y-2 text-[13px] text-ink" aria-label="Key">
        <Key label="Place inside the metro, sized by population">
          <svg width="14" height="14" aria-hidden>
            <circle cx="7" cy="7" r="5" fill={SCATTER.place} />
          </svg>
        </Key>
        <Key
          label={
            <>
              <BuildingIcon className="text-geo-city" width={12} height={15} /> {cityName}
            </>
          }
        >
          <svg width="16" height="16" aria-hidden>
            <circle cx="8" cy="8" r="6.5" fill={SCATTER.home} />
          </svg>
        </Key>
        <Key
          label={
            <>
              <MetroIcon className="text-geo-metro" width={20} height={14} /> The metro as a whole
            </>
          }
        >
          <svg width="18" height="18" aria-hidden>
            <circle cx="9" cy="9" r="7" fill="none" stroke={CHROME.geoMetro} strokeWidth="1.4" strokeDasharray="4 4" />
          </svg>
        </Key>
        <Key label="Typical US metro">
          <svg width="26" height="10" aria-hidden>
            <line x1="1" y1="5" x2="25" y2="5" stroke={CHROME.ink} strokeWidth="1.5" strokeDasharray="6 5" />
          </svg>
        </Key>
      </div>

      <p className="mt-4 max-w-[880px] text-note leading-[1.55] text-ink">
        {nPlaces === 0 ? (
          <>None of the metro’s {summary.nPlaces} places carries both a population and a wage series, so there is nothing to burst into yet. </>
        ) : nPlaces === 1 ? (
          <>
            {summary.nPlaces === 1 ? 'The metro is a single place' : `Only one of the metro’s ${summary.nPlaces} places carries both readings`}, and it sits
            in <b className="font-semibold">{QUADRANTS[qOf(places[0]) ?? 'demand_positive'].scatterLabel}</b>.{' '}
          </>
        ) : (
          <>
            Of the metro’s <span className="nums">{nPlaces}</span> places with both readings, {inList}.{' '}
          </>
        )}
        {cityQ && metroQ ? (
          cityQ === metroQ ? (
            <>
              <b className="font-semibold">{cityName}</b> proper moves with its metro: both read as <b className="font-semibold">{QUADRANTS[cityQ].scatterLabel}</b>
              {place.borderline && ' — though the city sits inside the borderline band'}.
            </>
          ) : (
            <>
              <b className="font-semibold">{cityName}</b> proper reads as <b className="font-semibold">{QUADRANTS[cityQ].scatterLabel}</b> while its metro reads as{' '}
              <b className="font-semibold">{QUADRANTS[metroQ].scatterLabel}</b>
              {place.borderline && ' — though the city sits inside the borderline band'}.
            </>
          )
        ) : (
          <>
            <b className="font-semibold">{cityName}</b> {place.class === 'CDP' ? 'is a census-designated place: the atlas carries no' : 'has no'}{' '}
            {place.popCagr === null ? 'population' : 'wage'} series for it over the window, so it cannot be placed on the plane
            {nPlaces > 0 && '; the places that can be are shown'}.
          </>
        )}
      </p>
    </Beat>
  )
}
