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
node scripts/shots.mjs ./shots --widths 390,768,1440   # screenshot every view; flags sideways overflow
```

## Site layout variants (a study)

The five sections fall into two halves of different kinds — **Economic Fundamentals, Metro
Industries, Admin Industries** describe the city (an overview, read); **Constraints Diagnosis,
Levers for Change** diagnose it and act (interactive, built on the first three). On main they
run as one linear flow. `?site=` tries other ways of organising the two halves and marking the
crossing between them; the dark **Site layout** pill at the bottom-left switches between them
(a navigation: the same place in the tool, under another layout).

| `?site=` | what it tries |
| --- | --- |
| *(none)* | **Current** — main's page, untouched: five tabs, one section per page, Prev / Next |
| `scroll` | **One scroll** — every section on one page; the tabs carry their part's name and follow the scroll; a full-screen **threshold band** marks part two (what you bring → what you do with it); each section closes (quiz + insight) where it ends |
| `chapters` | **Chapters** — one section per page, Prev / Next kept; the crossing is a **title page in the pager's sequence** (in both directions), the pager's line and buttons mark the seam, the tabs carry their part's name |
| `modes` | **Two modes** — the bar's first choice is the half: the profile is one scroll browsed in any order (no numbers, no checks), the diagnosis is stepped (1 → 2, Prev / Next) and wears the bar dark, with the **profile on call** as a panel; the profile ends on a hand-off |

Copy is placeholder throughout. The part names ("City profile", "Diagnose & act") are working
labels, written once in `src/site/variants.ts`. How it is built: `src/site/` (the variants, what
they answer v-3's section switch with, what they draw), `src/styles/site.css`, and one patch
group in `scripts/v3/port.mjs` ("site variants") — every question the switch asks falls back to
main's behaviour, so with no variant chosen the page is main's.

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
scripts/v3/port.mjs         regenerates src/legacy from a checkout of main's cities-v-3
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
  site/                     the site-level layout variants (?site=): variants.ts the study,
                            runtime.ts what v-3's section switch is answered with, SiteLayer.tsx
                            what they draw; styles/site.css
  components/
    ConstraintsSection.tsx  City Constraints: the zoomed walk + branch analysis
    ExplainersContent.tsx   the Explainers view: v-3's masthead, the gallery, one explainer
    pages/                  ConstraintNarrative, BranchAnalysisPage, the walk's layouts
  explainers/               the Visual Explainers (diagnostic tree, read a city)
```

The Growth Lab logo and the landing image are v-3's own, copied by the port script.
