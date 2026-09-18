/* The section's close (design-spec §2.4): "Test your knowledge" — a slide
   of questions with instant feedback — then "Put your insights", a note
   that goes to the Learning Journey. Answers and notes persist per metro. */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { answer, answerKey, saveInsight, useJourney } from '@/lib/journey'
import type { SectionSlug } from '@/lib/sections'
import { useReducedMotion } from '@/lib/use-media-query'
import { useToolState } from '@/lib/use-tool-state'
import { cn } from '@/lib/utils'

export interface CheckQuestion {
  q: string
  options: string[]
  /** index of the right option */
  answer: number
  /** shown after "Right. " / "Not quite. " */
  feedback: string
}

export interface CheckpointProps {
  section: SectionSlug
  questions: CheckQuestion[]
  applyPrompt: string
  applyPlaceholder?: string
  className?: string
}

const HEAD = 'flex items-center gap-2.5'
const DISC = 'flex size-[26px] shrink-0 items-center justify-center rounded-full bg-teal text-sm font-bold text-white'

export function Checkpoint({ section, questions, applyPrompt, applyPlaceholder, className }: CheckpointProps) {
  const { summary, cityName } = useToolState()
  const j = useJourney()
  const reduced = useReducedMotion()
  const answered = questions.map((_, i) => j.answered[answerKey(summary.id, section, i)])
  const nAnswered = answered.filter((a) => a !== undefined).length
  const firstOpen = answered.findIndex((a) => a === undefined)
  const [slide, setSlide] = useState(firstOpen === -1 ? 0 : firstOpen)

  // auto-advance to the next unanswered question 1.6s after an answer
  useEffect(() => {
    if (answered[slide] === undefined) return
    const next = answered.findIndex((a, i) => i > slide && a === undefined)
    if (next === -1) return
    const t = setTimeout(() => setSlide(next), 1600)
    return () => clearTimeout(t)
  }, [answered, slide])

  const saved = j.insights.find((n) => n.section === section && n.city === cityName)
  const [text, setText] = useState('')

  return (
    <div className={cn('mt-9 rounded-[10px] border border-line bg-[#f7f9f9]', className)}>
      <section id="check" data-beat="check" className="scroll-mt-chrome px-6 pt-5 pb-[22px] max-sm:px-3.5">
        <div className={HEAD}>
          <span className={DISC}>?</span>
          <h3 className="text-[16.5px] font-semibold text-ink">Test your knowledge</h3>
          <span className="nums ml-auto text-xs font-semibold text-ink-soft">
            {nAnswered} / {questions.length} answered
          </span>
        </div>
        <div className="mt-3 overflow-hidden">
          <div
            className={cn('flex', !reduced && 'transition-transform duration-300 ease-out')}
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {questions.map((q, qi) => {
              const picked = answered[qi]
              const done = picked !== undefined
              return (
                <div key={qi} className="min-w-0 flex-[0_0_100%] pr-1" aria-hidden={qi !== slide}>
                  <p className="mb-3 max-w-[78ch] text-[14.5px] text-ink">{q.q}</p>
                  <div className="flex max-w-[560px] flex-col gap-2">
                    {q.options.map((opt, oi) => {
                      const right = oi === q.answer
                      const wrongPick = done && picked === oi && !right
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={done || qi !== slide}
                          onClick={() => answer(summary.id, section, qi, oi)}
                          className={cn(
                            'rounded-md border border-line-strong bg-white px-3.5 py-2.5 text-left text-sm text-ink transition-colors enabled:hover:border-teal disabled:cursor-default',
                            done && right && 'border-rise shadow-[inset_0_0_0_1px_var(--color-rise)]',
                            wrongPick && 'border-fall bg-[#fdf3f5] shadow-[inset_0_0_0_1px_var(--color-fall)]',
                          )}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                  {done && (
                    <p className="mt-3 max-w-[72ch] text-[13.5px] text-ink" aria-live="polite">
                      <b className="font-semibold">{picked === q.answer ? 'Right. ' : 'Not quite. '}</b>
                      {q.feedback}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {questions.length > 1 && (
          <div className="mt-3.5 flex items-center gap-3">
            <button
              type="button"
              aria-label="Previous question"
              disabled={slide === 0}
              onClick={() => setSlide((s) => s - 1)}
              className="flex size-[30px] items-center justify-center rounded-full border border-line-strong bg-white text-teal enabled:hover:border-teal disabled:opacity-35"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex gap-[7px]">
              {questions.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Question ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={cn(
                    'size-[9px] rounded-full border-[1.5px] border-line-strong bg-white',
                    answered[i] !== undefined && 'border-teal bg-teal',
                    i === slide && 'border-teal shadow-[0_0_0_2.5px_rgba(37,88,98,.22)]',
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next question"
              disabled={slide === questions.length - 1}
              onClick={() => setSlide((s) => s + 1)}
              className="flex size-[30px] items-center justify-center rounded-full border border-line-strong bg-white text-teal enabled:hover:border-teal disabled:opacity-35"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </section>

      <section id="apply" data-beat="apply" className="scroll-mt-chrome rounded-b-[10px] border-t border-line bg-teal-tint px-6 pt-5 pb-[22px] max-sm:px-3.5">
        <div className={HEAD}>
          <span className={DISC}>✎</span>
          <h3 className="text-[16.5px] font-semibold text-ink">Put your insights</h3>
        </div>
        <p className="mt-2 mb-3 max-w-[78ch] text-[14.5px] text-ink">{applyPrompt}</p>
        <Textarea
          rows={4}
          value={saved ? saved.text : text}
          disabled={Boolean(saved)}
          onChange={(e) => setText(e.target.value)}
          placeholder={applyPlaceholder}
          className="max-w-[640px] rounded-md border-line-strong bg-white text-sm disabled:bg-white disabled:opacity-80 md:text-sm"
        />
        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            disabled={Boolean(saved)}
            onClick={() => {
              if (!text.trim()) return
              saveInsight({ section, city: cityName, text: text.trim() })
            }}
            className="rounded-[5px] bg-teal px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-teal-dark disabled:opacity-55"
          >
            Save to my journey
          </button>
          {saved && <span className="text-[13px] font-bold text-rise">Saved ✓</span>}
        </div>
      </section>
    </div>
  )
}
