/**
 * Tree Prototypes (#/tree) — three renderings of Figure 27, the city growth
 * diagnostics decision tree, as an interactive object: the wall chart you
 * brush, the dial you zoom, and the metro map with trains on it. Content is
 * single-sourced from learning/content/figures; shares the light GL theme.
 * Reached from the prototype-settings drawer on the Boston profile.
 */

import type { ReactNode } from "react";
import { WallChart } from "./WallChart";
import { Sunburst } from "./Sunburst";
import { Transit } from "./Transit";
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
        <h1>One tree, three interfaces</h1>
        <p className="tl-lede">
          The decision tree is the spine of city growth diagnostics: fourteen nodes from the
          growth question down to the suspects. Below, the same tree rebuilt three ways — a wall
          chart you brush, a dial you zoom, and a subway map with trains on it. The content never
          changes; what changes is the hand on it.
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
        <Section v={v} key={v.id} />
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
