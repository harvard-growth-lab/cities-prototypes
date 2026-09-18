# Cities Tool — app

Production app for the Growth Lab Cities Tool: the React rebuild of Nil's
`cities-v-1` prototype on `main`, driven by the City Atlas data bundle.

```sh
pnpm install
pnpm data       # data/city_atlas/**.parquet → public/data/** (DuckDB, ~10 s)
pnpm dev        # http://localhost:5173
pnpm build      # tsc -b && vite build (copies public/data into dist)
pnpm typecheck
pnpm lint       # oxlint
node scripts/shots.mjs --base http://localhost:5173 --routes /,/city/boston-ma/fundamentals --widths 390,768,1440
```

Node 22+ (`.node-version`). Copy `.env.example` to `.env` to override the basemap style.
`pnpm data` needs the atlas bundle in `data/city_atlas/` (gitignored, 390 MB — see
`data/city_atlas/README.md` for how it is exported from the `cities-tool` repo).

## Data

The atlas ships as parquet, one folder per country. The app never reads parquet: `scripts/build-data.ts`
(DuckDB via `@duckdb/node-api`, type-checked by `tsconfig.scripts.json`) slices it once into static JSON
under `public/data/` (gitignored, ~120 MB, 17,720 files), and the app fetches one file per view with
TanStack Query. The shapes are the TypeScript contracts in `src/data/types.ts` — the script builds every
object under those types, so a field added to the contract is a field the script must fill.

| file | what | size |
|---|---|---|
| `index.json` | every metro: slug, display name, principal place, centroid, diagnosis (growth rates, quadrant, borderline, supply side), plus the window, the cross-metro medians and borderline bands, the all-US-metros benchmark rates and the `counts` behind "rank n of N" | 170 KB |
| `national.json` | the industry dictionary (name, supersector, tier, PCI, tradability), national employment by industry and year, the all-metros benchmark series, lever medians, amenity fits, patent/publication labels | 130 KB |
| `metros/{id}.json` | one metro: panel, housing, diagnosis, amenity residual, the places summary (columnar), industries over the window (columnar), shift-share, opportunities, complexity, outlook, innovation, firm dynamics, remoteness, inputs, crime, education, air | 52–235 KB |
| `places/{id}.json` | one place: panel, housing, commute totals, diagnosis, amenity residual, crime, education, air, job accessibility, features | ~6 KB |
| `geo/metros/{id}.json` | GeoJSON: the metro polygon and its places (5 dp) | 2–600 KB |

Conventions worth knowing (the full account is in `data/city_atlas/README.md` and the CATALOG):
ids are strings with leading zeros; a missing value is `null`, never 0; rates are fractions
(`0.0057` = +0.57 %/yr); the window is 2014→2024 and each diagnosis snaps to the nearest year with data,
so the years read are carried beside every rate; industries are 4-digit NAICS (the atlas ships no sector
names — `src/data/sectors.ts` maps 2-digit prefixes to the ten supersectors the treemap groups by);
`metro_name` has no state and collides (four Springfields), so the URL slug is `name-state` of the
principal place (`boston-ma`). Place home values are pinned to the window's end year so levels match
the cost growth; the housing series runs on into a partial 2026.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite 8 + React 19 + TypeScript | `create-vite` `react-ts` template; Oxlint instead of ESLint (create-vite's current default, ~50× faster) |
| Routing | TanStack Router (file-based) | `@tanstack/router-plugin` generates `src/routeTree.gen.ts` from `src/routes/**`. **Commit the generated file** — `tsc -b` needs it before Vite runs. `autoCodeSplitting` splits every route (maplibre only loads on `/explore`). |
| URL state | TSR `validateSearch` + Zod 4 | Search params are typed end-to-end: `<Link search>` / `useNavigate` are checked against the schema, `Route.useSearch()` returns parsed values. Zod 4 is a Standard Schema, so no adapter package is needed. See `src/routes/explore.tsx`. |
| Server state | TanStack Query 5 | `queryClient` is passed as router context, so route loaders can `context.queryClient.ensureQueryData(...)` and components use `useSuspenseQuery`. `defaultPreloadStaleTime: 0` on the router so Query owns freshness. |
| Map | MapLibre GL 6 + `@vis.gl/react-maplibre` 8 | Only `src/components/map/city-map.tsx` imports maplibre (lazy chunk). Basemap defaults to OpenFreeMap Positron (free, no key) via `VITE_MAP_STYLE`; the worker URL is set explicitly (`?worker&url`) because maplibre's own `import.meta.url` resolution 404s under Vite. |
| Viz | d3 (math only) | d3 for scales, shapes, treemap layout and geo bounds; React renders every SVG. Import from `'d3'` (tree-shaken; pnpm does not expose the sub-packages at the root). Figure colours come from `src/lib/palette.ts`. |
| Styling | Tailwind 4 (`@tailwindcss/vite`) + shadcn/ui (Radix base, copy-in components in `src/components/ui/`) | The prototype's tokens live in `src/styles/index.css` under `@theme` (`bg-teal`, `text-ink-soft`, `border-line`, `text-geo-metro`, `text-rise`, the fluid type roles `text-h3`…) and the shadcn semantic tokens point at them (`--primary` = teal, radius 4px). `cn` is `createCn` from `cn/config` so the merge engine knows the type roles. |
| Devtools | `@tanstack/react-devtools` | Router + Query panels in one shell; lazy-loaded in dev only (`src/routes/__root.tsx`). |
| Paths | `@/` → `src/` | Configured in both `tsconfig.app.json` and `vite.config.ts`. |

## Routes

The section model is `src/lib/sections.ts` — one list drives the section bar, the pager, the
Learning Journey and the routes. Each section is a route under the tool shell; the beats inside a
section are anchors (`#b2`) that the scroll-spy `replace`s into the URL while deliberate navigation
(chips, pager, journey) `push`es. The scroller is `<main id="pages">`, not the window.

```
/                                landing: metro picker + verdict card ("Boston is a Magnet")
/city/$slug                      tool shell: sticky section bar + pager; ?place=<id> picks the admin
                                 city (default: the metro's principal place); ?journey opens the journey
/city/$slug/fundamentals         1 Economic Fundamentals — split layout beside a sticky map
/city/$slug/industries           2 Metro Industries — scrolly with one shared industry figure
/city/$slug/admin                3 Admin Industries — scrolly: the two workforces, then the dial
/city/$slug/constraints          4 Constraints Diagnosis — the metro scatter, the burst, cost vs pull
/city/$slug/levers               5 Levers for Change — the diagnostic tree, opportunities, evidence
/explainers, /explainers/$id     gallery (registry in src/explainers/registry.ts; empty for now)
```

Unknown slugs 404. The shell's loader ensures `index.json`, `national.json` and the metro file before
rendering and prefetches the geo and the admin place.

## Sections — what was kept from the prototype, and the liberties taken

The prototype (`cities-v-1` on `main`) is Boston with authored numbers; the app reads any of the
387 metros from the atlas, so copy is interpolated and every number is computed. Where the atlas has no
data for a prototype figure, the figure is replaced rather than faked:

- **Economic Fundamentals** keeps the split composition, the population index chart (admin vs all US
  metros, then the metro line drawing itself in), the anchor card and the places table with map picking.
  Peer cities are dropped (no peer definitions in the atlas); a wage chart is added.
- **Metro Industries** keeps the one shared figure that moves between three states (traded treemap →
  tier cards → top-12 RCA ranking) with the View / Color by / Sort by controls and the tier donut. The
  ranking's peer averages are dropped; Information is kept as its own sector.
- **Admin Industries** builds the prototype's opt-1 dots narrative (jobs → who fills them → residents out
  → two workforces) from `place_commute`, then a "Workplace, or dormitory?" dial with the metro's places
  ranked by jobs per resident worker. The exchange map and the sector bars are not buildable: the atlas
  ships neither partner flows nor a place sector composition.
- **Constraints Diagnosis** keeps the metro scatter (all 387 metros, real medians and borderline band,
  the quadrant buttons and the diagnostic explainer), the burst into the metro's places, and replaces the
  lorem third beat with the supply-side split (cost growth against the typical metro) and the amenity
  residual for metro and admin city.
- **Levers for Change** was a stub; it now walks the diagnostic tree from the diagnosis, plots the
  metro's absent industries by relatedness density × PCI, and lays out the remaining atlas modules as an
  evidence board (firm dynamics, innovation, remoteness, inputs, education, crime, air, job access).
- Every section ends with the prototype's checkpoint (three quiz questions computed from the data, and
  "Put your insights" saved to the Learning Journey in localStorage).
- Not built: the hidden intro quiz, the Extras section (RCA distributions), Stat Chat, the explainers'
  content, the reviewer-only opt-n toggles.

The quadrant vocabulary (`src/lib/quadrants.ts`) maps the atlas's `demand_positive` /
`demand_negative` / `supply_positive` / `supply_negative` onto the prototype's three registers:
the landing's Magnet / Leak / Sponge / Fortress, the scatter's Boomtown / Cooling off / Lifestyle magnet /
Held back, and the explainer's Positive Demand Shock / … .

## Layout

```
src/
  main.tsx, router.tsx    providers + RouterProvider; routeTree.gen.ts is GENERATED (commit it)
  routes/                 file routes; city.$slug.tsx is the tool shell; one file per section
  sections/<section>/     everything one section owns: its beats, figures, copy, quiz
  components/
    ui/                   shadcn/ui (do not edit by hand; `pnpm dlx shadcn@latest add <name>`)
    chrome/               toolbar, section bar, metro picker, pager, journey + geo dialogs, icons
    beats/                SectionPage, Beat, GeoBadge, StatRow, Explainer, Checkpoint, Scrolly, SplitLayout
    charts/               ChartFrame + useMeasure, useChartTooltip, axes, Legend
    map/city-map.tsx      the MapLibre map (metro dashed, admin solid, places picker)
    landing/              the diagnose panel
  data/                   types.ts (the contracts), queries.ts (Query options + hooks), derive.ts, sectors.ts
  lib/                    sections, quadrants, palette, format, journey (localStorage), use-tool-state, scroller
  styles/index.css        tailwind + theme tokens + shadcn variables
scripts/
  build-data.ts           the atlas → public/data pipeline (pnpm data)
  shots.mjs               playwright screenshots at 390/768/1440 with a horizontal-overflow check
```

## Carried over from the `tz-*` branches

Tammy's three branches (`tz-prototypes` → `tz-prototypes-2` → `tz-tree-quadrants`)
are the React prototypes. What this app takes from them, and what it
deliberately doesn't:

**Adopted**

- **Section model → routes** (above). Both `App.tsx` versions hand-roll hash
  routing (~150 lines: deep links, push-vs-replace, explainer slugs). TanStack
  Router replaces all of it; the one rule worth keeping is *scroll-spy
  replaces, deliberate navigation pushes*.
- **Explainer registry** (`tz-prototypes-2/src/explainers/registry.ts`) →
  `src/explainers/registry.ts`, unchanged in shape; `/explainers/$id` validates
  against it.
- **Tool shell structure** (`tool.css`, `port.css`): `100dvh` column → an
  inner scroller that is the scroll root (not `window`); `overflow-x: clip` so
  nothing widens the frame. Encoded in `routes/city.$slug.tsx`. The chrome is
  `cities-v-1`'s: the masthead scrolls away, the section bar sticks.
- **Breakpoints**: 640 (phone) and 920 (narrow) from the Sept 2026
  small-screen work. `sm` is Tailwind's 640; `narrow` is added in `@theme`.
  Rules are desktop-first (`max-narrow:`), matching how the prototypes wrote
  them. `src/lib/use-media-query.ts` exposes the same lines to JS.
- **GL chart palette** (`citytool/lib/glColors.ts`, itself a copy of the
  Growth Lab design grammar) → `gl-*` tokens in `@theme`, kept for future
  figures; the section figures use the prototype's own palettes
  (`src/lib/palette.ts`) so they match `cities-v-1`.
- **Formatters** (`citytool/lib/format.ts`) → `src/lib/format.ts`
  (Intl-based compact numbers, currency, pct/pp, rates, multiples).

- **`scripts/shots.mjs`** (`tz-tree-quadrants`): rewritten for this app —
  playwright-core screenshots at 390/768/1440 with a horizontal-overflow check
  per route. Good CI candidate.
- **Small-screen conventions** from `port.css`: dialogs go full-screen ≤640,
  dense 880-unit figures keep a 600–660px measure and scroll inside their
  stage, the scrolly stage pins to the bottom of the viewport under 920.

**Worth porting later**

- The tree and read-a-city explainers (`framer-motion`-based) into
  `src/explainers/`, which is wired but empty.

**Not adopted**

- `src/legacy/` on `tz-tree-quadrants` — the `cities-v-3` HTML shell run
  verbatim with React portals into two slots. A bridge to keep design work on
  `main` and React work in sync; the production app rebuilds the shell.
- `react-router-dom`, `react-leaflet`, `recharts` (`tz-prototypes`) —
  superseded by TanStack Router, MapLibre, d3.
- Global stylesheets with hand-named classes (`tool.css`, `figures.css` at
  80KB). Chrome and layout move to Tailwind; figure CSS that is genuinely
  bespoke should become CSS Modules beside the component, not be rewritten
  as utilities.
- The 20-prop drill from `App.tsx` into `ToolView` (`city`, `span`,
  `treeMode`, `branchPath`, …). Every one of those is a shareable pick, so it
  belongs in the URL: `$slug` is a path param, `place` is a search param on
  the shell, beats are hashes. That is the concrete case for *not* adding a
  store.

## Decisions made (were "open" in the scaffold)

- **UI components: shadcn/ui** (Radix base, `components.json`), themed to the prototype's tokens.
  Segmented controls are `ToggleGroup`, menus `Select`/`Popover`+`Command`, explainers `Collapsible`,
  overlays `Dialog`; cursor-following chart tooltips are a small custom hook, not Radix `Tooltip`.
- **Charts: d3 for math, React for SVG**, no chart library. Each figure is one component over a fixed
  viewBox; the palettes in `src/lib/palette.ts` are the prototype's (sectors, tiers, complexity ramp).
- **Global client state: none.** Shareable state is in the URL (`$slug`, `?place`, `?journey`, `#beat`),
  atlas data in TanStack Query, the reader's journey in localStorage, everything else local. Add zustand
  only if a hovered/brushed selection ever has to be shared between a map and a chart.
- **Static data, not a database.** The atlas is small enough per view (≤ 235 KB per metro) that a CDN of
  JSON beats a query service; regenerate with `pnpm data` when the bundle changes.
- **Prerendering: not yet.** TanStack Router is SPA-only here; TanStack Start remains the option if
  landing pages need SEO.
