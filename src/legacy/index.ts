/** Boots v-3's page once its markup — and the React slots inside it — are in
 *  the DOM. See src/legacy/README.md for what lives here and why. */

import "leaflet/dist/leaflet.css";
import "./xch_geo.js"; // sets window.XCH_GEO_RAW, which the maps read
import landingBg from "./assets/landing-page.webp";
import { loadTreemaps } from "./treemap.js";
import { initPage } from "./v3-page.js";
import type { CitiesBridge, LegacyApi } from "./bridge";

let api: LegacyApi | null = null;

/** Runs v-3's scripts in the order main ran them — the two inline scripts,
 *  then treemap.js's init (which main deferred to DOMContentLoaded).
 *  Idempotent: StrictMode mounts twice, and the page lives as long as the
 *  app. */
export function initLegacy(bridge: CitiesBridge): LegacyApi {
  if (api) return api;
  window.__cities = bridge;
  /* the landing image, bundled: v3.css reads it through this property */
  document.documentElement.style.setProperty("--map-asset", `url("${landingBg}")`);
  api = initPage();
  loadTreemaps()();
  return api;
}
