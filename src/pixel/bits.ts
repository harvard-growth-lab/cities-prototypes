import { seededRandom } from "./hooks";
import { hash, type Ctx } from "./pixel";

/**
 * Shared bits for the city portraits: tiny geometry helpers, a star field,
 * and the water-reflection blit worked out for the hour-cycle hero.
 * Each portrait keeps its own palette and composition — these are just the
 * strokes they all need.
 */

export const R = Math.round;

export function pxCircle(ctx: Ctx, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/** Pixel line; step 2 reads as a thin cable, 3 as a dotted stay. */
export function lineDots(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  step = 1,
) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i += step) {
    ctx.fillRect(R(x0 + ((x1 - x0) * i) / n), R(y0 + ((y1 - y0) * i) / n), 1, 1);
  }
}

export interface Star {
  x: number;
  y: number;
  b: number;
}

export function genStars(seed: number, n: number, w: number, maxY: number): Star[] {
  const rng = seededRandom(seed);
  return Array.from({ length: n }, () => ({
    x: (rng() * w) | 0,
    y: (rng() * maxY) | 0,
    b: rng(),
  }));
}

export function drawStars(ctx: Ctx, stars: Star[], t: number, alpha = 1) {
  for (const s of stars) {
    const tw = 0.4 + 0.6 * hash(s.x * 7 + s.y + Math.floor(t * 2.2 + s.b * 9));
    ctx.globalAlpha = alpha * (0.25 + 0.7 * s.b) * tw;
    ctx.fillStyle = s.b > 0.75 ? "#ffffff" : "#c9d3ff";
    ctx.fillRect(s.x, s.y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

/**
 * Mirror everything above `horizon` into the water below it: compressed
 * per-row self-blit with a time-wobbled x offset, then a depth tint.
 */
export function reflectWater(
  ctx: Ctx,
  w: number,
  horizon: number,
  rows: number,
  t: number,
  tint: string,
  tintA: number,
) {
  const cv = ctx.canvas;
  for (let r = 0; r < rows; r++) {
    const srcY = Math.max(0, R(horizon - 2 - r * 1.35));
    const dx = R(Math.sin(r * 0.52 + t * 1.5 + Math.sin(r * 1.7) * 0.4) * (1 + r * 0.05));
    ctx.drawImage(cv, 0, srcY, w, 1, dx, horizon + r, w, 1);
  }
  ctx.fillStyle = tint;
  ctx.globalAlpha = tintA;
  ctx.fillRect(0, horizon, w, rows);
  ctx.globalAlpha = tintA * 0.7;
  ctx.fillRect(0, horizon + (rows >> 1), w, rows >> 1);
  ctx.globalAlpha = 1;
}

/** Sparse moving glint lines on a water band. */
export function waterGlints(
  ctx: Ctx,
  w: number,
  horizon: number,
  rows: number,
  t: number,
  color: string,
  n = 10,
) {
  ctx.fillStyle = color;
  for (let j = 0; j < n; j++) {
    const row = (hash(j * 3 + Math.floor(t * 1.6)) * (rows - 4)) | 0;
    const gx = (hash(j * 7.7 + Math.floor(t * 0.9)) * (w - 30)) | 0;
    ctx.fillRect(gx, horizon + 2 + row, 6 + ((hash(j) * 14) | 0), 1);
  }
}
