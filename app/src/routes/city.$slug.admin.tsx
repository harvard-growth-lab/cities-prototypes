/* Section 3, Admin Industries: the two workforces of the admin city, read
   from its LODES totals. The place file is prefetched by the shell but may
   still be in flight (or missing), so the section waits behind a skeleton
   and falls back to the metro's own rows when the place has none. */
import { CatchBoundary, createFileRoute } from '@tanstack/react-router'
import { Suspense, useMemo } from 'react'
import { SectionPage } from '@/components/beats/section-page'
import { Skeleton } from '@/components/ui/skeleton'
import { placesOf } from '@/data/derive'
import { useToolState } from '@/lib/use-tool-state'
import { AdminSection } from '@/sections/admin/admin-section'
import { rankPlaces } from '@/sections/admin/commute'
import { NoCommuteSection } from '@/sections/admin/no-commute'

export const Route = createFileRoute('/city/$slug/admin')({
  component: Page,
})

function Page() {
  const { placeId } = useToolState()
  return (
    <SectionPage section="admin" variant="wide">
      <CatchBoundary getResetKey={() => placeId} errorComponent={Unavailable}>
        <Suspense fallback={<Loading />}>
          <AdminSection key={placeId} />
        </Suspense>
      </CatchBoundary>
    </SectionPage>
  )
}

function Loading() {
  return (
    <div className="grid grid-cols-[clamp(236px,27vw,392px)_minmax(0,1fr)] gap-14 max-narrow:grid-cols-1" aria-busy="true" aria-label="Loading the admin city’s commuting data">
      <div className="space-y-3 pt-10">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="aspect-[880/552] w-full rounded-[10px]" />
    </div>
  )
}

/** The place file could not be read: keep the metro's ranking on screen. */
function Unavailable() {
  const { metro } = useToolState()
  const places = useMemo(() => rankPlaces(placesOf(metro)), [metro])
  return <NoCommuteSection places={places} />
}
