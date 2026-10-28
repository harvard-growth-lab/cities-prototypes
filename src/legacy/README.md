# Main's cities-v-5 page, as this app's shell

`cities-v-5/` on `main` — the static prototype, and the folder main's work
happens in — is the app: its landing, masthead, section tabs and pager, journey window, dialogs
and every section but Constraints Diagnosis run here as they are. React
draws exactly two things into slots inside that markup: **Constraints
Diagnosis** (this branch's section) and the **Explainers** content.

Everything in this folder except `bridge.ts`, `index.ts`, `LegacyShell.tsx`,
`port.css` and the `.d.ts` files is **generated** by `scripts/v3/port.mjs`.
Don't edit the generated files; edit the script and re-run it:

```bash
TMP=$(mktemp -d) && git archive origin/main cities-v-5 | tar -x -C $TMP
node scripts/v3/port.mjs --src $TMP/cities-v-5
```

Last port: `origin/main` at `43efd4b` (2026-10-23, "Who am I? and Worker
Flows in v-5: commuting counts rounded; stats open on the lines; compare as
lines with ranks"), from `cities-v-5` — taken so everything but Constraints
Diagnosis is main's current page. The ports before it took `cities-v-5` at
`7a7d6bc` (2026-10-01), `cities-v-1` — last at `ceff4f8` (2026-09-17) — and
before that `cities-v-3`, last at `2994068` (2026-09-09), which is why the
script's folder and the generated files are still called `v3`: main copied
v-3 to v-1 on 2026-09-14 and v-1 to v-5 on 2026-09-21, so the source changed
folder twice without changing lineage, and the names here were kept so
nothing had to be rewired.

What came with the 2026-10-23 port, beyond the sections themselves (section
1 is now **Who am I?**, with data files of its own): main's **layout** runs
as main has it — **Two scrolls** by default (each part one scroll, a teal
close under each section, a band opening part two, the pager at the foot of
part two), `?layout=pages` / `?layout=scroll` for the other two — and its
**section bar by part**, which folds into a menu wherever its row does not
fit. Until then this branch held main's layout study dormant and ran its own
(`?site=`, `src/site/`), of which main's is a copy; main took it in whole,
so the branch's was retired, along with its phone section menu (main's fold
does that job now).

One thing in v-5 is still switched off here: its **section links**
(`#metro-industries`) stand down for this branch's hash routing (a `[port]`
patch; the code stays in the page, dormant). Main's take-aways for sections
4 and 5 describe its own drafts of them, so a patch swaps those two closes'
points for placeholders. Main's two one-line **flag scripts** (`?colours=`
in its head, `?landing=full` after the landing) run first thing in
`initPage()`, since markup set as HTML never runs a script.

## What is generated, and how it differs from upstream

| file | what | how it changed |
| --- | --- | --- |
| `html/body.html` | main's `<body>` | Constraints Diagnosis' markup replaced by the slot `#constraints-slot`; the (hidden) rail lists this branch's constraints steps; the explainers view emptied for React; the Explainers button restored to the masthead (main kept its styles and its toggle, but dropped the button); the two city pickers list this branch's cities (Boston and, since 2026-09-24, the three placeholder cities); asset and iframe paths under `legacy/` |
| `v3.css` | main's `<style>` | verbatim, but the landing image comes through `--map-asset` (a bundled import) |
| `v3-page.js` | the two inline scripts, in order, as one `initPage()` | the module's preamble sets `window.d3 = d3` — main loads d3 as a `<script src>` global, and `initPlacesInMetro` is the one place in the file that reaches for it off `window`, so with it unset the places table in "Explore the admins in your metro", its picker and the metro's cells on the map all stay empty, silently and with no error (Leaflet's UMD build assigns `window.L` on import; d3's ESM build does not). Every other edit is a `PAGE_PATCHES` entry in the script and marked `[port]` in the output: the constraints ids in `pageIds` / `sectionDefs` / the section switch; three calls that tell React about the city, the page in view and the Explainers tab; the rail highlight resolving scrolly steps; init that main ran on `load` / `DOMContentLoaded` running immediately; main's hash writer and router standing down; the take-aways of the last two closes as placeholders; the pager's line keeping to the storyline's five stops; and the exports at the end. Main's two flag scripts open the function. (The small-screen patches of Sept 15–17 and the hooks of this branch's own layout study are gone: main's page does all of that itself now.) |
| `treemap.js` | the Metro Industries / Extras charts | the IIFE returns its `init()` instead of running it on `DOMContentLoaded` |
| `xch_geo.js`, `who-2024.js`, `who-scatter-2024.js`, `who-metro-scatter-2024.js`, `who-points-2024.js`, `who_commute_geo.js`, `industries-2024.js`, `industries-2014.js` | the data scripts main's page loads (`DATA_SCRIPTS` in the port script): the boundaries, Who am I?'s measures, scatters, map points and commuting outlines, the metro's industry rows — each sets window globals, imported in main's order by `index.ts` | verbatim; a script main adds fails the port until it is listed |
| `assets/`, `public/legacy/` | the landing image, the logo, the framed all-metros page | verbatim |

## The seam

`bridge.ts` is the whole contract. `App.tsx` mounts the body, portals the two
React pieces into their slots, then runs `initLegacy()` once.

- main's page tells React three things, through `window.__cities`: the city
  picked (`onCity`), the page or step in view (`onPage`, from its own scroll
  spy — the React scrolly adds its phase through `markPage`), and the
  Explainers tab opening or closing (`onExplainers`). React uses them for
  the URL hash and for the constraints section's own state.
- React drives the page through what `initPage()` returns: `goTo`,
  `enterTool`, `backToLanding`, `toggleExplainers`, `openJourney`,
  `openGlossary` (the Explainers masthead's Glossary link), and reads
  `sectionDefs` for the routable ids.
- one question main's page asks back: `whoFigureStandIn()` — is one of this
  branch's commuting drawings (`src/commuters/`) standing in for Who am I?'s
  dots? Then the hand-off to the map fills it without a flight (a `[port]`
  patch in `handOff`).
- Hash routing (deep links, the Back button) is this branch's, layered over
  main's navigation. Main's v-5 has section links of its own, coarser (one
  per section, always replaced); they are unwired here so the two do not
  write the same address bar.

## Not main's

- The **Explainers** content and its masthead (`ExplainersContent.tsx`):
  main's masthead scrolls away inside the pages, so the explainers view
  carries its own copy. The gallery and the two explainers are this branch's.
- The **city list** is this branch's: Boston — the one city the diagnostic
  tree, the Drivers charts and the Amenities and Innovation Modules all have
  real data for — and, since 2026-09-24, three **placeholder** cities, City
  A, City B and City C, one per ending Boston does not take, with made-up
  dials and no module data (`src/data/placeholderCities.ts`; the landing's
  verdict for each is the "city hints" patch in the port script). There were
  four sample cities before Sept 2026, then Boston alone. Main's sections
  carry Boston's figures whichever city is picked anyway, as they do on main.
- `port.css`: three shell rules — the wrapper has no box, a deep link enters
  without the landing's slide, and the constraints stage sticks under main's
  section bar at the height main publishes as `--chrome-h` — and a floor
  for the Levers placeholder. Main's stylesheet has carried its own width
  rules since 2026-09-17 (1199 / 899 / 599), so the shell is main's at every
  width; the phone section menu and the chip fix this file carried until
  2026-10-23 went when main's bar learned to fold and its chip to keep to
  its box. The React section keeps its own two breakpoints (920 / 640) in
  `src/styles/figures.css`.
