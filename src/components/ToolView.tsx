import { useEffect, useRef } from "react";
import { PAGE_IDS, cityShortName } from "../data/content";
import { Toolbar } from "./Toolbar";
import { Rail } from "./Rail";
import { ExplainersView } from "./ExplainersView";
import { IntroQuiz } from "./pages/IntroQuiz";
import { OverviewSection } from "./pages/OverviewSection";
import { ExportBasketPage, ExportComplexityPage } from "./pages/ExportPages";
import { PracticePage } from "./pages/PracticePage";

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
}: ToolViewProps) {
  const pagesRef = useRef<HTMLElement>(null);
  const cityShort = cityShortName(city);

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
    PAGE_IDS.forEach((id) => {
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

          {/* City Constraints & Levers for Change (empty for now) */}
          <section className="page" id="page-constraints"></section>
          <section className="page" id="page-constraints-diagnose"></section>
          <section className="page" id="page-levers"></section>
        </main>
      </div>

      <ExplainersView open={explainersOpen} />
    </div>
  );
}
