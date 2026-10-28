/* Who am I?'s commuting figure (beat 3), three more drawings (Oct 2026) — a
   STUDY beside main's own.

   Main's beat carries a "Groups" study in its counter's opt menu: opt-1 the
   three groups as clusters, opt-2 a rectangle Venn, opt-3 a round one, all
   made of the same dots. The designers and researchers lean to opt-2, so
   this adds five more to that same menu that each keep its grammar — the
   two sets as rectangles, the overlap as the shared block, light frames,
   main's icons and naming, the slide-together arrival — and change one
   thing. Drawn by this branch (src/commuters/, a file each) into a slot
   beside main's figure, which stands down while one of them is up:

     blocks    opt-4   the rectangles as flat areas, the counts inside; day or night lights a set
     bars      opt-5   the Venn flattened to two rows that share the grey column, shares printed
     stacked   opt-6   the Venn upright: one column of dots, the sets as brackets
     per100    opt-7   the Venn in units: 100 squares for one set, the other hung off the overlap
     figures   opt-8   the rectangles as people, one figure for 10K

   (A first round of three and a second of five — a dot box by night and
   day, 100 people, ribbons; a mosaic, a polar Venn, the city's day, rush
   hour traffic, a waterfall — were replaced on 2026-10-23 by this set.)

   The choice rides the address as ?groups=, as main's three do. Main's own
   options still go to main: picking one hands the panel back to its figure.
   With one of these up, the hand-off to the map on the next beat fills the
   map without flying dots (main's figure, which owns them, is not on screen):
   the bridge's whoFigureStandIn. */

export type CommuterVariant = "blocks" | "bars" | "stacked" | "per100" | "figures";

export const COMMUTER_VARIANTS: { id: CommuterVariant; label: string }[] = [
  { id: "blocks", label: "opt-4" },
  { id: "bars", label: "opt-5" },
  { id: "stacked", label: "opt-6" },
  { id: "per100", label: "opt-7" },
  { id: "figures", label: "opt-8" },
];

const isOurs = (v: string | null): v is CommuterVariant =>
  COMMUTER_VARIANTS.some((o) => o.id === v);

/** main's select for the study, in the beat's opt menu */
const SELECT = ".wt-groups-opt";
const PARAM = "groups";

let current: CommuterVariant | null = null;
const listeners = new Set<() => void>();
let panel: HTMLElement | null = null;
let slot: HTMLElement | null = null;
/* the address's ?groups= before one of ours took it (main's choice), so
   handing back to main restores it */
let mainParam: string | null = null;

/* the drawing on screen replays on its own button, and on the presenter's
   "Play again" (which main aims at its own figure) */
const replays = new Set<() => void>();
export function onReplay(fn: () => void) {
  replays.add(fn);
  return () => {
    replays.delete(fn);
  };
}

export function subscribeVariant(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const getVariant = () => current;
/** one of ours is up, so main's figure (and its dots) is off screen */
export const commuterStandsIn = () => current !== null;

function setVariant(v: CommuterVariant | null) {
  if (v === current) return;
  const was = current;
  const url = new URL(window.location.href);
  if (current === null && v) {
    const p = url.searchParams.get(PARAM);
    mainParam = isOurs(p) ? null : p;
  }
  current = v;
  panel?.classList.toggle("cv-on", v !== null);
  if (v) url.searchParams.set(PARAM, v);
  else if (mainParam) url.searchParams.set(PARAM, mainParam);
  else url.searchParams.delete(PARAM);
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  if (v)
    document.querySelectorAll<HTMLSelectElement>(SELECT).forEach((s) => {
      s.value = v;
    });
  /* handed back: main's figure plays again, as main's own switch does,
     through its own Play again (once main has taken the change) */
  if (!v && was)
    requestAnimationFrame(() => {
      const r = panel?.getBoundingClientRect();
      const handing = document.getElementById("ovWrap")?.classList.contains("who-hand");
      if (r && r.bottom > 0 && r.top < window.innerHeight && !handing)
        document.querySelector<HTMLButtonElement>("#whoFlows .who-fl-replay")?.click();
    });
  listeners.forEach((fn) => fn());
}

function extend(sel: HTMLSelectElement) {
  if (sel.dataset.cv) return;
  sel.dataset.cv = "1";
  COMMUTER_VARIANTS.forEach((o) => sel.add(new Option(o.label, o.id)));
  if (current) sel.value = current;
}
const extendAll = () =>
  document.querySelectorAll<HTMLSelectElement>(SELECT).forEach(extend);

/* in the capture phase, ahead of main's own listener on the select: ours
   stop here (main would read an unknown value as its opt-1); main's go on
   to main, with the panel handed back first */
function onChange(e: Event) {
  const sel = e.target instanceof HTMLSelectElement && e.target.matches(SELECT) ? e.target : null;
  if (!sel) return;
  const v = sel.value;
  if (isOurs(v)) {
    e.stopPropagation();
    setVariant(v);
  } else setVariant(null);
  document.querySelectorAll<HTMLSelectElement>(SELECT).forEach((s) => {
    s.value = v;
  });
}

/** Makes the slot beside main's figure (#whoFlows) and wires the study into
 *  main's menu. Once: StrictMode boots the app twice. */
export function mountCommuters(): HTMLElement | null {
  if (slot) return slot;
  const host = document.getElementById("whoFlows");
  if (!host?.parentElement) return null;
  panel = host.parentElement;
  slot = document.createElement("div");
  slot.className = "cv-slot";
  host.after(slot);
  /* main builds the menu as it boots, and again a tick later where the
     first pass found no counter yet; a copy made later is caught on focus */
  extendAll();
  window.setTimeout(extendAll, 0);
  document.addEventListener("focusin", (e) => {
    if (e.target instanceof HTMLSelectElement && e.target.matches(SELECT)) extend(e.target);
  }, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("click", (e) => {
    if (current && e.target instanceof Element && e.target.closest(".pv-replay")) replays.forEach((fn) => fn());
  }, true);
  const v = new URLSearchParams(window.location.search).get(PARAM);
  if (isOurs(v)) setVariant(v);
  return slot;
}

/* ---------- what the drawings read off main's page ---------- */

interface Who2024 {
  in: { jobsHere: number; filledByCommuters: number; heldByResidents: number };
  out: { residentWorkers: number; workElsewhere: number };
}
declare global {
  interface Window {
    WHO_2024?: Who2024;
    fmtCount?: (n: number) => string;
    CITY_ICON?: string;
  }
}

export interface Commuters {
  /** commute in: live elsewhere, work in Boston */
  in: number;
  /** live and work in Boston */
  both: number;
  /** commute out: live in Boston, work elsewhere */
  out: number;
  jobs: number;
  residents: number;
}

/** Boston's three groups, as main's figure has them (who-2024.js) */
export function readCommuters(): Commuters | null {
  const W = window.WHO_2024;
  if (!W?.in || !W.out) return null;
  return {
    in: W.in.filledByCommuters,
    both: W.in.heldByResidents,
    out: W.out.workElsewhere,
    jobs: W.in.jobsHere,
    residents: W.out.residentWorkers,
  };
}

/** main's count format: 528K, 2.3 million */
export const fmt = (n: number) =>
  window.fmtCount ? window.fmtCount(n) : `${Math.round(n / 1000)}K`;
