import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { fmt, onReplay, type Commuters } from "./study";

/* What the commuting drawings share (src/commuters/): the three groups'
   keys and names, the box a drawing is given, when it is on screen, how it
   plays in and replays, main's own set and part labels, and the small
   controls dressed like main's. */

export type K = "in" | "both" | "out";
export const KS: K[] = ["in", "both", "out"];
export const NAME: Record<K, string> = {
  in: "commute in",
  both: "live and work in Boston",
  out: "commute out",
};

/** one dot, as main's figure counts them */
export const PER = 2000;

export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

declare global {
  interface Window {
    /** main's city-and-arrow icons for the three parts (v3-page.js) */
    FLOW_ICO?: Record<K, string>;
  }
}
const ico = (k: K) => window.FLOW_ICO?.[k] ?? "";

export function useBox<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

/** on once half of it is on screen; off again only once it has left
 *  entirely, so a small scroll back and forth does not replay it */
export function useSeen(ref: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.intersectionRatio >= 0.5) setSeen(true);
          else if (!e.isIntersecting) setSeen(false);
        }),
      { threshold: [0, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

/* ---------- opt-2's choreography ----------
   The two sets stand apart, named; after a beat they slide together until
   the shared people are one block; then the three parts take their colours
   and are named. The stage is a data attribute the drawings' CSS reads;
   the slide itself is a transition on the groups' transforms. A replay (or
   the presenter's Play again) jumps back to the start without a transition
   and runs again. Less motion asked for: the end state at once. */
export type Stage = "apart" | "together" | "named";

export function useChoreo(seen: boolean, hold = 800, slide = 1250) {
  const [stage, setStage] = useState<Stage>("apart");
  const [jump, setJump] = useState(true);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const run = () => {
    clear();
    if (reduced()) {
      setJump(true);
      setStage("named");
      return;
    }
    setJump(true);
    setStage("apart");
    timers.current.push(
      window.setTimeout(() => setJump(false), 40),
      window.setTimeout(() => setStage("together"), hold),
      window.setTimeout(() => setStage("named"), hold + slide + 250),
    );
  };
  useEffect(() => {
    if (seen) run();
    else {
      clear();
      setJump(true);
      setStage("apart");
    }
    return clear;
  }, [seen]);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => onReplay(() => runRef.current()), []);
  return { stage, jump, replay: run };
}

/* ---------- the labels, as opt-2 writes them ---------- */

type Align = "l" | "r" | "c";

/** a set's name over its rectangle, with its count (HTML, placed in px
 *  over the figure; it follows its rectangle through the slide) */
export function SetLabel({
  which,
  x,
  y,
  align,
  count,
  unit,
  short,
  maxWidth,
}: {
  which: "work" | "live";
  x: number;
  y: number;
  align: Align;
  count: string;
  unit: string;
  /** the short name, where there is no room for "People working in Boston" */
  short?: boolean;
  maxWidth?: number;
}) {
  const name = which === "work" ? (short ? "Working in Boston" : "People working in Boston") : short ? "Living in Boston" : "People living in Boston";
  return (
    <div className={`cv-set cv-set--${which}`} data-align={align} style={{ left: x, top: y, maxWidth }}>
      <b>{name}</b>
      <span>
        {count}
        <i> {unit}</i>
      </span>
    </div>
  );
}

/** a part's icon, count and name, and under it its share of its set */
export function PartLabel({
  k,
  x,
  y,
  align,
  count,
  name,
  share,
  maxWidth,
}: {
  k: K;
  x: number;
  y: number;
  align: Align;
  count: string;
  /** "" leaves the name to a key under the figure */
  name?: string;
  share?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div className={`cv-part cv-part--${k}`} data-align={align} style={{ left: x, top: y, maxWidth }}>
      <span className="cv-part-n">
        <span className="cv-ico" dangerouslySetInnerHTML={{ __html: ico(k) }} />
        <b>{count}</b>
        {name !== "" && <em>{name ?? NAME[k]}</em>}
      </span>
      {share && <span className="cv-part-w">{share}</span>}
    </div>
  );
}

/** each part's share of its set, in opt-2's words */
export const shares = (d: Commuters): Record<K, ReactNode> => {
  const pct = (a: number, b: number) => Math.round((a / b) * 100) + "%";
  return {
    in: (
      <>
        <b>{pct(d.in, d.jobs)}</b> of the people working in Boston
      </>
    ),
    both: (
      <>
        <b>{pct(d.both, d.jobs)}</b> of those working there and <b>{pct(d.both, d.residents)}</b> of those living there
      </>
    ),
    out: (
      <>
        <b>{pct(d.out, d.residents)}</b> of the people living in Boston
      </>
    ),
  };
};

/** the three parts under a row of blocks, as opt-2 places them where
 *  there is room: all three on one line, each under its block. Where the
 *  row is narrow the in and out labels drop to a second line at the row's
 *  two ends and the shared one keeps the first, centred under its block;
 *  on a phone the names go, leaving the icons and counts (a key under the
 *  figure names them). Shares only on a desk. */
export function PartsUnder({
  d,
  y,
  at,
  wide,
  counts,
}: {
  d: Commuters;
  /** the blocks' bottom edge */
  y: number;
  /** each block's left and right edge, in the together state */
  at: Record<K, [number, number]>;
  wide: boolean;
  /** what to print for each part (the counts by default) */
  counts?: Record<K, string>;
}) {
  const c = counts ?? { in: fmt(d.in), both: fmt(d.both), out: fmt(d.out) };
  const sh = wide ? shares(d) : null;
  const mid = (at.both[0] + at.both[1]) / 2;
  const span = at.out[1] - at.in[0];
  const oneLine = wide && span >= 700 && at.both[1] - at.both[0] > 230;
  const pad = wide ? 14 : 10, row2 = wide ? 60 : 36;
  const name = wide ? undefined : "";
  return (
    <>
      <PartLabel k="both" x={mid} y={y + pad} align="c" count={c.both} name={name} share={sh?.both} />
      <PartLabel k="in" x={at.in[0]} y={y + (oneLine ? pad : row2)} align="l" count={c.in} name={name} share={sh?.in} />
      <PartLabel k="out" x={at.out[1]} y={y + (oneLine ? pad : row2)} align="r" count={c.out} name={name} share={sh?.out} />
    </>
  );
}

export function Seg<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: { id: T; label: ReactNode }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="cv-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={o.id === value ? "is-active" : undefined}
          aria-pressed={o.id === value}
          onClick={() => onPick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Replay = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="cv-replay" onClick={onClick}>
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1M2.5 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    Play again
  </button>
);

/** the three groups with their counts, under a figure */
export const Key = ({ d, only }: { d: Commuters; only?: K[] }) => (
  <p className="cv-key">
    {(only ?? KS).map((k) => (
      <span key={k}>
        <i className={`cv-sw cv-sw--${k}`} aria-hidden="true" />
        <b>{fmt(d[k])}</b> {NAME[k]}
      </span>
    ))}
  </p>
);

/** a set's light frame around its blocks, as opt-2 draws it */
export const Frame = ({ which, x, y, w, h }: { which: "work" | "live"; x: number; y: number; w: number; h: number }) => (
  <rect className={`cv-frame cv-frame--${which}`} x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={3} />
);
