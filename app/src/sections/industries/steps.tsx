/* The three beats of the text column. Each reads the joined data and lifts
   what it lights (a sector, an industry) to the page, which hands it to
   the figure. */
import { Fragment, type ReactNode } from 'react'
import { Beat } from '@/components/beats/beat'
import { Explainer } from '@/components/beats/explainer'
import type { Sector } from '@/data/types'
import { TIER_COLOR, TIER_LABEL, TIER_ORDER } from '@/lib/palette'
import { COMPLEXITY_COPY, SECTOR_PHRASE, SPECIALIZATION_COPY, TIER_GLOSS, fractionWord, lowerName, pct0, roughInt, verbFor } from './copy'
import { Phrase } from './phrase'
import { RankCard } from './rank-card'
import { TierDonut } from './tier-donut'
import type { IndustryData, SectorShare } from './use-industry-data'

const OF = 3

/* ------------------------------------------------------------ beat 1 */

export interface Step1Props {
  data: IndustryData
  showComplexity: boolean
  litSector: Sector | null
  pinnedSector: Sector | null
  onLitSector: (s: Sector | null) => void
  onPinSector: (s: Sector) => void
}

export function Step1({ data, showComplexity, litSector, pinnedSector, onLitSector, onPinSector }: Step1Props) {
  const phrase = (s: SectorShare, cap = false) => {
    const text = SECTOR_PHRASE[s.sector]
    return (
      <Phrase key={s.sector} lit={litSector === s.sector} pinned={pinnedSector === s.sector} onLit={(on) => onLitSector(on ? s.sector : pinnedSector)} onPin={() => onPinSector(s.sector)}>
        {cap ? text.charAt(0).toUpperCase() + text.slice(1) : text}
      </Phrase>
    )
  }
  const join = (items: ReactNode[]) =>
    items.map((node, i) => (
      <Fragment key={i}>
        {i > 0 && (i === items.length - 1 ? ' and ' : ', ')}
        {node}
      </Fragment>
    ))
  const lead = data.leadSectors
  const behind = data.behindSectors
  const traded = data.tiers.traded
  return (
    <Beat
      id="b1"
      section="industries"
      n={1}
      of={OF}
      title="What brings income into your metro?"
      badge="metro"
      lede={
        <>
          Traded industries sell most of what they make to customers outside the metro, so what they earn is new income arriving here — {pct0(traded.share)} of the metro’s jobs.{' '}
          {lead.length > 0 && (
            <>
              {join(lead.map((s, i) => phrase(s, i === 0)))} {lead.length === 1 ? 'does' : 'do'} {fractionWord(data.leadShare)} of that work
              {behind.length > 0 ? <>, with {join(behind.map((s) => phrase(s)))} behind {behind.length === 1 ? 'it' : 'them'}.</> : '.'}
            </>
          )}
        </>
      }
    >
      {showComplexity && (
        <>
          {data.complexityRank && <RankCard rank={data.complexityRank.rank} of={data.complexityRank.of} year={data.complexityRank.year} className="mt-4 w-full max-w-[420px]" />}
          <Explainer title="What is economic complexity?" className="mt-4 w-full">
            <p>
              <b className="font-semibold">Complexity</b>
              {COMPLEXITY_COPY[0].slice('Complexity'.length)}
            </p>
            <p>{COMPLEXITY_COPY[1]}</p>
          </Explainer>
        </>
      )}
    </Beat>
  )
}

/* ------------------------------------------------------------ beat 2 */

export function Step2({ data }: { data: IndustryData }) {
  const { traded, partly_traded: partly, local } = data.tiers
  const examples = local.industries.slice(0, 3).map((d) => lowerName(d.name))
  return (
    <Beat
      id="b2"
      section="industries"
      n={2}
      of={OF}
      title="How tradable is the metro’s work?"
      badge="metro"
      lede={
        <>
          {traded.share >= 0.5 ? 'Most of the metro’s work sells outward.' : 'Most of the metro’s work does not sell outward.'} Local work{examples.length > 0 && <> — {examples.join(', ')} —</>} is {pct0(local.share)} of jobs, and another {pct0(partly.share)} is partly traded. Only {pct0(traded.share)} is traded, and that is the part bringing new income in.
        </>
      }
    >
      <TierDonut tiers={data.tiers} className="mt-4" />
      <Explainer title="How do we measure tradability?" className="mt-5 w-full">
        <p>Each industry is placed in a tier by how much of what it makes can be sold to someone outside the metro.</p>
        <dl className="mt-3 flex flex-col gap-2">
          {TIER_ORDER.map((t) => (
            <div key={t} className="grid grid-cols-[14px_auto] gap-x-2.5 text-[15px] leading-[1.45]">
              <span className="mt-[5px] inline-block size-[11px] rounded-[2px]" style={{ background: TIER_COLOR[t] }} />
              <div>
                <dt className="inline font-semibold">{TIER_LABEL[t]}</dt> <dd className="inline">{TIER_GLOSS[t]}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-soft">The tiers are cuts on a continuous measure, so an industry near a cut could fall the other way.</p>
      </Explainer>
    </Beat>
  )
}

/* ------------------------------------------------------------ beat 3 */

export interface Step3Props {
  data: IndustryData
  litCode: string | null
  pinnedCode: string | null
  onLitCode: (c: string | null) => void
  onPinCode: (c: string) => void
}

export function Step3({ data, litCode, pinnedCode, onLitCode, onPinCode }: Step3Props) {
  const r = data.ranking
  const phrase = (code: string, text: string) => (
    <Phrase lit={litCode === code} pinned={pinnedCode === code} onLit={(on) => onLitCode(on ? code : pinnedCode)} onPin={() => onPinCode(code)}>
      {text}
    </Phrase>
  )
  const x = (v: number) => v.toFixed(1)
  // "Concentration is not size": the smallest of the top five against the
  // biggest employer further down the ranking — only when the pair makes
  // the point (a clearly bigger industry at a lower concentration)
  const top5 = r.slice(0, 5)
  const smallest = top5.length > 1 ? top5.reduce((a, b) => (b.employment < a.employment ? b : a)) : undefined
  const rest = r.length > 3 ? r.slice(3) : r
  const largest = rest.length > 0 ? rest.reduce((a, b) => (b.employment > a.employment ? b : a)) : undefined
  const contrast = smallest && largest && smallest.code !== largest.code && largest.employment >= 3 * smallest.employment && smallest.rca > largest.rca
  return (
    <Beat
      id="b3"
      section="industries"
      n={3}
      of={OF}
      title="Which tradable industries is the metro most specialized in?"
      badge="metro"
      lede={
        r.length === 0 ? (
          <>
            No traded or partly traded industry with at least {roughInt(data.rankingFloor)} jobs is more concentrated in the metro than in the country as a whole. The metro’s tradable work follows the national mix rather than standing out from it.
          </>
        ) : (
          <>
            The metro is most concentrated in {phrase(r[0].code, lowerName(r[0].name))}, {x(r[0].rca)} times the national rate
            {r.length > 1 && <>, then {phrase(r[1].code, lowerName(r[1].name))} at {x(r[1].rca)}</>}
            {r.length > 2 && <> and {phrase(r[2].code, lowerName(r[2].name))} at {x(r[2].rca)}</>}.
            {contrast && smallest && largest && (
              <>
                {' '}
                Concentration is not size: {phrase(smallest.code, lowerName(smallest.name))} {verbFor(smallest.name, 'reach', 'reaches')} {x(smallest.rca)} times on {roughInt(smallest.employment)} jobs, while {phrase(largest.code, lowerName(largest.name))} {verbFor(largest.name, 'employ', 'employs')} {roughInt(largest.employment)} at {x(largest.rca)}.
              </>
            )}
          </>
        )
      }
    >
      <Explainer title="What is specialization?" className="mt-4 w-full">
        <p>
          {SPECIALIZATION_COPY.a}
          <b className="font-semibold">specialization</b>
          {SPECIALIZATION_COPY.b}
          <b className="nums font-semibold">1.0×</b>
          {SPECIALIZATION_COPY.c}
          <b className="nums font-semibold">2.0×</b>
          {SPECIALIZATION_COPY.d}
        </p>
        <p>
          {SPECIALIZATION_COPY.e}
          <i>distinctive</i>
          {SPECIALIZATION_COPY.f}
        </p>
      </Explainer>
    </Beat>
  )
}
