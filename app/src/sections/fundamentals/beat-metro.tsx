/* Beat 2 — "Your city is not an island": the metro's population drawn in
   beside the admin place's, what a metro area is, and the place's share
   of the metro. */
import { Suspense, useMemo, useRef } from 'react'
import { Beat } from '@/components/beats/beat'
import { Explainer } from '@/components/beats/explainer'
import { StatRow } from '@/components/beats/stat-row'
import { PeopleIcon } from '@/components/chrome/icons'
import { Skeleton } from '@/components/ui/skeleton'
import { latest, placesOf, rankOf } from '@/data/derive'
import { usePlace } from '@/data/queries'
import { fmtCompact, fmtInt } from '@/lib/format'
import { useToolState } from '@/lib/use-tool-state'
import { AnchorCard } from './anchor-card'
import { shareOfMetro } from './place-metrics'
import { PopulationChart } from './population-chart'
import { benchmarkStat, changeStat, countStat } from './stats'
import { useInView } from './use-in-view'

export function MetroBeat({ n, of }: { n: number; of: number }) {
  const { metro, place, cityName, metroName, summary, index } = useToolState()
  const { window: win, national } = index
  const popRow = latest(metro.panel, 'population')
  const start = metro.diagnosis.popYears?.[0] ?? win.start
  const share = shareOfMetro(place, summary)
  const { withPop, placesNoun } = useMemo(() => {
    const places = placesOf(metro)
    return {
      withPop: places.filter((p) => p.population !== null).map((p) => p.population),
      // Hawaii's metros hold census-designated places only
      placesNoun: places.length === 1 ? 'place' : places.some((p) => p.class === 'incorporated') ? 'cities and towns' : 'census-designated places',
    }
  }, [metro])

  return (
    <Beat
      id="b2"
      section="fundamentals"
      n={n}
      of={of}
      title="Your city is not an island"
      badge="metro"
      lede={
        <>
          The administrative city is one piece of a larger machine: people commute, firms hire, and housing supply responds across a region far wider
          than the city line — the <b className="font-semibold">labor market</b>. We approximate it with the metropolitan statistical area. {cityName}{' '}
          sits inside its metro area, and most of what follows is read at that scale.
        </>
      }
    >
      <StatRow
        items={[
          countStat(<PeopleIcon />, `Metro population, ${popRow?.year ?? win.end}`, fmtInt(popRow?.population)),
          changeStat(start, metro.diagnosis.popCagr),
          benchmarkStat(national.popCagr, [win.start, win.end]),
        ]}
      />
      <Suspense fallback={<Skeleton className="mt-6 h-[300px] w-full rounded-lg" />}>
        <MetroFigure />
      </Suspense>
      <Explainer title="What is a metro area (MSA)?" className="mt-7">
        <p>
          A <b className="font-semibold">metropolitan statistical area</b> is how the US Census draws the functional city: a dense core plus every
          surrounding county tied to it by commuting. It is the closest official shape to the real labor market — the area within which people can change
          jobs or homes without changing lives.
        </p>
        <p>
          {metroName}’s metro spans {fmtInt(summary.nPlaces)} {placesNoun} and about {fmtCompact(summary.population)} people; the administrative city is
          one of them{share !== null && <>, home to roughly {Math.round(share * 100)}% of the metro’s residents</>}. That is why most of what follows is
          read at the metro scale.
        </p>
      </Explainer>
      {share !== null && place.population !== null && (
        <AnchorCard className="mt-6" cityName={cityName} share={share} rank={rankOf(place.population, withPop)} of={withPop.length} />
      )}
    </Beat>
  )
}

function MetroFigure() {
  const { metro, placeId, cityName, metroName, index } = useToolState()
  const detail = usePlace(placeId)
  const ref = useRef<HTMLDivElement>(null)
  const drawKey = useInView(ref, 0.35)
  const band: [number, number] = metro.diagnosis.popYears ?? [index.window.start, index.window.end]
  const hasPop = detail.panel.some((r) => r.population !== null)
  return (
    <div ref={ref} className="mt-6">
      <PopulationChart
        place={hasPop ? { panel: detail.panel, label: `${cityName} Admin` } : null}
        metro={{ panel: metro.panel, label: `${metroName} Metro`, rate: metro.diagnosis.popCagr }}
        band={band}
        drawKey={drawKey}
      />
    </div>
  )
}
