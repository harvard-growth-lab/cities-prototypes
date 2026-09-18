/* The checkpoint's three questions, computed from the same numbers the
   beats show. The distractors sit near the real share so the reader has to
   have read the figure, not just the question. */
import type { CheckQuestion } from '@/components/beats/checkpoint'
import { fmtInt } from '@/lib/format'
import { fmtX, KIND_PHRASE, type CommuteRead, type PlaceRatio, type Verdict } from './commute'

const pctOf = (v: number | null) => Math.round((v ?? 0) * 100)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)))

/** Three "About N%" options around the real share, ascending; returns the
 *  options and the index of the real one. */
function shareOptions(real: number): { options: string[]; answer: number } {
  const alt1 = 100 - real
  const alt2 = real >= 50 ? Math.round(real / 2) : Math.min(95, real * 2)
  const set = [real]
  for (const c of [alt1, alt2, real + 20, real - 20, real + 35, real - 35]) {
    if (set.length === 3) break
    const v = Math.min(98, Math.max(2, c))
    if (set.every((s) => Math.abs(s - v) >= 8)) set.push(v)
  }
  set.sort((a, b) => a - b)
  return { options: set.map((s) => `About ${s}%`), answer: set.indexOf(real) }
}

export function adminQuestions(r: CommuteRead, city: string): CheckQuestion[] {
  const per100 = r.ratio === null ? 100 : Math.round(r.ratio * 100)
  const verdict = r.verdict ?? 'balanced'
  // every option carries a per-100 figure: the real one on the right answer,
  // and for the other two a figure that sits in that zone of the dial
  const figure = (v: Verdict) => {
    if (v === verdict) return per100
    if (v === 'balanced') return 100
    const mirror = 10_000 / Math.max(per100, 1)
    if (v === 'importer') return clamp(verdict === 'exporter' ? mirror : per100 * 1.8, 150, 400)
    return clamp(verdict === 'importer' ? mirror : per100 / 1.8, 25, 70)
  }
  const option = (v: Verdict, word: string) => `${word} — about ${figure(v)} jobs for every 100 its residents hold`
  const q1Options = [option('importer', 'importer'), option('exporter', 'exporter'), option('balanced', 'neither')]
  const q1Answer = verdict === 'importer' ? 0 : verdict === 'exporter' ? 1 : 2
  const q1Tail =
    verdict === 'importer'
      ? `More workers come in each day than residents go out: ${city} is a net importer, ${r.kind ? KIND_PHRASE[r.kind] : 'an importer'} on the dial.`
      : verdict === 'exporter'
        ? `More residents go out to work than workers come in: ${city} is a net exporter, ${r.kind ? KIND_PHRASE[r.kind] : 'a dormitory'} on the dial.`
        : `Within a quarter of even, which the dial reads as balanced: ${r.net > 0 ? 'somewhat more come in than go out' : r.net < 0 ? 'somewhat more go out than come in' : 'as many come in as go out'}, but not by enough to call ${city} a workplace or a dormitory.`

  const inPct = pctOf(r.inShare)
  const outPct = pctOf(r.outShare)
  const q2 = shareOptions(inPct)
  const q3 = shareOptions(outPct)

  return [
    {
      q: `${city} is a net … of workers.`,
      options: q1Options,
      answer: q1Answer,
      feedback: `${fmtInt(r.jobsHere)} jobs sit inside ${city} and its residents hold ${fmtInt(r.residentWorkers)}: ${fmtX(r.ratio)} jobs here for every job a resident holds. ${q1Tail}`,
    },
    {
      q: `Roughly what share of the jobs inside ${city} are filled by people who commute in?`,
      options: q2.options,
      answer: q2.answer,
      feedback: `${fmtInt(r.inCommuters)} of the ${fmtInt(r.jobsHere)} jobs inside ${city} — ${inPct}% — are held by people who live elsewhere in the metro. The other ${fmtInt(r.liveWorkHere)} are held by residents.`,
    },
    {
      q: `What share of ${city}’s residents work outside the city?`,
      options: q3.options,
      answer: q3.answer,
      feedback: `${fmtInt(r.outCommuters)} of the ${fmtInt(r.residentWorkers)} jobs ${city}’s residents hold — ${outPct}% — are outside the city line; ${fmtInt(r.liveWorkHere)} are inside it.`,
    },
  ]
}

/** When the admin city has no commute rows: one question the ranking can still answer. */
export function rankingQuestions(places: PlaceRatio[], metroName: string): CheckQuestion[] {
  if (places.length < 3) {
    return [
      {
        q: 'A place with more jobs inside its line than its residents hold is…',
        options: ['a net importer of workers — more come in each day than go out', 'a net exporter — its residents mostly work elsewhere', 'balanced — the two counts match'],
        answer: 0,
        feedback: 'Jobs located in a place divided by the jobs its residents hold: above 1× the place draws workers in; below it, the place sends them out.',
      },
    ]
  }
  const top = places[0]
  const mid = places[Math.floor(places.length / 2)]
  const low = places[places.length - 1]
  const opts = [top, mid, low].sort((a, b) => a.name.localeCompare(b.name))
  return [
    {
      q: `Which of these places in the ${metroName} metro has the most jobs for each job a resident holds?`,
      options: opts.map((p) => p.name),
      answer: opts.indexOf(top),
      feedback: `${top.name} sits at ${fmtX(top.ratio)}: ${fmtInt(top.jobsHere)} jobs inside its line against ${fmtInt(top.residentWorkers)} held by residents. ${low.name} is the other end at ${fmtX(low.ratio)}.`,
    },
  ]
}
