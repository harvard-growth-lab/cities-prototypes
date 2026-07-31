# Cities Tool

A shared repository for housing prototypes related to the 2026–2027 Bloomberg Cities project.

This branch is a React + TypeScript (Vite) port of the `V2_With_intoquiz` static prototype from
the `nt-prototypes` branch: a landing page that slides up into the Cities Tool — an intro quiz,
a scroll-driven city → MSA map overview, export visualizations, a "Put in Practice" reflection,
a Visual Explainers gallery, a My Learning Journey window, and an experimental Data Chat.

## Running

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # tsc -b + vite build
```

## Project structure

```
src/
  main.tsx                  entry point; imports the split stylesheets
  App.tsx                   view switching (landing <-> tool), city/span, journey state
  data/content.ts           all copy, options, indicator data, and sample journey state
  lib/downloads.ts          insights .txt and chat .csv download helpers
  styles/                   the original prototype CSS, split by area
  components/
    Landing.tsx             fixed landing view (hero, selectors, jump row)
    ToolView.tsx            toolbar + rail + scrolling pages; scroll spy
    Toolbar.tsx  Rail.tsx
    ExplainersView.tsx      Visual Explainers gallery (pixel-city thumbnails)
    icons.tsx               SVG icons shared across components
    pages/
      IntroQuiz.tsx         gapminder-style intro question carousel
      OverviewSection.tsx   two indicator blocks + sticky zooming Leaflet map
      OverviewMap.tsx       Leaflet map, city -> MSA zoom driven by scroll
      IndicatorTable.tsx    animated change-slider tables
      ExportPages.tsx       export basket + complexity viz pages
      VizActions.tsx        Data / Image / Share-link button cluster
      PracticePage.tsx      "Put in Practice" reflection card
    modals/
      JourneyModal.tsx      My Learning Journey window
      DataChatModal.tsx     Data Chat (beta) window
```

Chart images, the Growth Lab logo, and the map backdrop are placeholder assets served from
Figma URLs (see `src/data/content.ts` and the `--map-asset` variable in `src/styles/base.css`).
