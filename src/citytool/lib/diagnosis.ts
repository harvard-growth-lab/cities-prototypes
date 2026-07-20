import type { CityPanelRow, HousingRow } from '../data/types';

// Provisional labor-market diagnosis for an MSA, read off the population-change
// × wage-change plane (the same axes as MigrationChangeScatter). Split at the
// cross-section MEDIAN, the four quadrants map to shock types:
//
//            wage growth ↑ (rel. to median)
//                       │
//   neg. supply shock   │   pos. demand shock
//   (pop slow, pay fast)│   (pop fast, pay fast)
//   ────────────────────┼────────────────────  pop growth →
//   neg. demand shock   │   pos. supply shock
//   (pop slow, pay slow)│   (pop fast, pay slow:
//                       │    amenities / cost of living)
//
// constraintType groups by which axis tells the story: demand quadrants → look
// at industry composition / shift-share; supply quadrants → look at housing.
// This is a first cut — the economics here is still being worked out.

export type Quadrant =
  | 'demand_positive'
  | 'demand_negative'
  | 'supply_positive'
  | 'supply_negative';

export type ConstraintType = 'demand' | 'supply';

export type Diagnosis = {
  quadrant: Quadrant;
  constraintType: ConstraintType;
  popCagr: number;
  wageCagr: number;
  popMedian: number;
  wageMedian: number;
  // True when the metro sits close to both medians — the quadrant label is then
  // a weak signal and shouldn't be stated with confidence.
  borderline: boolean;
  title: string;
  blurb: string;
};

function nearest<T extends { year: number }>(rows: T[], target: number, ok: (r: T) => boolean): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const r of rows) {
    if (!ok(r)) continue;
    const d = Math.abs(r.year - target);
    if (d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best;
}

// Per-MSA (popCAGR, wageCAGR) over the window, snapping each end to the nearest
// year that has data. Same population/wage bounds-filtering as the scatter so
// the diagnosis lines up with what the chart shows.
function cagrPair(rows: CityPanelRow[], start: number, end: number): { pop: number; wage: number } | null {
  const pStart = nearest(rows, start, (r) => r.population != null && r.population > 0);
  const pEnd = nearest(rows, end, (r) => r.population != null && r.population > 0);
  const wStart = nearest(rows, start, (r) => r.mean_wage != null && r.mean_wage > 0);
  const wEnd = nearest(rows, end, (r) => r.mean_wage != null && r.mean_wage > 0);
  if (!pStart || !pEnd || pStart.year === pEnd.year) return null;
  if (!wStart || !wEnd || wStart.year === wEnd.year) return null;
  const pop = (pEnd.population! / pStart.population!) ** (1 / (pEnd.year - pStart.year)) - 1;
  const wage = (wEnd.mean_wage! / wStart.mean_wage!) ** (1 / (wEnd.year - wStart.year)) - 1;
  if (!Number.isFinite(pop) || !Number.isFinite(wage)) return null;
  return { pop, wage };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Median absolute deviation — a robust, scale-free spread measure. Used to
// decide whether a metro is "close" to the medians (and thus borderline).
function mad(xs: number[], med: number): number {
  const devs = xs.map((x) => Math.abs(x - med));
  return median(devs) ?? 0;
}

const COPY: Record<Quadrant, { title: string; blurb: string }> = {
  demand_positive: {
    title: 'Positive labor-demand shock',
    blurb:
      'Population and wages are both growing faster than the typical metro — the signature of a demand pull. People and pay are rising together because employers want more workers. The question for the next section is what is generating that demand.',
  },
  demand_negative: {
    title: 'Negative labor-demand shock',
    blurb:
      'Population and wages are both growing more slowly than the typical metro — the signature of weak labor demand. People leave and pay stagnates together. The next section looks at the industry composition to see where demand is leaking away.',
  },
  supply_positive: {
    title: 'Positive labor-supply shock',
    blurb:
      'Population is growing fast but wages lag — consistent with a supply shift: improving amenities or cheaper cost of living pull people in even without faster pay. The next section looks at housing, the clearest reading on local supply.',
  },
  supply_negative: {
    title: 'Negative labor-supply shock',
    blurb:
      'Wages are growing fast but population lags — consistent with a constrained supply: pay is bid up because workers cannot, or will not, move in (often a housing or cost-of-living wall). The next section looks at housing to test that.',
  },
};

export function classifyMsa(
  panel: CityPanelRow[],
  cityId: string,
  start: number,
  end: number,
): Diagnosis | null {
  if (end <= start) return null;

  // Cross-section of every MSA's (pop, wage) CAGR → medians for the split.
  const byCity = new Map<string, CityPanelRow[]>();
  for (const r of panel) {
    const arr = byCity.get(r.city_id) ?? [];
    arr.push(r);
    byCity.set(r.city_id, arr);
  }
  const pops: number[] = [];
  const wages: number[] = [];
  let mine: { pop: number; wage: number } | null = null;
  for (const [id, rows] of byCity) {
    const pair = cagrPair(rows, start, end);
    if (!pair) continue;
    pops.push(pair.pop);
    wages.push(pair.wage);
    if (id === cityId) mine = pair;
  }
  const popMedian = median(pops);
  const wageMedian = median(wages);
  if (!mine || popMedian == null || wageMedian == null) return null;

  const popHi = mine.pop >= popMedian;
  const wageHi = mine.wage >= wageMedian;
  const quadrant: Quadrant = popHi
    ? wageHi
      ? 'demand_positive'
      : 'supply_positive'
    : wageHi
      ? 'supply_negative'
      : 'demand_negative';
  const constraintType: ConstraintType = quadrant.startsWith('demand') ? 'demand' : 'supply';

  // Borderline when the metro is within ~⅓ of a MAD of BOTH medians: the
  // quadrant assignment is then a coin-flip and we say so rather than asserting
  // a confident shock label.
  const K = 0.35;
  const borderline =
    Math.abs(mine.pop - popMedian) < K * mad(pops, popMedian) &&
    Math.abs(mine.wage - wageMedian) < K * mad(wages, wageMedian);

  const copy = borderline
    ? {
        title: 'Borderline — mixed signal',
        blurb:
          `${'On both population and wage growth, this metro sits close to the ' +
          'median — it does not clearly fall into any one quadrant. Read the ' +
          'nearest-quadrant story below as a lean, not a diagnosis: '}` +
          COPY[quadrant].blurb,
      }
    : COPY[quadrant];

  return {
    quadrant,
    constraintType,
    popCagr: mine.pop,
    wageCagr: mine.wage,
    popMedian,
    wageMedian,
    borderline,
    ...copy,
  };
}

// ── Second bifurcation, taken only on the supply branch ─────────────────────
//
// Is the wall housing prices, or is the story amenities? Split on the metro's
// home-value CAGR against the cross-metro median: prices outrunning the
// typical metro are consistent with people being priced out (housing side);
// prices lagging it make the priced-out story hard to sustain, pushing the
// diagnosis toward amenities (read off the price-vs-salary residual).

export type SupplySide = 'housing' | 'amenity';

export type SupplyDiagnosis = {
  side: SupplySide;
  housingCagr: number; // the metro's ZHVI CAGR over the window
  housingMedian: number; // median ZHVI CAGR across metros
};

export function classifySupply(
  housing: HousingRow[],
  cityId: string,
  start: number,
  end: number,
): SupplyDiagnosis | null {
  if (end <= start) return null;
  const byCity = new Map<string, HousingRow[]>();
  for (const h of housing) {
    if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
    const arr = byCity.get(h.city_id) ?? [];
    arr.push(h);
    byCity.set(h.city_id, arr);
  }
  const cagrs: number[] = [];
  let mine: number | null = null;
  for (const [id, rows] of byCity) {
    const a = nearest(rows, start, () => true);
    const b = nearest(rows, end, () => true);
    if (!a || !b || a.year === b.year) continue;
    const c = (b.zhvi! / a.zhvi!) ** (1 / (b.year - a.year)) - 1;
    if (!Number.isFinite(c)) continue;
    cagrs.push(c);
    if (id === cityId) mine = c;
  }
  const med = median(cagrs);
  if (mine == null || med == null) return null;
  return { side: mine >= med ? 'housing' : 'amenity', housingCagr: mine, housingMedian: med };
}
