/* The checkpoint: three questions about what this section showed for this
   metro, options and feedback computed from the same data. */
import type { CheckQuestion } from '@/components/beats/checkpoint'
import { fmtInt, fmtMult } from '@/lib/format'
import { pct0 } from './copy'
import type { IndustryData } from './use-industry-data'

export function buildQuestions(data: IndustryData, metroName: string): CheckQuestion[] {
  const traded = data.tiers.traded
  const tradedPct = Math.round(traded.share * 100)
  // distractors 25 and 50 points away, kept under 90% (traded shares run 4–50%)
  const offsets = tradedPct + 50 <= 90 ? [25, 50] : [-25, 25]
  const qs: CheckQuestion[] = []

  qs.push({
    q: `Roughly what share of the ${metroName} metro’s jobs is traded — sold mostly to customers outside the metro?`,
    options: [`About ${tradedPct + offsets[0]}%`, `About ${tradedPct}%`, `About ${tradedPct + offsets[1]}%`],
    answer: 1,
    feedback: `About ${tradedPct}% — ${fmtInt(Math.round(traded.jobs))} of the metro’s ${fmtInt(Math.round(data.total))} jobs sit in traded industries. The rest serve the people already here, in part or in whole.`,
  })

  const [top, second, third] = data.tradedSectors
  if (top) {
    const others = data.tradedSectors.slice(1, 3).map((s) => s.sector)
    const options = [...others, top.sector].sort()
    const trail = [second, third].filter((s) => s !== undefined).map((s) => `${s.sector} (${pct0(s.share)})`)
    qs.push({
      q: `Which sector holds the most traded jobs in the ${metroName} metro?`,
      options,
      answer: options.indexOf(top.sector),
      feedback: `${top.sector} — ${pct0(top.share)} of the metro’s traded jobs${trail.length ? `, ahead of ${trail.join(' and ')}` : ''}.`,
    })
  }

  const lead = data.ranking[0]
  qs.push({
    q: 'An industry with a concentration of 1.0× means…',
    options: ['the industry has the same share of jobs here as nationally', 'the industry has twice the national share of jobs', 'the industry employs exactly 1,000 people here'],
    answer: 0,
    feedback: `1.0× is exactly the national rate: the industry’s share of the metro’s jobs equals its share of the country’s.${lead ? ` ${lead.name} at ${fmtMult(lead.rca)} is ${lead.rca.toFixed(1)} times more concentrated here than nationally.` : ''}`,
  })

  return qs
}
