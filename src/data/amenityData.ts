/** REAL amenity indicators for Boston — pulled out of the Growth Lab's
 *  Amenities Module (https://cities.taimur.sh/tools/amenities-module.html,
 *  built 2026-09-18) by scripts/build-amenity-data.mjs, which documents each
 *  measure. Not synthesized, and not edited by hand: regenerate with
 *  `node scripts/build-amenity-data.mjs`.
 *
 *  These fill the team spec's own Amenities data points (figures.ts, MODULES
 *  .amenities) — Education, Crime, Transportation, Air quality index, Quality
 *  of life — one chart each (src/components/pages/amenityCharts.tsx). The
 *  module publishes no composite, so "Overall amenities score" stays to come.
 *
 *    crime     crime-cost index, % of the national figure (100 = national;
 *              lower is safer), yearly; `place` / `metro` are the page's
 *              3-year average, `…Raw` the annual values
 *    edu       school achievement vs the national average, in student-level
 *              SDs (0 = national; × gradeFactor = grade levels), yearly
 *    aqi       EPA AQI by calendar month from Jan `y0` (lower is cleaner),
 *              plus a mean per calendar year
 *    jobs      jobs reachable by car in 15 / 30 / 60 min (LODES 2023), ranks
 *              among the metro's places and nationally (1 = most), medians
 *    vitality  establishments per 1,000 residents against the national rate
 *              (all 1,954 counted places pooled)
 */

export interface AmenityData {
  city: string;
  placeId: string;
  msaId: string;
  msaName: string;
  built: string;
  years: number[];
  crime: { place: (number | null)[]; metro: (number | null)[]; placeRaw: (number | null)[]; metroRaw: (number | null)[] };
  edu: { gradeFactor: number; place: (number | null)[]; metro: (number | null)[]; placeRaw: (number | null)[]; metroRaw: (number | null)[] };
  aqi: { y0: number; place: (number | null)[]; metro: (number | null)[]; placeAnnual: (number | null)[]; metroAnnual: (number | null)[] };
  jobs: {
    dataYear: number;
    minutes: number[];
    reach: number[];
    estimatedShare: number[];
    rankMetro: number[]; nMetro: number[]; medianMetro: number[];
    rankNation: number[]; nNation: number[]; medianNation: number[];
  };
  vitality: {
    asOf: string;
    counted: number;
    pop: number;
    popYear: number;
    types: { key: string; label: string; full: string; count: number; rate: number; national: number; ratio: number }[];
  };
}

const BOSTON: AmenityData = {"city":"Boston","placeId":"2507000","msaId":"14460","msaName":"Boston-Cambridge-Newton, MA-NH","built":"2026-09-18","years":[2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],"crime":{"place":[null,147.6,133.9,130.3,124.7,134.8,132.8,128.5,121.6,119.3,114.4,110.2,107.3,null],"metro":[97.4,91.7,87.8,82.4,78.5,81.5,81.2,75.9,74.6,72.1,71.4,68.9,69.2,null],"placeRaw":[null,135,149.7,118.2,124.9,134.3,140.9,123.1,122.5,120,115.6,109.3,105.3,null],"metroRaw":[91.8,90,95.9,78.2,74.6,84.8,82.1,76.3,70.4,78.7,68.3,68.6,69.9,null]},"edu":{"gradeFactor":3.2429,"place":[-0.1714,-0.1788,-0.1769,-0.169,-0.1699,-0.1779,-0.1973,-0.217,-0.2305,-0.2338,-0.2293,-0.2149,-0.1966,-0.1864],"metro":[0.3438,0.3362,0.333,0.3347,0.3402,0.3379,0.3221,0.2973,0.2759,0.2634,0.2647,0.2784,0.2953,0.3032],"placeRaw":[-0.1747,-0.1927,-0.1689,-0.169,-0.1691,-0.1716,-0.1931,-0.2273,-0.2305,-0.2338,-0.2371,-0.2171,-0.1906,-0.1822],"metroRaw":[0.3443,0.3306,0.3337,0.3347,0.3357,0.3503,0.3276,0.2883,0.2759,0.2634,0.251,0.2796,0.3045,0.3019]},"aqi":{"y0":2010,"place":[54.8,48.7,49.5,51.2,60.3,59.4,63.6,58,53,52.2,54.3,55.6,66,64,52.8,56.7,49.9,51.6,66.1,50.1,54.9,50.3,58.7,55.6,50.5,54.4,53.1,51.4,53.8,52.9,67.7,58.8,48.7,49.2,53.3,52.5,55.6,53.7,51.6,51.7,53.7,56.7,60.7,56.9,49.5,54.4,50.3,60.8,60,61.5,53.5,48,42.9,43.9,54.2,52.3,53.4,49.8,58.5,49.7,55.3,59.5,52.8,42.3,49.9,49.1,57.4,45.5,55.5,54.8,50.2,46.4,51.4,48.6,44.4,44.9,42.6,43.3,49.9,45.9,43.4,54.3,63.9,67.6,66.2,67.4,65,57.6,53,53.4,50.8,52.1,49.7,47.8,52.1,60.2,60.5,57.5,51.9,54.2,59.3,52.5,58.2,51.7,47,46.4,48,50.5,51.3,50.3,50,43,40,42.2,51.3,44.1,38.5,43.1,50.1,46.7,43,47.4,41.5,42.7,39.9,45.2,49.2,53.1,46.1,46.1,45.9,47.3,44.5,47.3,43.4,40.5,42.6,55.9,54,47.8,40.6,40.1,40,46.1,51.5,49.7,44.5,41.2,41.7,40.2,53.3,46.6,34.7,39.5,37.2,40.6,41.6,45.8,43.4,49.1,45.1,52.7,57.3,43.7,47.7,38.2,36.5,37.4,39.5,39.4,35.4,38,36.1,43.5,49.6,46.6,33.9,35.2,32.2,38.7,42.9,41.1,39.2,42.5,36.5,53.9,50.4,45,35.5,30.9,32.7,42],"metro":[55.5,49.9,50.3,54.5,63.2,61.5,67.9,62.5,56.3,52.2,56.1,57.2,67,66.7,53.5,57.2,51.5,55.8,71.5,55.1,56.4,52.4,59.4,57.7,51.1,54.8,53.4,54.2,55.3,57.3,73.2,70.5,51.3,50.5,56,56.1,56.6,55.4,51.9,55.4,55,60.9,68.1,61.1,52.4,54.9,53.9,63.5,61.2,62.5,58.1,55.1,49.9,54.6,61.5,54.3,55.4,51,58.9,52.3,57.8,60.6,55.5,48.8,58.5,51.1,60.4,51.5,60.6,55.1,52.4,50.1,52.8,49.3,48.8,49.7,53.5,51.5,66.1,54.1,47.8,54.4,63.9,67.6,66.2,67.9,65,61.5,56.5,58,54.3,57,53,48.7,52.5,60.2,60.7,57.5,52.1,55.3,61.3,54.1,64,58.8,48,47.4,48.1,52.3,51.8,51.1,51.5,45.3,43.6,47.7,61.5,51.2,44.3,43.6,50.1,48.5,46.9,49.8,46.4,47.5,45.8,51.3,54.6,55.5,46.4,46.5,48.8,51.1,47.2,49,47.7,45.7,48.1,60.2,58.1,53.2,44,42.6,46.2,49.6,54.5,52.1,49.3,44.4,46.6,47.9,63.5,56,41.3,49.7,42.3,51.5,47.6,53.4,48.5,55.1,51.7,59.7,62,47.1,49.9,40.4,39.4,43.5,43.8,44,41.7,44.2,46.4,56,58.3,51.3,43.9,44.1,62.2,43.3,46.1,45.1,44.6,50.8,41.9,58.9,55.5,55.2,39.9,35.7,37.5,44],"placeAnnual":[55.1,56.4,53.9,54.6,52.3,51.6,50,56.3,53.1,45.9,45.6,45.2,43.4,44.9,39,41],"metroAnnual":[57.3,58.7,57,57.4,56.2,55.2,55,58.4,55,49.2,49.2,49.3,49.9,49.9,48.3,46.3]},"jobs":{"dataYear":2023,"minutes":[15,30,60],"reach":[455558,1222022,2806283],"estimatedShare":[0,0,0],"rankMetro":[1,5,7],"nMetro":[37,37,37],"medianMetro":[76823,348253,2200158],"rankNation":[25,173,405],"nNation":[2142,2142,2142],"medianNation":[67830,344269,1316877]},"vitality":{"asOf":"Sept 2026","counted":1954,"pop":672973,"popYear":2025,"types":[{"key":"r","label":"Restaurants","full":"Non fast-food restaurants","count":2190,"rate":3.25,"national":2.39,"ratio":1.36},{"key":"d","label":"Daily needs","full":"Daily needs (grocers, pharmacies, gyms, libraries…)","count":1372,"rate":2.04,"national":1.74,"ratio":1.17},{"key":"c","label":"Arts & culture","full":"Arts, culture and recreation","count":450,"rate":0.67,"national":0.39,"ratio":1.72}]}};

/** keyed by the app's short city name */
export const AMENITY_DATA: Record<string, AmenityData> = { "Boston": BOSTON };

export const amenityData = (cityShort: string): AmenityData | null => AMENITY_DATA[cityShort] ?? null;
