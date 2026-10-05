# Hand-off: cities-prototypes

Written 2026-09-29 and brought up to date on 2026-10-03, for whoever
continues this work in a fresh Claude session (new
account, no memory of the previous ones). Everything below is what the
previous sessions knew and had agreed with Nil. Read this file first, then
`handoff/studies.md` and `handoff/memory-notes.md`; the opening message
Nil sends a new session is `handoff/START-HERE.md`.

Repo: `git@github.com:harvard-growth-lab/cities-prototypes.git`, branch `main`,
238 commits at hand-off; the last code change is `87a1774` (2026-10-02,
the tiers' shares on the chart), and the commit after it carries this
note. Local checkout:
`/Users/nit880/Documents/cities-prototypes`. The sketch pages at the repo
root are **untracked and only on this machine**; the ones that record
open or recent decisions are copied under `handoff/sketches/` (tracked,
paths adjusted) so a fresh clone or a worktree still has them.

---

## 1. What this is

A design prototype of a "City Diagnosis" tool for the Growth Lab: one long
single-page site that walks a reader through a city's economy in five
sections — *Who are you?*, *Metro Industries*, *Worker Flows*, *Constraints
Diagnosis*, *Levers for Change* — plus an *Extras* section outside the
storyline. It is a prototype for design review, not production code, but it
runs on real data and every interaction is expected to work.

The reference build it follows is https://cities.taimur.sh (its numbers, its
industry map, its wording). Where this prototype departs from it, it does so
by explicit design decisions recorded in the commit messages.

## 2. Which folder is live

**`cities-v-5/` is the only folder to edit.** Everything else is a frozen
record:

| Folder | Status |
|---|---|
| `cities-v-5/` | **the working line since 2026-09-22**, an exact copy of v-1 at that date, self-contained (all paths relative to its own folder) |
| `cities-v-1/` | frozen: the 2026-09-14 → 09-21 line (layout round) |
| `cities-v-3/` | frozen: design option C |
| `cities-v-2/`, `cities-v-4/` | earlier variants; v-4 was an "Option A" overview rebuild |
| `nt-prototypes/` | separate, untracked prototypes |
| repo-root `*.html` sketch pages | **untracked by convention**; design studies, see §8 |

Never edit v-1…v-4 unless asked by name. When Nil describes a change without
naming a folder, it means v-5. Commit with an explicit
`git add cities-v-5/index.html cities-v-5/treemap.js` (plus whatever else
changed), never `git add -A` — the root is full of untracked sketches.

The two files that matter:

- `cities-v-5/index.html` — ~12,550 lines: all markup, all CSS, and all page
  script (landing, section switching, scrolly engines, the quiz system, the
  Overview map, the commute maps…).
- `cities-v-5/treemap.js` — ~6,450 lines: the Metro Industries figure
  (`initIndustryFigure`) and the Worker Flows figure that shares its grammar.
- `cities-v-5/industries-2024.js`, `industries-2014.js` — the data (§6).

## 3. Running and verifying

**Serve the repo root** at http://127.0.0.1:8912/ with a no-cache Python
server. `.claude/launch.json` has it as the `prototypes` configuration
(`python3 -c "…SimpleHTTPRequestHandler with Cache-Control: no-store…"`,
port 8912). The site is then at http://127.0.0.1:8912/cities-v-5/ . The
desktop app **stops this server on its own** every hour or two (five times
on 2026-09-30); when a page stops answering, start it again before
blaming the page — Nil says "run the localhost".

**How to reach the figure programmatically** (three traps, all in the site,
not in any harness):

1. The tool is `display:none` until `enterTool('page-export-basket')` (or
   any section id) is called. `goTo()` alone marks the section but never
   reveals `#tool`, so the figure measures 0 wide and everything reads zero.
2. `.pages` is the scroll container and uses `scroll-behavior: smooth`, which
   headless Chrome does not tick. Set
   `document.querySelector('.pages').style.scrollBehavior = 'auto'`,
   `scrollIntoView({behavior:'instant'})` the target `.ct-step`, then dispatch
   a `window` `resize` so the figure remeasures.
3. Drive the Metro Industries figure with `window.MI.setStep(n)`:
   0 = whole-map beat, 4 = tiers beat, 6 = ranking beat (the scrolly maps
   its three beats to exactly those). Give paints ~2.5 s before reading.

**The in-app browser pane was unreliable** on 2026-09-29: its emulated
viewport kept being cleared mid-batch, and every reset threw the site back
to the landing page. The previous session therefore verified everything in
**headless Chrome over the DevTools protocol** with a ~40-line Node harness.
It is preserved verbatim as `handoff/verify-harness.mjs`, with a worked test
module `handoff/verify-example.mjs`. Run:

```
S=/tmp/shots node handoff/verify-harness.mjs handoff/verify-example.mjs "http://127.0.0.1:8912/cities-v-5/"
```

`PRELOAD=<file>` runs a script in the page before its own, to stage data the
source does not have (2026-10-05: a setter on `window.BOSTON_INDUSTRIES_2024`
that put two of beat 3's twelve behind their peers, to draw the left-hand bars).

Notes on the harness: Chrome is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`;
it needs `--remote-allow-origins=*`; `const`/`let` at the top level of a
`Runtime.evaluate` persist between calls, so wrap expressions in an IIFE;
clips below the first viewport need `captureBeyondViewport: true` (already
set); `elementFromPoint` only sees the viewport, so scroll a frame into view
before probing it; count visible cells via `#miTreemapSvg g.mi-mcell` rect
opacity. A review agent once overwrote the harness file in a shared
scratchpad — keep your copy under a distinctive name.

**Verify before claiming done.** The standing practice: after every change,
drive the real page (not a mock) through the golden path and the edge cases,
read computed styles and geometry, take a clipped screenshot and look at it.
Type checks are not feature checks.

**Accessibility is measured, not judged.** `handoff/contrast-audit.js` is an
auditor injected into the page: `window.__audit()` walks every text node
(and every field's value and placeholder), composites the real colour under
each word — the HTML ancestors' backgrounds with their opacity, and for SVG
text every filled shape painted beneath its centre (`isPointInFill`, so an
arc's hollow does not count) — and applies AA (4.5 to 1, or 3 for large
type); `window.__controls()` reads the edge of every field for 1.4.11.
`handoff/contrast-run.mjs` drives it through 47 states — every section's top
and beats, the three Metro Industries steps under both colourings and both
palettes, the sentence row, Ranked, the key hidden / as a card / zoomed, an
emptied ground, a cancelled tier, the opt panel, the table, the journey and
explainer overlays, the city picker, the geo map, Worker Flows steps 7–10,
the pager, the quiz with an answer, and the first section at phone width —
and writes `$S/contrast-results.json` (`rows` are the distinct failing
pairs, sorted by ratio). Run:

```
HARNESS_MS=900000 S=/tmp/shots node handoff/verify-harness.mjs handoff/contrast-run.mjs "http://127.0.0.1:8912/cities-v-5/"
```

The last line of the output reports `distinctFailures`; it was 0 at hand-off
(`ef7258d` fixed the 137 pairs it first found; re-run 2026-09-30: 47 states,
0; last re-run 2026-10-02 on `16cc5b7`, the new layout and type sizes: 47
states, 0). It takes about two minutes, so pass `HARNESS_MS` — the harness's default
150 s is too tight to trust. `controls` in the JSON lists every field's edge
ratio; the one under 3 at hand-off is a year select on the teal tint
outside Metro Industries (`.viz-controls--export`, 2.99 — the
`--control-edge` item in §8). It does **not** measure
non-text contrast — rings, edges, chart marks — nor focus-ring clipping;
those were done once by agents on 2026-09-30 and what is still open from
that pass is in §8.

**Review practice.** For anything substantive the previous sessions ran a
multi-agent review: three lenses (e.g. JS lifecycle / CSS & layout / a11y &
interaction) each reporting ≤5 concrete defects with file:line, then one
adversarial verifier per finding told to *refute* it and to treat
pre-existing conditions as not-real. Confirmed findings were fixed in a
follow-up commit. This caught real regressions every time (a shadowed `on`
helper, bars ignoring the zoom, a phone band covering a panel, a 230 ms
click timer swallowing keyboard activations). Keep doing it. One caution
from 2026-10-02: four reviewers each told to cover 15–18 screen sizes and
a dozen states stalled (the workflow gives up on an agent after ten
minutes without progress, six times over); only the narrowest brief
finished. Give each agent a few sizes or one concern, and more agents.
The review of the layout change is kept as
`handoff/review-layout-type.workflow.js` for re-running (§8, item 0c).

There is one known, pre-existing console error on load: a 404 for
`/favicon.ico`. It is not from any of this work.

## 4. The Metro Industries figure — how it is built

This is where most of the recent work lives. Read `treemap.js` from
`function initIndustryFigure` with this map in hand.

**Beats and steps.** The section is a scrolly built by `mount()` in
index.html (`function build()` / `activate(i)` / `restore()`): three text
beats in a left column (`.ct-step`, each opening with an eyebrow
"Metro Industries **1/3**"), the figure lifted into a sticky stage on the
right. The column is 336 px at a desk and fluid below it; see "The grid,
the frame and the type floor" at the end of this section. The mount config is `{ pageId:"page-export-basket", ctl:"MI",
noClassic:true, noBadge:true, states:{"2":[0,4,6]} }` — beat → figure step
0, 4, 6. `noBadge` (2026-10-01, at Nil's request): the beats carry no
"Viewing: Boston Metro" tag under their titles and no rule under it, the
prose following the title directly; the button is gone from this page's
head too. The city's section keeps its tag and rule. The
figure's own state machine has steps 0–7; `paint(step)` has a per-step cell
rule (`STATE` table), and `setStep` drops what a beat cannot carry.

- **Step 0** — every industry as a treemap, clustered and coloured by
  sector with the 6-digit industries as its cells (sector → industry;
  since 2026-10-01 no 4-digit group layer between them, at Nil's request),
  `mapFull()`; title "All industries".
- **Step 4** — the same cells sorted into three tier grounds (Traded /
  Partly traded / Local), `mapTiers()` over `clusterRows[k]` into `cardBox`;
  title "All industries, by tier"; each ground is a card with a band
  across its top (the tier's name, then its share of the metro's jobs:
  "Traded 23%"), a `.mi-card-none` line and a × that cancels the tier.
  **The shares live on the chart** (2026-10-02, Nil: "remove the donut
  chart from the second beat, instead put the percentages on the chart").
  The donut that stood under the beat's paragraph, its hover card and the
  "Tier shares" study that switched between the two are gone, with the
  older key of tier names and examples (`#miTradScale`); the beat's text
  is now title, paragraph, questions. `fitBandRef()` measures each name
  and share and, where any ground is too narrow for the two side by side
  with the cross (a phone), sets `bandStacked`: every band then takes a
  second line for the share, and `bandH()` grows by 17px on screen.
- **Step 6** — the ranking of the most specialized tradable industries
  (`R2 = ranking(rankPool(), true)`), with "Sort by" Concentration / Jobs /
  Against peers. The peers are the source's own (2026-10-04, see §6):
  `peerRca` is the metro's concentration measured against its five peer
  metros, and the tick on the concentration view is the peers' own rate
  against the nation, `rca / peerRca`, keyed "The five peer metros
  together". "Against peers" sorts by the lead, `gapOf()`: the metro's
  rate less the peers', both as printed (10.8 − 2.4 = 8.4), drawn from 0
  on the concentration view's own linear axis ("Ahead of the peer
  metros, in times the national rate", ticks +2× … +10×, 0 named "Same
  as the peers"); ahead is teal to the right, behind orange to the left
  (2026-10-05, Nil: "keep the x-axis as how it's in other format", the
  diverging bars of the generated version back, replacing a log axis of
  the ratio). With nothing behind, the domain is the concentration
  view's, so the ticks hold still when the order changes. All 12 are
  ahead in the source (missile parts +10.1, biotechnology R&D +8.4,
  storage devices last at +2.7), so no bar goes left in Boston; of the
  258 industries over 1×, 52 are behind their peers, all lower in the
  ranking. With one behind, `fitGap()` reaches the domain left until the
  longest bar there keeps its label's measured width before the plot's
  edge (refitted with the gutters). The card on a row gives the peers'
  rate and the ratio. The bars and the axis start at 0, and 1×, the
  national rate, is a labelled line over them (item 0f in §8).
  **Fabric coating mills are left out of this ranking** (2026-10-04, Nil:
  "from the last beat, remove the Fabric coating"): `RANK_LEAVE_OUT` in
  `rankPool()`. In the source it is the most specialized tradable
  industry, 12× on 599 jobs; it stays in beats 1 and 2. The list now
  opens with biotechnology R&D and closes with storage devices (4.6×),
  and the paragraph reads "The list opens with R&D in biotechnology …
  then guided missile and space vehicle parts at 10.3 and laboratory
  instruments at 9.0. Specialization is not size: marine fishing reaches
  8.5 times on 74 jobs …". The answers still hold: universities at 4.3×
  miss the 4.6× cut-off, and the twelve employ about 86,000 (86,003).
  `handoff/reference-check.py` prints the source's own top 12, fabric
  coating included.
- Steps 1, 3, 5, 7 are variants not used by the scrolly (7 = the tradable
  cluster alone; 3 = the whole-mix ranking).

**State inside the figure** (all closures in `initIndustryFigure`):

- `secOn` — the sector **filter**: a `Set` of shown sectors or `null`.
  `secShown(d)`, `applySec(next)`, `resetSec`. Hidden sectors leave no hole:
  the map is re-tiled over the rest (`rebuildSecGeo`) and the bars follow
  (`reBars`). The titles do **not** follow (since `feb8814`): "All
  industries" stays as authored under a filter or zoom, and `syncKey` resets
  them from `dataset.title`; the key and the crumbs say what is showing.
- `focus` / `focusGroup` — the **zoom** into one sector, then one 4-digit
  group. `inFocus(d)`, `setFocus(sec, grp)`, `zoomOut()`. Since `f19b23e`
  the zoom is the one isolate on *both* map beats and travels between them
  (`setStep` keeps it for steps 0, 4, 7; the tiers tile over `secShown &&
  inFocus`; a tier the zoom empties says "Nothing here from <name>"). Crumbs
  "All sectors › Sector › Group ×" are written by `syncNote()` into the note
  of the beat that is showing (`#miNote` for step 0, `#miNote4` for step 4)
  — only the showing one, so the faded head holds no tab stops.
- `tierOn` — which of the three grounds are on; `tierListWith(tOn, sOn)`
  filters `byJobsAll` by tier, filter **and zoom**; the "last ground stays
  on" guard probes it.
- `view` — `"map"` or `"alt"` (Ranked bars); `colorBy` — `"sector"` or
  `"complexity"` (complexity colouring hides the key and resets the filter);
  `barSort` — the bars' order.
- **The names' gutter is measured** (2026-10-01). The bars and the ranking
  set their names right-aligned in a gutter on the left. It was a fixed 292
  units (`BML`, `ML`), the width the phone needs with names at 18 units; at
  the desktop's 13 the longest name needs about 200, so about 100 units
  stood empty at the figure's left edge and the chart read narrower than
  the map (Nil's report). Now `barGutter(names)` and `rankGutter(ranked)`
  size it to the widest name it holds at the type the names are set in
  (`measureFor(cls)`: a probe's own `getComputedTextLength` when the
  figure is on screen, a canvas in the same computed font while the page
  is hidden); 292 stays the ceiling. Each set
  of bars keeps its own `{ml, scale}` (`barGeoAll`, `barGeoTrad`), fitted
  inside `drawBars`, and `asBars` reads the matching scale; each ranking
  carries `R.ml` (never narrower than the "Most specialized…" label over
  its leading rows). Names carry `data-max` for `refitNames`.
  `refitGutters()` re-fits and redraws all four when `typeSig()` changes
  (the names' computed font, or blind → measurable): from the debounced
  resize (a width crossing a breakpoint), from `remeasure` only while the
  last fit was blind, and, forced, once the page's face has loaded. It
  closes an open tier menu and keeps a lit row lit; a paint without
  animation now interrupts a transition still running on the cells, whose
  targets would otherwise overwrite the new fit.
- Year: `#miYear` (2024 / 2014) **destroys and rebuilds** the figure over
  the other year's rows. Every listener is attached through the `on()`
  helper, which records disposers. **Never name a local variable `on`
  inside these blocks** — twice now a `const on = () => …` shadowed the
  helper, so `on(el, "mouseenter", on)` ran the handler once at build and
  attached nothing (the key's hover outline, then the phrase highlights).

**The sector key** (`#miSectorKey`, built in the block starting
`const key = document.getElementById(p + "SectorKey")`): one entry per
sector (`button.sk-sec` with swatch + name, `aria-pressed`), a `button.sk-only`
beside each, and `.sk-reset` "Show all". `toggleSec` hides / brings back;
`onlySec` is the zoom (bringing a hidden sector back into the filter first);
hovering an entry outlines the sector's block on the map. Two dressings,
under the "Key actions" study:

- **opt-1 (inline, default)** — option B of `key-actions-sketches.html`
  (`85fe10f`): the entry is the switch, and on hover or focus it unfolds its
  verbs after the name in a `span.sk-verbs` — "Hide · Only"; "Bring back ·
  Only" once the sector is off; "Show all" alone for the last one showing,
  since it cannot be hidden. The verbs stay in the tab order and show a ring
  (`.sk-verbs` opens on `:hover` / `:focus-within`); the key's "Show all"
  (`.sk-reset`) is a tinted button at the row's end. Under opt-2 "Hide"
  stands down (the entry's click is the hide there) and "Only" keeps its
  place for the keyboard, unseen until reached.
- **opt-2 (card)** — hovering or focusing an entry opens a small card over
  it (`div.sk-tip#miKeyTip`, role group; since 2026-09-30): the sector's
  colour block and name, a facts line — "16% of metro jobs · 377K jobs ·
  175 industries", from the whole year's rows whatever the map shows
  (`secFacts`) — and its verbs as light buttons, `.skt-btn[data-act]`:
  "Hide" / "Bring back" and "Keep only", or "Show all" alone for the last
  one showing. The entry's own click still toggles the sector (no 230 ms
  defer, no double-click any more). The card stays while the pointer or a
  keyboard-placed focus is in it (`laterHide` waits 160 ms and checks
  `:hover` and `:focus-visible`; a `::after` bridge covers the 4px gap to
  the entry); Tab from the entry goes into the card, Tab from its last
  button to whatever follows the entry (`tabbables()`), Shift+Tab from its
  first button back to the entry; Escape closes it and returns focus to the
  entry, quietly (`quiet` stops the entry's `focusin` reopening it). After a
  button is used the card redraws and the same verb, or its successor,
  takes focus back (`showTip(b, keepFocus)`). Under this option the inline
  `.sk-verbs` are `display:none`. The entry carries
  `aria-describedby="miKeyHint"` (the facts line) while the card is open.

**The cell card** (`#miTip.rca-tip`, `mapTipHtml(c, hint)`): built row for
row like the ranking beat's card — name over the sector in its colour, then
Jobs / Share of metro jobs / Complexity (the ranking's five diamonds + the
score) / Tradability (not on the whole-map beat, which has not introduced
it) — with a last line beside the hand: "Click to zoom into <sector|group>"
(`zoomTarget`, allowed on steps 0, 4, 7) or "Click to pin". It follows the
cursor (`cursorTipPos`). The hand glyph is the `HAND` const at figure scope
(Tabler's hand-click, MIT), animated by `.skt-hand` / `.skt-hand-marks`,
still under `prefers-reduced-motion`.

**The head row** (`#miView`), under the "Control row" study:

- **opt-1 (tray)** — title + Year (labelled) + View Treemap|Ranked
  + Color Sector|Complexity (+ Sort by when bars are up), dressed as a
  "paper tray": no border, soft grey tray (`--paper #f4f5f2`), the chosen
  button a white tile with teal text and a soft shadow.
- **opt-2 (sentence, the default since 2026-10-04 at Nil's ask)** — the
  title is a sentence, "All industries, shown as
  a [treemap ▾], coloured by [sector ▾], in [2024 ▾]", each blank a native
  `<select>` cut to the width of its word (`fitPick` measures a hidden twin;
  refit on view/step/year changes). Leads per beat: "All industries," /
  "All industries, by tier," / "The most specialized industries,". The
  sentence is plain ink, nothing bold.
- Both keep one state: `applyView` / `applyColor` / `applyBarSort` sync the
  buttons and the blanks together.
- **Level** (2026-09-30, at Nil's ask): the grain the map is tiled at — a
  fourth pair in the tray, and in the sentence "shown as a [treemap] at the
  [6-digit] level" (`#miSLevel`). The control has two forms, the
  **"Level control" study** (`#miLevelOpt`, `fig.dataset.levelctl`, on the
  map beats): opt-1 (default) a toggle **Sector | Industry** (`#miLevel`,
  `data-level` 2 / 6), opt-2 a menu **6-digit · 4-digit · Sector**
  (`select#miLevelSel`, dressed as the Year select). Only one shows at a
  time; both and the sentence's blank are one state (`syncLevel`). Going
  back to the toggle from a map at 4 digits returns it to the industries
  (`setLevelCtl`), since the toggle has no 4. The tradable beat (state 4)
  reads at the industry level whatever the map rested at: `setStep`
  brings `MAP_GRAIN` back to 6 before painting it (and lets a pinned card
  go, as every beat change now does), and `syncLevel` holds the control
  there (`levelLocked`, `fig.dataset.levellock`): the other tiles are
  `disabled` and fade, while the chosen tile, the menu and the sentence's
  blank stay reachable but `aria-disabled`, each pointing
  (`aria-describedby`) at a hidden `.mi-sr` note that says why
  (`LEVEL_LOCK_WHY`, also the pair's title for the pointer); focus on a
  tile going out of reach moves to the chosen one; a held blank takes no
  key that would change it (`holdKeys`) and `applyLevel` puts a change
  back; the live region says the level was set back when it was. The
  level stays at 6 when the reader goes back, so the control always says
  what the map shows. The 3-digit subsectors are
  tiled the same way but not offered. Nil named the sector grain "1" in
  the ask; the options say "Sector"; `applyLevel` / `syncLevel` keep them
  one state, `fig.dataset.level` carries it. The data holds four NAICS
  grains per row: the 6-digit industry (`code`, 877 rows in 2024), its
  4-digit industry group (`group`, 292), its 3-digit subsector (`sub`, 85)
  and the sector (9). Module-level `MAP_GRAIN` is read by `layoutBands`:
  at 4, 3 or 2 the band's industries are first rolled up **as wholes** to
  that level (`levelUp`, one `aggCell` per group / subsector / sector, its
  industries as `members`, PCI jobs-weighted, tier only if shared) and only
  what is still too small folds further up; `bandsLayout`'s cache key
  carries the grain. The cells then carry the group's or subsector's short
  name, the card says "Industries N", the live region counts at the grain
  ("292 industry groups shown"), the complexity colouring uses the
  aggregate's PCI. **The level is where the map rests; the zoom walks down
  from there as it always has** (nested, at Nil's insistence — the first
  cut stopped the zoom at the sector on coarse grains): what is tiled is
  the finer of the level chosen and the depth zoomed to
  (`effectiveGrain(MAP_GRAIN, depth)` over `GRAIN_STEPS [2, 4, 6]`;
  `effGrain()` in the figure reads `focus`/`focusGroup`; `bandsLayout`
  keys its cache with it and hands it to `layoutBands(bands, grain)`). So
  at 4-digit: groups inside sectors → click → the sector's groups → click
  → the group's industries. At the sector level: nine blocks → click → the
  sector's groups → click → its industries. Escape walks back up. **At the
  industry level there is no group step** (2026-10-01): the map is tiled
  sector → industry (`tileBand(…, flat)`, `layoutBands` at grain 6 is
  `mergeLoop([LEVELS.sector], bands, true)`), the industries too small to
  draw fold into one "Other <sector>" cell per sector (per tier on the
  tradable beat) where they used to fold per group and subsector, and a
  click inside a zoomed sector pins the card (`zoomTarget` offers a group
  only where the cells are groups, `mapLayout.grain === 4`). A group zoom
  made from the Sector or 4-digit level still rides into the tradable
  beat; a map holding one group alone folds within it ("Other
  instruments", `oneGroup` in `layoutBands`), and a keyboard zoom-out
  with no blocks to land on takes the crumb (`applyRefocus`). Choosing
  a level while zoomed goes back to the top at that level (`applyLevel`
  calls `setFocus(null, null)`). The zoom hint, the crumbs, the keyboard
  targets and the live region ("32 industry groups shown in the map,
  zoomed into Professional & Business") all follow. With the sector-names
  band on at the sector level the cell keeps its share only, since the band
  names the block (`shareOnly` in `paintMap`). The control shows only while
  the map is up (`#miFigure:not([data-view="map"])` hides the pair and the
  blank): the bars and the ranking stay industries; the table follows the
  map's level (see below). A year's rebuild keeps the grain.
- **The ranking beats have their own row** (`#miSort`, "Sort by" with
  Concentration / Jobs / Against peers, shown on figure steps 3 and 6 only —
  a separate element from `#miView`, which carries the map beats' row). Under
  opt-2 it is a sentence too (fixed 2026-09-30; it had stayed as buttons):
  "The most specialized tradable industries, sorted by [concentration ▾]"
  (`p#miSRank`, select `#miSSortRank`, options rca / jobs / gap). The blank
  and the buttons are one state through `applySort(key)` in treemap.js, and
  the rebuild sets the blank from `sortKey`. Its lead matches the chart's own
  title (`mapTitleOf`), which steps 3 and 6 share.

**Other pieces on the figure:** "Show as table" (`#miTableBtn`) stands at
the map's top-right corner on the crumbs' line (it rides between the two
notes with the beat; since 2026-10-01 the table itself opens **over the
map**, `#miTable` sitting before `.tradable-viz-wrapper`, the map giving up
height to it, and lists the map at the level it is tiled at with only what
the page shows: at 6 digits Industry, Sector, Jobs, Share of metro jobs,
Complexity (the Industry group column went with the map's group layer),
plus Tradability on the tradable beat alone, as
the card does; at 4 digits or the sector level one row per group or sector
with its count of industries, jobs, share and jobs-weighted complexity.
Complexity is drawn as the card draws it, five diamonds and the score, no
level word and no "PCI".
The Location quotient column is gone - nothing on the page shows it -
`syncTable`); the "opt" study
word (`#miStudies`) rides the beat's eyebrow counter in the text column
("Metro Industries 1/3  opt"), moved there by `activate(i)` and handed back
to the head by `restore()`; the sector phrases in the first beat's text
(`.mi-hl[data-sector]`) wear their colour block and frame their sector on
hover; the third beat's phrases (`.mi-hl[data-ind]`) light their ranking row.

**Keyboard and screen reader** (`a1b3fd0`, `a297747`; learned from the
reference build's own page). Keep every one of these when touching the figure:

- A polite live region `#miLive` (`syncLive()`) says what the map is showing
  whenever that changes — how many industries, in tiers or as bars, zoomed
  into what, how many sectors, which tiers, coloured by what — and the figure
  carries `aria-label` = the map title (`mapTitleOf()`).
- The heads that are not showing (`.mi-title-all` / `.mi-title-tier`, the
  notes) are `inert`; the tradability menu's faded heads get `tabindex=-1`
  and `aria-hidden` (`syncMenuHeads`, run after each paint settles); the
  tier grounds' crosses are keyboard buttons (`.mi-card-x-hit`, `data-close`)
  while the grounds are up; the table over the map is a focusable region;
  the crumbs are a `nav` with `aria-current`, and the crumb's × reads "Zoom
  out to <sector | all sectors> (Esc)" with `aria-keyshortcuts`; the text's
  sector phrases are `role=button` and answer Enter and Space.
- The zoom hit targets ("Zoom into …") exist only on steps 0, 4, 7 in map
  view (`drawHits` is emptied elsewhere), so Tab finds nothing to zoom over
  the ranking or the bars.
- **Escape is one dispatcher** (`escLayers`, before `paint` in treemap.js),
  taking a layer at a time from the top: 1 the studies panel, 2 the
  tradability menu, 4 the key's card, 5 a pinned cell card,
  6 the zoom. A press inside a `<dialog>` is the dialog's. Layers marked
  `scoped` answer only when the event's target is inside the section's
  `.ct-scrolly` or `#miStudies`, or the body while the figure is hovered.
  Never add another `keydown` Escape listener — push a layer.
- **Focus follows its own actions**: after a keyboard action
  (`byKey = ev.detail === 0`) `refocus` is set and `applyRefocus()` runs
  after the paint — a keyboard zoom lands on the trail's "All sectors"
  (`crumb`), zooming out returns to the block just left (`hit`), taking a
  tier off lands on its chip (`chip`), putting it back on that ground's
  cross (`close`); closing the studies panel or the menu hands focus back to
  the word that opened it.
- In the text column the beat counter is `aria-hidden` with a `.mi-sr`
  "step n of N" beside it, and each beat opens with an `a.skip-chart` link
  past its text to the chart; `initCollapsible` sets `aria-expanded` /
  `aria-controls` (ids `cc-n`); the rail is `nav[aria-label=Contents]` and
  `updateActivePage` marks `aria-current`; the pager's current stop is
  `aria-current="step"`.
- Beats the reader is not on do not fade to 35 % any more (that left their
  words at 1.6 to 1): `.ct-step:not(.is-on){--ink:#5a656a;--ink-soft:#5a656a}`
  — `--ink` and `--ink-soft` are registered with `@property` so the change
  eases — and what is only picture (`svg:not(:has(text))`) eases to .55,
  except the explainer's chevron, which is a control and keeps its 4.5
  (`ec928b5`, scoped to `#page-export-basket`).
- Not done, by decision: arrow-key roving between the buttons of a
  segmented control (WCAG does not ask for it).

**The sectors named on the map** (the "Sector names" study, 2026-09-30, at
Nil's ask "the sector names should be displayed as well … build another
frame around it"). Both options share one mechanism: the tiling
(`tileBand`, module-level) gives every sector node 18 screen pixels of
`paddingTop` (`SEC_STRIP`; module-level `SEC_NAMES` is the mode and is in
`bandsLayout`'s cache key), and `paintFrames(L, dur)` — called from
`paintMap`, drawing into `gMapFrames`, a layer between the hits and the
cells — draws one `g.mi-secg` per block of `L.blocks`: `rect.mi-secframe`
(a hairline round the block), `rect.mi-sechead` (the strip) and
`text.mi-secname` (12.5px/700; the full name if it fits the block's width
less 10px, else `SECTOR_SHORT`, else nothing; nothing under 20px of
height). opt-2 **band**: strip and hairline in `secDeeper(sector)`, the
sector's colour taken down until white or ink reads 4.5 to 1 on it, the
name in `cellInk` of that. opt-3 **gutter**: the strip is white (the page's
ground), the name in `gutterInk(sector)` — the colour darkened until it
reads 4.5 on white, else ink — and the block's cells inset 3px
(`SEC_INSET`) so the sector reads as a labelled island. The strip outlines
its block on hover and zooms into the sector on click (when the zoom is
allowed); the frames dim and grey with the cells (`is-dim` / `is-mute`
mirrored at the three spots), leave with the map layer in the ranked view,
and follow the sector palette and the complexity colouring (the strips
keep the sector's colour under complexity, which then carries the sector
identity the cells no longer do). On the tiers each ground frames its own
sectors, so most names there fall to the short form or stand down.
`sector-frame-sketches.html` (untracked) shows four framings on the real
tiling: band, gutter, chip (a label over the cells, no room taken) and rule
(a strip in the block's own colour); the last two were not built.

**The sector blocks' dressing** (the "Sector blocks" study, built
2026-09-30 from `sector-level-sketches.html`, all five at Nil's "just build
them"; the row shows only while the map rests at the sector level,
`#miFigure[data-level="2"]`). Module-level `SEC_BLOCK`; `paintCards(all,
L, dur)` runs from `paintMap` after the labels and applies only when
`L.grain === 2` (zoomed in, the grain is finer and the blocks are plain
cells again). Each cell gets a `g.mi-mghost` (under the label) and a
`g.mi-mcard` (over it), emptied and rebuilt every paint, fading in with
the labels. opt-2 **card**: the plain label stands down and the card
writes, top down and only what fits (`line()` measures with `mapTextW`
against the block's width less 7px each side and its height less 4), the
sector's name (14/700; the short form at 12 if the full one will not go),
"26% of metro jobs · 596K", a "Largest groups" heading over the three
largest 4-digit groups with their shares (`groupsOf(cell)` rolls the
aggregate's `members` up by `group`), and the five complexity steps with
the word "complexity" (`cxBinOf(cell.pci)`); a line that will not fit is
left out with everything beneath it, so Construction and Other carry the
name alone. opt-3 **ghost**: the groups' own treemap tiled inside the
block (`d3.treemap` over `groupsOf`, `paddingInner(1)`) as white hairlines
at 30 %, the plain label kept. opt-4 **cardghost**: both. opt-5
**change**: the card with one more line, the sector's jobs in 2024 against
2014 as a yearly rate (`sectorJobs(year)` sums each year's file by sector;
"+1.7% a year, 2014 to 2024"). With the sector-names band on, the card drops
its name line (the band has it). Ink is `mapInkOf(c)` (so under the
complexity colouring the card follows the ramp's cell), the soft tone
white or ink at 80 %; the card's texts and circles take no pointer, so
the cell's hover and click (the zoom) are as before. Nil has not said
which to keep.

**Study switches ("opt")** — the panel behind the word. Each is a design
question still open; both options must keep working:

| Study | id | options (default first) | beats |
|---|---|---|---|
| Control row | `miRowOpt` | tray · **sentence** | 0 1 3 4 5 6 7 |
| Answer shown | `miAskCue` | marks · **tab** | 0 4 6 |
| Key actions | `miKeyOpt` | inline · card | 0 4 7 |
| Sector colours | `miPal` | house · tol (Paul Tol's muted set, grey Other; `SECTOR_PALETTES`) | 0 4 |
| Sector names | `miSecNames` | off · band · gutter (the sectors named on the map, see below) | 0 4 |
| Sector blocks | `miSecBlock` | plain · card · ghost · cardghost · change (what a block carries at the sector level, see below) | 0, at Level = Sector (the tradable beat holds the industry level) |
| Tier grounds | `miGround` | frame · grey | 4 |
| Tradability column | `miRankOpt` | score · **tier** | 3 6 |

The visibility rules for these live in index.html as
`#page-export-basket:has(#miFigure:not([data-step=…])) #miXPair{display:none}`
(they use `:has()` because the panel no longer sits inside the figure).

**The grid, the frame and the type floor** (2026-10-02; Nil relaying the
stakeholders: a slightly narrower text column, more room for the
visualisations, nothing set under 12.5px, good at every screen size). This
covers the two figure sections, Metro Industries and Worker Flows, which
share one grid rule.

*The grid.* Everything is driven from custom properties on `:root`
(index.html, beside `--grid-max`): `--ct-rail: clamp(248px, 24vw, 336px)`
(the text column; it was a fixed 392 down to 1200, then a clamp, with a
127px jump in the figure's width at 1199/1200), `--ct-gap: clamp(24px,
3vw, 44px)` (was 56, then 28), and the frame's padding `--panel-px`,
`--panel-pt`, `--panel-pb`. There is no step at any width any more; the
900–1199 band restates nothing for the grid. Measured figure widths, Metro
Industries: 846 → 915–921 at 1440 and wider, 686 → 801 at 1280, 606 → 746
at 1200, 638 → 654 at 1024. The **section bar reads the same numbers**
(`.secbar .citypick--bar{width:var(--ct-rail-now)}`,
`.secnav{margin-left:var(--ct-gap)}`), so at 1440 and up the location slot
is the text column's width and the section names run from the frame's left
edge to its right. Do not put literals back in either place.

*Wide windows* (2026-10-04, Nil: past about 1440 "widen the visualization
area to some extent", let the margins grow too, stop the figure "after
some point", and the text area "never gets wider"). `--grid-max` is no
longer a fixed 1360: it is `clamp(1360px, 1360px + (100vw - 1440px) / 2,
1720px)`, so past a 1440 window half of each further pixel goes to the
grid and half to the margins, and it stops at 1720 (a 2160 window). The
bars, the figure sections, the pager under them and the Who are you?
column all read it. In the figure sections the text column is fitted
against `--ct-frame-rail` (the old 1360 measure), so it is the width it
always was at every window (336 on a tall one, more on a short one, as
before), and the frame takes the whole of the growth: Metro Industries
and Worker Flows frames 980 at 1440, 1100 at 1680, 1220 at 1920, 1340
from 2160 (drawing 1274 wide), with margins 100, 160, 420, 860 a side at
1680, 1920, 2560, 3440. The chart's type stays 13px (it is sized to the
screen, not the drawing). The bars stay on the grid at every width.
Where the window's height holds the frame narrower than the grid, the
pair is **pinned to the grid's left edge** (it was centred), so the text
starts under the location chip and the logo and the frame under the
first tab in every section, and the room it cannot use falls to the
frame's right (this also applies to very short windows under 1440,
where the rail reaches its 520). Past 1440 the stage starts up to 30px
higher (eased in from 1440 to 1560), so a frame as tall as the window
allows is already stuck to the bar on the first beat instead of running
past the fold until the reader scrolls on. **Who are you?** follows the
same rule from 1440 up: the reading keeps 760 from the grid's left
edge, the map runs from it to the grid's right edge, where the bars
end, and stops at about 904 (it was pinned to the window's edge, 680 at
most, a strip far from the text on a wide screen); off the window's
edge it is framed as the figures are (1px border, 10px corners, the
stage's air above and below). Its edges are worked out on the wrap's
padding from the same width the bars use, so a classic scroll bar does
not put them out of line. Its closing card is on the grid too (it ran
edge to edge). Below 1440 the figure sections are unchanged except as
above, and Who are you? is unchanged. The landing (its own 1140 measure) and the
reading pages (Constraints, Levers, Extras at 880, their charts drawn at
880) were left as they were.

*The frame fits the window's height.* The figure is drawn on a box of
fixed proportions, so a wider frame is a taller one; before this change
the frame already ran under the fold on short windows (76px at 1366×650).
`--stage-max` is the widest the frame may be for the height there is:
`(100vh − --chrome-h − --stage-air − the frame's padding and border −
--fig-furn) × --fig-ratio + the side padding`. `--fig-furn` and
`--fig-ratio` are **per section** and set on `.pages:has(#page-…
:not(.sec-off))` as well as on the page, so the bar can read them: Metro
Industries 132px and 1.76 (the 880×500 box), Worker Flows 72px and 1.375
(its tallest box, the 880×640 map). Metro Industries' furniture grows
where its control row takes a second line (166px: any window under 1280
wide, or under 700 tall) and where the key takes a third (193px: under
1024 wide). If a control or the key is added to the figure, **re-measure
these three numbers** (`handoff/type-audit.mjs` prints `fig` and `panel`
heights; furniture = figure height − svg height). Where the height is
what binds, the room the figure cannot use goes to the text column
(`--ct-rail-now`, up to `--ct-rail-max` 520px), and past that the pair is
centred (`--ct-w`; since 2026-10-04 pinned to the grid's left edge
instead, see "Wide windows"). Under 800px of height the frame's top and
bottom padding and `--stage-air` tighten. Stacked (under 900) none of
this applies: the pair is `--ct-frame` wide.

*Stacked: the figure on top* (2026-10-05, Nil: "see how the vis is at
top and text the bottom" on the reference page's phone view, and do the
same). Under 900 the figure's band is held at the **head** of the
screen, under the section bar (`position:sticky; top:var(--secbar-h)`,
52px, 48 under 600; the stage is brought before the steps with
`order:-1`), and the beats' text reads underneath it. It was a band held
at the foot. The band runs edge to edge on the section's own ground
(#f9fafb) with 12px of padding (8 under 600), a hairline and a shadow
cast downward, and the figure sits in it as the white card it is at a
desk (1px border, 10px corners, 10/10/8 padding), as the reference's
card does: the drawing is 352 wide on a 390 phone (it was 382 when the
band was the frame). The answer's tab and the Present button hang from
the card's foot (`bottom:-13px`, `bottom:-21px`). The scroll spy has a
second rule for this layout: a beat becomes the reader's once its top
has risen past a line 60% of the way down the screen the band leaves
(the screen's middle is behind the band); because the band is as tall
as the beat's figure (Metro Industries 439 on the map beats, 529 on the
ranking; Worker Flows 367 on the map, 520 on the bars), going back
waits until the beat is 160px (or 40% of that screen) below the line,
so a band that grows cannot push the text back over the line and flip
the beat (Safari, which does not anchor the scroll). Checked scrolling
in 40px steps both ways, with and without scroll anchoring: three
changes each way, none repeated. On a short screen (a phone on its
side, under 540px tall) the band is not held, as the reference does
(nor is Who are you?'s map). Who are you?'s map was already first and
held; it now sits at the bar's foot (`--secbar-h`) instead of 3px
under it.

The text keeps at least a third of the screen or 260px, whichever is
less: the band's `top` is `min(--secbar-h, max(66svh, 100svh − 260px)
− --band-h)`, with `--band-h` kept by a ResizeObserver in the scrolly's
mount, so where a figure is taller (the ranking, Worker Flows' bars on
a phone Safari leaves 660 to 750px of) the band's head, the control
sentence, slides under the bar while the chart and key stay; it comes
back while one of its controls has the focus (`:focus-within`). At
390×844 that costs the ranking 3px; at 390×664 the text keeps 225px
where it had about 85. The band has 18px under the card, so the
answer's tab and the Present button hang inside it. While a band is
held, the scroller's `scroll-padding-top` is the band's foot (set by
spy()), so a control taking the focus and a jump land under it; a jump
to a beat (`goTo`: the journey panel, the rail, deep links) takes the
beat first and lands it under the band, and the presenter's exit lands
there instantly. A question asked on a stack holds its row by the
scroll (treemap.js `ask()`), not by the step's padding, and keeps it
clear of a band that grew. Also on the stack: the MI table caps at
`max(96px, min(240px, 100svh − 560px))`, the complexity ramp narrows
(`clamp(110px, 100vw − 260px, 300px)`), Worker Flows' empty control row
on the map beat and MI's hidden sector key under the complexity scale
give their room back, and Worker Flows' comparison (it pans at 600px on
a phone) opens with the 1× line in the middle. Worker Flows' bar names
were cut at the drawing's left edge on every width (a fixed 176-unit
gutter; on a phone the names are drawn larger): the gutter is now the
longest name's measured width (`fitGutter`), set before each beat
paints.

*The figure fills its frame.* `.tool-body .viz-big{width:880px}` still
holds every other figure on the site; inside these two stages it is
`width:100%`. The Metro Industries svg can therefore be drawn above its
own 880 units (S up to about 1.05).

*The text column's own scale* (≥ 900px only): the beat title is
`clamp(22px, .9rem + .9vw, 26px)` at line-height 1.2 (was `--t-h2`, 30px
at 1440) and the paragraph 16px at 1.6 (was `--t-base`, 16.9px at 1.62),
so the narrower measure still carries about seven words a line and the
title holds its question in two or three lines. Stacked, the prose has
the whole width and keeps the site's sizes.

*The type floor: 12.5px, everywhere in Metro Industries and the shared
chrome.* Three sizes carry the figure: 16 its title, 13 what is read as
content (industry names, values, the keys, the map's labels), 12.5 what
frames it (control labels and tiles, ticks, column heads, notes).
- **Chart text is sized on screen, not in units.** The charts' text lives
  inside the svg, which is scaled to the frame, so "11px" in the
  stylesheet used to mean 11 *units*: 10.6px at 1440 and 7.6px at 1200.
  The figure now publishes its scale, `--mi-s` on `#miFigure`
  (`tellScale()` in treemap.js, at init and in `remeasure()` *before*
  anything measures text), and the stylesheet divides by it:
  `#miFigure #miTreemapSvg .mi-name{font-size:calc(13px / var(--mi-s))}`
  and so on. The two ids are there to beat the per-band unit sizes further
  down (`@media (max-width:1199px)` and `599px`), which still serve the
  city's figure. `remeasure()` calls `refitGutters()` whenever the scale
  moves, since the gutters are fitted to the type; `typeSig` also watches
  `mi-colhead`.
- **The map's labels** are 13px, or 12.5 where that is what fits
  (`MAP.size`, `MAP.min`, the ladder `mapSizes()`); they were 12 down to
  10. Fewer small cells carry a name as a result: accepted. Sector names
  on the map and the sector-card lines (both studies) are 12.5 too.
- **Geometry that follows the type.** The tier grounds' band is
  `bandH()` = at least 26px on screen (30 units where the figure is drawn
  near its own size; a second line where the share is stacked under the
  name), its words on its middle line, the cells starting 14 units under
  it (`cardHead()`, `cardH()`); the top three's badge is a
  disc of at least 9.5px radius on screen with its number centred.
- **Where a chart cannot hold the type, it pans.** Twenty-five bars stand
  17 units apart, so under about 700px of drawing their names would touch.
  When the frame is narrower than `PAN_MIN` (704px), the figure sets
  `data-pan="1"` and the Ranked view and the ranking keep `min-width:
  704px` and scroll sideways inside `.tradable-viz-wrapper`, with a soft
  shadow on the side that has more. That is any window under about 1090
  wide, and every phone. The map never needs it: it is tiled to the width
  it has. `cursorTipPos` and the tier menu add the wrapper's `scrollLeft`,
  or they land in the wrong place while panned. This replaced the phone's
  old 600px pan for beat 3, whose text rendered at 6–10px.
- **The chrome.** Section-nav numbers 12.5 (were 11 / 10.5 / 10), the part
  names over the nav 12.5 (9.5), pager stops 12.5 (10.5), the Site Layout
  pill and panel 12.5 (9.5 and 12), the opt-1/opt-2 words in Worker Flows'
  bar 12.5 (9.5), the one-scroll layout's seals and seam 12.5, and
  `--t-xs` no longer falls under 12.5 on a phone.
- **Not done, by scope:** the type inside Worker Flows' own figure and in
  the other sections' figures is unchanged and still has sizes under 12.5
  (they are unit-scaled the old way). The same `--mi-s` approach would
  carry over.

*Checking it.* `handoff/type-audit.mjs` walks 14 Metro Industries states
at one viewport (`W`, `H` in the environment), prints the grid's numbers
and whether the frame fits, and lists every text node rendered under the
floor (`FLOOR`, default 12.5; svg text is measured through its screen
matrix; pseudo-element text is included); `SHOTS=prefix` writes a
screenshot per state. `handoff/type-audit-city.mjs` does the fit check for
Worker Flows. At hand-off both were clean at 1920×970, 1728×1000,
1512×860, 1440×789, 1366×650, 1280×720, 1200×800, 1100×800, 1024×768,
900×700, 820×1180 and 390×844, with one exception that is left alone:
at 1366×650 the Ranked view's frame runs 15px past the fold.

**The presenter view** (2026-10-04; Nil: "implement a presenter view mode
… similar to PowerPoint. This is a teaching tool so intention is to give
the teacher full view of the visualization"). Both figure sections,
Metro Industries and Worker Flows, can put their frame full screen.

*What it is.* The section's `.ct-panel` gets `.is-presenting` (and
`html.is-presenting`), becomes a fixed layer over the page and asks the
browser for real full screen (`requestFullscreen` on the panel; where
that is refused, as it is headless, the fixed layer is the view). The
script adds a bar on top (`.pv-bar`: "Metro Industries 2 of 3", the
beat's question from its heading, previous, next, "Exit Esc") and a
footer (`.pv-foot`) that mirrors the beat's "Ask the chart" rows: a
press on one clicks the row itself, so the figure, the marks and the
answer are the page's own; the answer is shown under the questions with
the answer tab's own "Back to …" words (the tab is hidden while
presenting). Worker Flows has no questions, so its footer stays hidden.
Beats change through the scrolly (`ct:take` on the step), so text,
figure and questions stay one state; the scrolly's `spy()` returns
early while `html.is-presenting`, since a re-laid-out page under the
view would otherwise scroll it back. On the way out the page is scrolled
to the beat the teacher ended on and the beat is released to the scroll.
The glossary overlay is moved into the panel while it stands (the peer
metros card opens it) and put back on exit.

*Which section.* `liveSection()`: only while the tool is on screen (not
the landing, not the explainers), and the figure section across the
middle of the screen, so in the one-scroll layout, where every section
is on, P on Constraints does nothing and P on Worker Flows opens Worker
Flows. The same reading sets `html[data-pvlive]`, which shows opt-3's
bar button; the view closes itself if its section is closed or the
landing comes back. The one-scroll layout clips each grey section to
its box (`clip-path`), lifted while presenting.

*Keys.* P opens it (not in a field, not while an overlay is open); → /
PageDown next, ← / PageUp previous, Home and End, except inside the
glossary, a term card, the table or a field, which keep those keys;
Escape follows the site's ladder, one thing per press (the glossary, a
card, the zoom, an open answer, then the view). In real full screen
the page asks to keep Escape (`navigator.keyboard.lock`, Chromium: a
held Escape still leaves); where the browser takes it anyway, the press
closes whatever card or answer was open and the view stays over the
window, and with nothing open the view closes. A full-screen request
that lands after the view was left is given back.

*Focus and announcements.* The title takes the focus on entry; Tab
runs round inside the view both ways; the footer is rebuilt on every
change with the keyboard's place kept (a question stays on its
question, "Back to …" lands on the question it answered), and a Next or
Previous about to be disabled under the keyboard hands it to the other.
A polite live region in the bar says the beat ("Metro Industries, 2 of
3. How tradable …") and a new answer. On exit the focus goes back to
the door it came from if that is in the beat on screen, or else to that
beat's door.

*The size.* `fit()` holds the figure (`--pv-w`) to the width the
screen's height leaves its drawing, from the visible svg's viewBox and
the furniture round it, and runs again from a ResizeObserver on the
figure and the footer. Each beat's drawing wants its own width (at
1440 the treemap 1064, the ranking 1193), so a change of beat held to
the old width would be cut short by the refit: since 2026-10-05 (Nil:
"make sure the viz transitions from beat 2 to beat 3") the fit waits
for the morph (`pres.morphUntil`, 1.25s) and the frame then eases to
its new width (`transition: width .35s`). Measured frame by frame,
the beat 2 to 3 morph runs on the page at 1440, 1920, 820 and 390, and
in the presenter at 1440, 1920 and 390. The type is scaled for the room by `--pv-k`
(1 at about 1100×700, up to 1.35, `min(w/1100, h/700)`): it feeds
`--mi-type`, which treemap.js reads as `TYPE_K` and multiplies into
the chart's type and everything sized to it (bands, cards, badges, the
map's label limits, the pan threshold), and the controls, sentence and
keys beside the chart scale with it in CSS. The ranked chart pans under
704px of drawing times `TYPE_K` (the CSS pan width now scales with it
too), so on a ranking the type gives way first, then the chart keeps
that width and the view scrolls on a screen too short for both. The
empty sector-key slot under the ranking is dropped in the view.

*Where its button sits — an opt study ("Present button",
`#miPresentAt`, `html[data-presentat]`).* opt-1 (default) a "Present"
button on the frame's top-right edge (`.pv-open--frame`, built into each
figure, the mirror of the answer tab on the left); opt-2 a "Present"
word after the beat's count in the text column (`.pv-open--eyebrow`,
made by the mount with each eyebrow); opt-3 a "Present" button at the
right end of the section bar, only while a figure section is showing
(`.pv-open--bar`). Any element with `data-present` opens it.

*Checking it.* `handoff/presenter-edges.mjs` runs the cases above;
`handoff/presenter-check.mjs` (with the harness; `W`, `H`,
`SHOTS=1` writes to `$S/pv/`) opens the view from the frame's button,
steps the three beats, asks and un-asks a question from the footer,
uses Home, Escape and P, and lists the three placements; it prints
whether the figure fits between the bar and the footer and the smallest
text on screen. Clean at 1920×1080, 1440×900, 1366×650, 1024×768 and
390×844 (on a phone the ranking pans, as on the page).

**Who are you?, rebuilt (2026-10-05).** Nil: "for now, we will get the
first 4 sections of this website (cities.taimur.sh/usa/place/boston-ma)
and make it the who are you section (it will have 4 beats)", keeping the
map's share of the width and v-5's design. The section (`#ovWrap`, the
reading on the left, the Leaflet map `#ovMap` on the right) now has the
reference's first four screens as its beats:
1. `#page-overview` "Where does Boston stand?": the four measures
   (population, average salary, home value, unemployment; 2024) in a
   table, each with its source, its level over its rank ("25th of 9,593"),
   and a strip against every US place: whiskers the 5th to 95th
   percentiles, the box the middle half, the median as a labelled line,
   Boston's dot (the strip runs from the 2nd to the 98th percentile,
   widened to take Boston; log scale for the counts and dollars, as the
   reference draws it); then the closest peer places as chips. Map: the
   city.
2. `#page-overview-msa` "Your city is not an island": the same for the
   Boston MSA among US metros, its peer metros, and the term "metro area"
   (`data-term="msa"`, glossary `#gl-msa`). Map: the metro's outline
   (the scroll-linked pull-back from the city, as before).
3. `#page-overview-out` "Not everyone who lives in Boston works there":
   where residents work (LODES 2023), a table of the four destinations the
   reference names. Map: each of 100 places shaded by the share of its jobs
   held by Boston residents, the four named.
4. `#page-overview-in` "More people commute into Boston than out of it":
   where Boston's workers live, the five origins, 207 jobs here per 100
   its residents hold. Map: 259 places shaded by the share of their
   employed residents who work in Boston, the five named.
The design is v-5's, not the reference's: the counters ("Who are you?
1/4", built from the blocks), the beats' title scale and 16px prose, plain
narrative (no bold, no dashes), the figure sections' tinted ground, the
map a framed card from 900px up (it was framed only from 1440; its share
of the width is unchanged: 42%, 32% from 900 to 1199), light chips and
4px corners, nothing under 12.5px (the map's callout chips went from 10
to 12.5px, light white tiles named "Boston" and "Boston MSA" as the prose
names them), and colours: Boston keeps its teal on all four maps (named
on the commuting maps, where the chips stand aside), orange
(`--orange`, heads `--orange-text`) for residents working out, as in
Worker Flows, and **blue (#3a76b0) for commuters coming in**, as the
reference draws them, so the teal stays Boston's (Worker Flows uses teal
for the same inflow; a reviewer found teal on both Boston and its
neighbours read as Boston being one of the empty places). The commuting
maps follow the reference's construction (opacity 0.12 + 0.7·√(share /
largest), named partners outlined darker, a key in the frame with a
Boston swatch, a place's figures on hover with the state where it is not
Massachusetts) and put the numbers on the map: each named partner
carries its workers under its name. **No arrows, and no camera move**
(2026-10-05, Nil: "remove the arrows from the map and make sure the map
stays in the same zoomed out level of the previous beat"): beats 3 and 4
hold beat 2's camera, the whole metro, so moving between beats 2, 3 and
4 changes only the layers. There is one camera, the scroll-linked one
(`ovZoom` → `ovCamTarget`, which has reached the metro's fit by the time
beat 3 is the reader's; `whoBeat` and `whoShow` only swap the layers and
the key; `whoFit` and the flights are gone; reset and resize go through
`ovZoom`; the dormant `ovMapStep` fits the metro for 3 and 4 as for 2).
At the metro's zoom the partners crowd round Boston, so the names are
placed (`declutter`): Boston's stands on Boston, and each partner's,
largest flow first, takes the first clear place of four round its own
(above, below, right, left), clear of the other names, the key, the zoom
buttons and the frame's edge, and gives way only when none is. At 1440
that names three of the four and three of the five (Waltham, Somerville
and Brookline give way); at 1024, two of each; on a phone, Cambridge.
The names carry their map's mode (`who-lbl--out`/`--in`), so the last
map's, which linger 200ms as Leaflet fades them, are never measured.
Headless captures at the metro zoom can show white hairlines between
tiles over the water; the browser does not draw them. The metro fits
with room round it, and on a stack the camera reaches the metro once
beat 2 is the reader's. The map now draws the real
outlines (`data/geo/who_commute_geo.js`) instead of the hand-drawn city
and metro shapes, which remain only as a stand-in. Removed: "Your
Admin"/"Your Metro" with their Levels/Comparison tiles (`wyBuild` is no
longer called), the MSA explainer panel, and "Admins in your metro" with
its places table and picker (its places' figures were generated; its
script now finds no table and stops). The section's checkpoint questions
were rewritten for the new beats, and the text elsewhere that described
the old section with it: the One-scroll seal's three points, the metro
dialog's place count (130, as the term and glossary say; it said 197),
and the checkpoint's writing prompt. A two-lens review (code; captures
against the reference and v-5's rules) found 18 problems, all fixed.

## 5. The end of a section, the quiz, the navigation

Every section ends in `secPager` (built in `showSection(i)` in index.html):
the numbered **journey line** (`.pgr-stop`: teal check behind, enlarged ring
where you stand, grey numbers ahead; stops are buttons) over **three cards**
(`.pgc`, all buttons): *Previous* with the teal check badge, *Optional —
Test your knowledge* with a soft speech-bubble mark, and *Next* with the
numbered ring badge, in the house teal (the one filled card: the way forward
is the prominent one). Kickers are plain sentence-case words; there is no
"Section n of 5" (the section nav already counts). The first section has no
Previous; the last offers "Start again"; the Extras read "Outside the storyline".

**Test your knowledge opens the quiz alone in a native `<dialog>`**
(`.kq-dialog`, built once by `checkDialog()`; `openSecCheck(true)` renders
`renderSecClose(name, true)` into it and `showModal()`s). It closes on its ×,
Escape or a click on the backdrop and hands focus back to the card, whose
line keeps the count ("3 questions · 1 of 3 answered"). `goTo('check-…')`
opens it too. The "Put your insights" reflection is retired (its renderer
still exists behind the `quizOnly` flag; the journey page still shows the
sample insights). The rail no longer lists checkpoints as steps
(`.rail .steps li[data-step^="check-"], …[data-step^="apply-"]{display:none}`).

**The section bar names its two parts** (2026-09-30, copied from the
reference build's scroll variant): "Part 1 City Profile" stands over the
first chip and "Part 2 Diagnose & Act" over the fourth, 12.5px bold in
`--ink-soft`, the part the reader is in written in teal via
`html[data-part]` (set in `showSection`: sections 0–2 → 1, 3–4 → 2, Extras
→ none). The names ride pseudo-elements — chip 1's `::before`, chip 4's
`::after` (its `::before` is the seam's hairline), with the 4→5 connector
moved to chip 5's `::before` — the row takes 15px of head-room, and under
1200px the names shorten to "Part 1" / "Part 2".

**The two bars stand on one grid** (2026-09-30): the toolbar (logo, links,
"My Learning Journey") takes the section bar's own padding rule,
`max(var(--frame-pad), (100% - var(--grid-max)) / 2)`, so the logo's left
edge is the location dropdown's and the journey button's right edge is the
last chip's ("Levers for Change") at every width from 1200 up, with or
without a classic scrollbar (both bars are children of `.pages`). Under
1200 the chips are a left-flowing filmstrip, so the button then aligns with
the bar's right edge instead. The landing's own header is unchanged.

**The site's layout study** (2026-09-30, at Nil's request, after the
reference build's `?site=scroll` variant). It is switched from the same
control the reference has: a dark pill fixed at the **bottom left**,
"Site Layout · Current", that opens its choices upward (`#siteLayoutSwitch`,
`.sv*`; a menu of `menuitemradio` buttons; Escape, arrows and an outside
click close/move; it shows only once the tool is open; on a phone it drops
the small "Site Layout" word). The reference has offered Current, One
scroll, Chapters, Two modes and, since, **Two scrolls** (`?site=halves`);
v-5 offers Current, One scroll and Two scrolls, and **Two scrolls is the
default** (2026-10-05, Nil: "add a final and default option ... a scroll
for part 1 and a scroll for part 2"). The choice is `html[data-layout]`
(`pages`, `scroll`, `halves`; `setSiteLayout(v)`, `LAYOUTS`,
`LAYOUT_DEFAULT`) and rides the address as `?layout=pages` or
`?layout=scroll`; the default needs none, so **an address without
`?layout` now opens Two scrolls, not Current**.
- **Navigation bar: Light / Tint** — a second group in the same menu
  ("Navigation bar", `html[data-nav]`, `setSiteNav(v)`, `?nav=tint`;
  independent of the layout, and the pill then reads e.g. "One scroll ·
  tint bar"). The bars are the toolbar (logo, links, "My Learning Journey")
  and the section bar under it. **Light** is white, as always. **Tint**
  (Nil's pick, #4 of six on `nav-tone-sketches.html`) puts both on
  `--teal-tint` #eef3f4, a hairline in its own family between and under
  them; the logo stays the teal one, the journey button stays the bar's one
  filled teal thing, the location is a white field with a darker #6f8087
  edge (3.7 to 1 on the tint — `--control-edge` would be 2.99), the section
  you are in is a white lifted tile (`inset 0 0 0 1px #c2d4d7` + soft
  shadow, as the control row's chosen button) and the sections behind a
  check in a white disc. Every text on it reads 5.8 to 1 or better,
  **including the "Part 1 / Part 2" names, which are `::before`/`::after`
  content the text audit cannot see** (checked by computed colour; they
  were 4.07 to 1 on the light bar until they lost their 80 % opacity).
  History: a **dark teal** bar with a white logo (`assets/gl_logo_white.png`,
  supplied by Nil, same 1079×230 as the dark one) was built first and found
  **way too dark**; a mid teal (#33707d), a deeper wash (#e1ebed) and the
  tray's paper (#f4f5f2) were built beside the tint. Nil kept only Light and
  Tint, so the others were removed (2026-09-30); their code is in commit
  `bf2a67b`, and `nav-tone-sketches.html` (untracked; its four removed
  grounds are pictures in `nav-tone-images/`) shows them. The white logo
  file is now unused. Unknown `?nav=` values fall back to light. Not
  covered: the landing header, the city menu's white panel, the "Site
  Layout" pill (dark, as on the reference). While Worker Flows is the
  section the study's "opt-1 opt-2" word takes the bar's right end, so the
  chips stop short of the journey button there.
- **Current (pages)** — as before: one section at a time, the pager's three
  cards at its foot.
- **One scroll** — the storyline's five sections stand together in the
  `.pages` scroll (`showSection` leaves them all on; the Extras alone still
  take the page for themselves), the pager is hidden except at the Extras,
  the chips follow the scroll (`trackSection`, throttled on the scroller's
  `scroll`: the section whose top has passed 40 % of the viewport; a chip
  click smooth-scrolls to the section and holds the tracker for a second),
  and the hash and `data-part` follow. After each storyline section a
  **teal close** (`section.sec-seal`, built from `SEAL_POINTS` and placed
  after the section's top-level element in the scroller, `topOf`): number
  and name, "What to take with you", three points drafted from the
  section's own text and its quiz's facts, a white "Test your knowledge"
  button (`openSecCheck(true, secIdx, opener)` — focus returns to the
  opener when the quiz closes; `syncCheckCard` keeps the seals' counts) and
  a "Keep scrolling · <next>" cue with a bobbing arrow (the last says "Back
  to the start"). The two grey-ground sections bleed their ground edge to
  edge under the white pages (`clip-path:inset(0 -100vmax)` + a 100vmax
  box-shadow, the reference's trick).
- **The opening of part two** (`section#seam`, built by `buildSeam()`,
  after Worker Flows' close): the reference's teal threshold band. "Part 2
  of 2", "Diagnose & Act", a line saying where Boston's data lands
  ("Negative supply shock" — the growth chart's quadrant, worded from
  `QUADS` in treemap.js), then a board: Part 1's three sections as checked
  cards with a mini-chart and a "Revisit" link (`data-go`), "builds on" and
  an arrow, Part 2's two sections as white cards (Constraints Diagnosis
  with the growth chart's quadrants, Levers for Change with three
  sliders), and "keep scrolling to begin". The mini-charts are drawn from
  **this page's own numbers**, not the reference's: growth from
  `window.BOSTON_GROWTH` (exported by treemap.js from `HOME` and the
  medians), the four largest sectors from `BOSTON_INDUSTRIES_2024`, the two
  workforces (687,736 jobs here, 334,026 held by residents) as on Worker
  Flows. The tracker sets `data-part` to 2 once the band is reached. On a
  phone each card is name and "Revisit" on one line with its chart below.
  Worker Flows has no quiz (`sectionChecksData` lacks it), so its close
  has no quiz button.
- **Two scrolls (the default)** — the reference build's `halves`: each
  part one scroll. `partOf(k)` gives a section's part (0 for the first
  three, 1 for Constraints and Levers, -1 for the Extras, which stay on
  their own), and `showSection` leaves on every section of the part the
  reader is in. Part one is Who are you?, Metro Industries and Worker
  Flows with their teal closes, as under One scroll, and no pager: Worker
  Flows' close (`.sec-seal--part-end`) trades its "Keep scrolling" cue for
  the reference's way on, a line across and "Next / Part 2: Diagnose &
  Act" large with a white disc and an arrow (`.seal-next`, `data-go` to
  Constraints; 4px corner on its hover ground). Part two's scroll opens on
  the band (`#seam`, which under this layout rides with part two rather
  than with Worker Flows, a full screen under the bars and no hairline),
  then Constraints, Levers and their closes, and ends on the pager's two
  cards, "Previous · City Profile" (to Who are you?, the top of part one)
  and "Next · Extras", without the line of stops or the quiz card (the
  closes carry the quizzes). The chips follow the scroll within the part
  (`trackSection` reads only the part's own sections; on the band the chip
  is Constraints). A chip in the same part smooth-scrolls there, the chip
  of the section the reader is in goes back to its top, a chip in the
  other part switches scrolls (to the top for the part's first section, so
  part two opens on its band; straight to the section otherwise), and
  `goTo`, the band's "Revisit" links, the hash and the journey land the
  same way. `data-part` is the active section's part.

Quiz content and state: `sectionChecksData()` (questions per section),
`CHECK_STATE`, `CHECK_DONE`, `APPLY_DONE`. For the keyboard (`a297747`): the
slides other than the current one are `inert` (`.kc-view{overflow:clip}` so
Tab cannot scroll the carousel away from its dots), answered options are
`aria-disabled` (not `disabled`, so the "(correct answer)" text stays
reachable) and ignore a second click, each redraw restores focus to the
control used (`again`, falling back to `.kc-dot.on`) and moves it to the
next question on auto-advance, the question reads "Question 1 of 3" with the
arrows named, and the dialog keeps `quizOnly` across redraws via
`cur.closest("dialog")`.

Scrolling up past the top of the page brings the landing back **from the
first section only** (`feb8814`; the wheel-up guard checks
`pager.dataset.sec === "0"`). From any later section the top is just the top
of that section.

## 6. Data

- `cities-v-5/industries-2024.js` → `window.BOSTON_INDUSTRIES_2024 =
  { fields, rows, sectors, total }`: Boston-Cambridge-Newton (MSA 14460),
  2024, **6-digit NAICS**, 877 industries, 2,318,249 jobs, as the reference
  build's "What We Produce" carries it: name, short name, code, jobs, group
  and subsector, the Growth Lab sector (NAICS 51 with Professional & Business,
  22 with Construction), RCA against the national mix and against the peer metros, PCI, the
  tradability score 0–1 and the tier (0 traded / 1 partly / 2 local).
  Original source: `/Users/nit880/Desktop/files/boston_tradeability_20260916.csv`
  (a 4-digit file; the 6-digit rows came later — see commit `22a6741`).
- `industries-2014.js` — 2014, built from the source's group panel at 2024's
  grain (see its header).
- **Aligned with the reference build, 2026-10-04.** Nil supplied the
  reference's own page for Boston (`/Users/nit880/Downloads/boston-ma-industries.html`,
  a single-file build of "What We Produce"; its data is one
  `JSON.parse` blob: `usa/industries.json`, `usa/metros/14460/industries.json`,
  profile and place files). `industries-2024.js` matches it row for row
  (877 industries; jobs, rca, peerRca, PCI, tier, tradability, national
  share; total 2,318,249; rank 8 of 382; the five peers). What changed to
  match it:
  - **The peers are real.** `peerRca` is the metro's concentration measured
    against its peers (Washington, Seattle, San Diego, Denver, Baltimore),
    not the peers' average RCA: 1× is the same share as the peers. The
    seeded per-peer values and the generated averages (`peersQuiet`,
    `nameRand`) are gone from the figure; `withPeers()` derives `peerRca`,
    the peers' own rate `rca / peerRca`, and `ahead` (peerRca ≥ 1). The
    module's `peersFor` still runs for the whole-mix ranking and the
    other sections, so their drawn values do not shift.
  - **Private Households (814110) has no tier, no tradability and no PCI**
    in the reference, and now here (null in both data files): it is in
    beat 1's map and table ("Not rated"), and in no tier, no tier share and
    not in the ranking's pool. Unrated complexity is grey (#c3ccce) with a
    "Not rated" entry in the legend, and lights no diamonds.
  - **RCA is unrounded** (it was rounded to two places in two places, which
    put seafood processing above plumbing fittings).
  - **Shares divide by the total the source quotes** (2,318,249), not the
    rows' sum (24 fewer); tooltips print shares as the reference does
    (26%, 5.4%, 0.55%).
  - **Wording:** beat 2 "Much of the metro's work", since local is 49%;
    beat 3 "599 jobs" and "61,687"; the ranking card reads the multiple as
    "the national share", not "a typical US metro"; "Not rated" for a
    missing PCI.
  Still differing from the reference, by design rather than data (Nil's
  to decide): the ranked bars are labelled with jobs where the reference
  prints the share; the tooltip shows complexity as diamonds and a score
  where the reference writes "Highest (PCI 1.93)"; the top complexity
  colour is #008379 (reference #029287); the map is grouped by sector
  only; the rank card says "of 382 US metros" and "Complexity rank"; the
  table has no location quotient column (removed at Nil's ask). **The 2014
  year option has no counterpart in the reference** (its 6-digit split is
  an estimate). Still generated elsewhere: the admin-city rows for Worker
  Flows. Read numbers from the rows; never regenerate them.
- The reference site's whole dataset is parquet under
  `https://cities.taimur.sh/data/` (see `handoff/memory-notes.md` for the
  file list, ids, and the 2012→2022 CAGR window it uses). It was mirrored
  into a session scratchpad that is gone; re-download with curl if needed.
- The Boston population story in *Who are you?* was deliberately aligned with
  the reference (+0.3 %/yr admin, +0.6 %/yr metro over 2016–2025; 2023–2025
  are estimates). **Do not reintroduce the old "shrinking" story** —
  details in the memory notes.

Sector colours (`sectorColors` in treemap.js): Construction #a25d37,
Education & Health #dc8271, Financial Activities #e5c95e, Leisure &
Hospitality #9adfe7, Manufacturing #7f3c6b, Natural Resources #5d9850,
Other #896885, Professional & Business #485fa2, Trade & Transportation
#86c8ab. The study's opt-2 (since 2026-09-30) is a set of another character: Paul Tol's muted scheme with a grey on Other and its rose lightened to `#cf6b7b` — wine `#882255` Professional, rose Education & Health, sand `#ddcc77` Trade, cyan `#88ccee` Leisure, olive `#999933` Financial, indigo `#332288` Manufacturing, purple `#aa4499` Construction, grey `#b3b3b3` Other, green `#117733` Natural. Periwinkle and a lavender-trade variant came before it; every candidate and its colour-blind score is on `sector-palette-sketches.html`. Design tokens: `--teal #255862`,
`--teal-dark`, `--teal-tint #eef3f4`, `--ink #1a2226`, `--ink-soft #526066`
(darkened from #5b686d in the contrast pass: 6.5 to 1 on the page, 4.8 on
the lightest map fill — use it for every secondary grey, never a hard-coded
one), `--orange #e76565` (marks only), `--orange-text #a93a17` (the accent
as words: "out" figures, the scatter's home label, the journey's current
row), `--rise #2d7d32` / `--fall #c0244a` (direction), `--control-edge
#7f8f95` (the edge of every field and select, 3 to 1 on white), `--border
#e2e7e8`, `--border-strong #c3ccce`, `--paper #f4f5f2`. `--ink` and
`--ink-soft` are `@property`-registered colours so a beat can ease between
its active and faded ink. Type is Source Sans 3; the key is 13 px (its verbs
and "Show all" too); small buttons 12 px/600. Every word on the page read 4.5 to 1 or better at
hand-off (`ef7258d`); keep it so — run the auditor (§3) after colour work.

**Who are you?'s data** (`cities-v-5/who-2024.js`, `window.WHO_2024`;
`cities-v-5/data/geo/who_commute_geo.js`, `window.WHO_COMMUTE_GEO`). Worked
from the reference's parquet (`cities.taimur.sh/data/usa/place_panel`,
`city_panel`, `place_commute`, `place_flows`, `place_directory`) by the
live bundle's own rules and checked against its rendered page: every
level, median, quartile, percentile, rank and peer, every commuting count
and share, and the 100 and 259 map places match. Notes: salary is the
site's "nowcast" (labelled IRS SOI, carried, 2023–25); the box plots
compare against every place (or metro) with a value that year, so the
count differs by measure; the peers are matched on 2014 values, and
Boston has no 2014 pay, so pay is not in its place match whatever the
reference's own note says (v-5's note leaves it out). The outlines are
the reference's (`/data/geo/usa/...`) for Boston, the MSA and the 260
places either map needs, 117 of which were not in `xch_geo.js`; three
place ids changed since that file was made (Watertown, Amesbury,
Methuen). The commuting beats read **LODES 2023**; Worker Flows still
reads 2022 (687,736 jobs, 206 per 100), so the two sections now disagree
(§8 0j).

## 7. How Nil likes to work — read this twice

- **Sketch first, then ship both picks as a study.** For any control or
  interaction question, make a sketch page at the repo root (`*-sketches.html`,
  live over the real data via `cities-v-5/industries-2024.js` + d3 from a
  CDN, drawn in the site's own dress) with 2–5 variants and a short "where
  each stands" note; Nil picks from the page. Implement the pick(s) as an
  "opt" study switch rather than replacing the current design.
- **Light controls near the figure.** No dark teal-filled buttons above the
  nine-colour treemap; every control carries its word ("Year", like "View").
  The one deliberate exception is the *Next* card at a section's end.
- **Not "AI-designed".** No all-caps kickers, no "Section 2 of 5" captions,
  no stern icons; soft, plain, sentence-case, in the house's own marks.
- **Interactions must not cover the chart.** Cards from the key must never
  stand over the map (the open question in §8).
- **Verify in the real page, show proof** (numbers and a screenshot), then
  push. Nil says "push to github" often; pushing after each verified change
  is the established rhythm. Never force-push.
- **Commit messages are prose**, in the house's voice: a short title line in
  the style of the history (`git log`), then a paragraph saying what changed
  and why, from the reader's point of view. Read ten recent messages before
  writing one. End with the attribution line the environment asks for.
- **One task at a time, terse replies, no headers for simple things.**
  When Nil's message is a single line of instruction, do it and report in
  two sentences. When they ask an open question ("where should I put…"),
  answer in 2–3 sentences with a recommendation and the trade-off, and offer
  a sketch.
- **The narrative is plain text** (2026-10-02, Metro Industries): no em
  dashes (set asides off with commas or "such as"), no bold, and a term
  the reader may not know carries a small info mark and a definition card,
  never an underline, because a ruled phrase in this text is one that acts
  on the chart. Do not make a paragraph longer to fit a term in.
- **Nothing under 12.5px**, the stakeholders' floor (2026-10-02). Check it
  with `handoff/type-audit.mjs`, which measures svg text on screen.
- **Keep the text column lean.** Nil has removed what competes with the
  prose beside the figure: the Viewing badge, the explainer panels, the
  donut (2026-10-01/02). When a number belongs to the chart, put it on the
  chart rather than in a second graphic in the text.
- **Buttons and tabs are 4px rounded rectangles, not pills** (2026-10-04,
  Nil, on the presenter view and the "Showing an answer" tab). The house
  corner is 4px; a control nested inside one (the tab's "Back to …") takes
  2px so the two corners sit together. Round dots stay round.
- Sketch pages and `nt-prototypes/` stay untracked; `.claude/` is untracked.

## 8. Open items at hand-off

0. **"Ask the chart" — built 2026-10-01; the wording is Nil's to tune.**
   Nil asked for questions in the narrative that lead a reader to the
   views the controls hide, at most two per beat, about complexity and
   tradability, presented "without confusing them". Six questions and
   three presentations were sketched
   (`handoff/sketches/explore-questions-sketches.html`, also at the repo
   root, with captures of the real figure in each view); Nil chose the
   third's rows with the answer in the text column, "very short and
   direct", for all three beats.
   **In the page:** an `.ask-chart` block in each beat's text (index.html,
   after the paragraph, the last thing in the beat's text now that the
   explainer rows are gone; `.ask-chart` is in the scrolly's `TEXT_SEL`
   so it travels into the step). A row is a
   button (`.ask-q[data-ask]`): a bars mark, the question, "Show →",
   which reads "Showing" with a dot once asked; its answer (`.ask-ans`)
   opens under it on the row's tint: one short answer in plain words and
   nothing else (Nil: no bold, no "Changed:" line, no Back link). The row
   pressed again is the way back to the beat's starting view.
   From the review of the feature (2026-10-02): the pressed row must not
   move, since it is the way back, so the step is pinned where it stands
   from the first question until the beat is left (`pinStep` /
   `unpinSteps`; the step's text is otherwise centred and re-centres as an
   answer opens); a question pressed in a beat the reader is not on takes
   that beat without a scroll (`ct:take`, heard by the scrolly's `mount`,
   which holds the beat until the reader has scrolled 100px or it leaves
   the screen); and the answers are written for 2024, so the blocks stand
   down while Year is 2014 (`[data-year="2014"]`, and a guard in `ask`).
   The review's "state" lens and several verifications were cut off by a
   session limit; the whole review was run again after the terms went in
   and confirmed thirteen things, all fixed (`rev13` in the commit
   message): a taken beat's hold is released by where the scroll puts the
   reader - scrolling toward it keeps it, 100px away or off the screen
   gives the decision back (`spy()` in `mount`), and the way back gives
   it back too (`ct:release`, sent after the answer has closed so the
   text is laid out as it will stay); a beat that is left keeps its box
   (`freezeSteps` sets the pinned step's min-height before its answer
   closes, `settleSteps` puts its text back inside that box), so nothing
   collapses above the reader; the pressed row is also held when the
   other question's answer closes above it (the pin's padding takes the
   difference); and only a real change of width unpins (the page sends
   "resize" to its figures on every beat change).
   **In the figure** (treemap.js, "Ask the chart"): `ASKS` maps each key
   to a beat and its settings; `setNamed(set)` puts the figure in the
   beat's own view plus those settings through the controls' own
   appliers, held to one paint (`holdPaint`); `ask(key)` records
   `asked = {key, sig}`; `paint()` calls `checkAskRef`, which closes the
   answer when `askSig()` no longer matches (the chart is left as the
   reader set it); `setStep` calls `leaveAskRef` first (the beat goes
   back to its own view) and `afterStepRef` last (a question pressed in
   a beat the reader is not on scrolls it in and is asked on arrival);
   Escape is the last `escLayer`. `fig.dataset.asked` / `askmarks` drive
   the marks on the controls a question moved (the label in teal with a
   dot; on the ranking, the Tradability head).
   **The six** (first of each pair the stronger; every figure recomputed
   from `industries-2024.js` and checked on the live page): beat 1 "Are
   the metro's biggest industries also its most complex?" (View Ranked,
   Sort by Complexity) and "Which of the two largest sectors holds the
   metro's complex work?" (Color Complexity); beat 2 "Is the work the
   metro sells outside also its most complex work?" (Color Complexity)
   and "What does the metro actually sell outside its borders?" (the
   Traded ground alone); beat 3, since 2026-10-05 (Nil: its questions
   "can be about sorted by peer and jobs", general ones such as how the
   most specialized industries do against the peers) "How do these
   specialties compare with the peer metros?" (Sort: concentration
   against peers; all twelve are more concentrated here than in the five
   peers together, so every bar runs right; missile parts lead, 10.3
   against the peers' 0.2, and biotechnology R&D is second, 10.8 against
   2.4;
   "peer metros" is the term with its card) and "Which of these
   specialties employ the most people?" (Sort: jobs; biotechnology R&D
   with 61,687 of the twelve's 86,003, laboratory instruments and savings
   institutions about 7,000 each, two under 100). Both ways back read
   "Back to most specialized". The universities question (the Partly
   traded filter) was dropped for the peers one. (The "Against peers" view was generated when
   these were written; since 2026-10-04 it reads the source, §6. The 2014
   industry rows are estimates, so no question rests on the year.)
0b. **Terms and the glossary — built 2026-10-02.** Nil found the question
   block and the collapsible explainer panels together "cluttering the
   space": the three panels in Metro Industries are gone ("What is
   economic complexity?", "How do we measure tradability?", "What is
   specialization?"). Their text lives on as the three entries of a
   **Glossary** dialog (`#glossaryOverlay`, the journey overlay's window;
   `openGlossary(term, opener)` / `closeGlossary()`, Escape, backdrop,
   focus kept inside and given back; the two "Glossary" links in the
   site's navs open it too). In the text a **term** is
   `button.term[data-term]`: the plain word followed by a small info mark,
   and **no rule under it** (2026-10-02: Nil found the dashed rule read as
   a chart interaction, since the phrases that act on the chart carry a
   dotted teal rule). The mark is drawn, not typed: a ring, a dot and a
   stem in one SVG, masked into `.term::after` so it takes the text's
   colour (ink-soft, teal when pointed at or open). It is .875em wide and
   never under 13px, with its centre .32em above the baseline, which puts
   it between the middle of the lowercase and of the capitals in both
   faces the terms sit in (Inter in the paragraphs, Source Sans 3 in the
   answers and the rank card). The earlier mark was a typed "i" in a
   bordered box, which sat off the text's line and off its own centre.
   The section's narrative and the glossary also carry **no em dashes**
   (same date); asides are set off with commas or "such as". Nor do the
   beat paragraphs carry **bold** (same date, Nil): the four figures that
   were set in `<strong>` (2.3 million, 5.4%, 600 jobs, 62,000) are plain,
   as the answers already were. Pointed at or
   pressed, it opens one small card beside itself (`#termCard`, `TERMS`
   in index.html's script): the term, one or two sentences, and "More in
   the glossary", which opens the dialog at that entry. The card sits in
   the text's own order, so Tab goes from the term to its button; Escape
   closes the card first and stops there. The paragraphs were reworded to
   name their terms **without growing** (Nil's condition; beat 2 was 321
   characters before and after, beat 3 325; without their dashes they are
   313 and 324): beat 2 "sorted into three
   tiers by tradability: how much of their output sells outside the
   metro", beat 3 "most specialized in … Specialization is not size".
   Complexity has no place in beat 1's paragraph, so its term stands in
   the answers that speak of it (b1q1, b1q2, b2q1) and on the complexity
   rank card ("Complexity rank, 2024"), which still comes forward under
   Color: Complexity, so a reader who colours by hand has the definition
   too. From the review: the glossary's entries are a keyboard stop
   (`.gl-body`, so the arrow keys scroll them), Tab cannot leave the
   dialog from the entry it opened at, it stands over the journey and
   chat windows (z-index 51); a card closes with the answer it hangs in
   and no longer swallows an Escape meant for the figure; the pointer
   coming back onto a term from its card keeps the card. Other sections keep
   their explainer panels; Nil asked about Metro Industries.
0d. **"Ask the chart": what changed, and the way back — built
   2026-10-04 (option 4).** Nil (2026-10-03): "it's not clear to the user
   what has changed and how they can return to the previous view."
   Sketched as `ask-chart-return-sketches.html` (repo root, tracked copy
   in `handoff/sketches/`): 1 the row as a switch; 2 before and after on
   the moved controls; 3 a "Starting view | Answer" switch in the head;
   4 a tab on the frame. **Nil chose 4.** While a question's answer
   stands, the frame's border turns teal and a tab sits on its top edge:
   "• Showing an answer | ↺ Back to …", the back label named for the view
   the beat returns to (`BACK_TO` in the ask module: "Back to the
   treemap", "Back to sector colours", "Back to all three tiers", "Back
   to both tradable tiers", "Back to most specialized"). The button runs
   the row's own way back (`backToStart`), and from the keyboard returns
   the focus to the question row. The tab is built in treemap.js and hung
   on the scrolly's `.ct-panel` (`.mi-asktab`, `.ct-panel.is-asked`); on a
   phone (since 2026-10-05, the band at the head of the screen) the card
   keeps its frame, which turns teal as at a desk, and the tab hangs from
   the card's foot over the text scrolling under the band, which keeps
   the way back on screen after the question row has scrolled away. It stands 13px above the frame: `--stage-air` went from 16 to
   30 (28 on short windows) and the stage starts 14px under the bar at
   900 and up, so the tab is never under the section bar. Shipped as the
   **"Answer shown" study** (`#miAskCue`): opt-1 marks only, as before;
   **opt-2 the tab**, the default. Known: at 1366×650 the frame runs past
   the fold by 24px with b1q1 open and 6px with b2q2 (both add a row to
   the head).

0j. **Who are you?, rebuilt 2026-10-05** (§4, "Who are you?, rebuilt"; §6).
   Open, for Nil: Worker Flows reads LODES 2022 and these beats 2023, so
   Boston's jobs read 687,736 there and 718,571 here (206 and 207 per
   100); its beats 2 to 4 and 8 also tell the commuting story these new
   beats now open with. The section has no "Ask the chart" questions yet
   and no presenter view (the view opens only the sections with a framed
   scrolly panel). The reference's peers note says pay was matched; for
   Boston it was not (§6).

0i. **The phone: the figure on top, built 2026-10-05** (§4, "Stacked:
   the figure on top"). From the reference page's phone view. Two
   reviews (code; the captures against the reference) found the jump,
   focus, asked-row, landscape and Worker Flows problems now fixed, and
   these left for Nil: the reference holds its band at a fixed 62svh
   with the chart filling the card (a taller treemap on a phone, a
   one-row key naming only the beat's sectors, "Show as table" in a foot
   row); v-5's band is as tall as the figure, capped as described. The
   floating Site Layout control covers reading text on a phone; the
   section bar clips at 360 wide and carries Worker Flows' opt links;
   Who are you?'s prose and Worker Flows' beat 2 use em dashes and bold.
   Worker Flows' figure text is drawn in drawing units, so on a phone it
   is under the 12.5px floor (outside the floor's scope so far).

0h. **Wide windows: built 2026-10-04** (§4, "Wide windows"). The grid
   grows past 1440 at half the window's rate to 1720; the figure
   sections' frames take it (980 → 1340), the text never widens, the
   pair is pinned left where the height binds, Who are you? is on the
   grid with its map framed. A two-lens review (CSS maths, the captures)
   moved the section bar back onto the grid (it had followed the pair,
   which split it from the masthead on short wide windows and moved it
   between sections), fixed Who are you?'s edges for classic scroll
   bars and its 1440 to 1600 overhang, and found the first-beat overrun
   that the stage's 30px lead now removes. Open, for Nil: the cap (1720, frame 1340)
   and the rate (half) are the two numbers to tune; the landing's 1140
   measure and the reading pages' 880 now sit inside a wider bar on a
   wide screen (the logo moves further between the landing and the tool,
   and the location chip stands further left of the reading pages'
   headings); the Site Layout control is pinned to the window's corner;
   Metro Industries' sector key wraps nine and one around 1680 (one line
   from about 1900); whether the reading pages' scatter should grow
   with the brief too.

0g. **The presenter view: built 2026-10-04** (§4, "The presenter view").
   Nil asked to brainstorm where its button goes; three places are built
   as the "Present button" study (frame button, the beat's counter, the
   section bar), with the frame button as the default. A three-lens review
   (logic, CSS and full screen, keyboard) found 13 problems, all fixed
   the same day and covered by `handoff/presenter-edges.mjs`; it also
   found that a year switch left the old build's answer tab on the frame
   (treemap.js now removes it with its build). Open: which place
   Nil keeps, and whether the view should also offer the beat's text as
   speaker notes (not built). Found while testing, not changed: in Worker
   Flows' second beat the longest bar name ("Utilities, agriculture &
   mining") starts 5px left of the drawing at every width, on the page
   as well as in the view.

0f. **Beat 3's peer marks: built 2026-10-04 (option 1).** Nil: "some
   peers ave line are outside of the chart … We still want to show the
   industries above 1". The peers' own rate against the nation is under
   1× for eight of the twelve, so their marks fell left of where the bars
   started. Sketched as `peer-mark-sketches.html` (repo root; tracked copy
   in `handoff/sketches/`): 1 bars and axis from 0 with 1× as a line; 2 a
   log axis; 3 two dots per industry; 4 the peers as a column. **Nil chose
   1, with the 1× line "more prominent" and labelled.** The ranking's bars
   now start at 0 (`xr(0)` in the step 3 and 6 boxes); the axis reads 0,
   then 2×, 4× …; the national rate is its own line (`.mi-nation`, 1.5px
   dashed ink on a 4px white edge, `.mi-nation-halo`), drawn in the rows'
   layer over the bars and carried past them, with a bold "1×" in the tick
   row and "National rate" under the last row (`.mi-nation-lab`, 12.5px on
   screen). The peer marks carry a white edge too (`.mi-peer-halo`), since
   every one now crosses a bar, three of them dark.
   Then (same day, Nil): the 1× line's white edge is at half opacity;
   **the ranking's key moved up into its head row**, right-aligned in
   `#miSort`, at the row's 16px (`#miSort .spec-key`; on the ranking the
   row is in the flow, so a key that does not fit takes a line of its own);
   under the peers order the key reads "more concentrated here", "less"
   (only while some bar trails its peers, `data-peerbehind`) and "the same
   share as the peers". **"The five peer metros together" is a term**
   (`data-term="peers"`): its card names the five and shows Boston and
   each peer's people (2024), jobs (2023) and average salary (2024), from
   the reference page's profile.json, stored as `peerStats` in
   `industries-2024.js`; "More in the glossary" opens a new **Peer metros**
   entry (`#gl-peers`) with the same figures as a table. The card hangs
   from the head row (`host = .mi-sort`) and drops over the chart's right
   columns while it is open. The national-rate line sits in the rows'
   layer, so it is put away by hand under the peers order (`R.nation`).

0e. **The control row's sentence is the default** (2026-10-04, Nil: "For
   Control Row options, make opt 2 the default"). On the stacked layout
   the band's head now follows the sentence's own height on the map beats
   and on the ranking (it reserved the tray's wrapped rows, and the
   ranking's two-line sentence rose out of the band).

0c. **The narrower text column and the type floor: the review did not
   finish; its one finished lens found six problems, all fixed on
   2026-10-03.** Three of the four review lenses stalled; the JavaScript
   lens finished and its findings were reproduced with its own probes,
   fixed, and re-run clean:
   1. The morphs snapped instead of animating wherever the chart pans
      (`data-pan`): the scale is now settled before an animated paint
      (`settleForPaint()` in `applyView` and `setStep`), so the next
      measure finds nothing moved.
   2. A dragged window edge cost about 180 ms per event: the gutter refit
      now runs 150 ms after the scale stops moving (`scheduleRefit`),
      and a 42-step resize sweep shows no long tasks in any state.
   3. The phone's Ranked band was 654px tall: the sector key stands down
      there while the chart pans (546px; 194px left for the text at
      390×844, 121 at 360×740).
   4. "None of the sectors shown" overran a narrow ground: it falls back
      to "None of these sectors", "None shown", "None".
   5. A refit closed an open tier menu and dropped the focus: the menu is
      re-hung from the new head and the focus returns to the head it
      was on (`keepMenuRef`).
   6. Tier bands with the table open: the cross is a fixed size on screen
      (an 8px mark on a 20px target, 13px in from the band's edge); a
      ground whose words do not clear it goes without a cross, and a
      name too wide even alone is cut to its first word ("Partly").
   The other three lenses (fit, type, css) never reported; re-run them
   with narrower briefs (`handoff/review-layout-type.workflow.js`).

1. **The map at the sector level — Nil's pick is pending.** This is the
   live question at hand-off. The Level control (§4) tiles the map at the
   sector, 4-digit or 6-digit grain; at the sector the nine blocks carry
   only a name and a share, which says what the key says. Five dressings
   are sketched on `handoff/sketches/sector-level-sketches.html` (also at
   the root): 0 as built; 1 the block as a card (name, share and jobs, the
   three largest 4-digit groups with shares, the complexity steps); 2 the
   groups' tiling ghosted inside each block at 30 %; 3 **the card over the
   ghosted tiling** (the previous session's recommendation); 4 the card
   with the sector's yearly change in jobs 2014→2024 (Professional &
   Business +1.7 %/yr, Manufacturing −1.0 %/yr; the 2014 file makes this
   possible only at this level). The nested rule — **the Level is where the
   map rests and the zoom walks down from there, sector → 4-digit →
   6-digit** — is built (§4), and so are all five dressings of the nine
   blocks, as the "Sector blocks" study (§4); what is open is which of the
   five Nil keeps. The brainstorm began with a
   misreading — "bar control area" was taken for the bar chart and a page
   of bar variants was drawn and discarded; Nil meant the control bar of
   the treemap. At 4 digits the one addition proposed is an industry count
   in the cell ("· 4 industries").
2. **Key actions — settled.** Of the five variants on
   `key-actions-sketches.html` Nil picked **B** (opt-1, `85fe10f`), and
   opt-2's card carries the facts and the verbs (§4, `d5d1256`). Still
   open: the card stands over the bottom of the map while it is up; a card
   dropping below the key (sketch A) would not.
3. **"Show as table" into the View control?** Proposed (not asked): make it
   a third View choice — Treemap | Ranked | Table — and drop the word from
   the map's corner; the sentence variant would get "shown as a [table]" for
   free. Trade-off: the table would replace the map rather than open over
   it. Nil asked for a sketch of both if pursued.
4. **The accessibility cross-check's remaining findings.** After the
   contrast pass a second, independent sweep (axe: 0 violations; pixel
   sampling of rendered text; a non-text pass over rings, edges and chart
   marks, each finding adversarially verified) confirmed thirteen items. Nil
   asked for **only the Metro Industries ones** to be applied — four, in
   `ec928b5` — and then, by design choice, took two of them back the same
   day: the ranking's quiet bars are the pale `#a9c2c7` again (the printed
   values carry the reading) and the chosen tile's edge is `#c2d4d7`, not
   teal (the white tile and its teal word say which option is on). Do not
   re-darken either. The nine outside that section are known and unapplied,
   with the fix each verifier proposed:
   - Overview scatter, phone width: the "Boston" label falls on grey dots
     (`.metro-scatter .ms-home-label`, 3.2 to 1) — a white halo:
     `paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round`.
   - `.viz-controls .seg-btn:focus-visible` and `.wy-ctl .seg-btn:focus-visible`
     lose their ring to `.seg{overflow:hidden}` — an inset ring
     (`outline-offset:-4px`, white on the selected teal button) or
     `.seg:has(.seg-btn:focus-visible){overflow:visible}`.
   - `.jp-opt-btn:focus-visible` (Worker Flows' opt pills in the secbar, the
     journey's option 1 / 2) clipped by `.jp-opt{overflow:hidden}` — same cure.
   - Overview map: `.mc-chip` callouts stay focusable while
     `#ovMap.pl-on .map-callouts{opacity:0}` — add `visibility:hidden` (with
     a delayed transition) or `inert` from the code that toggles `pl-on`.
   - `.kc-dot` quiz dots outlined at 1.63 to 1 — `border:1.5px solid
     var(--control-edge)`. The quiz `<dialog>` is one body-level element
     shared by every section, so this could not be done for Metro Industries
     alone; it is one line when Nil wants it everywhere.
   - Worker Flows: `#amMapSvg .am-flow.is-out` coral arrows under 3 to 1 on
     the map fills — `stroke:#bd5353;opacity:1`, and `.ak-line--out` to match.
   - Worker Flows dial and gauge zones (index.html near lines 11300 and 11408,
     `C_BAL`, `C_INL`, also the sector list's dots): `C_BAL → #888b8e`,
     `C_INL → #729095`.
   - Scatter dots `.metro-scatter .ms-dot` (1.3) and `.city-in-metro .cim-dot`
     (2.0) — keep the pale fill, add a 3 to 1 edge: `stroke:#7f8f95;
     stroke-width:.75`, moving the field's `opacity` to `fill-opacity`.
   - `--control-edge` reads 3.16 on the teal tint (the `#page-extras` select)
     — `#7b8b91` passes everywhere (3.53 white, 3.16 tint).
   And two of the Metro Industries fixes are scoped to `#page-export-basket`
   (the explainer header's ring let out of its panel, the chevron kept at
   opacity 1): the same lines serve Worker Flows' beats (`#page-admin-mix
   .ct-step`) and Overview's `.ov-block` once widened.
   **Reviews:** the keyboard batch (`a1b3fd0`, `a297747`) came from a
   19-gap research workflow (18 closed) and the contrast pass from the
   auditor plus the cross-check above. Everything since `8e3e960` was
   exercised by the headless checks each commit describes, but no
   multi-lens code review (§3) has read the 2026-09-30 work — the scroll
   layout, the band, the key card, the sector names and the level control
   are the most worth one pass.
5. **Touch.** The key's opt-2 card opens on hover and holds on
   `:hover`/`:focus-visible`; on touch there is no hover, so the card
   appears on the first tap and its buttons take the second. Known,
   unaddressed.
6. **The titles and the tiers' shares** stay as authored under a filter
   or zoom (the titles by decision in `feb8814`; the shares on the tier
   bands show the metro's shares regardless) — flagged by reviewers as possibly misleading,
   left as is: the key, the crumbs and the live region say what is showing.
7. **Arrow-key roving** between a segmented control's buttons is not
   implemented (not required by WCAG; every button is a tab stop).
8. **The scroll layout** — its closes carry summary points drafted by
   Claude from each section's text (`SEAL_POINTS` in index.html), which Nil
   has not edited yet; Worker Flows has no quiz to link; the band's
   Constraints and Levers cards are schematic (a quadrant sketch, three
   sliders), not live charts; the reference's Chapters and Two modes are
   not built; and under One scroll (and in part one of Two scrolls) every
   figure is built at once, fine for a prototype but the cost to watch.
   The harness modules in handoff/ were written when Current was the
   default; they address sections by id and still run, but a check meant
   for Current must now add `?layout=pages`.
9. **Not built from the sector-names sketches**: the chip (a label over
   the cells, no room taken) and the rule (a strip in the block's own
   colour) on `sector-frame-sketches.html`; Nil took the band and the
   gutter. The 3-digit subsector grain is tiled but not offered (Nil asked
   for Sector · 4 · 6).
10. **Decided and closed on 2026-09-30, so nobody reopens them**: the
   control-row sentence on the ranking beat; the key at 13px; the muted
   bars pale (`#a9c2c7`) and the chosen tile's edge `#c2d4d7`; the phrase
   highlight study removed from the panel (the frame is fixed); the colour
   study's opt-2 Paul Tol muted (lavender and periwinkle before it); the
   part names "Part 1 City Profile / Part 2 Diagnose & Act" without a dot;
   the toolbar on the section bar's grid; the navigation bar Light or Tint
   only (dark teal, mid teal, wash and paper tried and dropped, code at
   `bf2a67b`, pictures in `handoff/sketches/nav-tone-images/`).

## 9. Where things are

- `handoff/memory-notes.md` — the previous sessions' memory files, verbatim.
  Save the durable ones into the new account's memory (the working-line
  rule, the data notes, the light-controls feedback, the headless recipe).
- `handoff/verify-harness.mjs`, `handoff/verify-example.mjs` — the headless
  harness (`HARNESS_MS` raises its 150 s timeout) and a test that exercises
  the figure end to end.
- `handoff/contrast-audit.js`, `handoff/contrast-run.mjs` — the contrast
  auditor and the 47-state sweep that drives it (§3).
- `handoff/type-audit.mjs`, `handoff/type-audit-city.mjs` — the type-floor
  and frame-fit audit for the two figure sections (§4, "The grid, the
  frame and the type floor").
- `cities-v-5/who-2024.js`, `cities-v-5/data/geo/who_commute_geo.js` — Who
  are you?'s numbers and outlines (§4, §6).
- `handoff/presenter-check.mjs`, `handoff/presenter-edges.mjs` — the
  presenter view end to end and its edge cases (§4, "The presenter view").
- `handoff/review-layout-type.workflow.js` — the four-lens review of that
  change, as a Claude Code workflow script (§3, §8 item 0c).
- `handoff/commit-history.md` — the full `git log` with dates; the commit
  messages are the design record.
- `handoff/studies.md` — the study switches, their ids, options and beats.
- `handoff/START-HERE.md` — the message Nil pastes into a new session.
- `handoff/sketches/` — tracked copies (paths adjusted to `../../cities-v-5/`)
  of the sketch pages that record open or recent decisions:
  `sector-level-sketches.html` (**open**, item 1), `sector-frame-sketches.html`
  (the band and gutter shipped), `nav-tone-sketches.html` with
  `nav-tone-images/` (Light and Tint kept), `sector-palette-sketches.html`
  (the house set and Paul Tol), `key-actions-sketches.html` (B shipped),
  `control-row-two-ways.html` (tray and sentence),
  `explore-questions-sketches.html` with `explore-questions-images/`
  (the third's rows with the answer in the text were built, item 0),
  `ask-chart-return-sketches.html` with `ask-return-images/` (option 4,
  the tab on the frame, was built), `peer-mark-sketches.html` with
  `peer-mark-images/` (option 1 was built, item 0f). Open them through the
  same server (http://127.0.0.1:8912/handoff/sketches/…); the live ones
  need `cities-v-5/` beside `handoff/`.
- Sketch pages at the repo root are the originals, untracked by convention
  and only on this machine; the rest of them record earlier decisions.
