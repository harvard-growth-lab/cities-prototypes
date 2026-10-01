/* The site-level layout variants, outside React: what v-3's section switch
   asks (src/legacy/bridge.ts), and the few elements the variants add to
   v-3's markup — the seam's slot between the two halves, and, in the one
   scroll, the closes under each section. (The two scrolls break their
   sections with main's own teal closes, which v-3 builds for its one-scroll
   layout and hides and shows with each section; site.css only lets them be
   seen.)
   Like the constraints slot, those elements live inside markup React never
   re-renders, so they are built once, by hand, and React portals into them. */

import type { CitiesBridge, LegacyApi } from "../legacy/bridge";
import { PARTS, partOfName, type SiteVariant } from "./variants";

/* the halves by section index — v-3's order, assumed until its own
   sectionDefs arrive (the switch runs once while the page is still booting) */
let parts: (0 | 1 | -1)[] = [0, 0, 0, 1, 1, -1];
export const partOf = (i: number): 0 | 1 | -1 => parts[i] ?? -1;
/** the two sections either side of the crossing */
export const seamSections = () => ({ last: parts.lastIndexOf(0), first: parts.indexOf(1) });

let api: LegacyApi | null = null;
let variant: SiteVariant = "paged";
/** the section the switch last landed on */
let current = 0;

/** are sections k and i up at the same time — one scroll — under this variant? */
function together(k: number, i: number) {
  if (k === i) return true;
  if (partOf(k) < 0 || partOf(i) < 0) return false;
  /* the one scroll keeps the storyline up; the two scrolls, a half each */
  return variant === "scroll" || (variant === "halves" && partOf(k) === partOf(i));
}
export const sharesScroll = (i: number) => parts.some((_, k) => k !== i && together(k, i));

/* ---------- where a switch scrolls to ---------- */

const pagesEl = () => document.getElementById("pages");
const chromeH = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chrome-h")) || 67;

/** v-3 resolves an id through its scrolly engines first: inside a scrolly
 *  the section's own element is not the thing on screen */
function targetFor(id: string): HTMLElement | null {
  const w = window as unknown as Record<string, ((id: string) => HTMLElement | null) | undefined>;
  return w.ovStepFor?.(id) || w.ctStepFor?.(id) || document.getElementById(id);
}

/* while a scroll of ours is gliding, the spy would walk the tabs through
   every section it passes */
let spyHeld = false;

function scrollToSection(i: number, from: number) {
  const pages = pagesEl();
  const el = api && targetFor(api.sectionDefs[i].entry);
  if (!pages || !el) return false;
  const aim = () =>
    el.getBoundingClientRect().top - pages.getBoundingClientRect().top + pages.scrollTop - chromeH();
  /* glide to a neighbour already on the page; jump when the section was on
     another page a moment ago, or is screens away */
  const near = together(from, i) && Math.abs(aim() - pages.scrollTop) < pages.clientHeight * 1.5;
  if (near) {
    spyHeld = true;
    const release = () => {
      spyHeld = false;
      pages.removeEventListener("scrollend", release);
    };
    pages.addEventListener("scrollend", release);
    window.setTimeout(release, 1200);
    pages.scrollTo({ top: aim(), behavior: "smooth" });
  } else {
    pages.scrollTo({ top: aim(), behavior: "instant" });
    /* v-3 re-measures its figures on the resize it fires after the switch;
       aim again once that has settled */
    requestAnimationFrame(() => pages.scrollTo({ top: aim(), behavior: "instant" }));
  }
  return true;
}

/* ---------- what the page is told ---------- */

function paint(i: number) {
  const h = document.documentElement;
  h.dataset.siteSec = String(i);
  h.dataset.sitePart = String(partOf(i) + 1); // "1" | "2", "0" outside the storyline
  /* the last section of the storyline: its Next is the one door OUT (to
     Extras). The one scroll keeps that Next and drops the others, which
     point at sections already on the page. */
  h.dataset.siteExit = partOf(i) >= 0 && partOf(i + 1) < 0 ? "1" : "0";
  closes.forEach((el, k) => {
    el.hidden = !together(k, i);
  });
  if (variant === "halves") aimPager(i);
}

/** The two scrolls: main's pager names the sections either side of the
 *  current one, and inside a half those are already on the page. In the
 *  second half its cards are re-aimed at what is off the page — Previous
 *  back to the first half, Next to whatever follows the storyline. v-3
 *  rewrites the pager on every switch, before onSection, so this runs after
 *  each rewrite; the click is still main's own, which reads data-go. (The
 *  first half has no pager: its Next is in the close that ends it.) */
function aimPager(i: number) {
  if (!api || partOf(i) !== 1) return;
  const pager = document.querySelector(".secpager");
  const aim = (card: string, to: number, name: string) => {
    const b = pager?.querySelector<HTMLElement>(card);
    const label = b?.querySelector(".pgc-name");
    if (!b || !label) return;
    b.dataset.go = String(to);
    label.textContent = name;
    /* the card's badge is the target's stop: a number ahead (behind, main's check stands) */
    const badge = b.querySelector(".pgc-stop:not(.is-past)");
    if (badge) badge.textContent = String(to + 1);
  };
  aim(".pgc--prev", parts.indexOf(0), PARTS[0].name);
  const out = parts.lastIndexOf(1) + 1;
  if (api.sectionDefs[out]) aim(".pgc--next", out, api.sectionDefs[out].name);
}

/** The two scrolls: the first half's page ends on its last section's teal
 *  close. Main's cue there — "Keep scrolling · <the next section>" — is
 *  written for its one scroll; here that section is on another page, so the
 *  cue goes and the way on takes the close's foot: a row of its own under a
 *  hairline, named for the part it opens. The close's own click handler
 *  (main's) follows any [data-go] inside it, so the button needs no wiring. */
function endFirstHalf() {
  const { last, first } = seamSections();
  const close = document.querySelector(`#seal-${last} .seal-in`);
  if (!close || close.querySelector(".site-next")) return;
  const actions = close.querySelector(".seal-actions");
  actions?.querySelector(".seal-cue")?.remove();
  /* a close without a quiz had nothing else in that row */
  if (actions && !actions.children.length) actions.remove();
  const two = PARTS[1];
  const row = document.createElement("div");
  row.className = "site-next-row";
  row.innerHTML =
    `<button type="button" class="site-next" data-go="${first}">` +
    '<span class="site-next-k">Next</span>' +
    `<span class="site-next-name">Part ${two.n}: ${two.name.replace(/&/g, "&amp;")}</span>` +
    '<span class="site-next-go" aria-hidden="true"><svg class="site-arrow" viewBox="0 0 16 10" width="18" height="11.25">' +
    '<path d="M1 5h13M10 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
    "</button>";
  close.append(row);
}

/** Set before v-3 boots: the variant, for the stylesheet, and the part names
 *  the stylesheet prints over the tabs. */
export function beginSite(v: SiteVariant) {
  variant = v;
  const h = document.documentElement;
  h.dataset.site = v;
  PARTS.forEach((p) => h.style.setProperty(`--site-part-${p.n}`, `"Part ${p.n} · ${p.name}"`));
}

/** What the section switch is answered with. The baseline answers nothing
 *  about layout — it is main's one-section pages. */
export function siteHooks(): Partial<CitiesBridge> {
  const stacked = variant !== "paged";
  return {
    onSection(i) {
      current = i;
      switching = false;
      /* a switch made any other way than by settle() is where the reader is */
      if (!settling) spied = i;
      paint(i);
    },
    ...(stacked && {
      /* the two scrolls close a section with main's teal block, whose quiz
         is main's dialog */
      closesInline: variant === "scroll",
      sectionHidden(k: number, i: number) {
        beginSwitch();
        const off = !together(k, i);
        /* a section's close goes with it in the same breath — v-3 measures
           the page for its spy right after the switch, before onSection */
        const close = closes.get(k);
        if (close) close.hidden = off;
        return off;
      },
      sectionScroll(i: number) {
        /* a page of its own, or the head of the scroll: main's jump to the
           top, which also brings the masthead back. The second of the two
           scrolls has the board above its head: arriving from another page
           lands on the board, at the top; a move inside the half goes to
           the section. (`current` is still the section being left.) */
        if (!sharesScroll(i)) return false;
        const head = i === parts.findIndex((_, k) => together(k, i));
        const underBoard = variant === "halves" && partOf(i) === 1 && together(current, i);
        if (head && !underBoard) return false;
        return scrollToSection(i, current);
      },
    }),
  };
}

/** v-3's spy names the page in view; in a shared scroll that moves the tabs */
export function spyPage(id: string) {
  if (!api) return;
  const i = api.sectionDefs.findIndex((sd) => sd.pages.includes(id));
  if (i < 0) return;
  spied = i;
  settle();
}

/* ---------- the two scrolls: a close counts as its section ----------
   v-3's spy names the page with the most of the viewport, and a teal close
   is not a page: half-way through one the next section already has more of
   the screen, and over the board that opens part two no page has any.
   Main's rule in its own one scroll is that a section's close still counts
   as that section, read at a line 40% down the viewport. The same line is
   read here, and the board counts as the section it opens onto. */

/** the section the spy last named (or a deliberate switch landed on) */
let spied = -1;
let settling = false;
/* v-3's switch is under way, between its first question (sectionHidden) and
   onSection. It fires a resize in between, on which its spy reports — off a
   page whose sections have changed and whose html attributes have not. A
   settle on that reading would start a second switch inside the first, and
   the first would then finish over it. */
let switching = false;
function beginSwitch() {
  if (switching) return;
  switching = true;
  /* a backstop, should a switch ever end without reaching onSection */
  requestAnimationFrame(() => {
    switching = false;
  });
}

const readingLine = (pages: HTMLElement) => pages.getBoundingClientRect().top + pages.clientHeight * 0.4;
const sealOf = (k: number) => (variant === "halves" ? document.getElementById(`seal-${k}`) : null);

function closeUnderLine(): number {
  const pages = pagesEl();
  if (variant !== "halves" || !pages) return -1;
  const line = readingLine(pages);
  const under = (el: Element | null | undefined) => {
    const r = el?.getBoundingClientRect();
    return !!r && r.height > 0 && r.top <= line && r.bottom > line;
  };
  if (under(slots?.seam)) return seamSections().first;
  return parts.findIndex((_, k) => under(sealOf(k)));
}

/** section k's close is up and has not reached the line yet */
function closeAhead(k: number) {
  const pages = pagesEl();
  const r = sealOf(k)?.getBoundingClientRect();
  return !!pages && !!r && r.height > 0 && r.top > readingLine(pages);
}

/** the tabs follow the close under the line, else the page the spy named —
 *  which can be the section AFTER a close while that close is still below
 *  the line (a sliver of the next page outweighs a section whose last page
 *  has scrolled off): the reader is not past a close until it has passed */
function settle() {
  if (!api || spyHeld || switching) return;
  const k = closeUnderLine();
  let want = k >= 0 ? k : spied;
  if (k < 0) while (want > 0 && closeAhead(want - 1)) want--;
  if (want < 0 || want === current || !together(want, current)) return;
  settling = true;
  api.showSection(want, false);
  settling = false;
}

let settleTick = false;
function onPagesScroll() {
  if (settleTick) return;
  settleTick = true;
  requestAnimationFrame(() => {
    settleTick = false;
    settle();
  });
}

/** a tab for the section already current does nothing on main; in a shared
 *  scroll it goes to that section's start. "Already current" is read before
 *  the click reaches the tab (capture): main's own handler runs first on the
 *  way back up, and a switch it has just made is not this case. */
let currentAtClick = -1;
function beforeTabClick() {
  currentAtClick = current;
}
function onTabClick(e: Event) {
  const nav = e.currentTarget as HTMLElement;
  const b = (e.target as Element).closest(".secnav-btn");
  if (!api || !b) return;
  const i = [...nav.children].indexOf(b);
  if (i === currentAtClick && i === current && sharesScroll(i)) scrollToSection(i, current);
}

/* ---------- the elements the variants add ---------- */

export interface SiteSlots {
  /** between the two halves: the board the reader crosses on */
  seam: HTMLElement | null;
}

const closes = new Map<number, HTMLElement>();
let slots: SiteSlots | null = null;

/** Once v-3 has booted. Idempotent: StrictMode runs the boot effect twice. */
export function mountSite(a: LegacyApi): SiteSlots {
  if (slots) return slots;
  api = a;
  parts = a.sectionDefs.map((d) => partOfName(d.name));
  slots = { seam: null };
  if (variant === "paged") return slots;

  const make = (id: string) => {
    const el = document.createElement("div");
    el.id = id;
    return el;
  };
  /* a section's top-level element, as the switch finds it */
  const rootOf = (id: string) => {
    const el = document.getElementById(id);
    return el && ((el.closest(".ov-wrap, .sec-root") as HTMLElement | null) || el);
  };

  const firstOfTwo = rootOf(a.sectionDefs[seamSections().first].entry);
  if (firstOfTwo) {
    slots.seam = make("site-seam-slot");
    firstOfTwo.before(slots.seam);
  }

  /* the one scroll: each section closes (quiz + insight) where it ends */
  if (variant === "scroll")
    a.sectionDefs.forEach((sd, k) => {
      const html = a.renderSecClose(sd.name);
      const root = rootOf(sd.entry);
      if (!html || !root) return;
      const holder = make(`site-close-${k}`);
      holder.className = "site-close";
      holder.innerHTML = html;
      root.after(holder);
      a.wireSecClose(sd.name);
      closes.set(k, holder);
    });
  document.getElementById("secnav")?.addEventListener("click", beforeTabClick, true);
  document.getElementById("secnav")?.addEventListener("click", onTabClick);
  /* the spy speaks only when the page in view changes; a close passing the
     line needs every scroll */
  if (variant === "halves") {
    pagesEl()?.addEventListener("scroll", onPagesScroll, { passive: true });
    endFirstHalf();
  }

  paint(current);
  return slots;
}
