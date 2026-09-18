/* Section 1 — Economic Fundamentals (design-spec §3.1): three beats in a
   reading column beside one map that follows them, then the checkpoint
   across the full width below the split. The beats live in
   src/sections/fundamentals; this file composes them and holds what they
   share — the beat being read and the picked places. */
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { Checkpoint } from '@/components/beats/checkpoint'
import { SectionPage } from '@/components/beats/section-page'
import { SplitLayout } from '@/components/beats/split-layout'
import { sectionBySlug } from '@/lib/sections'
import { useToolState } from '@/lib/use-tool-state'
import { CityBeat } from '@/sections/fundamentals/beat-city'
import { MetroBeat } from '@/sections/fundamentals/beat-metro'
import { PlacesBeat } from '@/sections/fundamentals/beat-places'
import { APPLY_PLACEHOLDER, APPLY_PROMPT, buildCheckQuestions } from '@/sections/fundamentals/check-questions'
import { MapPane } from '@/sections/fundamentals/map-pane'
import { shareOfMetro } from '@/sections/fundamentals/place-metrics'

export const Route = createFileRoute('/city/$slug/fundamentals')({
  component: Page,
})

const SECTION = sectionBySlug('fundamentals')!
const N_BEATS = SECTION.beats.filter((b) => b.id !== 'check' && b.id !== 'apply').length
/** the table (and the map) hold at most two picked places; the oldest goes */
const MAX_PICKED = 2

function Page() {
  const { place, summary, cityName, metroName, index } = useToolState()
  const [block, setBlock] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const onActiveBlock = useCallback((i: number) => setBlock(i), [])
  const onPick = useCallback(
    (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-(MAX_PICKED - 1)), id])),
    [],
  )
  const onRemove = useCallback((id: string) => setPicked((p) => p.filter((x) => x !== id)), [])

  const questions = useMemo(
    () =>
      buildCheckQuestions({
        cityName,
        metroName,
        share: shareOfMetro(place, summary),
        popCagr: place.popCagr,
        nationalPopCagr: index.national.popCagr,
        windowStart: index.window.start,
      }),
    [cityName, metroName, place, summary, index.national.popCagr, index.window.start],
  )

  return (
    <SectionPage section="fundamentals" variant="split">
      <SplitLayout onActiveBlock={onActiveBlock} aside={<MapPane block={block} picked={picked} onPick={onPick} />}>
        <CityBeat n={1} of={N_BEATS} />
        <MetroBeat n={2} of={N_BEATS} />
        <PlacesBeat n={3} of={N_BEATS} picked={picked} onPick={onPick} onRemove={onRemove} />
      </SplitLayout>
      <Checkpoint section="fundamentals" className="mx-frame mb-10" questions={questions} applyPrompt={APPLY_PROMPT} applyPlaceholder={APPLY_PLACEHOLDER} />
    </SectionPage>
  )
}
