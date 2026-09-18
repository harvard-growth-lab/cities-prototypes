/* The five measures the places table compares, read the same way for the
   admin place, any picked place, and the metro. Ranks are among the
   metro's places that carry the measure. Pure; no React. */
import { nearest, rankOf } from '@/data/derive'
import type { Metro, MetroSummary, PlaceRow } from '@/data/types'
import { fmtCompact, fmtMoney, fmtMult, fmtPct, fmtRate } from '@/lib/format'

/** Population for a table cell: "673K", and three figures once past a million ("5.03M", not "5M"). */
const fmtPop = (x: number) =>
  x >= 1e6 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 }).format(x) : fmtCompact(x)

export type MetricId = 'population' | 'wage' | 'homeValue' | 'unemployment' | 'jobsRatio'

export interface Metric {
  id: MetricId
  label: string
  /** rank 1 = the largest, or the lowest when `asc` */
  asc?: boolean
  title?: string
  value: (c: MetricValues) => number | null
  change?: (c: MetricValues) => number | null
  format: (v: number) => string
  formatChange?: (v: number) => string
}

export interface MetricValues {
  population: number | null
  popCagr: number | null
  wage: number | null
  wageCagr: number | null
  homeValue: number | null
  costCagr: number | null
  unemployment: number | null
  jobsRatio: number | null
}

export interface TableColumn extends MetricValues {
  id: string
  name: string
  kind: 'admin' | 'metro' | 'place'
  /** places without a population (CDPs) say so under the name */
  note?: string
}

export const METRICS: Metric[] = [
  { id: 'population', label: 'Population', value: (c) => c.population, change: (c) => c.popCagr, format: fmtPop, formatChange: fmtRate },
  { id: 'wage', label: 'Average wage', title: 'IRS wage per return, 3-year centred mean', value: (c) => c.wage, change: (c) => c.wageCagr, format: (v) => fmtMoney(v, 'usa', true), formatChange: fmtRate },
  { id: 'homeValue', label: 'Home value', value: (c) => c.homeValue, change: (c) => c.costCagr, format: (v) => fmtMoney(v, 'usa', true), formatChange: fmtRate },
  { id: 'unemployment', label: 'Unemployment', title: 'Rank 1 = the lowest rate', asc: true, value: (c) => c.unemployment, format: (v) => fmtPct(v) },
  { id: 'jobsRatio', label: 'Jobs per resident worker', title: 'Jobs located in the place ÷ its employed residents', value: (c) => c.jobsRatio, format: fmtMult },
]

const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b : null)

export function placeColumn(p: PlaceRow, kind: 'admin' | 'place' = 'place'): TableColumn {
  return {
    id: p.id,
    name: p.name,
    kind,
    note: p.class === 'CDP' ? 'census-designated place' : undefined,
    population: p.population,
    popCagr: p.popCagr,
    wage: p.wage,
    wageCagr: p.wageCagr,
    homeValue: p.homeValue,
    costCagr: p.costCagr,
    unemployment: p.unemployment,
    jobsRatio: ratio(p.jobsHere, p.residentWorkers),
  }
}

/** The metro's own values: the latest panel year, the diagnosis rates, home value at the window's end. */
export function metroColumn(m: Metro, name: string, windowEnd: number): TableColumn {
  const pop = nearest(m.panel, 'population', windowEnd)
  const wage = nearest(m.panel, 'wage', windowEnd)
  const unemp = nearest(m.panel, 'unemployment', windowEnd)
  const home = nearest(m.housing, 'value', windowEnd)
  return {
    id: `metro-${m.summary.id}`,
    name,
    kind: 'metro',
    population: pop?.population ?? null,
    popCagr: m.diagnosis.popCagr,
    wage: wage?.wage ?? null,
    wageCagr: m.diagnosis.wageCagr,
    homeValue: home?.value ?? null,
    costCagr: m.diagnosis.costCagr,
    unemployment: unemp?.unemployment ?? null,
    jobsRatio: null,
  }
}

export interface Rank {
  rank: number
  of: number
}

/** Rank of every place's value for each metric, among the places that have it (none when a place is alone). */
export function rankTable(places: PlaceRow[]): Map<MetricId, Map<string, Rank>> {
  const cols = places.map((p) => placeColumn(p))
  const out = new Map<MetricId, Map<string, Rank>>()
  for (const metric of METRICS) {
    const values = cols.map((c) => metric.value(c))
    const of = values.filter((v) => v !== null).length
    const m = new Map<string, Rank>()
    if (of > 1)
      cols.forEach((c, i) => {
        const v = values[i]
        if (v !== null) m.set(c.id, { rank: rankOf(v, values, !metric.asc), of })
      })
    out.set(metric.id, m)
  }
  return out
}

/** Sort for the picker: incorporated places by population, then CDPs by wage, then the rest by name. */
export function pickerOrder(a: PlaceRow, b: PlaceRow): number {
  if (a.class !== b.class) return a.class === 'incorporated' ? -1 : 1
  const pa = a.population ?? -1
  const pb = b.population ?? -1
  if (pa !== pb) return pb - pa
  const wa = a.wage ?? -1
  const wb = b.wage ?? -1
  if (wa !== wb) return wb - wa
  return a.name.localeCompare(b.name)
}

/** The place's share of the metro's population, both at the window's end; null for a place without one. */
export const shareOfMetro = (place: Pick<PlaceRow, 'population'>, metro: Pick<MetroSummary, 'population'>): number | null =>
  place.population !== null && metro.population !== null && metro.population > 0 ? place.population / metro.population : null
