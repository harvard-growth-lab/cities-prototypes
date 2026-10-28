import { useRef } from "react";
import { fmt, type Commuters } from "./study";
import { Key, Replay, SetLabel, useBox, useChoreo, useSeen } from "./shared";

/* ====================================================================
   opt-5 · Two bars, one overlap
   opt-2 flattened. The people working in Boston are one bar, the people
   living there another on the row below, and the two rows are offset so
   that the shared 190K stand in one column: the grey of the top bar
   directly over the grey of the bottom. Where opt-2 overlaps two
   rectangles, this lines up two bars — the same Venn, read like a chart,
   with each part's share of its set printed in its segment. The bottom
   row slides in from the right until the greys meet.
   ==================================================================== */

export function Bars({ d }: { d: Commuters }) {
  const root = useRef<HTMLDivElement>(null);
  const [fig, box] = useBox<HTMLDivElement>();
  const seen = useSeen(root);
  const { stage, jump, replay } = useChoreo(seen);

  const { w, h } = box;
  const wide = w >= 560;
  const barH = wide ? 54 : 34, rowGap = wide ? 18 : 12;
  const push = wide ? 48 : 28;
  const total = d.in + d.both + d.out;
  const unit = (w - 8 - push) / total;
  const inW = d.in * unit, bothW = d.both * unit, outW = d.out * unit;
  const apart = stage === "apart";
  /* the top row sits left; the bottom row starts out pushed right, then
     its grey comes under the top row's; together, both centre in the room
     the push left */
  const x0 = apart ? 4 : 4 + push / 2;
  const x1 = apart ? 4 + inW + push : x0 + inW;
  const labelH = wide ? 40 : 34;
  const y0 = Math.max(labelH, (h - (2 * barH + rowGap)) / 2);
  const y1 = y0 + barH + rowGap;
  const pct = (a: number, b: number) => Math.round((a / b) * 100) + "%";

  const seg = (k: string, x: number, width: number, count: string, share: string) => (
    <g className={`cv-br cv-br--${k}`} transform={`translate(${x} 0)`}>
      <rect width={width} height={barH} />
      {width > 64 && (
        <text x={10} y={barH / 2 + 5} className="cv-t cv-br-t">
          <tspan className="cv-t--n">{count}</tspan>
          {width > 120 && <tspan dx="7" className="cv-br-s">{share}</tspan>}
        </text>
      )}
    </g>
  );

  return (
    <div className={"cv cv-ba" + (jump ? " is-jump" : "")} ref={root} data-stage={stage}>
      <div className="cv-top">
        <span className="cv-note">Each bar is a set; the greys line up.</span>
        <Replay onClick={replay} />
      </div>
      <div className="cv-fig" ref={fig}>
        {w > 0 && h > 0 && (
          <>
            <svg
              width={w}
              height={h}
              role="img"
              aria-label={`Two bars sharing a column: ${fmt(d.jobs)} working in Boston, ${fmt(d.residents)} living there; the ${fmt(d.both)} who do both line up. ${fmt(d.in)} commute in, ${fmt(d.out)} commute out.`}
            >
              {/* the tie: one column through both greys, once they meet */}
              <rect className="cv-ba-tie" x={x0 + inW} y={y0 - 4} width={bothW} height={2 * barH + rowGap + 8} rx={3} style={{ transform: "none" }} />
              <g className="cv-slide" style={{ transform: `translate(${x0}px, ${y0}px)` }}>
                {seg("in", 0, inW, fmt(d.in), pct(d.in, d.jobs))}
                {seg("both", inW, bothW, fmt(d.both), pct(d.both, d.jobs))}
              </g>
              <g className="cv-slide" style={{ transform: `translate(${x1}px, ${y1}px)` }}>
                {seg("copy", 0, bothW, fmt(d.both), pct(d.both, d.residents))}
                {seg("out", bothW, outW, fmt(d.out), pct(d.out, d.residents))}
              </g>
            </svg>
            <div className="cv-labs">
              <SetLabel which="work" x={x0} y={y0 - labelH} align="l" count={fmt(d.jobs)} unit="jobs" short={!wide} />
              <SetLabel which="live" x={x1 + bothW + outW} y={y1 + barH + 8} align="r" count={fmt(d.residents)} unit={wide ? "working residents" : "residents"} short={!wide} />
            </div>
          </>
        )}
      </div>
      <Key d={d} />
    </div>
  );
}
