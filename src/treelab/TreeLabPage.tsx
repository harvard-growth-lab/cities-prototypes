/**
 * Tree Prototypes (#/tree) — six renderings of Figure 27, the city growth
 * diagnostics decision tree, as an interactive object. Three you handle
 * (the wall chart you brush, the dial you zoom, the metro map with trains
 * on it) and three you scroll (the codex the tree indexes, the descent
 * where scroll is depth, the reel that plays the leaves sideways). Content
 * is single-sourced from learning/content/figures; shares the light GL
 * theme. Reached from the prototype-settings drawer on the Boston profile.
 */

import { Fragment, type ReactNode } from "react";
import { WallChart } from "./WallChart";
import { Sunburst } from "./Sunburst";
import { Transit } from "./Transit";
import { Codex } from "./Codex";
import { Descent } from "./Descent";
import { Reel } from "./Reel";
import "./treelab.css";

interface Variant {
  id: string;
  num: string;
  eyebrow: string;
  title: string;
  setup: string;
  notes: { label: string; text: string }[];
  bleed?: boolean;
  body: ReactNode;
}

const VARIANTS: Variant[] = [
  {
    id: "wall",
    num: "01",
    eyebrow: "hover & pin",
    title: "The wall chart",
    setup:
      "The whole tree at once, the way the figure hangs in the paper — but wired. Every node knows its ancestry: brush one and its path lights up in the color of its side while the panel reads its case.",
    notes: [
      {
        label: "The interaction",
        text: "hover to trace a lineage, click to pin it and free the pointer. The tree is the index; the panel is the page.",
      },
      {
        label: "As navigation",
        text: "the overview / site-map pattern — one glance shows the territory, one click opens any section.",
      },
    ],
    body: <WallChart />,
  },
  {
    id: "dial",
    num: "02",
    eyebrow: "radial zoom",
    title: "The dial",
    setup:
      "The tree bent into a circle. Each ring is a depth, each arc's width is its share of the suspects beneath it — demand in blue, supply in gold, paling as the branches thin. Click a branch and the dial re-roots on it.",
    notes: [
      {
        label: "The interaction",
        text: "click an arc to zoom into its subtree, the center to back out; leaves pin their one-line case to the caption.",
      },
      {
        label: "As navigation",
        text: "the dashboard-hub pattern — the whole framework as one compact dial in a corner of a city profile, showing where the current page sits.",
      },
    ],
    body: <Sunburst />,
  },
  {
    id: "metro",
    num: "03",
    eyebrow: "transit-map style",
    title: "The metro",
    setup:
      "The tree as a subway diagram: two lines leave The Growth Question — the blue Demand line and the gold Supply line — bending at 45° like a proper metro map, branching at interchange rings, ending at seven termini with route codes. Trains run the routes all day.",
    notes: [
      {
        label: "The style",
        text: "Beck-style transit graphics — thick rounded lines on white, terminus ticks, interchange rings, a legend box and a transit-authority title placard.",
      },
      {
        label: "The details",
        text: "hover a station to light its route from the origin and post the announcement below. Trains park under reduced motion.",
      },
    ],
    bleed: true,
    body: <Transit />,
  },
  {
    id: "codex",
    num: "04",
    eyebrow: "scroll-spy",
    title: "The codex",
    setup:
      "The tree flattened into fourteen entries of running prose, in the figure's own reading order, with the tree standing in the margin as the index. Scroll and the index tracks you — the lit path is always the ancestry of whatever sits under your reading line. Click any node to jump to its entry.",
    notes: [
      {
        label: "The interaction",
        text: "scroll to read; the margin map follows. The entries indent with their depth, so the document itself is the tree laid on its side.",
      },
      {
        label: "As navigation",
        text: "the docs-sidebar pattern — the tree is not the content here, it is the table of contents: always visible, always oriented, one click from anywhere.",
      },
    ],
    body: <Codex />,
  },
  {
    id: "descent",
    num: "05",
    eyebrow: "scroll to descend",
    title: "The descent",
    setup:
      "Scroll is depth. The whole chart hangs in a fixed frame; each turn of the wheel drops you one fork further down, the camera diving into the branch while the ruled-out limbs fall back. At every fork the card asks the fork's question — click a branch to change course, keep scrolling to commit, and the dashed trail ahead shows the route you're on.",
    notes: [
      {
        label: "The interaction",
        text: "the scroll bar becomes the tree's depth axis: down is deeper. Forks are decided by click, depth by scroll; the rail on the right jumps straight to any level of the current route.",
      },
      {
        label: "As navigation",
        text: "the guided-descent pattern — one continuous gesture walks the whole diagnostic, and where you are in the argument is legible in the scroll position itself.",
      },
    ],
    body: <Descent />,
  },
  {
    id: "reel",
    num: "06",
    eyebrow: "vertical in, horizontal out",
    title: "The reel",
    setup:
      "The seven suspects on one strip of film. The page scrolls down; the reel travels sideways, one leaf per turn, while the little tree above lights each suspect's ancestry as it passes — branch boundaries are where the lit path rearranges. The dot on the track below the leaves is the projector's counter.",
    notes: [
      {
        label: "The interaction",
        text: "vertical scroll converts to horizontal travel through the leaves in figure order; each card carries its full lineage as a chip trail, so the taxonomy never disappears.",
      },
      {
        label: "As navigation",
        text: "the filmstrip pattern — a linear tour of the endpoints for readers who want the suspects, with the tree kept overhead as the map of where each one hangs.",
      },
    ],
    body: <Reel />,
  },
];

function Section({ v }: { v: Variant }) {
  return (
    <section className="tl-section" id={`tl-${v.id}`}>
      <div className="tl-head">
        <span className="tl-num">{v.num}</span>
        <div>
          <span className="eyebrow">{v.eyebrow}</span>
          <h2>{v.title}</h2>
        </div>
      </div>
      <p className="tl-setup">{v.setup}</p>
      {v.bleed ? <div className="tl-bleed">{v.body}</div> : v.body}
      <div className="tl-notes">
        {v.notes.map((note) => (
          <p key={note.label}>
            <b>{note.label}</b> {note.text}
          </p>
        ))}
      </div>
    </section>
  );
}

export function TreeLabPage() {
  return (
    <div className="gl-app treelab-page">
      <div className="gl-corner">
        <a className="story-link" href="#/">
          ← Boston profile
        </a>
        <a className="story-link" href="#/concepts">
          Concepts →
        </a>
      </div>

      <header className="tl-hero">
        <span className="eyebrow">
          Tree Prototypes · Figure 27 · Doing Growth Diagnostics in Cities
        </span>
        <h1>One tree, six interfaces</h1>
        <p className="tl-lede">
          The decision tree is the spine of city growth diagnostics: fourteen nodes from the
          growth question down to the suspects. Below, the same tree rebuilt six ways. Three you
          handle — a wall chart you brush, a dial you zoom, a subway map with trains on it — and
          three you scroll: a codex the tree indexes, a descent where the wheel is the depth
          axis, and a reel that plays the leaves sideways. The content never changes; what
          changes is the hand on it.
        </p>
        <nav className="tl-index" aria-label="Jump to a variant">
          {VARIANTS.map((v) => (
            <a
              key={v.id}
              href="#/tree"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`tl-${v.id}`)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <b>{v.num}</b> {v.title}
            </a>
          ))}
        </nav>
      </header>

      {VARIANTS.map((v) => (
        <Fragment key={v.id}>
          {v.id === "codex" && (
            <div className="tl-turn">
              <span className="eyebrow">the scrolling three</span>
              <p>
                From here down, the wheel does the walking. The tree stops being a picture you
                point at and becomes the page itself — an index that reads along with you, a
                shaft you descend, a strip that plays sideways.
              </p>
            </div>
          )}
          <Section v={v} />
        </Fragment>
      ))}

      <footer className="tl-footer">
        <p>
          Fourteen nodes, verbatim from Figure 27 of <em>Doing Growth Diagnostics in Cities</em>{" "}
          (Harvard Growth Lab, 2026) — blue for the firms' side, gold for the residents'. To see
          the tree walked with real evidence, take the <a href="#/">Boston profile</a>'s learning
          mode, or start with the <a href="#/concepts">concepts</a>.
        </p>
      </footer>
    </div>
  );
}
