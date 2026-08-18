import type { ComponentType } from "react";
import { TreePage } from "./tree/TreePage";
import { TreeThumb } from "./tree/TreeThumb";
import { ReadCityPage } from "./read-city/ReadCityPage";
import { ReadCityThumb } from "./read-city/ReadCityThumb";

/** One visual explainer: a card on the Explainers gallery and the page it
 *  opens. Adding an explainer means adding an entry here — the gallery, the
 *  routing and the deep links all read this list. */
export interface Explainer {
  /** the URL segment under "#explainers/" — a shared link, so keep it stable */
  id: string;
  title: string;
  read: string;
  desc: string;
  Thumb: ComponentType;
  Page: ComponentType;
}

export const EXPLAINERS: Explainer[] = [
  {
    id: "diagnostic-tree",
    title: "How to Read the Diagnostic Tree",
    read: "4min read",
    desc: "Two dials — people and pay — two questions, and four diagnoses. How every US city over 100k sorts down the tree, one fork at a time.",
    Thumb: TreeThumb,
    Page: TreePage,
  },
  {
    id: "read-a-city",
    title: "How to Read a City",
    read: "6min read",
    desc: "Lit windows, moving trucks, cranes, dark storefronts. A pixel town tells you how it's doing — no spreadsheets — if you know the code.",
    Thumb: ReadCityThumb,
    Page: ReadCityPage,
  },
];

/** the explainer for an id, or null — the routing uses this to reject
 *  unknown "#explainers/…" slugs rather than rendering a blank section */
export const explainerById = (id: string | null): Explainer | null =>
  EXPLAINERS.find((e) => e.id === id) ?? null;
