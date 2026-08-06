import { useEffect, useRef } from "react";
import { PAGE_IDS, cityCountryName, cityShortName } from "../data/content";
import type { TreeMode, TreeVariant } from "../data/figures";
import { Toolbar } from "./Toolbar";
import { Rail } from "./Rail";
import { ExplainersView } from "./ExplainersView";
import { IntroQuiz } from "./pages/IntroQuiz";
import { OverviewSection } from "./pages/OverviewSection";
import { ExportBasketPage, ExportComplexityPage } from "./pages/ExportPages";
import { PracticePage } from "./pages/PracticePage";
import { ConstraintScrolly } from "./pages/ConstraintScrolly";
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
          />

          <BranchAnalysisPage
            cityShort={cityShort}
            branchPath={branchPath}
            onSelectBranch={onSelectBranch}
            variant={treeVariant}
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
