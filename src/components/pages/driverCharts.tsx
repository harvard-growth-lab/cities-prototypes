/* The live tool's driver charts, drawn from its own data — one per Drivers
   ChartKind in figures.ts. (The Amenities Module's indicators are
   amenityCharts.tsx, the Innovation Module's innovationCharts.tsx, and the
   forms of the data points no source draws yet placeholderCharts.tsx; this
   file's dispatcher hands those kinds on, and hands every card its
   verdict.) The live tool (cities-tool, src/components/story/
   DriversSection.tsx) answers each of an ending's questions with one chart;
   a card here draws the SAME numbers the live page draws, on its window,
   with a native tooltip on every mark (src/data/driverData.ts, pulled by
   scripts/build-driver-data.mjs). A city whose data has not been pulled
   draws an empty well naming what is missing — the seeded schematics that
   used to stand in went in Sept 2026, once every data point without a
   source had a placeholder form of its own.

   COLOUR does the same jobs as everywhere else in the section:
     identity    the admin city teal (--geo-city); its metro, the median
                 metro and the field of other places in greys
     polarity    gained ↔ lost around a neutral grey: TEAL for a gain, RUST
                 for a loss — the site's own two chart hues, not the live
                 tool's green / red, which shouted beside the other cards
                 (validated: ΔE 10.7 under protanopia, 20.9 normal vision)
     magnitude   one hue, light → dark (the rust ramp)
   Text inside a well wears ink tokens, never the series colour.

   THE VERDICT. Each card's caption opens on one coloured line — how this
   data point reads for the city — computed here from the same numbers the
   chart draws (`driverVerdict`), and by the other chart files for theirs.
   Up = reads well for the city, down = reads as a constraint, flat = about
   the field; a placeholder's verdict is the spec's rubric, still to come. */

import { useId, useMemo, useState } from "react";
import { hierarchy, treemap } from "d3-hierarchy";
import { interpolateRgb } from "d3-interpolate";
import type { ChartKind, ModuleView, PlaceholderSpec } from "../../data/figures";
import { driverData, type DriverData } from "../../data/driverData";
import { AmenityChart, amenitySource, amenityVerdict, isAmenityKind } from "./amenityCharts";
import { InnovationChart, innovationSource, innovationVerdict, isInnovationKind } from "./innovationCharts";
import { PlaceholderChart } from "./placeholderCharts";

const W = 560;
const H = 320;

const GAIN = "#255862";
const LOSS = "#b8431f";
const MID = "#e6e9ea";
/** a level — the stock of jobs — neither gained nor lost */
const LEVEL = "#8a9498";
const FIELD = "#c8cdd0";
const CITY = "#255862";
const METRO = "#8a9498";
/* magnitude: one hue, light → dark */
const SEQ = ["#fbebe4", "#f3cdbd", "#e6a88f", "#d37f5e", "#b8431f"];

/** how a data point reads for the city — the caption's coloured line */
export type VerdictTone = "up" | "down" | "flat" | "ph";
export interface Verdict {
  tone: VerdictTone;
  /** the read, in a few words */
  head: string;
  /** the figures behind it */
  body: string;
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg className="dc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {children}
    </svg>
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
  t < 0 ? interpolateRgb(MID, LOSS)(Math.min(1, -t)) : interpolateRgb(MID, GAIN)(Math.min(1, t));
/** a tick step that gives a span about `n` ticks */
const niceStep = (span: number, n = 5) => {
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= n) ?? mag * 10;
};
const ticksBy = (d: [number, number], step: number) => {
  const out: number[] = [];
  for (let v = Math.ceil(d[0] / step) * step; v <= d[1] + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
};

/* ---------- the shift-share waterfall ---------- */

function RealWaterfall({ data }: { data: DriverData }) {
  const ss = data.shiftShare;
  const base = 258;
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
  const y = lin([lo - (hi - lo) * 0.35, hi + (hi - lo) * 0.14], [base - 34, 34]);
  const bw = 60;
  const left = 44;
  const right = W - 44;
  const gap = (right - left - bars.length * bw) / (bars.length - 1);
  const x = (i: number) => left + i * (bw + gap);
  return (
    <Frame label={`Shift-share of the ${data.city} MSA's jobs, ${ss.t0} to ${ss.t1}`}>
      <line className="dc-axis" x1={20} x2={W - 20} y1={base} y2={base} />
      {bars.map((b, i) => {
        const anchor = b.delta == null;
        const top = anchor ? y(b.to) : Math.min(y(b.from), y(b.to));
        const h = anchor ? base - y(b.to) : Math.max(2, Math.abs(y(b.from) - y(b.to)));
        const up = (b.delta ?? 0) >= 0;
        return (
          <g key={b.k.join(" ")}>
            <rect x={x(i)} y={top} width={bw} height={h} rx={3} fill={anchor ? LEVEL : up ? GAIN : LOSS}>
              <title>
                {anchor
                  ? `${b.k.join(" ")}: ${Math.round(b.to).toLocaleString()} jobs`
                  : `${b.k.join(" ")}: ${jobs(b.delta!, true)} jobs (${Math.round(b.from).toLocaleString()} → ${Math.round(b.to).toLocaleString()})`}
              </title>
            </rect>
            {i < bars.length - 1 && (
              <line className="dc-link" x1={x(i) + bw} x2={x(i + 1)} y1={y(b.to)} y2={y(b.to)} />
            )}
            {anchor && (
              <path
                className="dc-break"
                d={`M${x(i) - 3} ${base - 18} l${(bw + 6) / 4} -5 l${(bw + 6) / 4} 5 l${(bw + 6) / 4} -5 l${(bw + 6) / 4} 5`}
              />
            )}
            <text className="dc-lab dc-name" x={x(i) + bw / 2} y={top - 6} textAnchor="middle">
              {anchor ? jobs(b.to) : jobs(b.delta!, true)}
            </text>
            <text className="dc-lab" x={x(i) + bw / 2} y={base + 17} textAnchor="middle">
              {b.k.map((line, li) => (
                <tspan key={line} x={x(i) + bw / 2} dy={li ? 13 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {`jobs in the ${data.city} MSA, ${ss.t0} → ${ss.t1} · levels grey · gained teal, lost rust · axis broken below the levels`}
      </text>
    </Frame>
  );
}

/* ---------- the industry effects, three ways ---------- */

type EffectView = "bars" | "paths" | "treemap";
const EFFECT_VIEWS: { id: EffectView; label: string }[] = [
  { id: "bars", label: "Ranked bars" },
  { id: "paths", label: "Share paths" },
  { id: "treemap", label: "Treemap" },
];

function EffectViews({ data }: { data: DriverData }) {
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
        <RealRankedBars data={data} />
      ) : view === "paths" ? (
        <RealSharePaths data={data} />
      ) : (
        <RealEffectTreemap data={data} />
      )}
    </>
  );
}

function RealRankedBars({ data }: { data: DriverData }) {
  /* the live chart ranks fifteen, by the size of the effect */
  const rows = [...data.shiftShare.bars]
    .sort((a, b) => Math.abs(b.ls) - Math.abs(a.ls))
    .slice(0, 15)
    .sort((a, b) => b.ls - a.ls);
  const dom: [number, number] = [
    Math.min(0, ...rows.map((r) => r.ls)),
    Math.max(0, ...rows.map((r) => r.ls)),
  ];
  /* three columns: the sector, its bar, its value — so a long bar never
     runs under either label */
  const x = lin(dom, [222, W - 66]);
  const rowH = 16.2;
  const y0 = 18;
  const yEnd = y0 + rows.length * rowH;
  const step = niceStep(dom[1] - dom[0], 5);
  const ticks = ticksBy(dom, step);
  return (
    <Frame label={`Local-share effect by 2-digit sector, ${data.city} MSA`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className={t === 0 ? "dc-axis" : "dc-grid"} x1={x(t)} x2={x(t)} y1={y0 - 4} y2={yEnd + 2} />
          <text className="dc-lab dc-tick" x={x(t)} y={yEnd + 14} textAnchor="middle">
            {t === 0 ? "0" : jobs(t, true)}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x0 = Math.min(x(0), x(r.ls));
        const w = Math.max(2, Math.abs(x(r.ls) - x(0)));
        return (
          <g key={r.code}>
            <text className="dc-lab" x={216} y={y0 + i * rowH + 9.5} textAnchor="end">
              {`${r.code} · ${r.name}`}
            </text>
            <rect x={x0} y={y0 + i * rowH} width={w} height={11.5} rx={2.5} fill={r.ls >= 0 ? GAIN : LOSS}>
              <title>{`${r.name}: local share ${jobs(r.ls, true)} jobs (${Math.round(r.e0).toLocaleString()} → ${Math.round(r.e1).toLocaleString()})`}</title>
            </rect>
            <text className="dc-lab dc-name" x={W - 10} y={y0 + i * rowH + 9.5} textAnchor="end">
              {jobs(r.ls, true)}
            </text>
          </g>
        );
      })}
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {`local-share effect, jobs, ${data.shiftShare.t0}–${data.shiftShare.t1} · the fifteen sectors with the largest effect`}
      </text>
    </Frame>
  );
}

function RealSharePaths({ data }: { data: DriverData }) {
  const series = data.shiftShare.sharePaths;
  const PL = { l: 66, r: 476, t: 24, b: 258 };
  const all = series.flatMap((s) => s.pts);
  const xd: [number, number] = [
    Math.log(Math.min(...all.map((p) => p.emp)) * 0.9),
    Math.log(Math.max(...all.map((p) => p.emp)) * 1.12),
  ];
  const shares = all.map((p) => p.share);
  const yd: [number, number] = [Math.min(...shares) * 0.92, Math.max(...shares) * 1.06];
  const x = (emp: number) => lin(xd, [PL.l, PL.r])(Math.log(emp));
  const y = lin(yd, [PL.b, PL.t]);
  const overall = data.shiftShare.overallShare;
  const yStep = niceStep(yd[1] - yd[0], 5);
  const yTicks = ticksBy(yd, yStep);
  const xTicks = [1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6].filter((v) => Math.log(v) >= xd[0] && Math.log(v) <= xd[1]);
  /* direct labels for the biggest sectors, as many as fit without touching;
     the rest answer the pointer */
  const named = new Map<string, string>();
  const allLabel = `all jobs ${(overall * 100).toFixed(1)}%`;
  const placed: [number, number, number][] = [[PL.r - allLabel.length * 5.6, y(overall) + 12, allLabel.length * 5.6]];
  for (const s of series) {
    const last = s.pts[s.pts.length - 1];
    const label = s.name.length > 22 ? s.name.slice(0, 21).trimEnd() + "…" : s.name;
    const lx = x(last.emp) + 8;
    const ly = y(last.share);
    const lw = label.length * 5.6;
    if (lx + lw > W - 6) continue;
    if (placed.some(([px, py, pw]) => Math.abs(py - ly) < 13 && lx < px + pw && px < lx + lw)) continue;
    placed.push([lx, ly, lw]);
    named.set(s.code, label);
  }
  return (
    <Frame label={`Share paths by 2-digit sector, ${data.city} MSA`}>
      {yTicks.map((t) => (
        <g key={t}>
          <line className="dc-grid" x1={PL.l} x2={PL.r} y1={y(t)} y2={y(t)} />
          <text className="dc-lab dc-tick" x={PL.l - 6} y={y(t) + 3.5} textAnchor="end">
            {`${(t * 100).toFixed(1)}%`}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={v}>
          <line className="dc-grid" x1={x(v)} x2={x(v)} y1={PL.t} y2={PL.b} />
          <text className="dc-lab dc-tick" x={x(v)} y={PL.b + 14} textAnchor="middle">
            {jobs(v)}
          </text>
        </g>
      ))}
      <line className="dc-axis" x1={PL.l} x2={PL.r} y1={PL.b} y2={PL.b} />
      <line className="dc-axis" x1={PL.l} x2={PL.l} y1={PL.t} y2={PL.b} />
      {/* the metro's share of ALL national jobs: above it, a sector the
          metro holds more of than its size implies */}
      <line className="dc-zero" x1={PL.l} x2={PL.r} y1={y(overall)} y2={y(overall)} />
      <text className="dc-lab dc-quiet dc-halo" x={PL.r - 2} y={y(overall) + 12} textAnchor="end">
        {allLabel}
      </text>
      {series.map((s) => {
        const first = s.pts[0];
        const last = s.pts[s.pts.length - 1];
        const prev = s.pts[Math.max(0, s.pts.length - 4)];
        const col = last.share >= first.share ? GAIN : LOSS;
        const a = Math.atan2(y(last.share) - y(prev.share), x(last.emp) - x(prev.emp));
        return (
          <g key={s.code}>
            <polyline
              points={s.pts.map((p) => `${x(p.emp)},${y(p.share)}`).join(" ")}
              fill="none"
              stroke={col}
              strokeWidth={2}
              strokeLinejoin="round"
            >
              <title>{`${s.code} · ${s.name}: ${first.year} ${(first.share * 100).toFixed(2)}% of national jobs → ${last.year} ${(last.share * 100).toFixed(2)}%`}</title>
            </polyline>
            <circle cx={x(first.emp)} cy={y(first.share)} r={2.6} fill="#fff" stroke={col} strokeWidth={1.4} />
            <path
              d={`M${x(last.emp)} ${y(last.share)} l${-7 * Math.cos(a - 0.45)} ${-7 * Math.sin(a - 0.45)} M${x(last.emp)} ${y(last.share)} l${-7 * Math.cos(a + 0.45)} ${-7 * Math.sin(a + 0.45)}`}
              stroke={col}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
            {named.has(s.code) && (
              <text className="dc-lab dc-name dc-halo" x={x(last.emp) + 8} y={y(last.share) + 3.5}>
                {named.get(s.code)}
              </text>
            )}
          </g>
        );
      })}
      <text className="dc-lab dc-quiet" x={(PL.l + PL.r) / 2} y={PL.b + 30} textAnchor="middle">
        jobs in the metro (log scale)
      </text>
      <text className="dc-lab dc-quiet" x={14} y={(PL.t + PL.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(PL.t + PL.b) / 2})`}>
        share of national jobs
      </text>
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {`${series[0].pts[0].year} (ring) → ${series[0].pts[series[0].pts.length - 1].year} (arrow) · share rose teal, fell rust`}
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
    return treemap<N>().size([W - 24, H - 46]).paddingInner(1.5).paddingOuter(2)(root).leaves();
  }, [ss.tiles]);
  return (
    <Frame label={`Treemap of the ${data.city} MSA's jobs in ${ss.t0}, coloured by local-share effect`}>
      <g transform="translate(12,10)">
        {leaves.map((n, i) => {
          const w = n.x1 - n.x0;
          const h = n.y1 - n.y0;
          const room = Math.floor(w / 5.2);
          return (
            <g key={i}>
              <rect x={n.x0} y={n.y0} width={Math.max(0, w)} height={Math.max(0, h)} rx={2} fill={diverge((n.data.ls ?? 0) / ss.tileScale)}>
                <title>{`${n.data.name} (${n.parent?.data.name}): ${Math.round(n.data.e0 ?? 0).toLocaleString()} jobs in ${ss.t0} · local share ${jobs(n.data.ls ?? 0, true)}`}</title>
              </rect>
              {w > 52 && h > 17 && (
                <text className="dc-lab dc-tile" x={n.x0 + 4} y={n.y0 + 12}>
                  {n.data.name.length > room ? n.data.name.slice(0, room - 1) + "…" : n.data.name}
                </text>
              )}
            </g>
          );
        })}
      </g>
      <text className="dc-lab dc-quiet" x={12} y={H - 8}>
        {`area = jobs in ${ss.t0} · colour = local-share effect`}
      </text>
      {[LOSS, MID, GAIN].map((c, i) => (
        <rect key={c} x={W - 132 + i * 20} y={H - 18} width={18} height={11} rx={2} fill={c} />
      ))}
      <text className="dc-lab dc-tick" x={W - 136} y={H - 9} textAnchor="end">
        lost
      </text>
      <text className="dc-lab dc-tick" x={W - 70} y={H - 9}>
        gained
      </text>
    </Frame>
  );
}

/* ---------- the industries new to the metro ---------- */

function RealNewIndustries({ data }: { data: DriverData }) {
  const ss = data.shiftShare;
  const list = [...ss.newIndustries].sort((a, b) => b.jobs - a.jobs).slice(0, 6);
  const top = Math.max(1, ...list.map((n) => n.jobs));
  const x = lin([0, top], [306, 500]);
  const pitch = Math.min(44, (250 - 60) / Math.max(list.length, 1));
  return (
    <Frame label={`Industries new to the ${data.city} MSA, ${ss.t0} to ${ss.t1}`}>
      <text className="dc-lab dc-name" x={20} y={26}>
        {`${ss.fresh.toLocaleString()} jobs in ${ss.newIndustries.length} industries new to the metro, ${ss.t0}–${ss.t1}`}
      </text>
      {list.map((n, i) => {
        const yy = 56 + i * pitch;
        return (
          <g key={n.naics}>
            <text className="dc-lab" x={298} y={yy + 10} textAnchor="end">
              {n.name.length > 44 ? n.name.slice(0, 43).trimEnd() + "…" : n.name}
            </text>
            <rect x={x(0)} y={yy} width={Math.max(2, x(n.jobs) - x(0))} height={13} rx={2.5} fill={GAIN}>
              <title>{`${n.name} (${n.naics}, ${n.sector}): ${n.jobs.toLocaleString()} jobs by ${ss.t1}`}</title>
            </rect>
            <text className="dc-lab dc-name" x={x(n.jobs) + 6} y={yy + 10}>
              {n.jobs.toLocaleString()}
            </text>
          </g>
        );
      })}
      <line className="dc-axis" x1={x(0)} x2={x(0)} y1={50} y2={56 + list.length * pitch - 4} />
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {ss.freshMaterial
          ? `jobs in ${ss.t1} in industries the metro had none of in ${ss.t0}`
          : `jobs in ${ss.t1} in industries the metro had none of in ${ss.t0} · below the live tool's materiality floor, so it skips this step`}
      </text>
    </Frame>
  );
}

/* ---------- home values: across the places, and over time ---------- */

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
  /* the places' frame is 272 × 176; it is scaled up into the well */
  const K = 1.62;
  return (
    <Frame label={`Home-value growth across the ${data.city} MSA's places, ${data.window.from}–${data.window.to}`}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={272} height={176} rx={3} />
        </clipPath>
      </defs>
      <g transform={`translate(24,12) scale(${K})`} clipPath={`url(#${clip})`}>
        <path d={data.msaOutline} fill="#f1f3f4" stroke={METRO} strokeWidth={0.6} strokeDasharray="2.4 2" />
        {data.places.map(
          (p) =>
            p.d && (
              <path key={p.id} d={p.d} fill={fill(p[key])} stroke="#fff" strokeWidth={0.4}>
                <title>{`${p.name}: ${p[key] == null ? "no data" : fmt(p[key]!)}`}</title>
              </path>
            ),
        )}
        {home?.d && <path d={home.d} fill="none" stroke="var(--ink)" strokeWidth={0.9} pointerEvents="none" />}
      </g>
      {ramp.map((c, i) => (
        <rect key={c} x={496} y={64 + (ramp.length - 1 - i) * 24} width={16} height={22} rx={2} fill={c} />
      ))}
      <text className="dc-lab dc-tick" x={504} y={54} textAnchor="middle">
        {fmt(Math.max(...vals)).replace("/yr", "")}
      </text>
      <text className="dc-lab dc-tick" x={504} y={64 + ramp.length * 24 + 14} textAnchor="middle">
        {fmt(Math.min(...vals)).replace("/yr", "")}
      </text>
      <text className="dc-lab dc-quiet" x={504} y={210} textAnchor="middle">
        quintiles
      </text>
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {home && home[key] != null
          ? `${data.city} outlined: ${fmt(home[key]!)} · median place ${fmt(data.medians.placeHome)} · ${data.places.length} places, ${data.window.from}–${data.window.to}`
          : `${data.city} outlined · ${data.places.length} places`}
      </text>
    </Frame>
  );
}

function RealCostTrend({ data }: { data: DriverData }) {
  const rows = data.costTrend;
  const PL = { l: 66, r: 458, t: 28, b: 258 };
  const xd: [number, number] = [rows[0].year, rows[rows.length - 1].year];
  const top = Math.max(...rows.flatMap((r) => [r.metro ?? 0, r.place ?? 0, r.median]));
  const x = lin(xd, [PL.l, PL.r]);
  const y = lin([0, top * 1.06], [PL.b, PL.t]);
  const line = (k: "metro" | "place" | "median") =>
    rows
      .filter((r) => r[k] != null)
      .map((r) => `${x(r.year)},${y(r[k]!)}`)
      .join(" ");
  const last = rows[rows.length - 1];
  const ticks = [250000, 500000, 750000, 1000000, 1250000].filter((t) => t < top * 1.06);
  const years = rows.map((r) => r.year).filter((yr) => yr % 5 === 0);
  /* the end labels, pushed apart where two series finish close together */
  const ends = (["place", "metro", "median"] as const)
    .filter((k) => last[k] != null)
    .map((k) => ({ k, y: y(last[k]!), ly: y(last[k]!) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++)
    if (ends[i].ly - ends[i - 1].ly < 26) ends[i].ly = ends[i - 1].ly + 26;
  const NAME = { place: data.city, metro: "its MSA", median: "median metro" };
  const COL = { place: CITY, metro: METRO, median: FIELD };
  return (
    <Frame label={`Home values by year: ${data.city}, its MSA and the median metro`}>
      <rect
        className="dc-window"
        x={x(data.window.from)}
        y={PL.t - 6}
        width={x(Math.min(data.window.to, xd[1])) - x(data.window.from)}
        height={PL.b - PL.t + 6}
      />
      <text className="dc-lab dc-quiet" x={(x(data.window.from) + x(Math.min(data.window.to, xd[1]))) / 2} y={PL.t - 10} textAnchor="middle">
        {`${data.window.from}–${data.window.to}`}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line className="dc-grid" x1={PL.l} x2={PL.r} y1={y(t)} y2={y(t)} />
          <text className="dc-lab dc-tick" x={PL.l - 6} y={y(t) + 3.5} textAnchor="end">
            {t >= 1e6 ? `$${(t / 1e6).toFixed(2).replace(/\.?0+$/, "")}M` : `$${t / 1000}k`}
          </text>
        </g>
      ))}
      <line className="dc-axis" x1={PL.l} x2={PL.r} y1={PL.b} y2={PL.b} />
      {years.map((yr) => (
        <text key={yr} className="dc-lab dc-tick" x={x(yr)} y={PL.b + 14} textAnchor="middle">
          {yr}
        </text>
      ))}
      <polyline points={line("median")} fill="none" stroke={FIELD} strokeWidth={2} strokeDasharray="6 5" />
      <polyline points={line("metro")} fill="none" stroke={METRO} strokeWidth={2} strokeLinejoin="round" />
      <polyline points={line("place")} fill="none" stroke={CITY} strokeWidth={2.2} strokeLinejoin="round" />
      {ends.map((e) => (
        <g key={e.k}>
          <circle cx={x(last.year)} cy={e.y} r={4} fill={COL[e.k]} stroke="#fff" strokeWidth={1.5}>
            <title>{`${NAME[e.k]}, ${last.year}: $${Math.round(last[e.k]!).toLocaleString()}`}</title>
          </circle>
          <text className="dc-lab dc-name dc-halo" x={x(last.year) + 9} y={e.ly + 1}>
            {NAME[e.k]}
          </text>
          <text className="dc-lab dc-tick dc-halo" x={x(last.year) + 9} y={e.ly + 13}>
            {`$${Math.round(last[e.k]! / 1000)}k`}
          </text>
        </g>
      ))}
      {rows.map((r) => (
        <rect key={r.year} x={x(r.year) - 7} y={PL.t} width={14} height={PL.b - PL.t} fill="transparent">
          <title>
            {`${r.year} · ${data.city} ${r.place == null ? "—" : `$${Math.round(r.place / 1000)}k`} · its MSA ${r.metro == null ? "—" : `$${Math.round(r.metro / 1000)}k`} · median metro $${Math.round(r.median / 1000)}k`}
          </title>
        </rect>
      ))}
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        typical home value by year (Zillow) · the median metro dashed
      </text>
    </Frame>
  );
}

/* ---------- the verdicts ---------- */

/** how each Drivers data point reads for the city, from the chart's own
 *  numbers */
function driverVerdict(kind: ChartKind, data: DriverData): Verdict | null {
  const ss = data.shiftShare;
  const win = `${ss.t0}–${ss.t1}`;
  switch (kind) {
    case "waterfall":
      return {
        tone: ss.local >= 0 ? "up" : "down",
        head: ss.local >= 0 ? "Local share positive" : "Local share negative",
        body: `${jobs(ss.local, true)} jobs from local performance, ${win}; the national trend ${jobs(ss.national, true)} and the industry mix ${jobs(ss.mix, true)}`,
      };
    case "effectViews": {
      const paths = ss.sharePaths;
      const fell = paths.filter((s) => s.pts[s.pts.length - 1].share < s.pts[0].share);
      const rose = paths.filter((s) => !fell.includes(s)).map((s) => s.name.toLowerCase());
      const slipping = fell.length > paths.length / 2;
      return {
        tone: slipping ? "down" : "up",
        head: slipping ? "Market share slipping" : "Market share holding",
        body: `${fell.length} of the ${paths.length} biggest sectors lost share of national jobs, ${win}${rose.length ? `; ${rose.slice(0, 3).join(", ")}${rose.length > 3 ? ` and ${rose.length - 3} more` : ""} gained` : ""}`,
      };
    }
    case "newIndustries":
      return {
        tone: ss.freshMaterial ? "up" : "flat",
        head: ss.freshMaterial ? "New industries material" : "New industries not material",
        body: `${ss.fresh.toLocaleString()} jobs in ${ss.newIndustries.length} industries the metro had none of in ${ss.t0}${ss.freshMaterial ? "" : "; below the live tool's floor"}`,
      };
    case "priceMap": {
      const home = data.places.find((p) => p.id === data.placeId);
      if (!home || home.home == null) return null;
      const below = home.home < data.medians.placeHome;
      return {
        tone: below ? "down" : "up",
        head: below ? "Below the median place" : "Above the median place",
        body: `home values ${pct1(home.home)}/yr in ${data.city} against ${pct1(data.medians.placeHome)}/yr for the median place in its MSA, ${data.window.from}–${data.window.to}`,
      };
    }
    case "costTrend": {
      const home = data.places.find((p) => p.id === data.placeId);
      const last = data.costTrend[data.costTrend.length - 1];
      if (!home || home.home == null) return null;
      const slower = home.home < data.medians.home;
      return {
        tone: slower ? "down" : "up",
        head: slower ? "Rising slower than the median metro" : "Rising faster than the median metro",
        body: `${pct1(home.home)}/yr since ${data.window.from} against the median metro's ${pct1(data.medians.home)}/yr${last.place != null ? `; $${Math.round(last.place / 1000)}k in ${last.year}` : ""}`,
      };
    }
    default:
      return null;
  }
}

/** a placeholder's verdict is the spec's rubric, still to come */
const placeholderVerdict = (view?: ModuleView): Verdict => ({
  tone: "ph",
  head: "Signal to come",
  body: view?.signal ? `read as ${view.signal}` : "",
});

/** the coloured line a card's caption opens on — null where the city's
 *  data has not been pulled */
export const chartVerdict = (kind: ChartKind, city: string, view?: ModuleView): Verdict | null => {
  if (kind === "placeholder") return placeholderVerdict(view);
  if (isAmenityKind(kind)) return amenityVerdict(kind, city);
  if (isInnovationKind(kind)) return innovationVerdict(kind, city);
  const d = driverData(city);
  return d ? driverVerdict(kind, d) : null;
};

/** the WINDOW a card's chart covers, for its tag: the walk's window for the
 *  live tool's charts, each Amenities measure's own span, the Innovation
 *  Module's pooled window. Only the years (Sept 2026, the user's call) — the
 *  source's name was on every pill and named nothing the card did not. Null
 *  for a placeholder, and where the city's data has not been pulled. */
export const chartSource = (kind: ChartKind, city: string): string | null => {
  if (kind === "placeholder") return null;
  if (isAmenityKind(kind)) return amenitySource(kind, city);
  if (isInnovationKind(kind)) return innovationSource(kind, city);
  const d = driverData(city);
  return d ? `${d.window.from}–${d.window.to}` : null;
};

/** a data point's chart: one of the live tool's driver charts, one of the
 *  Amenities or Innovation Module's indicators, or a placeholder in the form
 *  its spec names */
export function DriverChart({
  kind,
  city,
  placeholder,
}: {
  kind: ChartKind;
  city: string;
  placeholder?: PlaceholderSpec;
}) {
  if (kind === "placeholder")
    return placeholder ? <PlaceholderChart spec={placeholder} city={city} /> : null;
  if (isAmenityKind(kind)) return <AmenityChart kind={kind} city={city} />;
  if (isInnovationKind(kind)) return <InnovationChart kind={kind} city={city} />;
  const data = driverData(city);
  if (!data)
    return (
      <Frame label={`No live tool data has been pulled for ${city}`}>
        <text className="dc-lab dc-ph" x={W / 2} y={H / 2} textAnchor="middle">
          {`[no live tool data pulled for ${city}]`}
        </text>
      </Frame>
    );
  switch (kind) {
    case "waterfall":
      return <RealWaterfall data={data} />;
    case "effectViews":
      return <EffectViews data={data} />;
    case "newIndustries":
      return <RealNewIndustries data={data} />;
    case "priceMap":
      return <RealPlacesMap data={data} />;
    case "costTrend":
      return <RealCostTrend data={data} />;
  }
}
