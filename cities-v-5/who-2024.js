/* Who are you? (2026-10-05): the first four screens of the reference place
   page (cities.taimur.sh/usa/place/boston-ma), as v-5's first section.

   place, metro: the four measures for Boston city (2507000) and the Boston
   MSA (14460) at 2024 (salary: the site's "nowcast", IRS SOI carried
   2023-25), each with its rank and the distribution it is set against:
   every US place (or metro) with a value that year; q = 5th, 25th, 50th,
   75th, 95th percentiles; axis = 2nd and 98th, the strip's ends; log scale
   for population, salary and home value. low: rank 1 is the lowest. Peers
   as the reference matches them, on 2014 values (Boston has no 2014 pay,
   so pay is not in its place match, whatever the reference's note says).

   out, in: LODES 2023 (and 2014 for "then"), from place_commute and
   place_flows: where Boston's residents work and where its workers live,
   the named partners as the reference lists them, and each map's place
   count, largest share and frame. The per-place shares the maps colour by
   are in data/geo/who_commute_geo.js with the outlines.

   Every figure was worked from the reference's parquet by its own rules
   and checked against its rendered page. */
window.WHO_2024 = {
 "place": {
  "name": "Boston",
  "universe": "US places",
  "ind": [
   {
    "key": "population",
    "label": "Population",
    "source": "Census PEP, 2024",
    "value": 673458,
    "display": "673K",
    "rank": 25,
    "of": 9593,
    "low": false,
    "scale": "log",
    "q": [
     151.0,
     746.0,
     2875,
     12392.5,
     78326.5
    ],
    "axis": [
     84.0,
     146131.8
    ],
    "median": "2.9K"
   },
   {
    "key": "salary",
    "label": "Average salary",
    "source": "IRS SOI, carried, 2023\u201325",
    "value": 106267,
    "display": "$106K",
    "rank": 2009,
    "of": 13847,
    "low": false,
    "scale": "log",
    "q": [
     46724.9,
     58507.5,
     69383,
     87870.0,
     156484.1
    ],
    "axis": [
     41671.84,
     219044.72
    ],
    "median": "$69K"
   },
   {
    "key": "home_value",
    "label": "Home value",
    "source": "Zillow ZHVI, 2024",
    "value": 972529,
    "display": "$973K",
    "rank": 765,
    "of": 15998,
    "low": false,
    "scale": "log",
    "q": [
     137124.0,
     228622.5,
     322960.5,
     479681.25,
     950087.4
    ],
    "axis": [
     110366.16,
     1340946.8
    ],
    "median": "$323K"
   },
   {
    "key": "unemployment",
    "label": "Unemployment",
    "source": "BLS LAUS, 2024",
    "value": 3.8,
    "display": "3.8%",
    "rank": 691,
    "of": 1606,
    "low": true,
    "scale": "linear",
    "q": [
     2.6,
     3.3,
     3.9,
     4.6,
     6.575
    ],
    "axis": [
     2.3,
     8.29
    ],
    "median": "3.9%"
   }
  ],
  "peers": [
   "Washington, DC",
   "Oakland, CA",
   "Long Beach, CA",
   "Cambridge, MA"
  ],
  "peersNote": "Matched on population, density, home value, share of the metro and distance to its core, as of 2014."
 },
 "metro": {
  "name": "Boston MSA",
  "universe": "US metros",
  "ind": [
   {
    "key": "population",
    "label": "MSA population",
    "source": "Census PEP, 2024",
    "value": 5025517.0,
    "display": "5M",
    "rank": 11,
    "of": 387,
    "low": false,
    "scale": "log",
    "q": [
     98873.1,
     149785.5,
     258523.0,
     603179.0,
     2923370.1
    ],
    "axis": [
     80917.6,
     6353025.56
    ],
    "median": "259K"
   },
   {
    "key": "salary",
    "label": "Average salary",
    "source": "IRS SOI, carried, 2023\u201325",
    "value": 114779,
    "display": "$115K",
    "rank": 5,
    "of": 382,
    "low": false,
    "scale": "log",
    "q": [
     54254.9,
     60840.0,
     67569.5,
     75707.25,
     92256.45
    ],
    "axis": [
     50952.74,
     106197.7
    ],
    "median": "$68K"
   },
   {
    "key": "home_value",
    "label": "Home value",
    "source": "Zillow ZHVI, 2024",
    "value": 717120,
    "display": "$717K",
    "rank": 17,
    "of": 380,
    "low": false,
    "scale": "log",
    "q": [
     163032.6,
     225056.25,
     294764.0,
     399090.75,
     678146.85
    ],
    "axis": [
     145489.98,
     909935.58
    ],
    "median": "$295K"
   },
   {
    "key": "unemployment",
    "label": "Unemployment",
    "source": "BLS LAUS, 2024",
    "value": 3.7,
    "display": "3.7%",
    "rank": 163,
    "of": 387,
    "low": true,
    "scale": "linear",
    "q": [
     2.6,
     3.3,
     3.8,
     4.4,
     5.87
    ],
    "axis": [
     2.4,
     7.8
    ],
    "median": "3.8%"
   }
  ],
  "peers": [
   "Washington",
   "Seattle",
   "San Diego",
   "Denver"
  ],
  "peersNote": "Matched on population, density, pay and home value, as of 2014."
 },
 "out": {
  "year": 2023,
  "residentWorkers": 347517,
  "workInBoston": 190083,
  "workElsewhere": 157434,
  "shareLabel": "55%",
  "thenLabel": "54%",
  "thenYear": 2014,
  "outside": 27528,
  "outsideLabel": "8%",
  "top": [
   {
    "id": "2511000",
    "name": "Cambridge",
    "workers": 24509,
    "share": "7.1%",
    "centroid": [
     42.37641,
     -71.11931
    ]
   },
   {
    "id": "2545560",
    "name": "Newton",
    "workers": 8306,
    "share": "2.4%",
    "centroid": [
     42.33138,
     -71.20851
    ]
   },
   {
    "id": "2572600",
    "name": "Waltham",
    "workers": 7221,
    "share": "2.1%",
    "centroid": [
     42.38911,
     -71.24228
    ]
   },
   {
    "id": "2555745",
    "name": "Quincy",
    "workers": 6015,
    "share": "1.7%",
    "centroid": [
     42.24994,
     -71.0198
    ]
   }
  ],
  "upTo": {
   "name": "Brookline",
   "label": "26%"
  },
  "legend": "Share of each place's jobs held by Boston residents",
  "places": 100,
  "maxShare": 0.264562,
  "bounds": [
   [
    42.20429,
    -71.28603
   ],
   [
    42.42444,
    -70.9226
   ]
  ]
 },
 "in": {
  "year": 2023,
  "jobsHere": 718571,
  "heldByResidents": 190083,
  "filledByCommuters": 528488,
  "shareLabel": "26%",
  "per100": 207,
  "outside": 132148,
  "outsideLabel": "18%",
  "top": [
   {
    "id": "2555745",
    "name": "Quincy",
    "workers": 20328,
    "share": "2.8%",
    "centroid": [
     42.24994,
     -71.0198
    ]
   },
   {
    "id": "2511000",
    "name": "Cambridge",
    "workers": 20085,
    "share": "2.8%",
    "centroid": [
     42.37641,
     -71.11931
    ]
   },
   {
    "id": "2562535",
    "name": "Somerville",
    "workers": 16040,
    "share": "2.2%",
    "centroid": [
     42.39064,
     -71.10083
    ]
   },
   {
    "id": "2509210",
    "name": "Brookline",
    "workers": 14544,
    "share": "2.0%",
    "centroid": [
     42.3242,
     -71.14069
    ]
   },
   {
    "id": "2545560",
    "name": "Newton",
    "workers": 14322,
    "share": "2.0%",
    "centroid": [
     42.33138,
     -71.20851
    ]
   }
  ],
  "sendsMost": {
   "name": "Winthrop Town",
   "label": "41%"
  },
  "legend": "Share of each place's employed residents who work in Boston",
  "places": 259,
  "maxShare": 0.482885,
  "bounds": [
   [
    42.20429,
    -71.26996
   ],
   [
    42.41813,
    -70.9226
   ]
  ]
 },
 "boston": {
  "centroid": [
   42.31709,
   -71.09177
  ],
  "bounds": [
   [
    42.22791,
    -71.1909
   ],
   [
    42.3974,
    -70.9226
   ]
  ]
 }
};
