/* Admin Industries: five beats read against one stage. Beats 1–4 drive the
   dots (all the jobs → who fills them → residents out → two workforces);
   beat 5 swaps the stage for the dial and the metro's places. Every number
   is the admin place's latest LODES row. */
import { useMemo, useState, type ReactNode } from 'react'
import { Beat } from '@/components/beats/beat'
import { Checkpoint } from '@/components/beats/checkpoint'
import { Explainer } from '@/components/beats/explainer'
import { Scrolly } from '@/components/beats/scrolly'
import { StatRow } from '@/components/beats/stat-row'
import { Legend, type LegendItem } from '@/components/charts/legend'
import { BuildingIcon, PeopleIcon } from '@/components/chrome/icons'
import { placesOf } from '@/data/derive'
import { usePlace } from '@/data/queries'
import { fmtInt, fmtPct } from '@/lib/format'
import { ADMIN } from '@/lib/palette'
import { useToolState } from '@/lib/use-tool-state'
import { exchangeWords, fmtX, oneIn, planDots, rankPlaces, ratioSeries, readCommute, shortName, type CommuteRead, type DotPlan, type PlaceRatio, type RatioPoint } from './commute'
import { GaugeStage } from './gauge-stage'
import { NoCommuteSection } from './no-commute'
import { adminQuestions } from './questions'
import { WorkforceDots, type DotsState } from './workforce-dots'

const OF = 5
/** the scrolly's step index → the dots' state (beat 5 is the gauge, not a dots state) */
const dotsState = (i: number): DotsState => Math.min(Math.max(i, 0), 3) as DotsState
const pct = (v: number | null) => fmtPct(v === null ? null : v * 100, 0)

/** A second paragraph under a lede. */
const P = ({ children }: { children: ReactNode }) => <p className="mb-2 max-w-[760px] text-base leading-[1.6] text-ink">{children}</p>
const B = ({ children }: { children: ReactNode }) => <b className="nums font-bold">{children}</b>

function keyFor(state: DotsState, r: CommuteRead, plan: DotPlan, city: string): LegendItem[] {
  const items: LegendItem[] = []
  if (state === 0) return [{ color: ADMIN.both, kind: 'dot', label: `jobs located in ${city} · one dot is about ${fmtInt(plan.unit)} jobs` }]
  items.push({ color: ADMIN.jobsHere, kind: 'dot', label: `commutes in · ${pct(r.inShare)} of the jobs here` })
  items.push({ color: ADMIN.both, kind: 'dot', label: `lives and works in ${city} · ${pct(r.bothShareJobs)}` })
  if (state >= 2) items.push({ color: ADMIN.residents, kind: 'dot', label: `commutes out · ${pct(r.outShare)} of residents’ jobs` })
  return items
}

export function AdminSection() {
  const { placeId, cityName, metro, metroName } = useToolState()
  const place = usePlace(placeId)
  const read = useMemo(() => readCommute(place.commute), [place])
  const series = useMemo(() => ratioSeries(place.commute), [place])
  const places = useMemo(() => rankPlaces(placesOf(metro)), [metro])
  const [selected, setSelected] = useState(placeId)

  if (!read) return <NoCommuteSection places={places} />
  return <Beats read={read} series={series} places={places} placeId={placeId} cityName={cityName} metroName={metroName} selected={selected} onSelect={setSelected} />
}

interface BeatsProps {
  read: CommuteRead
  series: RatioPoint[]
  places: PlaceRatio[]
  placeId: string
  cityName: string
  metroName: string
  selected: string
  onSelect: (id: string) => void
}

function Beats({ read: r, series, places, placeId, cityName: city, metroName, selected, onSelect }: BeatsProps) {
  const plan = useMemo(() => planDots(r), [r])
  const questions = useMemo(() => adminQuestions(r, city), [r, city])

  const close = r.kind === 'balanced'
  const inWord = oneIn(r.bothShareJobs)
  const per100 = r.ratio === null ? null : Math.round(r.ratio * 100)
  const netWord = r.verdict === 'importer' ? 'a net importer of workers' : r.verdict === 'exporter' ? 'a net exporter of workers' : 'within a quarter of even'

  const steps = [
    {
      id: 'b1',
      node: (
        <Beat
          id="b1"
          section="admin"
          n={1}
          of={OF}
          title="One city, two workforces"
          badge="city"
          lede={
            <>
              Two counts sit behind every city. The jobs inside the boundary, whoever fills them, and the jobs its residents hold, wherever those jobs are. In most places the two are close. In {city} they{' '}
              {close ? 'are' : 'are not'}.
            </>
          }
        >
          <P>
            Start with the jobs. <B>{fmtInt(r.jobsHere)}</B> sit inside the city line. Each dot is about {fmtInt(plan.unit)} of them.
          </P>
          <Explainer title="Where the two counts come from" className="mt-4 max-w-[760px]">
            <p>
              Both counts are the Census Bureau’s LODES data for {r.year}: every job is placed once by where it is located and once by where the person who holds it lives. Jobs located in {city} and jobs held by {city}’s residents are the same file read
              two ways.
            </p>
            <p>It counts jobs, not people. Someone holding two jobs is counted twice, so the numbers run a little above the count of workers.</p>
          </Explainer>
        </Beat>
      ),
    },
    {
      id: 'b2',
      node: (
        <Beat
          id="b2"
          section="admin"
          n={2}
          of={OF}
          title={inWord ? `Only one in ${inWord} of those workers lives here` : 'Most of those workers live here'}
          badge="city"
          lede={
            <>
              <B>{fmtInt(r.liveWorkHere)}</B> of the jobs are held by {city} residents, and those dots stay put. The other <B>{fmtInt(r.inCommuters)}</B> move out to where their holders live, elsewhere in the metro.
            </>
          }
        />
      ),
    },
    {
      id: 'b3',
      node: (
        <Beat
          id="b3"
          section="admin"
          n={3}
          of={OF}
          title="Its residents commute out too"
          badge="city"
          lede={
            <>
              Residents hold <B>{fmtInt(r.residentWorkers)}</B> jobs. <B>{fmtInt(r.outCommuters)}</B> of them are outside the city, and those dots now leave in orange.
            </>
          }
        >
          <P>The two colours side by side are the exchange: for every resident who commutes out, {exchangeWords(r.inCommuters, r.outCommuters)}.</P>
        </Beat>
      ),
    },
    {
      id: 'b4',
      node: (
        <Beat
          id="b4"
          section="admin"
          n={4}
          of={OF}
          title="Two workforces"
          badge="city"
          lede={
            <>
              Sorted into rows, the same dots give the two counts. Jobs located here are the grey and teal rows together: <B>{fmtInt(r.jobsHere)}</B>. Jobs held by residents are the grey and orange rows: <B>{fmtInt(r.residentWorkers)}</B>.
            </>
          }
        >
          <P>
            {per100 !== null ? (
              <>
                That is <B>{fmtInt(per100)} jobs for every 100</B> its residents hold.{' '}
              </>
            ) : null}
            The city is {netWord}, and the beat that follows asks where that puts it among the metro’s places.
          </P>
        </Beat>
      ),
    },
    {
      id: 'b5',
      node: (
        <Beat
          id="b5"
          section="admin"
          n={5}
          of={OF}
          title="Workplace, or dormitory?"
          badge="city"
          lede={
            <>
              Every place collapses into one number: jobs located here for each job a resident holds. Above 1× the place imports workers; below it, the place sends them out. {city} sits at <B>{fmtX(r.ratio)}</B>.
            </>
          }
        >
          <StatRow
            items={[
              { icon: <BuildingIcon width={13} height={15} />, label: 'jobs located here', value: fmtInt(r.jobsHere), title: `${pct(r.inShare)} of them filled by people who commute in` },
              { icon: <PeopleIcon />, label: 'jobs held by residents', value: fmtInt(r.residentWorkers), title: `${pct(r.outShare)} of them outside the city` },
              { icon: <span className="text-[11px] font-bold">×</span>, label: 'jobs here per resident worker', value: fmtX(r.ratio) },
            ]}
          />
          <Explainer title="How to read the dial" className="mt-5 max-w-[760px]">
            <p>
              Jobs located in a place divided by the jobs its residents hold, wherever those are. <b>1×</b> means the two workforces are the same size — not that they are the same people. Below 0.8× the place is a dormitory for the metro; above 2× it is
              one of the metro’s hubs.
            </p>
            <p>The ranking beside the dial keeps to places with at least 5,000 resident workers, where a handful of jobs cannot swing the reading. Click a bar to point the dial at that place.</p>
          </Explainer>
        </Beat>
      ),
    },
  ]

  return (
    <>
      <Scrolly
        steps={steps}
        renderStage={(i) =>
          i < 4 ? (
            <div>
              <div className="mb-2 flex min-h-[34px] items-center">
                <Legend items={keyFor(dotsState(i), r, plan, shortName(city))} className="max-sm:gap-x-3 max-sm:text-[11px]" />
              </div>
              <WorkforceDots state={dotsState(i)} read={r} plan={plan} cityName={city} />
            </div>
          ) : (
            <GaugeStage read={r} series={series} places={places} cityId={placeId} cityName={city} metroName={metroName} selectedId={selected} onSelect={onSelect} />
          )
        }
      />
      <Checkpoint
        section="admin"
        questions={questions}
        applyPrompt="Which part of your city’s workforce surprised you, and what does it suggest about who the city’s jobs are for?"
        applyPlaceholder="The commuter share suggests…"
      />
    </>
  )
}
