/* The metro's row of the evidence board: firms, ideas, the place and its
   inputs, and what living there is like — each against the typical metro
   where the atlas carries a median. */
import { useMemo } from 'react'
import { latest } from '@/data/derive'
import type { Metro, National } from '@/data/types'
import { fmtInt, fmtPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fixed, fixedSigned, seriesOf } from './levers-data'
import { StatCard, type StatCardProps } from './stat-card'

const DASH = '—'
/* Patents by filing year thin out after 2019 (data-spec §1.6.11): the card
   reads that year and the series stops there. */
const PATENTS_LAST_COMPLETE = 2019
const AIR_LAST_YEAR = 2020

const typical = (v: number | null, f: (x: number) => string) => (v === null ? null : `typical metro ${f(v)}`)

function cards(metro: Metro, national: National): StatCardProps[] {
  const med = national.leverMedians
  const firm = latest(metro.firmDynamics, 'startup')
  const startup = seriesOf(metro.firmDynamics, (r) => r.startup)
  const exit = seriesOf(metro.firmDynamics, (r) => r.exit)

  const patRow = metro.innovation.find((r) => r.year === PATENTS_LAST_COMPLETE)
  const patents = seriesOf(
    metro.innovation.filter((r) => r.year <= PATENTS_LAST_COMPLETE),
    (r) => r.patentsPer100k,
  )
  const pub = latest(metro.innovation, 'publicationsPer100k')
  const pubs = seriesOf(metro.innovation, (r) => r.publicationsPer100k)

  const input = (kind: 'Electricity' | 'Water') => {
    const rows = metro.inputIntensity.filter((r) => r.input === kind)
    return { ...seriesOf(rows, (r) => r.intensity), last: rows.length ? rows[rows.length - 1] : null }
  }
  const elec = input('Electricity')
  const water = input('Water')
  const edu = latest(metro.education, 'value')
  const education = seriesOf(metro.education, (r) => r.value)
  const crime = latest(metro.crime, 'value')
  const crimes = seriesOf(metro.crime, (r) => r.value)
  const air = latest(metro.airQuality, 'value')
  const airs = seriesOf(metro.airQuality, (r) => r.value)

  return [
    {
      label: `Startup rate${firm ? `, ${firm.year}` : ''}`,
      value: firm ? fmtPct(firm.startup, 1) : DASH,
      benchmark: typical(med.startupRate, (x) => fmtPct(x, 1)),
      benchmarkValue: med.startupRate,
      ...startup,
      source: 'Census BDS, mix-adjusted · % of firms',
    },
    {
      label: `Firm exit rate${firm ? `, ${firm.year}` : ''}`,
      value: firm ? fmtPct(firm.exit, 1) : DASH,
      benchmark: typical(med.exitRate, (x) => fmtPct(x, 1)),
      benchmarkValue: med.exitRate,
      ...exit,
      source: 'Census BDS, mix-adjusted · % of firms',
    },
    {
      label: `Patents per 100k, ${PATENTS_LAST_COMPLETE}`,
      value: patRow?.patentsPer100k == null ? DASH : fixed(patRow.patentsPer100k, 1),
      benchmark: typical(med.patentsPer100k, (x) => fixed(x, 1)),
      benchmarkValue: med.patentsPer100k,
      ...patents,
      source: `Patent families by filing year · last complete year ${PATENTS_LAST_COMPLETE}`,
    },
    {
      label: `Publications per 100k${pub ? `, ${pub.year}` : ''}`,
      value: pub ? fmtInt(pub.publicationsPer100k) : DASH,
      benchmark: typical(med.publicationsPer100k, (x) => fmtInt(x)),
      benchmarkValue: med.publicationsPer100k,
      ...pubs,
      source: 'Research publications per 100k residents',
    },
    {
      label: 'Remoteness index',
      value: metro.remoteness === null ? DASH : fixed(metro.remoteness, 2),
      benchmark: typical(med.remoteness, (x) => fixed(x, 2)),
      source: 'Distance from other markets · 0 = central, 1 = remote',
    },
    {
      label: `Electricity input intensity${elec.last ? `, ${elec.last.year}` : ''}`,
      value: elec.last ? `${fixed(elec.last.intensity, 2)}×` : DASH,
      benchmark: '1.00 = the national industry mix',
      benchmarkValue: 1,
      series: elec.series,
      span: elec.span,
      source: 'How electricity-hungry the metro’s industry mix is',
    },
    {
      label: `Water input intensity${water.last ? `, ${water.last.year}` : ''}`,
      value: water.last ? `${fixed(water.last.intensity, 2)}×` : DASH,
      benchmark: '1.00 = the national industry mix',
      benchmarkValue: 1,
      series: water.series,
      span: water.span,
      source: 'How water-hungry the metro’s industry mix is',
    },
    {
      label: `Education${edu ? `, ${edu.year}` : ''}`,
      value: edu ? fixedSigned(edu.value, 2) : DASH,
      benchmark: 'grade levels vs the national mean (0)',
      benchmarkValue: 0,
      ...education,
      source: 'Test scores in grade-level equivalents vs the national mean',
    },
    {
      label: `Crime severity${crime ? `, ${crime.year}` : ''}`,
      value: crime ? fixed(crime.value, 0) : DASH,
      benchmark: '100 = the national rate',
      benchmarkValue: 100,
      ...crimes,
      source: 'Crime severity per capita, 3-year smoothed',
    },
    {
      label: `Air quality${air ? `, ${air.year}` : ''}`,
      value: air ? fixed(air.value, 0) : DASH,
      unit: '/ 100',
      benchmark: 'higher = cleaner',
      ...airs,
      source: `Air quality index, 0–100 · last year ${AIR_LAST_YEAR}`,
    },
  ]
}

/* Ten cards grouped 4 + 6 so no row is left with a lone card. */
const GROUPS: { title: string; from: number; to: number; cols: string }[] = [
  { title: 'Firms and ideas', from: 0, to: 4, cols: 'grid-cols-4 max-narrow:grid-cols-2' },
  { title: 'The place, its inputs, and living there', from: 4, to: 10, cols: 'grid-cols-3 max-narrow:grid-cols-2' },
]

export function EvidenceBoard({ metro, national }: { metro: Metro; national: National }) {
  const items = useMemo(() => cards(metro, national), [metro, national])
  return (
    <div className="flex flex-col gap-5" aria-label="Metro evidence board">
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h4 className="mb-2 text-xs font-bold tracking-[1px] text-ink-soft uppercase">{g.title}</h4>
          <ul className={cn('grid gap-3 max-sm:gap-2', g.cols)}>
            {items.slice(g.from, g.to).map((c) => (
              <li key={c.label} className="min-w-0">
                <StatCard {...c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
