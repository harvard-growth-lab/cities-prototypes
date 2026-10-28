import { useMemo, useRef } from "react";
import { fmt, type Commuters } from "./study";
import { PER, PartLabel, Replay, SetLabel, shares, useBox, useChoreo, useSeen, type K } from "./shared";

/* ====================================================================
   opt-6 · Stacked
   opt-2 turned upright. The same dots — one for about 2K people — in one
   column of three bands: those who commute in on top, those who live and
   work in Boston in the middle, those who commute out below. The work
   rectangle is the top two bands and the live rectangle the bottom two,
   each named by a bracket on the left; the parts are named on the right,
   beside their bands. It arrives as opt-2 does, only vertically: the two
   rectangles apart, then sliding together until the shared band is one.
   On a phone the column is the shape that fits.
   ==================================================================== */

export function Stacked({ d }: { d: Commuters }) {
  const root = useRef<HTMLDivElement>(null);
  const [fig, box] = useBox<HTMLDivElement>();
  const seen = useSeen(root);
  const { stage, jump, replay } = useChoreo(seen, 800, 1100);

  const { w, h } = box;
  const wide = w >= 560;
  const L = wide ? 196 : 108, Rm = wide ? 236 : 124;
  const gw = Math.max(0, w - L - Rm), gh = Math.max(0, h - 8);
  const n = { in: Math.round(d.in / PER), both: Math.round(d.both / PER), out: Math.round(d.out / PER) };

  /* the column count that gives the largest dots in the room, counting
     the shared band twice and the gap between the two rectangles as rows,
     since apart is how it starts */
  const g = useMemo(() => {
    if (!gw || !gh) return null;
    const GAPR = 1.4;
    let best: { C: number; rIn: number; rB: number; rOut: number; p: number } | null = null;
    for (let C = 6; C <= 80; C++) {
      const rIn = Math.ceil(n.in / C), rB = Math.ceil(n.both / C), rOut = Math.ceil(n.out / C);
      const p = Math.min(gw / C, gh / (rIn + 2 * rB + rOut + GAPR), 30);
      if (!best || p > best.p + 0.01) best = { C, rIn, rB, rOut, p };
    }
    if (!best) return null;
    const { C, rIn, rB, rOut, p } = best;
    const rows = rIn + rB + rOut, gap = GAPR * p, extra = rB * p + gap;
    const top = 4 + Math.max(0, (gh - rows * p - extra) / 2);
    const x = (c: number) => L + (gw - C * p) / 2 + c * p + p / 2;
    const y = (r: number) => top + r * p + p / 2;
    /* each band fills from its seam with the next: the in band from its
       bottom row up, the shared and the out bands from their top row down,
       so a short row is only ever at the top, or where grey meets orange */
    const inD = Array.from({ length: n.in }, (_, j) => [x(j % C), y(rIn - 1 - Math.floor(j / C))]);
    const bothD = Array.from({ length: n.both }, (_, j) => [x(j % C), y(rIn + Math.floor(j / C))]);
    const outD = Array.from({ length: n.out }, (_, j) => [x(j % C), y(rIn + rB + Math.floor(j / C))]);
    return { C, rIn, rB, rOut, p, rows, gap, extra, top, inD, bothD, outD, left: L + (gw - C * p) / 2, width: C * p };
  }, [gw, gh, n.in, n.both, n.out, L]);

  const apart = stage === "apart";
  const dy = g ? (apart ? g.extra : 0) : 0;
  /* together, the column centres in the room the slide freed */
  const lift = g ? (apart ? 0 : g.extra / 2) : 0;
  const sh = wide ? shares(d) : null;

  const dots = (pts: number[][], cls: string) => (
    <g className={cls}>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={g!.p * 0.38} />
      ))}
    </g>
  );
  /* a bracket on the left, open to the right, spanning rows a..b */
  const bracket = (which: "work" | "live", x: number, ya: number, yb: number) => (
    <path className={`cv-st-brk cv-st-brk--${which}`} d={`M${x + 7},${ya}H${x}V${yb}H${x + 7}`} />
  );

  return (
    <div className={"cv cv-st" + (jump ? " is-jump" : "")} ref={root} data-stage={stage}>
      <div className="cv-top">
        <span className="cv-note">One dot is about {fmt(PER)} people.</span>
        <Replay onClick={replay} />
      </div>
      <div className="cv-fig" ref={fig}>
        {g && (
          <>
            <svg
              width={w}
              height={h}
              role="img"
              aria-label={`One column of dots in three bands: ${fmt(d.in)} commute in, ${fmt(d.both)} live and work in Boston, ${fmt(d.out)} commute out. The top two bands are the ${fmt(d.jobs)} working in Boston, the bottom two the ${fmt(d.residents)} living there.`}
            >
              <g className="cv-slide" style={{ transform: `translate(0, ${-lift + dy}px)` }}>
                {dots(g.bothD, "cv-st-d cv-st-d--copy")}
                {dots(g.outD, "cv-st-d cv-st-d--out")}
                {bracket("live", g.left - 10, g.top + g.rIn * g.p + 2, g.top + g.rows * g.p - 2)}
              </g>
              <g className="cv-slide" style={{ transform: `translate(0, ${-lift}px)` }}>
                {dots(g.inD, "cv-st-d cv-st-d--in")}
                {dots(g.bothD, "cv-st-d cv-st-d--both")}
                {bracket("work", g.left - 22, g.top + 2, g.top + (g.rIn + g.rB) * g.p - 2)}
              </g>
            </svg>
            <div className="cv-labs">
              <SetLabel which="work" x={g.left - 30} y={-lift + g.top + ((g.rIn + g.rB) * g.p) / 2 - (wide ? 20 : 22)} align="r" count={fmt(d.jobs)} unit="jobs" short={!wide} maxWidth={g.left - 36} />
              <SetLabel which="live" x={g.left - 30} y={-lift + dy + g.top + ((g.rIn + g.rows) * g.p) / 2 - (wide ? 20 : 22)} align="r" count={fmt(d.residents)} unit={wide ? "working residents" : "residents"} short={!wide} maxWidth={g.left - 36} />
              {(["in", "both", "out"] as K[]).map((k) => {
                const r0 = k === "in" ? 0 : k === "both" ? g.rIn : g.rIn + g.rB;
                const r1 = k === "in" ? g.rIn : k === "both" ? g.rIn + g.rB : g.rows;
                const yMid = -lift + (k === "out" ? dy : 0) + g.top + ((r0 + r1) * g.p) / 2;
                return (
                  <PartLabel key={k} k={k} x={g.left + g.width + 14} y={yMid - (wide && sh ? 26 : 18)} align="l" count={fmt(d[k])} share={sh?.[k]} maxWidth={Rm - 22} />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
