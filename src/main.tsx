import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReadCityPage } from "./readcity/ReadCityPage";
import { ConceptsPage } from "./concepts/ConceptsPage";
import CityStory from "./citytool/pages/CityStory";
import { YearRangeProvider } from "./citytool/lib/yearRange";
import { JourneyProvider, QuizScope } from "./learning/journey";
import { PrototypeSettingsProvider, PrototypeDrawer, useProto } from "./learning/settings";
import "./app-shell.css";
// The two themes are injected per view (see App) so the light GL styles and the
// dark story styles never both own :root/body at once.
import storyCssUrl from "./readcity/story.css?url";
import citytoolCssUrl from "./citytool/styles.css?url";

/** Minimal hash switch — no router at the top level. #/story → the pixel
 *  scrollytelling; else the ported Growth-Lab CityStory (the landing page). */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function CornerControls() {
  const { setOpen, activeCount } = useProto();
  return (
    <div className="gl-corner">
      <button className="gear-btn" onClick={() => setOpen(true)} aria-label="Open prototype settings">
        <span className="dot" style={{ opacity: activeCount ? 1 : 0.35 }} />
        {activeCount ? `Prototype · ${activeCount} on` : "Prototype settings"}
      </button>
      <a className="story-link" href="#/concepts">
        Concepts →
      </a>
      <a className="story-link" href="#/story">
        How to Read a City →
      </a>
    </div>
  );
}

function PlaceApp() {
  return (
    <div className="gl-app">
      <JourneyProvider>
        <PrototypeSettingsProvider>
          <YearRangeProvider>
            <QuizScope scope="citystory">
              <MemoryRouter initialEntries={["/usa/place/boston-ma"]}>
                <Routes>
                  <Route path="/:country/place/:placeSlug" element={<CityStory />} />
                  <Route path="*" element={<Navigate to="/usa/place/boston-ma" replace />} />
                </Routes>
              </MemoryRouter>
            </QuizScope>
          </YearRangeProvider>
          <CornerControls />
          <PrototypeDrawer />
        </PrototypeSettingsProvider>
      </JourneyProvider>
    </div>
  );
}

function App() {
  const hash = useHashRoute();
  const isStory = hash.startsWith("#/story");
  const isConcepts = hash.startsWith("#/concepts");

  useEffect(() => {
    let link = document.getElementById("app-theme") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "app-theme";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    // concepts shares the light GL theme with the profile view
    link.href = isStory ? storyCssUrl : citytoolCssUrl;
    document.title = isStory
      ? "How to Read a City"
      : isConcepts
        ? "City Concepts · Growth Lab"
        : "Boston · Cities — Growth Lab";
  }, [isStory, isConcepts]);

  if (isStory) {
    return (
      <>
        <a
          href="#/"
          style={{
            position: "fixed",
            top: 14,
            left: 14,
            zIndex: 100,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 13,
            color: "#e8e6df",
            background: "rgba(20,20,19,0.72)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            padding: "6px 13px",
            textDecoration: "none",
            backdropFilter: "blur(6px)",
          }}
        >
          ← Boston profile
        </a>
        <ReadCityPage />
      </>
    );
  }
  if (isConcepts) return <ConceptsPage hash={hash} />;
  return <PlaceApp />;
}

// No <StrictMode>: react-leaflet v4's map init isn't idempotent under React 19's
// dev double-mount ("Map container is already initialized"). StrictMode is a
// dev-only check; dropping it keeps the Leaflet backdrop stable.
createRoot(document.getElementById("root")!).render(<App />);
