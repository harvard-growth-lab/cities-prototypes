import type {
  PlacePanelRow,
  PlaceHousingRow,
  CityPanelRow,
  HousingRow,
} from '../data/types';
import { fmtCompact, fmtMoneyCompact, fmtPct } from './format';

// Headline-stat builders for the story's "how is my city / MSA doing" sections.
// Mirrors the snap / CAGR / rank arithmetic in profile/PlaceSectionLevels +
// SectionLevels, but emits compact card data (value · change · rank) instead of
// table rows. Each indicator snaps independently to the nearest year it has.

export type StatCard = {
  key: string;
  label: string;
  note?: string;
  value: string;
  change: string | null;
  changeDir: 1 | 0 | -1 | null;
  rank: { rank: number; total: number } | null;
  // Overrides the change colour independently of the arrow direction. Used for
  // indicators where "down" is good (unemployment): a falling rate shows a
  // down-arrow but is coloured as an improvement.
  tone?: 'good' | 'bad';
};

function snapList(years: number[], target: number): number | null {
  if (years.length === 0) return null;
  let best = years[0];
  let bestDist = Math.abs(best - target);
  for (const y of years) {
    const d = Math.abs(y - target);
    if (d < bestDist) {
      best = y;
      bestDist = d;
    }
  }
  return best;
}

function cagr(v: number | null, b: number | null, span: number): { text: string; dir: 1 | 0 | -1 } | null {
  if (v == null || b == null || b <= 0 || span <= 0) return null;
  const r = (v / b) ** (1 / span) - 1;
  if (!Number.isFinite(r)) return null;
  return {
    text: `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%/yr`,
    dir: r > 0.0005 ? 1 : r < -0.0005 ? -1 : 0,
  };
}

function rankAmong(v: number | null, pop: (number | null | undefined)[]) {
  if (v == null) return null;
  const sortable = pop.filter((x): x is number => x != null);
  if (sortable.length === 0) return null;
  sortable.sort((a, b) => b - a);
  const idx = sortable.findIndex((x) => x === v);
  if (idx < 0) return null;
  return { rank: idx + 1, total: sortable.length };
}

// Generic single-indicator card builder over a (year → value) series for the
// subject, peer rows for ranking, and a formatter.
function buildCard<R extends { year: number }>(
  key: string,
  label: string,
  noteFor: (year: number | null) => string,
  fmt: (x: number | null) => string,
  mine: R[],
  valOf: (r: R) => number | null,
  peersAt: (year: number) => (number | null | undefined)[],
  start: number,
  end: number,
): StatCard {
  const present = mine.filter((r) => valOf(r) != null);
  const yrs = present.map((r) => r.year);
  const latestYr = snapList(yrs, end);
  const baseYr = snapList(yrs, start);
  const latest = latestYr != null ? present.find((r) => r.year === latestYr) ?? null : null;
  const base = baseYr != null ? present.find((r) => r.year === baseYr) ?? null : null;
  const span = (latestYr ?? 0) - (baseYr ?? 0);
  const v = latest ? valOf(latest) : null;
  const change = cagr(v, base ? valOf(base) : null, span);
  return {
    key,
    label,
    note: noteFor(latestYr),
    value: fmt(v),
    change: change?.text ?? null,
    changeDir: change?.dir ?? null,
    rank: latestYr != null ? rankAmong(v, peersAt(latestYr)) : null,
  };
}

// Rank where a LOWER value is better (rank #1 = lowest). Mirrors rankAmong but
// sorts ascending — used for the unemployment rate.
function rankAmongAsc(v: number | null, pop: (number | null | undefined)[]) {
  if (v == null) return null;
  const sortable = pop.filter((x): x is number => x != null);
  if (sortable.length === 0) return null;
  sortable.sort((a, b) => a - b);
  const idx = sortable.findIndex((x) => x === v);
  if (idx < 0) return null;
  return { rank: idx + 1, total: sortable.length };
}

// Unemployment-rate card. Like buildCard but the change is a percentage-point
// delta (not a CAGR — compounding a rate is meaningless), the rank is ascending
// (lower is better), and the colour is inverted (a falling rate is good).
function buildUnemploymentCard<R extends { year: number }>(
  mine: R[],
  rateOf: (r: R) => number | null,
  peersAt: (year: number) => (number | null | undefined)[],
  start: number,
  end: number,
): StatCard {
  const present = mine.filter((r) => rateOf(r) != null);
  const yrs = present.map((r) => r.year);
  const latestYr = snapList(yrs, end);
  const baseYr = snapList(yrs, start);
  const latest = latestYr != null ? present.find((r) => r.year === latestYr) ?? null : null;
  const base = baseYr != null ? present.find((r) => r.year === baseYr) ?? null : null;
  const v = latest ? rateOf(latest) : null;
  const b = base ? rateOf(base) : null;
  const pp = v != null && b != null && latestYr !== baseYr ? v - b : null;
  const dir = pp == null ? null : pp > 0.05 ? 1 : pp < -0.05 ? -1 : 0;
  return {
    key: 'unemployment',
    label: 'Unemployment',
    note: latestYr ? `BLS LAUS, ${latestYr}` : 'BLS LAUS',
    value: fmtPct(v, 1),
    change: pp == null ? null : `${pp >= 0 ? '+' : '−'}${Math.abs(pp).toFixed(1)} pp`,
    changeDir: dir,
    tone: dir === -1 ? 'good' : dir === 1 ? 'bad' : undefined,
    rank: latestYr != null ? rankAmongAsc(v, peersAt(latestYr)) : null,
  };
}

export function buildPlaceCards(
  placeId: string,
  msaPlaceIds: string[],
  panel: PlacePanelRow[],
  housing: PlaceHousingRow[],
  start: number,
  end: number,
): StatCard[] {
  const peers = new Set(msaPlaceIds);
  const myPanel = panel.filter((r) => r.place_id === placeId);
  const myHousing = housing.filter((r) => r.place_id === placeId && r.tier === 'all');
  const country = myPanel[0]?.country ?? 'usa';
  const m$ = (x: number | null) => fmtMoneyCompact(x, country);

  return [
    buildCard(
      'population',
      'Population',
      (y) => (y ? `Census PEP, ${y}` : 'Census PEP'),
      (x) => (x == null ? '—' : fmtCompact.format(x)),
      myPanel,
      (r) => r.population,
      (year) => panel.filter((r) => peers.has(r.place_id) && r.year === year).map((r) => r.population),
      start,
      end,
    ),
    buildCard(
      'salary',
      'Average salary',
      (y) => (y ? `IRS, residence, ${y}` : 'IRS, residence'),
      m$,
      myPanel,
      (r) => r.avg_wage,
      (year) => panel.filter((r) => peers.has(r.place_id) && r.year === year).map((r) => r.avg_wage),
      start,
      end,
    ),
    buildCard(
      'home',
      'Home value',
      (y) => (y ? `Zillow ZHVI, ${y}` : 'Zillow ZHVI'),
      m$,
      myHousing,
      (r) => r.zhvi,
      (year) =>
        housing.filter((r) => peers.has(r.place_id) && r.tier === 'all' && r.year === year).map((r) => r.zhvi),
      start,
      end,
    ),
    buildUnemploymentCard(
      myPanel,
      (r) => r.unemployment_rate,
      (year) =>
        panel.filter((r) => peers.has(r.place_id) && r.year === year).map((r) => r.unemployment_rate),
      start,
      end,
    ),
  ];
}

export function buildMsaCards(
  cityId: string,
  panel: CityPanelRow[],
  housing: HousingRow[],
  start: number,
  end: number,
): StatCard[] {
  const myPanel = panel.filter((r) => r.city_id === cityId);
  const myHousing = housing.filter((r) => r.city_id === cityId && r.tier === 'all');
  const country = myPanel[0]?.country ?? 'usa';
  const m$ = (x: number | null) => fmtMoneyCompact(x, country);

  return [
    buildCard(
      'population',
      'MSA population',
      (y) => (y ? `BEA implied, ${y}` : 'BEA implied'),
      (x) => (x == null ? '—' : fmtCompact.format(x)),
      myPanel,
      (r) => r.population,
      (year) => panel.filter((r) => r.year === year).map((r) => r.population),
      start,
      end,
    ),
    buildCard(
      'salary',
      'Average wage',
      (y) => (y ? `IPUMS ACS, ${y}` : 'IPUMS ACS'),
      m$,
      myPanel,
      (r) => r.mean_wage,
      (year) => panel.filter((r) => r.year === year).map((r) => r.mean_wage),
      start,
      end,
    ),
    buildCard(
      'home',
      'Home value',
      (y) => (y ? `Zillow ZHVI, ${y}` : 'Zillow ZHVI'),
      m$,
      myHousing,
      (r) => r.zhvi,
      (year) => housing.filter((r) => r.tier === 'all' && r.year === year).map((r) => r.zhvi),
      start,
      end,
    ),
    buildUnemploymentCard(
      myPanel,
      (r) => r.unemployment_rate,
      (year) => panel.filter((r) => r.year === year).map((r) => r.unemployment_rate),
      start,
      end,
    ),
  ];
}
