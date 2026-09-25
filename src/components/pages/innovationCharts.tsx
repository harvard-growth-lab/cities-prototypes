/* The Innovation Module's indicators, as the analysis section's cards — one
   per innovation ChartKind in figures.ts, which are the team spec's three
   Innovation data points (Firm creation; Patents per capita and
   specialization (RCA); Publications per capita and specialization (RCA)).
   The numbers are the Growth Lab's own, for Boston
   (src/data/innovationData.ts, pulled by scripts/build-innovation-data.mjs
   from cities.taimur.sh/tools/innovation-module.html); that script documents
   what each measure is and on which window. None of the module's prose is
   here — a card's copy is the data point's bracketed placeholder, under one
   computed verdict line (`innovationVerdict`).

   THE FORMS follow the jobs the data does:
     firm creation    one metro's position among all of them on two rates →
                      the page's own scatter (entry across, exit up), the
                      all-metro cross with its values, the four quadrants
                      named in their corners and the metro's own tinted; the
                      field in grey, the metro labelled with its rates.
     patents,         two things in one data point. A rate per resident, read
     publications     as high or low → a strip of every metro on a log axis,
                      the median marked, the metro's own figure and rank
                      written out. A specialization, read as WHICH classes →
                      ranked RCA bars from zero on a ticked axis, parity
                      (RCA = 1) marked. The page draws two levels — IPC
                      sections / subclasses, fields / concepts — so the card
                      carries both behind a switch, as the industry views do.

   COLOUR as amenityCharts.tsx: the metro wears the app's --geo-city teal,
   the field of other metros a neutral grey (#8a9498 — ΔE 23 from the teal,
   21 under protanopia); bars are the metro's own values, so they wear its
   one hue and no legend. Text wears ink tokens, never the series colour.

   Same 560 × 320 frame, classes (dc-*) and native-tooltip convention as
   driverCharts.tsx, whose dispatcher hands the innovation kinds on to here. */

import { useState } from "react";
import type { ChartKind } from "../../data/figures";
import {
  innovationData,
  type FirmQuadrant,
  type InnovationData,
  type RcaRow,
  type SpecializationData,
} from "../../data/innovationData";
import { missingDataLabel } from "../../data/placeholderCities";
import type { Verdict } from "./driverCharts";
import { titleCase } from "./titleCase";

const W = 560;
const H = 320;
const CITY = "#255862";
const FIELD = "#8a9498";

export type InnovationKind = Extract<ChartKind, "firmCreation" | "patents" | "publications">;
const INNOVATION_KINDS: readonly ChartKind[] = ["firmCreation", "patents", "publications"];
export const isInnovationKind = (k: ChartKind): k is InnovationKind =>
  INNOVATION_KINDS.includes(k);

const lin = (d: [number, number], r: [number, number]) => (v: number) =>
  r[0] + ((v - d[0]) / (d[1] - d[0])) * (r[1] - r[0]);
const signed = (v: number, dp: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}`;
const ordinal = (n: number) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n.toLocaleString()}${s}`;
};
/** a rate at the precision its size earns: 0.09 · 3.3 · 18.2 · 775 · 6.3k */
const compact = (v: number) =>
  v >= 10_000
    ? `${Math.round(v / 1000)}k`
    : v >= 1000
      ? `${(v / 1000).toFixed(1)}k`
      : v >= 100
        ? v.toFixed(0)
        : v >= 10
          ? v.toFixed(1)
          : v.toFixed(2);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const ticksBy = (d: [number, number], step: number) => {
  const out: number[] = [];
  for (let v = Math.ceil(d[0] / step) * step; v <= d[1] + 1e-9; v += step)
    out.push(Math.round(v * 100) / 100);
  return out;
};

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg className="dc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/* ---------- firm creation: entry against exit, among all metros ---------- */

const SC = { l: 56, r: 530, t: 26, b: 250 };
const QUAD_NAME: Record<FirmQuadrant, string> = {
  churn: "Churn",
  decline: "Decline",
  stasis: "Stasis",
  growth: "Growth",
};

function FirmCreation({ d }: { d: InnovationData }) {
  const F = d.firms;
  const { from, to } = d.window;
  const dom = (vs: number[]): [number, number] => {
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const pad = (hi - lo) * 0.06;
    return [lo - pad, hi + pad];
  };
  const xd = dom([F.entry, ...F.field.map((p) => p[0])]);
  const yd = dom([F.exit, ...F.field.map((p) => p[1])]);
  const x = lin(xd, [SC.l, SC.r]);
  const y = lin(yd, [SC.b, SC.t]);
  const bx = x(F.benchEntry);
  const by = y(F.benchExit);
  /* the quadrant the metro fell in, tinted — the cross draws the other three */
  const quadBox: Record<FirmQuadrant, [number, number, number, number]> = {
    churn: [bx, SC.r, SC.t, by],
    decline: [SC.l, bx, SC.t, by],
    stasis: [SC.l, bx, by, SC.b],
    growth: [bx, SC.r, by, SC.b],
  };
  const [qx0, qx1, qy0, qy1] = quadBox[F.quad];
  const xt = ticksBy(xd, 1);
  const yt = ticksBy(yd, 1);
  /* entry = exit, over the stretch both axes share: no net change */
  const da = Math.max(xd[0], yd[0]);
  const db = Math.min(xd[1], yd[1]);
  const cx = x(F.entry);
  const cy = y(F.exit);
  const right = cx > (SC.l + SC.r) / 2;
  const lx = right ? cx - 11 : cx + 11;
  const anchor = right ? "end" : "start";
  const pct = (v: number) => `${v.toFixed(1)}%`;
  return (
    <Frame
      label={`Firm entry against exit rates, every metro pooled ${from}–${to}: ${d.city}'s MSA among all ${d.nMetro} metros`}
    >
      <rect className="dc-window" x={Math.min(qx0, qx1)} y={Math.min(qy0, qy1)} width={Math.abs(qx1 - qx0)} height={Math.abs(qy1 - qy0)} />
      {xt.map((t) => (
        <g key={t}>
          <line className="dc-grid" x1={x(t)} x2={x(t)} y1={SC.t} y2={SC.b} />
          <text className="dc-lab dc-tick" x={x(t)} y={SC.b + 14} textAnchor="middle">
            {titleCase(`${t}%`)}
          </text>
        </g>
      ))}
      {yt.map((t) => (
        <g key={t}>
          <line className="dc-grid" x1={SC.l} x2={SC.r} y1={y(t)} y2={y(t)} />
          <text className="dc-lab dc-tick" x={SC.l - 6} y={y(t) + 3.5} textAnchor="end">
            {titleCase(`${t}%`)}
          </text>
        </g>
      ))}
      <line className="dc-axis" x1={SC.l} x2={SC.r} y1={SC.b} y2={SC.b} />
      <line className="dc-axis" x1={SC.l} x2={SC.l} y1={SC.t} y2={SC.b} />
      {da < db && (
        <>
          <line className="dc-link" x1={x(da)} y1={y(da)} x2={x(db)} y2={y(db)} />
          <text className="dc-lab dc-quiet dc-halo" x={x(db) + 5} y={y(db) + 11}>
            Entry = Exit
          </text>
        </>
      )}
      {/* the cross: all metros pooled over the same years, with its values */}
      <line className="dc-zero" x1={bx} x2={bx} y1={SC.t} y2={SC.b} />
      <line className="dc-zero" x1={SC.l} x2={SC.r} y1={by} y2={by} />
      <text className="dc-lab dc-quiet dc-halo" x={SC.l + 4} y={by - 5}>
        {titleCase(`all metros · exit ${pct(F.benchExit)}`)}
      </text>
      <text className="dc-lab dc-quiet dc-halo" x={bx + 5} y={SC.b - 6}>
        {titleCase(`all metros · entry ${pct(F.benchEntry)}`)}
      </text>
      <text className="dc-lab dc-quiet" x={SC.r - 5} y={SC.t + 12} textAnchor="end">
        {titleCase(QUAD_NAME.churn)}
      </text>
      <text className="dc-lab dc-quiet" x={SC.l + 5} y={SC.t + 12}>
        {titleCase(QUAD_NAME.decline)}
      </text>
      <text className="dc-lab dc-quiet" x={SC.l + 5} y={by + 14}>
        {titleCase(QUAD_NAME.stasis)}
      </text>
      <text className="dc-lab dc-quiet" x={SC.r - 5} y={by + 14} textAnchor="end">
        {titleCase(QUAD_NAME.growth)}
      </text>
      {F.field.map((p, i) => (
        <circle key={i} cx={x(p[0])} cy={y(p[1])} r={2.8} fill={FIELD} opacity={0.5} />
      ))}
      <circle cx={cx} cy={cy} r={5.5} fill={CITY} stroke="#fff" strokeWidth={1.8} />
      <text className="dc-lab dc-name dc-halo" x={lx} y={cy - 4} textAnchor={anchor}>
        {titleCase(d.city)}
      </text>
      <text className="dc-lab dc-tick dc-halo" x={lx} y={cy + 9} textAnchor={anchor}>
        {titleCase(`entry ${pct(F.entry)} · exit ${pct(F.exit)} · net ${signed(F.net, 1)} pts`)}
      </text>
      <circle cx={cx} cy={cy} r={14} fill="transparent">
        <title>
          {`${d.city}'s MSA, ${from}–${to}: entry ${pct(F.entry)} (all metros ${pct(F.benchEntry)}) · exit ${pct(F.exit)} (all metros ${pct(F.benchExit)}) · net ${signed(F.net, 1)} pts · ${QUAD_NAME[F.quad]} · ${F.firms.toLocaleString()} firms`}
        </title>
      </circle>
      <text className="dc-lab dc-quiet" x={(SC.l + SC.r) / 2} y={SC.b + 30} textAnchor="middle">
        Firm Entry Rate, % of Firms a Year
      </text>
      <text
        className="dc-lab dc-quiet"
        x={14}
        y={(SC.t + SC.b) / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${(SC.t + SC.b) / 2})`}
      >
        Exit Rate, % of Firms
      </text>
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {titleCase(`industry-mix adjusted, pooled ${from}–${to} · ${d.nMetro} metros · quadrants: Churn (both high), Decline, Stasis (both low), Growth`)}
      </text>
    </Frame>
  );
}

/* ---------- patents, publications: per resident, and RCA ---------- */

type Level = "broad" | "detailed";
type SpecKind = "patents" | "publications";
const LEVELS: Record<SpecKind, { id: Level; label: string }[]> = {
  patents: [
    { id: "broad", label: "IPC sections" },
    { id: "detailed", label: "IPC subclasses" },
  ],
  publications: [
    { id: "broad", label: "Fields" },
    { id: "detailed", label: "Concepts" },
  ],
};
/* the page's category names, at the width a card's label column has */
const SHORT: Record<string, string> = {
  "Human Necessities": "Human necessities",
  "Performing Operations; Transporting": "Operations; transporting",
  "Chemistry; Metallurgy": "Chemistry; metallurgy",
  "Textiles; Paper": "Textiles; paper",
  "Fixed Constructions": "Fixed constructions",
  "Mechanical Engineering; Lighting; Heating; Weapons; Blasting": "Mechanical engineering",
  "Business & Economics": "Business & economics",
  "Medicine and Biology": "Medicine & biology",
  "Arts and Humanities": "Arts & humanities",
  "Social Sciences": "Social sciences",
  "Engineering and Computer Science": "Engineering & computer science",
  "Earth and Environmental Sciences": "Earth & environmental sciences",
};
const rowLabel = (r: RcaRow) => {
  const name = SHORT[r.name] ?? r.name;
  /* a subclass code (C07K) takes three more characters than a section's (C) */
  return r.code ? `${r.code} · ${clip(name, r.code.length > 1 ? 34 : 37)}` : clip(name, 42);
};

/** every metro's rate on a log axis, the median marked, the metro on top */
function RateStrip({ d, s }: { d: InnovationData; s: SpecializationData }) {
  const lo = Math.log10(Math.min(...s.field, s.rate));
  const hi = Math.log10(Math.max(...s.field, s.rate));
  const x = (v: number) => lin([lo, hi], [20, 540])(Math.log10(v));
  const Y = 44;
  const per = `${s.per / 1000}k residents`;
  return (
    <g>
      {s.field.map((v, i) => (
        <line key={i} x1={x(v)} x2={x(v)} y1={Y - 7} y2={Y + 7} stroke={FIELD} strokeWidth={1} opacity={0.45} />
      ))}
      <line className="dc-zero" x1={x(s.median)} x2={x(s.median)} y1={Y - 11} y2={Y + 11} />
      <circle cx={x(s.rate)} cy={Y} r={5.5} fill={CITY} stroke="#fff" strokeWidth={1.8} />
      <circle cx={x(s.rate)} cy={Y} r={13} fill="transparent">
        <title>
          {`${d.city}'s MSA, ${d.window.from}–${d.window.to}: ${s.output.toLocaleString()} ${s.unit} over ${s.pop.toLocaleString()} residents (mean) = ${compact(s.rate)} per ${per} · ${ordinal(s.rank)} of ${s.n} metros · ${s.fitFactor}× what its population predicts`}
        </title>
      </circle>
      <text className="dc-lab dc-tick" x={20} y={Y + 21}>
        {titleCase(compact(Math.min(...s.field)))}
      </text>
      <text className="dc-lab dc-tick" x={x(s.median)} y={Y + 21} textAnchor="middle">
        {titleCase(`median ${compact(s.median)}`)}
      </text>
      <text className="dc-lab dc-name" x={x(s.rate)} y={Y + 21} textAnchor="middle">
        {titleCase(d.city)}
      </text>
      <text className="dc-lab dc-tick" x={540} y={Y + 21} textAnchor="end">
        {titleCase(compact(Math.max(...s.field)))}
      </text>
    </g>
  );
}

function RcaBars({ d, s, level }: { d: InnovationData; s: SpecializationData; level: Level }) {
  const rows = s[level];
  const y0 = 84;
  const pitch = Math.min(21, (282 - y0) / Math.max(rows.length, 1));
  const bh = pitch - 6;
  const top = Math.max((rows[0]?.rca ?? 1) * 1.05, 1.1);
  const x = lin([0, top], [246, 516]);
  const ticks = ticksBy([0, top], top > 3 ? 1 : 0.5);
  const yEnd = y0 + rows.length * pitch - 2;
  const unit = s.floorUnit;
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          {t !== 1 && <line className="dc-grid" x1={x(t)} x2={x(t)} y1={y0 - 6} y2={yEnd} />}
          <text className="dc-lab dc-tick" x={x(t)} y={yEnd + 14} textAnchor="middle">
            {titleCase(t)}
          </text>
        </g>
      ))}
      {/* parity, named at its foot — under the strip its name would stack
          with the metro's, which sits near it whenever the rate is high */}
      <line className="dc-zero" x1={x(1)} x2={x(1)} y1={y0 - 8} y2={yEnd + 2} />
      <text className="dc-lab dc-quiet dc-halo" x={x(1) + 5} y={y0 - 10}>
        RCA = 1, the All-Metro Share
      </text>
      {rows.map((r, i) => {
        const yy = y0 + i * pitch;
        const mid = yy + bh / 2 + 4;
        const section = s.sections[r.section]?.name;
        return (
          <g key={`${r.code ?? ""}${r.name}`}>
            <text className="dc-lab" x={238} y={mid} textAnchor="end">
              {titleCase(rowLabel(r))}
            </text>
            <rect x={x(0)} y={yy} width={Math.max(2, x(r.rca) - x(0))} height={bh} rx={2.5} fill={CITY}>
              <title>
                {`${r.name}${r.code ? ` (${r.code})` : ""}${level === "detailed" && section ? ` · ${section}` : ""}: RCA ${r.rca.toFixed(2)} · ${(r.share * 100).toFixed(1)}% of ${d.city}'s ${s.unit} vs ${(r.nat * 100).toFixed(1)}% across all metros · ${r.count.toLocaleString()} ${unit}`}
              </title>
            </rect>
            <text className="dc-lab dc-name dc-halo" x={x(r.rca) + 6} y={mid}>
              {titleCase(r.rca.toFixed(2))}
            </text>
          </g>
        );
      })}
      <text className="dc-lab dc-quiet" x={(x(0) + x(top)) / 2} y={yEnd + 28} textAnchor="middle">
        Revealed Comparative Advantage
      </text>
    </g>
  );
}

function Specialization({ d, kind }: { d: InnovationData; kind: SpecKind }) {
  const s = d[kind];
  const [level, setLevel] = useState<Level>("broad");
  const { from, to } = d.window;
  const note =
    level === "detailed"
      ? `top 10 by RCA, ${s.floor}+ ${s.floorUnit} each, ${from}–${to}`
      : `RCA over ${s.floorUnit}, ${from}–${to}${kind === "patents" ? " · latest years incomplete (grants still issuing)" : ""}`;
  return (
    <>
      <div className="dc-tabs" role="group" aria-label="Specialization level">
        {LEVELS[kind].map((l) => (
          <button
            key={l.id}
            type="button"
            className={"dc-tab" + (l.id === level ? " on" : "")}
            aria-pressed={l.id === level}
            onClick={() => setLevel(l.id)}
          >
            {titleCase(l.label)}
          </button>
        ))}
      </div>
      <Frame
        label={`${d.city}'s MSA: ${s.unit} per resident among all metros, and its specialization by ${LEVELS[kind][level === "broad" ? 0 : 1].label.toLowerCase()} (RCA), ${from}–${to}`}
      >
        <text className="dc-lab dc-name" x={20} y={20}>
          {titleCase(`${compact(s.rate)} ${s.unit} per ${s.per / 1000}k residents, ${from}–${to}`)}
        </text>
        <text className="dc-lab dc-tick" x={W - 20} y={20} textAnchor="end">
          {titleCase(`${ordinal(s.rank)} of ${s.n} metros · every metro a tick, log scale`)}
        </text>
        <RateStrip d={d} s={s} />
        <RcaBars d={d} s={s} level={level} />
        <text className="dc-lab dc-quiet" x={20} y={H - 6}>
          {titleCase(note)}
        </text>
      </Frame>
    </>
  );
}

/** the span a card's tag names — the page's pooled window. Years only: see
 *  chartSource in driverCharts. */
export const innovationSource = (_kind: InnovationKind, city: string): string | null => {
  const d = innovationData(city);
  return d ? `${d.window.from}–${d.window.to}` : null;
};

/** how each indicator reads for the city, from the chart's own numbers */
export const innovationVerdict = (kind: InnovationKind, city: string): Verdict | null => {
  const d = innovationData(city);
  if (!d) return null;
  const pct = (v: number) => `${v.toFixed(1)}%`;
  if (kind === "firmCreation") {
    const F = d.firms;
    const tone = F.readEntry === "higher" ? "up" : F.readEntry === "lower" ? "down" : "flat";
    return {
      tone,
      head: tone === "up" ? "High firm creation" : tone === "down" ? "Low firm creation" : "Firm creation near all metros",
      body: `firms enter at ${pct(F.entry)} and exit at ${pct(F.exit)} a year, against ${pct(F.benchEntry)} and ${pct(F.benchExit)} across metros · ${QUAD_NAME[F.quad]}`,
    };
  }
  const s = d[kind];
  const q = s.rank / s.n;
  const tone = q <= 0.25 ? "up" : q >= 0.75 ? "down" : "flat";
  const noun = kind === "patents" ? "patent output" : "research output";
  const above = s.broad.filter((r) => r.rca >= 1).map((r) => (SHORT[r.name] ?? r.name).toLowerCase());
  return {
    tone,
    head: `${tone === "up" ? "High" : tone === "down" ? "Low" : "Middling"} ${noun}`,
    body: `${compact(s.rate)} ${s.unit} per ${s.per / 1000}k residents, ${ordinal(s.rank)} of ${s.n} metros${above.length ? ` · specialized in ${above.slice(0, 3).join(", ")}` : " · no class above RCA 1"}`,
  };
};

/** one of the Innovation Module's indicators. A city the module has not
 *  been pulled for draws an empty well naming what is missing — there is no
 *  schematic of these: a made-up entry rate is a wrong number, not a
 *  drawing of a chart form. */
export function InnovationChart({ kind, city }: { kind: InnovationKind; city: string }) {
  const d = innovationData(city);
  if (!d)
    return (
      <Frame label={missingDataLabel("Innovation Module", city)}>
        <text className="dc-lab dc-ph" x={W / 2} y={H / 2} textAnchor="middle">
          {`[${missingDataLabel("Innovation Module", city)}]`}
        </text>
      </Frame>
    );
  switch (kind) {
    case "firmCreation":
      return <FirmCreation d={d} />;
    case "patents":
      return <Specialization d={d} kind="patents" />;
    case "publications":
      return <Specialization d={d} kind="publications" />;
  }
}
