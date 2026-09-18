/* The three-up stat strip the first two beats share: a count, its change
   over the window (rise/fall), and the all-US-metros benchmark. */
import type { ReactNode } from 'react'
import type { StatItem } from '@/components/beats/stat-row'
import { TrendIcon } from '@/components/chrome/icons'
import { fmtRate } from '@/lib/format'
import { rateMark } from './series'

export const countStat = (icon: ReactNode, label: string, value: string): StatItem => ({ icon, label, value })

/** A rate as a stat: the arrow and the ink follow its sign; one that rounds to zero stays neutral. */
function rateStat(label: string, rate: number | null | undefined, title?: string): StatItem {
  const { tone } = rateMark(rate ?? null)
  return {
    icon: <TrendIcon dir={tone === 'fall' ? 'down' : 'up'} />,
    label,
    value: fmtRate(rate),
    tone: tone === 'flat' ? undefined : tone,
    title,
  }
}

/** "Change since 2014 · +0.2%/yr" */
export const changeStat = (since: number, rate: number | null | undefined) => rateStat(`Change since ${since}`, rate)

/** "U.S. benchmark · +0.8%/yr" — all US metros over the window */
export const benchmarkStat = (rate: number, window: [number, number]) => rateStat('U.S. benchmark', rate, `All US metros, ${window[0]}–${window[1]}`)
