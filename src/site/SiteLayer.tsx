import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { hierarchy, stratify, tree, treemap, type HierarchyPointNode } from "d3-hierarchy";
import type { LegacyApi } from "../legacy/bridge";
import { firstOfPart, partOf, seamSections, type SiteSlots } from "./runtime";
import { PARTS, SITE_VARIANTS, hrefForVariant, type SiteVariant } from "./variants";
import {
  TREE_SIDE_COLOR,
  quadName,
  suggestedPath,
  treeNodes,
  type TreeNodeData,
  type TreeSide,
  type TreeVariant,
} from "../data/figures";
import { DEFAULT_WALK_SHAPE, walkShape } from "../components/pages/walkShapes";
import { DEFAULT_CITY, cityShortName } from "../data/content";
import { countryMedians, homePlace } from "../data/metros";
import { driverData } from "../data/driverData";
import { QuadGlyph, QuadMark } from "../components/pages/quadIcons";

/* What the site-level layout variants draw (see variants.ts for the study):
   the crossing between the tool's two halves in each variant's own form —
   a threshold band in the one scroll, a title page in the chapters' Prev /
   Next sequence, a hand-off at the foot of the profile in the two modes —
   plus the modes' switch and recall in the section bar, and the control
   that moves between the variants.

   THE CROSSING CARRIES NO PLACEHOLDER COPY (Sept 2026, the user's call):
   it is visuals from the tool's own data — the whole diagnostic tree drawn
   large with the city's route lit, one data-drawn mark on each of part
   one's cards (the fundamentals against the median metro, the metro's
   sectors, the city inside its metro), the four city types on the
   diagnosis card — and the only sentence is the diagnosis itself. The
   city is the one the prototype carries (content.ts). */

/** the city the crossing draws — the prototype's one city */
const CITY = cityShortName(DEFAULT_CITY);
/** the four-quadrant tree the walk and the analysis draw — not the initial
 *  draft's two-branch tree, whose heads carry no city type */
const VARIANT: TreeVariant = walkShape(DEFAULT_WALK_SHAPE).variant;
const TEAL = "#255862";

interface SiteLayerProps {
  api: LegacyApi;
  variant: SiteVariant;
  slots: SiteSlots;
  /** the section v-3's switch is on */
  section: number;
  /** the tool is on screen (not the landing) */
  inTool: boolean;
}

export function SiteLayer({ api, variant, slots, section, inTool }: SiteLayerProps) {
  const { last, first } = seamSections();
  const go = useCallback((i: number) => api.showSection(i), [api]);

  /* ---- chapters: the title page is a stop in the pager's sequence ----
     Prev / Next across the crossing land on it, in either direction; the
     tabs stay what they are on main, a jump straight to a section. */
  const [gate, setGate] = useState(false);
  useEffect(() => {
    if (variant !== "chapters") return;
    const pager = document.querySelector<HTMLElement>(".secpager");
    const nav = document.querySelector<HTMLElement>(".secbar");
    if (!pager) return;
    /* capture, so v-3's own listener on the pager never sees the click */
    const onPager = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLElement>(".pager-btn");
      if (!b) return;
      const from = Number(pager.dataset.sec);
      const to = Number(b.dataset.go);
      if (partOf(from) < 0 || partOf(to) < 0 || partOf(from) === partOf(to)) return;
      e.stopPropagation();
      setGate(true);
    };
    /* any tab (or the phone's menu) leaves the title page, including the tab
       of the section it was reached from, which the switch itself ignores */
    const onNav = (e: MouseEvent) => {
      if ((e.target as Element).closest(".secnav-btn, .secmenu-opt")) setGate(false);
    };
    pager.addEventListener("click", onPager, true);
    nav?.addEventListener("click", onNav);
    return () => {
      pager.removeEventListener("click", onPager, true);
      nav?.removeEventListener("click", onNav);
    };
  }, [variant]);
  useEffect(() => setGate(false), [section]);
  useEffect(() => {
    const h = document.documentElement;
    if (!gate) {
      delete h.dataset.siteGate;
      return;
    }
    h.dataset.siteGate = "1";
    document.getElementById("pages")?.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      delete h.dataset.siteGate;
    };
  }, [gate]);
  const leaveGate = (to: number) => {
    setGate(false);
    go(to);
  };

  const name = (i: number) => api.sectionDefs[i]?.name ?? "";

  return (
    <>
      {variant === "scroll" && slots.seam && createPortal(
        <PartSeam api={api} onRevisit={go}>
          <p className="seam-cue">
            keep scrolling to begin
            <Arrow dir="down" />
          </p>
        </PartSeam>,
        slots.seam,
      )}

      {variant === "chapters" && gate && slots.seam && createPortal(
        <PartSeam api={api} onRevisit={leaveGate} page>
          <div className="seam-pager">
            <button type="button" className="seam-btn" onClick={() => leaveGate(last)}>
              <Arrow dir="left" />
              {name(last)}
            </button>
            <button type="button" className="seam-btn seam-btn--go" onClick={() => leaveGate(first)}>
              Begin · {name(first)}
              <Arrow dir="right" />
            </button>
          </div>
        </PartSeam>,
        slots.seam,
      )}

      {variant === "modes" && slots.seam && createPortal(
        <PartHandoff onGo={() => go(first)} firstName={name(first)} />,
        slots.seam,
      )}
      {variant === "modes" && slots.mode && createPortal(
        <ModeSwitch section={section} onGo={go} />,
        slots.mode,
      )}
      {variant === "modes" && slots.recall && partOf(section) === 1 && createPortal(
        <ProfileRecall api={api} onOpen={go} />,
        slots.recall,
      )}

      {inTool && <SiteVariantSwitch variant={variant} />}
    </>
  );
}

/* ---------- shared bits ---------- */

function Arrow({ dir }: { dir: "left" | "right" | "down" }) {
  const rot = dir === "left" ? 180 : dir === "down" ? 90 : 0;
  return (
    <svg
      className="site-arrow"
      viewBox="0 0 16 10"
      width="16"
      height="10"
      aria-hidden="true"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M1 5h13M10 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CHECK = (
  <svg viewBox="0 0 10 8" width="9" height="7" aria-hidden="true">
    <path d="M1 4.2 3.7 6.8 9 1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** the sections of one half, with the numbers the tabs give them */
const sectionsOf = (api: LegacyApi, part: 0 | 1) =>
  api.sectionDefs.map((sd, i) => ({ name: sd.name, i })).filter((s) => partOf(s.i) === part);

/* ---------- the visuals the crossing is made of ---------- */

/** the diagnostic tree with the city's own route lit in its branch's colour
 *  and the rest of it faint. Large: every node named, a quadrant mark on
 *  each head, the city chipped on the ending it lands on. MINI (Sept 2026,
 *  the user's call): the same shape at card size and nothing else — no
 *  names, no marks, no chip, just the route through the fork — since the
 *  card it sits in is named and the diagnosis is written out above it. */
export function SeamTree({
  city,
  path,
  compact = false,
  mini = false,
}: {
  city: string;
  path: string[];
  compact?: boolean;
  /** card size: the shape alone */
  mini?: boolean;
}) {
  const TV = mini
    ? { w: 250, h: 104, pad: 16, top: 12, bottom: 12 }
    : { w: 760, h: compact ? 250 : 290, pad: 44, top: 44, bottom: 58 };
  const nodes = useMemo(() => {
    const root = stratify<TreeNodeData>()
      .id((d) => d.id)
      .parentId((d) => d.parent)(treeNodes(VARIANT));
    return tree<TreeNodeData>().size([TV.w - TV.pad * 2, TV.h - TV.top - TV.bottom])(root).descendants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, mini]);
  type N = HierarchyPointNode<TreeNodeData>;
  const on = new Set(["root", ...path]);
  const sideOf = (n: N): TreeSide => (n.ancestors().find((a) => a.depth === 1)?.data.id ?? "root") as TreeSide;
  const color = (n: N) => TREE_SIDE_COLOR[sideOf(n)] ?? "#8a9498";
  const X = (n: N) => n.x + TV.pad;
  const Y = (n: N) => n.y + TV.top;
  const elbow = (n: N) => {
    const p = n.parent as N;
    return `M${X(p)},${Y(p)} V${(Y(p) + Y(n)) / 2} H${X(n)} V${Y(n)}`;
  };
  const here = nodes.find((n) => n.data.id === path[path.length - 1]);
  const linked = nodes.filter((n) => n.parent).sort((a, b) => Number(on.has(a.data.id)) - Number(on.has(b.data.id)));
  return (
    <svg
      className={mini ? "seam-viz seam-viz--tree" : undefined}
      viewBox={`0 0 ${TV.w} ${TV.h}`}
      role="img"
      aria-label={`The diagnostic tree, with ${city}'s route lit`}
    >
      {linked.map((n) => (
        <path
          key={n.data.id}
          d={elbow(n)}
          fill="none"
          stroke={color(n)}
          strokeWidth={on.has(n.data.id) ? (mini ? 2.4 : 3.5) : mini ? 1.1 : 1.6}
          opacity={on.has(n.data.id) ? 1 : 0.28}
        />
      ))}
      {nodes.map((n) => {
        const lit = on.has(n.data.id);
        const head = n.depth === 1;
        const leaf = !n.children;
        if (mini)
          return (
            <circle
              key={n.data.id}
              cx={X(n)}
              cy={Y(n)}
              r={lit ? 4 : 2.6}
              fill={n.depth === 0 ? "var(--ink-soft)" : color(n)}
              opacity={lit || n.depth === 0 ? 1 : 0.34}
            />
          );
        return (
          <g key={n.data.id} opacity={lit || n.depth === 0 ? 1 : 0.5}>
            <circle cx={X(n)} cy={Y(n)} r={lit ? 7 : 5} fill={n.depth === 0 ? "var(--ink-soft)" : color(n)} />
            {head && <QuadMark side={n.data.id} x={X(n) - 13} y={Y(n) - 40} size={26} color={color(n)} />}
            {n.depth === 0 ? (
              <text className="seam-tree-t root" x={X(n)} y={Y(n) - 14} textAnchor="middle">
                {n.data.title}
              </text>
            ) : (
              <text className={"seam-tree-t" + (lit ? "" : " faint")} x={X(n)} y={Y(n) + (leaf ? 20 : 20)} textAnchor="middle" fill={color(n)}>
                {n.data.title}
              </text>
            )}
          </g>
        );
      })}
      {here &&
        (mini ? (
          /* where the route ends, ringed — the card says no more than that */
          <circle cx={X(here)} cy={Y(here)} r={7.5} fill="none" stroke={color(here)} strokeWidth={1.6} opacity={0.75} />
        ) : (
          <g>
            <rect x={X(here) - 30} y={Y(here) + 27} width={60} height={18} rx={9} fill={color(here)} />
            <text className="seam-tree-chip" x={X(here)} y={Y(here) + 39.5} textAnchor="middle">
              {city}
            </text>
          </g>
        ))}
    </svg>
  );
}

/** part one's marks, from the tool's own data — one per section, keyed by
 *  the section's name as v-3 carries it */
function SeamViz({ name, light }: { name: string; light: boolean }) {
  const ink = light ? "rgba(255,255,255,.85)" : TEAL;
  const soft = light ? "rgba(255,255,255,.35)" : "#c8cdd0";
  const d = driverData(CITY);
  const sectors = useMemo(() => {
    if (!d) return [];
    const bySector = new Map<string, number>();
    for (const t of d.shiftShare.tiles) bySector.set(t.sector, (bySector.get(t.sector) ?? 0) + t.e0);
    type S = { name: string; v?: number; children?: S[] };
    const root = hierarchy<S>({ name: "root", children: [...bySector].map(([name, v]) => ({ name, v })) })
      .sum((n) => n.v ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<S>().size([230, 92]).paddingInner(2)(root).leaves();
  }, [d]);
  const sugg = useMemo(() => suggestedPath(CITY, VARIANT), []);
  if (name === "Economic Fundamentals") {
    /* the two dials the tree turns on: the city against the median metro */
    const place = homePlace(CITY);
    const med = countryMedians("United States of America");
    if (!place) return null;
    const rows: [string, number, number][] = [
      ["population", place.pop, med.pop],
      ["pay", place.wage, med.wage],
    ];
    const span = Math.max(...rows.flatMap(([, a, b]) => [Math.abs(a), Math.abs(b)])) * 1.15;
    const x = (v: number) => 104 + (v / span) * 92;
    /* metrosData carries growth in %/yr already */
    const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%/yr`;
    return (
      <svg className="seam-viz" viewBox="0 0 250 62" role="img" aria-label={`${CITY}'s population and pay growth against the median metro`}>
        {rows.map(([k, a, b], i) => {
          const y = 14 + i * 26;
          return (
            <g key={k}>
              <text className="seam-viz-t" x={0} y={y + 4}>{k}</text>
              <line x1={x(0)} x2={x(0)} y1={y - 8} y2={y + 8} stroke={soft} strokeWidth={1} />
              <line x1={x(b)} x2={x(b)} y1={y - 7} y2={y + 7} stroke={soft} strokeWidth={2.5} />
              <line x1={x(0)} x2={x(a)} y1={y} y2={y} stroke={ink} strokeWidth={3} strokeLinecap="round" />
              <circle cx={x(a)} cy={y} r={4.5} fill={ink} />
              <text className="seam-viz-t" x={Math.max(x(a), x(b)) + 8} y={y + 4}>{pct(a)}</text>
            </g>
          );
        })}
        <text className="seam-viz-t" x={x(0)} y={60} textAnchor="middle">tick: the median metro</text>
      </svg>
    );
  }
  if (name === "Metro Industries") {
    if (!sectors.length) return null;
    return (
      <svg className="seam-viz" viewBox="0 0 230 92" role="img" aria-label={`The ${CITY} MSA's jobs by sector`}>
        {sectors.map((n, i) => {
          const w = n.x1 - n.x0;
          const h = n.y1 - n.y0;
          return (
            <g key={i}>
              <rect x={n.x0} y={n.y0} width={w} height={h} rx={2} fill={ink} opacity={i < 3 ? 1 : 0.55} />
              {w > 46 && h > 16 && (
                <text className="seam-viz-t" x={n.x0 + 4} y={n.y0 + 12} fill={light ? TEAL : "#fff"} style={{ fill: light ? "#1c454d" : "#fff" }}>
                  {n.data.name.length > w / 6 ? n.data.name.slice(0, Math.floor(w / 6) - 1) + "…" : n.data.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }
  if (name === "Admin Industries") {
    if (!d) return null;
    const home = d.places.find((p) => p.id === d.placeId);
    return (
      <svg className="seam-viz" viewBox="0 0 272 176" role="img" aria-label={`${CITY} inside its metro's places`}>
        <path d={d.msaOutline} fill="none" stroke={soft} strokeWidth={1} strokeDasharray="3 3" />
        {d.places.map((p) => p.d && <path key={p.id} d={p.d} fill={soft} stroke={light ? "rgba(28,69,77,.6)" : "#fff"} strokeWidth={0.6} />)}
        {home?.d && <path d={home.d} fill={ink} stroke="none" />}
      </svg>
    );
  }
  if (name === "Constraints Diagnosis") {
    /* the tree, small: this is the section that walks it, and the page no
       longer draws it large above (Sept 2026, the user's call) */
    return <SeamTree city={CITY} path={sugg} mini />;
  }
  if (name === "Levers for Change") {
    return (
      <svg className="seam-viz" viewBox="0 0 230 62" role="img" aria-label="Levers">
        {[0.32, 0.7, 0.5].map((t, i) => {
          const y = 12 + i * 20;
          return (
            <g key={i}>
              <line x1={10} x2={220} y1={y} y2={y} stroke={soft} strokeWidth={3} strokeLinecap="round" />
              <line x1={10} x2={10 + 210 * t} y1={y} y2={y} stroke={ink} strokeWidth={3} strokeLinecap="round" />
              <circle cx={10 + 210 * t} cy={y} r={6} fill={ink} />
            </g>
          );
        })}
      </svg>
    );
  }
  return null;
}

/* ---------- the crossing: what part one hands to part two ----------
   One board in both of its settings — a band in the one scroll, a page in
   the chapters: the diagnosis in a line, then the three sections just read,
   filed on the left with a mark from their own data, and the two ahead on
   the right — the first of them carrying the tree the diagnosis walks. */

function PartSeam({
  api,
  onRevisit,
  page = false,
  children,
}: {
  api: LegacyApi;
  onRevisit: (i: number) => void;
  /** a page of its own (chapters) rather than a band in the scroll */
  page?: boolean;
  /** the foot: a scroll cue, or the page's Prev / Next */
  children: ReactNode;
}) {
  const [one, two] = PARTS;
  const sugg = useMemo(() => suggestedPath(CITY, VARIANT), []);
  return (
    <section className={"seam" + (page ? " seam--page" : "")} aria-labelledby="seam-title">
      <div className="seam-in">
        {/* the header alone: the tree that used to sit beside it is in the
            Constraints Diagnosis card below, at card size */}
        <div className="seam-top">
          <header className="seam-head">
            <p className="seam-eyebrow">Part {two.n} of 2</p>
            <h2 id="seam-title">{two.name}</h2>
            <Diagnosis path={sugg} />
          </header>
        </div>

        <div className="seam-board">
          <div className="seam-group seam-group--done">
            <p className="seam-tag">
              <b>Part {one.n} · {one.name}</b>
              <span>what you bring</span>
            </p>
            <ul>
              {sectionsOf(api, 0).map((s) => (
                <li key={s.i} className="seam-card">
                  <span className="seam-num">{CHECK}</span>
                  <b>{s.name}</b>
                  <SeamViz name={s.name} light />
                  <button type="button" className="seam-link" onClick={() => onRevisit(s.i)}>
                    Revisit
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="seam-join" aria-hidden="true">
            <span>builds on</span>
            <Arrow dir="right" />
          </div>

          <div className="seam-group seam-group--next">
            <p className="seam-tag">
              <b>Part {two.n} · {two.name}</b>
              <span>what you do with it</span>
            </p>
            <ol>
              {sectionsOf(api, 1).map((s) => (
                <li key={s.i} className="seam-card">
                  <span className="seam-num">{s.i + 1}</span>
                  <b>{s.name}</b>
                  <SeamViz name={s.name} light={false} />
                </li>
              ))}
            </ol>
          </div>
        </div>

        <footer className="seam-foot">{children}</footer>
      </div>
    </section>
  );
}

/** the diagnosis in one line — the only sentence at the crossing, and it is
 *  the city's own data speaking */
function Diagnosis({ path }: { path: string[] }) {
  const head = path[0];
  const leaf = treeNodes(VARIANT).find((n) => n.id === path[path.length - 1]);
  const name = quadName(head);
  if (!name) return null;
  return (
    <p className="seam-diag">
      {CITY}'s data lands on{" "}
      <b>
        <QuadGlyph side={head} color="#fff" />
        {name}
        {leaf && leaf.id !== head ? ` › ${leaf.title}` : ""}
      </b>
      . Part {PARTS[1].n} walks that route and reads what sits at its end.
    </p>
  );
}

/* ---------- two modes ---------- */

/** the hand-off at the foot of the profile: the modes' crossing is the
 *  switch in the bar, so the page only has to offer it */
function PartHandoff({ onGo, firstName }: { onGo: () => void; firstName: string }) {
  const two = PARTS[1];
  const sugg = useMemo(() => suggestedPath(CITY, VARIANT), []);
  return (
    <aside className="handoff">
      <div className="handoff-txt">
        <p className="seam-eyebrow">Next · Part {two.n}</p>
        <h2>{two.name}</h2>
        <Diagnosis path={sugg} />
      </div>
      <div className="handoff-tree">
        <div className="seam-tree">
          <SeamTree city={CITY} path={sugg} compact />
        </div>
      </div>
      <button type="button" className="handoff-btn" onClick={onGo}>
        Start · {firstName}
        <Arrow dir="right" />
      </button>
    </aside>
  );
}

/** the two halves as the bar's first choice; each remembers where it was left */
function ModeSwitch({ section, onGo }: { section: number; onGo: (i: number) => void }) {
  const part = partOf(section);
  const left = useRef<[number, number]>([firstOfPart(0), firstOfPart(1)]);
  if (part !== -1) left.current[part] = section;
  return (
    <div className="modes" role="group" aria-label="Parts of the tool">
      {PARTS.map((p, pi) => (
        <button
          key={p.n}
          type="button"
          className={"modes-btn" + (part === pi ? " is-on" : "")}
          aria-pressed={part === pi}
          onClick={() => part !== pi && onGo(left.current[pi])}
        >
          <small>Part {p.n}</small>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** the profile on call while diagnosing: part two is built on part one, so
 *  part one stays one click away without leaving the step */
function ProfileRecall({ api, onOpen }: { api: LegacyApi; onOpen: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="recall" ref={box}>
      <button
        type="button"
        className={"recall-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {PARTS[0].name}
        <svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true">
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="recall-panel" role="dialog" aria-label={`${PARTS[0].name}, in brief`}>
          <p className="recall-head">
            <b>Part 1 · {PARTS[0].name}</b>
            <span>in brief, while you diagnose</span>
          </p>
          <ul>
            {sectionsOf(api, 0).map((s) => (
              <li key={s.i} className="recall-card">
                <b>{s.name}</b>
                <SeamViz name={s.name} light={false} />
                <button type="button" className="seam-link" onClick={() => onOpen(s.i)}>
                  Open section
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- the study's own control ---------- */

/** Bottom-left, off the page's own chrome: it belongs to the study, not the
 *  tool. Choosing a variant is a navigation (see variants.ts), to the same
 *  place in the tool. */
function SiteVariantSwitch({ variant }: { variant: SiteVariant }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const now = SITE_VARIANTS.find((s) => s.id === variant)!;

  return (
    <div className="sv" ref={box}>
      {open && (
        <div className="sv-panel" role="menu" aria-label="Site layout variants">
          {SITE_VARIANTS.map((s) => (
            <a
              key={s.id}
              role="menuitemradio"
              aria-checked={s.id === variant}
              className={"sv-opt" + (s.id === variant ? " is-on" : "")}
              href={hrefForVariant(s.id)}
              onClick={(e) => {
                /* a hash-only difference would not reload the page */
                e.preventDefault();
                if (s.id === variant) return setOpen(false);
                window.location.assign(hrefForVariant(s.id));
              }}
            >
              <b>{s.label}</b>
              <span>{s.note}</span>
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className={"sv-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sv-k">Site Layout</span>
        <span className="sv-now">{now.label}</span>
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
          <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
