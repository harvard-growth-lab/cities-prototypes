/* My Learning Journey (design-spec §2.3, option 1 — the index): the cities
   explored, every section and beat with what has been read, and the notes
   the reader saved. Anything in the list is a link into the tool. */
import { useNavigate } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { MetroSummary } from '@/data/types'
import { isVisited, sectionStatus, useJourney, type Insight, type SectionStatus } from '@/lib/journey'
import { SECTIONS, sectionBySlug, sectionPath, type SectionSlug } from '@/lib/sections'
import { cn } from '@/lib/utils'
import { JourneyIcon } from './icons'

export interface JourneyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** the metro the index links into */
  metro: MetroSummary
  /** every metro, to name the ones explored */
  metros: MetroSummary[]
  /** carried into the links so the admin city stays chosen */
  place?: string
  /** the section on screen, lifted in the index */
  current?: SectionSlug
}

const STATUS: Record<SectionStatus, { label: string; cls: string }> = {
  completed: { label: 'Completed', cls: 'text-[#2e7d33] font-semibold' },
  'in-progress': { label: 'In progress', cls: 'text-orange-dark font-semibold' },
  'not-started': { label: 'Not started', cls: 'text-ink-soft' },
}

function download(notes: Insight[]) {
  const text = notes
    .map((n) => `${sectionBySlug(n.section)?.name ?? n.section} · ${n.city} · ${new Date(n.at).toLocaleDateString()}\n${n.text}\n`)
    .join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'my-insights-notes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

export function JourneyDialog({ open, onOpenChange, metro, metros, place, current }: JourneyDialogProps) {
  const j = useJourney()
  const navigate = useNavigate()
  const explored = j.exploredMetros.map((id) => metros.find((m) => m.id === id)).filter((m) => m !== undefined)

  // navigating drops ?journey from the search, which is what closes the dialog
  const go = (slug: SectionSlug, beat?: string) =>
    navigate({ to: sectionPath(slug), params: { slug: metro.slug }, hash: beat, search: place ? { place } : {} })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(760px,calc(100dvh-48px))] w-[860px] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-[14px] p-0 shadow-[0_24px_70px_rgba(15,35,40,.35)] sm:max-w-[860px] max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
      >
        <div className="flex items-start gap-4 border-b border-line px-8 pt-[26px] pb-[22px] max-narrow:px-5 max-narrow:pt-5 max-narrow:pb-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-teal-tint text-teal max-narrow:hidden">
            <JourneyIcon width={22} height={22} />
          </span>
          <div className="min-w-0 pr-8">
            <DialogTitle className="text-[22px] font-semibold text-ink max-narrow:text-[19px]">My Learning Journey</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-ink-soft">
              The index of the diagnosis — every section and step, with what you've read, <b className="font-semibold text-ink">answered</b> and{' '}
              <b className="font-semibold text-ink">saved</b>. Click anything to go there.
            </DialogDescription>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-6 pb-8 max-narrow:px-5 max-narrow:pt-4">
          <section>
            <h3 className="text-xs font-bold tracking-[1.5px] text-ink-soft uppercase">Cities explored</h3>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {explored.length === 0 && <span className="text-sm text-ink-soft">No cities explored yet</span>}
              {explored.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate({ to: sectionPath('fundamentals'), params: { slug: m.slug }, search: {} })}
                  className={cn(
                    'rounded-full bg-teal-tint px-3 py-1 text-[13px] font-semibold text-teal hover:bg-[#e2ebec]',
                    m.id === metro.id && 'ring-1 ring-teal',
                  )}
                >
                  {m.displayName}
                </button>
              ))}
            </div>
          </section>

          <ol className="relative mt-7 before:absolute before:top-3 before:bottom-3 before:left-[19px] before:w-0.5 before:bg-[#e2ece3] before:content-['']">
            {SECTIONS.map((s) => {
              const status = sectionStatus(j, metro.id, s.slug)
              const here = s.slug === current
              return (
                <li key={s.slug} className="relative mb-4">
                  <button
                    type="button"
                    onClick={() => go(s.slug)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-[10px] px-0 py-1.5 text-left hover:bg-[#fbfcfc]',
                      here && 'bg-[#fdf4ef] ring-[1.5px] ring-orange ring-inset',
                    )}
                  >
                    <span
                      className={cn(
                        'nums flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-sm font-bold text-ink',
                        status === 'completed' && 'border-transparent bg-[#e7efe7] text-[#2e7d33]',
                        here && 'border-transparent bg-orange text-white',
                      )}
                    >
                      {String(s.n).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold text-ink">{s.name}</span>
                      <span className={cn('block text-[13px]', STATUS[status].cls)}>{STATUS[status].label}</span>
                    </span>
                  </button>
                  <ul className="mt-1.5 ml-[58px] flex flex-col gap-0.5">
                    {s.beats.map((b) => {
                      const done = isVisited(j, metro.id, s.slug, b.id)
                      const glyph = b.id === 'check' ? '?' : b.id === 'apply' ? '✎' : ''
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => go(s.slug, b.id)}
                            className={cn('flex items-center gap-2.5 py-0.5 text-left text-[13.5px] text-ink-soft hover:text-teal', done && 'text-ink')}
                          >
                            <span
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong text-[9px] font-bold',
                                done && 'border-teal bg-teal text-white',
                              )}
                            >
                              {glyph}
                            </span>
                            <span>{b.label}</span>
                            {done && <span className="text-xs font-bold text-[#2e7d33]">✓</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ol>

          <section className="mt-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold tracking-[1.5px] text-ink-soft uppercase">My saved insights/notes</h3>
              {j.insights.length > 0 && (
                <button
                  type="button"
                  onClick={() => download(j.insights)}
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold text-teal hover:border-teal"
                >
                  <Download className="size-3.5" /> Download
                </button>
              )}
            </div>
            {j.insights.length === 0 ? (
              <p className="mt-2.5 text-sm text-ink-soft">
                Nothing saved yet. When you save a response in “Put your insights”, it will be collected here.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5">
                {j.insights.map((n, k) => (
                  <li key={k} className="rounded-xl bg-teal-tint px-4 py-3">
                    <p className="text-[13px] font-semibold text-teal">
                      {sectionBySlug(n.section)?.name ?? n.section} · Put your insights — {n.city}
                    </p>
                    <p className="mt-1 text-[14.5px] leading-6 whitespace-pre-wrap text-ink">{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
