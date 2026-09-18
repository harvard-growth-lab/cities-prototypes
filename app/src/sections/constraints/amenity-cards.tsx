/* Beat 3's second figure: the amenity residual — how far home prices sit
   from what wages predict — for the metro and for the admin city, each
   with its change over the window. The two geographies keep their hues. */
import { Component, Suspense, type ReactNode } from 'react'
import { BuildingIcon, MetroIcon } from '@/components/chrome/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlace } from '@/data/queries'
import type { AmenityResidual } from '@/data/types'
import { fmtSignedPctInt, fmtYears } from '@/lib/format'
import { useToolState } from '@/lib/use-tool-state'
import { cn } from '@/lib/utils'

interface ReadingProps {
  amenity: AmenityResidual | null
  /** "" for the metro, ", net of its metro" for the city */
  tail: string
  tone: 'metro' | 'city'
  /** the admin city is its metro's only place */
  only?: boolean
}

/** The log-point change as whole points: −0.147 → "−15 pts". */
const fmtPts = (d: number) => {
  const n = Math.abs(d * 100).toFixed(0)
  return `${d >= 0 ? '+' : '−'}${n} ${n === '1' ? 'pt' : 'pts'}`
}
/** The residual as an unsigned magnitude; the word beside it carries the direction. */
const fmtMag = (v: number) => fmtSignedPctInt(Math.abs(v)).replace('+', '')

function Reading({ amenity, tail, tone, only }: ReadingProps) {
  if (!amenity) {
    return <p className="text-sm text-ink-soft">No amenity residual for this geography — the atlas has no price or wage series to fit.</p>
  }
  const pct = amenity.residualPct
  const flat = Math.abs(pct) < 0.0005
  const delta = amenity.residualDelta
  const steady = delta !== null && Math.abs(delta * 100) < 0.5
  return (
    <>
      <p className="leading-tight">
        <b className={cn('nums text-[34px] font-bold tracking-[-1px]', tone === 'metro' ? 'text-geo-metro' : 'text-geo-city')}>{flat ? '0%' : fmtMag(pct)}</b>{' '}
        <span className="text-sm text-ink">{flat ? `about what its wage predicts${tail}` : `${pct > 0 ? 'pricier' : 'cheaper'} than its wage predicts${tail}`}</span>
      </p>
      <p className="mt-2.5 text-sm text-ink">
        {delta === null ? (
          <span className="text-ink-soft">Change over the window: —</span>
        ) : steady ? (
          <>
            <span className="nums font-semibold text-ink-soft">0 pts</span> over {fmtYears(amenity.priceYears)} — the pull held steady.
          </>
        ) : (
          <>
            <span className={cn('nums font-semibold', delta >= 0 ? 'text-rise' : 'text-fall')}>
              {delta >= 0 ? '▲' : '▼'} {fmtPts(delta)}
            </span>{' '}
            over {fmtYears(amenity.priceYears)} — the pull {delta >= 0 ? 'strengthened' : 'weakened'}.
          </>
        )}
      </p>
      {only && flat && <p className="mt-1.5 text-xs text-ink-soft">The only place in its metro: net of the metro there is nothing left to read.</p>}
      <p className="mt-1.5 text-xs text-ink-soft">
        Wages read {fmtYears(amenity.wageYears)} · prices {fmtYears(amenity.priceYears)}
      </p>
    </>
  )
}

/** A place file that fails to load must not take the beat down with it. */
class PlaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <p className="text-sm text-ink-soft">The admin city’s detail file could not be loaded.</p> : this.props.children
  }
}

function CityReading({ placeId, only }: { placeId: string; only: boolean }) {
  const place = usePlace(placeId)
  return <Reading amenity={place.amenity} tail=", net of its metro" tone="city" only={only} />
}

export function AmenityCards() {
  const { metro, summary, placeId, metroName, cityName } = useToolState()
  return (
    <div className="mt-5 grid w-full max-w-[880px] grid-cols-2 gap-4 max-sm:grid-cols-1">
      <Card size="sm" className="rounded-[10px] bg-[#f4f6f7] ring-line">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[16.5px] font-bold text-geo-metro">
            <MetroIcon width={22} height={16} /> {metroName} metro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Reading amenity={metro.amenity} tail="" tone="metro" />
        </CardContent>
      </Card>
      <Card size="sm" className="rounded-[10px] bg-[#f4f6f7] ring-line">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[16.5px] font-bold text-geo-city">
            <BuildingIcon width={13} height={17} /> {cityName} admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlaceBoundary key={placeId}>
            <Suspense
              fallback={
                <div className="space-y-2">
                  <Skeleton className="h-9 w-2/3" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              }
            >
              <CityReading placeId={placeId} only={summary.nPlaces === 1} />
            </Suspense>
          </PlaceBoundary>
        </CardContent>
      </Card>
    </div>
  )
}
