A shared repository for housing prototypes related to the 2026-2027 Bloomberg Cities project.

Everything here is a static site. `main` is published with GitHub Pages, so
whatever is on `main` is what reviewers see — which is why design options live
in their own folder rather than on a branch. A branch would not be hosted.

```
index.html      landing page listing the prototypes, served at the Pages root
cities-v-1/     the Cities Tool — the main line, where the layout work happens
cities-v-2/     alternative structure for City Overview (design option B)
cities-v-3/     option B recoloured and repaged (design option C)
```

On 2026-09-14 `cities-v-1/` was re-created as an exact copy of `cities-v-3/`,
so the main line now carries option C's colour and navigation. It is the folder
the overall layout updates go into; content and figures are not part of that
work. The earlier main line is in git history, last at `aa3512b`.

## Design options

`cities-v-2/` is a full copy of `cities-v-1/`, not a successor. It exists so an
alternative City Overview can change the section's structure — add a page, drop
the sticky map, rearrange the flow — without that having to be expressible as a
toggle inside the current markup.

Only City Overview is the subject of the option. Every other section in
`cities-v-2/` is a snapshot of `cities-v-1/` taken when the copy was made and
will fall behind as the main line moves. That drift is expected; it is not a
design decision, and reviewers are told so on the landing page.

`cities-v-3/` is a copy of `cities-v-2/` with **two deliberate differences**:
each geography carries its own colour, and the navigation model changes — the
left rail and single long scroll become a page per section, with a nav across
the top and previous/next buttons at the foot of the content.

Content changes made in `cities-v-2/` should still be ported to `cities-v-3/`
so the two stay comparable; layout differences that follow from the navigation
model are part of the option. It also inherits option B's drift from
`cities-v-1/` outside City Overview.

Smaller options — a different chart design within a section — do not need a
folder; they ship as toggles in the chart toolbars.

## Running it

Serve the repository root over HTTP:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. Opening the files directly off the
filesystem mostly works, but serving over HTTP is more reliable — some browsers
restrict local scripts on `file://`.
