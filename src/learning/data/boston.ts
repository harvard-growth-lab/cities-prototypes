/**
 * BOSTON, MA — the one city instance.
 *
 * ALL VALUES ARE PLACEHOLDER / ILLUSTRATIVE, transcribed from
 * cities.taimur.sh/usa/place/boston-ma so the story is internally coherent:
 * city proper shedding people while the metro inches up, wages hot, housing
 * expensive-but-lagging, amenity pull fading. Consumed by the form-study
 * variants AND the city profile page. Real data development replaces this
 * file; the schema (types.ts) is the contract.
 */

import type { CityProfile } from "./types";

export const boston: CityProfile = {
  slug: "boston-ma",
  name: "Boston",
  state: "Massachusetts",
  stateAbbr: "MA",
  msaName: "Boston–Cambridge–Newton, MA–NH",
  msaShort: "Boston MSA",
  window: [2017, 2023],

  /* ————— stage 1 ————— */
  overview: {
    areaSqMi: 48.3,
    msaAreaSqMi: 3487,
    msaCounties: [
      "Suffolk",
      "Middlesex",
      "Norfolk",
      "Essex",
      "Plymouth",
      "Rockingham (NH)",
      "Strafford (NH)",
    ],
    placesInMsa: 197,
    blurb:
      "The city you govern is 48 square miles. The labor market you live in is 3,500 — 197 cities and towns across seven counties and two states, where your residents work, your workers sleep, and your housing market clears.",
  },

  /* ————— stage 2 ————— */
  city: {
    indicators: [
      {
        key: "population",
        label: "Population",
        source: "Census PEP",
        level: 655_000,
        levelYear: 2023,
        unit: "count",
        changePct: -0.8,
        tone: "bad",
        rank: 1,
        rankOf: 197,
        rankUniverse: "places in the MSA",
      },
      {
        key: "salary",
        label: "Average salary",
        source: "IRS, by residence",
        level: 100_000,
        levelYear: 2023,
        unit: "usd",
        changePct: 5.8,
        tone: "good",
        rank: 62,
        rankOf: 130,
        rankUniverse: "large US cities",
      },
      {
        key: "employment",
        label: "Jobs located in the city",
        source: "BLS QCEW",
        level: 590_000,
        levelYear: 2023,
        unit: "count",
        changePct: 0.7,
        tone: "neutral",
        rank: 6,
        rankOf: 130,
        rankUniverse: "large US cities",
      },
      {
        key: "homeValue",
        label: "Typical home value",
        source: "Zillow ZHVI",
        level: 971_000,
        levelYear: 2023,
        unit: "usd",
        changePct: 3.6,
        tone: "neutral",
        rank: 14,
        rankOf: 130,
        rankUniverse: "large US cities",
      },
      {
        key: "unemployment",
        label: "Unemployment",
        source: "BLS LAUS",
        level: 3.5,
        levelYear: 2023,
        unit: "pct",
        changePct: 0.1,
        tone: "bad",
        rank: 118,
        rankOf: 197,
        rankUniverse: "places in the MSA",
      },
    ],
    popSeries: [
      [2010, 618_000],
      [2011, 630_000],
      [2012, 641_000],
      [2013, 651_000],
      [2014, 660_000],
      [2015, 669_000],
      [2016, 679_000],
      [2017, 688_000],
      [2018, 693_000],
      [2019, 695_000],
      [2020, 691_000],
      [2021, 672_000],
      [2022, 660_000],
      [2023, 655_000],
    ],
  },

  /* ————— stage 3 ————— */
  msa: {
    indicators: [
      {
        key: "population",
        label: "MSA population",
        source: "Census PEP",
        level: 4_900_000,
        levelYear: 2023,
        unit: "count",
        changePct: 0.4,
        tone: "good",
        rank: 11,
        rankOf: 384,
        rankUniverse: "US metros",
      },
      {
        key: "wage",
        label: "Average wage",
        source: "ACS",
        level: 83_000,
        levelYear: 2023,
        unit: "usd",
        changePct: 4.5,
        tone: "good",
        rank: 6,
        rankOf: 262,
        rankUniverse: "US metros",
      },
      {
        key: "incomePerCapita",
        label: "Income per capita",
        source: "BEA",
        level: 91_000,
        levelYear: 2023,
        unit: "usd",
        changePct: 3.9,
        tone: "good",
        rank: 4,
        rankOf: 384,
        rankUniverse: "US metros",
      },
      {
        key: "homeValue",
        label: "Typical home value",
        source: "Zillow ZHVI",
        level: 648_000,
        levelYear: 2023,
        unit: "usd",
        changePct: 7.1,
        tone: "neutral",
        rank: 19,
        rankOf: 379,
        rankUniverse: "US metros",
      },
      {
        key: "costOfLiving",
        label: "Cost of living (RPP, US = 100)",
        source: "BEA",
        level: 111.8,
        levelYear: 2023,
        unit: "count",
        changePct: 0.3,
        tone: "bad",
        rank: 9,
        rankOf: 384,
        rankUniverse: "US metros",
      },
      {
        key: "unemployment",
        label: "Unemployment",
        source: "BLS LAUS",
        level: 3.3,
        levelYear: 2023,
        unit: "pct",
        changePct: -0.1,
        tone: "good",
        rank: 144,
        rankOf: 371,
        rankUniverse: "US metros",
      },
    ],
    popSeries: [
      [2010, 4_560_000],
      [2011, 4_600_000],
      [2012, 4_640_000],
      [2013, 4_680_000],
      [2014, 4_710_000],
      [2015, 4_740_000],
      [2016, 4_770_000],
      [2017, 4_790_000],
      [2018, 4_820_000],
      [2019, 4_860_000],
      [2020, 4_880_000],
      [2021, 4_850_000],
      [2022, 4_880_000],
      [2023, 4_900_000],
    ],
    cityShareOfMsaPop: 0.134,
    cityPopRankInMsa: 1,
    compare: { cityPopCagr: -0.8, msaPopCagr: 0.4, nationPopCagr: 0.5 },
  },

  /* ————— stage 4 ————— */
  exports: {
    tradableSharePct: 48,
    tradableShareNationalPct: 36,
    eci: 2.23,
    eciYear: 2023,
    workersTotal: 2_318_573,
    industryCount: 293,
    sectorCount: 20,
    industryYear: 2024,
    industries: [
      { name: "Restaurants and Other Eating Places", shortName: "Restaurants", employment: 175_444, sector: "hospitality", tradable: false, complexity: 0.12 },
      { name: "General Medical and Surgical Hospitals", shortName: "Hospitals", employment: 125_559, sector: "health", tradable: true, complexity: 0.62 },
      { name: "Scientific Research and Development Services", shortName: "Scientific R&D", employment: 96_682, sector: "scitech", tradable: true, complexity: 0.93 },
      { name: "Colleges, Universities, and Professional Schools", shortName: "Universities", employment: 85_523, sector: "education", tradable: true, complexity: 0.76 },
      { name: "Management of Companies and Enterprises", shortName: "Company HQs", employment: 64_860, sector: "proffin", tradable: true, complexity: 0.81 },
      { name: "Computer Systems Design and Related Services", shortName: "Computer systems design", employment: 63_891, sector: "scitech", tradable: true, complexity: 0.88 },
      { name: "Grocery and Convenience Stores", shortName: "Grocery stores", employment: 60_428, sector: "retail", tradable: false, complexity: 0.1 },
      { name: "Individual and Family Services", shortName: "Family services", employment: 60_218, sector: "health", tradable: false, complexity: 0.11 },
      { name: "Offices of Physicians", shortName: "Physicians' offices", employment: 46_096, sector: "health", tradable: false, complexity: 0.5 },
      { name: "Building Equipment Contractors", shortName: "Building contractors", employment: 45_734, sector: "construction", tradable: false, complexity: 0.34 },
      { name: "Software Publishers", shortName: "Software publishers", employment: 37_826, sector: "scitech", tradable: true, complexity: 0.95 },
      { name: "Home Health Care Services", shortName: "Home health care", employment: 30_976, sector: "health", tradable: false, complexity: 0.09 },
      { name: "Insurance Carriers", shortName: "Insurance carriers", employment: 30_801, sector: "proffin", tradable: true, complexity: 0.68 },
      { name: "Child Care Services", shortName: "Child care", employment: 25_132, sector: "health", tradable: false, complexity: 0.07 },
      { name: "Legal Services", shortName: "Legal services", employment: 24_743, sector: "proffin", tradable: false, complexity: 0.55 },
      { name: "Nursing Care Facilities", shortName: "Nursing care", employment: 24_036, sector: "health", tradable: false, complexity: 0.1 },
      { name: "Department Stores", shortName: "Department stores", employment: 21_646, sector: "retail", tradable: false, complexity: 0.12 },
      { name: "Accounting, Tax Preparation, and Payroll Services", shortName: "Accounting", employment: 21_260, sector: "proffin", tradable: false, complexity: 0.52 },
      { name: "Offices of Other Health Practitioners", shortName: "Other health offices", employment: 19_242, sector: "health", tradable: false, complexity: 0.42 },
    ],
  },

  /* ————— stage 5 ————— */
  diagnosis: {
    msa: { popCagr: 0.4, wageCagr: 4.5 },
    city: { popCagr: -0.8, wageCagr: 5.8 },
    medians: { popCagr: 0.5, wageCagr: 3.8 },
    windowLabel: "2017–2023",
    wedgeNote:
      "pay moved further than people, so the wall is on the supply side while demand keeps bidding.",
  },

  /* ————— stage 6 · demand branch (the acquitted side) ————— */
  demand: {
    exportEmployment: [
      [2017, 100],
      [2018, 103],
      [2019, 106],
      [2020, 101],
      [2021, 106],
      [2022, 110],
      [2023, 112],
    ],
    shiftShare: { nationalPp: 4.2, industryMixPp: 2.8, localPp: -1.0 },
    firmCreation: { ratePct: 8.9, nationalPct: 9.6, rank: 210, rankOf: 384 },
    marketAccess: { index: 74, rank: 18, rankOf: 384 },
    eci: 2.23,
    coi: 1.8,
    newExports: { actual: 7, predictedForEci: 11 },
    marketShare: { levelPct: 1.62, deltaPp: 0.08 },
    rajanZingales: { exposure: 0.42, verdict: "low" },
    inputPrices: [
      { input: "Electricity (industrial)", rank: 8, rankOf: 384 },
      { input: "Commercial rent", rank: 5, rankOf: 384 },
      { input: "Industrial land", rank: 3, rankOf: 384 },
      { input: "Water & sewer", rank: 122, rankOf: 384 },
    ],
    patentClusters: [
      { name: "Biotech & pharma", count: 4_210, adjacent: true },
      { name: "AI & machine learning", count: 2_380, adjacent: true },
      { name: "Robotics", count: 940, adjacent: true },
      { name: "Semiconductors", count: 410, adjacent: false },
    ],
  },

  /* ————— stage 6 · supply branch (the implicated side) ————— */
  supply: {
    homeValueIndex: {
      city: [
        [2017, 100],
        [2018, 105],
        [2019, 108],
        [2020, 111],
        [2021, 117],
        [2022, 122],
        [2023, 124],
      ],
      msa: [
        [2017, 100],
        [2018, 106],
        [2019, 111],
        [2020, 118],
        [2021, 132],
        [2022, 145],
        [2023, 151],
      ],
      nation: [
        [2017, 100],
        [2018, 107],
        [2019, 113],
        [2020, 122],
        [2021, 142],
        [2022, 158],
        [2023, 166],
      ],
    },
    priceGrowthByArea: [
      { name: "Brockton", cagrPct: 11.0 },
      { name: "Lawrence", cagrPct: 10.2 },
      { name: "Lynn", cagrPct: 9.8 },
      { name: "Somerville", cagrPct: 9.1 },
      { name: "Cambridge", cagrPct: 8.4 },
      { name: "Waltham", cagrPct: 7.9 },
      { name: "Quincy", cagrPct: 7.8 },
      { name: "Framingham", cagrPct: 7.4 },
      { name: "Newton", cagrPct: 6.9 },
      { name: "Boston", cagrPct: 3.6 },
    ],
    permits: {
      msaPer1k: 2.1,
      nationPer1k: 4.3,
      series: [
        [2017, 13_900],
        [2018, 14_200],
        [2019, 13_100],
        [2020, 12_400],
        [2021, 13_800],
        [2022, 12_900],
        [2023, 11_700],
      ],
    },
    isochrones: [
      { minutes: 20, shareOfMsaJobs: 0.18 },
      { minutes: 30, shareOfMsaJobs: 0.38 },
      { minutes: 40, shareOfMsaJobs: 0.57 },
    ],
    amenityResidualPp: -12.7,
    housingTest: {
      question: "Are people priced out?",
      cityGrowthPct: 7.1,
      medianGrowthPct: 8.8,
      verdict: "Probably not — today.",
      tone: "good",
      body:
        "A supply story is usually told in housing. But the metro's home values grew +7.1%/yr against +8.8%/yr for the typical US metro — with prices lagging the field, \"newly priced out\" is hard to sustain as the recent mover. The level is brutal; the change isn't. If housing isn't what changed, the other supply lever is amenities.",
    },
  },

  treePath: ["root", "supply", "amen"],
  treeRuledOut: ["housing"],

  /* ————— stage 7 ————— */
  table2: {
    vsNationPp: -0.1,
    vsPeersPp: 0.1,
    peers: [
      { name: "New York", popCagr: 0.1 },
      { name: "San Francisco", popCagr: -0.3 },
      { name: "Washington", popCagr: 0.6 },
      { name: "Chicago", popCagr: -0.2 },
      { name: "Seattle", popCagr: 1.1 },
    ],
    peerCriteria:
      "Box 8 criteria — similar size, income per capita, and knowledge-heavy industry mix: the big coastal-and-lakes brain hubs.",
  },
  growthQuestion:
    "Boston's export engine is world-class, yet the metro adds people more slowly than the country and the city proper is shrinking. What is making it hard to live here — and what would let export success show up as people?",
  levers: [
    {
      name: "Export-sector support",
      body: "Deepen the tradable base — the oxygen supply — that sets the ceiling on how large the metro can grow. Boston's is exceptional (ECI 2.23); the task is to keep it that way.",
      emphasis: "maintain",
      tag: "keep the oxygen flowing",
    },
    {
      name: "Housing supply",
      body: "Let construction respond to demand, so growth shows up as people rather than only as prices. The housing test says this isn't today's wall — but permits run at half the national rate, and fortress dynamics are one boom away.",
      emphasis: "secondary",
      tag: "second lever",
    },
    {
      name: "Amenity investment",
      body: "The quality-of-life pull that draws residents independent of wages. The −12.7 pp residual drift says this is where Boston is leaking: the deal feels worse even as the paychecks grow.",
      emphasis: "primary",
      tag: "where the leverage lives",
    },
  ],

  /* ————— voice ————— */
  narrative: {
    intro:
      "How well is a city doing? The clearest signal is whether people are arriving or leaving. Within a country, moving is relatively frictionless — so population change is residents voting with their feet on whether Boston is a good place to live and work.",
    cityNote:
      "The city proper is losing people — 0.8% a year — while salaries climb. Feet and paychecks are pointing in opposite directions, and that disagreement is the diagnostic thread this page pulls.",
    msaNote:
      "People commute, firms hire, and housing responds across a region far wider than the city line. The real unit is the Boston MSA — 4.9 million people — and most of what follows is read at that scale.",
    exportNote:
      "A metro's size tracks what it can sell to outsiders. Hospitals treating out-of-state patients, universities importing students, labs selling research, software shipped over a wire — the gold share is the economy breathing for everyone else.",
    constraintNote:
      "Wages are growing fast but population lags — consistent with a constrained supply side: pay is bid up because workers cannot, or will not, move in. The evidence pages check which supply suspect is holding the door.",
    branchNote:
      "The demand branch stays dim — exports, complexity, and market share all read healthy. On the supply branch, the housing test acquits prices as the recent mover, which leaves amenities holding the bag: the metro's revealed pull is fading.",
    leversNote:
      "The diagnosis is a hypothesis, not a verdict. It says where to look first — the supply side, amenities before housing — and which tests would change your mind. What it deliberately does not say is what to build; that's the work the next room is for.",
  },
};
