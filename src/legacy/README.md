# The cities-v-3 page (main), as this app's shell

`cities-v-3/` on `main` — the static prototype — is the app: its landing,
masthead, section tabs and pager, journey window, dialogs and every section
but City Constraints run here as they are. React draws exactly two things into
slots inside that markup: **City Constraints** (this branch's section) and the
**Explainers** content.

Everything in this folder except `bridge.ts`, `index.ts`, `LegacyShell.tsx`,
`port.css` and the `.d.ts` files is **generated** by `scripts/v3/port.mjs`.
Don't edit the generated files; edit the script and re-run it:

```bash
rm -rf /tmp/v3 && mkdir -p /tmp/v3 && git archive origin/main cities-v-3 | tar -x -C /tmp/v3
node scripts/v3/port.mjs --src /tmp/v3/cities-v-3
```

Last port: `origin/main` at `2994068` (2026-09-09, "One word to a zone on the
dial, large enough to read"). The port before it was `1e931db` (2026-09-02).

## What is generated, and how it differs from upstream

| file | what | how it changed |
| --- | --- | --- |
| `html/body.html` | v-3's `<body>` | City Constraints' markup replaced by the slot `#constraints-slot`; the (hidden) rail lists this branch's constraints steps; the explainers view emptied for React; the Explainers button restored to the masthead (v-3 kept its styles and its toggle, but dropped the button); the two city pickers list this branch's four sample cities; asset and iframe paths under `legacy/` |
| `v3.css` | v-3's `<style>` | verbatim, but the landing image comes through `--map-asset` (a bundled import) |
| `v3-page.js` | the two inline scripts, in order, as one `initPage()` | every edit is a `PAGE_PATCHES` entry in the script and marked `[port]` in the output: the constraints ids in `pageIds` / `sectionDefs` / the section switch; three calls that tell React about the city, the page in view and the Explainers tab; verdicts for the new sample cities in the landing teaser; the rail highlight resolving scrolly steps; init that main ran on `load` / `DOMContentLoaded` running immediately; the exports at the end |
| `treemap.js` | the Metro Industries / Extras charts | the IIFE returns its `init()` instead of running it on `DOMContentLoaded` |
| `xch_geo.js` | the metro's boundaries | verbatim |
| `assets/`, `public/legacy/` | the landing image, the logo, the framed all-metros page | verbatim |

## The seam

`bridge.ts` is the whole contract. `App.tsx` mounts the body, portals the two
React pieces into their slots, then runs `initLegacy()` once.

- v-3 tells React three things, through `window.__cities`: the city picked
  (`onCity`), the page or step in view (`onPage`, from its own scroll spy — the
  React scrolly adds its phase through `markPage`), and the Explainers tab
  opening or closing (`onExplainers`). React uses them for the URL hash and
  for the constraints section's own state.
- React drives v-3 through what `initPage()` returns: `goTo`, `enterTool`,
  `backToLanding`, `toggleExplainers`, `openJourney`, and reads `sectionDefs`
  for the routable ids.
- Hash routing (deep links, the Back button) is this branch's, layered over
  v-3's navigation; v-3 itself has none.

## Not v-3's

- The **Explainers** content and its masthead (`ExplainersContent.tsx`): v-3's
  masthead scrolls away inside the pages, so the explainers view carries its
  own copy. The gallery and the two explainers are this branch's.
- The **city list** is this branch's four (the ones the diagnostic tree has
  data for); v-3's sections carry Boston's figures whichever city is picked,
  as they do on main.
- `port.css`: the constraints stage sticks under v-3's section bar
  (`--chrome-h`) rather than under this app's old toolbar, and a deep link
  enters without the landing's slide.
