/* "Inside <City>": the admin city's own row of the board — schooling, crime
   and air against the nation, how many jobs are within reach, and what the
   city has to offer per resident. Reads the place file (suspense). */
import { useMemo } from 'react'
import { latest } from '@/data/derive'
import { usePlace } from '@/data/queries'
import type { Place } from '@/data/types'
import { fmtCompact, fmtInt } from '@/lib/format'
import { fixed, fixedSigned, seriesOf } from './levers-data'
import { StatCard } from './stat-card'

const DASH = '—'
const AIR_LAST_YEAR = 2020

function Rows({ rows }: { rows: { label: string; value: string; note?: string | null }[] }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-ink-soft">{r.label}</dt>
          <dd className="nums text-right font-semibold text-ink">
            {r.value}
            {r.note && <span className="ml-1 font-normal text-ink-soft">{r.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function cityCards(place: Place) {
  const pop = latest(place.panel, 'population')?.population ?? null
  const access = [...place.jobAccess].sort((a, b) => a.minutes - b.minutes)
  return {
    edu: latest(place.education, 'value'),
    education: seriesOf(place.education, (r) => r.value),
    crime: latest(place.crime, 'value'),
    crimes: seriesOf(place.crime, (r) => r.value),
    air: latest(place.airQuality, 'value'),
    airs: seriesOf(place.airQuality, (r) => r.value),
    access,
    a30: access.find((a) => a.minutes === 30) ?? access[0],
    features: place.features,
    /** counts per 10k residents where the place has a population; plain counts (CDPs) otherwise */
    perResident: pop !== null && pop > 0 ? (n: number) => fixed((n / pop) * 10000, 1) : null,
  }
}

export function CityBoard({ placeId }: { placeId: string }) {
  const place = usePlace(placeId)
  const d = useMemo(() => cityCards(place), [place])
  const count = d.perResident ?? ((n: number) => fmtInt(n))

  if (!d.edu && !d.crime && !d.air && !d.access.length && !d.features) {
    return (
      <p className="text-sm text-ink-soft">
        The atlas carries none of these for {place.name}
        {place.class === 'CDP' ? ' — a Census-designated place, which the city-level sources do not cover' : ''}.
      </p>
    )
  }
  return (
    // five cards: three across then two (spans on a six-column grid); when
    // narrow, two-up with the last across the full width (the doubled
    // pseudo-class outranks the desktop nth-child span)
    <ul
      className="grid grid-cols-6 gap-3 max-narrow:grid-cols-2 max-sm:gap-2 [&>li]:col-span-2 [&>li:nth-child(n+4)]:col-span-3 max-narrow:[&>li]:col-span-1 max-narrow:[&>li:nth-child(n+4)]:col-span-1 max-narrow:[&>li:nth-child(odd):last-child]:col-span-2"
      aria-label={`${place.name} evidence board`}
    >
      <li className="min-w-0">
        <StatCard
          label={`Education${d.edu ? `, ${d.edu.year}` : ''}`}
          value={d.edu ? fixedSigned(d.edu.value, 2) : DASH}
          benchmark="grade levels vs the national mean (0)"
          benchmarkValue={0}
          {...d.education}
          source="Test scores in grade-level equivalents vs the national mean"
        />
      </li>
      <li className="min-w-0">
        <StatCard
          label={`Crime severity${d.crime ? `, ${d.crime.year}` : ''}`}
          value={d.crime ? fixed(d.crime.value, 0) : DASH}
          benchmark="100 = the national rate"
          benchmarkValue={100}
          {...d.crimes}
          source="Crime severity per capita, 3-year smoothed"
        />
      </li>
      <li className="min-w-0">
        <StatCard
          label={`Air quality${d.air ? `, ${d.air.year}` : ''}`}
          value={d.air ? fixed(d.air.value, 0) : DASH}
          unit="/ 100"
          benchmark={d.air ? `national ${fixed(d.air.national, 0)} that year · higher = cleaner` : null}
          benchmarkValue={d.air ? d.air.national : null}
          {...d.airs}
          source={`Air quality index, 0–100 · last year ${AIR_LAST_YEAR}`}
        />
      </li>
      <li className="min-w-0">
        <StatCard
          label="Jobs within 30 minutes"
          value={d.a30 ? fmtCompact(d.a30.jobs) : DASH}
          benchmark={d.a30?.rankInMetro ? `rank ${d.a30.rankInMetro} in the metro` : d.access.length ? 'rank not scored' : null}
          source="Jobs reachable at peak travel times · LODES 2023"
        >
          {d.access.length > 0 && (
            <Rows
              rows={d.access.map((a) => ({
                label: `${a.minutes} min`,
                value: fmtInt(a.jobs),
                note: a.rankInMetro ? `#${a.rankInMetro}` : a.undercount ? 'undercount' : null,
              }))}
            />
          )}
        </StatCard>
      </li>
      <li className="min-w-0">
        <StatCard
          label={d.perResident ? 'Restaurants per 10k residents' : 'Restaurants'}
          value={d.features ? count(d.features.restaurants) : DASH}
          benchmark={d.features && !d.perResident ? 'counts — no resident population for this place' : null}
          source="Places of interest, snapshot"
        >
          {d.features && (
            <Rows
              rows={[
                { label: 'Culture', value: count(d.features.culture) },
                { label: 'Daily needs', value: count(d.features.dailyNeeds) },
              ]}
            />
          )}
        </StatCard>
      </li>
    </ul>
  )
}
