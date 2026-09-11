import { useCallback, useEffect, useMemo, useState } from "react";
import { cityCountryName, cityShortName } from "../data/content";
import {
  CONSTRAINT_FLOWS,
  DEFAULT_CONSTRAINT_FLOW,
  convertPath,
  suggestedPath,
  type ConstraintFlow,
  type TreeMode,
  type TreeVariant,
} from "../data/figures";
import { DEFAULT_WALK_SHAPE, walkShape } from "./pages/walkShapes";
import { ConstraintScrolly } from "./pages/ConstraintScrolly";
import { ConstraintNarrative } from "./pages/ConstraintNarrative";
import { BranchAnalysisPage } from "./pages/BranchAnalysisPage";
import { TreeSandboxPage } from "./pages/TreeSandboxPage";

interface ConstraintsSectionProps {
  city: string;
  /** the tree section's top-level structure choice */
  treeMode: TreeMode;
  onTreeModeChange: (m: TreeMode) => void;
  /** derived from the mode, for the sections that only need the shape */
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
 *  drawn into v-3's page (src/legacy) where its placeholder section was. */
export function ConstraintsSection({
  city,
  treeMode,
  onTreeModeChange,
  treeVariant,
  showThemes,
  branchPath,
  onSelectBranch,
  onPhaseInView,
}: ConstraintsSectionProps) {
  const cityShort = cityShortName(city);
  const country = cityCountryName(city);

  /* which telling of the section is mounted. Local — nothing outside the
     section reads it. The two flows' scroll tracks differ in height, so the
     swap re-anchors the section in view. */
  const [constraintFlow, setConstraintFlow] = useState<ConstraintFlow>(() => {
    /* a flow named in the URL's query (?flow=zoom) opens the section on
       that telling, so a variant can be linked to — and screenshot —
       without opening the disclosure first */
    const q = new URLSearchParams(window.location.search).get("flow");
    return CONSTRAINT_FLOWS.some((f) => f.id === q)
      ? (q as ConstraintFlow)
      : DEFAULT_CONSTRAINT_FLOW;
  });
  /* both guided tellings ("guided" and its shortened cut) mount the narrative,
     so they gate the same things */
  const guidedFlow = constraintFlow !== "compact";
  /* The walk tells ONE tree now (team revision, Sept 2026) — the
     four-quadrant forked structure — so the shape is settled rather than
     chosen. This still reads it through walkShape() because the
     branch-analysis section below has to mirror whatever the walk drew. */
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
  /* The shortened walk reads the chart, the tree and the branch analysis as
     ONE piece: the route stays on the diagnosis the whole way down, and only
     the end of the analysis hands the choice over. The release lives here
     because it spans both parts — the narrative pins the route, the
     analysis is what lifts the pin. */
  const [routeReleased, setRouteReleased] = useState(false);
  /* the analysis section's schematic floats over the viewport, and it must
     not be up while either neighbour is: the walk's pinned stage above —
     the tree itself, which the schematic would only duplicate while it is
     still on screen — or the sandbox below, which owns the same corner.
     The stage starts as "up": the walk reports its true state on mount. */
  const [sandboxUp, setSandboxUp] = useState(false);
  const [stageUp, setStageUp] = useState(true);
  useEffect(() => setRouteReleased(false), [constraintFlow, city]);
  const routeHeld = constraintFlow === "short" && !routeReleased;
  const changeConstraintFlow = useCallback((f: ConstraintFlow) => {
    setConstraintFlow(f);
    requestAnimationFrame(() =>
      document
        .getElementById("page-constraints")
        ?.scrollIntoView({ behavior: "auto", block: "start" }),
    );
  }, []);

  return (
    <>
      {constraintFlow === "compact" ? (
        <ConstraintScrolly
          cityShort={cityShort}
          country={country}
          selectedPath={branchPath}
          onPhaseInView={onPhaseInView}
          onStageInView={setStageUp}
          variant={treeVariant}
          showThemes={showThemes}
          mode={treeMode}
          onModeChange={onTreeModeChange}
          flow={constraintFlow}
          onFlowChange={changeConstraintFlow}
        />
      ) : (
        <ConstraintNarrative
          cityShort={cityShort}
          country={country}
          selectedPath={branchPath}
          onSelectPath={onSelectBranch}
          onPhaseInView={onPhaseInView}
          onStageInView={setStageUp}
          variant={treeVariant}
          flow={constraintFlow}
          onFlowChange={changeConstraintFlow}
          routePinned={routeHeld}
        />
      )}

      {/* while a guided walk is active the analysis schematic mirrors the
          tree the walk just drew — including its shape, so a third branch
          up there is a third branch down here; picks made on it convert
          back into the app-wide structure */}
      <BranchAnalysisPage
        cityShort={cityShort}
        branchPath={guidedFlow ? walkPath : branchPath}
        onSelectBranch={
          guidedFlow
            ? (p) => onSelectBranch(convertPath(p, treeVariant))
            : onSelectBranch
        }
        variant={guidedFlow ? walkVariant : treeVariant}
        showThemes={showThemes}
        routeHeld={routeHeld}
        onReachEnd={() => setRouteReleased(true)}
        treePickable={constraintFlow !== "short"}
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
