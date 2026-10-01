# The study switches ("opt")

Each is a design question Nil has not closed. The word "opt" rides the beat's
counter in the Metro Industries text column ("Metro Industries 1/3  opt");
its panel lists one row per study, each a plain `<select>` whose options are
"opt-1", "opt-2" (, "opt-3"). Both sides of every study must keep working:
verify a change under each option.

| Study | select id | figure attribute | options (default first) | shown on figure steps |
|---|---|---|---|---|
| Control row | `miRowOpt` | `data-row` = tray / sentence | opt-1 tray · opt-2 sentence | 0 1 3 4 5 6 7 |
| Level control | `miLevelOpt` | `data-levelctl` = toggle / menu | opt-1 toggle Sector · Industry · opt-2 menu 6-digit · 4-digit · Sector | 0 4 |
| Key actions | `miKeyOpt` | `data-key` = inline / card | opt-1 inline · opt-2 card | 0 4 7 |
| Sector colours | `miPal` | `data-pal` = house / tol | opt-1 house · opt-2 Paul Tol muted | 0 4 |
| Sector names | `miSecNames` | `data-secnames` = off / band / gutter | opt-1 off · opt-2 band · opt-3 gutter | 0 4 |
| Sector blocks | `miSecBlock` | `data-secblock` = plain / card / ghost / cardghost / change | opt-1 plain · opt-2 card · opt-3 ghost · opt-4 card over ghost · opt-5 card with change since 2014 | 0, only at Level = Sector |
| Tier grounds | `miGround` | — | opt-1 frame · opt-2 grey | 4 |
| Tier shares | `miTierOpt` | — | opt-1 cards · **opt-2 donut** (default) | 4 |
| Tradability column | `miRankOpt` | — | opt-1 score · **opt-2 tier** (default) | 3 6 |

Where they live: the `<label class="mi-study" id="mi…Pair">` rows inside
`#miStudies` in `cities-v-5/index.html`; their per-step visibility rules are
`#page-export-basket:has(#miFigure:not([data-step="…"])) #mi…Pair{display:none;}`
(`:has()`, because the panel no longer sits inside the figure). The handlers
are in `treemap.js` near `const rowEl = document.getElementById(p + "RowOpt")`,
`const keyOptEl …`, `const palEl …`, and the others by the same pattern.

What each option is:

- **Control row** — opt-1: the "paper tray" (no border, soft grey tray, the
  chosen button a white tile with teal text); opt-2: the title as a sentence
  whose blanks are native selects cut to their word ("All industries, shown
  as a [treemap], coloured by [sector], in [2024]"). Chosen from
  `control-row-two-ways.html`.
  On the ranking beats (steps 3 and 6), whose row is the separate `#miSort`,
  opt-2 reads "The most specialized tradable industries, sorted by
  [concentration ▾]" with the same blank for jobs and for the gap against peers.
- **Level control** (2026-09-30) — the map's grain as a two-way toggle,
  Sector or Industry (opt-1, default), or as a menu of the three grains,
  6-digit, 4-digit, Sector (opt-2). The grain itself, the nested zoom and
  the sentence's blank are the same under both.
  On the tradable beat the map is held at the industry level and the
  control is disabled (2026-10-01): tradability is an industry measure.
- **Key actions** — opt-1 (option B of `key-actions-sketches.html`, shipped
  in `85fe10f`): the entry unfolds its two verbs on hover or focus, quiet
  words after the name ("Hide · Only"; "Bring back · Only" once the sector
  is off; "Show all" alone for the last one showing); the entry's own click
  still switches the sector; the key's "Show all" is a tinted button at the
  row's end. opt-2 (reworked 2026-09-30): hovering or focusing an entry opens a card
  over it with the sector's colour and name, a facts line (share of metro
  jobs · jobs · industries) and light buttons "Hide" / "Bring back" and
  "Keep only" ("Show all" alone for the last one showing); the entry's own
  click still toggles; the card holds while the pointer or keyboard focus
  is in it, Tab walks into and out of it, Escape closes it back to the
  entry; the inline verbs are hidden under this option.
- **Sector colours** — the house set as shipped, or (opt-2 since
  2026-09-30, at Nil's request for "a totally different colour palette")
  Paul Tol's muted set with a grey on Other and a lightened rose: wine,
  rose and sand on the three big blocks, every pair ≥ 8 OKLab in normal,
  protan and deutan vision. `SECTOR_PALETTES` in treemap.js holds the two
  sets and is written over `sectorColors` in place; the key's swatches, the
  phrases and the cards follow. Earlier opt-2s (periwinkle, lavender trade)
  and every other candidate with its score are on
  `sector-palette-sketches.html`.
- **Sector names** (2026-09-30) — the sectors named on the map itself. The
  tiling gives each sector block 16px at its top; opt-2 fills it as a band
  in a deeper shade of the sector's colour with a hairline round the block,
  opt-3 leaves it white and sets the name in the sector's darkened colour,
  the block's cells inset 3px. Names that do not fit fall to a short form
  (`SECTOR_SHORT`), then stand down. Four framings on
  `sector-frame-sketches.html`.
- **Sector blocks** (2026-09-30) — what a sector's block carries when the
  map rests at the sector level: name and share (plain); the block as a
  card (name, share and jobs, the three largest groups, the complexity
  steps); the groups' tiling ghosted inside at 30 %; the card over the
  ghosting; the card with the sector's yearly change in jobs 2014→2024.
  Sketched on `sector-level-sketches.html`; all five built, none chosen.
  Since 2026-10-01 the plain and ghost labels at this level fit from 18px
  down (`MAP.sectorSize`) rather than the 12px the industry cells use.
- **Tier grounds** — each tier's ground as a framed line, or a light grey field.
- **Tier shares** — the tiers' shares as cards, or as the donut beside the text.
- **Tradability column** — the ranking's last column as the score, or the tier word.

Retired 2026-09-30 at Nil's request: the **Phrase highlight** study
(`miHlOpt`: dim / mute / frame). The frame is the fixed behaviour — a sector
phrase in the text draws a line round its block on the map; `hlMode` in
treemap.js defaults to "frame" when the select is absent, and the handler is
null-safe, so the row was simply removed from the panel.

## A site-level study: the layout

Not in the Metro Industries panel: the floating **Site Layout** pill at the
bottom left, as on the reference build (`#siteLayoutSwitch`), also
`?layout=scroll` in the address. **Current** is the page-at-a-time site with
the pager's cards; **One scroll** (2026-09-30) is the reference's scroll
variant done here: the five storyline sections in one scroll, the bar's
chips following, a teal close after each section ("What to take with you":
three points, the quiz button, "Keep scrolling · next") and the reference's
teal band opening Part 2, its mini-charts drawn from v-5's own numbers. A
second group in the same menu, **Navigation bar: Light / Tint**
(`?nav=tint`), sets the ground of both top bars whichever layout is chosen:
white, or the pale teal tint. A dark teal bar (white logo) was built first
and found too heavy; a mid teal, a wash and a paper ground were built
beside the tint and dropped, all six compared on `nav-tone-sketches.html`
(their code: commit `bf2a67b`). The
reference's Chapters and Two modes are not built. `setSiteLayout`,
`trackSection`, `SEAL_POINTS`, the seal builder and `buildSeam` sit together
in index.html just before the first `showSection(0, false)`; the styles are
under "the site's layout study" near the pager's rules. HANDOFF.md §5 has
the detail.
