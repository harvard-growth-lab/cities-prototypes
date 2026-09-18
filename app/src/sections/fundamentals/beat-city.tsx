/* Beat 1 — "How well is your city doing?": the admin place's population
   against all US metros, then its wage. A census-designated place with no
   population estimate leads with the wage instead. */
import { DollarSign } from 'lucide-react'
import { Suspense } from 'react'
import { Beat } from '@/components/beats/beat'
import { StatRow, type StatItem } from '@/components/beats/stat-row'
import { PeopleIcon } from '@/components/chrome/icons'
import { Skeleton } from '@/components/ui/skeleton'
import { latest } from '@/data/derive'
import { usePlace } from '@/data/queries'
import { fmtInt, fmtMoney } from '@/lib/format'
import { useToolState } from '@/lib/use-tool-state'
import { PopulationChart } from './population-chart'
import { benchmarkStat, changeStat, countStat } from './stats'
import { WageChart } from './wage-chart'

const SOURCE_LINE = 'Source: Census PEP (population); IRS SOI wages per return, 3-year centred mean (wage).'

export function CityBeat({ n, of }: { n: number; of: number }) {
  const { cityName, place } = useToolState()
  const noPop = place.population === null
  return (
    <Beat
      id="b1"
      section="fundamentals"
      n={n}
      of={of}
      title="How well is your city doing?"
      badge="city"
      lede={
        <>
          The clearest signal is whether people are arriving or leaving. Within a country, moving is relatively frictionless — so population change is
          residents voting with their feet on whether {cityName} is a good place to live and work. Here is how it has moved: each indicator’s change and
          how it compares with the national trend.
          {noPop && (
            <>
              {' '}
              {cityName} is a census-designated place, so the Census publishes no population estimate for it; its average wage stands in.
            </>
          )}
        </>
      }
    >
      <Suspense fallback={<Skeleton className="mt-5 h-[300px] w-full rounded-lg" />}>
        <CityBody />
      </Suspense>
    </Beat>
  )
}

function CityBody() {
  const { placeId, place, cityName, index } = useToolState()
  const detail = usePlace(placeId)
  const { window: win, national } = index
  const window: [number, number] = [win.start, win.end]
  const popRow = latest(detail.panel, 'population')
  const wageRow = latest(detail.panel, 'wage')
  const diag = detail.diagnosis
  const popCagr = diag?.popCagr ?? place.popCagr
  const wageCagr = diag?.wageCagr ?? place.wageCagr
  const popBand = diag?.popYears ?? window
  const wageBand = diag?.wageYears ?? window

  const stats: StatItem[] = popRow
    ? [countStat(<PeopleIcon />, `Admin population, ${popRow.year}`, fmtInt(popRow.population)), changeStat(popBand[0], popCagr), benchmarkStat(national.popCagr, window)]
    : wageRow
      ? [countStat(<DollarSign strokeWidth={2.2} />, `Average wage, ${wageRow.year}`, fmtMoney(wageRow.wage)), changeStat(wageBand[0], wageCagr), benchmarkStat(national.wageCagr, window)]
      : []

  return (
    <>
      {stats.length > 0 && <StatRow items={stats} />}
      {popRow && (
        <PopulationChart className="mt-6" place={{ panel: detail.panel, label: cityName, rate: popCagr }} nationLabel="All US metros" band={popBand} />
      )}
      {wageRow && <WageChart className="mt-6" panel={detail.panel} label={cityName} rate={wageCagr} band={wageBand} />}
      {!popRow && !wageRow && <p className="mt-5 text-sm text-ink-soft">The atlas carries no population or wage series for {cityName}.</p>}
      <p className="mt-3 text-xs text-ink-soft">{SOURCE_LINE}</p>
    </>
  )
}
