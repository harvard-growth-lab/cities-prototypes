import { useEffect, useMemo, useRef, useState } from 'react';
import type { CityPanelRow, HousingRow, CityRentRow } from '../../data/types';
import { useYearRange } from '../../lib/yearRange';
import { GL } from '../../lib/glColors';
import { fmtCompact, fmtPct1, fmtPct2, fmtPp } from '../../lib/format';
import { nearestRow } from '../../lib/panelRows';
import { pctTickFormatter, ppTickFormatter } from '../../lib/tickFormat';
import { amenityResiduals, residualDelta, type AmenityObs } from '../../lib/amenityResidual';

// One scatter, three Y-axis modes — the user picks via a dropdown and the
// points slide to their new positions. The X axis is *population CAGR* over
// the global compare window from useYearRange(); the highlight stays fixed
// across modes.
//
// Rendered as bare SVG so each point keeps a stable React key (its city_id);
// React reuses the DOM circle across mode switches and CSS transitions on
// `cx`/`cy` carry it from one position to the other.

// Highlight by muting: the field is c-muted, the focus metro is c-2 (the
// lead-finding / identity red). Labels use the dark tone (grammar Rule #6).
const HIGHLIGHT = GL.c2;
const HIGHLIGHT_DARK = GL.c2Dark;
const POINT_FILL = GL.muted;
const HOVER_FILL = GL.c1;      // hovered point pops in institutional blue
const HOVER_DARK = GL.c1Dark;
const RULE = GL.ink2;      // axis line — 1px ink-2
const GRID = GL.gridline;
const MUTED = GL.ink3;     // tick marks + secondary text

const VIEW_W = 720;
const VIEW_H = 400;
const M = { top: 16, right: 32, bottom: 50, left: 64 };
const PLOT_W = VIEW_W - M.left - M.right;
const PLOT_H = VIEW_H - M.top - M.bottom;

// Bubble-size anchors: the most populous metro (NYC) gets R_MAX; everything
// scales down area-true from there. PlaceExplodeScatter reuses these so its
// opening frame is pixel-identical to this chart.
export const METRO_R_MAX = 12;
export const METRO_R_MIN = 1.5;

type Mode = 'wage' | 'housing' | 'rent' | 'premium' | 'amenity_zhvi' | 'amenity_zori';

type ModeConfig = {
  label: string; // dropdown option
  yLabel: string; // axis label
  yFormat: (v: number) => string; // tooltip format
  tooltipName: string; // tooltip row label
  measureNoun: string; // "wage" etc — for the missing-highlight note
  source: React.ReactNode;
};

const MODES: Record<Mode, ModeConfig> = {
  wage: {
    label: 'Wage growth (mean-wage CAGR)',
    yLabel: 'Mean-wage CAGR',
    yFormat: fmtPct2,
    tooltipName: 'Wage CAGR',
    measureNoun: 'wage',
    source: (
      <>
        Population: BEA implied MSA population. Wages: IPUMS USA, ACS microdata
        aggregated to MSA via PUMA-to-MET2013 crosswalk.
      </>
    ),
  },
  premium: {
    label: 'Wage premium change (place-based pay)',
    yLabel: 'Δ wage premium',
    yFormat: fmtPp,
    tooltipName: 'Δ wage premium',
    measureNoun: 'wage-premium',
    source: (
      <>
        Population: BEA implied MSA population. Wage premium: metro fixed
        effects from a worker-level Mincer regression on IPUMS ACS microdata,
        controlling for education, age, sex, race, and hours.
      </>
    ),
  },
  housing: {
    label: 'Housing-cost growth (ZHVI CAGR)',
    yLabel: 'ZHVI CAGR',
    yFormat: fmtPct2,
    tooltipName: 'ZHVI CAGR',
    measureNoun: 'home-value',
    source: (
      <>
        Population: BEA implied MSA population. Housing: Zillow Home Value Index
        (ZHVI, all tiers, MSA-level, monthly → year-mean).
      </>
    ),
  },
  rent: {
    label: 'Rent growth (ZORI CAGR)',
    yLabel: 'ZORI CAGR',
    yFormat: fmtPct2,
    tooltipName: 'ZORI CAGR',
    measureNoun: 'rent',
    source: (
      <>
        Population: BEA implied MSA population. Rent: Zillow Observed Rent Index
        (ZORI, smoothed all-homes, MSA-level, monthly → year-mean). Series
        begins 2015 — MSAs with no rent observation inside the window are
        omitted.
      </>
    ),
  },
  amenity_zhvi: {
    label: 'Amenity drift — home value vs. salary (Δ residual)',
    yLabel: 'Δ amenity residual (home value)',
    yFormat: fmtPp,
    tooltipName: 'Δ amenity residual',
    measureNoun: 'amenity-residual',
    source: (
      <>
        Population: BEA implied MSA population. Amenity residual: national OLS
        of log ZHVI on log mean wage across metros, fit separately at each end
        of the window; Y is the change in each metro's residual (log points ≈
        pp). Rising = home values grew beyond what wages predict — growing
        revealed amenity demand (or tightening supply).
      </>
    ),
  },
  amenity_zori: {
    label: 'Amenity drift — rent vs. salary (Δ residual, 2015+)',
    yLabel: 'Δ amenity residual (rent)',
    yFormat: fmtPp,
    tooltipName: 'Δ amenity residual',
    measureNoun: 'amenity-residual',
    source: (
      <>
        Population: BEA implied MSA population. Amenity residual: national OLS
        of log ZORI on log mean wage across metros, fit separately at each end
        of the window; Y is the change in each metro's residual (log points ≈
        pp). ZORI begins 2015 — earlier window starts snap to it.
      </>
    ),
  },
};

export type Point = {
  id: string;
  name: string;
  x: number; // population CAGR over the configured window
  y: number; // mode-dependent CAGR or delta
  pop: number; // end-year population — drives the bubble area
};

// Area-true bubble radius: r ∝ √population, anchored so the most populous
// point gets rMax. Pure proportionality (no additive offset) keeps point AREA
// proportional to population — so a metro's dot area is roughly the sum of its
// places' dot areas when both use the same anchor. rMin is a visibility floor.
export function radiusFor(pop: number, popMax: number, rMax: number, rMin: number): number {
  if (!(popMax > 0) || !(pop > 0)) return rMin;
  return Math.max(rMin, rMax * Math.sqrt(pop / popMax));
}

// Build one point per city for the active mode. X is population CAGR over the
// configured (startYear, endYear) window; Y depends on mode. Per-city we snap
// to nearest available year so cities whose data starts late still appear.
// Exported so PlaceExplodeScatter can open on an exact replica of this chart.
export function buildPoints(
  mode: Mode,
  panel: CityPanelRow[],
  housing: HousingRow[],
  rent: CityRentRow[],
  startYear: number,
  endYear: number,
): Point[] {
  const byCity = new Map<string, { name: string; rows: CityPanelRow[] }>();
  for (const r of panel) {
    const slot = byCity.get(r.city_id) ?? { name: r.city_name, rows: [] };
    slot.rows.push(r);
    byCity.set(r.city_id, slot);
  }

  const zhviByCity = new Map<string, HousingRow[]>();
  if (mode === 'housing') {
    for (const h of housing) {
      if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
      const arr = zhviByCity.get(h.city_id) ?? [];
      arr.push(h);
      zhviByCity.set(h.city_id, arr);
    }
  }

  const zoriByCity = new Map<string, CityRentRow[]>();
  if (mode === 'rent') {
    for (const r of rent) {
      if (r.zori == null || r.zori <= 0) continue;
      const arr = zoriByCity.get(r.city_id) ?? [];
      arr.push(r);
      zoriByCity.set(r.city_id, arr);
    }
  }

  // Δ amenity residual: log(price) ~ log(mean wage) fit across all metros
  // separately at each end of the window (each metro snapped to its nearest
  // data year), then differenced per metro — see lib/amenityResidual. One
  // shared FE group reduces the fit to plain OLS with an intercept. Only
  // metros observable at BOTH ends enter either fit, so the two
  // cross-sections cover the same sample and the deltas are comparable.
  let amenityDelta: Map<string, number> | null = null;
  if (mode === 'amenity_zhvi' || mode === 'amenity_zori') {
    const priceSeries = new Map<string, { year: number; v: number }[]>();
    if (mode === 'amenity_zhvi') {
      for (const h of housing) {
        if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
        const arr = priceSeries.get(h.city_id) ?? [];
        arr.push({ year: h.year, v: h.zhvi });
        priceSeries.set(h.city_id, arr);
      }
    } else {
      for (const r of rent) {
        if (r.zori == null || r.zori <= 0) continue;
        const arr = priceSeries.get(r.city_id) ?? [];
        arr.push({ year: r.year, v: r.zori });
        priceSeries.set(r.city_id, arr);
      }
    }
    const obsStart: AmenityObs[] = [];
    const obsEnd: AmenityObs[] = [];
    for (const [cityId, { rows }] of byCity) {
      const prices = priceSeries.get(cityId);
      if (!prices) continue;
      const wS = nearestRow(rows, startYear, (r) => r.mean_wage != null && r.mean_wage > 0);
      const wE = nearestRow(rows, endYear,   (r) => r.mean_wage != null && r.mean_wage > 0);
      if (!wS || !wE || wS.year === wE.year) continue;
      const pS = nearestRow(prices, startYear);
      const pE = nearestRow(prices, endYear);
      if (!pS || !pE || pS.year === pE.year) continue;
      obsStart.push({ id: cityId, group: 'usa', logWage: Math.log(wS.mean_wage!), logPrice: Math.log(pS.v) });
      obsEnd.push({ id: cityId, group: 'usa', logWage: Math.log(wE.mean_wage!), logPrice: Math.log(pE.v) });
    }
    amenityDelta = residualDelta(amenityResiduals(obsStart), amenityResiduals(obsEnd));
  }

  const out: Point[] = [];
  const yrs = endYear - startYear;
  if (yrs <= 0) return out;
  for (const [cityId, { name, rows }] of byCity) {
    const rStart = nearestRow(rows, startYear, (r) => r.population != null && r.population > 0);
    const rEnd   = nearestRow(rows, endYear,   (r) => r.population != null && r.population > 0);
    if (!rStart || !rEnd || rStart.year === rEnd.year) continue;
    const span = rEnd.year - rStart.year;
    if (span <= 0) continue;
    const x = (rEnd.population! / rStart.population!) ** (1 / span) - 1;
    if (!Number.isFinite(x) || x > 0.15 || x < -0.10) continue;

    let y: number | null = null;
    if (mode === 'wage') {
      const wStart = nearestRow(rows, startYear, (r) => r.mean_wage != null && r.mean_wage > 0);
      const wEnd   = nearestRow(rows, endYear,   (r) => r.mean_wage != null && r.mean_wage > 0);
      if (!wStart || !wEnd || wStart.year === wEnd.year) continue;
      y = (wEnd.mean_wage! / wStart.mean_wage!) ** (1 / (wEnd.year - wStart.year)) - 1;
    } else if (mode === 'housing') {
      const hRows = zhviByCity.get(cityId) ?? [];
      const hStart = nearestRow(hRows, startYear);
      const hEnd   = nearestRow(hRows, endYear);
      if (!hStart?.zhvi || !hEnd?.zhvi || hStart.year === hEnd.year) continue;
      y = (hEnd.zhvi / hStart.zhvi) ** (1 / (hEnd.year - hStart.year)) - 1;
    } else if (mode === 'rent') {
      const rRows = zoriByCity.get(cityId) ?? [];
      const rStart = nearestRow(rRows, startYear, (r) => r.zori != null && r.zori > 0);
      const rEnd   = nearestRow(rRows, endYear,   (r) => r.zori != null && r.zori > 0);
      if (!rStart?.zori || !rEnd?.zori || rStart.year === rEnd.year) continue;
      y = (rEnd.zori / rStart.zori) ** (1 / (rEnd.year - rStart.year)) - 1;
    } else if (mode === 'premium') {
      const pStart = nearestRow(rows, startYear, (r) => r.wage_premium != null);
      const pEnd   = nearestRow(rows, endYear,   (r) => r.wage_premium != null);
      if (!pStart || !pEnd || pStart.year === pEnd.year) continue;
      y = (pEnd.wage_premium as number) - (pStart.wage_premium as number);
    } else {
      y = amenityDelta?.get(cityId) ?? null;
    }
    if (y == null || !Number.isFinite(y)) continue;

    out.push({ id: cityId, name, x, y, pop: rEnd.population! });
  }
  return out;
}

// "Nice" tick generator (Wilkinson-style). Picks a step that's a clean
// multiple of 1, 2, 2.5, or 5 × 10^n, then walks min → max.
export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const range = max - min;
  const rough = range / target;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  let step: number;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 4) step = 2.5 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pad(min: number, max: number, frac = 0.05): [number, number] {
  if (min === max) return [min - 1, max + 1];
  const p = (max - min) * frac;
  return [min - p, max + p];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

// Default view for the metro scatter: trim to the 2–98% quantile range so a
// handful of extreme small-MSA values don't stretch the frame into white
// space, then force-include `include` values (the highlighted metro, the
// medians) so the subject is always in the picture even when it IS one of the
// outliers. Points outside the frame are clipped, not dropped — drag-zoom can
// still reach them and the medians are computed over everything.
export function smartDomain(
  values: number[],
  include: (number | null | undefined)[] = [],
  qLo = 0.02,
  qHi = 0.98,
  padFrac = 0.07,
): [number, number] {
  if (values.length === 0) return pad(-0.05, 0.05);
  const s = [...values].sort((a, b) => a - b);
  let lo = quantile(s, qLo);
  let hi = quantile(s, qHi);
  for (const v of include) {
    if (v == null || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return pad(lo, hi, padFrac);
}

type Hover = { id: string; cx: number; cy: number; name: string; x: number; y: number; pop: number } | null;

// Static quadrant copy for the diagnosis overlay. Split is at the cross-section
// median (the dashed reference lines), so each corner is "relative to the
// typical metro". Mirrors lib/diagnosis.ts.
const QUADRANTS = {
  tr: { title: 'Positive demand shock', sub: 'pop & pay both fast' },
  br: { title: 'Positive supply shock', sub: 'pop fast, pay slow — amenities' },
  bl: { title: 'Negative demand shock', sub: 'pop & pay both slow' },
  tl: { title: 'Negative supply shock', sub: 'pop slow, pay fast — constrained' },
} as const;

export default function MigrationChangeScatter({
  panel,
  housing,
  rent,
  highlightCityId,
  quadrants = false,
  initialMode = 'wage',
}: {
  panel: CityPanelRow[];
  housing: HousingRow[];
  rent: CityRentRow[];
  highlightCityId?: string | null;
  // When true, overlay the four labor-shock quadrants and shade the one the
  // highlighted metro falls in. The quadrant story only holds on the pay axes
  // (wage, wage premium) — the overlay auto-hides for housing/rent modes.
  quadrants?: boolean;
  // Which Y-axis mode to open in (user can still switch via the dropdown).
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const { startYear, endYear } = useYearRange();
  const cfg = MODES[mode];
  const points = useMemo(
    () => buildPoints(mode, panel, housing, rent, startYear, endYear),
    [mode, panel, housing, rent, startYear, endYear],
  );

  const xMedian = useMemo(() => median(points.map((p) => p.x)), [points]);
  const yMedian = useMemo(() => median(points.map((p) => p.y)), [points]);
  const highlight = useMemo(
    () => (highlightCityId ? points.find((p) => p.id === highlightCityId) ?? null : null),
    [points, highlightCityId],
  );
  // For the "your metro isn't on this chart" note — small MSAs can lack the
  // Y-measure entirely (e.g. no IPUMS wage coverage) and would otherwise just
  // silently have no red dot.
  const highlightName = useMemo(
    () => (highlightCityId ? panel.find((r) => r.city_id === highlightCityId)?.city_name ?? null : null),
    [panel, highlightCityId],
  );

  // Default frame: quantile-trimmed so extreme small-MSA values don't leave
  // the bulk of metros huddled in white space, force-including the highlighted
  // metro and the medians. Extremes live outside the frame (clipped) — reach
  // them by drag-zooming.
  const autoXDomain = useMemo<[number, number]>(
    () => smartDomain(points.map((p) => p.x), [highlight?.x, xMedian]),
    [points, highlight, xMedian],
  );
  const autoYDomain = useMemo<[number, number]>(
    () => smartDomain(points.map((p) => p.y), [highlight?.y, yMedian]),
    [points, highlight, yMedian],
  );

  // Drag-to-zoom. `zoom` overrides the auto domains; `drag` is the live
  // rubber-band rectangle in viewBox coordinates while the mouse is down.
  const [zoom, setZoom] = useState<{ x: [number, number]; y: [number, number] } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const draggingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Reset the zoom whenever the data scope changes — a stale window would be
  // meaningless against a different point cloud.
  useEffect(() => {
    setZoom(null);
  }, [mode, startYear, endYear, highlightCityId]);

  const xDomain = zoom ? zoom.x : autoXDomain;
  const yDomain = zoom ? zoom.y : autoYDomain;

  const xScale = (v: number) =>
    M.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * PLOT_W;
  const yScale = (v: number) =>
    M.top + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * PLOT_H;

  // Invert a viewBox coordinate back to data space (for drag-zoom selection).
  const xInvert = (vb: number) => xDomain[0] + ((vb - M.left) / PLOT_W) * (xDomain[1] - xDomain[0]);
  const yInvert = (vb: number) => yDomain[0] + ((M.top + PLOT_H - vb) / PLOT_H) * (yDomain[1] - yDomain[0]);

  // Map a mouse event to viewBox coordinates, clamped to the plot rectangle.
  const eventToViewBox = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    return {
      x: Math.max(M.left, Math.min(M.left + PLOT_W, x)),
      y: Math.max(M.top, Math.min(M.top + PLOT_H, y)),
    };
  };

  const onDragStart = (e: React.MouseEvent) => {
    const p = eventToViewBox(e);
    if (!p) return;
    e.preventDefault(); // keep the drag from text-selecting the page
    draggingRef.current = true;
    setHover(null);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onDragMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const p = eventToViewBox(e);
    if (!p) return;
    setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };
  const onDragEnd = () => {
    draggingRef.current = false;
    setDrag((d) => {
      if (d) {
        const w = Math.abs(d.x1 - d.x0);
        const h = Math.abs(d.y1 - d.y0);
        // Ignore tiny drags (treated as a stray click, not a zoom gesture).
        if (w > 8 && h > 8) {
          const xLo = xInvert(Math.min(d.x0, d.x1));
          const xHi = xInvert(Math.max(d.x0, d.x1));
          // Smaller viewBox-y is higher data-y, so min-y → upper bound.
          const yHi = yInvert(Math.min(d.y0, d.y1));
          const yLo = yInvert(Math.max(d.y0, d.y1));
          setZoom({ x: [xLo, xHi], y: [yLo, yHi] });
        }
      }
      return null;
    });
  };

  const xTicks = niceTicks(xDomain[0], xDomain[1], 6);
  const yTicks = niceTicks(yDomain[0], yDomain[1], 6);
  const fmtXTick = useMemo(() => pctTickFormatter(xTicks), [xTicks]);
  // Premium and amenity modes are point deltas; all others are percent CAGRs.
  const isDeltaMode = mode === 'premium' || mode === 'amenity_zhvi' || mode === 'amenity_zori';
  const fmtYTick = useMemo(
    () => (isDeltaMode ? ppTickFormatter(yTicks) : pctTickFormatter(yTicks)),
    [isDeltaMode, yTicks],
  );

  // Bubble sizing (area ∝ population) + draw order: most populous first so
  // small metros render on top and stay hoverable under the big bubbles.
  const popMax = useMemo(() => Math.max(...points.map((p) => p.pop), 1), [points]);
  const rOf = (p: Point) => radiusFor(p.pop, popMax, METRO_R_MAX, METRO_R_MIN);
  const drawOrder = useMemo(() => [...points].sort((a, b) => b.pop - a.pop), [points]);

  // Hover state for the tooltip — driven from each circle's onMouseEnter so we
  // get crisp, deterministic hover semantics (no nearest-neighbor logic).
  const [hover, setHover] = useState<Hover>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(VIEW_W);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) {
    return <p className="muted">Not enough data to render this scatter.</p>;
  }

  const tooltipScale = containerWidth / VIEW_W; // viewBox → screen

  return (
    <>
      <div className="chart-toolbar">
        <label className="chart-toolbar-control">
          Y-axis
          <select
            className="chart-toolbar-select"
            value={mode}
            onChange={(e) => {
              setHover(null);
              setMode(e.target.value as Mode);
            }}
          >
            {(Object.keys(MODES) as Mode[]).map((k) => (
              <option key={k} value={k}>
                {MODES[k].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chart-zoom-bar">
        <span className="chart-zoom-hint">Drag to zoom into a region.</span>
        <button type="button" className="btn-link" onClick={() => setZoom(null)} disabled={!zoom}>
          Reset zoom
        </button>
      </div>

      {highlightCityId && !highlight && (
        <p className="chart-caption">
          {highlightName ?? 'The selected'} MSA has too little {cfg.measureNoun} data inside this
          window to be placed on this chart.
        </p>
      )}

      <div ref={containerRef} className="migration-scatter">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={() => {
            setHover(null);
            if (draggingRef.current) onDragEnd();
          }}
        >
          <defs>
            <clipPath id="mcs-plot-clip">
              <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>
          {/* Grid lines */}
          <g>
            {yTicks.map((t) => (
              <line
                key={`gy-${t}`}
                x1={M.left}
                x2={M.left + PLOT_W}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke={GRID}
                strokeDasharray="2 4"
              />
            ))}
            {xTicks.map((t) => (
              <line
                key={`gx-${t}`}
                x1={xScale(t)}
                x2={xScale(t)}
                y1={M.top}
                y2={M.top + PLOT_H}
                stroke={GRID}
                strokeDasharray="2 4"
              />
            ))}
          </g>

          {/* Axes */}
          <line
            x1={M.left}
            x2={M.left + PLOT_W}
            y1={M.top + PLOT_H}
            y2={M.top + PLOT_H}
            stroke={RULE}
          />
          <line
            x1={M.left}
            x2={M.left}
            y1={M.top}
            y2={M.top + PLOT_H}
            stroke={RULE}
          />

          {/* Median reference lines (clipped: a drag-zoom can push them out). */}
          <g clipPath="url(#mcs-plot-clip)">
            {xMedian != null && (
              <line
                x1={xScale(xMedian)}
                x2={xScale(xMedian)}
                y1={M.top}
                y2={M.top + PLOT_H}
                stroke={MUTED}
                strokeDasharray="3 3"
                className="ref-line"
              />
            )}
            {yMedian != null && (
              <line
                x1={M.left}
                x2={M.left + PLOT_W}
                y1={yScale(yMedian)}
                y2={yScale(yMedian)}
                stroke={MUTED}
                strokeDasharray="3 3"
                className="ref-line"
              />
            )}
          </g>

          {/* Diagnosis quadrants — only when asked, only on the pay axes
              (the shock labels read pop × pay, not pop × housing cost), and
              only when we have both medians. */}
          {quadrants && (mode === 'wage' || mode === 'premium') && xMedian != null && yMedian != null && (() => {
            // Clamp the split to the plot: a drag-zoom can push a median
            // offscreen, and the quadrant rects must not paint outside.
            const right = M.left + PLOT_W;
            const bottom = M.top + PLOT_H;
            const xm = Math.max(M.left, Math.min(right, xScale(xMedian)));
            const ym = Math.max(M.top, Math.min(bottom, yScale(yMedian)));
            // Which quadrant is the highlighted metro in? Shade it.
            const hx = highlight ? (highlight.x >= xMedian ? 'r' : 'l') : null;
            const hy = highlight ? (highlight.y >= yMedian ? 't' : 'b') : null;
            const activeKey = hx && hy ? `${hy}${hx}` : null;
            const rects: { key: keyof typeof QUADRANTS; x: number; y: number; w: number; h: number }[] = [
              { key: 'tl', x: M.left, y: M.top, w: xm - M.left, h: ym - M.top },
              { key: 'tr', x: xm, y: M.top, w: right - xm, h: ym - M.top },
              { key: 'bl', x: M.left, y: ym, w: xm - M.left, h: bottom - ym },
              { key: 'br', x: xm, y: ym, w: right - xm, h: bottom - ym },
            ];
            return (
              <g className="ref-line" style={{ pointerEvents: 'none' }}>
                {activeKey &&
                  rects
                    .filter((r) => r.key === activeKey)
                    .map((r) => (
                      <rect
                        key={`q-${r.key}`}
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        fill={HIGHLIGHT}
                        fillOpacity={0.06}
                      />
                    ))}
                {/* Corner labels */}
                {([
                  { k: 'tl', x: M.left + 8, y: M.top + 16, anchor: 'start' },
                  { k: 'tr', x: right - 8, y: M.top + 16, anchor: 'end' },
                  { k: 'bl', x: M.left + 8, y: bottom - 22, anchor: 'start' },
                  { k: 'br', x: right - 8, y: bottom - 22, anchor: 'end' },
                ] as const).map(({ k, x, y, anchor }) => (
                  <text key={`ql-${k}`} x={x} y={y} textAnchor={anchor as 'start' | 'end'} fontSize={11}>
                    <tspan fill={MUTED} fontWeight={600}>{QUADRANTS[k].title}</tspan>
                    <tspan x={x} dy={13} fill={MUTED} fontSize={9.5}>{QUADRANTS[k].sub}</tspan>
                  </text>
                ))}
              </g>
            );
          })()}

          {/* X tick labels */}
          {xTicks.map((t) => (
            <text
              key={`xl-${t}`}
              x={xScale(t)}
              y={M.top + PLOT_H + 16}
              fontSize={12}
              fill={MUTED}
              textAnchor="middle"
            >
              {fmtXTick(t)}
            </text>
          ))}
          {/* Y tick labels */}
          {yTicks.map((t) => (
            <text
              key={`yl-${t}`}
              x={M.left - 8}
              y={yScale(t) + 4}
              fontSize={12}
              fill={MUTED}
              textAnchor="end"
            >
              {fmtYTick(t)}
            </text>
          ))}

          {/* Axis labels */}
          <text
            x={M.left + PLOT_W / 2}
            y={VIEW_H - 8}
            fontSize={12}
            fill={MUTED}
            textAnchor="middle"
          >
            {`Population CAGR, ${startYear}–${endYear} (BEA MSA population)`}
          </text>
          <text
            x={-(M.top + PLOT_H / 2)}
            y={16}
            fontSize={12}
            fill={MUTED}
            textAnchor="middle"
            transform="rotate(-90)"
          >
            {`${cfg.yLabel}, ${startYear}–${endYear}`}
          </text>

          {/* Points. Stable React key per city → DOM circle persists across
              mode changes → CSS transition tweens cx/cy. Clipped: the default
              frame deliberately leaves outliers outside it. */}
          <g clipPath="url(#mcs-plot-clip)">
            <g>
              {drawOrder.map((p) => {
                const isHi = highlight?.id === p.id;
                if (isHi) return null; // drawn in the highlight layer below
                // Hovered point pops: repainted in c-1 blue, near-opaque, a
                // touch larger, with the dark tone as stroke. CSS transitions
                // on fill/fill-opacity/r make it a quick fade, not a snap.
                const isHov = hover?.id === p.id;
                return (
                  <circle
                    key={p.id}
                    className="scatter-pt"
                    cx={xScale(p.x)}
                    cy={yScale(p.y)}
                    r={rOf(p) + (isHov ? 1.5 : 0)}
                    fill={isHov ? HOVER_FILL : POINT_FILL}
                    fillOpacity={isHov ? 0.95 : 0.35}
                    stroke={isHov ? HOVER_DARK : 'none'}
                    onMouseEnter={() => {
                      if (draggingRef.current) return;
                      setHover({
                        id: p.id,
                        cx: xScale(p.x),
                        cy: yScale(p.y),
                        name: p.name,
                        x: p.x,
                        y: p.y,
                        pop: p.pop,
                      });
                    }}
                    onMouseLeave={() => setHover((h) => (h?.id === p.id ? null : h))}
                  />
                );
              })}
            </g>

            {/* Highlighted city, drawn last so it always sits on top. Sized
                like the field (floored for findability) — the red + label
                carry it. */}
            {highlight && (
              <g>
                <circle
                  key={highlight.id}
                  className="scatter-pt highlight"
                  cx={xScale(highlight.x)}
                  cy={yScale(highlight.y)}
                  r={Math.max(rOf(highlight), 3.5) + (hover?.id === highlight.id ? 1.5 : 0)}
                  fill={HIGHLIGHT}
                  stroke="#fff"
                  strokeWidth={1.5}
                  onMouseEnter={() => {
                    if (draggingRef.current) return;
                    setHover({
                      id: highlight.id,
                      cx: xScale(highlight.x),
                      cy: yScale(highlight.y),
                      name: highlight.name,
                      x: highlight.x,
                      y: highlight.y,
                      pop: highlight.pop,
                    });
                  }}
                  onMouseLeave={() => setHover((h) => (h?.id === highlight.id ? null : h))}
                />
                <text
                  className="scatter-pt"
                  x={xScale(highlight.x) + Math.max(rOf(highlight), 3.5) + 4}
                  y={yScale(highlight.y) + 4}
                  fontSize={12}
                  fontWeight={600}
                  fill={HIGHLIGHT_DARK}
                >
                  {highlight.name}
                </text>
              </g>
            )}
          </g>

          {/* Rubber-band selection while dragging. */}
          {drag && (
            <rect
              x={Math.min(drag.x0, drag.x1)}
              y={Math.min(drag.y0, drag.y1)}
              width={Math.abs(drag.x1 - drag.x0)}
              height={Math.abs(drag.y1 - drag.y0)}
              fill={HIGHLIGHT}
              fillOpacity={0.08}
              stroke={HIGHLIGHT}
              strokeOpacity={0.5}
              strokeDasharray="3 3"
            />
          )}
        </svg>

        {hover && (
          <div
            className="chart-tooltip"
            style={{
              position: 'absolute',
              left: hover.cx * tooltipScale + 12,
              top: hover.cy * tooltipScale + 12,
              pointerEvents: 'none',
            }}
          >
            <div className="chart-tooltip-name">{hover.name}</div>
            <dl className="chart-tooltip-grid">
              <div style={{ display: 'contents' }}>
                <dt>Population</dt>
                <dd>{fmtCompact.format(hover.pop)}</dd>
              </div>
              <div style={{ display: 'contents' }}>
                <dt>Pop CAGR</dt>
                <dd>{fmtPct1(hover.x)}</dd>
              </div>
              <div style={{ display: 'contents' }}>
                <dt>{cfg.tooltipName}</dt>
                <dd>{cfg.yFormat(hover.y)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
      <p className="chart-source">
        <span className="chart-source-label">Source</span>
        {cfg.source} Point area scales with the metro's population.
      </p>
    </>
  );
}
