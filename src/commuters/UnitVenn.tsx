import { useRef, useState } from "react";
import { type Commuters } from "./study";
import { Frame, Key, PartsUnder, Seg, SetLabel, useBox, useChoreo, useSeen } from "./shared";

/* ====================================================================
   opt-7 · Per 100
   opt-2 in units. One square is one of every hundred people in a set: for
   every 100 at work in Boston, 74 commute in and 26 live there, and the
   live rectangle hangs off those 26 with 22 more who commute out — so the
   two rectangles are 100 and 48 squares, and the counts are the shares.
   The switch makes the residents the hundred instead: 55 live and work
   there, 45 commute out, and the work rectangle grows to 207 squares,
   which is main's own figure of 207 jobs in Boston for every 100 its
   residents hold. Squares, not dots, so a unit is never mistaken for
   opt-2's 2K people.
   ==================================================================== */

type Base = "jobs" | "residents";

/** whole units that add up to 100 across a set: largest remainder */
function per100(a: number, b: number): [number, number] {
  const x = (a / (a + b)) * 100, fa = Math.floor(x), fb = Math.floor(100 - x);
  return fa + fb === 100 ? [fa, fb] : x - fa >= 100 - x - fb ? [fa + 1, fb] : [fa, fb + 1];
}

export function UnitVenn({ d }: { d: Commuters }) {
  const root = useRef<HTMLDivElement>(null);
  const [fig, box] = useBox<HTMLDivElement>();
  const seen = useSeen(root);
  const { stage, jump } = useChoreo(seen);
  const [base, setBase] = useState<Base>("jobs");

  /* the units: the base set is exactly 100; the other part takes the same scale */
  const u =
    base === "jobs"
      ? (() => { const [i, b] = per100(d.in, d.both); return { in: i, both: b, out: Math.round((d.out / d.jobs) * 100) }; })()
      : (() => { const [b, o] = per100(d.both, d.out); return { in: Math.round((d.in / d.residents) * 100), both: b, out: o }; })();
  const { w, h } = box;
  const wide = w >= 560;
  const top = wide ? 46 : 38, under = wide ? 104 : 74;
  const gapC = 1.6;
  /* the row count that gives the largest squares in the room, the two
     rectangles standing apart; the wider layout on a tie */
  const fit = Array.from({ length: 9 }, (_, i) => {
    const R = i + 4, cIn = Math.ceil(u.in / R), cB = Math.ceil(u.both / R), cOut = Math.ceil(u.out / R);
    return { R, cIn, cB, cOut, p: Math.max(0, Math.min((w - 8) / (cIn + 2 * cB + cOut + gapC), (h - top - under) / R, wide ? 34 : 24)) };
  }).reduce((a, b) => (b.p > a.p + 0.01 ? b : a));
  const { R, cIn, cB, cOut, p } = fit;
  const gh = R * p;
  const by = top + Math.max(0, (h - top - under - gh) / 2);
  const inW = cIn * p, bothW = cB * p, outW = cOut * p, gap = gapC * p;
  const slack = bothW + gap;
  const apart = stage === "apart";
  const x0 = 4 + Math.max(0, (w - 8 - (cIn + 2 * cB + cOut + gapC) * p) / 2);
  const workX = apart ? x0 : x0 + slack / 2;
  const liveX = apart ? x0 + inW + bothW + gap : workX + inW;

  /* each part fills column by column from its seam with the shared block,
     bottom row first, as opt-2's do — a short column is an outer one */
  const cells = (n: number, cols: number, dir: 1 | -1) =>
    Array.from({ length: n }, (_, j) => {
      const ci = Math.floor(j / R), c = dir > 0 ? ci : cols - 1 - ci;
      return [c * p, (R - 1 - (j % R)) * p] as [number, number];
    });
  const sq = (pts: [number, number][], cls: string, x: number) => (
    <g className={cls} transform={`translate(${x} ${by})`}>
      {pts.map(([cx, cy], i) => (
        <rect key={i} x={cx + p * 0.11} y={cy + p * 0.11} width={p * 0.78} height={p * 0.78} rx={p * 0.12} />
      ))}
    </g>
  );
  const at = { in: [workX, workX + inW], both: [workX + inW, workX + inW + bothW], out: [liveX + bothW, liveX + bothW + outW] } as const;
  const counts = { in: String(u.in), both: String(u.both), out: String(u.out) };
  const setN = base === "jobs" ? { work: "100", live: String(u.both + u.out) } : { work: String(u.in + u.both), live: "100" };

  return (
    <div className={"cv cv-uv" + (jump ? " is-jump" : "")} ref={root} data-stage={stage}>
      <div className="cv-top">
        <span className="cv-note">One square is one in a hundred of the</span>
        <Seg
          label="Which set is the hundred"
          value={base}
          onPick={setBase}
          options={[
            { id: "jobs", label: wide ? "people working in Boston" : "people working" },
            { id: "residents", label: wide ? "people living in Boston" : "people living" },
          ]}
        />
      </div>
      <div className="cv-fig" ref={fig}>
        {p > 0 && (
          <>
            <svg
              width={w}
              height={h}
              role="img"
              aria-label={`Of every 100 ${base === "jobs" ? "people working in Boston" : "people living in Boston"}: ${u.in} commute in, ${u.both} live and work there, ${u.out} commute out.`}
            >
              <g className="cv-slide" style={{ transform: `translate(${liveX}px, 0)` }}>
                <Frame which="live" x={0} y={by} w={bothW + outW} h={gh} />
                {sq(cells(u.both, cB, 1), "cv-uv-c cv-uv-c--copy", 0)}
                {sq(cells(u.out, cOut, 1), "cv-uv-c cv-uv-c--out", bothW)}
              </g>
              <g className="cv-slide" style={{ transform: `translate(${workX}px, 0)` }}>
                <Frame which="work" x={0} y={by} w={inW + bothW} h={gh} />
                {sq(cells(u.in, cIn, -1), "cv-uv-c cv-uv-c--in", 0)}
                {sq(cells(u.both, cB, 1), "cv-uv-c cv-uv-c--both", inW)}
              </g>
            </svg>
            <div className="cv-labs">
              <SetLabel which="work" x={workX} y={by - (wide ? 44 : 36)} align="l" count={setN.work} unit={base === "jobs" ? (wide ? "of every 100 working" : "of 100 working") : wide ? "for every 100 living there" : "per 100 living"} short={!wide} />
              <SetLabel which="live" x={liveX + bothW + outW} y={by - (wide ? 44 : 36)} align="r" count={setN.live} unit={base === "residents" ? (wide ? "of every 100 living" : "of 100 living") : wide ? "for every 100 working there" : "per 100 working"} short={!wide} />
              <PartsUnder d={d} y={by + gh} at={{ in: [...at.in], both: [...at.both], out: [...at.out] }} wide={wide} counts={counts} />
            </div>
          </>
        )}
      </div>
      {!wide && <Key d={d} />}
    </div>
  );
}
