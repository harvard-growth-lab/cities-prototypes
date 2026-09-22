/* The site-level layout variants, outside React: what v-3's section switch
   asks (src/legacy/bridge.ts), and the few elements the variants add to
   v-3's markup — the seam's slot between the two halves, the closes under
   each section in the one-scroll layouts, and two slots in the section bar.
   Like the constraints slot, those elements live inside markup React never
   re-renders, so they are built once, by hand, and React portals into them. */

import type { CitiesBridge, LegacyApi } from "../legacy/bridge";
import { PARTS, partOfName, type SiteVariant } from "./variants";

/* the halves by section index — v-3's order, assumed until its own
   sectionDefs arrive (the switch runs once while the page is still booting) */
let parts: (0 | 1 | -1)[] = [0, 0, 0, 1, 1, -1];
export const partOf = (i: number): 0 | 1 | -1 => parts[i] ?? -1;
/** the section a half opens on */
export const firstOfPart = (p: 0 | 1) => parts.indexOf(p);
/** the two sections either side of the crossing */
export const seamSections = () => ({ last: parts.lastIndexOf(0), first: parts.indexOf(1) });

let api: LegacyApi | null = null;
let variant: SiteVariant = "paged";
/** the section the switch last landed on */
let current = 0;

/** are sections k and i up at the same time — one scroll — under this variant? */
function together(k: number, i: number) {
  if (k === i) return true;
  if (variant === "scroll") return partOf(k) >= 0 && partOf(i) >= 0;
  if (variant === "modes") return partOf(k) === 0 && partOf(i) === 0;
  return false;
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
}

/** Set before v-3 boots: the variant, for the stylesheet, and the part names
 *  the stylesheet prints over the tabs. */
export function beginSite(v: SiteVariant) {
  variant = v;
  const h = document.documentElement;
  h.dataset.site = v;
  PARTS.forEach((p) => h.style.setProperty(`--site-part-${p.n}`, `"Part ${p.n} · ${p.name}"`));
}

/** What the section switch is answered with. The baseline and the chapters
 *  answer nothing about layout — they are main's one-section pages. */
export function siteHooks(onSection: (i: number) => void): Partial<CitiesBridge> {
  const oneScroll = variant === "scroll" || variant === "modes";
  return {
    onSection(i) {
      current = i;
      paint(i);
      onSection(i);
    },
    ...(oneScroll && {
      closesInline: true,
      sectionHidden(k: number, i: number) {
        const off = !together(k, i);
        /* a section's close goes with it in the same breath — v-3 measures
           the page for its spy right after the switch, before onSection */
        const close = closes.get(k);
        if (close) close.hidden = off;
        return off;
      },
      sectionScroll(i: number) {
        /* a page of its own, or the head of the scroll: main's jump to the
           top, which also brings the masthead back */
        if (!sharesScroll(i) || i === parts.findIndex((_, k) => together(k, i))) return false;
        return scrollToSection(i, current);
      },
    }),
  };
}

/** v-3's spy names the page in view; in a shared scroll that moves the tabs */
export function spyPage(id: string) {
  if (!api || spyHeld) return;
  const i = api.sectionDefs.findIndex((sd) => sd.pages.includes(id));
  if (i < 0 || i === current || !together(i, current)) return;
  api.showSection(i, false);
}

/** a tab for the section already current does nothing on main; in a shared
 *  scroll it goes to that section's start */
function onTabClick(e: Event) {
  const nav = e.currentTarget as HTMLElement;
  const b = (e.target as Element).closest(".secnav-btn");
  if (!api || !b) return;
  const i = [...nav.children].indexOf(b);
  if (i === current && sharesScroll(i)) scrollToSection(i, current);
}

/* ---------- the elements the variants add ---------- */

export interface SiteSlots {
  /** between the two halves: the threshold band, the title page, the hand-off */
  seam: HTMLElement | null;
  /** in the section bar, before the tabs: the mode switch */
  mode: HTMLElement | null;
  /** at the section bar's right edge: the profile on call */
  recall: HTMLElement | null;
}

const closes = new Map<number, HTMLElement>();
let slots: SiteSlots | null = null;

/** Once v-3 has booted. Idempotent: StrictMode runs the boot effect twice. */
export function mountSite(a: LegacyApi): SiteSlots {
  if (slots) return slots;
  api = a;
  parts = a.sectionDefs.map((d) => partOfName(d.name));
  slots = { seam: null, mode: null, recall: null };
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

  if (variant === "scroll" || variant === "modes") {
    /* each section closes where it ends (in the paged layouts the one pager
       carries whichever close is current) */
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
    document.getElementById("secnav")?.addEventListener("click", onTabClick);
  }

  if (variant === "modes") {
    const bar = document.querySelector(".secbar");
    const nav = document.getElementById("secnav");
    if (bar && nav) {
      slots.mode = make("site-mode-slot");
      nav.before(slots.mode);
      slots.recall = make("site-recall-slot");
      bar.append(slots.recall);
    }
  }

  paint(current);
  return slots;
}
