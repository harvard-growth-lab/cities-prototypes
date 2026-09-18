/* The tool shell: resolves the metro from its slug, loads what every
   section reads, and provides the tool state. The URL carries the shared
   picks — `?place` (the admin city), `?journey` (the dialog) — and the
   section routes render inside <main id="pages">, the only scroller. */
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, Outlet, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { GeoDialog } from '@/components/chrome/geo-dialog'
import { JourneyDialog } from '@/components/chrome/journey-dialog'
import { Pager } from '@/components/chrome/pager'
import { SectionBar } from '@/components/chrome/section-bar'
import { Toolbar } from '@/components/chrome/toolbar'
import { placesOf } from '@/data/derive'
import { indexQuery, metroGeoQuery, metroQuery, nationalQuery, placeQuery } from '@/data/queries'
import type { PlaceRow } from '@/data/types'
import { addExploredMetro } from '@/lib/journey'
import { ToolStateContext, useActiveSection, type Geo, type ToolState } from '@/lib/use-tool-state'

const searchSchema = z.object({
  place: z.string().optional(),
  journey: z.boolean().optional(),
})

export const Route = createFileRoute('/city/$slug')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ place: search.place }),
  loader: async ({ params, deps, context: { queryClient } }) => {
    const index = await queryClient.ensureQueryData(indexQuery())
    const m = index.metros.find((x) => x.slug === params.slug)
    if (!m) throw notFound()
    await Promise.all([queryClient.ensureQueryData(metroQuery(m.id)), queryClient.ensureQueryData(nationalQuery())])
    // needed soon, not now: the map's shapes and the admin place's detail
    void queryClient.prefetchQuery(metroGeoQuery(m.id))
    void queryClient.prefetchQuery(placeQuery(deps.place ?? m.principalPlaceId))
    return { metroId: m.id }
  },
  pendingComponent: () => <p className="p-10 text-sm text-ink-soft">Loading the metro…</p>,
  notFoundComponent: () => (
    <div className="p-10">
      <h1 className="text-title font-semibold text-ink">No such metro</h1>
      <p className="mt-2 text-sm text-ink-soft">
        The address does not name a metro in the atlas.{' '}
        <Link to="/" className="font-semibold text-teal underline underline-offset-2">
          Choose one on the landing page.
        </Link>
      </p>
    </div>
  ),
  component: ToolShell,
})

function ToolShell() {
  const { metroId } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const index = useSuspenseQuery(indexQuery()).data
  const national = useSuspenseQuery(nationalQuery()).data
  const metro = useSuspenseQuery(metroQuery(metroId)).data
  const geo = useQuery(metroGeoQuery(metroId)).data
  const [geoOpen, setGeoOpen] = useState<Geo | null>(null)
  const activeSection = useActiveSection()

  const summary = metro.summary
  const places = useMemo(() => placesOf(metro), [metro])
  const placeId = search.place && places.some((p) => p.id === search.place) ? search.place : summary.principalPlaceId
  const place = useMemo<PlaceRow>(
    () =>
      places.find((p) => p.id === placeId) ??
      places[0] ?? {
        id: summary.principalPlaceId,
        name: summary.principalPlaceName,
        state: summary.state,
        class: 'incorporated',
        population: null,
        popCagr: null,
        wage: null,
        wageCagr: null,
        homeValue: null,
        costCagr: null,
        unemployment: null,
        quadrant: null,
        borderline: false,
        supplySide: null,
        amenityPct: null,
        amenityDelta: null,
        jobsHere: null,
        residentWorkers: null,
      },
    [places, placeId, summary],
  )

  useEffect(() => addExploredMetro(summary.id), [summary.id])

  const setPlace = useCallback(
    (id: string) =>
      navigate({
        to: '.',
        search: (prev) => ({ ...prev, place: id === summary.principalPlaceId ? undefined : id }),
        hash: true,
        replace: true,
        resetScroll: false,
      }),
    [navigate, summary.principalPlaceId],
  )
  const openJourney = useCallback(
    () => navigate({ to: '.', search: (prev) => ({ ...prev, journey: true }), hash: true, resetScroll: false }),
    [navigate],
  )
  const closeJourney = useCallback(
    () => navigate({ to: '.', search: (prev) => ({ ...prev, journey: undefined }), hash: true, replace: true, resetScroll: false }),
    [navigate],
  )

  const state: ToolState = {
    index,
    national,
    metro,
    summary,
    placeId: place.id,
    place,
    setPlace,
    cityName: place.name,
    metroName: summary.name,
    displayName: summary.displayName,
    geo,
    openJourney,
    closeJourney,
    openGeo: setGeoOpen,
    closeGeo: () => setGeoOpen(null),
  }

  return (
    <ToolStateContext.Provider value={state}>
      <div className="flex h-dvh flex-col overflow-x-clip">
        <main id="pages" className="min-h-0 flex-1 overflow-x-clip overflow-y-auto">
          <Toolbar onJourney={openJourney} />
          <SectionBar />
          <Outlet />
          <Pager />
        </main>
        <JourneyDialog
          open={search.journey === true}
          onOpenChange={(o) => (o ? openJourney() : closeJourney())}
          metro={summary}
          metros={index.metros}
          place={search.place}
          current={activeSection.slug}
        />
        <GeoDialog geo={geoOpen} onClose={() => setGeoOpen(null)} />
      </div>
    </ToolStateContext.Provider>
  )
}
