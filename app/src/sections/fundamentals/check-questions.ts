/* The section's three questions (design-spec §3.1 checkpoint), with the
   share, the rates and the verdict computed from the atlas so they hold
   for any metro. Pure; no React. */
import type { CheckQuestion } from '@/components/beats/checkpoint'
import { fmtRate } from '@/lib/format'

export interface CheckInputs {
  cityName: string
  metroName: string
  /** the admin place's share of the metro's population, or null */
  share: number | null
  popCagr: number | null
  nationalPopCagr: number
  windowStart: number
}

/** "About 15%" (the share to the nearest 5%) among distractors at least 20 points away. */
function shareQuestion({ cityName, metroName, share }: CheckInputs): CheckQuestion | null {
  if (share === null || !Number.isFinite(share)) return null
  const pct = Math.max(5, Math.min(95, Math.round((share * 100) / 5) * 5))
  const wording = (v: number) => (v >= 95 ? 'Nearly all of them' : v === 50 ? 'About half' : v === 25 ? 'About a quarter' : `About ${v}%`)
  const distractors = [50, 95, 10, 25].filter((v) => Math.abs(v - pct) >= 20).slice(0, 2)
  const options = [...distractors.map((v) => ({ v, correct: false })), { v: pct, correct: true }].sort((a, b) => a.v - b.v)
  return {
    q: `Roughly what share of the ${metroName} metro’s residents live in ${cityName} proper?`,
    options: options.map((o) => wording(o.v)),
    answer: options.findIndex((o) => o.correct),
    feedback: `Around ${Math.round(share * 100)}% — the administrative city is one piece of a much larger labor market, which is why most of the diagnosis reads at the metro scale.`,
  }
}

const geoQuestion: CheckQuestion = {
  q: 'Which geography does most of the diagnosis read at?',
  options: ['The administrative city', 'The metro — the whole labor market', 'The state'],
  answer: 1,
  feedback: 'The metro: people commute, firms hire and housing responds across the whole labor market, so that is the scale most measures read at.',
}

/** Shrunk, grown slower than the country, in step with it (the two rates print the same), or faster. */
type Verdict = 'shrunk' | 'slow' | 'same' | 'fast'

function growthQuestion({ cityName, popCagr, nationalPopCagr, windowStart }: CheckInputs): CheckQuestion | null {
  if (popCagr === null || !Number.isFinite(popCagr)) return null
  const rate = fmtRate(popCagr).replace('/yr', '')
  const nat = fmtRate(nationalPopCagr).replace('/yr', '')
  const verdict: Verdict = popCagr < 0 ? 'shrunk' : rate === nat ? 'same' : popCagr >= nationalPopCagr ? 'fast' : 'slow'
  const about = `about ${rate} a year`
  const options: [Verdict, string][] = [
    ['slow', verdict === 'slow' ? `Grown slowly, ${about}` : 'Grown slowly, slower than the country'],
    verdict === 'same' ? ['same', `Grown in step with the country, ${about}`] : ['fast', verdict === 'fast' ? `Grown quickly, ${about}` : 'Grown quickly, faster than the country'],
    ['shrunk', verdict === 'shrunk' ? `Shrunk, ${about}` : 'Shrunk'],
  ]
  const feedback: Record<Verdict, string> = {
    shrunk: `It has shrunk ${about} since ${windowStart} while the country grew ${nat} — residents voting with their feet is the clearest signal there is.`,
    slow: `It has grown ${about} since ${windowStart}, under the national ${nat} — the clearest signal that something is holding the city back.`,
    same: `It has grown ${about} since ${windowStart}, in step with the national ${nat} — neither pulling ahead of the typical metro nor falling behind it.`,
    fast: `It has grown ${about} since ${windowStart}, ahead of the national ${nat} — people are arriving faster than in the typical metro.`,
  }
  return {
    q: `What has ${cityName} proper’s population done since ${windowStart}?`,
    options: options.map(([, text]) => text),
    answer: options.findIndex(([v]) => v === verdict),
    feedback: feedback[verdict],
  }
}

export function buildCheckQuestions(inputs: CheckInputs): CheckQuestion[] {
  return [shareQuestion(inputs), geoQuestion, growthQuestion(inputs)].filter((q): q is CheckQuestion => q !== null)
}

export const APPLY_PROMPT = 'What single fact about how your city is doing would you flag for a colleague — and what would you want to check next?'
export const APPLY_PLACEHOLDER = 'The population trend surprised me because…'
