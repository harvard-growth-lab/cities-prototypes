/* Metro Industries: three beats beside one figure the scroll drives — the
   traded treemap, the three tier cards, the specialization ranking — then
   the checkpoint. The page owns the figure's controls and what the ledes
   light, and hands them to both columns. */
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { Checkpoint } from '@/components/beats/checkpoint'
import { Scrolly } from '@/components/beats/scrolly'
import { SectionPage } from '@/components/beats/section-page'
import type { Sector } from '@/data/types'
import { useToolState } from '@/lib/use-tool-state'
import { IndustryFigure, type ColorBy, type SortBy, type View } from '@/sections/industries/industry-figure'
import { buildQuestions } from '@/sections/industries/questions'
import { Step1, Step2, Step3 } from '@/sections/industries/steps'
import { useIndustryData } from '@/sections/industries/use-industry-data'

export const Route = createFileRoute('/city/$slug/industries')({
  component: Page,
})

function Page() {
  const { metroName } = useToolState()
  const data = useIndustryData()
  // the view is remembered for the beat it was chosen on: each map beat opens on its map
  const [viewAt, setViewAt] = useState<{ step: number; view: View }>({ step: 0, view: 'map' })
  const [colorBy, setColorBy] = useState<ColorBy>('sector')
  const [sort, setSort] = useState<SortBy>('rca')
  const [litSector, setLitSector] = useState<Sector | null>(null)
  const [pinnedSector, setPinnedSector] = useState<Sector | null>(null)
  const [litCode, setLitCode] = useState<string | null>(null)
  const [pinnedCode, setPinnedCode] = useState<string | null>(null)

  const pinSector = useCallback((s: Sector) => {
    setPinnedSector((p) => {
      const next = p === s ? null : s
      setLitSector(next)
      return next
    })
  }, [])
  const pinCode = useCallback((c: string) => {
    setPinnedCode((p) => {
      const next = p === c ? null : c
      setLitCode(next)
      return next
    })
  }, [])

  const questions = useMemo(() => buildQuestions(data, metroName), [data, metroName])

  return (
    <SectionPage section="industries" variant="wide">
      <Scrolly
        steps={[
          {
            id: 'b1',
            node: <Step1 data={data} showComplexity={colorBy === 'complexity'} litSector={litSector} pinnedSector={pinnedSector} onLitSector={setLitSector} onPinSector={pinSector} />,
          },
          { id: 'b2', node: <Step2 data={data} /> },
          { id: 'b3', node: <Step3 data={data} litCode={litCode} pinnedCode={pinnedCode} onLitCode={setLitCode} onPinCode={pinCode} /> },
        ]}
        renderStage={(active) => (
          <IndustryFigure
            data={data}
            step={active}
            view={viewAt.step === active ? viewAt.view : 'map'}
            colorBy={colorBy}
            sort={sort}
            onView={(view) => setViewAt({ step: active, view })}
            onColorBy={setColorBy}
            onSort={setSort}
            litSector={litSector}
            litCode={litCode}
          />
        )}
      />
      <Checkpoint
        section="industries"
        questions={questions}
        applyPrompt="Which part of your city’s economic mix surprised you, and what does it suggest about what the city could sell more of?"
        applyPlaceholder="The mix suggests…"
      />
    </SectionPage>
  )
}
