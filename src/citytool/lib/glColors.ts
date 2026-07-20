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

/* ————— chart color-ramp helpers (shared by the map + treemap charts) ————— */

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function rgbHex(r: number, g: number, b: number) {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Red → warm-paper → green diverging ramp for signed growth/decline metrics.
// The saturated ends are pinned to GL's own c-2 (red) and c-3 (green) tones and
// the midpoint to warm paper, rather than ad-hoc hues; sequential metrics use
// only the upper half (paper → green) so "more = greener".
const GREEN_DARK: [number, number, number] = [26, 107, 83]; // c-3-dark   #1a6b53
const GREEN_MID: [number, number, number] = [91, 192, 160]; // c-3        #5bc0a0
const CREAM: [number, number, number] = [244, 241, 234]; //     paper-warm #f4f1ea
const RED_MID: [number, number, number] = [220, 111, 110]; //  c-2 seq-mid #dc6f6e
const RED_DARK: [number, number, number] = [138, 44, 43]; //   c-2-dark    #8a2c2b

/** t in [0,1]: 0 → warm paper, 1 → dark green. */
export function sequentialColor(t: number): string {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.5) {
    const k = u / 0.5;
    return rgbHex(lerp(CREAM[0], GREEN_MID[0], k), lerp(CREAM[1], GREEN_MID[1], k), lerp(CREAM[2], GREEN_MID[2], k));
  }
  const k = (u - 0.5) / 0.5;
  return rgbHex(lerp(GREEN_MID[0], GREEN_DARK[0], k), lerp(GREEN_MID[1], GREEN_DARK[1], k), lerp(GREEN_MID[2], GREEN_DARK[2], k));
}

/** t in [-1,1]: -1 → dark red, 0 → warm paper, +1 → dark green. */
export function divergingColor(t: number): string {
  const u = Math.max(-1, Math.min(1, t));
  if (u >= 0) {
    if (u < 0.5) {
      const k = u / 0.5;
      return rgbHex(lerp(CREAM[0], GREEN_MID[0], k), lerp(CREAM[1], GREEN_MID[1], k), lerp(CREAM[2], GREEN_MID[2], k));
    }
    const k = (u - 0.5) / 0.5;
    return rgbHex(lerp(GREEN_MID[0], GREEN_DARK[0], k), lerp(GREEN_MID[1], GREEN_DARK[1], k), lerp(GREEN_MID[2], GREEN_DARK[2], k));
  }
  const v = -u;
  if (v < 0.5) {
    const k = v / 0.5;
    return rgbHex(lerp(CREAM[0], RED_MID[0], k), lerp(CREAM[1], RED_MID[1], k), lerp(CREAM[2], RED_MID[2], k));
  }
  const k = (v - 0.5) / 0.5;
  return rgbHex(lerp(RED_MID[0], RED_DARK[0], k), lerp(RED_MID[1], RED_DARK[1], k), lerp(RED_MID[2], RED_DARK[2], k));
}
