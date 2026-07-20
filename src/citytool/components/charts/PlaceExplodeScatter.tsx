import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type {
  CityPanelRow,
  HousingRow,
  CityRentRow,
  PlacePanelRow,
  PlaceHousingRow,
  PlaceRentRow,
  PlaceDirectoryRow,
} from '../../data/types';
import { useYearRange } from '../../lib/yearRange';
import { GL } from '../../lib/glColors';
import { fmtCompact, fmtPct1, fmtPct2, fmtPp } from '../../lib/format';
import { pctTickFormatter, ppTickFormatter } from '../../lib/tickFormat';
import {
  buildPoints as buildCityPoints,
  niceTicks,
  median,
  pad,
  radiusFor,
  smartDomain,
  METRO_R_MAX,
  METRO_R_MIN,
} from './MigrationChangeScatter';
import { buildPoints as buildPlacePoints } from './PlaceChangeScatter';

// The MSA → places "explode" scatter. Opens as a replica of the metro scatter
// from the previous section — every US metro on the pop-growth × pay-growth
// plane, the active MSA highlighted — then, when its section scrolls into
// view, plays a three-beat transition (the scatter analogue of the story
// map's place → MSA zoom):
//   1. fade   — the other metros dissolve, leaving the MSA dot and the dashed
//               national median lines;
//   2. explode — the MSA dot bursts into one dot per place inside it, the
//               active place highlighted; a dashed ring stays where the metro
//               itself sits;
//   3. zoom   — the axes rescale around the metro's places.
// The dashed median lines are the *national metro* medians throughout — they
// are never re-derived from the places — so each place reads against two
// benchmarks at once: its own metro (the ring) and the typical US metro (the
// dashed lines).

const HIGHLIGHT = GL.c2;
const HIGHLIGHT_DARK = GL.c2Dark;
const POINT_FILL = GL.muted;
const HOVER_FILL = GL.c1;      // hovered point pops in institutional blue
const HOVER_DARK = GL.c1Dark;
const RULE = GL.ink2;
const GRID = GL.gridline;
const MUTED = GL.ink3;

const VIEW_W = 720;
const VIEW_H = 400;
const M = { top: 16, right: 32, bottom: 50, left: 64 };
const PLOT_W = VIEW_W - M.left - M.right;
const PLOT_H = VIEW_H - M.top - M.bottom;

const EASE = [0.4, 0, 0.2, 1] as const;

// Bubble anchors for the places. Point area ∝ population, anchored to the
// largest place in the MSA. The fragments launch at these radii already — on
// the metro's absolute scale they'd be sub-pixel specks and the burst would
// read as empty — so the size story is honest within each frame, not across
// the metro→place hand-off.
const PLACE_R_MAX = 9;
const PLACE_R_MIN = 1.6;

// Places don't carry the metro's wage-premium series, so the mode set is the
// place trio plus the amenity-drift pair. Each mode maps 1:1 onto a metro mode
// of the same key, which is what the opening frame and the median lines are
// computed from. `fieldNoun` names the Y measure in the opening-frame heading.
type Mode = 'wage' | 'housing' | 'rent' | 'amenity_zhvi' | 'amenity_zori';

const MODES: Record<
  Mode,
  { label: string; yLabelMetro: string; yLabelPlace: string; tipLabel: string; fieldNoun: string }
> = {
  wage: {
    label: 'Salary CAGR (IRS residence)',
    yLabelMetro: 'Mean-wage CAGR (metro)',
    yLabelPlace: 'Avg salary CAGR (place)',
    tipLabel: 'Salary CAGR',
    fieldNoun: 'wage growth',
  },
  housing: {
    label: 'Home-value CAGR (ZHVI)',
    yLabelMetro: 'ZHVI CAGR (metro)',
    yLabelPlace: 'ZHVI CAGR (place)',
    tipLabel: 'ZHVI CAGR',
    fieldNoun: 'home-value growth',
  },
  rent: {
    label: 'Rent CAGR (ZORI, 2015+)',
    yLabelMetro: 'ZORI CAGR (metro)',
    yLabelPlace: 'ZORI CAGR (place)',
    tipLabel: 'ZORI CAGR',
    fieldNoun: 'rent growth',
  },
  amenity_zhvi: {
    label: 'Amenity drift — home value vs. salary (Δ residual)',
    yLabelMetro: 'Δ amenity residual (metro)',
    yLabelPlace: 'Δ amenity residual (place)',
    tipLabel: 'Δ amenity residual',
    fieldNoun: 'amenity drift',
  },
  amenity_zori: {
    label: 'Amenity drift — rent vs. salary (Δ residual, 2015+)',
    yLabelMetro: 'Δ amenity residual (metro)',
    yLabelPlace: 'Δ amenity residual (place)',
    tipLabel: 'Δ amenity residual',
    fieldNoun: 'amenity drift',
  },
};

// The intro is a linear phase walk; 'zoom' is also the resting, interactive
// state (hover + mode switches live there).
type Phase = 'field' | 'fade' | 'explode' | 'zoom';

type Hover = { id: string; cx: number; cy: number; name: string; x: number; y: number; pop: number };

type Props = {
  // True while this chart's story section is the active one — drives the intro.
  active: boolean;
  // Metro-level inputs: the opening frame + the national median lines.
  cityPanel: CityPanelRow[];
  cityHousing: HousingRow[];
  cityRent: CityRentRow[];
  // Place-level inputs: what the metro dot explodes into.
  placePanel: PlacePanelRow[];
  placeHousing: PlaceHousingRow[];
  placeRent: PlaceRentRow[];
  placeNames: Map<string, string>;
  msaPlaceIds: string[];
  msaId: string;
  msaName: string;
  highlightPlaceId: string;
  // Which Y-axis mode to open in (user can still switch via the dropdown).
  initialMode?: Mode;
  // Place → MSA labels for the amenity modes' fixed effects. Without it those
  // two modes render as no-data.
  directory?: PlaceDirectoryRow[];
};

export default function PlaceExplodeScatter({
  active,
  cityPanel,
  cityHousing,
  cityRent,
  placePanel,
  placeHousing,
  placeRent,
  placeNames,
  msaPlaceIds,
  msaId,
  msaName,
  highlightPlaceId,
  initialMode = 'wage',
  directory,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>('field');
  const [hover, setHover] = useState<Hover | null>(null);
  const { startYear, endYear } = useYearRange();
  const reduce = useReducedMotion();
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  };

  // Walk the intro. Beats are spaced so each reads on its own: the field
  // dissolves, then the burst, then the rescale.
  const playIntro = useCallback(() => {
    clearTimers();
    if (reduce) {
      setPhase('zoom');
      return;
    }
    setPhase('field');
    timersRef.current = [
      window.setTimeout(() => setPhase('fade'), 700),
      window.setTimeout(() => setPhase('explode'), 1400),
      window.setTimeout(() => setPhase('zoom'), 2800),
    ];
  }, [reduce]);

  // Replay on every entry: reset when the section deactivates so scrolling
  // back re-runs the burst (mirrors the map re-flying on each pass).
  useEffect(() => {
    if (active) {
      playIntro();
    } else {
      clearTimers();
      setPhase('field');
      setHover(null);
    }
    return clearTimers;
  }, [active, playIntro]);

  const exploded = phase === 'explode' || phase === 'zoom';
  const zoomed = phase === 'zoom';

  // ── Data ──────────────────────────────────────────────────────────────
  const cityPoints = useMemo(
    () => buildCityPoints(mode, cityPanel, cityHousing, cityRent, startYear, endYear),
    [mode, cityPanel, cityHousing, cityRent, startYear, endYear],
  );
  const peerSet = useMemo(() => new Set(msaPlaceIds), [msaPlaceIds]);
  const msaPanel = useMemo(
    () => placePanel.filter((r) => peerSet.has(r.place_id)),
    [placePanel, peerSet],
  );
  const msaOf = useMemo(
    () => (directory ? new Map(directory.map((d) => [d.place_id, d.msa_id])) : undefined),
    [directory],
  );
  const isAmenity = mode === 'amenity_zhvi' || mode === 'amenity_zori';
  const placePoints = useMemo(() => {
    // The amenity modes fit a national regression (choropleth parity), so
    // they need every place — the CAGR modes only need the metro's own. In
    // both cases only this MSA's places are plotted.
    const pts = buildPlacePoints(
      mode,
      isAmenity ? placePanel : msaPanel,
      placeHousing,
      placeRent,
      placeNames,
      peerSet,
      startYear,
      endYear,
      msaOf,
    );
    return isAmenity ? pts.filter((p) => p.isMsaPeer) : pts;
  }, [mode, isAmenity, placePanel, msaPanel, placeHousing, placeRent, placeNames, peerSet, startYear, endYear, msaOf]);
  const placeHighlight = placePoints.find((p) => p.id === highlightPlaceId) ?? null;
  const msaPt = useMemo(
    () => cityPoints.find((p) => p.id === msaId) ?? null,
    [cityPoints, msaId],
  );

  // National metro medians — the dashed lines. Fixed in data space across all
  // phases; only their pixel position moves when the domain rescales.
  const xMed = useMemo(() => median(cityPoints.map((p) => p.x)), [cityPoints]);
  const yMed = useMemo(() => median(cityPoints.map((p) => p.y)), [cityPoints]);

  // Bubble sizing + draw order (most populous first → small dots on top).
  const popMaxMetro = useMemo(() => Math.max(...cityPoints.map((p) => p.pop), 1), [cityPoints]);
  const popMaxPlace = useMemo(() => Math.max(...placePoints.map((p) => p.pop), 1), [placePoints]);
  const metroDraw = useMemo(() => [...cityPoints].sort((a, b) => b.pop - a.pop), [cityPoints]);
  const placeDraw = useMemo(() => [...placePoints].sort((a, b) => b.pop - a.pop), [placePoints]);
  // Same formula + anchors as MigrationChangeScatter, so the opening frame is
  // an exact replica of the previous section's chart.
  const rMetro = (pop: number) => radiusFor(pop, popMaxMetro, METRO_R_MAX, METRO_R_MIN);
  const rPlace = (pop: number) => radiusFor(pop, popMaxPlace, PLACE_R_MAX, PLACE_R_MIN);

  // ── Domains ───────────────────────────────────────────────────────────
  // Metro frame: the same quantile-trimmed smart domain as the previous
  // section's chart (same include set — its highlight IS this MSA), so the
  // opening frame is an exact replica of where the reader just was.
  const metroXDomain = useMemo<[number, number]>(
    () => smartDomain(cityPoints.map((p) => p.x), [msaPt?.x, xMed]),
    [cityPoints, msaPt, xMed],
  );
  const metroYDomain = useMemo<[number, number]>(
    () => smartDomain(cityPoints.map((p) => p.y), [msaPt?.y, yMed]),
    [cityPoints, msaPt, yMed],
  );

  // The zoomed frame fits the metro's places but always keeps the MSA point
  // and the national medians inside — the whole point is reading the places
  // against both benchmarks.
  const placeXDomain = useMemo<[number, number]>(() => {
    const vals = placePoints.map((p) => p.x);
    if (msaPt) vals.push(msaPt.x);
    if (xMed != null) vals.push(xMed);
    if (vals.length === 0) return metroXDomain;
    return pad(Math.min(...vals), Math.max(...vals), 0.08);
  }, [placePoints, msaPt, xMed, metroXDomain]);
  const placeYDomain = useMemo<[number, number]>(() => {
    const vals = placePoints.map((p) => p.y);
    if (msaPt) vals.push(msaPt.y);
    if (yMed != null) vals.push(yMed);
    if (vals.length === 0) return metroYDomain;
    return pad(Math.min(...vals), Math.max(...vals), 0.08);
  }, [placePoints, msaPt, yMed, metroYDomain]);

  const xDomain = zoomed ? placeXDomain : metroXDomain;
  const yDomain = zoomed ? placeYDomain : metroYDomain;

  const xs = (v: number) => M.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * PLOT_W;
  const ys = (v: number) => M.top + PLOT_H - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * PLOT_H;

  // Where the burst originates: the MSA dot, else the plot centre. The solid
  // dot mirrors the previous section's highlight (sized, floored) exactly.
  const ox = msaPt ? xs(msaPt.x) : M.left + PLOT_W / 2;
  const oy = msaPt ? ys(msaPt.y) : M.top + PLOT_H / 2;
  const msaR = msaPt ? Math.max(rMetro(msaPt.pop), 3.5) : 6;

  const xTicks = useMemo(() => niceTicks(xDomain[0], xDomain[1], 6), [xDomain]);
  const yTicks = useMemo(() => niceTicks(yDomain[0], yDomain[1], 6), [yDomain]);
  const fmtXTick = useMemo(() => pctTickFormatter(xTicks), [xTicks]);
  // Amenity modes are log-point deltas; the CAGR modes are percents.
  const fmtYTick = useMemo(
    () => (isAmenity ? ppTickFormatter(yTicks) : pctTickFormatter(yTicks)),
    [isAmenity, yTicks],
  );

  // ── Motion configs ────────────────────────────────────────────────────
  const dur = reduce ? 0 : 1;
  // Position moves: the burst and the rescale share one glide.
  const moveT = { duration: 0.85 * dur, ease: EASE };
  const fadeT = { duration: 0.55 * dur };
  // Resetting to the opening frame is instant — it happens offscreen.
  const snapOrMove = phase === 'field' ? { duration: 0 } : moveT;

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

  if (cityPoints.length === 0 && placePoints.length === 0) {
    return <p className="muted">Not enough data to render this scatter.</p>;
  }

  // Axis system (grid + tick labels + captions) is keyed on the active frame
  // and crossfaded — tick values change with the domain, so tweening each
  // label would produce nonsense mid-flight.
  const axisKey = `${mode}-${zoomed ? 'place' : 'metro'}`;

  const heading = exploded
    ? `Places within the ${msaName} MSA`
    : `Every US metro: population growth × ${MODES[mode].fieldNoun}`;

  return (
    <>
      <h4>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={heading}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 * dur }}
          >
            {heading}
          </motion.span>
        </AnimatePresence>
      </h4>

      <div className="chart-controls">
        <label>
          <span className="chart-controls-label">Y axis</span>
          <select
            value={mode}
            onChange={(e) => {
              // A mode switch mid-intro skips straight to the resting frame —
              // the choreography only makes sense from the top.
              clearTimers();
              setHover(null);
              setMode(e.target.value as Mode);
              setPhase('zoom');
            }}
          >
            {Object.entries(MODES).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-link"
          onClick={playIntro}
          disabled={!zoomed}
        >
          Replay
        </button>
      </div>

      <div ref={containerRef} className="migration-scatter">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id="pes-plot-clip">
              <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          {/* Grid, tick labels, axis captions — crossfaded per frame. */}
          <AnimatePresence initial={false}>
            <motion.g
              key={axisKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 * dur }}
            >
              {yTicks.map((t) => (
                <line
                  key={`gy-${t}`}
                  x1={M.left}
                  x2={M.left + PLOT_W}
                  y1={ys(t)}
                  y2={ys(t)}
                  stroke={GRID}
                  strokeDasharray="2 4"
                />
              ))}
              {xTicks.map((t) => (
                <line
                  key={`gx-${t}`}
                  x1={xs(t)}
                  x2={xs(t)}
                  y1={M.top}
                  y2={M.top + PLOT_H}
                  stroke={GRID}
                  strokeDasharray="2 4"
                />
              ))}
              {xTicks.map((t) => (
                <text key={`xl-${t}`} x={xs(t)} y={M.top + PLOT_H + 16} fontSize={12} fill={MUTED} textAnchor="middle">
                  {fmtXTick(t)}
                </text>
              ))}
              {yTicks.map((t) => (
                <text key={`yl-${t}`} x={M.left - 8} y={ys(t) + 4} fontSize={12} fill={MUTED} textAnchor="end">
                  {fmtYTick(t)}
                </text>
              ))}
              <text x={M.left + PLOT_W / 2} y={VIEW_H - 8} fontSize={12} fill={MUTED} textAnchor="middle">
                {zoomed
                  ? `Population CAGR, ${startYear}–${endYear} (Census PEP, places)`
                  : `Population CAGR, ${startYear}–${endYear} (BEA MSA population)`}
              </text>
              <text x={-(M.top + PLOT_H / 2)} y={16} fontSize={12} fill={MUTED} textAnchor="middle" transform="rotate(-90)">
                {`${zoomed ? MODES[mode].yLabelPlace : MODES[mode].yLabelMetro}, ${startYear}–${endYear}`}
              </text>
            </motion.g>
          </AnimatePresence>

          {/* Axis rules — static frame. */}
          <line x1={M.left} x2={M.left + PLOT_W} y1={M.top + PLOT_H} y2={M.top + PLOT_H} stroke={RULE} />
          <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + PLOT_H} stroke={RULE} />

          {/* National metro medians — pinned in data space, gliding in pixels.
              Drawn at the group origin and moved by transform: framer can't
              tween line-endpoint attributes (x1 etc.), but transforms it can. */}
          {xMed != null && (
            <motion.g
              initial={false}
              animate={{ x: xs(xMed) }}
              transition={snapOrMove}
              style={{ pointerEvents: 'none' }}
            >
              <line x1={0} x2={0} y1={M.top} y2={M.top + PLOT_H} stroke={MUTED} strokeDasharray="3 3" />
              <text x={5} y={M.top + 10} fontSize={9.5} fill={MUTED}>
                US-metro median
              </text>
            </motion.g>
          )}
          {yMed != null && (
            <motion.g
              initial={false}
              animate={{ y: ys(yMed) }}
              transition={snapOrMove}
              style={{ pointerEvents: 'none' }}
            >
              <line x1={M.left} x2={M.left + PLOT_W} y1={0} y2={0} stroke={MUTED} strokeDasharray="3 3" />
              <text x={M.left + PLOT_W - 5} y={-5} fontSize={9.5} fill={MUTED} textAnchor="end">
                US-metro median
              </text>
            </motion.g>
          )}

          {/* The metro field — every other US metro, dissolved in one group
              fade at the first beat. Gone from the DOM once zoomed. */}
          {!zoomed && (
            <motion.g
              initial={false}
              animate={{ opacity: phase === 'field' ? 1 : 0 }}
              transition={fadeT}
            >
              {metroDraw.map((p) => {
                if (p.id === msaId) return null;
                return (
                  <circle
                    key={p.id}
                    cx={xs(p.x)}
                    cy={ys(p.y)}
                    r={rMetro(p.pop)}
                    fill={POINT_FILL}
                    fillOpacity={0.35}
                  />
                );
              })}
            </motion.g>
          )}

          <g clipPath="url(#pes-plot-clip)">
            {/* The places — mounted at the MSA dot, flung to their own
                coordinates at the explode beat, re-gliding on zoom. Sized by
                population (area-true); the biggest launch first. */}
            {placeDraw.map((p, i) => {
              if (p.id === highlightPlaceId) return null;
              // Hovered point pops in c-1 blue with a fast per-value tween —
              // the slow snapOrMove glide stays reserved for positions.
              const isHov = hover?.id === p.id;
              return (
                <motion.circle
                  key={p.id}
                  initial={false}
                  animate={{
                    cx: exploded ? xs(p.x) : ox,
                    cy: exploded ? ys(p.y) : oy,
                    r: rPlace(p.pop) + (isHov ? 1.5 : 0),
                    fill: isHov ? HOVER_FILL : POINT_FILL,
                    fillOpacity: isHov ? 0.95 : 0.5,
                    opacity: exploded ? 1 : 0,
                  }}
                  transition={{
                    ...snapOrMove,
                    delay: phase === 'explode' ? (i / Math.max(placeDraw.length, 1)) * 0.35 * dur : 0,
                    r: { duration: 0.15 },
                    fill: { duration: 0.15 },
                    fillOpacity: { duration: 0.15 },
                  }}
                  stroke={isHov ? HOVER_DARK : 'none'}
                  onMouseEnter={() => {
                    if (!zoomed) return;
                    setHover({ id: p.id, cx: xs(p.x), cy: ys(p.y), name: p.name, x: p.x, y: p.y, pop: p.pop });
                  }}
                  onMouseLeave={() => setHover((h) => (h?.id === p.id ? null : h))}
                />
              );
            })}

            {/* The MSA itself: the solid red dot of the previous section hands
                off to a dashed ring pinned at the metro's own coordinates. */}
            {msaPt && (
              <>
                <motion.circle
                  initial={false}
                  animate={{ cx: ox, cy: oy, opacity: exploded ? 0 : 1 }}
                  transition={{ cx: snapOrMove, cy: snapOrMove, opacity: fadeT }}
                  r={msaR}
                  fill={HIGHLIGHT}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
                <motion.circle
                  initial={false}
                  animate={{ cx: ox, cy: oy, opacity: exploded ? 1 : 0 }}
                  transition={{ cx: snapOrMove, cy: snapOrMove, opacity: fadeT }}
                  r={msaR + 3}
                  fill="none"
                  stroke={MUTED}
                  strokeWidth={1.2}
                  strokeDasharray="3 3"
                />
              </>
            )}

            {/* The active place — flung with the rest but landing highlighted.
                Sized like its peers, floored so the red stays findable. */}
            {placeHighlight && (
              <motion.circle
                initial={false}
                animate={{
                  cx: exploded ? xs(placeHighlight.x) : ox,
                  cy: exploded ? ys(placeHighlight.y) : oy,
                  r: Math.max(rPlace(placeHighlight.pop), 4) + (hover?.id === placeHighlight.id ? 1.5 : 0),
                  opacity: exploded ? 1 : 0,
                }}
                transition={{
                  ...snapOrMove,
                  delay: phase === 'explode' ? 0.15 * dur : 0,
                  r: { duration: 0.15 },
                }}
                fill={HIGHLIGHT}
                stroke="#fff"
                strokeWidth={1.5}
                onMouseEnter={() => {
                  if (!zoomed) return;
                  setHover({
                    id: placeHighlight.id,
                    cx: xs(placeHighlight.x),
                    cy: ys(placeHighlight.y),
                    name: placeHighlight.name,
                    x: placeHighlight.x,
                    y: placeHighlight.y,
                    pop: placeHighlight.pop,
                  });
                }}
                onMouseLeave={() => setHover((h) => (h?.id === placeHighlight.id ? null : h))}
              />
            )}
          </g>

          {/* Labels ride outside the clip so they survive at the plot edge. */}
          {msaPt && (
            <>
              <motion.text
                initial={false}
                animate={{ x: ox + msaR + 4, y: oy + 4, opacity: exploded ? 0 : 1 }}
                transition={{ x: snapOrMove, y: snapOrMove, opacity: fadeT }}
                fontSize={12}
                fontWeight={600}
                fill={HIGHLIGHT_DARK}
                style={{ pointerEvents: 'none' }}
              >
                {msaName}
              </motion.text>
              <motion.text
                initial={false}
                animate={{ x: ox + msaR + 7, y: oy - msaR - 2, opacity: exploded ? 1 : 0 }}
                transition={{ x: snapOrMove, y: snapOrMove, opacity: fadeT }}
                fontSize={11}
                fill={MUTED}
                style={{ pointerEvents: 'none' }}
              >
                {msaName} (metro)
              </motion.text>
            </>
          )}
          {placeHighlight && (
            <motion.text
              initial={false}
              animate={{
                x: (exploded ? xs(placeHighlight.x) : ox) + Math.max(rPlace(placeHighlight.pop), 4) + 4,
                y: (exploded ? ys(placeHighlight.y) : oy) + 4,
                opacity: exploded ? 1 : 0,
              }}
              transition={{ ...snapOrMove, delay: phase === 'explode' ? 0.6 * dur : 0 }}
              fontSize={12}
              fontWeight={600}
              fill={HIGHLIGHT_DARK}
              style={{ pointerEvents: 'none' }}
            >
              {placeHighlight.name}
            </motion.text>
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
                <dt>{MODES[mode].tipLabel}</dt>
                <dd>{isAmenity ? fmtPp(hover.y) : fmtPct2(hover.y)}</dd>
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
            } on log salary (metros: plain OLS on IPUMS mean wage; places: MSA fixed effects on IRS salary), fit separately at each end of the window; Y is the change in the residual (log points ≈ pp) — how much ${
              mode === 'amenity_zhvi' ? 'home values' : 'rents'
            } moved beyond what salaries predict, for places net of the metro-wide trend.`}{' '}
        Each point is a place in the {msaName} MSA; red is the active place; the
        dashed ring marks the metro itself. Dashed lines are the medians across
        all US metros, carried over from the previous section. Point area scales
        with population.
      </p>
    </>
  );
}
