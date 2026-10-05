# Memory notes from the previous sessions (verbatim)

These were the auto-memory files of the Claude account that worked on this repo until 2026-09-29. A new account starts without them; save the durable ones into its memory. Each file's frontmatter is kept.

---

## MEMORY.md

```markdown
# Memory index

- [Working line is cities-v-5 (copy of v-1)](working-line-v5.md) — since 2026-09-22 all work goes into cities-v-5; v-1, v-3 and the rest are frozen records
- [Earlier working line: cities-v-1](working-line-v3.md) — the 2026-09-14 to 09-21 line, an exact copy of v-3; superseded by v-5
- [Reference data mirror](reference-data-mirror.md) — cities.taimur.sh serves parquet under /data/; mirrored locally, queryable with duckdb
- [Boston population aligned with the reference](boston-is-not-shrinking.md) — chart 2006–2025, reading 2016–2025 shaped to the site's +0.3%/yr admin and +0.6%/yr metro; 2023–2025 city and 2025 metro are estimates; the old −0.8%/yr shrinking story was fabricated
- [Real 2024 data in Metro Industries](real-data-2024.md) — since 2026-09-16 the figure embeds the Desktop CSV's 2024 rows; peers, admin rows and the rank card are still generated
- [Light controls over the treemap](feedback_light_controls.md) — no dark filled buttons, every control labelled; sketch 2–5 variants first, ship the picks as an opt study
- [Headless verification of v-5](headless-verify-v5.md) — drive Chrome over CDP when the pane resets; open the tool with enterTool, kill smooth scroll, MI.setStep(n)
- [Accessibility fixes: Metro Industries only](feedback_a11y_scope.md) — scope a11y/contrast CSS to #page-export-basket; other sections' findings are listed in HANDOFF §8, not applied; the whole-page auditor lives in handoff/
```

---

## working-line-v5.md

```markdown
---
name: working-line-v5
description: Since 2026-09-22 the active working variant is cities-v-5, an exact copy of cities-v-1; changes go there only and must not reach other versions
metadata:
  type: project
---

On 2026-09-22 the user said the work moves to `cities-v-5/`: "we will work on v-5. there will be many changes but they will not effect any other version". It was created on 2026-09-21 as an exact copy of `cities-v-1/` at commit `6b43ea1` (only its README differs), so it carries the real 2024 Boston rows, the tier language, the Metroverse-style cell labels, the section links and the reordered Metro Industries beats.

Edit `cities-v-5/index.html` and `cities-v-5/treemap.js`; commit with an explicit `git add cities-v-5/index.html cities-v-5/treemap.js`. Serve at http://127.0.0.1:8912/cities-v-5/index.html. v-5 is self-contained: every path in it is relative to its own folder (assets, data/geo, treemap.js), so nothing it does can reach another version.

`cities-v-1/` is now the frozen record of the line it was taken from, as `cities-v-3/` is for design option C. Supersedes [[working-line-v3]].

**Why:** the user wants a variant they can change freely without disturbing the versions already shown to others.
**How to apply:** never edit v-1, v-2, v-3 or v-4 unless asked by name; when a change is described without a folder, it means v-5. Related: [[real-data-2024]].
```

---

## working-line-v3.md

```markdown
---
name: working-line-v3
description: Superseded on 2026-09-22 by cities-v-5; records the 2026-09-14 to 09-21 line, when work went into cities-v-1
metadata:
  type: project
---

On 2026-09-14 the user had `cities-v-1/` re-created as an exact copy of `cities-v-3/` (rsync, diff-identical) and said the work moves to v-1: "we won't change the content and visualization but we will do overall layout updates". Serve it at http://127.0.0.1:8912/cities-v-1/index.html. `cities-v-3/` stays as the frozen record of design option C; the pre-copy v-1 is in git history at `aa3512b`.

Before that (2026-08-18 to 2026-09-13) the working target was `cities-v-3/index.html`; earlier still, v-2 with mirrored ports into v-3.

**Why:** the layout round needs a folder that GitHub Pages hosts (branches are not hosted), and v-1 is the "Current" card on the landing page.

**Superseded:** since 2026-09-22 the work is in `cities-v-5/` — see [[working-line-v5]]; v-1 is now a frozen record.

**How it applied then:** edit `cities-v-1/index.html` and `cities-v-1/treemap.js`; leave v-3 alone unless asked; do not touch content or figures during the layout work. cities-v-4 is a separate untracked variant (Overview rebuilt per "Option A"). Repo-root sketch HTML files stay untracked; pushes go to github.com:harvard-growth-lab/cities-prototypes main; "run the localhost" = serve repo root at 127.0.0.1:8912.
```

---

## real-data-2024.md

```markdown
---
name: real-data-2024
description: Metro Industries runs on the real 2024 Boston CSV from the Desktop handoff (since 2026-09-16); what is real, what is still generated
metadata:
  type: project
---

Since 2026-09-16 the Metro Industries figure in cities-v-1 draws real data: `/Users/nit880/Desktop/files/boston_tradeability_20260916.csv` (metro 14460 Boston-Cambridge-Newton, 2004–2024, 4-digit NAICS; columns employment, national_employment, market_share, rca, industry, sector_2d, pci, tradability, tradability_class). The 2024 rows are embedded in `cities-v-1/treemap.js` as `rawData` (292 industries, 2,318,250 jobs; the unnamed row dropped; Private Households held at score 0, local). Tiers come from `tradability_class` (0 traded / 1 partly / 2 local; class cuts sit at 0.2 and 0.8 on the score). Sectors follow the Growth Lab grouping (NAICS 51 with Professional & Business, 22 with Construction). Shares: traded 22%, partly 29%, local 48%.

Still generated, not real: peer-metro averages ("Against peers" order), the admin-city derived rows (`adminIndustryData`), the complexity rank card ("9th of 384"). The commuting section's LEHD 687,736 jobs were told against a drawn 2.82M metro total; against the real total that is 30%, not the 24% the text says.

**Why:** the user said "now it's time to work with real data" and to take only data from the handoff files, not design.
**How to apply:** read numbers from the rows, never regenerate them; when new years or peers arrive, extend `rawData`/add a peers source rather than re-seeding. Related: [[working-line-v3]], [[reference-data-mirror]].
```

---

## reference-data-mirror.md

```markdown
---
name: reference-data-mirror
description: "The cities.taimur.sh reference prototype's full parquet dataset is mirrored locally and queryable with duckdb"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 58a9f4f7-4b48-4e12-a3ed-cb508b870dfb
  modified: 2026-08-31T19:59:04.192Z
---

The reference prototype at https://cities.taimur.sh serves its numbers as parquet
files under `https://cities.taimur.sh/data/` (fetched by the page over HTTP range
requests; there is no JS data global to scrape). Every headline number on a city
page comes from these files, so they are the authoritative source for data points
rather than the rendered DOM.

Mirrored on 2026-08-31 into the session scratchpad at `ref/`, with a duckdb venv
and a query helper `cities.py` beside it. Re-download with `curl` from
`https://cities.taimur.sh/data/<path>` if the scratchpad is gone.

Files: `indicators`, `wage_reliability`, and under `usa/`: `place_panel`,
`city_panel`, `place_directory`, `city_directory`, `county_directory`,
`city_complexity`, `city_outlook`, `city_proximity`, `city_density`,
`place_density`, `place_centrality`, `place_commute`, `place_flows`,
`place_housing`, `place_rent`, `city_housing`, `city_rent`, `place_fiscal`,
`city_sector_composition`, `industry_attributes`,
`national_industry_employment`, plus per-MSA
`msa_industry_employment/<msa>.parquet` and
`place_sector_composition/<msa>.parquet`.

Ids: Boston place 2507000 / MSA 14460; Chicago place 1714000 / MSA 16980.

The site's headline changes are CAGRs over a **2012 → 2022** window (verified:
Boston pop +0.26%/yr, salary +5.07%/yr, home value +8.21%/yr reproduce its
"+0.3 / +5.1 / +8.2"). Commuting totals are read at `year=2022` in
`place_commute` but the ranked partner lists come from `year=2023` in
`place_flows`, even though the page labels both "LODES 2022".

Related: [[working-line-v3]]
```

---

## boston-is-not-shrinking.md

```markdown
---
name: boston-is-not-shrinking
description: v-3's population chart runs 2006–2025 with 2016–2025 as the reading, shaped so the decade says what cities.taimur.sh says (Boston +0.3%/yr, metro +0.6%/yr); 2010–2024 are the site's own values, the old −0.8%/yr shrinking story was fabricated
metadata:
  type: project
---

The prototype used to tell a fabricated story: Boston admin shrinking at −0.8%/yr.
The reference site (https://cities.taimur.sh/usa/place/boston-ma) reads
2012→2022 from Census PEP: Boston +0.26%/yr (shown +0.3), metro +0.58 (+0.6),
national benchmark +0.8, levels 660K / 4.9M in 2022.

State of v-3 on 2026-09-06, at the user's request:
- Chart axis 2006–2025, reading (shaded band, labels, stats) 2016–2025.
- 2010–2024 are the site's own values (`place_panel` / `city_panel` parquet under
  https://cities.taimur.sh/data/); 2006–2009 are the intercensal series the tool
  carried before; the national line is the US total.
- The tail is **massaged so the decade reads the site's rates**: Boston's
  2023–2025 are a smooth path from 2022's 660,080 to 698,426 (+0.3%/yr over
  2016–2025); the metro's 2025 is 5,075,071 (+0.6%/yr). These are estimates, not
  published points; 2012→2022 still reproduces the site's +0.26 / +0.58.
- Labels compute their rate from the series (`rateOf` in `renderSpark`); the
  national label is pinned to `NAT_TREND.pop` = 0.8 as the site's benchmark.
- Landing: "Boston is growing slowly", +0.3 vs national +0.8, "per year, 2016 to 2025".
- The Census API for the 2000–2010 intercensal series now needs a key
  (api.census.gov redirects to missing_key.html), and the old CSV paths 404.

**Why:** the user wants the twenty-year frame and the last-decade highlight, but
the numbers must still agree with the reference.

**How to apply:** keep 2010–2024 as the site's values; if the tail is touched,
keep 2016→2025 at +0.3 / +0.6 and say which points are estimates. Do not
reintroduce a decline story. Related: [[reference-data-mirror]].
```

---

## feedback_light_controls.md

```markdown
---
name: feedback-light-controls
description: Controls above the treemap must be light — no dark teal-filled buttons; secondary choices (year) labelled like the others; the user likes control options shown as sketch pages first
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 58a9f4f7-4b48-4e12-a3ed-cb508b870dfb
  modified: 2026-09-29T19:33:09.832Z
---

Keep the chart's control row visually light: no dark filled (teal + white text) buttons, and a secondary control like the year must carry the same kind of label as the others ("Year", like "View" and "Color by") rather than being the odd one out.

**Why:** On 2026-09-29 the user said the dark-background buttons "make the page look cluttered" against the nine-colour treemap, and that the unlabelled year dropdown was inconsistent. They chose the "paper tray" dress (no border, soft grey tray, chosen button a white tile) for opt-1 and the title-as-sentence with tinted-pill blanks for opt-2 of the Metro Industries row.

**How to apply:** When adding or restyling any control near a colourful figure in cities-v-5, prefer tinted/tray/underline treatments over filled ones, give every control its word, and offer 2–5 variants on a sketch page (live over the real data) before implementing — the user picks from the page. Ship both chosen options as an "opt" study switch, as the other studies are.
```

---

## headless-verify-v5.md

```markdown
---
name: headless-verify-v5
description: "How to verify cities-v-5 deterministically in headless Chrome over CDP when the in-app browser pane keeps resetting its size; the three site-specific traps (tool hidden, smooth scroll, MI.setStep)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 58a9f4f7-4b48-4e12-a3ed-cb508b870dfb
  modified: 2026-09-29T21:37:27.318Z
---

Verify cities-v-5 in headless Chrome driven over the DevTools protocol from Node rather than the in-app browser pane when the pane is unstable.

**Why:** On 2026-09-29 the pane's emulated viewport kept getting cleared mid-batch (1500 → 900 → cleared), and each reset threw the site back to the landing page, so every measurement read zero. Chrome is at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and Node 24 has a built-in WebSocket, so a ~40-line harness (`--headless=new --remote-debugging-port=<p> --remote-allow-origins=*`, then `Runtime.evaluate` / `Page.captureScreenshot` with a `clip`) gives deterministic viewports and real screenshots. The harness lived in that session's scratchpad (`cdp.mjs`); rebuild it if needed.

**How to apply:** three traps in the site itself, not the harness:
- The tool is `display:none` until `enterTool('page-export-basket')` is called; `goTo()` marks the section but never reveals `#tool`, so the figure measures 0 wide.
- `.pages` scrolls with `scroll-behavior:smooth`, which headless does not tick: set `.pages.style.scrollBehavior='auto'`, `scrollIntoView({behavior:'instant'})` the target `.ct-step`, then dispatch a `resize` so the figure remeasures.
- Drive figure states with `window.MI.setStep(n)` (0 flat map, 4 tiers, 6 ranking); `const`/`let` at the top level of a `Runtime.evaluate` persist across calls, so wrap each expression in an IIFE.
Give paints ~2.5s before reading; count visible cells via `#miTreemapSvg g.mi-mcell` rect opacity, not `rect` alone.
```

---

## feedback_a11y_scope.md (added 2026-09-30)

```markdown
---
name: feedback-a11y-scope
description: "Accessibility and contrast fixes go to Metro Industries only unless Nil names another section; the other sections' confirmed findings are listed, not applied"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 58a9f4f7-4b48-4e12-a3ed-cb508b870dfb
  modified: 2026-09-30T10:07:37.345Z
---

On 2026-09-30, given thirteen confirmed cross-check findings (focus rings, chart marks, quiz dots, tokens) spread over the whole page, Nil said "only apply the accessibility fixes in metro industries". Four were applied (`ec928b5`), scoped with `#page-export-basket` / `#miFigure` selectors; the nine in Overview, Worker Flows and Extras, plus the shared quiz dialog's dots, were left as they were and written up in `HANDOFF.md` §8 with the fix each verifier proposed.

**Why:** the other sections are not the current work; a global token or shared-rule change would alter them uninvited.
**How to apply:** scope accessibility CSS to the Metro Industries section (`#page-export-basket …`) rather than editing shared rules or `:root` tokens; for a shared element (the body-level `.kq-dialog` quiz, the secbar) say so and ask before touching it. The text-contrast auditor (`handoff/contrast-audit.js` + `handoff/contrast-run.mjs`) is the whole-page check; keep its result at 0 failures. Related: [[feedback_light_controls]], [[working-line-v5]].
```

---

## feedback_narrative_plain.md (added 2026-10-03)

```markdown
---
name: feedback-narrative-plain
description: "Narrative text beside the figures is plain: no em dashes, no bold, terms get an info mark (never an underline), paragraphs not lengthened, numbers go on the chart not in extra graphics"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 58a9f4f7-4b48-4e12-a3ed-cb508b870dfb
  modified: 2026-10-03T21:33:40.951Z
---

In the Metro Industries beats (cities-v-5), Nil asked on 2026-10-02 for: no "—" in the narrative; no bold text in it (nor in the "Ask the chart" answers); terms such as tradability, specialization and complexity marked with a small drawn info icon that opens a definition card with a link to the glossary, never with a dashed or dotted underline, "as it confuses with the chart interactions" (the phrases that drive the chart carry a dotted teal rule); and "do not make the narrative text longer" when working terms in. The same day Nil removed the tier donut from beat 2 and asked for the percentages on the chart instead; earlier they removed the Viewing badge and the collapsible explainer panels as clutter.

**Why:** the text column sits beside a busy nine-colour figure; anything that competes with the prose or looks like a chart control reads as clutter or confusion.
**How to apply:** set asides off with commas or "such as"; keep figures plain; reserve underlines in narrative for chart-linked phrases; when a number belongs to the chart, label it on the chart. Related: [[feedback_type_floor]], [[feedback_light_controls]], [[working-line-v5]].
```

---

## feedback_type_floor.md (added 2026-10-03)

```markdown
---
name: feedback-type-floor
description: "Stakeholders' floor is 12.5px rendered for every text on the site; chart text in the scaled SVG must be measured on screen, not trusted from CSS units"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 58a9f4f7-4b48-4e12-a3ed-cb508b870dfb
  modified: 2026-10-03T21:33:45.777Z
---

On 2026-10-02 Nil relayed the stakeholders: a narrower text column, more room for the visualisations, "make sure smallest font is 12.5px", a clear size hierarchy, good at every screen size. Done in cities-v-5 commit 16cc5b7 for Metro Industries and the shared chrome; Worker Flows' own figure and other sections' figures were left out of scope and still have smaller unit-scaled text.

**Why:** the figures are SVGs on a fixed 880-unit box scaled to the frame, so a CSS size inside them is in units and shrinks with the frame (11 units read as 7.6px in a 1200 window); "12px in the stylesheet" is not what the reader sees.
**How to apply:** for new or changed text near the figures, keep it ≥12.5px on screen at every width; in Metro Industries size SVG text as calc(Npx / var(--mi-s)); check with handoff/type-audit.mjs (measures through getScreenCTM) at desktop, laptop and phone sizes. Related: [[feedback_narrative_plain]], [[headless-verify-v5]].
```

### feedback_no_pills.md

---
name: feedback-no-pills
description: Buttons and tabs use the house 4px rounded rectangle, never pill shapes; nested controls take 2px
metadata:
  type: feedback
---

On 2026-10-04 Nil asked that the presenter view's buttons and the "Showing an answer" tab on the Metro Industries frame stop being pills: "make them our 4px round rectangles". The site's own corner is `border-radius:4px` (the selects, the dark buttons, the focus ring); the pills had been 13px on 26px-tall controls, and the presenter's bar and footer buttons 6 to 8px. Done in cities-v-5 (the commit after d2d47f9).

**Why:** a fully rounded control reads as a different design language from the rest of the tool; Nil wants one corner across the controls.
**How to apply:** for any new button, tab, chip or door in cities-v-5, use 4px corners; a control set inside another (an inner hover ground) uses 2px so the corners nest. Status dots and markers stay round (50%). Related: [[feedback_light_controls]].
