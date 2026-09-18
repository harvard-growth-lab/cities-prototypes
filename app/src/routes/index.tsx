/* The landing (design-spec §2.1): the question, what the tool does, and
   the diagnose panel for one metro. The chosen metro is local state,
   remembered between visits. */
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { JourneyDialog } from '@/components/chrome/journey-dialog'
import { Toolbar } from '@/components/chrome/toolbar'
import { DiagnosePanel } from '@/components/landing/diagnose-panel'
import { indexQuery } from '@/data/queries'
import { SECTIONS, sectionPath } from '@/lib/sections'

const DEFAULT_METRO = '14460' // Boston
const REMEMBER = 'cities:landing-metro'

export const Route = createFileRoute('/')({
  validateSearch: z.object({ journey: z.boolean().optional() }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(indexQuery()),
  component: Landing,
})

function remembered() {
  try {
    return localStorage.getItem(REMEMBER) ?? DEFAULT_METRO
  } catch {
    return DEFAULT_METRO
  }
}

function Landing() {
  const index = useSuspenseQuery(indexQuery()).data
  const { journey } = Route.useSearch()
  const navigate = useNavigate()
  const [metroId, setMetroId] = useState(remembered)
  const metro = index.metros.find((m) => m.id === metroId) ?? index.metros.find((m) => m.id === DEFAULT_METRO) ?? index.metros[0]

  useEffect(() => {
    try {
      localStorage.setItem(REMEMBER, metro.id)
    } catch {
      /* forgettable */
    }
  }, [metro.id])

  const openJourney = () => navigate({ to: '/', search: { journey: true } })
  const closeJourney = () => navigate({ to: '/', search: {}, replace: true })

  return (
    <div className="relative flex h-dvh flex-col overflow-x-clip bg-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-[url(/assets/landing-page.webp)] bg-cover bg-top"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(255,255,255,.55) 0%, rgba(255,255,255,.18) 55%, rgba(255,255,255,0) 100%), url(/assets/landing-page.webp)',
        }}
      />
      <Toolbar variant="landing" onJourney={openJourney} className="relative z-10" />

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-[max(24px,calc((100vw_-_1140px)_/_2))] py-10 max-narrow:items-start max-narrow:py-8 max-sm:px-4">
        <div className="grid w-full max-w-[1140px] grid-cols-[minmax(0,600px)_470px] items-center justify-between gap-x-14 gap-y-0 [grid-template-areas:'copy_panel'_'jump_panel'] max-[1200px]:grid-cols-[1fr_minmax(340px,420px)] max-[1200px]:gap-x-10 max-narrow:max-w-[680px] max-narrow:grid-cols-1 max-narrow:[grid-template-areas:'copy'_'panel'_'jump']">
          <div className="[grid-area:copy]">
            <p className="text-lg font-semibold tracking-[0.2px] text-teal">Growth Lab Cities Tool</p>
            <h1 className="mt-3 text-hero font-bold tracking-[-0.6px] text-teal [@media(max-height:960px)]:text-[clamp(40px,5vw,60px)]">
              What is constraining your city's growth?
            </h1>
            <p className="mt-6 max-w-[600px] text-base leading-[1.6] text-ink">
              Pick a city and the tool reads it three ways: as the administrative city you can see from City Hall, as the metro
              that is its real labor market, and against the typical US metro. Population, pay and the cost of living tell
              you whether people are arriving or leaving and whether employers are bidding for them; the industries say
              what the metro sells to the world and where it is most specialized.
            </p>
            <p className="mt-4 max-w-[600px] text-base leading-[1.6] text-ink max-sm:hidden">
              Put together, those readings point at the binding constraint — demand for what the city makes, or the
              supply of people, housing and amenities that lets it grow — and at the levers that could move it.
            </p>
          </div>

          <div className="[grid-area:panel] max-narrow:mt-8">
            <DiagnosePanel index={index} metro={metro} onChange={(m) => setMetroId(m.id)} />
          </div>

          <div className="mt-[38px] flex flex-wrap items-baseline gap-x-4 gap-y-1.5 [grid-area:jump] max-narrow:mt-7">
            <span className="text-[12.5px] font-semibold text-teal">Jump to a section:</span>
            {SECTIONS.map((s) => (
              <Link
                key={s.slug}
                to={sectionPath(s.slug)}
                params={{ slug: metro.slug }}
                className="text-[13.5px] text-teal underline decoration-teal/60 underline-offset-[3px] hover:decoration-teal"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <JourneyDialog open={journey === true} onOpenChange={(o) => (o ? openJourney() : closeJourney())} metro={metro} metros={index.metros} />
    </div>
  )
}
