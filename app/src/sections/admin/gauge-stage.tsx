/* The stage for "Workplace, or dormitory?": the dial for the admin city
   (or whichever place the reader picks), its verdict and the sentence
   behind it, the ratio's drift, and the metro's places ranked beside. */
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtInt } from '@/lib/format'
import { useIsNarrow, useIsPhone } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { fmtX, KIND_PHRASE, ratioKind, shortName, VERDICT_LABEL, verdictOf, type CommuteRead, type PlaceRatio, type RatioPoint, type Verdict } from './commute'
import { DormitoryGauge } from './dormitory-gauge'
import { PlacesRatioChart } from './places-ratio-chart'
import { RatioSparkline } from './ratio-sparkline'

const PILL: Record<Verdict, string> = {
  importer: 'bg-teal-tint text-teal',
  exporter: 'bg-[#fbe6e6] text-[#b23a3a]',
  balanced: 'bg-[#eceff0] text-ink-soft',
}

export interface GaugeStageProps {
  /** the admin city's read */
  read: CommuteRead
  series: RatioPoint[]
  places: PlaceRatio[]
  cityId: string
  cityName: string
  metroName: string
  selectedId: string
  onSelect: (id: string) => void
}

/** The sentence under the pill: the admin city's, with its in/out split, or a picked place's. */
function sentence(read: CommuteRead, picked: PlaceRatio | undefined, isCity: boolean, cityName: string) {
  if (isCity) {
    const kind = read.kind ? KIND_PHRASE[read.kind] : 'hard to place'
    const flows =
      read.net > 0
        ? `Net of the ${fmtInt(read.outCommuters)} who commute out, ${fmtInt(read.net)} more people come in than go out.`
        : read.net < 0
          ? `Net of the ${fmtInt(read.inCommuters)} who commute in, ${fmtInt(-read.net)} more people go out than come in.`
          : 'As many people come in as go out.'
    return `${fmtInt(read.jobsHere)} jobs sit inside ${cityName} and its residents hold ${fmtInt(read.residentWorkers)}. ${flows} On this reading ${cityName} as a whole is ${kind}.`
  }
  if (!picked) return null
  const kind = ratioKind(picked.ratio)
  return `${picked.name} has ${fmtInt(picked.jobsHere)} jobs inside its line and its residents hold ${fmtInt(picked.residentWorkers)}: ${fmtX(picked.ratio)} jobs here per resident worker. On this reading ${picked.name} is ${kind ? KIND_PHRASE[kind] : 'hard to place'}.`
}

export function GaugeStage({ read, series, places, cityId, cityName, metroName, selectedId, onSelect }: GaugeStageProps) {
  const narrow = useIsNarrow()
  const phone = useIsPhone()
  const picked = useMemo(() => places.find((p) => p.id === selectedId), [places, selectedId])
  const isCity = selectedId === cityId
  const value = isCity ? read.ratio : (picked?.ratio ?? null)
  const name = shortName(isCity ? cityName : (picked?.name ?? cityName))
  const verdict = verdictOf(value)
  const text = sentence(read, picked, isCity, cityName)
  const smallPool = places.length > 0 && places.some((p) => p.residentWorkers < 5_000)

  const pill = verdict && <Badge className={cn('h-auto rounded-full border-0 px-2.5 py-0.5 text-[12.5px] font-bold', PILL[verdict])}>{VERDICT_LABEL[verdict]}</Badge>
  const back = !isCity && (
    <Button type="button" variant="outline" size="xs" onClick={() => onSelect(cityId)} className="border-line-strong text-teal">
      Back to {shortName(cityName)}
    </Button>
  )
  const chartHead = (
    <p className="mb-1.5 text-xs font-semibold text-ink-soft">
      Jobs here per resident worker · {places.length === 1 ? 'the one place' : `${places.length} places`} in the {metroName} metro
      {smallPool ? '' : ' with 5,000+ resident workers'}
      {places.length > 1 && !phone ? ' · click a bar to point the dial at it' : ''}
    </p>
  )

  // the phone band has no room for a column layout: dial beside its reading, the ranking under both
  if (phone) {
    return (
      <div className="min-w-0">
        <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-x-3">
          <DormitoryGauge value={value} name={name} ghost={isCity ? null : read.ratio} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {pill}
              {back}
            </div>
            {text && <p className="mt-1.5 text-[11.5px] leading-[1.4] text-ink">{text}</p>}
          </div>
        </div>
        <div className="mt-2">
          {chartHead}
          <PlacesRatioChart places={places} cityId={cityId} selectedId={selectedId} onSelect={onSelect} maxHeight={130} />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-x-7 gap-y-3">
      <div className="min-w-0">
        <DormitoryGauge value={value} name={name} ghost={isCity ? null : read.ratio} className={cn(narrow && 'max-w-[300px]')} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {pill}
          {back}
        </div>
        {text && <p className={cn('mt-2 max-w-[46ch] text-ink', narrow ? 'text-xs leading-[1.45]' : 'text-[13px] leading-[1.5]')}>{text}</p>}
        {!narrow && series.length > 1 && <RatioSparkline series={series} cityName={shortName(cityName)} className="mt-3" />}
      </div>
      <div className="min-w-0">
        {chartHead}
        <PlacesRatioChart places={places} cityId={cityId} selectedId={selectedId} onSelect={onSelect} maxHeight={narrow ? 240 : 400} />
      </div>
    </div>
  )
}
