/* The Admin Industries model: one LODES row read five ways. Pure functions
   over the place's commute series and the metro's place rows — no React.
   Every share is a fraction or null; every word comes from a number. */
import type { Place, PlaceRow } from '@/data/types'
import { ADMIN, CHROME } from '@/lib/palette'

export interface CommuteRead {
  year: number
  jobsHere: number
  residentWorkers: number
  liveWorkHere: number
  inCommuters: number
  outCommuters: number
  /** in / jobsHere — the jobs filled by people who live elsewhere */
  inShare: number | null
  /** liveWorkHere / jobsHere */
  bothShareJobs: number | null
  /** liveWorkHere / residentWorkers */
  bothShareRes: number | null
  /** out / residentWorkers — residents' jobs outside the line */
  outShare: number | null
  /** jobsHere / residentWorkers: the workplace-or-dormitory number */
  ratio: number | null
  /** in − out: more come in (+) than go out (−) */
  net: number
  kind: RatioKind | null
  verdict: Verdict | null
}

export type RatioKind = 'dormitory' | 'balanced' | 'importer' | 'hub'
export type Verdict = 'importer' | 'exporter' | 'balanced'

const div = (a: number, b: number) => (b > 0 ? a / b : null)

/** The dial's zones (design-spec §3.3): < 0.8 dormitory, ≤ 1.25 balanced, < 2 importer, else hub. */
export function ratioKind(r: number | null): RatioKind | null {
  if (r === null || !Number.isFinite(r)) return null
  if (r < 0.8) return 'dormitory'
  if (r <= 1.25) return 'balanced'
  if (r < 2) return 'importer'
  return 'hub'
}

/** The verdict pill follows the dial's zones, so the two never disagree:
 *  a dormitory exports workers, a balanced place is balanced, the rest import. */
export function verdictOf(r: number | null): Verdict | null {
  const kind = ratioKind(r)
  if (kind === null) return null
  if (kind === 'dormitory') return 'exporter'
  if (kind === 'balanced') return 'balanced'
  return 'importer'
}

/** The latest commute row (the columns are complete wherever a row exists),
 *  or undefined when the place has none. */
export function readCommute(commute: Place['commute']): CommuteRead | undefined {
  const c = [...commute].sort((a, b) => a.year - b.year).at(-1)
  if (!c) return undefined
  const { year, jobsHere, residentWorkers, liveWorkHere, inCommuters, outCommuters } = c
  const ratio = div(jobsHere, residentWorkers)
  return {
    year,
    jobsHere,
    residentWorkers,
    liveWorkHere,
    inCommuters,
    outCommuters,
    inShare: div(inCommuters, jobsHere),
    bothShareJobs: div(liveWorkHere, jobsHere),
    bothShareRes: div(liveWorkHere, residentWorkers),
    outShare: div(outCommuters, residentWorkers),
    ratio,
    net: inCommuters - outCommuters,
    kind: ratioKind(ratio),
    verdict: verdictOf(ratio),
  }
}

export interface RatioPoint {
  year: number
  ratio: number
}

/** The ratio by year for the sparkline (2010 on, where residents hold any jobs). */
export function ratioSeries(commute: Place['commute']): RatioPoint[] {
  return commute
    .filter((c) => c.year >= 2010 && c.residentWorkers > 0)
    .map((c) => ({ year: c.year, ratio: c.jobsHere / c.residentWorkers }))
    .sort((a, b) => a.year - b.year)
}

/* ------------------------------------------------------------------ dots */

export interface DotPlan {
  /** jobs per dot */
  unit: number
  both: number
  in: number
  out: number
}

const LADDER = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000]

/** One dot is `unit` jobs: the smallest 1–2–5 number that keeps the city's
 *  jobs at ≤ 360 dots (the out-commuters' group has to fit too). */
export function planDots(c: CommuteRead): DotPlan {
  const need = Math.max(c.jobsHere, c.residentWorkers, 1) / 360
  const unit = LADDER.find((u) => u >= need) ?? LADDER[LADDER.length - 1]
  const count = (x: number) => (x > 0 ? Math.max(1, Math.round(x / unit)) : 0)
  return { unit, both: count(c.liveWorkHere), in: count(c.inCommuters), out: count(c.outCommuters) }
}

/* ---------------------------------------------------------------- places */

export interface PlaceRatio {
  id: string
  name: string
  jobsHere: number
  residentWorkers: number
  ratio: number
}

/** The metro's places ranked by jobs per resident worker: those with ≥ 5,000
 *  resident workers, or the 15 largest when fewer than six clear that bar. */
export function rankPlaces(places: PlaceRow[]): PlaceRatio[] {
  const withData = places
    .filter((p): p is PlaceRow & { jobsHere: number; residentWorkers: number } => p.jobsHere !== null && p.residentWorkers !== null && p.residentWorkers > 0)
    .map((p) => ({ id: p.id, name: p.name, jobsHere: p.jobsHere, residentWorkers: p.residentWorkers, ratio: p.jobsHere / p.residentWorkers }))
  const big = withData.filter((p) => p.residentWorkers >= 5_000)
  const pool = big.length >= 6 ? big : withData.sort((a, b) => b.residentWorkers - a.residentWorkers).slice(0, 15)
  return pool.sort((a, b) => b.ratio - a.ratio)
}

/* ----------------------------------------------------------------- words */

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const word = (n: number) => SMALL[n] ?? String(n)

/** "one in four" from a share ≤ ½; null when most live here. */
export function oneIn(share: number | null): string | null {
  if (share === null || share > 0.5) return null
  if (share <= 0) return null
  return word(Math.max(2, Math.round(1 / share)))
}

/** "for every resident who commutes out, <more than three people commute in>". */
export function exchangeWords(inC: number, outC: number): string {
  if (outC <= 0) return inC > 0 ? 'people commute in and no one commutes out' : 'no one moves either way'
  const r = inC / outC
  if (r < 0.85) return 'fewer than one person commutes in'
  if (r < 1.25) return 'about one person commutes in'
  const k = Math.floor(r)
  const frac = r - k
  if (frac < 0.15) return `about ${word(k)} people commute in`
  if (frac < 0.5) return `more than ${word(k)} people commute in`
  if (frac < 0.85) return `nearly ${word(k + 1)} people commute in`
  return `about ${word(k + 1)} people commute in`
}

/** A name that fits a figure label: "Augusta-Richmond County consolidated
 *  government (balance)" → "Augusta"; short names pass through. */
export function shortName(name: string, max = 20): string {
  // "… city (balance)" / "… consolidated government (balance)" are one Census naming pattern
  const base = /\(balance\)$/i.test(name)
    ? name.replace(/\s*\(balance\)$/i, '').replace(/\s+(consolidated|metro|metropolitan|unified)?\s*(government|city)$/i, '').trim()
    : name.trim()
  if (base.length <= max) return base
  const head = base.split(/[-/]/)[0].trim()
  if (head.length >= 4 && head.length <= max) return head
  return `${base.slice(0, max - 1).trimEnd()}…`
}

export const KIND_LABEL: Record<RatioKind, string> = {
  dormitory: 'Dormitory',
  balanced: 'Balanced',
  importer: 'Importer',
  hub: 'Hub',
}

/** "a hub" / "an importer" / "a balanced place" / "a dormitory" */
export const KIND_PHRASE: Record<RatioKind, string> = {
  dormitory: 'a dormitory',
  balanced: 'a balanced place',
  importer: 'an importer',
  hub: 'a hub',
}

/** A stroke that reads on white: the zone's colour, except the balanced grey. */
export const zoneStroke = (kind: RatioKind | null) => (kind && kind !== 'balanced' ? ADMIN.zones[kind] : CHROME.inkSoft)

export const VERDICT_LABEL: Record<Verdict, string> = {
  importer: 'Net importer',
  exporter: 'Net exporter',
  balanced: 'Balanced',
}

/** Two decimals: the dial and the ranking need 2.07× and 2.08× to stay apart. */
export const fmtX = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(2)}×`)
