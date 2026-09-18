/* Section 4 — Constraints Diagnosis: the metro on the people × pay plane,
   the metro bursting into its places, and the supply-side split (cost or
   the place itself). Three plain beats on the 880 figure measure, then the
   checkpoint. The page takes the frame width so the 880-unit plots keep
   their width on compressed desktops (design-spec §3.4). */
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Checkpoint, type CheckQuestion } from '@/components/beats/checkpoint'
import { SectionPage } from '@/components/beats/section-page'
import type { Quadrant } from '@/data/types'
import { fmtRate, fmtSignedPct } from '@/lib/format'
import { QUADRANTS } from '@/lib/quadrants'
import { useToolState } from '@/lib/use-tool-state'
import { BeatCity } from '@/sections/constraints/beat-city'
import { BeatCost } from '@/sections/constraints/beat-cost'
import { BeatMetro } from '@/sections/constraints/beat-metro'

export const Route = createFileRoute('/city/$slug/constraints')({
  component: Page,
})

const OF = 3
const QUARTERS: Quadrant[] = ['supply_negative', 'demand_positive', 'supply_positive', 'demand_negative']

function Page() {
  const { index, summary, metroName } = useToolState()

  const questions = useMemo<CheckQuestion[]>(() => {
    const qs: CheckQuestion[] = [
      {
        q: 'A metro pairs fast salary growth with slow population growth. What does that usually point to?',
        options: ['A supply constraint — people are being priced out', 'Weak demand for workers', 'A shrinking export base'],
        answer: 0,
        feedback: 'When pay is bid up but people cannot move in, the binding constraint is usually the cost and supply of housing.',
      },
      {
        q: 'Which signal would point at housing as the wall?',
        options: ['Home values rising faster than the national trend', 'Falling rents', 'Slow wage growth'],
        answer: 0,
        feedback: 'Fast-rising home values alongside strong pay growth is what being priced out looks like in the data.',
      },
    ]
    if (summary.quadrant) {
      const q = QUADRANTS[summary.quadrant]
      qs.push({
        q: `Which quarter does ${metroName}’s metro land in?`,
        options: QUARTERS.map((k) => QUADRANTS[k].scatterLabel),
        answer: QUARTERS.indexOf(summary.quadrant),
        feedback: `${metroName} reads ${q.shock}${summary.borderline ? ' (borderline)' : ''}: people ${fmtRate(summary.popCagr)} against a typical ${fmtSignedPct(index.medians.popCagr)}, pay ${fmtRate(summary.wageCagr)} against ${fmtSignedPct(index.medians.wageCagr)}.`,
      })
    }
    return qs
  }, [summary, metroName, index.medians])

  return (
    <SectionPage section="constraints" variant="wide">
      <div className="mx-auto w-full max-w-[880px]">
        <div className="space-y-[88px] max-narrow:space-y-16 max-sm:space-y-12">
          <BeatMetro n={1} of={OF} />
          <BeatCity n={2} of={OF} />
          <BeatCost n={3} of={OF} />
        </div>
        <Checkpoint
          section="constraints"
          questions={questions}
          applyPrompt="After these charts, what do you now suspect is binding your city’s growth — and which chart made you think so?"
          applyPlaceholder="The scatter position makes me suspect…"
        />
      </div>
    </SectionPage>
  )
}
