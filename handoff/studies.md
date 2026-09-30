# The study switches ("opt")

Each is a design question Nil has not closed. The word "opt" rides the beat's
counter in the Metro Industries text column ("Metro Industries 1/3  opt");
its panel lists one row per study, each a plain `<select>` whose options are
"opt-1", "opt-2" (, "opt-3"). Both sides of every study must keep working:
verify a change under each option.

| Study | select id | figure attribute | options (default first) | shown on figure steps |
|---|---|---|---|---|
| Control row | `miRowOpt` | `data-row` = tray / sentence | opt-1 tray · opt-2 sentence | 0 1 3 4 5 6 7 |
| Key actions | `miKeyOpt` | `data-key` = inline / card | opt-1 inline · opt-2 card | 0 4 7 |
| Sector colours | `miPal` | `data-pal` = house / tol | opt-1 house · opt-2 Paul Tol muted | 0 4 |
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
- **Tier grounds** — each tier's ground as a framed line, or a light grey field.
- **Tier shares** — the tiers' shares as cards, or as the donut beside the text.
- **Tradability column** — the ranking's last column as the score, or the tier word.

Retired 2026-09-30 at Nil's request: the **Phrase highlight** study
(`miHlOpt`: dim / mute / frame). The frame is the fixed behaviour — a sector
phrase in the text draws a line round its block on the map; `hlMode` in
treemap.js defaults to "frame" when the select is absent, and the handler is
null-safe, so the row was simply removed from the panel.

## A site-level study: the layout

Not in the Metro Industries panel but in the tool's toolbar, the small
"layout opt-1 · opt-2" word (`.site-study`), also `?layout=scroll` in the
address. opt-1 is the page-at-a-time site with the pager's cards; opt-2
(2026-09-30) is the reference build's scroll variant done here: the five
storyline sections in one scroll, the bar's chips following, and after
each section a teal close ("What to take with you": three points, the
quiz button, "Keep scrolling · next"). `setSiteLayout`, `trackSection`,
`SEAL_POINTS` and the seal builder sit together in index.html just before
the first `showSection(0, false)`; the styles are under "the site's layout
study" near the pager's rules. HANDOFF.md §5 has the detail.
