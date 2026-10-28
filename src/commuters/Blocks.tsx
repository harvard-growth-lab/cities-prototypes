import { useRef, useState } from "react";
import { fmt, type Commuters } from "./study";
import { Frame, Key, PartsUnder, Seg, SetLabel, useBox, useChoreo, useSeen } from "./shared";

/* ====================================================================
   opt-4 · Blocks
   opt-2 without the dots: the same two rectangles, the same slide
   together, but each part a flat block with its count set inside it, so
   there is nothing to count and the figure reads at a glance. The frames,
   the names over the sets and the parts under them are opt-2's. One
   control lights the set that is Boston right now: by day the people
   working there, by night the people living there.
   ==================================================================== */

type Show = "all" | "day" | "night";

const SAY: Record<Show, (d: Commuters) => string> = {
  all: (d) => `Two sets, one overlap: the ${fmt(d.both)} who live and work in Boston.`,
  day: (d) => `By day Boston holds everyone who works there: ${fmt(d.jobs)}.`,
  night: (d) => `By night, everyone who lives there and has a job: ${fmt(d.residents)}.`,
};

export function Blocks({ d }: { d: Commuters }) {
  const root = useRef<HTMLDivElement>(null);
  const [fig, box] = useBox<HTMLDivElement>();
  const seen = useSeen(root);
  const { stage, jump } = useChoreo(seen);
  const [show, setShow] = useState<Show>("all");

  const { w, h } = box;
  const wide = w >= 560;
  const top = wide ? 46 : 38, under = wide ? 104 : 74;
  const bh = Math.max(36, Math.min(h - top - under, wide ? 150 : 100));
  const by = top + Math.max(0, (h - top - under - bh) / 2);
  const gap = wide ? 30 : 18;
  /* scaled so the two sets fit standing apart (the shared block twice);
     together, the whole slides to the middle of the room that frees */
  const total = d.in + 2 * d.both + d.out;
  const unit = (w - 8) / total;
  const inW = d.in * unit, bothW = d.both * unit, outW = d.out * unit;
  const slack = bothW + gap;
  const apart = stage === "apart";
  const workX = apart ? 4 : 4 + slack / 2;
  const liveX = apart ? 4 + inW + bothW + gap : workX + inW;
  const at = { in: [workX, workX + inW], both: [workX + inW, workX + inW + bothW], out: [liveX + bothW, liveX + bothW + outW] } as const;

  const block = (k: "in" | "both" | "out" | "copy", x: number, width: number, count: string, name: string) => (
    <g className={`cv-bl cv-bl--${k}`} transform={`translate(${x} ${by})`}>
      <rect width={width} height={bh} />
      {width > 56 && (
        <text x={width / 2} y={bh / 2 + (width > 130 && bh > 60 ? -4 : 5)} textAnchor="middle" className="cv-t cv-bl-t">
          <tspan className="cv-t--n">{count}</tspan>
          {width > 130 && bh > 60 && (
            <tspan x={width / 2} dy="1.35em">{name}</tspan>
          )}
        </text>
      )}
    </g>
  );

  return (
    <div className={"cv cv-bk" + (jump ? " is-jump" : "")} ref={root} data-stage={stage} data-show={show}>
      <div className="cv-top">
        <span className="cv-note">Show</span>
        <Seg
          label="Which set to light"
          value={show}
          onPick={setShow}
          options={[
            { id: "all", label: "Everyone" },
            { id: "day", label: "Boston by day" },
            { id: "night", label: "Boston by night" },
          ]}
        />
      </div>
      <div className="cv-fig" ref={fig}>
        {w > 0 && h > 0 && (
          <>
            <svg
              width={w}
              height={h}
              role="img"
              aria-label={`Two rectangles: people working in Boston, ${fmt(d.jobs)}, and people living in Boston, ${fmt(d.residents)}, overlapping in the ${fmt(d.both)} who do both; ${fmt(d.in)} commute in, ${fmt(d.out)} commute out.`}
            >
              <g className="cv-slide" style={{ transform: `translate(${liveX}px, 0)` }}>
                <Frame which="live" x={0} y={by} w={bothW + outW} h={bh} />
                {block("copy", 0, bothW, fmt(d.both), "live and work here")}
                {block("out", bothW, outW, fmt(d.out), "commute out")}
              </g>
              <g className="cv-slide" style={{ transform: `translate(${workX}px, 0)` }}>
                <Frame which="work" x={0} y={by} w={inW + bothW} h={bh} />
                {block("in", 0, inW, fmt(d.in), "commute in")}
                {block("both", inW, bothW, fmt(d.both), "live and work here")}
              </g>
            </svg>
            <div className="cv-labs">
              <SetLabel which="work" x={workX} y={by - (wide ? 44 : 36)} align="l" count={fmt(d.jobs)} unit="jobs" short={!wide} />
              <SetLabel which="live" x={liveX + bothW + outW} y={by - (wide ? 44 : 36)} align="r" count={fmt(d.residents)} unit={wide ? "working residents" : "residents"} short={!wide} />
              <PartsUnder d={d} y={by + bh} at={{ in: [...at.in], both: [...at.both], out: [...at.out] }} wide={wide} />
            </div>
          </>
        )}
      </div>
      {wide ? <p className="cv-foot">{SAY[show](d)}</p> : <Key d={d} />}
    </div>
  );
}
