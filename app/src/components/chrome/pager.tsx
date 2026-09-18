/* The foot of every section: back, forward, and the five-stop line that
   says where the reader is in the argument. Every stop and button is a
   push navigation to a section route. */
import { Link } from '@tanstack/react-router'
import { SECTIONS, sectionPath, type Section } from '@/lib/sections'
import { useActiveSection, useToolState } from '@/lib/use-tool-state'
import { cn } from '@/lib/utils'
import { CheckMark } from './icons'

const BTN =
  'inline-flex items-center gap-1 rounded-[4px] border border-teal bg-white px-[18px] py-2.5 text-sm font-semibold whitespace-nowrap text-teal transition-colors hover:bg-teal hover:text-white max-sm:px-3.5'

function Stop({ s, state, slug }: { s: Section; state: 'past' | 'current' | 'ahead'; slug: string }) {
  return (
    <Link
      to={sectionPath(s.slug)}
      params={{ slug }}
      search={true}
      title={s.name}
      aria-current={state === 'current' ? 'page' : undefined}
      className={cn(
        'inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-white text-[10.5px] font-bold text-ink-soft transition-[transform,border-color,color] duration-150 hover:scale-[1.15] hover:border-teal hover:text-teal',
        state === 'past' && 'border-teal bg-teal text-white',
        state === 'current' && 'scale-[1.3] border-teal text-teal shadow-[0_0_0_4px_rgba(37,88,98,.12)] hover:scale-[1.3]',
      )}
    >
      {state === 'past' ? <CheckMark /> : s.n}
    </Link>
  )
}

export function Pager({ variant = 'plain' }: { variant?: 'plain' | 'wide' }) {
  const { summary } = useToolState()
  const active = useActiveSection()
  const i = SECTIONS.findIndex((s) => s.slug === active.slug)
  const prev = SECTIONS[i - 1]
  const next = SECTIONS[i + 1]

  return (
    <footer
      className={cn(
        'mx-auto w-full pt-[26px] pb-[34px] max-[1200px]:px-10 max-narrow:px-7 max-sm:px-3.5 max-sm:pt-[18px] max-sm:pb-6',
        variant === 'wide' ? 'max-w-grid px-frame' : 'max-w-[976px] px-12',
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3.5 max-narrow:grid-cols-2 max-narrow:gap-y-5">
        <div className="flex justify-start max-narrow:order-2">
          {prev && (
            <Link to={sectionPath(prev.slug)} params={{ slug: summary.slug }} search={true} className={BTN}>
              ← <span className="max-sm:hidden">{prev.name}</span>
              <span className="sm:hidden">{prev.short}</span>
            </Link>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 max-narrow:order-1 max-narrow:col-span-2">
          <div className="flex items-center">
            {SECTIONS.map((s, k) => (
              <span key={s.slug} className="flex items-center">
                {k > 0 && <span className={cn('h-0.5 w-[26px] bg-[#dde3e5] max-sm:w-3.5', k <= i && 'bg-teal')} />}
                <Stop s={s} slug={summary.slug} state={k < i ? 'past' : k === i ? 'current' : 'ahead'} />
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-soft">
            <b className="font-semibold text-ink">{active.name}</b> · {active.n} of {SECTIONS.length} ·{' '}
            {next ? `next: ${next.name}` : 'the end of the line'}
          </p>
        </div>
        <div className="flex justify-end max-narrow:order-3">
          {next && (
            <Link to={sectionPath(next.slug)} params={{ slug: summary.slug }} search={true} className={BTN}>
              <span className="max-sm:hidden">{next.name}</span>
              <span className="sm:hidden">{next.short}</span> →
            </Link>
          )}
        </div>
      </div>
    </footer>
  )
}
