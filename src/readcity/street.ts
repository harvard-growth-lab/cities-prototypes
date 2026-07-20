import { seededRandom } from "../pixel/hooks";
import { clamp, css, hash, mix, mixHex, rgb, skyGradient, type Ctx } from "../pixel/pixel";
import { R, drawStars, genStars, lineDots } from "../pixel/bits";
import { WARM, litShareAt, paletteAt, STOP_AT, walkersAt, type Palette } from "../pixel/palette";

/**
 * Street level — the same city from the quay: the container ship and its
 * gantry on the left, the works behind them, and five shops of Main Street
 * running right. The oxygen machine in one elevation: boxes leave, money
 * arrives, paychecks walk down the street and light the tills. Turn the
 * factory off and watch the multiplier run in reverse.
 */

export const ST_W = 480;
export const ST_H = 270;

const W = ST_W;
const H = ST_H;
const BASE = 214; // building base / back of sidewalk
const CURB = 234; // sidewalk front edge
const FEET = 231; // walkers' feet
const SEA_TOP = 166; // far edge of the basin
const WALL_TOP = 206; // quay wall coping
const DECKLINE = 190; // ship's deck

export type StScene = {
  hour: number; // sky
  factory: number; // 0..1 the plant: smoke, windows, gate
  ship: number; // 0..1 berth activity: ship, gantry, departures
  shops: number; // 0..1 how much of Main Street is open
  workers: number; // 0..1 hi-vis paychecks on the sidewalk
  tourists: number; // 0..1 tour boat + visitors
  gold: number; // 0..1 make the money visible
};

/* ——— layout ——— */

const FACT_X = 150;
const FACT_W = 92; // 150..242
const SHOP_W = 44;
const SHOPS_X = [246, 294, 342, 390, 438];

interface Shop {
  x: number;
  awnA: string;
  awnB: string;
  brick: string;
  thr: number; // closes when s.shops falls below this
  kind: "bakery" | "grocer" | "books" | "diner" | "barber";
}

const SHOPS: Shop[] = [
  { x: SHOPS_X[0], awnA: "#c96a4a", awnB: "#e8d8b8", brick: "#3a2428", thr: 0.5, kind: "bakery" },
  { x: SHOPS_X[1], awnA: "#3d7a5f", awnB: "#e8d8b8", brick: "#2e2a3c", thr: 0.68, kind: "grocer" },
  { x: SHOPS_X[2], awnA: "#8a6bbf", awnB: "#cabade", brick: "#3c3226", thr: 0.82, kind: "books" },
  { x: SHOPS_X[3], awnA: "#b3893a", awnB: "#e8d8b8", brick: "#262e2c", thr: 0.3, kind: "diner" },
  { x: SHOPS_X[4], awnA: "#5a7fae", awnB: "#dae4f0", brick: "#342238", thr: 0.06, kind: "barber" },
];

const FLAT_WINS = (() => {
  const rng = seededRandom(808);
  const wins: { x: number; y: number; thr: number; warm: string }[] = [];
  for (const s of SHOPS) {
    for (let f = 0; f < 3; f++) {
      for (let c = 0; c < 3; c++) {
        wins.push({
          x: s.x + 6 + c * 13,
          y: 134 + f * 18,
          thr: 0.06 + rng() * 0.9,
          warm: WARM[(rng() * WARM.length) | 0],
        });
      }
    }
  }
  return wins;
})();

const BACKDROP = (() => {
  const rng = seededRandom(99);
  const out: { x: number; w: number; h: number; spire?: boolean }[] = [];
  let x = -4;
  let i = 0;
  while (x < W) {
    const w = 16 + ((rng() * 24) | 0);
    const h = (26 + rng() * rng() * 62) | 0;
    out.push({ x, w, h, spire: i === 7 });
    x += w + 2 + ((rng() * 6) | 0);
    i++;
  }
  return out;
})();

const STARS = genStars(17, 60, W, 100);

const WALK_TONES = ["#c3c2b7", "#8a92b8", "#b08a6a", "#7a9a8a", "#a87c8a", "#c9b47a"];
const BOX_COLS = ["#c96a4a", "#3d7a5f", "#5a7fae", "#b3893a", "#8a6bbf"];

/* ——— the berth ——— */

/** Ship cycle: 32s at berth loading, 6s steaming out, 8s gap, repeat. */
const SHIP_T = 46;
const MOVE_T = 8;
const DROP_AT = 6.8; // seconds into a move when the spreader lets go

function shipPos(t: number): number | null {
  const ph = t % SHIP_T;
  if (ph < 32) return 8;
  if (ph < 38) {
    const k = (ph - 32) / 6;
    return 8 - k * k * 140;
  }
  return null;
}

/** Boxes on deck: arrives with 8; each crane move lands one at DROP_AT. */
function loadedBoxes(t: number): number {
  const ph = t % SHIP_T;
  if (ph >= 32) return 12;
  const landed = ph % MOVE_T >= DROP_AT ? 1 : 0;
  return Math.min(12, 8 + Math.floor(ph / MOVE_T) + landed);
}

function drawBasin(ctx: Ctx, t: number, pal: Palette, s: StScene) {
  // water: sky-tinted, darker toward the near wall, restless rows
  const far = mix(rgb("#16233f"), pal.s[3], 0.14 + 0.3 * pal.amb);
  const near = mix(rgb("#0a1226"), pal.s[2], 0.1 + 0.14 * pal.amb);
  // the basin runs flush to the works' wall — no bare column at the seam
  for (let y = SEA_TOP; y < WALL_TOP; y++) {
    const u = (y - SEA_TOP) / (WALL_TOP - SEA_TOP);
    ctx.fillStyle = css(mix(far, near, u));
    ctx.fillRect(0, y, FACT_X, 1);
  }
  ctx.fillStyle = css(mix(far, rgb("#dde4ec"), 0.2 + 0.2 * pal.amb));
  ctx.fillRect(0, SEA_TOP, FACT_X, 1); // far edge catch-light
  for (let y = SEA_TOP + 2; y < WALL_TOP - 1; y += 2) {
    const u = (y - SEA_TOP) / (WALL_TOP - SEA_TOP);
    for (let j = 0; j < 3; j++) {
      const gx = (hash(j * 5.1 + y * 1.7 + Math.floor(t * (1.2 + u))) * 142) | 0;
      ctx.fillStyle = `rgba(168,192,224,${0.05 + 0.09 * pal.amb + 0.03 * u})`;
      ctx.fillRect(gx, y, 3 + ((hash(j + y) * (4 + u * 8)) | 0), 1);
    }
  }

  // the ship
  const sx0 = s.ship > 0.1 ? shipPos(t) : null;
  if (sx0 !== null && sx0 > -130) {
    const x = R(sx0);
    const loaded = loadedBoxes(t);
    // hull
    ctx.fillStyle = "#141a30";
    ctx.fillRect(x, DECKLINE, 90, 12);
    ctx.fillStyle = "#7a3040";
    ctx.fillRect(x, DECKLINE + 9, 90, 3);
    ctx.fillStyle = "#1e2438";
    ctx.fillRect(x, DECKLINE, 90, 1);
    ctx.fillStyle = "rgba(6,10,24,0.55)";
    ctx.fillRect(x + 2, DECKLINE + 13, 86, 2); // waterline shadow
    // deck boxes
    for (let i = 0; i < loaded; i++) {
      const c = i % 5;
      const l = (i / 5) | 0;
      ctx.fillStyle = BOX_COLS[(i * 3 + 1) % BOX_COLS.length];
      ctx.fillRect(x + 12 + c * 12, DECKLINE - 6 - l * 5, 10, 5);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + 12 + c * 12, DECKLINE - 2 - l * 5, 10, 1);
    }
    // bridge castle aft
    ctx.fillStyle = "#c3c6d4";
    ctx.fillRect(x + 76, DECKLINE - 18, 13, 18);
    ctx.fillStyle = "#12182c";
    ctx.fillRect(x + 78, DECKLINE - 15, 3, 2);
    ctx.fillRect(x + 84, DECKLINE - 15, 3, 2);
    ctx.fillRect(x + 78, DECKLINE - 10, 9, 1);
    ctx.fillStyle = "#3a4160";
    ctx.fillRect(x + 81, DECKLINE - 22, 2, 4);
    if ((t % 2.4) < 0.15) {
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(x + 81, DECKLINE - 23, 1, 1);
    }
    // reflection smudge + wake when leaving
    ctx.fillStyle = "rgba(10,14,28,0.4)";
    ctx.fillRect(x + 4, DECKLINE + 15, 82, 1);
    if (sx0 < 6) {
      for (let k = 1; k < 7; k++) {
        ctx.fillStyle = `rgba(200,214,228,${0.16 * (1 - k / 7)})`;
        ctx.fillRect(x + 90 + k * 5, DECKLINE + 8 + (k % 2), 4, 1);
      }
    }
  }

  // tour boat pottering along the near edge
  if (s.tourists > 0.15) {
    const T = 26;
    const dir = Math.floor(t / T) % 2 === 0 ? 1 : -1;
    const prog = (t % T) / T;
    const bx = R(dir > 0 ? -22 + prog * 170 : 148 - prog * 170);
    const by = WALL_TOP - 8;
    ctx.fillStyle = "#0a0e1e";
    ctx.fillRect(bx, by, 22, 4);
    ctx.fillStyle = "#b3893a";
    ctx.fillRect(bx + 3, by - 6, 16, 2); // canopy
    ctx.fillStyle = "#3a4258";
    ctx.fillRect(bx + 3, by - 4, 1, 4);
    ctx.fillRect(bx + 18, by - 4, 1, 4);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = WALK_TONES[(k * 2 + 1) % WALK_TONES.length];
      ctx.fillRect(bx + 6 + k * 4, by - 4, 2, 4);
    }
    if (hash(Math.floor(t * 3.1)) > 0.86) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(bx + 6 + ((hash(Math.floor(t * 5)) * 12) | 0), by - 5, 1, 1); // camera flash
    }
  }

  // quay wall: coping, weathered face, weep stains, bollards
  ctx.fillStyle = "#2e3650";
  ctx.fillRect(0, WALL_TOP, FACT_X, 2);
  ctx.fillStyle = "#1c2338";
  ctx.fillRect(0, WALL_TOP + 2, FACT_X, BASE - WALL_TOP - 2);
  ctx.fillStyle = "#151b2c";
  for (let x = 5; x < FACT_X; x += 11) ctx.fillRect(x, WALL_TOP + 2, 1, BASE - WALL_TOP - 2);
  ctx.fillStyle = "#232c46";
  ctx.fillRect(0, WALL_TOP + 3, FACT_X, 1);
  for (const bx of [12, 54, 96, 134]) {
    ctx.fillStyle = "#3a4054";
    ctx.fillRect(bx, WALL_TOP - 3, 4, 3);
    ctx.fillStyle = "#12172a";
    ctx.fillRect(bx + 1, WALL_TOP - 2, 2, 1);
  }
  // a life ring on the wall
  ctx.fillStyle = "#c96a4a";
  ctx.fillRect(70, WALL_TOP + 4, 5, 5);
  ctx.fillStyle = "#1c2338";
  ctx.fillRect(71, WALL_TOP + 5, 3, 3);
}

/** The gantry: a sturdy portal on the quay, loading the ship box by box. */
function drawGantry(ctx: Ctx, t: number, pal: Palette, s: StScene) {
  const beamY = 116;
  const legA = 112;
  const legB = 144;
  const col = css(mix(rgb("#252c48"), pal.s[1], 0.05 + 0.1 * pal.amb));
  ctx.fillStyle = col;
  ctx.fillRect(4, beamY, 148, 3); // boom over the berth
  ctx.fillStyle = "rgba(4,5,12,0.4)";
  ctx.fillRect(4, beamY + 3, 148, 1);
  ctx.fillStyle = col;
  ctx.fillRect(legA, beamY + 3, 3, FEET - beamY - 3); // legs down to the quay
  ctx.fillRect(legB, beamY + 3, 3, FEET - beamY - 3);
  ctx.fillRect(legA, 160, legB - legA + 3, 2); // portal tie
  ctx.fillRect(legA - 2, FEET - 2, 7, 2); // feet
  ctx.fillRect(legB - 2, FEET - 2, 7, 2);
  // X-brace above the portal tie
  lineDots(ctx, legA + 3, 158, legB, beamY + 6, 2);
  lineDots(ctx, legA + 3, beamY + 6, legB, 158, 2);
  // machinery house + beacon
  ctx.fillRect(126, beamY - 7, 14, 7);
  ctx.fillStyle = "#ffd27a";
  ctx.fillRect(128, beamY - 5, 2, 2);
  if ((t % 2.2) < 0.13) {
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(132, beamY - 9, 1, 1);
  }

  const working = s.ship > 0.1 && (t % SHIP_T) < 32;
  const pickX = 128;
  const stackTop = 210;
  let trolley = pickX;
  let cab = 8;
  let boxAt: [number, number] | null = null;
  let boxCol = BOX_COLS[0];
  if (working) {
    // this move's box: aim at its exact deck slot, in its deck color, so the
    // landed box is pixel-identical to the one drawBasin shows once it counts
    const idx = Math.min(11, 8 + Math.floor((t % SHIP_T) / MOVE_T));
    const dropX = 25 + (idx % 5) * 12; // box lands on ship slot 8+12+c*12
    const dropY = DECKLINE - 7 - ((idx / 5) | 0) * 5; // box top rests at -6-l*5
    boxCol = BOX_COLS[(idx * 3 + 1) % BOX_COLS.length];
    const ph = (t % SHIP_T) % MOVE_T;
    if (ph < 1.6) {
      cab = 8 + (ph / 1.6) * (stackTop - beamY - 8);
    } else if (ph < 3.2) {
      cab = stackTop - beamY - ((ph - 1.6) / 1.6) * (stackTop - beamY - 22);
      boxAt = [pickX - 5, beamY + cab];
    } else if (ph < 5.4) {
      const k = (ph - 3.2) / 2.2;
      trolley = pickX + (dropX - pickX) * k;
      cab = 22;
      boxAt = [trolley - 5, beamY + cab];
    } else if (ph < DROP_AT) {
      trolley = dropX;
      cab = 22 + ((ph - 5.4) / (DROP_AT - 5.4)) * (dropY - beamY - 22);
      boxAt = [dropX - 5, beamY + cab];
    } else {
      trolley = dropX + (pickX - dropX) * ((ph - DROP_AT) / (MOVE_T - DROP_AT));
      cab = 14;
    }
  }
  ctx.fillStyle = "#565e82";
  ctx.fillRect(R(trolley) - 2, beamY + 3, 5, 2);
  ctx.fillRect(R(trolley), beamY + 5, 1, Math.max(2, R(cab) - 5));
  ctx.fillStyle = "#c9cdd9";
  ctx.fillRect(R(trolley) - 4, beamY + R(cab), 9, 1); // spreader
  if (boxAt) {
    ctx.fillStyle = boxCol;
    ctx.fillRect(R(boxAt[0]), R(boxAt[1]) + 1, 10, 5);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; // same bottom shading as a deck box
    ctx.fillRect(R(boxAt[0]), R(boxAt[1]) + 5, 10, 1);
  }
  // the yard stack, waiting between the legs
  if (s.ship > 0.1) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = BOX_COLS[(i * 2 + 2) % BOX_COLS.length];
      ctx.fillRect(122, 224 - i * 6, 12, 6);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(122, 229 - i * 6, 12, 1);
    }
  }
}

/* ——— the works ——— */

function drawFactory(ctx: Ctx, t: number, pal: Palette, s: StScene) {
  const on = s.factory;
  const top = 122;
  const facade = mix(rgb("#2c1f28"), pal.s[1], 0.05 + 0.18 * pal.amb);
  ctx.fillStyle = css(facade);
  ctx.fillRect(FACT_X, top, FACT_W, BASE - top);
  // sawtooth roof: north-light teeth with a cool glass face
  const toothCol = css(mix(facade, rgb("#04050c"), 0.22));
  for (let x0 = FACT_X + 2; x0 + 12 <= FACT_X + FACT_W - 2; x0 += 12) {
    ctx.fillStyle = toothCol;
    for (let i = 0; i < 6; i++) ctx.fillRect(x0, top - i, 9 - i, 1);
    ctx.fillStyle =
      on > 0.12
        ? mixHex("#9ec8e8", "#ffd27a", pal.night * 0.5)
        : css(mix(rgb("#141826"), pal.s[1], 0.15 + 0.2 * pal.amb));
    ctx.fillRect(x0 + 8 - 5, top - 5, 2, 4); // glass face of the tooth
  }
  ctx.fillStyle = css(mix(facade, rgb("#e8e4d4"), 0.1 * pal.amb + 0.08));
  ctx.fillRect(FACT_X, top, FACT_W, 1);
  // stacks
  for (const sx of [FACT_X + 20, FACT_X + 66]) {
    ctx.fillStyle = "#2a3048";
    ctx.fillRect(sx, top - 28, 5, 30); // barrel, rooted through the roofline
    ctx.fillStyle = "#3a4468";
    ctx.fillRect(sx, top - 22, 5, 1);
    ctx.fillRect(sx, top - 12, 5, 1);
    ctx.fillStyle = "#464e70";
    ctx.fillRect(sx - 1, top - 30, 7, 2);
    if (on > 0.08) {
      for (let k = 0; k < 7; k++) {
        const age = (t * 0.3 + k / 7 + (sx & 7) / 9) % 1;
        const size = 1 + age * 3.4;
        ctx.globalAlpha = (1 - age) * (0.26 + 0.22 * pal.amb) * on;
        ctx.fillStyle = css(mix(pal.s[1], rgb("#9aa0b0"), 0.62));
        ctx.fillRect(
          R(sx + 1 + age * 18 + Math.sin(t * 0.8 + k * 2.1) * 1.6),
          R(top - 33 - age * 24),
          R(size),
          Math.max(1, R(size * 0.7)),
        );
      }
      ctx.globalAlpha = 1;
    }
  }
  // industrial window grid — cool glow when the works run
  const rng = seededRandom(313);
  for (let fy = top + 8; fy < 178; fy += 16) {
    for (let fx = FACT_X + 8; fx < FACT_X + FACT_W - 10; fx += 14) {
      const litHere = on > 0.12 && rng() < 0.3 + on * 0.6;
      ctx.fillStyle = litHere
        ? mixHex("#9ec8e8", "#ffd27a", pal.night * 0.5)
        : css(mix(rgb("#141826"), pal.s[1], 0.12 + 0.2 * pal.amb));
      ctx.fillRect(fx, fy, 9, 10);
      ctx.fillStyle = css(mix(facade, rgb("#04050c"), 0.4));
      ctx.fillRect(fx + 4, fy, 1, 10);
      ctx.fillRect(fx, fy + 5, 9, 1);
      if (!litHere && on < 0.1 && hash(fx * fy) > 0.72) {
        ctx.fillStyle = "#0a0c14"; // broken pane
        ctx.fillRect(fx + 1 + ((hash(fx) * 3) | 0), fy + 1 + ((hash(fy) * 4) | 0), 2, 2);
      }
    }
  }
  // gate
  const gx = FACT_X + 34;
  ctx.fillStyle = css(mix(facade, rgb("#04050c"), 0.35));
  ctx.fillRect(gx - 2, 186, 28, BASE - 186);
  if (on > 0.15) {
    ctx.fillStyle = `rgba(255,210,122,${0.35 + 0.55 * pal.night})`;
    ctx.fillRect(gx, 189, 24, BASE - 189); // open, warm inside
    ctx.fillStyle = "rgba(20,16,20,0.85)";
    ctx.fillRect(gx + 11, 189, 2, BASE - 189); // door split
  } else {
    ctx.fillStyle = "#3a3448";
    ctx.fillRect(gx, 189, 24, BASE - 189);
    ctx.fillStyle = "#23202e";
    for (let x = gx + 2; x < gx + 24; x += 4) ctx.fillRect(x, 189, 1, BASE - 189);
    ctx.fillStyle = "#6a6458"; // the chain
    lineDots(ctx, gx + 1, 196, gx + 23, 202, 2);
    ctx.fillStyle = "#e8e4d8"; // the notice
    ctx.fillRect(gx + 9, 194, 6, 7);
    ctx.fillStyle = "#8a2f2a";
    ctx.fillRect(gx + 10, 196, 4, 1);
    ctx.fillRect(gx + 10, 198, 4, 1);
  }
  // sign board over the gate — lit while the works breathe
  ctx.fillStyle = "#20263a";
  ctx.fillRect(gx - 4, 178, 32, 7);
  ctx.fillStyle = on > 0.15 ? "#e8b84b" : "#4a4658";
  for (let i = 0; i < 5; i++) ctx.fillRect(gx - 1 + i * 6, 180, 4, 3);
  if (on > 0.15 && pal.night > 0.3) {
    ctx.fillStyle = "rgba(232,184,75,0.12)";
    ctx.fillRect(gx - 6, 176, 36, 11);
  }
}

/* ——— Main Street ——— */

function shopState(shop: Shop, sVal: number): "open" | "closed" | "boarded" {
  if (sVal >= shop.thr) return "open";
  if (sVal >= shop.thr - 0.22) return "closed";
  return "boarded";
}

function drawGoods(ctx: Ctx, shop: Shop, gx: number) {
  // a shelf of wares in the window, one signature per trade
  if (shop.kind === "bakery") {
    ctx.fillStyle = "#6a4a32";
    ctx.fillRect(gx, 207, 18, 1);
    ctx.fillStyle = "#d8a878";
    for (let i = 0; i < 3; i++) ctx.fillRect(gx + 2 + i * 6, 204, 4, 3);
  } else if (shop.kind === "grocer") {
    ctx.fillStyle = "#3d7a5f";
    ctx.fillRect(gx + 1, 205, 6, 4);
    ctx.fillStyle = "#c96a4a";
    ctx.fillRect(gx + 9, 205, 6, 4);
    ctx.fillStyle = "#e8b84b";
    ctx.fillRect(gx + 5, 203, 6, 2);
  } else if (shop.kind === "books") {
    const spines = ["#8a6bbf", "#c96a4a", "#3d7a5f", "#5a7fae", "#b3893a"];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = spines[i];
      ctx.fillRect(gx + 2 + i * 3, 203 - (i % 2), 2, 6 + (i % 2));
    }
  } else if (shop.kind === "diner") {
    ctx.fillStyle = "#4a3a48";
    ctx.fillRect(gx, 206, 18, 2); // counter
    ctx.fillStyle = "#c3c2b7";
    ctx.fillRect(gx + 3, 203, 4, 3); // coffee urn
    ctx.fillStyle = "#c94a4a";
    ctx.fillRect(gx + 12, 204, 2, 2); // ketchup
  } else {
    ctx.fillStyle = "#3a3040";
    ctx.fillRect(gx + 4, 204, 5, 5); // the chair
    ctx.fillStyle = "#c9ccd8";
    ctx.fillRect(gx + 12, 202, 4, 6); // the mirror
  }
}

function drawShop(ctx: Ctx, shop: Shop, t: number, pal: Palette, s: StScene, litW: number) {
  const x = shop.x;
  const state = shopState(shop, s.shops);
  const brick = mix(rgb(shop.brick), pal.s[1], 0.06 + 0.2 * pal.amb);
  // flats above
  ctx.fillStyle = css(brick);
  ctx.fillRect(x, 128, SHOP_W, 60);
  ctx.fillStyle = css(mix(brick, rgb("#e8e4d4"), 0.1 * pal.amb + 0.08));
  ctx.fillRect(x, 128, SHOP_W, 1);
  ctx.fillStyle = css(mix(brick, rgb("#04050c"), 0.3));
  ctx.fillRect(x + SHOP_W - 1, 128, 1, 60);
  const flatLit = litW * (0.45 + 0.55 * s.shops);
  for (const wn of FLAT_WINS) {
    if (wn.x < x || wn.x > x + SHOP_W) continue;
    const lit = wn.thr < flatLit;
    ctx.fillStyle = lit ? wn.warm : css(mix(rgb("#100f1e"), pal.s[1], 0.1 + 0.22 * pal.amb));
    ctx.fillRect(wn.x, wn.y, 5, 6);
    ctx.fillStyle = css(mix(brick, rgb("#04050c"), 0.35));
    ctx.fillRect(wn.x, wn.y + 6, 5, 1); // sill
  }
  // cornice + pilasters framing the ground floor
  ctx.fillStyle = css(mix(brick, rgb("#e8e4d4"), 0.14));
  ctx.fillRect(x, 186, SHOP_W, 2);
  ctx.fillStyle = css(mix(brick, rgb("#04050c"), 0.2));
  ctx.fillRect(x, 188, 2, BASE - 188);
  ctx.fillRect(x + SHOP_W - 2, 188, 2, BASE - 188);

  if (state === "boarded") {
    ctx.fillStyle = css(mix(rgb(shop.awnA), rgb("#2e2e36"), 0.85));
    ctx.fillRect(x + 2, 188, SHOP_W - 4, 6); // dead fascia
    ctx.fillStyle = "#6a5a40";
    ctx.fillRect(x + 2, 194, SHOP_W - 4, BASE - 194);
    ctx.fillStyle = "#57482f";
    for (let y = 196; y < BASE; y += 5) ctx.fillRect(x + 2, y, SHOP_W - 4, 1);
    ctx.fillStyle = "#4a3d28";
    ctx.fillRect(x + 12, 194, 1, BASE - 194);
    ctx.fillRect(x + 30, 194, 1, BASE - 194);
    ctx.fillStyle = "#e8e4d8";
    ctx.fillRect(x + 17, 199, 9, 7); // FOR RENT
    ctx.fillStyle = "#8a2f2a";
    ctx.fillRect(x + 18, 201, 7, 1);
    ctx.fillRect(x + 18, 203, 7, 1);
    return;
  }

  const open = state === "open";
  // fascia sign
  ctx.fillStyle = open
    ? css(mix(rgb(shop.awnA), rgb("#141220"), 0.5))
    : css(mix(rgb(shop.awnA), rgb("#2e2e36"), 0.75));
  ctx.fillRect(x + 2, 188, SHOP_W - 4, 6);
  ctx.fillStyle = open ? "#e8dcc0" : "#5a5664";
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 12 + i * 5, 190, 3, 2); // sign letters
  // awning
  ctx.fillStyle = open ? shop.awnA : css(mix(rgb(shop.awnA), rgb("#3a3a42"), 0.72));
  ctx.fillRect(x + 1, 194, SHOP_W - 2, 5);
  ctx.fillStyle = open ? shop.awnB : css(mix(rgb(shop.awnB), rgb("#3a3a42"), 0.72));
  for (let a = x + 4; a < x + SHOP_W - 3; a += 6) ctx.fillRect(a, 194, 2, 5);
  for (let a = x + 2; a < x + SHOP_W - 2; a += 4) ctx.fillRect(a, 199, 2, 1); // scallop
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 1, 198, SHOP_W - 2, 1);

  // shopfront: framed glass + door
  ctx.fillStyle = "#1a1626";
  ctx.fillRect(x + 2, 200, SHOP_W - 4, BASE - 200);
  const glassCol = open
    ? `rgba(255,214,140,${0.3 + 0.62 * pal.night})`
    : css(mix(rgb("#0b0e1a"), pal.s[1], 0.08 + 0.14 * pal.amb));
  ctx.fillStyle = glassCol;
  ctx.fillRect(x + 4, 202, SHOP_W - 16, 10);
  ctx.fillStyle = open ? "#2a2234" : "#141220";
  ctx.fillRect(x + SHOP_W - 10, 201, 6, BASE - 201); // door
  if (open) {
    ctx.fillStyle = "#c9b47a";
    ctx.fillRect(x + SHOP_W - 9, 206, 1, 2); // handle
    drawGoods(ctx, shop, x + 6);
    // somebody at the counter now and then
    if (hash(shop.x * 3 + Math.floor(t / 4)) > 0.45) {
      const px = x + 8 + ((hash(shop.x + Math.floor(t / 4)) * (SHOP_W - 26)) | 0);
      ctx.fillStyle = "rgba(24,20,28,0.9)";
      ctx.fillRect(px, 202, 2, 2);
      ctx.fillRect(px, 204, 2, 8);
    }
    if (pal.night > 0.3) {
      ctx.fillStyle = `rgba(255,214,140,${0.14 * pal.night})`;
      ctx.fillRect(x + 2, CURB - 2, SHOP_W - 6, 4); // spill onto the pavement
    }
  } else {
    ctx.fillStyle = "#e8e4d8"; // FOR RENT in the dark window
    ctx.fillRect(x + 9, 203, 8, 6);
    ctx.fillStyle = "#8a2f2a";
    ctx.fillRect(x + 10, 205, 6, 1);
  }
  // identity marks
  if (shop.kind === "barber") {
    ctx.fillStyle = "#e8e4d8";
    ctx.fillRect(x - 2, 196, 3, 9);
    for (let i = 0; i < 4; i++) {
      const yy = 196 + ((i * 3 + (open ? Math.floor(t * 4) : 0)) % 9);
      ctx.fillStyle = i % 2 ? "#c94a4a" : "#4a6ac9";
      ctx.fillRect(x - 2, yy, 3, 1);
    }
  } else if (shop.kind === "bakery" && open) {
    ctx.fillStyle = "#3a3448"; // A-board on the pavement
    ctx.fillRect(x + 13, CURB - 8, 6, 8);
    ctx.fillStyle = "#e8d8b8";
    ctx.fillRect(x + 14, CURB - 7, 4, 5);
  } else if (shop.kind === "diner" && open && pal.night > 0.25) {
    const ph = Math.floor(t / 1.3) % 2;
    ctx.fillStyle = ph ? "#ff7ab0" : "#5ad8d0";
    ctx.fillRect(x + 6, 184, 14, 2); // neon strip above the fascia
    ctx.fillStyle = "rgba(255,122,176,0.12)";
    ctx.fillRect(x + 4, 182, 18, 6);
  }
}

/* ——— sidewalk life ——— */

interface Walker {
  phase: number;
  speed: number;
  tone: string;
}

const REGULARS: Walker[] = (() => {
  const rng = seededRandom(2024);
  return Array.from({ length: 7 }, (_, i) => ({
    phase: rng() * 400,
    speed: (9 + rng() * 8) * (rng() < 0.5 ? -1 : 1),
    tone: WALK_TONES[i % WALK_TONES.length],
  }));
})();

const CREW: Walker[] = (() => {
  const rng = seededRandom(4141);
  return Array.from({ length: 5 }, (_, i) => ({
    phase: rng() * 300,
    speed: (11 + rng() * 6) * (i % 2 ? -1 : 1),
    tone: "#e8823a",
  }));
})();

/** Walkers pace a range of the sidewalk (never out over the water). */
function walkerX(wk: Walker, t: number, x0: number, x1: number): number {
  const span = x1 - x0;
  const raw = ((wk.phase + t * wk.speed) % span + span) % span;
  return x0 + raw;
}

function drawWalker(ctx: Ctx, x: number, t: number, i: number, tone: string, hivis: boolean) {
  const step = Math.floor(t * 6 + i * 3) % 2;
  ctx.fillStyle = "#d8a878";
  ctx.fillRect(R(x), FEET - 8, 2, 2); // head
  ctx.fillStyle = tone;
  ctx.fillRect(R(x), FEET - 6, 2, 4); // torso
  if (hivis) {
    ctx.fillStyle = "#f4f0e0";
    ctx.fillRect(R(x), FEET - 5, 2, 1); // the stripe
  }
  ctx.fillStyle = "#20242f";
  ctx.fillRect(R(x) - (step ? 1 : 0), FEET - 2, 1, 2);
  ctx.fillRect(R(x) + (step ? 2 : 1), FEET - 2, 1, 2);
}

function drawStreetLife(ctx: Ctx, t: number, pal: Palette, s: StScene) {
  // sidewalk
  ctx.fillStyle = "#20263a";
  ctx.fillRect(0, BASE, W, CURB - BASE);
  ctx.fillStyle = "#181d2e";
  for (let x = 6; x < W; x += 13) ctx.fillRect(x, BASE, 1, CURB - BASE);
  ctx.fillStyle = "#2c3450";
  ctx.fillRect(0, BASE, W, 1);
  ctx.fillStyle = "#0e1120";
  ctx.fillRect(0, CURB, W, 2); // curb
  // roadway
  ctx.fillStyle = "#161a2a";
  ctx.fillRect(0, CURB + 2, W, H - CURB - 2);
  ctx.fillStyle = "#3a4054";
  for (let x = 4; x < W; x += 12) ctx.fillRect(x, 252, 6, 1);

  // lamps + hydrant
  const lampOn = pal.night > 0.28;
  for (const lx of [58, 262, 330, 398, 464]) {
    if (lampOn) {
      ctx.fillStyle = "rgba(255,210,130,0.1)";
      ctx.fillRect(lx - 9, CURB - 4, 18, 6);
      ctx.fillStyle = "rgba(255,210,130,0.16)";
      ctx.fillRect(lx - 3, 196, 7, 4);
    }
    ctx.fillStyle = "#141a2c";
    ctx.fillRect(lx, 198, 1, CURB - 198);
    ctx.fillStyle = lampOn ? "#ffd68c" : "#232a40";
    ctx.fillRect(lx - 1, 196, 3, 2);
  }
  ctx.fillStyle = "#a04838";
  ctx.fillRect(310, CURB - 6, 3, 6);
  ctx.fillRect(309, CURB - 4, 5, 1);

  // parked cars, a delivery van when the street thrives, a passer-by
  const parked: [number, string][] = [[268, "#4a5578"], [360, "#5a4a5f"]];
  for (const [px, tone] of parked) {
    ctx.fillStyle = tone;
    ctx.fillRect(px, 240, 16, 5);
    ctx.fillRect(px + 3, 237, 9, 3);
    ctx.fillStyle = "#0c0f1c";
    ctx.fillRect(px + 2, 245, 3, 2);
    ctx.fillRect(px + 11, 245, 3, 2);
  }
  if (s.shops > 0.8) {
    ctx.fillStyle = "#c3c2b7";
    ctx.fillRect(296, 237, 18, 8);
    ctx.fillStyle = "#8a92b8";
    ctx.fillRect(310, 239, 4, 6);
    ctx.fillStyle = "#0c0f1c";
    ctx.fillRect(298, 245, 3, 2);
    ctx.fillRect(308, 245, 3, 2);
    ctx.fillStyle = BOX_COLS[1];
    ctx.fillRect(291, 241, 4, 4); // crate on the kerb
  }
  const carX = ((t * 55) % (W + 60)) - 30;
  ctx.fillStyle = "#7a5a8f";
  ctx.fillRect(R(carX), 258, 14, 4);
  ctx.fillRect(R(carX) + 3, 255, 8, 3);
  ctx.fillStyle = "#0c0f1c";
  ctx.fillRect(R(carX) + 2, 262, 3, 2);
  ctx.fillRect(R(carX) + 9, 262, 3, 2);
  if (pal.night > 0.35) {
    ctx.fillStyle = "#ffe9b0";
    ctx.fillRect(R(carX) + 14, 259, 2, 1);
  }

  // people
  const regN = Math.round(walkersAt(s.hour) * (0.35 + 0.65 * s.shops) * REGULARS.length);
  for (let i = 0; i < Math.min(regN, REGULARS.length); i++) {
    const wk = REGULARS[i];
    drawWalker(ctx, walkerX(wk, t, 152, 476), t, i, wk.tone, false);
  }
  const crewN = Math.round(clamp(s.workers, 0, 1) * CREW.length);
  for (let i = 0; i < crewN; i++) {
    const wk = CREW[i];
    const x = walkerX(wk, t, 158, 470);
    drawWalker(ctx, x, t, i + 9, wk.tone, true);
    // a paycheck changes hands where a worker meets an open till
    if (s.gold > 0.2) {
      for (const shop of SHOPS) {
        if (shopState(shop, s.shops) === "open" && Math.abs(x - (shop.x + 20)) < 2) {
          const rise = (t * 2.4) % 1;
          ctx.fillStyle = `rgba(255,223,154,${0.95 - rise * 0.75})`;
          ctx.fillRect(R(x), R(FEET - 12 - rise * 9), 2, 2);
          ctx.fillStyle = `rgba(232,184,75,${0.5 - rise * 0.4})`;
          ctx.fillRect(R(x) - 1, R(FEET - 11 - rise * 9), 4, 1);
        }
      }
    }
  }
  // tourists idling on the pier walk
  if (s.tourists > 0.25) {
    for (let i = 0; i < 2; i++) {
      const tx = 26 + i * 30 + Math.sin(t * 0.4 + i * 2) * 7;
      drawWalker(ctx, tx, t * 0.3, i + 20, i ? "#c9b47a" : "#8ab8c9", false);
      if (hash(i * 9 + Math.floor(t * 2.6)) > 0.9) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(R(tx) + 1, FEET - 10, 1, 1);
      }
    }
  }
}

/** The money made visible: gold flecks arcing from the berth to the works. */
function drawGold(ctx: Ctx, t: number, s: StScene) {
  if (s.gold < 0.15 || s.ship < 0.15) return;
  const x0 = 60;
  const y0 = 178;
  const x1 = FACT_X + 46;
  const y1 = 176;
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.36 + k / 4) % 1;
    const arcX = (p: number) => x0 + (x1 - x0) * p;
    const arcY = (p: number) => y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 48;
    // fading trail
    for (let j = 1; j <= 2; j++) {
      const pp = ph - j * 0.045;
      if (pp <= 0) continue;
      ctx.fillStyle = `rgba(232,184,75,${(0.4 - j * 0.15) * (0.6 + 0.4 * Math.sin(pp * Math.PI))})`;
      ctx.fillRect(R(arcX(pp)), R(arcY(pp)), 2, 2);
    }
    const glow = 0.55 + 0.45 * Math.sin(ph * Math.PI);
    ctx.fillStyle = `rgba(255,223,154,${0.2 * glow})`;
    ctx.fillRect(R(arcX(ph)) - 1, R(arcY(ph)) - 1, 4, 4);
    ctx.fillStyle = `rgba(255,236,180,${glow})`;
    ctx.fillRect(R(arcX(ph)), R(arcY(ph)), 2, 2);
  }
}

/* ——— the scene ——— */

export function drawStreet(ctx: Ctx, t: number, s: StScene) {
  const pal = paletteAt(s.hour, 0);
  const litW = litShareAt(s.hour) * (0.4 + 0.6 * pal.night);

  skyGradient(ctx, W, SEA_TOP + 2, STOP_AT.map((at, i) => ({ at, c: pal.s[i] })));
  if (pal.night > 0.05) drawStars(ctx, STARS, t, pal.night * 0.8);

  // downtown, a mile behind
  ctx.fillStyle = css(mix(pal.s[2], rgb("#151b36"), 0.5));
  for (const b of BACKDROP) {
    ctx.fillRect(b.x, SEA_TOP + 2 - b.h, b.w, b.h);
    if (b.spire) {
      ctx.fillRect(b.x + (b.w >> 1), SEA_TOP + 2 - b.h - 7, 1, 7);
      ctx.fillRect(b.x + (b.w >> 1) - 1, SEA_TOP + 2 - b.h - 3, 3, 3);
    }
  }
  ctx.fillStyle = `rgba(216,168,106,${0.55 * litW + 0.1 * pal.night})`;
  for (let i = 0; i < 26; i++) {
    const b = BACKDROP[i % BACKDROP.length];
    ctx.fillRect(
      b.x + 2 + ((hash(i * 3.7) * (b.w - 4)) | 0),
      SEA_TOP + 2 - b.h + 3 + ((hash(i * 9.1) * (b.h - 6)) | 0),
      1,
      1,
    );
  }

  drawBasin(ctx, t, pal, s);
  drawFactory(ctx, t, pal, s);
  for (const shop of SHOPS) drawShop(ctx, shop, t, pal, s, litW);
  drawStreetLife(ctx, t, pal, s);
  drawGantry(ctx, t, pal, s);
  drawGold(ctx, t, s);

  // gulls over the basin
  for (let i = 0; i < 2; i++) {
    const gx = ((t * (12 + i * 5)) % (170 + 30)) - 15;
    const gy = 104 + i * 16 + Math.sin(t * 2 + i * 3) * 4;
    ctx.fillStyle = "#c9d3ff";
    ctx.fillRect(R(gx), R(gy), 1, 1);
    ctx.fillRect(R(gx) - 1, R(gy) - (Math.floor(t * 5 + i) % 2), 1, 1);
    ctx.fillRect(R(gx) + 1, R(gy) - (Math.floor(t * 5 + i) % 2), 1, 1);
  }
}
