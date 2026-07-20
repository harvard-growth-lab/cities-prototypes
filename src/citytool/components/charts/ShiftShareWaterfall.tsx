import { useMemo } from 'react';
import type { ShiftShareResult } from '../../lib/shiftShare';
import { fmtInt } from '../../lib/format';
import { GL } from '../../lib/glColors';

// Waterfall of the four effects that bridge start-year MSA employment to
// end-year MSA employment:
//
//   Start  →  +National  →  +Industry-mix  →  +Local share  →  +New industries  →  End
//
// Each intermediate bar is a "floating" segment positioned at the running
// total. Positive effects float up (teal), negative effects float down
// (orange). Start and End are anchored to zero (teal solid base).

type Props = {
  result: ShiftShareResult;
  msaName: string;
};

// Anchor bars are a neutral dark grey to distinguish "totals" from the
// signed deltas in between. Positive deltas use the same forest green as
// the effect treemap; negative deltas use the GL highlight red. The
// complexity teal/orange palette is intentionally avoided here so the
// red/green = good/bad convention reads consistently across the page.
const COLOR = {
  base:     GL.ink2,      // anchor bars (start/end), neutral dark ink
  positive: GL.c3Dark,    // positive intermediate effects (c-3, matches effect treemap green)
  negative: GL.c2,        // negative intermediate effects (c-2, matches effect treemap red)
  connector: GL.muted,
  axis:     GL.ink3,
  text:     GL.ink,
  muted:    GL.ink3,
};

type Step = {
  key: string;
  label: string;
  /** Numeric delta. For anchor bars (start/end) this equals the bar's height. */
  value: number;
  /** Bar bottom (in employment units). For anchor bars this is 0. */
  base: number;
  /** Bar top (in employment units). */
  top: number;
  /** Whether this is an anchor bar (vs a floating intermediate). */
  anchor: boolean;
  /** Running total in employment units immediately AFTER this step. The
   *  horizontal connector to the next bar sits at this y-level — top for a
   *  positive intermediate, bottom for a negative one, top for anchors. */
  runningAfter: number;
};

export default function ShiftShareWaterfall({ result, msaName }: Props) {
  const steps = useMemo<Step[]>(() => {
    const { startEmployment, endEmployment, nsTotal, imTotal, lsTotal, newIndustriesTotal } =
      result.totals;
    const out: Step[] = [];
    let running = startEmployment;
    out.push({
      key: 'start', label: `Start (${result.t0})`,
      value: startEmployment, base: 0, top: startEmployment, anchor: true,
      runningAfter: startEmployment,
    });
    const addStep = (key: string, label: string, delta: number) => {
      const base = delta >= 0 ? running : running + delta;
      const top  = delta >= 0 ? running + delta : running;
      running += delta;
      out.push({ key, label, value: delta, base, top, anchor: false, runningAfter: running });
    };
    addStep('ns',  'National',      nsTotal);
    addStep('im',  'Industry-mix',  imTotal);
    addStep('ls',  'Local share',   lsTotal);
    addStep('new', 'New industries',newIndustriesTotal);
    out.push({
      key: 'end', label: `End (${result.t1})`,
      value: endEmployment, base: 0, top: endEmployment, anchor: true,
      runningAfter: endEmployment,
    });
    return out;
  }, [result]);

  const chartHeight = 360;
  const margin = { top: 28, right: 20, bottom: 56, left: 78 };
  const innerH = chartHeight - margin.top - margin.bottom;
  const yMax = Math.max(...steps.map((s) => s.top));
  const yMin = Math.min(0, ...steps.map((s) => s.base));
  const yScale = (v: number) => margin.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const yTickValues = (() => {
    const ticks: number[] = [];
    const step = niceStep((yMax - yMin) / 5);
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v);
    return ticks;
  })();

  const barWidthPct = 12;     // percent of inner width per bar
  const gapPct = (100 - barWidthPct * steps.length) / (steps.length + 1);
  const stepX = (i: number) => `${gapPct + i * (barWidthPct + gapPct) + barWidthPct / 2}%`;
  const barX  = (i: number) => `${gapPct + i * (barWidthPct + gapPct)}%`;

  return (
    <div className="shift-share-waterfall">
      <svg
        viewBox={`0 0 1000 ${chartHeight}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: chartHeight, fontFamily: 'inherit' }}
      >
        {/* Y-axis grid + labels */}
        {yTickValues.map((tv) => (
          <g key={tv}>
            <line
              x1={margin.left} x2={1000 - margin.right}
              y1={yScale(tv)}  y2={yScale(tv)}
              stroke={GL.rule} strokeWidth={1}
            />
            <text
              x={margin.left - 6} y={yScale(tv) + 4}
              textAnchor="end" fontSize={11} fill={COLOR.muted}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtInt.format(tv)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {steps.map((s, i) => {
          const yTop = yScale(s.top);
          const yBase = yScale(s.base);
          const h = Math.max(2, yBase - yTop);
          const fill = s.anchor ? COLOR.base : s.value >= 0 ? COLOR.positive : COLOR.negative;
          const labelY = yTop - 6;
          const xPct = barX(i);
          return (
            <g key={s.key}>
              <rect
                x={xPct}
                y={yTop}
                width={`${barWidthPct}%`}
                height={h}
                fill={fill}
                opacity={0.92}
              />
              <text
                x={stepX(i)} y={labelY}
                textAnchor="middle" fontSize={11.5} fontWeight={600}
                fill={COLOR.text}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {s.anchor ? fmtInt.format(s.value) : `${s.value >= 0 ? '+' : ''}${fmtInt.format(s.value)}`}
              </text>
              <text
                x={stepX(i)} y={chartHeight - margin.bottom + 16}
                textAnchor="middle" fontSize={11.5} fill={COLOR.text}
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* Dashed connectors. Each one is a perfectly horizontal line at the
            running-total level after the source bar. For a positive bar that's
            the bar's top; for a negative bar it's the bar's bottom (where it
            ended up after subtracting). The line lands at the same y on the
            next bar's left edge, which is exactly where that bar starts
            (base of next positive / top of next negative / anchor's top). */}
        {steps.slice(0, -1).map((s, i) => {
          const y = yScale(s.runningAfter);
          const x1 = `calc(${barX(i)} + ${barWidthPct}%)`;
          const x2 = barX(i + 1);
          return (
            <line
              key={`c-${s.key}`}
              x1={x1} x2={x2}
              y1={y} y2={y}
              stroke={COLOR.connector} strokeWidth={1} strokeDasharray="3 3"
            />
          );
        })}
      </svg>

      <p className="chart-source">
        <span className="chart-source-label">Method</span>
        Classical shift-share: starting employment plus national-trend growth,
        the industry-mix effect (how {msaName}'s base industries grew nationally
        vs. all industries), the local-share effect (how {msaName} performed
        within each industry relative to the national rate), and "new industries"
        (jobs in industries absent from {msaName} at the start year). National
        denominator is Johan Canas's QCEW summed across all counties.
      </p>
    </div>
  );
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}
