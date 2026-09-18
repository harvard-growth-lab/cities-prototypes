/* The section's words: how sectors are named inside a sentence, the
   explainer copy from the prototype, and small helpers that turn data into
   prose without ever printing a raw number. */
import type { Sector, TradabilityClass } from '@/data/types'
import { fmtInt } from '@/lib/format'

/** A sector as it reads inside a sentence. */
export const SECTOR_PHRASE: Record<Sector, string> = {
  'Professional & Business': 'professional & business services',
  Manufacturing: 'manufacturing',
  'Financial Activities': 'financial activities',
  'Trade & Transportation': 'trade & transportation',
  Information: 'information',
  'Education & Health': 'education & health',
  'Leisure & Hospitality': 'leisure & hospitality',
  'Natural Resources': 'natural resources',
  Construction: 'construction',
  Other: 'other services',
}

export const TIER_GLOSS: Record<TradabilityClass, string> = {
  traded: 'sells most of its output outside the metro, so its earnings are new income arriving here',
  partly_traded: 'sells some outside and some to the people already here',
  local: 'serves the people already here; the customer has to be standing there',
}

export const COMPLEXITY_COPY = [
  'Complexity measures the knowledge an industry takes to run. Work that needs many people holding many different specialised skills — medical devices, financial engineering, research instruments — is complex. Work that almost anywhere can do — food service, retail, basic construction — is not.',
  'It matters because complex work is hard to copy. Places that hold it tend to pay more, to weather downturns better, and to find it easier to move into the next complex thing, because the know-how is already in the room. A metro’s complexity is the mix of its industries weighted by how much of each it does.',
]

export const SPECIALIZATION_COPY = {
  a: 'An industry counts as a ',
  b: ' when the metro does more of it than the country does. The measure divides the industry’s share of jobs here by its share of jobs nationally: ',
  c: ' is exactly the national rate, ',
  d: ' is twice as concentrated here as anywhere else.',
  e: 'It says nothing about size. A small industry can be a powerful specialization and a large one can be entirely ordinary — this measures what is ',
  f: ' about the metro, not what employs the most people.',
}

/** "Scientific Research and Development Services" → "scientific research and development services";
 *  hyphenated words are lowered part by part ("Air-Conditioning"); acronyms
 *  and mixed-case tokens keep their capitals. */
export const lowerName = (name: string) =>
  name
    .split(' ')
    .map((w) =>
      w
        .split('-')
        .map((part) => (/^[A-Z][a-z]*$/.test(part.replace(/[(),;:]/g, '')) ? part.toLowerCase() : part))
        .join('-'),
    )
    .join(' ')

/** The verb form an industry name takes: a plural-looking head ("Software
 *  Publishers", "… Services", "Offices of Physicians") reads as plural, the
 *  rest ("Management of Companies …", "Traveler Accommodation") as singular. */
export function verbFor(name: string, plural: string, singular: string) {
  const head = name.split(/ (?:of|for|to) /)[0].replace(/[(),;:]/g, '').trim()
  return /s$/i.test(head) ? plural : singular
}

/** Rounded for prose: 1,425 → "1,400"; 37,826 → "38,000"; 125,559 → "126,000". */
export function roughInt(n: number) {
  const step = n >= 10000 ? 1000 : n >= 1000 ? 100 : n >= 100 ? 10 : 1
  return fmtInt(Math.round(n / step) * step)
}

/** A share as a whole percent: 0.223 → "22%". */
export const pct0 = (share: number) => `${Math.round(share * 100)}%`

/** "more than four fifths" for the lead sectors' combined share. */
export function fractionWord(share: number) {
  if (share >= 0.97) return 'almost all'
  if (share >= 0.9) return 'more than nine tenths'
  if (share >= 0.8) return 'more than four fifths'
  if (share >= 0.75) return 'about three quarters'
  if (share >= 0.66) return 'about two thirds'
  return 'more than half'
}
