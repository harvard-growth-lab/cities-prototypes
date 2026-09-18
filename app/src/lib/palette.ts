/* Figure colours from cities-v-1 (design-spec §1.1 "Chart palettes"). The
   chrome and geography colours are Tailwind tokens (src/styles/index.css);
   these are the encodings figures need as JS values for SVG fills. */
import type { Quadrant, Sector, TradabilityClass } from '@/data/types'

export const CHROME = {
  teal: '#255862',
  tealDark: '#1c454d',
  tealTint: '#eef3f4',
  orange: '#e76565',
  orangeDark: '#cf4f2c',
  orangeTint: '#fdf0ec',
  ink: '#1a2226',
  inkSoft: '#5b686d',
  line: '#e2e7e8',
  lineStrong: '#c3ccce',
  rise: '#3d9a43',
  fall: '#c0244a',
  geoCity: '#255862',
  geoCityFill: '#93a9ad',
  geoMetro: '#4a6a72',
  geoMetroFill: '#dde7ea',
} as const

export const SECTOR_COLOR: Record<Sector, string> = {
  Construction: '#c084a2',
  'Education & Health': '#e8836e',
  'Financial Activities': '#f4c542',
  'Leisure & Hospitality': '#8fd0d8',
  Manufacturing: '#4f8fa3',
  'Natural Resources': '#7cb342',
  Other: '#8b7ba8',
  'Professional & Business': '#b94a44',
  'Trade & Transportation': '#e0938a',
  Information: '#6a8fd6',
}

export const TIER_COLOR: Record<TradabilityClass, string> = {
  traded: '#255862',
  partly_traded: '#59838c',
  local: '#b9ccd0',
}
export const TIER_LABEL: Record<TradabilityClass, string> = {
  traded: 'Traded',
  partly_traded: 'Partly traded',
  local: 'Local',
}
export const TIER_ORDER: TradabilityClass[] = ['traded', 'partly_traded', 'local']

/** Five PCI bins, least → most complex; cuts at −0.72, −0.40, 0.08, 0.65. */
export const COMPLEXITY_RAMP = ['#e4a368', '#efc9a5', '#f8e7d7', '#89ccc7', '#029287'] as const
const COMPLEXITY_CUTS = [-0.72, -0.4, 0.08, 0.65]
export function complexityColor(pci: number | null | undefined) {
  if (pci === null || pci === undefined || Number.isNaN(pci)) return '#d9dde0'
  let i = 0
  while (i < COMPLEXITY_CUTS.length && pci >= COMPLEXITY_CUTS[i]) i++
  return COMPLEXITY_RAMP[i]
}

/** The tint behind each quadrant in the diagnostic explainer's small chart. */
export const QUADRANT_TINT: Record<Quadrant, string> = {
  supply_negative: '#f6f2e9',
  demand_positive: '#e8ecf2',
  demand_negative: '#f9edec',
  supply_positive: '#e9efeb',
}

/** Ranking bars: the top three in teal, the rest muted. */
export const RANK_MUTED = '#a9c2c7'
/** Small grey mini-bars (jobs columns). */
export const BAR_GREY = '#7c848c'

/** The population chart's series. */
export const SERIES = {
  city: '#0f4557',
  metro: '#a3ccd4',
  metroInk: '#3f8195',
  nation: '#9aa0a6',
  grid: '#e9e9eb',
  base: '#9ea2a7',
  axis: '#8e9196',
  tick: '#72767b',
  band: 'rgba(18,22,26,.045)',
} as const

/** The metro scatter. */
export const SCATTER = {
  field: '#c8cdd0',
  peer: '#9ea2a3',
  home: CHROME.orangeDark,
  place: '#b3b8ba',
} as const

/** Admin Industries: the two workforces and the dial's zones. */
export const ADMIN = {
  jobsHere: CHROME.geoCity,
  residents: CHROME.orange,
  both: '#9aa8ad',
  below: '#6f9aa3',
  zones: { dormitory: CHROME.orange, balanced: '#c9ced2', importer: '#8fb5bb', hub: CHROME.geoCity },
} as const

/** Text colour that reads on a fill: white on deep colours, ink on light. */
export function inkOn(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  return luma > 175 ? CHROME.ink : '#ffffff'
}
