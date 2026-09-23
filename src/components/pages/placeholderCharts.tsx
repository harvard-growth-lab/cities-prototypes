/* Placeholder cards for the data points no source draws yet — one seeded
   drawing per PlaceholderForm in figures.ts, chosen per data point by what
   its data type and signal call for:

     one value among all metros, read high / low   → histogram, the MSA's bin lit
     a rank over time, read up / down               → a line on an inverted axis
     two measures across every metro                → scatter with its fit
     one measure per sector, the city against MSA   → sector scatter on the diagonal
     one share per sector, city and MSA             → dumbbell rows
     two flows or two series over time              → two lines, end-labelled
     industries × inputs, over time                 → two small heatmaps
     one scalar per metro, ranked                   → sorted columns, the MSA lit
     a measure across the city's tracts             → a hex map, one hue

   Nothing here is data: every mark comes from a fixed seed, no axis carries
   a value (tick marks only, "earlier" / "latest", "lower" / "higher"), and
   the card tags the well "Placeholder". When a source arrives the data point
   gets a real ChartKind and its own chart, and its placeholder spec goes.

   Same frame, classes (dc-*) and colour jobs as driverCharts.tsx: the city
   teal, the field of other metros grey, polarity in --rise / --fall,
   magnitude one hue light → dark; text in ink tokens, never a series colour.
   Sector names are real 2-digit NAICS labels, so a row reads as the row it
   will be. */

import { useMemo } from "react";
import type { PlaceholderSpec } from "../../data/figures";
import { titleCase } from "./titleCase";

const W = 560;
const H = 320;
const CITY = "#255862";
const FIELD = "#8a9498";
const FIELD_SOFT = "#c8cdd0";
/* polarity in the site's two chart hues, as the Shocks cards draw it:
   teal for the city outgrowing its metro, rust for lagging it */
const RISE = "#255862";
const FALL = "#b8431f";
const INK_LINE = "#56626a";
/* magnitude ramps: the supply side's rust (as the places map wears), and
   the city's own teal for an intensity read on the demand side */
const SEQ_RUST = ["#fbebe4", "#f3cdbd", "#e6a88f", "#d37f5e", "#b8431f"];
const SEQ_TEAL = ["#e8eff0", "#c3d4d7", "#8fb0b6", "#5a8791", "#255862"];

/** a small seeded generator, so a placeholder draws the same way every time */
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
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lin = (d: [number, number], r: [number, number]) => (v: number) =>
  r[0] + ((v - d[0]) / (d[1] - d[0])) * (r[1] - r[0]);
/** a series named "{city}" is the city the section is about */
const named = (s: string, city: string) => s.replace("{city}", city);

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg className="dc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** the two axes of a plot, with tick marks and no values */
function Axes({
  l, r, t, b, xTitle, yTitle, xEnds,
}: {
  l: number; r: number; t: number; b: number;
  xTitle?: string; yTitle?: string;
  /** words at the x axis' ends, where the signal has them */
  xEnds?: [string, string];
}) {
  const nx = 8;
  const ny = 5;
  return (
    <g>
      <line className="dc-axis" x1={l} x2={r} y1={b} y2={b} />
      <line className="dc-axis" x1={l} x2={l} y1={t} y2={b} />
      {Array.from({ length: nx + 1 }, (_, i) => l + (i / nx) * (r - l)).map((x) => (
        <line key={x} className="dc-axis" x1={x} x2={x} y1={b} y2={b + 3} />
      ))}
      {Array.from({ length: ny + 1 }, (_, i) => t + (i / ny) * (b - t)).map((y) => (
        <line key={y} className="dc-axis" x1={l - 3} x2={l} y1={y} y2={y} />
      ))}
      {xEnds && (
        <>
          <text className="dc-lab dc-tick" x={l} y={b + 12}>
            {titleCase(xEnds[0])}
          </text>
          <text className="dc-lab dc-tick" x={r} y={b + 12} textAnchor="end">
            {titleCase(xEnds[1])}
          </text>
        </>
      )}
      {xTitle && (
        <text className="dc-lab dc-quiet" x={(l + r) / 2} y={b + (xEnds ? 30 : 18)} textAnchor="middle">
          {titleCase(xTitle)}
        </text>
      )}
      {yTitle && (
        <text
          className="dc-lab dc-quiet"
          x={14}
          y={(t + b) / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(t + b) / 2})`}
        >
          {titleCase(yTitle)}
        </text>
      )}
    </g>
  );
}

/* ---------- one value among all metros: a histogram, the MSA's bin lit ---------- */

function Histogram({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  const PL = { l: 52, r: 532, t: 40, b: 250 };
  const bins = 40;
  const counts = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: bins }, (_, i) => {
      const z = (i - 18.5) / 8;
      return Math.exp((-z * z) / 2) * (0.7 + r() * 0.3);
    });
  }, []);
  const step = (PL.r - PL.l) / bins;
  const y = (v: number) => PL.b - v * (PL.b - PL.t - 8);
  const cityBin = 28;
  const medianX = PL.l + 19 * step;
  const among = spec.among ?? "metros";
  return (
    <Frame label={`${spec.x} of every ${among.replace(/s$/, "")}, as a histogram, with ${city} marked`}>
      <text className="dc-lab dc-name" x={20} y={20}>
        {titleCase(`${spec.x}, every ${among.replace(/s$/, "")}`)}
      </text>
      {counts.map((c, i) => (
        <rect
          key={i}
          x={PL.l + i * step + 0.75}
          y={y(c)}
          width={step - 1.5}
          height={PL.b - y(c)}
          rx={2}
          fill={i === cityBin ? CITY : FIELD_SOFT}
        />
      ))}
      <line className="dc-zero" x1={medianX} x2={medianX} y1={PL.t - 6} y2={PL.b} />
      <text className="dc-lab dc-quiet dc-halo" x={medianX + 4} y={PL.t - 9}>
        Median
      </text>
      <text className="dc-lab dc-name dc-halo" x={PL.l + (cityBin + 0.5) * step} y={y(counts[cityBin]) - 8} textAnchor="middle">
        {titleCase(city)}
      </text>
      <Axes {...PL} xTitle={spec.x} yTitle={among} xEnds={["lower", "higher"]} />
    </Frame>
  );
}

/* ---------- a rank over time: a line, 1 at the top ---------- */

function RankLine({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  const PL = { l: 56, r: 480, t: 30, b: 250 };
  const n = 16;
  const vs = useMemo(() => {
    const r = rng(23);
    let v = 0.58;
    return Array.from({ length: n }, () => {
      v = clamp(v + (0.34 - v) * 0.18 + gauss(r) * 0.07, 0.05, 0.95);
      return v;
    });
  }, []);
  const x = (i: number) => PL.l + (i / (n - 1)) * (PL.r - PL.l);
  const y = (v: number) => PL.t + v * (PL.b - PL.t);
  const pts = vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <Frame label={`${city}'s ${spec.y} over time, rank 1 at the top`}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} className="dc-grid" x1={PL.l} x2={PL.r} y1={y(g)} y2={y(g)} />
      ))}
      <text className="dc-lab dc-tick" x={PL.l - 7} y={PL.t + 4} textAnchor="end">
        1
      </text>
      <polyline points={pts} fill="none" stroke={CITY} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {vs.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={CITY} stroke="#fff" strokeWidth={1.2} />
      ))}
      <circle cx={x(n - 1)} cy={y(vs[n - 1])} r={5} fill={CITY} stroke="#fff" strokeWidth={1.8} />
      <text className="dc-lab dc-name dc-halo" x={x(n - 1) + 10} y={y(vs[n - 1]) + 4}>
        {titleCase(city)}
      </text>
      <Axes {...PL} xTitle="years" yTitle={`${spec.y}, 1 at the top`} xEnds={["earlier", "latest"]} />
    </Frame>
  );
}

/* ---------- two measures across every metro: a scatter and its fit ---------- */

function Scatter({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  const PL = { l: 56, r: 530, t: 24, b: 250 };
  const slope = spec.slope ?? 1;
  const fit = (u: number) => 0.5 + slope * 0.5 * (u - 0.5);
  const pts = useMemo(() => {
    const r = rng(37);
    return Array.from({ length: 240 }, () => {
      const u = clamp(0.5 + gauss(r) * 0.42, 0.02, 0.98);
      return [u, clamp(fit(u) + gauss(r) * 0.16, 0.02, 0.98)] as [number, number];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slope]);
  const x = lin([0, 1], [PL.l, PL.r]);
  const y = lin([0, 1], [PL.b, PL.t]);
  const cu = 0.66;
  const cv = clamp(fit(cu) + 0.13, 0.04, 0.96);
  return (
    <Frame label={`${spec.y} against ${spec.x}, every metro, with ${city} marked`}>
      {pts.map(([u, v], i) => (
        <circle key={i} cx={x(u)} cy={y(v)} r={2.8} fill={FIELD} opacity={0.5} />
      ))}
      <line x1={x(0)} y1={y(fit(0))} x2={x(1)} y2={y(fit(1))} stroke={INK_LINE} strokeWidth={1.2} opacity={0.7} />
      <text className="dc-lab dc-quiet dc-halo" x={x(1) - 3} y={y(fit(1)) + (slope > 0 ? -6 : 13)} textAnchor="end">
        Fit Across All Metros
      </text>
      <circle cx={x(cu)} cy={y(cv)} r={5.5} fill={CITY} stroke="#fff" strokeWidth={1.8} />
      <text className="dc-lab dc-name dc-halo" x={x(cu) + 10} y={y(cv) + 4}>
        {titleCase(city)}
      </text>
      <Axes {...PL} xTitle={spec.x} yTitle={spec.y} />
    </Frame>
  );
}

/* ---------- one measure per sector, the city against its MSA ---------- */

const SECTORS: [string, string][] = [
  ["11", "Agriculture"],
  ["21", "Mining"],
  ["23", "Construction"],
  ["31–33", "Manufacturing"],
  ["42", "Wholesale"],
  ["44–45", "Retail"],
  ["48–49", "Transport"],
  ["51", "Information"],
  ["52", "Finance"],
  ["54", "Professional services"],
  ["62", "Health care"],
  ["72", "Accommodation, food"],
];

function SectorScatter({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  const PL = { l: 56, r: 530, t: 26, b: 250 };
  const pts = useMemo(() => {
    const r = rng(41);
    return SECTORS.map(([code, name]) => {
      const u = clamp(0.5 + gauss(r) * 0.34, 0.06, 0.94);
      return { code, name, u, v: clamp(u + gauss(r) * 0.26, 0.06, 0.94) };
    });
  }, []);
  const x = lin([0, 1], [PL.l, PL.r]);
  const y = lin([0, 1], [PL.b, PL.t]);
  return (
    <Frame label={`${spec.y} against ${spec.x}, one dot per 2-digit sector, the diagonal where the two are equal`}>
      <circle cx={PL.l + 5} cy={13} r={4.5} fill={RISE} />
      <text className="dc-lab dc-tick" x={PL.l + 14} y={16.5}>
        {titleCase(`grows faster in ${city} than in its MSA`)}
      </text>
      <circle cx={PL.l + 230} cy={13} r={4.5} fill={FALL} />
      <text className="dc-lab dc-tick" x={PL.l + 239} y={16.5}>
        Slower
      </text>
      <line className="dc-link" x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} />
      <text className="dc-lab dc-quiet dc-halo" x={x(1) - 3} y={y(1) + 13} textAnchor="end">
        Same Growth in Both
      </text>
      {pts.map((p) => (
        <g key={p.code}>
          <circle cx={x(p.u)} cy={y(p.v)} r={5.5} fill={p.v >= p.u ? RISE : FALL} stroke="#fff" strokeWidth={1.5} />
          {Math.abs(p.v - p.u) > 0.12 && (
            <text className="dc-lab dc-tick dc-halo" x={x(p.u) + 8} y={y(p.v) + 3.5}>
              {titleCase(`${p.code} ${p.name}`)}
            </text>
          )}
        </g>
      ))}
      <Axes {...PL} xTitle={spec.x} yTitle={spec.y} />
    </Frame>
  );
}

/* ---------- one share per sector, city and MSA: dumbbell rows ---------- */

const MIX_ROWS: [string, string][] = [
  ["31–33", "Manufacturing"],
  ["44–45", "Retail"],
  ["51", "Information"],
  ["52", "Finance & insurance"],
  ["54", "Professional services"],
  ["62", "Health care"],
  ["72", "Accommodation, food"],
  ["23", "Construction"],
  ["42", "Wholesale"],
  ["48–49", "Transport, warehousing"],
];

function Dumbbell({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  const [a, b] = (spec.series ?? ["{city}", "its MSA"]).map((s) => named(s, city));
  const rows = useMemo(() => {
    const r = rng(47);
    return MIX_ROWS.map(([code, name]) => {
      const m = clamp(0.12 + r() * 0.6, 0.05, 0.95);
      return { code, name, m, c: clamp(m + gauss(r) * 0.28, 0.05, 0.95) };
    });
  }, []);
  const x = lin([0, 1], [214, 524]);
  const y0 = 46;
  const pitch = 21;
  const base = y0 + rows.length * pitch - 4;
  return (
    <Frame label={`${spec.x} by 2-digit sector: ${a} against ${b}`}>
      <circle cx={220} cy={18} r={4.5} fill={CITY} />
      <text className="dc-lab dc-tick" x={229} y={21.5}>
        {titleCase(a)}
      </text>
      <circle cx={229 + a.length * 5.8 + 16} cy={18} r={4.5} fill={FIELD} />
      <text className="dc-lab dc-tick" x={229 + a.length * 5.8 + 25} y={21.5}>
        {titleCase(b)}
      </text>
      {rows.map((row, i) => {
        const cy = y0 + i * pitch + 6;
        return (
          <g key={row.code}>
            <text className="dc-lab" x={204} y={cy + 4} textAnchor="end">
              {titleCase(`${row.code} · ${row.name}`)}
            </text>
            <line x1={x(row.m)} x2={x(row.c)} y1={cy} y2={cy} stroke={FIELD_SOFT} strokeWidth={2.5} />
            <circle cx={x(row.m)} cy={cy} r={4.5} fill={FIELD} stroke="#fff" strokeWidth={1.4} />
            <circle cx={x(row.c)} cy={cy} r={4.5} fill={CITY} stroke="#fff" strokeWidth={1.4} />
          </g>
        );
      })}
      <Axes l={214} r={524} t={y0 - 8} b={base} xTitle={spec.x} />
    </Frame>
  );
}

/* ---------- two series over time ---------- */

function Lines({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  const PL = { l: 56, r: 452, t: 28, b: 250 };
  const n = 20;
  const [a, b] = (spec.series ?? ["{city}", "its MSA"]).map((s) => named(s, city));
  const series = useMemo(() => {
    const r = rng(59);
    const walk = (start: number, drift: number) => {
      let v = start;
      return Array.from({ length: n }, () => {
        v = clamp(v + drift + gauss(r) * 0.035, 0.06, 0.94);
        return v;
      });
    };
    return [walk(0.34, 0.03), walk(0.56, -0.006)];
  }, []);
  const x = (i: number) => PL.l + (i / (n - 1)) * (PL.r - PL.l);
  const y = lin([0, 1], [PL.b, PL.t]);
  const line = (vs: number[]) => vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  /* end labels, pushed apart where the two lines finish close together */
  const ends = [
    { name: a, color: CITY, v: series[0][n - 1], ly: y(series[0][n - 1]) },
    { name: b, color: FIELD, v: series[1][n - 1], ly: y(series[1][n - 1]) },
  ].sort((p, q) => p.ly - q.ly);
  if (ends[1].ly - ends[0].ly < 16) {
    const mid = (ends[0].ly + ends[1].ly) / 2;
    ends[0].ly = mid - 8;
    ends[1].ly = mid + 8;
  }
  return (
    <Frame label={`${spec.y} over time: ${a} and ${b}`}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} className="dc-grid" x1={PL.l} x2={PL.r} y1={y(g)} y2={y(g)} />
      ))}
      <polyline points={line(series[1])} fill="none" stroke={FIELD} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={line(series[0])} fill="none" stroke={CITY} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {ends.map((e) => (
        <g key={e.name}>
          <circle cx={x(n - 1)} cy={y(e.v)} r={4.5} fill={e.color} stroke="#fff" strokeWidth={1.6} />
          <text className="dc-lab dc-name dc-halo" x={x(n - 1) + 10} y={e.ly + 4}>
            {titleCase(e.name)}
          </text>
        </g>
      ))}
      <Axes {...PL} xTitle="years" yTitle={spec.y} xEnds={["earlier", "latest"]} />
    </Frame>
  );
}

/* ---------- industries × inputs, over time: two small heatmaps ---------- */

const RZ_ROWS = ["31–33 Manufacturing", "51 Information", "52 Finance & insurance", "54 Professional services", "42 Wholesale", "48–49 Transport", "21 Mining", "11 Agriculture"];
const RZ_COLS = ["finance", "skills", "capital", "energy", "R&D"];

function Heatmap({ city }: { city: string }) {
  const cells = useMemo(() => {
    const r = rng(53);
    return RZ_ROWS.map(() =>
      RZ_COLS.map(() => {
        const e = clamp(r(), 0, 0.999);
        return [e, clamp(e + gauss(r) * 0.22, 0, 0.999)] as [number, number];
      }),
    );
  }, []);
  const panels = [
    { x: 196, title: "earlier window", k: 0 },
    { x: 376, title: "latest window", k: 1 },
  ];
  const cw = 34;
  const ch = 24;
  const y0 = 68;
  return (
    <Frame label={`Input intensity of ${city}'s tradable industries, by input, in an earlier and the latest window`}>
      {RZ_ROWS.map((name, i) => (
        <text key={name} className="dc-lab" x={188} y={y0 + i * ch + ch / 2 + 4} textAnchor="end">
          {titleCase(name)}
        </text>
      ))}
      {panels.map((p) => (
        <g key={p.k}>
          <text className="dc-lab dc-name" x={p.x + (cw * RZ_COLS.length) / 2} y={20} textAnchor="middle">
            {titleCase(p.title)}
          </text>
          {RZ_COLS.map((c, j) => {
            const cx = p.x + j * cw + cw / 2 + 3;
            return (
              <text key={c} className="dc-lab dc-tick" x={cx} y={62} transform={`rotate(-40 ${cx} 62)`}>
                {titleCase(c)}
              </text>
            );
          })}
          {cells.map((row, i) =>
            row.map((cell, j) => {
              const t = cell[p.k];
              return (
                <rect
                  key={`${i}-${j}`}
                  x={p.x + j * cw + 1}
                  y={y0 + i * ch + 1}
                  width={cw - 2}
                  height={ch - 2}
                  rx={2}
                  fill={SEQ_TEAL[Math.floor(t * SEQ_TEAL.length)]}
                  /* the intense cells, outlined: where the industry leans on the input */
                  stroke={t > 0.8 ? "var(--ink)" : "none"}
                  strokeWidth={1}
                />
              );
            }),
          )}
        </g>
      ))}
      {SEQ_TEAL.map((c, i) => (
        <rect key={c} x={196 + i * 18} y={H - 40} width={17} height={11} rx={2} fill={c} />
      ))}
      <text className="dc-lab dc-quiet" x={292} y={H - 31}>
        Intensity, Low to High · Outlined: The Industry Leans on That Input
      </text>
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        Tradable Industries Down the Side, Inputs Across · Two Windows, So a Shift Reads as a Shift
      </text>
    </Frame>
  );
}

/* ---------- one scalar per metro, ranked: sorted columns, the MSA lit ---------- */

function RankColumns({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  const PL = { l: 56, r: 532, t: 40, b: 250 };
  const n = 80;
  const vals = useMemo(() => {
    const r = rng(67);
    return Array.from({ length: n }, (_, i) => 0.1 + 0.9 * Math.pow(1 - i / (n - 1), 1.7) * (0.9 + r() * 0.1)).sort((a, b) => b - a);
  }, []);
  const step = (PL.r - PL.l) / n;
  const y = (v: number) => PL.b - v * (PL.b - PL.t - 6);
  const cityIdx = 23;
  const medIdx = 40;
  const medianX = PL.l + (medIdx + 0.5) * step;
  return (
    <Frame label={`${spec.y} of every metro, ranked, with ${city}'s MSA marked`}>
      {vals.map((v, i) => (
        <rect
          key={i}
          x={PL.l + i * step + 0.75}
          y={y(v)}
          width={step - 1.5}
          height={PL.b - y(v)}
          rx={1.5}
          fill={i === cityIdx ? CITY : FIELD_SOFT}
        />
      ))}
      <line className="dc-zero" x1={medianX} x2={medianX} y1={PL.t - 6} y2={PL.b} />
      <text className="dc-lab dc-quiet dc-halo" x={medianX + 4} y={PL.t - 9}>
        Median Metro
      </text>
      <text className="dc-lab dc-name dc-halo" x={PL.l + (cityIdx + 0.5) * step} y={y(vals[cityIdx]) - 8} textAnchor="middle">
        {titleCase(city)}
      </text>
      <Axes {...PL} xTitle="every metro, ranked" yTitle={spec.y} />
    </Frame>
  );
}

/* ---------- a measure across the city's tracts: a hex map ---------- */

function HexMap({ city }: { city: string }) {
  const R = 17;
  const hexes = useMemo(() => {
    const r = rng(61);
    const cx = 270;
    const cy = 162;
    const out: { x: number; y: number; t: number }[] = [];
    for (let q = -4; q <= 4; q++)
      for (let s = -4; s <= 4; s++) {
        if (Math.abs(q + s) > 4) continue;
        const x = cx + R * Math.sqrt(3) * (q + s / 2);
        const y = cy + R * 1.5 * s;
        /* a hotspot off-centre, the way growth clusters, plus noise */
        const d = Math.hypot(x - (cx + 34), y - (cy - 22)) / (R * 4.2);
        out.push({ x, y, t: clamp(0.95 * Math.exp(-d * d * 1.6) + (r() - 0.5) * 0.3, 0, 0.999) });
      }
    return out;
  }, []);
  const hex = (x: number, y: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 30);
      return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  return (
    <Frame label={`Map of ${city}'s tracts, filled by housing growth`}>
      <text className="dc-lab dc-name" x={20} y={20}>
        {titleCase(`housing growth within ${city}, by tract`)}
      </text>
      {hexes.map((h, i) => (
        <polygon key={i} points={hex(h.x, h.y)} fill={SEQ_RUST[Math.floor(h.t * SEQ_RUST.length)]} stroke="#fff" strokeWidth={1.2} />
      ))}
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        One Cell per Tract · New Homes Over the Window, as a Share of the Stock
      </text>
      <text className="dc-lab dc-tick" x={426} y={H - 8} textAnchor="end">
        Less
      </text>
      {SEQ_RUST.map((c, i) => (
        <rect key={c} x={432 + i * 18} y={H - 18} width={17} height={11} rx={2} fill={c} />
      ))}
      <text className="dc-lab dc-tick" x={526} y={H - 8}>
        More
      </text>
    </Frame>
  );
}

/** a data point's placeholder: the chart form its data type and signal
 *  call for, drawn from a seed */
export function PlaceholderChart({ spec, city }: { spec: PlaceholderSpec; city: string }) {
  switch (spec.form) {
    case "histogram":
      return <Histogram spec={spec} city={city} />;
    case "rankLine":
      return <RankLine spec={spec} city={city} />;
    case "scatter":
      return <Scatter spec={spec} city={city} />;
    case "sectorScatter":
      return <SectorScatter spec={spec} city={city} />;
    case "dumbbell":
      return <Dumbbell spec={spec} city={city} />;
    case "lines":
      return <Lines spec={spec} city={city} />;
    case "heatmap":
      return <Heatmap city={city} />;
    case "rankColumns":
      return <RankColumns spec={spec} city={city} />;
    case "map":
      return <HexMap city={city} />;
  }
}
