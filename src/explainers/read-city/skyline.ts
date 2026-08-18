import { seededRandom } from "./hooks";
import {
  clamp,
  css,
  hash,
  mix,
  rgb,
  skyGradient,
  type Ctx,
} from "./pixel";
import {
  R,
  drawStars,
  genStars,
  lineDots,
  pxCircle,
  reflectWater,
  waterGlints,
} from "./bits";
import { COOL, WARM, litShareAt, paletteAt, STOP_AT, walkersAt, type Palette } from "./palette";

/**
 * The wide riverfront — Anyville seen from across the water. One drawing,
 * every knob the story needs: the hour, how full the windows are, which way
 * the moving trucks run on the bridge, whether the stacks smoke and the
 * ships sail, whether the empty lot grows a crane, how high the "rent tide"
 * has climbed the esplanade, and whether it rains.
 * Scroll state s is eased outside; real time t keeps the city breathing.
 */

export const SKY_W = 480;
export const SKY_H = 270;

const W = SKY_W;
const H = SKY_H;
const HORIZON = 190; // waterline at the city's feet
const ESPL = 240; // top of the near-bank esplanade
const WATER_ROWS = ESPL - HORIZON;
const DECK = 156; // bridge deck
// the growth lot sits inboard of the office filler so cover-cropping never eats it
const LOT_X = 382;
const LOT_W = 46;
const LOT_H = 124; // the tower, topped out

export type SkyScene = {
  hour: number; // 0..24
  occ: number; // 0..1.1 — occupancy: lit windows, walkers
  flow: number; // -1..1 — net migration on the bridge
  factory: number; // 0..1 — stacks smoking, plant lit
  harbor: number; // 0..1 — ferry + cargo departures
  crane: number; // 0..1 — crane over the lot
  build: number; // 0..1 — lot construction progress (≥0.97 = topped out, lit)
  fortress: number; // 0..1 — the door shut: height-cap lid, U-turning trucks, a queue at the letting office
  rain: number; // 0..1 — weather as mood
};

/* ——— deterministic scene furniture ——— */

interface Win {
  x: number;
  y: number;
  thr: number;
  warm: string;
}

type Kind = "factory" | "walkup" | "hospital" | "glass" | "setback" | "office" | "lot";

interface Bld {
  x: number;
  w: number;
  hgt: number;
  base: string;
  kind: Kind;
  wins: Win[];
}

const SPEC: [number, number, number, string, Kind][] = [
  [134, 52, 52, "#241a24", "factory"],
  [190, 38, 84, "#1c1526", "walkup"],
  [232, 46, 112, "#2a3242", "hospital"],
  [282, 44, 148, "#0f1a2e", "glass"],
  [330, 48, 166, "#10152b", "setback"],
  [LOT_X, LOT_W, LOT_H, "#141a30", "lot"],
  [434, 36, 94, "#151a2e", "office"],
];

function tierW(w: number, hgt: number, yFromTop: number): number {
  const f = yFromTop / hgt;
  if (f < 0.2) return w - 22;
  if (f < 0.48) return w - 10;
  return w;
}

const SETBACK_TIERS = [
  [0, 0.2],
  [0.2, 0.48],
  [0.48, 1],
] as const;

/** The setback tower's slabs as integer rects, top tier first. */
function setbackTiers(b: Bld): { x: number; y: number; w: number; h: number }[] {
  const top = HORIZON - b.hgt;
  return SETBACK_TIERS.map(([f0, f1]) => {
    const w = tierW(b.w, b.hgt, (f0 + 0.01) * b.hgt);
    const y = R(top + f0 * b.hgt);
    return { x: b.x + ((b.w - w) >> 1), y, w, h: R(top + f1 * b.hgt) - y };
  });
}

const BLDS: Bld[] = (() => {
  const rng = seededRandom(4242);
  return SPEC.map(([x, w, hgt, base, kind]) => {
    const wins: Win[] = [];
    const top = HORIZON - hgt;
    const glass = kind === "glass";
    const stepY = glass ? 4 : 5;
    const stepX = glass ? 4 : 5;
    for (let y = top + 5; y < HORIZON - 8; y += stepY) {
      const tw = kind === "setback" ? tierW(w, hgt, y - top) : w;
      const x0 = x + ((w - tw) >> 1);
      for (let wx = x0 + 3; wx < x0 + tw - 3; wx += stepX) {
        wins.push({
          x: wx,
          y,
          thr: 0.06 + rng() * 0.9,
          warm:
            rng() < (glass ? 0.75 : kind === "hospital" ? 0.4 : 0.1)
              ? COOL[(rng() * COOL.length) | 0]
              : WARM[(rng() * WARM.length) | 0],
        });
      }
    }
    return { x, w, hgt, base, kind, wins };
  });
})();

const MID = (() => {
  const rng = seededRandom(777);
  const out: { x: number; w: number; h: number; wins: { x: number; y: number; thr: number }[] }[] = [];
  let x = 128;
  while (x < 370) {
    const w = 14 + ((rng() * 20) | 0);
    const h = (34 + rng() * rng() * 78) | 0;
    const wins: { x: number; y: number; thr: number }[] = [];
    for (let wy = HORIZON - h + 4; wy < HORIZON - 6; wy += 3) {
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        if (rng() < 0.3) wins.push({ x: wx, y: wy, thr: 0.1 + rng() * 0.95 });
      }
    }
    out.push({ x, w, h, wins });
    x += w + 2 + ((rng() * 5) | 0);
  }
  return out;
})();

const FAR = (() => {
  const rng = seededRandom(555);
  const out: { x: number; w: number; h: number }[] = [];
  let x = -4;
  while (x < W) {
    const w = 10 + ((rng() * 18) | 0);
    out.push({ x, w, h: (8 + rng() * (x < 140 ? 14 : 30)) | 0 });
    x += w - 2;
  }
  return out;
})();

const STARS = genStars(31, 92, W, 150);

const CLOUDS = (() => {
  const rng = seededRandom(64);
  return Array.from({ length: 4 }, () => ({
    y: 20 + rng() * 62,
    x0: rng() * W,
    speed: 0.8 + rng() * 0.9,
    blobs: Array.from({ length: 8 + ((rng() * 6) | 0) }, () => ({
      dx: (rng() * 46 - 23) | 0,
      dy: (rng() * 8 - 4) | 0,
      w: (7 + rng() * 15) | 0,
      h: rng() < 0.6 ? 2 : 3,
    })),
  }));
})();

const WALKERS = (() => {
  const rng = seededRandom(12);
  return Array.from({ length: 8 }, (_, i) => ({
    phase: rng() * W,
    speed: (i === 5 ? 30 : 8 + rng() * 7) * (rng() < 0.5 ? -1 : 1),
    dog: i === 2,
    jog: i === 5,
  }));
})();

const LAMPS = [24, 108, 192, 276, 360, 444];

const TRUCK_TONES = ["#c3c2b7", "#c96a4a", "#5a7fae", "#b3893a"];

// per-canvas truck opacities, eased in time: scenes settle on solid 0/1
// counts, while a count change mid-scroll fades a truck instead of popping it
const TRUCK_ALPHAS = new WeakMap<Ctx, { t: number; a: number[] }>();

/* ——— pieces ——— */

/**
 * Moon sweep, 0..1 right-to-left. Rises at 17:24 — in daylight, when
 * night-scaled alpha is still zero, so it fades in with dusk — peaks over
 * town near 22:00, then rides the long tail of the arc down the left sky
 * and sinks below the waterline behind the bridge just before 07:00:
 * a real moonset, never a mid-sky pop.
 */
function moonP(h: number): number {
  return ((h - 17.4 + 24) % 24) / 13.5;
}

/** Horizon haze: the moon pales over the last stretch of its arc. */
function moonFade(mp: number): number {
  return clamp((1 - mp) / 0.22, 0, 1);
}

function drawSunMoon(ctx: Ctx, h: number, pal: Palette, rain: number) {
  const p = (h - 6.1) / 13.4;
  // the storm swallows the sun well before the rain peaks, and the arc's
  // ends fade in/out so an easing hour never pops the sun mid-sky
  const sunA =
    clamp(1 - rain / 0.6, 0, 1) * clamp(Math.min(p, 1 - p) / 0.05, 0, 1);
  if (p > 0 && p < 1 && sunA > 0.02) {
    const sx = R(36 + p * (W - 72));
    const sy = R(HORIZON - 10 - Math.sin(p * Math.PI) * 152);
    const low = 1 - Math.sin(p * Math.PI);
    const col = css(mix(rgb("#fff3cd"), rgb("#ff9c50"), low));
    ctx.globalAlpha = 0.16 * sunA;
    ctx.fillStyle = col;
    pxCircle(ctx, sx, sy, 11);
    ctx.globalAlpha = (0.3 + low * 0.25) * sunA;
    pxCircle(ctx, sx, sy, 8);
    ctx.globalAlpha = sunA;
    pxCircle(ctx, sx, sy, 5);
    ctx.globalAlpha = 1;
  }
  const mp = moonP(h);
  const ma = Math.min(1, pal.night * 1.5) * (1 - rain) * moonFade(mp);
  if (mp > 0 && mp < 1 && ma > 0.02) {
    const mx = R(W - 44 - mp * (W - 92));
    // crests at mp≈0.28 — around (330, 28), in the notch between the glass
    // and setback towers — then the long tail walks it down to y=196, under
    // the waterline where the water pass paints over it, as the window ends
    const my = R(196 - Math.sin(Math.PI * Math.pow(mp, 0.55)) * 168);
    ctx.fillStyle = "#e9e5c9";
    // the halo pools over the lit limb — centered down-right, away from the
    // bite, so it fades out at the terminator instead of ringing the dark side
    ctx.globalAlpha = 0.05 * ma;
    pxCircle(ctx, mx + 2, my + 1, 9);
    ctx.globalAlpha = 0.09 * ma;
    pxCircle(ctx, mx + 2, my + 1, 6);
    ctx.globalAlpha = ma;
    pxCircle(ctx, mx, my, 5);
    ctx.fillStyle = css(pal.s[1]);
    pxCircle(ctx, mx - 2, my - 1, 4);
    ctx.globalAlpha = 1;
  }
  return p;
}

function drawClouds(ctx: Ctx, h: number, t: number, pal: Palette, sunP: number, rain: number) {
  const glow = sunP > 0 && sunP < 1 ? 1 - Math.sin(sunP * Math.PI) : 0;
  let body = mix(mix(pal.s[1], rgb("#f2f2ea"), 0.1 + pal.amb * 0.5), pal.s[3], glow * 0.5);
  body = mix(body, rgb("#20242e"), rain * 0.75);
  const under = mix(body, pal.s[0], 0.42);
  for (const c of CLOUDS) {
    const cx = ((c.x0 + h * 9 + t * (c.speed + rain * 2.2)) % (W + 130)) - 65;
    for (const b of c.blobs) {
      ctx.fillStyle = css(b.dy > 1 ? under : body);
      ctx.fillRect(R(cx + b.dx), R(c.y + b.dy + rain * 8), b.w + R(rain * 3), b.h);
    }
  }
}

/** The bridge into town: a through-arch, and where the moving trucks vote. */
function drawBridge(ctx: Ctx, t: number, pal: Palette, flow: number, fortress: number) {
  const night = pal.night;
  const col = css(mix(mix(pal.s[2], rgb("#141a3c"), 0.55), rgb("#4a5578"), night * 0.4));
  ctx.fillStyle = col;
  ctx.fillRect(0, DECK, 134, 2);
  const archY = (x: number) => 118 + 0.011 * (x - 65) * (x - 65);
  for (let x = 0; x < 134; x++) {
    const y = R(archY(x));
    if (y <= DECK) {
      ctx.fillRect(x, y, 1, 2); // the arch rib
      if (x % 7 === 3 && DECK - y > 3) ctx.fillRect(x, y + 2, 1, DECK - y - 2); // hangers
    }
  }
  // piers under the arch springings, standing in the river
  ctx.fillRect(8, DECK + 2, 4, HORIZON - DECK - 2);
  ctx.fillRect(122, DECK + 2, 4, HORIZON - DECK - 2);
  // the necklace: arch + deck lamps read the bridge at night
  if (night > 0.3) {
    ctx.fillStyle = `rgba(255,223,154,${0.5 + 0.5 * night})`;
    for (let x = 4; x < 131; x += 9) {
      const y = R(archY(x));
      if (y <= DECK) ctx.fillRect(x, y - 1, 1, 1);
    }
    for (let x = 6; x < 132; x += 14) ctx.fillRect(x, DECK - 1, 1, 1);
  }

  // traffic: |flow| trucks vote with their wheels, one car keeps the deck alive
  const inbound = flow >= 0;
  const drawTruck = (x: number, headRight: boolean, i: number, braking = false) => {
    ctx.fillStyle = TRUCK_TONES[i % TRUCK_TONES.length];
    ctx.fillRect(R(x), DECK - 5, 9, 4); // box
    ctx.fillStyle = css(mix(rgb("#1a2034"), pal.s[1], 0.2 * pal.amb));
    ctx.fillRect(headRight ? R(x) + 9 : R(x) - 3, DECK - 3, 3, 2); // cab
    if (pal.night > 0.35 || braking) {
      ctx.fillStyle = "#ffe9b0";
      if (pal.night > 0.35) ctx.fillRect(headRight ? R(x) + 12 : R(x) - 4, DECK - 2, 1, 1);
      ctx.fillStyle = braking ? "#ff3a3a" : "#ff6a5a";
      ctx.fillRect(headRight ? R(x) - 1 : R(x) + 9, DECK - 2, 1, braking ? 2 : 1);
    }
  };
  // the truck count is the original round(|flow|·3) — settled scenes show
  // fully solid trucks — but each slot's opacity eases in time, so a count
  // step mid-scroll fades the truck out on the move; the gate empties the
  // deck around flow = 0, where the sign flip mirrors the lanes
  const span = 134 + 30;
  const want = Math.round(Math.min(1, Math.abs(flow)) * 3);
  let st = TRUCK_ALPHAS.get(ctx);
  if (!st) TRUCK_ALPHAS.set(ctx, (st = { t, a: [0, 0, 0] }));
  const dt = Math.min(0.1, Math.max(0, t - st.t));
  st.t = t;
  const ease = dt > 0 ? 1 - Math.exp(-dt * 9) : 1; // snap on the static path
  const gate = clamp(Math.abs(flow) / 0.12, 0, 1);
  for (let i = 0; i < 3; i++) {
    const target = i < want ? 1 : 0;
    st.a[i] += (target - st.a[i]) * ease;
    if (Math.abs(st.a[i] - target) < 0.02) st.a[i] = target;
    const a = st.a[i] * gate;
    if (a < 0.04) continue;
    const raw = (hash(i * 7.3) * span + t * 15 + i * 43) % span;
    const x = inbound ? raw - 15 : span - raw - 15;
    if (x < -14 || x > 133) continue;
    ctx.globalAlpha = a;
    drawTruck(x, inbound, i);
    ctx.globalAlpha = 1;
  }
  // the ambient car keeps a fixed identity and direction: never teleports
  const carX = ((hash(3 * 7.3) * span + t * 24 + 3 * 43) % span) - 15;
  if (carX >= -14 && carX <= 133) {
    ctx.fillStyle = pal.night > 0.45 ? "#ffe9b0" : css(mix(pal.s[2], rgb("#10142c"), 0.8));
    ctx.fillRect(R(carX), DECK - 2, 3, 2);
  }
  // the door shut: movers reach mid-span, sit a beat, and turn back
  const uturns = Math.round(clamp(fortress, 0, 1) * 2);
  for (let i = 0; i < uturns; i++) {
    const T = 9;
    const p = ((t + i * 4.7) % T) / T;
    const xTurn = 72 + i * 14;
    if (p < 0.4) {
      const k = p / 0.4;
      drawTruck(-14 + (xTurn + 14) * k, true, i + 1);
    } else if (p < 0.56) {
      drawTruck(xTurn, true, i + 1, true); // brake lights: nowhere to go
    } else {
      const k = (p - 0.56) / 0.44;
      drawTruck(xTurn - (xTurn + 14) * k, false, i + 1);
    }
  }
  if (pal.night > 0.3 && (t % 2.1) < 0.13) {
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(65, 116, 1, 1);
  }
}

function drawCrane(ctx: Ctx, t: number, pal: Palette, craneA: number, build: number) {
  if (craneA < 0.06) return;
  const frameTop = HORIZON - Math.max(14, build * LOT_H);
  const mx = LOT_X - 5;
  const jy = Math.min(frameTop, HORIZON - 20) - 24;
  ctx.globalAlpha = Math.min(1, craneA * 1.6);
  const col = css(mix(rgb("#8a7434"), rgb("#0d1126"), pal.night * 0.72));
  ctx.fillStyle = col;
  ctx.fillRect(mx, jy, 2, HORIZON - jy); // mast
  for (let y = jy + 2; y < HORIZON; y += 4) ctx.fillRect(mx - 1, y, 4, 1);
  ctx.fillRect(mx - 3, jy - 3, 8, 3); // cab
  ctx.fillRect(mx, jy - 1, 40, 1); // jib over the lot
  ctx.fillRect(mx - 14, jy - 1, 14, 1); // counter-jib
  ctx.fillRect(mx - 13, jy, 4, 3); // counterweight
  lineDots(ctx, mx, jy - 8, mx + 39, jy - 2);
  lineDots(ctx, mx, jy - 8, mx - 13, jy - 2);
  ctx.fillRect(mx, jy - 9, 1, 8);
  // constant work rates — scaling the sin frequency by the eased crane
  // level would multiply all of elapsed t, whipping the trolley on scroll
  const trolley = mx + 8 + (Math.sin(t * 0.26) * 0.5 + 0.5) * 28;
  const drop = 6 + (Math.sin(t * 0.17 + 2) * 0.5 + 0.5) * (frameTop - jy - 9);
  ctx.fillRect(R(trolley), jy, 2, 1);
  ctx.fillRect(R(trolley), jy + 1, 1, R(drop));
  ctx.fillRect(R(trolley) - 1, jy + R(drop) + 1, 3, 2); // the load
  if ((t + 0.7) % 1.7 < 0.12) {
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(mx, jy - 10, 1, 1);
  }
  ctx.globalAlpha = 1;
}

const LOT_BLD = BLDS.find((b) => b.kind === "lot")!;

function drawLot(ctx: Ctx, pal: Palette, s: SkyScene, litW: number) {
  const b = LOT_BLD;
  const done = clamp(s.build, 0, 1);
  if (done < 0.03) {
    // the empty lot: hoarding fence, rubble, a leaning sign
    ctx.fillStyle = css(mix(rgb("#2a2438"), pal.s[1], 0.12 * pal.amb));
    for (let x = b.x; x < b.x + b.w; x += 2) ctx.fillRect(x, HORIZON - 7, 1, 7);
    ctx.fillRect(b.x, HORIZON - 8, b.w, 1);
    ctx.fillStyle = "#1a1626";
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(b.x + 3 + ((hash(i * 3.1) * (b.w - 8)) | 0), HORIZON - 3 - ((hash(i) * 3) | 0), 3, 2);
    }
    ctx.fillStyle = "#3a3450";
    ctx.fillRect(b.x + 14, HORIZON - 16, 16, 8); // the developer's billboard
    ctx.fillStyle = pal.night > 0.35 ? "#e8d8b8" : "#c3c2b7";
    ctx.fillRect(b.x + 16, HORIZON - 14, 12, 4);
    ctx.fillStyle = "#8a2f2a";
    ctx.fillRect(b.x + 17, HORIZON - 13, 6, 2);
    ctx.fillStyle = "#2a2438";
    ctx.fillRect(b.x + 21, HORIZON - 8, 1, 8);
    return;
  }
  const topped = done > 0.94;
  const doneH = Math.max(8, R(done * LOT_H));
  const top = HORIZON - doneH;
  // raw concrete while rising, the base tone once topped out
  const facade = topped
    ? mix(rgb(b.base), pal.s[1], 0.04 + 0.2 * pal.amb)
    : mix(rgb("#3c4354"), pal.s[1], 0.1 + 0.32 * pal.amb);
  ctx.fillStyle = css(facade);
  ctx.fillRect(b.x, top, b.w, doneH);
  if (!topped) {
    // open frame on the top storeys
    const frameBand = Math.min(((doneH * 0.55) | 0) + 2, 16);
    const fy = top;
    ctx.fillStyle = css(mix(rgb("#2a3352"), pal.s[1], 0.1 * pal.amb));
    for (let y = fy; y < fy + frameBand; y += 5) ctx.fillRect(b.x + 1, y, b.w - 2, 1);
    for (let x = b.x + 3; x < b.x + b.w - 2; x += 7) ctx.fillRect(x, fy, 1, frameBand);
    for (let x = b.x + 2; x < b.x + b.w - 2; x += 4) ctx.fillRect(x, fy - 2, 1, 2); // rebar
    // safety netting
    ctx.fillStyle = "#1c3524";
    for (let y = fy + 2; y < fy + frameBand; y++) {
      for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
        if (((x + y * 2) & 3) === 0) ctx.fillRect(x, y, 1, 1);
      }
    }
    // the legal lid: the height cap the frame is frozen under
    if (s.fortress > 0.1) {
      const capY = top - 6;
      ctx.globalAlpha = Math.min(1, s.fortress * 1.4);
      ctx.fillStyle = "#e66767";
      for (let x = b.x - 7; x < b.x + b.w + 7; x += 5) ctx.fillRect(x, capY, 3, 2);
      ctx.fillRect(b.x - 8, capY - 3, 2, 8); // end posts
      ctx.fillRect(b.x + b.w + 6, capY - 3, 2, 8);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = css(mix(facade, rgb("#e8e4d4"), 0.12 * pal.amb + 0.1));
    ctx.fillRect(b.x, top, b.w, 1); // parapet
  }
  // windows light up only once the tower tops out
  if (topped) {
    const lit = litW * clamp((done - 0.94) / 0.06, 0, 1);
    ctx.fillStyle = css(mix(rgb("#0a0c18"), pal.s[1], 0.1 + 0.26 * pal.amb));
    for (const wn of b.wins) {
      if (wn.y > top + 3) ctx.fillRect(wn.x, wn.y, 2, 2);
    }
    for (const wn of b.wins) {
      if (wn.y > top + 3 && wn.thr < lit) {
        ctx.fillStyle = wn.warm;
        ctx.fillRect(wn.x, wn.y, 2, 2);
      }
    }
  }
  // shaded edge
  ctx.fillStyle = css(mix(facade, rgb("#04050c"), 0.3));
  ctx.fillRect(b.x + b.w - 2, top, 2, doneH);
}

function drawBuilding(ctx: Ctx, b: Bld, t: number, pal: Palette, sunP: number, litW: number, s: SkyScene) {
  if (b.kind === "lot") return; // drawn separately
  const top = HORIZON - b.hgt;
  const ambMix = b.kind === "hospital" ? 0.08 + 0.3 * pal.amb : 0.04 + 0.2 * pal.amb;
  const facade = mix(rgb(b.base), pal.s[1], ambMix);
  const fCss = css(facade);
  ctx.fillStyle = fCss;

  // shade, rake, and parapet follow these rects — one box for most kinds,
  // per-slab for the setback tower so nothing frames it against the sky
  const tiers = b.kind === "setback" ? setbackTiers(b) : [{ x: b.x, y: top, w: b.w, h: b.hgt }];

  if (b.kind === "setback") {
    for (const tr of tiers) ctx.fillRect(tr.x, tr.y, tr.w, tr.h + 1);
    ctx.fillRect(b.x + (b.w >> 1) - 1, top - 9, 2, 9); // spire
    ctx.fillRect(b.x + (b.w >> 1), top - 14, 1, 5);
    if ((t % 1.9) < 0.14) {
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(b.x + (b.w >> 1), top - 15, 1, 1);
    }
  } else if (b.kind === "factory") {
    ctx.fillRect(b.x, top, b.w, b.hgt);
    // sawtooth roofline
    for (let x = b.x; x < b.x + b.w - 2; x += 8) {
      for (let i = 0; i < 5; i++) ctx.fillRect(x + i, top - 5 + i, 1, 5 - i);
    }
  } else {
    ctx.fillRect(b.x, top, b.w, b.hgt);
  }

  // low-sun rake + off-sun shade
  const sunX = 36 + sunP * (W - 72);
  const sunLeft = sunX < b.x + b.w / 2;
  ctx.fillStyle = css(mix(facade, rgb("#04050c"), 0.3));
  for (const tr of tiers) ctx.fillRect(sunLeft ? tr.x + tr.w - 2 : tr.x, tr.y, 2, tr.h);
  if (sunP > 0 && sunP < 1) {
    const low = 1 - Math.sin(sunP * Math.PI);
    if (low > 0.2 && pal.amb > 0.1) {
      ctx.fillStyle = css(mix(facade, rgb("#ffb46a"), 0.5 * low * (1 - s.rain)));
      for (const tr of tiers) ctx.fillRect(sunLeft ? tr.x : tr.x + tr.w - 2, tr.y, 2, tr.h);
    }
  }
  if (b.kind !== "factory") {
    ctx.fillStyle = css(mix(facade, rgb("#e8e4d4"), 0.12 * pal.amb + 0.1));
    tiers.forEach((tr, i) => {
      if (i === 0) {
        ctx.fillRect(tr.x, tr.y, tr.w, 1); // parapet catch-light
      } else {
        const up = tiers[i - 1]; // …and each exposed setback ledge
        ctx.fillRect(tr.x, tr.y, up.x - tr.x, 1);
        ctx.fillRect(up.x + up.w, tr.y, tr.x + tr.w - (up.x + up.w), 1);
      }
    });
  }

  // windows: unlit pass, then lit pass
  const factoryDim = b.kind === "factory" ? 0.2 + s.factory * 0.55 : 1;
  const lit = litW * factoryDim * (b.kind === "hospital" ? 1.3 : 1);
  const glass = css(
    b.kind === "glass"
      ? mix(pal.s[1], rgb(b.base), 0.3 + 0.55 * pal.night)
      : mix(rgb("#0a0c18"), pal.s[1], 0.08 + 0.2 * pal.amb),
  );
  const ww = b.kind === "glass" ? 3 : 2;
  ctx.fillStyle = glass;
  for (const wn of b.wins) if (wn.thr >= lit) ctx.fillRect(wn.x, wn.y, ww, 2);
  for (const wn of b.wins) {
    if (wn.thr < lit) {
      ctx.fillStyle = wn.warm;
      ctx.fillRect(wn.x, wn.y, ww, 2);
    }
  }

  /* rooftop signatures */
  if (b.kind === "factory") {
    for (const sx of [b.x + 9, b.x + 29]) {
      ctx.fillStyle = "#2a3048";
      ctx.fillRect(sx, top - 24, 4, 24);
      ctx.fillStyle = "#3a4468";
      ctx.fillRect(sx, top - 19, 4, 1);
      ctx.fillRect(sx, top - 10, 4, 1);
      ctx.fillStyle = "#464e70";
      ctx.fillRect(sx - 1, top - 25, 6, 2);
      if (s.factory > 0.08) {
        for (let k = 0; k < 7; k++) {
          const age = (t * 0.32 + k / 7 + (sx & 7) / 9) % 1;
          const size = 1 + age * 3.2;
          ctx.globalAlpha = (1 - age) * (0.24 + 0.24 * pal.amb) * s.factory;
          ctx.fillStyle = css(mix(pal.s[1], rgb("#9aa0b0"), 0.62));
          ctx.fillRect(
            R(sx + 1 + age * 16 + Math.sin(t * 0.8 + k * 2.1) * 1.6),
            R(top - 27 - age * 20),
            R(size),
            Math.max(1, R(size * 0.7)),
          );
        }
        ctx.globalAlpha = 1;
      }
    }
  } else if (b.kind === "hospital") {
    // the cross that never sleeps — surgery is an export
    const cx = b.x + (b.w >> 1);
    const cy = top + 8;
    ctx.fillStyle = "#e66767";
    ctx.fillRect(cx - 1, cy - 4, 3, 11);
    ctx.fillRect(cx - 5, cy, 11, 3);
    if (pal.night > 0.25) {
      ctx.globalAlpha = 0.16;
      ctx.fillRect(cx - 7, cy - 6, 15, 15);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#2a3146";
    ctx.fillRect(b.x + 6, top - 3, 5, 3); // plant room
    if ((t + 1.3) % 2.6 < 0.14) {
      ctx.fillStyle = "#7ac4ff";
      ctx.fillRect(b.x + b.w - 6, top - 4, 1, 1); // ambulance-bay beacon
    }
  } else if (b.kind === "glass") {
    ctx.fillStyle = "#2a3146";
    ctx.fillRect(b.x + 5, top - 9, 1, 9); // antenna
    if ((t + 1.1) % 2.3 < 0.14) {
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(b.x + 5, top - 10, 1, 1);
    }
  } else if (b.kind === "walkup") {
    ctx.fillStyle = css(mix(rgb("#2e3450"), pal.s[1], 0.2 * pal.amb));
    for (let y = top + 8; y < HORIZON - 12; y += 8) {
      ctx.fillRect(b.x + 4, y, 12, 1);
      const up = ((y - top) / 8) % 2 === 0;
      lineDots(ctx, b.x + (up ? 5 : 15), y + 7, b.x + (up ? 15 : 5), y + 1);
    }
  } else if (b.kind === "office") {
    ctx.fillStyle = "#2a3146";
    ctx.fillRect(b.x + 7, top - 3, 4, 3); // AC
    ctx.fillRect(b.x + 16, top - 2, 3, 2);
    ctx.fillRect(b.x + 24, top - 3, 4, 3);
  }

  if (pal.night > 0.2) {
    ctx.fillStyle = hash(b.x) > 0.5 ? "#ffd27a" : "#8ae0c0";
    ctx.fillRect(b.x + 2, HORIZON - 2, 1, 1); // dock light
  }
}

function drawShips(ctx: Ctx, t: number, pal: Palette, s: SkyScene) {
  // ferry: the city breathing across the water
  if (s.harbor > 0.12) {
    const T = 34;
    const prog = (t % T) / T;
    const dir = Math.floor(t / T) % 2 === 0 ? 1 : -1;
    const fx = R(dir > 0 ? -26 + prog * (W + 52) : W + 26 - prog * (W + 52));
    const fy = HORIZON + 10;
    ctx.fillStyle = "rgba(6,10,24,0.5)";
    ctx.fillRect(fx - 8 * dir, fy + 6, 18, 2);
    for (let k = 1; k < 8; k++) {
      ctx.fillStyle = `rgba(200,214,228,${0.14 * (1 - k / 8)})`;
      ctx.fillRect(fx - dir * (10 + k * 4), fy + 4 + (k % 2), 3, 1);
    }
    ctx.fillStyle = "#0a0e1e";
    ctx.fillRect(fx - 10, fy, 20, 4);
    ctx.fillStyle = css(mix(rgb("#3a4258"), pal.s[1], 0.3 * pal.amb));
    ctx.fillRect(fx - 6, fy - 4, 12, 4);
    ctx.fillStyle = pal.night > 0.4 ? "#ffd27a" : "#1c2234";
    for (let k = 0; k < 4; k++) ctx.fillRect(fx - 4 + k * 3, fy - 3, 2, 2);
    ctx.fillStyle = dir > 0 ? "#7ae08a" : "#ff7a6a";
    if (pal.night > 0.3) ctx.fillRect(fx + 9 * dir, fy - 1, 1, 1);
  }
  // the container ship, heading out under the bridge with the city's exports
  if (s.harbor > 0.4) {
    const T = 46;
    const prog = (t % T) / T;
    const x = R(W + 50 - prog * (W + 140));
    const y = HORIZON + 26;
    ctx.fillStyle = "rgba(6,10,24,0.55)";
    ctx.fillRect(x - 2, y + 9, 44, 2);
    for (let k = 1; k < 7; k++) {
      ctx.fillStyle = `rgba(200,214,228,${0.13 * (1 - k / 7)})`;
      ctx.fillRect(x + 42 + k * 4, y + 6 + (k % 2), 3, 1); // wake astern
    }
    ctx.fillStyle = "#0d1126";
    ctx.fillRect(x, y, 42, 8); // hull
    ctx.fillStyle = "#7a3040";
    ctx.fillRect(x, y + 6, 42, 2);
    const boxCols = ["#c96a4a", "#3d7a5f", "#5a7fae", "#b3893a", "#8a6bbf"];
    for (let c = 0; c < 7; c++) {
      for (let l = 0; l < (c % 3 === 1 ? 2 : 3); l++) {
        ctx.fillStyle = boxCols[(c * 2 + l) % boxCols.length];
        ctx.fillRect(x + 3 + c * 5, y - 3 - l * 3, 4, 3);
      }
    }
    ctx.fillStyle = "#c3c6d4";
    ctx.fillRect(x + 36, y - 8, 5, 8); // bridge castle aft
    ctx.fillStyle = "#12182c";
    ctx.fillRect(x + 37, y - 6, 3, 1);
    if (pal.night > 0.3) {
      ctx.fillStyle = "#ff7a6a";
      ctx.fillRect(x - 1, y + 1, 1, 1);
    }
  }
}

function drawWater(ctx: Ctx, t: number, pal: Palette, sunP: number, s: SkyScene) {
  reflectWater(ctx, W, HORIZON, WATER_ROWS, t, "#080d20", 0.44 + 0.18 * pal.night);
  waterGlints(ctx, W, HORIZON, WATER_ROWS, t, `rgba(214,224,236,${0.04 + 0.07 * pal.amb})`);
  const glitter = (cx: number, warm: boolean, str: number) => {
    for (let r = 2; r < WATER_ROWS - 2; r += 2) {
      if (hash(r * 13.7 + Math.floor(t * 5)) > 0.45) continue;
      const spread = 2 + r * 0.35;
      const gx = R(cx + (hash(r + Math.floor(t * 3)) - 0.5) * spread * 2);
      ctx.fillStyle = warm ? `rgba(255,190,120,${str})` : `rgba(220,224,200,${str * 0.8})`;
      ctx.fillRect(gx, HORIZON + r, 2, 1);
    }
  };
  if (sunP > 0 && sunP < 1) {
    const low = 1 - Math.sin(sunP * Math.PI);
    const a =
      0.3 * (low - 0.4) * clamp(1 - s.rain / 0.5, 0, 1) *
      clamp(Math.min(sunP, 1 - sunP) / 0.05, 0, 1);
    if (low > 0.45 && a > 0.01) glitter(36 + sunP * (W - 72), true, a);
  }
  const mp = moonP(s.hour);
  if (mp > 0 && mp < 1 && pal.night > 0.5 && s.rain < 0.5)
    glitter(W - 44 - mp * (W - 92), false, 0.16 * moonFade(mp));
}

function drawEsplanade(ctx: Ctx, t: number, pal: Palette, s: SkyScene) {
  ctx.fillStyle = "#0a0e1b";
  ctx.fillRect(0, ESPL, W, H - ESPL);
  ctx.fillStyle = "#0d1222";
  for (let y = ESPL + 6; y < H; y += 7) ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = "#1b2236";
  ctx.fillRect(0, ESPL + 2, W, 1);
  for (let x = 2; x < W; x += 8) ctx.fillRect(x, ESPL + 2, 1, 5);
  ctx.fillStyle = "#151b2e";
  for (const bx of [66, 240, 414]) {
    ctx.fillRect(bx, ESPL + 12, 9, 2);
    ctx.fillRect(bx + 1, ESPL + 14, 1, 2);
    ctx.fillRect(bx + 7, ESPL + 14, 1, 2);
  }
  // trees at the right end of the walk
  for (const tx of [468, 476]) {
    ctx.fillStyle = "#241c18";
    ctx.fillRect(tx, ESPL + 6, 1, 8);
    ctx.fillStyle = "#1e4030";
    ctx.fillRect(tx - 2, ESPL + 1, 5, 6);
    ctx.fillStyle = "#2a5a3c";
    ctx.fillRect(tx - 1, ESPL, 3, 3);
  }
  const lampOn = pal.night > 0.28;
  for (const lx of LAMPS) {
    if (lampOn) {
      ctx.fillStyle = "rgba(255,210,130,0.12)";
      ctx.fillRect(lx - 13, H - 5, 26, 5);
      ctx.fillRect(lx - 8, H - 9, 16, 4);
      ctx.fillStyle = "rgba(255,210,130,0.16)";
      pxCircle(ctx, lx, ESPL + 9, 4);
    }
    ctx.fillStyle = "#141a2c";
    ctx.fillRect(lx, ESPL + 10, 1, 14);
    ctx.fillStyle = lampOn ? "#ffd68c" : "#232a40";
    ctx.fillRect(lx - 1, ESPL + 8, 3, 2);
  }
  // walkers — the commute curve times how full the city is
  const n = R(walkersAt(s.hour) * clamp(s.occ, 0, 1.1) * 7 * (1 - s.rain * 0.7));
  ctx.fillStyle = "#04060d";
  for (let i = 0; i < Math.min(n, WALKERS.length); i++) {
    const wk = WALKERS[i];
    const raw = (wk.phase + t * wk.speed) % W;
    const x = R(raw < 0 ? raw + W : raw);
    const y = H - 10;
    const step = Math.floor(t * (wk.jog ? 10 : 6) + i * 3) % 2;
    ctx.fillRect(x, y - 5, 1, 1);
    ctx.fillRect(x, y - 4, 1, 3);
    ctx.fillRect(x - (step ? 1 : 0), y - 1, 1, 1);
    ctx.fillRect(x + (step ? 0 : 1), y - 1, 1, 1);
    if (wk.dog) {
      const dx = x - Math.sign(wk.speed) * 5;
      ctx.fillRect(dx, y - 2, 3, 1);
      ctx.fillRect(dx + (wk.speed > 0 ? -1 : 3), y - 3, 1, 1);
      ctx.fillRect(dx + (wk.speed > 0 ? 3 : -1), y - 3, 1, 1);
    }
  }
}

/**
 * The shadow price made visible: a pop-up letting office on the esplanade
 * with a queue growing out of it — the only thing a fortress city builds.
 */
function drawQueue(ctx: Ctx, t: number, pal: Palette, s: SkyScene) {
  if (s.fortress < 0.12) return;
  const bx = 352; // the booth, under the frozen lot's corner of town
  const a = Math.min(1, s.fortress * 1.3);
  ctx.globalAlpha = a;
  // warm spill down the whole line, so the queue silhouettes at dusk
  if (pal.night > 0.2) {
    ctx.fillStyle = "rgba(255,214,140,0.09)";
    ctx.fillRect(bx - 62, H - 9, 84, 9);
    ctx.fillStyle = "rgba(255,214,140,0.16)";
    ctx.fillRect(bx - 12, H - 8, 34, 8);
  }
  ctx.fillStyle = "#1c2138";
  ctx.fillRect(bx, 250, 13, 14); // the booth
  ctx.fillStyle = "#2e3650";
  ctx.fillRect(bx - 1, 248, 15, 2); // flat roof
  ctx.fillStyle = "#e8b84b";
  for (let i = 0; i < 3; i++) ctx.fillRect(bx + 2 + i * 4, 251, 2, 2); // TO LET
  ctx.fillStyle = "#ffd68c";
  ctx.fillRect(bx + 2, 255, 5, 4); // the lit hatch
  ctx.fillStyle = "#0e1120";
  ctx.fillRect(bx + 9, 255, 3, 9); // door
  // the queue, shuffling in place
  const n = R(clamp(s.fortress, 0, 1) * 11);
  ctx.fillStyle = "#04060d";
  for (let i = 0; i < n; i++) {
    const qx = bx - 6 - i * 5 - ((hash(i * 3.3) * 2) | 0);
    const shuffle = hash(i * 7.1 + Math.floor(t * 1.4)) > 0.9 ? 1 : 0;
    const y = H - 10;
    const tall = hash(i * 5.7) > 0.5 ? 1 : 0;
    ctx.fillRect(qx + shuffle, y - 5 - tall, 1, 1); // head
    ctx.fillRect(qx + shuffle, y - 4 - tall, 1, 3 + tall); // body
    ctx.fillRect(qx + shuffle, y - 1, 1, 1);
    ctx.fillRect(qx + shuffle + 1, y - 1, 1, 1);
    if (hash(i * 9.3) > 0.6) ctx.fillRect(qx + shuffle + 2, y - 2, 1, 2); // folder of paperwork
  }
  ctx.globalAlpha = 1;
}

function drawRain(ctx: Ctx, t: number, s: SkyScene) {
  if (s.rain < 0.04) return;
  const n = R(s.rain * 56);
  for (let i = 0; i < n; i++) {
    const speed = 90 + hash(i) * 70;
    const fy = (hash(i * 3.3) * (H + 8) + t * speed) % (H + 8) - 4;
    const fx = hash(i * 7.1) * (W + 20) - fy * 0.12;
    ctx.fillStyle = i % 3 ? `rgba(138,164,216,${0.5 * s.rain})` : `rgba(106,132,184,${0.36 * s.rain})`;
    ctx.fillRect(R(fx), R(fy), 1, 3);
  }
  // a flash finds the spire
  if (s.rain > 0.5 && (t % 12) > 11.7 && (t % 12) < 11.84) {
    ctx.fillStyle = "rgba(234,242,255,0.16)";
    ctx.fillRect(0, 0, W, HORIZON);
    ctx.fillStyle = "#eaf2ff";
    let bx = 352;
    for (let y = 0; y < 12; y++) {
      bx += hash(y * 7 + Math.floor(t)) > 0.5 ? 1 : -1;
      ctx.fillRect(bx, y, 1, 1);
    }
  }
}

function drawBirds(ctx: Ctx, h: number, t: number, rain: number) {
  const dawn = clamp(1 - Math.abs(h - 7.1) / 1.6, 0, 1);
  const dusk = clamp(1 - Math.abs(h - 18.3) / 1.1, 0, 1) * 0.6;
  const a = Math.max(dawn, dusk) * (1 - rain);
  if (a <= 0.02) return;
  ctx.fillStyle = `rgba(10,13,26,${0.5 + a * 0.5})`;
  for (let i = 0; i < 4; i++) {
    const bx = ((t * 26 + i * 67 + hash(i) * 40) % (W + 30)) - 15;
    const by = 36 + i * 13 + Math.sin(t * 3.2 + i) * 3;
    const up = Math.floor(t * 6 + i) % 2 === 0;
    ctx.fillRect(R(bx), R(by), 1, 1);
    ctx.fillRect(R(bx) - 1, R(by) + (up ? -1 : 0), 1, 1);
    ctx.fillRect(R(bx) + 1, R(by) + (up ? -1 : 0), 1, 1);
  }
}

/* ——— the scene ——— */

export function drawSkyline(ctx: Ctx, t: number, s: SkyScene) {
  const pal = paletteAt(s.hour, s.rain);
  const occ = clamp(s.occ, 0, 1.15);
  // lit windows follow the hour, thin out with vacancy, and mostly matter at night
  const litW = litShareAt(s.hour) * (0.06 + occ * occ * 0.85) * (0.4 + 0.6 * pal.night);

  skyGradient(ctx, W, HORIZON, STOP_AT.map((at, i) => ({ at, c: pal.s[i] })));

  if (pal.night > 0.04 && s.rain < 0.6) {
    ctx.globalAlpha = 1 - s.rain;
    drawStars(ctx, STARS, t, pal.night);
    ctx.globalAlpha = 1;
  }

  const sunP = drawSunMoon(ctx, s.hour, pal, s.rain);
  drawClouds(ctx, s.hour, t, pal, sunP, s.rain);

  // far bank
  ctx.fillStyle = css(mix(pal.s[2], rgb("#131a36"), 0.55));
  for (const f of FAR) ctx.fillRect(f.x, HORIZON - f.h, f.w, f.h);

  drawBridge(ctx, t, pal, s.flow, s.fortress);

  // mid depth
  ctx.fillStyle = css(mix(pal.s[2], rgb("#0c1126"), 0.76));
  for (const m of MID) ctx.fillRect(m.x, HORIZON - m.h, m.w, m.h);
  ctx.fillStyle = "#d8a86a";
  for (const m of MID) {
    for (const wn of m.wins) {
      if (wn.thr < litW * 0.85) ctx.fillRect(wn.x, wn.y, 1, 1);
    }
  }

  for (const b of BLDS) drawBuilding(ctx, b, t, pal, sunP, litW, s);
  drawLot(ctx, pal, s, litW);
  drawCrane(ctx, t, pal, s.crane, s.build);

  drawBirds(ctx, s.hour, t, s.rain);

  ctx.fillStyle = "rgba(5,7,15,0.35)";
  ctx.fillRect(0, HORIZON - 1, W, 1);

  drawWater(ctx, t, pal, sunP, s);
  drawShips(ctx, t, pal, s);
  drawEsplanade(ctx, t, pal, s);
  drawQueue(ctx, t, pal, s);
  drawRain(ctx, t, s);
}
