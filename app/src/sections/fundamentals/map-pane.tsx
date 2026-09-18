/* The section's one map, following the beat being read: the admin place
   (beat 1), the metro pulled back (beat 2), then every place as a
   clickable cell (beat 3) with the "Add a place" nudge until a pick. */
import { lazy, Suspense, useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useToolState } from '@/lib/use-tool-state'
import { MapNudge } from './map-nudge'

const CityMap = lazy(() => import('@/components/map/city-map'))

export interface MapPaneProps {
  /** index of the beat being read */
  block: number
  picked: string[]
  onPick: (id: string) => void
}

export function MapPane({ block, picked, onPick }: MapPaneProps) {
  const { geo, placeId, cityName, openGeo } = useToolState()
  const picker = block >= 2
  // every place the metro has a polygon for; the map drops the admin place itself
  const pickable = useMemo(
    () => (geo ? geo.features.filter((f) => f.properties.kind === 'place' && f.properties.id !== placeId).map((f) => f.properties.id) : []),
    [geo, placeId],
  )
  if (!geo) return <Skeleton className="h-full w-full rounded-none" />
  return (
    <div className="relative h-full w-full">
      <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
        <CityMap
          geo={geo}
          focus={block === 0 ? 'city' : 'metro'}
          cityId={placeId}
          cityName={cityName}
          placeIds={picker ? pickable : undefined}
          selectedIds={picked}
          onPlaceClick={onPick}
          onCalloutClick={openGeo}
        />
      </Suspense>
      {picker && picked.length === 0 && pickable.length > 0 && <MapNudge className="absolute bottom-3.5 left-3.5 z-10 max-sm:bottom-8 max-sm:left-2.5" />}
    </div>
  )
}
