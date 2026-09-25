/* The Amenities Module's indicators, as the analysis section's cards — one per
   amenity ChartKind in figures.ts, which are five of the team spec's six
   Amenities data points (Education, Crime, Transportation, Air quality index,
   Quality of life). The numbers are the Growth Lab's own, for Boston
   (src/data/amenityData.ts, pulled by scripts/build-amenity-data.mjs from
   cities.taimur.sh/tools/amenities-module.html); that script documents what
   each measure is. None of the module's prose is here — a card's copy is the
   data point's bracketed placeholder, under one computed verdict line
   (`amenityVerdict`: how the indicator reads for the city, from the same
   numbers the chart draws).

   THE FORMS follow the jobs the data does:
     education, crime   change over time, two series against a benchmark →
                        two lines and a labelled reference (national = 0 /
                        100). The module's 3-year averages, as its page
                        draws, with the raw yearly values faint behind.
     air quality        the same, on yearly means, with the monthly series
                        faint behind (its seasonal swing is most of what the
                        series does) and the Good / Moderate line at 50.
     transportation     three magnitudes, each against two medians → bars on
                        ONE shared axis with a tick per median; the ranks are
                        text, since a rank has no length.
     quality of life    a ratio to the national rate → bars from zero with
                        the reference at 1×.

   COLOUR. The city wears the app's --geo-city teal. Its metro is drawn in a
   neutral GREY, as the module's own page draws it — not in --geo-metro: that
   pair (#255862 / #4a6a72) measures ΔE 7.5 where 15 is the floor for telling
   two series apart at all, and these lines cross. Teal against #8a9498 is
   ΔE 23 (21 under protanopia) at ≥3:1 on the well. Both lines are also
   labelled at their ends, so identity never rests on colour; text wears ink
   tokens, never the series colour.

   Same 560 × 320 frame, classes (dc-*) and native-tooltip convention as
   driverCharts.tsx, whose dispatcher hands the amenity kinds on to here. */

import type { ChartKind } from "../../data/figures";
import { amenityData, type AmenityData } from "../../data/amenityData";
import { missingDataLabel } from "../../data/placeholderCities";
import type { Verdict } from "./driverCharts";
import { titleCase } from "./titleCase";

const W = 560;
const H = 320;
const CITY = "#255862";
const METRO = "#8a9498";
/* the section's data window, marked on every series the way the cost trend
   marks it — these indicators run longer than the walk's 2014 → 2024 */
const WINDOW: [number, number] = [2014, 2024];

export type AmenityKind = Extract<
  ChartKind,
  "education" | "crime" | "jobAccess" | "airQuality" | "vitality"
>;
const AMENITY_KINDS: readonly ChartKind[] = [
  "education",
  "crime",
  "jobAccess",
  "airQuality",
  "vitality",
];
export const isAmenityKind = (k: ChartKind): k is AmenityKind =>
  AMENITY_KINDS.includes(k);

const lin = (d: [number, number], r: [number, number]) => (v: number) =>
  r[0] + ((v - d[0]) / (d[1] - d[0])) * (r[1] - r[0]);
const signed = (v: number, dp: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}`;
const big = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${v}`;
const ordinal = (n: number) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n.toLocaleString()}${s}`;
};
/** the last entry of a series that has a value, with its index */
const lastOf = (xs: (number | null)[]): [number, number] | null => {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null) return [i, xs[i]!];
  return null;
};

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg className="dc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/* ---------- two series over the years, against a benchmark ---------- */

const PLOT = { l: 58, r: 452, t: 36, b: 254 };

interface Series {
  name: string;
  color: string;
  /** x positions, in years (a yearly mean sits at mid-year) */
  xs: number[];
  ys: (number | null)[];
}

/** the year labels: every third year from the first, and the last where it
 *  has room */
const yearTicks = (xd: [number, number]): [number, string][] => {
  const out: number[] = [];
  for (let yr = xd[0]; yr <= xd[1]; yr += 3) out.push(yr);
  if (xd[1] - out[out.length - 1] >= 2) out.push(xd[1]);
  return out.map((yr) => [yr, `${yr}`]);
};

function LinePair({
  label,
  xd,
  yd,
  ticks,
  tickFmt,
  valueFmt,
  series,
  refAt,
  refLabel,
  refBelow,
  xTicks,
  windowX = WINDOW,
  note,
  hoverYears,
  hoverText,
  under,
}: {
  label: string;
  xd: [number, number];
  yd: [number, number];
  ticks: number[];
  tickFmt: (v: number) => string;
  valueFmt: (v: number) => string;
  /** the context series first, the city last — it draws on top */
  series: Series[];
  refAt: number;
  /** what the benchmark is, written above it — and, where the two sides of
   *  it have names (the AQI's categories), the lower side's under it */
  refLabel: string;
  refBelow?: string;
  /** where the year labels go; every third year by default */
  xTicks?: [number, string][];
  /** the data window's extent on this chart's x scale */
  windowX?: [number, number];
  note: string;
  hoverYears: number[];
  hoverText: (year: number) => string;
  /** anything that belongs under the lines (raw yearly values, the AQI's
   *  monthly trace) */
  under?: React.ReactNode;
}) {
  const x = lin(xd, [PLOT.l, PLOT.r]);
  const y = lin(yd, [PLOT.b, PLOT.t]);
  const pts = (s: Series) =>
    s.ys
      .map((v, i) => (v == null ? null : `${x(s.xs[i]).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  /* the line-end labels: each at its own line's end, pushed apart where two
     series finish within a label's height of each other */
  const ends = series
    .map((s) => {
      const l = lastOf(s.ys);
      return l ? { s, x: x(s.xs[l[0]]), y: y(l[1]), v: l[1], ly: y(l[1]) } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e != null)
    .sort((a, b) => a.y - b.y);
  const GAP = 30;
  for (let i = 1; i < ends.length; i++)
    if (ends[i].ly - ends[i - 1].ly < GAP) {
      const mid = (ends[i].ly + ends[i - 1].ly) / 2;
      ends[i - 1].ly = mid - GAP / 2;
      ends[i].ly = mid + GAP / 2;
    }
  const w0 = Math.max(xd[0], windowX[0]);
  const w1 = Math.min(xd[1], windowX[1]);
  /* THE BENCHMARK'S LABEL GOES WHERE THERE IS ROOM. A series can end on the
     benchmark (Boston's crime index finishes at 107 against 100) or cross
     it mid-chart (its AQI), so a fixed corner lands on a line sooner or
     later. Each end of the line is scored by how far the nearest series
     point stays from the strip(s) the label would occupy, over the label's
     own width, and the clearer end wins. */
  const labelW = Math.max(refLabel.length, refBelow?.length ?? 0) * 5.6 + 6;
  const clearance = (x0: number, x1: number) => {
    let best = Infinity;
    for (const s of series)
      s.ys.forEach((v, i) => {
        if (v == null) return;
        const px = x(s.xs[i]);
        if (px < x0 - 8 || px > x1 + 8) return;
        const dy = y(v) - y(refAt); // + is below the benchmark
        const gap = dy < 0 ? -dy - 15 : refBelow ? dy - 15 : Infinity;
        best = Math.min(best, gap);
      });
    return best;
  };
  const atLeft = clearance(PLOT.l, PLOT.l + labelW) >= clearance(PLOT.r - labelW, PLOT.r);
  const refX = atLeft ? PLOT.l + 4 : PLOT.r - 3;
  const refAnchor = atLeft ? "start" : "end";
  const step = hoverYears.length > 1 ? x(hoverYears[1]) - x(hoverYears[0]) : 14;
  const xt = xTicks ?? yearTicks(xd);
  return (
    <Frame label={label}>
      <rect className="dc-window" x={x(w0)} y={PLOT.t - 6} width={x(w1) - x(w0)} height={PLOT.b - PLOT.t + 6} />
      <text className="dc-lab dc-quiet" x={(x(w0) + x(w1)) / 2} y={PLOT.t - 10} textAnchor="middle">
        {titleCase(`${WINDOW[0]}–${WINDOW[1]}`)}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          {t !== refAt && <line className="dc-grid" x1={PLOT.l} x2={PLOT.r} y1={y(t)} y2={y(t)} />}
          <text className="dc-lab dc-tick" x={PLOT.l - 6} y={y(t) + 3.5} textAnchor="end">
            {titleCase(tickFmt(t))}
          </text>
        </g>
      ))}
      {xt.map(([at, text]) => (
        <g key={text}>
          <line className="dc-grid" x1={x(at)} x2={x(at)} y1={PLOT.t} y2={PLOT.b} />
          <text className="dc-lab dc-tick" x={x(at)} y={PLOT.b + 14} textAnchor="middle">
            {titleCase(text)}
          </text>
        </g>
      ))}
      <line className="dc-axis" x1={PLOT.l} x2={PLOT.r} y1={PLOT.b} y2={PLOT.b} />
      {under}
      {/* the benchmark: the one line everything else is read against */}
      <line className="dc-zero" x1={PLOT.l} x2={PLOT.r} y1={y(refAt)} y2={y(refAt)} />
      <text className="dc-lab dc-quiet dc-halo" x={refX} y={y(refAt) - 5} textAnchor={refAnchor}>
        {titleCase(refLabel)}
      </text>
      {refBelow && (
        <text className="dc-lab dc-quiet dc-halo" x={refX} y={y(refAt) + 13} textAnchor={refAnchor}>
          {titleCase(refBelow)}
        </text>
      )}
      {series.map((s) => (
        <polyline
          key={s.name}
          points={pts(s)}
          fill="none"
          stroke={s.color}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {ends.map((e) => (
        <g key={e.s.name}>
          <circle cx={e.x} cy={e.y} r={4} fill={e.s.color} stroke="#fff" strokeWidth={1.5} />
          <text className="dc-lab dc-name dc-halo" x={e.x + 9} y={e.ly + 1}>
            {titleCase(e.s.name)}
          </text>
          <text className="dc-lab dc-tick dc-halo" x={e.x + 9} y={e.ly + 13}>
            {titleCase(valueFmt(e.v))}
          </text>
        </g>
      ))}
      {/* a column per year to hover: both series' values, by name */}
      {hoverYears.map((yr) => (
        <rect key={yr} x={x(yr) - step / 2} y={PLOT.t} width={step} height={PLOT.b - PLOT.t} fill="transparent">
          <title>{hoverText(yr)}</title>
        </rect>
      ))}
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {titleCase(note)}
      </text>
    </Frame>
  );
}

/** "2019 · Boston 128.5 · its MSA 75.9", for whichever of the two has a value */
const yearLine =
  (d: AmenityData, place: (number | null)[], metro: (number | null)[], fmt: (v: number) => string, years: number[]) =>
  (yr: number) => {
    const i = years.indexOf(yr);
    const parts = [
      place[i] != null ? `${d.city} ${fmt(place[i]!)}` : null,
      metro[i] != null ? `its MSA ${fmt(metro[i]!)}` : null,
    ].filter(Boolean);
    return `${yr} · ${parts.length ? parts.join(" · ") : "no data"}`;
  };

/** the raw yearly values, faint under the smoothed lines */
function RawUnder({ d, place, metro, y }: { d: AmenityData; place: (number | null)[]; metro: (number | null)[]; y: (v: number) => number }) {
  const x = lin([d.years[0], d.years[d.years.length - 1]], [PLOT.l, PLOT.r]);
  const pts = (ys: (number | null)[]) =>
    ys.map((v, i) => (v == null ? null : `${x(d.years[i]).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
  return (
    <g opacity={0.28}>
      <polyline points={pts(metro)} fill="none" stroke={METRO} strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={pts(place)} fill="none" stroke={CITY} strokeWidth={1} strokeDasharray="3 3" />
    </g>
  );
}

function Crime({ d }: { d: AmenityData }) {
  const { place, metro, placeRaw, metroRaw } = d.crime;
  const top = Math.max(...[...place, ...metro, ...placeRaw, ...metroRaw].map((v) => v ?? 0), 100);
  const hi = Math.ceil((top * 1.06) / 50) * 50;
  const fmt = (v: number) => v.toFixed(0);
  return (
    <LinePair
      label={`Crime severity as a share of the national level, by year: ${d.city} and its MSA`}
      xd={[d.years[0], d.years[d.years.length - 1]]}
      yd={[0, hi]}
      ticks={[50, 100, 150, 200, 250].filter((t) => t <= hi)}
      tickFmt={fmt}
      valueFmt={fmt}
      series={[
        { name: "its MSA", color: METRO, xs: d.years, ys: metro },
        { name: d.city, color: CITY, xs: d.years, ys: place },
      ]}
      refAt={100}
      refLabel="national level"
      note="crime-cost index, 100 = the national level · lines are 3-year averages, the yearly values dotted behind · lower is safer"
      hoverYears={d.years}
      hoverText={yearLine(d, place, metro, fmt, d.years)}
      under={<RawUnder d={d} place={placeRaw} metro={metroRaw} y={lin([0, hi], [PLOT.b, PLOT.t])} />}
    />
  );
}

function Education({ d }: { d: AmenityData }) {
  const { place, metro, placeRaw, metroRaw } = d.edu;
  const vs = [...place, ...metro, ...placeRaw, ...metroRaw].filter((v): v is number => v != null);
  /* symmetric enough to keep the national average off the frame's edge */
  const lo = Math.floor((Math.min(...vs, 0) - 0.1) * 10) / 10;
  const hi = Math.ceil((Math.max(...vs, 0) + 0.1) * 10) / 10;
  const fmt = (v: number) => `${signed(v, 2)} SD`;
  return (
    <LinePair
      label={`School achievement against the national average, by year: ${d.city} and its MSA`}
      xd={[d.years[0], d.years[d.years.length - 1]]}
      yd={[lo, hi]}
      ticks={[-0.6, -0.3, 0, 0.3, 0.6].filter((t) => t >= lo && t <= hi)}
      tickFmt={(v) => signed(v, 1)}
      valueFmt={fmt}
      series={[
        { name: "its MSA", color: METRO, xs: d.years, ys: metro },
        { name: d.city, color: CITY, xs: d.years, ys: place },
      ]}
      refAt={0}
      refLabel="national average"
      note={`test scores, grades 3–8, in student-level SDs · 3-year averages, yearly values dotted behind · 0.3 SD ≈ ${(0.3 * d.edu.gradeFactor).toFixed(0)} grade level`}
      hoverYears={d.years}
      hoverText={yearLine(d, place, metro, fmt, d.years)}
      under={<RawUnder d={d} place={placeRaw} metro={metroRaw} y={lin([lo, hi], [PLOT.b, PLOT.t])} />}
    />
  );
}

function AirQuality({ d }: { d: AmenityData }) {
  const { y0, place, placeAnnual, metroAnnual } = d.aqi;
  const years = placeAnnual.map((_, i) => y0 + i);
  const mid = years.map((yr) => yr + 0.5);
  const xd: [number, number] = [y0, y0 + placeAnnual.length];
  const all = [...place, ...placeAnnual, ...metroAnnual].filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(...all, 50) / 10) * 10;
  const hi = Math.ceil(Math.max(...all, 50) / 10) * 10;
  const x = lin(xd, [PLOT.l, PLOT.r]);
  const y = lin([lo, hi], [PLOT.b, PLOT.t]);
  const monthly = place
    .map((v, i) => (v == null ? null : `${x(y0 + (i + 0.5) / 12).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const fmt = (v: number) => v.toFixed(0);
  const ticks = Array.from({ length: Math.floor((hi - lo) / 20) + 1 }, (_, i) => lo + i * 20).filter((t) => t !== 50);
  return (
    <LinePair
      label={`Air Quality Index, monthly and by year: ${d.city} and its MSA, against the Good / Moderate line`}
      xd={xd}
      yd={[lo, hi]}
      ticks={[...ticks, 50].sort((a, b) => a - b)}
      tickFmt={fmt}
      valueFmt={fmt}
      series={[
        { name: "its MSA", color: METRO, xs: mid, ys: metroAnnual },
        { name: d.city, color: CITY, xs: mid, ys: placeAnnual },
      ]}
      refAt={50}
      refLabel="Moderate"
      refBelow="Good"
      /* the domain runs to the END of the last year, so its ends are not the
         years to print, and the window covers whole calendar years */
      xTicks={yearTicks([y0, years[years.length - 1]]).map(([yr, t]) => [yr + 0.5, t])}
      windowX={[WINDOW[0], WINDOW[1] + 1]}
      note={`EPA AQI · ${d.city} by month (faint) and by yearly mean · ≤ 50 Good, 51–100 Moderate · lower is cleaner`}
      hoverYears={mid}
      hoverText={(m) => yearLine(d, placeAnnual, metroAnnual, fmt, years)(Math.floor(m)) + " (yearly mean)"}
      under={<polyline points={monthly} fill="none" stroke={CITY} strokeWidth={0.9} opacity={0.22} strokeLinejoin="round" />}
    />
  );
}

/* ---------- transportation: jobs within reach ---------- */

function JobAccess({ d }: { d: AmenityData }) {
  const J = d.jobs;
  const max = Math.max(...J.reach, ...J.medianMetro, ...J.medianNation);
  const x = lin([0, max * 1.04], [118, 476]);
  const row = (i: number) => 58 + i * 64;
  const ticks = [1e6, 2e6, 3e6, 4e6].filter((t) => t <= max * 1.04);
  return (
    <Frame label={`Jobs reachable by car from ${d.city} within 15, 30 and 60 minutes, against the median place in its MSA and nationally`}>
      <text className="dc-lab dc-quiet" x={20} y={22}>
        {titleCase(`jobs within a drive, leaving 08:00 on a weekday · ${J.dataYear} jobs`)}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line className="dc-grid" x1={x(t)} x2={x(t)} y1={44} y2={244} />
          <text className="dc-lab dc-tick" x={x(t)} y={256} textAnchor="middle">
            {titleCase(`${t / 1e6}M jobs`)}
          </text>
        </g>
      ))}
      {J.minutes.map((m, i) => (
        <g key={m}>
          <text className="dc-lab dc-name" x={20} y={row(i) + 14}>
            {titleCase(`${m} min`)}
          </text>
          <rect x={118} y={row(i)} width={Math.max(2, x(J.reach[i]) - 118)} height={20} rx={3} fill={CITY}>
            <title>{`${J.reach[i].toLocaleString()} jobs within ${m} minutes of ${d.city}`}</title>
          </rect>
          {/* the two medians, as ticks across the bar: what a typical place reaches */}
          {/* (the national one stands taller: at 15 and 30 minutes the two
              medians all but coincide, and it would vanish behind the other) */}
          <line x1={x(J.medianNation[i])} x2={x(J.medianNation[i])} y1={row(i) - 10} y2={row(i) + 30} stroke="var(--ink)" strokeWidth={1.6} strokeDasharray="3 2">
            <title>{`median place nationally: ${J.medianNation[i].toLocaleString()} jobs within ${m} minutes`}</title>
          </line>
          <line x1={x(J.medianMetro[i])} x2={x(J.medianMetro[i])} y1={row(i) - 5} y2={row(i) + 25} stroke={METRO} strokeWidth={2.4}>
            <title>{`median place in the MSA: ${J.medianMetro[i].toLocaleString()} jobs within ${m} minutes`}</title>
          </line>
          <text className="dc-lab dc-name dc-halo" x={Math.max(x(J.reach[i]), x(J.medianMetro[i]), x(J.medianNation[i])) + 8} y={row(i) + 14}>
            {titleCase(big(J.reach[i]))}
          </text>
          <text className="dc-lab dc-tick" x={118} y={row(i) + 40}>
            {titleCase(`${ordinal(J.rankMetro[i])} of ${J.nMetro[i]} places in its MSA · ${ordinal(J.rankNation[i])} of ${J.nNation[i].toLocaleString()} nationally · medians ${big(J.medianMetro[i])} and ${big(J.medianNation[i])}`)}
          </text>
        </g>
      ))}
      {/* the two ticks, named */}
      <line x1={22} x2={22} y1={H - 22} y2={H - 6} stroke={METRO} strokeWidth={2.4} />
      <text className="dc-lab dc-quiet" x={29} y={H - 9}>
        Median Place in Its MSA
      </text>
      <line x1={190} x2={190} y1={H - 24} y2={H - 4} stroke="var(--ink)" strokeWidth={1.6} strokeDasharray="3 2" />
      <text className="dc-lab dc-quiet" x={197} y={H - 9}>
        Median Place Nationally
      </text>
    </Frame>
  );
}

/* ---------- quality of life: establishments per resident ---------- */

function Vitality({ d }: { d: AmenityData }) {
  const V = d.vitality;
  const top = Math.max(2, Math.ceil(Math.max(...V.types.map((t) => t.ratio))));
  const x = lin([0, top], [172, 484]);
  const row = (i: number) => 62 + i * 64;
  const ticks = Array.from({ length: top * 2 + 1 }, (_, i) => i / 2);
  return (
    <Frame label={`Establishments per 1,000 residents in ${d.city}, as a multiple of the national rate`}>
      <text className="dc-lab dc-quiet" x={20} y={22}>
        {titleCase(`operating establishments per resident, as a multiple of the national rate · ${V.asOf}`)}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          {t !== 1 && t % 1 === 0 && <line className="dc-grid" x1={x(t)} x2={x(t)} y1={44} y2={248} />}
          {t % 1 === 0 && (
            <text className="dc-lab dc-tick" x={x(t)} y={260} textAnchor="middle">
              {titleCase(t === 0 ? "0" : `${t}×`)}
            </text>
          )}
        </g>
      ))}
      {V.types.map((t, i) => (
        <g key={t.key}>
          <text className="dc-lab dc-name" x={20} y={row(i) + 14}>
            {titleCase(t.label)}
          </text>
          <rect x={x(0)} y={row(i)} width={Math.max(2, x(t.ratio) - x(0))} height={20} rx={3} fill={CITY}>
            <title>{`${t.full}: ${t.count.toLocaleString()} in ${d.city} = ${t.rate} per 1,000 residents · national rate ${t.national}`}</title>
          </rect>
          <text className="dc-lab dc-name dc-halo" x={x(t.ratio) + 8} y={row(i) + 14}>
            {titleCase(`${t.ratio.toFixed(2)}×`)}
          </text>
          <text className="dc-lab dc-tick" x={x(0)} y={row(i) + 38}>
            {titleCase(`${t.count.toLocaleString()} establishments · ${t.rate} per 1,000 residents · national ${t.national}`)}
          </text>
          {/* the benchmark, as a stroke across each bar's band — one line down the
              whole plot ran through the figures written under the bars */}
          <line className="dc-zero" x1={x(1)} x2={x(1)} y1={row(i) - 8} y2={row(i) + 28} />
        </g>
      ))}
      <text className="dc-lab dc-quiet dc-halo" x={x(1) + 4} y={50}>
        National Rate
      </text>
      <text className="dc-lab dc-quiet" x={20} y={H - 8}>
        {titleCase(`the national rate pools all ${V.counted.toLocaleString()} counted places · Google Places counts inside the city boundary`)}
      </text>
    </Frame>
  );
}

/** the span a card's tag names — each measure's own, not the walk's window.
 *  Years only: see chartSource in driverCharts. */
export const amenitySource = (kind: AmenityKind, city: string): string | null => {
  const d = amenityData(city);
  if (!d) return null;
  const span = (xs: (number | null)[]) => {
    const first = xs.findIndex((v) => v != null);
    const last = lastOf(xs);
    return first < 0 || !last ? "" : `${d.years[first]}–${d.years[last[0]]}`;
  };
  const when =
    kind === "crime"
      ? span(d.crime.place)
      : kind === "education"
        ? span(d.edu.place)
        : kind === "airQuality"
          ? `${d.aqi.y0}–${d.aqi.y0 + d.aqi.placeAnnual.length - 1}`
          : kind === "jobAccess"
            ? `${d.jobs.dataYear}`
            : d.vitality.asOf;
  return when;
};

/** how each indicator reads for the city, from the chart's own numbers */
export const amenityVerdict = (kind: AmenityKind, city: string): Verdict | null => {
  const d = amenityData(city);
  if (!d) return null;
  switch (kind) {
    case "education": {
      const p = lastOf(d.edu.place);
      const m = lastOf(d.edu.metro);
      if (!p) return null;
      const up = p[1] >= 0;
      return {
        tone: up ? "up" : "down",
        head: up ? "Above the national average" : "Below the national average",
        body: `${signed(p[1], 2)} SD in ${d.years[p[0]]}, about ${Math.abs(p[1] * d.edu.gradeFactor).toFixed(1)} grade levels ${up ? "ahead" : "behind"}${m ? `; its MSA ${signed(m[1], 2)} SD` : ""}`,
      };
    }
    case "crime": {
      const p = lastOf(d.crime.place);
      const m = lastOf(d.crime.metro);
      if (!p) return null;
      const up = p[1] <= 100;
      return {
        tone: up ? "up" : "down",
        head: up ? "Below the national level" : "Above the national level",
        body: `${p[1].toFixed(0)}% of the national crime cost per resident in ${d.years[p[0]]}${m ? `; its MSA ${m[1].toFixed(0)}%` : ""}`,
      };
    }
    case "airQuality": {
      const p = lastOf(d.aqi.placeAnnual);
      const m = lastOf(d.aqi.metroAnnual);
      if (!p) return null;
      const up = p[1] <= 50;
      return {
        tone: up ? "up" : "down",
        head: up ? "Good on average" : "Moderate on average",
        body: `AQI ${p[1].toFixed(0)} across ${d.aqi.y0 + p[0]}, ${up ? "under" : "over"} the Good / Moderate line at 50${m ? `; its MSA ${m[1].toFixed(0)}` : ""}`,
      };
    }
    case "jobAccess": {
      const J = d.jobs;
      const i = 1; // the 30-minute reach
      const q = J.rankMetro[i] / J.nMetro[i];
      const tone = q <= 0.25 ? "up" : q >= 0.75 ? "down" : "flat";
      return {
        tone,
        head: tone === "up" ? "High job access" : tone === "down" ? "Low job access" : "Middling job access",
        body: `${big(J.reach[i])} jobs within ${J.minutes[i]} minutes by car, ${ordinal(J.rankMetro[i])} of ${J.nMetro[i]} places in its MSA and ${ordinal(J.rankNation[i])} of ${J.nNation[i].toLocaleString()} nationally`,
      };
    }
    case "vitality": {
      const V = d.vitality;
      const mean = V.types.reduce((s, t) => s + t.ratio, 0) / V.types.length;
      const tone = mean >= 1.1 ? "up" : mean <= 0.9 ? "down" : "flat";
      return {
        tone,
        head: tone === "up" ? "Above the national rate" : tone === "down" ? "Below the national rate" : "Near the national rate",
        body: `${V.types.map((t) => `${t.label.toLowerCase()} ${t.ratio.toFixed(2)}×`).join(", ")} the national rate per resident`,
      };
    }
  }
};

/** one of the Amenities Module's indicators. A city the module has not been
 *  pulled for draws an empty well naming what is missing — there is no
 *  schematic of these: a made-up crime series is not a drawing of a chart
 *  form, it is a wrong number. */
export function AmenityChart({ kind, city }: { kind: AmenityKind; city: string }) {
  const d = amenityData(city);
  if (!d)
    return (
      <Frame label={missingDataLabel("Amenities Module", city)}>
        <text className="dc-lab dc-ph" x={W / 2} y={H / 2} textAnchor="middle">
          {`[${missingDataLabel("Amenities Module", city)}]`}
        </text>
      </Frame>
    );
  switch (kind) {
    case "education":
      return <Education d={d} />;
    case "crime":
      return <Crime d={d} />;
    case "jobAccess":
      return <JobAccess d={d} />;
    case "airQuality":
      return <AirQuality d={d} />;
    case "vitality":
      return <Vitality d={d} />;
  }
}
