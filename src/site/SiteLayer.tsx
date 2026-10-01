import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { hierarchy, stratify, tree, treemap, type HierarchyPointNode } from "d3-hierarchy";
import type { LegacyApi } from "../legacy/bridge";
import { partOf, type SiteSlots } from "./runtime";
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
import { QuadGlyph } from "../components/pages/quadIcons";

/* What the site-level layout variants draw (see variants.ts for the study):
   the crossing between the tool's two halves — one board, a threshold band
   scrolled through in the one scroll, the opening screen of the second
   half's page in the two scrolls — and the control that moves between the
   variants.

   THE CROSSING CARRIES NO PLACEHOLDER COPY (Sept 2026, the user's call):
   it is visuals from the tool's own data — one data-drawn mark on each of
   part one's cards (the fundamentals against the median metro, the metro's
   sectors, the city inside its metro), the diagnostic pathway with the
   city's route lit on the diagnosis card — and the only sentence is the
   diagnosis itself. The city is the one the prototype carries (content.ts). */

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
  /** the tool is on screen (not the landing) */
  inTool: boolean;
}

export function SiteLayer({ api, variant, slots, inTool }: SiteLayerProps) {
  const go = useCallback((i: number) => api.showSection(i), [api]);

  return (
    <>
      {/* before the diagnosis in both layouts: mid-scroll in the one scroll,
          the first screen of the second half's page in the two scrolls */}
      {variant !== "paged" && slots.seam && createPortal(
        <PartSeam api={api} onRevisit={go}>
          <p className="site-seam-cue">
            keep scrolling to begin
            <Arrow dir="down" />
          </p>
        </PartSeam>,
        slots.seam,
      )}

      {inTool && <SiteVariantSwitch variant={variant} />}
    </>
  );
}

/* ---------- shared bits ---------- */

function Arrow({ dir }: { dir: "right" | "down" }) {
  const rot = dir === "down" ? 90 : 0;
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

/** the diagnostic pathway with the city's own route lit in its branch's colour
 *  and the rest of it faint — at card size, the shape and nothing else: no
 *  names, no marks, no chip, just the route through the fork, since the card
 *  it sits in is named and the diagnosis is written out above it (Sept 2026,
 *  the user's call). */
function SeamTree({ city, path }: { city: string; path: string[] }) {
  const TV = { w: 250, h: 104, pad: 16, top: 12, bottom: 12 };
  const nodes = useMemo(() => {
    const root = stratify<TreeNodeData>()
      .id((d) => d.id)
      .parentId((d) => d.parent)(treeNodes(VARIANT));
    return tree<TreeNodeData>().size([TV.w - TV.pad * 2, TV.h - TV.top - TV.bottom])(root).descendants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      className="site-seam-viz site-seam-viz--tree"
      viewBox={`0 0 ${TV.w} ${TV.h}`}
      role="img"
      aria-label={`The diagnostic pathway, with ${city}'s route lit`}
    >
      {linked.map((n) => (
        <path
          key={n.data.id}
          d={elbow(n)}
          fill="none"
          stroke={color(n)}
          strokeWidth={on.has(n.data.id) ? 2.4 : 1.1}
          opacity={on.has(n.data.id) ? 1 : 0.28}
        />
      ))}
      {nodes.map((n) => {
        const lit = on.has(n.data.id);
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
      })}
      {/* where the route ends, ringed — the card says no more than that */}
      {here && (
        <circle cx={X(here)} cy={Y(here)} r={7.5} fill="none" stroke={color(here)} strokeWidth={1.6} opacity={0.75} />
      )}
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
  if (name === "Who are you?") {
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
      <svg className="site-seam-viz" viewBox="0 0 250 62" role="img" aria-label={`${CITY}'s population and pay growth against the median metro`}>
        {rows.map(([k, a, b], i) => {
          const y = 14 + i * 26;
          return (
            <g key={k}>
              <text className="site-seam-viz-t" x={0} y={y + 4}>{k}</text>
              <line x1={x(0)} x2={x(0)} y1={y - 8} y2={y + 8} stroke={soft} strokeWidth={1} />
              <line x1={x(b)} x2={x(b)} y1={y - 7} y2={y + 7} stroke={soft} strokeWidth={2.5} />
              <line x1={x(0)} x2={x(a)} y1={y} y2={y} stroke={ink} strokeWidth={3} strokeLinecap="round" />
              <circle cx={x(a)} cy={y} r={4.5} fill={ink} />
              <text className="site-seam-viz-t" x={Math.max(x(a), x(b)) + 8} y={y + 4}>{pct(a)}</text>
            </g>
          );
        })}
        <text className="site-seam-viz-t" x={x(0)} y={60} textAnchor="middle">tick: the median metro</text>
      </svg>
    );
  }
  if (name === "Metro Industries") {
    if (!sectors.length) return null;
    return (
      <svg className="site-seam-viz" viewBox="0 0 230 92" role="img" aria-label={`The ${CITY} MSA's jobs by sector`}>
        {sectors.map((n, i) => {
          const w = n.x1 - n.x0;
          const h = n.y1 - n.y0;
          return (
            <g key={i}>
              <rect x={n.x0} y={n.y0} width={w} height={h} rx={2} fill={ink} opacity={i < 3 ? 1 : 0.55} />
              {w > 46 && h > 16 && (
                <text className="site-seam-viz-t" x={n.x0 + 4} y={n.y0 + 12} fill={light ? TEAL : "#fff"} style={{ fill: light ? "#1c454d" : "#fff" }}>
                  {n.data.name.length > w / 6 ? n.data.name.slice(0, Math.floor(w / 6) - 1) + "…" : n.data.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }
  if (name === "Worker Flows") {
    if (!d) return null;
    const home = d.places.find((p) => p.id === d.placeId);
    return (
      <svg className="site-seam-viz" viewBox="0 0 272 176" role="img" aria-label={`${CITY} inside its metro's places`}>
        <path d={d.msaOutline} fill="none" stroke={soft} strokeWidth={1} strokeDasharray="3 3" />
        {d.places.map((p) => p.d && <path key={p.id} d={p.d} fill={soft} stroke={light ? "rgba(28,69,77,.6)" : "#fff"} strokeWidth={0.6} />)}
        {home?.d && <path d={home.d} fill={ink} stroke="none" />}
      </svg>
    );
  }
  if (name === "Constraints Diagnosis") {
    /* the tree, small: this is the section that walks it, and the page no
       longer draws it large above (Sept 2026, the user's call) */
    return <SeamTree city={CITY} path={sugg} />;
  }
  if (name === "Levers for Change") {
    return (
      <svg className="site-seam-viz" viewBox="0 0 230 62" role="img" aria-label="Levers">
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
   One board in both of its settings — a band scrolled through in the one
   scroll, the second half's first screen in the two scrolls: the diagnosis in
   a line, then the three sections just read, filed on the left with a mark
   from their own data, and the two ahead on the right — the first of them
   carrying the tree the diagnosis walks. */

function PartSeam({
  api,
  onRevisit,
  children,
}: {
  api: LegacyApi;
  onRevisit: (i: number) => void;
  /** the foot: the scroll cue */
  children: ReactNode;
}) {
  const [one, two] = PARTS;
  const sugg = useMemo(() => suggestedPath(CITY, VARIANT), []);
  return (
    <section className="site-seam" aria-labelledby="site-seam-title">
      <div className="site-seam-in">
        {/* the header alone: the tree that used to sit beside it is in the
            Constraints Diagnosis card below, at card size */}
        <div className="site-seam-top">
          <header className="site-seam-head">
            <p className="site-seam-eyebrow">Part {two.n} of 2</p>
            <h2 id="site-seam-title">{two.name}</h2>
            <Diagnosis path={sugg} />
          </header>
        </div>

        <div className="site-seam-board">
          <div className="site-seam-group site-seam-group--done">
            <p className="site-seam-tag">
              <b>Part {one.n} · {one.name}</b>
              <span>what you bring</span>
            </p>
            <ul>
              {sectionsOf(api, 0).map((s) => (
                <li key={s.i} className="site-seam-card">
                  <span className="site-seam-num">{CHECK}</span>
                  <b>{s.name}</b>
                  <SeamViz name={s.name} light />
                  <button type="button" className="site-seam-link" onClick={() => onRevisit(s.i)}>
                    Revisit
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-seam-join" aria-hidden="true">
            <span>builds on</span>
            <Arrow dir="right" />
          </div>

          <div className="site-seam-group site-seam-group--next">
            <p className="site-seam-tag">
              <b>Part {two.n} · {two.name}</b>
              <span>what you do with it</span>
            </p>
            <ol>
              {sectionsOf(api, 1).map((s) => (
                <li key={s.i} className="site-seam-card">
                  <span className="site-seam-num">{s.i + 1}</span>
                  <b>{s.name}</b>
                  <SeamViz name={s.name} light={false} />
                </li>
              ))}
            </ol>
          </div>
        </div>

        <footer className="site-seam-foot">{children}</footer>
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
    <p className="site-seam-diag">
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
    <div className="site-sv" ref={box}>
      {open && (
        <div className="site-sv-panel" role="menu" aria-label="Site layout variants">
          {SITE_VARIANTS.map((s) => (
            <a
              key={s.id}
              role="menuitemradio"
              aria-checked={s.id === variant}
              className={"site-sv-opt" + (s.id === variant ? " is-on" : "")}
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
        className={"site-sv-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="site-sv-k">Site Layout</span>
        <span className="site-sv-now">{now.label}</span>
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
          <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
