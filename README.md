A shared repository for housing prototypes related to the 2026-2027 Bloomberg Cities project.

Everything here is a static site. `main` is published with GitHub Pages, so
whatever is on `main` is what reviewers see — which is why design options live
in their own folder rather than on a branch. A branch would not be hosted.

```
index.html      landing page listing the prototypes, served at the Pages root
cities-v-1/     the Cities Tool — the main line
cities-v-2/     alternative structure for City Overview (design option B)
cities-v-3/     option B in a different palette (design option C)
```

## Design options

`cities-v-2/` is a full copy of `cities-v-1/`, not a successor. It exists so an
alternative City Overview can change the section's structure — add a page, drop
the sticky map, rearrange the flow — without that having to be expressible as a
toggle inside the current markup.

Only City Overview is the subject of the option. Every other section in
`cities-v-2/` is a snapshot of `cities-v-1/` taken when the copy was made and
will fall behind as the main line moves. That drift is expected; it is not a
design decision, and reviewers are told so on the landing page.

`cities-v-3/` is a copy of `cities-v-2/` in which **only the palette changes**.
Structure, content and behaviour stay identical to option B, so the two can be
compared on colour alone.

That makes it the one folder here whose contents are meant to stay in step with
another: a functional change made in `cities-v-2/` has to be made in
`cities-v-3/` too, or the colour comparison stops being like-for-like. It also
inherits option B's drift from `cities-v-1/` outside City Overview.

Smaller options — a different chart design within a section — do not need a
folder. Two of them already ship inside `cities-v-1/` as **"Bar design option"**
toggles in the chart toolbars.

## Running it

Serve the repository root over HTTP:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. Opening the files directly off the
filesystem mostly works, but serving over HTTP is more reliable — some browsers
restrict local scripts on `file://`.
