/* The section's one data join: the metro's industries at the latest year
   with employment, joined to the national industry attributes (name,
   sector, tier, PCI). Everything the three beats and the figure show is
   derived here once. */
import { useMemo } from 'react'
import { industriesOf } from '@/data/derive'
import type { Metro, National, Sector, TradabilityClass } from '@/data/types'
import { TIER_ORDER } from '@/lib/palette'
import { useToolState } from '@/lib/use-tool-state'

export interface IndustryDatum {
  code: string
  name: string
  sector: Sector
  tier: TradabilityClass
  pci: number | null
  tradability: number | null
  employment: number
  /** of all metro jobs (untiered industries included in the total) */
  share: number
  rca: number | null
}

export interface RankRow extends IndustryDatum {
  rca: number
  /** 1-based rank by concentration */
  rank: number
}

export interface TierStat {
  tier: TradabilityClass
  jobs: number
  share: number
  /** descending by jobs */
  industries: IndustryDatum[]
}

export interface SectorShare {
  sector: Sector
  jobs: number
  /** of the traded tier's jobs */
  share: number
}

export interface IndustryData {
  year: number
  /** Σ employment, all industries with a tier or not */
  total: number
  /** the tiered industries, descending by jobs */
  industries: IndustryDatum[]
  tiers: Record<TradabilityClass, TierStat>
  /** sectors of the traded tier, descending */
  tradedSectors: SectorShare[]
  /** the sectors that together pass 80% of traded jobs, then the next two */
  leadSectors: SectorShare[]
  leadShare: number
  behindSectors: SectorShare[]
  /** every sector present, descending by jobs across all tiers */
  sectorsPresent: Sector[]
  /** top 12 by RCA among traded + partly traded with rca ≥ 1 and jobs ≥ rankingFloor */
  ranking: RankRow[]
  rankingFloor: number
  complexityRank: { rank: number; of: number; year: number } | null
}

const RANK_N = 12
/* 1,000 jobs is the spec's floor; thin metros fall back so the ranking is
   never empty when something qualifies at a lower bar. */
const FLOORS = [1000, 250, 100]

export function buildIndustryData(metro: Metro, national: National, withComplexity: number): IndustryData {
  const years = metro.industryYears
  const rows = industriesOf(metro)
  // the latest year with any employment recorded
  let yi = years.length - 1
  while (yi > 0 && !rows.some((r) => (r.employment[yi] ?? 0) > 0)) yi--
  const year = years[yi] ?? years[years.length - 1]

  let total = 0
  const all: (Omit<IndustryDatum, 'tier' | 'share'> & { tier: TradabilityClass | null })[] = []
  for (const r of rows) {
    if (r.code === '9999') continue
    const emp = r.employment[yi]
    if (emp === null || emp === undefined || !(emp > 0)) continue
    const attr = national.industries[r.code]
    if (!attr) continue
    total += emp
    all.push({
      code: r.code,
      name: attr.name,
      sector: attr.sector,
      tier: attr.tier,
      pci: attr.pci,
      tradability: attr.tradability,
      employment: emp,
      rca: r.rca[yi] ?? null,
    })
  }

  const industries: IndustryDatum[] = all
    .filter((d): d is typeof d & { tier: TradabilityClass } => d.tier !== null)
    .map((d) => ({ ...d, share: total > 0 ? d.employment / total : 0 }))
    .sort((a, b) => b.employment - a.employment)

  const tiers = Object.fromEntries(
    TIER_ORDER.map((tier) => {
      const inds = industries.filter((d) => d.tier === tier)
      const jobs = inds.reduce((s, d) => s + d.employment, 0)
      return [tier, { tier, jobs, share: total > 0 ? jobs / total : 0, industries: inds }]
    }),
  ) as Record<TradabilityClass, TierStat>

  const sectorJobs = (inds: IndustryDatum[]) => {
    const m = new Map<Sector, number>()
    for (const d of inds) m.set(d.sector, (m.get(d.sector) ?? 0) + d.employment)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const tradedTotal = tiers.traded.jobs
  const tradedSectors: SectorShare[] = sectorJobs(tiers.traded.industries).map(([sector, jobs]) => ({
    sector,
    jobs,
    share: tradedTotal > 0 ? jobs / tradedTotal : 0,
  }))
  const leadSectors: SectorShare[] = []
  let leadShare = 0
  for (const s of tradedSectors) {
    if (leadShare >= 0.8) break
    leadSectors.push(s)
    leadShare += s.share
  }
  const behindSectors = tradedSectors.slice(leadSectors.length, leadSectors.length + 2)
  const sectorsPresent = sectorJobs(industries).map(([s]) => s)

  const tradable = industries.filter(
    (d): d is IndustryDatum & { rca: number } => (d.tier === 'traded' || d.tier === 'partly_traded') && d.rca !== null && d.rca >= 1,
  )
  let rankingFloor = FLOORS[0]
  let pool = tradable.filter((d) => d.employment >= rankingFloor)
  for (const floor of FLOORS.slice(1)) {
    if (pool.length >= 5) break
    rankingFloor = floor
    pool = tradable.filter((d) => d.employment >= floor)
  }
  const ranking: RankRow[] = pool
    .sort((a, b) => b.rca - a.rca)
    .slice(0, RANK_N)
    .map((d, i) => ({ ...d, rank: i + 1 }))

  const cx = [...metro.complexity].reverse().find((c) => c.rankUniverse !== null)
  const complexityRank = cx && cx.rankUniverse !== null ? { rank: cx.rankUniverse, of: withComplexity, year: cx.year } : null

  return {
    year,
    total,
    industries,
    tiers,
    tradedSectors,
    leadSectors,
    leadShare,
    behindSectors,
    sectorsPresent,
    ranking,
    rankingFloor,
    complexityRank,
  }
}

export function useIndustryData(): IndustryData {
  const { metro, national, index } = useToolState()
  return useMemo(() => buildIndustryData(metro, national, index.counts.withComplexity), [metro, national, index])
}
