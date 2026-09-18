/* "Understand the diagnostic hypothesis": two dials read against the
   typical city, the verdict they imply, and the small draggable plane.
   Either input drives the other. The dials open on the home metro's own
   quarter, so the reader starts where the scatter will put them. */
import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Quadrant } from '@/data/types'
import { QUADRANTS } from '@/lib/quadrants'
import { cn } from '@/lib/utils'
import { DxChart } from './dx-chart'

type Dir = 'up' | 'down'
interface DxState {
  pop: Dir | null
  pay: Dir | null
  /** set by a drag; null while the dials place the dot */
  dot: [number, number] | null
}

const quadrantOf = (pop: Dir | null, pay: Dir | null): Quadrant | null =>
  !pop || !pay ? null : pay === 'up' ? (pop === 'up' ? 'demand_positive' : 'supply_negative') : pop === 'up' ? 'supply_positive' : 'demand_negative'

const STEP = 'rounded-[4px] border border-line bg-white px-[15px] py-[13px]'
const HEAD = 'mb-2.5 text-[15px] font-semibold text-ink'
const OPT =
  'h-auto flex-1 rounded-[4px] border border-line-strong bg-white px-2.5 py-[7px] text-[13px] font-normal text-ink hover:border-teal hover:bg-white data-[state=on]:border-teal data-[state=on]:bg-teal data-[state=on]:text-white'

function Dial({ name, value, up, down, onChange }: { name: string; value: Dir | null; up: string; down: string; onChange: (v: Dir | null) => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="w-[78px] shrink-0 text-sm text-ink">{name}</span>
      <ToggleGroup
        type="single"
        value={value ?? ''}
        onValueChange={(v) => onChange(v === 'up' || v === 'down' ? v : null)}
        aria-label={name}
        className="flex-1 gap-2 rounded-none"
      >
        <ToggleGroupItem value="up" className={OPT}>
          ▲ {up}
        </ToggleGroupItem>
        <ToggleGroupItem value="down" className={OPT}>
          ▼ {down}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

export function DxExplainer({ initial }: { initial: Quadrant | null }) {
  const [state, setState] = useState<DxState>(() => ({
    pop: initial ? QUADRANTS[initial].pop : null,
    pay: initial ? QUADRANTS[initial].pay : null,
    dot: null,
  }))
  const q = quadrantOf(state.pop, state.pay)

  return (
    <>
      <p>
        Every diagnosis starts with two questions, each read against the typical city: are people arriving or leaving, and is pay rising or falling? The answers
        drop the city into one of four quarters, and each quarter points at a different cause.
      </p>
      <div className="mt-4 grid grid-cols-[1fr_340px] items-start gap-[34px] max-narrow:grid-cols-1 max-narrow:gap-4">
        <div>
          <div className={STEP}>
            <h5 className={HEAD}>1 · Read the two dials, against the typical city</h5>
            <Dial name="People" value={state.pop} up="arriving" down="leaving" onChange={(pop) => setState((s) => ({ ...s, pop, dot: null }))} />
            <Dial name="Paychecks" value={state.pay} up="rising" down="falling" onChange={(pay) => setState((s) => ({ ...s, pay, dot: null }))} />
          </div>
          <div className={cn(STEP, 'mt-3')} aria-live="polite">
            <h5 className={HEAD}>2 · What that tells you</h5>
            {q ? (
              <>
                <strong className="mb-1.5 block text-base font-semibold text-ink">{QUADRANTS[q].shock}</strong>
                <p className="text-sm leading-[1.55] text-ink">{QUADRANTS[q].explainer}</p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">Set both dials, or drag the dot on the chart.</p>
            )}
          </div>
        </div>
        <div className={cn(STEP, 'px-3.5 pt-3.5 pb-3')}>
          <DxChart quadrant={q} dot={state.dot} onDrag={(dot, quadrant) => setState({ pop: QUADRANTS[quadrant].pop, pay: QUADRANTS[quadrant].pay, dot })} />
          <p className="mt-[9px] text-xs leading-[1.5] text-ink-soft">
            The colours are the four quarters and the dashed crosshair is the typical city. Drag the dot, or set the dials.
          </p>
        </div>
      </div>
    </>
  )
}
