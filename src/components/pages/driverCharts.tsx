/* Schematics of the live tool's driver charts — one per Drivers ChartKind in
   figures.ts (the Amenities Module's indicators are amenityCharts.tsx; this
   file's dispatcher hands those kinds on). The live tool (cities-tool, src/components/story/
   DriversSection.tsx) answers each of an ending's questions with one chart;
   the analysis section draws the FORM of that chart here, so a data point
   reads as the thing it will be — a waterfall, a map, a burst of places —
   rather than as an empty frame.

   TWO VERSIONS OF EACH. Where the city has an entry in driverData.ts — the
   live tool's own files, pulled by scripts/build-driver-data.mjs — the chart
   is REAL: the same numbers the live page draws, on its window, with a
   native tooltip on every mark. A city without one gets the SCHEMATIC: every
   mark generated from a fixed seed, no axis carrying a value, the well
   tagged as such. Both keep what a reader needs to recognise the live
   chart — the marks, the order of the parts, the benchmark each is read
   against — and give colour the same jobs:

     polarity    rise / fall around a neutral midpoint (the live tool's
                 green-good / red-bad convention, this app's --rise/--fall)
     magnitude   one hue, light → dark (the supply side's rust)
     identity    the admin city and its metro in the app's own geography
                 tokens (--geo-city, --geo-metro), the field in grey

   Text inside a well wears ink tokens, never the series colour. */

import { useId, useMemo, useState } from "react";
import { Delaunay } from "d3-delaunay";
import { hierarchy, treemap } from "d3-hierarchy";
import { interpolateRgb } from "d3-interpolate";
import type { ChartKind } from "../../data/figures";
import { driverData, type DriverData } from "../../data/driverData";
import { AmenityChart, amenitySource, isAmenityKind } from "./amenityCharts";

const W = 320;
const H = 190;

const RISE = "#3d9a43";
const FALL = "#c0244a";
const RISE_TINT = "#d5ead6";
const FALL_TINT = "#f3d3db";
const MID = "#e6e9ea";
const ANCHOR = "#56626a";
const FIELD = "#c8cdd0";
const CITY = "#255862";
const METRO = "#4a6a72";
/* magnitude: one hue, light → dark */
const SEQ = ["#fbebe4", "#f3cdbd", "#e6a88f", "#d37f5e", "#b8431f"];

/** a small seeded generator, so a schematic draws the same way every time */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
/** roughly normal, from the seeded uniform */
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) / 2;

function Frame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      className="dc-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label} (schematic)`}
    >
      {children}
    </svg>
  );
}

/* ---------- the industry story ---------- */

/** ShiftShareWaterfall: start → national → industry mix → local share → new
 *  industries → end. The anchors are totals (neutral), the four effects are
 *  signed deltas floating at the running total; the axis is broken, because
 *  the anchors are levels and the effects are changes. */
function Waterfall() {
  const base = 146;
  const bars: { k: string[]; from: number; to: number; anchor?: boolean }[] = [
    { k: ["Start"], from: base, to: 84, anchor: true },
    { k: ["National"], from: 84, to: 26 },
    { k: ["Industry", "mix"], from: 26, to: 44 },
    { k: ["Local", "share"], from: 44, to: 78 },
    { k: ["New", "industries"], from: 78, to: 68 },
    { k: ["End"], from: base, to: 68, anchor: true },
  ];
  const bw = 32;
  const gap = (W - 44 - bars.length * bw) / (bars.length - 1);
  const x = (i: number) => 22 + i * (bw + gap);
  return (
    <Frame label="Shift-share waterfall">
      <line className="dc-axis" x1={14} x2={W - 14} y1={base} y2={base} />
      {bars.map((b, i) => {
        const y = Math.min(b.from, b.to);
        const h = Math.abs(b.from - b.to);
        const up = b.to < b.from;
        return (
          <g key={b.k.join(" ")}>
            <rect
              x={x(i)}
              y={y}
              width={bw}
              height={h}
              rx={2.5}
              fill={b.anchor ? ANCHOR : up ? RISE : FALL}
            />
            {/* the running total carries across to the next bar */}
            {i < bars.length - 1 && (
              <line
                className="dc-link"
                x1={x(i) + bw}
                x2={x(i + 1)}
                y1={b.to}
                y2={b.to}
              />
            )}
            {/* the broken axis: the anchors are levels, the effects changes,
                so the anchors cross a compressed stretch */}
            {b.anchor && (
              <path
                className="dc-break"
                d={`M${x(i) - 2} ${base - 14} l${(bw + 4) / 4} -4 l${(bw + 4) / 4} 4 l${(bw + 4) / 4} -4 l${(bw + 4) / 4} 4`}
              />
            )}
            <text className="dc-lab" x={x(i) + bw / 2} y={base + 13} textAnchor="middle">
              {b.k.map((line, li) => (
                <tspan key={line} x={x(i) + bw / 2} dy={li ? 10.5 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <text className="dc-lab dc-quiet" x={W / 2} y={H - 6} textAnchor="middle">
        the metro's jobs, start → end of the window
      </text>
    </Frame>
  );
}

const EFFECT_VIEWS = [
  { id: "bars", label: "Ranked bars" },
  { id: "paths", label: "Share paths" },
  { id: "treemap", label: "Treemap" },
] as const;
type EffectView = (typeof EFFECT_VIEWS)[number]["id"];

/** IndustryEffectViews: three ways to read the decomposition by industry,
 *  switchable in the live tool — and here, since which one survives is the
 *  part of the story the live tool has not settled. */
function EffectViews({ data }: { data: DriverData | null }) {
  const [view, setView] = useState<EffectView>("bars");
  return (
    <>
      <div className="dc-tabs" role="group" aria-label="Industry view">
        {EFFECT_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={"dc-tab" + (v.id === view ? " on" : "")}
            aria-pressed={v.id === view}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "bars" ? (
        data ? <RealRankedBars data={data} /> : <RankedBars />
      ) : view === "paths" ? (
        data ? <RealSharePaths data={data} /> : <SharePaths />
      ) : data ? (
        <RealEffectTreemap data={data} />
      ) : (
        <EffectTreemap />
      )}
    </>
  );
}

/** one metric, sorted, capped to the biggest movers */
function RankedBars() {
  const vals = [62, 44, 31, 18, -12, -24, -39, -58];
  const mid = 168;
  const rowH = 17;
  const y0 = 22;
  return (
    <Frame label="Ranked bars of the biggest industry movers">
      <line className="dc-axis" x1={mid} x2={mid} y1={y0 - 6} y2={y0 + vals.length * rowH + 2} />
      {vals.map((v, i) => (
        <g key={i}>
          {/* a stub where the industry's name goes */}
          <rect
            className="dc-stub"
            x={16}
            y={y0 + i * rowH + 3}
            width={58 + ((i * 37) % 32)}
            height={5}
            rx={2.5}
          />
          <rect
            x={v >= 0 ? mid + 1 : mid - 1 + v * 1.3}
            y={y0 + i * rowH}
            width={Math.abs(v) * 1.3}
            height={11}
            rx={2.5}
            fill={v >= 0 ? RISE : FALL}
          />
        </g>
      ))}
      <text className="dc-lab dc-quiet" x={mid + 6} y={H - 8}>
        gained →
      </text>
      <text className="dc-lab dc-quiet" x={mid - 6} y={H - 8} textAnchor="end">
        ← lost
      </text>
    </Frame>
  );
}

/** employment × market share, one point per year — the only view that keeps
 *  the intervening years, and the only one that separates "the industry
 *  shrank everywhere" from "we lost" */
function SharePaths() {
  const paths = useMemo(() => {
    const r = rng(11);
    const starts: [number, number, number, number][] = [
      [70, 120, 14, -9],
      [120, 70, 12, 7],
      [190, 110, -10, 8],
      [230, 60, 9, -2],
    ];
    return starts.map(([sx, sy, dx, dy]) => {
      const pts: [number, number][] = [[sx, sy]];
      for (let i = 1; i < 6; i++) {
        const [px, py] = pts[i - 1];
        pts.push([px + dx + gauss(r) * 7, py + dy + gauss(r) * 6]);
      }
      return pts;
    });
  }, []);
  const px0 = 40;
  const py1 = 152;
  return (
    <Frame label="Share paths: employment against market share, one point per year">
      <line className="dc-axis" x1={px0} x2={W - 16} y1={py1} y2={py1} />
      <line className="dc-axis" x1={px0} x2={px0} y1={18} y2={py1} />
      {paths.map((pts, i) => {
        /* up the share axis is gaining ground; down is losing it */
        const gained = pts[pts.length - 1][1] < pts[0][1];
        const col = gained ? RISE : FALL;
        const [ax, ay] = pts[pts.length - 1];
        const [bx, by] = pts[pts.length - 2];
        const a = Math.atan2(ay - by, ax - bx);
        return (
          <g key={i}>
            <polyline
              points={pts.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke={col}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            {pts.slice(0, -1).map(([x, y], j) => (
              <circle key={j} cx={x} cy={y} r={2} fill="#fff" stroke={col} strokeWidth={1.2} />
            ))}
            <path
              d={`M${ax} ${ay} l${-7 * Math.cos(a - 0.45)} ${-7 * Math.sin(a - 0.45)} M${ax} ${ay} l${-7 * Math.cos(a + 0.45)} ${-7 * Math.sin(a + 0.45)}`}
              stroke={col}
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
            />
          </g>
        );
      })}
      <text className="dc-lab" x={(px0 + W - 16) / 2} y={py1 + 16} textAnchor="middle">
        employment in the metro →
      </text>
      <text
        className="dc-lab"
        x={px0 - 12}
        y={(18 + py1) / 2}
        textAnchor="middle"
        transform={`rotate(-90 ${px0 - 12} ${(18 + py1) / 2})`}
      >
        share of the national industry →
      </text>
    </Frame>
  );
}

/** a slice-and-dice treemap: rows of cells, each row a share of the height */
function treemapCells(
  rows: number[][],
  x0: number,
  y0: number,
  w: number,
  h: number,
) {
  const total = rows.flat().reduce((a, b) => a + b, 0);
  const cells: { x: number; y: number; w: number; h: number; v: number; row: number }[] = [];
  let y = y0;
  rows.forEach((row, ri) => {
    const sum = row.reduce((a, b) => a + b, 0);
    const rh = (sum / total) * h;
    let x = x0;
    row.forEach((v) => {
      const cw = (v / sum) * w;
      cells.push({ x, y, w: cw, h: rh, v, row: ri });
      x += cw;
    });
    y += rh;
  });
  return cells;
}

/** composition and performance at once — area is the metro's base, colour
 *  is the effect */
function EffectTreemap() {
  const cells = treemapCells(
    [
      [30, 22, 14],
      [18, 14, 10, 8],
      [10, 8, 7, 5, 4],
    ],
    16,
    16,
    W - 32,
    H - 40,
  );
  const tone = [4, 3, 1, 2, 0, 3, 2, 1, 4, 2, 0, 3];
  return (
    <Frame label="Treemap of the metro's industries, coloured by effect">
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x + 1}
          y={c.y + 1}
          width={Math.max(0, c.w - 2)}
          height={Math.max(0, c.h - 2)}
          rx={2.5}
          fill={[FALL, FALL_TINT, MID, RISE_TINT, RISE][tone[i % tone.length]]}
        />
      ))}
      <text className="dc-lab dc-quiet" x={16} y={H - 8}>
        area = jobs · colour = effect, lost ↔ gained
      </text>
    </Frame>
  );
}

/** NewIndustriesTreemap: what the metro had none of at the start, sized by
 *  end-year jobs and grouped by sector */
function NewIndustries() {
  const groups: { x: number; w: number; rows: number[][] }[] = [
    { x: 16, w: 136, rows: [[9, 6], [5, 4, 3]] },
    { x: 156, w: 92, rows: [[7], [4, 3]] },
    { x: 252, w: 52, rows: [[4], [3], [2]] },
  ];
  return (
    <Frame label="Treemap of industries new to the metro, grouped by sector">
      {groups.map((g, gi) => (
        <g key={gi}>
          <rect className="dc-stub" x={g.x + 1} y={18} width={g.w * 0.55} height={5} rx={2.5} />
          {treemapCells(g.rows, g.x, 28, g.w, H - 56).map((c, i) => (
            <rect
              key={i}
              x={c.x + 1}
              y={c.y + 1}
              width={Math.max(0, c.w - 2)}
              height={Math.max(0, c.h - 2)}
              rx={2.5}
              fill={CITY}
              fillOpacity={0.78 - c.row * 0.22 - (i % 2) * 0.08}
            />
          ))}
        </g>
      ))}
      <text className="dc-lab dc-quiet" x={16} y={H - 8}>
        area = jobs at the end of the window · grouped by sector
      </text>
    </Frame>
  );
}

/* ---------- the map ---------- */

/** MsaPlacesChoropleth, in the abstract: a tessellated metro, each place
 *  filled by where its price growth sits in the metro's own distribution
 *  (slow → fast), the admin city outlined. */
function PlacesMap({ city }: { city: string }) {
  const clip = useId();
  const { cells, outline, home } = useMemo(() => {
    const r = rng(7);
    const cx = 136;
    const cy = 94;
    /* the metro's outline: a wobbling closed curve */
    const ring: [number, number][] = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = 1 + (r() - 0.5) * 0.34;
      ring.push([cx + Math.cos(a) * 112 * rad, cy + Math.sin(a) * 70 * rad]);
    }
    const mid = (p: [number, number], q: [number, number]) =>
      [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number];
    let d = "";
    ring.forEach((p, i) => {
      const next = ring[(i + 1) % n];
      const m = mid(p, next);
      d += i === 0 ? `M${mid(ring[n - 1], p).join(" ")} ` : "";
      d += `Q${p.join(" ")} ${m.join(" ")} `;
    });
    /* the places: denser toward the core, the way a metro's are */
    const pts: [number, number][] = [];
    for (let i = 0; i < 34; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.pow(r(), 0.75);
      pts.push([cx + Math.cos(a) * 118 * rad, cy + Math.sin(a) * 76 * rad]);
    }
    const vor = Delaunay.from(pts).voronoi([0, 0, 272, H]);
    /* the fill: a gradient across the metro plus noise — the pattern is the
       point, a wall that binds the whole metro or a corner of it */
    const cells = pts.map(([x, y], i) => {
      const t = 0.55 - Math.hypot((x - cx) / 118, (y - cy) / 76) * 0.55 + (r() - 0.5) * 0.4;
      return { d: vor.renderCell(i), t: Math.max(0, Math.min(0.999, t)) };
    });
    /* the admin city: the place nearest the core */
    let home = 0;
    pts.forEach(([x, y], i) => {
      if (Math.hypot(x - cx, y - cy) < Math.hypot(pts[home][0] - cx, pts[home][1] - cy))
        home = i;
    });
    return { cells, outline: d + "Z", home };
  }, []);
  const ramp = SEQ;
  return (
    <Frame label="Map of the metro's places, filled by home-value growth">
      <defs>
        <clipPath id={clip}>
          <path d={outline} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {cells.map((c, i) => (
          <path
            key={i}
            d={c.d}
            fill={ramp[Math.floor(c.t * ramp.length)]}
            stroke="#fff"
            strokeWidth={1.2}
          />
        ))}
        {/* the admin city, outlined so it can be found among its neighbours */}
        <path d={cells[home].d} fill="none" stroke="var(--ink)" strokeWidth={2.2} />
      </g>
      <path d={outline} fill="none" stroke={METRO} strokeWidth={1.2} strokeDasharray="4 3" />
      {/* the legend: the ramp, named at both ends */}
      {ramp.map((c, i) => (
        <rect key={c} x={284} y={46 + (ramp.length - 1 - i) * 17} width={12} height={15} rx={2} fill={c} />
      ))}
      <text className="dc-lab" x={290} y={38} textAnchor="middle">
        fast
      </text>
      <text className="dc-lab" x={290} y={46 + ramp.length * 17 + 12} textAnchor="middle">
        slow
      </text>
      <text className="dc-lab dc-quiet" x={16} y={H - 8}>
        {`every place in the metro · ${city} outlined`}
      </text>
    </Frame>
  );
}

/* ---------- the housing story's trajectory ---------- */

/** MsaCostTrend: the metro, the median metro in the same year, and the
 *  place — with the compare window marked on the axis */
function CostTrend({ city }: { city: string }) {
  const x0 = 22;
  const x1 = 232;
  const yb = 150;
  const n = 24;
  const line = (f: (t: number) => number) =>
    Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return `${x0 + t * (x1 - x0)},${yb - f(t)}`;
    }).join(" ");
  /* a dip, then a climb that steepens — the shape of the last two decades */
  const shape = (k: number, lift: number) => (t: number) =>
    lift + k * (28 * t + 62 * Math.pow(Math.max(0, t - 0.45), 1.6) - 16 * Math.exp(-Math.pow((t - 0.38) / 0.12, 2)));
  const metro = shape(1, 18);
  const place = shape(1.22, 26);
  const median = shape(0.62, 12);
  const wx = (t: number) => x0 + t * (x1 - x0);
  return (
    <Frame label="Home values over time: the metro, the median metro and the place">
      {/* the compare window */}
      <rect className="dc-window" x={wx(0.74)} y={20} width={wx(0.96) - wx(0.74)} height={yb - 20} />
      <text className="dc-lab dc-quiet" x={(wx(0.74) + wx(0.96)) / 2} y={16} textAnchor="middle">
        compare window
      </text>
      <line className="dc-axis" x1={x0} x2={x1} y1={yb} y2={yb} />
      <polyline points={line(median)} fill="none" stroke={FIELD} strokeWidth={2} strokeDasharray="5 4" />
      <polyline points={line(metro)} fill="none" stroke={METRO} strokeWidth={2} strokeLinejoin="round" />
      <polyline points={line(place)} fill="none" stroke={CITY} strokeWidth={2} strokeLinejoin="round" />
      {(
        [
          [place, CITY, city],
          [metro, METRO, "its MSA"],
          [median, FIELD, "median metro"],
        ] as [(t: number) => number, string, string][]
      ).map(([f, col, name]) => (
        <g key={name}>
          <circle cx={x1} cy={yb - f(1)} r={3} fill={col} stroke="#fff" strokeWidth={1.2} />
          <text className="dc-lab dc-name" x={x1 + 8} y={yb - f(1) + 3.5}>
            {name}
          </text>
        </g>
      ))}
      <text className="dc-lab dc-quiet" x={x0} y={yb + 15}>
        years →
      </text>
    </Frame>
  );
}

const pct1 = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;
const jobs = (v: number, signed = false) => {
  const a = Math.abs(v);
  const body =
    a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : `${Math.round(a)}`;
  return (v < 0 ? "−" : signed ? "+" : "") + body;
};
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};
const lin = (d: [number, number], r: [number, number]) => (v: number) =>
  r[0] + ((v - d[0]) / (d[1] - d[0])) * (r[1] - r[0]);
const diverge = (t: number) =>
  t < 0 ? interpolateRgb(MID, FALL)(Math.min(1, -t)) : interpolateRgb(MID, RISE)(Math.min(1, t));

function RealWaterfall({ data }: { data: DriverData }) {
  const ss = data.shiftShare;
  const base = 146;
  const steps = [
    { k: ["Start", String(ss.t0)], delta: null as number | null, level: ss.start },
    { k: ["National"], delta: ss.national, level: 0 },
    { k: ["Industry", "mix"], delta: ss.mix, level: 0 },
    { k: ["Local", "share"], delta: ss.local, level: 0 },
    { k: ["New", "industries"], delta: ss.fresh, level: 0 },
    { k: ["End", String(ss.t1)], delta: null, level: ss.end },
  ];
  /* the running total each effect floats at */
  let run = ss.start;
  const bars = steps.map((st) => {
    if (st.delta == null) return { ...st, from: 0, to: st.level };
    const from = run;
    run += st.delta;
    return { ...st, from, to: run };
  });
  const levels = bars.flatMap((b) => (b.delta == null ? [b.to] : [b.from, b.to]));
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  /* the broken axis: the anchors are levels, the effects changes — the
     stretch below the lowest mark is compressed into the break */
  const y = lin([lo - (hi - lo) * 0.35, hi + (hi - lo) * 0.12], [base - 22, 22]);
  const bw = 32;
  const gap = (W - 44 - bars.length * bw) / (bars.length - 1);
  const x = (i: number) => 22 + i * (bw + gap);
  return (
    <Frame label={`Shift-share of the ${data.city} MSA's jobs, ${ss.t0} to ${ss.t1}`}>
      <line className="dc-axis" x1={14} x2={W - 14} y1={base} y2={base} />
      {bars.map((b, i) => {
        const anchor = b.delta == null;
        const top = anchor ? y(b.to) : Math.min(y(b.from), y(b.to));
        const h = anchor ? base - y(b.to) : Math.max(1.5, Math.abs(y(b.from) - y(b.to)));
        const up = (b.delta ?? 0) >= 0;
        return (
          <g key={b.k.join(" ")}>
            <rect x={x(i)} y={top} width={bw} height={h} rx={2.5} fill={anchor ? ANCHOR : up ? RISE : FALL}>
              <title>
                {anchor
                  ? `${b.k.join(" ")}: ${Math.round(b.to).toLocaleString()} jobs`
                  : `${b.k.join(" ")}: ${jobs(b.delta!, true)} jobs`}
              </title>
            </rect>
            {i < bars.length - 1 && (
              <line className="dc-link" x1={x(i) + bw} x2={x(i + 1)} y1={y(b.to)} y2={y(b.to)} />
            )}
            {anchor && (
              <path
                className="dc-break"
                d={`M${x(i) - 2} ${base - 12} l${(bw + 4) / 4} -4 l${(bw + 4) / 4} 4 l${(bw + 4) / 4} -4 l${(bw + 4) / 4} 4`}
              />
            )}
            <text className="dc-lab dc-name" x={x(i) + bw / 2} y={top - 4} textAnchor="middle">
              {anchor ? jobs(b.to) : jobs(b.delta!, true)}
            </text>
            <text className="dc-lab" x={x(i) + bw / 2} y={base + 13} textAnchor="middle">
              {b.k.map((line, li) => (
                <tspan key={line} x={x(i) + bw / 2} dy={li ? 10.5 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function RealRankedBars({ data }: { data: DriverData }) {
  /* the live chart ranks fifteen; the twelve biggest fit this frame */
  const rows = [...data.shiftShare.bars]
    .sort((a, b) => Math.abs(b.ls) - Math.abs(a.ls))
    .slice(0, 12)
    .sort((a, b) => b.ls - a.ls);
  const dom: [number, number] = [
    Math.min(0, ...rows.map((r) => r.ls)),
    Math.max(0, ...rows.map((r) => r.ls)),
  ];
  /* three columns: the sector, its bar, its value — so a long bar never
     runs under either label */
  const x = lin(dom, [142, W - 40]);
  const rowH = 12.6;
  const y0 = 16;
  return (
    <Frame label={`Local-share effect by 2-digit sector, ${data.city} MSA`}>
      <line className="dc-axis" x1={x(0)} x2={x(0)} y1={y0 - 4} y2={y0 + rows.length * rowH} />
      {rows.map((r, i) => {
        const x0 = Math.min(x(0), x(r.ls));
        const w = Math.max(1.5, Math.abs(x(r.ls) - x(0)));
        return (
          <g key={r.code}>
            <text className="dc-lab" x={136} y={y0 + i * rowH + 7.5} textAnchor="end">
              {`${r.code} · ${r.name}`}
            </text>
            <rect x={x0} y={y0 + i * rowH} width={w} height={9} rx={2} fill={r.ls >= 0 ? RISE : FALL}>
              <title>{`${r.name}: local share ${jobs(r.ls, true)} jobs (${Math.round(r.e0).toLocaleString()} → ${Math.round(r.e1).toLocaleString()})`}</title>
            </rect>
            <text className="dc-lab dc-name" x={W - 8} y={y0 + i * rowH + 7.5} textAnchor="end">
              {jobs(r.ls, true)}
            </text>
          </g>
        );
      })}
      <text className="dc-lab dc-quiet" x={W / 2} y={H - 6} textAnchor="middle">
        local-share effect, jobs
      </text>
    </Frame>
  );
}

function RealSharePaths({ data }: { data: DriverData }) {
  const series = data.shiftShare.sharePaths;
  const all = series.flatMap((s) => s.pts);
  const xd: [number, number] = [
    Math.log(Math.min(...all.map((p) => p.emp)) * 0.9),
    Math.log(Math.max(...all.map((p) => p.emp)) * 1.1),
  ];
  const shares = all.map((p) => p.share);
  const yd: [number, number] = [Math.min(...shares) * 0.92, Math.max(...shares) * 1.05];
  const x = (emp: number) => lin(xd, [44, W - 58])(Math.log(emp));
  const y = lin(yd, [150, 16]);
  const overall = data.shiftShare.overallShare;
  /* direct labels for the biggest sectors, as many as fit without touching;
     the rest answer the pointer */
  const named = new Map<string, string>();
  /* the benchmark's own label takes its spot first, under the line's right
     end, and the sector labels keep clear of it */
  const allLabel = `all jobs ${(overall * 100).toFixed(1)}%`;
  const placed: [number, number, number][] = [
    [W - 16 - allLabel.length * 5, y(overall) + 10, allLabel.length * 5],
  ];
  for (const s of series.slice(0, 6)) {
    const last = s.pts[s.pts.length - 1];
    const label = s.name.split(/[ ,&]/)[0];
    const lx = x(last.emp) + 5;
    const ly = y(last.share);
    const lw = label.length * 5.4;
    if (lx + lw > W - 4) continue;
    if (placed.some(([px, py, pw]) => Math.abs(py - ly) < 11 && lx < px + pw && px < lx + lw)) continue;
    placed.push([lx, ly, lw]);
    named.set(s.code, label);
  }
  return (
    <Frame label={`Share paths by 2-digit sector, ${data.city} MSA`}>
      <line className="dc-axis" x1={44} x2={W - 14} y1={150} y2={150} />
      <line className="dc-axis" x1={44} x2={44} y1={14} y2={150} />
      {[yd[0] + (yd[1] - yd[0]) * 0.1, (yd[0] + yd[1]) / 2, yd[1] - (yd[1] - yd[0]) * 0.1].map((t) => (
        <text key={t} className="dc-lab dc-tick" x={40} y={y(t) + 3} textAnchor="end">
          {`${(t * 100).toFixed(1)}%`}
        </text>
      ))}
      {/* the metro's share of ALL national jobs: above it, a sector the
          metro holds more of than its size implies */}
      <line className="dc-zero" x1={44} x2={W - 14} y1={y(overall)} y2={y(overall)} />
      <text className="dc-lab dc-quiet" x={W - 16} y={y(overall) + 10} textAnchor="end">
        {allLabel}
      </text>
      {series.map((s) => {
        const first = s.pts[0];
        const last = s.pts[s.pts.length - 1];
        /* the arrow points the way the path has been heading, not the way
           its last year happened to jitter */
        const prev = s.pts[Math.max(0, s.pts.length - 4)];
        const col = last.share >= first.share ? RISE : FALL;
        const a = Math.atan2(y(last.share) - y(prev.share), x(last.emp) - x(prev.emp));
        return (
          <g key={s.code}>
            <polyline
              points={s.pts.map((p) => `${x(p.emp)},${y(p.share)}`).join(" ")}
              fill="none"
              stroke={col}
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <title>{`${s.code} · ${s.name}: ${first.year} ${(first.share * 100).toFixed(2)}% of national jobs → ${last.year} ${(last.share * 100).toFixed(2)}%`}</title>
            </polyline>
            <circle cx={x(first.emp)} cy={y(first.share)} r={1.8} fill="#fff" stroke={col} strokeWidth={1.1} />
            <path
              d={`M${x(last.emp)} ${y(last.share)} l${-5 * Math.cos(a - 0.45)} ${-5 * Math.sin(a - 0.45)} M${x(last.emp)} ${y(last.share)} l${-5 * Math.cos(a + 0.45)} ${-5 * Math.sin(a + 0.45)}`}
              stroke={col}
              strokeWidth={1.5}
              strokeLinecap="round"
              fill="none"
            />
            {named.has(s.code) && (
              <text className="dc-lab dc-name" x={x(last.emp) + 5} y={y(last.share) + 3}>
                {named.get(s.code)}
              </text>
            )}
          </g>
        );
      })}
      <text className="dc-lab" x={(44 + W - 14) / 2} y={165} textAnchor="middle">
        jobs in the metro (log) →
      </text>
      <text className="dc-lab" x={10} y={82} textAnchor="middle" transform="rotate(-90 10 82)">
        share of national jobs →
      </text>
    </Frame>
  );
}

function RealEffectTreemap({ data }: { data: DriverData }) {
  const ss = data.shiftShare;
  const leaves = useMemo(() => {
    type N = { name: string; e0?: number; ls?: number; children?: N[] };
    const bySector = new Map<string, N[]>();
    for (const t of ss.tiles) {
      const arr = bySector.get(t.sector) ?? [];
      arr.push({ name: t.name, e0: t.e0, ls: t.ls });
      bySector.set(t.sector, arr);
    }
    const root = hierarchy<N>({
      name: "root",
      children: [...bySector].map(([name, children]) => ({ name, children })),
    })
      .sum((d) => d.e0 ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<N>().size([W - 24, H - 34]).paddingInner(1).paddingOuter(1.5)(root).leaves();
  }, [ss.tiles]);
  return (
    <Frame label={`Treemap of the ${data.city} MSA's jobs in ${ss.t0}, coloured by local-share effect`}>
      <g transform="translate(12,8)">
        {leaves.map((n, i) => {
          const w = n.x1 - n.x0;
          const h = n.y1 - n.y0;
          const room = Math.floor(w / 4.4);
          return (
            <g key={i}>
              <rect
                x={n.x0}
                y={n.y0}
                width={Math.max(0, w)}
                height={Math.max(0, h)}
                rx={1.5}
                fill={diverge((n.data.ls ?? 0) / ss.tileScale)}
              >
                <title>{`${n.data.name} (${n.parent?.data.name}): ${Math.round(n.data.e0 ?? 0).toLocaleString()} jobs in ${ss.t0} · local share ${jobs(n.data.ls ?? 0, true)}`}</title>
              </rect>
              {w > 44 && h > 15 && (
                <text className="dc-lab dc-tile" x={n.x0 + 3} y={n.y0 + 10}>
                  {n.data.name.length > room ? n.data.name.slice(0, room - 1) + "…" : n.data.name}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <text className="dc-lab dc-quiet" x={12} y={H - 6}>
        {`area = jobs in ${ss.t0} · colour = local-share effect, lost ↔ gained`}
      </text>
    </Frame>
  );
}

function RealNewIndustries({ data }: { data: DriverData }) {
  const ss = data.shiftShare;
  const list = ss.newIndustries.slice(0, 4);
  return (
    <Frame label={`Industries new to the ${data.city} MSA, ${ss.t0} to ${ss.t1}`}>
      <text className="dc-big" x={W / 2} y={62} textAnchor="middle">
        {`${ss.fresh.toLocaleString()} jobs`}
      </text>
      <text className="dc-lab" x={W / 2} y={80} textAnchor="middle">
        {`in ${ss.newIndustries.length} industries new to the metro, ${ss.t0}–${ss.t1}`}
      </text>
      {list.map((n, i) => (
        <text key={n.naics} className="dc-lab dc-quiet" x={W / 2} y={104 + i * 12} textAnchor="middle">
          {`${n.name} · ${n.jobs}`}
        </text>
      ))}
      {!ss.freshMaterial && (
        <text className="dc-lab dc-ph" x={W / 2} y={H - 10} textAnchor="middle">
          [below the materiality floor: the live tool skips this step]
        </text>
      )}
    </Frame>
  );
}

function RealPlacesMap({ data }: { data: DriverData }) {
  const clip = useId();
  const key = "home";
  const vals = data.places.map((p) => p[key]).filter((v): v is number => v != null);
  /* price growth: quintiles of the metro's own distribution, one hue */
  const cuts = [0.2, 0.4, 0.6, 0.8].map((q) => quantile(vals, q));
  const ramp = SEQ;
  const fill = (v: number | null) => (v == null ? "#eef0f1" : ramp[cuts.filter((c) => v >= c).length]);
  const fmt = (v: number) => `${pct1(v)}/yr`;
  const home = data.places.find((p) => p.id === data.placeId);
  return (
    <Frame label={`Home-value growth across the ${data.city} MSA's places`}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={272} height={176} rx={4} />
        </clipPath>
      </defs>
      <g transform="translate(6,4)" clipPath={`url(#${clip})`}>
        {/* the metro itself, as the ground the places sit on — the frame is
            fitted to the places, so its far edges run off the well */}
        <path d={data.msaOutline} fill="#f1f3f4" stroke={METRO} strokeWidth={0.8} strokeDasharray="3 2.5" />
        {data.places.map(
          (p) =>
            p.d && (
              <path key={p.id} d={p.d} fill={fill(p[key])} stroke="#fff" strokeWidth={0.5}>
                <title>{`${p.name}: ${p[key] == null ? "no data" : fmt(p[key]!)}`}</title>
              </path>
            ),
        )}
        {home?.d && <path d={home.d} fill="none" stroke="var(--ink)" strokeWidth={1.3} pointerEvents="none" />}
      </g>
      {ramp.map((c, i) => (
        <rect key={c} x={288} y={40 + (ramp.length - 1 - i) * 17} width={12} height={15} rx={2} fill={c} />
      ))}
      <text className="dc-lab dc-tick" x={294} y={32} textAnchor="middle">
        {fmt(Math.max(...vals)).replace("/yr", "")}
      </text>
      <text className="dc-lab dc-tick" x={294} y={40 + ramp.length * 17 + 11} textAnchor="middle">
        {fmt(Math.min(...vals)).replace("/yr", "")}
      </text>
      <text className="dc-lab dc-quiet" x={8} y={H - 3}>
        {home && home[key] != null
          ? `${data.city} outlined: ${fmt(home[key]!)}`
          : `${data.city} outlined`}
      </text>
    </Frame>
  );
}

function RealCostTrend({ data }: { data: DriverData }) {
  const rows = data.costTrend;
  const xd: [number, number] = [rows[0].year, rows[rows.length - 1].year];
  const top = Math.max(...rows.flatMap((r) => [r.metro ?? 0, r.place ?? 0, r.median]));
  const x = lin(xd, [38, 232]);
  const y = lin([0, top * 1.05], [150, 18]);
  const line = (k: "metro" | "place" | "median") =>
    rows
      .filter((r) => r[k] != null)
      .map((r) => `${x(r.year)},${y(r[k]!)}`)
      .join(" ");
  const last = rows[rows.length - 1];
  const ticks = [250000, 500000, 750000].filter((t) => t < top);
  return (
    <Frame label={`Home values by year: ${data.city}, its MSA and the median metro`}>
      <rect
        className="dc-window"
        x={x(data.window.from)}
        y={18}
        width={x(Math.min(data.window.to, xd[1])) - x(data.window.from)}
        height={132}
      />
      <text
        className="dc-lab dc-quiet"
        x={(x(data.window.from) + x(Math.min(data.window.to, xd[1]))) / 2}
        y={14}
        textAnchor="middle"
      >
        {`${data.window.from}–${data.window.to}`}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line className="dc-grid" x1={38} x2={232} y1={y(t)} y2={y(t)} />
          <text className="dc-lab dc-tick" x={34} y={y(t) + 3} textAnchor="end">
            {`$${t / 1000}k`}
          </text>
        </g>
      ))}
      <line className="dc-axis" x1={38} x2={232} y1={150} y2={150} />
      {[xd[0], data.window.from, xd[1]].map((yr) => (
        <text key={yr} className="dc-lab dc-tick" x={x(yr)} y={162} textAnchor="middle">
          {yr}
        </text>
      ))}
      <polyline points={line("median")} fill="none" stroke={FIELD} strokeWidth={2} strokeDasharray="5 4" />
      <polyline points={line("metro")} fill="none" stroke={METRO} strokeWidth={2} strokeLinejoin="round" />
      <polyline points={line("place")} fill="none" stroke={CITY} strokeWidth={2} strokeLinejoin="round" />
      {(
        [
          ["place", CITY, data.city],
          ["metro", METRO, "its MSA"],
          ["median", FIELD, "median metro"],
        ] as ["metro" | "place" | "median", string, string][]
      ).map(([k, col, name]) =>
        last[k] == null ? null : (
          <g key={k}>
            <circle cx={x(last.year)} cy={y(last[k]!)} r={3} fill={col} stroke="#fff" strokeWidth={1.2}>
              <title>{`${name}, ${last.year}: $${Math.round(last[k]!).toLocaleString()}`}</title>
            </circle>
            <text className="dc-lab dc-name" x={x(last.year) + 7} y={y(last[k]!) + 1}>
              {name}
            </text>
            <text className="dc-lab dc-tick" x={x(last.year) + 7} y={y(last[k]!) + 11}>
              {`$${Math.round(last[k]! / 1000)}k`}
            </text>
          </g>
        ),
      )}
    </Frame>
  );
}

/** where a card's chart came from, for its tag — the live tool's data on the
 *  walk's window, or the Amenities Module on the measure's own span. Null
 *  where the city's data has not been pulled and the chart is a drawing. */
export const chartSource = (kind: ChartKind, city: string): string | null => {
  if (isAmenityKind(kind)) return amenitySource(kind, city);
  const d = driverData(city);
  return d ? `Live tool data · ${d.window.from}–${d.window.to}` : null;
};

/** a data point's chart: one of the live tool's driver charts — real where
 *  the city's data has been pulled, the schematic otherwise — or one of the
 *  Amenities Module's indicators */
export function DriverChart({ kind, city }: { kind: ChartKind; city: string }) {
  if (isAmenityKind(kind)) return <AmenityChart kind={kind} city={city} />;
  const data = driverData(city);
  switch (kind) {
    case "waterfall":
      return data ? <RealWaterfall data={data} /> : <Waterfall />;
    case "effectViews":
      return <EffectViews data={data} />;
    case "newIndustries":
      return data ? <RealNewIndustries data={data} /> : <NewIndustries />;
    case "priceMap":
      return data ? <RealPlacesMap data={data} /> : <PlacesMap city={city} />;
    case "costTrend":
      return data ? <RealCostTrend data={data} /> : <CostTrend city={city} />;
  }
}
