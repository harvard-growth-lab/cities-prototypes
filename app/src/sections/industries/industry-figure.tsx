/* The stage: one figure whose state follows the active step — the traded
   treemap, the three tier cards, the specialization ranking — with its
   controls in a fixed-height head and a key in the caption slot. */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { ChartFrame } from '@/components/charts/chart-frame'
import { TipHead, TipLead, TipRow, useChartTooltip } from '@/components/charts/chart-tooltip'
import { Legend } from '@/components/charts/legend'
import type { Sector } from '@/data/types'
import { fmtInt, fmtMult, fmtPct } from '@/lib/format'
import { CHROME, COMPLEXITY_RAMP, RANK_MUTED, SECTOR_COLOR, TIER_LABEL, complexityColor } from '@/lib/palette'
import { useIsPhone, useMediaQuery, useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { BarsFurniture } from './bars'
import { CellLabels, CellLayer, MapFurniture } from './cells'
import { pct0 } from './copy'
import { RankingFurniture, RowBands } from './ranking'
import { Seg } from './seg'
import { useFontsReady } from './text-measure'
import { BARS_PITCH, RANK_PITCH, VB, layoutBars, layoutRanking, layoutTierCards, layoutTradedMap, type CellGeom } from './treemap-layout'
import type { IndustryData, IndustryDatum, RankRow } from './use-industry-data'

export type View = 'map' | 'bars'
export type ColorBy = 'sector' | 'complexity'
export type SortBy = 'rca' | 'jobs' | 'trad'

export interface IndustryFigureProps {
  data: IndustryData
  step: number
  view: View
  colorBy: ColorBy
  sort: SortBy
  onView: (v: View) => void
  onColorBy: (v: ColorBy) => void
  onSort: (v: SortBy) => void
  /** a sector lit from the first beat's lede */
  litSector: Sector | null
  /** an industry lit from the third beat's lede */
  litCode: string | null
}

const VIEWS = [
  { value: 'map', label: 'Sized by jobs' },
  { value: 'bars', label: 'Ordered by jobs' },
] as const
const COLORS = [
  { value: 'sector', label: 'Sector' },
  { value: 'complexity', label: 'Complexity' },
] as const
const SORTS = [
  { value: 'rca', label: 'Concentration' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'trad', label: 'Tradability' },
] as const

const ARIA: Record<number, string> = {
  0: 'Treemap of the metro’s traded industries, sized by jobs and grouped by sector',
  1: 'Three tier cards — traded, partly traded, local — each a treemap of its industries sized by jobs',
  2: 'Ranking of the metro’s most concentrated tradable industries, bars showing times the national rate',
}

function sortRows(rows: RankRow[], sort: SortBy) {
  const r = [...rows]
  if (sort === 'jobs') r.sort((a, b) => b.employment - a.employment)
  else if (sort === 'trad') r.sort((a, b) => (b.tradability ?? 0) - (a.tradability ?? 0) || b.rca - a.rca)
  return r
}

export function IndustryFigure({ data, step, view, colorBy, sort, onView, onColorBy, onSort, litSector, litCode }: IndustryFigureProps) {
  const reduced = useReducedMotion()
  const motion = !reduced
  const phone = useIsPhone()
  const compact = useMediaQuery('(width < 1200px)')
  const ts = phone ? 1.8 : compact ? 1.25 : 1
  const fontsReady = useFontsReady()
  const wrapRef = useRef<HTMLDivElement>(null)
  const tip = useChartTooltip(wrapRef)
  const [hover, setHover] = useState<string | null>(null)

  const byCode = useMemo(() => new Map(data.industries.map((d) => [d.code, d])), [data])
  const cards = useMemo(() => layoutTierCards(data), [data])
  const tradedMap = useMemo(() => layoutTradedMap(data), [data])
  const barsTraded = useMemo(() => layoutBars(data.tiers.traded.industries), [data])
  const barsAll = useMemo(() => layoutBars(data.industries), [data])
  const rankRows = useMemo(() => sortRows(data.ranking, sort), [data, sort])
  const ranking = useMemo(() => layoutRanking(rankRows), [rankRows])

  const layout = step === 2 ? ranking : step === 1 ? (view === 'map' ? cards : barsAll) : view === 'map' ? tradedMap : barsTraded
  // hidden cells wait at their tier-card position, so the next state fades them in in place
  const geoms = useMemo(() => {
    const m = new Map<string, CellGeom>()
    for (const d of data.industries) {
      const g = layout.cells.get(d.code) ?? cards.cells.get(d.code)
      if (g) m.set(d.code, layout.cells.has(d.code) ? g : { ...g, visible: false })
    }
    return m
  }, [data, layout, cards])

  // labels and furniture hold back while the cells travel, then fade in
  const stateKey = `${step}/${step < 2 ? view : ''}`
  const underRef = useRef<SVGGElement>(null)
  const overRef = useRef<SVGGElement>(null)
  useEffect(() => {
    if (!motion) return
    const anims = [underRef.current, overRef.current].map((el) =>
      el?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.65 }, { opacity: 1 }], { duration: 950, easing: 'ease' }),
    )
    return () => anims.forEach((a) => a?.cancel())
  }, [stateKey, motion])

  const rankOf = useMemo(() => new Map(data.ranking.map((r) => [r.code, r.rank])), [data])
  const fillOf = (d: IndustryDatum) => {
    if (step === 2) return (rankOf.get(d.code) ?? 99) <= 3 ? CHROME.teal : RANK_MUTED
    return colorBy === 'sector' ? SECTOR_COLOR[d.sector] : complexityColor(d.pci)
  }
  const dimOf = (d: IndustryDatum) => (step < 2 && litSector !== null && d.sector !== litSector ? 0.13 : 1)

  const cellTip = (d: IndustryDatum) => (
    <>
      <TipHead>{d.name}</TipHead>
      <TipRow label="Sector" value={d.sector} />
      <TipRow label="Jobs" value={fmtInt(Math.round(d.employment))} />
      <TipRow label="Tradability" value={TIER_LABEL[d.tier]} />
      {colorBy === 'complexity' && <TipRow label="Complexity (PCI)" value={d.pci === null ? '—' : d.pci.toFixed(2)} />}
    </>
  )
  const rankTip = (r: RankRow) => (
    <>
      <TipHead className="flex items-center gap-2">
        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-teal text-[11px] font-bold text-white">{r.rank}</span>
        {r.name}
      </TipHead>
      <p className="mb-1 flex items-center gap-1.5 text-xs text-ink-soft">
        <span className="inline-block size-[10px] rounded-[2px]" style={{ background: SECTOR_COLOR[r.sector] }} />
        {r.sector}
      </p>
      <TipLead value={fmtMult(r.rca)} caption="more concentrated here than the national rate" />
      <TipRow label="Tradability" value={TIER_LABEL[r.tier]} />
      <TipRow label="Jobs here" value={fmtInt(Math.round(r.employment))} />
      <TipRow label="Share of metro jobs" value={fmtPct(r.share * 100, 2)} />
      <TipRow label="Complexity (PCI)" value={r.pci === null ? '—' : r.pci.toFixed(2)} />
    </>
  )
  const enter = (code: string, e: MouseEvent) => {
    const d = byCode.get(code)
    if (!d) return
    setHover(code)
    const r = step === 2 ? data.ranking.find((x) => x.code === code) : undefined
    tip.show(e.clientX, e.clientY, r ? rankTip(r) : cellTip(d))
  }
  const move = (e: MouseEvent) => tip.move(e.clientX, e.clientY)
  const leave = () => {
    setHover(null)
    tip.hide()
  }

  const hoverGeom = hover ? geoms.get(hover) : undefined
  const isMap = layout.kind === 'map' || layout.kind === 'cards'
  const sectorsInState = step === 0 ? data.tradedSectors.map((s) => s.sector) : data.sectorsPresent

  return (
    <div>
      {/* the head slot: 104 on the map beats (controls + title), 42 on the ranking (controls alone) */}
      <div className={cn('max-narrow:min-h-0', step < 2 ? 'min-h-[104px]' : 'min-h-[42px]')}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {step < 2 ? (
            <>
              <Seg label="View" value={view} options={[...VIEWS]} onChange={onView} />
              <Seg label="Color by" value={colorBy} options={[...COLORS]} onChange={onColorBy} />
            </>
          ) : (
            <Seg label="Sort by" value={sort} options={[...SORTS]} onChange={onSort} />
          )}
        </div>
        {step === 0 && (
          <div className="mt-3">
            <p className="text-[16px] leading-tight font-bold text-teal">Traded industries</p>
            <p className="mt-1 text-[13px] text-ink max-sm:hidden">
              Sell most of what they make outside the metro <span className="text-ink-soft">({pct0(data.tiers.traded.share)} of metro jobs)</span>
            </p>
          </div>
        )}
        {step === 1 && view === 'map' && <p className="mt-3 text-[16px] leading-tight font-bold text-teal max-sm:hidden">All industries, by tier</p>}
      </div>

      <div ref={wrapRef} className="relative mt-3">
        <div className={cn(!isMap && 'overflow-x-auto')}>
          {/* under 920px the stage is a band pinned to the bottom: the figure gives up height, not width */}
          <ChartFrame width={VB.w} height={VB.h} className={cn('mx-auto font-sans max-narrow:max-h-[40svh] max-sm:max-h-[34svh]', !isMap && phone && 'min-w-[600px]')} role="img" aria-label={ARIA[step]}>
            <g ref={underRef}>
              {isMap && <MapFurniture layout={layout} ts={ts} />}
              {layout.kind === 'bars' && <RowBands layout={layout} pitch={BARS_PITCH} codes={[hover]} motion={motion} />}
              {layout.kind === 'ranking' && <RowBands layout={layout} pitch={RANK_PITCH} codes={[hover, litCode]} motion={motion} />}
            </g>
            <CellLayer industries={data.industries} geoms={geoms} fillOf={fillOf} dimOf={dimOf} motion={motion} interactive={isMap} onEnter={enter} onMove={move} onLeave={leave} />
            <g ref={overRef}>
              {isMap && <CellLabels industries={data.industries} geoms={geoms} fillOf={fillOf} dimOf={dimOf} ts={ts} fontsReady={fontsReady} />}
              {layout.kind === 'bars' && (
                <BarsFurniture items={byCode} layout={layout} ts={ts} tradCol={step === 0 ? 'score' : 'tier'} litSector={litSector} hoverCode={hover} onEnter={enter} onMove={move} onLeave={leave} />
              )}
              {layout.kind === 'ranking' && !rankRows.length && (
                <text x={VB.w / 2} y={VB.h / 2} textAnchor="middle" fontSize={14 * ts} fill={CHROME.inkSoft}>
                  No traded or partly traded industry is more concentrated here than the national rate.
                </text>
              )}
              {layout.kind === 'ranking' && <RankingFurniture rows={rankRows} layout={layout} braced={sort === 'rca'} ts={ts} litCode={litCode} hoverCode={hover} motion={motion} onEnter={enter} onMove={move} onLeave={leave} />}
            </g>
            {isMap && hoverGeom?.visible && <rect x={hoverGeom.x} y={hoverGeom.y} width={hoverGeom.w} height={hoverGeom.h} fill="none" stroke={CHROME.ink} strokeWidth={2.5} pointerEvents="none" />}
          </ChartFrame>
        </div>
        {tip.Tooltip}
      </div>

      {/* tall enough for a two-row key, so the panel keeps its height between states */}
      <div className="mt-3 min-h-[60px] max-narrow:min-h-0">
        {step < 2 && colorBy === 'sector' && <Legend items={sectorsInState.map((s) => ({ color: SECTOR_COLOR[s], label: s }))} className="max-sm:text-[11px]" />}
        {step < 2 && colorBy === 'complexity' && (
          <div className="flex items-center gap-2 text-[12.5px] text-ink">
            <span>Less complex</span>
            <span className="flex overflow-hidden rounded-[3px]">
              {COMPLEXITY_RAMP.map((c) => (
                <span key={c} className="h-3 w-[26px]" style={{ background: c }} />
              ))}
            </span>
            <span>More complex</span>
          </div>
        )}
        {step === 2 && (
          <p className="text-[12.5px] text-ink-soft">
            {data.ranking.length
              ? `Traded and partly traded industries with at least ${fmtInt(data.rankingFloor)} jobs, ranked by how concentrated they are here against the national rate.`
              : 'No traded or partly traded industry here is more concentrated than the national rate.'}
          </p>
        )}
      </div>
    </div>
  )
}
