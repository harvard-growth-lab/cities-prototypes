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
| Sector colours | `miPal` | `data-pal` = mint / periwinkle | opt-1 mint · opt-2 periwinkle | 0 4 |
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
  row's end. opt-2: a hover card with the sector's colour and name and a
  "Click to hide / Double-click to keep only" hint beside a tapping hand;
  the entry does the work (click deferred 230 ms for the double-click;
  keyboard acts at once and reads "Enter to hide / “Only”, the next button,
  keeps only"); "Hide" stands down and "Only" stays in the tab order,
  unseen until reached.
- **Sector colours** — Trade & Transportation as mint (`#86c8ab`, as shipped)
  or periwinkle; the swatches in the key, the phrases and the cards follow.
- **Tier grounds** — each tier's ground as a framed line, or a light grey field.
- **Tier shares** — the tiers' shares as cards, or as the donut beside the text.
- **Tradability column** — the ranking's last column as the score, or the tier word.

Retired 2026-09-30 at Nil's request: the **Phrase highlight** study
(`miHlOpt`: dim / mute / frame). The frame is the fixed behaviour — a sector
phrase in the text draws a line round its block on the map; `hlMode` in
treemap.js defaults to "frame" when the select is absent, and the handler is
null-safe, so the row was simply removed from the panel.
