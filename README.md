# Cities Tool

A shared repository for housing prototypes related to the 2026–2027 Bloomberg Cities project.

This branch is `cities-v-3` from `main` — the static prototype: its landing, masthead, section
tabs and pager, journey window and dialogs, and every section but one — with **City Constraints**
built here in React: the pizza chart, the four-quadrant diagnostic tree told as a guided walk, and
the branch analysis. v-3's page runs as-is inside a Vite + React app (`src/legacy/`, generated
from `main` by `scripts/v3/port.mjs`; the README there says how and how to re-sync), and React
draws City Constraints and the Explainers content into slots in it.

## Running

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # tsc -b + vite build
```

## Project structure

```
scripts/v3/port.mjs         regenerates src/legacy from a checkout of main's cities-v-3
public/legacy/              the logo and the all-metros page the Extras section frames (verbatim)
src/
  main.tsx                  entry point; v-3's stylesheet first, then this branch's
  App.tsx                   mounts v-3's body, portals the two React pieces in, boots v-3;
                            hash routing (deep links, Back) layered over v-3's navigation
  data/content.ts           the sample cities; data/figures.ts, data/metros.ts the tree and its data
  legacy/                   main's page — generated files + the bridge to the React pieces
    README.md               what is generated, what the bridge does, what is not v-3's
    LegacyShell.tsx         mounts v-3's body; index.ts boots its scripts once
    bridge.ts               the seam: what v-3 tells React, what React drives
  styles/figures.css        the constraints section; styles/explainers.css the gallery
  components/
    ConstraintsSection.tsx  City Constraints: the walk (or the compact telling) + branch analysis
    ExplainersContent.tsx   the Explainers view: v-3's masthead, the gallery, one explainer
    pages/                  ConstraintNarrative, ConstraintScrolly, BranchAnalysisPage, the walk's layouts
  explainers/               the Visual Explainers (diagnostic tree, read a city)
```

The Growth Lab logo and the landing image are v-3's own, copied by the port script.
