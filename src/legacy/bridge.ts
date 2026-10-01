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

  /* ---- the site-level layout variants (src/site/) ----
     Questions v-3's section switch asks; each is optional, and unanswered
     the switch behaves as it does on main (one section up, scrolled to the
     top, its quiz a card in the pager). */
  /** is section `k` hidden while section `i` is the current one? */
  sectionHidden?(k: number, i: number): boolean;
  /** the closes (quiz + insight) sit under their sections, so a rail or
   *  journey step for one scrolls to it instead of opening main's quiz dialog */
  closesInline?: boolean;
  /** scroll to section `i` after a switch; true = handled, false = go to the top */
  sectionScroll?(i: number): boolean;
  /** the switch landed on section `i` */
  onSection?(i: number): void;
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
  /** the section switch itself; `toTop: false` switches without scrolling */
  showSection(i: number, toTop?: boolean): void;
  /** a section's close (quiz + insight) as markup — "" for a section without
   *  one — and the wiring for it once it is in the DOM (found by its own id) */
  renderSecClose(name: string): string;
  wireSecClose(name: string): void;
}

declare global {
  interface Window {
    __cities?: CitiesBridge;
  }
}
