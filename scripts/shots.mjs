#!/usr/bin/env node
/* Screenshot the site's views at several viewport widths and report what
   overflows sideways — the small-screen check (Sept 2026).

   usage:  node scripts/shots.mjs [outDir] [--widths 390,768,1440]
                                  [--routes landing,overview,…] [--base http://localhost:5173/]

   Needs a dev server (npm run dev) and the local Chrome; the browser is
   driven through playwright-core, which is in node_modules, with no
   download of its own. For each width and route it writes
   <outDir>/<width>-<route>.png and prints one line: the document's and the
   .pages scroller's scrollWidth against the viewport, and the outermost
   elements that reach past the viewport's edge. "H-OVERFLOW" on a line is
   a failure; "ok" is the pass.

   The walk's stops are reached by scrolling the .pages scroller until the
   block's centre sits on the stage's centre line — the same line the
   scroll→stop effect reads (see ConstraintNarrative). */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright-core");

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--"))) || "./shots";
const BASE = opt("--base", "http://localhost:5173/");
const WIDTHS = opt("--widths", "390,768,1440").split(",").map(Number);
const ONLY = opt("--routes", "").split(",").filter(Boolean);
const CHROME = opt(
  "--chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
);
mkdirSync(OUT, { recursive: true });

/* a phone is tall and touch; a laptop is not. "--height 390" forces one
   height for every width (a phone on its side: --widths 844 --height 390) */
const HEIGHT = Number(opt("--height", "0"));
const viewportFor = (w) => ({
  width: w,
  height:
    HEIGHT || (w < 500 ? Math.round(w * 2.16) : w < 1000 ? Math.round(w * 1.33) : 900),
  mobile: w < 1000,
});

const VIEWS = [
  { name: "landing", hash: "" },
  { name: "overview", hash: "#overview" },
  { name: "overview-msa", hash: "#overview-msa" },
  { name: "export-basket", hash: "#export-basket" },
  { name: "tradable", hash: "#tradableSection" },
  { name: "admin-mix", hash: "#admin-mix" },
  { name: "levers", hash: "#levers" },
  { name: "extras", hash: "#extras" },
  { name: "constraints-0", hash: "#constraints", step: 0 },
  { name: "constraints-3", hash: "#constraints", step: 3 },
  { name: "constraints-6", hash: "#constraints", step: 6 },
  { name: "constraints-7", hash: "#constraints", step: 7 },
  { name: "constraints-9", hash: "#constraints", step: 9 },
  { name: "branch-analysis", hash: "#branch-analysis" },
  { name: "branch-analysis-mid", hash: "#branch-analysis", scrollBy: 900 },
  { name: "sandbox", hash: "#branch-analysis", toEl: "#page-tree-sandbox" },
  { name: "explainers", hash: "#explainers" },
  { name: "ex-tree", hash: "#explainers/diagnostic-tree" },
  { name: "ex-tree-mid", hash: "#explainers/diagnostic-tree", scrollBy: 1400 },
  { name: "ex-read-city", hash: "#explainers/read-a-city" },
  { name: "ex-read-city-mid", hash: "#explainers/read-a-city", scrollBy: 1400 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overflowReport(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const scroller = document.querySelector(".pages");
    const doc = { scrollWidth: document.documentElement.scrollWidth, vw };
    const pages = scroller
      ? { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth }
      : null;
    const wide = [];
    const clips = (el) => {
      const ox = getComputedStyle(el).overflowX;
      return ox === "hidden" || ox === "auto" || ox === "scroll" || ox === "clip";
    };
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")
        continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > vw + 2 || r.left < -2) {
        /* report the outermost offender only, and nothing that an ancestor
           clips or scrolls (a strip that scrolls sideways is not overflow) */
        let p = el.parentElement;
        let skip = false;
        while (p && p !== document.body) {
          if (clips(p) && p !== scroller) {
            skip = true;
            break;
          }
          const pr = p.getBoundingClientRect();
          if (pr.right > vw + 2 || pr.left < -2) {
            skip = true;
            break;
          }
          p = p.parentElement;
        }
        if (skip) continue;
        const tag = el.tagName.toLowerCase();
        const cls =
          typeof el.className === "string" && el.className.trim()
            ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
            : "";
        const id = el.id ? "#" + el.id : "";
        wide.push(
          `${tag}${id}${cls} left=${Math.round(r.left)} right=${Math.round(r.right)} w=${Math.round(r.width)}`,
        );
        if (wide.length >= 12) break;
      }
    }
    return { doc, pages, wide };
  });
}

async function scrollWalkToStep(page, i) {
  await page.evaluate((i) => {
    const track = document.querySelector(".nv-scrolly");
    const scroller = track?.closest(".pages");
    const blocks = document.querySelectorAll(".nv-step");
    const stage = document.querySelector(".nv-scrolly .jz-sticky");
    if (!track || !scroller || !blocks[i] || !stage) return;
    scroller.style.scrollBehavior = "auto";
    const b = blocks[i].getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const stacked = window.matchMedia("(max-width: 920px)").matches;
    const sr = scroller.getBoundingClientRect();
    /* the reading line: the stage's centre, or — stacked — the middle of
       the band under it (ConstraintNarrative's scroll→stop effect) */
    const line = stacked
      ? (s.bottom + sr.top + scroller.clientHeight) / 2
      : s.top + s.height / 2;
    scroller.scrollTop += b.top + b.height / 2 - line;
  }, i);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const report = [];
let failures = 0;
for (const w of WIDTHS) {
  const vp = viewportFor(w);
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.push(`[${w}] pageerror: ${e.message}`));
  for (const v of VIEWS) {
    if (ONLY.length && !ONLY.includes(v.name)) continue;
    try {
      await page.goto(BASE + v.hash, { waitUntil: "networkidle" });
      await sleep(1800);
      if (v.step !== undefined) {
        await scrollWalkToStep(page, v.step);
        await sleep(2800);
      } else if (v.toEl) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          const scroller = el?.closest(".pages");
          if (!el || !scroller) return;
          scroller.style.scrollBehavior = "auto";
          scroller.scrollTop +=
            el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 60;
        }, v.toEl);
        await sleep(1500);
      } else if (v.scrollBy) {
        await page.evaluate((dy) => {
          for (const sel of [".pages", "#explainersView"]) {
            const s = document.querySelector(sel);
            if (s && s.scrollHeight > s.clientHeight) {
              s.style.scrollBehavior = "auto";
              s.scrollTop += dy;
            }
          }
        }, v.scrollBy);
        await sleep(1500);
      }
      await page.screenshot({ path: `${OUT}/${w}-${v.name}.png`, fullPage: false });
      const o = await overflowReport(page);
      const over =
        o.doc.scrollWidth > o.doc.vw + 2 ||
        (o.pages && o.pages.scrollWidth > o.pages.clientWidth + 2);
      if (over) failures += 1;
      report.push(
        `[${w}px] ${v.name}: docW=${o.doc.scrollWidth} pagesW=${o.pages ? `${o.pages.scrollWidth}/${o.pages.clientWidth}` : "-"} ${over ? "H-OVERFLOW" : "ok"}` +
          (o.wide.length ? "\n    " + o.wide.join("\n    ") : ""),
      );
    } catch (e) {
      failures += 1;
      report.push(`[${w}px] ${v.name}: ERROR ${String(e.message).split("\n")[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(report.join("\n"));
console.log(failures ? `\n${failures} route(s) overflow or failed` : "\nno sideways overflow");
process.exit(failures ? 1 : 0);
