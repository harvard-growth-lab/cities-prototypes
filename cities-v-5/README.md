# Cities Tool — v-5

Created on 2026-09-21 as an exact copy of [`../cities-v-1/`](../cities-v-1/)
at commit `6b43ea1`. Same content, same figures, same data — including the real
2024 Boston employment rows, the tier language (traded, partly traded, local)
and the Metro Industries order the copy was taken with.

[`../cities-v-1/`](../cities-v-1/) is the line this was taken from; it holds
the record of that work at the point of the copy.

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

Serve the repository root over HTTP and open `cities-v-5/`:

```bash
python3 -m http.server 8000
```

What v-1 carried into this copy, beyond option C's colour and navigation: the
real 2024 data for Metro Industries, the three-tier tradability language, the
Metroverse-style cell labels, section links such as `#metro-industries`, and
the Economic Fundamentals layout pass.
