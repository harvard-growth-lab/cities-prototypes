/* The tool's sections and the beats inside them, in reading order. One model
   drives the section bar, the pager, the Learning Journey and the routes
   (cities-v-1 on main: sectionDefs + the rail). Beats are in-page anchors
   (`#b1`) inside a section route. */

export type SectionSlug = 'fundamentals' | 'industries' | 'admin' | 'constraints' | 'levers'

export interface Beat {
  id: string
  /** the rail / journey label */
  label: string
}

export interface Section {
  slug: SectionSlug
  /** 1-based number shown in the bar */
  n: number
  name: string
  short: string
  /** which geography the section reads at, for the Viewing badge default */
  geo: 'metro' | 'city'
  beats: Beat[]
}

export const SECTIONS: Section[] = [
  {
    slug: 'fundamentals',
    n: 1,
    name: 'Economic Fundamentals',
    short: 'Fundamentals',
    geo: 'city',
    beats: [
      { id: 'b1', label: 'How well is your city doing' },
      { id: 'b2', label: 'Your city is not an island' },
      { id: 'b3', label: 'Admins in your metro' },
      { id: 'check', label: 'Test your knowledge' },
      { id: 'apply', label: 'Put your insights' },
    ],
  },
  {
    slug: 'industries',
    n: 2,
    name: 'Metro Industries',
    short: 'Industries',
    geo: 'metro',
    beats: [
      { id: 'b1', label: 'What brings income into your metro?' },
      { id: 'b2', label: 'How tradable is the metro’s work?' },
      { id: 'b3', label: 'Which tradable industries is the metro most specialized in?' },
      { id: 'check', label: 'Test your knowledge' },
      { id: 'apply', label: 'Put your insights' },
    ],
  },
  {
    slug: 'admin',
    n: 3,
    name: 'Admin Industries',
    short: 'Admin',
    geo: 'city',
    beats: [
      { id: 'b1', label: 'One city, two workforces' },
      { id: 'b2', label: 'Who fills those jobs' },
      { id: 'b3', label: 'Where its residents work' },
      { id: 'b4', label: 'Two workforces' },
      { id: 'b5', label: 'Workplace, or dormitory?' },
      { id: 'check', label: 'Test your knowledge' },
      { id: 'apply', label: 'Put your insights' },
    ],
  },
  {
    slug: 'constraints',
    n: 4,
    name: 'Constraints Diagnosis',
    short: 'Constraints',
    geo: 'metro',
    beats: [
      { id: 'b1', label: 'How is the metro performing?' },
      { id: 'b2', label: 'Is your city pulling with the metro?' },
      { id: 'b3', label: 'Cost, or the place itself?' },
      { id: 'check', label: 'Test your knowledge' },
      { id: 'apply', label: 'Put your insights' },
    ],
  },
  {
    slug: 'levers',
    n: 5,
    name: 'Levers for Change',
    short: 'Levers',
    geo: 'metro',
    beats: [
      { id: 'b1', label: 'What the diagnosis points at' },
      { id: 'b2', label: 'What the metro could grow into' },
      { id: 'b3', label: 'The evidence board' },
      { id: 'check', label: 'Test your knowledge' },
      { id: 'apply', label: 'Put your insights' },
    ],
  },
]

export const sectionBySlug = (slug: string): Section | undefined =>
  SECTIONS.find((s) => s.slug === slug)

/** The route path for a section: '/city/$slug/fundamentals'. */
export const sectionPath = (slug: SectionSlug) => `/city/$slug/${slug}` as const

/** Sections 1–3 describe the place, 4–5 diagnose it: the seam in the bar. */
export const SEAM_BEFORE: SectionSlug = 'constraints'
