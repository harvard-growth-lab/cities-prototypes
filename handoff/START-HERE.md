# What to paste into a new session

Copy everything between the rules into the first message of the new
session (new account, same machine, the repo open as the working
directory).

---

I'm Nil. I'm continuing the cities-prototypes design work with you; this is a new account and nothing from the previous sessions is in your memory. The repo is open at /Users/nit880/Documents/cities-prototypes (GitHub: harvard-growth-lab/cities-prototypes, branch main, everything pushed).

Before anything else, read HANDOFF.md at the repo root, then handoff/studies.md and handoff/memory-notes.md, and save the durable memories from handoff/memory-notes.md into your own memory (the working-line rule, the data notes, the light-controls feedback, the headless verification recipe, the accessibility-scope rule).

How I work, in short (HANDOFF.md section 7 has it in full):
- Edit only cities-v-5/index.html and cities-v-5/treemap.js. Never touch v-1 to v-4.
- Serve the repo root at http://127.0.0.1:8912/ (the "prototypes" server in .claude/launch.json). The app stops it on its own now and then; when I say "run the localhost", start it again.
- Verify every change in the real page, headless, with handoff/verify-harness.mjs before you tell me it is done, and show me proof (numbers and a screenshot). Keep the whole-site contrast sweep (handoff/contrast-run.mjs) at 0 failures.
- Commit messages are prose in the house voice (read ten recent ones first). Push to GitHub after every verified change, adding only the files you changed - never git add -A; the root is full of untracked sketch pages.
- A design question is sketched first: a page at the repo root with 2 to 5 variants on the real data, in the site's own dress; I pick from the page; the picks ship as an "opt" study, not as a replacement of what is there. Light controls near the figure, no all-caps, nothing that reads as AI-designed.
- One task at a time; short replies for short instructions.

Where we are: the open decision is the treemap at the sector level (HANDOFF.md section 8, item 1) - five treatments on handoff/sketches/sector-level-sketches.html; I will tell you which to build. Nothing is half-done in the code.

To show me you have the picture, tell me in five lines what the "opt" studies on the Metro Industries beats are, which one decision is open, and how you will verify your first change.

---
