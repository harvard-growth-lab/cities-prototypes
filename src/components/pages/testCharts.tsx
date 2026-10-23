import {
  METROS,
  METRO_MEDIANS,
  METRO_SPAN,
  PRICE_SPAN,
  USA,
  countryMedians,
  homeMsa,
  homePlace,
  metroUnit,
  type MetroDatum,
} from "../../data/metros";
import {
  QUAD_NAME,
  TREE_SIDE_COLOR,
  quadSideOf,
  supplyRead,
  type QuadSide,
} from "../../data/figures";
import { missingDataLabel } from "../../data/placeholderCities";
import type { TestId } from "../../data/diagTests";
import { DriverChart } from "./driverCharts";

/* ---------- the tests' instruments (Oct 2026, the open-ended study) ----------
   One chart per test, drawn on the analysis cards' own 560 × 320 frame and
   in their palette — the city teal, its MSA a grey ring, every other metro
   the pale field — so a test card and a module card read as one family.
   Two of the five are the analysis's own charts: the local share is the
   shift-share waterfall, and complexity is a placeholder in the form its
   signal calls for. */

const W = 560;
const H = 320;
const FIELD = "#c8cdd0";
const CITY = "#255862";
const METRO = "#8a9498";

const pct = (v: number) =>
  `${Math.abs(v) < 0.05 ? "" : v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg className="dc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

function Missing({ city }: { city: string }) {
  const label = missingDataLabel("test", city);
  return (
    <Frame label={label}>
      <text className="dc-lab dc-ph" x={W / 2} y={H / 2} textAnchor="middle">
        {`[${label}]`}
      </text>
    </Frame>
  );
}

/* ---------- population vs wages: the quadrant test ----------
   The walk's plane, small: every US metro in the field, the median
   crosshair, the four city types in their corners, the city and its MSA. */

/** where each city type sits on the plane */
const CORNER: Record<QuadSide, { x: 1 | -1; y: 1 | -1 }> = {
  demandpos: { x: 1, y: 1 },
  supplyneg: { x: -1, y: 1 },
  demandneg: { x: -1, y: -1 },
  supplypos: { x: 1, y: -1 },
};

function QuadrantChart({ city }: { city: string }) {
  const place = homePlace(city);
  const msa = homeMsa(city);
  if (!place) return <Missing city={city} />;
  const side = quadSideOf(city);
  const L = 58, R = 536, T = 14, B = 266;
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;
  const hw = (R - L) / 2;
  const hh = (B - T) / 2;
  const at = (m: MetroDatum) => {
    const [u, v] = metroUnit(m);
    return [cx + u * hw, cy - v * hh] as const;
  };
  const [px, py] = at(place);
  const mp = msa ? at(msa) : null;
  /* the two names go on the sides away from each other */
  const cityLeft = mp ? px <= mp[0] : false;
  return (
    <Frame label={`${city} on the population vs wages chart`}>
      {(Object.keys(CORNER) as QuadSide[]).map((q) => {
        const c = CORNER[q];
        const mine = q === side;
        return (
          <g key={q}>
            <rect
              x={c.x > 0 ? cx : L}
              y={c.y > 0 ? T : cy}
              width={hw}
              height={hh}
              fill={TREE_SIDE_COLOR[q]}
              opacity={mine ? 0.1 : 0.035}
            />
            <text
              className={"dc-lab" + (mine ? " dc-name" : "")}
              x={c.x > 0 ? R - 10 : L + 10}
              y={c.y > 0 ? T + 20 : B - 12}
              textAnchor={c.x > 0 ? "end" : "start"}
              style={mine ? { fill: TREE_SIDE_COLOR[q] } : undefined}
            >
              {QUAD_NAME[q]}
            </text>
          </g>
        );
      })}
      <rect x={L} y={T} width={R - L} height={B - T} fill="none" className="dc-axis" />
      {METROS.map((m) => {
        const [x, y] = at(m);
        return <circle key={m.name + m.size} cx={x} cy={y} r={2.3} fill={FIELD} />;
      })}
      <line className="dc-zero" x1={cx} x2={cx} y1={T} y2={B} />
      <line className="dc-zero" x1={L} x2={R} y1={cy} y2={cy} />
      <text className="dc-lab dc-tick" x={cx} y={B + 15} textAnchor="middle">
        median {pct(METRO_MEDIANS.pop)}
      </text>
      <text className="dc-lab dc-tick" x={L - 6} y={cy + 3} textAnchor="end">
        {pct(METRO_MEDIANS.wage)}
      </text>
      <text className="dc-lab" x={cx} y={B + 40} textAnchor="middle">
        Population Growth, %/yr
      </text>
      <text
        className="dc-lab"
        transform={`translate(${L - 40} ${cy}) rotate(-90)`}
        textAnchor="middle"
      >
        Wage Growth, %/yr
      </text>
      {mp && (
        <g>
          <circle cx={mp[0]} cy={mp[1]} r={6.5} fill="#fff" stroke={METRO} strokeWidth={2.2}>
            <title>{`${city} MSA · population ${pct(msa!.pop)}/yr, wages ${pct(msa!.wage)}/yr`}</title>
          </circle>
          <text
            className="dc-lab dc-halo"
            x={mp[0] + (cityLeft ? 11 : -11)}
            y={mp[1] + 4}
            textAnchor={cityLeft ? "start" : "end"}
          >
            {city} MSA
          </text>
        </g>
      )}
      <circle cx={px} cy={py} r={7.5} fill={CITY} stroke="#fff" strokeWidth={2}>
        <title>{`${city} · population ${pct(place.pop)}/yr, wages ${pct(place.wage)}/yr`}</title>
      </circle>
      <text
        className="dc-lab dc-name dc-halo"
        x={px + (cityLeft ? -12 : 12)}
        y={py + 4}
        textAnchor={cityLeft ? "end" : "start"}
      >
        {city}
      </text>
    </Frame>
  );
}

/* ---------- one measure among all metros ----------
   The demand fork and the supply fork, each as the distribution the
   comparison is made in: every US metro binned, the median metro dashed,
   the city (or its MSA) marked where it falls. */

function Distribution({
  values,
  median,
  span,
  subject,
  axis,
}: {
  values: number[];
  median: number;
  /** how far either side of the median the axis reaches, %/yr */
  span: number;
  subject: { value: number; label: string; metro: boolean };
  axis: string;
}) {
  const L = 34, R = 530, T = 52, B = 254;
  const BINS = 26;
  const lo = median - span;
  const hi = median + span;
  const bw = (R - L) / BINS;
  const binOf = (v: number) =>
    Math.max(0, Math.min(BINS - 1, Math.floor(((v - lo) / (hi - lo)) * BINS)));
  const counts = new Array(BINS).fill(0);
  values.forEach((v) => counts[binOf(v)]++);
  const max = Math.max(...counts);
  const x = (v: number) => L + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (R - L);
  const mine = binOf(subject.value);
  const sx = x(subject.value);
  const mx = x(median);
  const color = subject.metro ? METRO : CITY;
  /* the two labels go on the sides away from each other */
  const subjectLeft = subject.value < median;
  const step = span > 2.5 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(t);
  return (
    <Frame label={`${subject.label} among ${values.length} US metros`}>
      <text className="dc-lab dc-quiet" x={L} y={16}>
        {values.length} US metros
      </text>
      <line className="dc-axis" x1={L} x2={R} y1={B} y2={B} />
      {counts.map((c, i) => {
        const h = (c / max) * (B - T);
        return (
          <rect
            key={i}
            x={L + i * bw + 1}
            y={B - h}
            width={bw - 2}
            height={h}
            rx={1.5}
            fill={i === mine ? color : FIELD}
          >
            {/* the end bins hold the tails */}
            <title>
              {i === 0
                ? `${c} metros at ${pct(lo + (hi - lo) / BINS)}/yr or less`
                : i === BINS - 1
                  ? `${c} metros at ${pct(hi - (hi - lo) / BINS)}/yr or more`
                  : `${c} metros at ${pct(lo + i * ((hi - lo) / BINS))} to ${pct(lo + (i + 1) * ((hi - lo) / BINS))}/yr`}
            </title>
          </rect>
        );
      })}
      {ticks.map((t) => (
        <text key={t} className="dc-lab dc-tick" x={x(t)} y={B + 16} textAnchor="middle">
          {pct(t)}
        </text>
      ))}
      <text className="dc-lab" x={(L + R) / 2} y={B + 42} textAnchor="middle">
        {axis}
      </text>
      <line className="dc-zero" x1={mx} x2={mx} y1={T - 26} y2={B} />
      <text
        className="dc-lab dc-halo"
        x={mx + (subjectLeft ? 6 : -6)}
        y={T - 16}
        textAnchor={subjectLeft ? "start" : "end"}
      >
        Median metro {pct(median)}
      </text>
      <line x1={sx} x2={sx} y1={T - 8} y2={B} stroke={color} strokeWidth={2} />
      <circle cx={sx} cy={T - 8} r={5.5} fill={subject.metro ? "#fff" : color} stroke={color} strokeWidth={2}>
        <title>{`${subject.label} ${pct(subject.value)}/yr`}</title>
      </circle>
      <text
        className="dc-lab dc-name dc-halo"
        x={sx + (subjectLeft ? -10 : 10)}
        y={T - 4}
        textAnchor={subjectLeft ? "end" : "start"}
      >
        {subject.label} {pct(subject.value)}
      </text>
    </Frame>
  );
}

function MetroGrowthChart({ city }: { city: string }) {
  const msa = homeMsa(city);
  if (!msa) return <Missing city={city} />;
  return (
    <Distribution
      values={METROS.map((m) => m.pop)}
      median={countryMedians(USA).pop}
      span={METRO_SPAN.pop}
      subject={{ value: msa.pop, label: `${city} MSA`, metro: true }}
      axis="MSA Population Growth, %/yr"
    />
  );
}

function HomeValuesChart({ city }: { city: string }) {
  const sr = supplyRead(city);
  if (!sr) return <Missing city={city} />;
  return (
    <Distribution
      values={METROS.flatMap((m) => (m.home == null ? [] : [m.home]))}
      median={sr.costMedian}
      span={PRICE_SPAN.home}
      subject={{
        value: sr.costCagr,
        label: sr.grain === "place" ? city : `${city} MSA`,
        metro: sr.grain === "metro",
      }}
      axis="Home Value Growth, %/yr"
    />
  );
}

/** the instrument a test is read on */
export function TestChart({ id, city }: { id: TestId; city: string }) {
  switch (id) {
    case "quadrant":
      return <QuadrantChart city={city} />;
    case "metroGrowth":
      return <MetroGrowthChart city={city} />;
    case "homeValues":
      return <HomeValuesChart city={city} />;
    case "localShare":
      return <DriverChart kind="waterfall" city={city} />;
    case "complexity":
      return (
        <DriverChart
          kind="placeholder"
          city={city}
          placeholder={{ form: "scatter", x: "population (log)", y: "ECI", slope: 1 }}
        />
      );
  }
}
