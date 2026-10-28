import { useMemo, useSyncExternalStore } from "react";
import { getVariant, readCommuters, subscribeVariant } from "./study";
import { Blocks } from "./Blocks";
import { Bars } from "./Bars";
import { Stacked } from "./Stacked";
import { UnitVenn } from "./UnitVenn";
import { Figures } from "./Figures";

/* Who am I?'s commuting figure, opt-4 onwards (src/commuters/study.ts says
   how they sit in main's menu). Each is drawn to the box main's panel leaves
   it — the panel is a fixed band on narrow screens and a fixed frame on a
   desk — and plays when it comes on screen, with opt-2's choreography
   (shared.tsx). Colours are main's three: --flow-in, --flow-both, --flow-out. */

export function CommuterVariants() {
  const v = useSyncExternalStore(subscribeVariant, getVariant);
  const d = useMemo(readCommuters, []);
  if (!v || !d) return null;
  if (v === "blocks") return <Blocks d={d} />;
  if (v === "bars") return <Bars d={d} />;
  if (v === "stacked") return <Stacked d={d} />;
  if (v === "per100") return <UnitVenn d={d} />;
  return <Figures d={d} />;
}
