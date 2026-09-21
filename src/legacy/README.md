# Main's cities-v-1 page, as this app's shell

`cities-v-1/` on `main` — the static prototype, and main's main line — is the
app: its landing, masthead, section tabs and pager, journey window, dialogs
and every section but Constraints Diagnosis run here as they are. React
draws exactly two things into slots inside that markup: **Constraints
Diagnosis** (this branch's section) and the **Explainers** content.

Everything in this folder except `bridge.ts`, `index.ts`, `LegacyShell.tsx`,
`port.css` and the `.d.ts` files is **generated** by `scripts/v3/port.mjs`.
Don't edit the generated files; edit the script and re-run it:

```bash
TMP=$(mktemp -d) && git archive origin/main cities-v-1 | tar -x -C $TMP
node scripts/v3/port.mjs --src $TMP/cities-v-1
```

Last port: `origin/main` at `ceff4f8` (2026-09-17, "Economic Fundamentals
hangs from the same left edge as the top bar on wide screens"). The ports
before it took `cities-v-3` — last at `2994068` (2026-09-09) — which is why
the script's folder and the generated files are still called `v3`: on
2026-09-14 main re-created `cities-v-1/` as an exact copy of `cities-v-3/`
and moved the layout work there, so the source changed folder without
changing lineage, and the names here were kept so nothing had to be rewired.

## What is generated, and how it differs from upstream

| file | what | how it changed |
| --- | --- | --- |
| `html/body.html` | main's `<body>` | Constraints Diagnosis' markup replaced by the slot `#constraints-slot`; the (hidden) rail lists this branch's constraints steps; the explainers view emptied for React; the Explainers button restored to the masthead (main kept its styles and its toggle, but dropped the button); the two city pickers list this branch's cities (Boston only, since Sept 2026); asset and iframe paths under `legacy/` |
| `v3.css` | main's `<style>` | verbatim, but the landing image comes through `--map-asset` (a bundled import) |
| `v3-page.js` | the two inline scripts, in order, as one `initPage()` | the module's preamble sets `window.d3 = d3` — main loads d3 as a `<script src>` global, and `initPlacesInMetro` is the one place in the file that reaches for it off `window`, so with it unset the places table in "Explore the admins in your metro", its picker and the metro's cells on the map all stay empty, silently and with no error (Leaflet's UMD build assigns `window.L` on import; d3's ESM build does not). Every other edit is a `PAGE_PATCHES` entry in the script and marked `[port]` in the output: the constraints ids in `pageIds` / `sectionDefs` / the section switch; three calls that tell React about the city, the page in view and the Explainers tab; the rail highlight resolving scrolly steps; init that main ran on `load` / `DOMContentLoaded` running immediately; the exports at the end; and the **phone section menu** — a button naming the current section and a menu of the five, built beside the tab strip and rendered by `showSection` (Sept 17; the CSS is in `port.css`). (The other small-screen patches of Sept 15–16 are gone: main's page now does all of that itself.) |
| `treemap.js` | the Metro Industries / Extras charts | the IIFE returns its `init()` instead of running it on `DOMContentLoaded` |
| `xch_geo.js` | the metro's boundaries | verbatim |
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
  `enterTool`, `backToLanding`, `toggleExplainers`, `openJourney`, and reads
  `sectionDefs` for the routable ids.
- Hash routing (deep links, the Back button) is this branch's, layered over
  main's navigation; main's page itself has none.

## The site-level layout variants

`src/site/` studies how the tool's two halves are organised (`?site=`; the
repo README has the table). It needs four things of main's section switch,
each a `[port]` patch that **asks** `window.__cities` and falls back to
main's behaviour when nothing answers — so the default page is main's:

- `sectionHidden(k, i)` — which sections stay up with section `i` (one
  scroll keeps the storyline up; the modes keep the profile up);
- `sectionScroll(i)` — aim at a section's start instead of the page's top;
- `closesInline` — the closes (quiz + insight) sit under their sections,
  so the pager stops rendering and wiring "the" close, and `wireSecClose`
  finds a close by the id it already carries (`check-<slug>`) rather than
  by class, since there is more than one;
- `onSection(i)` — the section the switch landed on.

`initPage()` also returns `showSection`, `renderSecClose` and
`wireSecClose` for them. Everything else the variants do is outside the
generated files: a slot before `#constraints-slot`, the closes, two slots
in `.secbar`, and `src/styles/site.css` keyed on `html[data-site]`.

## Not main's

- The **Explainers** content and its masthead (`ExplainersContent.tsx`):
  main's masthead scrolls away inside the pages, so the explainers view
  carries its own copy. The gallery and the two explainers are this branch's.
- The **city list** is this branch's: Boston only (since Sept 2026 — the one
  city the diagnostic tree, the Drivers charts and the Amenities Module all
  have real data for; there were four sample cities until then). Main's
  sections carry Boston's figures whichever city is picked anyway, as they
  do on main.
- `port.css`: three shell rules — the wrapper has no box, a deep link enters
  without the landing's slide, and the constraints stage sticks under main's
  section bar at the height main publishes as `--chrome-h` — and the
  **phone section menu**. Main's stylesheet has carried its own width rules
  since 2026-09-17 (1199 / 899 / 599), so the shell is main's at every width
  with one exception: at main's mobile tier (≤599px) its tab strip has
  ~165px beside the location chip and cuts every tab but the current one, so
  here the strip stands down and the sections collapse into a button naming
  the current section, with a menu of the five under the bar (a check behind
  you, the current one on the tint, numbers ahead — the tabs' own state
  language). With it, one fix to main's chip below 1199px: its button kept
  a desk width of 300px inside a wrapper of 184 / 158, and the overhang lay
  under the tabs (its chevron peeks out between them on main) and under the
  menu's button here. Both are candidates to move upstream. The React
  section keeps its own two breakpoints (920 / 640) in
  `src/styles/figures.css`.
