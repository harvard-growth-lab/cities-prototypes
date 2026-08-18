import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  DEFAULT_CITY,
  PAGE_IDS,
  SAMPLE_EXPLORED_CITIES,
  SAMPLE_INSIGHTS,
  SAMPLE_VISITED_PAGES,
  SPANS,
  cityShortName,
} from "./data/content";
import type { Insight } from "./data/content";
import {
  DEFAULT_TREE_MODE,
  convertPath,
  modeThemes,
  modeVariant,
  suggestedPath,
  type TreeMode,
} from "./data/figures";
import { explainerById } from "./explainers/registry";
import { Landing } from "./components/Landing";
import { ToolView } from "./components/ToolView";
import { JourneyModal } from "./components/modals/JourneyModal";
import { DataChatModal } from "./components/modals/DataChatModal";

function scrollToPage(id: string, behavior: ScrollBehavior) {
  document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}

/* ---------- URL hash routing ----------
   The hash mirrors the section in view ("#overview", "#export-basket", …,
   "#explainers" for the gallery, or "#explainers/<id>" for one open
   explainer); no hash means the landing. Deep links open the tool directly
   at that section. Every view the reader can navigate to has to be in the
   hash — an open explainer held only in component state would be invisible
   to the Back button and unshareable. */

const EXPLAINERS_SLUG = "explainers";

const slugForPage = (id: string) => id.replace(/^page-/, "");
const pageForSlug = (slug: string) => {
  const id = `page-${slug}`;
  return PAGE_IDS.includes(id) ? id : null;
};

/** "explainers" → the gallery; "explainers/diagnostic-tree" → that
 *  explainer. An unknown id falls back to the gallery (and the hash effect
 *  then rewrites the bad slug away). */
const parseExplainers = (slug: string): { open: boolean; id: string | null } => {
  if (slug !== EXPLAINERS_SLUG && !slug.startsWith(`${EXPLAINERS_SLUG}/`)) {
    return { open: false, id: null };
  }
  const id = slug.slice(EXPLAINERS_SLUG.length + 1);
  return { open: true, id: explainerById(id)?.id ?? null };
};

const explainersSlug = (id: string | null) =>
  id ? `${EXPLAINERS_SLUG}/${id}` : EXPLAINERS_SLUG;

const readHash = () => decodeURIComponent(window.location.hash.slice(1));

export default function App() {
  const [city, setCity] = useState(DEFAULT_CITY);
  const [span, setSpan] = useState(SPANS[0]);

  /* a valid hash on load deep-links straight into the tool, skipping the
     landing slide */
  const initialRoute = useRef(
    (() => {
      const slug = readHash();
      const ex = parseExplainers(slug);
      return {
        page: pageForSlug(slug),
        explainers: ex.open,
        explainerId: ex.id,
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
  const [openExplainer, setOpenExplainer] = useState<string | null>(initialRoute.explainerId);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  /* The scroll spy rewrites the hash on every section that drifts past, so
     the hash effect REPLACES by default — pushing there would bury the real
     history under scroll noise. A deliberate navigation (opening the
     Explainers tab, opening an explainer, going back to the gallery) flags
     the next write as a push, so the Back button retraces those steps. */
  const historyMode = useRef<"push" | "replace">("replace");
  const pushNext = () => {
    historyMode.current = "push";
  };

  /* journey state (pre-seeded with the prototype's sample progress) */
  const [currentPageId, setCurrentPageId] = useState<string | null>(initialRoute.page);
  const [visitedPages, setVisitedPages] = useState<ReadonlySet<string>>(
    () => new Set(SAMPLE_VISITED_PAGES),
  );
  const [exploredCities, setExploredCities] = useState<ReadonlySet<string>>(
    () => new Set(SAMPLE_EXPLORED_CITIES),
  );
  const [insights] = useState<Insight[]>(SAMPLE_INSIGHTS);

  /* which structure the diagnostic tree proposes. One mode rather than two
     coupled flags: themes only exist under the alt leaves, so the pair could
     never move freely anyway. Lives here because the branch-analysis section
     has to follow the same shape. */
  const [treeMode, setTreeMode] = useState<TreeMode>(DEFAULT_TREE_MODE);
  const treeVariant = modeVariant(treeMode);
  const showThemes = modeThemes(treeMode);
  /* the descent picked on the diagnostic tree (ids below the root); defaults
     to the data-driven read and names/feeds the branch-analysis section */
  const [branchPath, setBranchPath] = useState<string[]>(() =>
    suggestedPath(cityShortName(DEFAULT_CITY), modeVariant(DEFAULT_TREE_MODE)),
  );
  /* switching modes carries the pick across to the nearest route in the
     target structure, so hover/selection state never dangles */
  const changeTreeMode = useCallback((m: TreeMode) => {
    setTreeMode(m);
    setBranchPath((p) => convertPath(p, modeVariant(m)));
  }, []);
  /* switching cities re-derives the suggested read — a pick made for one
     city shouldn't leak into another's diagnostic */
  const treeVariantRef = useRef(treeVariant);
  treeVariantRef.current = treeVariant;
  useEffect(() => {
    setBranchPath(suggestedPath(cityShortName(city), treeVariantRef.current));
  }, [city]);

  const addExploredCity = (c: string) => {
    setExploredCities((prev) => (prev.has(c) ? prev : new Set(prev).add(c)));
  };

  /** leave the Explainers section entirely — the tab AND whichever explainer
      was open inside it, which otherwise stays mounted and reappears the next
      time the section is shown */
  const closeExplainers = useCallback(() => {
    setExplainersOpen(false);
    setOpenExplainer(null);
  }, []);

  const goTo = useCallback(
    (id: string) => {
      // the target is display:none while the explainers page is open, so the
      // close must be committed before scrolling to it
      if (explainersOpen) flushSync(closeExplainers);
      scrollToPage(id, "smooth");
    },
    [explainersOpen, closeExplainers],
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
    /* a null target enters the tool without aiming at a page — the route
       asked for the Explainers section, which sits outside the page column */
    (targetId: string | null) => {
      if (landingHidden) {
        if (targetId) goTo(targetId);
        return;
      }
      if (landingAnim.current) return;
      landingAnim.current = "enter";
      /* a page target means the reader asked for the tool body, which is
         display:none while Explainers is up. Batched with the rest, so it is
         committed before the layout effect scrolls; without it the scroll
         lands on a hidden element and the reader arrives back inside the
         explainer they thought they had left. */
      if (targetId) closeExplainers();
      setToolActive(true);
      addExploredCity(city);
      pendingScroll.current = targetId;
      setLandingUp(true);
      window.setTimeout(finishLandingAnim, 950); // safety net if transitionend is missed
    },
    [landingHidden, city, goTo, finishLandingAnim, closeExplainers],
  );

  /* jump instantly to the target page as soon as the tool is displayed, so it
     is already in place while the landing slides away above it. Keyed on the
     slide starting as well as on toolActive: after the first entry the tool
     stays mounted and active, so every later trip in from the landing would
     otherwise leave the pending target unconsumed and drop the reader
     wherever the page column happened to be parked. */
  useLayoutEffect(() => {
    if (toolActive && pendingScroll.current) {
      const id = pendingScroll.current;
      pendingScroll.current = null;
      scrollToPage(id, "instant");
    }
  }, [toolActive, landingUp]);

  const backToLanding = useCallback(() => {
    if (landingAnim.current || !landingHidden) return;
    landingAnim.current = "return";
    /* going home leaves the Explainers section too — otherwise the tool
       still holds an open explainer behind the landing, and the reader's
       next trip into the tool arrives there instead of at their target */
    closeExplainers();
    setLandingHidden(false); // reappear...
    setLandingUp(true); // ...above the viewport...
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setLandingUp(false)), // ...then slide down
    );
    window.setTimeout(finishLandingAnim, 950);
  }, [landingHidden, finishLandingAnim, closeExplainers]);

  /* keep the URL in step with the app. Writing history entries directly
     (rather than assigning location.hash) avoids re-triggering our own
     hashchange listener; replace vs push is set by historyMode, so scroll
     drift stays out of history while deliberate moves stay in it. */
  useEffect(() => {
    const slug = !landingHidden
      ? ""
      : explainersOpen
        ? explainersSlug(openExplainer)
        : currentPageId
          ? slugForPage(currentPageId)
          : "";
    const push = historyMode.current === "push";
    historyMode.current = "replace";
    if (slug === readHash()) return;
    const { pathname, search } = window.location;
    const url = slug ? `#${slug}` : pathname + search;
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
  }, [landingHidden, explainersOpen, openExplainer, currentPageId]);

  /* hand-edited URLs and browser back/forward navigate the app */
  useEffect(() => {
    const onHashChange = () => {
      const slug = readHash();
      if (!slug) {
        backToLanding();
        return;
      }
      const ex = parseExplainers(slug);
      if (ex.open) {
        setExplainersOpen(true);
        setOpenExplainer(ex.id);
        // a Forward/pasted jump straight into Explainers from the landing
        // still has to get the tool on screen first
        if (!landingHidden) enterTool(null);
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
        /* the tab button enters and leaves the section as a whole, so it
           always lands on the gallery rather than resuming mid-explainer */
        onToggleExplainers={() => {
          pushNext();
          setExplainersOpen((v) => !v);
          setOpenExplainer(null);
        }}
        openExplainer={openExplainer}
        onOpenExplainer={(id) => {
          pushNext();
          setOpenExplainer(id);
        }}
        onOpenChat={() => setChatOpen(true)}
        onOpenJourney={() => setJourneyOpen(true)}
        onBackToLanding={backToLanding}
        onGoTo={goTo}
        currentPageId={currentPageId}
        onPageInView={onPageInView}
        branchPath={branchPath}
        onSelectBranch={setBranchPath}
        treeMode={treeMode}
        onTreeModeChange={changeTreeMode}
        treeVariant={treeVariant}
        showThemes={showThemes}
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
