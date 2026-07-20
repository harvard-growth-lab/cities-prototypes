import { drawStars, genStars, pxCircle, R } from "../pixel/bits";
import { reflectWater, waterGlints } from "../pixel/bits";
import {
  clamp,
  css,
  hash,
  mix,
  rgb,
  skyGradient,
  type Ctx,
  type RGB,
} from "../pixel/pixel";
import { paletteAt, STOP_AT, WARM, type Palette } from "../pixel/palette";

/**
 * Two banks, one bridge — spatial equilibrium as a pixel scene. Alba on
 * the left bank, Bruma on the right, one tied-arch bridge over the strait:
 * portal towers at the quay edges, a lit deck that runs behind each town's
 * bridge-foot building (so traffic drives in from town, never pops into
 * mid-air). Trucks cross BOTH ways all the time (the churn nobody notices);
 * the scene keeps a little population ledger per canvas and drifts it
 * toward whichever town currently offers the better deal
 *   deal = boom + amenities − crowding
 * so a shock tips the bridge one way until crowding (windows filling, a
 * queue at the letting office) eats the advantage and the flows cancel
 * again. Ends changed, flows balanced: the theorem, drawn.
 */

export const TWIN_W = 480;
export const TWIN_H = 270;

export type TwinScene = {
  hour: number; // 0..24
  boomA: number; // 0..1 — export boom in Alba (smoke, ship, gold flecks)
  boomB: number; // 0..1 — export boom in Bruma
  amenA: number; // 0..1 — Alba's amenities (low = rain over Alba)
  amenB: number; // 0..1 — Bruma's amenities
};

const HORIZON = 206; // waterline
const QUAY = 198; // building baseline / quay top
const DECK = 168; // bridge deck — the road surface the trucks ride
const CREST = 138; // arch crest, ~30px over the deck like the story's bridge
const TWR_L = 190; // portal towers at the quay edges — the arch springs here
const TWR_R = 290;
const DECK_X0 = 150; // deck ends hidden behind each town's bridge-foot building
const DECK_X1 = 330;
const K_ARCH = (DECK - CREST) / ((TWR_L - 240) * (TWR_L - 240));

const ALBA = "#3987e5"; // pennant colors — the MigrationSim towns' colors
const BRUMA = "#9085e9";

interface Bld {
  x: number;
  w: number;
  h: number;
  base: string;
  pennant?: boolean;
  factory?: boolean;
}

// Alba, outer edge → bridge foot; Bruma is the mirror image
const TOWN_A: Bld[] = [
  { x: 4, w: 34, h: 30, base: "#241a24", factory: true },
  { x: 42, w: 26, h: 58, base: "#1c1526" },
  { x: 72, w: 30, h: 44, base: "#241f30" },
  { x: 106, w: 28, h: 84, base: "#10152b", pennant: true },
  { x: 138, w: 26, h: 52, base: "#151a2e" },
];
const TOWN_B: Bld[] = TOWN_A.map((b) => ({ ...b, x: TWIN_W - b.x - b.w }));

const KIOSK_A = 166; // letting office at each bridge foot
const KIOSK_B = TWIN_W - KIOSK_A - 10;

const STARS = genStars(11, 64, TWIN_W, 140);

/* ——— the per-canvas population ledger, and its public readout ———
   The model is deliberately small and fully on display:
     deal (utility)  u = w + a − r(N)
     wage draw       w = W_BOOM · boom
     amenities       a = W_AMEN · amen
     crowding cost   r = W_CROWD · share   (rents rise with population)
   Migration works off the imbalance: dN_B/dt ∝ u_B − u_A, so at rest
   u_A = u_B — spatial equilibrium. */

export const TWIN_MODEL = { W_BOOM: 0.6, W_AMEN: 0.5, W_CROWD: 0.9 } as const;

export interface TwinReadout {
  shareA: number; // population shares, 0..1
  shareB: number;
  wageA: number; // the three deal terms, per town
  wageB: number;
  amenA: number;
  amenB: number;
  crowdA: number;
  crowdB: number;
  dealA: number; // u = w + a − r
  dealB: number;
  net: number; // −1..1, + = flowing toward Bruma
}

const LEDGER = new WeakMap<Ctx, { popB: number; last: number; out?: TwinReadout }>();

/** Where the deal balances: ½ + (Bruma's edge − Alba's edge) / (2·crowding). */
function equilibriumPopB(s: TwinScene): number {
  const edge =
    TWIN_MODEL.W_BOOM * (s.boomB - s.boomA) + TWIN_MODEL.W_AMEN * (s.amenB - s.amenA);
  return clamp(0.5 + edge / (2 * TWIN_MODEL.W_CROWD), 0.16, 0.84);
}

/** Latest model state for a mounted twin canvas (null before first frame). */
export function readTwin(cv: HTMLCanvasElement | null): TwinReadout | null {
  const ctx = cv?.getContext("2d");
  return (ctx && LEDGER.get(ctx)?.out) || null;
}

/* ——— pieces ——— */

function facade(base: string, pal: Palette): string {
  const c = rgb(base);
  const day = mix(c, rgb("#8a8ea6"), 0.2 * pal.amb);
  return css(mix(day, rgb("#0b0e1c"), pal.night * 0.45));
}

function drawSunMoon(ctx: Ctx, h: number, pal: Palette, gloom: number) {
  const p = (h - 6.1) / 13.4;
  const sunA = clamp(Math.min(p, 1 - p) / 0.05, 0, 1) * (1 - gloom * 0.7);
  if (p > 0 && p < 1 && sunA > 0.02) {
    const sx = R(30 + p * (TWIN_W - 60));
    const sy = R(HORIZON - 46 - Math.sin(p * Math.PI) * 130);
    const low = 1 - Math.sin(p * Math.PI);
    ctx.fillStyle = css(mix(rgb("#fff3cd"), rgb("#ff9c50"), low));
    ctx.globalAlpha = 0.18 * sunA;
    pxCircle(ctx, sx, sy, 10);
    ctx.globalAlpha = sunA;
    pxCircle(ctx, sx, sy, 5);
    ctx.globalAlpha = 1;
  }
  const mp = ((h - 17.4 + 24) % 24) / 13.5;
  const ma = Math.min(1, pal.night * 1.5) * clamp((1 - mp) / 0.22, 0, 1);
  if (mp > 0 && mp < 1 && ma > 0.02) {
    const mx = R(TWIN_W - 40 - mp * (TWIN_W - 84));
    const my = R(150 - Math.sin(Math.PI * Math.pow(mp, 0.55)) * 118);
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

function drawTown(
  ctx: Ctx,
  t: number,
  pal: Palette,
  town: Bld[],
  pop: number, // this town's share, 0..1
  boom: number,
  pennant: string,
  mirror: boolean, // true for Bruma (queue and flecks flip)
) {
  const litP = clamp(0.3 + 1.25 * (pop - 0.16), 0.05, 0.95) * (0.4 + 0.6 * pal.night);
  const unlit = css(mix(rgb("#0a0c18"), pal.s[1], 0.1 + 0.24 * pal.amb));
  for (let i = 0; i < town.length; i++) {
    const b = town[i];
    const top = QUAY - b.h;
    ctx.fillStyle = facade(b.base, pal);
    ctx.fillRect(b.x, top, b.w, b.h);
    ctx.fillStyle = css(mix(rgb(b.base), rgb("#e8e4d4"), 0.12 * pal.amb + 0.08));
    ctx.fillRect(b.x, top, b.w, 1);
    // windows: density is the town's population made visible
    for (let wy = top + 3; wy + 3 <= QUAY - 2; wy += 6) {
      for (let wx = b.x + 2; wx + 2 <= b.x + b.w - 2; wx += 5) {
        const k = i * 131 + wx * 7.1 + wy * 13.7 + (mirror ? 999 : 0);
        ctx.fillStyle = hash(k) < litP ? WARM[(hash(k * 3) * WARM.length) | 0] : unlit;
        ctx.fillRect(wx, wy, 2, 3);
      }
    }
    if (b.factory) {
      // stacks; smoke rises with the boom
      ctx.fillStyle = facade("#1a1420", pal);
      const s1 = mirror ? b.x + b.w - 8 : b.x + 4;
      const s2 = mirror ? b.x + b.w - 16 : b.x + 12;
      ctx.fillRect(s1, top - 8, 3, 8);
      ctx.fillRect(s2, top - 5, 3, 5);
      if (boom > 0.12) {
        ctx.fillStyle = `rgba(200,200,210,${0.3 * boom})`;
        for (let j = 0; j < 4; j++) {
          const p = (t * 0.42 + j * 0.25 + (mirror ? 0.5 : 0)) % 1;
          ctx.fillRect(
            R(s1 + 1 + Math.sin((p + j) * 6) * (2 + p * 3) * (mirror ? -1 : 1)),
            R(top - 10 - p * 16),
            2 + (p > 0.5 ? 1 : 0),
            1,
          );
        }
      }
    }
    if (b.pennant) {
      ctx.fillStyle = "#3a3a44";
      ctx.fillRect(b.x + ((b.w / 2) | 0), top - 9, 1, 9);
      ctx.fillStyle = pennant;
      const wave = Math.sin(t * 3 + (mirror ? 2 : 0)) > 0 ? 6 : 5;
      const fx = b.x + ((b.w / 2) | 0) + (mirror ? -wave : 1);
      ctx.fillRect(fx, top - 9, wave, 2);
      ctx.fillRect(fx + (mirror ? 1 : 0), top - 7, wave - 1, 1);
    }
  }

  // the letting office at the bridge foot — and the queue that grows as
  // the town fills past half: crowding, eating the advantage
  const kx = mirror ? KIOSK_B : KIOSK_A;
  const queueN = Math.round(clamp(pop - 0.52, 0, 0.35) * 22);
  ctx.fillStyle = facade("#2a2438", pal);
  ctx.fillRect(kx, QUAY - 10, 10, 10);
  ctx.fillStyle = pal.night > 0.35 || pop > 0.52 ? "#ffd27a" : css(pal.s[2]);
  ctx.fillRect(kx + 3, QUAY - 7, 4, 4);
  // when the line gets long the vacancy lamp turns red and blinks
  if (queueN >= 4) {
    ctx.fillStyle = (t % 1.6) < 0.9 ? "#ff5a5a" : "#7a2626";
    ctx.fillRect(kx + 3, QUAY - 12, 4, 2);
  }
  // figures read as ink by day, lamplit by night
  const figC = css(mix(rgb("#14161f"), rgb("#d6d0bc"), pal.night * 0.85));
  ctx.fillStyle = figC;
  for (let q = 0; q < queueN; q++) {
    const qx = mirror ? kx + 13 + q * 5 : kx - 5 - q * 5;
    const bob = hash(q * 3.1 + (mirror ? 7 : 0) + Math.floor(t * 1.4)) < 0.12 ? 1 : 0;
    ctx.fillRect(qx, QUAY - 4 - bob, 2, 4 + bob);
  }
  // a few strollers on the quay, more when the town is fuller
  const wn = Math.round(pop * 6);
  for (let i = 0; i < wn; i++) {
    const range = mirror ? [TWIN_W - 160, TWIN_W - 24] : [24, 160];
    const x = range[0] + ((hash(i * 5.9 + (mirror ? 31 : 0)) * (range[1] - range[0]) + t * (4 + hash(i) * 5)) % (range[1] - range[0]));
    ctx.fillRect(R(x), QUAY - 3, 1, 3);
  }
}

/** Export money: gold flecks arcing from the moored ship up into town. */
function drawShipAndGold(ctx: Ctx, t: number, pal: Palette, boom: number, mirror: boolean) {
  if (boom < 0.08) return;
  const sx = mirror ? TWIN_W - 34 : 34; // ship mid
  ctx.globalAlpha = Math.min(1, boom * 1.5);
  ctx.fillStyle = css(mix(rgb("#c98500"), rgb("#241c10"), pal.night * 0.45));
  ctx.fillRect(sx - 14, HORIZON + 4, 28, 4); // hull
  ctx.fillStyle = css(mix(rgb("#e8e4d4"), rgb("#3a3a44"), pal.night * 0.5));
  ctx.fillRect(sx - 5, HORIZON - 1, 10, 5); // house
  ctx.fillRect(sx + 7, HORIZON - 3, 2, 7); // mast
  ctx.globalAlpha = 1;
  // flecks: paychecks arcing off the ship, up and over the town
  const tx = mirror ? TWIN_W - 118 : 118;
  const n = Math.round(boom * 8);
  ctx.fillStyle = "#ffd76a";
  for (let i = 0; i < n; i++) {
    const p = (t * 0.4 + hash(i * 7.7)) % 1;
    const x = sx + (tx - sx) * p;
    const y = HORIZON - 4 - Math.sin(p * Math.PI) * (62 + hash(i) * 22);
    ctx.globalAlpha = Math.min(1, boom * 1.6) * (0.55 + 0.45 * Math.sin(p * Math.PI));
    ctx.fillRect(R(x), R(y), 2, p > 0.6 ? 1 : 2);
  }
  ctx.globalAlpha = 1;
}

/** Trouble at home: a private rain cloud over one town only. */
function drawLocalRain(ctx: Ctx, t: number, town: Bld[], amen: number, mirror: boolean) {
  const r = 1 - amen;
  if (r < 0.08) return;
  const x0 = mirror ? TWIN_W - 170 : 6;
  const x1 = mirror ? TWIN_W - 6 : 170;
  // gloom over that half
  ctx.fillStyle = `rgba(16,18,26,${0.22 * r})`;
  ctx.fillRect(x0, 0, x1 - x0, QUAY);
  // the cloud
  ctx.fillStyle = `rgba(38,43,58,${0.85 * r})`;
  const cx = (x0 + x1) / 2;
  ctx.fillRect(R(cx - 46 + Math.sin(t * 0.4) * 3), 66, 92, 8);
  ctx.fillRect(R(cx - 30 + Math.sin(t * 0.4) * 3), 60, 56, 6);
  // streaks
  ctx.fillStyle = `rgba(178,198,232,${0.55 * r})`;
  const n = Math.round(r * 30);
  for (let i = 0; i < n; i++) {
    const x = x0 + 8 + hash(i * 3.3) * (x1 - x0 - 16);
    const y = 78 + ((hash(i * 8.1) * 110 + t * 105) % (QUAY - 82));
    ctx.fillRect(R(x), R(y), 1, 4);
  }
  void town;
}

const TRUCK_TONES = ["#c3c2b7", "#c96a4a", "#5a7fae", "#b3893a"];

/** The story bridge's little moving truck: box, low cab, night lights. */
function drawTruck(ctx: Ctx, x: number, headRight: boolean, i: number, pal: Palette) {
  ctx.fillStyle = TRUCK_TONES[i % TRUCK_TONES.length];
  ctx.fillRect(R(x), DECK - 5, 9, 4);
  ctx.fillStyle = css(mix(rgb("#1a2034"), pal.s[1], 0.2 * pal.amb));
  ctx.fillRect(headRight ? R(x) + 9 : R(x) - 3, DECK - 3, 3, 2);
  if (pal.night > 0.35) {
    ctx.fillStyle = "#ffe9b0";
    ctx.fillRect(headRight ? R(x) + 12 : R(x) - 4, DECK - 2, 1, 1);
    ctx.fillStyle = "#ff6a5a";
    ctx.fillRect(headRight ? R(x) - 1 : R(x) + 9, DECK - 2, 1, 1);
  }
}

/* ——— the scene ——— */

export function drawTwin(ctx: Ctx, t: number, s: TwinScene) {
  const h = ((s.hour % 24) + 24) % 24;
  const gloom = Math.max(1 - s.amenA, 1 - s.amenB) * 0.5;
  const pal = paletteAt(h, gloom * 0.4);

  // the ledger drifts toward the current deal; a long gap (static path,
  // reduced motion, first paint) snaps it straight to the equilibrium
  let st = LEDGER.get(ctx);
  if (!st) LEDGER.set(ctx, (st = { popB: 0.5, last: t }));
  const dt = t - st.last;
  st.last = t;
  const eq = equilibriumPopB(s);
  if (dt <= 0 || dt > 0.5) st.popB = eq;
  else st.popB += (eq - st.popB) * (1 - Math.exp(-dt * 0.33));
  const popB = st.popB;
  const popA = 1 - popB;
  // net flow on the bridge: the imbalance still being worked off
  const net = clamp((eq - popB) * 9, -1, 1);
  // publish the model state for the widget's instrument panel
  {
    const { W_BOOM, W_AMEN, W_CROWD } = TWIN_MODEL;
    const wageA = W_BOOM * s.boomA;
    const wageB = W_BOOM * s.boomB;
    const amenA = W_AMEN * s.amenA;
    const amenB = W_AMEN * s.amenB;
    const crowdA = W_CROWD * popA;
    const crowdB = W_CROWD * popB;
    st.out = {
      shareA: popA,
      shareB: popB,
      wageA,
      wageB,
      amenA,
      amenB,
      crowdA,
      crowdB,
      dealA: wageA + amenA - crowdA,
      dealB: wageB + amenB - crowdB,
      net,
    };
  }

  // sky, stars, sun
  skyGradient(ctx, TWIN_W, TWIN_H, STOP_AT.map((at, i) => ({ at, c: pal.s[i] as RGB })));
  if (pal.night > 0.12) drawStars(ctx, STARS, t, pal.night * (1 - gloom));
  drawSunMoon(ctx, h, pal, gloom);

  // far shore between the towns
  ctx.fillStyle = css(mix(pal.s[2], rgb("#0c1020"), 0.45 + pal.night * 0.2));
  for (let x = TWR_L - 20; x < TWR_R + 20; x++) {
    const y = R(HORIZON - 6 - 4 * (0.5 + 0.5 * Math.sin(x * 0.05 + 2)));
    ctx.fillRect(x, y, 1, HORIZON - y);
  }

  // quays
  const quayC = css(mix(mix(rgb("#2a2c38"), rgb("#8e8d94"), 0.28 * pal.amb), rgb("#11131f"), pal.night * 0.5));
  ctx.fillStyle = quayC;
  ctx.fillRect(0, QUAY, 190, HORIZON - QUAY);
  ctx.fillRect(TWIN_W - 190, QUAY, 190, HORIZON - QUAY);

  /* — the bridge: a tied arch between two portal towers at the water's
       edge, its deck running on over trestles to vanish into each town —
       drawn before the towns so the bridge-foot buildings swallow the
       deck ends and the trucks driving in and out of town — */
  const steel = mix(pal.s[2], rgb("#141a3c"), 0.72);
  const bridgeC = css(mix(steel, rgb("#4a5578"), pal.night * 0.35));
  const kerbC = css(mix(mix(steel, rgb("#4a5578"), pal.night * 0.35), rgb("#c9c4d6"), 0.14 + 0.26 * pal.amb));
  const underC = css(mix(steel, rgb("#06070d"), 0.45));
  ctx.fillStyle = bridgeC;
  ctx.fillRect(DECK_X0, DECK + 1, DECK_X1 - DECK_X0, 2); // roadbed
  ctx.fillStyle = underC;
  ctx.fillRect(DECK_X0, DECK + 3, DECK_X1 - DECK_X0, 1); // girder shadow
  ctx.fillStyle = kerbC;
  ctx.fillRect(DECK_X0, DECK, DECK_X1 - DECK_X0, 1); // lit kerb — the road line
  ctx.fillStyle = bridgeC;
  ctx.fillRect(178, DECK + 4, 2, QUAY - DECK - 4); // approach trestles on the quays
  ctx.fillRect(300, DECK + 4, 2, QUAY - DECK - 4);
  // portal towers: one clean vertical each side, deck parapet to riverbed
  ctx.fillRect(TWR_L - 3, DECK - 5, 6, HORIZON + 6 - (DECK - 5));
  ctx.fillRect(TWR_R - 3, DECK - 5, 6, HORIZON + 6 - (DECK - 5));
  ctx.fillStyle = kerbC;
  ctx.fillRect(TWR_L - 3, DECK - 5, 6, 1); // caps
  ctx.fillRect(TWR_R - 3, DECK - 5, 6, 1);
  // the arch crests over midspan and springs exactly at the towers
  ctx.fillStyle = bridgeC;
  const archY = (x: number) => CREST + K_ARCH * (x - 240) * (x - 240);
  for (let x = TWR_L; x <= TWR_R; x++) {
    const y = R(archY(x));
    if (y <= DECK) {
      ctx.fillRect(x, y, 1, 2);
      if (x % 7 === 3 && DECK - y > 4) ctx.fillRect(x, y + 2, 1, DECK - y - 2); // hangers
    }
  }
  if (pal.night > 0.3) {
    ctx.fillStyle = `rgba(255,223,154,${0.5 + 0.5 * pal.night})`;
    for (let x = TWR_L + 2; x < TWR_R; x += 9) {
      const y = R(archY(x));
      if (y <= DECK) ctx.fillRect(x, y - 1, 1, 1); // the necklace
    }
    for (let x = DECK_X0 + 6; x < DECK_X1; x += 14) ctx.fillRect(x, DECK - 1, 1, 1); // deck lamps
    if ((t % 2.1) < 0.13) {
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(239, CREST - 2, 1, 1); // crest beacon
    }
  }

  // traffic: churn both ways, always on deck — plus the net flow still
  // being worked off. Journeys run from behind one town's buildings to
  // behind the other's: no mid-air arrivals.
  const X0 = DECK_X0 - 10;
  const SP = DECK_X1 - DECK_X0 + 8;
  const churnE = X0 + ((hash(1.7) * SP + t * 16) % SP);
  const churnW = X0 + SP - ((hash(4.2) * SP + t * 14) % SP) - 12;
  drawTruck(ctx, churnW, false, 1, pal);
  drawTruck(ctx, churnE, true, 0, pal);
  const extra = Math.round(Math.min(1, Math.abs(net)) * 3);
  const gate = clamp(Math.abs(net) / 0.1, 0, 1);
  for (let i = 0; i < extra; i++) {
    const raw = (hash(i * 7.3 + 2) * SP + t * (22 + i * 3) + i * 47) % SP;
    const east = net >= 0;
    const x = east ? X0 + raw : X0 + SP - raw - 12;
    ctx.globalAlpha = gate;
    drawTruck(ctx, x, east, i + 2, pal);
    ctx.globalAlpha = 1;
  }

  // towns (private weather first, so buildings sit over the gloom)
  drawLocalRain(ctx, t, TOWN_A, s.amenA, false);
  drawLocalRain(ctx, t, TOWN_B, s.amenB, true);
  drawTown(ctx, t, pal, TOWN_A, popA, s.boomA, ALBA, false);
  drawTown(ctx, t, pal, TOWN_B, popB, s.boomB, BRUMA, true);

  // water first, then everything that stands in it
  reflectWater(ctx, TWIN_W, HORIZON, 46, t, css(mix(pal.s[0], rgb("#050810"), 0.5)), 0.44);
  ctx.fillStyle = css(mix(pal.s[0], rgb("#04060c"), 0.72));
  ctx.fillRect(0, HORIZON + 46, TWIN_W, TWIN_H - HORIZON - 46);
  ctx.fillStyle = css(mix(rgb("#141a3c"), rgb("#04060c"), 0.4));
  ctx.fillRect(TWR_L - 3, HORIZON, 6, 7); // tower feet in the water
  ctx.fillRect(TWR_R - 3, HORIZON, 6, 7);
  drawShipAndGold(ctx, t, pal, s.boomA, false);
  drawShipAndGold(ctx, t, pal, s.boomB, true);
  if (pal.night > 0.25) {
    waterGlints(ctx, TWIN_W, HORIZON, 40, t, `rgba(255,223,154,${0.3 * pal.night})`, 8);
  }
}
