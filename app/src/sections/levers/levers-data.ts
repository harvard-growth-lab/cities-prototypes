/* Pure derivations for Levers for Change: the diagnostic path through the
   tree, the evidence tiles, the opportunity set and the beat-2 stats. All of
   it reads the atlas JSON and tolerates nulls — a missing value comes back as
   null (the caller prints '—'), never NaN. */
import { industriesOf, opportunitiesOf } from '@/data/derive'
import type { AtlasIndex, Metro, MetroSummary, National, Sector, TradabilityClass } from '@/data/types'
import { fmtCompact, fmtInt, fmtRate, fmtSignedPct, fmtSignedPp } from '@/lib/format'
import { QUADRANTS } from '@/lib/quadrants'
import type { SparkPoint } from './sparkline'

export type TreeNodeId =
  | 'root'
  | 'demand'
  | 'supply'
  | 'existing'
  | 'newact'
  | 'cost'
  | 'amenity'
  | 'shocks'
  | 'inputs'
  | 'coord'
  | 'housing'
  | 'transport'

export type Side = 'demand' | 'supply'

/** toFixed with a true minus sign (format.ts prints a hyphen for some negatives). */
export const fixed = (v: number, digits: number) => v.toFixed(digits).replace('-', '−')
/** toFixed with an explicit sign: +0.98 / −0.59. */
export const fixedSigned = (v: number, digits: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`

/** A stat card's series plus its "2010–2023" span (null under two points). */
export function seriesOf<T extends { year: number }>(rows: T[], pick: (r: T) => number | null): { series: SparkPoint[]; span: string | null } {
  const series = rows.map((r) => ({ year: r.year, value: pick(r) }))
  const ys = series.filter((p) => p.value !== null).map((p) => p.year)
  return { series, span: ys.length >= 2 ? `${Math.min(...ys)}–${Math.max(...ys)}` : null }
}
/** fmtSignedPct with a true minus sign. */
const signedPct = (v: number | null) => fmtSignedPct(v).replace('-', '−')

export interface DiagnosisPath {
  side: Side | null
  /** nodes the evidence lights, root first */
  lit: TreeNodeId[]
  /** the next fork's options, ringed but not settled */
  candidates: TreeNodeId[]
  /** the human name of the last lit node */
  endName: string
  /** shown when a fork was decided by a small margin */
  leans: string | null
}

export const NODE_NAME: Record<TreeNodeId, string> = {
  root: 'The growth question',
  demand: 'Labor demand',
  supply: 'Labor supply',
  existing: 'Existing industries',
  newact: 'New activities',
  cost: 'Cost of living',
  amenity: 'Amenities',
  shocks: 'External shocks',
  inputs: 'Production inputs',
  coord: 'Coordination problems',
  housing: 'Housing supply',
  transport: 'Transportation',
}

/* The forks (design-spec §3.0 Q6): whose problem is it → what kind → what
   exactly. The first fork is the quadrant's side; the second reads the
   supply-side split (cost vs amenity) or the shift-share local effect
   (the metro's own industries lost ground → existing; else → new). */
export function diagnosisPath(summary: MetroSummary, metro: Metro, index: AtlasIndex): DiagnosisPath {
  const q = summary.quadrant
  if (!q) {
    return { side: null, lit: ['root'], candidates: ['demand', 'supply'], endName: NODE_NAME.root, leans: null }
  }
  const side = QUADRANTS[q].constraint
  const lit: TreeNodeId[] = ['root', side]
  let candidates: TreeNodeId[] = []
  const notes: string[] = []
  if (summary.borderline) {
    notes.push(`${summary.name} sits inside the band around both medians, so the first fork only leans toward labor ${side}.`)
  }
  if (side === 'supply') {
    const ss = summary.supplySide
    if (ss === 'cost') {
      lit.push('cost')
      candidates = ['housing', 'transport']
    } else if (ss === 'amenity') {
      lit.push('amenity')
    } else {
      candidates = ['cost', 'amenity']
    }
    const c = summary.costCagr
    if (ss && c !== null && Math.abs(c - index.medians.costCagr) < 0.003) {
      notes.push(
        `Home-value growth (${fmtRate(c)}) is within 0.3 pp of the metro median (${fmtRate(index.medians.costCagr)}), so the second fork leans toward ${NODE_NAME[ss].toLowerCase()} rather than settling it.`,
      )
    }
  } else {
    const t = metro.shiftShareTotals
    if (!t) {
      candidates = ['existing', 'newact']
    } else if (t.ls < 0) {
      lit.push('existing')
      candidates = ['shocks', 'inputs']
    } else {
      lit.push('newact')
      candidates = ['coord']
    }
    if (t && t.startEmployment > 0 && Math.abs(t.ls / t.startEmployment) < 0.005) {
      notes.push(
        `The local-share effect (${signedPct(t.ls / t.startEmployment)} of starting jobs) is close to zero, so the second fork only leans toward ${NODE_NAME[lit[lit.length - 1]].toLowerCase()}.`,
      )
    }
  }
  return { side, lit, candidates, endName: NODE_NAME[lit[lit.length - 1]], leans: notes.length ? notes.join(' ') : null }
}

export interface Evidence {
  key: string
  label: string
  /** one or two lines */
  value: string[]
  reading: string
  /** which branch the tile speaks to */
  side: Side | 'both'
}

const dash = '—'

/** Σ employment in one tier at an index of metro.industryYears (nulls skipped). */
function tierJobs(metro: Metro, national: National, yearIdx: number, tier: TradabilityClass | null): number {
  let sum = 0
  for (const row of industriesOf(metro)) {
    const t = national.industries[row.code]?.tier ?? null
    if (tier !== null && t !== tier) continue
    const v = row.employment[yearIdx]
    if (v !== null && v !== undefined) sum += v
  }
  return sum
}

export function evidenceOf(summary: MetroSummary, metro: Metro, index: AtlasIndex, national: National): Evidence[] {
  const years = index.window
  const win = `${years.start}–${years.end}`
  const out: Evidence[] = []

  // 1 · the wedge
  const pop = summary.popCagr
  const wage = summary.wageCagr
  const q = summary.quadrant
  out.push({
    key: 'wedge',
    label: 'The wedge',
    value: [
      `people ${fmtRate(pop)} vs typical ${fmtRate(index.medians.popCagr)}`,
      `pay ${fmtRate(wage)} vs ${fmtRate(index.medians.wageCagr)}`,
    ],
    reading:
      pop === null || wage === null || !q
        ? 'The diagnosis needs both rates; one is missing.'
        : `${pop >= index.medians.popCagr ? 'More' : 'Fewer'} people than the typical metro, pay ${wage >= index.medians.wageCagr ? 'climbing faster' : 'climbing slower'} — reads as a ${QUADRANTS[q].shock.toLowerCase()}.`,
    side: 'both',
  })

  // 2 · shift-share, local share
  const t = metro.shiftShareTotals
  const lsShare = t && t.startEmployment > 0 ? t.ls / t.startEmployment : null
  out.push({
    key: 'ls',
    label: 'Shift-share, local share',
    value: t ? [`${t.ls >= 0 ? '+' : '−'}${fmtCompact(Math.abs(t.ls))} jobs (${signedPct(lsShare)})`] : [dash],
    reading: t
      ? `The metro's own competitiveness ${t.ls >= 0 ? 'added' : 'lost'} ${fmtInt(Math.abs(t.ls))} jobs over ${win}, net of the national trend and the industry mix.`
      : 'No shift-share for this metro.',
    side: 'demand',
  })

  // 3 · tradable jobs, index 100 → x
  const last = metro.industryYears.length - 1
  const traded0 = tierJobs(metro, national, 0, 'traded')
  const traded1 = tierJobs(metro, national, last, 'traded')
  const idx = traded0 > 0 ? (traded1 / traded0) * 100 : null
  out.push({
    key: 'traded',
    label: 'Tradable jobs',
    value: [idx === null ? dash : `100 → ${Math.round(idx)}`],
    reading:
      idx === null
        ? 'No traded-industry employment at the start of the window.'
        : `Jobs in traded industries ${idx >= 100 ? 'grew' : 'shrank'} ${signedPct(idx / 100 - 1)} over ${metro.industryYears[0]}–${metro.industryYears[last]}: the export engine ${idx >= 100 ? 'kept growing' : 'lost ground'}.`,
    side: 'demand',
  })

  // 4 · home-value growth vs all US metros
  const cost = summary.costCagr
  out.push({
    key: 'cost',
    label: 'Home-value growth',
    value: [cost === null ? dash : `${fmtRate(cost, 2)} vs ${fmtRate(index.national.costCagr, 2)} all US metros`],
    reading:
      cost === null
        ? 'No home-value series for this metro.'
        : `Home values ${cost >= index.national.costCagr ? 'outpaced' : 'lagged'} the all-metro trend and sit ${cost >= index.medians.costCagr ? 'above' : 'below'} the metro median (${fmtRate(index.medians.costCagr, 2)}) — ${summary.supplySide === 'cost' ? 'a cost-of-living story' : 'not a cost-of-living story'}.`,
    side: 'supply',
  })

  // 5 · amenity residual delta
  const d = metro.amenity?.residualDelta ?? null
  out.push({
    key: 'amenity',
    label: 'Amenity residual, change',
    value: [d === null ? dash : fmtSignedPp(d)],
    reading:
      d === null
        ? 'No amenity residual for this metro.'
        : `Prices rose ${d < 0 ? 'less' : 'more'} than the wage change alone predicts: the be-here premium ${d < 0 ? 'drained' : 'built'} over ${win}.`,
    side: 'supply',
  })
  return out
}

/* ------------------------------------------------------- opportunities */

export interface Opportunity {
  code: string
  name: string
  sector: Sector
  tier: TradabilityClass | null
  pci: number
  density: number
  /** the metro's own jobs and RCA in the industry (absent = RCA < 1) */
  employment: number
  rca: number | null
  nationalJobs: number | null
  /** density × PCI — the COI's own term, and the ranking behind the labels, the table and the quiz */
  score: number
}

/** The metro's absent industries, joined with the dictionary, ranked by density × PCI. */
export function opportunitiesFor(metro: Metro, national: National): Opportunity[] {
  const lastNat = national.industryYears.length - 1
  const rows = opportunitiesOf(metro)
    .filter((r) => !r.present)
    .flatMap((r) => {
      const ind = national.industries[r.code]
      if (!ind || ind.pci === null) return []
      const nat = national.nationalEmployment[r.code]
      return [
        {
          code: r.code,
          name: ind.name,
          sector: ind.sector,
          tier: ind.tier,
          pci: ind.pci,
          density: r.density,
          employment: r.employment,
          rca: r.rca,
          nationalJobs: nat?.[lastNat] ?? null,
        },
      ]
    })
  return rows.map((r) => ({ ...r, score: r.density * r.pci })).sort((a, b) => b.score - a.score)
}

/* --------------------------------------------------------------- stats */

export interface LatestComplexity {
  year: number
  eci: number
  rank: number | null
  /** the universe the rank is over */
  of: number
}

/** ECI does not exist for every metro; the rank is recomputed within those that have it
 *  (index.counts.withComplexity), falling back to the atlas rank over all 917 CBSAs. */
export function latestComplexity(metro: Metro, withComplexity: number): LatestComplexity | null {
  const row = metro.complexity.reduce<Metro['complexity'][number] | null>((a, r) => (!a || r.year > a.year ? r : a), null)
  if (!row) return null
  return row.rankUniverse !== null
    ? { year: row.year, eci: row.eci, rank: row.rankUniverse, of: withComplexity }
    : { year: row.year, eci: row.eci, rank: row.rankAll, of: 917 }
}

export function latestOutlook(metro: Metro) {
  return metro.outlook.reduce<Metro['outlook'][number] | null>((a, r) => (!a || r.year > a.year ? r : a), null)
}

/** Share of the metro's jobs in traded industries at the latest window year. */
export function tradedShare(metro: Metro, national: National): { share: number; year: number } | null {
  const last = metro.industryYears.length - 1
  if (last < 0) return null
  const all = tierJobs(metro, national, last, null)
  if (all <= 0) return null
  return { share: tierJobs(metro, national, last, 'traded') / all, year: metro.industryYears[last] }
}

/** A stable rotation so the computed quiz's right answer is not always option A. */
export function rotate<T>(xs: T[], seed: string): T[] {
  if (!xs.length) return xs
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9973
  const k = h % xs.length
  return [...xs.slice(k), ...xs.slice(0, k)]
}
