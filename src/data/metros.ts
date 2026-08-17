/** REAL metro data for the pizza chart, extracted from the cities-v-2 app
 *  (cities.taimur.sh, the "How is the metro performing?" chart):
 *
 *    source   /data/city_panel.parquet (USA metros) + place_panel.parquet
 *    measure  population CAGR × average-wage CAGR
 *    window   PINNED 2017 → 2022, both endpoints required
 *    checked  against the live page for Boston: pop +0.4%/yr (median +0.5%),
 *             wages +5.3%/yr (median +4.5%) — matches.
 *
 *  Every USA metro with both series at both endpoints (n = 375).
 *
 *  THE WINDOW IS PINNED ON PURPOSE. Pay data ends at 2022 while population
 *  and home values run to 2023+, so a "first→last valid year per series"
 *  rule silently measures pay over 2017–2022 and population over 2017–2023.
 *  Every series and every threshold in this file — including the home-value
 *  median the supply fork tests against — has to share one window, or a
 *  fork compares a 2022-window benchmark against a 2023-window city value
 *  and flips on the mismatch rather than on the city. Extending to 2023 for
 *  population and housing is defensible, but only if the paired medians are
 *  recomputed on that window too (see METRO_MEDIAN_ZHVI below). */

/** The one window every series and threshold in this file is measured on.
 *  Anything added here — a new indicator, a new sample city, a new median —
 *  must be computed on THIS window, or recomputed everywhere together. */
export const DATA_WINDOW = { from: 2017, to: 2022 } as const;
export const DATA_WINDOW_LABEL = `${DATA_WINDOW.from}–${DATA_WINDOW.to}`;

export interface MetroDatum {
  name: string;
  /** population growth, CAGR %/yr */
  pop: number;
  /** average-wage growth, CAGR %/yr */
  wage: number;
  /** home-value growth (metro ZHVI CAGR %/yr), same pinned window. Source:
   *  the cities-explainer reference bundle, whose metro table is THIS table
   *  (name/pop/wage/size match on all 375 rows) plus this series;
   *  spot-checked against METRO_HOUSING below (Boston 7.12 ✓ San Jose
   *  10.28 ✓). Metro-level CONTEXT only — the tree sorts cities, so no fork
   *  ever tests this series; it is kept because it is the paired-window
   *  metro reading. (The median across these 375 is 8.86; METRO_MEDIAN_ZHVI,
   *  8.83, stays the one quoted benchmark.) */
  home: number;
  /** latest population (dot sizing) */
  size: number;
}

export const METROS: MetroDatum[] = [
  { name: "New York", pop: 0.39, wage: 4.4, home: 5.87, size: 20385354 },
  { name: "Los Angeles", pop: -0.57, wage: 5.09, home: 9, size: 12906936 },
  { name: "Chicago", pop: -0.08, wage: 4.91, home: 5.85, size: 9477937 },
  { name: "Dallas", pop: 1.69, wage: 5.07, home: 10.42, size: 8049709 },
  { name: "Houston", pop: 1.34, wage: 3.37, home: 8.27, size: 7374669 },
  { name: "Washington", pop: 0.59, wage: 4.39, home: 6.09, size: 6384462 },
  { name: "Philadelphia", pop: 0.56, wage: 4.5, home: 7.44, size: 6252024 },
  { name: "Atlanta", pop: 1.21, wage: 4.77, home: 12.16, size: 6237796 },
  { name: "Miami", pop: 0.3, wage: 6.42, home: 10.39, size: 6211194 },
  { name: "Phoenix", pop: 1.11, wage: 5.15, home: 13.75, size: 5029933 },
  { name: "Boston", pop: 0.37, wage: 5.27, home: 7.12, size: 4931775 },
  { name: "Riverside", pop: 0.48, wage: 4.74, home: 11.12, size: 4675657 },
  { name: "San Francisco", pop: -0.48, wage: 6.84, home: 7.54, size: 4599793 },
  { name: "Detroit", pop: 0.17, wage: 3.83, home: 8.74, size: 4358510 },
  { name: "Seattle", pop: 0.78, wage: 6.75, home: 10.68, size: 4040080 },
  { name: "Minneapolis", pop: 0.67, wage: 4.05, home: 7.31, size: 3711875 },
  { name: "Tampa", pop: 1.25, wage: 5.41, home: 13.14, size: 3306285 },
  { name: "San Diego", pop: -0.23, wage: 5.81, home: 9.41, size: 3283755 },
  { name: "Denver", pop: 0.68, wage: 5.33, home: 9.25, size: 2991705 },
  { name: "Baltimore", pop: 0.34, wage: 4.15, home: 5.63, size: 2846006 },
  { name: "St. Louis", pop: -0.02, wage: 4.65, home: 7.19, size: 2803371 },
  { name: "Orlando", pop: 2.03, wage: 5.33, home: 11.56, size: 2783767 },
  { name: "Charlotte", pop: 1.64, wage: 5.76, home: 12.25, size: 2738919 },
  { name: "San Antonio", pop: 1.48, wage: 4.63, home: 9.19, size: 2660228 },
  { name: "Portland", pop: 0.45, wage: 5.09, home: 7.93, size: 2510302 },
  { name: "Austin", pop: 2.81, wage: 7.54, home: 12.54, size: 2430375 },
  { name: "Sacramento", pop: 0.88, wage: 5.31, home: 9.21, size: 2423591 },
  { name: "Pittsburgh", pop: 0.17, wage: 4.84, home: 6.83, size: 2349227 },
  { name: "Las Vegas", pop: 1.25, wage: 4.89, home: 12.46, size: 2321961 },
  { name: "Cincinnati", pop: 0.61, wage: 4.78, home: 9.16, size: 2247081 },
  { name: "Kansas City", pop: 0.76, wage: 4.78, home: 9.27, size: 2209457 },
  { name: "Columbus", pop: 0.82, wage: 4.9, home: 10.06, size: 2168930 },
  { name: "Indianapolis", pop: 1.17, wage: 5.01, home: 11.15, size: 2148512 },
  { name: "Nashville", pop: 1.81, wage: 5.88, home: 11.2, size: 2077922 },
  { name: "Cleveland", pop: 0.1, wage: 4.52, home: 8.07, size: 2067376 },
  { name: "San Jose", pop: -0.42, wage: 6.72, home: 10.28, size: 1951368 },
  { name: "Virginia Beach", pop: 0.5, wage: 4.42, home: 6.5, size: 1768300 },
  { name: "Jacksonville", pop: 2.24, wage: 5.19, home: 12.02, size: 1681346 },
  { name: "Providence", pop: 0.78, wage: 4.38, home: 8.67, size: 1680699 },
  { name: "Milwaukee", pop: -0.13, wage: 4.37, home: 7.17, size: 1564152 },
  { name: "Raleigh", pop: 2.14, wage: 5.92, home: 10.96, size: 1483195 },
  { name: "Oklahoma City", pop: 1.15, wage: 3.71, home: 7.91, size: 1462926 },
  { name: "Richmond", pop: 1.08, wage: 5.03, home: 8.31, size: 1364579 },
  { name: "Memphis", pop: -0.08, wage: 4.16, home: 11.45, size: 1341175 },
  { name: "Louisville", pop: 0.45, wage: 4.31, home: 8.04, size: 1321483 },
  { name: "Salt Lake City", pop: 1.11, wage: 5.33, home: 12.53, size: 1272236 },
  { name: "New Orleans", pop: -0.34, wage: 4.24, home: 5.21, size: 1249156 },
  { name: "Birmingham", pop: 0.55, wage: 4.42, home: 9.15, size: 1181300 },
  { name: "Buffalo", pop: 0.51, wage: 4.48, home: 9.19, size: 1159211 },
  { name: "Grand Rapids", pop: 0.59, wage: 4.4, home: 9.83, size: 1091750 },
  { name: "Rochester", pop: 0.16, wage: 4.39, home: 7.58, size: 1080350 },
  { name: "Tucson", pop: 0.64, wage: 4.56, home: 11.57, size: 1059412 },
  { name: "Tulsa", pop: 0.89, wage: 3.54, home: 8.45, size: 1036199 },
  { name: "Fresno", pop: 0.64, wage: 4.64, home: 10.2, size: 1017107 },
  { name: "Urban Honolulu", pop: 0.19, wage: 4.32, home: 6.56, size: 995652 },
  { name: "Omaha", pop: 0.98, wage: 4.85, home: 8.89, size: 978390 },
  { name: "Greenville", pop: 1.43, wage: 4.4, home: 9.87, size: 961030 },
  { name: "Knoxville", pop: 1.26, wage: 5.18, home: 12, size: 933626 },
  { name: "Albuquerque", pop: 0.17, wage: 4.58, home: 10.27, size: 920200 },
  { name: "Bakersfield", pop: 0.67, wage: 3.73, home: 10.09, size: 917293 },
  { name: "Albany", pop: 0.5, wage: 4.75, home: 6.83, size: 904216 },
  { name: "North Port", pop: 2.13, wage: 6.14, home: 11.9, size: 894767 },
  { name: "McAllen", pop: 0.77, wage: 4.81, home: 9.83, size: 889799 },
  { name: "El Paso", pop: 0.71, wage: 4.91, home: 7.71, size: 872344 },
  { name: "Allentown", pop: 0.79, wage: 4.0, home: 8.45, size: 871414 },
  { name: "Worcester", pop: -1.68, wage: 4.94, home: 8.65, size: 865735 },
  { name: "Baton Rouge", pop: 0.51, wage: 3.61, home: 4.62, size: 853104 },
  { name: "Columbia", pop: 0.56, wage: 3.98, home: 9.15, size: 848473 },
  { name: "Oxnard", pop: -0.33, wage: 4.6, home: 7.46, size: 835032 },
  { name: "Charleston", pop: 1.4, wage: 5.87, home: 9.44, size: 831230 },
  { name: "Cape Coral", pop: 2.24, wage: 5.54, home: 11.47, size: 826567 },
  { name: "Boise City", pop: 2.78, wage: 5.45, home: 16.97, size: 814129 },
  { name: "Stockton", pop: 1.38, wage: 5.85, home: 10.19, size: 795880 },
  { name: "Lakeland", pop: 2.9, wage: 4.75, home: 13.48, size: 790530 },
  { name: "Greensboro", pop: 0.61, wage: 4.41, home: 10.23, size: 785413 },
  { name: "Colorado Springs", pop: 1.15, wage: 4.92, home: 11.18, size: 767534 },
  { name: "Little Rock", pop: 0.56, wage: 4.21, home: 6.16, size: 758380 },
  { name: "Provo", pop: 3.02, wage: 6.0, home: 12.91, size: 717339 },
  { name: "Ogden", pop: 1.48, wage: 5.16, home: 13.76, size: 714697 },
  { name: "Deltona", pop: 1.78, wage: 5.62, home: 12.51, size: 707455 },
  { name: "Akron", pop: -0.16, wage: 4.39, home: 8.01, size: 698506 },
  { name: "Des Moines", pop: 1.42, wage: 4.37, home: 6.53, size: 691487 },
  { name: "Madison", pop: 1.04, wage: 5.23, home: 7.44, size: 690029 },
  { name: "Winston", pop: 0.65, wage: 3.99, home: 10.2, size: 688725 },
  { name: "Wichita", pop: 0.38, wage: 3.92, home: 8.27, size: 657030 },
  { name: "Syracuse", pop: 0.14, wage: 4.3, home: 7.88, size: 655604 },
  { name: "Palm Bay", pop: 1.46, wage: 5.16, home: 12.07, size: 631956 },
  { name: "Springfield", pop: -0.06, wage: 3.95, home: 7.51, size: 626837 },
  { name: "Augusta", pop: 0.8, wage: 3.92, home: 9.99, size: 624645 },
  { name: "Spokane", pop: 1.67, wage: 4.95, home: 14.58, size: 612261 },
  { name: "Harrisburg", pop: 1.14, wage: 4.29, home: 6.96, size: 604003 },
  { name: "Fayetteville", pop: 2.26, wage: 4.9, home: 11.25, size: 601990 },
  { name: "Durham", pop: 1.22, wage: 5.84, home: 11.33, size: 601788 },
  { name: "Toledo", pop: -0.09, wage: 4.29, home: 7.76, size: 601058 },
  { name: "Chattanooga", pop: 0.7, wage: 4.93, home: 10.33, size: 575746 },
  { name: "Scranton", pop: 0.47, wage: 4.22, home: 8.37, size: 568723 },
  { name: "Jackson", pop: -0.54, wage: 4.38, home: 6.97, size: 565934 },
  { name: "Portland", pop: 1.17, wage: 5.59, home: 10.52, size: 563795 },
  { name: "Lancaster", pop: 0.57, wage: 4.63, home: 7.87, size: 556991 },
  { name: "Modesto", pop: 0.28, wage: 4.73, home: 10.2, size: 552410 },
  { name: "Myrtle Beach", pop: 2.96, wage: 6.06, home: 11.05, size: 536208 },
  { name: "Youngstown", pop: -0.21, wage: 4.46, home: 8.86, size: 535935 },
  { name: "Pensacola", pop: 1.41, wage: 5.34, home: 12.2, size: 522590 },
  { name: "Port St. Lucie", pop: 2.01, wage: 4.96, home: 12.89, size: 522261 },
  { name: "Lexington", pop: 0.28, wage: 4.43, home: 8.38, size: 519557 },
  { name: "Huntsville", pop: 2.47, wage: 4.76, home: 11.45, size: 515081 },
  { name: "Reno", pop: 1.68, wage: 6.65, home: 11.43, size: 500623 },
  { name: "Killeen", pop: 2.24, wage: 4.89, home: 11.76, size: 494841 },
  { name: "Springfield", pop: 1.06, wage: 4.8, home: 11.04, size: 487114 },
  { name: "Santa Rosa", pop: -0.77, wage: 5.51, home: 5.63, size: 483398 },
  { name: "Lafayette", pop: -0.36, wage: 3.43, home: 2.21, size: 481519 },
  { name: "Visalia", pop: 0.68, wage: 4.31, home: 9.93, size: 478288 },
  { name: "Asheville", pop: 0.95, wage: 5.78, home: 10.02, size: 476955 },
  { name: "Lansing", pop: -0.28, wage: 4.07, home: 8.13, size: 473375 },
  { name: "York", pop: 0.7, wage: 4.09, home: 7.61, size: 461385 },
  { name: "Fort Wayne", pop: 0.98, wage: 4.71, home: 10.19, size: 455058 },
  { name: "Vallejo", pop: 0.28, wage: 4.82, home: 8.45, size: 449724 },
  { name: "Corpus Christi", pop: -0.31, wage: 3.91, home: 6, size: 446869 },
  { name: "Santa Maria", pop: -0.0, wage: 5.28, home: 9.22, size: 445286 },
  { name: "Salisbury", pop: 1.72, wage: 5.46, home: 8.97, size: 440175 },
  { name: "Salem", pop: 0.7, wage: 4.69, home: 11.08, size: 439374 },
  { name: "Salinas", pop: 0.09, wage: 5.0, home: 9.13, size: 436427 },
  { name: "Reading", pop: 0.7, wage: 3.89, home: 8.46, size: 432281 },
  { name: "Manchester", pop: 0.63, wage: 5.31, home: 9.61, size: 426307 },
  { name: "Brownsville", pop: 0.17, wage: 4.98, home: 7.71, size: 425819 },
  { name: "Shreveport", pop: -0.86, wage: 4.37, home: 2.77, size: 420951 },
  { name: "Savannah", pop: 1.63, wage: 4.9, home: 9.62, size: 418858 },
  { name: "Mobile", pop: -0.13, wage: 4.05, home: 8.58, size: 411291 },
  { name: "Beaumont", pop: -0.24, wage: 3.5, home: 6.43, size: 407115 },
  { name: "Gulfport", pop: 0.41, wage: 4.26, home: 8.12, size: 402237 },
  { name: "Flint", pop: -0.27, wage: 4.04, home: 11.3, size: 402031 },
  { name: "Anchorage", pop: 0.02, wage: 3.47, home: 4.18, size: 401025 },
  { name: "Naples", pop: 1.45, wage: 7.08, home: 11.01, size: 400510 },
  { name: "Canton", pop: 0.02, wage: 4.39, home: 7.85, size: 399685 },
  { name: "Ocala", pop: 2.34, wage: 5.48, home: 13.62, size: 396661 },
  { name: "Fayetteville", pop: 0.4, wage: 4.3, home: 8.8, size: 392827 },
  { name: "Tallahassee", pop: 0.45, wage: 4.32, home: 8.64, size: 391819 },
  { name: "Eugene", pop: 0.58, wage: 4.72, home: 10.69, size: 386187 },
  { name: "Montgomery", pop: 0.61, wage: 3.97, home: 6.57, size: 385634 },
  { name: "Trenton", pop: 0.75, wage: 3.84, home: 7.25, size: 382165 },
  { name: "Davenport", pop: -0.06, wage: 4.33, home: 5, size: 379876 },
  { name: "Spartanburg", pop: 2.24, wage: 4.15, home: 11.25, size: 373242 },
  { name: "Fort Collins", pop: 1.35, wage: 4.75, home: 8.31, size: 368017 },
  { name: "Ann Arbor", pop: -0.05, wage: 4.13, home: 6.36, size: 367947 },
  { name: "Hickory", pop: 0.02, wage: 4.93, home: 11.56, size: 367514 },
  { name: "Peoria", pop: -0.45, wage: 4.09, home: 3.8, size: 363597 },
  { name: "Greeley", pop: 2.77, wage: 4.97, home: 9.57, size: 350610 },
  { name: "Huntington", pop: -0.46, wage: 4.08, home: 5.55, size: 347461 },
  { name: "Lincoln", pop: 0.71, wage: 4.45, home: 7.94, size: 342875 },
  { name: "Kalamazoo", pop: -0.07, wage: 4.17, home: 8.86, size: 337107 },
  { name: "Rockford", pop: -0.18, wage: 3.61, home: 8.48, size: 335165 },
  { name: "Green Bay", pop: 0.69, wage: 4.29, home: 8.91, size: 330902 },
  { name: "Lubbock", pop: 0.75, wage: 4.62, home: 6.52, size: 329085 },
  { name: "Boulder", pop: 0.34, wage: 5.32, home: 8.34, size: 328039 },
  { name: "South Bend", pop: 0.17, wage: 4.85, home: 9.8, size: 324205 },
  { name: "Clarksville", pop: 2.44, wage: 4.87, home: 10.77, size: 321803 },
  { name: "Roanoke", pop: 0.08, wage: 4.49, home: 8.33, size: 314295 },
  { name: "Evansville", pop: -0.04, wage: 3.81, home: 7.79, size: 314150 },
  { name: "Columbus", pop: 0.67, wage: 3.53, home: 8.4, size: 313725 },
  { name: "Kennewick", pop: 1.42, wage: 4.2, home: 11.74, size: 311299 },
  { name: "Kingsport", pop: 0.29, wage: 4.56, home: 9.05, size: 311033 },
  { name: "Gainesville", pop: 1.37, wage: 4.95, home: 9.97, size: 304268 },
  { name: "Wilmington", pop: 0.84, wage: 6.23, home: 10.34, size: 301844 },
  { name: "Crestview", pop: 2.03, wage: 6.33, home: 11.78, size: 300215 },
  { name: "Olympia", pop: 1.28, wage: 5.25, home: 12.16, size: 298645 },
  { name: "Merced", pop: 1.5, wage: 4.85, home: 11.45, size: 292034 },
  { name: "Sioux Falls", pop: 2.17, wage: 5.33, home: 8.94, size: 289496 },
  { name: "Utica", pop: -0.28, wage: 4.58, home: 9.09, size: 288078 },
  { name: "Hagerstown", pop: 1.44, wage: 4.2, home: 8.8, size: 284945 },
  { name: "Waco", pop: 1.04, wage: 5.2, home: 12.38, size: 283212 },
  { name: "San Luis Obispo", pop: 0.0, wage: 5.41, home: 7.7, size: 282535 },
  { name: "Duluth", pop: 0.12, wage: 4.39, home: 8.26, size: 280337 },
  { name: "Fort Smith", pop: -0.24, wage: 4.56, home: 8.1, size: 279070 },
  { name: "College Station", pop: 1.44, wage: 4.41, home: 5.26, size: 278389 },
  { name: "Bremerton", pop: 0.86, wage: 5.7, home: 10.93, size: 277876 },
  { name: "Atlantic City", pop: 0.79, wage: 4.42, home: 10.91, size: 276111 },
  { name: "Cedar Rapids", pop: 0.37, wage: 3.92, home: 6.1, size: 275663 },
  { name: "Tuscaloosa", pop: 2.27, wage: 4.1, home: 7.37, size: 271388 },
  { name: "Amarillo", pop: 0.48, wage: 4.53, home: 7.43, size: 270751 },
  { name: "Erie", pop: -0.33, wage: 4.35, home: 6.33, size: 269112 },
  { name: "Laredo", pop: -0.4, wage: 4.2, home: 5.88, size: 268276 },
  { name: "Santa Cruz", pop: -0.66, wage: 5.71, home: 8.91, size: 265851 },
  { name: "Lynchburg", pop: 0.11, wage: 4.41, home: 7.88, size: 263320 },
  { name: "Fargo", pop: 1.46, wage: 4.73, home: 4.23, size: 259659 },
  { name: "Yakima", pop: 0.53, wage: 4.01, home: 11.7, size: 256566 },
  { name: "Daphne", pop: 3.02, wage: 5.25, home: 10.38, size: 246577 },
  { name: "Appleton", pop: 0.79, wage: 3.87, home: 8.38, size: 245306 },
  { name: "Binghamton", pop: 0.27, wage: 4.37, home: 7.35, size: 245048 },
  { name: "Tyler", pop: 1.29, wage: 4.3, home: 8.9, size: 242249 },
  { name: "Charlottesville", pop: 0.66, wage: 4.98, home: 7.35, size: 240983 },
  { name: "Champaign", pop: -0.18, wage: 4.29, home: 4.5, size: 237981 },
  { name: "Macon", pop: 0.43, wage: 4.17, home: 10.83, size: 233969 },
  { name: "Barnstable Town", pop: 1.72, wage: 6.01, home: 10.1, size: 232571 },
  { name: "Topeka", pop: -0.1, wage: 3.91, home: 8.99, size: 231775 },
  { name: "Bellingham", pop: 0.83, wage: 5.91, home: 11.89, size: 230701 },
  { name: "Rochester", pop: 0.93, wage: 3.86, home: 8.01, size: 228307 },
  { name: "Burlington", pop: 0.84, wage: 5.22, home: 7.66, size: 228290 },
  { name: "Hilton Head Island", pop: 1.17, wage: 6.42, home: 9.84, size: 227920 },
  { name: "Las Cruces", pop: 0.68, wage: 4.29, home: 8.75, size: 223604 },
  { name: "Medford", pop: 0.49, wage: 5.09, home: 8.25, size: 222153 },
  { name: "Lake Havasu City", pop: 1.31, wage: 5.08, home: 13.85, size: 220947 },
  { name: "Longview", pop: 0.24, wage: 4.2, home: 7.59, size: 220757 },
  { name: "Athens", pop: 1.08, wage: 5.2, home: 12.38, size: 220609 },
  { name: "Lafayette", pop: -0.12, wage: 4.06, home: 9.41, size: 218585 },
  { name: "Gainesville", pop: 1.39, wage: 5.04, home: 11.76, size: 213126 },
  { name: "Johnson City", pop: 0.83, wage: 4.85, home: 9.84, size: 210476 },
  { name: "Yuma", pop: 0.0, wage: 4.5, home: 12.39, size: 209538 },
  { name: "Warner Robins", pop: 1.71, wage: 3.74, home: 8.95, size: 208228 },
  { name: "Lake Charles", pop: -0.18, wage: 3.61, home: 0.95, size: 207571 },
  { name: "Chico", pop: -1.94, wage: 5.1, home: 8.67, size: 207384 },
  { name: "Elkhart", pop: 0.29, wage: 4.51, home: 9.56, size: 207161 },
  { name: "Jacksonville", pop: 1.17, wage: 5.46, home: 9.81, size: 206718 },
  { name: "Springfield", pop: -0.27, wage: 3.89, home: 3.16, size: 206559 },
  { name: "Bend", pop: 2.03, wage: 7.16, home: 12.64, size: 206491 },
  { name: "Charleston", pop: -0.93, wage: 4.01, home: 5.03, size: 204643 },
  { name: "Punta Gorda", pop: 2.27, wage: 6.76, home: 13.31, size: 203113 },
  { name: "St. Cloud", pop: 0.37, wage: 4.19, home: 8.18, size: 202126 },
  { name: "Panama City", pop: 0.02, wage: 5.43, home: 12.41, size: 201034 },
  { name: "Houma", pop: -0.93, wage: 3.53, home: 0.59, size: 200359 },
  { name: "Florence", pop: -0.61, wage: 4.16, home: 7.65, size: 199294 },
  { name: "St. George", pop: 3.59, wage: 5.72, home: 14.22, size: 197898 },
  { name: "Racine", pop: 0.09, wage: 4.11, home: 8.82, size: 196710 },
  { name: "Saginaw", pop: -0.37, wage: 4.24, home: 10.72, size: 188425 },
  { name: "Dover", pop: 1.25, wage: 4.33, home: 8.66, size: 187819 },
  { name: "Columbia", pop: 1.07, wage: 4.77, home: 8.15, size: 187743 },
  { name: "Bloomington", pop: -0.19, wage: 3.87, home: 4.3, size: 186912 },
  { name: "Bowling Green", pop: 1.27, wage: 4.12, home: 8.9, size: 186420 },
  { name: "Joplin", pop: 0.65, wage: 4.0, home: 10.02, size: 184076 },
  { name: "Coeur d'Alene", pop: 3.13, wage: 6.13, home: 16.57, size: 183540 },
  { name: "Yuba City", pop: 1.16, wage: 5.19, home: 10.79, size: 183017 },
  { name: "Kingston", pop: 0.41, wage: 5.93, home: 11.51, size: 182357 },
  { name: "Billings", pop: 1.27, wage: 4.34, home: 8.51, size: 181896 },
  { name: "Blacksburg", pop: -0.11, wage: 4.76, home: 8.1, size: 181397 },
  { name: "Auburn", pop: 2.32, wage: 5.04, home: 7.73, size: 181044 },
  { name: "Redding", pop: 0.18, wage: 5.0, home: 8.97, size: 180972 },
  { name: "Abilene", pop: 1.11, wage: 5.03, home: 7.4, size: 180072 },
  { name: "El Centro", pop: -0.21, wage: 4.62, home: 8.09, size: 179767 },
  { name: "Iowa City", pop: 0.9, wage: 4.43, home: 5.19, size: 179356 },
  { name: "Monroe", pop: 0.03, wage: 3.23, home: 3.59, size: 178503 },
  { name: "Midland", pop: 0.82, wage: 4.01, home: 5.7, size: 177931 },
  { name: "Greenville", pop: -0.17, wage: 4.57, home: 9.79, size: 177090 },
  { name: "Burlington", pop: 1.57, wage: 4.8, home: 10.77, size: 176544 },
  { name: "Muskegon", pop: 0.22, wage: 3.79, home: 12.21, size: 175526 },
  { name: "Sioux City", pop: 0.82, wage: 4.04, home: 7.46, size: 175246 },
  { name: "Eau Claire", pop: 0.74, wage: 4.43, home: 9.01, size: 173610 },
  { name: "Oshkosh", pop: 0.08, wage: 3.7, home: 8.23, size: 171049 },
  { name: "Pueblo", pop: 0.38, wage: 4.26, home: 13.81, size: 169485 },
  { name: "Terre Haute", pop: -0.16, wage: 4.19, home: 8.66, size: 168543 },
  { name: "Waterloo", pop: -0.19, wage: 4.4, home: 5.11, size: 167720 },
  { name: "Sebastian", pop: 1.69, wage: 5.37, home: 11.98, size: 167698 },
  { name: "East Stroudsburg", pop: -0.05, wage: 4.21, home: 13.95, size: 167437 },
  { name: "Idaho Falls", pop: 2.64, wage: 4.86, home: 16.36, size: 165747 },
  { name: "Kahului", pop: -0.2, wage: 4.3, home: 10.2, size: 164560 },
  { name: "Janesville", pop: 0.22, wage: 4.66, home: 9.2, size: 163959 },
  { name: "Bloomington", pop: -0.57, wage: 4.79, home: 9.71, size: 162733 },
  { name: "Homosassa Springs", pop: 2.26, wage: 4.87, home: 14.12, size: 162586 },
  { name: "Odessa", pop: 0.57, wage: 3.79, home: 6.12, size: 161480 },
  { name: "Madera", pop: 0.63, wage: 5.18, home: 11.21, size: 160414 },
  { name: "Jackson", pop: 0.16, wage: 3.68, home: 8.74, size: 159828 },
  { name: "Grand Junction", pop: 0.96, wage: 4.39, home: 10.98, size: 158585 },
  { name: "State College", pop: -0.54, wage: 3.9, home: 6.14, size: 157992 },
  { name: "Decatur", pop: 0.7, wage: 4.79, home: 9.14, size: 157400 },
  { name: "Chambersburg", pop: 0.34, wage: 4.33, home: 7.43, size: 157017 },
  { name: "Elizabethtown", pop: 0.86, wage: 4.14, home: 9.16, size: 156969 },
  { name: "Santa Fe", pop: 0.83, wage: 4.85, home: 10.32, size: 155768 },
  { name: "Logan", pop: 2.48, wage: 5.66, home: 14.48, size: 155622 },
  { name: "Hattiesburg", pop: 0.9, wage: 4.65, home: 5.9, size: 155535 },
  { name: "Monroe", pop: 0.79, wage: 3.74, home: 6.48, size: 155412 },
  { name: "Bangor", pop: 0.41, wage: 4.63, home: 10.22, size: 154817 },
  { name: "Rapid City", pop: 0.9, wage: 5.11, home: 10.43, size: 153972 },
  { name: "Florence", pop: 0.89, wage: 4.97, home: 7.88, size: 153926 },
  { name: "Niles", pop: -0.14, wage: 5.29, home: 8.79, size: 153064 },
  { name: "Hanford", pop: 0.41, wage: 4.3, home: 9.5, size: 152776 },
  { name: "Dothan", pop: 0.62, wage: 4.12, home: 6.12, size: 152488 },
  { name: "Vineland", pop: 0.03, wage: 4.08, home: 7.85, size: 151686 },
  { name: "Jefferson City", pop: -0.12, wage: 4.34, home: 8.13, size: 150377 },
  { name: "Valdosta", pop: 0.6, wage: 4.87, home: 9.06, size: 149748 },
  { name: "Wichita Falls", pop: -0.19, wage: 4.47, home: 10.54, size: 149508 },
  { name: "Alexandria", pop: -0.6, wage: 3.65, home: 2.83, size: 148999 },
  { name: "Albany", pop: -0.34, wage: 3.93, home: 9.66, size: 148669 },
  { name: "Winchester", pop: 1.16, wage: 4.38, home: 8.14, size: 146222 },
  { name: "Texarkana", pop: -0.48, wage: 4.19, home: 7.78, size: 145984 },
  { name: "The Villages", pop: 3.01, wage: 6.18, home: 9.73, size: 144978 },
  { name: "Rocky Mount", pop: -0.33, wage: 4.7, home: 10.55, size: 144403 },
  { name: "Flagstaff", pop: 0.47, wage: 4.61, home: 12.22, size: 144326 },
  { name: "Lebanon", pop: 0.63, wage: 4.49, home: 7.69, size: 144003 },
  { name: "Dalton", pop: -0.05, wage: 3.65, home: 10.53, size: 143684 },
  { name: "Sherman", pop: 1.79, wage: 5.45, home: 11.84, size: 143292 },
  { name: "Morgantown", pop: 0.22, wage: 4.3, home: 3.96, size: 141117 },
  { name: "Bismarck", pop: 1.06, wage: 3.64, home: 3.52, size: 139732 },
  { name: "La Crosse", pop: 0.34, wage: 4.45, home: 7.59, size: 139074 },
  { name: "Wausau", pop: 0.4, wage: 4.23, home: 7.08, size: 138175 },
  { name: "Hammond", pop: 0.65, wage: 3.97, home: 4.47, size: 136734 },
  { name: "Wheeling", pop: -0.65, wage: 3.08, home: 5.57, size: 136690 },
  { name: "Harrisonburg", pop: 0.38, wage: 4.35, home: 6.98, size: 136597 },
  { name: "Jonesboro", pop: 0.6, wage: 4.86, home: 7.31, size: 135262 },
  { name: "Springfield", pop: 0.02, wage: 4.12, home: 9.63, size: 134686 },
  { name: "Napa", pop: -0.78, wage: 5.34, home: 6.7, size: 134492 },
  { name: "Battle Creek", pop: -0.11, wage: 3.47, home: 10.31, size: 133475 },
  { name: "Johnstown", pop: -0.23, wage: 4.04, home: 6.43, size: 131432 },
  { name: "Mount Vernon", pop: 0.84, wage: 5.22, home: 11.94, size: 131229 },
  { name: "Jackson", pop: 0.25, wage: 4.6, home: 10.92, size: 130725 },
  { name: "Albany", pop: 0.86, wage: 4.55, home: 12.16, size: 130516 },
  { name: "Pittsfield", pop: 0.5, wage: 4.87, home: 9.06, size: 129551 },
  { name: "Cleveland", pop: 1.03, wage: 4.6, home: 10.97, size: 128613 },
  { name: "Lawton", pop: 0.03, wage: 3.5, home: 5.6, size: 127863 },
  { name: "Staunton", pop: 0.79, wage: 4.72, home: 8.03, size: 126603 },
  { name: "Glens Falls", pop: 0.05, wage: 4.71, home: 7.31, size: 126212 },
  { name: "Sierra Vista", pop: 0.1, wage: 3.76, home: 10.05, size: 125497 },
  { name: "Mansfield", pop: 0.79, wage: 4.32, home: 10.92, size: 125268 },
  { name: "Wenatchee", pop: 0.97, wage: 5.36, home: 11.22, size: 124179 },
  { name: "New Bern", pop: -0.13, wage: 5.02, home: 8.9, size: 123904 },
  { name: "Morristown", pop: 0.7, wage: 4.75, home: 10.73, size: 122002 },
  { name: "Owensboro", pop: 0.51, wage: 4.03, home: 9.27, size: 121528 },
  { name: "Missoula", pop: 0.52, wage: 5.87, home: 12.85, size: 120931 },
  { name: "Altoona", pop: -0.38, wage: 4.51, home: 2.8, size: 120796 },
  { name: "Farmington", pop: -1.02, wage: 2.51, home: 4.61, size: 120580 },
  { name: "San Angelo", pop: 0.25, wage: 4.72, home: 8.56, size: 120550 },
  { name: "Lawrence", pop: -0.04, wage: 4.43, home: 8.36, size: 120053 },
  { name: "St. Joseph", pop: -1.06, wage: 4.04, home: 7.41, size: 119759 },
  { name: "Carbondale", pop: -0.88, wage: 4.4, home: 4.35, size: 119569 },
  { name: "Goldsboro", pop: -0.8, wage: 4.42, home: 6.92, size: 118185 },
  { name: "Sheboygan", pop: 0.48, wage: 3.85, home: 8.49, size: 117860 },
  { name: "Anniston", pop: 0.18, wage: 3.29, home: 7.09, size: 115744 },
  { name: "Watertown", pop: 0.41, wage: 3.99, home: 6.03, size: 115487 },
  { name: "California", pop: 0.44, wage: 3.67, home: 5.86, size: 115001 },
  { name: "Brunswick", pop: -0.52, wage: 5.05, home: 10.58, size: 114588 },
  { name: "Weirton", pop: -0.65, wage: 4.03, home: 8.17, size: 114290 },
  { name: "Lewiston", pop: 1.1, wage: 5.01, home: 11.79, size: 113454 },
  { name: "Williamsport", pop: -0.14, wage: 4.28, home: 5.18, size: 113223 },
  { name: "Beckley", pop: -1.1, wage: 4.64, home: 7.04, size: 112274 },
  { name: "Muncie", pop: -0.54, wage: 4.37, home: 9.66, size: 112183 },
  { name: "Longview", pop: 0.96, wage: 5.43, home: 12.08, size: 112058 },
  { name: "Michigan City", pop: 0.36, wage: 4.86, home: 9.48, size: 111810 },
  { name: "Kankakee", pop: -0.79, wage: 4.19, home: 6.78, size: 106221 },
  { name: "Gettysburg", pop: 0.66, wage: 4.32, home: 6.54, size: 106017 },
  { name: "Sebring", pop: 0.4, wage: 5.08, home: 13.14, size: 105954 },
  { name: "Ithaca", pop: 0.61, wage: 4.22, home: 6.12, size: 105827 },
  { name: "Sumter", pop: -0.45, wage: 4.28, home: 7.64, size: 104068 },
  { name: "Mankato", pop: 0.61, wage: 4.26, home: 7.12, size: 104062 },
  { name: "Fond du Lac", pop: 0.31, wage: 4.24, home: 8.55, size: 104010 },
  { name: "Grand Forks", pop: 0.14, wage: 4.08, home: 3.22, size: 102863 },
  { name: "Gadsden", pop: -0.04, wage: 4.28, home: 9.28, size: 102821 },
  { name: "Bay City", pop: -0.25, wage: 4.05, home: 8.53, size: 102754 },
  { name: "Decatur", pop: -0.78, wage: 4.23, home: 4.4, size: 101369 },
  { name: "Lima", pop: -0.39, wage: 4.15, home: 8.83, size: 101086 },
  { name: "Cheyenne", pop: 0.5, wage: 4.07, home: 6.54, size: 100860 },
  { name: "Ames", pop: 0.55, wage: 4.12, home: 5.36, size: 99995 },
  { name: "Hot Springs", pop: 0.33, wage: 4.18, home: 10.65, size: 99942 },
  { name: "Rome", pop: 0.42, wage: 4.68, home: 12.75, size: 99586 },
  { name: "Dubuque", pop: 0.34, wage: 4.87, home: 6.62, size: 98748 },
  { name: "Cape Girardeau", pop: 0.31, wage: 4.43, home: 7.09, size: 98309 },
  { name: "Victoria", pop: -0.27, wage: 3.6, home: 6.51, size: 98272 },
  { name: "Manhattan", pop: 0.01, wage: 4.28, home: 4.79, size: 97949 },
  { name: "Corvallis", pop: 1.19, wage: 4.11, home: 9.12, size: 97406 },
  { name: "Fairbanks", pop: -0.8, wage: 3.67, home: 4.29, size: 95749 },
  { name: "Ocean City", pop: 0.49, wage: 5.68, home: 11.03, size: 95415 },
  { name: "Cumberland", pop: -0.92, wage: 3.93, home: 7.21, size: 94113 },
  { name: "Pocatello", pop: 1.01, wage: 4.46, home: 15.35, size: 89871 },
  { name: "Parkersburg", pop: -0.53, wage: 4.22, home: 6.72, size: 88459 },
  { name: "Grants Pass", pop: 0.28, wage: 4.71, home: 9.23, size: 87786 },
  { name: "Hinesville", pop: 1.46, wage: 4.06, home: 9.63, size: 86440 },
  { name: "Grand Island", pop: 0.31, wage: 5.01, home: 8.28, size: 85961 },
  { name: "Great Falls", pop: 0.79, wage: 4.6, home: 9.05, size: 84908 },
  { name: "Pine Bluff", pop: -1.39, wage: 4.12, home: 6.08, size: 84726 },
  { name: "Midland", pop: 0.11, wage: -1.5, home: 8.2, size: 83761 },
  { name: "Columbus", pop: 0.37, wage: 3.89, home: 8.57, size: 83746 },
  { name: "Kokomo", pop: 0.33, wage: 3.56, home: 9.47, size: 83574 },
  { name: "Bloomsburg", pop: -0.09, wage: 3.66, home: 5.37, size: 83469 },
  { name: "Elmira", pop: -0.75, wage: 4.18, home: 6.73, size: 81598 },
  { name: "Casper", pop: -0.01, wage: 3.48, home: 5.48, size: 79565 },
  { name: "Danville", pop: -1.49, wage: 4.19, home: 3.64, size: 72089 },
  { name: "Walla Walla", pop: 0.49, wage: 4.47, home: 11.48, size: 66103 },
  { name: "Lewiston", pop: 0.85, wage: 4.52, home: 10.96, size: 65500 },
  { name: "Carson City", pop: 1.27, wage: 5.5, home: 11.2, size: 58094 },
];

/** The sample cities from the city picker, at both geographies — one per
 *  leaf of the alt diagnostic tree. City-proper values come from
 *  place_panel.parquet (Memphis 4748000, San Antonio 4865000, San Jose
 *  0668000, Boston 2507000), same window and rule as the metros. */
export const US_SAMPLE_CITIES: readonly string[] = [
  "Memphis",
  "San Antonio",
  "San Jose",
  "Boston",
];
/* home here is the PLACE ZHVI figure (same values as PLACE_HOUSING below) */
const HOME_PLACES: Record<string, MetroDatum> = {
  Memphis: { name: "Memphis", pop: -1.02, wage: 4.3, home: 12.37, size: 618468 },
  "San Antonio": { name: "San Antonio", pop: -0.47, wage: 4.37, home: 8.89, size: 1475931 },
  "San Jose": { name: "San Jose", pop: -1.07, wage: 7.37, home: 10.62, size: 978451 },
  Boston: { name: "Boston", pop: -0.82, wage: 5.82, home: 3.63, size: 660080 },
};

/* ---------- home values (Zillow ZHVI), for the supply sub-fork ----------
 *  source   /data/place_housing.parquet + city_housing.parquet, tier "all"
 *  measure  ZHVI CAGR %/yr over the SAME pinned 2017 → 2022 window
 *  The place figure is what the Housing-vs-Amenities fork tests; the metro
 *  median is the benchmark it is tested against — the two must always be
 *  quoted on the same window. */

export interface HousingDatum {
  /** home-value growth, CAGR %/yr */
  zhvi: number;
  /** latest home value, USD */
  level: number;
}

export const PLACE_HOUSING: Record<string, HousingDatum> = {
  Memphis: { zhvi: 12.37, level: 185050 },
  "San Antonio": { zhvi: 8.89, level: 280720 },
  "San Jose": { zhvi: 10.62, level: 1353793 },
  Boston: { zhvi: 3.63, level: 970623 },
};

/** the same measure at metro level, for the four sample metros */
export const METRO_HOUSING: Record<string, HousingDatum> = {
  Memphis: { zhvi: 11.45, level: 239438 },
  "San Antonio": { zhvi: 9.19, level: 301439 },
  "San Jose": { zhvi: 10.28, level: 1552541 },
  Boston: { zhvi: 7.12, level: 648136 },
};

/** The typical metro's home-value growth — median ZHVI CAGR across all 379
 *  USA metros, on the SAME pinned 2017 → 2022 window as PLACE_HOUSING.
 *
 *  This threshold is PAIRED to the window. On 2017 → 2023 the median is
 *  7.97, not 8.83, and every place figure above moves with it. Changing one
 *  without the other is the specific mistake this comment exists to prevent:
 *  San Jose's place ZHVI is 10.62 on the pinned window (clears 8.83 by
 *  1.8pp, comfortably Housing) but 8.07 on 2017 → 2023 — which, tested
 *  against the 2022-window 8.83, would wrongly read as Amenities.
 *
 *  The threshold is also PAIRED to the universe. The cities-explainer
 *  reference site uses the same METHOD for its supply fork — each city's
 *  home growth vs the MEDIAN across US METROS, same 2017 → 2022 window,
 *  never a mean and never computed from the city field — but its metro list
 *  is broader (700 metros incl. ones this file's METROS excludes for missing
 *  wage data), so its median lands at 9.18. Neither number is wrong; each is
 *  the median of its own universe, and this one pairs with THIS file's data. */
export const METRO_MEDIAN_ZHVI = 8.83;

export const placeHousing = (city: string): HousingDatum | null =>
  PLACE_HOUSING[city] ?? null;

/* ---------- country scoping ----------
 *  The forks compare a place to the median metro IN ITS OWN COUNTRY, and the
 *  cost fork reads a different series per country: home values in the US,
 *  rents in Mexico. Only USA metros are loaded so far, so that is the only
 *  populated entry — a Mexican or UK sample city needs its own median set
 *  AND a rent series before it can be diagnosed. */

export const USA = "United States of America";

export interface CountryMedians {
  /** median metro population growth, CAGR %/yr */
  pop: number;
  /** median metro wage growth, CAGR %/yr */
  wage: number;
  /** median metro cost-of-living growth, CAGR %/yr */
  cost: number;
}

/** how the cost fork's series is named in that country's copy */
export interface CostMeasure {
  sentenceCase: string;
  lower: string;
}

const COST_MEASURE: Record<string, CostMeasure> = {
  [USA]: { sentenceCase: "Home values", lower: "home-value" },
  Mexico: { sentenceCase: "Rents", lower: "rent" },
};

export const costMeasure = (country: string): CostMeasure =>
  COST_MEASURE[country] ?? { sentenceCase: "Costs", lower: "cost-of-living" };

/** Median metros per country. USA is the only set loaded — METROS holds US
 *  metros only — so every country resolves to it today. That is fine while
 *  all four sample cities are American, and wrong the moment one is not:
 *  adding a Mexican city means loading `mex` rows from city_panel.parquet
 *  and city_rent.parquet, computing their medians on the same pinned window
 *  (see DATA_WINDOW), and adding an entry here. The parameter exists so
 *  those call sites already read correctly. */
const COUNTRY_MEDIANS: Record<string, CountryMedians> = {
  get [USA]() {
    return { ...METRO_MEDIANS, cost: METRO_MEDIAN_ZHVI };
  },
};

export const countryMedians = (country: string): CountryMedians =>
  COUNTRY_MEDIANS[country] ?? COUNTRY_MEDIANS[USA];

/** the place's cost-of-living growth, whichever series its country uses */
export const placeCost = (city: string): { growth: number } | null => {
  const h = PLACE_HOUSING[city];
  return h ? { growth: h.zhvi } : null;
};

/** the selected city's metro / city proper; null when we have no data */
export const homeMsa = (city: string): MetroDatum | null =>
  US_SAMPLE_CITIES.includes(city)
    ? (METROS.find((m) => m.name === city) ?? null)
    : null;
export const homePlace = (city: string): MetroDatum | null =>
  HOME_PLACES[city] ?? null;

/** the other US sample cities, drawn as labeled peer dots */
export const peerMetros = (city: string): MetroDatum[] =>
  US_SAMPLE_CITIES.filter((n) => n !== city).map(
    (n) => METROS.find((m) => m.name === n)!,
  );

const median = (vs: number[]) => {
  const s = [...vs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/** the crosshair: the typical metro */
export const METRO_MEDIANS = {
  pop: median(METROS.map((m) => m.pop)),
  wage: median(METROS.map((m) => m.wage)),
};

/* unit-square mapping for the pizza chart: the median crosshair is the
   centre, spans chosen so ~96% of metros fall inside; the tail is clamped
   just inside the rim */
export const METRO_SPAN = { pop: 2.4, wage: 2.2 };
const clamp = (v: number) => Math.max(-0.97, Math.min(0.97, v));
export const metroUnit = (m: MetroDatum): [number, number] => [
  clamp((m.pop - METRO_MEDIANS.pop) / METRO_SPAN.pop),
  clamp((m.wage - METRO_MEDIANS.wage) / METRO_SPAN.wage),
];

const sgn = (v: number) => (v > 0 ? "+" : "−");
/** ["pop −0.6%/yr", "wages +5.8%/yr"] — two short rows, so the dot-label
 *  stacks stay narrow enough to fit the gaps between quadrant labels */
export const metroStatsRows = (m: MetroDatum): string[] => [
  `pop ${sgn(m.pop)}${Math.abs(m.pop).toFixed(1)}%/yr`,
  `wages ${sgn(m.wage)}${Math.abs(m.wage).toFixed(1)}%/yr`,
];
