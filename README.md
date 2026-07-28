A shared repository for housing prototypes related to the 2026–2027 Bloomberg Cities project.

## Running

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # tsc -b + vite build
```

The app is a single-page hash router (`src/main.tsx`) with four views:

- `#/` — **CityStory**, the Growth-Lab city diagnosis (the landing page)
- `#/concepts` — **Concepts**, four takes on the framework: seven pixel-art explainer toys, the same seven ideas as interactive-textbook figures, a sketchbook of twenty experimental mini-prototypes, and a "pocket textbook" of fifty interactive micro-pages on the wider urban-economics shelf (M1–M50, `MicroFigsA–E.tsx`)
- `#/tree` — **Tree Prototypes**, three renderings of the Figure-27 diagnostic tree: a wall chart (hover & pin), a zoomable dial, and a metro map. Linked from the prototype-settings drawer on the city profile.
- `#/story` — **ReadCity**, a scrollytelling narrative

## Project structure

```
src/
  main.tsx          hash router + view switch, theme loading
  app-shell.css     global chrome (corner bar, prototype-settings drawer)

  citytool/         View 1 — the city profile
    pages/ components/ lib/ data/ geo/ styles.css
  concepts/         View 2 — the concept toys
  treelab/          View 3 — the diagnostic-tree design explorations
  readcity/         View 4 — the scrollytelling story (+ skyline/street scenes)

  learning/         the quiz / diagnostic layer shared into CityStory
    data/ content/  illustrative Boston data, figures + quiz definitions
    journey.tsx settings.tsx    answer persistence + the settings drawer
    QuizBits / QuizRecap / InstrumentCards / DragDot / TreeWalk / PizzaChart …

  pixel/            low-level pixel-canvas graphics lib (Views 2 & 3)
```

Dependencies flow one way: `citytool/` and the concept/story views depend on
the `learning/` and `pixel/` substrates, never the reverse.
