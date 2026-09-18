/* "Viewing: Boston metro" — the geography a badge names, drawn on the map.
   Opened by every GeoBadge and by the map's callout chips. */
import { lazy, Suspense } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToolState, type Geo } from '@/lib/use-tool-state'

const CityMap = lazy(() => import('@/components/map/city-map'))

export function GeoDialog({ geo, onClose }: { geo: Geo | null; onClose: () => void }) {
  const { cityName, metroName, summary, placeId, geo: shapes } = useToolState()
  const n = summary.nPlaces
  const isCity = geo === 'city'
  return (
    <Dialog open={geo !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex w-[660px] max-w-[calc(100%-2rem)] flex-col gap-0 rounded-[14px] p-0 sm:max-w-[660px] max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <div className="px-7 pt-6 pb-3 pr-12 max-sm:px-5">
          <DialogTitle className="text-[20px] font-semibold text-ink">
            Viewing: {isCity ? `${cityName} admin` : `${metroName} metro`}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-soft">
            {isCity
              ? `The administrative city — one municipality among the metro’s ${n}.`
              : `The whole labor market — ${n} cities and towns inside the dashed edge.`}
          </DialogDescription>
        </div>
        <div className="px-7 pb-7 max-sm:min-h-0 max-sm:flex-1 max-sm:px-3 max-sm:pb-3">
          <div className="aspect-[600/430] w-full overflow-hidden rounded-lg border border-line max-sm:h-full">
            {geo && shapes ? (
              <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
                <CityMap geo={shapes} focus={geo} cityId={placeId} cityName={cityName} interactive={false} showCallouts={false} />
              </Suspense>
            ) : (
              <Skeleton className="h-full w-full rounded-none" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
