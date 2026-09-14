# Cities Tool — the main line

Re-created on 2026-09-14 as an exact copy of [`../cities-v-3/`](../cities-v-3/)
(design option C). Same content, same figures, same data. This folder is where
the overall layout updates happen; the content and the visualisations are not
part of that work and stay as they are in option C. `cities-v-3/` remains as
the record of option C at the point the copy was taken.

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

Serve the repository root over HTTP and open `cities-v-1/`:

```bash
python3 -m http.server 8000
```

The earlier main line (before this copy) is in git history, last at `aa3512b`.
