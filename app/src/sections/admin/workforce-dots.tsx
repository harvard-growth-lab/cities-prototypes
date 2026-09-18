/* The two workforces as dots (design-spec §3.3, opt-1 beats 1–4). One dot
   is `unit` jobs. State 0: every job inside the city ring. State 1: the
   jobs held by commuters travel to the metro ring and turn teal. State 2:
   residents' jobs outside the line leave in orange. State 3: the rings go
   and the dots sort into three rows, which read as the two counts. */
import { useMemo } from 'react'
import { ChartFrame } from '@/components/charts/chart-frame'
import { fmtCompact, fmtInt, fmtPct } from '@/lib/format'
import { ADMIN, CHROME } from '@/lib/palette'
import { useIsPhone, useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { shortName, type CommuteRead, type DotPlan } from './commute'

export type DotsState = 0 | 1 | 2 | 3

const W = 880
const H = 552
const CITY = { cx: 232, cy: 250, r: 148 }
const METRO = { cx: 620, cy: 250, r: 192 }
const ROW = { x0: 240, perLine: 44, pitch: 12, y: { in: 96, both: 268, out: 400 } } as const
const DOT_R = 3.6
/** the sum lines: under the last possible row (nine lines from 400) */
const SUM_Y = 514
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const DURATION = 1100

// in-SVG type steps up as the panel narrows (design-spec §5)
const CAPTION = 'text-[13px] max-[1200px]:text-[15px] max-sm:text-[20px]'
const LABEL = 'text-[12px] max-[1200px]:text-[14px] max-sm:text-[17px]'

type Group = 'both' | 'in' | 'out'
interface Pt {
  x: number
  y: number
}

/** Vogel's spiral: n points evenly filling a disc of radius R. */
function spiral(n: number, cx: number, cy: number, R: number): Pt[] {
  const c = (R - 9) / Math.sqrt(Math.max(n, 1))
  return Array.from({ length: n }, (_, i) => {
    const r = c * Math.sqrt(i + 0.5)
    const t = i * GOLDEN
    return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }
  })
}

const rowPt = (y0: number, i: number): Pt => ({
  x: ROW.x0 + (i % ROW.perLine) * ROW.pitch,
  y: y0 + Math.floor(i / ROW.perLine) * ROW.pitch,
})

const pct = (v: number | null) => fmtPct(v === null ? null : v * 100, 0)

export interface WorkforceDotsProps {
  state: DotsState
  read: CommuteRead
  plan: DotPlan
  cityName: string
  className?: string
}

export function WorkforceDots({ state, read, plan, cityName, className }: WorkforceDotsProps) {
  const reduced = useReducedMotion()
  const phone = useIsPhone()
  const city = shortName(cityName)

  // Layouts are fixed per plan; the state only picks which one each dot sits in.
  const layout = useMemo(() => {
    const cityJobs = spiral(plan.both + plan.in, CITY.cx, CITY.cy, CITY.r)
    const cityRes = spiral(plan.both + plan.out, CITY.cx, CITY.cy, CITY.r)
    // in the metro ring, the in-commuters cluster on the side facing the city
    const metro = spiral(plan.in + plan.out, METRO.cx, METRO.cy, METRO.r).sort((a, b) => a.x - b.x)
    return {
      both: { home: cityJobs.slice(0, plan.both) },
      in: { home: cityJobs.slice(plan.both), away: metro.slice(0, plan.in) },
      out: { home: cityRes.slice(plan.both), away: metro.slice(plan.in) },
    }
  }, [plan])

  const posOf = (group: Group, i: number): Pt => {
    if (state === 3) return rowPt(ROW.y[group], i)
    if (group === 'both') return layout.both.home[i]
    if (group === 'in') return state >= 1 ? layout.in.away[i] : layout.in.home[i]
    return state >= 2 ? layout.out.away[i] : layout.out.home[i]
  }
  const fillOf = (group: Group) => (group === 'both' ? ADMIN.both : group === 'in' ? (state >= 1 ? ADMIN.jobsHere : ADMIN.both) : ADMIN.residents)

  const groups: { group: Group; n: number }[] = [
    { group: 'both', n: plan.both },
    { group: 'in', n: plan.in },
    { group: 'out', n: plan.out },
  ]

  const ringsOn = state < 3
  const fade = reduced ? undefined : 'opacity 350ms ease'
  const label = useMemo(() => describe(state, read, plan, cityName), [state, read, plan, cityName])

  return (
    <ChartFrame width={W} height={H} role="img" aria-label={label} className={cn('max-narrow:max-h-[34dvh]', className)}>
      {/* the rings */}
      <g style={{ opacity: ringsOn ? 1 : 0, transition: fade }}>
        <circle cx={CITY.cx} cy={CITY.cy} r={CITY.r} fill="none" stroke={CHROME.lineStrong} strokeWidth={1.2} />
        <text x={CITY.cx} y={CITY.cy - CITY.r - 12} textAnchor="middle" fill={CHROME.inkSoft} fontWeight={700} letterSpacing={1.4} className={LABEL}>
          {city.toUpperCase()}
        </text>
        <g style={{ opacity: state >= 1 ? 1 : 0, transition: fade }}>
          <circle cx={METRO.cx} cy={METRO.cy} r={METRO.r} fill="none" stroke={CHROME.geoMetro} strokeWidth={1.2} strokeDasharray="6 5" />
          <text x={METRO.cx} y={METRO.cy - METRO.r - 12} textAnchor="middle" fill={CHROME.geoMetro} fontWeight={700} letterSpacing={1.2} className={LABEL}>
            IN THE METRO, OUTSIDE {city.toUpperCase()}
          </text>
        </g>
      </g>

      {/* the dots */}
      {groups.map(({ group, n }) =>
        Array.from({ length: n }, (_, i) => {
          const p = posOf(group, i)
          const hidden = group === 'out' && state < 2
          const delay = reduced ? 0 : (i / Math.max(n, 1)) * DURATION * 0.25
          return (
            <circle
              key={`${group}${i}`}
              r={DOT_R}
              style={{
                transform: `translate(${p.x}px, ${p.y}px)`,
                fill: fillOf(group),
                opacity: hidden ? 0 : 1,
                transition: reduced
                  ? 'none'
                  : `transform ${DURATION}ms cubic-bezier(.25,.8,.3,1) ${delay}ms, fill 500ms ease ${delay}ms, opacity 500ms ease ${delay}ms`,
              }}
            />
          )
        }),
      )}

      {/* captions */}
      {state === 0 && (
        <Caption x={CITY.cx} y={CITY.cy + CITY.r + 24} lines={[[fmtCompact(read.jobsHere), ' jobs'], ['', `one dot is about ${fmtInt(plan.unit)}`]]} />
      )}
      {state === 1 && (
        <>
          <Caption x={CITY.cx} y={CITY.cy + CITY.r + 24} lines={[[fmtCompact(read.liveWorkHere), ' live & work here'], ['', `${pct(read.bothShareJobs)} of the jobs`]]} />
          <Caption x={METRO.cx} y={METRO.cy + METRO.r + 24} color={ADMIN.jobsHere} lines={[[fmtCompact(read.inCommuters), ' commute in'], ['', `${pct(read.inShare)} of the city’s jobs`]]} />
        </>
      )}
      {state === 2 && (
        <>
          <Caption x={CITY.cx} y={CITY.cy + CITY.r + 24} lines={[[fmtCompact(read.liveWorkHere), ' live & work here'], ['', `${pct(read.bothShareRes)} of residents’ jobs`]]} />
          {phone ? (
            // the phone's bottom-right corner is under the shell's floating button: counts only, stacked left of it
            <>
              <Caption x={METRO.cx - 40} y={METRO.cy + METRO.r + 24} color={ADMIN.jobsHere} lines={[[fmtCompact(read.inCommuters), ' commute in']]} />
              <Caption x={METRO.cx - 40} y={METRO.cy + METRO.r + 50} color={ADMIN.residents} lines={[[fmtCompact(read.outCommuters), ' commute out']]} />
            </>
          ) : (
            <>
              <Caption x={METRO.cx - 105} y={METRO.cy + METRO.r + 24} color={ADMIN.jobsHere} lines={[[fmtCompact(read.inCommuters), ' commute in'], ['', `${pct(read.inShare)} of jobs here`]]} />
              <Caption x={METRO.cx + 105} y={METRO.cy + METRO.r + 24} color={ADMIN.residents} lines={[[fmtCompact(read.outCommuters), ' commute out'], ['', `${pct(read.outShare)} of residents’ jobs`]]} />
            </>
          )}
        </>
      )}
      {state === 3 && (
        <>
          <Caption x={ROW.x0 - 14} y={ROW.y.in + 4} anchor="end" color={ADMIN.jobsHere} lines={[[fmtCompact(read.inCommuters), ' commute in'], ['', `${pct(read.inShare)} of jobs here`]]} />
          <Caption x={ROW.x0 - 14} y={ROW.y.both + 4} anchor="end" color={CHROME.inkSoft} lines={[[fmtCompact(read.liveWorkHere), ' live & work here'], ['', `${pct(read.bothShareJobs)} of jobs here`], ['', `${pct(read.bothShareRes)} of residents’ jobs`]]} />
          <Caption x={ROW.x0 - 14} y={ROW.y.out + 4} anchor="end" color={ADMIN.residents} lines={[[fmtCompact(read.outCommuters), ' commute out'], ['', `${pct(read.outShare)} of residents’ jobs`]]} />
          {/* the two counts, read off the rows; stacked where the phone's larger type needs the width */}
          <Sum x={ROW.x0} y={SUM_Y} a={ADMIN.jobsHere} b={ADMIN.both} value={fmtInt(read.jobsHere)} label="jobs located here" />
          <Sum x={phone ? ROW.x0 : ROW.x0 + 276} y={phone ? SUM_Y + 26 : SUM_Y} a={ADMIN.both} b={ADMIN.residents} value={fmtInt(read.residentWorkers)} label="jobs held by residents" />
        </>
      )}
    </ChartFrame>
  )
}

/** "● + ● = 718,571 jobs located here": a count read off two rows of dots. */
function Sum({ x, y, a, b, value, label }: { x: number; y: number; a: string; b: string; value: string; label: string }) {
  return (
    <g className={CAPTION}>
      <circle cx={x} cy={y} r={DOT_R} fill={a} />
      <text x={x + 10} y={y} dy="0.35em" fill={CHROME.inkSoft}>
        +
      </text>
      <circle cx={x + 24} cy={y} r={DOT_R} fill={b} />
      <text x={x + 34} y={y} dy="0.35em" fill={CHROME.ink}>
        <tspan fill={CHROME.inkSoft}>= </tspan>
        <tspan fontWeight={700}>{value}</tspan> {label}
      </text>
    </g>
  )
}

/** Two lines: a bold number with its label, then the share underneath. */
function Caption({ x, y, lines, anchor = 'middle', color = CHROME.ink }: { x: number; y: number; lines: [string, string][]; anchor?: 'middle' | 'end'; color?: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={color} className={CAPTION}>
      {lines.map(([bold, rest], i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : '1.3em'}>
          {bold && <tspan fontWeight={700}>{bold}</tspan>}
          {rest}
        </tspan>
      ))}
    </text>
  )
}

function describe(state: DotsState, r: CommuteRead, plan: DotPlan, city: string) {
  const unit = `one dot is about ${fmtInt(plan.unit)} jobs`
  switch (state) {
    case 0:
      return `${fmtInt(r.jobsHere)} jobs located in ${city}, drawn as dots inside the city; ${unit}.`
    case 1:
      return `Of the jobs in ${city}, ${fmtInt(r.inCommuters)} (${pct(r.inShare)}) are held by people who commute in from the metro and ${fmtInt(r.liveWorkHere)} by residents; ${unit}.`
    case 2:
      return `${fmtInt(r.inCommuters)} commute into ${city} and ${fmtInt(r.outCommuters)} residents (${pct(r.outShare)} of residents’ jobs) commute out; ${unit}.`
    default:
      return `Three rows of dots: ${fmtInt(r.inCommuters)} commute in, ${fmtInt(r.liveWorkHere)} live and work in ${city}, ${fmtInt(r.outCommuters)} commute out; ${unit}.`
  }
}
