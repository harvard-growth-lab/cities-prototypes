A shared repository for housing prototypes related to the 2026–2027 Bloomberg Cities project.

## Running

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # tsc -b + vite build
```

The app is a single-page hash router (`src/main.tsx`) with three views:

- `#/` — **CityStory**, the Growth-Lab city diagnosis (the landing page)
- `#/concepts` — **Concepts**, a grid of bite-size explainer toys
- `#/story` — **ReadCity**, a scrollytelling narrative

## Project structure

```
src/
  main.tsx          hash router + view switch, theme loading
  app-shell.css     global chrome (corner bar, prototype-settings drawer)

  citytool/         View 1 — the city profile
    pages/ components/ lib/ data/ geo/ styles.css
  concepts/         View 2 — the concept toys
  readcity/         View 3 — the scrollytelling story (+ skyline/street scenes)

  learning/         the quiz / diagnostic layer shared into CityStory
    data/ content/  illustrative Boston data, figures + quiz definitions
    journey.tsx settings.tsx    answer persistence + the settings drawer
    QuizBits / QuizRecap / InstrumentCards / DragDot / TreeWalk / PizzaChart …

  pixel/            low-level pixel-canvas graphics lib (Views 2 & 3)
```

Dependencies flow one way: `citytool/` and the concept/story views depend on
the `learning/` and `pixel/` substrates, never the reverse.
