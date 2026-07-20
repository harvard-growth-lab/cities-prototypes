/**
 * Shared pixel-art helpers for the Pixel Lab: ordered dithering, palette
 * interpolation, and a fast dithered sky gradient. Everything works at the
 * canvas's internal (small) resolution — the CSS upscale with
 * image-rendering: pixelated is what makes it read as pixel art.
 */

export type Ctx = CanvasRenderingContext2D;

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function css(c: RGB): string {
  return `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function mixHex(a: string, b: string, t: number): string {
  return css(mix(rgb(a), rgb(b), t));
}

/** Darken (t<0) or lighten (t>0) a hex color. */
export function shade(hex: string, t: number): string {
  const c = rgb(hex);
  return t < 0 ? css(mix(c, { r: 0, g: 0, b: 0 }, -t)) : css(mix(c, { r: 255, g: 255, b: 255 }, t));
}

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/** Piecewise-linear lookup through [x, value] keyframes (x ascending). */
export function keyframes(keys: readonly (readonly [number, number])[], x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) {
      const [x0, v0] = keys[i - 1];
      const [x1, v1] = keys[i];
      return v0 + ((x - x0) / (x1 - x0)) * (v1 - v0);
    }
  }
  return keys[keys.length - 1][1];
}

/** Deterministic hash noise in [0,1) — stable across frames for a given n. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 4×4 Bayer ordered-dither thresholds, normalized to (0,1). */
export const BAYER4: number[][] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/** True where a dithered blend at ratio t should show the second color. */
export function dithered(x: number, y: number, t: number): boolean {
  return t > BAYER4[y & 3][x & 3];
}

export interface SkyStop {
  at: number; // 0 top … 1 bottom
  c: RGB;
}

const imgCache = new WeakMap<Ctx, ImageData>();

/**
 * Vertical multi-stop gradient, ordered-dithered between neighboring stops,
 * written through ImageData so it stays cheap at full-canvas size per frame.
 */
export function skyGradient(ctx: Ctx, w: number, h: number, stops: SkyStop[]) {
  let img = imgCache.get(ctx);
  if (!img || img.width !== w || img.height !== h) {
    img = ctx.createImageData(w, h);
    imgCache.set(ctx, img);
  }
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const u = h < 2 ? 0 : y / (h - 1);
    let i = 0;
    while (i < stops.length - 2 && u > stops[i + 1].at) i++;
    const s0 = stops[i];
    const s1 = stops[i + 1];
    const span = Math.max(1e-6, s1.at - s0.at);
    const t = clamp((u - s0.at) / span, 0, 1);
    const row = BAYER4[y & 3];
    for (let x = 0; x < w; x++) {
      const c = t > row[x & 3] ? s1.c : s0.c;
      const o = (y * w + x) * 4;
      d[o] = c.r;
      d[o + 1] = c.g;
      d[o + 2] = c.b;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Convenience: parse hex stops evenly spaced (or with explicit positions). */
export function stops(colors: string[], at?: number[]): SkyStop[] {
  return colors.map((c, i) => ({
    at: at ? at[i] : colors.length < 2 ? 0 : i / (colors.length - 1),
    c: rgb(c),
  }));
}
