# Cities Tool — v-6

Created on 2026-10-14 as a copy of [`../cities-v-5/`](../cities-v-5/), to show
the second design option for the "Who are you?" section beside v-5's. The rest
of the tool is v-5's as it stood at the copy.

| | v-5 | v-6 |
|---|---|---|
| The admin's and the metro's stats | bars | a line, the marks named on it |
| The scatters | one beat for each measure | one chart for each geography, its measure switched over it |
| The commuting figure | dots that sort into three groups | a Sankey of the same three groups |

Both replay the commuting animation every time it comes into view. The city
and metro comparison follows each version's stats form.

```
index.html                 the whole page — markup, styles and page logic
treemap.js                 d3 figures: the industry treemaps, rankings and maps
rca-distributions.html     standalone RCA distribution sketches
assets/gl_logo.png         Growth Lab logo
assets/landing-page.webp   landing page map background
data/geo/                  Boston admin, metro and metro-places geometry
```

What it inherits from option C: each geography carries its own colour
everywhere it is named, and the tool is a page per section — a nav across the
top always says where you are, and previous/next buttons at the foot of the
content move between sections.

## Running it

Serve the repository root over HTTP and open `cities-v-6/`:

```bash
python3 -m http.server 8000
```

What v-1 carried into this copy, beyond option C's colour and navigation: the
real 2024 data for Metro Industries, the three-tier tradability language, the
Metroverse-style cell labels, section links such as `#metro-industries`, and
the Economic Fundamentals layout pass.
