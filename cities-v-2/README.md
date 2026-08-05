# Cities Tool — City Overview, design option B

An alternative structure for the **City Overview** section, kept as its own copy
of the tool because the option changes how the section is built rather than only
how it looks — it may add a page, drop the sticky map, or rearrange the flow,
none of which fits a toggle inside the existing markup.

**Only City Overview is the subject of this option.** Everything else here is a
snapshot of `cities-v-1/` taken on 2026-08-05 and will fall behind as the main
line moves. Differences outside City Overview are drift, not design decisions.
For the current tool, see [`../cities-v-1/`](../cities-v-1/).

Everything needed to run it is in this folder.

```
index.html                 the whole page — markup, styles and page logic
treemap.js                 d3 charts for the City Exports section
assets/gl_logo.png         Growth Lab logo
assets/landing-page.webp   landing page map background
```

## Running it

Serve the folder over HTTP and open `index.html`:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

Opening `index.html` directly from the filesystem mostly works, but serving it
over HTTP is more reliable — some browsers restrict local scripts on `file://`.

## Requires an internet connection

Three libraries load from a CDN rather than being vendored:

- d3 v7 — the treemaps and the specialization/peer charts
- Leaflet 1.9.4 (JS + CSS) — the City Overview map

Map tiles are also fetched remotely. Offline, the page still renders but the
charts and the map will be missing.

## What's in the page

- **Landing** — city and time-span selectors; scrolling enters the tool
- **City Overview** — how the city is doing, the metro it sits in, and how the
  city compares with its metro
- **City Exports** — an industry treemap, a tradable/non-tradable split, the
  city's most specialized industries, and a comparison against peer cities
- **City Constraints** — every US metro plotted on population growth against
  salary growth, with an explainer for the four quadrants, then the same plot
  again with the metro dot breaking apart into the places inside it
- **Levers for Change** — placeholder section

## Notes on the data

The figures are **illustrative, not real**. Industry employment comes from a
Boston sample, but specialization scores (RCA), peer-city values, product
complexity and 2014–2024 change are generated dummy values. They are held
stable per industry within a page load, so a value doesn't shift as you
interact — but they are regenerated on each reload, so the exact numbers and
the length of the specialized-industry list change between sessions.

Two charts carry a **"Bar design option"** link in their toolbar. These are
alternative chart designs for review, not features intended for end users.

## Hidden sections

"Explore Your Assumption" (the intro quiz) and City Overview's "Put in
Practice" are hidden via a CSS block near the top of `index.html`, which
documents what to restore to bring either back.
