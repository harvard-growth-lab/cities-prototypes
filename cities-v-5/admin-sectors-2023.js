/* Admin sectors (2026-10-26): the administrative city's two workforces by
   NAICS 2-digit sector, for the beats that follow the metro's industries in
   "What do my metro and I produce?" (they replace the Worker Flows section).

   LODES 2023, the same source and year as section 1's commuting beats, from
   the reference's parquet (cities.taimur.sh/usa/place/boston-ma):
   place_sector_composition for Boston (2507000) and city_sector_composition
   for the Boston MSA (14460). Per sector: jobs = jobs located in Boston,
   whoever holds them (workplace area characteristics); residents = jobs
   Boston's residents hold, wherever those are (residence area
   characteristics); msaJobs and msaResidents are the same two counts for
   the metro. There is no split of a sector's jobs into residents and
   commuters: jobs minus residents is the floor on what Boston draws in
   (positive) or sends out (negative) for that work.

   admin: the sector sums, which equal the place_commute row for 2023
   (718,571 jobs, 347,517 working residents, 190,083 who live and work in
   Boston); in = jobs minus liveWork, out = residents minus liveWork, the
   528K and 157K of section 1. metro: the MSA's sums (2,811,395 jobs,
   2,547,848 resident workers), not the 2.3M of the 2024 industry beats,
   which come from another source; never put the two in one sentence.

   name is the reference's sector title, short the name section 2's
   treemap gives the 2-digit sector (treemap.js NAICS2), sector the house
   palette group it is coloured by (treemap.js sectorColors). Sorted by
   jobs located in Boston. Every count is written on screen through
   window.fmtCount; shares as whole percent; ratios with one decimal. */
window.ADMIN_SECTORS_2023 = {
  year: 2023,
  source: "LODES 2023 (workplace and residence area characteristics)",
  admin: { name: "Boston", jobs: 718571, residents: 347517, liveWork: 190083, in: 528488, out: 157434 },
  metro: { name: "Boston metro", jobs: 2811395, residents: 2547848 },
  sectors: [
    { code: "62", name: "Health Care and Social Assistance", short: "Health care & social assistance", sector: "Education & Health",
      jobs: 146805, residents: 65445, msaJobs: 453229, msaResidents: 421338 },
    { code: "54", name: "Professional, Scientific, and Technical Services", short: "Professional & technical services", sector: "Professional & Business",
      jobs: 109007, residents: 46498, msaJobs: 345968, msaResidents: 304328 },
    { code: "61", name: "Educational Services", short: "Education", sector: "Education & Health",
      jobs: 78624, residents: 42821, msaJobs: 295456, msaResidents: 275175 },
    { code: "52", name: "Finance and Insurance", short: "Finance & insurance", sector: "Financial Activities",
      jobs: 72986, residents: 21455, msaJobs: 148884, msaResidents: 133707 },
    { code: "72", name: "Accommodation and Food Services", short: "Accommodation & food", sector: "Leisure & Hospitality",
      jobs: 59567, residents: 31784, msaJobs: 220552, msaResidents: 205812 },
    { code: "92", name: "Public Administration", short: "Public administration", sector: "Other",
      jobs: 38632, residents: 14352, msaJobs: 111240, msaResidents: 101414 },
    { code: "56", name: "Administrative and Support and Waste Management", short: "Administrative & support", sector: "Professional & Business",
      jobs: 34901, residents: 21156, msaJobs: 151294, msaResidents: 135797 },
    { code: "44-45", name: "Retail Trade", short: "Retail trade", sector: "Trade & Transportation",
      jobs: 31066, residents: 23630, msaJobs: 245784, msaResidents: 226009 },
    { code: "51", name: "Information", short: "Information", sector: "Other",
      jobs: 28212, residents: 13110, msaJobs: 96795, msaResidents: 86129 },
    { code: "48-49", name: "Transportation and Warehousing", short: "Transportation & warehousing", sector: "Trade & Transportation",
      jobs: 26552, residents: 9194, msaJobs: 75085, msaResidents: 66252 },
    { code: "81", name: "Other Services (except Public Administration)", short: "Other services", sector: "Other",
      jobs: 21956, residents: 12058, msaJobs: 91343, msaResidents: 84546 },
    { code: "23", name: "Construction", short: "Construction", sector: "Construction",
      jobs: 14926, residents: 8862, msaJobs: 136309, msaResidents: 116250 },
    { code: "53", name: "Real Estate and Rental and Leasing", short: "Real estate & rental", sector: "Financial Activities",
      jobs: 14892, residents: 6039, msaJobs: 40415, msaResidents: 36089 },
    { code: "71", name: "Arts, Entertainment, and Recreation", short: "Arts & recreation", sector: "Leisure & Hospitality",
      jobs: 13364, residents: 6448, msaJobs: 52671, msaResidents: 47923 },
    { code: "42", name: "Wholesale Trade", short: "Wholesale trade", sector: "Trade & Transportation",
      jobs: 9366, residents: 7280, msaJobs: 94682, msaResidents: 84780 },
    { code: "31-33", name: "Manufacturing", short: "Manufacturing", sector: "Manufacturing",
      jobs: 8302, residents: 8673, msaJobs: 171589, msaResidents: 151965 },
    { code: "55", name: "Management of Companies and Enterprises", short: "Management of companies", sector: "Professional & Business",
      jobs: 6838, residents: 7191, msaJobs: 63836, msaResidents: 54584 },
    { code: "22", name: "Utilities", short: "Utilities", sector: "Trade & Transportation",
      jobs: 2461, residents: 1138, msaJobs: 9274, msaResidents: 9515 },
    { code: "11", name: "Agriculture, Forestry, Fishing and Hunting", short: "Agriculture & forestry", sector: "Natural Resources",
      jobs: 101, residents: 368, msaJobs: 6639, msaResidents: 5801 },
    { code: "21", name: "Mining, Quarrying, and Oil and Gas Extraction", short: "Mining, oil & gas", sector: "Natural Resources",
      jobs: 13, residents: 15, msaJobs: 350, msaResidents: 434 }
  ]
};
