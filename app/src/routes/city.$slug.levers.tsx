/* Levers for Change: what the diagnosis points at, what the metro could grow
   into, and the rest of the evidence the atlas holds about the metro and
   its admin city. A plain page of three beats and the checkpoint. */
import { createFileRoute } from '@tanstack/react-router'
import { Compass, Globe, Layers } from 'lucide-react'
import { Suspense, useMemo } from 'react'
import { Beat } from '@/components/beats/beat'
import { Checkpoint, type CheckQuestion } from '@/components/beats/checkpoint'
import { Explainer } from '@/components/beats/explainer'
import { SectionPage } from '@/components/beats/section-page'
import { StatRow, type StatItem } from '@/components/beats/stat-row'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtPct } from '@/lib/format'
import { useToolState } from '@/lib/use-tool-state'
import { CityBoard } from '@/sections/levers/city-board'
import { EvidenceBoard } from '@/sections/levers/evidence-board'
import { EvidenceList } from '@/sections/levers/evidence-list'
import { InnovationLists } from '@/sections/levers/innovation-lists'
import { LeverTree } from '@/sections/levers/lever-tree'
import {
  NODE_NAME,
  diagnosisPath,
  evidenceOf,
  fixed,
  latestComplexity,
  latestOutlook,
  opportunitiesFor,
  rotate,
  tradedShare,
} from '@/sections/levers/levers-data'
import { OpportunityChart } from '@/sections/levers/opportunity-chart'
import { OpportunityTable } from '@/sections/levers/opportunity-table'

export const Route = createFileRoute('/city/$slug/levers')({
  component: Page,
})

const OF = 3

const SPEC_QUESTIONS: CheckQuestion[] = [
  {
    q: 'If housing supply is the binding constraint, which lever belongs first on the list?',
    options: ['Zoning and permitting reform', 'An export marketing campaign', 'Lower parking fees'],
    answer: 0,
    feedback: 'A supply constraint is loosened on the supply side — zoning, permitting and construction capacity come first.',
  },
  {
    q: 'A good lever targets…',
    options: ['the binding constraint the diagnosis found', 'everything at once', 'whatever peer cities did'],
    answer: 0,
    feedback: 'The diagnosis exists to aim the response: one binding constraint, one lever aimed at it, then re-measure.',
  },
]

function Page() {
  const { index, national, metro, summary, placeId, cityName, metroName } = useToolState()

  const path = useMemo(() => diagnosisPath(summary, metro, index), [summary, metro, index])
  const evidence = useMemo(() => evidenceOf(summary, metro, index, national), [summary, metro, index, national])
  const opportunities = useMemo(() => opportunitiesFor(metro, national), [metro, national])
  const eci = useMemo(() => latestComplexity(metro, index.counts.withComplexity), [metro, index])
  const coi = useMemo(() => latestOutlook(metro), [metro])
  const traded = useMemo(() => tradedShare(metro, national), [metro, national])

  const stats: StatItem[] = [
    {
      icon: <Layers />,
      label: eci ? `Economic complexity (ECI), ${eci.year}` : 'Economic complexity (ECI)',
      value: eci ? `${fixed(eci.eci, 2)} · rank ${eci.rank ?? '—'} of ${eci.of}` : '—',
      title: 'How much diverse, hard-to-copy know-how the metro’s industries embody',
    },
    {
      icon: <Compass />,
      label: coi ? `Complexity outlook (COI), ${coi.year}` : 'Complexity outlook (COI)',
      value: coi ? `${fixed(coi.coi, 2)} · rank ${coi.rank} of ${index.metros.length}` : '—',
      title: 'How close the metro’s know-how sits to complex industries it does not yet have',
    },
    {
      icon: <Globe />,
      label: traded ? `Traded share of jobs, ${traded.year}` : 'Traded share of jobs',
      value: traded ? fmtPct(traded.share * 100, 1) : '—',
      title: 'Jobs in industries whose output leaves the region',
    },
  ]

  const questions = useMemo<CheckQuestion[]>(() => {
    const top = opportunities.slice(0, 4)
    if (top.length < 2) return SPEC_QUESTIONS
    const options = rotate(top, summary.id)
    const first = top[0]
    return [
      ...SPEC_QUESTIONS,
      {
        q: `Weighing relatedness against complexity, which absent industry tops ${metroName}’s metro opportunity list?`,
        options: options.map((o) => o.name),
        answer: options.findIndex((o) => o.code === first.code),
        feedback: `${first.name} combines a relatedness density of ${fixed(first.density, 2)} with a PCI of ${fixed(first.pci, 2)} — the top of the list in the chart above.`,
      },
    ]
  }, [opportunities, summary.id, metroName])


  return (
    <SectionPage section="levers" variant="plain">
      <Beat
        id="b1"
        section="levers"
        n={1}
        of={OF}
        title="What the diagnosis points at"
        badge="metro"
        lede={
          <>
            The diagnosis narrows the search. A <b>supply-side</b> reading points at housing and the cost of living, or at what living here is
            like; a <b>demand-side</b> reading points at the industries the metro already has and the ones it could grow into.
            {path.side && (
              <>
                {' '}
                For the {metroName} metro the evidence walks to <b>{path.endName.toLowerCase()}</b>
                {path.candidates.length ? `, with ${path.candidates.length === 1 ? 'one suspect' : 'the next fork'} still open below it` : ''}.
              </>
            )}
          </>
        }
        className="mb-16"
      >
        <div className="mt-6">
          <LeverTree path={path} metroName={metroName} />
        </div>
        <p className="mt-3 text-sm text-ink">
          <span className="font-semibold">The walk the evidence takes:</span> {path.lit.map((id) => NODE_NAME[id]).join(' → ')}
          {path.candidates.length > 0 && (
            <span className="text-ink-soft">
              {' '}
              · still open: {path.candidates.map((id) => NODE_NAME[id].toLowerCase()).join(' or ')}
            </span>
          )}
          .{path.leans && <span className="text-ink-soft"> {path.leans}</span>}
        </p>
        <EvidenceList items={evidence} side={path.side} className="mt-5" />
      </Beat>

      <Beat
        id="b2"
        section="levers"
        n={2}
        of={OF}
        title="What the metro could grow into"
        badge="metro"
        lede={
          <>
            Complexity is what a metro knows how to do; the industry space is where that know-how could reach next. Each dot below is an
            industry the {metroName} metro does not yet have, placed by how related it is to what the metro already does and by how complex it
            is. The nearest, most complex ones are where new activities are likeliest to take root.
          </>
        }
        className="mb-16"
      >
        <StatRow items={stats} />
        <OpportunityChart opportunities={opportunities} metroName={metroName} />
        <OpportunityTable opportunities={opportunities} className="mt-5" />
        <Explainer title="What is relatedness density?" skin="boxed" className="mt-5">
          <p>
            Two industries are related when metros that have one tend to have the other. For an industry <i>j</i> the metro does not have,
            density is the share of its related industries that are already here: density(c, j) = Σ<sub>i</sub> M(c, i)·φ(i, j) / Σ<sub>i</sub>{' '}
            φ(i, j), where M says whether the metro <i>c</i> has industry <i>i</i> (RCA ≥ 1) and φ is the proximity between industries.
          </p>
          <p>
            The complexity outlook (COI) sums density × PCI over all the absent industries: a metro with a high outlook sits close to many
            complex activities it does not yet do.
          </p>
        </Explainer>
      </Beat>

      <Beat
        id="b3"
        section="levers"
        n={3}
        of={OF}
        title="The evidence board"
        badge="metro"
        lede={
          <>
            The other things the atlas measures about the {metroName} metro and about {cityName} itself, each set against the typical metro
            where a median exists. None of them is a verdict on its own; they are the checks a lever has to survive.
          </>
        }
        className="mb-16"
      >
        <div className="mt-6">
          <EvidenceBoard metro={metro} national={national} />
        </div>
        <h3 className="mt-8 text-title font-semibold text-ink">Inside {cityName}</h3>
        <p className="mt-1 mb-4 text-sm text-ink-soft">The admin city on its own, where the atlas reads it: schooling, crime and air against the nation, the jobs within reach, and what it offers per resident.</p>
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-[10px]" />}>
          <CityBoard placeId={placeId} />
        </Suspense>
        <h3 className="mt-8 text-title font-semibold text-ink">Where the metro’s ideas concentrate</h3>
        <p className="mt-1 mb-4 text-sm text-ink-soft">Patents and research publications, 2020–2024, as revealed comparative advantage.</p>
        <InnovationLists metro={metro} national={national} />
      </Beat>

      <Checkpoint
        section="levers"
        questions={questions}
        applyPrompt="Name one lever you would explore first for your city, and the evidence you would need before backing it."
        applyPlaceholder="I would start with… because…"
      />
    </SectionPage>
  )
}
