import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlacePanelRow, PlaceHousingRow, PlaceRentRow, PlaceDirectoryRow } from '../../data/types';
import { useYearRange } from '../../lib/yearRange';
import { GL } from '../../lib/glColors';
import { pctTickFormatter, ppTickFormatter } from '../../lib/tickFormat';
import { amenityResiduals, residualDelta, type AmenityObs } from '../../lib/amenityResidual';

// Place change-on-change scatter. X axis = population CAGR (Census PEP) over
// the configured compare window; Y = wage CAGR (IRS) or ZHVI CAGR (Zillow)
// over the same window. Per-place we snap to nearest available year in each
// source so a place doesn't disappear just because its 2012/2022 entries
// happen to be sparse.

function nearestRow<T extends { year: number }>(rows: T[], target: number, pred: (r: T) => boolean = () => true): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const r of rows) {
    if (!pred(r)) continue;
    const d = Math.abs(r.year - target);
    if (d < bestDist) { best = r; bestDist = d; }
  }
  return best;
}

// Highlight by muting: field in c-muted, peers in c-1 (institutional blue),
// the focus place in c-2 (identity red). Labels use each mark's dark tone.
const HIGHLIGHT = GL.c2;
const HIGHLIGHT_DARK = GL.c2Dark;
const POINT_FILL = GL.muted;
const PEER_FILL = GL.c1;
const PEER_DARK = GL.c1Dark; // hover pop stroke + repaint tone
const RULE = GL.ink2;      // axis line — 1px ink-2
const GRID = GL.gridline;
const MUTED = GL.ink3;     // tick marks + secondary text

const VIEW_W = 720;
const VIEW_H = 400;
const M = { top: 16, right: 32, bottom: 50, left: 64 };
const PLOT_W = VIEW_W - M.left - M.right;
const PLOT_H = VIEW_H - M.top - M.bottom;

const fmtPct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtPct2 = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmtPp = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`;

type Mode = 'wage' | 'housing' | 'rent' | 'amenity_zhvi' | 'amenity_zori';
type Universe = 'all' | 'msa';

const MODES: Record<Mode, { label: string; yLabel: string; tipLabel: string }> = {
  wage: {
    label: 'Salary CAGR (IRS residence)',
    yLabel: 'Avg salary CAGR (place)',
    tipLabel: 'Salary CAGR',
  },
  housing: {
    label: 'Home-value CAGR (ZHVI)',
    yLabel: 'ZHVI CAGR (place)',
    tipLabel: 'ZHVI CAGR',
  },
  rent: {
    label: 'Rent CAGR (ZORI, 2015+)',
    yLabel: 'ZORI CAGR (place)',
    tipLabel: 'ZORI CAGR',
  },
  amenity_zhvi: {
    label: 'Amenity drift — home value vs. salary (Δ residual)',
    yLabel: 'Δ amenity residual (place)',
    tipLabel: 'Δ amenity residual',
  },
  amenity_zori: {
    label: 'Amenity drift — rent vs. salary (Δ residual, 2015+)',
    yLabel: 'Δ amenity residual (place)',
    tipLabel: 'Δ amenity residual',
  },
};

export type Point = {
  id: string;
  name: string;
  x: number;
  y: number;
  pop: number; // end-year population — drives the bubble area where sized
  isMsaPeer: boolean;
};

type Hover = { id: string; cx: number; cy: number; name: string; x: number; y: number };

type Props = {
  panel: PlacePanelRow[];
  housing: PlaceHousingRow[];
  rent: PlaceRentRow[];
  placeNames: Map<string, string>;
  msaPlaceIds: string[];
  highlightPlaceId: string;
  // Pin the comparison universe and hide the "Compare against" control. With
  // 'msa' the scatter shows only places in the active MSA, drawn in the neutral
  // ink style of the metro scatter (no blue peer highlight) for consistency.
  lockUniverse?: Universe;
  // Which Y-axis mode to open in (user can still switch via the dropdown).
  initialMode?: Mode;
  // Place → MSA labels for the amenity modes' fixed effects. The amenity
  // regression is fit on the full `panel` (national when the caller passes the
  // USA panel) regardless of the display universe. Without it those two modes
  // render as no-data.
  directory?: PlaceDirectoryRow[];
};

function niceTicks(min: number, max: number, target = 6): number[] {
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
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pad(min: number, max: number, frac = 0.05): [number, number] {
  if (min === max) return [min - 1, max + 1];
  const p = (max - min) * frac;
  return [min - p, max + p];
}

// Exported so PlaceExplodeScatter shares the exact same point construction.
// `msaOf` (place → MSA) is only needed by the amenity modes, for the FE
// grouping — the CAGR modes ignore it.
export function buildPoints(
  mode: Mode,
  panel: PlacePanelRow[],
  housing: PlaceHousingRow[],
  rent: PlaceRentRow[],
  placeNames: Map<string, string>,
  msaPeers: Set<string>,
  startYear: number,
  endYear: number,
  msaOf?: Map<string, string>,
): Point[] {
  const panelByPlace = new Map<string, PlacePanelRow[]>();
  for (const r of panel) {
    const arr = panelByPlace.get(r.place_id) ?? [];
    arr.push(r);
    panelByPlace.set(r.place_id, arr);
  }
  const housingByPlace = new Map<string, PlaceHousingRow[]>();
  if (mode === 'housing') {
    for (const h of housing) {
      if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
      const arr = housingByPlace.get(h.place_id) ?? [];
      arr.push(h);
      housingByPlace.set(h.place_id, arr);
    }
  }
  const rentByPlace = new Map<string, PlaceRentRow[]>();
  if (mode === 'rent') {
    for (const r of rent) {
      if (r.zori == null || r.zori <= 0) continue;
      const arr = rentByPlace.get(r.place_id) ?? [];
      arr.push(r);
      rentByPlace.set(r.place_id, arr);
    }
  }

  const out: Point[] = [];

  // Δ amenity residual: national OLS of log(price) on log(avg salary) with
  // MSA fixed effects (within-MSA demeaning) — the same regression behind the
  // choropleth's amenity score — fit separately at each end of the window and
  // differenced per place. The FE absorbs each metro's own drift, so a
  // place's delta reads as movement relative to its metro average. Only
  // places observable at BOTH ends enter either fit.
  let amenityDelta: Map<string, number> | null = null;
  if (mode === 'amenity_zhvi' || mode === 'amenity_zori') {
    if (!msaOf) return out; // needs place → MSA labels for the fixed effects
    const priceSeries = new Map<string, { year: number; v: number }[]>();
    if (mode === 'amenity_zhvi') {
      for (const h of housing) {
        if (h.tier !== 'all' || h.zhvi == null || h.zhvi <= 0) continue;
        const arr = priceSeries.get(h.place_id) ?? [];
        arr.push({ year: h.year, v: h.zhvi });
        priceSeries.set(h.place_id, arr);
      }
    } else {
      for (const r of rent) {
        if (r.zori == null || r.zori <= 0) continue;
        const arr = priceSeries.get(r.place_id) ?? [];
        arr.push({ year: r.year, v: r.zori });
        priceSeries.set(r.place_id, arr);
      }
    }
    const obsStart: AmenityObs[] = [];
    const obsEnd: AmenityObs[] = [];
    for (const [placeId, rows] of panelByPlace) {
      const msa = msaOf.get(placeId);
      const prices = priceSeries.get(placeId);
      if (!msa || !prices) continue;
      const wS = nearestRow(rows, startYear, (r) => r.avg_wage != null && r.avg_wage > 0);
      const wE = nearestRow(rows, endYear,   (r) => r.avg_wage != null && r.avg_wage > 0);
      if (!wS || !wE || wS.year === wE.year) continue;
      const pS = nearestRow(prices, startYear);
      const pE = nearestRow(prices, endYear);
      if (!pS || !pE || pS.year === pE.year) continue;
      obsStart.push({ id: placeId, group: msa, logWage: Math.log(wS.avg_wage!), logPrice: Math.log(pS.v) });
      obsEnd.push({ id: placeId, group: msa, logWage: Math.log(wE.avg_wage!), logPrice: Math.log(pE.v) });
    }
    amenityDelta = residualDelta(amenityResiduals(obsStart), amenityResiduals(obsEnd));
  }

  for (const [placeId, rows] of panelByPlace) {
    const pStart = nearestRow(rows, startYear, (r) => r.population != null && r.population > 0);
    const pEnd   = nearestRow(rows, endYear,   (r) => r.population != null && r.population > 0);
    if (!pStart || !pEnd || pStart.year === pEnd.year) continue;
    const xSpan = pEnd.year - pStart.year;
    const x = (pEnd.population! / pStart.population!) ** (1 / xSpan) - 1;
    if (!Number.isFinite(x) || x < -0.1 || x > 0.15) continue;

    let y: number | null = null;
    if (mode === 'wage') {
      const wStart = nearestRow(rows, startYear, (r) => r.avg_wage != null && r.avg_wage > 0);
      const wEnd   = nearestRow(rows, endYear,   (r) => r.avg_wage != null && r.avg_wage > 0);
      if (!wStart || !wEnd || wStart.year === wEnd.year) continue;
      y = (wEnd.avg_wage! / wStart.avg_wage!) ** (1 / (wEnd.year - wStart.year)) - 1;
    } else if (mode === 'housing') {
      const hRows = housingByPlace.get(placeId) ?? [];
      const hStart = nearestRow(hRows, startYear);
      const hEnd   = nearestRow(hRows, endYear);
      if (!hStart?.zhvi || !hEnd?.zhvi || hStart.year === hEnd.year) continue;
      y = (hEnd.zhvi / hStart.zhvi) ** (1 / (hEnd.year - hStart.year)) - 1;
    } else if (mode === 'rent') {
      const rRows = rentByPlace.get(placeId) ?? [];
      const rStart = nearestRow(rRows, startYear, (r) => r.zori != null && r.zori > 0);
      const rEnd   = nearestRow(rRows, endYear,   (r) => r.zori != null && r.zori > 0);
      if (!rStart?.zori || !rEnd?.zori || rStart.year === rEnd.year) continue;
      y = (rEnd.zori / rStart.zori) ** (1 / (rEnd.year - rStart.year)) - 1;
    } else {
      y = amenityDelta?.get(placeId) ?? null;
    }
    if (y == null || !Number.isFinite(y)) continue;
    // The CAGR modes clamp to a plausible annual-growth band; the amenity
    // delta is a total log-point change over the window with fatter tails, so
    // it gets a wider artifact gate.
    const isDelta = mode === 'amenity_zhvi' || mode === 'amenity_zori';
    if (isDelta ? y < -0.75 || y > 0.75 : y < -0.15 || y > 0.3) continue;

    out.push({
      id: placeId,
      name: placeNames.get(placeId) ?? placeId,
      x,
      y,
      pop: pEnd.population!,
      isMsaPeer: msaPeers.has(placeId),
    });
  }
  return out;
}

export default function PlaceChangeScatter({
  panel,
  housing,
  rent,
  placeNames,
  msaPlaceIds,
  highlightPlaceId,
  lockUniverse,
  initialMode = 'wage',
  directory,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [universeState, setUniverse] = useState<Universe>('all');
  const universe = lockUniverse ?? universeState;
  const [hover, setHover] = useState<Hover | null>(null);
  // Drag-to-zoom. `zoom` overrides the auto-fit domains; `drag` is the live
  // rubber-band rectangle in viewBox coordinates while the mouse is down.
  const [zoom, setZoom] = useState<{ x: [number, number]; y: [number, number] } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const draggingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { startYear, endYear } = useYearRange();

  // Reset the zoom whenever the data scope changes — a stale window would be
  // meaningless against a different point cloud.
  useEffect(() => {
    setZoom(null);
  }, [mode, universe, startYear, endYear, highlightPlaceId]);

  // In MSA-only mode every point is a peer, so the blue peer-highlight loses
  // its job — draw them as neutral ink dots, mirroring MigrationChangeScatter.
  const neutralPeers = universe === 'msa';

  const peerSet = useMemo(() => new Set(msaPlaceIds), [msaPlaceIds]);
  const msaOf = useMemo(
    () => (directory ? new Map(directory.map((d) => [d.place_id, d.msa_id])) : undefined),
    [directory],
  );
  const allPoints = useMemo(
    () => buildPoints(mode, panel, housing, rent, placeNames, peerSet, startYear, endYear, msaOf),
    [mode, panel, housing, rent, placeNames, peerSet, startYear, endYear, msaOf],
  );
  const points = useMemo(
    () => (universe === 'msa' ? allPoints.filter((p) => p.isMsaPeer) : allPoints),
    [allPoints, universe],
  );

  const autoXDomain = useMemo<[number, number]>(() => {
    if (points.length === 0) return pad(-0.05, 0.05);
    const xs = points.map((p) => p.x);
    return pad(Math.min(...xs), Math.max(...xs));
  }, [points]);
  const autoYDomain = useMemo<[number, number]>(() => {
    if (points.length === 0) return pad(-0.05, 0.05);
    const ys = points.map((p) => p.y);
    return pad(Math.min(...ys), Math.max(...ys));
  }, [points]);

  // Effective domains: the zoom window if set, else the auto-fit bounds.
  const xDomain = zoom ? zoom.x : autoXDomain;
  const yDomain = zoom ? zoom.y : autoYDomain;

  const xScale = (v: number) => M.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * PLOT_W;
  const yScale = (v: number) => M.top + PLOT_H - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * PLOT_H;

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

  const xTicks = useMemo(() => niceTicks(xDomain[0], xDomain[1], 6), [xDomain]);
  const yTicks = useMemo(() => niceTicks(yDomain[0], yDomain[1], 6), [yDomain]);
  const fmtXTick = useMemo(() => pctTickFormatter(xTicks), [xTicks]);
  // Amenity modes are log-point deltas; the CAGR modes are percents.
  const isDeltaMode = mode === 'amenity_zhvi' || mode === 'amenity_zori';
  const fmtYTick = useMemo(
    () => (isDeltaMode ? ppTickFormatter(yTicks) : pctTickFormatter(yTicks)),
    [isDeltaMode, yTicks],
  );

  const xMed = useMemo(() => median(points.map((p) => p.x)), [points]);
  const yMed = useMemo(() => median(points.map((p) => p.y)), [points]);
  const highlight = points.find((p) => p.id === highlightPlaceId) ?? null;

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
  const tooltipScale = containerWidth / VIEW_W;

  return (
    <>
      <div className="chart-controls">
        <label>
          <span className="chart-controls-label">Y axis</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {Object.entries(MODES).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {!lockUniverse && (
          <label>
            <span className="chart-controls-label">Compare against</span>
            <select value={universe} onChange={(e) => setUniverse(e.target.value as Universe)}>
              <option value="all">All places in MSAs we cover</option>
              <option value="msa">Places in this MSA only</option>
            </select>
          </label>
        )}
      </div>

      <div className="chart-zoom-bar">
        <span className="chart-zoom-hint">Drag to zoom into a region.</span>
        <button type="button" className="btn-link" onClick={() => setZoom(null)} disabled={!zoom}>
          Reset zoom
        </button>
      </div>

      <div ref={containerRef} className="migration-scatter">
        {points.length === 0 ? (
          <p className="muted">No data for this mode at the current scope.</p>
        ) : (
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
              <clipPath id="pcs-plot-clip">
                <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} />
              </clipPath>
            </defs>
            <g>
              {yTicks.map((t) => (
                <line key={`gy-${t}`} x1={M.left} x2={M.left + PLOT_W} y1={yScale(t)} y2={yScale(t)} stroke={GRID} strokeDasharray="2 4" />
              ))}
              {xTicks.map((t) => (
                <line key={`gx-${t}`} x1={xScale(t)} x2={xScale(t)} y1={M.top} y2={M.top + PLOT_H} stroke={GRID} strokeDasharray="2 4" />
              ))}
            </g>
            <line x1={M.left} x2={M.left + PLOT_W} y1={M.top + PLOT_H} y2={M.top + PLOT_H} stroke={RULE} />
            <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + PLOT_H} stroke={RULE} />
            {xMed != null && (
              <line x1={xScale(xMed)} x2={xScale(xMed)} y1={M.top} y2={M.top + PLOT_H} stroke={MUTED} strokeDasharray="3 3" className="ref-line" />
            )}
            {yMed != null && (
              <line x1={M.left} x2={M.left + PLOT_W} y1={yScale(yMed)} y2={yScale(yMed)} stroke={MUTED} strokeDasharray="3 3" className="ref-line" />
            )}
            {xTicks.map((t) => (
              <text key={`xl-${t}`} x={xScale(t)} y={M.top + PLOT_H + 16} fontSize={12} fill={MUTED} textAnchor="middle">
                {fmtXTick(t)}
              </text>
            ))}
            {yTicks.map((t) => (
              <text key={`yl-${t}`} x={M.left - 8} y={yScale(t) + 4} fontSize={12} fill={MUTED} textAnchor="end">
                {fmtYTick(t)}
              </text>
            ))}
            <text x={M.left + PLOT_W / 2} y={VIEW_H - 8} fontSize={12} fill={MUTED} textAnchor="middle">
              {`Population CAGR, ${startYear}–${endYear} (Census PEP, places)`}
            </text>
            <text x={-(M.top + PLOT_H / 2)} y={16} fontSize={12} fill={MUTED} textAnchor="middle" transform="rotate(-90)">
              {`${MODES[mode].yLabel}, ${startYear}–${endYear}`}
            </text>
            <g clipPath="url(#pcs-plot-clip)">
              <g>
                {points.filter((p) => !p.isMsaPeer && p.id !== highlightPlaceId).map((p) => {
                  const isHov = hover?.id === p.id;
                  return (
                    <circle
                      key={p.id}
                      className="scatter-pt"
                      cx={xScale(p.x)}
                      cy={yScale(p.y)}
                      r={2.4 + (isHov ? 1.5 : 0)}
                      fill={isHov ? PEER_FILL : POINT_FILL}
                      fillOpacity={isHov ? 0.95 : 0.35}
                      stroke={isHov ? PEER_DARK : 'none'}
                      onMouseEnter={() => {
                        if (draggingRef.current) return;
                        setHover({ id: p.id, cx: xScale(p.x), cy: yScale(p.y), name: p.name, x: p.x, y: p.y });
                      }}
                      onMouseLeave={() => setHover((h) => (h?.id === p.id ? null : h))}
                    />
                  );
                })}
              </g>
              <g>
                {points.filter((p) => p.isMsaPeer && p.id !== highlightPlaceId).map((p) => {
                  const isHov = hover?.id === p.id;
                  return (
                    <circle
                      key={p.id}
                      className="scatter-pt"
                      cx={xScale(p.x)}
                      cy={yScale(p.y)}
                      r={(neutralPeers ? 3.5 : 3.4) + (isHov ? 1.5 : 0)}
                      fill={isHov ? PEER_FILL : neutralPeers ? POINT_FILL : PEER_FILL}
                      fillOpacity={isHov ? 0.95 : neutralPeers ? 0.4 : 0.9}
                      stroke={isHov ? PEER_DARK : 'none'}
                      onMouseEnter={() => {
                        if (draggingRef.current) return;
                        setHover({ id: p.id, cx: xScale(p.x), cy: yScale(p.y), name: p.name, x: p.x, y: p.y });
                      }}
                      onMouseLeave={() => setHover((h) => (h?.id === p.id ? null : h))}
                    />
                  );
                })}
              </g>
              {highlight && (
                <g>
                  <circle
                    key={highlight.id}
                    className="scatter-pt"
                    cx={xScale(highlight.x)}
                    cy={yScale(highlight.y)}
                    r={5.5 + (hover?.id === highlight.id ? 1.5 : 0)}
                    fill={HIGHLIGHT}
                    stroke="#fff"
                    strokeWidth={1.5}
                    onMouseEnter={() => {
                      if (draggingRef.current) return;
                      setHover({ id: highlight.id, cx: xScale(highlight.x), cy: yScale(highlight.y), name: highlight.name, x: highlight.x, y: highlight.y });
                    }}
                    onMouseLeave={() => setHover((h) => (h?.id === highlight.id ? null : h))}
                  />
                  <text className="scatter-pt" x={xScale(highlight.x) + 10} y={yScale(highlight.y) + 4} fontSize={12} fontWeight={600} fill={HIGHLIGHT_DARK}>
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
        )}
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
                <dt>Pop CAGR</dt>
                <dd>{fmtPct1(hover.x)}</dd>
              </div>
              <div style={{ display: 'contents' }}>
                <dt>{MODES[mode].tipLabel}</dt>
                <dd>{isDeltaMode ? fmtPp(hover.y) : fmtPct2(hover.y)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <p className="chart-source">
        <span className="chart-source-label">Source</span>
        Population CAGR: Census Population Estimates Program subcounty (Vintage
        2019 + 2024) at place level, {startYear}–{endYear}.{' '}
        {mode === 'wage'
          ? 'Wages: IRS A00200 / N00200, aggregated from ZIPs via Census ZCTA × Place areal weights. Residence-based.'
          : mode === 'housing'
          ? 'Home value: Zillow ZHVI all-tier, aggregated the same way.'
          : mode === 'rent'
          ? 'Rent: Zillow ZORI (smoothed all-homes), aggregated the same way. Series begins 2015 — coverage is materially thinner than ZHVI.'
          : `Amenity residual: national OLS of log ${
              mode === 'amenity_zhvi' ? 'ZHVI' : 'ZORI'
            } on log IRS salary with MSA fixed effects, fit separately at each end of the window; Y is the change in each place's residual (log points ≈ pp) — how much its ${
              mode === 'amenity_zhvi' ? 'home values' : 'rents'
            } moved beyond what salaries predict, net of the metro-wide trend.`}{' '}
        {neutralPeers
          ? 'Each point is a place in this MSA; red is the active place.'
          : 'Blue points are places in the current MSA; red is the active place; grey is the rest.'}{' '}
        Dashed lines are medians across visible points.
      </p>
    </>
  );
}
