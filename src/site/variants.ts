/* Site-level layout variants (Sept 2026) — a STUDY, chosen with ?site=.

   The tool's five sections fall into two halves of different kinds: the
   first three describe the city (an informational overview, read), the last
   two diagnose it and act on the diagnosis (interactive, and built on the
   first three). On main they run as one linear flow of five tabs. Each
   variant here organises the two halves differently and marks the crossing
   between them in its own way:

     paged     main's page, untouched — the baseline to compare against
     scroll    everything in one scroll; a threshold band marks the crossing
     halves    each half its own scroll; the first ends on a Next in its
               last section's close, and the same board opens the second

   (Two more were tried and deleted in Oct 2026: "chapters", a title page in
   the Prev / Next sequence, and "modes", a browsed profile beside a stepped
   diagnosis.)

   The variant is read once, from the URL, before v-3's page boots: what the
   section switch asks of React (src/legacy/bridge.ts) is fixed for the life
   of the page, so changing variant is a navigation, not a state change. */

export type SiteVariant = "paged" | "scroll" | "halves";

export const DEFAULT_SITE_VARIANT: SiteVariant = "paged";

export const SITE_VARIANTS: { id: SiteVariant; label: string; note: string }[] = [
  { id: "paged", label: "Current", note: "five sections, one linear flow" },
  { id: "scroll", label: "One scroll", note: "a threshold band marks part two" },
  { id: "halves", label: "Two scrolls", note: "each part one scroll, a Next between" },
];

/** The two halves, by the names v-3's sectionDefs carry. The part names are
 *  working labels — change them here and every variant follows. */
export const PARTS = [
  {
    n: 1,
    name: "City Profile",
    kind: "read",
    sections: ["Who are you?", "Metro Industries", "Worker Flows"],
  },
  {
    n: 2,
    name: "Diagnose & Act",
    kind: "do",
    sections: ["Constraints Diagnosis", "Levers for Change"],
  },
] as const;

export type PartIndex = 0 | 1;

/** which half a section belongs to; -1 for a section outside the storyline (Extras) */
export const partOfName = (name: string): PartIndex | -1 =>
  (PARTS[0].sections as readonly string[]).includes(name)
    ? 0
    : (PARTS[1].sections as readonly string[]).includes(name)
      ? 1
      : -1;

const PARAM = "site";

export function readSiteVariant(): SiteVariant {
  const v = new URLSearchParams(window.location.search).get(PARAM);
  return SITE_VARIANTS.some((s) => s.id === v) ? (v as SiteVariant) : DEFAULT_SITE_VARIANT;
}

/** the same place in the tool, under another variant (the default carries no param) */
export function hrefForVariant(v: SiteVariant): string {
  const url = new URL(window.location.href);
  if (v === DEFAULT_SITE_VARIANT) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, v);
  return url.pathname + url.search + url.hash;
}
