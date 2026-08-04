import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  CITIES,
  PAGE_IDS,
  SAMPLE_EXPLORED_CITIES,
  SAMPLE_INSIGHTS,
  SAMPLE_VISITED_PAGES,
  SPANS,
} from "./data/content";
import type { Insight } from "./data/content";
import { PLACE_QUAD } from "./data/figures";
import { Landing } from "./components/Landing";
import { ToolView } from "./components/ToolView";
import { JourneyModal } from "./components/modals/JourneyModal";
import { DataChatModal } from "./components/modals/DataChatModal";

function scrollToPage(id: string, behavior: ScrollBehavior) {
  document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}

/* ---------- URL hash routing ----------
   The hash mirrors the section in view ("#overview", "#export-basket", …,
   or "#explainers"); no hash means the landing. Deep links open the tool
   directly at that section. */

const EXPLAINERS_SLUG = "explainers";

const slugForPage = (id: string) => id.replace(/^page-/, "");
const pageForSlug = (slug: string) => {
  const id = `page-${slug}`;
  return PAGE_IDS.includes(id) ? id : null;
};

const readHash = () => decodeURIComponent(window.location.hash.slice(1));

export default function App() {
  const [city, setCity] = useState(CITIES[0]);
  const [span, setSpan] = useState(SPANS[0]);

  /* a valid hash on load deep-links straight into the tool, skipping the
     landing slide */
  const initialRoute = useRef(
    (() => {
      const slug = readHash();
      return {
        page: pageForSlug(slug),
        explainers: slug === EXPLAINERS_SLUG,
      };
    })(),
  ).current;
  const deepLinked = initialRoute.page !== null || initialRoute.explainers;

  /* landing <-> tool transition. The tool stays mounted (and, once entered,
     active) underneath; the landing is a fixed overlay that slides up out of
     the way and back down. */
  const [toolActive, setToolActive] = useState(deepLinked);
  const [landingHidden, setLandingHidden] = useState(deepLinked);
  const [landingUp, setLandingUp] = useState(false);
  const landingAnim = useRef<"enter" | "return" | null>(null);
  const pendingScroll = useRef<string | null>(initialRoute.page);

  const [explainersOpen, setExplainersOpen] = useState(initialRoute.explainers);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  /* journey state (pre-seeded with the prototype's sample progress) */
  const [currentPageId, setCurrentPageId] = useState<string | null>(initialRoute.page);
  const [visitedPages, setVisitedPages] = useState<ReadonlySet<string>>(
    () => new Set(SAMPLE_VISITED_PAGES),
  );
  const [exploredCities, setExploredCities] = useState<ReadonlySet<string>>(
    () => new Set(SAMPLE_EXPLORED_CITIES),
  );
  const [insights, setInsights] = useState<Insight[]>(SAMPLE_INSIGHTS);

  /* the descent picked on the diagnostic tree (ids below the root); defaults
     to the data-driven read and names/feeds the branch-analysis section */
  const [branchPath, setBranchPath] = useState<string[]>(PLACE_QUAD.path);

  const addExploredCity = (c: string) => {
    setExploredCities((prev) => (prev.has(c) ? prev : new Set(prev).add(c)));
  };

  const goTo = useCallback(
    (id: string) => {
      // the target is display:none while the explainers page is open, so the
      // close must be committed before scrolling to it
      if (explainersOpen) flushSync(() => setExplainersOpen(false));
      scrollToPage(id, "smooth");
    },
    [explainersOpen],
  );

  const finishLandingAnim = useCallback(() => {
    if (!landingAnim.current) return;
    const direction = landingAnim.current;
    landingAnim.current = null;
    if (direction === "enter") {
      setLandingHidden(true);
      setLandingUp(false);
    }
  }, []);

  const enterTool = useCallback(
    (targetId: string) => {
      if (landingHidden) {
        goTo(targetId);
        return;
      }
      if (landingAnim.current) return;
      landingAnim.current = "enter";
      setToolActive(true);
      addExploredCity(city);
      pendingScroll.current = targetId;
      setLandingUp(true);
      window.setTimeout(finishLandingAnim, 950); // safety net if transitionend is missed
    },
    [landingHidden, city, goTo, finishLandingAnim],
  );

  /* jump instantly to the target page as soon as the tool is displayed, so it
     is already in place while the landing slides away above it */
  useLayoutEffect(() => {
    if (toolActive && pendingScroll.current) {
      const id = pendingScroll.current;
      pendingScroll.current = null;
      scrollToPage(id, "instant");
    }
  }, [toolActive]);

  const backToLanding = useCallback(() => {
    if (landingAnim.current || !landingHidden) return;
    landingAnim.current = "return";
    setLandingHidden(false); // reappear...
    setLandingUp(true); // ...above the viewport...
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setLandingUp(false)), // ...then slide down
    );
    window.setTimeout(finishLandingAnim, 950);
  }, [landingHidden, finishLandingAnim]);

  /* keep the URL in step with the app. replaceState (rather than assigning
     location.hash) avoids both flooding history from the scroll spy and
     re-triggering our own hashchange listener. */
  useEffect(() => {
    const slug = !landingHidden
      ? ""
      : explainersOpen
        ? EXPLAINERS_SLUG
        : currentPageId
          ? slugForPage(currentPageId)
          : "";
    if (slug === readHash()) return;
    const { pathname, search } = window.location;
    history.replaceState(null, "", slug ? `#${slug}` : pathname + search);
  }, [landingHidden, explainersOpen, currentPageId]);

  /* hand-edited URLs and browser back/forward navigate the app */
  useEffect(() => {
    const onHashChange = () => {
      const slug = readHash();
      if (!slug) {
        backToLanding();
        return;
      }
      if (slug === EXPLAINERS_SLUG) {
        setExplainersOpen(true);
        return;
      }
      const id = pageForSlug(slug);
      if (!id) return;
      if (landingHidden) goTo(id);
      else enterTool(id);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [landingHidden, goTo, enterTool, backToLanding]);

  const changeCity = (c: string) => {
    setCity(c);
    if (toolActive) addExploredCity(c);
  };

  const onPageInView = useCallback((id: string) => {
    setCurrentPageId(id);
    setVisitedPages((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const savePractice = (text: string) => {
    setInsights((prev) => [
      ...prev,
      { section: "City Exports · Put in Practice", city, span, text },
    ]);
  };

  const journeyNavigate = (entry: string) => {
    setJourneyOpen(false);
    if (landingHidden) goTo(entry);
    else enterTool(entry);
  };

  return (
    <>
      <Landing
        hidden={landingHidden}
        up={landingUp}
        city={city}
        span={span}
        onCityChange={changeCity}
        onSpanChange={setSpan}
        onEnterTool={enterTool}
        onOpenJourney={() => setJourneyOpen(true)}
        onSlideTransitionEnd={finishLandingAnim}
      />

      <ToolView
        active={toolActive}
        landingHidden={landingHidden}
        city={city}
        span={span}
        onCityChange={changeCity}
        onSpanChange={setSpan}
        explainersOpen={explainersOpen}
        onToggleExplainers={() => setExplainersOpen((v) => !v)}
        onOpenChat={() => setChatOpen(true)}
        onOpenJourney={() => setJourneyOpen(true)}
        onBackToLanding={backToLanding}
        onGoTo={goTo}
        currentPageId={currentPageId}
        onPageInView={onPageInView}
        onSavePractice={savePractice}
        branchPath={branchPath}
        onSelectBranch={setBranchPath}
      />

      <JourneyModal
        open={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        onNavigate={journeyNavigate}
        visitedPages={visitedPages}
        currentPageId={currentPageId}
        exploredCities={exploredCities}
        insights={insights}
      />

      <DataChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
