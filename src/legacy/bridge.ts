/** The seam between v-3's page (the shell) and the React pieces inside it.
 *
 *  v-3 owns navigation, the city, the journey and every dialog; React draws
 *  City Constraints and the Explainers content into slots in its markup.
 *  What React needs to hear travels through window.__cities; what React
 *  drives is the object v-3's page script returns from initPage(). */

/** what the React app provides (set by initLegacy) */
export interface CitiesBridge {
  /** the city picked in either of v-3's pickers */
  onCity(city: string): void;
  /** the page or rail step in view, from v-3's own scroll spy */
  onPage(id: string): void;
  /** the Explainers tab opened or closed */
  onExplainers(open: boolean): void;
}

export interface LegacySectionDef {
  name: string;
  pages: string[];
  entry: string;
}

/** what v-3's page script returns */
export interface LegacyApi {
  syncCity(city: string): void;
  /** navigate to a page or rail-step id (switches the section, then scrolls) */
  goTo(id: string): void;
  /** leave the landing for the tool, aimed at a page (null: nowhere in particular) */
  enterTool(id: string | null): void;
  backToLanding(): void;
  /** no argument toggles */
  toggleExplainers(open?: boolean): void;
  openJourney(): void;
  /** the constraints scrolly reports its own phase from its sticky track */
  markPage(id: string): void;
  /** the section list, as the tabs, pager and journey read it */
  sectionDefs: LegacySectionDef[];
}

declare global {
  interface Window {
    __cities?: CitiesBridge;
  }
}
