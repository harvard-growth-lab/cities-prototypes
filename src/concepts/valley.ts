import { genStars, drawStars, pxCircle, R } from "../pixel/bits";
import {
  clamp,
  css,
  hash,
  keyframes,
  mix,
  rgb,
  skyGradient,
  type Ctx,
  type RGB,
} from "../pixel/pixel";
import { paletteAt, walkersAt, WARM, type Palette, STOP_AT } from "../pixel/palette";

/**
 * The breathing boundary — one valley, one labor market, and a dashed
 * administrative line standing in the middle of it. Suburbs on the left,
 * main street in the middle, downtown towers on the right. Run the day:
 * at dawn the house windows dim and the road pours rightward across the
 * line into the towers; at dusk the tide runs back. The line (drawn in
 * the same red-dash stroke as the story's height cap: a rule, not a
 * thing) never stops anyone — and `cityOnly` shows what "just my side
 * of the line" would leave you governing.
 */

export const VAL_W = 480;
export const VAL_H = 270;

export type ValScene = {
  hour: number; // 0..24
  boundary: number; // 0..1 — the dashed city-limit line + its sign
  cityOnly: number; // 0..1 — dim everything outside the line
};

/* ——— composition constants ——— */

const HORIZON = 240; // building baseline / top of sidewalk
const SIDEWALK_H = 5; // 240..245
const ROAD_Y = HORIZON + SIDEWALK_H; // 245
const ROAD_H = 14; // 245..259
const VERGE_Y = ROAD_Y + ROAD_H; // 259..270
const BX = 306; // the city limit

/* ——— deterministic furniture ——— */

interface House {
  x: number;
  w: number;
  h: number;
  chim?: boolean;
}
const HOUSES: House[] = [
  { x: 8, w: 14, h: 12 },
  { x: 27, w: 13, h: 10 },
  { x: 44, w: 15, h: 14, chim: true },
  { x: 64, w: 12, h: 10 },
  { x: 81, w: 14, h: 13 },
  { x: 100, w: 13, h: 11, chim: true },
  { x: 117, w: 14, h: 12 },
  { x: 134, w: 12, h: 10 },
];
const TREES = [23, 60, 96, 131, 150];

interface Block {
  x: number;
  w: number;
  h: number;
  base: string;
  shops?: boolean;
  hospital?: boolean;
}
// main street (outside the line) — the hospital sits hard against the lot
const BLOCKS: Block[] = [
  { x: 156, w: 34, h: 46, base: "#1d1830", shops: true },
  { x: 194, w: 38, h: 54, base: "#241a24", shops: true },
  { x: 236, w: 26, h: 38, base: "#1c1526", shops: true },
  { x: 266, w: 32, h: 50, base: "#2a3242", hospital: true },
];
// the parking lot: first thing inside the line, and the hospital's
const LOT = { x: 312, w: 34 };
// downtown towers (inside the line)
const TOWERS: Block[] = [
  { x: 352, w: 28, h: 102, base: "#10152b" },
  { x: 384, w: 38, h: 152, base: "#0f1a2e" },
  { x: 426, w: 24, h: 118, base: "#151a2e" },
  { x: 454, w: 22, h: 170, base: "#141a30" },
];

const STARS = genStars(7, 70, VAL_W, 150);

/* ——— the tide curves (all by hour) ——— */

// share of house windows lit: breakfast bump, empty workday, full evening
const HOME_CURVE = [
  [0, 0.3], [1.5, 0.16], [4.5, 0.08], [6, 0.42], [7.2, 0.5], [8.5, 0.22],
  [10, 0.08], [15.5, 0.08], [17, 0.22], [18.5, 0.55], [20, 0.8],
  [21.5, 0.85], [23, 0.55], [24, 0.3],
] as const;
// share of tower windows lit: the workday, inverted suburbia
const WORK_CURVE = [
  [0, 0.05], [5.5, 0.04], [7, 0.22], [8.5, 0.72], [9.5, 0.92], [12, 0.85],
  [14, 0.88], [16.5, 0.78], [18, 0.45], [19.5, 0.18], [21.5, 0.08], [24, 0.05],
] as const;
// net commute flow: + rightward (into town) in the morning, − back at dusk
const FLOW_CURVE = [
  [0, 0], [5.8, 0], [7, 0.5], [8.4, 1], [9.8, 0.3], [12, 0.08], [15.5, -0.08],
  [17, -0.45], [18.4, -1], [20, -0.35], [22, -0.06], [24, 0],
] as const;
// shopfront lights on main street
const SHOP_CURVE = [
  [0, 0], [7, 0.08], [8.5, 0.6], [10, 0.85], [18, 0.9], [20.5, 0.6],
  [22, 0.2], [23.5, 0.02], [24, 0],
] as const;

const homeAt = (h: number) => keyframes(HOME_CURVE, h);
const workAt = (h: number) => keyframes(WORK_CURVE, h);
const flowAt = (h: number) => keyframes(FLOW_CURVE, h);
const shopAt = (h: number) => keyframes(SHOP_CURVE, h);

/* ——— small helpers ——— */

function facade(base: string, pal: Palette): string {
  const c = rgb(base);
  const day = mix(c, rgb("#8a8ea6"), 0.18 * pal.amb);
  return css(mix(day, rgb("#0b0e1c"), pal.night * 0.45));
}

/** Stable per-window lighting: more windows come on as litP rises. */
function litWindows(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  litP: number,
  pal: Palette,
  pitchX = 5,
  pitchY = 6,
  ww = 2,
  wh = 3,
) {
  const unlit = css(mix(rgb("#0a0c18"), pal.s[1], 0.1 + 0.24 * pal.amb));
  for (let wy = y; wy + wh <= y + h; wy += pitchY) {
    for (let wx = x; wx + ww <= x + w; wx += pitchX) {
      const k = seed * 131 + wx * 7.1 + wy * 13.7;
      if (hash(k) < litP) {
        ctx.fillStyle = WARM[(hash(k * 3) * WARM.length) | 0];
      } else {
        ctx.fillStyle = unlit;
      }
      ctx.fillRect(wx, wy, ww, wh);
    }
  }
}

function drawSunMoon(ctx: Ctx, h: number, pal: Palette) {
  const p = (h - 6.1) / 13.4;
  const sunA = clamp(Math.min(p, 1 - p) / 0.05, 0, 1);
  if (p > 0 && p < 1 && sunA > 0.02) {
    const sx = R(30 + p * (VAL_W - 60));
    const sy = R(HORIZON - 40 - Math.sin(p * Math.PI) * 150);
    const low = 1 - Math.sin(p * Math.PI);
    const col = css(mix(rgb("#fff3cd"), rgb("#ff9c50"), low));
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.18 * sunA;
    pxCircle(ctx, sx, sy, 10);
    ctx.globalAlpha = sunA;
    pxCircle(ctx, sx, sy, 5);
    ctx.globalAlpha = 1;
  }
  const mp = ((h - 17.4 + 24) % 24) / 13.5;
  const ma = Math.min(1, pal.night * 1.5) * clamp((1 - mp) / 0.22, 0, 1);
  if (mp > 0 && mp < 1 && ma > 0.02) {
    const mx = R(VAL_W - 40 - mp * (VAL_W - 84));
    const my = R(190 - Math.sin(Math.PI * Math.pow(mp, 0.55)) * 158);
    ctx.fillStyle = "#e9e5c9";
    ctx.globalAlpha = 0.08 * ma;
    pxCircle(ctx, mx + 2, my + 1, 7);
    ctx.globalAlpha = ma;
    pxCircle(ctx, mx, my, 4);
    ctx.fillStyle = css(pal.s[1]);
    pxCircle(ctx, mx - 2, my - 1, 3);
    ctx.globalAlpha = 1;
  }
}

function ridgeY(x: number, base: number, amp: number, k: number): number {
  return base - amp * (0.55 + 0.45 * Math.sin(x * k + hash(k) * 9)) - 2 * Math.sin(x * 0.11 + k * 5);
}

/* ——— the scene ——— */

export function drawValley(ctx: Ctx, t: number, s: ValScene) {
  const h = ((s.hour % 24) + 24) % 24;
  const pal = paletteAt(h);
  const home = homeAt(h);
  const work = workAt(h);
  const flow = flowAt(h);
  const shops = shopAt(h);

  // sky
  skyGradient(ctx, VAL_W, VAL_H, STOP_AT.map((at, i) => ({ at, c: pal.s[i] as RGB })));
  if (pal.night > 0.12) drawStars(ctx, STARS, t, pal.night);
  drawSunMoon(ctx, h, pal);

  // valley ridges behind town
  const far = css(mix(pal.s[2], rgb("#0c1020"), 0.42 + pal.night * 0.2));
  const near = css(mix(pal.s[3], rgb("#0a0d1a"), 0.55 + pal.night * 0.2));
  for (let x = 0; x < VAL_W; x++) {
    ctx.fillStyle = far;
    const y1 = R(ridgeY(x, HORIZON - 14, 22, 0.017));
    ctx.fillRect(x, y1, 1, HORIZON - y1);
    ctx.fillStyle = near;
    const y2 = R(ridgeY(x, HORIZON - 4, 12, 0.031));
    ctx.fillRect(x, y2, 1, HORIZON - y2);
  }

  // ground: sidewalk, road, verge
  ctx.fillStyle = css(mix(mix(rgb("#2a2c38"), rgb("#8e8d94"), 0.3 * pal.amb), rgb("#11131f"), pal.night * 0.5));
  ctx.fillRect(0, HORIZON, VAL_W, SIDEWALK_H);
  ctx.fillStyle = css(mix(mix(rgb("#1b1d28"), rgb("#5e5f6a"), 0.22 * pal.amb), rgb("#0b0d16"), pal.night * 0.45));
  ctx.fillRect(0, ROAD_Y, VAL_W, ROAD_H);
  const lane = css(mix(rgb("#8f8a6e"), rgb("#3a3a30"), pal.night * 0.5));
  ctx.fillStyle = lane;
  for (let x = 2; x < VAL_W; x += 12) ctx.fillRect(x, ROAD_Y + 7, 5, 1);
  ctx.fillStyle = css(mix(mix(rgb("#16241a"), rgb("#3f5a38"), 0.3 * pal.amb), rgb("#0a1210"), pal.night * 0.55));
  ctx.fillRect(0, VERGE_Y, VAL_W, VAL_H - VERGE_Y);

  // street lamps come on at night, both sides of the line
  if (pal.night > 0.25) {
    for (let x = 16; x < VAL_W; x += 46) {
      ctx.fillStyle = "#3a3a44";
      ctx.fillRect(x, HORIZON - 12, 1, 12);
      ctx.fillStyle = `rgba(255,223,154,${0.7 * pal.night})`;
      ctx.fillRect(x - 1, HORIZON - 13, 3, 2);
    }
  }

  /* — suburbs — */
  for (let i = 0; i < HOUSES.length; i++) {
    const hs = HOUSES[i];
    const top = HORIZON - hs.h;
    const wall = rgb(i % 2 ? "#2e2838" : "#372c3c");
    ctx.fillStyle = css(mix(mix(wall, rgb("#a09aae"), 0.3 * pal.amb), rgb("#0b0e1c"), pal.night * 0.42));
    ctx.fillRect(hs.x, top, hs.w, hs.h);
    // pitched roof: wide at the eaves, narrow at the ridge
    const roofC = css(mix(mix(rgb("#1c1730"), rgb("#7c7488"), 0.26 * pal.amb), rgb("#0b0e1c"), pal.night * 0.4));
    ctx.fillStyle = roofC;
    for (let r = 0; r < 4; r++) ctx.fillRect(hs.x - 1 + r, top - 1 - r, hs.w + 2 - r * 2, 1);
    // door + two windows
    ctx.fillStyle = css(mix(rgb("#0e0c18"), pal.s[2], 0.15 * pal.amb));
    ctx.fillRect(hs.x + ((hs.w / 2) | 0), HORIZON - 5, 2, 5);
    for (let k = 0; k < 2; k++) {
      const wx = hs.x + 2 + k * (hs.w - 6);
      const lit = hash(i * 17.3 + k * 5.1) < home;
      ctx.fillStyle = lit ? WARM[(hash(i * 3 + k) * WARM.length) | 0] : css(mix(rgb("#0a0c18"), pal.s[1], 0.12 + 0.2 * pal.amb));
      ctx.fillRect(wx, top + 4, 2, 3);
    }
    // evening chimney smoke
    if (hs.chim) {
      ctx.fillStyle = roofC;
      ctx.fillRect(hs.x + hs.w - 4, top - 8, 2, 5);
      const puff = home > 0.5 ? 0.5 + pal.night * 0.5 : 0;
      if (puff > 0.1) {
        ctx.fillStyle = `rgba(190,190,200,${0.28 * puff})`;
        for (let j = 0; j < 3; j++) {
          const pt = (t * 0.5 + j * 0.33 + i) % 1;
          ctx.fillRect(
            R(hs.x + hs.w - 4 + Math.sin((pt + j) * 5) * 2),
            R(top - 9 - pt * 9),
            2 - (pt > 0.6 ? 1 : 0) + 1,
            1,
          );
        }
      }
    }
  }
  // trees
  for (const tx of TREES) {
    ctx.fillStyle = css(mix(rgb("#3a2c1e"), rgb("#191009"), pal.night * 0.5));
    ctx.fillRect(tx, HORIZON - 4, 1, 4);
    ctx.fillStyle = css(mix(mix(rgb("#22381f"), rgb("#4a7a3a"), 0.35 * pal.amb), rgb("#0d1610"), pal.night * 0.55));
    pxCircle(ctx, tx, HORIZON - 7, 3);
  }

  /* — main street (outside the line) — */
  for (let i = 0; i < BLOCKS.length; i++) {
    const b = BLOCKS[i];
    const top = HORIZON - b.h;
    ctx.fillStyle = facade(b.base, pal);
    ctx.fillRect(b.x, top, b.w, b.h);
    ctx.fillStyle = css(mix(rgb(b.base), rgb("#e8e4d4"), 0.1 * pal.amb + 0.08));
    ctx.fillRect(b.x, top, b.w, 1); // parapet
    if (b.shops) {
      // upper floors are homes; the ground floor is a shopfront strip
      litWindows(ctx, b.x + 2, top + 4, b.w - 4, b.h - 14, i * 7 + 1, home * 0.75, pal);
      const glowA = shops * (0.35 + 0.65 * pal.night);
      ctx.fillStyle = `rgba(255,210,122,${0.15 + 0.75 * glowA})`;
      ctx.fillRect(b.x + 2, HORIZON - 7, b.w - 4, 5);
      ctx.fillStyle = css(mix(rgb("#241c10"), rgb("#0d0a08"), pal.night * 0.4));
      for (let px = b.x + 5; px < b.x + b.w - 3; px += 6) ctx.fillRect(px, HORIZON - 7, 1, 5);
    }
    if (b.hospital) {
      // hospitals never sleep — steady mid lighting, cross glows at night
      litWindows(ctx, b.x + 2, top + 8, b.w - 4, b.h - 14, 91, 0.4 + home * 0.15, pal, 5, 5, 2, 2);
      ctx.fillStyle = pal.night > 0.3 ? "#ff6a6a" : "#c9484a";
      ctx.fillRect(b.x + ((b.w / 2) | 0) - 1, top + 2, 2, 6);
      ctx.fillRect(b.x + ((b.w / 2) | 0) - 3, top + 4, 6, 2);
    }
  }

  /* — the hospital's parking lot (first thing inside the line) — */
  {
    const surfDay = mix(rgb("#23252f"), rgb("#6e6e78"), 0.25 * pal.amb);
    ctx.fillStyle = css(mix(surfDay, rgb("#0d0f18"), pal.night * 0.45));
    ctx.fillRect(LOT.x, HORIZON - 11, LOT.w, 11);
    ctx.fillStyle = css(mix(rgb("#8f8a6e"), rgb("#3a3a30"), pal.night * 0.55));
    for (let k = 0; k <= 4; k++) ctx.fillRect(LOT.x + 1 + k * 8, HORIZON - 11, 1, 4);
    // stalls fill with the workday — the lot is its own tide gauge
    for (let k = 0; k < 4; k++) {
      if (hash(k * 3.7 + 2) < work * 0.92 + 0.04) {
        ctx.fillStyle = ["#c3c2b7", "#c96a4a", "#5a7fae", "#b3893a"][k % 4];
        ctx.fillRect(LOT.x + 3 + k * 8, HORIZON - 9, 6, 4);
        ctx.fillStyle = "#11131f";
        ctx.fillRect(LOT.x + 4 + k * 8, HORIZON - 10, 4, 1);
      }
    }
    // booth at the entrance
    ctx.fillStyle = facade("#2a2438", pal);
    ctx.fillRect(LOT.x + LOT.w - 4, HORIZON - 13, 4, 13);
    ctx.fillStyle = work > 0.3 || pal.night > 0.4 ? "#ffd27a" : css(pal.s[2]);
    ctx.fillRect(LOT.x + LOT.w - 3, HORIZON - 11, 2, 2);
  }

  /* — downtown towers (inside the line) — */
  for (let i = 0; i < TOWERS.length; i++) {
    const b = TOWERS[i];
    const top = HORIZON - b.h;
    ctx.fillStyle = facade(b.base, pal);
    ctx.fillRect(b.x, top, b.w, b.h);
    ctx.fillStyle = css(mix(rgb(b.base), rgb("#e8e4d4"), 0.12 * pal.amb + 0.08));
    ctx.fillRect(b.x, top, b.w, 1);
    litWindows(ctx, b.x + 2, top + 3, b.w - 4, b.h - 8, i * 13 + 5, work * 0.88 + 0.04, pal, 5, 5, 2, 2);
  }
  // antenna beacon on the tallest tower
  {
    const b = TOWERS[3];
    const top = HORIZON - b.h;
    ctx.fillStyle = "#3a3a44";
    ctx.fillRect(b.x + ((b.w / 2) | 0), top - 7, 1, 7);
    if ((t % 2.1) < 0.13) {
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(b.x + ((b.w / 2) | 0), top - 8, 1, 1);
    }
  }

  /* — the boundary line (under the traffic: people drive across it) — */
  if (s.boundary > 0.03) {
    ctx.globalAlpha = Math.min(1, s.boundary) * (0.55 + 0.45 * pal.night);
    ctx.fillStyle = "#e66767";
    for (let y = 26; y < VERGE_Y + 4; y += 7) ctx.fillRect(BX, y, 2, 4);
    ctx.globalAlpha = 1;
  }

  /* — the commuter tide — */
  const east = Math.max(0, flow); // toward downtown
  const west = Math.max(0, -flow);
  const drawCar = (x: number, y: number, headRight: boolean, i: number) => {
    ctx.fillStyle = ["#c3c2b7", "#c96a4a", "#5a7fae", "#b3893a"][i % 4];
    ctx.fillRect(R(x), y, 5, 2);
    ctx.fillStyle = "#11131f";
    ctx.fillRect(R(x) + (headRight ? 3 : 1), y - 1, 2, 1);
    if (pal.night > 0.35) {
      ctx.fillStyle = "#ffe9b0";
      ctx.fillRect(headRight ? R(x) + 5 : R(x) - 1, y + 1, 1, 1);
      ctx.fillStyle = "#ff6a5a";
      ctx.fillRect(headRight ? R(x) - 1 : R(x) + 5, y + 1, 1, 1);
    }
  };
  const span = VAL_W + 24;
  const nEast = Math.round(east * 7) + 1; // one ambient car each way, always
  const nWest = Math.round(west * 7) + 1;
  for (let i = 0; i < nEast; i++) {
    const x = ((hash(i * 7.3) * span + t * (30 + hash(i) * 12) + i * 37) % span) - 12;
    drawCar(x, ROAD_Y + 2, true, i);
  }
  for (let i = 0; i < nWest; i++) {
    const x = span - ((hash(i * 9.1 + 4) * span + t * (30 + hash(i + 9) * 12) + i * 41) % span) - 12;
    drawCar(x, ROAD_Y + 9, false, i + 1);
  }
  // walkers on the sidewalk, thickest around main street and the towers
  const wn = Math.round(walkersAt(h) * 9);
  for (let i = 0; i < wn; i++) {
    const zone = i % 2 ? [150, 300] : [330, 470];
    const speed = 5 + hash(i * 3.3) * 4;
    const dir = flow >= 0 ? 1 : -1;
    const x = zone[0] + ((hash(i * 5.7) * (zone[1] - zone[0]) + t * speed * dir + span) % (zone[1] - zone[0]));
    ctx.fillStyle = css(mix(rgb("#0e1020"), pal.s[3], 0.18 * pal.amb));
    ctx.fillRect(R(x), HORIZON - 3, 1, 3);
  }

  /* — "only my city": everything past the line fades to hearsay — */
  if (s.cityOnly > 0.02) {
    ctx.fillStyle = `rgba(5,7,13,${0.8 * Math.min(1, s.cityOnly)})`;
    ctx.fillRect(0, 0, BX, VAL_H);
  }

  /* — the city-limit sign, above everything — */
  if (s.boundary > 0.03) {
    ctx.globalAlpha = Math.min(1, s.boundary);
    ctx.fillStyle = "#4a4a54";
    ctx.fillRect(BX + 4, HORIZON - 12, 1, 12);
    ctx.fillStyle = css(mix(rgb("#d8d4c8"), rgb("#5a584e"), pal.night * 0.55));
    ctx.fillRect(BX + 1, HORIZON - 18, 12, 7);
    ctx.fillStyle = "#2a2620";
    ctx.fillRect(BX + 2, HORIZON - 16, 10, 1);
    ctx.fillRect(BX + 2, HORIZON - 14, 7, 1);
    ctx.globalAlpha = 1;
  }
}
