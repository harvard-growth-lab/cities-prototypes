/* The data manifest, as a snapshot for the text editor (?edit only).
   Made by tools/data-manifest.py from https://docs.google.com/spreadsheets/d/1RdaA7qJiePBGVlfibSnHXteRWwQMJs3zyT6BB4mMzxY/edit?gid=1856054194#gid=1856054194
   Do not edit by hand: run the script again when the sheet changes. */
window.DATA_MANIFEST = {
 "source": "https://docs.google.com/spreadsheets/d/1RdaA7qJiePBGVlfibSnHXteRWwQMJs3zyT6BB4mMzxY/edit?gid=1856054194#gid=1856054194",
 "fetched": "2026-11-05",
 "rows": [
  {
   "row": 3,
   "section": "Who am I and my Metro?",
   "module": "Who am I?",
   "analysis": "Admin boundary and map",
   "level": "Admin",
   "metric": "Geographic boundary",
   "years": "2025",
   "type": "geo",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "geometry",
     "file": "place_boundaries.parquet",
     "note": ""
    },
    {
     "column": "place_name",
     "file": "place_boundaries.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 4,
   "section": "Who am I and my Metro?",
   "module": "Who am I?",
   "analysis": "Admin boundary and map",
   "level": "Admin",
   "metric": "Peer list",
   "years": "2014-2024",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "peer_rank",
     "file": "place_peers.parquet",
     "note": ""
    },
    {
     "column": "peer_place_id",
     "file": "place_peers.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 5,
   "section": "Who am I and my Metro?",
   "module": "Who am I?",
   "analysis": "Admin population",
   "level": "Admin",
   "metric": "Population in latest year and relative to national and peers",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "",
   "instruction": "Filter for max year. Construct national series as sum of metro population from metro_panel.parquet",
   "fields": [
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 6,
   "section": "Who am I and my Metro?",
   "module": "Who am I?",
   "analysis": "Admin level statistics vs population",
   "level": "Admin",
   "metric": "Employment level and relative to national, peers, and peer average vs population in latest year",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from employment series, population series and peer list",
   "instruction": "Filter for max year. Construct national series as sum of metro employed population from metro_panel.parquet",
   "fields": [
    {
     "column": "employed",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": "for admin-level data"
    },
    {
     "column": "employed",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": "for national-level data (sum of metros)"
    }
   ]
  },
  {
   "row": 7,
   "section": "Who am I and my Metro?",
   "module": "Who am I?",
   "analysis": "Admin level statistics vs population",
   "level": "Admin",
   "metric": "Wage levels and relative to national, peers, and peer average vs population in latest year",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from wage series, population series and peer list",
   "instruction": "Filter for max year. Construct national series by aggregating metros (average of wage_nowcast weighted by wage_nowcast_n) in metro_panel.parquet. Construct peer average series by aggregating places (average of wage_nowcast weighted by wage_nowcast_n) in place_panel.parquet.",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "wage_nowcast_n",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": "for admin-level data"
    },
    {
     "column": "wage_nowcast",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "wage_nowcast_n",
     "file": "metro_panel.parquet",
     "note": "for national-level data"
    }
   ]
  },
  {
   "row": 8,
   "section": "Who am I and my Metro?",
   "module": "Who am I?",
   "analysis": "Admin level statistics vs population",
   "level": "Admin",
   "metric": "Housing price levels and relative to national, peers, and peer average vs population in latest year",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from housing series, population series and peer list",
   "instruction": "Filter for max year. Construct national series by aggregating metros (average of value weighted by population) in metro_housing.parquet. Construct peer average series by aggregating places (average of value weighted by population) in place_housing.parquet.",
   "fields": [
    {
     "column": "value",
     "file": "place_housing.parquet",
     "note": "for admin-level data"
    },
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": "for admin-level data"
    },
    {
     "column": "value",
     "file": "metro_housing.parquet",
     "note": "for national-level data (population-weighted average of metros)"
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": "for national-level data (sum of population of metros)"
    }
   ]
  },
  {
   "row": 9,
   "section": "Who am I and my Metro?",
   "module": "Who am I?",
   "analysis": "Admin level statistics vs population",
   "level": "Admin",
   "metric": "Unemployement rate levels and relative to national, peers, and peer average vs population in latest year",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from unemployment series, population series and peer list",
   "instruction": "Filter for max year. Construct national unemployment rate over time = 100 - 100*(sum of 'employed' / sum of 'labor_force' across metros in metro_panel.parquet). Construct peer average unemployment rate over time = 100 - 100*(sum of 'employed' / sum of 'labor_force' across peer admins in place_panel.parquet)",
   "fields": [
    {
     "column": "unemployment_rate",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": "for admin-level data"
    },
    {
     "column": "employed",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "labor_force",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "employed",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "labor_force",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": "for national-level unemployment rate, sum employed / sum labor_force across metros"
    }
   ]
  },
  {
   "row": 10,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Admin to Metro Key",
   "level": "Admin",
   "metric": "Admin to Metro Key",
   "years": "2025",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "place_id",
     "file": "place_directory.parquet",
     "note": ""
    },
    {
     "column": "metro_id",
     "file": "place_directory.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 11,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro boundary and map",
   "level": "Metro",
   "metric": "Geographic boundary",
   "years": "2025",
   "type": "geo",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "geometry",
     "file": "metro_boundaries.parquet",
     "note": ""
    },
    {
     "column": "metro_name",
     "file": "metro_boundaries.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 12,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro boundary and map",
   "level": "Metro",
   "metric": "Peer list",
   "years": "2014-2024",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "peer_rank",
     "file": "metro_peers.parquet",
     "note": ""
    },
    {
     "column": "peer_metro_id",
     "file": "metro_peers.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 13,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro dashboard of level statistics",
   "level": "Metro",
   "metric": "Metro population levels with national ranking",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from population series",
   "instruction": "Filter for max year, compute national ranking",
   "fields": [
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 14,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro dashboard of level statistics",
   "level": "Metro",
   "metric": "Metro employment levels with national ranking",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment series",
   "instruction": "Filter for max year, compute national ranking",
   "fields": [
    {
     "column": "employed",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 15,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro dashboard of level statistics",
   "level": "Metro",
   "metric": "Metro wage levels with national ranking",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from wage series",
   "instruction": "Filter for max year, compute national ranking",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 16,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro dashboard of level statistics",
   "level": "Metro",
   "metric": "Metro housing price levels with national ranking",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from housing price series",
   "instruction": "Filter for max year, compute national ranking",
   "fields": [
    {
     "column": "value",
     "file": "metro_housing.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 17,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro dashboard of level statistics",
   "level": "Metro",
   "metric": "Metro unemployment levels with national ranking",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from unemployment series",
   "instruction": "Filter for max year, compute national ranking",
   "fields": [
    {
     "column": "unemployment_rate",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 18,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro comparison to other metros",
   "level": "Metro",
   "metric": "Metro employment vs population for all MSAs",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment series and population series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "employed",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 19,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro comparison to other metros",
   "level": "Metro",
   "metric": "Metro wage vs population for all MSAs",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from wage series and population series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 20,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro comparison to other metros",
   "level": "Metro",
   "metric": "Metro housing prices vs population for all MSAs",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from housing series and population series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "value",
     "file": "metro_housing.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 21,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Metro comparison to other metros",
   "level": "Metro",
   "metric": "Metro unemployment vs population for all MSAs",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from unemployment series and population series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "unemployment_rate",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 22,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Flows between me and my metro",
   "level": "Metro and Admin",
   "metric": "Map of admin and other admins colored by gross sending into admin",
   "years": "2023",
   "type": "bilateral",
   "status": "Done",
   "compute": true,
   "calculation": "from flows series",
   "instruction": "Filter for direction = out (sending) and max year. partner_id indicates the partner place, jobs is the size of the flow, and rank is the rank of the flow in that direction. Link partner_id to place_boundaries.parquet for polygon.",
   "fields": [
    {
     "column": "partner_id",
     "file": "",
     "note": ""
    },
    {
     "column": "direction",
     "file": "",
     "note": ""
    },
    {
     "column": "jobs",
     "file": "",
     "note": ""
    },
    {
     "column": "rank",
     "file": "",
     "note": ""
    }
   ]
  },
  {
   "row": 23,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Flows between me and my metro",
   "level": "Metro and Admin",
   "metric": "Map of admin and other admins colored by gross receiving into admin",
   "years": "2023",
   "type": "bilateral",
   "status": "Done",
   "compute": true,
   "calculation": "from flows series",
   "instruction": "Filter for direction = in (receiving) and max year. partner_id indicates the partner place, jobs is the size of the flow, and rank is the rank of the flow in that direction. Link partner_id to place_boundaries.parquet for polygon.",
   "fields": [
    {
     "column": "partner_id",
     "file": "",
     "note": ""
    },
    {
     "column": "direction",
     "file": "",
     "note": ""
    },
    {
     "column": "jobs",
     "file": "",
     "note": ""
    },
    {
     "column": "rank",
     "file": "",
     "note": ""
    }
   ]
  },
  {
   "row": 24,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Flows between me and my metro",
   "level": "Metro and Admin",
   "metric": "Map of admin and other admins colored by net flows into the admin",
   "years": "2023",
   "type": "bilateral",
   "status": "Done",
   "compute": true,
   "calculation": "from flows series",
   "instruction": "Compute partner-level net flows with this admin. Filter for max year and construct net flow of jobs (direction in - direction out) between every partner and this admin. Link partner_id to place_boundaries.parquet for polygon.",
   "fields": [
    {
     "column": "partner_id",
     "file": "",
     "note": ""
    },
    {
     "column": "direction",
     "file": "",
     "note": ""
    },
    {
     "column": "jobs",
     "file": "",
     "note": ""
    },
    {
     "column": "rank",
     "file": "",
     "note": ""
    }
   ]
  },
  {
   "row": 25,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Explore admins in metro",
   "level": "Metro and Admin",
   "metric": "All admin population",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from population series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 26,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Explore admins in metro",
   "level": "Metro and Admin",
   "metric": "All admin employment",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from employment series",
   "instruction": "FIlter for max year",
   "fields": [
    {
     "column": "employed",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 27,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Explore admins in metro",
   "level": "Metro and Admin",
   "metric": "All admin wages",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from wage series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 28,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Explore admins in metro",
   "level": "Metro and Admin",
   "metric": "All admin housing prices",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from housing price series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "value",
     "file": "place_housing.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 29,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Explore admins in metro",
   "level": "Metro and Admin",
   "metric": "All admin unemployment rates",
   "years": "2024",
   "type": "cross-section",
   "status": "Done",
   "compute": true,
   "calculation": "from unemployment series",
   "instruction": "Filter for max year",
   "fields": [
    {
     "column": "unemployment_rate",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 30,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Summary",
   "level": "Metro and Admin",
   "metric": "Whether you are an anchor based on population and employment shares",
   "years": "2023",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from Census population and LODES employment series",
   "instruction": "Filter for max year. Place population share of metro = place population in place_panel.parquet / metro population in metro_panel.parquet. Place employment share of metro = employment summed across sectors / metro_employment summed across sectors in place_sector_balance.parquet. Call a place the anchor of its metro if it is at least X% of the metro's population.",
   "fields": [
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "employment",
     "file": "",
     "note": ""
    },
    {
     "column": "metro_employment",
     "file": "place_sector_balance.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 31,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Summary",
   "level": "Admin",
   "metric": "Whether you are net sender or receiver of workers",
   "years": "2023",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from total of resident workers and jobs here",
   "instruction": "Filter for max year. Ratio = jobs_here / resident_workers (jobs located in the admin over jobs held by its residents). Above 1 the admin is a net receiver of workers, below 1 a net sender.",
   "fields": [
    {
     "column": "jobs_here",
     "file": "place_commute.parquet",
     "note": ""
    },
    {
     "column": "resident_workers",
     "file": "place_commute.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 32,
   "section": "Who am I and my Metro?",
   "module": "You are not an island",
   "analysis": "Summary",
   "level": "Admin",
   "metric": "What are your top connected admins",
   "years": "2023",
   "type": "bilateral",
   "status": "Done",
   "compute": true,
   "calculation": "from flows series",
   "instruction": "Filter for max year. Express most connected admins as gross flows? Or what measure here?",
   "fields": [
    {
     "column": "partner_id",
     "file": "place_flows.parquet",
     "note": ""
    },
    {
     "column": "direction",
     "file": "place_flows.parquet",
     "note": ""
    },
    {
     "column": "jobs",
     "file": "place_flows.parquet",
     "note": ""
    },
    {
     "column": "rank",
     "file": "place_flows.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 33,
   "section": "What do my metro and I produce?",
   "module": "Metro Exports",
   "analysis": "Metro Industry Composition",
   "level": "Metro",
   "metric": "Metro employment shares by industry (tree-map and ranked)",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment by industry series",
   "instruction": "Compute shares from raw employment",
   "fields": [
    {
     "column": "industry_code",
     "file": "metro_industry_employment.parquet",
     "note": ""
    },
    {
     "column": "industry",
     "file": "metro_industry_employment.parquet",
     "note": ""
    },
    {
     "column": "sector_2d",
     "file": "metro_industry_employment.parquet",
     "note": ""
    },
    {
     "column": "employment",
     "file": "metro_industry_employment.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 34,
   "section": "What do my metro and I produce?",
   "module": "Metro Exports",
   "analysis": "Metro Industry Complexity",
   "level": "Metro",
   "metric": "Metro employment shares by industry (tree-map and ranked) with complexity",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment by industry series",
   "instruction": "Compute shares from raw employment",
   "fields": [
    {
     "column": "industry_code",
     "file": "metro_industry_employment.parquet",
     "note": ""
    },
    {
     "column": "industry",
     "file": "metro_industry_employment.parquet",
     "note": ""
    },
    {
     "column": "sector_2d",
     "file": "metro_industry_employment.parquet",
     "note": ""
    },
    {
     "column": "employment",
     "file": "metro_industry_employment.parquet",
     "note": ""
    },
    {
     "column": "pci",
     "file": "metro_industry_employment.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 35,
   "section": "What do my metro and I produce?",
   "module": "Metro Exports",
   "analysis": "Metro Industry Tradability",
   "level": "Metro",
   "metric": "Metro employment shares by industry (tree-map and ranked) with tradeability",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment by industry series and tradability mapping",
   "instruction": "Compute shares from raw employment. Merge industry_tradability.parquet on industry_code to transform tradability probabilities into the three tradability classes.",
   "fields": [
    {
     "column": "industry_code",
     "file": "",
     "note": ""
    },
    {
     "column": "industry",
     "file": "",
     "note": ""
    },
    {
     "column": "sector_2d",
     "file": "",
     "note": ""
    },
    {
     "column": "employment",
     "file": "",
     "note": ""
    },
    {
     "column": "tradability",
     "file": "",
     "note": ""
    },
    {
     "column": "tradability_class",
     "file": "industry_tradability.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 36,
   "section": "What do my metro and I produce?",
   "module": "Metro Exports",
   "analysis": "Metro Industry Tradability",
   "level": "Metro",
   "metric": "Tradability classification",
   "years": "-",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "grain",
     "file": "industry_tradability.parquet",
     "note": ""
    },
    {
     "column": "industry_code",
     "file": "industry_tradability.parquet",
     "note": ""
    },
    {
     "column": "tradability_class",
     "file": "industry_tradability.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 37,
   "section": "What do my metro and I produce?",
   "module": "Metro Exports",
   "analysis": "Metro Tradeable Specialization",
   "level": "Metro",
   "metric": "Metro RCAs in tradeable industries, and comparison to mean of peers",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment by industry series and tradeability determination and peers list",
   "instruction": "Compute employment RCAs from metro x year x employment totals in metro_industry_employment, using national employment in the denomenator coming from national_industry_employment with the same column names. Merge industry_tradability.parquet on industry_code to transform tradability probabilities into the three tradability classes. When comparing metro's RCA to mean RCA of peers, construct RCA of peers as pooled RCA: aggregate metro x year employment totals across peers and then construct RCA using national employment in the denomenator from national_industry_employment.",
   "fields": [
    {
     "column": "industry_code",
     "file": "",
     "note": ""
    },
    {
     "column": "industry",
     "file": "",
     "note": ""
    },
    {
     "column": "sector_2d",
     "file": "",
     "note": ""
    },
    {
     "column": "employment",
     "file": "",
     "note": ""
    },
    {
     "column": "tradability",
     "file": "",
     "note": ""
    },
    {
     "column": "tradability_class",
     "file": "industry_tradability.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 38,
   "section": "What do my metro and I produce?",
   "module": "Admin Industry",
   "analysis": "Admin share of Metro Jobs",
   "level": "Admin and Metro",
   "metric": "Treemap of Admin jobs at 2 digit level with toggle for residents and place-based workers",
   "years": "2023",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from WAC and RAC series",
   "instruction": "Compute shares for treemap from employment (jobs located in place) or workers (jobs done by place's residents)",
   "fields": [
    {
     "column": "sector",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "sector_name",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "employment",
     "file": "place_sector_balance.parquet",
     "note": "jobs located in place, from WAC"
    },
    {
     "column": "workers",
     "file": "place_sector_balance.parquet",
     "note": "jobs done by place's residents, from RAC"
    }
   ]
  },
  {
   "row": 39,
   "section": "What do my metro and I produce?",
   "module": "Admin Industry",
   "analysis": "Admin share of Metro Jobs",
   "level": "Admin and Metro",
   "metric": "Total Metro jobs by industry broken down by three categories (stacked bar) - done in Admin, done by Admin residents outside Admin, not done in Admin or by Admin residents",
   "years": "2002-2023 (use latest year)",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "the place-lab \"here vs home\" table: jobs here vs what residents do, by sector",
   "instruction": "Filter to the admin (place_id) and the latest year; one row per sector. employment = jobs located in the admin (LODES WAC), workers = jobs held by admin residents wherever they work (LODES RAC), net_jobs = employment - workers. Draw as a diverging bar sorted by net_jobs: positive = the admin imports workers for the sector, negative = it exports them. metro_employment and share_of_metro_jobs give the metro comparison. Note: There are 32 cells where share_of_metro_jobs in place_sector_balance has a value greater than 1 due to LODES noise in small cells, so the charts should cap values above 1.",
   "fields": [
    {
     "column": "sector",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "sector_name",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "employment",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "workers",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "net_jobs",
     "file": "place_sector_balance.parquet",
     "note": "plus metro_employment, share_of_metro_jobs for the metro comparison"
    }
   ]
  },
  {
   "row": 40,
   "section": "What do my metro and I produce?",
   "module": "Admin Industry",
   "analysis": "Admin specialization in Metro",
   "level": "Admin and Metro",
   "metric": "Ratio of Admin jobs to Metro jobs",
   "years": "2002-2023 (use latest year)",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment by industry 2 digit Admin and employment by industry in Metro",
   "instruction": "Filter for max year. Ratio of admin jobs to metro jobs = sector_share_place / sector_share_metro per sector.",
   "fields": [
    {
     "column": "sector",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "sector_name",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "sector_share_place",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "sector_share_metro",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "location_quotient",
     "file": "place_sector_balance.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 41,
   "section": "What do my metro and I produce and export?",
   "module": "Admin and Metro Industry flows",
   "analysis": "Net sender or receiver",
   "level": "Admin and Metro",
   "metric": "Ratio of jobs present and jobs sent",
   "years": "2002-2023 (use latest year)",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from aggregated flows series",
   "instruction": "Ratio = jobs_here / resident_workers (jobs located in the admin over jobs held by its residents). Above 1 the admin is a net receiver of workers, below 1 a net sender. in_commuters = jobs_here - live_work_here; out_commuters = resident_workers - live_work_here.",
   "fields": [
    {
     "column": "jobs_here",
     "file": "place_commute.parquet",
     "note": ""
    },
    {
     "column": "resident_workers",
     "file": "place_commute.parquet",
     "note": ""
    },
    {
     "column": "live_work_here",
     "file": "place_commute.parquet",
     "note": ""
    },
    {
     "column": "in_commuters",
     "file": "place_commute.parquet",
     "note": ""
    },
    {
     "column": "out_commuters",
     "file": "place_commute.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 42,
   "section": "What do my metro and I produce and export?",
   "module": "Admin and Metro Industry flows",
   "analysis": "Net flows",
   "level": "Admin and Metro",
   "metric": "Net flows by industry",
   "years": "2002-2023 (use latest year)",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from employment by industry and place 2 digit levels",
   "instruction": "net_jobs = employment - workers per sector and year: positive, the admin imports workers for the sector on net; negative, it exports them. Null where either side is missing for the admin.",
   "fields": [
    {
     "column": "net_jobs",
     "file": "place_sector_balance.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 43,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my admin",
   "level": "Admin",
   "metric": "Admin population trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 44,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my admin",
   "level": "Admin",
   "metric": "Admin employment trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "employed",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 45,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my admin",
   "level": "Admin",
   "metric": "Admin wages trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 46,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my admin",
   "level": "Admin",
   "metric": "Admin housing prices trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "value",
     "file": "place_housing.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 47,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my admin",
   "level": "Admin",
   "metric": "Admin unemployment rate trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "unemployment_rate",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 48,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my metro",
   "level": "Metro",
   "metric": "Metro population trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 49,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my metro",
   "level": "Metro",
   "metric": "Metro employment trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "employed",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 50,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my metro",
   "level": "Metro",
   "metric": "Metro wages trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 51,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my metro",
   "level": "Metro",
   "metric": "Metro housing prices trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "value",
     "file": "metro_housing.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 52,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my metro",
   "level": "Metro",
   "metric": "Metro unemployment rate trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "unemployment_rate",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 53,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my nation",
   "level": "National",
   "metric": "National population trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from population series",
   "instruction": "Construct national population trend as sum of metro populations over time",
   "fields": [
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 54,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my nation",
   "level": "National",
   "metric": "National employment trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from employment series",
   "instruction": "Construct national employment trend as sum of metro 'employed' variable over time",
   "fields": [
    {
     "column": "employed",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 55,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my nation",
   "level": "National",
   "metric": "National wages trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from wage series",
   "instruction": "Construct national wage trend as average of metro wage (wage_nowcast) weighted by metro IRS return count (wage_nowcast_n) over time",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "wage_nowcast_n",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 56,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my nation",
   "level": "National",
   "metric": "National housing prices trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from housing series and population series",
   "instruction": "Construct national housing series as average of metro housing value weighted by metro population over time",
   "fields": [
    {
     "column": "value",
     "file": "",
     "note": ""
    },
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 57,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my nation",
   "level": "National",
   "metric": "National unemployment rate trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from employment and labor force series",
   "instruction": "Construct national unemployment rate as 100 - 100*(sum of 'employed' / sum of 'labor_force' across metros) over time",
   "fields": [
    {
     "column": "employed",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "labor_force",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 58,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my peers",
   "level": "Admin",
   "metric": "Peer average population trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from population series",
   "instruction": "Construct peer population series as sum of population in peer places over time",
   "fields": [
    {
     "column": "population",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 59,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my peers",
   "level": "Admin",
   "metric": "Peer average employment trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from employment series",
   "instruction": "Construct peer employment series as sum of 'employed' in peer places over time",
   "fields": [
    {
     "column": "employed",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 60,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my peers",
   "level": "Admin",
   "metric": "Peer average wages trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from wage series",
   "instruction": "Construct peer wage series as average of peer places (average of wage_nowcast weighted by wage_nowcast_n) over time",
   "fields": [
    {
     "column": "wage_nowcast",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "wage_nowcast_n",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 61,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my peers",
   "level": "Admin",
   "metric": "Peer average housing prices trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from housing series",
   "instruction": "Construct peer housing series as average of peer places (average of value weighted by population) over time",
   "fields": [
    {
     "column": "value",
     "file": "place_housing.parquet",
     "note": ""
    },
    {
     "column": "population",
     "file": "place_housing.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 62,
   "section": "How I am doing?",
   "module": "Trends in my admin, metro, and peers",
   "analysis": "Trends in my peers",
   "level": "Admin",
   "metric": "Peer average unemployment rate trend over time since 2006 with last ten years highlighted",
   "years": "2006-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from unemployment series",
   "instruction": "Construct peer unemployment rate over time as 100 - 100*(sum of 'employed' / sum of 'labor_force' across peer admins)",
   "fields": [
    {
     "column": "employed",
     "file": "place_panel.parquet",
     "note": ""
    },
    {
     "column": "labor_force",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 63,
   "section": "How I am doing?",
   "module": "Quadrants",
   "analysis": "Admin level quadtrants",
   "level": "Admin",
   "metric": "2x2 of wage growth vs population growth",
   "years": "2014-2024",
   "type": "panel",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "pop_cagr",
     "file": "place_diagnosis.parquet",
     "note": ""
    },
    {
     "column": "wage_cagr",
     "file": "place_diagnosis.parquet",
     "note": ""
    },
    {
     "column": "pop_cagr_benchmark",
     "file": "place_diagnosis.parquet",
     "note": ""
    },
    {
     "column": "wage_cagr_benchmark",
     "file": "place_diagnosis.parquet",
     "note": ""
    },
    {
     "column": "quadrant",
     "file": "place_diagnosis.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 64,
   "section": "How I am doing?",
   "module": "Quadrants",
   "analysis": "Admin level quadtrants with Metro",
   "level": "Admin; Metro",
   "metric": "2x2 of wage growth vs population growth with Metro added",
   "years": "2014-2024",
   "type": "panel",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "pop_cagr",
     "file": "",
     "note": ""
    },
    {
     "column": "wage_cagr",
     "file": "",
     "note": ""
    },
    {
     "column": "pop_cagr_benchmark",
     "file": "",
     "note": ""
    },
    {
     "column": "wage_cagr_benchmark",
     "file": "",
     "note": ""
    },
    {
     "column": "quadrant",
     "file": "",
     "note": ""
    }
   ]
  },
  {
   "row": 65,
   "section": "Negative Supply",
   "module": "Housing vs Amenities",
   "analysis": "Admin level housing quadrants with Metro",
   "level": "Admin; Metro",
   "metric": "2x2 of housing price growth vs population growth with Metro added",
   "years": "2014-2024",
   "type": "panel",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "pop_cagr",
     "file": "",
     "note": ""
    },
    {
     "column": "cost_cagr",
     "file": "",
     "note": ""
    },
    {
     "column": "pop_cagr_median",
     "file": "",
     "note": ""
    },
    {
     "column": "cost_cagr_median",
     "file": "metro_diagnosis.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 66,
   "section": "Multiple",
   "module": "Shocks at Metro Level",
   "analysis": "Market share",
   "level": "Metro",
   "metric": "Market share of top tradeable industries over time",
   "years": "2014-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "industry_code",
     "file": "",
     "note": ""
    },
    {
     "column": "market_share",
     "file": "",
     "note": ""
    },
    {
     "column": "subsetting",
     "file": "",
     "note": ""
    }
   ]
  },
  {
   "row": 67,
   "section": "Multiple",
   "module": "Shocks at Metro Level",
   "analysis": "Metro Shift share",
   "level": "Metro",
   "metric": "Shift shares for national, industry mix, and local by industry",
   "years": "2014-2024",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "industry_code",
     "file": "metro_shift_share.parquet",
     "note": ""
    },
    {
     "column": "ns",
     "file": "metro_shift_share.parquet",
     "note": "national share"
    },
    {
     "column": "im",
     "file": "metro_shift_share.parquet",
     "note": "industry mix"
    },
    {
     "column": "ls",
     "file": "metro_shift_share.parquet",
     "note": "local share"
    },
    {
     "column": "is_new",
     "file": "metro_shift_share.parquet",
     "note": "true if industry has no employment in start year"
    },
    {
     "column": "e_r_t0",
     "file": "metro_shift_share.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 68,
   "section": "Negative Demand",
   "module": "Inputs",
   "analysis": "Rajen-Zingales",
   "level": "Metro",
   "metric": "Dependency ratio distributions by input",
   "years": "2010-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from employment by industry and industry depedency ratios",
   "instruction": "Compute rank in input among all metros",
   "fields": [
    {
     "column": "input",
     "file": "metro_input_intensity.parquet",
     "note": ""
    },
    {
     "column": "intensity",
     "file": "metro_input_intensity.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 69,
   "section": "Negative Demand",
   "module": "Innovation",
   "analysis": "Firm creation",
   "level": "Metro",
   "metric": "Firm entry vs exits",
   "years": "2010-2023",
   "type": "panel",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "startup_rate_adj",
     "file": "metro_firm_dynamics.parquet",
     "note": ""
    },
    {
     "column": "firm_exit_rate_adj",
     "file": "metro_firm_dynamics.parquet",
     "note": ""
    },
    {
     "column": "net_rate_adj",
     "file": "metro_firm_dynamics.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 70,
   "section": "Negative Demand",
   "module": "Innovation",
   "analysis": "Patents",
   "level": "Metro",
   "metric": "Patent output against population",
   "years": "2000-2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "Pool patents across most recent 5 years. Compute mean population across the same period.",
   "instruction": "",
   "fields": [
    {
     "column": "population",
     "file": "metro_innovation_per_capita.parquet",
     "note": ""
    },
    {
     "column": "patents",
     "file": "metro_innovation_per_capita.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 71,
   "section": "Negative Demand",
   "module": "Innovation",
   "analysis": "Patents",
   "level": "Metro",
   "metric": "Patent specialization by group",
   "years": "latest 5 years (pooled)",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "level",
     "file": "metro_patent_rca.parquet",
     "note": "section or subclass"
    },
    {
     "column": "class_label",
     "file": "metro_patent_rca.parquet",
     "note": ""
    },
    {
     "column": "patents",
     "file": "metro_patent_rca.parquet",
     "note": ""
    },
    {
     "column": "rca",
     "file": "metro_patent_rca.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 72,
   "section": "Negative Demand",
   "module": "Innovation",
   "analysis": "Publications",
   "level": "Metro",
   "metric": "Publication output against population",
   "years": "2000-2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "Pool publications across most recent 5 years. Compute mean population across the same period.",
   "instruction": "",
   "fields": [
    {
     "column": "population",
     "file": "metro_innovation_per_capita.parquet",
     "note": ""
    },
    {
     "column": "publications",
     "file": "metro_innovation_per_capita.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 73,
   "section": "Negative Demand",
   "module": "Innovation",
   "analysis": "Publications",
   "level": "Metro",
   "metric": "Publication specialization by group",
   "years": "latest 5 years (pooled)",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "level",
     "file": "metro_publication_rca.parquet",
     "note": "broad_field or concept"
    },
    {
     "column": "field_label",
     "file": "metro_publication_rca.parquet",
     "note": ""
    },
    {
     "column": "appearances",
     "file": "metro_publication_rca.parquet",
     "note": ""
    },
    {
     "column": "rca",
     "file": "metro_publication_rca.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 74,
   "section": "Multiple",
   "module": "Complexity",
   "analysis": "ECI Ranking",
   "level": "Metro",
   "metric": "ECI ranking over time",
   "years": "2004, 2009, 2014, 2019, 2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "eci",
     "file": "metro_complexity.parquet",
     "note": ""
    },
    {
     "column": "eci_rank",
     "file": "metro_complexity.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 75,
   "section": "Multiple",
   "module": "Complexity",
   "analysis": "Remoteness",
   "level": "Metro",
   "metric": "ECI vs remoteness",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "remoteness_index",
     "file": "metro_eci_remoteness.parquet",
     "note": ""
    },
    {
     "column": "eci",
     "file": "metro_eci_remoteness.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 76,
   "section": "Multiple",
   "module": "Complexity",
   "analysis": "Rock Song",
   "level": "Metro",
   "metric": "Residual ECI vs COI",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "ECI residual computed from regression of ECI on log population, log wage, and log housing prices",
   "instruction": "",
   "fields": [
    {
     "column": "population",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "wage_nowcast",
     "file": "metro_panel.parquet",
     "note": ""
    },
    {
     "column": "value",
     "file": "metro_housing.parquet",
     "note": ""
    },
    {
     "column": "eci",
     "file": "metro_complexity.parquet",
     "note": ""
    },
    {
     "column": "coi",
     "file": "metro_outlook.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 77,
   "section": "Multiple",
   "module": "Complexity",
   "analysis": "Opportunities",
   "level": "Metro",
   "metric": "Top opportunities in the adjacent possible",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "No",
   "instruction": "RCAs are precomputed here. For consistency you could also compute RCAs here as well, by merging metro_industry_employment and national_industry_employment to get metro and national employment totals. But this reproduces what you will see in 'rca' column so you can also use this column directly.",
   "fields": [
    {
     "column": "industry_code",
     "file": "metro_opportunities.parquet",
     "note": ""
    },
    {
     "column": "industry",
     "file": "metro_opportunities.parquet",
     "note": ""
    },
    {
     "column": "sector_2d",
     "file": "metro_opportunities.parquet",
     "note": ""
    },
    {
     "column": "density",
     "file": "metro_opportunities.parquet",
     "note": ""
    },
    {
     "column": "pci",
     "file": "metro_opportunities.parquet",
     "note": ""
    },
    {
     "column": "rca",
     "file": "metro_opportunities.parquet",
     "note": ""
    },
    {
     "column": "tradability",
     "file": "metro_opportunities.parquet",
     "note": ""
    },
    {
     "column": "coi",
     "file": "metro_opportunities.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 78,
   "section": "Multiple",
   "module": "Admin & Metro Demand",
   "analysis": "Admin vs Metro industry mix",
   "level": "Admin",
   "metric": "Market share of Metro's top tradeable industries over time",
   "years": "2002-2023",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "from LODES place employment by sector and metro employment by sector",
   "instruction": "Annual series of share_of_metro_jobs (= employment / metro_employment) by sector. Tradability is an attribute of NAICS-4/6 industries and does not resolve to the 20 LODES sectors, so \"top tradable industries\" is not available at admin grain; rank sectors by employment or location_quotient instead, or read the metro's tradable market share from derived/metro_industry_market_share with industry_tradability. Note: There are 32 cells where share_of_metro_jobs in place_sector_balance has a value greater than 1 due to LODES noise in small cells, so the charts should cap values above 1.",
   "fields": [
    {
     "column": "share_of_metro_jobs",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "location_quotient",
     "file": "place_sector_balance.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 79,
   "section": "Multiple",
   "module": "Admin & Metro Demand",
   "analysis": "Admin Shift-share",
   "level": "Admin",
   "metric": "Shift shares for national, industry mix, and local by industry",
   "years": "2014-2023 (one window)",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "LMDI shift-share on jobs located in the admin, by sector, over the window",
   "instruction": "ns = national-share (reference) effect, im = sector-mix effect, ls = local-share effect; ns + im + ls (+ new-sector jobs) = e_r_t1 - e_r_t0. The reference is all places in the bundle summed, since LODES has no place-consistent national total. Only admins observed at both ends of the window are present.",
   "fields": [
    {
     "column": "sector",
     "file": "",
     "note": ""
    },
    {
     "column": "e_r_t0",
     "file": "",
     "note": ""
    },
    {
     "column": "e_r_t1",
     "file": "",
     "note": ""
    },
    {
     "column": "ns",
     "file": "",
     "note": ""
    },
    {
     "column": "im",
     "file": "",
     "note": ""
    },
    {
     "column": "ls",
     "file": "",
     "note": ""
    },
    {
     "column": "is_new",
     "file": "",
     "note": "totals: ns_total, im_total, ls_total, new_sectors_total"
    }
   ]
  },
  {
   "row": 80,
   "section": "Multiple",
   "module": "Admin & Metro Demand",
   "analysis": "Commute net flows",
   "level": "Admin",
   "metric": "Change in commute net flows by industry",
   "years": "2003-2023 (annual change)",
   "type": "series, annual",
   "status": "Done",
   "compute": true,
   "calculation": "net_jobs_change = net_jobs - net_jobs of the previous year",
   "instruction": "Filter to the admin and the latest year; net_jobs_change is the year-on-year change in the net import of workers by sector. Null where the previous year is missing for the admin (e.g. LODES gaps).",
   "fields": [
    {
     "column": "net_jobs",
     "file": "place_sector_balance.parquet",
     "note": ""
    },
    {
     "column": "net_jobs_change",
     "file": "place_sector_balance.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 81,
   "section": "Multiple",
   "module": "Housing",
   "analysis": "Housing prices",
   "level": "Admin",
   "metric": "Housing prices over time",
   "years": "2014-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "value",
     "file": "place_housing.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 82,
   "section": "Multiple",
   "module": "Housing",
   "analysis": "Housing prices",
   "level": "Metro",
   "metric": "Housing prices over time",
   "years": "2014-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "value",
     "file": "metro_housing.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 83,
   "section": "Multiple",
   "module": "Housing",
   "analysis": "Real wages",
   "level": "Admin",
   "metric": "real wages over time",
   "years": "2013-2023",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "real_wage",
     "file": "place_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 84,
   "section": "Multiple",
   "module": "Housing",
   "analysis": "Real wages",
   "level": "Metro",
   "metric": "real wages over time",
   "years": "2013-2023",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "real_wage",
     "file": "metro_panel.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 85,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Overall revealed amenities",
   "level": "Admin; Metro",
   "metric": "Amenity score (residual) based on wages and housing prices",
   "years": "2024",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "residual",
     "file": "",
     "note": ""
    },
    {
     "column": "residual_pct",
     "file": "",
     "note": ""
    },
    {
     "column": "residual_delta",
     "file": "",
     "note": ""
    }
   ]
  },
  {
   "row": 86,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Education Quality",
   "level": "Admin",
   "metric": "Education index - place vs metro, both relative to national",
   "years": "2010-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "grade_level",
     "file": "place_education.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 87,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Education Quality",
   "level": "Metro",
   "metric": "Education index - place vs metro, both relative to national",
   "years": "2010-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "grade_level",
     "file": "metro_education.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 88,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Crime",
   "level": "Admin",
   "metric": "Crime index - place vs metro, both relative to national",
   "years": "2010-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "severity_pc_ratio_s3",
     "file": "place_crime.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 89,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Crime",
   "level": "Metro",
   "metric": "Crime index - place vs metro, both relative to national",
   "years": "2010-2024",
   "type": "series, annual",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "severity_pc_ratio_s3",
     "file": "metro_crime.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 90,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Job Accessibility",
   "level": "Admin",
   "metric": "Isochrone x number of jobs accessible; rank in metro; rank nationally",
   "years": "2023",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "isochrone",
     "file": "place_job_accessibility_values.parquet",
     "note": ""
    },
    {
     "column": "total_employment",
     "file": "place_job_accessibility_values.parquet",
     "note": ""
    },
    {
     "column": "total_employment_rank_city",
     "file": "place_job_accessibility_values.parquet",
     "note": ""
    },
    {
     "column": "total_employment_rank_national",
     "file": "place_job_accessibility_values.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 91,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Job Accessibility",
   "level": "Admin",
   "metric": "Isochrone boundaries",
   "years": "2026",
   "type": "point",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "isochrone",
     "file": "place_job_accessibility_isochrones.parquet",
     "note": ""
    },
    {
     "column": "geometry",
     "file": "place_job_accessibility_isochrones.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 92,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Non-fast food restaurants",
   "level": "Admin",
   "metric": "Number per 1,000, relative to national",
   "years": "2026",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from features dataset and merged with population series",
   "instruction": "Merge with most recent population estimate; construct count per 1,000 people; construct ratio with national (totals across all places)",
   "fields": [
    {
     "column": "restaurant_count",
     "file": "place_features.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 93,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Daily Needs",
   "level": "Admin",
   "metric": "Number per 1,000, relative to national",
   "years": "2026",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from features dataset and merged with population series",
   "instruction": "Merge with most recent population estimate; construct count per 1,000 people; construct ratio with national (totals across all places)",
   "fields": [
    {
     "column": "daily_needs_count",
     "file": "place_features.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 94,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Arts and Culture",
   "level": "Admin",
   "metric": "Number per 1,000, relative to national",
   "years": "2026",
   "type": "point",
   "status": "Done",
   "compute": true,
   "calculation": "from features dataset and merged with population series",
   "instruction": "Merge with most recent population estimate; construct count per 1,000 people; construct ratio with national (totals across all places)",
   "fields": [
    {
     "column": "culture_count",
     "file": "place_features.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 95,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Air Quality",
   "level": "Admin",
   "metric": "Air quality index - place vs metro",
   "years": "2010-2025",
   "type": "series, monthly",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "aqi",
     "file": "place_aqi.parquet",
     "note": ""
    }
   ]
  },
  {
   "row": 96,
   "section": "Multiple",
   "module": "Amenities",
   "analysis": "Air Quality",
   "level": "Metro",
   "metric": "Air quality index - place vs metro",
   "years": "2010-2025",
   "type": "series, monthly",
   "status": "Done",
   "compute": false,
   "calculation": "",
   "instruction": "",
   "fields": [
    {
     "column": "aqi",
     "file": "metro_aqi.parquet",
     "note": ""
    }
   ]
  }
 ]
};
