/**
 * THE SCHEMA — the contract between today's placeholder data and
 * tomorrow's real pulls (Census PEP, ACS, BLS QCEW/LAUS, Zillow ZHVI,
 * BPS, BDS, Metroverse). Every variant reads only these shapes, and the
 * shapes store numbers — display formatting lives in `derive.ts`.
 *
 * All values in `boston.ts` are placeholder / illustrative.
 */

/* ————— small vocabulary ————— */

export type SectorKey =
  | "health"
  | "scitech"
  | "education"
  | "hospitality"
  | "proffin"
  | "retail"
  | "construction";

/** Constraint side implied by the Figure-31 wedge. */
export type Side = "demand" | "supply" | "none";

/** [year, value] points; annual unless noted. */
export type Series = [year: number, value: number][];

export interface Indicator {
  key:
    | "population"
    | "salary"
    | "wage"
    | "homeValue"
    | "unemployment"
    | "employment"
    | "incomePerCapita"
    | "costOfLiving";
  label: string;
  source: string; // e.g. "Census PEP" — provenance string, shown small
  level: number;
  levelYear: number;
  unit: "count" | "usd" | "pct";
  /** average annual change over `CityProfile.window` — pct/yr, or pp/yr for pct units */
  changePct: number;
  /** interpretation of the change for a policymaker reading quickly */
  tone: "good" | "bad" | "neutral";
  /** rank of the LEVEL among `rankOf` places (1 = highest), null if n/a */
  rank: number | null;
  rankOf: number | null;
  rankUniverse: string; // "US metros", "places in the MSA", …
}

export interface Industry {
  name: string;
  shortName: string;
  employment: number;
  sector: SectorKey;
  /** does it mostly sell to non-residents? (the "oxygen") — illustrative */
  tradable: boolean;
  /** 0–1 stand-in for PCI complexity shading — illustrative */
  complexity: number;
}

/* ————— journey stage 6 evidence blocks ————— */

export interface DemandEvidence {
  /** tradable employment index over time (start year = 100) */
  exportEmployment: Series;
  /** shift-share decomposition of MSA job growth, pp over the window */
  shiftShare: { nationalPp: number; industryMixPp: number; localPp: number };
  firmCreation: { ratePct: number; nationalPct: number; rank: number; rankOf: number };
  marketAccess: { index: number; rank: number; rankOf: number };
  eci: number;
  coi: number;
  newExports: { actual: number; predictedForEci: number };
  marketShare: { levelPct: number; deltaPp: number };
  rajanZingales: { exposure: number; verdict: "high" | "low" };
  inputPrices: { input: string; rank: number; rankOf: number }[];
  patentClusters: { name: string; count: number; adjacent: boolean }[];
}

export interface SupplyEvidence {
  /** home values indexed to 100 at window start */
  homeValueIndex: { city: Series; msa: Series; nation: Series };
  /** annualized home-value growth by area within the metro, for the mini-map */
  priceGrowthByArea: { name: string; cagrPct: number }[];
  /** housing units permitted per 1k residents per year */
  permits: { msaPer1k: number; nationPer1k: number; series: Series };
  /** share of MSA jobs reachable by transit+car blend — illustrative */
  isochrones: { minutes: 20 | 30 | 40; shareOfMsaJobs: number }[];
  /** pp drift of the amenity residual (housing premium unexplained by wages) */
  amenityResidualPp: number;
  housingTest: {
    question: string;
    cityGrowthPct: number;
    medianGrowthPct: number;
    verdict: string;
    tone: "good" | "bad";
    body: string;
  };
}

/* ————— the profile ————— */

export interface CityProfile {
  slug: string;
  name: string;
  state: string;
  stateAbbr: string;
  msaName: string;
  msaShort: string;
  /** analysis window, inclusive years */
  window: [number, number];

  /* stage 1 — overview */
  overview: {
    areaSqMi: number;
    msaAreaSqMi: number;
    msaCounties: string[];
    placesInMsa: number;
    /** one-line "you are here" orientation */
    blurb: string;
  };

  /* stage 2 — the admin city */
  city: {
    indicators: Indicator[];
    popSeries: Series;
  };

  /* stage 3 — the MSA around it */
  msa: {
    indicators: Indicator[];
    popSeries: Series;
    cityShareOfMsaPop: number; // 0–1
    cityPopRankInMsa: number;
    /** pop CAGR over the window, %/yr — the stage-3 signal */
    compare: { cityPopCagr: number; msaPopCagr: number; nationPopCagr: number };
  };

  /* stage 4 — exports (MSA level only) */
  exports: {
    industries: Industry[];
    tradableSharePct: number;
    tradableShareNationalPct: number;
    eci: number;
    eciYear: number;
    workersTotal: number;
    industryCount: number;
    sectorCount: number;
    industryYear: number;
  };

  /* stage 5 — the pizza chart. CAGRs in %/yr; wedge derived vs the medians. */
  diagnosis: {
    msa: { popCagr: number; wageCagr: number };
    city: { popCagr: number; wageCagr: number };
    medians: { popCagr: number; wageCagr: number }; // US-metro benchmark
    windowLabel: string;
    /** profile-specific clause appended to the wedge reading */
    wedgeNote: string;
  };

  /* stage 6 — evidence for each branch */
  demand: DemandEvidence;
  supply: SupplyEvidence;
  /** Figure-27 path the evidence points to (node ids), + cleared suspects */
  treePath: string[];
  treeRuledOut: string[];

  /* stage 7 — synthesis */
  table2: {
    /** MSA pop growth minus national, pp/yr */
    vsNationPp: number;
    /** MSA pop growth minus peer-group mean, pp/yr */
    vsPeersPp: number;
    peers: { name: string; popCagr: number }[];
    peerCriteria: string;
  };
  growthQuestion: string;
  levers: {
    name: string;
    body: string;
    emphasis: "primary" | "secondary" | "maintain";
    tag: string;
  }[];

  /* voice — short prose slots used across variants */
  narrative: {
    intro: string;
    cityNote: string;
    msaNote: string;
    exportNote: string;
    constraintNote: string;
    branchNote: string;
    leversNote: string;
  };
}
