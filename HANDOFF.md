# Hand-off: cities-prototypes

Written 2026-09-29 and brought up to date through the evening of
2026-09-30, for whoever continues this work in a fresh Claude session (new
account, no memory of the previous ones). Everything below is what the
previous sessions knew and had agreed with Nil. Read this file first, then
`handoff/studies.md` and `handoff/memory-notes.md`; the opening message
Nil sends a new session is `handoff/START-HERE.md`.

Repo: `git@github.com:harvard-growth-lab/cities-prototypes.git`, branch `main`,
216 commits at hand-off (HEAD `14f3494`). Local checkout:
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

- `cities-v-5/index.html` — ~11,400 lines: all markup, all CSS, and all page
  script (landing, section switching, scrolly engines, the quiz system, the
  Overview map, the commute maps…).
- `cities-v-5/treemap.js` — ~5,600 lines: the Metro Industries figure
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
0). It takes about two minutes, so pass `HARNESS_MS` — the harness's default
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
click timer swallowing keyboard activations). Keep doing it.

There is one known, pre-existing console error on load: a 404 for
`/favicon.ico`. It is not from any of this work.

## 4. The Metro Industries figure — how it is built

This is where most of the recent work lives. Read `treemap.js` from
`function initIndustryFigure` with this map in hand.

**Beats and steps.** The section is a scrolly built by `mount()` in
index.html (`function build()` / `activate(i)` / `restore()`): three text
beats in a 330 px left column (`.ct-step`, each opening with an eyebrow
"Metro Industries **1/3**"), the figure lifted into a sticky stage on the
right. The mount config is `{ pageId:"page-export-basket", ctl:"MI",
noClassic:true, states:{"2":[0,4,6]} }` — beat → figure step 0, 4, 6. The
figure's own state machine has steps 0–7; `paint(step)` has a per-step cell
rule (`STATE` table), and `setStep` drops what a beat cannot carry.

- **Step 0** — every industry as a treemap (sector → group → industry),
  `mapFull()`; title "All industries".
- **Step 4** — the same cells sorted into three tier grounds (Traded /
  Partly traded / Local), `mapTiers()` over `clusterRows[k]` into `cardBox`;
  title "All industries, by tier"; each ground is a card with a head, a
  share caption, a `.mi-card-none` line and a × that cancels the tier.
- **Step 6** — the ranking of the most specialized tradable industries
  (`R2 = ranking(rankPool(), true)`), with "Sort by" Concentration / Jobs /
  Against peers.
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

- **opt-1 (tray, default)** — title + Year (labelled) + View Treemap|Ranked
  + Color by Sector|Complexity (+ Sort by when bars are up), dressed as a
  "paper tray": no border, soft grey tray (`--paper #f4f5f2`), the chosen
  button a white tile with teal text and a soft shadow.
- **opt-2 (sentence)** — the title is a sentence, "All industries, shown as
  a [treemap ▾], coloured by [sector ▾], in [2024 ▾]", each blank a native
  `<select>` cut to the width of its word (`fitPick` measures a hidden twin;
  refit on view/step/year changes). Leads per beat: "All industries," /
  "All industries, by tier," / "The most specialized industries,". The
  sentence is plain ink, nothing bold.
- Both keep one state: `applyView` / `applyColor` / `applyBarSort` sync the
  buttons and the blanks together.
- **Level** (2026-09-30, at Nil's ask): the grain the map is tiled at — a
  fourth pair in the tray, "Level Sector · 4-digit · 6-digit" (`#miLevel`,
  `data-level` 2 / 4 / 6; the 3-digit subsectors are tiled the same way but
  not offered, Nil having asked for these three), and in the sentence
  "shown as a [treemap] at the [6-digit] level" (`#miSLevel`); `applyLevel` / `syncLevel` keep them
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
  sector's groups → click → its industries. Escape walks back up. Choosing
  a level while zoomed goes back to the top at that level (`applyLevel`
  calls `setFocus(null, null)`). The zoom hint, the crumbs, the keyboard
  targets and the live region ("32 industry groups shown in the map,
  zoomed into Professional & Business") all follow. With the sector-names
  band on at the sector level the cell keeps its share only, since the band
  names the block (`shareOnly` in `paintMap`). The control shows only while
  the map is up (`#miFigure:not([data-view="map"])` hides the pair and the
  blank): the bars and the ranking stay industries, and so does the table
  under the key. A year's rebuild keeps the grain.
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
notes with the beat; the table itself opens under the key); the "opt" study
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
  while the grounds are up; the table under the key is a focusable region;
  the crumbs are a `nav` with `aria-current`, and the crumb's × reads "Zoom
  out to <sector | all sectors> (Esc)" with `aria-keyshortcuts`; the text's
  sector phrases are `role=button` and answer Enter and Space.
- The zoom hit targets ("Zoom into …") exist only on steps 0, 4, 7 in map
  view (`drawHits` is emptied elsewhere), so Tab finds nothing to zoom over
  the ranking or the bars.
- **Escape is one dispatcher** (`escLayers`, before `paint` in treemap.js),
  taking a layer at a time from the top: 1 the studies panel, 2 the
  tradability menu, 3 a donut card, 4 the key's card, 5 a pinned cell card,
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
(`tileBand`, module-level) gives every sector node 16 screen pixels of
`paddingTop` (`SEC_STRIP`; module-level `SEC_NAMES` is the mode and is in
`bandsLayout`'s cache key), and `paintFrames(L, dur)` — called from
`paintMap`, drawing into `gMapFrames`, a layer between the hits and the
cells — draws one `g.mi-secg` per block of `L.blocks`: `rect.mi-secframe`
(a hairline round the block), `rect.mi-sechead` (the strip) and
`text.mi-secname` (11px/700; the full name if it fits the block's width
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

**Study switches ("opt")** — the panel behind the word. Each is a design
question still open; both options must keep working:

| Study | id | options (default first) | beats |
|---|---|---|---|
| Control row | `miRowOpt` | tray · sentence | 0 1 3 4 5 6 7 |
| Key actions | `miKeyOpt` | inline · card | 0 4 7 |
| Sector colours | `miPal` | house · tol (Paul Tol's muted set, grey Other; `SECTOR_PALETTES`) | 0 4 |
| Sector names | `miSecNames` | off · band · gutter (the sectors named on the map, see below) | 0 4 |
| Tier grounds | `miGround` | frame · grey | 4 |
| Tier shares | `miTierOpt` | cards · **donut** | 4 |
| Tradability column | `miRankOpt` | score · **tier** | 3 6 |

The visibility rules for these live in index.html as
`#page-export-basket:has(#miFigure:not([data-step=…])) #miXPair{display:none}`
(they use `:has()` because the panel no longer sits inside the figure).

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
first chip and "Part 2 Diagnose & Act" over the fourth, 9.5px bold in
`--ink-soft`, the part the reader is in written in teal via
`html[data-part]` (set in `showSection`: sections 0–2 → 1, 3–4 → 2, Extras
→ none). The names ride pseudo-elements — chip 1's `::before`, chip 4's
`::after` (its `::before` is the seam's hairline), with the 4→5 connector
moved to chip 5's `::before` — the row takes 12px of head-room, and under
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
the small "Site Layout" word). The reference offers four layouts (Current,
One scroll, Chapters, Two modes); v-5 offers the first two. The choice is
`html[data-layout]` (`setSiteLayout(v)`) and rides the address as
`?layout=scroll`.
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
  22 with Construction), RCA against the national mix and the peers, PCI, the
  tradability score 0–1 and the tier (0 traded / 1 partly / 2 local).
  Original source: `/Users/nit880/Desktop/files/boston_tradeability_20260916.csv`
  (a 4-digit file; the 6-digit rows came later — see commit `22a6741`).
- `industries-2014.js` — 2014, built from the source's group panel at 2024's
  grain (see its header).
- Still **generated, not real**: peer-metro averages ("Against peers"), the
  admin-city rows for Worker Flows, the complexity rank card. Read numbers
  from the rows; never regenerate them.
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
- Sketch pages and `nt-prototypes/` stay untracked; `.claude/` is untracked.

## 8. Open items at hand-off

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
   6-digit** — is built (§4); what is still open is only the dressing of
   the nine blocks. The brainstorm began with a
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
   free. Trade-off: the table would replace the map rather than open under
   the key. Nil asked for a sketch of both if pursued.
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
6. **The titles and the tier share captions** stay as authored under a filter
   or zoom (the titles by decision in `feb8814`; the captions show the
   metro's shares regardless) — flagged by reviewers as possibly misleading,
   left as is: the key, the crumbs and the live region say what is showing.
7. **Arrow-key roving** between a segmented control's buttons is not
   implemented (not required by WCAG; every button is a tab stop).
8. **The scroll layout** — its closes carry summary points drafted by
   Claude from each section's text (`SEAL_POINTS` in index.html), which Nil
   has not edited yet; Worker Flows has no quiz to link; the band's
   Constraints and Levers cards are schematic (a quadrant sketch, three
   sliders), not live charts; the reference's other two layouts (Chapters,
   Two modes) are not built; and under One scroll every figure is built at
   once, fine for a prototype but the cost to watch.
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
  `control-row-two-ways.html` (tray and sentence). Open them through the
  same server (http://127.0.0.1:8912/handoff/sketches/…); the live ones
  need `cities-v-5/` beside `handoff/`.
- Sketch pages at the repo root are the originals, untracked by convention
  and only on this machine; the rest of them record earlier decisions.
