/* Admin sectors 2013 (2026-10-27): the same two workforces as
   admin-sectors-2023.js, ten years earlier, for the year select on the beats
   that follow the metro's industries in "What do my metro and I produce?".
   Built the same way and in the same shape as the 2023 file, so the page can
   swap one for the other.

   LODES 2013 from the reference's parquet (cities.taimur.sh/usa/place/boston-ma):
   place_sector_composition for Boston (2507000) and city_sector_composition
   for the Boston MSA (14460), year 2013. Per sector: jobs = the parquet's
   employment (jobs located in Boston, whoever holds them; workplace area
   characteristics); residents = its workers (jobs Boston's residents hold,
   wherever those are; residence area characteristics); msaJobs and
   msaResidents are the same two counts for the metro. The 2023 file was
   checked against the same parquet with the same mapping and matches it
   field for field. There is no split of a sector's jobs into residents and
   commuters: jobs minus residents is the floor on what Boston draws in
   (positive) or sends out (negative) for that work.

   admin: the sector sums, which equal the place_commute row for 2013
   (594,138 jobs, 293,210 working residents, 158,610 who live and work in
   Boston); in = jobs minus liveWork (435,528), out = residents minus liveWork
   (134,600). metro: the MSA's sums (2,485,684 jobs, 2,291,816 resident workers).

   od: LODES8 origin-destination 2013, JT00 (all jobs), main and aux files for
   Massachusetts (the aux file adds the jobs in Boston held by people who live
   out of state); jobs whose workplace block is in Boston, by whether the home
   block is in Boston (residents) or not (nonResidents), in the three LODES
   industry groups SI01 goods producing (NAICS 11, 21, 23, 31-33), SI02 trade,
   transportation and utilities (22, 42, 44-45, 48-49) and SI03 all other
   services. Boston's blocks are those whose place (stplc) is 2507000 in the
   LODES 2020-block crosswalk, which LODES8 uses for every year. residents sum
   to liveWork and nonResidents to in exactly. These are counts for the three
   groups only: any split of one sector's jobs into residents and
   non-residents is the page's estimate, never a count. Note for that
   estimate: in 2013 Agriculture (11) has 13 jobs in Boston and 134 residents
   working in it, so the goods group's resident rate (0.26) would give it more
   residents in the city than it has jobs; a split that caps it there must hand
   the rest of the group's residents to the group's other sectors, or the goods
   group falls about 22 short of the OD count.

   The 2013 OD files are an earlier LODES8 release (created 2023-03-21) than
   the 2023 ones (2025-12-02); the parquet and the OD agree for both years.

   name is the reference's sector title, short and sector are copied by code
   from admin-sectors-2023.js (section 2's treemap name and the house palette
   group). Sorted by jobs located in Boston, 2013 (so the order differs from
   2023's). Every count is written on screen through window.fmtCount; shares
   as whole percent; ratios with one decimal. */
window.ADMIN_SECTORS_2013 = {
  year: 2013,
  source: "LODES 2013 (workplace and residence area characteristics)",
  admin: { name: "Boston", jobs: 594138, residents: 293210, liveWork: 158610, in: 435528, out: 134600 },
  metro: { name: "Boston metro", jobs: 2485684, residents: 2291816 },
  od: { residents: { SI01: 3919, SI02: 14696, SI03: 139995 }, nonResidents: { SI01: 14488, SI02: 46828, SI03: 374212 } },
  sectors: [
    { code: "62", name: "Health Care and Social Assistance", short: "Health care & social assistance", sector: "Education & Health",
      jobs: 120324, residents: 57644, msaJobs: 405108, msaResidents: 386803 },
    { code: "54", name: "Professional, Scientific, and Technical Services", short: "Professional & technical services", sector: "Professional & Business",
      jobs: 70830, residents: 30082, msaJobs: 252272, msaResidents: 225789 },
    { code: "52", name: "Finance and Insurance", short: "Finance & insurance", sector: "Financial Activities",
      jobs: 68317, residents: 20602, msaJobs: 144292, msaResidents: 134007 },
    { code: "61", name: "Educational Services", short: "Education", sector: "Education & Health",
      jobs: 60637, residents: 30936, msaJobs: 256827, msaResidents: 244821 },
    { code: "72", name: "Accommodation and Food Services", short: "Accommodation & food", sector: "Leisure & Hospitality",
      jobs: 55112, residents: 29608, msaJobs: 201025, msaResidents: 189094 },
    { code: "92", name: "Public Administration", short: "Public administration", sector: "Other",
      jobs: 41907, residents: 14840, msaJobs: 100395, msaResidents: 91347 },
    { code: "44-45", name: "Retail Trade", short: "Retail trade", sector: "Trade & Transportation",
      jobs: 31230, residents: 23789, msaJobs: 254143, msaResidents: 236503 },
    { code: "56", name: "Administrative and Support and Waste Management", short: "Administrative & support", sector: "Professional & Business",
      jobs: 29256, residents: 19822, msaJobs: 133417, msaResidents: 121682 },
    { code: "81", name: "Other Services (except Public Administration)", short: "Other services", sector: "Other",
      jobs: 22303, residents: 12237, msaJobs: 87951, msaResidents: 82371 },
    { code: "48-49", name: "Transportation and Warehousing", short: "Transportation & warehousing", sector: "Trade & Transportation",
      jobs: 19324, residents: 6933, msaJobs: 58044, msaResidents: 53497 },
    { code: "51", name: "Information", short: "Information", sector: "Other",
      jobs: 15480, residents: 8579, msaJobs: 82147, msaResidents: 73393 },
    { code: "53", name: "Real Estate and Rental and Leasing", short: "Real estate & rental", sector: "Financial Activities",
      jobs: 11960, residents: 5100, msaJobs: 34970, msaResidents: 32197 },
    { code: "23", name: "Construction", short: "Construction", sector: "Construction",
      jobs: 11005, residents: 5767, msaJobs: 89065, msaResidents: 77868 },
    { code: "71", name: "Arts, Entertainment, and Recreation", short: "Arts & recreation", sector: "Leisure & Hospitality",
      jobs: 9826, residents: 4419, msaJobs: 37954, msaResidents: 34980 },
    { code: "42", name: "Wholesale Trade", short: "Wholesale trade", sector: "Trade & Transportation",
      jobs: 9001, residents: 6865, msaJobs: 97101, msaResidents: 86964 },
    { code: "55", name: "Management of Companies and Enterprises", short: "Management of companies", sector: "Professional & Business",
      jobs: 8255, residents: 5860, msaJobs: 56368, msaResidents: 50264 },
    { code: "31-33", name: "Manufacturing", short: "Manufacturing", sector: "Manufacturing",
      jobs: 7375, residents: 9111, msaJobs: 182275, msaResidents: 158275 },
    { code: "22", name: "Utilities", short: "Utilities", sector: "Trade & Transportation",
      jobs: 1969, residents: 858, msaJobs: 8356, msaResidents: 8115 },
    { code: "21", name: "Mining, Quarrying, and Oil and Gas Extraction", short: "Mining, oil & gas", sector: "Natural Resources",
      jobs: 14, residents: 24, msaJobs: 582, msaResidents: 551 },
    { code: "11", name: "Agriculture, Forestry, Fishing and Hunting", short: "Agriculture & forestry", sector: "Natural Resources",
      jobs: 13, residents: 134, msaJobs: 3392, msaResidents: 3295 }
  ]
};
