# Hand-off: cities-prototypes

Written 2026-09-29 for whoever continues this work in a fresh Claude session
(new account, no memory of the previous ones). Everything below is what the
previous sessions knew and had agreed with Nil. Read this file first, then the
files under `handoff/`.

Repo: `git@github.com:harvard-growth-lab/cities-prototypes.git`, branch `main`,
192 commits at hand-off (HEAD `b4b9a69`). Local checkout:
`/Users/nit880/Documents/cities-prototypes`.

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
port 8912). The site is then at http://127.0.0.1:8912/cities-v-5/ .

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

**Review practice.** For anything substantive the previous sessions ran a
multi-agent review: three lenses (e.g. JS lifecycle / CSS & layout / a11y &
interaction) each reporting ≤5 concrete defects with file:line, then one
adversarial verifier per finding told to *refute* it and to treat
pre-existing conditions as not-real. Confirmed findings were fixed in a
follow-up commit. This caught real regressions every time (a shadowed `on`
helper, bars ignoring the zoom, a phone band covering a panel, a 230 ms
click timer swallowing keyboard activations). Keep doing it.

There is one known, pre-existing console error on load: a 404 for a missing
resource. It is not from any of this work.

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
  the map is re-tiled over the rest (`rebuildSecGeo`), the bars follow
  (`reBars`), the titles follow ("8 of 9 sectors", "…, by tier").
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

- **opt-1 (inline, default)** — the entry is the switch, "only" sits beside it.
- **opt-2 (card)** — hovering opens a small card (`div.sk-tip#miKeyTip`,
  role tooltip) with the sector's colour block and name and one hint line
  beside a tapping hand: "Click to hide / Double-click to keep only",
  "Click to bring back…", or "Click to show all sectors" for the last one
  showing. A pointer click is deferred 230 ms to tell it from a double-click;
  keyboard activations (`ev.detail === 0`) act at once and get the wording
  "Enter to hide / “Only”, the next button, keeps only" (the `.sk-only`
  button stays in the tab order, clipped until focused). The entry carries
  `aria-describedby="miKeyHint"` while the card is open. Escape closes the
  card first; only a second Escape zooms out.

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

**Other pieces on the figure:** "Show as table" (`#miTableBtn`) stands at
the map's top-right corner on the crumbs' line (it rides between the two
notes with the beat; the table itself opens under the key); the "opt" study
word (`#miStudies`) rides the beat's eyebrow counter in the text column
("Metro Industries 1/3  opt"), moved there by `activate(i)` and handed back
to the head by `restore()`; the sector phrases in the first beat's text
(`.mi-hl[data-sector]`) wear their colour block and frame their sector on
hover; the third beat's phrases (`.mi-hl[data-ind]`) light their ranking row.

**Study switches ("opt")** — the panel behind the word. Each is a design
question still open; both options must keep working:

| Study | id | options (default first) | beats |
|---|---|---|---|
| Control row | `miRowOpt` | tray · sentence | 0 1 3 4 5 6 7 |
| Key actions | `miKeyOpt` | inline · card | 0 4 7 |
| Sector colours | `miPal` | mint · periwinkle (trade & transportation's colour) | 0 4 |
| Tier grounds | `miGround` | frame · grey | 4 |
| Tier shares | `miTierOpt` | cards · **donut** | 4 |
| Phrase highlight | `miHlOpt` | dim · mute · **frame** | 0 4 |
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

Quiz content and state: `sectionChecksData()` (questions per section),
`CHECK_STATE`, `CHECK_DONE`, `APPLY_DONE`.

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
#86c8ab (mint; periwinkle under the study). Design tokens: `--teal #255862`,
`--teal-dark`, `--teal-tint #eef3f4`, `--ink #1a2226`, `--ink-soft #5b686d`,
`--border #e2e7e8`, `--border-strong #c3ccce`, `--paper #f4f5f2`; type is
Source Sans 3; the key is 12.5 px; small buttons 12 px/600.

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

1. **Key actions opt-2 — where the verbs live.** Nil asked for the legend
   card to offer *Hide* / *Keep only* without covering the chart, and for a
   brainstorm. Five variants are on `key-actions-sketches.html` (untracked):
   A a card dropping below the key (now anchored below the whole key, gap
   bridged), B the verbs unfolding inside the entry, C a fixed strip under
   the key, D a pill beside the entry, E a menu on click. The previous
   session's reading: **C first, then A**. Nil has not picked yet. When they
   do, implement it as the card mode's behaviour (the current card is
   hint-only: click / double-click on the entry).
2. **"Show as table" into the View control?** Proposed (not asked): make it
   a third View choice — Treemap | Ranked | Table — and drop the word from
   the map's corner; the sentence variant would get "shown as a [table]" for
   free. Trade-off: the table would replace the map rather than open under
   the key. Nil asked for a sketch of both if pursued.
3. **Reviews not run** (the account hit its session limit): the last
   multi-lens review covered up to `a4f82d5`/`f19b23e` and its confirmed
   findings were fixed in `bf8d5c7`. Commits after that — the cell card on
   the ranking's design (`8e3e960`, `3809f21`), the phrase fixes and swatches
   (`bbed8e8`), the table word's move (`361880b`), the three-card section
   end (`2f6fee9`, `bf7bb44`) and the quiz modal (`b4b9a69`) — were verified
   headless but not reviewed by agents. Worth one review pass.
4. **Touch.** In key opt-2 the verbs rely on hover/double-click; on touch
   there is no double-click in every browser and no way to dismiss the card
   but tapping elsewhere. Known, unaddressed.
5. **The `.mi-title-tier` "by tier" title and the tier share captions** show
   the metro's shares even under a filter or zoom — established behaviour,
   flagged by reviewers as possibly misleading, left as is.

## 9. Where things are

- `handoff/memory-notes.md` — the previous sessions' memory files, verbatim.
  Save the durable ones into the new account's memory (the working-line
  rule, the data notes, the light-controls feedback, the headless recipe).
- `handoff/verify-harness.mjs`, `handoff/verify-example.mjs` — the headless
  harness and a test that exercises the figure end to end.
- `handoff/commit-history.md` — the full `git log` with dates; the commit
  messages are the design record.
- `handoff/studies.md` — the study switches, their ids, options and beats.
- Sketch pages (untracked, at the repo root): the two most relevant are
  `control-row-two-ways.html` (the head row's two dressings, as chosen) and
  `key-actions-sketches.html` (open item 1). Others record earlier decisions.
