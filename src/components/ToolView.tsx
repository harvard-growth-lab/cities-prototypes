import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_IDS, cityCountryName, cityShortName } from "../data/content";
import {
  convertPath,
  type ConstraintFlow,
  type TreeMode,
  type TreeVariant,
} from "../data/figures";
import { Toolbar } from "./Toolbar";
import { Rail } from "./Rail";
import { ExplainersView } from "./ExplainersView";
import { IntroQuiz } from "./pages/IntroQuiz";
import { OverviewSection } from "./pages/OverviewSection";
import { ExportBasketPage, ExportComplexityPage } from "./pages/ExportPages";
import { PracticePage } from "./pages/PracticePage";
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
  onOpenChat: () => void;
  onOpenJourney: () => void;
  onBackToLanding: () => void;
  onGoTo: (pageId: string) => void;
  currentPageId: string | null;
  onPageInView: (pageId: string) => void;
  onSavePractice: (text: string) => void;
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
  onOpenChat,
  onOpenJourney,
  onBackToLanding,
  onGoTo,
  currentPageId,
  onPageInView,
  onSavePractice,
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
  const branchSide = branchPath[0] === "demand" ? ("demand" as const) : ("supply" as const);

  /* which telling of the City Constraints section is mounted. Local to the
     view — nothing outside the section reads it. The two flows' scroll
     tracks differ in height, so the swap re-anchors the section in view. */
  const [constraintFlow, setConstraintFlow] = useState<ConstraintFlow>("compact");
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
        <Rail currentPageId={currentPageId} onGoTo={onGoTo} branchSide={branchSide} />

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
          <IntroQuiz cityShort={cityShort} onFinish={() => onGoTo("page-overview")} />

          <OverviewSection
            cityShort={cityShort}
            span={span}
            pagesRef={pagesRef}
            mapVisible={active && !explainersOpen}
          />

          {/* City Description (empty for now) */}
          <section className="page" id="page-description"></section>
          <section className="page" id="page-msa"></section>

          <ExportBasketPage cityShort={cityShort} />
          <ExportComplexityPage />
          <PracticePage onSave={onSavePractice} />

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
            />
          )}

          {/* the guided walk always tells the ALT structure, so while it is
              active the analysis schematic mirrors that four-leaf tree; picks
              made on it convert back into the app-wide structure */}
          <BranchAnalysisPage
            cityShort={cityShort}
            branchPath={
              constraintFlow === "guided"
                ? convertPath(branchPath, "alt")
                : branchPath
            }
            onSelectBranch={
              constraintFlow === "guided"
                ? (p) => onSelectBranch(convertPath(p, treeVariant))
                : onSelectBranch
            }
            variant={constraintFlow === "guided" ? "alt" : treeVariant}
            showThemes={showThemes}
          />

          {/* Levers for Change (empty for now) */}
          <section className="page" id="page-levers"></section>
        </main>
      </div>

      <ExplainersView open={explainersOpen} />
    </div>
  );
}
