import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PAGE_IDS, cityCountryName, cityShortName } from "../data/content";
import {
  DEFAULT_CONSTRAINT_FLOW,
  convertPath,
  suggestedPath,
  type ConstraintFlow,
  type TreeMode,
  type TreeVariant,
} from "../data/figures";
import { Toolbar } from "./Toolbar";
import { Rail } from "./Rail";
import { ExplainersView } from "./ExplainersView";
import {
  DEFAULT_WALK_SHAPE,
  walkShape,
} from "./pages/walkShapes";
import { ConstraintScrolly } from "./pages/ConstraintScrolly";
import { ConstraintNarrative } from "./pages/ConstraintNarrative";
import { BranchAnalysisPage } from "./pages/BranchAnalysisPage";

interface ToolViewProps {
  active: boolean;
  landingHidden: boolean;
  city: string;
  span: string;
  onCityChange: (city: string) => void;
  onSpanChange: (span: string) => void;
  explainersOpen: boolean;
  onToggleExplainers: () => void;
  /** which explainer is open inside the section, or null for the gallery */
  openExplainer: string | null;
  onOpenExplainer: (id: string | null) => void;
  onOpenChat: () => void;
  onOpenJourney: () => void;
  onBackToLanding: () => void;
  onGoTo: (pageId: string) => void;
  currentPageId: string | null;
  onPageInView: (pageId: string) => void;
  /** the descent picked on the diagnostic tree (ids below the root) */
  branchPath: string[];
  onSelectBranch: (path: string[]) => void;
  /** the tree section's top-level structure choice */
  treeMode: TreeMode;
  onTreeModeChange: (m: TreeMode) => void;
  /** derived from the mode, for the sections that only need the shape */
  treeVariant: TreeVariant;
  showThemes: boolean;
}

export function ToolView({
  active,
  landingHidden,
  city,
  span,
  onCityChange,
  onSpanChange,
  explainersOpen,
  onToggleExplainers,
  openExplainer,
  onOpenExplainer,
  onOpenChat,
  onOpenJourney,
  onBackToLanding,
  onGoTo,
  currentPageId,
  onPageInView,
  branchPath,
  onSelectBranch,
  treeMode,
  onTreeModeChange,
  treeVariant,
  showThemes,
}: ToolViewProps) {
  const pagesRef = useRef<HTMLElement>(null);
  const cityShort = cityShortName(city);
  const country = cityCountryName(city);

  /* which telling of the City Constraints section is mounted. Local to the
     view — nothing outside the section reads it. The two flows' scroll
     tracks differ in height, so the swap re-anchors the section in view. */
  const [constraintFlow, setConstraintFlow] = useState<ConstraintFlow>(
    DEFAULT_CONSTRAINT_FLOW,
  );
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
     because it spans both sections — the narrative pins the route, the
     analysis is what lifts the pin. */
  const [routeReleased, setRouteReleased] = useState(false);
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

  /* scroll spy: tracks the page in view for the rail + journey, and toggles
     .inview on sections so their entrance animations re-trigger */
  useEffect(() => {
    const root = pagesRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          e.target.classList.toggle("inview", e.isIntersecting);
          if (e.isIntersecting) onPageInView(e.target.id);
        });
      },
      { root, threshold: 0.55 },
    );
    /* the two City Constraints steps live inside the scrolly's sticky track
       and report themselves from its scroll position — a mid-track flip is
       beyond a visibility-ratio observer on thin anchors */
    const selfReporting = new Set(["page-constraints", "page-constraints-diagnose"]);
    PAGE_IDS.forEach((id) => {
      if (selfReporting.has(id)) return;
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [onPageInView]);

  return (
    <div id="tool" className={active ? "active" : ""}>
      <Toolbar
        city={city}
        span={span}
        onCityChange={onCityChange}
        onSpanChange={onSpanChange}
        explainersOpen={explainersOpen}
        onToggleExplainers={onToggleExplainers}
        onOpenChat={onOpenChat}
        onOpenJourney={onOpenJourney}
        onLogoClick={onBackToLanding}
      />

      <div className="tool-body" style={explainersOpen ? { display: "none" } : undefined}>
        <Rail currentPageId={currentPageId} onGoTo={onGoTo} />

        <main
          className="pages"
          ref={pagesRef}
          onWheel={(e) => {
            /* scrolling up at the very top slides the landing back down */
            const pages = pagesRef.current;
            if (landingHidden && !explainersOpen && pages && pages.scrollTop <= 1 && e.deltaY < -25) {
              onBackToLanding();
            }
          }}
        >
          {/* every section outside City Constraints is an empty shell —
              the anchors exist so the rail highlights and the journey
              counts, but only the prototype section carries content */}
          <section className="page" id="page-intro-q1"></section>
          <section className="page" id="page-intro-q2"></section>
          <section className="page" id="page-overview"></section>
          <section className="page" id="page-overview-msa"></section>
          <section className="page" id="page-description"></section>
          <section className="page" id="page-msa"></section>
          <section className="page" id="page-export-basket"></section>
          <section className="page" id="page-export-complexity"></section>
          <section className="page" id="page-practice"></section>

          {constraintFlow === "compact" ? (
            <ConstraintScrolly
              cityShort={cityShort}
              country={country}
              selectedPath={branchPath}
              onSelectPath={onSelectBranch}
              onPhaseInView={onPageInView}
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
              onPhaseInView={onPageInView}
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
          />

          {/* Levers for Change (empty for now) */}
          <section className="page" id="page-levers"></section>
        </main>
      </div>

      <ExplainersView open={explainersOpen} openId={openExplainer} onOpen={onOpenExplainer} />
    </div>
  );
}
