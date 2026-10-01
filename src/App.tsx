import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_CITY, cityShortName } from "./data/content";
import {
  DEFAULT_TREE_MODE,
  modeThemes,
  modeVariant,
  suggestedPath,
} from "./data/figures";
import { explainerById } from "./explainers/registry";
import { LegacyShell } from "./legacy/LegacyShell";
import { initLegacy } from "./legacy";
import type { LegacyApi } from "./legacy/bridge";
import { ConstraintsSection } from "./components/ConstraintsSection";
import { ExplainersContent } from "./components/ExplainersContent";
import { SiteLayer } from "./site/SiteLayer";
import { beginSite, mountSite, siteHooks, spyPage, type SiteSlots } from "./site/runtime";
import { readSiteVariant } from "./site/variants";

/* the site-level layout variant under study (?site=, src/site/variants.ts):
   read once, and told to the stylesheet before v-3's page boots */
const SITE_VARIANT = readSiteVariant();
beginSite(SITE_VARIANT);

/* ---------- URL hash routing ----------
   v-3's page owns navigation (landing <-> tool, the section switch, the
   scroll spy). The hash mirrors what it shows ("#overview", "#tradableSection",
   …, "#explainers" for the gallery, or "#explainers/<id>" for one open
   explainer); no hash means the landing. Deep links open the tool directly
   at that section. Every view the reader can navigate to has to be in the
   hash — an open explainer held only in component state would be invisible
   to the Back button and unshareable. */

const EXPLAINERS_SLUG = "explainers";

const slugForPage = (id: string) => id.replace(/^page-/, "");
/** "overview" → page-overview; a rail step inside a section ("tradableSection",
 *  "check-overview") keeps its own id as its slug */
const pageForSlug = (slug: string, ids: ReadonlySet<string>) => {
  const prefixed = `page-${slug}`;
  if (ids.has(prefixed)) return prefixed;
  return ids.has(slug) ? slug : null;
};

/** "explainers" → the gallery; "explainers/diagnostic-pathway" → that
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

/** the elements inside v-3's markup that React draws into */
interface Slots {
  constraints: HTMLElement;
  explainers: HTMLElement;
}

export default function App() {
  /* v-3's body is in the DOM from the first render; the slots exist once
     that commit has happened, and the portals below render into them */
  const [slots, setSlots] = useState<Slots | null>(null);
  useLayoutEffect(() => {
    const constraints = document.getElementById("constraints-slot");
    const explainers = document.getElementById("explainersView");
    if (constraints && explainers) setSlots({ constraints, explainers });
  }, []);

  const legacy = useRef<LegacyApi | null>(null);
  const initialRoute = useRef(
    (() => {
      const slug = readHash();
      const ex = parseExplainers(slug);
      return { slug, explainers: ex.open, explainerId: ex.id };
    })(),
  ).current;

  /* what v-3 reports, mirrored for the hash */
  const [city, setCity] = useState(DEFAULT_CITY);
  const [landingHidden, setLandingHidden] = useState(false);
  const landingHiddenRef = useRef(false);
  landingHiddenRef.current = landingHidden;
  const [explainersOpen, setExplainersOpen] = useState(false);
  const [openExplainer, setOpenExplainer] = useState<string | null>(initialRoute.explainerId);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  /* the hash effects wait for v-3 to be booted */
  const [ready, setReady] = useState(false);
  /* the elements the site-level layout variants add to v-3's markup
     (src/site/runtime.ts) */
  const [siteSlots, setSiteSlots] = useState<SiteSlots | null>(null);

  /* The scroll spy rewrites the hash on every section that drifts past, so
     the hash effect REPLACES by default — pushing there would bury the real
     history under scroll noise. A deliberate navigation (opening or leaving
     the Explainers tab, opening an explainer, going back to the gallery)
     flags the next write as a push, so the Back button retraces those
     steps. */
  const historyMode = useRef<"push" | "replace">("replace");
  const pushNext = () => {
    historyMode.current = "push";
  };

  /* which structure the diagnostic pathway proposes. One mode rather than two
     coupled flags: themes only exist under the alt leaves, so the pair could
     never move freely anyway. No longer a choice (Sept 2026): the structure
     switch came off with the section's variant controls, so the mode is fixed
     at the default. It still lives here because the branch-analysis section
     has to follow the same shape. */
  const treeMode = DEFAULT_TREE_MODE;
  const treeVariant = modeVariant(treeMode);
  const showThemes = modeThemes(treeMode);
  /* the descent picked on the diagnostic pathway (ids below the root); defaults
     to the data-driven read and names/feeds the branch-analysis section */
  const [branchPath, setBranchPath] = useState<string[]>(() =>
    suggestedPath(cityShortName(DEFAULT_CITY), modeVariant(DEFAULT_TREE_MODE)),
  );
  /* switching cities re-derives the suggested read — a pick made for one
     city shouldn't leak into another's diagnostic */
  const treeVariantRef = useRef(treeVariant);
  treeVariantRef.current = treeVariant;
  useEffect(() => {
    setBranchPath(suggestedPath(cityShortName(city), treeVariantRef.current));
  }, [city]);

  /* boot v-3 once its markup and the React slots are in the DOM */
  useEffect(() => {
    if (!slots) return;
    const api = initLegacy({
      onCity: setCity,
      onPage: (id) => {
        setCurrentPageId(id);
        /* in a layout that keeps several sections in one scroll, the page
           in view is also what moves the tabs */
        spyPage(id);
      },
      onExplainers: (open) => {
        pushNext();
        setExplainersOpen(open);
        /* leaving the tab leaves whichever explainer was open inside it,
           which otherwise stays mounted and reappears the next time */
        if (!open) setOpenExplainer(null);
      },
      ...siteHooks(),
    });
    legacy.current = api;
    setSiteSlots(mountSite(api));
    /* the landing's state is a class v-3 toggles; watch it rather than ask */
    const landing = document.getElementById("landing");
    const watch = landing
      ? new MutationObserver(() => setLandingHidden(landing.classList.contains("hidden")))
      : null;
    if (landing) watch!.observe(landing, { attributes: true, attributeFilter: ["class"] });
    /* a valid hash on load deep-links straight into the tool, skipping the
       landing's slide */
    const ids = new Set(api.sectionDefs.flatMap((s) => s.pages));
    const page = pageForSlug(initialRoute.slug, ids);
    if (page || initialRoute.explainers) {
      document.documentElement.dataset.v3Instant = "1";
      api.enterTool(page);
      if (initialRoute.explainers) api.toggleExplainers(true);
      setLandingHidden(true);
      window.setTimeout(() => {
        delete document.documentElement.dataset.v3Instant;
      }, 1000);
    }
    setReady(true);
    return () => watch?.disconnect();
  }, [slots, initialRoute]);

  /* keep the URL in step with the page. Writing history entries directly
     (rather than assigning location.hash) avoids re-triggering our own
     hashchange listener; replace vs push is set by historyMode, so scroll
     drift stays out of history while deliberate moves stay in it. */
  useEffect(() => {
    if (!ready) return;
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
  }, [ready, landingHidden, explainersOpen, openExplainer, currentPageId]);

  /* hand-edited URLs and browser back/forward navigate the page */
  useEffect(() => {
    if (!ready) return;
    const onHashChange = () => {
      const api = legacy.current;
      if (!api) return;
      const slug = readHash();
      if (!slug) {
        api.backToLanding();
        return;
      }
      const ex = parseExplainers(slug);
      if (ex.open) {
        setOpenExplainer(ex.id);
        // a Forward/pasted jump straight into Explainers from the landing
        // still has to get the tool on screen first
        if (!landingHiddenRef.current) api.enterTool(null);
        api.toggleExplainers(true);
        return;
      }
      const ids = new Set(api.sectionDefs.flatMap((s) => s.pages));
      const id = pageForSlug(slug, ids);
      if (!id) return;
      if (landingHiddenRef.current) api.goTo(id);
      else api.enterTool(id);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [ready]);

  const markPage = useCallback((id: string) => legacy.current?.markPage(id), []);

  return (
    <>
      <LegacyShell />

      {slots &&
        createPortal(
          <ConstraintsSection
            city={city}
            treeVariant={treeVariant}
            showThemes={showThemes}
            branchPath={branchPath}
            onSelectBranch={setBranchPath}
            onPhaseInView={markPage}
          />,
          slots.constraints,
        )}

      {slots &&
        createPortal(
          <ExplainersContent
            container={slots.explainers}
            openId={openExplainer}
            onOpen={(id) => {
              pushNext();
              setOpenExplainer(id);
            }}
            onClose={() => legacy.current?.toggleExplainers(false)}
            onHome={() => {
              legacy.current?.toggleExplainers(false);
              legacy.current?.backToLanding();
            }}
            onJourney={() => legacy.current?.openJourney()}
          />,
          slots.explainers,
        )}

      {ready && siteSlots && legacy.current && (
        <SiteLayer
          api={legacy.current}
          variant={SITE_VARIANT}
          slots={siteSlots}
          inTool={landingHidden}
        />
      )}
    </>
  );
}
