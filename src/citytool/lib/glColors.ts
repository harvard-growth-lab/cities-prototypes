// Growth Lab design-system palette for charts (SVG / Recharts / Leaflet).
//
// This is the chart-side mirror of the CSS :root tokens in src/styles.css,
// which in turn are downstream copies of ~/dev/gl-design/grammar.md (the
// source of truth). Values flow downward: if a hex changes in grammar.md,
// update styles.css AND this file. Never invent a chart color outside this set.
//
// Grammar essentials encoded here:
//  • Each categorical hue has a light / main / dark tone. Main fills geoms;
//    dark strokes overlaps AND renders every text label/annotation tied to the
//    mark (WCAG AA on paper); light is for backgrounds and faded states.
//  • Highlight by muting: paint the field in `muted`, repaint the focus in
//    c-1 (institutional blue) or c-2 (lead-finding red).
//  • Axis line = ink-2 1px; gridline = gridline; faint in-panel lines = ink-4.

export const GL = {
  // Warm ink ramp
  ink: '#1a1714',
  ink2: '#2c2823',
  ink3: '#4f4a42',
  ink4: '#9a9389',

  // Chrome
  accent: '#1a5a8e', // institutional voice (== c1Dark)
  rule: '#dddddd',
  gridline: '#d8d4cc',
  paper: '#ffffff',
  paperWarm: '#f4f1ea',

  // Categorical — c1 (primary blue) and c2 (lead-finding / identity red)
  c1: '#2f87c8',
  c1Dark: '#1a5a8e',
  c1Light: '#b5d5ea',
  c2: '#cc4948',
  c2Dark: '#8a2c2b',
  c2Light: '#e89c9c',
  c3: '#2aa584',
  c3Dark: '#1a6b53',
  c3Light: '#92d6bf',
  c4: '#7554a3',
  c4Dark: '#4a3470',
  c5: '#ea822d',
  c5Dark: '#a8580f',
  c6: '#cdc86b',
  c6Dark: '#8a8638',

  // Muted (de-emphasis) — cool grey that recedes behind warm ink
  muted: '#afb5be',
  mutedDark: '#5f6773',
  mutedLight: '#cdd2d9',
} as const;
