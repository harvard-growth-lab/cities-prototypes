/**
 * The metro field behind the pizza chart — PLACEHOLDER data.
 * Ten named archetype metros (values chosen so each lands in its
 * textbook wedge relative to the medians) plus a deterministic cloud of
 * unlabeled dots for texture. Real data: one row per CBSA from
 * Census PEP + QCEW.
 */

export interface MetroDot {
  name: string;
  /** population CAGR %/yr over the window */
  popCagr: number;
  /** nominal wage CAGR %/yr over the window */
  wageCagr: number;
  /** point size ~ metro population (relative) */
  size: number;
  /** one-line diagnostic reading for the tooltip */
  reading: string;
}

/** US-metro benchmark the wedges are measured against. */
export const MEDIANS = { popCagr: 0.5, wageCagr: 3.8 };

export const WINDOW_LABEL = "2017–2023";

export const archetypeMetros: MetroDot[] = [
  {
    name: "Austin",
    popCagr: 2.4,
    wageCagr: 4.9,
    size: 2.3,
    reading:
      "People arrive even faster than pay rises — a demand boom the city absorbs. The healthy quadrant (1b).",
  },
  {
    name: "Nashville",
    popCagr: 1.9,
    wageCagr: 4.4,
    size: 2.0,
    reading:
      "Employers bidding for workers and workers showing up: positive labor demand with elastic supply (1b).",
  },
  {
    name: "San Francisco",
    popCagr: 0.2,
    wageCagr: 6.0,
    size: 4.7,
    reading:
      "Pay surges, people trickle — inelastic labor supply. A housing wall or a Manhattan effect; the housing tests decide (4f/1a border country).",
  },
  {
    name: "Boise",
    popCagr: 2.1,
    wageCagr: 3.2,
    size: 0.8,
    reading:
      "People came for the place, not the paycheck — a supply boom that elastic demand absorbs (2a).",
  },
  {
    name: "El Paso",
    popCagr: 0.9,
    wageCagr: 2.6,
    size: 0.9,
    reading:
      "Arrivals outrun the jobs: wages sag while population grows — inelastic labor demand (2c).",
  },
  {
    name: "Detroit",
    popCagr: -0.7,
    wageCagr: 2.9,
    size: 4.3,
    reading:
      "People leave faster than pay falls behind: elastic supply following the firms out — the demand-shock signature (3d).",
  },
  {
    name: "Youngstown",
    popCagr: -1.1,
    wageCagr: 3.1,
    size: 0.5,
    reading:
      "Population falls ahead of wages: demand collapsed with the export base and residents followed it out (3d).",
  },
  {
    name: "Scranton",
    popCagr: 0.2,
    wageCagr: 2.4,
    size: 0.6,
    reading:
      "Wages fall harder than population moves: jobs left but people stay through the pain — inelastic supply, rooted by homes and community (3c).",
  },
  {
    name: "Flint",
    popCagr: -1.0,
    wageCagr: 4.3,
    size: 0.4,
    reading:
      "People leave even as pay rises — pushed out by collapsing amenities while firms still hire: negative labor supply (4e).",
  },
  {
    name: "Pittsburgh",
    popCagr: 0.3,
    wageCagr: 4.4,
    size: 2.4,
    reading:
      "Wages rise further than population falls: paying to hold workers while the city resets to a smaller, more productive equilibrium (4f).",
  },
];

/* ————— deterministic texture cloud ————— */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CloudDot {
  popCagr: number;
  wageCagr: number;
  size: number;
}

/** ~60 unlabeled metros scattered around the medians (seeded, stable). */
export function metroCloud(n = 60, seed = 77): CloudDot[] {
  const rand = mulberry32(seed);
  const gauss = () => {
    let s = 0;
    for (let i = 0; i < 4; i++) s += rand();
    return (s - 2) / 1.15;
  };
  return Array.from({ length: n }, () => ({
    popCagr: MEDIANS.popCagr + gauss() * 0.95,
    wageCagr: MEDIANS.wageCagr + gauss() * 0.8,
    size: 0.3 + Math.pow(rand(), 3.2) * 3.5,
  }));
}
