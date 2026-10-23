# Cities Tool

A shared repository for housing prototypes related to the 2026–2027 Bloomberg Cities project.

This branch is `cities-v-5` from `main` (called v-3 below and in the file names, after the folder
the port first took; main has since copied it to v-1 and then v-5) — the static prototype: its landing, masthead, section
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
node scripts/shots.mjs ./shots --widths 390,768,1440   # screenshot every view; flags sideways overflow
```

## Site layout

The site's layout is main's own. The five sections fall into two parts — **Who am I?, Metro
Industries, Worker Flows** profile the city; **Constraints Diagnosis, Levers for Change**
diagnose it and act — and main's default since 2026-10-05 is **Two scrolls**: each part one
scroll, a teal close ("What to take with you") under each section, a Next from part one's last
close into part two, which opens on a band introducing it. Main's `?layout=pages` (one section
per page) and `?layout=scroll` (everything in one scroll) still reach the other two. This branch
ran that study itself from 2026-09-21 (`?site=`, `src/site/`); main took it in whole, so the
branch's copy was retired on 2026-10-23.

## Constraints Diagnosis variants (a study)

The section as built walks one tree to one ending, and the ending decides which data modules
the analysis reads. `?constraints=` swaps the whole section for an open-ended take: several
**tests** (population vs wages, metro population growth, home value growth, local share of job
growth, and economic complexity as a placeholder) each point to modules; the modules most
tests point to are suggested, and any module can still be read. A dark pill, **Constraints
Diagnosis**, at the bottom-left while the section is on screen, switches between them.

| `?constraints=` | what it tries |
| --- | --- |
| *(none)* | **Diagnostic Pathway** — the section as it is: the walk, the analysis, the sandbox |
| `guided` | **Guided Tests** — a scrolly, one test a stop; the nine modules gather a pip per test, then rank; then the board and the reading list |
| `bench` | **Test Bench** — every test at once as cards, then the module board (suggested first, any can be added), then the reading list |
| `explorer` | **Module Explorer** — the tests as a strip of chips, the modules as a ranked list beside the one open module |

The tests and the ranking are in `src/data/diagTests.ts`. Where a test's pointer is a reading of
the tree rather than something the team has specified, its comment says so.

## Small screens

Two breakpoints, shared by `src/legacy/port.css` (the shell), `src/styles/figures.css`
(City Constraints) and the React section (`walkFit.tsx`, `useMediaQuery`): **920px**, below
which every scrolly stacks — the stage pinned on top, the captions scrolling under it, the
reading line in the band below the stage — and **640px**, below which everything is one
column with 16px gutters, the tabs use short names and the walk's stage is a camera (each
zoomed stop frames one card and its parent) rather than a map. `scripts/shots.mjs` drives
the dev server through the local Chrome and reports any route whose content reaches past
the viewport.

## Project structure

```
scripts/v3/port.mjs         regenerates src/legacy from a checkout of main's cities-v-5
public/legacy/              the logo and the all-metros page the Extras section frames (verbatim)
src/
  main.tsx                  entry point; v-3's stylesheet first, then this branch's
  App.tsx                   mounts v-3's body, portals the two React pieces in, boots v-3;
                            hash routing (deep links, Back) layered over v-3's navigation
  data/content.ts           the cities the prototype carries (Boston, plus three placeholder cities in data/placeholderCities.ts); data/figures.ts, data/metros.ts the tree and its data
  legacy/                   main's page — generated files + the bridge to the React pieces
    README.md               what is generated, what the bridge does, what is not v-3's
    LegacyShell.tsx         mounts v-3's body; index.ts boots its scripts once
    bridge.ts               the seam: what v-3 tells React, what React drives
  styles/figures.css        the constraints section; styles/explainers.css the gallery
  components/
    ConstraintsSection.tsx  City Constraints: the zoomed walk + branch analysis
    ExplainersContent.tsx   the Explainers view: v-3's masthead, the gallery, one explainer
    pages/                  ConstraintNarrative, BranchAnalysisPage, the walk's layouts
  explainers/               the Visual Explainers (diagnostic tree, read a city)
```

The Growth Lab logo and the landing image are v-3's own, copied by the port script.
