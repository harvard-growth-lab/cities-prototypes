/* Section-level variants of Constraints Diagnosis (Oct 2026) — a STUDY,
   chosen with ?constraints=.

   The section as built is the pathway: a walk down one tree to one ending,
   whose ending decides the modules the analysis reads. The team is looking
   at an open-ended approach instead — several tests, the quadrant test
   among them, suggesting the most relevant modules while the reader can
   open any of them (src/data/diagTests.ts). Each variant below is one way
   of telling that, swapped in for the WHOLE section:

     pathway   the section as it is: the walk, the analysis, the sandbox
     guided    a scrolly, one test a stop; the modules' relevance adds up
               on the stage, then the reader picks what to read
     bench     every test at once as cards, then the module board
     explorer  module-first: the tests are a strip, the modules a ranked
               list, one module open at a time

   Unlike the site layout (a navigation, since v-3 reads it at boot), the
   section variant is plain React state; the URL only remembers it, so a
   link or a reload opens on the same variant. */

export type CdVariant = "pathway" | "guided" | "bench" | "explorer";
export type OpenVariant = Exclude<CdVariant, "pathway">;

export const DEFAULT_CD_VARIANT: CdVariant = "pathway";

export const CD_VARIANTS: { id: CdVariant; label: string; note: string }[] = [
  { id: "pathway", label: "Diagnostic Pathway", note: "the current walk: the tree leads to one ending" },
  { id: "guided", label: "Guided Tests", note: "one test a step; the modules' relevance adds up" },
  { id: "bench", label: "Test Bench", note: "every test at once, then choose the modules" },
  { id: "explorer", label: "Module Explorer", note: "browse any module, ranked by the tests" },
];

const PARAM = "constraints";

export function readCdVariant(): CdVariant {
  const v = new URLSearchParams(window.location.search).get(PARAM);
  return CD_VARIANTS.some((s) => s.id === v) ? (v as CdVariant) : DEFAULT_CD_VARIANT;
}

/** remember the variant in the URL, keeping the hash (the default carries
 *  no param) */
export function writeCdVariant(v: CdVariant) {
  const url = new URL(window.location.href);
  if (v === DEFAULT_CD_VARIANT) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, v);
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
}
