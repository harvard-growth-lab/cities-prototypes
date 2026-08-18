import { clamp, keyframes, mix, rgb, type RGB } from "./pixel";

/**
 * Shared time-of-day palette for the "How to Read a City" scenes — the
 * pixel lab's twelve hand-tuned sky keys, factored out so the wide
 * riverfront and the street-level scene light the same world. `rain`
 * pulls every stop toward storm grey and eats the ambient light.
 */

interface SkyKey {
  h: number;
  sky: [string, string, string, string]; // zenith → horizon
  amb: number; // daylight 0..1
}

const SKY_KEYS: SkyKey[] = [
  { h: 0, sky: ["#04060f", "#070b1c", "#0d1228", "#221f3c"], amb: 0 },
  { h: 4.4, sky: ["#04060f", "#070b1c", "#0d1228", "#221f3c"], amb: 0 },
  { h: 5.6, sky: ["#0a0f26", "#141838", "#2b2450", "#5c3a55"], amb: 0.05 },
  { h: 6.6, sky: ["#1e2e58", "#3a4276", "#8a5878", "#e8996a"], amb: 0.28 },
  { h: 7.8, sky: ["#41699f", "#6c8cbe", "#a4b2d0", "#e5d2ac"], amb: 0.72 },
  { h: 10, sky: ["#4a7cba", "#779fd0", "#a9bedb", "#d5dade"], amb: 1 },
  { h: 15, sky: ["#4a7cba", "#779fd0", "#a9bedb", "#d5dade"], amb: 1 },
  { h: 17.4, sky: ["#3f68a6", "#6e8abc", "#ada6c4", "#e7c08f"], amb: 0.85 },
  { h: 18.7, sky: ["#2b3870", "#525089", "#a46476", "#f0a05c"], amb: 0.48 },
  { h: 19.8, sky: ["#131b42", "#22275e", "#4e3363", "#a05648"], amb: 0.14 },
  { h: 21, sky: ["#060a1c", "#0b102e", "#131a3a", "#332c50"], amb: 0.02 },
  { h: 24, sky: ["#04060f", "#070b1c", "#0d1228", "#221f3c"], amb: 0 },
];

const SKY_RGB = SKY_KEYS.map((k) => k.sky.map(rgb));
const STORM = ["#14171f", "#1c202c", "#262b3a", "#343848"].map(rgb);

export const STOP_AT = [0, 0.42, 0.72, 1];

export interface Palette {
  s: RGB[]; // 4 sky stops
  amb: number; // ambient daylight 0..1
  night: number; // how "on" the city's lights are 0..1
}

export function paletteAt(h: number, rain = 0): Palette {
  let i = 1;
  while (i < SKY_KEYS.length - 1 && h > SKY_KEYS[i].h) i++;
  const a = SKY_KEYS[i - 1];
  const b = SKY_KEYS[i];
  const t = clamp((h - a.h) / Math.max(1e-6, b.h - a.h), 0, 1);
  let s = SKY_RGB[i - 1].map((c, j) => mix(c, SKY_RGB[i][j], t));
  let amb = a.amb + (b.amb - a.amb) * t;
  if (rain > 0.02) {
    s = s.map((c, j) => mix(c, STORM[j], rain * 0.8));
    amb *= 1 - 0.62 * rain;
  }
  return { s, amb, night: clamp(1 - amb * 1.25, 0, 1) };
}

/** Share of windows lit, by hour — evenings peak, a few night owls remain. */
const LIT_CURVE = [
  [0, 0.26], [1.5, 0.14], [4, 0.07], [5.5, 0.12], [6.5, 0.18], [7.5, 0.13],
  [9, 0.05], [15, 0.04], [16.5, 0.09], [17.5, 0.2], [18.5, 0.44],
  [19.3, 0.6], [20.2, 0.7], [21.5, 0.76], [22.5, 0.66], [23.2, 0.48], [24, 0.26],
] as const;

export const litShareAt = (h: number) => keyframes(LIT_CURVE, h);

/** Foot traffic by hour — the commute curve, normalized 0..1. */
const WALK_CURVE = [
  [0, 0.15], [4.5, 0], [6, 0.15], [8.3, 0.7], [10.5, 0.35], [13, 0.5],
  [16, 0.5], [18.3, 1], [20, 0.65], [22, 0.3], [24, 0.15],
] as const;

export const walkersAt = (h: number) => keyframes(WALK_CURVE, h);

export const WARM = ["#ffd27a", "#ffc45c", "#ffdf9a", "#ffb765", "#ffcf85", "#f4e3b0"];
export const COOL = ["#bcd4ff", "#cfe0ff"];
