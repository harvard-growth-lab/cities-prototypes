import { useMemo, useRef } from "react";
import { fmt, type Commuters } from "./study";
import { Frame, Key, PartsUnder, Replay, SetLabel, useBox, useChoreo, useSeen } from "./shared";

/* ====================================================================
   opt-8 · Figures
   opt-2 as people. One figure stands for about 10K, so the crowd is 88
   strong: 53 who commute in, 19 who live and work in Boston, 16 who
   commute out, in the same two rectangles with the same light frames,
   sliding together the same way. The rows are chosen to fill the room
   the panel gives, so the figures are as large as they can be.
   ==================================================================== */

const PER = 10000;

export function Figures({ d }: { d: Commuters }) {
  const root = useRef<HTMLDivElement>(null);
  const [fig, box] = useBox<HTMLDivElement>();
  const seen = useSeen(root);
  const { stage, jump, replay } = useChoreo(seen);

  const { w, h } = box;
  const wide = w >= 560;
  const top = wide ? 46 : 38, under = wide ? 104 : 74;
  const n = { in: Math.round(d.in / PER), both: Math.round(d.both / PER), out: Math.round(d.out / PER) };

  /* the row count that gives the largest figures in the room, the two
     rectangles standing apart */
  const g = useMemo(() => {
    const gw = w - 8, gh = h - top - under;
    if (gw <= 0 || gh <= 0) return null;
    const GAPC = 1.4;
    let best: { R: number; cIn: number; cB: number; cOut: number; p: number } | null = null;
    for (let R = 2; R <= 10; R++) {
      const cIn = Math.ceil(n.in / R), cB = Math.ceil(n.both / R), cOut = Math.ceil(n.out / R);
      const p = Math.min(gw / (cIn + 2 * cB + cOut + GAPC), gh / R, wide ? 48 : 30);
      if (!best || p > best.p + 0.01) best = { R, cIn, cB, cOut, p };
    }
    if (!best) return null;
    const { R, cIn, cB, cOut, p } = best;
    const cols = cIn + 2 * cB + cOut + GAPC;
    return { R, cIn, cB, cOut, p, gap: GAPC * p, x0: 4 + Math.max(0, (gw - cols * p) / 2), by: top + Math.max(0, (gh - R * p) / 2) };
  }, [w, h, top, under, wide, n.in, n.both, n.out]);

  const apart = stage === "apart";
  const inW = g ? g.cIn * g.p : 0, bothW = g ? g.cB * g.p : 0, outW = g ? g.cOut * g.p : 0;
  const slack = g ? bothW + g.gap : 0;
  const workX = g ? (apart ? g.x0 : g.x0 + slack / 2) : 0;
  const liveX = g ? (apart ? g.x0 + inW + bothW + g.gap : workX + inW) : 0;
  const gh = g ? g.R * g.p : 0;

  /* each part fills column by column from its seam with the shared block,
     bottom row first, as opt-2's dots do */
  const cells = (count: number, cols: number, dir: 1 | -1) =>
    Array.from({ length: count }, (_, j) => {
      const R = g!.R, ci = Math.floor(j / R), c = dir > 0 ? ci : cols - 1 - ci;
      return [c * g!.p, (R - 1 - (j % R)) * g!.p] as [number, number];
    });
  const people = (pts: [number, number][], cls: string, x: number) => (
    <g className={cls} transform={`translate(${x} ${g!.by})`}>
      {pts.map(([cx, cy], i) => (
        <g key={i} transform={`translate(${cx} ${cy}) scale(${g!.p})`}>
          <circle cx=".5" cy=".24" r=".14" />
          <path d="M.22 .94C.22 .6.33 .46.5 .46S.78 .6.78 .94Z" />
        </g>
      ))}
    </g>
  );
  const at = { in: [workX, workX + inW], both: [workX + inW, workX + inW + bothW], out: [liveX + bothW, liveX + bothW + outW] } as const;

  return (
    <div className={"cv cv-fg" + (jump ? " is-jump" : "")} ref={root} data-stage={stage}>
      <div className="cv-top">
        <span className="cv-note">One figure is about {fmt(PER)} people.</span>
        <Replay onClick={replay} />
      </div>
      <div className="cv-fig" ref={fig}>
        {g && (
          <>
            <svg
              width={w}
              height={h}
              role="img"
              aria-label={`Two rectangles of figures, one for about ${fmt(PER)} people: ${fmt(d.jobs)} working in Boston and ${fmt(d.residents)} living there, overlapping in the ${fmt(d.both)} who do both; ${fmt(d.in)} commute in, ${fmt(d.out)} commute out.`}
            >
              <g className="cv-slide" style={{ transform: `translate(${liveX}px, 0)` }}>
                <Frame which="live" x={0} y={g.by} w={bothW + outW} h={gh} />
                {people(cells(n.both, g.cB, 1), "cv-fg-p cv-fg-p--copy", 0)}
                {people(cells(n.out, g.cOut, 1), "cv-fg-p cv-fg-p--out", bothW)}
              </g>
              <g className="cv-slide" style={{ transform: `translate(${workX}px, 0)` }}>
                <Frame which="work" x={0} y={g.by} w={inW + bothW} h={gh} />
                {people(cells(n.in, g.cIn, -1), "cv-fg-p cv-fg-p--in", 0)}
                {people(cells(n.both, g.cB, 1), "cv-fg-p cv-fg-p--both", inW)}
              </g>
            </svg>
            <div className="cv-labs">
              <SetLabel which="work" x={workX} y={g.by - (wide ? 44 : 36)} align="l" count={fmt(d.jobs)} unit="jobs" short={!wide} />
              <SetLabel which="live" x={liveX + bothW + outW} y={g.by - (wide ? 44 : 36)} align="r" count={fmt(d.residents)} unit={wide ? "working residents" : "residents"} short={!wide} />
              <PartsUnder d={d} y={g.by + gh} at={{ in: [...at.in], both: [...at.both], out: [...at.out] }} wide={wide} />
            </div>
          </>
        )}
      </div>
      {!wide && <Key d={d} />}
    </div>
  );
}
