import { useMemo, useState } from "react";
import { cityCountryName, cityShortName } from "../data/content";
import { convertPath, suggestedPath, type TreeVariant } from "../data/figures";
import { DEFAULT_WALK_SHAPE, walkShape } from "./pages/walkShapes";
import { ConstraintNarrative } from "./pages/ConstraintNarrative";
import { BranchAnalysisPage } from "./pages/BranchAnalysisPage";
import { TreeSandboxPage } from "./pages/TreeSandboxPage";

interface ConstraintsSectionProps {
  city: string;
  /** derived from the app-wide mode, for the sections that only need the shape */
  treeVariant: TreeVariant;
  showThemes: boolean;
  /** the descent picked on the diagnostic tree (ids below the root) */
  branchPath: string[];
  onSelectBranch: (path: string[]) => void;
  /** the scrolly reports its own page from its sticky track */
  onPhaseInView: (pageId: string) => void;
}

/** City Constraints — this branch's section: the chart, the guided walk
 *  down the diagnostic tree, and the branch analysis that follows. It is
 *  drawn into v-3's page (src/legacy) where its placeholder section was.
 *
 *  The section tells ONE walk (Sept 2026): the zoomed walk over the
 *  four-quadrant forked tree. The user-flow switch and the tellings it chose
 *  between — the initial draft, the guided walk, the shortened guided walk —
 *  came off with that decision; see git history. */
export function ConstraintsSection({
  city,
  treeVariant,
  showThemes,
  branchPath,
  onSelectBranch,
  onPhaseInView,
}: ConstraintsSectionProps) {
  const cityShort = cityShortName(city);
  const country = cityCountryName(city);

  /* The walk tells ONE tree — the four-quadrant forked structure — so the
     shape is settled rather than chosen. This still reads it through
     walkShape() because the branch-analysis section below has to mirror
     whatever the walk drew. */
  const walkVariant = walkShape(DEFAULT_WALK_SHAPE).variant;
  /* The analysis section mirrors the walk's tree, so the app's pick (held on
     the app-wide structure) converts into the walk's. The alias cannot
     recover a shock's SIGN, so a pick that merely mirrors the city's own
     suggestion reads AS the walk's sign-aware suggestion — otherwise the
     schematic would mark a quadrant branch no one chose. */
  const walkPath = useMemo(() => {
    /* "hasn't deviated" is read against the APP's own default for this city
       — projecting the walk's suggestion into the app space instead loses
       the leaf on the one-element quad path and never matches */
    const appSugg = suggestedPath(cityShort, treeVariant);
    return appSugg.join("/") === branchPath.join("/")
      ? suggestedPath(cityShort, walkVariant)
      : convertPath(branchPath, walkVariant);
  }, [cityShort, walkVariant, treeVariant, branchPath]);
  /* the analysis section's schematic floats over the viewport, and it must
     not be up while either neighbour is: the walk's pinned stage above —
     the tree itself, which the schematic would only duplicate while it is
     still on screen — or the sandbox below, which owns the same corner.
     The stage starts as "up": the walk reports its true state on mount. */
  const [sandboxUp, setSandboxUp] = useState(false);
  const [stageUp, setStageUp] = useState(true);

  return (
    <>
      <ConstraintNarrative
        cityShort={cityShort}
        country={country}
        selectedPath={branchPath}
        onSelectPath={onSelectBranch}
        onPhaseInView={onPhaseInView}
        onStageInView={setStageUp}
        variant={treeVariant}
      />

      {/* the analysis schematic mirrors the tree the walk just drew —
          including its shape, so a third branch up there is a third branch
          down here; picks made on it convert back into the app-wide
          structure */}
      <BranchAnalysisPage
        cityShort={cityShort}
        branchPath={walkPath}
        onSelectBranch={(p) => onSelectBranch(convertPath(p, treeVariant))}
        variant={walkVariant}
        showThemes={showThemes}
        floatSuppressed={stageUp || sandboxUp}
      />

      {/* the room off the flow: the whole tree again, live, after the guided
          read has finished with its one ending. It is deliberately AFTER the
          analysis and before the checkpoint — a reader who never opens it has
          missed nothing, and a reader who does has somewhere to put the
          "what about the others?" the guided read provokes. Nothing in it
          reaches the section above: an ending's analysis opens inside the
          sandbox, under its tree, so the page never sends the reader back
          up. */}
      <TreeSandboxPage cityShort={cityShort} onInView={setSandboxUp} />
    </>
  );
}
