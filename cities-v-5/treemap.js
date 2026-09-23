/* =========================================================================
   Boston MSA industry treemaps (d3)

   Renders two views off one dataset:
     1. #exportTreemapSvg     - static initial map, industries grouped by sector
     2. #tradableAnimatedSvg  - same map, then split into
                                Tradable (left, still sector-grouped/coloured)
                                Non-tradable (right, greyed)

   Both use a 1000x480 viewBox so they share the prototype's proportions.
   ========================================================================= */
(function(){
  "use strict";

  const WIDTH  = 880;    /* the figure measure: just proud of the 760 text measure, fonts 1:1 */
  const HEIGHT = 450;    /* wide-and-short (2:1) so the full map fits one view */
  const GREY   = "#9ca3af";

  /* "Color by" modes. Complexity and change are dummy values for the prototype,
     but held stable per industry so a cell keeps its shade across replays. */
  /* One seeded PRNG for every generated data value, so each figure reads
     the same on every load. Visual-only jitter may stay random. */
  let _prng = 20260826;
  function srand(){
    _prng = (_prng * 1664525 + 1013904223) >>> 0;
    return _prng / 4294967296;
  }

  const SECTOR     = "Sector";
  const COMPLEXITY = "Product complexity";
  const TRADABILITY = "Tradability";

  /* sampled from the reference build's complexity scale (cities.taimur.sh),
     which runs a diverging orange -> pale -> teal from least to most complex.
     The legend's gradient under the figure uses the same five stops. */
  const complexityPalette = ["#e4a368","#efc9a5","#f8e7d7","#89ccc7","#008379"];
  const complexityByName = new Map();

  /* Tradability 0 -> 1: how much of an industry's output is sold outside
     the region. A diverging ramp — russet (locally consumed) through a
     neutral gray to the theme teal (widely traded) — because the midpoint
     means "neither". Poles are lightness-matched (OKLab L .45/.43) and sit
     on opposite sides of the blue–yellow axis, so the direction survives
     red-green colourblindness (poles ΔE 9.9 protan, target ≥8); the russet
     pole keeps ΔE 24 from the complexity ramp's terracotta. */
  function token(name, fallback){
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  }

  let _tradScale = null;
  function tradabilityScale(v){
    if (!_tradScale) {
      _tradScale = d3.scaleLinear()
        .domain([0, 0.25, 0.5, 0.75, 1])
        .range(["#7f451e", "#b97f4e", "#efeeec",
                "#67929f", token("--teal", "#255862")])
        .interpolate(d3.interpolateLab)
        .clamp(true);
    }
    return _tradScale(v);
  }

  /* tradability, RCA, PCI and the tier per industry are read from the rows
     below, once they exist; see after rawData */
  /* Dummy admin share of each sector's metro jobs — downtown-weighted
     sectors run high, land-hungry ones low. Authored as relative
     propensities and scaled, once the rows exist, so their jobs-weighted
     mean is the 687,736 jobs LEHD counts inside the city: 30% of the
     metro's real 2,318,250. One table to swap for real place-level
     (2-digit) employment when it arrives. */
  const ADMIN_SHARE = {
    "Construction": 0.13, "Education & Health": 0.32,
    "Financial Activities": 0.38, "Leisure & Hospitality": 0.25,
    "Manufacturing": 0.08, "Natural Resources": 0.03,
    "Other": 0.19, "Professional & Business": 0.34,
    "Trade & Transportation": 0.16
  };
  function tradabilityOf(name){ return tradByName.has(name) ? tradByName.get(name) : 0; }
  /* the tier the source assigns, 0 traded, 1 partly traded, 2 local */
  function tierOf(name){ return tierByName.has(name) ? tierByName.get(name) : 2; }

  const colorMode  = { exportTreemapSvg:SECTOR, tradableAnimatedSvg:SECTOR,
                       complexityTreemapSvg:COMPLEXITY };

  /* Which cells are currently on the grey (non-tradable) side, per svg, so a
     later "Color by" change can recolour without losing the split. */
  const splitState = { exportTreemapSvg:null, tradableAnimatedSvg:null };

  /* the five bins are the metro's own quintiles of PCI in 2024; the one
     industry with no PCI in the source sits in the middle bin */
  const PCI_CUTS = [-0.72, -0.4, 0.08, 0.65];
  function complexityColor(name){
    if(!complexityByName.has(name)){
      const v = pciByName.get(name);
      let bin = 2;
      if (v != null){ bin = 0; while (bin < PCI_CUTS.length && v >= PCI_CUTS[bin]) bin++; }
      complexityByName.set(name, complexityPalette[bin]);
    }
    return complexityByName.get(name);
  }

  function tradabilityColor(name){ return tradabilityScale(tradabilityOf(name)); }

  /* Fill for one industry cell. Non-tradable cells stay grey in every mode —
     grey encodes "non-tradable", not a sector. */
  function cellFill(svgId, d, grey){
    if (grey) return GREY;
    const mode = colorMode[svgId];
    if (mode === COMPLEXITY) return complexityColor(d.data.name);
    if (mode === TRADABILITY) return tradabilityColor(d.data.name);
    return sectorColors[d.parent.data.name];
  }

  const sectorColors = {
    "Construction": "#c084a2",
    "Education & Health": "#e8836e",
    "Financial Activities": "#f4c542",
    "Leisure & Hospitality": "#8fd0d8",
    "Manufacturing": "#3c7d91",
    "Natural Resources": "#7cb342",
    "Other": "#7d6d9a",
    "Professional & Business": "#b94a44",
    "Trade & Transportation": "#e0938a"
  };

  /* Boston-Cambridge-Newton (metro 14460), 2024, 6-digit NAICS, from
     boston_6d_pci_rca_tradability_2024.csv: name, code, employment, the
     Growth Lab sector (2-digit NAICS grouped as Metroverse does: 51 with
     professional & business, 22 with construction), the RCA against the
     national mix, the PCI, the tradability score 0 to 1 and the tier the
     source assigns (0 traded, 1 partly traded, 2 local), and the source's
     own tradable flag. The seven rows with no name in the source are
     dropped, which is 735 jobs; Private Households has no score, tier or
     flag there and is held at 0, local, not tradable. 880 industries,
     2,317,838 jobs. */
  const rawData = [
    {name: "Oilseed (except Soybean) Farming", code: "111120", employ: 26.4, sector: "Natural Resources", rca: 5.886, pci: 1.117, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Vegetable (except Potato) and Melon Farming", code: "111219", employ: 562.26, sector: "Natural Resources", rca: 0.588, pci: -0.682, trad: 1.0, tier: 0, tradable: true},
    {name: "Apple Orchards", code: "111331", employ: 197.08, sector: "Natural Resources", rca: 0.384, pci: -0.023, trad: 1.0, tier: 0, tradable: true},
    {name: "Grape Vineyards", code: "111332", employ: 45.18, sector: "Natural Resources", rca: 0.098, pci: -0.172, trad: 1.0, tier: 0, tradable: true},
    {name: "Berry (except Strawberry) Farming", code: "111334", employ: 216.32, sector: "Natural Resources", rca: 0.598, pci: -0.148, trad: 1.0, tier: 0, tradable: true},
    {name: "Fruit and Tree Nut Combination Farming", code: "111336", employ: 27.14, sector: "Natural Resources", rca: 0.329, pci: 0.419, trad: 1.0, tier: 0, tradable: true},
    {name: "Mushroom Production", code: "111411", employ: 2.41, sector: "Natural Resources", rca: 0.021, pci: 1.524, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Food Crops Grown Under Cover", code: "111419", employ: 2027.1, sector: "Natural Resources", rca: 4.142, pci: -0.325, trad: 0.9, tier: 0, tradable: true},
    {name: "Nursery and Tree Production", code: "111421", employ: 163.57, sector: "Natural Resources", rca: 0.118, pci: -0.636, trad: 0.9, tier: 0, tradable: true},
    {name: "Floriculture Production", code: "111422", employ: 98.4, sector: "Natural Resources", rca: 0.13, pci: -0.164, trad: 0.9, tier: 0, tradable: true},
    {name: "Hay Farming", code: "111940", employ: 1.36, sector: "Natural Resources", rca: 0.013, pci: -1.334, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Crop Farming", code: "111998", employ: 157.48, sector: "Natural Resources", rca: 0.305, pci: -1.339, trad: 1.0, tier: 0, tradable: true},
    {name: "Dairy Cattle and Milk Production", code: "112120", employ: 10.62, sector: "Natural Resources", rca: 0.011, pci: -1.473, trad: 0.9, tier: 0, tradable: true},
    {name: "Hog and Pig Farming", code: "112210", employ: 3.38, sector: "Natural Resources", rca: 0.046, pci: -1.967, trad: 0.9, tier: 0, tradable: true},
    {name: "Broilers and Other Meat Type Chicken Production", code: "112320", employ: 9.3, sector: "Natural Resources", rca: 0.241, pci: -0.878, trad: 0.9, tier: 0, tradable: true},
    {name: "Turkey Production", code: "112330", employ: 5.95, sector: "Natural Resources", rca: 0.275, pci: -0.906, trad: 0.9, tier: 0, tradable: true},
    {name: "Sheep Farming", code: "112410", employ: 11.34, sector: "Natural Resources", rca: 0.941, pci: 0.113, trad: 1.0, tier: 0, tradable: true},
    {name: "Finfish Farming and Fish Hatcheries", code: "112511", employ: 25.34, sector: "Natural Resources", rca: 0.987, pci: -0.107, trad: 1.0, tier: 0, tradable: true},
    {name: "Shellfish Farming", code: "112512", employ: 18.55, sector: "Natural Resources", rca: 1.072, pci: 1.318, trad: 0.9, tier: 0, tradable: true},
    {name: "Apiculture", code: "112910", employ: 16.45, sector: "Natural Resources", rca: 0.364, pci: -0.299, trad: 0.9, tier: 0, tradable: true},
    {name: "Horses and Other Equine Production", code: "112920", employ: 50.23, sector: "Natural Resources", rca: 0.451, pci: 0.202, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Animal Production", code: "112990", employ: 14.13, sector: "Natural Resources", rca: 0.213, pci: -0.889, trad: 0.9, tier: 0, tradable: true},
    {name: "Timber Tract Operations", code: "113110", employ: 6.78, sector: "Natural Resources", rca: 0.333, pci: -0.569, trad: 1.0, tier: 0, tradable: true},
    {name: "Forest Nurseries and Gathering of Forest Products", code: "113210", employ: 3.43, sector: "Natural Resources", rca: 0.197, pci: 0.256, trad: 1.0, tier: 0, tradable: true},
    {name: "Logging", code: "113310", employ: 15.37, sector: "Natural Resources", rca: 0.072, pci: -1.176, trad: 1.0, tier: 0, tradable: true},
    {name: "Finfish Fishing", code: "114111", employ: 128.65, sector: "Natural Resources", rca: 3.457, pci: 1.059, trad: 1.0, tier: 0, tradable: true},
    {name: "Shellfish Fishing", code: "114112", employ: 72.93, sector: "Natural Resources", rca: 3.653, pci: 1.497, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Marine Fishing", code: "114119", employ: 73.89, sector: "Natural Resources", rca: 8.53, pci: 2.834, trad: 1.0, tier: 0, tradable: true},
    {name: "Hunting and Trapping", code: "114210", employ: 26.07, sector: "Natural Resources", rca: 1.053, pci: -0.656, trad: 1.0, tier: 0, tradable: true},
    {name: "Soil Preparation, Planting, and Cultivating", code: "115112", employ: 111.43, sector: "Natural Resources", rca: 0.359, pci: -2.118, trad: 0.861, tier: 0, tradable: true},
    {name: "Postharvest Crop Activities (except Cotton Ginning)", code: "115114", employ: 8.75, sector: "Natural Resources", rca: 0.007, pci: -1.741, trad: 0.5, tier: 1, tradable: true},
    {name: "Farm Labor Contractors and Crew Leaders", code: "115115", employ: 12.79, sector: "Natural Resources", rca: 0.003, pci: -2.118, trad: 0.861, tier: 0, tradable: true},
    {name: "Farm Management Services", code: "115116", employ: 24.22, sector: "Natural Resources", rca: 0.068, pci: -2.118, trad: 0.861, tier: 0, tradable: true},
    {name: "Support Activities for Animal Production", code: "115210", employ: 294.42, sector: "Natural Resources", rca: 0.838, pci: -0.995, trad: 0.5, tier: 1, tradable: true},
    {name: "Support Activities for Forestry", code: "115310", employ: 52.03, sector: "Natural Resources", rca: 0.248, pci: -0.844, trad: 0.5, tier: 1, tradable: true},
    {name: "Dimension Stone Mining and Quarrying", code: "212311", employ: 31.18, sector: "Natural Resources", rca: 0.397, pci: -0.221, trad: 1.0, tier: 0, tradable: true},
    {name: "Crushed and Broken Granite Mining and Quarrying", code: "212313", employ: 7.08, sector: "Natural Resources", rca: 0.295, pci: -0.7, trad: 0.59, tier: 1, tradable: true},
    {name: "Other Crushed and Broken Stone Mining and Quarrying", code: "212319", employ: 6.89, sector: "Natural Resources", rca: 0.122, pci: -0.045, trad: 0.5, tier: 1, tradable: true},
    {name: "Construction Sand and Gravel Mining", code: "212321", employ: 150.2, sector: "Natural Resources", rca: 0.597, pci: -1.109, trad: 0.9, tier: 0, tradable: true},
    {name: "Drilling Oil and Gas Wells", code: "213111", employ: 2.31, sector: "Natural Resources", rca: 0.006, pci: -1.842, trad: 0.9, tier: 0, tradable: true},
    {name: "Support Activities for Oil and Gas Operations", code: "213112", employ: 4.04, sector: "Natural Resources", rca: 0.001, pci: -2.422, trad: 0.9, tier: 0, tradable: true},
    {name: "Support Activities for Metal Mining", code: "213114", employ: 3.13, sector: "Natural Resources", rca: 0.099, pci: -1.842, trad: 0.9, tier: 0, tradable: true},
    {name: "Support Activities for Nonmetallic Minerals (except Fuels) Mining", code: "213115", employ: 16.61, sector: "Natural Resources", rca: 0.886, pci: -1.842, trad: 0.9, tier: 0, tradable: true},
    {name: "Hydroelectric Power Generation", code: "221111", employ: 185.19, sector: "Construction", rca: 1.829, pci: -0.223, trad: 0.9, tier: 0, tradable: true},
    {name: "Fossil Fuel Electric Power Generation", code: "221112", employ: 2760.88, sector: "Construction", rca: 3.368, pci: -0.902, trad: 0.894, tier: 0, tradable: true},
    {name: "Nuclear Electric Power Generation", code: "221113", employ: 124.98, sector: "Construction", rca: 0.815, pci: -0.902, trad: 0.894, tier: 0, tradable: true},
    {name: "Solar Electric Power Generation", code: "221114", employ: 395.26, sector: "Construction", rca: 0.41, pci: 0.858, trad: 0.871, tier: 0, tradable: true},
    {name: "Wind Electric Power Generation", code: "221115", employ: 210.29, sector: "Construction", rca: 0.79, pci: -1.051, trad: 0.9, tier: 0, tradable: true},
    {name: "Biomass Electric Power Generation", code: "221117", employ: 15.89, sector: "Construction", rca: 0.246, pci: -0.902, trad: 0.894, tier: 0, tradable: true},
    {name: "Other Electric Power Generation", code: "221118", employ: 96.08, sector: "Construction", rca: 0.491, pci: 1.758, trad: 0.9, tier: 0, tradable: true},
    {name: "Electric Bulk Power Transmission and Control", code: "221121", employ: 47.8, sector: "Construction", rca: 0.146, pci: -0.971, trad: 0.9, tier: 0, tradable: true},
    {name: "Electric Power Distribution", code: "221122", employ: 882.34, sector: "Construction", rca: 0.736, pci: -1.477, trad: 0.225, tier: 1, tradable: false},
    {name: "Natural Gas Distribution", code: "221210", employ: 405.75, sector: "Construction", rca: 0.711, pci: -1.457, trad: 0.132, tier: 2, tradable: false},
    {name: "Water Supply and Irrigation Systems", code: "221310", employ: 38.48, sector: "Construction", rca: 0.083, pci: -1.255, trad: 0.5, tier: 1, tradable: true},
    {name: "Sewage Treatment Facilities", code: "221320", employ: 55.97, sector: "Construction", rca: 0.716, pci: 0.296, trad: 0.5, tier: 1, tradable: true},
    {name: "Steam and Air-Conditioning Supply", code: "221330", employ: 38.94, sector: "Construction", rca: 1.541, pci: 2.374, trad: 0.5, tier: 1, tradable: true},
    {name: "New Single-Family Housing Construction (except For-Sale Builders)", code: "236115", employ: 3120.08, sector: "Construction", rca: 0.453, pci: -0.778, trad: 0.02, tier: 2, tradable: false},
    {name: "New Multifamily Housing Construction (except For-Sale Builders)", code: "236116", employ: 678.74, sector: "Construction", rca: 0.867, pci: 0.432, trad: 0.256, tier: 1, tradable: false},
    {name: "New Housing For-Sale Builders", code: "236117", employ: 321.46, sector: "Construction", rca: 0.333, pci: -0.778, trad: 0.02, tier: 2, tradable: false},
    {name: "Residential Remodelers", code: "236118", employ: 8081.72, sector: "Construction", rca: 0.881, pci: -0.697, trad: 0.0, tier: 2, tradable: false},
    {name: "Industrial Building Construction", code: "236210", employ: 1476.91, sector: "Construction", rca: 0.501, pci: -1.028, trad: 0.9, tier: 0, tradable: true},
    {name: "Commercial and Institutional Building Construction", code: "236220", employ: 11742.09, sector: "Construction", rca: 0.818, pci: -1.011, trad: 0.0, tier: 2, tradable: false},
    {name: "Water and Sewer Line and Related Structures Construction", code: "237110", employ: 2789.3, sector: "Construction", rca: 0.694, pci: -1.12, trad: 0.0, tier: 2, tradable: false},
    {name: "Oil and Gas Pipeline and Related Structures Construction", code: "237120", employ: 124.33, sector: "Construction", rca: 0.062, pci: -1.264, trad: 0.9, tier: 0, tradable: true},
    {name: "Power and Communication Line and Related Structures Construction", code: "237130", employ: 2590.2, sector: "Construction", rca: 0.696, pci: -1.122, trad: 0.5, tier: 1, tradable: true},
    {name: "Land Subdivision", code: "237210", employ: 418.26, sector: "Construction", rca: 0.691, pci: -0.053, trad: 0.5, tier: 1, tradable: true},
    {name: "Highway, Street, and Bridge Construction", code: "237310", employ: 4652.42, sector: "Construction", rca: 0.758, pci: -0.918, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Heavy and Civil Engineering Construction", code: "237990", employ: 614.53, sector: "Construction", rca: 0.348, pci: -0.928, trad: 0.689, tier: 1, tradable: true},
    {name: "Poured Concrete Foundation and Structure Contractors", code: "238110", employ: 2029.47, sector: "Construction", rca: 0.404, pci: -0.915, trad: 0.0, tier: 2, tradable: false},
    {name: "Structural Steel and Precast Concrete Contractors", code: "238120", employ: 425.94, sector: "Construction", rca: 0.464, pci: -0.366, trad: 0.0, tier: 2, tradable: false},
    {name: "Framing Contractors", code: "238130", employ: 361.53, sector: "Construction", rca: 0.306, pci: -0.543, trad: 0.188, tier: 2, tradable: false},
    {name: "Masonry Contractors", code: "238140", employ: 2471.66, sector: "Construction", rca: 0.859, pci: -0.543, trad: 0.188, tier: 2, tradable: false},
    {name: "Glass and Glazing Contractors", code: "238150", employ: 1742.53, sector: "Construction", rca: 1.253, pci: -0.796, trad: 0.022, tier: 2, tradable: false},
    {name: "Roofing Contractors", code: "238160", employ: 2286.99, sector: "Construction", rca: 0.419, pci: -0.796, trad: 0.022, tier: 2, tradable: false},
    {name: "Siding Contractors", code: "238170", employ: 276.95, sector: "Construction", rca: 0.893, pci: -0.796, trad: 0.022, tier: 2, tradable: false},
    {name: "Other Foundation, Structure, and Building Exterior Contractors", code: "238190", employ: 815.26, sector: "Construction", rca: 1.099, pci: -0.796, trad: 0.022, tier: 2, tradable: false},
    {name: "Electrical Contractors and Other Wiring Installation Contractors", code: "238210", employ: 19917.05, sector: "Construction", rca: 0.923, pci: -0.919, trad: 0.0, tier: 2, tradable: false},
    {name: "Plumbing, Heating, and Air-Conditioning Contractors", code: "238220", employ: 23870.65, sector: "Construction", rca: 0.916, pci: -0.9, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Building Equipment Contractors", code: "238290", employ: 1818.35, sector: "Construction", rca: 0.95, pci: -0.785, trad: 0.0, tier: 2, tradable: false},
    {name: "Drywall and Insulation Contractors", code: "238310", employ: 5237.41, sector: "Construction", rca: 1.019, pci: -0.185, trad: 0.0, tier: 2, tradable: false},
    {name: "Painting and Wall Covering Contractors", code: "238320", employ: 3328.24, sector: "Construction", rca: 0.783, pci: -0.399, trad: 0.0, tier: 2, tradable: false},
    {name: "Flooring Contractors", code: "238330", employ: 1926.91, sector: "Construction", rca: 1.193, pci: -0.174, trad: 0.0, tier: 2, tradable: false},
    {name: "Tile and Terrazzo Contractors", code: "238340", employ: 253.96, sector: "Construction", rca: 0.324, pci: 0.265, trad: 0.037, tier: 2, tradable: false},
    {name: "Finish Carpentry Contractors", code: "238350", employ: 3290.53, sector: "Construction", rca: 1.14, pci: -0.435, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Building Finishing Contractors", code: "238390", employ: 2049.76, sector: "Construction", rca: 1.311, pci: 0.279, trad: 0.0, tier: 2, tradable: false},
    {name: "Site Preparation Contractors", code: "238910", employ: 6943.7, sector: "Construction", rca: 1.005, pci: -1.163, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other Specialty Trade Contractors", code: "238990", employ: 6677.3, sector: "Construction", rca: 0.881, pci: -0.874, trad: 0.0, tier: 2, tradable: false},
    {name: "Dog and Cat Food Manufacturing", code: "311111", employ: 8.13, sector: "Manufacturing", rca: 0.041, pci: -1.666, trad: 1.0, tier: 0, tradable: true},
    {name: "Flour Milling", code: "311211", employ: 240.42, sector: "Manufacturing", rca: 2.679, pci: -0.172, trad: 1.0, tier: 0, tradable: true},
    {name: "Malt Manufacturing", code: "311213", employ: 15.19, sector: "Manufacturing", rca: 1.169, pci: 1.447, trad: 1.0, tier: 0, tradable: true},
    {name: "Soybean and Other Oilseed Processing", code: "311224", employ: 24.42, sector: "Manufacturing", rca: 0.225, pci: -0.943, trad: 1.0, tier: 0, tradable: true},
    {name: "Fats and Oils Refining and Blending", code: "311225", employ: 77.24, sector: "Manufacturing", rca: 1.319, pci: -0.153, trad: 1.0, tier: 0, tradable: true},
    {name: "Nonchocolate Confectionery Manufacturing", code: "311340", employ: 145.36, sector: "Manufacturing", rca: 0.481, pci: 0.615, trad: 1.0, tier: 0, tradable: true},
    {name: "Chocolate and Confectionery Manufacturing from Cacao Beans", code: "311351", employ: 88.13, sector: "Manufacturing", rca: 0.71, pci: 0.524, trad: 1.0, tier: 0, tradable: true},
    {name: "Confectionery Manufacturing from Purchased Chocolate", code: "311352", employ: 533.71, sector: "Manufacturing", rca: 1.47, pci: 0.524, trad: 1.0, tier: 0, tradable: true},
    {name: "Frozen Fruit, Juice, and Vegetable Manufacturing", code: "311411", employ: 192.0, sector: "Manufacturing", rca: 0.526, pci: 0.142, trad: 1.0, tier: 0, tradable: true},
    {name: "Frozen Specialty Food Manufacturing", code: "311412", employ: 263.4, sector: "Manufacturing", rca: 0.598, pci: 0.25, trad: 0.9, tier: 0, tradable: true},
    {name: "Fruit and Vegetable Canning", code: "311421", employ: 6.67, sector: "Manufacturing", rca: 0.011, pci: -0.092, trad: 1.0, tier: 0, tradable: true},
    {name: "Specialty Canning", code: "311422", employ: 3.79, sector: "Manufacturing", rca: 0.039, pci: 1.539, trad: 1.0, tier: 0, tradable: true},
    {name: "Dried and Dehydrated Food Manufacturing", code: "311423", employ: 65.99, sector: "Manufacturing", rca: 0.325, pci: -0.196, trad: 1.0, tier: 0, tradable: true},
    {name: "Fluid Milk Manufacturing", code: "311511", employ: 568.29, sector: "Manufacturing", rca: 1.049, pci: 0.35, trad: 0.905, tier: 0, tradable: true},
    {name: "Cheese Manufacturing", code: "311513", employ: 9.82, sector: "Manufacturing", rca: 0.02, pci: -0.623, trad: 1.0, tier: 0, tradable: true},
    {name: "Dry, Condensed, and Evaporated Dairy Product Manufacturing", code: "311514", employ: 80.19, sector: "Manufacturing", rca: 0.395, pci: 0.09, trad: 1.0, tier: 0, tradable: true},
    {name: "Ice Cream and Frozen Dessert Manufacturing", code: "311520", employ: 175.88, sector: "Manufacturing", rca: 0.468, pci: 0.958, trad: 0.9, tier: 0, tradable: true},
    {name: "Animal (except Poultry) Slaughtering", code: "311611", employ: 7.2, sector: "Manufacturing", rca: 0.013, pci: -1.882, trad: 1.0, tier: 0, tradable: true},
    {name: "Meat Processed from Carcasses", code: "311612", employ: 1243.63, sector: "Manufacturing", rca: 0.854, pci: -1.178, trad: 0.9, tier: 0, tradable: true},
    {name: "Rendering and Meat Byproduct Processing", code: "311613", employ: 5.84, sector: "Manufacturing", rca: 0.045, pci: -0.306, trad: 1.0, tier: 0, tradable: true},
    {name: "Seafood Product Preparation and Packaging", code: "311710", employ: 1425.0, sector: "Manufacturing", rca: 5.473, pci: 0.895, trad: 1.0, tier: 0, tradable: true},
    {name: "Retail Bakeries", code: "311811", employ: 5321.56, sector: "Manufacturing", rca: 2.295, pci: -0.566, trad: 0.5, tier: 1, tradable: true},
    {name: "Commercial Bakeries", code: "311812", employ: 3186.12, sector: "Manufacturing", rca: 1.103, pci: 0.238, trad: 0.534, tier: 1, tradable: true},
    {name: "Frozen Cakes, Pies, and Other Pastries Manufacturing", code: "311813", employ: 98.99, sector: "Manufacturing", rca: 0.538, pci: 0.238, trad: 0.534, tier: 1, tradable: true},
    {name: "Cookie and Cracker Manufacturing", code: "311821", employ: 81.29, sector: "Manufacturing", rca: 0.222, pci: 1.039, trad: 0.937, tier: 0, tradable: true},
    {name: "Dry Pasta, Dough, and Flour Mixes Manufacturing from Purchased Flour", code: "311824", employ: 105.41, sector: "Manufacturing", rca: 0.345, pci: 1.039, trad: 0.937, tier: 0, tradable: true},
    {name: "Tortilla Manufacturing", code: "311830", employ: 51.63, sector: "Manufacturing", rca: 0.122, pci: 0.369, trad: 0.9, tier: 0, tradable: true},
    {name: "Roasted Nuts and Peanut Butter Manufacturing", code: "311911", employ: 8.92, sector: "Manufacturing", rca: 0.059, pci: 0.476, trad: 0.926, tier: 0, tradable: true},
    {name: "Other Snack Food Manufacturing", code: "311919", employ: 381.36, sector: "Manufacturing", rca: 0.63, pci: 0.476, trad: 0.926, tier: 0, tradable: true},
    {name: "Coffee and Tea Manufacturing", code: "311920", employ: 1192.38, sector: "Manufacturing", rca: 2.006, pci: 0.573, trad: 1.0, tier: 0, tradable: true},
    {name: "Flavoring Syrup and Concentrate Manufacturing", code: "311930", employ: 30.0, sector: "Manufacturing", rca: 0.148, pci: 2.715, trad: 0.9, tier: 0, tradable: true},
    {name: "Mayonnaise, Dressing, and Other Prepared Sauce Manufacturing", code: "311941", employ: 1262.46, sector: "Manufacturing", rca: 4.152, pci: 0.362, trad: 1.0, tier: 0, tradable: true},
    {name: "Spice and Extract Manufacturing", code: "311942", employ: 350.92, sector: "Manufacturing", rca: 1.008, pci: 0.362, trad: 1.0, tier: 0, tradable: true},
    {name: "Perishable Prepared Food Manufacturing", code: "311991", employ: 840.37, sector: "Manufacturing", rca: 0.815, pci: 0.61, trad: 0.706, tier: 1, tradable: true},
    {name: "All Other Miscellaneous Food Manufacturing", code: "311999", employ: 215.59, sector: "Manufacturing", rca: 0.317, pci: -0.026, trad: 1.0, tier: 0, tradable: true},
    {name: "Soft Drink Manufacturing", code: "312111", employ: 236.06, sector: "Manufacturing", rca: 0.357, pci: 0.61, trad: 0.5, tier: 1, tradable: true},
    {name: "Bottled Water Manufacturing", code: "312112", employ: 500.93, sector: "Manufacturing", rca: 3.285, pci: 0.271, trad: 0.9, tier: 0, tradable: true},
    {name: "Ice Manufacturing", code: "312113", employ: 12.82, sector: "Manufacturing", rca: 0.153, pci: -0.172, trad: 0.5, tier: 1, tradable: true},
    {name: "Breweries", code: "312120", employ: 2724.63, sector: "Manufacturing", rca: 1.641, pci: -0.283, trad: 1.0, tier: 0, tradable: true},
    {name: "Wineries", code: "312130", employ: 115.91, sector: "Manufacturing", rca: 0.099, pci: -0.604, trad: 1.0, tier: 0, tradable: true},
    {name: "Distilleries", code: "312140", employ: 79.12, sector: "Manufacturing", rca: 0.354, pci: 0.5, trad: 1.0, tier: 0, tradable: true},
    {name: "Tobacco Manufacturing", code: "312230", employ: 24.98, sector: "Manufacturing", rca: 0.329, pci: 1.632, trad: 1.0, tier: 0, tradable: true},
    {name: "Broadwoven Fabric Mills", code: "313210", employ: 315.2, sector: "Manufacturing", rca: 2.045, pci: 0.819, trad: 1.0, tier: 0, tradable: true},
    {name: "Narrow Fabric Mills and Schiffli Machine Embroidery", code: "313220", employ: 14.17, sector: "Manufacturing", rca: 0.254, pci: 1.251, trad: 1.0, tier: 0, tradable: true},
    {name: "Nonwoven Fabric Mills", code: "313230", employ: 256.71, sector: "Manufacturing", rca: 2.273, pci: 1.53, trad: 1.0, tier: 0, tradable: true},
    {name: "Knit Fabric Mills", code: "313240", employ: 3.47, sector: "Manufacturing", rca: 0.083, pci: 1.504, trad: 1.0, tier: 0, tradable: true},
    {name: "Textile and Fabric Finishing Mills", code: "313310", employ: 181.49, sector: "Manufacturing", rca: 0.841, pci: 0.274, trad: 1.0, tier: 0, tradable: true},
    {name: "Fabric Coating Mills", code: "313320", employ: 598.87, sector: "Manufacturing", rca: 12.005, pci: 1.934, trad: 1.0, tier: 0, tradable: true},
    {name: "Curtain and Linen Mills", code: "314120", employ: 106.27, sector: "Manufacturing", rca: 0.437, pci: 1.001, trad: 1.0, tier: 0, tradable: true},
    {name: "Textile Bag and Canvas Mills", code: "314910", employ: 391.08, sector: "Manufacturing", rca: 1.333, pci: 0.212, trad: 1.0, tier: 0, tradable: true},
    {name: "Rope, Cordage, Twine, Tire Cord, and Tire Fabric Mills", code: "314994", employ: 4.23, sector: "Manufacturing", rca: 0.123, pci: 1.302, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Textile Product Mills", code: "314999", employ: 128.74, sector: "Manufacturing", rca: 0.435, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "Apparel Knitting Mills", code: "315120", employ: 28.6, sector: "Manufacturing", rca: 0.583, pci: 1.66, trad: 1.0, tier: 0, tradable: true},
    {name: "Cut and Sew Apparel Contractors", code: "315210", employ: 143.47, sector: "Manufacturing", rca: 0.407, pci: 0.381, trad: 1.0, tier: 0, tradable: true},
    {name: "Cut and Sew Apparel Manufacturing (except Contractors)", code: "315250", employ: 103.51, sector: "Manufacturing", rca: 0.16, pci: 0.518, trad: 1.0, tier: 0, tradable: true},
    {name: "Apparel Accessories and Other Apparel Manufacturing", code: "315990", employ: 50.26, sector: "Manufacturing", rca: 0.384, pci: 0.859, trad: 1.0, tier: 0, tradable: true},
    {name: "Leather and Hide Tanning and Finishing", code: "316110", employ: 70.84, sector: "Manufacturing", rca: 2.887, pci: -0.273, trad: 1.0, tier: 0, tradable: true},
    {name: "Footwear Manufacturing", code: "316210", employ: 55.03, sector: "Manufacturing", rca: 0.7, pci: 1.121, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Leather and Allied Product Manufacturing", code: "316990", employ: 187.26, sector: "Manufacturing", rca: 1.482, pci: 0.63, trad: 1.0, tier: 0, tradable: true},
    {name: "Sawmills", code: "321113", employ: 12.89, sector: "Manufacturing", rca: 0.06, pci: -1.206, trad: 1.0, tier: 0, tradable: true},
    {name: "Softwood Veneer and Plywood Manufacturing", code: "321212", employ: 1.41, sector: "Manufacturing", rca: 0.022, pci: -0.769, trad: 0.949, tier: 0, tradable: true},
    {name: "Wood Window and Door Manufacturing", code: "321911", employ: 78.28, sector: "Manufacturing", rca: 0.254, pci: -0.734, trad: 0.9, tier: 0, tradable: true},
    {name: "Cut Stock, Resawing Lumber, and Planing", code: "321912", employ: 0.37, sector: "Manufacturing", rca: 0.003, pci: -0.734, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Millwork (including Flooring)", code: "321918", employ: 70.1, sector: "Manufacturing", rca: 0.247, pci: -0.734, trad: 0.9, tier: 0, tradable: true},
    {name: "Wood Container and Pallet Manufacturing", code: "321920", employ: 230.99, sector: "Manufacturing", rca: 0.273, pci: -1.025, trad: 0.9, tier: 0, tradable: true},
    {name: "Manufactured Home (Mobile Home) Manufacturing", code: "321991", employ: 0.37, sector: "Manufacturing", rca: 0.002, pci: -1.036, trad: 0.938, tier: 0, tradable: true},
    {name: "Prefabricated Wood Building Manufacturing", code: "321992", employ: 27.3, sector: "Manufacturing", rca: 0.181, pci: -1.036, trad: 0.938, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Wood Product Manufacturing", code: "321999", employ: 79.8, sector: "Manufacturing", rca: 0.263, pci: -1.036, trad: 0.938, tier: 0, tradable: true},
    {name: "Paper Mills", code: "322120", employ: 5.42, sector: "Manufacturing", rca: 0.02, pci: 0.402, trad: 1.0, tier: 0, tradable: true},
    {name: "Corrugated and Solid Fiber Box Manufacturing", code: "322211", employ: 42.54, sector: "Manufacturing", rca: 0.044, pci: -0.482, trad: 0.9, tier: 0, tradable: true},
    {name: "Folding Paperboard Box Manufacturing", code: "322212", employ: 42.56, sector: "Manufacturing", rca: 0.175, pci: -0.482, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Paperboard Container Manufacturing", code: "322219", employ: 208.27, sector: "Manufacturing", rca: 1.04, pci: -0.482, trad: 0.9, tier: 0, tradable: true},
    {name: "Paper Bag and Coated and Treated Paper Manufacturing", code: "322220", employ: 36.0, sector: "Manufacturing", rca: 0.067, pci: 0.717, trad: 1.0, tier: 0, tradable: true},
    {name: "Stationery Product Manufacturing", code: "322230", employ: 10.05, sector: "Manufacturing", rca: 0.064, pci: 1.504, trad: 0.9, tier: 0, tradable: true},
    {name: "All Other Converted Paper Product Manufacturing", code: "322299", employ: 24.1, sector: "Manufacturing", rca: 0.155, pci: 0.805, trad: 1.0, tier: 0, tradable: true},
    {name: "Commercial Printing (except Screen and Books)", code: "323111", employ: 3731.92, sector: "Manufacturing", rca: 0.702, pci: -0.914, trad: 0.5, tier: 1, tradable: true},
    {name: "Commercial Screen Printing", code: "323113", employ: 1528.56, sector: "Manufacturing", rca: 1.388, pci: -0.85, trad: 0.388, tier: 1, tradable: false},
    {name: "Books Printing", code: "323117", employ: 19.16, sector: "Manufacturing", rca: 0.224, pci: -0.85, trad: 0.388, tier: 1, tradable: false},
    {name: "Support Activities for Printing", code: "323120", employ: 73.36, sector: "Manufacturing", rca: 0.251, pci: 1.166, trad: 0.5, tier: 1, tradable: true},
    {name: "Asphalt Paving Mixture and Block Manufacturing", code: "324121", employ: 206.33, sector: "Manufacturing", rca: 0.69, pci: -0.371, trad: 0.941, tier: 0, tradable: true},
    {name: "Asphalt Shingle and Coating Materials Manufacturing", code: "324122", employ: 430.14, sector: "Manufacturing", rca: 1.994, pci: -0.371, trad: 0.941, tier: 0, tradable: true},
    {name: "Petroleum Lubricating Oil and Grease Manufacturing", code: "324191", employ: 33.23, sector: "Manufacturing", rca: 0.182, pci: 0.968, trad: 1.0, tier: 0, tradable: true},
    {name: "Industrial Gas Manufacturing", code: "325120", employ: 72.62, sector: "Manufacturing", rca: 0.218, pci: 0.497, trad: 0.9, tier: 0, tradable: true},
    {name: "Synthetic Dye and Pigment Manufacturing", code: "325130", employ: 214.29, sector: "Manufacturing", rca: 1.744, pci: 1.921, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Basic Inorganic Chemical Manufacturing", code: "325180", employ: 223.6, sector: "Manufacturing", rca: 0.369, pci: -0.19, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Basic Organic Chemical Manufacturing", code: "325199", employ: 57.27, sector: "Manufacturing", rca: 0.127, pci: 0.207, trad: 1.0, tier: 0, tradable: true},
    {name: "Plastics Material and Resin Manufacturing", code: "325211", employ: 578.65, sector: "Manufacturing", rca: 0.881, pci: 0.307, trad: 1.0, tier: 0, tradable: true},
    {name: "Synthetic Rubber Manufacturing", code: "325212", employ: 61.59, sector: "Manufacturing", rca: 0.395, pci: 1.557, trad: 1.0, tier: 0, tradable: true},
    {name: "Artificial and Synthetic Fibers and Filaments Manufacturing", code: "325220", employ: 169.66, sector: "Manufacturing", rca: 1.434, pci: 1.279, trad: 1.0, tier: 0, tradable: true},
    {name: "Nitrogenous Fertilizer Manufacturing", code: "325311", employ: 1.36, sector: "Manufacturing", rca: 0.04, pci: -0.744, trad: 1.0, tier: 0, tradable: true},
    {name: "Compost Manufacturing", code: "325315", employ: 7.54, sector: "Manufacturing", rca: 0.348, pci: -0.744, trad: 1.0, tier: 0, tradable: true},
    {name: "Pesticide and Other Agricultural Chemical Manufacturing", code: "325320", employ: 1.36, sector: "Manufacturing", rca: 0.018, pci: 0.349, trad: 1.0, tier: 0, tradable: true},
    {name: "Medicinal and Botanical Manufacturing", code: "325411", employ: 723.67, sector: "Manufacturing", rca: 1.322, pci: 0.562, trad: 1.0, tier: 0, tradable: true},
    {name: "Pharmaceutical Preparation Manufacturing", code: "325412", employ: 3755.54, sector: "Manufacturing", rca: 1.006, pci: 0.887, trad: 1.0, tier: 0, tradable: true},
    {name: "In-Vitro Diagnostic Substance Manufacturing", code: "325413", employ: 1368.24, sector: "Manufacturing", rca: 1.759, pci: 0.562, trad: 1.0, tier: 0, tradable: true},
    {name: "Biological Product (except Diagnostic) Manufacturing", code: "325414", employ: 1318.97, sector: "Manufacturing", rca: 2.233, pci: 0.562, trad: 1.0, tier: 0, tradable: true},
    {name: "Paint and Coating Manufacturing", code: "325510", employ: 212.69, sector: "Manufacturing", rca: 0.35, pci: 0.154, trad: 1.0, tier: 0, tradable: true},
    {name: "Adhesive Manufacturing", code: "325520", employ: 781.54, sector: "Manufacturing", rca: 2.067, pci: 1.436, trad: 1.0, tier: 0, tradable: true},
    {name: "Soap and Other Detergent Manufacturing", code: "325611", employ: 68.23, sector: "Manufacturing", rca: 0.152, pci: 0.026, trad: 1.0, tier: 0, tradable: true},
    {name: "Polish and Other Sanitation Good Manufacturing", code: "325612", employ: 26.92, sector: "Manufacturing", rca: 0.086, pci: 0.026, trad: 1.0, tier: 0, tradable: true},
    {name: "Surface Active Agent Manufacturing", code: "325613", employ: 13.46, sector: "Manufacturing", rca: 0.161, pci: 0.026, trad: 1.0, tier: 0, tradable: true},
    {name: "Toilet Preparation Manufacturing", code: "325620", employ: 16.08, sector: "Manufacturing", rca: 0.02, pci: 1.003, trad: 1.0, tier: 0, tradable: true},
    {name: "Printing Ink Manufacturing", code: "325910", employ: 140.75, sector: "Manufacturing", rca: 1.234, pci: 2.154, trad: 1.0, tier: 0, tradable: true},
    {name: "Custom Compounding of Purchased Resins", code: "325991", employ: 5.48, sector: "Manufacturing", rca: 0.035, pci: 0.511, trad: 1.0, tier: 0, tradable: true},
    {name: "Photographic Film, Paper, Plate, Chemical, and Copy Toner Manufacturing", code: "325992", employ: 158.47, sector: "Manufacturing", rca: 2.13, pci: 1.635, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Chemical Product and Preparation Manufacturing", code: "325998", employ: 59.49, sector: "Manufacturing", rca: 0.115, pci: -0.129, trad: 1.0, tier: 0, tradable: true},
    {name: "Plastics Bag and Pouch Manufacturing", code: "326111", employ: 1.08, sector: "Manufacturing", rca: 0.003, pci: -0.182, trad: 1.0, tier: 0, tradable: true},
    {name: "Plastics Packaging Film and Sheet (including Laminated) Manufacturing", code: "326112", employ: 5.03, sector: "Manufacturing", rca: 0.022, pci: -0.182, trad: 1.0, tier: 0, tradable: true},
    {name: "Unlaminated Plastics Film and Sheet (except Packaging) Manufacturing", code: "326113", employ: 8.21, sector: "Manufacturing", rca: 0.025, pci: -0.182, trad: 1.0, tier: 0, tradable: true},
    {name: "Unlaminated Plastics Profile Shape Manufacturing", code: "326121", employ: 8.55, sector: "Manufacturing", rca: 0.034, pci: -0.392, trad: 1.0, tier: 0, tradable: true},
    {name: "Plastics Pipe and Pipe Fitting Manufacturing", code: "326122", employ: 2.47, sector: "Manufacturing", rca: 0.008, pci: -0.392, trad: 1.0, tier: 0, tradable: true},
    {name: "Laminated Plastics Plate, Sheet (except Packaging), and Shape Manufacturing", code: "326130", employ: 15.14, sector: "Manufacturing", rca: 0.064, pci: 0.946, trad: 0.9, tier: 0, tradable: true},
    {name: "Polystyrene Foam Product Manufacturing", code: "326140", employ: 25.66, sector: "Manufacturing", rca: 0.059, pci: 0.915, trad: 0.9, tier: 0, tradable: true},
    {name: "Urethane and Other Foam Product (except Polystyrene) Manufacturing", code: "326150", employ: 9.64, sector: "Manufacturing", rca: 0.014, pci: 0.413, trad: 1.0, tier: 0, tradable: true},
    {name: "Plastics Bottle Manufacturing", code: "326160", employ: 15.91, sector: "Manufacturing", rca: 0.034, pci: 0.674, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Plastics Product Manufacturing", code: "326199", employ: 81.46, sector: "Manufacturing", rca: 0.038, pci: -0.807, trad: 0.995, tier: 0, tradable: true},
    {name: "Rubber and Plastics Hoses and Belting Manufacturing", code: "326220", employ: 104.15, sector: "Manufacturing", rca: 0.476, pci: 0.43, trad: 1.0, tier: 0, tradable: true},
    {name: "Rubber Product Manufacturing for Mechanical Use", code: "326291", employ: 148.95, sector: "Manufacturing", rca: 0.624, pci: -0.082, trad: 0.948, tier: 0, tradable: true},
    {name: "All Other Rubber Product Manufacturing", code: "326299", employ: 106.2, sector: "Manufacturing", rca: 0.425, pci: -0.082, trad: 0.948, tier: 0, tradable: true},
    {name: "Pottery, Ceramics, and Plumbing Fixture Manufacturing", code: "327110", employ: 84.96, sector: "Manufacturing", rca: 0.862, pci: 0.826, trad: 1.0, tier: 0, tradable: true},
    {name: "Clay Building Material and Refractories Manufacturing", code: "327120", employ: 44.69, sector: "Manufacturing", rca: 0.325, pci: 0.492, trad: 1.0, tier: 0, tradable: true},
    {name: "Flat Glass Manufacturing", code: "327211", employ: 1.42, sector: "Manufacturing", rca: 0.019, pci: 1.592, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Pressed and Blown Glass and Glassware Manufacturing", code: "327212", employ: 391.82, sector: "Manufacturing", rca: 5.213, pci: 1.111, trad: 1.0, tier: 0, tradable: true},
    {name: "Glass Product Manufacturing Made of Purchased Glass", code: "327215", employ: 143.54, sector: "Manufacturing", rca: 0.363, pci: 0.615, trad: 1.0, tier: 0, tradable: true},
    {name: "Cement Manufacturing", code: "327310", employ: 213.13, sector: "Manufacturing", rca: 1.222, pci: 0.842, trad: 0.9, tier: 0, tradable: true},
    {name: "Ready-Mix Concrete Manufacturing", code: "327320", employ: 197.58, sector: "Manufacturing", rca: 0.105, pci: -1.531, trad: 0.125, tier: 2, tradable: false},
    {name: "Concrete Block and Brick Manufacturing", code: "327331", employ: 51.92, sector: "Manufacturing", rca: 0.259, pci: 0.195, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Concrete Product Manufacturing", code: "327390", employ: 554.09, sector: "Manufacturing", rca: 0.782, pci: -0.311, trad: 0.669, tier: 1, tradable: true},
    {name: "Lime Manufacturing", code: "327410", employ: 6.33, sector: "Manufacturing", rca: 0.34, pci: 0.825, trad: 0.9, tier: 0, tradable: true},
    {name: "Gypsum Product Manufacturing", code: "327420", employ: 63.9, sector: "Manufacturing", rca: 0.945, pci: 1.583, trad: 0.9, tier: 0, tradable: true},
    {name: "Abrasive Product Manufacturing", code: "327910", employ: 58.61, sector: "Manufacturing", rca: 0.566, pci: 1.227, trad: 1.0, tier: 0, tradable: true},
    {name: "Cut Stone and Stone Product Manufacturing", code: "327991", employ: 291.19, sector: "Manufacturing", rca: 0.509, pci: -0.4, trad: 0.5, tier: 1, tradable: true},
    {name: "Ground or Treated Mineral and Earth Manufacturing", code: "327992", employ: 43.36, sector: "Manufacturing", rca: 1.032, pci: 0.167, trad: 1.0, tier: 0, tradable: true},
    {name: "Mineral Wool Manufacturing", code: "327993", employ: 4.91, sector: "Manufacturing", rca: 0.035, pci: 0.167, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Nonmetallic Mineral Product Manufacturing", code: "327999", employ: 39.7, sector: "Manufacturing", rca: 0.349, pci: 0.909, trad: 1.0, tier: 0, tradable: true},
    {name: "Iron and Steel Mills and Ferroalloy Manufacturing", code: "331110", employ: 16.72, sector: "Manufacturing", rca: 0.023, pci: -0.126, trad: 1.0, tier: 0, tradable: true},
    {name: "Iron and Steel Pipe and Tube Manufacturing from Purchased Steel", code: "331210", employ: 31.78, sector: "Manufacturing", rca: 0.123, pci: 0.216, trad: 1.0, tier: 0, tradable: true},
    {name: "Rolled Steel Shape Manufacturing", code: "331221", employ: 85.7, sector: "Manufacturing", rca: 0.429, pci: 0.233, trad: 0.932, tier: 0, tradable: true},
    {name: "Other Aluminum Rolling, Drawing, and Extruding", code: "331318", employ: 4.07, sector: "Manufacturing", rca: 0.021, pci: 0.06, trad: 1.0, tier: 0, tradable: true},
    {name: "Nonferrous Metal (except Aluminum) Smelting and Refining", code: "331410", employ: 213.96, sector: "Manufacturing", rca: 4.119, pci: 1.481, trad: 1.0, tier: 0, tradable: true},
    {name: "Copper Rolling, Drawing, Extruding, and Alloying", code: "331420", employ: 82.5, sector: "Manufacturing", rca: 0.316, pci: 0.958, trad: 1.0, tier: 0, tradable: true},
    {name: "Secondary Smelting, Refining, and Alloying of Nonferrous Metal (except Copper and Aluminum)", code: "331492", employ: 159.76, sector: "Manufacturing", rca: 1.279, pci: 0.625, trad: 1.0, tier: 0, tradable: true},
    {name: "Iron Foundries", code: "331511", employ: 12.83, sector: "Manufacturing", rca: 0.062, pci: -0.301, trad: 0.92, tier: 0, tradable: true},
    {name: "Steel Investment Foundries", code: "331512", employ: 1.82, sector: "Manufacturing", rca: 0.018, pci: -0.301, trad: 0.92, tier: 0, tradable: true},
    {name: "Steel Foundries (except Investment)", code: "331513", employ: 36.2, sector: "Manufacturing", rca: 0.283, pci: -0.301, trad: 0.92, tier: 0, tradable: true},
    {name: "Nonferrous Metal Die-Casting Foundries", code: "331523", employ: 184.65, sector: "Manufacturing", rca: 0.76, pci: -0.182, trad: 0.9, tier: 0, tradable: true},
    {name: "Aluminum Foundries (except Die-Casting)", code: "331524", employ: 310.77, sector: "Manufacturing", rca: 1.225, pci: -0.182, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Nonferrous Metal Foundries (except Die-Casting)", code: "331529", employ: 92.48, sector: "Manufacturing", rca: 0.776, pci: -0.182, trad: 0.9, tier: 0, tradable: true},
    {name: "Iron and Steel Forging", code: "332111", employ: 4.85, sector: "Manufacturing", rca: 0.017, pci: -0.281, trad: 0.93, tier: 0, tradable: true},
    {name: "Custom Roll Forming", code: "332114", employ: 28.02, sector: "Manufacturing", rca: 0.59, pci: -0.281, trad: 0.93, tier: 0, tradable: true},
    {name: "Powder Metallurgy Part Manufacturing", code: "332117", employ: 41.52, sector: "Manufacturing", rca: 0.732, pci: -0.281, trad: 0.93, tier: 0, tradable: true},
    {name: "Metal Crown, Closure, and Other Metal Stamping (except Automotive)", code: "332119", employ: 291.64, sector: "Manufacturing", rca: 0.434, pci: -0.281, trad: 0.93, tier: 0, tradable: true},
    {name: "Metal Kitchen Cookware, Utensil, Cutlery, and Flatware (except Precious) Manufacturing", code: "332215", employ: 10.66, sector: "Manufacturing", rca: 0.135, pci: 1.418, trad: 1.0, tier: 0, tradable: true},
    {name: "Saw Blade and Handtool Manufacturing", code: "332216", employ: 289.59, sector: "Manufacturing", rca: 1.496, pci: 0.471, trad: 1.0, tier: 0, tradable: true},
    {name: "Prefabricated Metal Building and Component Manufacturing", code: "332311", employ: 3.82, sector: "Manufacturing", rca: 0.009, pci: -1.181, trad: 0.827, tier: 0, tradable: true},
    {name: "Fabricated Structural Metal Manufacturing", code: "332312", employ: 626.41, sector: "Manufacturing", rca: 0.411, pci: -1.181, trad: 0.827, tier: 0, tradable: true},
    {name: "Plate Work Manufacturing", code: "332313", employ: 67.89, sector: "Manufacturing", rca: 0.11, pci: -1.181, trad: 0.827, tier: 0, tradable: true},
    {name: "Metal Window and Door Manufacturing", code: "332321", employ: 127.78, sector: "Manufacturing", rca: 0.164, pci: -0.768, trad: 0.452, tier: 1, tradable: false},
    {name: "Sheet Metal Work Manufacturing", code: "332322", employ: 2259.38, sector: "Manufacturing", rca: 0.899, pci: -0.768, trad: 0.452, tier: 1, tradable: false},
    {name: "Ornamental and Architectural Metal Work Manufacturing", code: "332323", employ: 484.8, sector: "Manufacturing", rca: 0.519, pci: -0.768, trad: 0.452, tier: 1, tradable: false},
    {name: "Power Boiler and Heat Exchanger Manufacturing", code: "332410", employ: 127.71, sector: "Manufacturing", rca: 0.463, pci: 0.444, trad: 1.0, tier: 0, tradable: true},
    {name: "Metal Tank (Heavy Gauge) Manufacturing", code: "332420", employ: 407.07, sector: "Manufacturing", rca: 1.043, pci: -0.577, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Metal Container Manufacturing", code: "332439", employ: 189.78, sector: "Manufacturing", rca: 0.968, pci: 0.283, trad: 0.944, tier: 0, tradable: true},
    {name: "Hardware Manufacturing", code: "332510", employ: 21.63, sector: "Manufacturing", rca: 0.14, pci: 0.782, trad: 1.0, tier: 0, tradable: true},
    {name: "Spring Manufacturing", code: "332613", employ: 2.71, sector: "Manufacturing", rca: 0.018, pci: 0.094, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Fabricated Wire Product Manufacturing", code: "332618", employ: 46.88, sector: "Manufacturing", rca: 0.207, pci: 0.094, trad: 1.0, tier: 0, tradable: true},
    {name: "Machine Shops", code: "332710", employ: 7038.71, sector: "Manufacturing", rca: 1.5, pci: -1.182, trad: 0.5, tier: 1, tradable: true},
    {name: "Precision Turned Product Manufacturing", code: "332721", employ: 184.97, sector: "Manufacturing", rca: 0.289, pci: -0.146, trad: 1.0, tier: 0, tradable: true},
    {name: "Bolt, Nut, Screw, Rivet, and Washer Manufacturing", code: "332722", employ: 28.0, sector: "Manufacturing", rca: 0.046, pci: -0.146, trad: 1.0, tier: 0, tradable: true},
    {name: "Metal Heat Treating", code: "332811", employ: 91.16, sector: "Manufacturing", rca: 0.299, pci: -0.617, trad: 0.694, tier: 1, tradable: true},
    {name: "Metal Coating, Engraving (except Jewelry and Silverware), and Allied Services to Manufacturers", code: "332812", employ: 1088.0, sector: "Manufacturing", rca: 1.138, pci: -0.617, trad: 0.694, tier: 1, tradable: true},
    {name: "Electroplating, Plating, Polishing, Anodizing, and Coloring", code: "332813", employ: 1150.26, sector: "Manufacturing", rca: 1.216, pci: -0.617, trad: 0.694, tier: 1, tradable: true},
    {name: "Industrial Valve Manufacturing", code: "332911", employ: 220.42, sector: "Manufacturing", rca: 0.618, pci: 0.089, trad: 1.0, tier: 0, tradable: true},
    {name: "Fluid Power Valve and Hose Fitting Manufacturing", code: "332912", employ: 263.8, sector: "Manufacturing", rca: 0.545, pci: 0.089, trad: 1.0, tier: 0, tradable: true},
    {name: "Plumbing Fixture Fitting and Trim Manufacturing", code: "332913", employ: 740.11, sector: "Manufacturing", rca: 5.478, pci: 0.089, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Metal Valve and Pipe Fitting Manufacturing", code: "332919", employ: 723.89, sector: "Manufacturing", rca: 4.299, pci: 0.089, trad: 1.0, tier: 0, tradable: true},
    {name: "Ammunition (except Small Arms) Manufacturing", code: "332993", employ: 2.99, sector: "Manufacturing", rca: 0.06, pci: -0.381, trad: 1.0, tier: 0, tradable: true},
    {name: "Small Arms, Ordnance, and Ordnance Accessories Manufacturing", code: "332994", employ: 33.28, sector: "Manufacturing", rca: 0.126, pci: -0.381, trad: 1.0, tier: 0, tradable: true},
    {name: "Fabricated Pipe and Pipe Fitting Manufacturing", code: "332996", employ: 98.44, sector: "Manufacturing", rca: 0.227, pci: -0.381, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Fabricated Metal Product Manufacturing", code: "332999", employ: 297.21, sector: "Manufacturing", rca: 0.191, pci: -0.729, trad: 1.0, tier: 0, tradable: true},
    {name: "Lawn and Garden Tractor and Home Lawn and Garden Equipment Manufacturing", code: "333112", employ: 8.58, sector: "Manufacturing", rca: 0.108, pci: -1.627, trad: 1.0, tier: 0, tradable: true},
    {name: "Construction Machinery Manufacturing", code: "333120", employ: 8.85, sector: "Manufacturing", rca: 0.018, pci: -0.51, trad: 1.0, tier: 0, tradable: true},
    {name: "Food Product Machinery Manufacturing", code: "333241", employ: 87.09, sector: "Manufacturing", rca: 0.374, pci: 0.486, trad: 1.0, tier: 0, tradable: true},
    {name: "Semiconductor Machinery Manufacturing", code: "333242", employ: 2503.49, sector: "Manufacturing", rca: 4.022, pci: 0.421, trad: 1.0, tier: 0, tradable: true},
    {name: "Sawmill, Woodworking, and Paper Machinery Manufacturing", code: "333243", employ: 31.66, sector: "Manufacturing", rca: 0.185, pci: 0.421, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Industrial Machinery Manufacturing", code: "333248", employ: 2642.2, sector: "Manufacturing", rca: 2.679, pci: -0.038, trad: 1.0, tier: 0, tradable: true},
    {name: "Commercial and Service Industry Machinery Manufacturing", code: "333310", employ: 2127.62, sector: "Manufacturing", rca: 1.875, pci: 0.234, trad: 1.0, tier: 0, tradable: true},
    {name: "Industrial and Commercial Fan and Blower and Air Purification Equipment Manufacturing", code: "333413", employ: 135.0, sector: "Manufacturing", rca: 0.347, pci: -0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Heating Equipment (except Warm Air Furnaces) Manufacturing", code: "333414", employ: 628.67, sector: "Manufacturing", rca: 3.959, pci: -0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Air-Conditioning and Warm Air Heating Equipment and Commercial and Industrial Refrigeration Equipment Manufacturing", code: "333415", employ: 223.89, sector: "Manufacturing", rca: 0.261, pci: -0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Industrial Mold Manufacturing", code: "333511", employ: 34.19, sector: "Manufacturing", rca: 0.062, pci: -0.729, trad: 0.967, tier: 0, tradable: true},
    {name: "Special Die and Tool, Die Set, Jig, and Fixture Manufacturing", code: "333514", employ: 328.31, sector: "Manufacturing", rca: 0.353, pci: -0.729, trad: 0.967, tier: 0, tradable: true},
    {name: "Cutting Tool and Machine Tool Accessory Manufacturing", code: "333515", employ: 86.81, sector: "Manufacturing", rca: 0.266, pci: -0.729, trad: 0.967, tier: 0, tradable: true},
    {name: "Machine Tool Manufacturing", code: "333517", employ: 467.48, sector: "Manufacturing", rca: 0.782, pci: -0.729, trad: 0.967, tier: 0, tradable: true},
    {name: "Rolling Mill and Other Metalworking Machinery Manufacturing", code: "333519", employ: 43.21, sector: "Manufacturing", rca: 0.317, pci: -0.729, trad: 0.967, tier: 0, tradable: true},
    {name: "Turbine and Turbine Generator Set Units Manufacturing", code: "333611", employ: 17.3, sector: "Manufacturing", rca: 0.22, pci: -0.167, trad: 1.0, tier: 0, tradable: true},
    {name: "Speed Changer, Industrial High-Speed Drive, and Gear Manufacturing", code: "333612", employ: 47.9, sector: "Manufacturing", rca: 0.239, pci: -0.167, trad: 1.0, tier: 0, tradable: true},
    {name: "Mechanical Power Transmission Equipment Manufacturing", code: "333613", employ: 358.81, sector: "Manufacturing", rca: 2.888, pci: -0.167, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Engine Equipment Manufacturing", code: "333618", employ: 5.88, sector: "Manufacturing", rca: 0.05, pci: -0.167, trad: 1.0, tier: 0, tradable: true},
    {name: "Air and Gas Compressor Manufacturing", code: "333912", employ: 5.34, sector: "Manufacturing", rca: 0.027, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "Measuring, Dispensing, and Other Pumping Equipment Manufacturing", code: "333914", employ: 303.57, sector: "Manufacturing", rca: 0.837, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "Elevator and Moving Stairway Manufacturing", code: "333921", employ: 113.13, sector: "Manufacturing", rca: 0.644, pci: -0.382, trad: 1.0, tier: 0, tradable: true},
    {name: "Conveyor and Conveying Equipment Manufacturing", code: "333922", employ: 44.43, sector: "Manufacturing", rca: 0.093, pci: -0.382, trad: 1.0, tier: 0, tradable: true},
    {name: "Overhead Traveling Crane, Hoist, and Monorail System Manufacturing", code: "333923", employ: 22.79, sector: "Manufacturing", rca: 0.087, pci: -0.382, trad: 1.0, tier: 0, tradable: true},
    {name: "Industrial Truck, Tractor, Trailer, and Stacker Machinery Manufacturing", code: "333924", employ: 170.24, sector: "Manufacturing", rca: 0.911, pci: -0.382, trad: 1.0, tier: 0, tradable: true},
    {name: "Power-Driven Handtool Manufacturing", code: "333991", employ: 259.83, sector: "Manufacturing", rca: 1.766, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "Welding and Soldering Equipment Manufacturing", code: "333992", employ: 14.56, sector: "Manufacturing", rca: 0.06, pci: 0.1, trad: 1.0, tier: 0, tradable: true},
    {name: "Packaging Machinery Manufacturing", code: "333993", employ: 156.59, sector: "Manufacturing", rca: 0.357, pci: 1.105, trad: 1.0, tier: 0, tradable: true},
    {name: "Industrial Process Furnace and Oven Manufacturing", code: "333994", employ: 78.86, sector: "Manufacturing", rca: 0.372, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "Fluid Power Cylinder and Actuator Manufacturing", code: "333995", employ: 41.14, sector: "Manufacturing", rca: 0.189, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "Fluid Power Pump and Motor Manufacturing", code: "333996", employ: 120.92, sector: "Manufacturing", rca: 0.496, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous General Purpose Machinery Manufacturing", code: "333998", employ: 1155.8, sector: "Manufacturing", rca: 1.263, pci: 0.294, trad: 1.0, tier: 0, tradable: true},
    {name: "Electronic Computer Manufacturing", code: "334111", employ: 408.7, sector: "Manufacturing", rca: 0.562, pci: 1.505, trad: 1.0, tier: 0, tradable: true},
    {name: "Computer Storage Device Manufacturing", code: "334112", employ: 862.47, sector: "Manufacturing", rca: 4.631, pci: 1.505, trad: 1.0, tier: 0, tradable: true},
    {name: "Computer Terminal and Other Computer Peripheral Equipment Manufacturing", code: "334118", employ: 3592.0, sector: "Manufacturing", rca: 6.023, pci: 1.505, trad: 1.0, tier: 0, tradable: true},
    {name: "Telephone Apparatus Manufacturing", code: "334210", employ: 303.05, sector: "Manufacturing", rca: 1.023, pci: 2.85, trad: 1.0, tier: 0, tradable: true},
    {name: "Radio and Television Broadcasting and Wireless Communications Equipment Manufacturing", code: "334220", employ: 120.08, sector: "Manufacturing", rca: 0.163, pci: 1.463, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Communications Equipment Manufacturing", code: "334290", employ: 319.5, sector: "Manufacturing", rca: 1.504, pci: 1.394, trad: 1.0, tier: 0, tradable: true},
    {name: "Audio and Video Equipment Manufacturing", code: "334310", employ: 68.41, sector: "Manufacturing", rca: 0.328, pci: 1.933, trad: 1.0, tier: 0, tradable: true},
    {name: "Bare Printed Circuit Board Manufacturing", code: "334412", employ: 472.23, sector: "Manufacturing", rca: 1.136, pci: 0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Semiconductor and Related Device Manufacturing", code: "334413", employ: 5324.02, sector: "Manufacturing", rca: 1.429, pci: 0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Capacitor, Resistor, Coil, Transformer, and Other Inductor Manufacturing", code: "334416", employ: 705.1, sector: "Manufacturing", rca: 2.989, pci: 0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Electronic Connector Manufacturing", code: "334417", employ: 577.22, sector: "Manufacturing", rca: 1.62, pci: 0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Printed Circuit Assembly (Electronic Assembly) Manufacturing", code: "334418", employ: 1014.53, sector: "Manufacturing", rca: 0.923, pci: 1.145, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Electronic Component Manufacturing", code: "334419", employ: 2305.78, sector: "Manufacturing", rca: 1.824, pci: 0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Electromedical and Electrotherapeutic Apparatus Manufacturing", code: "334510", employ: 4478.4, sector: "Manufacturing", rca: 2.883, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing", code: "334511", employ: 3354.98, sector: "Manufacturing", rca: 2.369, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Automatic Environmental Control Manufacturing for Residential, Commercial, and Appliance Use", code: "334512", employ: 277.78, sector: "Manufacturing", rca: 1.648, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables", code: "334513", employ: 3119.21, sector: "Manufacturing", rca: 2.351, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Totalizing Fluid Meter and Counting Device Manufacturing", code: "334514", employ: 24.04, sector: "Manufacturing", rca: 0.296, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Instrument Manufacturing for Measuring and Testing Electricity and Electrical Signals", code: "334515", employ: 1753.7, sector: "Manufacturing", rca: 2.109, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Analytical Laboratory Instrument Manufacturing", code: "334516", employ: 7095.82, sector: "Manufacturing", rca: 9.045, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Irradiation Apparatus Manufacturing", code: "334517", employ: 575.58, sector: "Manufacturing", rca: 2.743, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Measuring and Controlling Device Manufacturing", code: "334519", employ: 1552.5, sector: "Manufacturing", rca: 1.875, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Manufacturing and Reproducing Magnetic and Optical Media", code: "334610", employ: 19.6, sector: "Manufacturing", rca: 0.194, pci: 2.204, trad: 1.0, tier: 0, tradable: true},
    {name: "Residential Electric Lighting Fixture Manufacturing", code: "335131", employ: 5.1, sector: "Manufacturing", rca: 0.053, pci: 1.03, trad: 1.0, tier: 0, tradable: true},
    {name: "Commercial, Industrial, and Institutional Electric Lighting Fixture Manufacturing", code: "335132", employ: 5.5, sector: "Manufacturing", rca: 0.028, pci: 1.03, trad: 1.0, tier: 0, tradable: true},
    {name: "Electric Lamp Bulb and Other Lighting Equipment Manufacturing", code: "335139", employ: 8.37, sector: "Manufacturing", rca: 0.081, pci: 1.441, trad: 1.0, tier: 0, tradable: true},
    {name: "Small Electrical Appliance Manufacturing", code: "335210", employ: 53.65, sector: "Manufacturing", rca: 0.417, pci: 0.705, trad: 1.0, tier: 0, tradable: true},
    {name: "Major Household Appliance Manufacturing", code: "335220", employ: 40.69, sector: "Manufacturing", rca: 0.256, pci: 0.938, trad: 1.0, tier: 0, tradable: true},
    {name: "Power, Distribution, and Specialty Transformer Manufacturing", code: "335311", employ: 25.41, sector: "Manufacturing", rca: 0.114, pci: 1.172, trad: 0.9, tier: 0, tradable: true},
    {name: "Motor and Generator Manufacturing", code: "335312", employ: 47.17, sector: "Manufacturing", rca: 0.115, pci: -0.066, trad: 1.0, tier: 0, tradable: true},
    {name: "Switchgear and Switchboard Apparatus Manufacturing", code: "335313", employ: 615.55, sector: "Manufacturing", rca: 1.184, pci: -0.066, trad: 1.0, tier: 0, tradable: true},
    {name: "Relay and Industrial Control Manufacturing", code: "335314", employ: 185.91, sector: "Manufacturing", rca: 0.263, pci: -0.066, trad: 1.0, tier: 0, tradable: true},
    {name: "Battery Manufacturing", code: "335910", employ: 690.15, sector: "Manufacturing", rca: 1.895, pci: 1.245, trad: 1.0, tier: 0, tradable: true},
    {name: "Fiber Optic Cable Manufacturing", code: "335921", employ: 1192.22, sector: "Manufacturing", rca: 7.311, pci: 1.47, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Communication and Energy Wire Manufacturing", code: "335929", employ: 17.25, sector: "Manufacturing", rca: 0.098, pci: 1.47, trad: 1.0, tier: 0, tradable: true},
    {name: "Current-Carrying Wiring Device Manufacturing", code: "335931", employ: 378.78, sector: "Manufacturing", rca: 1.432, pci: 0.637, trad: 1.0, tier: 0, tradable: true},
    {name: "Noncurrent-Carrying Wiring Device Manufacturing", code: "335932", employ: 10.03, sector: "Manufacturing", rca: 0.073, pci: 0.637, trad: 1.0, tier: 0, tradable: true},
    {name: "Carbon and Graphite Product Manufacturing", code: "335991", employ: 12.67, sector: "Manufacturing", rca: 0.116, pci: 1.416, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Electrical Equipment and Component Manufacturing", code: "335999", employ: 371.35, sector: "Manufacturing", rca: 0.787, pci: 0.667, trad: 1.0, tier: 0, tradable: true},
    {name: "Automobile and Light Duty Motor Vehicle Manufacturing", code: "336110", employ: 42.68, sector: "Manufacturing", rca: 0.075, pci: 0.854, trad: 1.0, tier: 0, tradable: true},
    {name: "Motor Vehicle Body Manufacturing", code: "336211", employ: 168.93, sector: "Manufacturing", rca: 0.362, pci: -1.134, trad: 1.0, tier: 0, tradable: true},
    {name: "Truck Trailer Manufacturing", code: "336212", employ: 9.38, sector: "Manufacturing", rca: 0.047, pci: -1.134, trad: 1.0, tier: 0, tradable: true},
    {name: "Travel Trailer and Camper Manufacturing", code: "336214", employ: 20.33, sector: "Manufacturing", rca: 0.041, pci: -1.134, trad: 1.0, tier: 0, tradable: true},
    {name: "Motor Vehicle Gasoline Engine and Engine Parts Manufacturing", code: "336310", employ: 53.92, sector: "Manufacturing", rca: 0.109, pci: -0.27, trad: 1.0, tier: 0, tradable: true},
    {name: "Motor Vehicle Electrical and Electronic Equipment Manufacturing", code: "336320", employ: 2.69, sector: "Manufacturing", rca: 0.004, pci: -0.061, trad: 1.0, tier: 0, tradable: true},
    {name: "Motor Vehicle Brake System Manufacturing", code: "336340", employ: 3.31, sector: "Manufacturing", rca: 0.014, pci: 0.916, trad: 1.0, tier: 0, tradable: true},
    {name: "Motor Vehicle Transmission and Power Train Parts Manufacturing", code: "336350", employ: 13.38, sector: "Manufacturing", rca: 0.018, pci: 0.24, trad: 1.0, tier: 0, tradable: true},
    {name: "Motor Vehicle Seating and Interior Trim Manufacturing", code: "336360", employ: 0.13, sector: "Manufacturing", rca: 0.0, pci: 0.05, trad: 1.0, tier: 0, tradable: true},
    {name: "Motor Vehicle Metal Stamping", code: "336370", employ: 3.13, sector: "Manufacturing", rca: 0.003, pci: -0.196, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Motor Vehicle Parts Manufacturing", code: "336390", employ: 3.6, sector: "Manufacturing", rca: 0.002, pci: -0.74, trad: 1.0, tier: 0, tradable: true},
    {name: "Aircraft Engine and Engine Parts Manufacturing", code: "336412", employ: 765.05, sector: "Manufacturing", rca: 0.479, pci: 0.427, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Aircraft Parts and Auxiliary Equipment Manufacturing", code: "336413", employ: 2347.55, sector: "Manufacturing", rca: 0.672, pci: 0.406, trad: 1.0, tier: 0, tradable: true},
    {name: "Guided Missile and Space Vehicle Manufacturing", code: "336414", employ: 3327.11, sector: "Manufacturing", rca: 4.102, pci: 0.427, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Guided Missile and Space Vehicle Parts and Auxiliary Equipment Manufacturing", code: "336419", employ: 2297.11, sector: "Manufacturing", rca: 10.327, pci: 0.427, trad: 1.0, tier: 0, tradable: true},
    {name: "Ship Building and Repairing", code: "336611", employ: 97.62, sector: "Manufacturing", rca: 0.134, pci: 0.109, trad: 0.94, tier: 0, tradable: true},
    {name: "Boat Building", code: "336612", employ: 100.54, sector: "Manufacturing", rca: 0.234, pci: 0.109, trad: 0.94, tier: 0, tradable: true},
    {name: "Motorcycle, Bicycle, and Parts Manufacturing", code: "336991", employ: 49.32, sector: "Manufacturing", rca: 0.31, pci: 0.911, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Transportation Equipment Manufacturing", code: "336999", employ: 3.91, sector: "Manufacturing", rca: 0.051, pci: 0.321, trad: 1.0, tier: 0, tradable: true},
    {name: "Wood Kitchen Cabinet and Countertop Manufacturing", code: "337110", employ: 718.01, sector: "Manufacturing", rca: 0.483, pci: -0.975, trad: 0.9, tier: 0, tradable: true},
    {name: "Upholstered Household Furniture Manufacturing", code: "337121", employ: 24.68, sector: "Manufacturing", rca: 0.05, pci: -0.583, trad: 0.976, tier: 0, tradable: true},
    {name: "Nonupholstered Wood Household Furniture Manufacturing", code: "337122", employ: 123.11, sector: "Manufacturing", rca: 0.418, pci: -0.583, trad: 0.976, tier: 0, tradable: true},
    {name: "Household Furniture (except Wood and Upholstered) Manufacturing", code: "337126", employ: 7.08, sector: "Manufacturing", rca: 0.088, pci: -0.583, trad: 0.976, tier: 0, tradable: true},
    {name: "Institutional Furniture Manufacturing", code: "337127", employ: 44.07, sector: "Manufacturing", rca: 0.266, pci: -0.583, trad: 0.976, tier: 0, tradable: true},
    {name: "Wood Office Furniture Manufacturing", code: "337211", employ: 10.98, sector: "Manufacturing", rca: 0.094, pci: -0.04, trad: 0.795, tier: 1, tradable: true},
    {name: "Custom Architectural Woodwork and Millwork Manufacturing", code: "337212", employ: 113.62, sector: "Manufacturing", rca: 0.288, pci: -0.04, trad: 0.795, tier: 1, tradable: true},
    {name: "Office Furniture (except Wood) Manufacturing", code: "337214", employ: 18.6, sector: "Manufacturing", rca: 0.08, pci: -0.04, trad: 0.795, tier: 1, tradable: true},
    {name: "Showcase, Partition, Shelving, and Locker Manufacturing", code: "337215", employ: 80.37, sector: "Manufacturing", rca: 0.205, pci: -0.04, trad: 0.795, tier: 1, tradable: true},
    {name: "Mattress Manufacturing", code: "337910", employ: 9.1, sector: "Manufacturing", rca: 0.053, pci: 1.16, trad: 0.9, tier: 0, tradable: true},
    {name: "Blind and Shade Manufacturing", code: "337920", employ: 14.0, sector: "Manufacturing", rca: 0.13, pci: 1.873, trad: 0.9, tier: 0, tradable: true},
    {name: "Surgical and Medical Instrument Manufacturing", code: "339112", employ: 3764.37, sector: "Manufacturing", rca: 1.575, pci: -0.097, trad: 0.892, tier: 0, tradable: true},
    {name: "Surgical Appliance and Supplies Manufacturing", code: "339113", employ: 2635.94, sector: "Manufacturing", rca: 1.686, pci: 0.371, trad: 1.0, tier: 0, tradable: true},
    {name: "Dental Equipment and Supplies Manufacturing", code: "339114", employ: 292.92, sector: "Manufacturing", rca: 1.529, pci: -0.097, trad: 0.892, tier: 0, tradable: true},
    {name: "Ophthalmic Goods Manufacturing", code: "339115", employ: 98.08, sector: "Manufacturing", rca: 0.286, pci: 1.175, trad: 1.0, tier: 0, tradable: true},
    {name: "Dental Laboratories", code: "339116", employ: 757.76, sector: "Manufacturing", rca: 0.712, pci: -0.097, trad: 0.892, tier: 0, tradable: true},
    {name: "Jewelry and Silverware Manufacturing", code: "339910", employ: 135.24, sector: "Manufacturing", rca: 0.355, pci: 0.846, trad: 1.0, tier: 0, tradable: true},
    {name: "Sporting and Athletic Goods Manufacturing", code: "339920", employ: 42.89, sector: "Manufacturing", rca: 0.082, pci: -0.198, trad: 1.0, tier: 0, tradable: true},
    {name: "Doll, Toy, and Game Manufacturing", code: "339930", employ: 80.74, sector: "Manufacturing", rca: 0.556, pci: 1.539, trad: 1.0, tier: 0, tradable: true},
    {name: "Office Supplies (except Paper) Manufacturing", code: "339940", employ: 36.61, sector: "Manufacturing", rca: 0.375, pci: 1.448, trad: 1.0, tier: 0, tradable: true},
    {name: "Sign Manufacturing", code: "339950", employ: 1583.45, sector: "Manufacturing", rca: 0.904, pci: -0.702, trad: 0.0, tier: 2, tradable: false},
    {name: "Gasket, Packing, and Sealing Device Manufacturing", code: "339991", employ: 1117.32, sector: "Manufacturing", rca: 3.264, pci: -0.516, trad: 1.0, tier: 0, tradable: true},
    {name: "Musical Instrument Manufacturing", code: "339992", employ: 187.5, sector: "Manufacturing", rca: 1.188, pci: 1.197, trad: 1.0, tier: 0, tradable: true},
    {name: "Fastener, Button, Needle, and Pin Manufacturing", code: "339993", employ: 35.17, sector: "Manufacturing", rca: 1.139, pci: 2.276, trad: 1.0, tier: 0, tradable: true},
    {name: "Broom, Brush, and Mop Manufacturing", code: "339994", employ: 89.12, sector: "Manufacturing", rca: 1.147, pci: 1.311, trad: 1.0, tier: 0, tradable: true},
    {name: "All Other Miscellaneous Manufacturing", code: "339999", employ: 99.52, sector: "Manufacturing", rca: 0.085, pci: -0.516, trad: 1.0, tier: 0, tradable: true},
    {name: "Automobile and Other Motor Vehicle Merchant Wholesalers", code: "423110", employ: 1051.14, sector: "Trade & Transportation", rca: 0.391, pci: -0.578, trad: 0.0, tier: 2, tradable: false},
    {name: "Motor Vehicle Supplies and New Parts Merchant Wholesalers", code: "423120", employ: 1330.55, sector: "Trade & Transportation", rca: 0.372, pci: -0.721, trad: 0.5, tier: 1, tradable: true},
    {name: "Tire and Tube Merchant Wholesalers", code: "423130", employ: 166.12, sector: "Trade & Transportation", rca: 0.31, pci: 0.099, trad: 0.536, tier: 1, tradable: true},
    {name: "Motor Vehicle Parts (Used) Merchant Wholesalers", code: "423140", employ: 140.9, sector: "Trade & Transportation", rca: 0.476, pci: -0.507, trad: 0.5, tier: 1, tradable: true},
    {name: "Furniture Merchant Wholesalers", code: "423210", employ: 585.85, sector: "Trade & Transportation", rca: 0.639, pci: 0.623, trad: 0.123, tier: 2, tradable: false},
    {name: "Home Furnishing Merchant Wholesalers", code: "423220", employ: 476.99, sector: "Trade & Transportation", rca: 0.417, pci: 0.45, trad: 0.5, tier: 1, tradable: true},
    {name: "Lumber, Plywood, Millwork, and Wood Panel Merchant Wholesalers", code: "423310", employ: 1448.97, sector: "Trade & Transportation", rca: 0.684, pci: -0.223, trad: 0.0, tier: 2, tradable: false},
    {name: "Brick, Stone, and Related Construction Material Merchant Wholesalers", code: "423320", employ: 983.21, sector: "Trade & Transportation", rca: 0.746, pci: -0.106, trad: 0.0, tier: 2, tradable: false},
    {name: "Roofing, Siding, and Insulation Material Merchant Wholesalers", code: "423330", employ: 877.49, sector: "Trade & Transportation", rca: 0.948, pci: 0.346, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Construction Material Merchant Wholesalers", code: "423390", employ: 628.33, sector: "Trade & Transportation", rca: 0.973, pci: -0.06, trad: 0.0, tier: 2, tradable: false},
    {name: "Photographic Equipment and Supplies Merchant Wholesalers", code: "423410", employ: 94.02, sector: "Trade & Transportation", rca: 0.669, pci: 2.07, trad: 0.9, tier: 0, tradable: true},
    {name: "Office Equipment Merchant Wholesalers", code: "423420", employ: 1253.46, sector: "Trade & Transportation", rca: 0.969, pci: 0.245, trad: 0.0, tier: 2, tradable: false},
    {name: "Computer and Computer Peripheral Equipment and Software Merchant Wholesalers", code: "423430", employ: 3874.41, sector: "Trade & Transportation", rca: 0.999, pci: 0.622, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Commercial Equipment Merchant Wholesalers", code: "423440", employ: 769.54, sector: "Trade & Transportation", rca: 0.691, pci: 0.451, trad: 0.007, tier: 2, tradable: false},
    {name: "Medical, Dental, and Hospital Equipment and Supplies Merchant Wholesalers", code: "423450", employ: 6687.65, sector: "Trade & Transportation", rca: 1.27, pci: -0.017, trad: 0.5, tier: 1, tradable: true},
    {name: "Ophthalmic Goods Merchant Wholesalers", code: "423460", employ: 123.48, sector: "Trade & Transportation", rca: 0.402, pci: 1.216, trad: 0.587, tier: 1, tradable: true},
    {name: "Other Professional Equipment and Supplies Merchant Wholesalers", code: "423490", employ: 1317.44, sector: "Trade & Transportation", rca: 2.148, pci: 0.8, trad: 0.5, tier: 1, tradable: true},
    {name: "Metal Service Centers and Other Metal Merchant Wholesalers", code: "423510", employ: 791.4, sector: "Trade & Transportation", rca: 0.347, pci: -0.807, trad: 0.195, tier: 2, tradable: false},
    {name: "Coal and Other Mineral and Ore Merchant Wholesalers", code: "423520", employ: 4.74, sector: "Trade & Transportation", rca: 0.051, pci: 0.923, trad: 0.9, tier: 0, tradable: true},
    {name: "Electrical Apparatus and Equipment, Wiring Supplies, and Related Equipment Merchant Wholesalers", code: "423610", employ: 3220.99, sector: "Trade & Transportation", rca: 0.854, pci: -0.823, trad: 0.0, tier: 2, tradable: false},
    {name: "Household Appliances, Electric Housewares, and Consumer Electronics Merchant Wholesalers", code: "423620", employ: 1974.89, sector: "Trade & Transportation", rca: 2.961, pci: 0.575, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Electronic Parts and Equipment Merchant Wholesalers", code: "423690", employ: 2740.13, sector: "Trade & Transportation", rca: 1.063, pci: 0.143, trad: 0.5, tier: 1, tradable: true},
    {name: "Hardware Merchant Wholesalers", code: "423710", employ: 931.22, sector: "Trade & Transportation", rca: 0.561, pci: -0.21, trad: 0.046, tier: 2, tradable: false},
    {name: "Plumbing and Heating Equipment and Supplies (Hydronics) Merchant Wholesalers", code: "423720", employ: 3125.59, sector: "Trade & Transportation", rca: 1.258, pci: -0.485, trad: 0.0, tier: 2, tradable: false},
    {name: "Warm Air Heating and Air-Conditioning Equipment and Supplies Merchant Wholesalers", code: "423730", employ: 868.62, sector: "Trade & Transportation", rca: 0.534, pci: 0.231, trad: 0.0, tier: 2, tradable: false},
    {name: "Refrigeration Equipment and Supplies Merchant Wholesalers", code: "423740", employ: 64.58, sector: "Trade & Transportation", rca: 0.251, pci: 0.778, trad: 0.5, tier: 1, tradable: true},
    {name: "Construction and Mining (except Oil Well) Machinery and Equipment Merchant Wholesalers", code: "423810", employ: 549.31, sector: "Trade & Transportation", rca: 0.298, pci: -0.666, trad: 0.5, tier: 1, tradable: true},
    {name: "Farm and Garden Machinery and Equipment Merchant Wholesalers", code: "423820", employ: 244.32, sector: "Trade & Transportation", rca: 0.191, pci: -1.815, trad: 0.9, tier: 0, tradable: true},
    {name: "Industrial Machinery and Equipment Merchant Wholesalers", code: "423830", employ: 3963.7, sector: "Trade & Transportation", rca: 0.567, pci: -0.989, trad: 0.5, tier: 1, tradable: true},
    {name: "Industrial Supplies Merchant Wholesalers", code: "423840", employ: 722.39, sector: "Trade & Transportation", rca: 0.347, pci: -0.844, trad: 0.5, tier: 1, tradable: true},
    {name: "Service Establishment Equipment and Supplies Merchant Wholesalers", code: "423850", employ: 812.18, sector: "Trade & Transportation", rca: 0.794, pci: -0.477, trad: 0.0, tier: 2, tradable: false},
    {name: "Transportation Equipment and Supplies (except Motor Vehicle) Merchant Wholesalers", code: "423860", employ: 82.1, sector: "Trade & Transportation", rca: 0.115, pci: 0.06, trad: 0.43, tier: 1, tradable: false},
    {name: "Sporting and Recreational Goods and Supplies Merchant Wholesalers", code: "423910", employ: 896.6, sector: "Trade & Transportation", rca: 0.74, pci: -0.072, trad: 0.04, tier: 2, tradable: false},
    {name: "Toy and Hobby Goods and Supplies Merchant Wholesalers", code: "423920", employ: 82.25, sector: "Trade & Transportation", rca: 0.182, pci: 0.721, trad: 0.555, tier: 1, tradable: true},
    {name: "Recyclable Material Merchant Wholesalers", code: "423930", employ: 752.13, sector: "Trade & Transportation", rca: 0.42, pci: -1.113, trad: 0.0, tier: 2, tradable: false},
    {name: "Jewelry, Watch, Precious Stone, and Precious Metal Merchant Wholesalers", code: "423940", employ: 240.52, sector: "Trade & Transportation", rca: 0.33, pci: 0.786, trad: 0.693, tier: 1, tradable: true},
    {name: "Other Miscellaneous Durable Goods Merchant Wholesalers", code: "423990", employ: 1029.5, sector: "Trade & Transportation", rca: 0.574, pci: -0.465, trad: 0.0, tier: 2, tradable: false},
    {name: "Printing and Writing Paper Merchant Wholesalers", code: "424110", employ: 83.59, sector: "Trade & Transportation", rca: 0.439, pci: 1.631, trad: 0.5, tier: 1, tradable: true},
    {name: "Stationery and Office Supplies Merchant Wholesalers", code: "424120", employ: 718.98, sector: "Trade & Transportation", rca: 1.341, pci: 0.338, trad: 0.5, tier: 1, tradable: true},
    {name: "Industrial and Personal Service Paper Merchant Wholesalers", code: "424130", employ: 1270.34, sector: "Trade & Transportation", rca: 1.186, pci: 0.476, trad: 0.0, tier: 2, tradable: false},
    {name: "Drugs and Druggists' Sundries Merchant Wholesalers", code: "424210", employ: 6292.0, sector: "Trade & Transportation", rca: 1.646, pci: 0.138, trad: 0.0, tier: 2, tradable: false},
    {name: "Piece Goods, Notions, and Other Dry Goods Merchant Wholesalers", code: "424310", employ: 322.67, sector: "Trade & Transportation", rca: 0.808, pci: 0.585, trad: 0.625, tier: 1, tradable: true},
    {name: "Footwear Merchant Wholesalers", code: "424340", employ: 886.45, sector: "Trade & Transportation", rca: 2.806, pci: 1.386, trad: 0.5, tier: 1, tradable: true},
    {name: "Clothing and Clothing Accessories Merchant Wholesalers", code: "424350", employ: 990.89, sector: "Trade & Transportation", rca: 0.545, pci: 0.352, trad: 0.572, tier: 1, tradable: true},
    {name: "General Line Grocery Merchant Wholesalers", code: "424410", employ: 2174.31, sector: "Trade & Transportation", rca: 0.466, pci: -0.086, trad: 0.004, tier: 2, tradable: false},
    {name: "Packaged Frozen Food Merchant Wholesalers", code: "424420", employ: 704.1, sector: "Trade & Transportation", rca: 1.247, pci: 0.573, trad: 0.5, tier: 1, tradable: true},
    {name: "Dairy Product (except Dried or Canned) Merchant Wholesalers", code: "424430", employ: 469.11, sector: "Trade & Transportation", rca: 0.818, pci: -0.232, trad: 0.182, tier: 2, tradable: false},
    {name: "Poultry and Poultry Product Merchant Wholesalers", code: "424440", employ: 32.31, sector: "Trade & Transportation", rca: 0.208, pci: 0.532, trad: 0.5, tier: 1, tradable: true},
    {name: "Confectionery Merchant Wholesalers", code: "424450", employ: 628.66, sector: "Trade & Transportation", rca: 0.676, pci: -1.101, trad: 0.0, tier: 2, tradable: false},
    {name: "Fish and Seafood Merchant Wholesalers", code: "424460", employ: 1900.73, sector: "Trade & Transportation", rca: 3.557, pci: 1.345, trad: 0.606, tier: 1, tradable: true},
    {name: "Meat and Meat Product Merchant Wholesalers", code: "424470", employ: 444.62, sector: "Trade & Transportation", rca: 0.484, pci: 0.078, trad: 0.151, tier: 2, tradable: false},
    {name: "Fresh Fruit and Vegetable Merchant Wholesalers", code: "424480", employ: 2200.19, sector: "Trade & Transportation", rca: 1.115, pci: 0.419, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Grocery and Related Products Merchant Wholesalers", code: "424490", employ: 2914.95, sector: "Trade & Transportation", rca: 0.551, pci: -0.688, trad: 0.0, tier: 2, tradable: false},
    {name: "Grain and Field Bean Merchant Wholesalers", code: "424510", employ: 24.59, sector: "Trade & Transportation", rca: 0.124, pci: -2.238, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Farm Product Raw Material Merchant Wholesalers", code: "424590", employ: 159.66, sector: "Trade & Transportation", rca: 0.732, pci: -0.169, trad: 0.9, tier: 0, tradable: true},
    {name: "Plastics Materials and Basic Forms and Shapes Merchant Wholesalers", code: "424610", employ: 359.76, sector: "Trade & Transportation", rca: 0.648, pci: 0.412, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Chemical and Allied Products Merchant Wholesalers", code: "424690", employ: 1245.08, sector: "Trade & Transportation", rca: 0.629, pci: -0.923, trad: 0.026, tier: 2, tradable: false},
    {name: "Petroleum Bulk Stations and Terminals", code: "424710", employ: 188.11, sector: "Trade & Transportation", rca: 0.41, pci: -1.342, trad: 0.808, tier: 0, tradable: true},
    {name: "Petroleum and Petroleum Products Merchant Wholesalers (except Bulk Stations and Terminals)", code: "424720", employ: 244.77, sector: "Trade & Transportation", rca: 0.256, pci: -1.281, trad: 0.5, tier: 1, tradable: true},
    {name: "Beer and Ale Merchant Wholesalers", code: "424810", employ: 772.49, sector: "Trade & Transportation", rca: 0.507, pci: -0.274, trad: 0.0, tier: 2, tradable: false},
    {name: "Wine and Distilled Alcoholic Beverage Merchant Wholesalers", code: "424820", employ: 892.89, sector: "Trade & Transportation", rca: 0.409, pci: 1.095, trad: 0.5, tier: 1, tradable: true},
    {name: "Farm Supplies Merchant Wholesalers", code: "424910", employ: 330.85, sector: "Trade & Transportation", rca: 0.225, pci: -1.768, trad: 0.9, tier: 0, tradable: true},
    {name: "Book, Periodical, and Newspaper Merchant Wholesalers", code: "424920", employ: 232.09, sector: "Trade & Transportation", rca: 0.853, pci: 0.68, trad: 0.827, tier: 0, tradable: true},
    {name: "Flower, Nursery Stock, and Florists' Supplies Merchant Wholesalers", code: "424930", employ: 547.71, sector: "Trade & Transportation", rca: 0.593, pci: 0.087, trad: 0.85, tier: 0, tradable: true},
    {name: "Tobacco Product and Electronic Cigarette Merchant Wholesalers", code: "424940", employ: 88.41, sector: "Trade & Transportation", rca: 0.322, pci: 0.492, trad: 0.5, tier: 1, tradable: true},
    {name: "Paint, Varnish, and Supplies Merchant Wholesalers", code: "424950", employ: 36.15, sector: "Trade & Transportation", rca: 0.088, pci: 0.095, trad: 0.342, tier: 1, tradable: false},
    {name: "Other Miscellaneous Nondurable Goods Merchant Wholesalers", code: "424990", employ: 520.8, sector: "Trade & Transportation", rca: 0.305, pci: -0.216, trad: 0.0, tier: 2, tradable: false},
    {name: "Wholesale Trade Agents and Brokers", code: "425120", employ: 6490.0, sector: "Trade & Transportation", rca: 0.96, pci: -0.156, trad: 0.9, tier: 0, tradable: true},
    {name: "New Car Dealers", code: "441110", employ: 15558.11, sector: "Trade & Transportation", rca: 0.722, pci: -1.189, trad: 0.0, tier: 2, tradable: false},
    {name: "Used Car Dealers", code: "441120", employ: 1518.89, sector: "Trade & Transportation", rca: 0.45, pci: -1.222, trad: 0.0, tier: 2, tradable: false},
    {name: "Recreational Vehicle Dealers", code: "441210", employ: 174.34, sector: "Trade & Transportation", rca: 0.187, pci: -0.706, trad: 0.5, tier: 1, tradable: true},
    {name: "Boat Dealers", code: "441222", employ: 543.31, sector: "Trade & Transportation", rca: 0.848, pci: -0.959, trad: 0.193, tier: 2, tradable: false},
    {name: "Motorcycle, ATV, and All Other Motor Vehicle Dealers", code: "441227", employ: 598.35, sector: "Trade & Transportation", rca: 0.439, pci: -0.959, trad: 0.193, tier: 2, tradable: false},
    {name: "Automotive Parts and Accessories Retailers", code: "441330", employ: 4263.56, sector: "Trade & Transportation", rca: 0.623, pci: -1.399, trad: 0.0, tier: 2, tradable: false},
    {name: "Tire Dealers", code: "441340", employ: 1662.44, sector: "Trade & Transportation", rca: 0.495, pci: -1.332, trad: 0.0, tier: 2, tradable: false},
    {name: "Home Centers", code: "444110", employ: 8534.4, sector: "Trade & Transportation", rca: 0.951, pci: -1.12, trad: 0.0, tier: 2, tradable: false},
    {name: "Paint and Wallpaper Retailers", code: "444120", employ: 465.21, sector: "Trade & Transportation", rca: 0.557, pci: -0.871, trad: 0.0, tier: 2, tradable: false},
    {name: "Hardware Retailers", code: "444140", employ: 2747.49, sector: "Trade & Transportation", rca: 0.702, pci: -1.385, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Building Material Dealers", code: "444180", employ: 4635.9, sector: "Trade & Transportation", rca: 0.627, pci: -0.931, trad: 0.0, tier: 2, tradable: false},
    {name: "Outdoor Power Equipment Retailers", code: "444230", employ: 486.62, sector: "Trade & Transportation", rca: 0.825, pci: -1.005, trad: 0.378, tier: 1, tradable: false},
    {name: "Nursery, Garden Center, and Farm Supply Retailers", code: "444240", employ: 1802.38, sector: "Trade & Transportation", rca: 0.788, pci: -1.443, trad: 0.0, tier: 2, tradable: false},
    {name: "Supermarkets and Other Grocery Retailers (except Convenience Retailers)", code: "445110", employ: 56666.06, sector: "Trade & Transportation", rca: 1.148, pci: -1.109, trad: 0.0, tier: 2, tradable: false},
    {name: "Convenience Retailers", code: "445131", employ: 3452.94, sector: "Trade & Transportation", rca: 1.052, pci: -0.92, trad: 0.0, tier: 2, tradable: false},
    {name: "Vending Machine Operators", code: "445132", employ: 309.0, sector: "Trade & Transportation", rca: 0.424, pci: -0.438, trad: 0.497, tier: 1, tradable: false},
    {name: "Fruit and Vegetable Retailers", code: "445230", employ: 1017.4, sector: "Trade & Transportation", rca: 1.649, pci: 0.019, trad: 0.334, tier: 1, tradable: false},
    {name: "Meat Retailers", code: "445240", employ: 697.29, sector: "Trade & Transportation", rca: 0.629, pci: -1.071, trad: 0.0, tier: 2, tradable: false},
    {name: "Fish and Seafood Retailers", code: "445250", employ: 591.97, sector: "Trade & Transportation", rca: 1.96, pci: 0.999, trad: 0.5, tier: 1, tradable: true},
    {name: "Baked Goods Retailers", code: "445291", employ: 534.46, sector: "Trade & Transportation", rca: 1.434, pci: -0.493, trad: 0.039, tier: 2, tradable: false},
    {name: "Confectionery and Nut Retailers", code: "445292", employ: 482.4, sector: "Trade & Transportation", rca: 1.348, pci: 0.379, trad: 0.184, tier: 2, tradable: false},
    {name: "All Other Specialty Food Retailers", code: "445298", employ: 1272.61, sector: "Trade & Transportation", rca: 0.784, pci: -0.493, trad: 0.039, tier: 2, tradable: false},
    {name: "Beer, Wine, and Liquor Retailers", code: "445320", employ: 4369.07, sector: "Trade & Transportation", rca: 1.365, pci: -1.206, trad: 0.0, tier: 2, tradable: false},
    {name: "Furniture Retailers", code: "449110", employ: 4384.98, sector: "Trade & Transportation", rca: 1.065, pci: -1.132, trad: 0.0, tier: 2, tradable: false},
    {name: "Floor Covering Retailers", code: "449121", employ: 848.38, sector: "Trade & Transportation", rca: 0.697, pci: -0.82, trad: 0.0, tier: 2, tradable: false},
    {name: "Window Treatment Retailers", code: "449122", employ: 207.07, sector: "Trade & Transportation", rca: 0.825, pci: 0.184, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other Home Furnishings Retailers", code: "449129", employ: 3196.57, sector: "Trade & Transportation", rca: 1.293, pci: 0.184, trad: 0.0, tier: 2, tradable: false},
    {name: "Electronics and Appliance Retailers", code: "449210", employ: 5895.0, sector: "Trade & Transportation", rca: 0.766, pci: -0.918, trad: 0.0, tier: 2, tradable: false},
    {name: "Department Stores", code: "455110", employ: 21646.0, sector: "Trade & Transportation", rca: 1.051, pci: -0.381, trad: 0.0, tier: 2, tradable: false},
    {name: "Warehouse Clubs and Supercenters", code: "455211", employ: 4506.47, sector: "Trade & Transportation", rca: 0.223, pci: -1.449, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other General Merchandise Retailers", code: "455219", employ: 7356.53, sector: "Trade & Transportation", rca: 0.432, pci: -1.611, trad: 0.087, tier: 2, tradable: false},
    {name: "Pharmacies and Drug Retailers", code: "456110", employ: 13224.2, sector: "Trade & Transportation", rca: 0.985, pci: -1.265, trad: 0.0, tier: 2, tradable: false},
    {name: "Cosmetics, Beauty Supplies, and Perfume Retailers", code: "456120", employ: 2496.6, sector: "Trade & Transportation", rca: 0.68, pci: -0.413, trad: 0.0, tier: 2, tradable: false},
    {name: "Optical Goods Retailers", code: "456130", employ: 968.42, sector: "Trade & Transportation", rca: 0.684, pci: 0.152, trad: 0.0, tier: 2, tradable: false},
    {name: "Food (Health) Supplement Retailers", code: "456191", employ: 306.33, sector: "Trade & Transportation", rca: 0.356, pci: -0.734, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other Health and Personal Care Retailers", code: "456199", employ: 566.45, sector: "Trade & Transportation", rca: 0.439, pci: -0.64, trad: 0.005, tier: 2, tradable: false},
    {name: "Gasoline Stations with Convenience Stores", code: "457110", employ: 5179.43, sector: "Trade & Transportation", rca: 0.486, pci: -1.576, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Gasoline Stations", code: "457120", employ: 2079.57, sector: "Trade & Transportation", rca: 1.81, pci: -1.396, trad: 0.465, tier: 1, tradable: false},
    {name: "Fuel Dealers", code: "457210", employ: 3125.0, sector: "Trade & Transportation", rca: 3.328, pci: -1.266, trad: 0.5, tier: 1, tradable: true},
    {name: "Clothing and Clothing Accessories Retailers", code: "458110", employ: 15298.0, sector: "Trade & Transportation", rca: 0.891, pci: -0.658, trad: 0.0, tier: 2, tradable: false},
    {name: "Shoe Retailers", code: "458210", employ: 3121.04, sector: "Trade & Transportation", rca: 0.908, pci: -0.404, trad: 0.0, tier: 2, tradable: false},
    {name: "Jewelry Retailers", code: "458310", employ: 1875.57, sector: "Trade & Transportation", rca: 0.853, pci: -0.68, trad: 0.0, tier: 2, tradable: false},
    {name: "Luggage and Leather Goods Retailers", code: "458320", employ: 368.67, sector: "Trade & Transportation", rca: 1.341, pci: 1.587, trad: 0.275, tier: 1, tradable: false},
    {name: "Sporting Goods Retailers", code: "459110", employ: 4954.9, sector: "Trade & Transportation", rca: 0.817, pci: -0.791, trad: 0.0, tier: 2, tradable: false},
    {name: "Hobby, Toy, and Game Retailers", code: "459120", employ: 1537.86, sector: "Trade & Transportation", rca: 0.594, pci: -0.369, trad: 0.0, tier: 2, tradable: false},
    {name: "Sewing, Needlework, and Piece Goods Retailers", code: "459130", employ: 433.13, sector: "Trade & Transportation", rca: 0.961, pci: -0.388, trad: 0.0, tier: 2, tradable: false},
    {name: "Musical Instrument and Supplies Retailers", code: "459140", employ: 453.12, sector: "Trade & Transportation", rca: 0.839, pci: 0.091, trad: 0.0, tier: 2, tradable: false},
    {name: "Book Retailers and News Dealers", code: "459210", employ: 2166.07, sector: "Trade & Transportation", rca: 1.855, pci: -0.179, trad: 0.0, tier: 2, tradable: false},
    {name: "Florists", code: "459310", employ: 1245.84, sector: "Trade & Transportation", rca: 1.333, pci: -1.218, trad: 0.0, tier: 2, tradable: false},
    {name: "Office Supplies and Stationery Retailers", code: "459410", employ: 1153.23, sector: "Trade & Transportation", rca: 0.919, pci: -0.57, trad: 0.0, tier: 2, tradable: false},
    {name: "Gift, Novelty, and Souvenir Retailers", code: "459420", employ: 1919.77, sector: "Trade & Transportation", rca: 0.772, pci: -0.618, trad: 0.5, tier: 1, tradable: true},
    {name: "Used Merchandise Retailers", code: "459510", employ: 2000.0, sector: "Trade & Transportation", rca: 0.5, pci: -0.836, trad: 0.0, tier: 2, tradable: false},
    {name: "Pet and Pet Supplies Retailers", code: "459910", employ: 1756.82, sector: "Trade & Transportation", rca: 0.704, pci: -0.339, trad: 0.0, tier: 2, tradable: false},
    {name: "Art Dealers", code: "459920", employ: 205.52, sector: "Trade & Transportation", rca: 0.667, pci: 0.581, trad: 0.802, tier: 0, tradable: true},
    {name: "Manufactured (Mobile) Home Dealers", code: "459930", employ: 31.19, sector: "Trade & Transportation", rca: 0.223, pci: -0.944, trad: 0.5, tier: 1, tradable: true},
    {name: "Tobacco, Electronic Cigarette, and Other Smoking Supplies Retailers", code: "459991", employ: 2575.31, sector: "Trade & Transportation", rca: 0.93, pci: -1.202, trad: 0.074, tier: 2, tradable: false},
    {name: "All Other Miscellaneous Retailers", code: "459999", employ: 3593.15, sector: "Trade & Transportation", rca: 0.982, pci: -0.761, trad: 0.0, tier: 2, tradable: false},
    {name: "Scheduled Passenger Air Transportation", code: "481111", employ: 9993.01, sector: "Trade & Transportation", rca: 1.275, pci: 1.962, trad: 1.0, tier: 0, tradable: true},
    {name: "Scheduled Freight Air Transportation", code: "481112", employ: 800.35, sector: "Trade & Transportation", rca: 1.214, pci: 1.962, trad: 1.0, tier: 0, tradable: true},
    {name: "Nonscheduled Chartered Passenger Air Transportation", code: "481211", employ: 209.51, sector: "Trade & Transportation", rca: 0.398, pci: 0.109, trad: 1.0, tier: 0, tradable: true},
    {name: "Nonscheduled Chartered Freight Air Transportation", code: "481212", employ: 181.25, sector: "Trade & Transportation", rca: 1.376, pci: 0.109, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Nonscheduled Air Transportation", code: "481219", employ: 32.4, sector: "Trade & Transportation", rca: 0.345, pci: 0.109, trad: 1.0, tier: 0, tradable: true},
    {name: "Deep Sea Freight Transportation", code: "483111", employ: 9.44, sector: "Trade & Transportation", rca: 0.052, pci: 2.243, trad: 1.0, tier: 0, tradable: true},
    {name: "Deep Sea Passenger Transportation", code: "483112", employ: 24.58, sector: "Trade & Transportation", rca: 0.08, pci: 2.243, trad: 1.0, tier: 0, tradable: true},
    {name: "Coastal and Great Lakes Freight Transportation", code: "483113", employ: 41.04, sector: "Trade & Transportation", rca: 0.308, pci: 2.072, trad: 1.0, tier: 0, tradable: true},
    {name: "Coastal and Great Lakes Passenger Transportation", code: "483114", employ: 30.72, sector: "Trade & Transportation", rca: 1.545, pci: 2.243, trad: 1.0, tier: 0, tradable: true},
    {name: "Inland Water Freight Transportation", code: "483211", employ: 1.36, sector: "Trade & Transportation", rca: 0.006, pci: 0.702, trad: 1.0, tier: 0, tradable: true},
    {name: "Inland Water Passenger Transportation", code: "483212", employ: 62.43, sector: "Trade & Transportation", rca: 0.971, pci: 0.702, trad: 1.0, tier: 0, tradable: true},
    {name: "General Freight Trucking, Local", code: "484110", employ: 4156.18, sector: "Trade & Transportation", rca: 0.671, pci: -1.2, trad: 0.0, tier: 2, tradable: false},
    {name: "General Freight Trucking, Long-Distance, Truckload", code: "484121", employ: 532.15, sector: "Trade & Transportation", rca: 0.065, pci: -1.363, trad: 0.5, tier: 1, tradable: true},
    {name: "General Freight Trucking, Long-Distance, Less Than Truckload", code: "484122", employ: 1050.67, sector: "Trade & Transportation", rca: 0.221, pci: -1.363, trad: 0.5, tier: 1, tradable: true},
    {name: "Used Household and Office Goods Moving", code: "484210", employ: 2280.82, sector: "Trade & Transportation", rca: 1.178, pci: 0.106, trad: 0.5, tier: 1, tradable: true},
    {name: "Specialized Freight (except Used Goods) Trucking, Local", code: "484220", employ: 1293.34, sector: "Trade & Transportation", rca: 0.357, pci: -1.603, trad: 0.423, tier: 1, tradable: false},
    {name: "Specialized Freight (except Used Goods) Trucking, Long-Distance", code: "484230", employ: 375.84, sector: "Trade & Transportation", rca: 0.184, pci: -1.603, trad: 0.594, tier: 1, tradable: true},
    {name: "Mixed Mode Transit Systems", code: "485111", employ: 90.83, sector: "Trade & Transportation", rca: 2.929, pci: 1.285, trad: 0.5, tier: 1, tradable: true},
    {name: "Bus and Other Motor Vehicle Transit Systems", code: "485113", employ: 472.7, sector: "Trade & Transportation", rca: 1.876, pci: 1.285, trad: 0.5, tier: 1, tradable: true},
    {name: "Interurban and Rural Bus Transportation", code: "485210", employ: 289.9, sector: "Trade & Transportation", rca: 2.453, pci: 0.671, trad: 0.697, tier: 1, tradable: true},
    {name: "Taxi and Ridesharing Services", code: "485310", employ: 664.03, sector: "Trade & Transportation", rca: 0.75, pci: -0.266, trad: 0.5, tier: 1, tradable: true},
    {name: "Limousine Service", code: "485320", employ: 1341.33, sector: "Trade & Transportation", rca: 1.571, pci: 0.867, trad: 0.283, tier: 1, tradable: false},
    {name: "School and Employee Bus Transportation", code: "485410", employ: 7129.71, sector: "Trade & Transportation", rca: 2.29, pci: -0.664, trad: 0.495, tier: 1, tradable: false},
    {name: "Charter Bus Industry", code: "485510", employ: 448.48, sector: "Trade & Transportation", rca: 1.693, pci: 0.322, trad: 0.5, tier: 1, tradable: true},
    {name: "Special Needs Transportation", code: "485991", employ: 2442.15, sector: "Trade & Transportation", rca: 2.012, pci: -0.352, trad: 0.084, tier: 2, tradable: false},
    {name: "All Other Transit and Ground Passenger Transportation", code: "485999", employ: 1371.56, sector: "Trade & Transportation", rca: 1.935, pci: -0.352, trad: 0.084, tier: 2, tradable: false},
    {name: "Pipeline Transportation of Natural Gas", code: "486210", employ: 32.32, sector: "Trade & Transportation", rca: 0.096, pci: -1.755, trad: 0.9, tier: 0, tradable: true},
    {name: "Pipeline Transportation of Refined Petroleum Products", code: "486910", employ: 1.36, sector: "Trade & Transportation", rca: 0.017, pci: 0.29, trad: 0.9, tier: 0, tradable: true},
    {name: "Scenic and Sightseeing Transportation, Land", code: "487110", employ: 56.75, sector: "Trade & Transportation", rca: 0.437, pci: 1.25, trad: 0.9, tier: 0, tradable: true},
    {name: "Scenic and Sightseeing Transportation, Water", code: "487210", employ: 91.09, sector: "Trade & Transportation", rca: 0.387, pci: 1.26, trad: 0.9, tier: 0, tradable: true},
    {name: "Scenic and Sightseeing Transportation, Other", code: "487990", employ: 2.62, sector: "Trade & Transportation", rca: 0.061, pci: 1.97, trad: 0.9, tier: 0, tradable: true},
    {name: "Air Traffic Control", code: "488111", employ: 12.08, sector: "Trade & Transportation", rca: 0.118, pci: 1.246, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Airport Operations", code: "488119", employ: 2693.03, sector: "Trade & Transportation", rca: 2.108, pci: 0.897, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Support Activities for Air Transportation", code: "488190", employ: 595.31, sector: "Trade & Transportation", rca: 0.156, pci: -0.591, trad: 0.9, tier: 0, tradable: true},
    {name: "Support Activities for Rail Transportation", code: "488210", employ: 42.44, sector: "Trade & Transportation", rca: 0.098, pci: -0.663, trad: 0.9, tier: 0, tradable: true},
    {name: "Port and Harbor Operations", code: "488310", employ: 3.52, sector: "Trade & Transportation", rca: 0.039, pci: 1.315, trad: 0.9, tier: 0, tradable: true},
    {name: "Marine Cargo Handling", code: "488320", employ: 5.02, sector: "Trade & Transportation", rca: 0.004, pci: 0.89, trad: 0.9, tier: 0, tradable: true},
    {name: "Navigational Services to Shipping", code: "488330", employ: 30.73, sector: "Trade & Transportation", rca: 0.091, pci: 0.981, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Support Activities for Water Transportation", code: "488390", employ: 26.1, sector: "Trade & Transportation", rca: 0.142, pci: 1.412, trad: 0.9, tier: 0, tradable: true},
    {name: "Motor Vehicle Towing", code: "488410", employ: 1264.19, sector: "Trade & Transportation", rca: 0.899, pci: -0.945, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Support Activities for Road Transportation", code: "488490", employ: 160.11, sector: "Trade & Transportation", rca: 0.252, pci: -0.166, trad: 0.5, tier: 1, tradable: true},
    {name: "Freight Transportation Arrangement", code: "488510", employ: 1948.37, sector: "Trade & Transportation", rca: 0.379, pci: -0.344, trad: 0.9, tier: 0, tradable: true},
    {name: "Packing and Crating", code: "488991", employ: 190.19, sector: "Trade & Transportation", rca: 0.773, pci: 0.082, trad: 0.72, tier: 1, tradable: true},
    {name: "All Other Support Activities for Transportation", code: "488999", employ: 123.95, sector: "Trade & Transportation", rca: 0.518, pci: 0.082, trad: 0.72, tier: 1, tradable: true},
    {name: "Couriers and Express Delivery Services", code: "492110", employ: 10903.42, sector: "Trade & Transportation", rca: 0.699, pci: -0.429, trad: 1.0, tier: 0, tradable: true},
    {name: "Local Messengers and Local Delivery", code: "492210", employ: 2154.0, sector: "Trade & Transportation", rca: 0.631, pci: 0.234, trad: 0.0, tier: 2, tradable: false},
    {name: "General Warehousing and Storage", code: "493110", employ: 7320.41, sector: "Trade & Transportation", rca: 0.233, pci: -0.546, trad: 0.367, tier: 1, tradable: false},
    {name: "Refrigerated Warehousing and Storage", code: "493120", employ: 2083.5, sector: "Trade & Transportation", rca: 1.574, pci: -0.157, trad: 0.5, tier: 1, tradable: true},
    {name: "Farm Product Warehousing and Storage", code: "493130", employ: 1.38, sector: "Trade & Transportation", rca: 0.007, pci: -2.127, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Warehousing and Storage", code: "493190", employ: 162.72, sector: "Trade & Transportation", rca: 0.142, pci: -0.104, trad: 0.5, tier: 1, tradable: true},
    {name: "Motion Picture and Video Production", code: "512110", employ: 2191.77, sector: "Professional & Business", rca: 0.49, pci: 0.783, trad: 1.0, tier: 0, tradable: true},
    {name: "Motion Picture and Video Distribution", code: "512120", employ: 35.13, sector: "Professional & Business", rca: 0.285, pci: 2.419, trad: 1.0, tier: 0, tradable: true},
    {name: "Motion Picture Theaters (except Drive-Ins)", code: "512131", employ: 1217.61, sector: "Professional & Business", rca: 1.135, pci: -0.847, trad: 0.007, tier: 2, tradable: false},
    {name: "Drive-In Motion Picture Theaters", code: "512132", employ: 7.06, sector: "Professional & Business", rca: 0.17, pci: -0.847, trad: 0.007, tier: 2, tradable: false},
    {name: "Teleproduction and Other Postproduction Services", code: "512191", employ: 124.17, sector: "Professional & Business", rca: 0.359, pci: 1.476, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Motion Picture and Video Industries", code: "512199", employ: 40.28, sector: "Professional & Business", rca: 0.627, pci: 1.476, trad: 1.0, tier: 0, tradable: true},
    {name: "Music Publishers", code: "512230", employ: 10.62, sector: "Professional & Business", rca: 0.084, pci: 2.047, trad: 1.0, tier: 0, tradable: true},
    {name: "Sound Recording Studios", code: "512240", employ: 81.87, sector: "Professional & Business", rca: 0.787, pci: 1.962, trad: 1.0, tier: 0, tradable: true},
    {name: "Record Production and Distribution", code: "512250", employ: 21.48, sector: "Professional & Business", rca: 0.159, pci: 2.401, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Sound Recording Industries", code: "512290", employ: 22.81, sector: "Professional & Business", rca: 0.521, pci: 2.221, trad: 1.0, tier: 0, tradable: true},
    {name: "Newspaper Publishers", code: "513110", employ: 1855.94, sector: "Professional & Business", rca: 1.246, pci: -1.277, trad: 0.5, tier: 1, tradable: true},
    {name: "Periodical Publishers", code: "513120", employ: 2193.08, sector: "Professional & Business", rca: 1.496, pci: 0.405, trad: 1.0, tier: 0, tradable: true},
    {name: "Book Publishers", code: "513130", employ: 2457.19, sector: "Professional & Business", rca: 2.435, pci: 0.528, trad: 1.0, tier: 0, tradable: true},
    {name: "Directory and Mailing List Publishers", code: "513140", employ: 912.39, sector: "Professional & Business", rca: 4.299, pci: 1.087, trad: 0.9, tier: 0, tradable: true},
    {name: "Greeting Card Publishers", code: "513191", employ: 42.37, sector: "Professional & Business", rca: 2.773, pci: 0.852, trad: 0.9, tier: 0, tradable: true},
    {name: "All Other Publishers", code: "513199", employ: 314.73, sector: "Professional & Business", rca: 0.69, pci: 0.852, trad: 0.9, tier: 0, tradable: true},
    {name: "Software Publishers", code: "513210", employ: 37825.75, sector: "Professional & Business", rca: 3.269, pci: 0.622, trad: 1.0, tier: 0, tradable: true},
    {name: "Radio Broadcasting Stations", code: "516110", employ: 638.27, sector: "Professional & Business", rca: 0.871, pci: -1.272, trad: 0.5, tier: 1, tradable: true},
    {name: "Television Broadcasting Stations", code: "516120", employ: 1749.87, sector: "Professional & Business", rca: 1.424, pci: 0.83, trad: 0.5, tier: 1, tradable: true},
    {name: "Media Streaming Distribution Services, Social Networks, and Other Media Networks and Content Providers", code: "516210", employ: 2770.55, sector: "Professional & Business", rca: 0.752, pci: -0.156, trad: 0.9, tier: 0, tradable: true},
    {name: "Wired Telecommunications Carriers", code: "517111", employ: 5535.88, sector: "Professional & Business", rca: 0.877, pci: -1.101, trad: 0.5, tier: 1, tradable: true},
    {name: "Wireless Telecommunications Carriers (except Satellite)", code: "517112", employ: 1151.43, sector: "Professional & Business", rca: 1.0, pci: -0.979, trad: 0.5, tier: 1, tradable: true},
    {name: "Telecommunications Resellers", code: "517121", employ: 458.88, sector: "Professional & Business", rca: 0.531, pci: -0.475, trad: 0.5, tier: 1, tradable: true},
    {name: "Satellite Telecommunications", code: "517410", employ: 38.36, sector: "Professional & Business", rca: 0.327, pci: 1.133, trad: 0.9, tier: 0, tradable: true},
    {name: "All Other Telecommunications", code: "517810", employ: 756.53, sector: "Professional & Business", rca: 2.34, pci: -0.475, trad: 0.5, tier: 1, tradable: true},
    {name: "Computing Infrastructure Providers, Data Processing, Web Hosting, and Related Services", code: "518210", employ: 8116.07, sector: "Professional & Business", rca: 1.012, pci: 0.08, trad: 0.9, tier: 0, tradable: true},
    {name: "Libraries and Archives", code: "519210", employ: 330.96, sector: "Professional & Business", rca: 0.802, pci: 0.184, trad: 0.5, tier: 1, tradable: true},
    {name: "Web Search Portals and All Other Information Services", code: "519290", employ: 4839.39, sector: "Professional & Business", rca: 2.351, pci: 0.722, trad: 1.0, tier: 0, tradable: true},
    {name: "Monetary Authorities-Central Bank", code: "521110", employ: 10.84, sector: "Financial Activities", rca: 0.229, pci: 1.851, trad: 0.83, tier: 0, tradable: true},
    {name: "Commercial Banking", code: "522110", employ: 20466.41, sector: "Financial Activities", rca: 0.795, pci: -1.472, trad: 0.5, tier: 1, tradable: true},
    {name: "Credit Unions", code: "522130", employ: 4119.68, sector: "Financial Activities", rca: 0.939, pci: -1.089, trad: 0.016, tier: 2, tradable: false},
    {name: "Savings Institutions and Other Depository Credit Intermediation", code: "522180", employ: 6619.91, sector: "Financial Activities", rca: 4.966, pci: -0.874, trad: 0.5, tier: 1, tradable: true},
    {name: "Credit Card Issuing", code: "522210", employ: 16.74, sector: "Financial Activities", rca: 0.026, pci: 1.374, trad: 1.0, tier: 0, tradable: true},
    {name: "Sales Financing", code: "522220", employ: 377.24, sector: "Financial Activities", rca: 0.305, pci: -0.64, trad: 1.0, tier: 0, tradable: true},
    {name: "Consumer Lending", code: "522291", employ: 762.68, sector: "Financial Activities", rca: 0.392, pci: -1.379, trad: 0.5, tier: 1, tradable: true},
    {name: "Real Estate Credit", code: "522292", employ: 2295.42, sector: "Financial Activities", rca: 0.607, pci: -0.85, trad: 0.657, tier: 1, tradable: true},
    {name: "International, Secondary Market, and All Other Nondepository Credit Intermediation", code: "522299", employ: 357.92, sector: "Financial Activities", rca: 0.226, pci: -0.85, trad: 0.657, tier: 1, tradable: true},
    {name: "Mortgage and Nonmortgage Loan Brokers", code: "522310", employ: 989.84, sector: "Financial Activities", rca: 0.649, pci: 0.162, trad: 0.0, tier: 2, tradable: false},
    {name: "Financial Transactions Processing, Reserve, and Clearinghouse Activities", code: "522320", employ: 1081.28, sector: "Financial Activities", rca: 0.472, pci: 0.351, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Activities Related to Credit Intermediation", code: "522390", employ: 434.89, sector: "Financial Activities", rca: 0.369, pci: -0.708, trad: 0.525, tier: 1, tradable: true},
    {name: "Investment Banking and Securities Intermediation", code: "523150", employ: 11203.73, sector: "Financial Activities", rca: 1.561, pci: -0.384, trad: 1.0, tier: 0, tradable: true},
    {name: "Commodity Contracts Intermediation", code: "523160", employ: 370.57, sector: "Financial Activities", rca: 0.747, pci: -0.306, trad: 1.0, tier: 0, tradable: true},
    {name: "Securities and Commodity Exchanges", code: "523210", employ: 88.72, sector: "Financial Activities", rca: 0.702, pci: 2.268, trad: 1.0, tier: 0, tradable: true},
    {name: "Miscellaneous Intermediation", code: "523910", employ: 1093.22, sector: "Financial Activities", rca: 1.777, pci: 0.118, trad: 1.0, tier: 0, tradable: true},
    {name: "Portfolio Management and Investment Advice", code: "523940", employ: 27406.0, sector: "Financial Activities", rca: 2.704, pci: 0.036, trad: 1.0, tier: 0, tradable: true},
    {name: "Trust, Fiduciary, and Custody Activities", code: "523991", employ: 712.47, sector: "Financial Activities", rca: 2.309, pci: 0.434, trad: 1.0, tier: 0, tradable: true},
    {name: "Miscellaneous Financial Investment Activities", code: "523999", employ: 2431.28, sector: "Financial Activities", rca: 4.104, pci: 0.434, trad: 1.0, tier: 0, tradable: true},
    {name: "Direct Life Insurance Carriers", code: "524113", employ: 7422.38, sector: "Financial Activities", rca: 2.679, pci: -0.255, trad: 0.717, tier: 1, tradable: true},
    {name: "Direct Health and Medical Insurance Carriers", code: "524114", employ: 9815.34, sector: "Financial Activities", rca: 1.68, pci: -0.255, trad: 0.717, tier: 1, tradable: true},
    {name: "Direct Property and Casualty Insurance Carriers", code: "524126", employ: 13026.27, sector: "Financial Activities", rca: 1.528, pci: -0.255, trad: 0.717, tier: 1, tradable: true},
    {name: "Direct Title Insurance Carriers", code: "524127", employ: 81.26, sector: "Financial Activities", rca: 0.064, pci: -0.255, trad: 0.717, tier: 1, tradable: true},
    {name: "Other Direct Insurance (except Life, Health, and Medical) Carriers", code: "524128", employ: 163.82, sector: "Financial Activities", rca: 0.432, pci: -0.255, trad: 0.717, tier: 1, tradable: true},
    {name: "Reinsurance Carriers", code: "524130", employ: 291.94, sector: "Financial Activities", rca: 0.624, pci: -0.255, trad: 0.717, tier: 1, tradable: true},
    {name: "Insurance Agencies and Brokerages", code: "524210", employ: 11915.94, sector: "Financial Activities", rca: 0.665, pci: -1.078, trad: 0.0, tier: 2, tradable: false},
    {name: "Claims Adjusting", code: "524291", employ: 973.96, sector: "Financial Activities", rca: 1.043, pci: -0.045, trad: 0.482, tier: 1, tradable: false},
    {name: "Pharmacy Benefit Management and Other Third Party Administration of Insurance and Pension Funds", code: "524292", employ: 1934.77, sector: "Financial Activities", rca: 0.599, pci: -0.045, trad: 0.482, tier: 1, tradable: false},
    {name: "All Other Insurance Related Activities", code: "524298", employ: 2125.33, sector: "Financial Activities", rca: 1.468, pci: -0.045, trad: 0.482, tier: 1, tradable: false},
    {name: "Pension Funds", code: "525110", employ: 77.85, sector: "Financial Activities", rca: 1.542, pci: 1.635, trad: 0.5, tier: 1, tradable: true},
    {name: "Health and Welfare Funds", code: "525120", employ: 7.83, sector: "Financial Activities", rca: 0.112, pci: 1.724, trad: 0.555, tier: 1, tradable: true},
    {name: "Other Insurance Funds", code: "525190", employ: 6.45, sector: "Financial Activities", rca: 0.362, pci: 1.298, trad: 0.9, tier: 0, tradable: true},
    {name: "Open-End Investment Funds", code: "525910", employ: 48.14, sector: "Financial Activities", rca: 0.672, pci: 1.92, trad: 0.726, tier: 1, tradable: true},
    {name: "Trusts, Estates, and Agency Accounts", code: "525920", employ: 17.04, sector: "Financial Activities", rca: 0.259, pci: 0.31, trad: 0.615, tier: 1, tradable: true},
    {name: "Other Financial Vehicles", code: "525990", employ: 134.09, sector: "Financial Activities", rca: 0.619, pci: 0.985, trad: 0.792, tier: 1, tradable: true},
    {name: "Lessors of Residential Buildings and Dwellings", code: "531110", employ: 5530.0, sector: "Financial Activities", rca: 0.724, pci: -0.841, trad: 0.0, tier: 2, tradable: false},
    {name: "Lessors of Nonresidential Buildings (except Miniwarehouses)", code: "531120", employ: 2934.14, sector: "Financial Activities", rca: 0.91, pci: -0.515, trad: 0.0, tier: 2, tradable: false},
    {name: "Lessors of Miniwarehouses and Self-Storage Units", code: "531130", employ: 642.87, sector: "Financial Activities", rca: 0.558, pci: -0.688, trad: 0.0, tier: 2, tradable: false},
    {name: "Lessors of Other Real Estate Property", code: "531190", employ: 231.99, sector: "Financial Activities", rca: 0.293, pci: -0.878, trad: 0.287, tier: 1, tradable: false},
    {name: "Offices of Real Estate Agents and Brokers", code: "531210", employ: 5763.0, sector: "Financial Activities", rca: 0.825, pci: -0.515, trad: 0.0, tier: 2, tradable: false},
    {name: "Residential Property Managers", code: "531311", employ: 9725.9, sector: "Financial Activities", rca: 0.897, pci: -0.311, trad: 0.122, tier: 2, tradable: false},
    {name: "Nonresidential Property Managers", code: "531312", employ: 5200.27, sector: "Financial Activities", rca: 1.47, pci: -0.311, trad: 0.122, tier: 2, tradable: false},
    {name: "Offices of Real Estate Appraisers", code: "531320", employ: 390.57, sector: "Financial Activities", rca: 0.687, pci: -0.576, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Activities Related to Real Estate", code: "531390", employ: 2158.27, sector: "Financial Activities", rca: 1.175, pci: 0.088, trad: 0.0, tier: 2, tradable: false},
    {name: "Passenger Car Rental", code: "532111", employ: 1908.85, sector: "Financial Activities", rca: 1.284, pci: -0.009, trad: 0.5, tier: 1, tradable: true},
    {name: "Passenger Car Leasing", code: "532112", employ: 20.17, sector: "Financial Activities", rca: 0.116, pci: -0.009, trad: 0.5, tier: 1, tradable: true},
    {name: "Truck, Utility Trailer, and RV (Recreational Vehicle) Rental and Leasing", code: "532120", employ: 1291.4, sector: "Financial Activities", rca: 0.493, pci: -0.069, trad: 0.5, tier: 1, tradable: true},
    {name: "Consumer Electronics and Appliances Rental", code: "532210", employ: 152.58, sector: "Financial Activities", rca: 1.461, pci: -0.864, trad: 0.5, tier: 1, tradable: true},
    {name: "Formal Wear and Costume Rental", code: "532281", employ: 27.79, sector: "Financial Activities", rca: 0.41, pci: -0.771, trad: 0.548, tier: 1, tradable: true},
    {name: "Video Tape and Disc Rental", code: "532282", employ: 10.26, sector: "Financial Activities", rca: 0.244, pci: -0.771, trad: 0.548, tier: 1, tradable: true},
    {name: "Home Health Equipment Rental", code: "532283", employ: 134.65, sector: "Financial Activities", rca: 0.319, pci: -0.771, trad: 0.548, tier: 1, tradable: true},
    {name: "Recreational Goods Rental", code: "532284", employ: 60.15, sector: "Financial Activities", rca: 0.224, pci: -0.771, trad: 0.548, tier: 1, tradable: true},
    {name: "All Other Consumer Goods Rental", code: "532289", employ: 1038.45, sector: "Financial Activities", rca: 0.911, pci: -1.226, trad: 0.0, tier: 2, tradable: false},
    {name: "General Rental Centers", code: "532310", employ: 250.82, sector: "Financial Activities", rca: 0.616, pci: -0.69, trad: 0.153, tier: 2, tradable: false},
    {name: "Commercial Air, Rail, and Water Transportation Equipment Rental and Leasing", code: "532411", employ: 125.32, sector: "Financial Activities", rca: 1.14, pci: 0.796, trad: 0.9, tier: 0, tradable: true},
    {name: "Construction, Mining, and Forestry Machinery and Equipment Rental and Leasing", code: "532412", employ: 811.53, sector: "Financial Activities", rca: 0.585, pci: -0.84, trad: 0.5, tier: 1, tradable: true},
    {name: "Office Machinery and Equipment Rental and Leasing", code: "532420", employ: 362.96, sector: "Financial Activities", rca: 1.484, pci: 1.062, trad: 0.225, tier: 1, tradable: false},
    {name: "Other Commercial and Industrial Machinery and Equipment Rental and Leasing", code: "532490", employ: 1008.26, sector: "Financial Activities", rca: 0.546, pci: -0.356, trad: 0.0, tier: 2, tradable: false},
    {name: "Lessors of Nonfinancial Intangible Assets (except Copyrighted Works)", code: "533110", employ: 167.53, sector: "Financial Activities", rca: 0.478, pci: 0.712, trad: 1.0, tier: 0, tradable: true},
    {name: "Offices of Lawyers", code: "541110", employ: 24266.89, sector: "Professional & Business", rca: 1.052, pci: -0.608, trad: 0.5, tier: 1, tradable: true},
    {name: "Title Abstract and Settlement Offices", code: "541191", employ: 235.88, sector: "Professional & Business", rca: 0.261, pci: -0.966, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other Legal Services", code: "541199", employ: 240.23, sector: "Professional & Business", rca: 0.32, pci: -0.966, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Certified Public Accountants", code: "541211", employ: 12789.45, sector: "Professional & Business", rca: 1.129, pci: -0.922, trad: 0.531, tier: 1, tradable: true},
    {name: "Tax Preparation Services", code: "541213", employ: 2191.23, sector: "Professional & Business", rca: 1.184, pci: -0.922, trad: 0.531, tier: 1, tradable: true},
    {name: "Payroll Services", code: "541214", employ: 1765.91, sector: "Professional & Business", rca: 0.525, pci: -0.922, trad: 0.531, tier: 1, tradable: true},
    {name: "Other Accounting Services", code: "541219", employ: 4513.42, sector: "Professional & Business", rca: 0.831, pci: -0.888, trad: 0.0, tier: 2, tradable: false},
    {name: "Architectural Services", code: "541310", employ: 6969.66, sector: "Professional & Business", rca: 1.619, pci: 0.636, trad: 1.0, tier: 0, tradable: true},
    {name: "Landscape Architectural Services", code: "541320", employ: 765.58, sector: "Professional & Business", rca: 1.091, pci: 0.871, trad: 0.5, tier: 1, tradable: true},
    {name: "Engineering Services", code: "541330", employ: 26122.89, sector: "Professional & Business", rca: 1.098, pci: -0.179, trad: 1.0, tier: 0, tradable: true},
    {name: "Drafting Services", code: "541340", employ: 44.06, sector: "Professional & Business", rca: 0.274, pci: 0.278, trad: 0.5, tier: 1, tradable: true},
    {name: "Building Inspection Services", code: "541350", employ: 371.62, sector: "Professional & Business", rca: 0.721, pci: 0.128, trad: 0.0, tier: 2, tradable: false},
    {name: "Geophysical Surveying and Mapping Services", code: "541360", employ: 47.27, sector: "Professional & Business", rca: 0.226, pci: -0.198, trad: 1.0, tier: 0, tradable: true},
    {name: "Surveying and Mapping (except Geophysical) Services", code: "541370", employ: 689.05, sector: "Professional & Business", rca: 0.693, pci: -0.796, trad: 0.0, tier: 2, tradable: false},
    {name: "Testing Laboratories and Services", code: "541380", employ: 3140.86, sector: "Professional & Business", rca: 0.908, pci: -0.395, trad: 1.0, tier: 0, tradable: true},
    {name: "Interior Design Services", code: "541410", employ: 1040.53, sector: "Professional & Business", rca: 0.889, pci: 0.921, trad: 0.5, tier: 1, tradable: true},
    {name: "Industrial Design Services", code: "541420", employ: 365.38, sector: "Professional & Business", rca: 1.281, pci: 0.909, trad: 0.862, tier: 0, tradable: true},
    {name: "Graphic Design Services", code: "541430", employ: 884.44, sector: "Professional & Business", rca: 0.782, pci: 0.264, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Specialized Design Services", code: "541490", employ: 485.14, sector: "Professional & Business", rca: 1.355, pci: 1.007, trad: 0.5, tier: 1, tradable: true},
    {name: "Custom Computer Programming Services", code: "541511", employ: 31979.87, sector: "Professional & Business", rca: 1.626, pci: 0.196, trad: 1.0, tier: 0, tradable: true},
    {name: "Computer Systems Design Services", code: "541512", employ: 28225.23, sector: "Professional & Business", rca: 1.367, pci: 0.196, trad: 1.0, tier: 0, tradable: true},
    {name: "Computer Facilities Management Services", code: "541513", employ: 865.63, sector: "Professional & Business", rca: 0.75, pci: 0.196, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Computer Related Services", code: "541519", employ: 2820.28, sector: "Professional & Business", rca: 1.421, pci: 0.196, trad: 1.0, tier: 0, tradable: true},
    {name: "Administrative Management and General Management Consulting Services", code: "541611", employ: 29002.61, sector: "Professional & Business", rca: 1.792, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Human Resources Consulting Services", code: "541612", employ: 2637.79, sector: "Professional & Business", rca: 1.727, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Marketing Consulting Services", code: "541613", employ: 5808.27, sector: "Professional & Business", rca: 1.031, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Process, Physical Distribution, and Logistics Consulting Services", code: "541614", employ: 2202.28, sector: "Professional & Business", rca: 0.762, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Other Management Consulting Services", code: "541618", employ: 2075.19, sector: "Professional & Business", rca: 0.896, pci: -0.088, trad: 1.0, tier: 0, tradable: true},
    {name: "Environmental Consulting Services", code: "541620", employ: 2618.23, sector: "Professional & Business", rca: 1.36, pci: -0.053, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Scientific and Technical Consulting Services", code: "541690", employ: 7053.64, sector: "Professional & Business", rca: 1.868, pci: -0.808, trad: 0.5, tier: 1, tradable: true},
    {name: "Research and Development in Nanotechnology", code: "541713", employ: 994.26, sector: "Professional & Business", rca: 3.071, pci: 0.274, trad: 1.0, tier: 0, tradable: true},
    {name: "Research and Development in Biotechnology (except Nanobiotechnology)", code: "541714", employ: 61686.97, sector: "Professional & Business", rca: 10.854, pci: 0.274, trad: 1.0, tier: 0, tradable: true},
    {name: "Research and Development in the Physical, Engineering, and Life Sciences (except Nanotechnology and Biotechnology)", code: "541715", employ: 31458.7, sector: "Professional & Business", rca: 3.195, pci: 0.274, trad: 1.0, tier: 0, tradable: true},
    {name: "Research and Development in the Social Sciences and Humanities", code: "541720", employ: 2542.08, sector: "Professional & Business", rca: 1.769, pci: 0.331, trad: 1.0, tier: 0, tradable: true},
    {name: "Advertising Agencies", code: "541810", employ: 3912.33, sector: "Professional & Business", rca: 0.893, pci: 0.62, trad: 1.0, tier: 0, tradable: true},
    {name: "Public Relations Agencies", code: "541820", employ: 1459.14, sector: "Professional & Business", rca: 1.06, pci: 1.126, trad: 1.0, tier: 0, tradable: true},
    {name: "Media Buying Agencies", code: "541830", employ: 170.51, sector: "Professional & Business", rca: 0.498, pci: 1.888, trad: 1.0, tier: 0, tradable: true},
    {name: "Media Representatives", code: "541840", employ: 111.78, sector: "Professional & Business", rca: 0.342, pci: 1.108, trad: 1.0, tier: 0, tradable: true},
    {name: "Indoor and Outdoor Display Advertising", code: "541850", employ: 179.2, sector: "Professional & Business", rca: 0.425, pci: 0.406, trad: 0.003, tier: 2, tradable: false},
    {name: "Direct Mail Advertising", code: "541860", employ: 505.83, sector: "Professional & Business", rca: 0.861, pci: 1.653, trad: 1.0, tier: 0, tradable: true},
    {name: "Advertising Material Distribution Services", code: "541870", employ: 73.05, sector: "Professional & Business", rca: 0.279, pci: 0.754, trad: 0.191, tier: 2, tradable: false},
    {name: "Other Services Related to Advertising", code: "541890", employ: 1789.94, sector: "Professional & Business", rca: 1.243, pci: 0.309, trad: 0.5, tier: 1, tradable: true},
    {name: "Marketing Research and Public Opinion Polling", code: "541910", employ: 1331.15, sector: "Professional & Business", rca: 1.126, pci: 1.11, trad: 1.0, tier: 0, tradable: true},
    {name: "Photography Studios, Portrait", code: "541921", employ: 322.49, sector: "Professional & Business", rca: 0.56, pci: -0.322, trad: 0.227, tier: 1, tradable: false},
    {name: "Commercial Photography", code: "541922", employ: 154.48, sector: "Professional & Business", rca: 0.678, pci: -0.322, trad: 0.227, tier: 1, tradable: false},
    {name: "Translation and Interpretation Services", code: "541930", employ: 529.54, sector: "Professional & Business", rca: 0.854, pci: 1.06, trad: 1.0, tier: 0, tradable: true},
    {name: "Veterinary Services", code: "541940", employ: 7678.0, sector: "Professional & Business", rca: 0.842, pci: -1.08, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other Professional, Scientific, and Technical Services", code: "541990", employ: 3616.33, sector: "Professional & Business", rca: 0.86, pci: -0.537, trad: 1.0, tier: 0, tradable: true},
    {name: "Offices of Bank Holding Companies", code: "551111", employ: 23.53, sector: "Professional & Business", rca: 0.249, pci: -0.41, trad: 0.501, tier: 1, tradable: true},
    {name: "Offices of Other Holding Companies", code: "551112", employ: 1132.03, sector: "Professional & Business", rca: 0.757, pci: -0.272, trad: 0.5, tier: 1, tradable: true},
    {name: "Corporate, Subsidiary, and Regional Managing Offices", code: "551114", employ: 63704.44, sector: "Professional & Business", rca: 1.303, pci: -0.41, trad: 0.501, tier: 1, tradable: true},
    {name: "Office Administrative Services", code: "561110", employ: 7499.0, sector: "Professional & Business", rca: 0.677, pci: -0.737, trad: 0.5, tier: 1, tradable: true},
    {name: "Facilities Support Services", code: "561210", employ: 1341.2, sector: "Professional & Business", rca: 0.536, pci: -0.457, trad: 0.5, tier: 1, tradable: true},
    {name: "Employment Placement Agencies", code: "561311", employ: 4503.85, sector: "Professional & Business", rca: 1.115, pci: -0.244, trad: 0.071, tier: 2, tradable: false},
    {name: "Executive Search Services", code: "561312", employ: 1543.36, sector: "Professional & Business", rca: 2.049, pci: -0.244, trad: 0.071, tier: 2, tradable: false},
    {name: "Temporary Help Services", code: "561320", employ: 35283.95, sector: "Professional & Business", rca: 0.735, pci: -0.649, trad: 0.0, tier: 2, tradable: false},
    {name: "Professional Employer Organizations", code: "561330", employ: 428.84, sector: "Professional & Business", rca: 0.083, pci: -0.271, trad: 0.634, tier: 1, tradable: true},
    {name: "Document Preparation Services", code: "561410", employ: 452.5, sector: "Professional & Business", rca: 0.556, pci: -0.005, trad: 0.5, tier: 1, tradable: true},
    {name: "Telephone Answering Services", code: "561421", employ: 445.2, sector: "Professional & Business", rca: 0.762, pci: 0.06, trad: 0.601, tier: 1, tradable: true},
    {name: "Telemarketing Bureaus and Other Contact Centers", code: "561422", employ: 963.3, sector: "Professional & Business", rca: 0.25, pci: -0.053, trad: 0.544, tier: 1, tradable: true},
    {name: "Private Mail Centers", code: "561431", employ: 544.43, sector: "Professional & Business", rca: 0.489, pci: -0.042, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Business Service Centers (including Copy Shops)", code: "561439", employ: 490.07, sector: "Professional & Business", rca: 0.436, pci: -0.042, trad: 0.0, tier: 2, tradable: false},
    {name: "Collection Agencies", code: "561440", employ: 1280.2, sector: "Professional & Business", rca: 0.666, pci: -0.214, trad: 0.5, tier: 1, tradable: true},
    {name: "Credit Bureaus", code: "561450", employ: 39.17, sector: "Professional & Business", rca: 0.099, pci: 1.723, trad: 0.85, tier: 0, tradable: true},
    {name: "Repossession Services", code: "561491", employ: 38.83, sector: "Professional & Business", rca: 0.249, pci: 0.054, trad: 0.464, tier: 1, tradable: false},
    {name: "Court Reporting and Stenotype Services", code: "561492", employ: 51.4, sector: "Professional & Business", rca: 0.178, pci: 0.054, trad: 0.464, tier: 1, tradable: false},
    {name: "All Other Business Support Services", code: "561499", employ: 1254.91, sector: "Professional & Business", rca: 0.656, pci: 0.054, trad: 0.464, tier: 1, tradable: false},
    {name: "Travel Agencies", code: "561510", employ: 1715.48, sector: "Professional & Business", rca: 0.926, pci: 0.273, trad: 0.16, tier: 2, tradable: false},
    {name: "Tour Operators", code: "561520", employ: 1996.44, sector: "Professional & Business", rca: 3.646, pci: 1.265, trad: 0.9, tier: 0, tradable: true},
    {name: "Convention and Visitors Bureaus", code: "561591", employ: 17.37, sector: "Professional & Business", rca: 0.187, pci: 0.363, trad: 0.624, tier: 1, tradable: true},
    {name: "All Other Travel Arrangement and Reservation Services", code: "561599", employ: 270.3, sector: "Professional & Business", rca: 0.336, pci: 0.363, trad: 0.624, tier: 1, tradable: true},
    {name: "Investigation and Personal Background Check Services", code: "561611", employ: 113.47, sector: "Professional & Business", rca: 0.212, pci: 0.435, trad: 0.289, tier: 1, tradable: false},
    {name: "Security Guards and Patrol Services", code: "561612", employ: 14742.76, sector: "Professional & Business", rca: 0.874, pci: 0.199, trad: 0.0, tier: 2, tradable: false},
    {name: "Armored Car Services", code: "561613", employ: 39.53, sector: "Professional & Business", rca: 0.109, pci: 0.435, trad: 0.289, tier: 1, tradable: false},
    {name: "Security Systems Services (except Locksmiths)", code: "561621", employ: 2188.24, sector: "Professional & Business", rca: 0.724, pci: 0.096, trad: 0.0, tier: 2, tradable: false},
    {name: "Locksmiths", code: "561622", employ: 326.0, sector: "Professional & Business", rca: 0.677, pci: 0.043, trad: 0.0, tier: 2, tradable: false},
    {name: "Exterminating and Pest Control Services", code: "561710", employ: 1701.02, sector: "Professional & Business", rca: 0.601, pci: -0.854, trad: 0.0, tier: 2, tradable: false},
    {name: "Janitorial Services", code: "561720", employ: 27225.12, sector: "Professional & Business", rca: 1.292, pci: -0.777, trad: 0.0, tier: 2, tradable: false},
    {name: "Landscaping Services", code: "561730", employ: 16271.69, sector: "Professional & Business", rca: 0.913, pci: -0.632, trad: 0.0, tier: 2, tradable: false},
    {name: "Carpet and Upholstery Cleaning Services", code: "561740", employ: 456.36, sector: "Professional & Business", rca: 0.682, pci: -0.511, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Services to Buildings and Dwellings", code: "561790", employ: 1565.81, sector: "Professional & Business", rca: 0.699, pci: -0.288, trad: 0.0, tier: 2, tradable: false},
    {name: "Packaging and Labeling Services", code: "561910", employ: 281.26, sector: "Professional & Business", rca: 0.3, pci: 0.187, trad: 0.757, tier: 1, tradable: true},
    {name: "Convention and Trade Show Organizers", code: "561920", employ: 1086.75, sector: "Professional & Business", rca: 1.006, pci: 0.899, trad: 0.9, tier: 0, tradable: true},
    {name: "All Other Support Services", code: "561990", employ: 998.38, sector: "Professional & Business", rca: 0.262, pci: -0.623, trad: 0.0, tier: 2, tradable: false},
    {name: "Solid Waste Collection", code: "562111", employ: 3562.38, sector: "Professional & Business", rca: 1.16, pci: -0.929, trad: 0.0, tier: 2, tradable: false},
    {name: "Hazardous Waste Collection", code: "562112", employ: 40.84, sector: "Professional & Business", rca: 0.214, pci: 0.076, trad: 0.424, tier: 1, tradable: false},
    {name: "Other Waste Collection", code: "562119", employ: 148.78, sector: "Professional & Business", rca: 0.542, pci: 0.076, trad: 0.424, tier: 1, tradable: false},
    {name: "Hazardous Waste Treatment and Disposal", code: "562211", employ: 603.42, sector: "Professional & Business", rca: 1.233, pci: -0.718, trad: 0.876, tier: 0, tradable: true},
    {name: "Solid Waste Landfill", code: "562212", employ: 8.41, sector: "Professional & Business", rca: 0.015, pci: -0.718, trad: 0.876, tier: 0, tradable: true},
    {name: "Solid Waste Combustors and Incinerators", code: "562213", employ: 222.18, sector: "Professional & Business", rca: 3.691, pci: -0.718, trad: 0.876, tier: 0, tradable: true},
    {name: "Other Nonhazardous Waste Treatment and Disposal", code: "562219", employ: 144.66, sector: "Professional & Business", rca: 0.512, pci: 0.079, trad: 0.813, tier: 0, tradable: true},
    {name: "Remediation Services", code: "562910", employ: 1837.69, sector: "Professional & Business", rca: 0.973, pci: -0.152, trad: 0.768, tier: 1, tradable: true},
    {name: "Materials Recovery Facilities", code: "562920", employ: 166.02, sector: "Professional & Business", rca: 0.457, pci: 0.168, trad: 0.5, tier: 1, tradable: true},
    {name: "Septic Tank and Related Services", code: "562991", employ: 440.86, sector: "Professional & Business", rca: 0.868, pci: -0.899, trad: 0.337, tier: 1, tradable: false},
    {name: "All Other Miscellaneous Waste Management Services", code: "562998", employ: 391.35, sector: "Professional & Business", rca: 1.096, pci: -0.899, trad: 0.337, tier: 1, tradable: false},
    {name: "Elementary and Secondary Schools", code: "611110", employ: 19244.0, sector: "Education & Health", rca: 0.994, pci: -0.361, trad: 0.0, tier: 2, tradable: false},
    {name: "Junior Colleges", code: "611210", employ: 15.48, sector: "Education & Health", rca: 0.095, pci: 1.08, trad: 0.5, tier: 1, tradable: true},
    {name: "Colleges, Universities, and Professional Schools", code: "611310", employ: 85523.11, sector: "Education & Health", rca: 4.314, pci: -0.184, trad: 0.5, tier: 1, tradable: true},
    {name: "Business and Secretarial Schools", code: "611410", employ: 65.64, sector: "Education & Health", rca: 1.998, pci: 2.259, trad: 0.5, tier: 1, tradable: true},
    {name: "Computer Training", code: "611420", employ: 652.08, sector: "Education & Health", rca: 2.863, pci: 1.058, trad: 0.5, tier: 1, tradable: true},
    {name: "Professional and Management Development Training", code: "611430", employ: 626.68, sector: "Education & Health", rca: 0.668, pci: 0.355, trad: 0.5, tier: 1, tradable: true},
    {name: "Cosmetology and Barber Schools", code: "611511", employ: 59.8, sector: "Education & Health", rca: 0.185, pci: -0.239, trad: 0.212, tier: 1, tradable: false},
    {name: "Flight Training", code: "611512", employ: 89.42, sector: "Education & Health", rca: 0.21, pci: -0.239, trad: 0.212, tier: 1, tradable: false},
    {name: "Apprenticeship Training", code: "611513", employ: 317.43, sector: "Education & Health", rca: 1.023, pci: -0.239, trad: 0.212, tier: 1, tradable: false},
    {name: "Other Technical and Trade Schools", code: "611519", employ: 647.36, sector: "Education & Health", rca: 0.506, pci: -0.239, trad: 0.212, tier: 1, tradable: false},
    {name: "Fine Arts Schools", code: "611610", employ: 2963.92, sector: "Education & Health", rca: 1.279, pci: -0.087, trad: 0.0, tier: 2, tradable: false},
    {name: "Sports and Recreation Instruction", code: "611620", employ: 5524.83, sector: "Education & Health", rca: 1.342, pci: 0.097, trad: 0.0, tier: 2, tradable: false},
    {name: "Language Schools", code: "611630", employ: 1126.1, sector: "Education & Health", rca: 3.108, pci: 2.09, trad: 0.5, tier: 1, tradable: true},
    {name: "Exam Preparation and Tutoring", code: "611691", employ: 2279.83, sector: "Education & Health", rca: 1.07, pci: 0.113, trad: 0.01, tier: 2, tradable: false},
    {name: "Automobile Driving Schools", code: "611692", employ: 650.07, sector: "Education & Health", rca: 2.098, pci: 0.113, trad: 0.01, tier: 2, tradable: false},
    {name: "All Other Miscellaneous Schools and Instruction", code: "611699", employ: 2694.24, sector: "Education & Health", rca: 1.647, pci: 0.43, trad: 0.0, tier: 2, tradable: false},
    {name: "Educational Support Services", code: "611710", employ: 4811.0, sector: "Education & Health", rca: 1.311, pci: 0.193, trad: 0.5, tier: 1, tradable: true},
    {name: "Offices of Physicians (except Mental Health Specialists)", code: "621111", employ: 44735.91, sector: "Education & Health", rca: 0.796, pci: -0.814, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Physicians, Mental Health Specialists", code: "621112", employ: 1360.09, sector: "Education & Health", rca: 0.631, pci: -0.814, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Dentists", code: "621210", employ: 19242.0, sector: "Education & Health", rca: 0.928, pci: -0.981, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Chiropractors", code: "621310", employ: 1449.87, sector: "Education & Health", rca: 0.492, pci: -1.087, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Optometrists", code: "621320", employ: 1490.81, sector: "Education & Health", rca: 0.514, pci: -1.34, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Mental Health Practitioners (except Physicians)", code: "621330", employ: 4813.45, sector: "Education & Health", rca: 0.958, pci: -0.443, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Physical, Occupational and Speech Therapists, and Audiologists", code: "621340", employ: 8108.16, sector: "Education & Health", rca: 0.843, pci: -0.95, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of Podiatrists", code: "621391", employ: 467.98, sector: "Education & Health", rca: 0.735, pci: -0.7, trad: 0.0, tier: 2, tradable: false},
    {name: "Offices of All Other Miscellaneous Health Practitioners", code: "621399", employ: 2132.73, sector: "Education & Health", rca: 0.77, pci: -0.7, trad: 0.0, tier: 2, tradable: false},
    {name: "Family Planning Centers", code: "621410", employ: 56.89, sector: "Education & Health", rca: 0.077, pci: -0.04, trad: 0.102, tier: 2, tradable: false},
    {name: "Outpatient Mental Health and Substance Abuse Centers", code: "621420", employ: 781.2, sector: "Education & Health", rca: 0.146, pci: -0.943, trad: 0.0, tier: 2, tradable: false},
    {name: "HMO Medical Centers", code: "621491", employ: 230.83, sector: "Education & Health", rca: 0.072, pci: -0.991, trad: 0.208, tier: 1, tradable: false},
    {name: "Kidney Dialysis Centers", code: "621492", employ: 2917.08, sector: "Education & Health", rca: 1.076, pci: -0.991, trad: 0.208, tier: 1, tradable: false},
    {name: "Freestanding Ambulatory Surgical and Emergency Centers", code: "621493", employ: 1328.13, sector: "Education & Health", rca: 0.31, pci: -0.991, trad: 0.208, tier: 1, tradable: false},
    {name: "All Other Outpatient Care Centers", code: "621498", employ: 9821.87, sector: "Education & Health", rca: 1.799, pci: -0.646, trad: 0.191, tier: 2, tradable: false},
    {name: "Medical Laboratories", code: "621511", employ: 3278.08, sector: "Education & Health", rca: 0.752, pci: -0.27, trad: 0.364, tier: 1, tradable: false},
    {name: "Diagnostic Imaging Centers", code: "621512", employ: 1262.35, sector: "Education & Health", rca: 0.736, pci: -0.27, trad: 0.364, tier: 1, tradable: false},
    {name: "Home Health Care Services", code: "621610", employ: 30976.0, sector: "Education & Health", rca: 0.888, pci: -1.076, trad: 0.153, tier: 2, tradable: false},
    {name: "Ambulance Services", code: "621910", employ: 3902.3, sector: "Education & Health", rca: 1.461, pci: -1.126, trad: 0.0, tier: 2, tradable: false},
    {name: "Blood and Organ Banks", code: "621991", employ: 46.79, sector: "Education & Health", rca: 0.026, pci: -0.193, trad: 0.319, tier: 1, tradable: false},
    {name: "All Other Miscellaneous Ambulatory Health Care Services", code: "621999", employ: 2394.98, sector: "Education & Health", rca: 1.38, pci: -0.193, trad: 0.319, tier: 1, tradable: false},
    {name: "General Medical and Surgical Hospitals", code: "622110", employ: 125558.62, sector: "Education & Health", rca: 1.849, pci: -0.939, trad: 0.5, tier: 1, tradable: true},
    {name: "Psychiatric and Substance Abuse Hospitals", code: "622210", employ: 897.78, sector: "Education & Health", rca: 0.653, pci: 0.596, trad: 0.5, tier: 1, tradable: true},
    {name: "Specialty (except Psychiatric and Substance Abuse) Hospitals", code: "622310", employ: 854.59, sector: "Education & Health", rca: 0.357, pci: 0.896, trad: 0.5, tier: 1, tradable: true},
    {name: "Nursing Care Facilities (Skilled Nursing Facilities)", code: "623110", employ: 24036.0, sector: "Education & Health", rca: 0.941, pci: -1.487, trad: 0.0, tier: 2, tradable: false},
    {name: "Residential Intellectual and Developmental Disability Facilities", code: "623210", employ: 8148.78, sector: "Education & Health", rca: 1.205, pci: -0.982, trad: 0.247, tier: 1, tradable: false},
    {name: "Residential Mental Health and Substance Abuse Facilities", code: "623220", employ: 9185.22, sector: "Education & Health", rca: 1.973, pci: -0.45, trad: 0.5, tier: 1, tradable: true},
    {name: "Continuing Care Retirement Communities", code: "623311", employ: 8073.13, sector: "Education & Health", rca: 0.876, pci: -0.956, trad: 0.249, tier: 1, tradable: false},
    {name: "Assisted Living Facilities for the Elderly", code: "623312", employ: 10902.87, sector: "Education & Health", rca: 1.187, pci: -0.956, trad: 0.249, tier: 1, tradable: false},
    {name: "Other Residential Care Facilities", code: "623990", employ: 2678.43, sector: "Education & Health", rca: 1.119, pci: -0.448, trad: 0.5, tier: 1, tradable: true},
    {name: "Child and Youth Services", code: "624110", employ: 5322.11, sector: "Education & Health", rca: 1.197, pci: -0.792, trad: 0.0, tier: 2, tradable: false},
    {name: "Services for the Elderly and Persons with Disabilities", code: "624120", employ: 41820.44, sector: "Education & Health", rca: 0.849, pci: -1.067, trad: 0.063, tier: 2, tradable: false},
    {name: "Other Individual and Family Services", code: "624190", employ: 13075.45, sector: "Education & Health", rca: 1.345, pci: -0.886, trad: 0.0, tier: 2, tradable: false},
    {name: "Community Food Services", code: "624210", employ: 992.96, sector: "Education & Health", rca: 1.127, pci: -0.303, trad: 0.122, tier: 2, tradable: false},
    {name: "Temporary Shelters", code: "624221", employ: 2250.39, sector: "Education & Health", rca: 1.418, pci: -0.426, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Community Housing Services", code: "624229", employ: 1532.43, sector: "Education & Health", rca: 1.605, pci: -0.426, trad: 0.0, tier: 2, tradable: false},
    {name: "Emergency and Other Relief Services", code: "624230", employ: 742.22, sector: "Education & Health", rca: 1.209, pci: 0.338, trad: 0.657, tier: 1, tradable: true},
    {name: "Vocational Rehabilitation Services", code: "624310", employ: 5067.0, sector: "Education & Health", rca: 1.199, pci: -0.985, trad: 0.01, tier: 2, tradable: false},
    {name: "Child Care Services", code: "624410", employ: 25132.0, sector: "Education & Health", rca: 1.304, pci: -1.147, trad: 0.0, tier: 2, tradable: false},
    {name: "Theater Companies and Dinner Theaters", code: "711110", employ: 1663.36, sector: "Leisure & Hospitality", rca: 1.169, pci: 0.945, trad: 0.53, tier: 1, tradable: true},
    {name: "Dance Companies", code: "711120", employ: 143.35, sector: "Leisure & Hospitality", rca: 0.552, pci: 1.4, trad: 0.5, tier: 1, tradable: true},
    {name: "Musical Groups and Artists", code: "711130", employ: 978.64, sector: "Leisure & Hospitality", rca: 1.337, pci: 0.864, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Performing Arts Companies", code: "711190", employ: 276.26, sector: "Leisure & Hospitality", rca: 1.673, pci: 1.486, trad: 0.9, tier: 0, tradable: true},
    {name: "Sports Teams and Clubs", code: "711211", employ: 2053.85, sector: "Leisure & Hospitality", rca: 1.02, pci: 1.47, trad: 0.9, tier: 0, tradable: true},
    {name: "Racetracks", code: "711212", employ: 655.86, sector: "Leisure & Hospitality", rca: 2.829, pci: -0.001, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Spectator Sports", code: "711219", employ: 121.65, sector: "Leisure & Hospitality", rca: 0.211, pci: -0.001, trad: 0.9, tier: 0, tradable: true},
    {name: "Promoters of Performing Arts, Sports, and Similar Events with Facilities", code: "711310", employ: 4458.25, sector: "Leisure & Hospitality", rca: 1.783, pci: 0.466, trad: 0.5, tier: 1, tradable: true},
    {name: "Promoters of Performing Arts, Sports, and Similar Events without Facilities", code: "711320", employ: 546.82, sector: "Leisure & Hospitality", rca: 0.582, pci: 0.405, trad: 0.9, tier: 0, tradable: true},
    {name: "Agents and Managers for Artists, Athletes, Entertainers, and Other Public Figures", code: "711410", employ: 162.49, sector: "Leisure & Hospitality", rca: 0.274, pci: 1.528, trad: 0.9, tier: 0, tradable: true},
    {name: "Independent Artists, Writers, and Performers", code: "711510", employ: 349.37, sector: "Leisure & Hospitality", rca: 0.295, pci: 0.087, trad: 0.9, tier: 0, tradable: true},
    {name: "Museums", code: "712110", employ: 3594.99, sector: "Leisure & Hospitality", rca: 1.486, pci: -0.465, trad: 0.5, tier: 1, tradable: true},
    {name: "Historical Sites", code: "712120", employ: 295.5, sector: "Leisure & Hospitality", rca: 2.031, pci: 0.882, trad: 0.9, tier: 0, tradable: true},
    {name: "Zoos and Botanical Gardens", code: "712130", employ: 28.82, sector: "Leisure & Hospitality", rca: 0.053, pci: 1.311, trad: 0.5, tier: 1, tradable: true},
    {name: "Nature Parks and Other Similar Institutions", code: "712190", employ: 21.69, sector: "Leisure & Hospitality", rca: 0.144, pci: 0.68, trad: 0.9, tier: 0, tradable: true},
    {name: "Amusement and Theme Parks", code: "713110", employ: 45.48, sector: "Leisure & Hospitality", rca: 0.02, pci: 0.926, trad: 0.9, tier: 0, tradable: true},
    {name: "Amusement Arcades", code: "713120", employ: 222.89, sector: "Leisure & Hospitality", rca: 0.401, pci: -0.245, trad: 0.5, tier: 1, tradable: true},
    {name: "Casinos (except Casino Hotels)", code: "713210", employ: 6.6, sector: "Leisure & Hospitality", rca: 0.021, pci: 0.627, trad: 0.9, tier: 0, tradable: true},
    {name: "Other Gambling Industries", code: "713290", employ: 9.66, sector: "Leisure & Hospitality", rca: 0.014, pci: -0.547, trad: 0.5, tier: 1, tradable: true},
    {name: "Golf Courses and Country Clubs", code: "713910", employ: 6228.56, sector: "Leisure & Hospitality", rca: 0.88, pci: -0.783, trad: 0.0, tier: 2, tradable: false},
    {name: "Skiing Facilities", code: "713920", employ: 144.37, sector: "Leisure & Hospitality", rca: 1.414, pci: 0.614, trad: 0.9, tier: 0, tradable: true},
    {name: "Marinas", code: "713930", employ: 641.8, sector: "Leisure & Hospitality", rca: 1.352, pci: 0.289, trad: 0.9, tier: 0, tradable: true},
    {name: "Fitness and Recreational Sports Centers", code: "713940", employ: 12522.44, sector: "Leisure & Hospitality", rca: 0.996, pci: -0.489, trad: 0.0, tier: 2, tradable: false},
    {name: "Bowling Centers", code: "713950", employ: 396.76, sector: "Leisure & Hospitality", rca: 0.558, pci: -0.97, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other Amusement and Recreation Industries", code: "713990", employ: 4075.13, sector: "Leisure & Hospitality", rca: 0.94, pci: -0.34, trad: 0.0, tier: 2, tradable: false},
    {name: "Hotels (except Casino Hotels) and Motels", code: "721110", employ: 25381.85, sector: "Leisure & Hospitality", rca: 1.0, pci: -1.002, trad: 0.5, tier: 1, tradable: true},
    {name: "Casino Hotels", code: "721120", employ: 2.33, sector: "Leisure & Hospitality", rca: 0.001, pci: 0.171, trad: 0.9, tier: 0, tradable: true},
    {name: "Bed-and-Breakfast Inns", code: "721191", employ: 88.71, sector: "Leisure & Hospitality", rca: 0.304, pci: -0.413, trad: 0.9, tier: 0, tradable: true},
    {name: "All Other Traveler Accommodation", code: "721199", employ: 97.11, sector: "Leisure & Hospitality", rca: 0.229, pci: -0.413, trad: 0.9, tier: 0, tradable: true},
    {name: "RV (Recreational Vehicle) Parks and Campgrounds", code: "721211", employ: 190.13, sector: "Leisure & Hospitality", rca: 0.545, pci: -0.976, trad: 0.9, tier: 0, tradable: true},
    {name: "Recreational and Vacation Camps (except Campgrounds)", code: "721214", employ: 415.83, sector: "Leisure & Hospitality", rca: 1.94, pci: -0.976, trad: 0.9, tier: 0, tradable: true},
    {name: "Rooming and Boarding Houses, Dormitories, and Workers' Camps", code: "721310", employ: 78.33, sector: "Leisure & Hospitality", rca: 0.66, pci: 0.089, trad: 0.9, tier: 0, tradable: true},
    {name: "Food Service Contractors", code: "722310", employ: 12823.48, sector: "Leisure & Hospitality", rca: 1.223, pci: -0.942, trad: 0.0, tier: 2, tradable: false},
    {name: "Caterers", code: "722320", employ: 5059.57, sector: "Leisure & Hospitality", rca: 1.483, pci: 0.125, trad: 0.0, tier: 2, tradable: false},
    {name: "Mobile Food Services", code: "722330", employ: 667.95, sector: "Leisure & Hospitality", rca: 0.785, pci: -0.647, trad: 0.111, tier: 2, tradable: false},
    {name: "Drinking Places (Alcoholic Beverages)", code: "722410", employ: 3529.0, sector: "Leisure & Hospitality", rca: 0.454, pci: -0.897, trad: 0.0, tier: 2, tradable: false},
    {name: "Full-Service Restaurants", code: "722511", employ: 107342.88, sector: "Leisure & Hospitality", rca: 1.002, pci: -0.983, trad: 0.0, tier: 2, tradable: false},
    {name: "Limited-Service Restaurants", code: "722513", employ: 48732.96, sector: "Leisure & Hospitality", rca: 0.538, pci: -1.348, trad: 0.0, tier: 2, tradable: false},
    {name: "Cafeterias, Grill Buffets, and Buffets", code: "722514", employ: 518.91, sector: "Leisure & Hospitality", rca: 0.419, pci: -1.045, trad: 0.162, tier: 2, tradable: false},
    {name: "Snack and Nonalcoholic Beverage Bars", code: "722515", employ: 18849.25, sector: "Leisure & Hospitality", rca: 1.251, pci: -0.923, trad: 0.0, tier: 2, tradable: false},
    {name: "General Automotive Repair", code: "811111", employ: 5503.51, sector: "Other", rca: 0.71, pci: -1.195, trad: 0.0, tier: 2, tradable: false},
    {name: "Specialized Automotive Repair", code: "811114", employ: 491.56, sector: "Other", rca: 0.516, pci: -0.898, trad: 0.0, tier: 2, tradable: false},
    {name: "Automotive Body, Paint, and Interior Repair and Maintenance", code: "811121", employ: 4305.53, sector: "Other", rca: 0.905, pci: -1.189, trad: 0.0, tier: 2, tradable: false},
    {name: "Automotive Glass Replacement Shops", code: "811122", employ: 532.01, sector: "Other", rca: 0.706, pci: -0.786, trad: 0.0, tier: 2, tradable: false},
    {name: "Automotive Oil Change and Lubrication Shops", code: "811191", employ: 619.16, sector: "Other", rca: 0.522, pci: -1.144, trad: 0.0, tier: 2, tradable: false},
    {name: "Car Washes", code: "811192", employ: 1532.44, sector: "Other", rca: 0.396, pci: -0.991, trad: 0.0, tier: 2, tradable: false},
    {name: "All Other Automotive Repair and Maintenance", code: "811198", employ: 243.79, sector: "Other", rca: 0.446, pci: -1.144, trad: 0.0, tier: 2, tradable: false},
    {name: "Electronic and Precision Equipment Repair and Maintenance", code: "811210", employ: 1853.42, sector: "Other", rca: 1.054, pci: -0.437, trad: 0.5, tier: 1, tradable: true},
    {name: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance", code: "811310", employ: 2286.0, sector: "Other", rca: 0.575, pci: -1.489, trad: 0.5, tier: 1, tradable: true},
    {name: "Home and Garden Equipment Repair and Maintenance", code: "811411", employ: 37.24, sector: "Other", rca: 0.381, pci: -0.542, trad: 0.096, tier: 2, tradable: false},
    {name: "Appliance Repair and Maintenance", code: "811412", employ: 419.1, sector: "Other", rca: 1.105, pci: -0.542, trad: 0.096, tier: 2, tradable: false},
    {name: "Reupholstery and Furniture Repair", code: "811420", employ: 250.39, sector: "Other", rca: 1.058, pci: 0.526, trad: 0.0, tier: 2, tradable: false},
    {name: "Footwear and Leather Goods Repair", code: "811430", employ: 19.33, sector: "Other", rca: 0.462, pci: 1.864, trad: 0.197, tier: 2, tradable: false},
    {name: "Other Personal and Household Goods Repair and Maintenance", code: "811490", employ: 642.14, sector: "Other", rca: 0.773, pci: -0.244, trad: 0.192, tier: 2, tradable: false},
    {name: "Barber Shops", code: "812111", employ: 375.16, sector: "Other", rca: 0.52, pci: -0.424, trad: 0.0, tier: 2, tradable: false},
    {name: "Beauty Salons", code: "812112", employ: 10812.36, sector: "Other", rca: 1.283, pci: -0.424, trad: 0.0, tier: 2, tradable: false},
    {name: "Nail Salons", code: "812113", employ: 4462.03, sector: "Other", rca: 1.343, pci: -0.424, trad: 0.0, tier: 2, tradable: false},
    {name: "Diet and Weight Reducing Centers", code: "812191", employ: 146.21, sector: "Other", rca: 0.792, pci: -0.215, trad: 0.0, tier: 2, tradable: false},
    {name: "Other Personal Care Services", code: "812199", employ: 1783.24, sector: "Other", rca: 0.622, pci: -0.215, trad: 0.0, tier: 2, tradable: false},
    {name: "Funeral Homes and Funeral Services", code: "812210", employ: 1143.39, sector: "Other", rca: 0.69, pci: -1.501, trad: 0.0, tier: 2, tradable: false},
    {name: "Cemeteries and Crematories", code: "812220", employ: 558.61, sector: "Other", rca: 0.868, pci: -0.874, trad: 0.0, tier: 2, tradable: false},
    {name: "Coin-Operated Laundries and Drycleaners", code: "812310", employ: 1883.58, sector: "Other", rca: 1.665, pci: -0.937, trad: 0.0, tier: 2, tradable: false},
    {name: "Drycleaning and Laundry Services (except Coin-Operated)", code: "812320", employ: 3268.53, sector: "Other", rca: 1.225, pci: -0.953, trad: 0.0, tier: 2, tradable: false},
    {name: "Linen Supply", code: "812331", employ: 329.45, sector: "Other", rca: 0.532, pci: 0.513, trad: 0.292, tier: 1, tradable: false},
    {name: "Industrial Launderers", code: "812332", employ: 178.45, sector: "Other", rca: 0.263, pci: 0.244, trad: 0.046, tier: 2, tradable: false},
    {name: "Pet Care (except Veterinary) Services", code: "812910", employ: 3982.33, sector: "Other", rca: 0.978, pci: -0.616, trad: 0.0, tier: 2, tradable: false},
    {name: "Photofinishing Laboratories (except One-Hour)", code: "812921", employ: 15.79, sector: "Other", rca: 0.242, pci: 1.651, trad: 0.866, tier: 0, tradable: true},
    {name: "One-Hour Photofinishing", code: "812922", employ: 1.38, sector: "Other", rca: 0.114, pci: 1.651, trad: 0.866, tier: 0, tradable: true},
    {name: "Parking Lots and Garages", code: "812930", employ: 4155.92, sector: "Other", rca: 1.529, pci: 2.22, trad: 0.018, tier: 2, tradable: false},
    {name: "All Other Personal Services", code: "812990", employ: 1910.58, sector: "Other", rca: 1.08, pci: -0.22, trad: 0.0, tier: 2, tradable: false},
    {name: "Religious Organizations", code: "813110", employ: 192.97, sector: "Other", rca: 0.05, pci: -0.246, trad: 0.328, tier: 1, tradable: false},
    {name: "Grantmaking Foundations", code: "813211", employ: 1283.14, sector: "Other", rca: 0.848, pci: 0.011, trad: 0.5, tier: 1, tradable: true},
    {name: "Voluntary Health Organizations", code: "813212", employ: 583.75, sector: "Other", rca: 0.822, pci: 1.061, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Grantmaking and Giving Services", code: "813219", employ: 709.24, sector: "Other", rca: 0.87, pci: 0.075, trad: 0.018, tier: 2, tradable: false},
    {name: "Human Rights Organizations", code: "813311", employ: 888.04, sector: "Other", rca: 0.847, pci: 0.081, trad: 0.5, tier: 1, tradable: true},
    {name: "Environment, Conservation and Wildlife Organizations", code: "813312", employ: 2898.46, sector: "Other", rca: 2.049, pci: -0.176, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Social Advocacy Organizations", code: "813319", employ: 3862.51, sector: "Other", rca: 1.602, pci: -0.515, trad: 0.5, tier: 1, tradable: true},
    {name: "Civic and Social Organizations", code: "813410", employ: 12131.0, sector: "Other", rca: 1.855, pci: -1.038, trad: 0.0, tier: 2, tradable: false},
    {name: "Business Associations", code: "813910", employ: 1704.04, sector: "Other", rca: 0.72, pci: -1.05, trad: 0.5, tier: 1, tradable: true},
    {name: "Professional Organizations", code: "813920", employ: 1399.8, sector: "Other", rca: 0.777, pci: 0.58, trad: 0.5, tier: 1, tradable: true},
    {name: "Labor Unions and Similar Labor Organizations", code: "813930", employ: 2365.05, sector: "Other", rca: 1.085, pci: -0.435, trad: 0.0, tier: 2, tradable: false},
    {name: "Political Organizations", code: "813940", employ: 141.39, sector: "Other", rca: 0.553, pci: 0.895, trad: 0.5, tier: 1, tradable: true},
    {name: "Other Similar Organizations (except Business, Professional, Labor, and Political Organizations)", code: "813990", employ: 341.73, sector: "Other", rca: 0.169, pci: 0.223, trad: 0.5, tier: 1, tradable: true},
    {name: "Private Households", code: "814110", employ: 5017.0, sector: "Other", rca: 1.226, pci: null, trad: 0.0, tier: 2, tradable: false}
  ];

  /* Tradability, RCA, PCI and the tier per industry, as the source gives
     them; nothing here is generated any more */
  const tradByName = new Map(rawData.map(r => [r.name, r.trad]));
  const tierByName = new Map(rawData.map(r => [r.name, r.tier]));
  const rcaReal    = new Map(rawData.map(r => [r.name, Math.round(r.rca * 100) / 100]));
  const pciByName  = new Map(rawData.map(r => [r.name, r.pci]));
  const tradableByName = new Map(rawData.map(r => [r.name, r.tradable]));

  /* every industry, at its real 2024 employment: 2,318,250 jobs over 292
     industries. The commuting section's LEHD figures (687,736 jobs inside
     the admin city) were told against a drawn total of 2.82M; against the
     real total they are 30% of the metro's jobs, not 24%. */
  const industryData = [...rawData].sort((a, b) => b.employ - a.employ);
  const ADMIN_JOBS = 687736;
  {
    const w = industryData.reduce((a, d) => a + d.employ * (ADMIN_SHARE[d.sector] ?? 0.15), 0);
    const k = ADMIN_JOBS / w;
    Object.keys(ADMIN_SHARE).forEach(sec => { ADMIN_SHARE[sec] = Math.round(ADMIN_SHARE[sec] * k * 1000) / 1000; });
  }

  /* Build the sector -> industries hierarchy for a given set of rows. */
  function hierarchyFor(rows, label){
    const bySector = {};
    rows.forEach(d => {
      (bySector[d.sector] = bySector[d.sector] || []).push({ name: d.name, value: d.employ });
    });
    return {
      name: label,
      children: Object.entries(bySector).map(([sector, children]) => ({ name: sector, children }))
    };
  }

  /* Lay out a sector-grouped treemap into a box of the given width. */
  function layout(rows, label, boxWidth){
    const node = d3.hierarchy(hierarchyFor(rows, label)).sum(d => d.value);
    d3.treemap().size([boxWidth, HEIGHT])
      .paddingTop(1).paddingRight(1).paddingBottom(1).paddingLeft(1)(node);
    return node;
  }

  /* Truncate a label to what actually fits, or drop it when the cell is tiny. */
  /* The cell labels are drawn in the figure's own 880-unit box, so on a
     phone an 11-unit label renders at under 5px. The stylesheet raises the
     unit size at narrow widths; this reads that back, because the budget
     fitLabel spends — 8 units a character, a 20-unit floor under the cell,
     a baseline 11 units down — was written for 11-unit type and has to
     scale with it or the names overrun the cells they name.
     At 11 the arithmetic is exactly what it always was. */
  const LAB_BASE = 11;
  function labUnit(){
    const el = document.getElementById("miTreemapSvg");
    if (!el) return LAB_BASE;
    const v = parseFloat(getComputedStyle(el).getPropertyValue("--mi-lab"));
    return v > 0 ? v : LAB_BASE;
  }
  function fitLabel(name, box, unit){
    const u = unit || LAB_BASE;
    if (box.width < 40 || box.height < 20 * (u / LAB_BASE)) return "";
    const chars = Math.floor((box.width - 8) / (8 * (u / LAB_BASE)));
    if (chars <= 3) return "";
    return name.length > chars ? name.slice(0, chars - 3) + "…" : name;
  }

  /* The cells of the industry figure are labelled as Metroverse labels its
     composition map: the full name at the top left, wrapped by whole words
     and set as large as the cell allows, and the industry's share of all
     jobs centred along the bottom in larger, lighter numerals. A name is
     never cut: if it cannot be set whole at the smallest size, the cell
     carries no text at all, rather than a stub like "X...". Widths come
     from a canvas, which measures the same whether or not the figure is on
     screen - the cells are built while their page is still hidden. */
  const _labCtx = (function(){
    try { return document.createElement("canvas").getContext("2d"); } catch (e){ return null; }
  })();
  const LAB_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  /* measured at the size it will be set at, never scaled from another: the
     system face tracks tighter as it grows, so 8px type runs wider than a
     twelfth of the same words at 100px - which is how names came to overrun
     the smallest cells */
  const _textW = new Map();
  function textW(str, f, weight){
    const key = weight + "|" + f + "|" + str;
    if (_textW.has(key)) return _textW.get(key);
    let w;
    if (_labCtx){ _labCtx.font = weight + " " + f + "px " + LAB_STACK; w = _labCtx.measureText(str).width * 1.03; }
    else w = str.length * f * 0.58;
    _textW.set(key, w);
    return w;
  }
  function wrapWords(name, maxW, f){
    const lines = [];
    let line = "";
    for (const w of name.split(/\s+/)){
      if (textW(w, f, 400) > maxW) return null;        /* a word that will not fit: no cutting */
      const next = line ? line + " " + w : w;
      if (line && textW(next, f, 400) > maxW){ lines.push(line); line = w; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  const _labSpec = new Map();
  /* k is the unit scale the stylesheet asks for at this width (1 on desktop) */
  function cellLabelSpec(name, w, h, k, pctText){
    const key = name + "|" + Math.round(w) + "|" + Math.round(h) + "|" + k + "|" + pctText;
    if (_labSpec.has(key)) return _labSpec.get(key);
    let out = null;
    if (w >= 26 * k && h >= 14 * k){
      const pad = Math.max(3, Math.min(7, Math.min(w, h) * 0.05)) * Math.min(k, 1.4);
      const minF = 8 * k, maxF = Math.max(minF, Math.min(18 * k, Math.min(w, h) * 0.16));
      const availW = w - 2 * pad, LH = 1.14;
      const sizes = [];
      for (let f = Math.floor(maxF); f > minF; f -= 1) sizes.push(f);
      sizes.push(minF);
      const tryFit = withPct => {
        for (const f of sizes){
          const lines = wrapWords(name, availW, f);
          if (!lines) continue;
          let pf = 0, need = pad + lines.length * f * LH + pad;
          if (withPct){
            pf = Math.round(Math.min(26 * k, Math.max(9 * k, f * 1.5), h * 0.24));
            while (pf > 9 * k && textW(pctText, pf, 300) > availW) pf -= 1;
            if (textW(pctText, pf, 300) > availW) continue;
            need += pf * 1.05 + pad * 0.5;
          }
          if (need <= h) return { f: f, lines: lines, pf: pf, pad: pad, lh: LH };
        }
        return null;
      };
      out = (h >= 30 * k && w >= 36 * k ? tryFit(true) : null) || tryFit(false);
    }
    _labSpec.set(key, out);
    return out;
  }
  /* White on the deeper fills, ink on the light ones - chosen on the
     contrast each one actually has with the fill, not on a brightness
     score. The perceived-lightness test this used to run put white on four
     of the nine sector fills that read far better in ink: the two largest
     blocks on the map, education & health and trade & transportation, were
     carrying their names at 2.7:1 and 2.4:1 where ink gives 6.1 and 6.7.
     Three fills used to clear 4.5:1 with neither ink - manufacturing,
     other, and the ramp's darkest green. Each has since been taken down
     about five points of L*, the smallest move that carries white text at
     4.6:1, so every fill in the figure now reads. */
  const CELL_INK = "#1a2226";
  const relLum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const LUM_INK = relLum({ r: 26, g: 34, b: 38 });
  function cellInk(fill){
    const c = d3.color(fill); if (!c) return "#fff";
    const L = relLum(c.rgb());
    const onWhite = 1.05 / (L + 0.05);
    const onInk = (L + 0.05) / (LUM_INK + 0.05);
    return onInk >= onWhite ? CELL_INK : "#fff";
  }

  /* Draw the sector-grouped map into an <svg>, returning its pieces. */
  function draw(svgEl){
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const root = layout(industryData, "root", WIDTH);
    root.children.forEach(s => { s.key = "L:" + s.data.name; });

    // Separate layers keep sector blocks behind the industry cells.
    const sectorLayer   = svg.append("g").attr("class", "sector-layer");
    const industryLayer = svg.append("g").attr("class", "industry-layer");

    sectorLayer.selectAll("rect")
      .data(root.children, d => d.key)
      .join("rect")
      .attr("class", "sector-rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
      .attr("fill", d => sectorColors[d.data.name]);

    const cells = industryLayer.selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("class", "industry");

    // rect.cell so the "Color by" control can target these.
    // Fully opaque: the sector blocks sit behind these cells, and a translucent
    // cell would composite over them and muddy the complexity palette.
    cells.append("rect")
      .attr("class", "cell industry-rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
      .attr("fill", d => cellFill(svgEl.id, d, false));

    cells.append("text")
      .attr("class", "industry-text")
      .attr("x", d => d.x0 + 4).attr("y", d => d.y0 + 11)
      .style("font-size", "8px")
      .text(d => fitLabel(d.data.name, { width: d.x1 - d.x0, height: d.y1 - d.y0 }));

    return { svg, root, sectorLayer, cells };
  }

  /* ---------- 1. static map ---------- */
  function renderStaticTreemap(){
    const el = document.getElementById("exportTreemapSvg");
    if (el) draw(el);
  }

  /* the complexity beat: the same mix drawn again, shaded by how much
     knowledge each industry takes rather than which sector it sits in */
  function renderComplexityTreemap(){
    const el = document.getElementById("complexityTreemapSvg");
    if (el) draw(el);
  }
  function initComplexityTooltip(){
    const svgEl = document.getElementById("complexityTreemapSvg");
    const tip = document.getElementById("complexityTip");
    const wrap = svgEl && svgEl.closest(".tradable-viz-wrapper");
    if (!svgEl || !tip || !wrap) return;
    attachCellTip(svgEl, wrap, tip);
  }

  /* ---------- 2. animated split ---------- */
  /* ---------- 3. the tradable split ----------
     Ported from v-2: the metro's mix parts into two halves, the industries
     that sell outward keeping their sector colours on the left and the ones
     serving the people already here going grey on the right. Which side an
     industry lands on follows its own tradability score, so the split is the
     same one the beat's donut and the tooltips report. */
  function initTradableAnimation(){
    const el = document.getElementById("tradableAnimatedSvg");
    if (!el) return;

    const { svg, root, sectorLayer, cells } = draw(el);
    const allLeaves = root.leaves();

    function reset(){
      sectorLayer.selectAll(".sector-rect").interrupt();
      sectorLayer.selectAll(".sector-rect")
        .data(root.children, d => d.key)
        .join("rect")
        .attr("class", "sector-rect")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("fill", d => sectorColors[d.data.name])
        .style("opacity", 1);

      cells.select(".cell").interrupt()
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("fill", d => cellFill(el.id, d, false));

      cells.select(".industry-text").interrupt()
        .style("opacity", 1)
        .attr("x", d => d.x0 + 4).attr("y", d => d.y0 + 11)
        .text(d => fitLabel(d.data.name, { width: d.x1 - d.x0, height: d.y1 - d.y0 }));

      el.classList.remove("animated");
      document.querySelectorAll(".tradable-split-header")
        .forEach(h => h.classList.remove("is-on"));
    }

    function run(){
      reset();

      /* which side an industry lands on is its own tradability score, not a
         random draw as in v-2 — the halves then agree with the donut above
         the chart and with every tooltip */
      const nonTradableNames = new Set(
        allLeaves.filter(d => !isTradable(d.data.name)).map(d => d.data.name));

      const tradable    = allLeaves.filter(d => !nonTradableNames.has(d.data.name));
      const nonTradable = allLeaves.filter(d =>  nonTradableNames.has(d.data.name));

      // Equal-width halves, both using the full height.
      const gap = 6;
      const half = (WIDTH - gap) / 2;
      const rightX = half + gap;

      // Left keeps the sector grouping; right is a flat grey treemap.
      const left = layout(
        tradable.map(d => ({ name: d.data.name, employ: d.value, sector: d.parent.data.name })),
        "L", half
      );
      const right = d3.hierarchy({
        name: "R",
        children: nonTradable.map(d => ({ name: d.data.name, value: d.value }))
      }).sum(d => d.value);
      d3.treemap().size([half, HEIGHT])
        .paddingTop(1).paddingRight(1).paddingBottom(1).paddingLeft(1)(right);

      const box = new Map();
      left.leaves().forEach(n => box.set(n.data.name,
        { x: n.x0, y: n.y0, width: n.x1 - n.x0, height: n.y1 - n.y0, grey: false }));
      right.leaves().forEach(n => box.set(n.data.name,
        { x: rightX + n.x0, y: n.y0, width: n.x1 - n.x0, height: n.y1 - n.y0, grey: true }));

      // Sector blocks now describe the left half only.
      left.children.forEach(s => { s.key = "L:" + s.data.name; });
      const blocks = sectorLayer.selectAll(".sector-rect").data(left.children, d => d.key);

      blocks.exit().transition().duration(500).style("opacity", 0).remove();

      blocks.enter().append("rect")
        .attr("class", "sector-rect")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("fill", d => sectorColors[d.data.name])
        .style("opacity", 0)
        .transition().delay(700).duration(700).style("opacity", 1);

      blocks.transition().duration(1200).ease(d3.easeCubicInOut)
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0);

      cells.select(".industry-text").transition().duration(300).style("opacity", 0);

      cells.select(".cell")
        .transition().duration(1200).ease(d3.easeCubicInOut)
        .attr("x", d => box.get(d.data.name).x)
        .attr("y", d => box.get(d.data.name).y)
        .attr("width", d => box.get(d.data.name).width)
        .attr("height", d => box.get(d.data.name).height)
        .attr("fill", d => cellFill(el.id, d, box.get(d.data.name).grey))
        .on("end", function(d, i){
          if (i !== cells.size() - 1) return;   // run the follow-up once
          cells.select(".industry-text")
            .attr("x", d => box.get(d.data.name).x + 4)
            .attr("y", d => box.get(d.data.name).y + 11)
            .text(d => fitLabel(d.data.name, box.get(d.data.name)))
            .transition().duration(400).style("opacity", 1);
        });

      splitState[el.id] = box;
      if (tradableClearHover) tradableClearHover();
      el.classList.add("animated");
      /* the scrolly lifts both the chart and its split headers out of the
         subsection, so the reveal is set on the headers themselves rather
         than on an ancestor the two no longer share */
      const section = el.closest(".export-subsection");
      if (section) section.classList.add("animated");
      document.querySelectorAll(".tradable-split-header")
        .forEach(h => h.classList.add("is-on"));
    }

    const btn = document.getElementById("replayBtn");
    if (btn) btn.addEventListener("click", run);

    // Play once when the section first scrolls into view.
    new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        setTimeout(run, 300);
        obs.disconnect();
      });
    }, { threshold: 0.35 }).observe(el);
  }

  /* Repaint one treemap for the given "Color by" mode, preserving any
     tradable/non-tradable split already on screen. `legends` maps a mode to the
     id of the legend that explains it. */
  function setColorBy(svgId, mode, legends){
    colorMode[svgId] = mode;
    const split = splitState[svgId];
    d3.select("#" + svgId).selectAll(".cell")
      .attr("fill", d => cellFill(svgId, d, split ? !!(split.get(d.data.name) || {}).grey : false));

    if (svgId === "exportTreemapSvg"){
      refreshExportOption();
      updateExportHeadStat();
    }

    if (legends) {
      const show = (id, on) => {
        const el = id && document.getElementById(id);
        if (el) el.classList.toggle("show", on);
      };
      show(legends.complexity, mode === COMPLEXITY);
      show(legends.change,     mode === TRADABILITY);
    }
  }

  /* =====================================================================
     3 · Specialization (RCA)

     RCA = the industry's share of local jobs divided by its share of jobs
     across US metros (the benchmark). Above 1.0 means the industry is more
     concentrated here than it is nationally.

     Dummy values for the prototype, held stable per industry. A handful of
     plausible Boston strengths are seeded by hand; the rest are random with
     most sitting below 1.0.
     ===================================================================== */
  const RCA_TOP_N = 10;

  /* The RCA values below are no longer read - the source carries the real
     ones - but the short names are, matched on the name with its
     punctuation removed, since the source spells "Colleges, Universities,
     and Professional Schools" with commas. */
  const rcaSeed = {
    /* short names for the rows the real ranking brings up */
    "Seafood Product Preparation and Packaging":                                  { rca: 0, short: "Seafood preparation" },
    "Computer and Peripheral Equipment Manufacturing":                            { rca: 0, short: "Computer equipment makers" },
    "Textile and Fabric Finishing and Fabric Coating Mills":                      { rca: 0, short: "Textile finishing mills" },
    "Industrial Machinery Manufacturing":                                         { rca: 0, short: "Industrial machinery" },
    "Web Search Portals, Libraries, Archives, and Other Information Services":    { rca: 0, short: "Information services" },
    "School and Employee Bus Transportation":                                     { rca: 0, short: "School and employee buses" },
    "Colleges Universities and Professional Schools":                             { rca: 5.4, short: "Colleges and universities" },
    "Scientific Research and Development Services":                               { rca: 4.1, short: "Scientific R&D services" },
    "Other Financial Investment Activities":                                      { rca: 3.6, short: "Other financial investment" },
    "Pharmaceutical and Medicine Manufacturing":                                  { rca: 3.2, short: "Pharmaceutical manufacturing" },
    "Junior Colleges":                                                            { rca: 2.9, short: "Junior colleges" },
    "General Medical and Surgical Hospitals":                                     { rca: 2.7, short: "General medical hospitals" },
    "Management Scientific and Technical Consulting Services":                    { rca: 2.4, short: "Management consulting" },
    "Computer Systems Design and Related Services":                               { rca: 2.2, short: "Computer systems design" },
    "Medical and Diagnostic Laboratories":                                        { rca: 2.0, short: "Medical and diagnostic labs" },
    "Navigational Measuring Electromedical and Control Instruments Manufacturing":{ rca: 1.9, short: "Navigational instruments" },
    "Medical Equipment and Supplies Manufacturing":                               { rca: 1.7, short: "Medical equipment manufacturing" },
    "Securities and Commodity Contracts Intermediation and Brokerage":            { rca: 1.5, short: "Securities brokerage" },
    "Other Information Services":                                                 { rca: 1.42, short: "Other information services" },
    "Architectural Engineering and Related Services":                             { rca: 1.3, short: "Architectural and engineering" },
    "Insurance Carriers":                                                         { rca: 1.24, short: "Insurance carriers" },
    "Software Publishers":                                                        { rca: 1.15, short: "Software publishers" },
    "Legal Services":                                                             { rca: 1.08, short: "Legal services" }
  };
  const normName = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const shortByNorm = new Map(Object.entries(rcaSeed).map(([n, v]) => [normName(n), v.short]));
  const shortLabel = name => shortByNorm.get(normName(name));

  /* tradable at all, for the figures that split two ways and for the
     specialisation list, is the source's own flag: the traded tier and the
     more outward part of the partly traded one */
  function isTradable(name){ return tradableByName.get(name) === true; }

  function rcaOf(name){ return rcaReal.has(name) ? rcaReal.get(name) : 0; }

  const totalCityJobs = industryData.reduce((s, d) => s + d.employ, 0);

  function specialized(rows){
    const set = rows || industryData;
    const total = set.reduce((a, d) => a + d.employ, 0) || 1;
    return set
      .filter(d => isTradable(d.name) && rcaOf(d.name) > 1)
      .map(d => {
        const rca = rcaOf(d.name);
        // Shares behind the ratio, so a tooltip can show numbers that
        // actually divide out to the multiplier rather than asserting it.
        const localPct = d.employ / total * 100;
        return {
          name: d.name,
          sector: d.sector,
          employ: d.employ,
          rca: rca,
          localPct: localPct,
          worldPct: localPct / rca,
          label: shortLabel(d.name) ||
                 (d.name.length > 40 ? d.name.slice(0, 37) + "…" : d.name)
        };
      })
      .sort((a, b) => b.rca - a.rca);
  }

  const cityName = (document.querySelector(".city-short") || {}).textContent || "Your city";
  const fmtJobs = n => Math.round(n).toLocaleString();
  /* One decimal, except near the benchmark: 1.02 rounded to "1×" would read as
     sitting on the line, contradicting a chart filtered to everything above it. */
  const fmtX = v => {
    const one = Math.round(v * 10) / 10;
    return (one <= 1 ? v.toFixed(2) : one) + "×";
  };

  let rcaShowAll = false;
  /* "bar" (live design) or "dot" — the alternative, reachable from the viz bar.
     Bars read the excess over the benchmark as a length, which is the quantity
     the chart is actually about; the dot form encodes employment in its radius
     as well, which the row tooltip now carries either way. */
  let rcaDesign = "bar";

  /* Shared axis header for both RCA charts, so they read identically.
     "RCA = 1" sits at the head of the benchmark line and reads rightwards from
     it; the axis title shares that baseline and is centred over the scale —
     nudged right only if it would otherwise run into the marker. */
  const RCA_LABEL_ZONE = 84;   // width reserved for the "RCA = 1" marker

  function drawAxisHeader(svg, x, plotR, MT, gridBottom, plainLabel){
    const baseline = MT - 40;

    svg.append("line").attr("class", "rca-benchmark")
      .attr("x1", x(1)).attr("y1", MT - 12).attr("x2", x(1)).attr("y2", gridBottom);

    // Centred on the scale *after* the marker's zone. Measuring the rendered
    // text would be exact, but getComputedTextLength returns 0 while the page
    // is hidden at init, so the clamp would silently never fire.
    svg.append("text").attr("class", "rca-axis-title")
      .attr("x", (x(1) + RCA_LABEL_ZONE + plotR) / 2).attr("y", baseline)
      .attr("text-anchor", "middle")
      .text("Times more concentrated in this metro than in the US metros");

    const bench = svg.append("g").attr("class", "rca-bench-hit");
    bench.append("rect")
      .attr("x", x(1) - 6).attr("y", MT - 29)
      .attr("width", 74).attr("height", 16);
    /* the marker sits just above the line it names, dressed like a tick —
       an axis annotation, not a second title */
    bench.append("text")
      .attr("class", "rca-benchmark-label" + (plainLabel ? " rca-benchmark-label--plain" : ""))
      .attr("x", x(1) + 7).attr("y", MT - 17).attr("text-anchor", "start")
      .text("RCA = 1");

    return bench;
  }

  /* Sits above the band's top-left corner, reading left to right across it —
     a title over the three rows rather than a note against any one of them. */
  function topTag(svg, rows, x0, y, versusPeers){
    if (rows.length < 3) return;
    let text = "Most concentrated tradable industries";
    if (versusPeers) {
      const ahead = rows.slice(0, 3).filter(d => d.ahead).length;
      text = ahead === 3 ? "All three beat their peers"
           : ahead === 0 ? "All three trail their peers"
           : "Mixed against peers";
    }
    svg.append("text").attr("class", "rca-top-tag")
      .attr("x", x0).attr("y", y).attr("text-anchor", "start").text(text);
  }

  function renderRcaChart(){
    const el = document.getElementById("rcaChartSvg");
    if (!el) return;

    const all  = specialized();
    const rows = rcaShowAll ? all : all.slice(0, RCA_TOP_N);

    // Employment now lives in the row tooltip, so the plot takes that width.
    const W = 880, ML = 300, MT = 76, MB = 26, RH = 34;
    const PLOT_R = 800;
    const H = MT + rows.length * RH + MB;

    const svg = d3.select(el)
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("height", H);
    svg.selectAll("*").remove();

    // Axis starts at 1, not 0. Nothing is ever drawn below the benchmark on a
    // chart filtered to RCA > 1, so a 0–1 stretch would be dead space between
    // the labels and the line. Stems measure excess over 1.0, so 1 is the
    // meaningful origin here.
    const x = d3.scaleLinear()
      .domain([1, d3.max(all, d => d.rca) * 1.05])
      .range([ML + 10, PLOT_R]);
    const rad = d3.scaleSqrt()
      .domain([0, d3.max(all, d => d.employ)])
      .range([3.5, 13]);

    const rowY = i => MT + i * RH + RH / 2;
    const gridBottom = MT + rows.length * RH;

    // Behind the gridlines and everything else, so the band tints the rows
    // without hiding any part of the chart drawn over it.
    if (rows.length >= 3) {
      svg.append("rect").attr("class", "rca-top-band")
        .attr("x", 0).attr("y", MT).attr("width", W).attr("height", 3 * RH);
    }

    svg.append("line").attr("class", "rca-axis")
      .attr("x1", x.range()[0]).attr("y1", MT - 12).attr("x2", PLOT_R).attr("y2", MT - 12);

    // whole-number ticks only; 1 is drawn as the benchmark instead
    const hi = Math.floor(x.domain()[1]);
    for (let t = 2; t <= hi; t++) {
      svg.append("line").attr("class", "rca-grid")
        .attr("x1", x(t)).attr("y1", MT - 12).attr("x2", x(t)).attr("y2", gridBottom);
      svg.append("text").attr("class", "rca-tick")
        .attr("x", x(t)).attr("y", MT - 20).attr("text-anchor", "middle").text(t + "×");
    }

    const bench = drawAxisHeader(svg, x, PLOT_R, MT, gridBottom, false);

    const tip  = document.getElementById("rcaTip");
    const wrap = el.parentElement;
    if (tip && wrap) {
      bench
        .on("mouseenter", function(){
          const b = this.getBoundingClientRect();
          const w = wrap.getBoundingClientRect();
          tip.hidden = false;
          const left = b.left - w.left + b.width / 2 - tip.offsetWidth / 2;
          tip.style.left = Math.max(0, Math.min(left, w.width - tip.offsetWidth)) + "px";
          tip.style.top  = (b.bottom - w.top + 8) + "px";
        })
        .on("mouseleave", function(){ tip.hidden = true; });
    }

    const g = svg.selectAll(".rca-row").data(rows).join("g").attr("class", "rca-row");

    // Both charts sort by RCA, so "first three" is the same three industries in
    // each — which is what lets the peer label refer back to the other chart.
    g.classed("is-top", (d, i) => i < 3);

    g.append("rect").attr("class", "rca-hit")
      .attr("x", 0).attr("y", (d, i) => MT + i * RH)
      .attr("width", W).attr("height", RH);

    g.append("text").attr("class", "rca-label")
      .attr("x", ML - 16).attr("y", (d, i) => rowY(i) + 4)
      .attr("text-anchor", "end").text(d => d.label);

    if (rcaDesign === "bar") {
      // Bars run from the benchmark, not from zero, so their length is the
      // excess over 1.0 rather than a total measured from an origin no row
      // ever reaches. Employment is not encoded in the mark here — it only
      // appears in the Employment column.
      g.append("rect").attr("class", "rca-bar")
        .attr("x", x(1)).attr("y", (d, i) => rowY(i) - 9)
        .attr("width", d => Math.max(1.5, x(d.rca) - x(1)))
        .attr("height", 18)
        .attr("fill", d => sectorColors[d.sector]);
    } else {
      // stem runs from the benchmark, so its length is the excess over 1.0
      g.append("line").attr("class", "rca-stem")
        .attr("x1", x(1)).attr("y1", (d, i) => rowY(i))
        .attr("x2", d => x(d.rca)).attr("y2", (d, i) => rowY(i))
        .attr("stroke", d => sectorColors[d.sector]);

      g.append("circle").attr("class", "rca-dot")
        .attr("cx", d => x(d.rca)).attr("cy", (d, i) => rowY(i))
        .attr("r", d => rad(d.employ))
        .attr("fill", d => sectorColors[d.sector]);
    }

    // "5.4×" reads as a multiplier; "5.40" reads as a score on an unknown scale
    g.append("text").attr("class", "rca-value")
      .attr("x", d => x(d.rca) + (rcaDesign === "bar" ? 9 : rad(d.employ) + 9))
      .attr("y", (d, i) => rowY(i) + 4)
      .text(d => fmtX(d.rca));

    // Row tooltip carries what the marks can't: the exact employment count,
    // the year, and the two shares the multiplier is derived from.
    topTag(svg, rows, 0, MT - 7, false);

    const rowTip = document.getElementById("rcaRowTip");
    if (rowTip && wrap) {
      const yearSel = document.querySelector("#specializationSection .ctl select");
      g.on("mouseenter", function(ev, d){
        const year = yearSel ? yearSel.value : "";
        rowTip.innerHTML =
          '<strong>' + d.name + '</strong>' +
          (year ? '<div class="tip-row"><span>Year</span><span>' + year + '</span></div>' : '') +
          '<div class="tip-row"><span>RCA</span><span>' + fmtX(d.rca) + '</span></div>' +
          '<div class="tip-sub">' + d.localPct.toFixed(2) + '% of ' + cityName +
            "'s jobs vs " + d.worldPct.toFixed(2) + "% across US metros</div>" +
          '<div class="tip-row"><span>Employment</span><span>' +
            fmtJobs(d.employ) + ' jobs</span></div>';
        rowTip.hidden = false;
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, rowTip);
      })
      .on("mouseleave", function(){ rowTip.hidden = true; });
    }

    const btn = document.getElementById("rcaToggleBtn");
    if (btn) {
      btn.textContent = rcaShowAll
        ? "Show top " + RCA_TOP_N
        : "Show all " + all.length;
    }

    // legend covering only the sectors actually on screen
    const legend = document.getElementById("rcaLegend");
    if (legend) {
      const seen = [];
      rows.forEach(d => { if (seen.indexOf(d.sector) === -1) seen.push(d.sector); });
      legend.innerHTML = seen.sort().map(s =>
        '<span class="rca-sw"><i style="background:' + sectorColors[s] + '"></i>' +
        s + "</span>").join("");
    }

    /* Only the mark-specific key swaps. The sector legend describes both forms —
       bars are filled by sector too — and with bar as the default, dropping the
       whole footnote would leave the chart's only colour key off the page. */
    const isBar = (rcaDesign === "bar");
    /* the bar form reads without a legend — sector colour is decoration the
       row labels already carry, and the footnote returns with the dot form */
    const foot = document.getElementById("rcaFootnote");
    if (foot) foot.hidden = isBar;
    const setKey = (id, shown) => {
      const k = document.getElementById(id);
      if (k) k.hidden = !shown;
    };
    setKey("rcaDotKey", !isBar);
    setKey("rcaBarKey", isBar);
  }

  /* =====================================================================
     4 · Peer comparison

     Same RCA formula, same US-metro benchmark — computed independently for each
     peer city, then compared. The peer marker is a single number (the mean of
     the four), with the individual cities available on hover.
     ===================================================================== */
  const PEERS = ["Washington", "Seattle", "Denver", "San Diego"];
  const peerByName = new Map();

  /* Profile card shown when hovering a peer city. Dummy figures for the
     prototype; the home city's column is the same on every card. */
  const HOME_PROFILE = {
    label: "Boston, MA",
    population: "660K", density: "5,400/km²", wage: "$100,000",
    home: "$971,000", share: "13.4%", diversity: "0.64"
  };

  const PEER_PROFILES = {
    "Washington": { label: "Washington, DC",
      population: "690K", density: "4,457/km²", wage: "$105,318",
      home: "$625,470", share: "10.8%", diversity: "0.69" },
    "Seattle": { label: "Seattle, WA",
      population: "755K", density: "3,390/km²", wage: "$112,000",
      home: "$866,000", share: "18.6%", diversity: "0.61" },
    "Denver": { label: "Denver, CO",
      population: "715K", density: "1,830/km²", wage: "$85,000",
      home: "$585,000", share: "24.1%", diversity: "0.73" },
    "San Diego": { label: "San Diego, CA",
      population: "1.39M", density: "1,680/km²", wage: "$88,000",
      home: "$902,000", share: "41.5%", diversity: "0.70" }
  };

  const PROFILE_ROWS = [
    ["Population",      "population"],
    ["Density",         "density"],
    ["Average salary",  "wage"],
    ["Home value",      "home"],
    ["Share of metro",  "share"],
    ["Diversity index", "diversity"]
  ];

  function initPeerCityChips(){
    const wrap = document.getElementById("peerCityList");
    if (!wrap) return;
    wrap.innerHTML = PEERS.map(name => {
      const p = PEER_PROFILES[name];
      if (!p) return "";
      const rows = PROFILE_ROWS.map(([label, key]) =>
        '<tr><th scope="row">' + label + "</th>" +
        "<td>" + p[key] + "</td>" +
        "<td>" + HOME_PROFILE[key] + "</td></tr>").join("");
      return '<span class="peer-city">' +
        '<button type="button" class="peer-city-btn">' + p.label + "</button>" +
        '<span class="peer-card" role="tooltip">' +
          "<table><thead><tr><td></td>" +
            "<th>This</th><th>" + HOME_PROFILE.label.split(",")[0] + "</th>" +
          "</tr></thead><tbody>" + rows + "</tbody></table>" +
        "</span></span>";
    }).join("");
  }

  function peersFor(name, cityRca){
    if (!peerByName.has(name)) {
      // Where the peer group sits relative to this city. Mostly below (the
      // city is specialised here), sometimes above — those are the rows worth
      // arguing about.
      const factor = 0.4 + srand() * 0.85;
      // Floor the target, never the resulting average — clamping after the
      // fact would leave the tick showing a number the four cities don't
      // actually average to.
      const target = Math.max(1.15, cityRca * factor);

      // Spread four cities around that target, then rescale so they average
      // to it exactly — the tooltip numbers must reconcile with the tick.
      const jitter = PEERS.map(() => 0.62 + srand() * 0.76);
      const mean = jitter.reduce((s, j) => s + j, 0) / jitter.length;
      const values = jitter.map(j => Math.round(target * (j / mean) * 10) / 10);

      // Average taken from the rounded values, so what is shown adds up.
      const avg = Math.round(
        (values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;

      peerByName.set(name, { values: values, avg: avg });
    }
    return peerByName.get(name);
  }

  function specializedWithPeers(rows){
    // Compare on the values the reader actually sees. Testing the raw numbers
    // would flag a row orange while its two labels read identically.
    const shown = v => Math.round(v * 10) / 10;
    return specialized(rows).map(d => {
      const p = peersFor(d.name, d.rca);
      return Object.assign({}, d, {
        peerAvg: p.avg,
        peerValues: p.values,
        ahead: shown(d.rca) >= shown(p.avg)
      });
    });
  }

  let peerShowAll = false;
  /* Follows the specialization chart: the two are one section behind a toggle,
     so switching views must not also switch mark type under the reader. */
  let peerDesign = "bar";

  function renderPeerChart(){
    const el = document.getElementById("peerChartSvg");
    if (!el) return;

    const all  = specializedWithPeers();
    const rows = peerShowAll ? all : all.slice(0, RCA_TOP_N);

    // Employment lives in the row tooltip, so the plot takes that width.
    const W = 880, ML = 300, MT = 76, MB = 26, RH = 34;
    const PLOT_R = 800;
    const H = MT + rows.length * RH + MB;

    const svg = d3.select(el)
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("height", H);
    svg.selectAll("*").remove();

    const hiVal = d3.max(all, d => Math.max(d.rca, d.peerAvg));
    const x = d3.scaleLinear().domain([1, hiVal * 1.05]).range([ML + 10, PLOT_R]);
    const rad = d3.scaleSqrt()
      .domain([0, d3.max(all, d => d.employ)]).range([3.5, 13]);

    const rowY = i => MT + i * RH + RH / 2;
    const gridBottom = MT + rows.length * RH;

    // Behind the gridlines and everything else, so the band tints the rows
    // without hiding any part of the chart drawn over it.
    if (rows.length >= 3) {
      svg.append("rect").attr("class", "rca-top-band")
        .attr("x", 0).attr("y", MT).attr("width", W).attr("height", 3 * RH);
    }

    svg.append("line").attr("class", "rca-axis")
      .attr("x1", x.range()[0]).attr("y1", MT - 12).attr("x2", PLOT_R).attr("y2", MT - 12);

    const hi = Math.floor(x.domain()[1]);
    for (let t = 2; t <= hi; t++) {
      svg.append("line").attr("class", "rca-grid")
        .attr("x1", x(t)).attr("y1", MT - 12).attr("x2", x(t)).attr("y2", gridBottom);
      svg.append("text").attr("class", "rca-tick")
        .attr("x", x(t)).attr("y", MT - 20).attr("text-anchor", "middle").text(t + "×");
    }

    drawAxisHeader(svg, x, PLOT_R, MT, gridBottom, true);

    const g = svg.selectAll(".rca-row").data(rows).join("g").attr("class", "rca-row");

    // Both charts sort by RCA, so "first three" is the same three industries in
    // each — which is what lets the peer label refer back to the other chart.
    g.classed("is-top", (d, i) => i < 3);

    g.append("rect").attr("class", "rca-hit")
      .attr("x", 0).attr("y", (d, i) => MT + i * RH)
      .attr("width", W).attr("height", RH);

    g.append("text").attr("class", "rca-label")
      .attr("x", ML - 16).attr("y", (d, i) => rowY(i) + 4)
      .attr("text-anchor", "end").text(d => d.label);

    if (peerDesign === "bar") {
      // Bullet form: the bar is this city, the tick is the peer target. Where
      // the bar falls short of the tick, the shortfall is drawn in.
      g.append("rect").attr("class", "rca-bar")
        .attr("x", x(1)).attr("y", (d, i) => rowY(i) - 9)
        .attr("width", d => Math.max(1.5, x(d.rca) - x(1)))
        .attr("height", 18)
        .attr("fill", d => sectorColors[d.sector]);

      g.append("line").attr("class", "peer-gap peer-gap--behind")
        .attr("x1", d => x(d.rca)).attr("y1", (d, i) => rowY(i))
        .attr("x2", d => x(Math.max(d.rca, d.peerAvg))).attr("y2", (d, i) => rowY(i))
        .style("display", d => d.ahead ? "none" : null);

      // taller than the bar so it stays readable where it overlaps
      g.append("line").attr("class", "peer-tick")
        .attr("x1", d => x(d.peerAvg)).attr("y1", (d, i) => rowY(i) - 13)
        .attr("x2", d => x(d.peerAvg)).attr("y2", (d, i) => rowY(i) + 13);
    } else {
      // Connector spans the gap. Neutral by default; highlighted only where the
      // city trails its peers, since those are the exceptions worth spotting.
      g.append("line")
        .attr("class", d => "peer-gap" + (d.ahead ? "" : " peer-gap--behind"))
        .attr("x1", d => x(Math.min(d.rca, d.peerAvg))).attr("y1", (d, i) => rowY(i))
        .attr("x2", d => x(Math.max(d.rca, d.peerAvg))).attr("y2", (d, i) => rowY(i));

      // Peer average is a tick, not a dot — a different mark shape reads as a
      // reference value rather than a second comparable observation.
      g.append("line").attr("class", "peer-tick")
        .attr("x1", d => x(d.peerAvg)).attr("y1", (d, i) => rowY(i) - 9)
        .attr("x2", d => x(d.peerAvg)).attr("y2", (d, i) => rowY(i) + 9);

      g.append("circle").attr("class", "rca-dot")
        .attr("cx", d => x(d.rca)).attr("cy", (d, i) => rowY(i))
        .attr("r", d => rad(d.employ))
        .attr("fill", d => sectorColors[d.sector]);
    }

    g.append("text")
      .attr("class", d => "rca-value" + (d.ahead ? "" : " rca-value--behind"))
      .attr("x", d => x(Math.max(d.rca, d.peerAvg)) +
                      (peerDesign === "bar" ? 11 : rad(d.employ) + 9))
      .attr("y", (d, i) => rowY(i) + 4)
      .text(d => fmtX(d.rca));

    // Row tooltip: the peer comparison spelled out, with the four cities the
    // average is built from and an explicit above/below verdict.
    topTag(svg, rows, 0, MT - 7, true);

    const rowTip = document.getElementById("peerRowTip");
    const wrap = el.parentElement;
    if (rowTip && wrap) {
      const yearSel = document.querySelector("#specializationSection .ctl select");
      g.on("mouseenter", function(ev, d){
        const year = yearSel ? yearSel.value : "";
        // A gap between two multipliers is a difference in points, not itself
        // a multiplier — "0.8×" would read as Boston being smaller than peers.
        const diff = Math.abs(Math.round((d.rca - d.peerAvg) * 10) / 10);
        const dir  = d.ahead ? "up" : "down";
        const verdict = diff === 0
          ? "Level with the peer average"
          : diff + (d.ahead ? " above the peer average" : " below the peer average");
        rowTip.innerHTML =
          '<strong>' + d.name + '</strong>' +
          (year ? '<div class="tip-row"><span>Year</span><span>' + year + '</span></div>' : '') +
          '<div class="tip-row"><span>' + cityName + '</span><span>' + fmtX(d.rca) + '</span></div>' +
          '<div class="tip-row"><span>Peer average</span><span>' + fmtX(d.peerAvg) + '</span></div>' +
          '<div class="tip-verdict ' + dir + '">' +
            '<span class="tip-arrow" aria-hidden="true">' + (d.ahead ? "▲" : "▼") + '</span>' +
            verdict + '</div>' +
          '<div class="tip-peers">' +
            PEERS.map((p, i) =>
              '<div class="tip-row tip-row--peer"><span>' + p + '</span><span>' +
              fmtX(d.peerValues[i]) + '</span></div>').join("") +
          '</div>' +
          '<div class="tip-row"><span>Employment</span><span>' +
            fmtJobs(d.employ) + ' jobs</span></div>';
        rowTip.hidden = false;
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, rowTip);
      })
      .on("mouseleave", function(){ rowTip.hidden = true; });
    }

    const btn = document.getElementById("peerToggleBtn");
    if (btn) {
      btn.textContent = peerShowAll ? "Show top " + RCA_TOP_N : "Show all " + all.length;
    }

    // Keep the legend to marks actually on screen. In bar form the city is a
    // bar rather than a sized dot, and the "above" run isn't drawn at all —
    // only shortfalls are — so naming it would describe nothing.
    const isBar = (peerDesign === "bar");
    const setKey = (id, shown) => {
      const k = document.getElementById(id);
      if (k) k.hidden = !shown;
    };
    // In bar form neither city key applies: there is no sized dot, and the bar
    // needs no naming. Only the peer tick and the shortfall remain.
    setKey("peerCityKey", !isBar);
    setKey("peerCityKeyBar", false);
    setKey("peerAboveKey", !isBar);
  }

  function initPeerChart(){
    if (!document.getElementById("peerChartSvg")) return;
    renderPeerChart();
    const btn = document.getElementById("peerToggleBtn");
    if (btn) btn.addEventListener("click", () => {
      peerShowAll = !peerShowAll;
      renderPeerChart();
    });
  }

  /* World benchmark vs peer benchmark: the same industries and the same RCA
     formula, so this is one section with two views rather than two sections.
     Both charts stay rendered and only their visibility changes — switching
     costs nothing, and each view keeps its own "show all" and design state
     instead of being reset every time the reader looks at the other one. */
  function initRcaViewToggle(){
    const host = document.getElementById("specializationSection");
    const seg  = document.getElementById("rcaViewSeg");
    if (!host || !seg) return;

    let cur = "self";
    function show(view){
      cur = view;
      host.classList.toggle("is-dist", view === "dist");
      host.querySelectorAll("[data-rcaview]").forEach(el => {
        el.classList.toggle("view-off", el.dataset.rcaview !== view);
      });
      seg.querySelectorAll(".seg-btn").forEach(b => {
        const on = b.dataset.rcaviewGo === view;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      /* entering or leaving by any route keeps the active design marked */
      markDesigns();
    }

    /* One design list serves the whole section: bar and dot restyle the
       charts in place (both views share the choice, one mental model),
       while the two box plots open the all-metros view with that design
       pinned through the query string. The active option is marked rather
       than relabelled, so every design the section can wear stays listed. */
    const designList = document.getElementById("rcaDesignList");
    const distFrame  = document.getElementById("rcaDistFrame");
    let distBack = "self", distDesign = "box";
    function markDesigns(){
      if (!designList) return;
      const active = (cur === "dist") ? distDesign : rcaDesign;
      designList.querySelectorAll(".design-opt").forEach(b =>
        b.classList.toggle("is-on", b.dataset.design === active));
    }
    function openDist(design){
      if (cur !== "dist") distBack = cur;
      distDesign = design;
      if (distFrame){
        /* both box plots keep the four peer metros on stage */
        const url = "rca-distributions.html?dots=peers&design=" + design;
        if (distFrame.getAttribute("src") !== url) distFrame.setAttribute("src", url);
      }
      show("dist");
    }
    if (designList) designList.addEventListener("click", e => {
      const b = e.target.closest(".design-opt");
      if (!b) return;
      const d = b.dataset.design;
      if (d === "box" || d === "band"){
        if (cur !== "dist" || distDesign !== d) openDist(d);
      } else {
        rcaDesign = d;
        peerDesign = d;
        renderRcaChart();
        renderPeerChart();
        if (cur === "dist") show(distBack);
      }
      markDesigns();
    });

    /* Named from the same list the chart averages, so the tooltip cannot drift
       from the four cities actually behind the tick. */
    const tip = document.getElementById("peerListTip");
    if (tip) {
      tip.innerHTML =
        "<strong>" + PEERS.length + " peer cities</strong><ul>" +
        PEERS.map(n => "<li>" + ((PEER_PROFILES[n] || {}).label || n) + "</li>").join("") +
        "</ul><span class=\"peer-tip-note\">Metros close to " + cityName +
        " in size, income and industry mix — close enough that the comparison " +
        "says something other than \u201clarge city\u201d.</span>";
    }

    seg.addEventListener("click", e => {
      const btn = e.target.closest(".seg-btn");
      if (btn && seg.contains(btn)) show(btn.dataset.rcaviewGo);
    });

    /* ---- intro transport + row-count control for the embedded chart.
       The frame exposes window.__intro (play/pause/resume + step events)
       and window.__chart (row limit); the bar's five dots follow the
       intro's steps. ---- */
    const introBtn    = document.getElementById("rcaIntroBtn");
    const introDotsEl = document.getElementById("rcaIntroDots");
    const rowsBtn     = document.getElementById("distRowsBtn");
    const frameIntro  = () => distFrame && distFrame.contentWindow && distFrame.contentWindow.__intro;
    const frameChart  = () => distFrame && distFrame.contentWindow && distFrame.contentWindow.__chart;
    function frameHeight(){
      const c = frameChart();
      if (!c) return;
      const b = c.contentBottom();
      if (b > 200) distFrame.style.height = (b + 14) + "px";
    }
    function introUi(st){
      if (introBtn) introBtn.innerHTML =
        !st.running ? "&#9654; Play intro"
        : st.paused ? "&#9654; Resume intro"
        :             "&#10074;&#10074; Pause intro";
      if (introDotsEl) [...introDotsEl.children].forEach((d, i) => {
        d.classList.toggle("on", i < st.step);
        d.classList.toggle("cur", st.running && !st.paused && i === st.step - 1);
      });
      frameHeight();
    }
    function bindDistFrame(){
      const api = frameIntro();
      if (!api) return;
      api.onChange = introUi;
      introUi(api.state());
      const c = frameChart();
      if (rowsBtn && c) rowsBtn.textContent =
        c.limit() ? "Show all " + c.total() : "Show top 10";
    }
    if (distFrame){
      distFrame.addEventListener("load", bindDistFrame);
      bindDistFrame();
    }
    if (introBtn) introBtn.addEventListener("click", () => {
      const api = frameIntro();
      if (!api) return;
      const st = api.state();
      if (!st.running) api.play();
      else if (st.paused) api.resume();
      else api.pause();
    });
    if (rowsBtn) rowsBtn.addEventListener("click", () => {
      const c = frameChart();
      if (!c) return;
      c.setLimit(c.limit() ? null : 10);
      rowsBtn.textContent = c.limit() ? "Show all " + c.total() : "Show top 10";
      frameHeight();
    });

    /* the friendly box plot is the section's opening view; Bar and the
       classic box stay one click away on the design list */
    openDist("band");
  }

  function initRcaChart(){
    if (!document.getElementById("rcaChartSvg")) return;
    renderRcaChart();
    const btn = document.getElementById("rcaToggleBtn");
    if (btn) btn.addEventListener("click", () => {
      rcaShowAll = !rcaShowAll;
      renderRcaChart();
    });
  }

  /* Visible "Color by" segmented control (replaces the old <select>).
     Each group carries the svg it drives and the legends it can reveal. */
  function initColorBySegments(){
    document.querySelectorAll(".seg[data-svg]").forEach(group => {
      const legends = {
        complexity: group.dataset.legendComplexity,
        change:     group.dataset.legendChange
      };
      group.addEventListener("click", e => {
        const btn = e.target.closest(".seg-btn");
        if (!btn || !group.contains(btn)) return;
        group.querySelectorAll(".seg-btn").forEach(b => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        setColorBy(group.dataset.svg, btn.dataset.mode, legends);
      });
    });
  }

  /* =====================================================================
     5 · Metro scatter — population growth vs wage growth

     Dummy metros, generated once per load. Medians are set so the quadrant
     story matches the section copy and the City Overview tables: Boston's
     metro grows slowly (+0.4%/yr) while pay runs ahead (+4.5%/yr), which
     lands it in the constrained-supply quadrant.
     ===================================================================== */
  const METRO_X_MED = 0.7;    // population CAGR, %/yr
  const METRO_Y_MED = 4.0;    // avg-salary CAGR, %/yr

  const HOME = { name: "Boston", pop: 0.4, pay: 5.3, size: 4.9 };
  const PEER_POINTS = [
    { name: "Washington",  pop: 0.35, pay: 4.9, size: 6.4 },
    { name: "Seattle",     pop: 1.15, pay: 5.4, size: 4.0 },
    { name: "Denver",      pop: 1.30, pay: 4.6, size: 3.0 },
    { name: "San Diego",   pop: 0.25, pay: 4.3, size: 3.3 }
  ];

  let _metros = null;
  function metroPoints(){
    if (_metros) return _metros;
    const rest = [];
    for (let i = 0; i < 170; i++) {
      // clustered around the medians, with a long tail on both axes
      const pop = METRO_X_MED + (srand() + srand() + srand() - 1.5) * 1.1;
      const pay = METRO_Y_MED + (srand() + srand() + srand() - 1.5) * 1.1;
      rest.push({
        name: "Metro area " + (i + 1),
        pop: Math.round(pop * 100) / 100,
        pay: Math.round(pay * 100) / 100,
        size: Math.round((0.15 + Math.pow(srand(), 3) * 5.5) * 100) / 100,
        other: true
      });
    }
    _metros = rest
      .concat(PEER_POINTS.map(p => Object.assign({ peer: true }, p)))
      .concat([Object.assign({ home: true }, HOME)])
      // draw the small grey mass first so highlights sit on top
      .sort((a, b) => (a.home ? 2 : a.peer ? 1 : 0) - (b.home ? 2 : b.peer ? 1 : 0));
    return _metros;
  }

  /* Quadrant buttons. Rendered as HTML over the chart rather than in the SVG
     so they are real buttons — focusable, with a genuine border-radius — and
     positioned in % so they track the responsive viewBox. */
  const QUADS = [
    { key:"tl", name:"Held back", pop:"down", pay:"up",
      dx:"Negative Supply Shock",
      blurb:"Pay is bid up because workers cannot, or will not, move in \u2014 often a housing or cost-of-living wall. Demand for labor is there; the supply of people can\u2019t follow it." },
    { key:"tr", name:"Boomtown", pop:"up", pay:"up",
      dx:"Positive Demand Shock",
      blurb:"People and pay rise together. Demand for what the city produces is growing, and the city is still able to absorb the workers it pulls in." },
    { key:"bl", name:"Cooling off", pop:"down", pay:"down",
      dx:"Negative Demand Shock",
      blurb:"Fewer newcomers and slower raises at the same time. Demand for the city\u2019s output has gone quiet, so neither wages nor population are being pulled up." },
    { key:"br", name:"Lifestyle magnet", pop:"up", pay:"down",
      dx:"Positive Supply Shock",
      blurb:"People keep arriving even though pay lags. Amenities or cheaper living draw workers in, and that added supply of people holds wages down." }
  ];

  /* Conventional icons: a group-of-people silhouette, and a coin marked with
     a dollar sign. Both solid so they sit together. */
  const ICON_POP =
    '<svg class="q-ico q-ico--pop" viewBox="0 0 24 18" aria-hidden="true">' +
    '<circle cx="5" cy="5.4" r="3"/><circle cx="19" cy="5.4" r="3"/>' +
    '<circle cx="12" cy="4.4" r="3.7"/>' +
    '<path d="M0.5 17v-2.1a4.5 4.5 0 0 1 7.1-3.7 6 6 0 0 0-1.6 4.1V17Z"/>' +
    '<path d="M23.5 17v-2.1a4.5 4.5 0 0 0-7.1-3.7 6 6 0 0 1 1.6 4.1V17Z"/>' +
    '<path d="M6.5 17v-2.3a5.5 5.5 0 0 1 11 0V17Z"/></svg>';
  const ICON_PAY =
    '<svg class="q-ico q-ico--pay" viewBox="0 0 18 18" aria-hidden="true">' +
    '<circle cx="9" cy="9" r="8"/>' +
    '<path d="M9 3.5v11" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M11.6 6.2c-.6-.8-1.6-1.2-2.6-1.2-1.5 0-2.6.8-2.6 1.9 0 1.2 1 1.6 2.6 1.9 1.6.3 2.6.7 2.6 1.9 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.4-2.7-1.2" ' +
    'fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const arrow = dir => '<svg class="q-arr q-arr--' + dir + '" viewBox="0 0 10 10" aria-hidden="true">' +
    (dir === "up" ? '<path d="M5 1 9 9 1 9Z"/>' : '<path d="M5 9 1 1 9 1Z"/>') + '</svg>';

  function buildQuadrantButtons(wrap, tip){
    if (!wrap || wrap.querySelector(".q-btn")) return;
    QUADS.forEach(q => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "q-btn q-btn--" + q.key;
      b.dataset.q = q.key;
      b.setAttribute("aria-expanded", "false");
      b.innerHTML =
        '<span class="q-btn-name">' + q.name + '</span>' +
        '<span class="q-btn-metrics">' +
          '<span class="q-metric">' + ICON_POP + 'Population' + arrow(q.pop) + '</span>' +
          '<span class="q-metric">' + ICON_PAY + 'Pay' + arrow(q.pay) + '</span>' +
        '</span>';
      wrap.appendChild(b);
    });

    if (!tip) return;

    const show = btn => {
      const q = QUADS.find(d => d.key === btn.dataset.q);
      btn.setAttribute("aria-expanded", "true");
      tip.innerHTML =
        '<strong>' + q.dx + '</strong>' +
        '<p>' + q.blurb + '</p>';
      tip.hidden = false;
      const w = wrap.getBoundingClientRect(), r = btn.getBoundingClientRect();
      const left = r.left - w.left + r.width / 2 - tip.offsetWidth / 2;
      // flip above the button when there is no room below
      const below = r.bottom - w.top + 8;
      const fits = below + tip.offsetHeight <= w.height;
      tip.style.left = Math.max(6, Math.min(left, w.width - tip.offsetWidth - 6)) + "px";
      tip.style.top = (fits ? below : r.top - w.top - tip.offsetHeight - 8) + "px";
    };
    const hide = btn => {
      if (btn) btn.setAttribute("aria-expanded", "false");
      tip.hidden = true;
    };

    wrap.querySelectorAll(".q-btn").forEach(btn => {
      btn.addEventListener("mouseenter", () => show(btn));
      btn.addEventListener("focus", () => show(btn));
      btn.addEventListener("mouseleave", () => hide(btn));
      btn.addEventListener("blur", () => hide(btn));
      // tap support, where hover does not exist
      btn.addEventListener("click", () => {
        if (btn.getAttribute("aria-expanded") === "true") hide(btn); else show(btn);
      });
    });
  }

  /* Anchor each button just inside its quadrant, in % of the viewBox. */
  function placeQuadrantButtons(wrap, tip, x, y, W, H){
    buildQuadrantButtons(wrap, tip);
    if (!wrap) return;
    const vx = x(METRO_X_MED) / W * 100, vy = y(METRO_Y_MED) / H * 100;
    const pad = 1.4;
    const pos = {
      tl: { left: (x.range()[0] / W * 100 + pad) + "%", top: (y.range()[1] / H * 100 + pad) + "%" },
      tr: { right: ((W - x.range()[1]) / W * 100 + pad) + "%", top: (y.range()[1] / H * 100 + pad) + "%" },
      bl: { left: (x.range()[0] / W * 100 + pad) + "%", bottom: ((H - y.range()[0]) / H * 100 + pad) + "%" },
      br: { right: ((W - x.range()[1]) / W * 100 + pad) + "%", bottom: ((H - y.range()[0]) / H * 100 + pad) + "%" }
    };
    Object.keys(pos).forEach(k => {
      const b = wrap.querySelector(".q-btn--" + k);
      if (!b) return;
      b.style.left = b.style.right = b.style.top = b.style.bottom = "";
      Object.assign(b.style, pos[k]);
    });
    void vx; void vy;
  }

  /* =====================================================================
     6 · Diagnostic explainer

     Two dials and a draggable dot over the same four quarters as the scatter.
     Setting the dials moves the dot; dragging the dot sets the dials. Either
     way the verdict below explains the supply/demand mechanism.
     ===================================================================== */
  const DX_TEXT = {
    tl: { title:"Negative Supply Shock",
      body:"Demand for workers is strong, and that is what bids pay up. What is missing is the supply of people: they cannot move in, or will not. The wall is usually housing. Too few homes get built, so the cost of living swallows the raise before anyone banks it, and the city is held back by its own capacity rather than by weak demand." },
    tr: { title:"Positive Demand Shock",
      body:"Demand for what the city produces is growing, and both numbers move up together. Employers bid harder for workers, and workers arrive. Supply is keeping pace well enough that the newcomers do not drag pay back down, which is growth working roughly as intended." },
    bl: { title:"Negative Demand Shock",
      body:"Demand has gone quiet. Fewer employers competing for workers means slower raises, and slower raises mean fewer reasons to move in. Nothing is blocking supply here; there simply is not the pull. The constraint sits on the demand side." },
    br: { title:"Positive Supply Shock",
      body:"People arrive for reasons other than pay: amenities, space, a lower cost of living. That inflow is itself an increase in labor supply, and more workers competing for the same jobs holds wages down. The draw is the place, not the paycheck." }
  };

  function initDxExplainer(){
    const svgEl = document.getElementById("dxChart");
    const verdict = document.getElementById("dxVerdict");
    if (!svgEl || !verdict) return;

    const S = 300, PAD = 26, MID = S / 2;
    const svg = d3.select(svgEl);
    // Flat pastels, butted edge to edge with no separator. Selection is shown
    // by dimming the other three rather than by deepening this one.
    const fills = { tl:"#f6f2e9", tr:"#e8ecf2",
                    bl:"#f9edec", br:"#e9efeb" };
    const box = { tl:[PAD, PAD], tr:[MID, PAD], bl:[PAD, MID], br:[MID, MID] };
    Object.keys(box).forEach(k => {
      svg.append("rect").attr("class", "dx-q dx-q--" + k)
        .attr("x", box[k][0]).attr("y", box[k][1])
        .attr("width", MID - PAD).attr("height", MID - PAD)
        .attr("fill", fills[k]);
    });

    svg.append("line").attr("class", "dx-cross")
      .attr("x1", MID).attr("x2", MID).attr("y1", PAD).attr("y2", S - PAD);
    svg.append("line").attr("class", "dx-cross")
      .attr("x1", PAD).attr("x2", S - PAD).attr("y1", MID).attr("y2", MID);

    // Both labels sit flat inside the plot, hugging their own axis line.
    svg.append("text").attr("class", "dx-axis")
      .attr("x", S - PAD - 4).attr("y", MID - 9).attr("text-anchor", "end")
      .text("People \u2192");
    svg.append("text").attr("class", "dx-axis")
      .attr("x", MID + 9).attr("y", PAD + 16).attr("text-anchor", "start")
      .text("Pay \u2191");

    // A black dot in a white ring, inside a dashed halo that marks it draggable.
    const dot = svg.append("g").attr("class", "dx-dot-g")
      .attr("transform", "translate(" + MID + "," + MID + ")");
    dot.append("circle").attr("class", "dx-dot-halo").attr("r", 16);
    dot.append("circle").attr("class", "dx-dot").attr("r", 9);

    let state = { pop:null, pay:null };

    const quadOf = (px, py) =>
      (py < MID ? "t" : "b") + (px < MID ? "l" : "r");

    function paint(){
      svg.selectAll(".dx-q").classed("is-on", false);
      const q = (state.pop && state.pay)
        ? (state.pay === "up" ? "t" : "b") + (state.pop === "up" ? "r" : "l")
        : null;
      if (q) svg.select(".dx-q--" + q).classed("is-on", true);
      svg.classed("has-sel", !!q);

      document.querySelectorAll(".dx-opt").forEach(b => {
        b.classList.toggle("is-on", state[b.dataset.dial] === b.dataset.val);
      });

      if (!q) {
        verdict.innerHTML =
          '<h5 class="dx-step-head">2 · What that tells you</h5>' +
          '<p class="dx-idle">Set both dials, or drag the dot on the chart.</p>';
        return;
      }
      const t = DX_TEXT[q];
      verdict.innerHTML =
        '<h5 class="dx-step-head">2 · What that tells you</h5>' +
        '<strong class="dx-verdict-title">' + t.title + '</strong>' +
        '<p class="dx-verdict-body">' + t.body + '</p>';
    }

    function moveDotToState(){
      if (!state.pop || !state.pay) return;
      const cx = state.pop === "up" ? MID + 52 : MID - 52;
      const cy = state.pay === "up" ? MID - 52 : MID + 52;
      dot.transition().duration(260)
        .attr("transform", "translate(" + cx + "," + cy + ")");
    }

    document.querySelectorAll(".dx-opt").forEach(b => {
      b.addEventListener("click", () => {
        state[b.dataset.dial] = b.dataset.val;
        paint(); moveDotToState();
      });
    });

    // drag the dot by hand — it sets the dials rather than reading them
    let dragging = false;
    const place = ev => {
      const r = svgEl.getBoundingClientRect();
      const pt = ev.touches ? ev.touches[0] : ev;
      const px = Math.max(PAD, Math.min(S - PAD, (pt.clientX - r.left) / r.width * S));
      const py = Math.max(PAD, Math.min(S - PAD, (pt.clientY - r.top) / r.height * S));
      dot.interrupt().attr("transform", "translate(" + px + "," + py + ")");
      const q = quadOf(px, py);
      state.pop = q[1] === "r" ? "up" : "down";
      state.pay = q[0] === "t" ? "up" : "down";
      paint();
    };
    svgEl.addEventListener("pointerdown", e => {
      dragging = true; svgEl.setPointerCapture(e.pointerId); place(e); e.preventDefault();
    });
    svgEl.addEventListener("pointermove", e => { if (dragging) place(e); });
    svgEl.addEventListener("pointerup", e => {
      dragging = false;
      try { svgEl.releasePointerCapture(e.pointerId); } catch (err) {}
    });

    paint();
  }

  /* The frame both metro-scale scatters share: same margins, same scales off
     the same metro field, same reference lines. The second chart has to read
     as the first one carrying on, so none of this may drift between them. */
  function metroFrame(el){
    const data = metroPoints();
    const W = 880, H = 560;
    // Room for the axis lines and their labels: the top clears the "typical"
    // caption, the left and bottom clear ticks plus the axis titles.
    const M = { top: 46, right: 30, bottom: 82, left: 92 };

    const svg = d3.select(el).attr("viewBox", "0 0 " + W + " " + H);
    svg.selectAll("*").remove();

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.pop)).nice()
      .range([M.left, W - M.right]);
    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.pay)).nice()
      .range([H - M.bottom, M.top]);
    const r = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.size)]).range([1.3, 12]);

    // the quadrant this section is about
    svg.append("rect").attr("class", "ms-quad")
      .attr("x", x.range()[0]).attr("y", y.range()[1])
      .attr("width", x(METRO_X_MED) - x.range()[0])
      .attr("height", y(METRO_Y_MED) - y.range()[1]);

    x.ticks(6).forEach(t => {
      svg.append("line").attr("class", "ms-grid")
        .attr("x1", x(t)).attr("x2", x(t)).attr("y1", M.top).attr("y2", H - M.bottom);
      svg.append("text").attr("class", "ms-tick")
        .attr("x", x(t)).attr("y", H - M.bottom + 20).attr("text-anchor", "middle")
        .text(t + "%");
    });
    y.ticks(6).forEach(t => {
      svg.append("line").attr("class", "ms-grid")
        .attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(t)).attr("y2", y(t));
      svg.append("text").attr("class", "ms-tick")
        .attr("x", M.left - 10).attr("y", y(t) + 4).attr("text-anchor", "end")
        .text(t.toFixed(1) + "%");
    });

    // solid axis lines framing the plot, drawn over the gridlines
    svg.append("line").attr("class", "ms-axis-line")
      .attr("x1", M.left).attr("x2", M.left)
      .attr("y1", M.top).attr("y2", H - M.bottom);
    svg.append("line").attr("class", "ms-axis-line")
      .attr("x1", M.left).attr("x2", W - M.right)
      .attr("y1", H - M.bottom).attr("y2", H - M.bottom);

    // medians that split the four quadrants
    svg.append("line").attr("class", "ms-median")
      .attr("x1", x(METRO_X_MED)).attr("x2", x(METRO_X_MED))
      .attr("y1", M.top).attr("y2", H - M.bottom);
    svg.append("line").attr("class", "ms-median")
      .attr("x1", M.left).attr("x2", W - M.right)
      .attr("y1", y(METRO_Y_MED)).attr("y2", y(METRO_Y_MED));

    // Reference lines get named in place — "typical" is what the dashed
    // crosshair actually means, and saying so beats a legend.
    svg.append("text").attr("class", "ms-typical")
      .attr("x", x(METRO_X_MED)).attr("y", M.top - 10).attr("text-anchor", "middle")
      .text("Typical population growth");
    svg.append("path").attr("class", "ms-typical-mark")
      .attr("d", "M" + (x(METRO_X_MED) - 4) + " " + (M.top - 6) +
                 "L" + (x(METRO_X_MED) + 4) + " " + (M.top - 6) +
                 "L" + x(METRO_X_MED) + " " + (M.top) + "Z");

    svg.append("text").attr("class", "ms-typical")
      .attr("x", W - M.right - 10).attr("y", y(METRO_Y_MED) - 8).attr("text-anchor", "end")
      .text("Typical salary growth");
    svg.append("path").attr("class", "ms-typical-mark")
      .attr("d", "M" + (W - M.right) + " " + (y(METRO_Y_MED) - 4) +
                 "L" + (W - M.right) + " " + (y(METRO_Y_MED) + 4) +
                 "L" + (W - M.right - 5) + " " + y(METRO_Y_MED) + "Z");

    svg.append("text").attr("class", "ms-axis-title")
      .attr("x", (M.left + W - M.right) / 2).attr("y", H - 14)
      .attr("text-anchor", "middle")
      .text("Population growth (annual rate, 2015\u20132025)");
    svg.append("text").attr("class", "ms-axis-title")
      .attr("transform", "rotate(-90)")
      .attr("x", -(M.top + H - M.bottom) / 2).attr("y", 24)
      .attr("text-anchor", "middle")
      .text("Average salary growth (annual rate, 2015\u20132025)");

    return { svg, data, x, y, r, W, H, M };
  }

  function renderMetroScatter(){
    const el = document.getElementById("metroScatterSvg");
    if (!el) return;

    const { svg, data, x, y, r, W, H } = metroFrame(el);

    placeQuadrantButtons(document.getElementById("scatterWrap"),
                         document.getElementById("quadTip"), x, y, W, H);

    svg.append("g").selectAll("circle").data(data).join("circle")
      .attr("class", d => "ms-dot" + (d.home ? " ms-dot--home" : d.peer ? " ms-dot--peer" : ""))
      .attr("cx", d => x(d.pop)).attr("cy", d => y(d.pay))
      .attr("r", d => r(d.size));

    // Peers are named too, but smaller — they are context, not the subject.
    svg.append("g").selectAll("text")
      .data(data.filter(d => d.peer)).join("text")
      .attr("class", "ms-peer-label")
      .attr("x", d => x(d.pop) + r(d.size) + 6)
      .attr("y", d => y(d.pay) + 4)
      .text(d => d.name);

    svg.append("text").attr("class", "ms-home-label")
      .attr("x", x(HOME.pop) + r(HOME.size) + 8).attr("y", y(HOME.pay) + 5)
      .text(HOME.name);
  }

  /* =====================================================================
     6 · The city inside the metro

     The same plot again, but the metro dot breaks apart into the places
     that make it up. Positions are authored as offsets from the metro's
     own point rather than as absolute rates, so the places land inside
     the frame whatever domain the random metro field happens to produce.

     The story the dummy numbers tell: the metro grows slowly while pay
     runs ahead, and the city itself is the part shedding people fastest
     — so the single metro dot was hiding the city's own problem.
     ===================================================================== */
  const MSA_PLACES = [
    // The left-hand places are kept under pay ≈ 4.9 so they clear the "Held
    // back" button sitting in that corner — the city especially.
    { name:"Somerville",  dx:-1.00, dy: 0.32, size: 81 },
    { name:"Cambridge",   dx:-0.70, dy: 0.38, size:118 },
    { name:"Brookline",   dx:-0.50, dy: 0.34, size: 63 },
    { name:"Arlington",   dx:-0.38, dy: 0.28, size: 46 },
    { name:"Watertown",   dx:-0.32, dy: 0.26, size: 35 },
    { name:"Medford",     dx:-0.24, dy: 0.34, size: 59 },
    { name:"Milton",      dx:-0.12, dy:-0.30, size: 28 },
    { name:"Melrose",     dx: 0.06, dy:-0.55, size: 29 },
    { name:"Waltham",     dx: 0.06, dy: 0.38, size: 65 },
    { name:"Needham",     dx: 0.12, dy: 0.50, size: 32 },
    { name:"Newton",      dx: 0.18, dy: 0.55, size: 88 },
    { name:"Beverly",     dx: 0.18, dy:-0.62, size: 42 },
    { name:"Salem",       dx: 0.24, dy:-0.36, size: 44 },
    { name:"Dedham",      dx: 0.26, dy:-0.95, size: 25 },
    { name:"Norwood",     dx: 0.30, dy:-0.72, size: 31 },
    { name:"Malden",      dx: 0.32, dy:-0.44, size: 66 },
    { name:"Woburn",      dx: 0.36, dy: 0.22, size: 41 },
    { name:"Quincy",      dx: 0.42, dy: 0.16, size:101 },
    { name:"Braintree",   dx: 0.44, dy:-0.18, size: 39 },
    { name:"Saugus",      dx: 0.44, dy:-1.15, size: 29 },
    { name:"Peabody",     dx: 0.50, dy:-0.86, size: 54 },
    { name:"Framingham",  dx: 0.56, dy: 0.06, size: 72 },
    { name:"Wakefield",   dx: 0.56, dy:-0.42, size: 27 },
    { name:"Everett",     dx: 0.62, dy:-1.05, size: 49 },
    { name:"Lynn",        dx: 0.68, dy:-0.92, size:101 },
    { name:"Weymouth",    dx: 0.70, dy:-0.66, size: 57 },
    { name:"Revere",      dx: 0.76, dy:-1.28, size: 62 },
    { name:"Natick",      dx: 0.76, dy: 0.34, size: 37 },
    { name:"Randolph",    dx: 0.84, dy:-1.35, size: 34 },
    { name:"Lowell",      dx: 0.90, dy:-0.55, size:115 },
    { name:"Chelsea",     dx: 0.96, dy:-1.20, size: 40 },
    { name:"Marlborough", dx: 1.08, dy: 0.12, size: 41 },
    { name:"Franklin",    dx: 1.24, dy:-0.24, size: 33 },
    // last so it paints on top of the rest
    { name:"Boston",      dx:-1.2,  dy: 0.5,  size:660, home:true }
  ];

  function renderCityInMetro(){
    const el = document.getElementById("cityInMetroSvg");
    if (!el) return;

    const { svg, data, x, y, r, W, H } = metroFrame(el);

    // Same four quadrant buttons as the section above — the plot is the same
    // plot, so the reader should not have to re-learn what the corners mean.
    placeQuadrantButtons(document.getElementById("cimWrap"),
                         document.getElementById("cimQuadTip"), x, y, W, H);

    // Keep the places off the axis lines however the domain came out.
    const inset = 12;
    const clamp = (scale, v) => {
      const [a, b] = scale.range();
      const lo = Math.min(a, b) + inset, hi = Math.max(a, b) - inset;
      return Math.max(lo, Math.min(hi, scale(v)));
    };
    const px = d => clamp(x, HOME.pop + d.dx);
    const py = d => clamp(y, HOME.pay + d.dy);
    const pr = d3.scaleSqrt()
      .domain([0, d3.max(MSA_PLACES, d => d.size)]).range([2.5, 13]);

    /* Opening frame: the metro field exactly as the section above leaves it. */
    const field = svg.append("g").attr("class", "cim-field");
    field.selectAll("circle").data(data).join("circle")
      .attr("class", d => "ms-dot" + (d.home ? " ms-dot--home" : d.peer ? " ms-dot--peer" : ""))
      .attr("cx", d => x(d.pop)).attr("cy", d => y(d.pay))
      .attr("r", d => r(d.size));
    field.selectAll("text").data(data.filter(d => d.peer)).join("text")
      .attr("class", "ms-peer-label")
      .attr("x", d => x(d.pop) + r(d.size) + 6)
      .attr("y", d => y(d.pay) + 4)
      .text(d => d.name);

    const mx = x(HOME.pop), my = y(HOME.pay), mr = r(HOME.size);

    const metroDot = svg.append("circle").attr("class", "ms-dot ms-dot--home cim-metro")
      .attr("cx", mx).attr("cy", my).attr("r", mr);
    const metroLabel = svg.append("text").attr("class", "ms-home-label")
      .attr("x", mx + mr + 8).attr("y", my + 5)
      .text(HOME.name);

    /* What the metro leaves behind once it has come apart: a dashed ring on
       the spot, so every place can still be read against its own metro. */
    // Opacity goes through style() throughout: the dot classes carry an
    // `opacity` rule in the stylesheet, which outranks the attribute.
    const ring = svg.append("g").attr("class", "cim-ring").style("opacity", 0);
    ring.append("circle").attr("class", "cim-ring-c")
      .attr("cx", mx).attr("cy", my).attr("r", mr + 7);
    ring.append("text").attr("class", "cim-ring-label")
      .attr("x", mx + mr + 14).attr("y", my + 4)
      .text("Boston metro");

    const places = svg.append("g").attr("class", "cim-places")
      .selectAll("circle").data(MSA_PLACES).join("circle")
      .attr("class", d => "cim-dot" + (d.home ? " cim-dot--home" : ""))
      .attr("cx", mx).attr("cy", my).attr("r", 0).style("opacity", 0);

    const city = MSA_PLACES[MSA_PLACES.length - 1];
    const cityLabel = svg.append("text").attr("class", "ms-home-label")
      .attr("x", px(city) + pr(city.size) + 8).attr("y", py(city) + 5)
      .style("opacity", 0)
      .text(city.name);

    function reset(){
      svg.selectAll(".cim-field, .cim-metro, .ms-home-label, .cim-ring").interrupt();
      places.interrupt();
      field.style("opacity", 1);
      metroDot.style("opacity", 1).attr("r", mr);
      metroLabel.style("opacity", 1);
      ring.style("opacity", 0);
      cityLabel.style("opacity", 0);
      places.attr("cx", mx).attr("cy", my).attr("r", 0).style("opacity", 0);
    }

    /* The break-up, in one pass: the rest of the country clears out, the
       metro dot collapses into its ring, and the places it was standing in
       for spill out of that same point to their own growth rates. */
    function run(){
      reset();

      field.transition().duration(520).style("opacity", 0);
      metroLabel.transition().duration(320).style("opacity", 0);
      metroDot.transition().delay(320).duration(340)
        .attr("r", 0).style("opacity", 0);
      ring.transition().delay(520).duration(300).style("opacity", 1);

      places.transition()
        .delay((d, i) => d.home ? 560 : 660 + i * 16)
        .duration(900).ease(d3.easeCubicOut)
        .attr("cx", px).attr("cy", py)
        .attr("r", d => pr(d.size))
        .style("opacity", 1);

      cityLabel.transition().delay(1400).duration(400).style("opacity", 1);
    }

    const btn = document.getElementById("cimReplayBtn");
    if (btn) btn.addEventListener("click", run);

    // Play once when the section first scrolls into view.
    new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        setTimeout(run, 350);
        obs.disconnect();
      });
    }, { threshold: 0.35 }).observe(el);
  }


  /* ---------- export treemap: transformation options 1-4 ----------
     Stakeholder-facing, numbered on the right of the controls bar. Each
     number transforms the export treemap (or annotates it) around whichever
     "Color by" is active: 1 = ranked list beside the map, 2 = one-axis
     swarm. The metric follows the
     colour mode: complexity -> PCI, tradability -> traded share, sector -> jobs.
     Clicking the active number restores the plain map. */
  let exportOpt = 0;
  let exportView = "map";   /* the treemap is always the default view */
  let exportListOn = false; /* option 1's side list, off until asked for */
  const EOPT_DUR = 950;

  function pciNumOf(name){
    const v = pciByName.get(name);
    return v == null ? 0 : Math.round(v * 100) / 100;
  }

  function exportMetric(){
    const mode = colorMode.exportTreemapSvg;
    if (mode === COMPLEXITY) return {
      kind: "pci", axis: "Product complexity (PCI)",
      listTitle: "Top 5 most complex industries",
      corner: "big and complex",
      val: n => pciNumOf(n),
      fmt: v => "PCI " + v.toFixed(2), barFmt: v => v.toFixed(2)
    };
    if (mode === TRADABILITY) return {
      kind: "trd", axis: "Tradability (0 local \u2192 1 traded)",
      listTitle: "Top 5 most traded industries",
      corner: "big and traded",
      val: n => tradabilityOf(n),
      fmt: v => v.toFixed(2), barFmt: v => v.toFixed(2)
    };
    return {
      kind: "jobs", axis: "Jobs (log scale)",
      listTitle: "Top 5 industries by jobs",
      fmt: v => Math.round(v).toLocaleString() + " jobs",
      barFmt: v => Math.round(v).toLocaleString(), log: true
    };
  }
  const exVal  = (m, d) => m.val ? m.val(d.data.name) : d.value;
  const exRank = (m, d) => m.rank ? m.rank(d.data.name) : exVal(m, d);

  function exportAltLabel(){
    const m = exportMetric();
    if (exportOpt === 2) return m.kind === "pci" ? "Ordered by complexity"
                       : m.kind === "trd" ? "Ordered by tradability" : "Ordered by jobs";
    if (exportOpt === 3) return m.kind === "pci" ? "Most complex, ranked"
                       : m.kind === "trd" ? "Most traded, ranked" : "Biggest, ranked";
    if (exportOpt === 4) return m.kind === "pci" ? "Complexity vs. jobs"
                       : m.kind === "trd" ? "Tradability vs. jobs" : "Jobs by sector";
    return "";
  }

  function updateExportViewSeg(){
    const wrap = document.getElementById("exportViewWrap");
    if (!wrap) return;
    const show = exportOpt >= 2;
    wrap.hidden = !show;
    if (!show) return;
    wrap.querySelector('[data-view="alt"]').textContent = exportAltLabel();
    wrap.querySelectorAll(".seg-btn").forEach(b => {
      const on = (b.dataset.view === "alt") === (exportView === "alt");
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function applyExportOption(animate){
    const svgEl = document.getElementById("exportTreemapSvg");
    const listWrap = document.getElementById("exportTopList");
    if (!svgEl || !listWrap) return;
    const svg = d3.select(svgEl);
    const cells = svg.selectAll("g.industry");
    if (cells.empty()) return;
    const m = exportMetric();
    const dur = animate ? EOPT_DUR : 0;
    const leaves = cells.data();
    if (exportClearHover) exportClearHover();   /* no highlight survives a view change */
    const W2 = WIDTH, H2 = HEIGHT;

    svg.selectAll(".opt-overlay").interrupt().transition().duration(200).attr("opacity", 0).remove();
    listWrap.hidden = true; listWrap.textContent = "";
    cells.style("opacity", 1);

    const restoreMap = () => {
      svg.selectAll(".sector-layer").interrupt().transition().duration(dur * .6).style("opacity", 1);
      cells.select("rect").interrupt().transition().duration(dur).ease(d3.easeCubicInOut)
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("rx", 0).attr("opacity", 1)
        .attr("stroke", null).attr("stroke-width", null);
      cells.select("text").interrupt().transition()
        .delay(dur ? dur - 150 : 0).duration(300).attr("opacity", 1);
    };

    if (exportOpt === 0){ restoreMap(); return; }

    const vizRow = document.querySelector(".export-viz-row");
    if (vizRow) vizRow.classList.toggle("with-list", exportOpt === 1 && exportListOn);

    if (exportOpt === 1){
      restoreMap();
      if (!exportListOn) return;
      const ranked = [...leaves].sort((a, b) => exRank(m, b) - exRank(m, a));
      const groups = [];
      if (m.kind === "trd"){
        /* tradability cuts both ways: the local tail is often the story */
        groups.push(["Top 5 most traded", ranked.slice(0, 5)]);
        groups.push(["Top 5 most local", ranked.slice(-5).reverse()]);
      } else {
        groups.push([m.listTitle, ranked.slice(0, 5)]);
      }
      groups.forEach(([gTitle, items], gi) => {
      const title = document.createElement("div");
      title.className = "toplist-title";
      title.textContent = gTitle + (gi === 0 ? " (hover to locate)" : "");
      listWrap.appendChild(title);
      items.forEach((d, i) => {
        const b = document.createElement("button");
        b.type = "button";
        const valTxt = m.isNew && m.isNew(d.data.name) ? "new since 2015" : m.fmt(exVal(m, d));
        b.innerHTML = '<span class="rk">' + (i + 1) + '</span><span>' + d.data.name +
                      '</span><span class="pci">' + valTxt + '</span>';
        b.addEventListener("mouseenter", () => {
          cells.style("opacity", c => c === d ? 1 : .18)
            .select("rect").style("stroke", c => c === d ? "#1a2226" : null)
            .style("stroke-width", c => c === d ? 2.5 : null);
          svg.selectAll(".sector-layer").style("opacity", .18);
        });
        b.addEventListener("mouseleave", () => {
          cells.style("opacity", 1).select("rect").style("stroke", null).style("stroke-width", null);
          svg.selectAll(".sector-layer").style("opacity", 1);
        });
        listWrap.appendChild(b);
      });
      });
      listWrap.hidden = false;
      return;
    }

    /* options 2-4 rest on the treemap until the reader flips their toggle */
    if (exportView !== "alt"){ restoreMap(); return; }

    /* the morphs: sector blocks and cell labels step aside */
    svg.selectAll(".sector-layer").interrupt().transition().duration(300).style("opacity", 0);
    cells.select("text").interrupt().transition().duration(250).attr("opacity", 0);
    const ov = svg.append("g").attr("class", "opt-ax opt-overlay").attr("opacity", 0);
    const moveRect = (sel, fx, fy, fw, fh, frx) => sel.select("rect").interrupt()
      .transition().duration(dur).ease(d3.easeCubicInOut)
      .attr("x", fx).attr("y", fy).attr("width", fw).attr("height", fh)
      .attr("rx", frx).attr("opacity", 1).attr("stroke", null).attr("stroke-width", null);

    if (exportOpt === 2){
      const vals = leaves.map(d => exVal(m, d));
      const x = m.log
        ? d3.scaleLog([Math.max(1, d3.min(vals)), d3.max(vals)], [46, W2 - 26])
        : d3.scaleLinear([d3.min(vals), d3.max(vals)], [46, W2 - 26]);
      const r = d3.scaleSqrt([0, d3.max(leaves, d => d.value)], [2, 34]);
      const nodes = leaves.map(d => ({d, x: x(exVal(m, d)), y: H2 * .46, r: r(d.value)}));
      const sim = d3.forceSimulation(nodes)
        .force("x", d3.forceX(n => x(exVal(m, n.d))).strength(1))
        .force("y", d3.forceY(H2 * .46).strength(.08))
        .force("c", d3.forceCollide(n => n.r + .6)).stop();
      for (let i = 0; i < 200; i++) sim.tick();
      /* no dot may leave the sheet: pin centres a radius inside every edge */
      nodes.forEach(n => {
        n.x = Math.max(n.r + 2, Math.min(W2 - n.r - 2, n.x));
        n.y = Math.max(n.r + 2, Math.min(H2 - 60 - n.r, n.y));
      });
      const pos = new Map(nodes.map(n => [n.d, n]));
      moveRect(cells,
        d => pos.get(d).x - pos.get(d).r, d => pos.get(d).y - pos.get(d).r,
        d => pos.get(d).r * 2, d => pos.get(d).r * 2, d => pos.get(d).r);
      ov.append("line").attr("x1", 26).attr("x2", W2 - 16).attr("y1", H2 - 46).attr("y2", H2 - 46);
      ov.append("text").attr("class", "axname").attr("x", W2 / 2).attr("y", H2 - 24)
        .attr("text-anchor", "middle").text(m.axis + " →");
      const lead = [...leaves].sort((a, b) => exRank(m, b) - exRank(m, a))[0];
      const lp = pos.get(lead), t = lead.data.name;
      const est = t.length * 6.4;
      const labY = Math.max(16, lp.y - lp.r - 24);
      const lx = Math.max(est / 2 + 8, Math.min(lp.x, W2 - 10 - est / 2));
      ov.append("circle").attr("class", "opt-lead-ring")
        .attr("cx", lp.x).attr("cy", lp.y).attr("r", lp.r + 3.5);
      ov.append("line").attr("class", "opt-lead-stem")
        .attr("x1", lp.x).attr("y1", lp.y - lp.r - 5)
        .attr("x2", lx).attr("y2", labY + 4);
      ov.append("text").attr("class", "opt-dotlab").attr("x", lx).attr("y", labY)
        .attr("text-anchor", "middle").text(t);
      ov.transition().delay(Math.max(0, dur - 200)).duration(400).attr("opacity", 1);
      return;
    }

    if (exportOpt === 4){
      const R = 8;
      const jobs = leaves.map(d => d.value);
      if (m.kind === "jobs"){
        /* sector strip plot: a row per sector, jobs along x */
        const sectors = [...new Set(leaves.map(d => d.parent.data.name))];
        const band = d3.scalePoint().domain(sectors).range([34, H2 - 72]).padding(.5);
        const x = d3.scaleLog([Math.max(1, d3.min(jobs)), d3.max(jobs)], [120, W2 - 26]);
        const jit = d => { let h = 0; for (const c of d.data.name) h = (h * 31 + c.charCodeAt(0)) | 0;
                           return ((h >>> 0) % 21) - 10; };
        moveRect(cells,
          d => x(Math.max(1, d.value)) - R, d => band(d.parent.data.name) + jit(d) - R,
          R * 2, R * 2, R);
        sectors.forEach(s => {
          ov.append("text").attr("x", 4).attr("y", band(s) + 4).attr("font-size", 10)
            .text(s.length > 16 ? s.slice(0, 15) + "…" : s);
        });
        ov.append("line").attr("x1", 110).attr("x2", W2 - 16).attr("y1", H2 - 48).attr("y2", H2 - 48);
        ov.append("text").attr("class", "axname").attr("x", (W2 + 100) / 2).attr("y", H2 - 26)
          .attr("text-anchor", "middle").text("Jobs (log) →");
      } else {
        const vals = leaves.map(d => exVal(m, d));
        const x = d3.scaleLinear([d3.min(vals), d3.max(vals)], [56, W2 - 26]);
        const y = d3.scaleLog([Math.max(1, d3.min(jobs)), d3.max(jobs)], [H2 - 62, 22]);
        moveRect(cells,
          d => x(exVal(m, d)) - R, d => y(Math.max(1, d.value)) - R, R * 2, R * 2, R);
        ov.append("line").attr("x1", 46).attr("x2", W2 - 16).attr("y1", H2 - 48).attr("y2", H2 - 48);
        ov.append("line").attr("x1", 46).attr("x2", 46).attr("y1", 14).attr("y2", H2 - 48);
        ov.append("text").attr("x", 50).attr("y", H2 - 28).text("← " + m.axis + " →");
        ov.append("text").attr("class", "axname").attr("x", 14).attr("y", 26)
          .attr("transform", "rotate(-90 14 26)").attr("text-anchor", "end").text("jobs (log)");
        const medX = d3.median(vals), medY = d3.median(jobs);
        ov.append("line").attr("class", "opt-quad")
          .attr("x1", x(medX)).attr("x2", x(medX)).attr("y1", 14).attr("y2", H2 - 48);
        ov.append("line").attr("class", "opt-quad")
          .attr("x1", 46).attr("x2", W2 - 16).attr("y1", y(medY)).attr("y2", y(medY));
        ov.append("text").attr("class", "opt-quadlab").attr("x", W2 - 20).attr("y", 30)
          .attr("text-anchor", "end").text(m.corner + " → the corner that matters");
      }
      ov.transition().delay(Math.max(0, dur - 200)).duration(400).attr("opacity", 1);
      return;
    }

    if (exportOpt === 3){
      const top = [...leaves].sort((a, b) => exRank(m, b) - exRank(m, a)).slice(0, 12);
      const rows = new Map(top.map((d, i) => [d, i]));
      const GUT = 330, rowH = (H2 - 66) / 12, barH = Math.min(26, rowH - 8);
      const xw = d3.scaleLinear([0, exVal(m, top[0])], [GUT, W2 - 96]);
      const rowY = i => 16 + i * rowH;
      cells.filter(d => !rows.has(d)).select("rect").interrupt()
        .transition().duration(dur * .8)
        .attr("x", d => (d.x0 + d.x1) / 2).attr("y", d => (d.y0 + d.y1) / 2)
        .attr("width", 0).attr("height", 0).attr("opacity", 0);
      moveRect(cells.filter(d => rows.has(d)),
        GUT, d => rowY(rows.get(d)), d => Math.max(2, xw(exVal(m, d)) - GUT), barH, 2);
      top.forEach((d, i) => {
        const n = d.data.name;
        ov.append("text").attr("class", "opt-bar-name").attr("x", GUT - 8)
          .attr("y", rowY(i) + barH / 2 + 4).attr("text-anchor", "end")
          .text(n.length > 52 ? n.slice(0, 51) + "…" : n);
        const valTxt = m.isNew && m.isNew(d.data.name) ? "new" : m.barFmt(exVal(m, d));
        ov.append("text").attr("class", "opt-bar-val")
          .attr("x", xw(exVal(m, d)) + 6).attr("y", rowY(i) + barH / 2 + 4).text(valTxt);
      });
      ov.append("text").attr("class", "axname").attr("x", GUT).attr("y", H2 - 14)
        .text("bar length = " + m.axis.toLowerCase());
      ov.transition().delay(Math.max(0, dur - 200)).duration(400).attr("opacity", 1);
      return;
    }

  }

  function refreshExportOption(){
    if (!exportOpt) return;
    updateExportViewSeg();
    updateTopBtn();
    applyExportOption(true);
  }

  function updateTopBtn(){
    const b = document.getElementById("exportTopBtn");
    if (!b) return;
    b.hidden = exportOpt !== 1;
    /* the switch names what it will actually show under the active Color by */
    const mk = exportMetric().kind;
    const lab = b.querySelector(".switch-label");
    if (lab) lab.textContent =
        mk === "pci" ? "Show Most Complex Industries"
      : mk === "trd" ? "Show Most & Least Traded Industries"
      :                "Show Largest Industries";
    b.setAttribute("aria-pressed", String(exportListOn));
  }

  /* one labelled slot in the bar carries whichever control the active
     option brings: "Top industries" for the list, "View" for the morphs */
  function updateExportOptCtl(){
    const ctl = document.getElementById("exportOptCtl");
    if (!ctl) return;
    ctl.hidden = !exportOpt;
    ctl.dataset.opt = String(exportOpt);   /* lets CSS hard-guard per option */
    /* option 1's button names itself; the morph options keep a View label */
    const lab = document.getElementById("exportOptCtlLabel");
    if (lab){ lab.hidden = exportOpt === 1; lab.textContent = "View"; }
  }

  /* One tooltip serves every form a treemap's cells take — tiles, swarm
     dots, ranked bars, the tradable/local split — because the morphs reuse
     the same elements. Same card pattern as the RCA row tooltips. */
  let exportClearHover = null;     /* lets view changes clear a live highlight */
  let tradableClearHover = null;   /* same, for the split animation */

  /* Cursor tooltips prefer the top-right corner of the cursor; when the
     cursor is too close to the frame's top the tip flips BELOW it, and when
     it is too close to the right edge it flips to the left of the cursor —
     never pinned to an edge while the cursor keeps moving.
     Where the frame is too narrow to hold the card beside the cursor at all
     (a card is 330 wide and a stage can be narrower than twice that), the
     card centres ON the cursor rather than parking against the left edge,
     which is what made it look stuck while the pointer moved. */
  function cursorTipPos(ev, wrap, tip){
    const w = wrap.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = ev.clientX - w.left, y = ev.clientY - w.top;
    let left = x + 10;
    if (left + tw > w.width){
      left = x - tw - 10;
      if (left < 0) left = x - tw / 2;
    }
    let top = y - th - 10;
    if (top < 0) top = y + 14;
    tip.style.left = Math.max(0, Math.min(left, Math.max(0, w.width - tw))) + "px";
    tip.style.top  = Math.max(0, Math.min(top, Math.max(0, w.height - th))) + "px";
  }

  function attachCellTip(svgEl, wrap, tip){
    /* Self-healing highlight: re-parenting a hovered node (the bring-to-
       front) can swallow its mouseleave, so never trust leave alone — track
       the hot mark and clear it on the next enter, on leaving the svg, and
       on any view change. */
    let hot = null;
    const clearHot = () => {
      tip.hidden = true;
      if (!hot) return;
      d3.select(hot).select("rect").style("stroke", null).style("stroke-width", null);
      hot = null;
    };
    d3.select(svgEl).on("mouseleave.celltip", () => { tip.hidden = true; clearHot(); });
    d3.select(svgEl).selectAll("g.industry")
      .on("mouseenter", function(ev, d){
        clearHot();
        hot = this;
        const name = d.data.name;
        const mode = colorMode[svgEl.id];
        let extra = "";
        if (mode === COMPLEXITY)
          extra = '<div class="tip-row"><span>Complexity (PCI)</span><span>' +
                  pciNumOf(name).toFixed(2) + '</span></div>';
        if (mode === TRADABILITY)
          extra = '<div class="tip-row"><span>Tradability</span><span>' +
                  tradabilityOf(name).toFixed(2) + '</span></div>';
        tip.innerHTML = '<strong>' + name + '</strong>' +
          '<div class="tip-row"><span>Sector</span><span>' + d.parent.data.name + '</span></div>' +
          '<div class="tip-row"><span>Jobs</span><span>' +
            Math.round(d.value).toLocaleString() + '</span></div>' + extra;
        tip.hidden = false;
        cursorTipPos(ev, wrap, tip);
        /* the mark answers the cursor: ink outline, brought to the front
           because swarm dots overlap (inline style so it beats the CSS) */
        this.parentNode.appendChild(this);
        d3.select(this).select("rect").style("stroke", "#1a2226").style("stroke-width", 2.5);
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, tip);
      })
      .on("mouseleave", function(){
        tip.hidden = true;
        clearHot();
      });
    return clearHot;
  }

  /* ---- share strips: one headline percentage per treemap reading ----
     A jobs-weighted share of the metro above a stated threshold, drawn as a
     number plus a 100% bar, so every colour ramp also gets its one-line
     quantitative summary. */
  function jobsShare(pred){
    let hit = 0, tot = 0;
    industryData.forEach(r => { tot += r.employ; if (pred(r)) hit += r.employ; });
    return tot ? hit / tot : 0;
  }

  function donutStat(host, pct, color, caption){
    if (!host) return;
    const r = 15.5, c = 2 * Math.PI * r;
    host.innerHTML =
      '<svg class="ds-donut" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">' +
        '<circle class="ds-track" cx="20" cy="20" r="' + r + '"/>' +
        '<circle class="ds-val" cx="20" cy="20" r="' + r + '" style="stroke:' + color +
          '" stroke-dasharray="' + (c * pct).toFixed(2) + ' ' + (c * (1 - pct)).toFixed(2) + '"/>' +
      '</svg>' +
      '<span class="ds-txt"><span class="ds-num">' + Math.round(pct * 100) + '%</span>' +
      '<span class="ds-cap">' + caption + '</span></span>';
    host.hidden = false;
  }

  /* The export map's stat follows the Color-by mode and hides with it. */
  function updateExportHeadStat(){
    const host = document.getElementById("exportHeadStat");
    if (!host) return;
    const mode = colorMode.exportTreemapSvg;
    if (mode === COMPLEXITY)
      donutStat(host, jobsShare(r => pciNumOf(r.name) > 0), "#2f7d6a",
        "of metro jobs \u00b7 above-average complexity");
    else if (mode === TRADABILITY)
      donutStat(host, jobsShare(r => isTradable(r.name)), token("--teal", "#255862"),
        "of metro jobs \u00b7 widely traded");
    else host.hidden = true;
  }

  /* ---- the lean map: what the place does more of than its metro ----
     The same sector blocks as the merged admin map, recoloured by each
     sector's share of the city against its share of the metro (the form the reference proto uses; ours computes ~1.6× from ADMIN_SHARE). House
     diverging pair: russet = leans less, teal = leans more, parity pale. */
  /* The two commuting donuts — real LEHD-style shares from the reference. */
  function initCommuteStats(){
    donutStat(document.getElementById("commuteOutStat"), 0.54, token("--teal", "#255862"),
      'of residents\u2019 jobs \u00b7 inside <span class="city-short">Boston</span>');
    donutStat(document.getElementById("commuteInStat"), 0.26, token("--teal", "#255862"),
      'of <span class="city-short">Boston</span>\u2019s jobs \u00b7 held by residents');
  }

  function initLeanMap(){
    const el = document.getElementById("leanMapSvg");
    if (!el) return;
    const root = layout(industryData, "root", WIDTH);
    const total = d3.sum(root.children, sec => sec.value);

    /* Two ways to count, as in the reference's Count control: jobs located
       inside the admin boundary (ADMIN_SHARE), or the jobs the city's
       residents hold wherever those jobs sit. The residence profile is
       authored as relative propensities and normalised so its jobs-weighted
       mean lands exactly on the canon: 334,026 resident jobs over the
       metro's real total. */
    const RESIDENT_PROFILE = {
      Construction: .6, "Education & Health": 1.25, "Financial Activities": 1.15,
      "Leisure & Hospitality": 1.2, Manufacturing: .45, "Natural Resources": .5,
      Other: 1.05, "Professional & Business": 1.1, "Trade & Transportation": .8
    };
    const RES_OVERALL = 334026 / totalCityJobs;
    const profOf = sec => RESIDENT_PROFILE[sec.data.name] !== undefined ? RESIDENT_PROFILE[sec.data.name] : 1;
    const profMean = d3.sum(root.children, sec => sec.value * profOf(sec)) / total;
    const admShareOf = sec => ADMIN_SHARE[sec.data.name] !== undefined ? ADMIN_SHARE[sec.data.name] : 0.15;
    const admOverall = d3.sum(root.children, sec => sec.value * admShareOf(sec)) / total;

    const LENSES = {
      work: { overall: admOverall, shareOf: admShareOf,
              shareLbl: cityName + " admin share of this sector",
              allLbl: cityName + " admin share of all metro jobs" },
      res:  { overall: RES_OVERALL,
              shareOf: sec => profOf(sec) * (RES_OVERALL / profMean),
              shareLbl: "held by " + cityName + " residents — this sector",
              allLbl: "held by " + cityName + " residents — all metro jobs" }
    };
    let lens = "work";

    /* the frame IS the treemap's frame: the blocks state sits at the exact
       coordinates the admin-share animation ends on, so the scroll from one
       step to the next hands off pixel-identical — no redraw, the same map
       simply starts to morph. Any spare height centers the bar chart. */
    const W = 880, ROW = 36, MB = 66;
    const need = 26 + root.children.length * ROW + MB;
    const H = Math.max(need, HEIGHT);
    const MT = 26 + (H - need) / 2;
    el.setAttribute("viewBox", "0 0 " + W + " " + H);
    el.setAttribute("height", H);
    const BASE = 500, K = 140, LOGMIN = -2.1, LOGMAX = 0.9;
    const xOf = r => BASE + K * Math.max(LOGMIN, Math.min(LOGMAX, Math.log2(r)));

    /* two geometries per sector under the current lens: its block on the
       sector map and its bar row. The SOLID band — the counted slice — is
       the element that morphs; the veiled remainder just fades away. */
    function computeGeo(){
      const L = LENSES[lens];
      const ratioOf = sec => L.shareOf(sec) / L.overall;
      const rows = [...root.children].sort((a, b) => ratioOf(b) - ratioOf(a));
      const geo = new Map(rows.map((d, i) => {
        const share = L.shareOf(d), r = ratioOf(d), x = xOf(r);
        const bx = d.x0, bw = d.x1 - d.x0;
        const by = d.y0, bh = d.y1 - d.y0;
        return [d.data.name, {
          share, r,
          ghost: { x: bx, y: by, w: bw, h: bh * (1 - share) },
          solid: { x: bx, y: by + bh * (1 - share), w: bw, h: bh * share },
          bar:   { x: Math.min(BASE, x), y: MT + i * ROW + 4, w: Math.abs(x - BASE), h: 22 },
          tipX: x
        }];
      }));
      return { rows, geo, overall: L.overall };
    }
    let cur = computeGeo();

    const svg = d3.select(el);
    svg.selectAll("*").remove();

    /* bar furniture, hidden until the bars state; rebuilt on lens change
       because the ranking and the values both move with the count */
    const furn = svg.append("g").attr("class", "lean-furn").style("opacity", 0);
    function buildFurn(){
      furn.selectAll("*").remove();
      furn.append("line")
        .attr("x1", BASE).attr("x2", BASE)
        .attr("y1", MT - 12).attr("y2", MT + cur.rows.length * ROW + 8)
        .attr("stroke", "#8a989d").attr("stroke-width", 1.5);
      cur.rows.forEach((d, i) => {
        const g0 = cur.geo.get(d.data.name);
        furn.append("text")
          .attr("x", 280).attr("y", MT + i * ROW + 22)
          .attr("text-anchor", "end")
          .style("fill", "#1a2226").style("stroke", "none")
          .attr("font-size", 13.5).attr("font-weight", 600)
          .text(d.data.name);
        furn.append("text")
          .attr("x", g0.r >= 1 ? g0.tipX + 8 : g0.tipX - 8)
          .attr("y", MT + i * ROW + 23)
          .attr("text-anchor", g0.r >= 1 ? "start" : "end")
          .style("fill", "#1a2226").style("stroke", "none")
          .attr("font-size", 13).attr("font-weight", 700)
          .text(g0.r.toFixed(2).replace(/0$/, "") + "×");
      });
      furn.append("text")
        .attr("x", BASE).attr("y", MT + cur.rows.length * ROW + 26)
        .attr("text-anchor", "middle")
        .style("fill", "#5b686d").style("stroke", "none").attr("font-size", 12)
        .text("same as the metro");
      furn.append("text")
        .attr("x", BASE).attr("y", MT + cur.rows.length * ROW + 46)
        .attr("text-anchor", "middle")
        .style("fill", "#5b686d").style("stroke", "none").attr("font-size", 12)
        .text(lens === "work"
          ? "share of " + cityName + " ÷ share of the metro"
          : "share of residents’ work ÷ share of the metro");
    }
    buildFurn();

    /* the sectors: pale ghost (the uncounted remainder), solid slice, name */
    const secs = svg.selectAll("g.lean-sec").data(root.children, d => d.data.name)
      .join("g").attr("class", "lean-sec");
    secs.each(function(d){
      const g0 = cur.geo.get(d.data.name);
      const sel = d3.select(this);
      sel.append("rect").attr("class", "ln-ghost")
        .attr("x", g0.ghost.x).attr("y", g0.ghost.y)
        .attr("width", g0.ghost.w).attr("height", g0.ghost.h)
        .attr("fill", sectorColors[d.data.name]).attr("fill-opacity", .26)
        .attr("stroke", "#fff").attr("stroke-width", 1);
      sel.append("rect").attr("class", "ln-solid")
        .attr("x", g0.solid.x).attr("y", g0.solid.y)
        .attr("width", g0.solid.w).attr("height", g0.solid.h)
        .attr("fill", sectorColors[d.data.name])
        .attr("stroke", "#fff").attr("stroke-width", .8);
      if (g0.ghost.w > 70 && (g0.ghost.h + g0.solid.h) > 40)
        sel.append("text").attr("class", "ln-name")
          .attr("x", g0.ghost.x + 8).attr("y", g0.ghost.y + 17)
          .style("fill", "#1a2226").style("stroke", "none")
          .attr("font-size", 13).attr("font-weight", 600)
          .text(fitLabel(d.data.name, { width: g0.ghost.w, height: 40 }));
    });

    let view = "blocks", visible = false, playTimer = null;
    const DUR = 850;
    function toBars(animate){
      view = "bars";
      buildFurn();                       // the lens may have changed meanwhile
      const t = animate ? DUR : 0;
      secs.selectAll(".ln-ghost").transition().duration(t * .5).attr("fill-opacity", 0);
      secs.selectAll(".ln-name").transition().duration(t * .4).style("opacity", 0);
      secs.each(function(d){
        const g0 = cur.geo.get(d.data.name);
        d3.select(this).select(".ln-solid")
          .transition().duration(t).ease(d3.easeCubicInOut)
          .attr("x", g0.bar.x).attr("y", g0.bar.y)
          .attr("width", g0.bar.w).attr("height", g0.bar.h);
      });
      furn.transition().delay(t * .55).duration(Math.max(1, t * .5)).style("opacity", 1);
    }
    function toBlocks(animate){
      view = "blocks";
      const t = animate ? DUR : 0;
      furn.transition().duration(t * .35).style("opacity", 0);
      secs.each(function(d){
        const g0 = cur.geo.get(d.data.name);
        const s = d3.select(this);
        s.select(".ln-ghost").attr("height", g0.ghost.h);   // lens-true remainder
        s.select(".ln-solid")
          .transition().duration(t).ease(d3.easeCubicInOut)
          .attr("x", g0.solid.x).attr("y", g0.solid.y)
          .attr("width", g0.solid.w).attr("height", g0.solid.h);
      });
      secs.selectAll(".ln-ghost").transition().delay(t * .4).duration(t * .5).attr("fill-opacity", .26);
      secs.selectAll(".ln-name").transition().delay(t * .5).duration(t * .4).style("opacity", 1);
    }

    /* the Count control: same chart, different question — where the job
       sits, or what the residents do. Re-rank and re-scale in place. */
    function setLens(k, animate){
      if (k === lens) return;
      lens = k;
      cur = computeGeo();
      document.querySelectorAll("#leanLensSeg .seg-btn").forEach(b => {
        const on = b.dataset.l === lens;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      const t = animate ? 600 : 0;
      if (view === "bars"){
        buildFurn();
        furn.style("opacity", 1);
        secs.each(function(d){
          const g0 = cur.geo.get(d.data.name);
          d3.select(this).select(".ln-solid")
            .transition().duration(t).ease(d3.easeCubicInOut)
            .attr("x", g0.bar.x).attr("y", g0.bar.y)
            .attr("width", g0.bar.w).attr("height", g0.bar.h);
        });
      } else {
        secs.each(function(d){
          const g0 = cur.geo.get(d.data.name);
          const s = d3.select(this);
          s.select(".ln-solid")
            .transition().duration(t).ease(d3.easeCubicInOut)
            .attr("x", g0.solid.x).attr("y", g0.solid.y)
            .attr("width", g0.solid.w).attr("height", g0.solid.h);
          s.select(".ln-ghost")
            .transition().duration(t).ease(d3.easeCubicInOut)
            .attr("height", g0.ghost.h);
        });
      }
      renderNote();
    }
    document.querySelectorAll("#leanLensSeg .seg-btn").forEach(b =>
      b.addEventListener("click", () => setLens(b.dataset.l, true)));

    /* every arrival replays: the blocks hold for a beat, then the solid
       slices line up — scrolling away and back always runs it again */
    function playSeq(){
      clearTimeout(playTimer);
      toBlocks(false);
      playTimer = setTimeout(() => { if (visible && view === "blocks") toBars(true); }, 650);
    }
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.top < window.innerHeight * .8 &&
             r.bottom > window.innerHeight * .15;
    };
    const setVis = v => {
      if (v === visible) return;
      visible = v;
      clearTimeout(playTimer);
      if (v) playSeq();
    };
    const scroller = document.getElementById("pages");
    if (scroller) scroller.addEventListener("scroll", () => setVis(inView()), { passive: true });
    window.addEventListener("resize", () => setVis(inView()));

    /* the superlative under whichever count is on */
    function renderNote(){
      const note = document.getElementById("leanNote");
      if (!note) return;
      const top = cur.rows[0], g0 = cur.geo.get(top.data.name);
      if (lens === "work")
        note.innerHTML = "<strong>" + top.data.name + "</strong> is " +
          g0.r.toFixed(1) + "× as large a share here as in the metro — " +
          Math.round(g0.share * 100) + "% of the metro’s " + top.data.name.toLowerCase() +
          " sits inside the city, against " + Math.round(cur.overall * 100) +
          "% of the metro’s jobs overall.";
      else
        note.innerHTML = "<strong>" + top.data.name + "</strong> leads what residents do — they hold " +
          Math.round(g0.share * 100) + "% of the metro’s " + top.data.name.toLowerCase() +
          " jobs, against " + Math.round(cur.overall * 100) + "% of all metro jobs.";
    }
    renderNote();

    /* house tooltip: cursor top-right, works in both states and both counts */
    const tip = document.getElementById("leanTip");
    const wrap = document.getElementById("leanWrap");
    if (tip && wrap){
      secs.style("cursor", "default")
       .on("mouseenter", function(ev, d){
        const g0 = cur.geo.get(d.data.name);
        const L = LENSES[lens];
        tip.innerHTML = "<strong>" + d.data.name + "</strong>" +
          '<div class="tip-row"><span>Lean vs the metro</span><span><b class="tip-pct">' +
            g0.r.toFixed(2) + "×</b></span></div>" +
          '<div class="tip-row"><span>' + L.shareLbl + '</span><span>' +
            Math.round(g0.share * 100) + "%</span></div>" +
          '<div class="tip-row"><span>' + L.allLbl + '</span><span>' +
            Math.round(cur.overall * 100) + "%</span></div>";
        tip.hidden = false;
        cursorTipPos(ev, wrap, tip);
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, tip);
      })
      .on("mouseleave", function(){ tip.hidden = true; });
    }
  }

  /* ---------- 4 · from the tradable map to what the metro leads on ----------
     The closing beat of Metro Industries. It opens as a treemap of the
     tradable industries the metro is specialised in, then every cell travels
     to its own row and stretches into a bar: how many times more concentrated
     the industry is here than in a typical US metro. The four peer metros'
     average rides each row as a tick, and the top three are picked out. */
  const SPEC_TOP_N = 12;

  function initSpecializationMorph(){
    const el = document.getElementById("specMorphSvg");
    if (!el || typeof d3 === "undefined") return;

    const all = specializedWithPeers().sort((a, b) => b.rca - a.rca);
    if (!all.length) return;
    const rows = all.slice(0, SPEC_TOP_N);
    const keep = new Set(rows.map(d => d.name));

    const W = 880, ML = 292, MT = 62, MB = 30, RH = 34, PLOT_R = 812;
    const H = MT + rows.length * RH + MB;
    el.setAttribute("viewBox", "0 0 " + W + " " + H);
    el.setAttribute("height", H);

    const svg = d3.select(el);
    const x = d3.scaleLinear()
      .domain([1, d3.max(all, d => Math.max(d.rca, d.peerAvg)) * 1.06])
      .range([ML + 12, PLOT_R]);
    const rowY = i => MT + i * RH + RH / 2;
    const BAR_H = 17;
    const TEAL = token("--teal", "#255862");

    /* the opening treemap, laid out over the plot's own box so nothing has
       to jump before the morph begins */
    const tm = d3.hierarchy({ name: "S", children: all.map(d =>
        ({ name: d.name, value: d.employ, sector: d.sector })) }).sum(d => d.value);
    d3.treemap().size([W, H - 6]).paddingTop(1).paddingRight(1)
      .paddingBottom(1).paddingLeft(1)(tm);
    const cellBox = new Map();
    tm.leaves().forEach(n => cellBox.set(n.data.name,
      { x: n.x0, y: n.y0, w: n.x1 - n.x0, h: n.y1 - n.y0, sector: n.data.sector }));

    let axisG = null, drawn = false;

    function build(){
      svg.selectAll("*").remove();
      axisG = svg.append("g").attr("class", "spec-axis").style("opacity", 0);
      const g = svg.append("g").attr("class", "spec-cells");

      const cell = g.selectAll("g.spec-cell").data(all, d => d.name)
        .join("g").attr("class", "spec-cell");
      cell.append("rect").attr("class", "spec-rect")
        .attr("x", d => cellBox.get(d.name).x).attr("y", d => cellBox.get(d.name).y)
        .attr("width", d => cellBox.get(d.name).w).attr("height", d => cellBox.get(d.name).h)
        .attr("fill", d => sectorColors[d.sector] || TEAL)
        .attr("rx", 0);
      cell.append("text").attr("class", "spec-cell-lab")
        .attr("x", d => cellBox.get(d.name).x + 4).attr("y", d => cellBox.get(d.name).y + 11)
        .text(d => fitLabel(d.label, { width: cellBox.get(d.name).w, height: cellBox.get(d.name).h }));
      drawn = false;
    }

    function axis(){
      axisG.selectAll("*").remove();
      const ticks = x.ticks(5).filter(t => t >= 1);
      const t = axisG.selectAll("g.spec-tick").data(ticks).join("g").attr("class", "spec-tick");
      t.append("line").attr("class", d => "spec-grid" + (d === 1 ? " is-base" : ""))
        .attr("x1", d => x(d)).attr("x2", d => x(d))
        .attr("y1", MT - 18).attr("y2", MT + rows.length * RH);
      t.append("text").attr("class", "spec-ticklab")
        .attr("x", d => x(d)).attr("y", MT - 24).attr("text-anchor", "middle")
        .text(d => d + "×");
      axisG.append("text").attr("class", "spec-axname")
        .attr("x", ML + 12).attr("y", MT - 42)
        .text("Times more concentrated here than in a typical US metro");
    }

    function toBars(animate){
      if (drawn) return;
      drawn = true;
      /* a reader who has asked for less motion gets the ranking itself, not
         the journey to it — and the end state is then reachable without
         waiting on a frame loop */
      const reduce = window.matchMedia &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      const run = animate !== false && !reduce;

      axis();
      const cells = svg.selectAll("g.spec-cell");
      const idx = new Map(rows.map((d, i) => [d.name, i]));
      const bars = cells.filter(d => keep.has(d.name));
      const barX = x(1);
      const geom = {
        x: barX,
        y: d => rowY(idx.get(d.name)) - BAR_H / 2,
        w: d => Math.max(2, x(d.rca) - barX),
        fill: d => idx.get(d.name) < 3 ? TEAL : "#a9c2c7"
      };

      if (!run){
        cells.filter(d => !keep.has(d.name)).remove();
        svg.selectAll(".spec-cell-lab").remove();
        bars.select(".spec-rect")
          .attr("x", geom.x).attr("y", geom.y).attr("width", geom.w)
          .attr("height", BAR_H).attr("rx", 0).attr("fill", geom.fill);
        axisG.style("opacity", 1);
        decorate(bars, idx, false);
        return;
      }

      /* everything outside the ranking leaves first, so the rows it makes
         room for are not travelling through a crowd */
      cells.filter(d => !keep.has(d.name)).transition().duration(520)
        .style("opacity", 0).remove();
      svg.selectAll(".spec-cell-lab").transition().duration(260).style("opacity", 0);

      let ended = false;
      bars.select(".spec-rect").transition().delay(320).duration(1150)
        .ease(d3.easeCubicInOut)
        .attr("x", geom.x).attr("y", geom.y).attr("width", geom.w)
        .attr("height", BAR_H).attr("rx", 0).attr("fill", geom.fill)
        .on("end", function(){
          if (ended) return;          // once for the group, not once per bar
          ended = true;
          decorate(bars, idx, true);
        });

      axisG.transition().delay(420).duration(600).style("opacity", 1);
    }

    /* the row's furniture arrives once the bars have stopped moving: name,
       multiplier, the peer tick, and a rank badge on the leading three */
    function decorate(bars, idx, animate){
      const fade = (sel, delay) => animate
        ? sel.style("opacity", 0).transition().delay(delay).duration(420).style("opacity", 1)
        : sel;
      bars.each(function(d){
        const i = idx.get(d.name), g = d3.select(this), y = rowY(i), top3 = i < 3;
        fade(g.append("text").attr("class", "spec-name" + (top3 ? " is-top" : ""))
          .attr("x", ML - 10).attr("y", y + 4).attr("text-anchor", "end")
          .text(d.label), 0);
        fade(g.append("text").attr("class", "spec-val" + (top3 ? " is-top" : ""))
          .attr("x", Math.max(x(d.rca), x(d.peerAvg)) + 9).attr("y", y + 4)
          .text(d.rca.toFixed(1) + "\u00d7"), 120);
        /* the peer metros' average, as a tick standing across the bar */
        fade(g.append("line").attr("class", "spec-peer")
          .attr("x1", x(d.peerAvg)).attr("x2", x(d.peerAvg))
          .attr("y1", y - BAR_H / 2 - 4).attr("y2", y + BAR_H / 2 + 4), 260);
        /* the leading three carry a numbered badge ahead of their label */
        if (top3){
          fade(g.append("circle").attr("class", "spec-badge-bg")
            .attr("cx", 14).attr("cy", y).attr("r", 9), 0);
          fade(g.append("text").attr("class", "spec-badge")
            .attr("x", 14).attr("y", y + 3.5).attr("text-anchor", "middle")
            .text(i + 1), 0);
        }
      });
    }

    build();
    const btn = document.getElementById("specReplayBtn");
    if (btn) btn.addEventListener("click", () => { build(); setTimeout(() => toBars(true), 420); });

    new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        setTimeout(() => toBars(true), 420);
        obs.disconnect();
      });
    }, { threshold: 0.3 }).observe(el);
  }

  /* =====================================================================
     Metro Industries — one figure, four states

     The section's four beats share a single treemap that lives in the
     scrolly's stage. Scrolling drives it between states, and every move is a
     transition of the same cells, so nothing is ever redrawn from scratch:

       0 · the metro's mix, coloured by sector
       1 · the same mix, recoloured by how complex each industry is
       2 · the mix parts into what sells outward and what serves locally
       3 · the tradable, specialised half ranks itself as bars

     It is driven by scroll position, so it plays in reverse on the way back
     up; that is why nothing is ever removed, only faded. */
  const MI_W = 880, MI_H = 500, MI_TOP_N = 12;

  /* The coarse grain. The mix is drawn industry by industry everywhere else;
     the admin beat opens one level up, where each sector shows only its
     largest industries and rolls the rest into a single block. Areas are
     preserved, so the coarse map covers exactly the same ground as the fine
     one — only the level of detail changes. */
  /* "Ordered by jobs" has to be readable as an order, and no treemap tiling
     gives that: squarify chases square cells and throws the sequence away,
     binary keeps it only loosely, and slice or dice would put 292 industries
     in slivers under a pixel. This is a strip layout — the classic answer.
     Cells run largest first, left to right along a row, then on to the next
     row, and a row closes when adding one more would make its cells worse
     shaped. Area still encodes jobs; only the reading order is imposed. */
  function stripLayout(rows, W, H, gap){
    const g = gap === undefined ? 1 : gap;
    const items = rows.slice().sort((a, b) => b.employ - a.employ);
    const total = items.reduce((s, d) => s + d.employ, 0) || 1;
    const scale = (W * H) / total;
    const out = new Map();
    let i = 0, y = 0;
    while (i < items.length){
      let sum = 0, best = Infinity, count = 0;
      for (let k = i; k < items.length; k++){
        const trySum = sum + items[k].employ * scale;
        const rowH = trySum / W;
        let worst = 0;
        for (let m = i; m <= k; m++){
          const wI = (items[m].employ * scale) / rowH;
          worst = Math.max(worst, Math.max(wI / rowH, rowH / wI));
        }
        if (worst <= best){ best = worst; sum = trySum; count = k - i + 1; }
        else break;
      }
      if (!count){ count = 1; sum = items[i].employ * scale; }
      const rowH = sum / W;
      let x = 0;
      for (let m = i; m < i + count; m++){
        const wI = (items[m].employ * scale) / rowH;
        out.set(items[m].name, {
          x: x + g / 2, y: y + g / 2,
          w: Math.max(0, wI - g), h: Math.max(0, rowH - g)
        });
        x += wI;
      }
      y += rowH; i += count;
    }
    return out;
  }

  function twoDigitRows(rows, keepPerSector){
    const keep = keepPerSector || 3, bySector = {};
    rows.forEach(d => { (bySector[d.sector] = bySector[d.sector] || []).push(d); });
    const out = [];
    Object.keys(bySector).forEach(sec => {
      const list = bySector[sec].slice().sort((a, b) => b.employ - a.employ);
      list.slice(0, keep).forEach(d => out.push({ name: d.name, sector: sec, employ: d.employ }));
      const rest = list.slice(keep);
      if (rest.length) out.push({
        /* the catch-all sector would otherwise read "Other Other" */
        name: sec === "Other" ? "All other industries" : "Other " + sec,
        sector: sec, coarse: true,
        employ: rest.reduce((a, d) => a + d.employ, 0)
      });
    });
    return out;
  }


  /* The same figure serves any section built on this grammar; `p` is the id
     prefix its markup uses and `rows` the industry set it reads, so the metro
     and the administrative city each get their own instance. */
  function initIndustryFigure(p, rows, ctlName, opts){
    opts = opts || {};
    const el = document.getElementById(p + "TreemapSvg");
    const fig = document.getElementById(p + "Figure");
    if (!el || !fig || typeof d3 === "undefined") return;
    const industryData = rows;

    const svg = d3.select(el);
    const TEAL = token("--teal", "#255862");
    const MUTED = "#a9c2c7";
    const ORANGE = token("--orange", "#e76565");

    const box = (n, dx, dy) => ({ x: n.x0 + (dx || 0), y: n.y0 + (dy || 0),
                                  w: Math.max(0, n.x1 - n.x0), h: Math.max(0, n.y1 - n.y0) });
    /* the reference build separates sectors by 8px and cells by 1, with no
       stroke on the cells — so the clustering reads as grouping rather than
       as a grid. paddingOuter is half the sector gutter, since two
       neighbouring sectors each contribute their own. */
    /* padTop reserves a strip along the top of each sector block for its
       name, so the label has somewhere to sit that is not on top of the
       first industry's own label */
    function tmap(rows, w, h, grouped, padTop){
      const node = grouped
        ? d3.hierarchy(hierarchyFor(rows, "MI")).sum(d => d.value)
        : d3.hierarchy({ name: "MI", children: rows.map(r => ({ name: r.name, value: r.employ })) })
            .sum(d => d.value);
      const t = d3.treemap().size([w, h]).paddingInner(1);
      /* 3.5 either side plus the 1 of paddingInner is the reference's 8 */
      if (grouped) t.paddingOuter(3.5);
      if (grouped && padTop) t.paddingTop(d =>
        d.depth === 1 && (d.y1 - d.y0) >= 46 && (d.x1 - d.x0) >= 60 ? padTop : 3.5);
      t(node);
      return node;
    }

    /* ---- the three geometries, worked out once ---- */
    const full = tmap(industryData, MI_W, MI_H, true);
    const posFull = new Map(full.leaves().map(n => [n.data.name, box(n)]));
    /* the same industries with the sector walls taken down, so the biggest
       run from the top-left corner in plain order of size */
    let view = "map";
    fig.dataset.view = view;
    fig.dataset.names = "above";
    /* what the map beats colour their cells by: the sector, or how much
       know-how each industry takes */
    let colorBy = "sector";
    /* how the sectors are named on the map: a strip above each block, the
       name written on the block, or not at all */
    let nameMode = "above";
    /* in opt-2 the name sits over the block's first cell, so that cell's own
       label stands down rather than printing under it */
    let hideLab = new Set();
    const fillBy = d => colorBy === "complexity" ? complexityColor(d.name) : sectorColors[d.sector];
    const spot = d => posFull.get(d.name);

    const GAP = 8, HALF = (MI_W - GAP) / 2;
    const outward = industryData.filter(d => isTradable(d.name));
    const local   = industryData.filter(d => !isTradable(d.name));
    const posSplit = new Map();
    tmap(outward, HALF, MI_H, true).leaves()
      .forEach(n => posSplit.set(n.data.name, box(n)));
    tmap(local, HALF, MI_H, false).leaves()
      .forEach(n => posSplit.set(n.data.name, box(n, HALF + GAP)));

    /* ---- three clusters by tradability, the most tradable on the left.
       Column width is the cluster's share of jobs; inside each column the
       industries keep their sector walls, so colour stays the sector's and
       position alone carries tradability. ---- */
    /* the strip each sector block keeps along its top for its own name */
    const SEC_STRIP = 17;
    /* the tier is the source's; the two cuts are where its tiers part on
       the score (local ends at 0.19, traded begins at 0.80), kept for the
       track drawn under a score */
    const CL_HI = 0.8, CL_LO = 0.2;
    const clusterOf = d => tierOf(d.name);
    const clusterRows = [0, 1, 2].map(k => industryData.filter(d => clusterOf(d) === k));
    const jobsTotal = d3.sum(industryData, d => d.employ) || 1;
    const clusterShare = clusterRows.map(l => d3.sum(l, d => d.employ) / jobsTotal);
    const CGAP = 8, CW = MI_W - 2 * CGAP;
    const posCluster = new Map(), posClusterFlat = new Map();
    /* the sector blocks inside each cluster column, keyed by column and
       sector — a sector can appear in all three, and where it does, saying
       so is part of the beat's point */
    const secClusterA = new Map(), secClusterB = new Map();
    const posClusterA = new Map(), posClusterB = new Map();
    /* Each band is a card: a ground of its own carrying the share and the name,
       with the treemap inset inside it. The header moves off the page and into
       the card, so a column and its label are one object rather than two that
       have to be kept in step across the HTML/SVG boundary. */
    /* One even frame round each ground's map. The map insets its cells 7
       from its zone at the sides and bottom (3.5 for the root, 3.5 for the
       sector block), so 9 of card padding puts the cells 16 from the sides
       and the bottom; the head is 44, which sets the one-line title's cap 16
       from the top (15px, baseline 27) and its baseline 20.5 above the strip
       band, so the strip reads as its own row, while the two-line head still
       fits (18px share at 25, name at 40). The title's left edge is the
       cells' left edge. */
    /* which tradability tiers are in play. One state for the whole beat: the
       grounds the reader cancels on the map are the tiers the bars drop. */
    let tierOn = [true, true, true];
    const tierShown = d => tierOn[clusterOf(d)];
    const CARD_PAD = 9, CARD_HEAD = 44, CARD_BOT = 9, CARD_TXT = CARD_PAD + 7;
    const BAND_H = 30;
    const CARD_Y = CARD_HEAD, CARD_H = MI_H - CARD_HEAD - CARD_BOT;
    /* Which grounds are standing. A ground the reader cancels takes its
       width with it and the rest spread into it, so what is left is always
       a full frame rather than a gap where a tier used to be. */
    let cardBox = [];
    function layoutClusters(){
      [posClusterA, posClusterB, secClusterA, secClusterB, posCluster, posClusterFlat]
        .forEach(m => m.clear());
      cardBox = [];
      const live = [0, 1, 2].filter(k => tierOn[k]);
      const shareSum = live.reduce((a, k) => a + clusterShare[k], 0) || 1;
      const room = MI_W - CGAP * Math.max(0, live.length - 1);
      let x0 = 0;
      live.forEach(k => {
        const w = Math.max(36, room * clusterShare[k] / shareSum);
        cardBox.push({ x: x0, w: w, k: k });
        const iw = Math.max(20, w - CARD_PAD * 2), ix = x0 + CARD_PAD;
        const l = clusterRows[k].filter(secShown);
        if (l.length){
          const tA = tmap(l, iw, CARD_H, true, SEC_STRIP), tB = tmap(l, iw, CARD_H, true);
          tA.leaves().forEach(n => posClusterA.set(n.data.name, box(n, ix, CARD_Y)));
          tB.leaves().forEach(n => posClusterB.set(n.data.name, box(n, ix, CARD_Y)));
          tA.children.forEach(c =>
            secClusterA.set(k + "|" + c.data.name, { name: c.data.name, b: box(c, ix, CARD_Y) }));
          tB.children.forEach(c =>
            secClusterB.set(k + "|" + c.data.name, { name: c.data.name, b: box(c, ix, CARD_Y) }));
          tB.leaves().forEach(n => posCluster.set(n.data.name, box(n, ix, CARD_Y)));
          /* the same column in plain size order, for the Ordered view */
          const off = x0;
          stripLayout(l, w, MI_H).forEach((b, name) =>
            posClusterFlat.set(name, { x: b.x + off, y: b.y, w: b.w, h: b.h }));
        }
        x0 += w + CGAP;
      });
    }
    /* ---- the sector filter, driven from the key under the map ----
       A hidden sector does not leave a hole: the map is laid out again over
       the sectors still showing, in the same frames, so the reader always
       reads a whole rectangle. Null means every sector, which is the state
       the figure opens in and the one the key's reset returns to. */
    let secOn = null;
    let secGeo = null;
    const secShown = d => !secOn || secOn.has(d.sector);
    const secFiltered = () => !!secOn;
    /* the grounds are laid out once the filters they read exist, and again
       whenever either of them moves */
    layoutClusters();
    let resetSec = null;              /* the key fills this in: applySec(null) */
    function rebuildSecGeo(){
      if (!secOn){ secGeo = null; layoutClusters(); return; }
      const rows = industryData.filter(secShown);
      const g = { full: new Map(), fullA: new Map(), secA: new Map(), secB: new Map(),
                  tradA: new Map(), tradB: new Map(), tradSecA: new Map(), tradSecB: new Map() };
      if (rows.length){
        const tA = tmap(rows, MI_W, MI_H, true, SEC_STRIP), tB = tmap(rows, MI_W, MI_H, true);
        tA.leaves().forEach(n => g.fullA.set(n.data.name, box(n)));
        tB.leaves().forEach(n => g.full.set(n.data.name, box(n)));
        tA.children.forEach(c => g.secA.set(c.data.name, box(c)));
        tB.children.forEach(c => g.secB.set(c.data.name, box(c)));
        /* the two tiers that sell outward, over the same filter */
        const tr = rows.filter(d => clusterOf(d) <= 1);
        if (tr.length){
          const uA = tmap(tr, MI_W, MI_H, true, SEC_STRIP), uB = tmap(tr, MI_W, MI_H, true);
          uA.leaves().forEach(n => g.tradA.set(n.data.name, box(n)));
          uB.leaves().forEach(n => g.tradB.set(n.data.name, box(n)));
          uA.children.forEach(c => g.tradSecA.set(c.data.name, box(c)));
          uB.children.forEach(c => g.tradSecB.set(c.data.name, box(c)));
        }
      }
      secGeo = g;
      /* the grounds answer to both filters, and they are laid out in one
         place rather than kept as a baseline and an overlay */
      layoutClusters();
    }
    const clusterSpot = d =>
      (nameMode === "above" ? posClusterA : posClusterB).get(d.name) || posFull.get(d.name);
    /* all three clusters wear one colouring: the columns already carry the
       tradability, so colour is free to say sector, or complexity */
    const clusterFill = fillBy;
    /* the two tiers that sell outward at all - traded and partly traded -
       as one map filling the width, sectors grouped and no tier grounds:
       the beat between the three tiers and the ranking, which is drawn over
       the same set */
    const tradRows = clusterRows[0].concat(clusterRows[1]);
    /* two geometries for the same mix: one that reserves a strip along the
       top of each sector block for its name (opt-1), one that does not
       (opt-2 writes on the block, opt-3 does not write at all) */
    const tradTreeA = tradRows.length ? tmap(tradRows, MI_W, MI_H, true, SEC_STRIP) : null;
    const tradTreeB = tradRows.length ? tmap(tradRows, MI_W, MI_H, true) : null;
    const posTradA = new Map(tradTreeA ? tradTreeA.leaves().map(n => [n.data.name, box(n)]) : []);
    const posTradB = new Map(tradTreeB ? tradTreeB.leaves().map(n => [n.data.name, box(n)]) : []);
    const secTradA = new Map(tradTreeA ? tradTreeA.children.map(c => [c.data.name, box(c)]) : []);
    const secTradB = new Map(tradTreeB ? tradTreeB.children.map(c => [c.data.name, box(c)]) : []);
    const posTradFlat = tradRows.length ? stripLayout(tradRows, MI_W, MI_H) : new Map();
    const tradSpot = d =>
      (secGeo ? (nameMode === "above" ? secGeo.tradA : secGeo.tradB).get(d.name) : null) ||
      (nameMode === "above" ? posTradA : posTradB).get(d.name);
    /* the whole mix in the same two geometries, for the opening beat that
       shows every industry: the sector blocks named on a strip (opt-1) or
       on the block itself (opt-2, opt-3) */
    const fullTreeA = tmap(industryData, MI_W, MI_H, true, SEC_STRIP);
    const posFullA = new Map(fullTreeA.leaves().map(n => [n.data.name, box(n)]));
    const secFullA = new Map(fullTreeA.children.map(c => [c.data.name, box(c)]));
    const secFullB = new Map(full.children.map(c => [c.data.name, box(c)]));
    const allSpot = d =>
      (secGeo ? (nameMode === "above" ? secGeo.fullA : secGeo.full).get(d.name) : null) ||
      (nameMode === "above" ? posFullA : posFull).get(d.name);

    /* ---- Ordered by jobs: the same cells as a ranked bar chart. The top
       rows by jobs become bars, named on the left and valued at the end;
       every other cell keeps its place in the map and fades, so it can come
       back when the map does. One ranking is over the whole mix, one over
       the tradable cluster for the beat that shows that alone. ---- */
    /* the bars stop short of the right edge so the tradability column has a
       place to stand: ordered by jobs answers "what is biggest", and the
       column beside it answers "and does it sell outward", which is the
       question this beat is actually asking */
    const NB = 25, BML = 292, BMT = 62, BRH = 17.2, BBAR = 12, BPR = 740;
    /* the bars' head is the ranking's head, line for line: the column names
       on one baseline, a rule under each column, the tick row below that */
    const BHEAD_Y = BMT - 46, BRULE_Y = BMT - 36, BTICK_Y = BMT - 14, BGRID_TOP = BMT - 8;
    /* which column the bars carry beside the jobs: the opening beat asks how
       much know-how the work takes, the tiers beat how much of it sells out */
    let barMode = "cx";
    /* the five complexity steps, the same cuts the map's ramp is built on */
    const cxBin = name => {
      const v = pciByName.get(name);
      if (v == null) return 2;
      let b = 0; while (b < PCI_CUTS.length && v >= PCI_CUTS[b]) b++;
      return b;
    };
    const CX_WORDS = ["lowest", "low", "middle", "high", "highest"];
    /* what orders the bars: their own length, or the complexity beside them.
       Either way the bar is the jobs, as the ranking's bar stays the
       concentration whichever order its rows take */
    let barSort = "jobs";
    const cxVal = name => { const v = pciByName.get(name); return v == null ? -99 : v; };
    /* the set is the metro's biggest industries either way; the order is
       what the control changes */
    const barOrder = list => {
      const rows = list.slice(0, NB);
      return barSort === "cx" && barMode !== "tier"
        ? rows.slice().sort((a, b) => cxVal(b.name) - cxVal(a.name) || b.employ - a.employ)
        : rows;
    };
    const byJobsAll = industryData.slice().sort((a, b) => b.employ - a.employ);
    const barScale = d3.scaleLinear()
      .domain([0, (byJobsAll[0] ? byJobsAll[0].employ : 1) * 1.04]).range([BML + 12, BPR]);
    let closeMenuRef = null;
    /* the bars answer to both filters, so either one has to ask what the
       other leaves before it takes anything away */
    const tierListWith = (tOn, sOn) =>
      byJobsAll.filter(d => tOn[clusterOf(d)] && (!sOn || sOn.has(d.sector)));
    const tierList = () => tierListWith(tierOn, secOn);
    let barRankAll = null;                 /* set once barOrder exists */
    const byJobsTrad = tradRows.slice().sort((a, b) => b.employ - a.employ);
    const barRankTrad = new Map(byJobsTrad.slice(0, NB).map((d, i) => [d.name, i]));
    const barY = i => BMT + i * BRH + BRH / 2;
    const asBars = (d, rankMap, fill, fallback) => {
      const r = rankMap.get(d.name);
      return r == null
        ? { box: fallback, fill, op: 0, rx: 0 }
        : { box: { x: barScale(0), y: barY(r) - BBAR / 2,
                   w: Math.max(2, barScale(d.employ) - barScale(0)), h: BBAR }, fill, op: 1, rx: 0 };
    };
    window[ctlName + "_CLUSTERS"] = { share: clusterShare, gap: CGAP, width: MI_W };

    const ML = 292, MT = 62, RH = 34, BAR_H = 17, PLOT_R = 712;
    /* the three heads share a baseline, and the rules sit under them - the tick
       row keeps its own line below, so the labels of the columns and the
       readings of the scale never sit on the same line. The tick row sits
       midway between the rule and the first row, 14 clear of each, and the
       grid starts under it. */
    const HEAD_Y = MT - 46, HEAD_RULE_Y = MT - 36, TICK_Y = MT - 14, GRID_TOP = MT - 8;

    /* Trimming by character count let the widest names run past the left edge
       of the frame - "Sporting Goods Hobby and Musical Inst..." reached -17.6
       of an 880-unit box and was cut by it. The gutter is fixed in user units
       while .mi-name's size is not, so the only honest test is a measured one.
       It cannot be done at build time: the figure is built while its page is
       still hidden, and getComputedTextLength returns 0 in a display:none
       subtree, which silently passed every name through untrimmed. So the
       names are trimmed on paint, when the figure is on screen, and the
       character rule stands in until then. */
    const NAME_MAX = ML - 10 - 30;
    const charFit = n => n.length > 34 ? n.slice(0, 33).replace(/\s+\S*$/, "") + "\u2026" : n;
    function refitNames(){
      svg.selectAll("text.mi-name").each(function(){
        const full = this.getAttribute("data-full");
        if (!full || !this.getComputedTextLength) return;
        this.textContent = full;
        const w0 = this.getComputedTextLength();
        if (w0 === 0){ this.textContent = charFit(full); return; }
        if (w0 <= NAME_MAX) return;
        let cut = full;
        while (cut.length > 4){
          cut = cut.slice(0, -1).replace(/\s+$/, "");
          this.textContent = cut + "\u2026";
          if (this.getComputedTextLength() <= NAME_MAX) return;
        }
      });
    }

    /* the tradability column, between the bars and the jobs column */
    const TC_R = 796, TC_W = 56;
    const rowY = i => MT + i * RH + RH / 2;
    /* A ranking over a set of industries: the top twelve by concentration,
       with the scale they need. Two are kept. One is over the whole mix, for
       the narrative that reads sector first; the other is over the tradable
       cluster alone, for the narrative that reads tradability first, so its
       bars only ever rise from cells that were on screen the beat before. */
    /* the specializations among a set of industries. The tool's older
       tradable flag is a separate draw from the 0-1 score, and filtering on
       it would drop cells the clusters count as tradable, so a set picked by
       the score is judged on concentration alone. Shares are of all metro
       jobs, which is what the card says they are. */
    /* rcaOf and peersFor draw from the one seeded sequence the rest of the
       tool shares, and cache what they draw. Before this ranking, only
       industries the older flag admits were ever asked about, so asking about
       the others here would move every later draw — the metro scatter's
       background metros among them. So a value already drawn is used as it
       stands, and one not yet drawn comes from a generator seeded on the
       industry's own name, with the same formula, touching neither the shared
       sequence nor its caches. */
    const nameRand = key => {
      let h = 2166136261;
      for (const c of key){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
      let st = (h >>> 0) || 1;
      return () => (st = (st * 1664525 + 1013904223) >>> 0) / 4294967296;
    };
    /* the RCA as the source gives it; the peer values below are still
       generated, since the source carries no peer metros */
    const rcaQuiet = name => rcaOf(name);
    const peersQuiet = (name, cityRca) => {
      if (peerByName.has(name)) return peerByName.get(name);
      const r = nameRand(name + "|peers");
      const target = Math.max(1.15, cityRca * (0.4 + r() * 0.85));
      const jitter = PEERS.map(() => 0.62 + r() * 0.76);
      const mean = jitter.reduce((a, j) => a + j, 0) / jitter.length;
      const values = jitter.map(j => Math.round(target * (j / mean) * 10) / 10);
      const avg = Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10;
      return { values: values, avg: avg };
    };
    function specializedAmong(rows){
      const total = d3.sum(industryData, d => d.employ) || 1;
      const shown = v => Math.round(v * 10) / 10;
      return rows.filter(d => rcaQuiet(d.name) > 1).map(d => {
        const rca = rcaQuiet(d.name), localPct = d.employ / total * 100, pr = peersQuiet(d.name, rca);
        return { name: d.name, sector: d.sector, employ: d.employ, rca: rca,
          localPct: localPct, worldPct: localPct / rca,
          label: shortLabel(d.name) ||
                 (d.name.length > 40 ? d.name.slice(0, 37) + "\u2026" : d.name),
          peerAvg: pr.avg, peerValues: pr.values, ahead: shown(rca) >= shown(pr.avg) };
      });
    }
    /* The ranking ships as its second option: the tradability column names
       the tier ("Traded", "Partly traded", "Local") instead of printing the
       score, and its head opens the tier filter. The two tradable tiers
       start checked and the local one does not, so the beat opens on the
       most specialised tradable industries, as the question asks, and the
       reader can let the local ones in from the head. opt-1 keeps the
       earlier ranking: the score in the column, over the same two tiers,
       with no filter. */
    let rankMode = "tier";
    fig.dataset.rank = rankMode;
    const TIER_DEFAULT6 = () => [true, true, false];
    let tierOn6 = TIER_DEFAULT6();
    /* the industries the third beat ranks over: whatever the filter has
       checked under opt-2, the two tradable tiers under opt-1 */
    const rankPool = () => rankMode === "tier"
      ? clusterRows.filter((_, k) => tierOn6[k]).flat()
      : clusterRows[0].concat(clusterRows[1]);
    const TIER_NAMES = ["Traded", "Partly traded", "Local"];
    const tierLabel = d => TIER_NAMES[clusterOf(d)];
    /* A word is wider than a number, so the plot gives up room to the column
       while the words are showing - 54 units, not more. At 82 the value
       labels sat 70.8 from the words where opt-1's scores sit 44.6; the widest
       bar lands 0.0687 of the span short of the edge and the widest label
       runs 37.8 past it, so 54 puts the gap at 44.7. Only the third beat's
       ranking shows the words; the first ranking keeps its score and its
       full plot whichever option is on. */
    const plotR = tier => tier ? PLOT_R - 54 : PLOT_R;
    const inTier = R => R === R2 && rankMode === "tier";
    let wireRowsRef = null, rebuildR2Ref = null, hlSpansRef = null;
    /* how a phrase in the text points at its sector: "frame" draws a line
       round the block, "mute" turns the rest grey, "dim" fades it */
    let hlMode = "frame";
    function ranking(rows, among){
      const base = among ? specializedAmong(rows) : specializedWithPeers(rows);
      const ranked = base.sort((a, b) => b.rca - a.rca).slice(0, MI_TOP_N);
      /* only the ranking among the clusters - the third beat's - ever
         shows the tier words */
      const right = plotR(among && rankMode === "tier");
      return { ranked,
        rankIdx: new Map(ranked.map((d, i) => [d.name, i])),   /* by concentration: the badges' order */
        pos: new Map(ranked.map((d, i) => [d.name, i])),       /* the order on screen, which sorting changes */
        rankRow: new Map(ranked.map(d => [d.name, d])),
        xr: d3.scaleLinear()
          .domain([1, (d3.max(ranked, d => Math.max(d.rca, d.peerAvg)) || 2) * 1.06])
          .range([ML + 12, right]),
        /* the gap against the peer average, symmetric so the average sits
           mid-chart: ahead to the right, behind to the left */
        xg: (function(){
          const g = Math.max(0.5, (d3.max(ranked, d => Math.abs(d.rca - d.peerAvg)) || 0.5) * 1.15);
          return d3.scaleLinear().domain([-g, g]).range([ML + 12, right]);
        })() };
    }
    const gapOf = d => d.rca - d.peerAvg;
    const gapBox = (R, d, pos) => {
      const g = gapOf(d), x0 = Math.min(R.xg(0), R.xg(g));
      return { x: x0, y: rowY(pos) - BAR_H / 2, w: Math.max(2, Math.abs(R.xg(g) - R.xg(0))), h: BAR_H };
    };
    /* the three orders a reader can ask for: how concentrated, how big, and
       how far ahead of or behind the peers */
    const SORTS = {
      rca:  (a, b) => b.rca - a.rca,
      jobs: (a, b) => b.employ - a.employ,
      gap:  (a, b) => (b.rca - b.peerAvg) - (a.rca - a.peerAvg),
      trad: (a, b) => tradabilityOf(b.name) - tradabilityOf(a.name)
    };
    let sortKey = "rca";
    function reorder(R){
      const order = R.ranked.slice().sort(SORTS[sortKey] || SORTS.rca);
      R.pos = new Map(order.map((d, i) => [d.name, i]));
    }
    /* the ranking the third beat shows is over the clusters the filter has
       checked - the two tradable ones as shipped, so its bars rise only from
       cells that were in those two columns a beat before, unless the reader
       has let the local cluster in from the head */
    const R1 = ranking(industryData), R2 = ranking(rankPool(), true);
    const ranked = R1.ranked, rankIdx = R1.rankIdx, rankRow = R1.rankRow, xr = R1.xr;

    /* every industry, with everything each state needs to place and paint it */
    const cells = industryData.map(d => ({
      name: d.name, sector: d.sector, employ: d.employ,
      rank: rankIdx.has(d.name) ? rankIdx.get(d.name) : -1,
      row: rankRow.get(d.name) || null,
      rank2: R2.rankIdx.has(d.name) ? R2.rankIdx.get(d.name) : -1,
      row2: R2.rankRow.get(d.name) || null
    }));

    const STATE = {
      /* every industry, sized by jobs and grouped into sectors: the opening
         beat, coloured by sector or by complexity as the reader asks */
      0: d => !secShown(d) ? { box: allSpot(d), fill: fillBy(d), op: 0, rx: 0 }
        : view === "alt" ? asBars(d, barRankAll, fillBy(d), allSpot(d))
                         : { box: allSpot(d), fill: fillBy(d), op: 1, rx: 0 },
      1: d => view === "alt" ? asBars(d, barRankAll, complexityColor(d.name), spot(d))
                             : { box: spot(d), fill: complexityColor(d.name), op: 1, rx: 0 },
      2: d => ({ box: posSplit.get(d.name) || posFull.get(d.name),
                 fill: isTradable(d.name) ? sectorColors[d.sector] : GREY,
                 op: 1, rx: 0 }),
      3: d => d.rank < 0
        ? { box: posSplit.get(d.name) || posFull.get(d.name), fill: GREY, op: 0, rx: 0 }
        : sortKey === "gap"
          ? { box: gapBox(R1, d.row, R1.pos.get(d.name)), fill: gapOf(d.row) >= 0 ? TEAL : ORANGE, op: 1, rx: 0 }
          : { box: { x: xr(1), y: rowY(R1.pos.get(d.name)) - BAR_H / 2,
                     w: Math.max(2, xr(d.row.rca) - xr(1)), h: BAR_H },
              fill: d.rank < 3 ? TEAL : MUTED, op: 1, rx: 0 },
      /* the three clusters by tradability, the most tradable on the left */
      4: d => !secShown(d) || !tierShown(d) ? { box: clusterSpot(d), fill: clusterFill(d), op: 0, rx: 0 }
        : view === "alt"
          ? asBars(d, barRankAll, clusterFill(d), clusterSpot(d))
          : { box: clusterSpot(d), fill: clusterFill(d), op: 1, rx: 0 },
      /* the two outward-selling tiers on their own, the full width, read by
         complexity; the local tier stays where the clusters left it and fades */
      5: d => !secShown(d)
        ? { box: clusterOf(d) <= 1 ? (tradSpot(d) || posFull.get(d.name)) : clusterSpot(d),
            fill: complexityColor(d.name), op: 0, rx: 0 }
        : clusterOf(d) <= 1
        ? (view === "alt"
            ? asBars(d, barRankTrad, complexityColor(d.name), tradSpot(d) || posFull.get(d.name))
            : { box: tradSpot(d) || posFull.get(d.name), fill: complexityColor(d.name), op: 1, rx: 0 })
        : { box: clusterSpot(d), fill: GREY, op: 0, rx: 0 },
      /* traded and partly traded together, the full width, with no tier
         grounds: the beat after the three tiers. The local tier waits unseen
         where the tiers put it, already in the colour it wears there, so
         travelling back fades it in in place */
      7: d => !secShown(d)
        ? { box: clusterOf(d) <= 1 ? (tradSpot(d) || posFull.get(d.name)) : clusterSpot(d),
            fill: fillBy(d), op: 0, rx: 0 }
        : clusterOf(d) <= 1
        ? (view === "alt"
            ? asBars(d, barRankTrad, fillBy(d), tradSpot(d) || posFull.get(d.name))
            : { box: tradSpot(d) || posFull.get(d.name), fill: fillBy(d), op: 1, rx: 0 })
        : { box: clusterSpot(d), fill: fillBy(d), op: 0, rx: 0 },
      /* the ranking the two tradable clusters turn into. Arriving, it runs in
         two movements: everything that will not be a bar fades where it
         stands, then the ranked cells travel out of their columns and settle
         into bars */
      6: d => d.rank2 < 0
        ? { box: clusterSpot(d), fill: fillBy(d), op: 0, rx: 0 }
        : sortKey === "gap"
          ? { box: gapBox(R2, d.row2, R2.pos.get(d.name)), fill: gapOf(d.row2) >= 0 ? TEAL : ORANGE,
              op: 1, rx: 0, delay: arriving ? 300 : 0 }
          : { box: { x: R2.xr(1), y: rowY(R2.pos.get(d.name)) - BAR_H / 2,
                     w: Math.max(2, R2.xr(d.row2.rca) - R2.xr(1)), h: BAR_H },
              fill: d.rank2 < 3 ? TEAL : MUTED, op: 1, rx: 0, delay: arriving ? 300 : 0 }
    };

    /* ---- the marks ---- */
    svg.selectAll("*").remove();
    const gAxis = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    const gAxis2 = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    const gAxisGap  = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    const gAxisGap2 = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    /* the row highlight lives below the cells: above them it would paint
       over the bars, and any translucency would shift the sector colour the
       bar is encoding */
    /* behind every other layer: the three grounds and their headers */
    const gCards = svg.append("g").attr("class", "mi-cards").style("opacity", 0);
    /* Each ground is a frame with a band across its top: the tier's name at
       the left of the band, its share beside it, and a cross at the right
       that takes the ground away. The frame is square, drawn as an outline
       rather than a grey field, so the cells inside it carry all the colour. */
    function drawCards(animate){
      const dur = animate ? 950 : 0;
      const sel = gCards.selectAll("g.mi-card-g").data(cardBox, c => c.k)
        .join(enter => {
          const g = enter.append("g").attr("class", "mi-card-g");
          g.append("rect").attr("class", "mi-card").attr("y", 0).attr("height", MI_H).attr("rx", 0);
          g.append("rect").attr("class", "mi-card-band").attr("y", 0).attr("height", BAND_H);
          g.append("text").attr("class", "mi-card-lab");
          g.append("text").attr("class", "mi-card-pct");
          g.append("text").attr("class", "mi-card-none");
          const x = g.append("g").attr("class", "mi-card-x");
          x.append("rect").attr("class", "mi-card-x-hit").attr("y", 5).attr("width", 20).attr("height", 20);
          x.append("path").attr("class", "mi-card-x-mark");
          x.append("title");
          return g;
        });
      const go = q => dur ? q.transition().duration(dur).ease(d3.easeCubicInOut) : q;
      /* the words are set at once and only the geometry travels: text put on
         a transition arrives with it, and a ground coming back would carry a
         blank band the whole way */
      sel.select("text.mi-card-lab").attr("y", 20).text(c => TIER_NAMES[c.k]);
      sel.select("text.mi-card-pct").attr("y", 20).attr("text-anchor", "end")
        .text(c => Math.round(clusterShare[c.k] * 100) + "%");
      sel.select("text.mi-card-none").attr("y", CARD_HEAD + 26);
      go(sel.select("rect.mi-card")).attr("x", c => c.x).attr("width", c => c.w);
      go(sel.select("rect.mi-card-band")).attr("x", c => c.x).attr("width", c => c.w);
      go(sel.select("text.mi-card-lab")).attr("x", c => c.x + CARD_TXT);
      go(sel.select("text.mi-card-pct")).attr("x", c => c.x + c.w - CARD_TXT - 22);
      go(sel.select("text.mi-card-none")).attr("x", c => c.x + CARD_TXT);
      /* the cross only where there is another ground to fall back on */
      sel.select("g.mi-card-x").style("display", cardBox.length > 1 ? null : "none");
      go(sel.select("rect.mi-card-x-hit")).attr("x", c => c.x + c.w - CARD_TXT - 16);
      go(sel.select("path.mi-card-x-mark")).attr("d", c => {
        const x = c.x + c.w - CARD_TXT - 10, y = 15, r = 4;
        return "M" + (x - r) + "," + (y - r) + "L" + (x + r) + "," + (y + r) +
               "M" + (x + r) + "," + (y - r) + "L" + (x - r) + "," + (y + r);
      });
      sel.select("title").text(c => "Take " + TIER_NAMES[c.k].toLowerCase() + " off the map");
      sel.select("rect.mi-card-x-hit").on("click", (ev, c) => { ev.stopPropagation(); setTier(c.k, false); });
    }
    drawCards(false);
    /* the grounds a reader has cancelled, offered back above the chart */
    const tierBack = document.getElementById(p + "TierBack");
    function syncTierBack(){
      if (!tierBack) return;
      const off = [0, 1, 2].filter(k => !tierOn[k]);
      tierBack.innerHTML = off.map(k =>
        '<button type="button" class="mcl-chip" data-tier="' + k + '">' +
        '<i aria-hidden="true">+</i>' + TIER_NAMES[k] + '</button>').join("");
    }
    /* one state for the beat: the map's grounds and the bars' filter are the
       same three tiers, so cancelling a ground drops it from both */
    function setTier(k, on){
      if (tierOn[k] === on) return;
      const probe = tierOn.slice(); probe[k] = on;
      if (!probe.some(Boolean) || !tierListWith(probe, secOn).length) return;
      tierOn[k] = on;
      layoutClusters();
      barListAll = tierList();
      reBarRank();
      drawBars(barListAll, gBarsAll);
      drawCards(!reduced());
      syncTierBack();
      if (syncTierMenu) syncTierMenu();
      if (step >= 0) paint(step, !reduced());
    }
    let syncTierMenu = null;
    if (tierBack) tierBack.addEventListener("click", ev => {
      const b = ev.target.closest(".mcl-chip[data-tier]");
      if (b) setTier(+b.dataset.tier, true);
    });
    syncTierBack();
    const gHi = svg.append("g").attr("class", "mi-hilite-layer");
    const hiRect = gHi.append("rect").attr("class", "mi-hilite")
      .attr("x", 0).attr("width", MI_W).attr("height", RH).style("opacity", 0);
    /* the bands a named phrase lights, in the same layer for the same reason */
    const gLit = gHi.append("g").attr("class", "mi-litrows");
    const gCells = svg.append("g").attr("class", "mi-cells");
    const gRows  = svg.append("g").attr("class", "mi-rows").style("opacity", 0);
    const gRows2 = svg.append("g").attr("class", "mi-rows").style("opacity", 0);
    const gBarsAll  = svg.append("g").attr("class", "mi-rows mi-bars").style("opacity", 0);
    const gBarsTrad = svg.append("g").attr("class", "mi-rows mi-bars").style("opacity", 0);
    /* the sector names, written on the blocks they belong to */
    const gSecLab = svg.append("g").attr("class", "mi-seclab").style("opacity", 0);
    /* the phrase highlight's frame sits above everything: it draws no fill,
       so the blocks and their names read straight through it */
    const gHlFrame = svg.append("g").attr("class", "mi-hlframe-layer");
    /* The reference writes its names ON the coloured block and switches
       between white and near-black to suit it. Ours sit in a strip above
       the block, where the ground is the panel's white — so the choice is
       not white-or-black but how dark the sector's own colour has to be
       to carry on white. Darkening the hue rather than going to ink makes
       the name itself the key: the words are the colour they name. */
    const lum = c => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const onWhite = c => 1.05 / (lum(c) + 0.05);
    /* Why the name needs a ground at all: written straight onto the fill it
       cannot be read: even now that manufacturing and other have been taken
       down to carry white at 4.6:1, a name written on the fill would be
       fighting the cells' own labels for the same surface. */
    /* The near-black chip was legible and wrong: it floated two units inside
       the block, leaving a rim of fill showing all round it, and a shape that
       floats reads as something laid on top of the picture. Nine of them over
       three tradability columns looked like hardware bolted to the map.
       The name now sits in a tab flush with the block's own top-left corner,
       so two of its four sides are the block's edges and it reads as part of
       the block's construction. The ground is the white the gutters already
       are, and the ink is the sector's own hue - the same ink opt-1 sets on
       its strip, so the name is its sector's colour whichever option is on. */
    /* 4.6 rather than 4.5: at 4.5 two of the nine cleared the bar by 0.03,
       which is a rounding accident rather than a margin */
    const labelInk = hex => {
      const base = d3.color(hex); if (!base) return "#1a2226";
      for (let k = 0; k <= 3.2; k += 0.1){
        const c = d3.color(base.darker(k).formatHex());
        if (onWhite(c) >= 4.6) return c.formatHex();
      }
      return "#1a2226";
    };
    /* opt-1 writes on a strip of its own above the block, so it stays at the
       11 units the strip was cut for. opt-2 shares the surface with the cell
       labels, so it has to sit above them in size as well as in weight -
       anything smaller reads as one more industry name. */
    /* the chip is what separates the two registers, so the words themselves
       can stay the size of the cell labels. Setting them larger cost names:
       at 1100 a 15-unit name lost four of beat 2's nine blocks, Professional
       & Business among them, because the blocks are fixed in user units
       while the type is not. Same size, dark ground, white ink. */
    const TAB_PADL = 3, TAB_PADR = 5, TAB_AIR = 4, TAB_R = 3;
    /* The tab was white, and white is the one value none of the nine fills
       use, so nine white notches read as holes punched in the map - and on
       the two pale fills it disappeared altogether, so the treatment was not
       even consistent. The ground is now the block's own colour taken most of
       the way to white: the tab is made of the block, never white, and never
       the brightest thing on the picture. Near-black on it runs 12.5:1 to
       14.8:1, where the white tab's sector-hued ink only reached 4.62. */
    const TAB_TINT = 0.82;
    const tabGround = hex => d3.interpolateRgb(hex, "#ffffff")(TAB_TINT);
    const secUnit = () => labUnit();
    function drawSectorLabels(which){
      /* only where the block can hold the words: a clipped sector name is
         worse than none, since the reader cannot tell which it was */
      hideLab = new Set();
      if (nameMode === "off"){ gSecLab.selectAll("g.mi-seclab-g").remove(); return; }
      const above = nameMode === "above";
      const u = above ? LAB_BASE : secUnit();
      /* the tab's own geometry, in the same user units as the blocks */
      const TH = Math.round(u * 1.36);
      const dy = TH - Math.round(u * 0.41);
      const secs = which === 4 ? (above ? secClusterA : secClusterB) : null;
      const flat = which === 0
        ? (secGeo ? (above ? secGeo.secA : secGeo.secB) : (above ? secFullA : secFullB))
        : (secGeo ? (above ? secGeo.tradSecA : secGeo.tradSecB) : (above ? secTradA : secTradB));
      const src = secs
        ? [...secs].map(([k, v]) => ({ key: k, name: v.name, b: v.b }))
        : [...flat].map(([name, b]) => ({ key: name, name: name, b: b }));
      /* a generous first pass only - the real gate is the measured width
         below, so this must not throw away a name the block could hold */
      const items = src.filter(d =>
        d.b.h >= Math.max(46, TH + 11) && d.b.w >= name_w(d.name, u));
      const gsel = gSecLab.selectAll("g.mi-seclab-g").data(items, d => d.key)
        .join(enter => {
          const g = enter.append("g").attr("class", "mi-seclab-g");
          g.append("path").attr("class", "mi-seclab-tab");
          g.append("text");
          return g;
        });
      const txt = gsel.select("text")
        .attr("class", "mi-seclab-t" + (above ? "" : " is-inside"))
        .attr("x", d => d.b.x + (above ? 5 : TAB_PADL))
        .attr("y", d => d.b.y + (above ? 12 : dy))
        .attr("fill", d => above ? labelInk(sectorColors[d.name]) : "#1a2226")
        .text(d => d.name);
      /* name_w is only a cheap pre-filter; what the block has to hold is the
         width the browser actually sets, so measure it and drop the ones that
         would run past their own block into the sector beside them */
      const realW = new Map();
      txt.each(function(d){
        const w = this.getComputedTextLength ? this.getComputedTextLength() : name_w(d.name, u);
        realW.set(d.key, w);
      });
      /* what the block has to clear: opt-1 needs the words plus a little air,
         opt-2 needs the whole chip and its insets */
      const tabW = d => (realW.get(d.key) || 0) + TAB_PADL + TAB_PADR;
      const need = d => above
        ? (realW.get(d.key) || 0) + 12
        : tabW(d) + TAB_AIR;
      /* sharp where the tab meets the block's own top and left edges, rounded
         only on the one corner that is free of them */
      gsel.select("path.mi-seclab-tab")
        .attr("display", above ? "none" : null)
        .attr("fill", d => tabGround(sectorColors[d.name]))
        .attr("d", d => {
          const x0 = d.b.x, y0 = d.b.y, w = tabW(d);
          return `M${x0},${y0} H${x0 + w} V${y0 + TH - TAB_R}` +
                 ` a${TAB_R},${TAB_R} 0 0 1 ${-TAB_R},${TAB_R} H${x0} Z`;
        });
      /* a tab with no word on it names nothing, so the two leave together */
      gsel.filter(d => need(d) > d.b.w).remove();
      /* opt-2 covers whatever cell lies under the tab - the tab, not the
         words, since the tab is what the reader cannot see through */
      if (!above) items.forEach(d => {
        if (need(d) > d.b.w) return;
        const x0 = d.b.x, y0 = d.b.y;
        const x1 = x0 + tabW(d), y1 = y0 + TH;
        /* the tabs are drawn from the layout on screen, so the cells they
           cover have to be looked for in that same layout: against the
           unfiltered maps a tab covers cells that have moved away, and
           misses the ones that moved under it */
        const pos = secGeo
          ? (which === 4 ? secGeo.clB : which === 0 ? secGeo.full : secGeo.tradB)
          : (which === 4 ? posClusterB : which === 0 ? posFull : posTradB);
        (which === 4 ? clusterRows.flat() : which === 0 ? industryData : tradRows).forEach(r => {
          const b = pos.get(r.name);
          if (b && b.x < x1 && b.y < y1 &&
              b.x + b.w > x0 && b.y + b.h > y0) hideLab.add(r.name);
        });
      });
    }
    /* semibold runs about 0.55em a character, plus the inset and a little air
       at the end; the estimate has to follow the size the name is set at, or
       it throws away names the block could hold */
    const name_w = (s, u) => s.length * 6.1 * ((u || LAB_BASE) / LAB_BASE) + 14;
    let coarseCell = null, posCoarse = null, posCoarseFlat = null, coarseShare = null;
    if (opts.adminReveal){
      /* This beat asks how much of the METRO's work happens in the city, so
         it opens on the metro's own mix, aggregated one level up. The beats
         after it read the administrative city, which is the set this figure
         otherwise carries. */
      const revealRows = opts.revealRows || industryData;
      const coarse = twoDigitRows(revealRows);
      posCoarse = new Map(tmap(coarse, MI_W, MI_H, true).leaves()
        .map(n => [n.data.name, box(n)]));
      posCoarseFlat = stripLayout(coarse, MI_W, MI_H);
      coarseShare = d => ADMIN_SHARE[d.sector] !== undefined ? ADMIN_SHARE[d.sector] : 0.15;

      /* the sector's own colour, once pale and once full: the pale ground is
         the whole of that work across the metro, and the full band standing
         on the foot of the block is the part of it inside the city */
      const pale = sec => d3.interpolateRgb(sectorColors[sec] || "#ccc", "#ffffff")(0.66);

      const gCoarse = svg.insert("g", ".mi-cells").attr("class", "mi-coarse");
      coarseCell = gCoarse.selectAll("g.mi-cell").data(coarse, d => d.name)
        .join("g").attr("class", "mi-cell");
      coarseCell.append("rect").attr("class", "mi-rect")
        .attr("fill", d => sectorColors[d.sector] || "#ccc");
      coarseCell.append("rect").attr("class", "mi-share")
        .attr("fill", d => sectorColors[d.sector] || "#ccc")
        .attr("height", 0);
      coarseCell.append("text").attr("class", "mi-lab");
      /* one figure per sector, on its largest block */
      const biggest = {};
      coarse.forEach(d => {
        const cur = biggest[d.sector];
        if (!cur || d.employ > cur.employ) biggest[d.sector] = d;
      });
      coarseCell.filter(d => biggest[d.sector] === d)
        .append("text").attr("class", "mi-share-pct")
        .text(d => Math.round(coarseShare(d) * 100) + "% here");
    }

    const cell = gCells.selectAll("g.mi-cell").data(cells, d => d.name)
      .join("g").attr("class", "mi-cell");
    cell.append("rect").attr("class", "mi-rect cell");
    cell.append("text").attr("class", "mi-lab");
    cell.append("text").attr("class", "mi-pct");

    /* the ranking's own furniture, drawn once per ranking and revealed with
       its state: the axis and its name, the leading three braced, and each
       row's name, value, peer tick and badge */
    function drawGapAxis(R, AG){
      const ticks = R.xg.ticks(5);
      AG.selectAll("g.mi-tick").data(ticks).join("g").attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 0 ? " is-base" : ""))
          .attr("x1", d => R.xg(d)).attr("x2", d => R.xg(d))
          .attr("y1", GRID_TOP).attr("y2", MT + R.ranked.length * RH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => R.xg(d)).attr("y", TICK_Y).attr("text-anchor", "middle")
          .text(d => (d > 0 ? "+" : "") + d + "\u00d7"));
      AG.append("text").attr("class", "mi-axname")
        .attr("x", ML + 12).attr("y", HEAD_Y)
        .text("Against the peer average");
      AG.append("text").attr("class", "mi-colhead")
        .attr("x", MI_W - 6).attr("y", HEAD_Y).attr("text-anchor", "end").text("Jobs");
      tradHead(AG, R);
      headRules(AG, ML + 12, plotR(inTier(R)), inTier(R));
    }
    /* the tradability column's head, its range on the same line, and the rules
       that make the three columns read as a table head */
    const JOBS_L = 812, JOBS_R = MI_W - 6;
    /* the head as a button: the word, a caret, and a hit area round both. ctx
       says which filter it opens, since the jobs order and the ranking keep
       their own tier sets. */
    function menuHead(G, xRight, yBase, ctx){
      const hg = G.append("g").attr("class", "mi-tradmenu " + ctx)
        .attr("tabindex", 0).attr("role", "button")
        .attr("aria-haspopup", "true").attr("aria-expanded", "false");
      const ht = hg.append("text").attr("class", "mi-colhead")
        .attr("x", xRight - 13).attr("y", yBase).attr("text-anchor", "end").text("Tradability");
      /* the caret ends flush with the column's edge, and the hit area stops
         at the separator rather than crossing it */
      hg.append("path").attr("class", "mi-tradmenu-caret")
        .attr("d", `M${xRight - 7},${yBase - 6} l3.5,3.5 l3.5,-3.5`);
      const tw = ht.node().getComputedTextLength ? ht.node().getComputedTextLength() : 70;
      hg.insert("rect", "text").attr("class", "mi-tradmenu-hit")
        .attr("x", xRight - 13 - tw - 6).attr("y", yBase - 16)
        .attr("width", tw + 21).attr("height", 22).attr("rx", 3);
    }
    function tradHead(A, R){
      if (inTier(R)){ menuHead(A, TC_R, HEAD_Y, "is-rank"); return; }
      A.append("text").attr("class", "mi-colhead")
        .attr("x", TC_R).attr("y", HEAD_Y).attr("text-anchor", "end").text("Tradability");
    }
    function headRules(A, plotL, plotEnd, tier){
      const y = HEAD_RULE_Y;
      /* one rule under each column, and nothing between them: the breaks in
         the rule are the separators. The tradability column is 56 wide under
         a score and 80 under a word, so its rule follows the mode; 712 clears
         the widest word by 4 and the head by 8, as the jobs rule clears its
         column */
      const tradL = tier ? 712 : TC_R - TC_W - 8;
      [[plotL, plotEnd], [tradL, TC_R], [JOBS_L, JOBS_R]].forEach(seg => {
        A.append("line").attr("class", "mi-headrule")
          .attr("x1", seg[0]).attr("x2", seg[1]).attr("y1", y).attr("y2", y);
      });
    }
    function drawRanking(R, A, G){
      const tierMode = inTier(R);
      /* the rows carry the mode, so the score's track stands down under
         the words without touching the first ranking's rows */
      G.classed("is-tier", tierMode);
      A.selectAll("g.mi-tick").data(R.xr.ticks(5).filter(t => t >= 1)).join("g")
        .attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 1 ? " is-base" : ""))
          .attr("x1", d => R.xr(d)).attr("x2", d => R.xr(d))
          .attr("y1", GRID_TOP).attr("y2", MT + R.ranked.length * RH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => R.xr(d)).attr("y", TICK_Y).attr("text-anchor", "middle")
          .text(d => d + "\u00d7"));
      A.append("text").attr("class", "mi-axname")
        .attr("x", ML + 12).attr("y", HEAD_Y)
        .text("Times more concentrated");
      /* the jobs column: its head, and each row's count at the right edge */
      A.append("text").attr("class", "mi-colhead")
        .attr("x", MI_W - 6).attr("y", HEAD_Y).attr("text-anchor", "end").text("Jobs");
      tradHead(A, R);
      headRules(A, ML + 12, plotR(tierMode), tierMode);
      /* the leading three by concentration, braced only while that is the order */
      const topN = Math.min(3, R.ranked.length);
      R.brace = A.append("g").attr("class", "mi-bracewrap");
      if (topN){
        const y0 = rowY(0) - BAR_H / 2 - 5, y1 = rowY(topN - 1) + BAR_H / 2 + 5;
        R.brace.append("path").attr("class", "mi-brace").attr("d", "M4," + y0 + "V" + y1);
        R.brace.append("text").attr("class", "mi-toplab")
          .attr("x", 4).attr("y", y0 - 9)
          .text("Most specialized tradable industries");
      }
      const row = G.selectAll("g.mi-row").data(R.ranked, d => d.name)
        .join("g").attr("class", "mi-row")
        .attr("transform", d => "translate(0," + rowY(R.pos.get(d.name)) + ")");
      /* the band the cursor actually hits: full width, so the name at one end
         and the jobs count at the other belong to the same target */
      row.append("rect").attr("class", "mi-rowbg")
        .attr("x", 0).attr("y", -RH / 2).attr("width", MI_W).attr("height", RH);
      const top = d => R.rankIdx.get(d.name) < 3;
      row.append("text").attr("class", d => "mi-name" + (top(d) ? " is-top" : ""))
        .attr("x", ML - 10).attr("y", 4).attr("text-anchor", "end")
        .attr("data-full", d => d.label).text(d => charFit(d.label));
      row.append("text").attr("class", d => "mi-val" + (top(d) ? " is-top" : ""))
        .attr("x", d => Math.max(R.xr(d.rca), R.xr(d.peerAvg)) + 9).attr("y", 4)
        .text(d => d.rca.toFixed(1) + "\u00d7");
      row.append("line").attr("class", "mi-peer")
        .attr("x1", d => R.xr(d.peerAvg)).attr("x2", d => R.xr(d.peerAvg))
        .attr("y1", -BAR_H / 2 - 4).attr("y2", BAR_H / 2 + 4);
      /* the jobs column: the count, and a short bar beneath it so size reads
         as a second small chart in every order the rows can take. Beside the
         tier word the count sits on the row's common baseline, as the word
         and the value do, and the bar drops a step to stay clear of it */
      const jb = d3.scaleLinear().domain([0, d3.max(R.ranked, d => d.employ) || 1]).range([0, 58]);
      row.append("text").attr("class", "mi-jobs")
        .attr("x", MI_W - 6).attr("y", tierMode ? 4 : 1).attr("text-anchor", "end")
        .text(d => d.employ >= 1000 ? Math.round(d.employ / 1000) + "K" : Math.round(d.employ));
      row.append("rect").attr("class", "mi-jobsbar")
        .attr("x", d => MI_W - 6 - Math.max(4, jb(d.employ))).attr("y", tierMode ? 7 : 5)
        .attr("width", d => Math.max(4, jb(d.employ))).attr("height", 4).attr("rx", 0);
      /* the tradability column, built the way the jobs column is: the score,
         and a short track beneath it from 0 to 1, filled as far as the score
         reaches, with a tick where the traded tier begins */
      const tw = d3.scaleLinear().domain([0, 1]).range([0, TC_W]);
      row.append("text").attr("class", "mi-trad" + (tierMode ? " is-tier" : ""))
        .attr("x", TC_R).attr("y", tierMode ? 4 : 1).attr("text-anchor", "end")
        .text(d => tierMode ? tierLabel(d) : tradabilityOf(d.name).toFixed(2));
      row.append("rect").attr("class", "mi-tradtrack")
        .attr("x", TC_R - TC_W).attr("y", 5).attr("width", TC_W).attr("height", 4).attr("rx", 0);
      row.append("rect").attr("class", "mi-tradbar")
        .attr("x", TC_R - TC_W).attr("y", 5).attr("height", 4).attr("rx", 0)
        .attr("width", d => Math.max(1, tw(tradabilityOf(d.name))));
      row.append("line").attr("class", "mi-tradtick")
        .attr("x1", TC_R - TC_W + tw(CL_HI)).attr("x2", TC_R - TC_W + tw(CL_HI))
        .attr("y1", 10).attr("y2", 13.5);
      row.filter(top).call(g => {
        g.append("circle").attr("class", "mi-badge-bg").attr("cx", 14).attr("cy", 0).attr("r", 9);
        g.append("text").attr("class", "mi-badge").attr("x", 14).attr("y", 3.5)
          .attr("text-anchor", "middle").text(d => R.rankIdx.get(d.name) + 1);
      });
      R.row = row;
    }
    /* The ranking over a different pool. R2 is mutated in place rather than
       replaced, because every state closure holds it; the cells relearn
       their place in it; and its three groups are cleared and drawn again,
       since the axis furniture is appended rather than joined. */
    function rebuildR2(animate){
      Object.assign(R2, ranking(rankPool(), true));
      cells.forEach(c => {
        c.rank2 = R2.rankIdx.has(c.name) ? R2.rankIdx.get(c.name) : -1;
        c.row2 = R2.rankRow.get(c.name) || null;
      });
      gAxis2.selectAll("*").remove(); gAxisGap2.selectAll("*").remove(); gRows2.selectAll("*").remove();
      drawGapAxis(R2, gAxisGap2);
      drawRanking(R2, gAxis2, gRows2);
      reorder(R2);
      placeRanking(R2, false);
      if (wireRowsRef) wireRowsRef(R2);
      if (step === 6) paint(6, animate);
    }
    rebuildR2Ref = rebuildR2;
    /* the rows to their places in the current order */
    function placeRanking(R, animate){
      if (!R.row) return;
      const dur = animate ? 800 : 0;
      const t = sel => dur ? sel.transition().duration(dur).ease(d3.easeCubicInOut) : sel;
      t(R.row).attr("transform", d => "translate(0," + rowY(R.pos.get(d.name)) + ")");
      (dur ? R.brace.transition().duration(dur / 2) : R.brace)
        .style("opacity", sortKey === "rca" ? 1 : 0);
      /* under the peers order the value is the gap, printed at the bar's
         far end; the peer tick stands down, since the average is the line */
      const gap = sortKey === "gap";
      const val = R.row.select(".mi-val");
      val.text(d => gap ? ((gapOf(d) >= 0 ? "+" : "\u2212") + Math.abs(gapOf(d)).toFixed(1) + "\u00d7")
                        : d.rca.toFixed(1) + "\u00d7");
      t(val).attr("x", d => gap ? (gapOf(d) >= 0 ? R.xg(gapOf(d)) + 8 : R.xg(gapOf(d)) - 8)
                                : Math.max(R.xr(d.rca), R.xr(d.peerAvg)) + 9)
        .attr("text-anchor", d => gap && gapOf(d) < 0 ? "end" : "start");
      t(R.row.select(".mi-peer")).style("opacity", gap ? 0 : 1);
    }
    drawRanking(R1, gAxis, gRows);
    drawRanking(R2, gAxis2, gRows2);
    drawGapAxis(R1, gAxisGap);
    drawGapAxis(R2, gAxisGap2);

    /* the bars' furniture: a jobs axis, the names on the left, the value at
       each bar's end */
    const fmtJobs = v => v >= 1000 ? Math.round(v / 1000) + "K" : String(Math.round(v));
    const shortName = n => charFit(n);
    function drawBars(list, G){
      /* built fresh each time: the tier filter re-ranks the whole view, the
         order can change under the reader, and the beats ask for different
         columns, so there is nothing here worth updating in place */
      G.selectAll("*").remove();
      const rows = barOrder(list);
      const tierMode = barMode === "tier";
      G.selectAll("g.mi-tick").data(barScale.ticks(4)).join("g").attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 0 ? " is-base" : ""))
          .attr("x1", d => barScale(d)).attr("x2", d => barScale(d))
          .attr("y1", BGRID_TOP).attr("y2", BMT + rows.length * BRH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => barScale(d)).attr("y", BTICK_Y).attr("text-anchor", "middle")
          .text(d => fmtJobs(d)));
      G.append("text").attr("class", "mi-axname")
        .attr("x", BML + 12).attr("y", BHEAD_Y).text("Jobs in the metro");
      /* one column beside the plot, at the edge the ranking keeps its last
         column on. The tiers beat carries tradability, and its head is the
         filter; the opening beat carries complexity, as five steps rather
         than a score, since the beat puts no number on complexity */
      const COL_R = MI_W - 6, CX_D = 4.2, CX_GAP = 12, CX_L = COL_R - 4 * CX_GAP - 2 * CX_D;
      if (tierMode){
        if (G === gBarsAll) menuHead(G, COL_R, BHEAD_Y, "is-bars");
        else G.append("text").attr("class", "mi-colhead")
          .attr("x", COL_R).attr("y", BHEAD_Y).attr("text-anchor", "end").text("Tradability");
      } else {
        G.append("text").attr("class", "mi-colhead")
          .attr("x", COL_R).attr("y", BHEAD_Y).attr("text-anchor", "end").text("Complexity");
      }
      /* both columns are 84 wide, which clears the longest of the words that
         head them; measuring the word instead would read 0, since the figure
         is drawn before the page that holds it is laid out */
      const colL = COL_R - 84;
      /* a rule under each column, and the break between them is the only
         separator - the ranking's head, at the bars' own height */
      [[BML + 12, BPR], [colL, COL_R]].forEach(seg => {
        G.append("line").attr("class", "mi-headrule")
          .attr("x1", seg[0]).attr("x2", seg[1]).attr("y1", BRULE_Y).attr("y2", BRULE_Y);
      });
      const row = G.selectAll("g.mi-row").data(rows, d => d.name).join("g").attr("class", "mi-row");
      row.append("text").attr("class", "mi-name")
        .attr("x", BML - 10).attr("y", (d, i) => barY(i) + 4).attr("text-anchor", "end")
        .attr("data-full", d => d.label || d.name).text(d => charFit(d.label || d.name));
      /* the reading sits at the end of the bar it belongs to, as the
         ranking's does */
      row.append("text").attr("class", "mi-val")
        .attr("x", d => barScale(d.employ) + 8).attr("y", (d, i) => barY(i) + 4)
        .text(d => fmtJobs(d.employ));
      if (tierMode){
        row.append("text").attr("class", "mi-trad is-tier")
          .attr("x", COL_R).attr("y", (d, i) => barY(i) + 4).attr("text-anchor", "end")
          .text(d => tierLabel(d));
        return;
      }
      /* five steps, filled as far as the industry reaches. The count is the
         reading, so every step is the same ink rather than the ramp's own
         colour, whose middle is too pale to count at this size. Diamonds:
         a row of them counts at a glance, and they are the one mark in the
         figure that is neither a square cell nor a round dot. */
      row.each(function(d, i){
        const g = d3.select(this), on = cxBin(d.name), y = barY(i);
        for (let k = 0; k < 5; k++){
          const x = CX_L + CX_D + k * CX_GAP;
          g.append("path").attr("class", "mi-cxdot" + (k <= on ? " is-on" : ""))
            .attr("d", "M" + x + "," + (y - CX_D) + "L" + (x + CX_D) + "," + y +
                       "L" + x + "," + (y + CX_D) + "L" + (x - CX_D) + "," + y + "Z");
        }
      });
    }
    let barListAll = byJobsAll;
    const reBarRank = () => { barRankAll = new Map(barOrder(barListAll).map((d, i) => [d.name, i])); };
    reBarRank();
    drawBars(byJobsAll, gBarsAll);
    { const keep = barMode; barMode = "tier"; drawBars(byJobsTrad, gBarsTrad); barMode = keep; }

    /* the labels are fitted when a beat paints; when the window crosses one
       of the widths that change the unit scale, the beat on screen is
       painted again so its names are fitted to the new scale */
    {
      let lastUnit = null, timer = null;
      window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const u = labUnit();
          if (lastUnit !== null && u !== lastUnit && step >= 0) paint(step, false);
          lastUnit = u;
        }, 150);
      });
      lastUnit = labUnit();
    }

    let step = -1, painted = -1, arriving = false;
    /* set once the tooltips are wired; the beat change calls it so a phrase
       left lit cannot dim the next beat */
    let clearHighlight = null;
    const reduced = () => window.matchMedia &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    function paint(i, animate){
      /* only a first arrival at the ranking is staged; re-sorting it is not */
      arriving = !!animate && i === 6 && painted !== 6;
      const at = STATE[i];
      const dur = animate ? 950 : 0;
      const rects = cell.select(".mi-rect");
      const sel = dur ? rects.transition().delay(d => at(d).delay || 0)
        .duration(dur).ease(d3.easeCubicInOut) : rects;
      sel.attr("x", d => at(d).box.x).attr("y", d => at(d).box.y)
         .attr("width", d => at(d).box.w).attr("height", d => at(d).box.h)
         .attr("fill", d => at(d).fill).attr("rx", d => at(d).rx)
         .style("opacity", d => at(d).op);
      /* a cell faded out of the ranking must not answer the cursor */
      rects.style("pointer-events", d => at(d).op > 0 ? null : "none");

      /* labels ride the cells while there is room for them, and stand down
         once the mix becomes a ranking that carries its own names */
      const labs = cell.select(".mi-lab"), pcts = cell.select(".mi-pct");
      const barsOn = view === "alt" && (i === 0 || i === 1 || i === 4 || i === 5 || i === 7);
      /* which cell labels stand down is decided by where the sector names
         land, so the names have to be placed before the labels are written */
      if (i === 7 || i === 4 || i === 0) drawSectorLabels(i); else hideLab = new Set();
      /* the names can only be measured once the figure is on screen */
      refitNames();
      if (i === 3 || i === 6 || barsOn){
        [labs, pcts].forEach(t => (dur ? t.transition().duration(dur / 3) : t).style("opacity", 0));
      } else {
        /* the name whole and as large as the cell allows, the share under
           it; a cell that cannot hold the whole name carries nothing */
        const k = labUnit() / LAB_BASE, pctFmt = d3.format(".2%");
        cell.each(function(d){
          const st = at(d), b = st.box, g = d3.select(this);
          const nameT = g.select(".mi-lab"), pctT = g.select(".mi-pct");
          nameT.text(null); pctT.text(null);
          if (st.op <= 0 || hideLab.has(d.name)) return;
          const spec = cellLabelSpec(d.name, b.w, b.h, k, pctFmt(d.employ / jobsTotal));
          if (!spec) return;
          const ink = cellInk(st.fill), x = b.x + spec.pad;
          nameT.attr("x", x).attr("y", b.y + spec.pad + spec.f * 0.86)
            .style("font-size", spec.f + "px").style("fill", ink).attr("data-ink", ink);
          spec.lines.forEach((ln, n) => nameT.append("tspan")
            .attr("x", x).attr("dy", n ? spec.f * spec.lh : 0).text(ln));
          if (spec.pf) pctT.attr("x", b.x + b.w / 2).attr("y", b.y + b.h - spec.pad - spec.pf * 0.12)
            .style("font-size", spec.pf + "px").style("fill", ink).attr("data-ink", ink)
            .text(pctFmt(d.employ / jobsTotal));
        });
        [labs, pcts].forEach(t => (dur ? t.transition().delay(dur / 2).duration(dur / 2) : t)
          .style("opacity", d => at(d).op > 0 ? 1 : 0));
      }
      const show = (g, on, delay) => {
        /* a faded group still sits over everything beneath it, so the pointer
           has to be handed back with the opacity */
        g.style("pointer-events", on ? null : "none");
        return (dur ? g.transition().delay(on ? (delay || 0) : 0).duration(dur / 2) : g)
          .style("opacity", on ? 1 : 0);
      };
      const gapMode = sortKey === "gap";
      /* on arrival the ranking's names and columns come in once the bars
         have nearly settled */
      const late = arriving ? dur * 0.7 : 0;
      show(gAxis, i === 3 && !gapMode);
      show(gAxisGap, i === 3 && gapMode);
      show(gRows, i === 3);
      show(gAxis2, i === 6 && !gapMode, late);
      show(gAxisGap2, i === 6 && gapMode, late);
      show(gRows2, i === 6, late);
      if (barsOn && i !== 5 && i !== 7){
        const wantBar = i === 4 ? "tier" : "cx";
        if (barMode !== wantBar){ barMode = wantBar; reBarRank(); drawBars(barListAll, gBarsAll); }
      }
      show(gBarsAll, barsOn && i !== 5 && i !== 7);
      show(gBarsTrad, barsOn && (i === 5 || i === 7));
      /* the names belong to the sector-coloured map: under Ordered by jobs
         the blocks are gone, and under Complexity the colour is not the
         sector's any more, so the labels would be naming the wrong thing */
      /* both map beats name their blocks; the sets differ, so redraw on
         arrival rather than once */
      if (closeMenuRef && !(((i === 4 || i === 0) && view === "alt") || i === 6)) closeMenuRef();
      const cardsOn = i === 4 && view === "map";
      gCards.classed("is-on", cardsOn);
      show(gCards, cardsOn);
      /* a ground the filter empties keeps its width - the tiers' shares are
         the metro's, not the filter's - and says why it is bare */
      gCards.selectAll("g.mi-card-g").each(function(c){
        const g = d3.select(this), k = c.k;
        const bare = secFiltered() && !clusterRows[k].some(secShown);
        g.select(".mi-card-none").text(bare ? "None of the sectors shown" : "");
        g.select(".mi-card-pct").style("opacity", bare ? 0.4 : 1);
        g.select(".mi-card-lab").style("opacity", bare ? 0.4 : 1);
      });
      show(gSecLab, (i === 7 || i === 4 || i === 0) && view === "map" &&
        colorBy === "sector" && nameMode !== "off");
      /* on the reveal section the opening beat rests on the admin bands: the
         cells fade first, the blocks behind them come forward, and the veil
         drops last. Leaving the beat runs the same three in reverse. */
      if (opts.adminReveal && coarseCell){
        const onZero = i === 0;
        /* the coarse map is the beat's own grain: on its beat it splits into
           the two shades, and it steps aside for the finer beats after it */
        if (onZero) placeCoarse(animate, true);
        (dur ? coarseCell.transition().duration(dur / 2) : coarseCell)
          .style("opacity", onZero ? 1 : 0);
        if (dur){
          rects.transition().delay(onZero ? 0 : dur / 4).duration(dur / 2)
            .style("opacity", d => onZero ? 0 : at(d).op);
        } else {
          rects.style("opacity", d => onZero ? 0 : at(d).op);
        }
        rects.style("pointer-events", d => onZero || at(d).op === 0 ? "none" : null);
        labs.style("opacity", onZero ? 0 : null);
      }
      painted = i;
    }

    function setView(v){
      if (v === view) return;
      view = v;
      fig.dataset.view = view;
      const ve = document.getElementById(p + "View");
      if (ve) ve.querySelectorAll(".seg-btn[data-view]").forEach(x => {
        const on = x.dataset.view === view;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
    }

    /* colour by: sector or complexity, on the two map beats. Each beat
       opens on sector, which is what its text describes; the reader changes
       it once there */
    /* the naming study: three options on the same two beats. Switching the
       strip on or off moves the cells, so the beat repaints rather than
       just redrawing the labels. */
    const namesEl = document.getElementById(p + "Names");
    if (namesEl) namesEl.addEventListener("change", () => {
      if (namesEl.value === nameMode) return;
      nameMode = namesEl.value;
      fig.dataset.names = nameMode;
      if (step === 7 || step === 4 || step === 0) paint(step, !reduced());
    });

    /* The tradability tiers, as a filter on the jobs order and on the
       ranking. Ordered by jobs answers "what is biggest"; unchecking a tier
       asks the narrower question the beat is really about - what is the
       biggest work that sells outward - so there all three start checked.
       The ranking starts on the two tradable tiers, which is its question.
       In either place the last one cannot be unchecked, since an empty chart
       answers nothing. */
    const menuEl = document.getElementById(p + "TradMenu");
    if (menuEl){
      /* which head opened it: the jobs order and the ranking keep separate
         tier sets, under the same three words */
      let menuCtx = "bars";
      const ctxOf = g => g && g.classList.contains("is-rank") ? "rank" : "bars";
      const tiersOf = ctx => ctx === "rank" ? tierOn6 : tierOn;
      /* the ranking draws a head in each of its two axis groups, one per
         order, so take the one that is actually showing */
      const headG = () => {
        const all = [].slice.call(el.querySelectorAll("g.mi-tradmenu." + (menuCtx === "rank" ? "is-rank" : "is-bars")));
        const shown = all.filter(g => {
          let n = g; while (n && n !== el){ if (n.nodeType === 1 && +getComputedStyle(n).opacity === 0) return false; n = n.parentNode; }
          return true;
        });
        return shown[0] || all[0] || null;
      };
      const isOpen = () => !menuEl.hidden;
      const closeMenu = () => {
        menuEl.hidden = true;
        el.querySelectorAll("g.mi-tradmenu").forEach(g => {
          g.classList.remove("is-open"); g.setAttribute("aria-expanded", "false");
        });
      };
      syncTierMenu = () => { if (!menuEl.hidden && menuCtx === "bars") syncItems(); };
      const syncItems = () => {
        const on = tiersOf(menuCtx);
        menuEl.querySelectorAll(".tm-item[data-tier]").forEach(b => {
          const k = +b.dataset.tier;
          b.classList.toggle("is-on", !!on[k]);
          b.setAttribute("aria-pressed", String(!!on[k]));
        });
      };
      const openMenu = () => {
        const g = headG(); if (!g) return;
        syncItems();
        const host = el.parentNode;                       /* the viz wrapper */
        const hb = g.getBoundingClientRect(), pb = host.getBoundingClientRect();
        menuEl.hidden = false;
        /* under the head, right edges together, and never off the wrapper */
        const mw = menuEl.offsetWidth;
        let left = hb.right - pb.left - mw;
        left = Math.max(4, Math.min(left, pb.width - mw - 4));
        menuEl.style.left = left + "px";
        menuEl.style.top = (hb.bottom - pb.top + 6) + "px";
        g.classList.add("is-open");
        g.setAttribute("aria-expanded", "true");
      };
      /* the head is redrawn whenever the filter moves, so the click is caught
         on the figure rather than bound to a node that will not survive */
      const toggleFrom = g => {
        const ctx = ctxOf(g);
        if (isOpen() && ctx === menuCtx){ closeMenu(); return; }
        closeMenu(); menuCtx = ctx; openMenu();
      };
      el.addEventListener("click", ev => {
        const g = ev.target.closest && ev.target.closest("g.mi-tradmenu");
        if (g) toggleFrom(g);
      });
      el.addEventListener("keydown", ev => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const g = ev.target.closest && ev.target.closest("g.mi-tradmenu");
        if (!g) return;
        ev.preventDefault();
        toggleFrom(g);
      });
      menuEl.addEventListener("click", ev => {
        const b = ev.target.closest(".tm-item[data-tier]");
        if (!b) return;
        const k = +b.dataset.tier, on = tiersOf(menuCtx);
        /* an empty chart answers nothing, so the last one stays on. Over the
           bars that is not the last tier but the last tier the sectors on
           screen still have anything in */
        if (menuCtx === "rank"){
          if (on[k] && on.filter(Boolean).length === 1) return;
        } else {
          const probe = on.slice(); probe[k] = !probe[k];
          if (!tierListWith(probe, secOn).length) return;
        }
        on[k] = !on[k];
        b.classList.toggle("is-on", on[k]);
        b.setAttribute("aria-pressed", String(on[k]));
        if (menuCtx === "rank"){
          if (rebuildR2Ref) rebuildR2Ref(!reduced());
        } else {
          /* the map's grounds are these same tiers, so they move together */
          layoutClusters();
          const list = tierList();
          barListAll = list;
          reBarRank();
          drawBars(list, gBarsAll);
          drawCards(!reduced());
          syncTierBack();
          paint(step, !reduced());
        }
        openMenu();                                        /* re-anchor */
      });
      document.addEventListener("click", ev => {
        if (!isOpen()) return;
        if (menuEl.contains(ev.target)) return;
        if (ev.target.closest && ev.target.closest("g.mi-tradmenu")) return;
        closeMenu();
      });
      document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeMenu(); });
      closeMenuRef = closeMenu;
    }

    /* the ranking's own study: tier word (shipped) or score in the
       tradability column. Going to opt-1 also resets the filter, so opt-1 is
       always the ranking over the two tradable tiers alone. */
    const rankOptEl = document.getElementById(p + "RankOpt");
    if (rankOptEl) rankOptEl.addEventListener("change", () => {
      if (rankOptEl.value === rankMode) return;
      rankMode = rankOptEl.value;
      fig.dataset.rank = rankMode;
      tierOn6 = TIER_DEFAULT6();                          /* opt-2 always reopens as shipped */
      if (closeMenuRef) closeMenuRef();
      if (rebuildR2Ref) rebuildR2Ref(!reduced());
    });

    const colorEl = document.getElementById(p + "Color");
    /* the complexity rank and the complexity explainer in the first beat's text */
    const complexityBits = [p + "RankCard", p + "ComplexityInfo"]
      .map(id => document.getElementById(id)).filter(Boolean);
    function setColorBy(c){
      colorBy = c === "complexity" ? "complexity" : "sector";
      fig.dataset.color = colorBy;
      /* the complexity ramp takes the key's slot under the chart, and the key
         is the only way back from a sector filter: rather than strand the
         reader with a filtered map and nothing to undo it, the sectors come
         back as the key leaves */
      if (colorBy === "complexity" && secFiltered() && resetSec) resetSec();
      /* those show only while the first beat is coloured by complexity. They
         are only touched on that beat: showing or hiding them in a beat above
         the reader would shift the page under them. They open and close in
         place, so the centred text re-settles smoothly rather than jumping,
         and while closed they leave the tab order and the reading order */
      if (step === 0 || step < 0) complexityBits.forEach(el => {
        const off = colorBy !== "complexity";
        el.classList.toggle("is-off", off);
        el.setAttribute("aria-hidden", String(off));
        el.inert = off;
      });
      if (colorEl) colorEl.querySelectorAll(".seg-btn[data-color]").forEach(x => {
        const on = x.dataset.color === colorBy;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
    }
    setColorBy(colorBy);
    if (colorEl) colorEl.addEventListener("click", ev => {
      const b = ev.target.closest(".seg-btn[data-color]");
      if (!b || b.dataset.color === colorBy) return;
      setColorBy(b.dataset.color);
      if (step === 7 || step === 4 || step === 0) paint(step, !reduced());
    });

    window[ctlName] = { setStep: function(i){
      i = Math.max(0, Math.min(7, i | 0));
      if (i === step) return;
      /* a phrase left lit must not dim the beat that follows it */
      if (clearHighlight) clearHighlight();
      const first = step < 0;
      step = i;
      fig.dataset.step = String(i);
      /* each map beat opens coloured by sector, as its text describes */
      if (i === 7 || i === 4 || i === 0) setColorBy("sector");
      /* the clusters are a movement between columns, and the ranked bars
         have none: the beat opens as the map however the last one was left */
      if (i === 4) setView("map");
      /* the reveal section opens on the metro's own mix and only then shows
         the city's part of it, so its first beat is played, not painted */
      if (first && i === 0 && opts.adminReveal){ paintMetroFirst(); return; }
      paint(i, !first && !reduced());
    } };

    /* the clusters' furniture: the header's columns and the captions share
       the columns' widths, and the captions carry each cluster's share */
    (function clusterFurniture(){
      const head = document.getElementById(p + "ClusterHead");
      const pct = v => Math.round(v * 100) + "%";
      /* the cluster header's columns moved into the cards, so this is null on
         that beat now - it must not fall back to the head itself, or the
         arrow row gets sized as if it were the three columns */
      const colsEl = head && head.querySelector(".mcl-cols");
      if (colsEl) [].forEach.call(colsEl.children, (c, k) => {
        const pc = c.querySelector(".pct"); if (pc) pc.textContent = "(" + pct(clusterShare[k]) + ")";
      });
      /* the header of the opening frame, which shows the most tradable alone */
      const tradHead = document.getElementById(p + "TradHead");
      if (tradHead){ const pc = tradHead.querySelector(".pct");
        if (pc) pc.textContent = "(" + pct(clusterShare[0] + clusterShare[1]) + " of metro jobs)"; }
      /* each name sits over its own column, so the header is measured from
         the chart rather than from the slot that holds it — the slot runs a
         little wider, and a share of that width would drift the names right */
      function sizeClusterHead(){
        if (!head || !colsEl) return;
        /* only the columns need measuring against the chart. The head itself
           must NOT be given a measured width: this runs while the page is
           still hidden, where the chart measures 0 and the fallback pinned the
           row at 880px against a 620px figure, so the arrow ran off the panel
           and took "Less tradable" with it. */
        const w = el.getBoundingClientRect().width || MI_W, sc = w / MI_W;
        colsEl.style.gap = (CGAP * sc) + "px";
        [].forEach.call(colsEl.children, (c, k) => {
          c.style.flexBasis = (Math.max(36, CW * clusterShare[k]) * sc) + "px";
        });
      }
      sizeClusterHead();
      window.addEventListener("resize", sizeClusterHead);
      /* the second beat's scale: the score runs from 1 on the left to 0 on
         the right, as the map does, each band drawn as wide as its stretch of
         the score, and each named with two of the metro's largest industries
         in it, so 0 and 1 arrive with things the reader already knows */
      const scaleHost = document.getElementById(p + "TradScale");
      if (scaleHost){
        /* only a generic tail is cut ("Restaurants and Other Eating Places"
           reads as "Restaurants"); a name that would lose its meaning in the
           cutting is passed over for the next largest industry instead */
        /* a single word left before the generic tail stands on its own
           ("Restaurants"); a longer one would be left hanging ("Executive
           Legislative"), so that name is kept whole and, being long, gives
           way to the next industry */
        const shortOf = n => {
          const t = n.replace(/ \(.*\)$/, "").trim(), m = t.match(/^(\S+) and Other /);
          return m ? m[1] : t;
        };
        /* each tier's two largest industries, by name */
        const examples = k => clusterRows[k].slice().sort((a, b) => b.employ - a.employ)
          .map(d => shortOf(d.name)).filter(t => t.length <= 30).slice(0, 2).join(", ");
        const bands = [
          { k: 0, name: TIER_NAMES[0], tone: "#255862" },
          { k: 1, name: TIER_NAMES[1], tone: "#59838c" },
          { k: 2, name: TIER_NAMES[2], tone: "#b9ccd0" }
        ];
        /* the score is not shown anywhere any more, so the key says only
           what the chart cannot: the three tiers by name, each with two of
           the metro's own industries from inside it */
        scaleHost.innerHTML =
          '<span class="ts-rows">' + bands.map(b =>
            '<span class="ts-row"><i style="background:' + b.tone + '"></i><span>' +
            '<span class="ts-name">' + b.name + '</span>' +
            '<span class="ts-eg">e.g. ' + examples(b.k) + '</span></span></span>').join("") + '</span>';
        scaleHost.hidden = false;

        /* The tier study's second option, which ships. The shares leave the
           grounds for a donut beside the lede, so the chart carries the
           tier's name alone; each tier, hovered or focused, names its three
           largest industries with their jobs. opt-1 keeps the earlier beat:
           the share on each ground, and the key of names and examples. */
        const donutHost = document.getElementById(p + "TierDonut");
        const tierOptEl = document.getElementById(p + "TierOpt");
        let clearTierHot = () => {};
        if (donutHost){
          /* a small ring: the list beside it carries the reading, so the ring
             only has to show the three parts and their order */
          const R = 34, RI = 23, SZ = R * 2 + 2;
          const jobsOf = n => Math.round(n).toLocaleString();
          const tierJobs = k => d3.sum(clusterRows[k], d => d.employ);
          const labelOf = d => shortLabel(d.name) || shortOf(d.name);
          const largest = k => clusterRows[k].slice().sort((a, b) => b.employ - a.employ).slice(0, 3);
          donutHost.innerHTML =
            '<svg class="tdn-ring" width="' + SZ + '" height="' + SZ + '" viewBox="0 0 ' + SZ + ' ' + SZ +
              '" role="img" aria-label="Share of metro jobs in each tradability tier"></svg>' +
            '<div class="tdn-rows">' + bands.map(b =>
              '<button type="button" class="tdn-row" data-tier="' + b.k + '" aria-describedby="' + p + 'TierTip">' +
              '<i style="background:' + b.tone + '"></i><b>' + b.name + '</b>' +
              '<span class="tdn-pct">' + pct(clusterShare[b.k]) + '</span></button>').join("") + '</div>' +
            /* the rows describe themselves by the card, so a reader who
               cannot see it still gets the tier's largest industries */
            '<div class="tdn-tip" id="' + p + 'TierTip" hidden></div>';
          const ring = d3.select(donutHost).select("svg.tdn-ring").append("g")
            .attr("transform", "translate(" + SZ / 2 + "," + SZ / 2 + ")");
          /* a thin ring, in the order the grounds take, with a hairline of
             ground between the segments */
          const arcs = d3.pie().sort(null).value(d => clusterShare[d.k]).padAngle(0.014)(bands);
          const arc = d3.arc().innerRadius(RI).outerRadius(R);
          ring.selectAll("path.tdn-arc").data(arcs).join("path")
            .attr("class", "tdn-arc").attr("data-tier", d => d.data.k)
            .attr("d", arc).attr("fill", d => d.data.tone);
          const tipEl = donutHost.querySelector(".tdn-tip");
          /* the pointer, the keyboard and a press each hold their own tier,
             the pointer's first; the card is rebuilt only when the shown
             tier changes, so crossing a row's parts does not rebuild it */
          let hoverK = null, focusK = null, pinK = null, shownK = null;
          const hot = k => {
            if (k === shownK) return;
            shownK = k;
            donutHost.classList.toggle("is-hot", k != null);
            donutHost.querySelectorAll("[data-tier]").forEach(n =>
              n.classList.toggle("is-hot", k != null && +n.getAttribute("data-tier") === k));
            if (k == null){ tipEl.hidden = true; return; }
            const b = bands[k], n = clusterRows[k].length;
            tipEl.innerHTML =
              '<div class="tdn-head"><b>' + b.name + '</b><span>' + pct(clusterShare[k]) +
                ' of metro jobs \u00b7 ' + jobsOf(tierJobs(k)) + ' jobs</span></div>' +
              '<ul class="tdn-list">' + largest(k).map(d =>
                '<li><span>' + labelOf(d) + '</span><span>' + jobsOf(d.employ) + '</span></li>').join("") + '</ul>' +
              '<p class="tdn-note">The three largest of the ' + n + ' industries in the tier</p>';
            tipEl.hidden = false;
          };
          const apply = () => hot(hoverK != null ? hoverK : focusK != null ? focusK : pinK);
          const putAway = () => { hoverK = focusK = pinK = null; apply(); };
          const tierAt = ev => { const t = ev.target.closest && ev.target.closest("[data-tier]"); return t ? +t.getAttribute("data-tier") : null; };
          donutHost.addEventListener("mouseover", ev => { const k = tierAt(ev); if (k != null){ hoverK = k; apply(); } });
          donutHost.addEventListener("mouseleave", () => { hoverK = null; apply(); });
          donutHost.addEventListener("focusin", ev => { const k = tierAt(ev); if (k != null){ focusK = k; apply(); } });
          donutHost.addEventListener("focusout", ev => { if (!donutHost.contains(ev.relatedTarget)){ focusK = null; apply(); } });
          /* a press on a row opens its card and holds it, and a second press
             puts it away - the path a touch has, since touch sends no
             mouseleave, and a keyboard's way to dismiss without leaving */
          donutHost.addEventListener("click", ev => {
            const k = tierAt(ev); if (k == null) return;
            if (shownK === k) putAway(); else { pinK = k; apply(); }
          });
          /* a tap elsewhere, or Escape, puts the card away */
          document.addEventListener("pointerdown", ev => {
            if (shownK != null && !donutHost.contains(ev.target)) putAway();
          });
          document.addEventListener("keydown", ev => { if (ev.key === "Escape" && shownK != null) putAway(); });
          clearTierHot = putAway;
        }
        /* the switch between the two: the share on the grounds and the key,
           or the name alone on the grounds and the donut */
        const setTierOpt = mode => {
          const donut = mode === "donut";
          fig.dataset.tier = donut ? "donut" : "cards";
          scaleHost.hidden = donut;
          if (donutHost) donutHost.hidden = !donut;
          clearTierHot();
          /* the name keeps its place on the band either way now; only the
             share stands down when the donut carries the shares */
          if (tierOptEl) tierOptEl.value = donut ? "donut" : "cards";
        };
        setTierOpt("donut");
        if (tierOptEl) tierOptEl.addEventListener("change", () => setTierOpt(tierOptEl.value));
      }
    })();

    /* the coarse map, laid out for whichever arrangement is chosen. `split`
       says whether the blocks are showing their two shades yet. */
    function placeCoarse(animate, split){
      if (!coarseCell) return;
      const at = d => (view === "alt" ? posCoarseFlat : posCoarse).get(d.name);
      const pale = sec => d3.interpolateRgb(sectorColors[sec] || "#ccc", "#ffffff")(0.66);
      const dur = animate ? 900 : 0;

      const r = coarseCell.select(".mi-rect");
      (dur ? r.transition().duration(dur).ease(d3.easeCubicInOut) : r)
        .attr("x", d => at(d).x).attr("y", d => at(d).y)
        .attr("width", d => at(d).w).attr("height", d => at(d).h)
        .attr("fill", d => split ? pale(d.sector) : (sectorColors[d.sector] || "#ccc"));

      /* the city's band grows up from the foot of its own block */
      const band = coarseCell.select(".mi-share")
        .attr("x", d => at(d).x).attr("width", d => at(d).w);
      (dur ? band.transition().delay(split ? dur * 0.35 : 0).duration(dur * 0.65)
                 .ease(d3.easeCubicInOut) : band)
        .attr("y", d => at(d).y + at(d).h * (split ? 1 - coarseShare(d) : 1))
        .attr("height", d => split ? at(d).h * coarseShare(d) : 0);

      const t = coarseCell.select(".mi-lab");
      t.attr("x", d => at(d).x + 5).attr("y", d => at(d).y + 13)
        .text(d => fitLabel(d.name, { width: at(d).w, height: at(d).h }));
      (dur ? t.transition().delay(dur / 2).duration(dur / 2) : t).style("opacity", 1);

      const pct = coarseCell.select(".mi-share-pct");
      pct.attr("x", d => at(d).x + 6).attr("y", d => at(d).y + at(d).h - 7);
      (dur ? pct.transition().delay(split ? dur * 0.8 : 0).duration(dur * 0.4) : pct)
        .style("opacity", split ? 1 : 0);
    }

    /* the opening frame of the reveal: the metro's mix at the coarse grain,
       with the sector blocks and the veil still to come. The reveal waits for
       the figure to be on screen, and plays again on every return. */
    function paintMetroFirst(){
      placeCoarse(false, false);
      coarseCell.style("opacity", 1);
      cell.select(".mi-rect").style("opacity", 0);
      cell.select(".mi-lab").style("opacity", 0); cell.select(".mi-pct").style("opacity", 0);
    }
    if (opts.adminReveal){
      let played = false;
      const play = () => {
        if (played || step !== 0) return;
        played = true;
        paint(0, !reduced());
      };
      if (window.IntersectionObserver){
        new IntersectionObserver(es => es.forEach(e => {
          if (e.isIntersecting) setTimeout(play, 420);
          else played = false;            // leaving arms it to play again
        }), { threshold: 0.35 }).observe(el);
      } else {
        setTimeout(play, 600);
      }
    }

    /* ---- the sector key, which is also the map's filter ----
       In the order the map is biggest-first. Each entry is a button: it
       says what its colour means, tells the sector's figures on hover, and
       takes its sector out of the map or leaves only it. */
    const key = document.getElementById(p + "SectorKey");
    if (key){
      const jobs = {}, trad = {}, inds = {};
      industryData.forEach(d => {
        jobs[d.sector] = (jobs[d.sector] || 0) + d.employ;
        inds[d.sector] = (inds[d.sector] || 0) + 1;
      });
      tradRows.forEach(d => { trad[d.sector] = (trad[d.sector] || 0) + d.employ; });
      const tot = Object.values(jobs).reduce((x, y) => x + y, 0) || 1;
      const totTrad = Object.values(trad).reduce((x, y) => x + y, 0) || 1;
      const order = Object.keys(jobs).sort((x, y) => jobs[y] - jobs[x]);
      /* two shares per sector: of every metro job, and of the jobs that sell
         outward at all, for the beat whose map shows only those */
      key.innerHTML = order.map((sec, i) =>
        '<button type="button" class="sk-sec' + (trad[sec] ? '' : ' sk-no-trad') +
        '" data-si="' + i + '" aria-pressed="true" style="--sw:' + (sectorColors[sec] || "#ccc") + '">' +
        '<i class="sk-sw"></i><span class="sk-name">' + sec + '</span>' +
        ' <span class="sk-share sk-all">' + Math.round(jobs[sec] / tot * 100) + '%</span>' +
        '<span class="sk-share sk-trad">' + Math.round((trad[sec] || 0) / totTrad * 100) + '%</span></button>').join("") +
        '<button type="button" class="sk-reset" hidden>Show all sectors</button>';
      const resetBtn = key.querySelector(".sk-reset");
      /* the card rides over the whole figure, so it can stand clear of the
         key's own line. It carries the sector's figures and, under them,
         what can be done with it: a card that follows the cursor cannot
         hold a button the reader is meant to reach, so this one anchors to
         the entry it belongs to while the cell cards keep following. */
      const tipEl = document.createElement("div");
      tipEl.className = "sk-tip";
      tipEl.hidden = true;
      fig.appendChild(tipEl);
      const items = [].slice.call(key.querySelectorAll(".sk-sec"));
      const allHeadTitle = document.querySelector("#" + p + "AllHead .mcl-dir");
      const headDefault = allHeadTitle ? allHeadTitle.textContent : "";
      /* the key says which sectors are in play, and the reset appears only
         when there is something to go back from */
      function syncKey(){
        items.forEach((b, i) => {
          const on = !secOn || secOn.has(order[i]);
          b.classList.toggle("is-off", !on);
          b.setAttribute("aria-pressed", String(on));
        });
        if (resetBtn) resetBtn.hidden = !secFiltered();
        /* the chart's own title must not still say every industry while the
           map is showing some of them */
        if (allHeadTitle) allHeadTitle.textContent = !secOn ? headDefault
          : secOn.size === 1 ? [...secOn][0]
          : secOn.size + " of " + order.length + " sectors";
      }
      /* the filter moves the map, the names on it and the bars beside it */
      function applySec(next){
        if (next && !next.size) return;                 /* an empty map answers nothing */
        secOn = (next && next.size === order.length) ? null : next;
        rebuildSecGeo();
        barListAll = tierList();
        reBarRank();
        drawBars(barListAll, gBarsAll);
        syncKey();
        if (step >= 0) paint(step, !reduced());
      }
      resetSec = () => applySec(null);
      const allSet = () => new Set(order);

      /* ---- the card, which is also this entry's menu ---- */
      let openFor = null, closeT = null;
      const holdOpen = () => clearTimeout(closeT);
      /* the pointer has to be able to travel from the entry to the card, so
         leaving either one only arms the close */
      const armClose = () => { clearTimeout(closeT); closeT = setTimeout(hideTip, 180); };
      function hideTip(){
        clearTimeout(closeT); openFor = null; tipEl.hidden = true;
        items.forEach(x => x.classList.remove("is-open"));
      }
      function showTip(b){
        const i = +b.dataset.si, sec = order[i];
        const shown = !secOn || secOn.has(sec);
        const solo = !!(secOn && secOn.size === 1 && secOn.has(sec));
        openFor = b;
        /* what can be done with this sector, in the state it is in: the only
           sector on the map cannot be hidden, so it is offered the way back
           instead of a click that would be refused */
        const acts = solo
          ? [["all", "Show all sectors"]]
          : shown
            ? [["hide", "Hide"], ["only", "Keep only"]]
            : [["show", "Bring back"], ["only", "Keep only"]];
        tipEl.innerHTML =
          '<b>' + sec + '</b>' +
          '<span class="skt-row"><span>Jobs</span><span>' + Math.round(jobs[sec]).toLocaleString() + '</span></span>' +
          '<span class="skt-row"><span>Share of metro jobs</span><span>' +
            (jobs[sec] / tot * 100).toFixed(1) + '%</span></span>' +
          '<span class="skt-row"><span>Industries</span><span>' + inds[sec] + '</span></span>' +
          '<span class="skt-acts">' + acts.map(a =>
            '<button type="button" class="skt-btn" data-act="' + a[0] + '">' + a[1] + '</button>').join("") +
          '</span>';
        tipEl.hidden = false;
        items.forEach(x => x.classList.toggle("is-open", x === b));
        /* clear of the WHOLE key, not just of the entry it belongs to: the
           key wraps, and a card that cleared only its own entry sat over the
           row above and took every hover meant for it. Centred on the entry
           so it still says which one it belongs to, and the entry is lit
           while it is open. */
        const fb = fig.getBoundingClientRect(), bb = b.getBoundingClientRect();
        const kb = key.getBoundingClientRect();
        const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
        let left = bb.left - fb.left + bb.width / 2 - w / 2;
        tipEl.style.left = Math.max(0, Math.min(left, Math.max(0, fb.width - w))) + "px";
        tipEl.style.top = Math.max(0, kb.top - fb.top - h - 8) + "px";
      }
      /* the actions live in the card, so there is one place they are done
         from and the keyboard can reach every one of them */
      tipEl.addEventListener("click", ev => {
        const a = ev.target.closest(".skt-btn");
        if (!a || !openFor) return;
        const b = openFor, sec = order[+b.dataset.si];
        if (a.dataset.act === "all") applySec(null);
        else if (a.dataset.act === "only") applySec(new Set([sec]));
        else {
          const next = secOn ? new Set(secOn) : allSet();
          if (a.dataset.act === "hide") next.delete(sec); else next.add(sec);
          applySec(next);
        }
        showTip(b);                                     /* the card follows the change */
        b.focus();
      });
      tipEl.addEventListener("mouseenter", holdOpen);
      tipEl.addEventListener("mouseleave", armClose);
      key.addEventListener("click", ev => {
        if (ev.target.closest(".sk-reset")){ applySec(null); hideTip(); return; }
        /* a click opens the card too, which is how a touch reaches it */
        const b = ev.target.closest(".sk-sec");
        if (b){ holdOpen(); showTip(b); }
      });
      items.forEach(b => {
        b.addEventListener("mouseenter", () => { holdOpen(); showTip(b); });
        b.addEventListener("focus", () => { holdOpen(); showTip(b); });
        b.addEventListener("mouseleave", armClose);
        /* the card sits elsewhere in the page's order, so the keyboard is
           given a way in: enter, space or down opens it and steps inside */
        b.addEventListener("keydown", ev => {
          if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "ArrowDown") return;
          ev.preventDefault();
          holdOpen(); showTip(b);
          const first = tipEl.querySelector(".skt-btn");
          if (first) first.focus();
        });
      });
      /* and a way back out to the entry it belongs to */
      tipEl.addEventListener("keydown", ev => {
        if (ev.key !== "Escape") return;
        const b = openFor;
        hideTip();
        if (b) b.focus();
      });
      key.addEventListener("focusout", ev => {
        if (!ev.relatedTarget || (!key.contains(ev.relatedTarget) && !tipEl.contains(ev.relatedTarget))) armClose();
      });
      document.addEventListener("keydown", ev => { if (ev.key === "Escape") hideTip(); });
      syncKey();
    }

    /* ---- the tooltip, reading whatever the figure is currently showing ----
       The same cells mean different things state to state, so the card names
       the measure in play rather than always reciting jobs. */
    const wrap = el.closest(".tradable-viz-wrapper");
    const tip = document.getElementById(p + "Tip");
    if (wrap && tip){
      const cellOf = (k, v) => '<dt>' + k + '</dt><dd>' + v + '</dd>';
      const pct = v => v.toFixed(2) + "%";
      /* the number the ranking is ordered by, given the size it is ordered by */
      const tipLead = r => '<div class="tip-lead"><b>' + r.rca.toFixed(1) +
        '\u00d7</b><span>more concentrated here than in<br>a typical US metro</span></div>';
      /* complexity reads the same here as it does in the chart's own column -
         the five steps - with the score beside them, since a card has room
         for the number the column has no space to carry */
      const cxCell = name => {
        if (pciByName.get(name) == null)
          return '<dd class="tip-cx-cell"><em>not measured</em></dd>';
        const on = cxBin(name);
        let dots = '<span class="tip-cx" aria-hidden="true">';
        for (let k = 0; k < 5; k++) dots += '<i' + (k <= on ? ' class="is-on"' : '') + '></i>';
        return '<dd class="tip-cx-cell">' + dots + '</span>' +
          '<span class="tip-cx-val">' + pciNumOf(name).toFixed(2) + '</span>' +
          '<span class="tip-sr">step ' + (on + 1) + ' of 5, ' + CX_WORDS[on] + '</span></dd>';
      };
      let hot = null, hotRow = null;
      const cool = () => {
        tip.hidden = true;
        hiRect.style("opacity", 0);
        if (hotRow){ hotRow.classList.remove("is-hot"); hotRow = null; }
        if (hot) d3.select(hot).style("stroke", "#1a2226").style("stroke", null).style("stroke-width", null);
        hot = null;
      };
      d3.select(el).on("mouseleave.mitip", cool);
      cell.on("mouseenter", function(ev, d){
        cool();
        const r = this.querySelector(".mi-rect");
        hot = r;
        /* one card, whatever the figure is showing: the industry says the
           same things about itself on every beat, and a reader who learned
           where to look on one beat finds it in the same place on the next.
           The beat only adds - the ranking puts its own reading on top. */
        const rrow = step === 6 ? d.row2 : d.row;
        const onRank = (step === 3 || step === 6) && !!rrow;
        const body = (onRank ? tipLead(rrow) : "") +
          '<dl class="tip-grid">' +
          cellOf("Jobs", Math.round(d.employ).toLocaleString()) +
          cellOf("Share of metro jobs", pct(d.employ / jobsTotal * 100)) +
          '<dt>Complexity</dt>' + cxCell(d.name) +
          cellOf("Tradability", tierLabel(d)) +
          (onRank ? cellOf("Peer metros average", rrow.peerAvg.toFixed(1) + "\u00d7") : "") +
          '</dl>';
        const labRow = rrow;
        const rank = (step === 6 && R2.rankIdx.has(d.name) && R2.rankIdx.get(d.name) < 3)
          ? '<span class="tip-rank">' + (R2.rankIdx.get(d.name) + 1) + '</span>' : '';
        /* the sector belongs on every card: it is what the colour under the
           cursor means, and on the ranking it is the one thing the row does
           not already say */
        const head = '<div class="tip-head"><strong>' + rank +
          (labRow ? labRow.label : d.name) + '</strong>' +
          '<span class="tip-sector"><i style="background:' + sectorColors[d.sector] + '"></i>' +
          d.sector + '</span></div>';
        tip.innerHTML = head + body;
        tip.hidden = false;
        cursorTipPos(ev, wrap, tip);
        this.parentNode.appendChild(this);          // hovered mark to the front
        d3.select(r).style("stroke", "#1a2226").style("stroke-width", 2.5);
        /* coming in off the bar rather than the band, light the band anyway */
        if (!hotRow && (step === 3 || step === 6)){
          const R = step === 6 ? R2 : R1;
          const g = R && R.row && R.row.filter(x => x.name === d.name).node();
          if (g){
            hotRow = g; g.classList.add("is-hot");
            hiRect.attr("y", rowY(R.pos.get(d.name)) - RH / 2).style("opacity", 1);
          }
        }
      })
      .on("mousemove", function(ev){ cursorTipPos(ev, wrap, tip); })
      .on("mouseleave", cool);

      /* the prose points at the chart. A phrase in the lede naming a sector
         stands the rest of the mix down, so the reader does not have to
         translate "manufacturing" into a colour before they can find it.
         Hover and focus for pointer and keyboard; click as well, because a
         phone has no hover and the reference this follows forgets that. */
      const hlSpans = [].slice.call(document.querySelectorAll(".mi-hl"));
      hlSpansRef = hlSpans;
      /* each beat points at what it is about: the mix beat names sectors, the
         tradability beat names one of the three clusters, and the ranking
         names industries outright */
      const hlRows = () => [R1, R2].filter(R => R && R.row);
      const clearHl = () => {
        cell.classed("is-dim", false).classed("is-mute", false);
        /* a muted label was repainted, so it is put back in the ink the cell
           wrote it in rather than guessed at */
        cell.selectAll(".mi-lab,.mi-pct")
          .style("fill", function(){ return this.getAttribute("data-ink"); });
        gHlFrame.selectAll("rect").remove();
        hlRows().forEach(R => R.row.classed("is-lit", false));
        gLit.selectAll("rect").remove();
        hlSpans.forEach(x => x.classList.remove("is-lit"));
      };
      /* where a sector's own block is on the beat showing: one block on the
         whole mix, one per tier on the clusters. Nothing outside the maps -
         under the bars a sector is scattered down the rows, and a frame
         round scattered rows is not a frame */
      const hlSectorBoxes = want => {
        if (view !== "map") return [];
        const above = nameMode === "above";
        if (step === 0){
          const src = secGeo ? (above ? secGeo.secA : secGeo.secB)
                             : (above ? secFullA : secFullB);
          return want.map(n => src.get(n)).filter(Boolean);
        }
        if (step === 4 || step === 7){
          const src = step === 4 ? (above ? secClusterA : secClusterB) : null;
          if (!src) return want.map(n =>
            (secGeo ? (above ? secGeo.tradSecA : secGeo.tradSecB)
                    : (above ? secTradA : secTradB)).get(n)).filter(Boolean);
          const out = [];
          src.forEach((v, k) => { if (want.indexOf(v.name) >= 0) out.push(v.b); });
          return out;
        }
        return [];
      };
      /* the rest of the mix turns to one grey rather than fading away: every
         block keeps its place and its size, and colour alone says which is
         the one being named */
      const muteOthers = want => {
        const off = d => want.indexOf(d.sector) < 0;
        cell.classed("is-mute", off);
        cell.filter(off).selectAll(".mi-lab,.mi-pct").style("fill", "#9aa3a6");
      };
      const hlStep = span => span.dataset.on || "0";
      /* the band behind a lit row has to be drawn under the cells, since the
         ranking's rows paint over them - the same reason the hover band lives
         in this layer */
      const litBands = (R, keep) => {
        const ys = [];
        R.row.each(function(d){
          if (!keep.has(d.name)) return;
          const m = /translate\(0,\s*([-\d.]+)\)/.exec(this.getAttribute("transform") || "");
          if (m) ys.push(+m[1]);
        });
        gLit.selectAll("rect").data(ys).join("rect")
          .attr("x", 0).attr("width", MI_W).attr("height", RH).attr("y", y => y - RH / 2);
      };
      const litHl = span => {
        const ds = span.dataset;
        if (ds.sector){
          const want = ds.sector.split("|").filter(n => !secOn || secOn.has(n));
          /* the sector the phrase names is off the map: there is nothing to
             point at, and dimming or greying every cell would say there is */
          if (!want.length){ span.classList.add("is-lit"); return; }
          if (hlMode === "dim"){
            cell.classed("is-dim", d => want.indexOf(d.sector) < 0);
          } else if (hlMode === "mute"){
            muteOthers(want);
          } else {
            /* the frame leaves the mix exactly as it was and draws a line
               round the block being named; where there is no block to draw
               round, the rest turns grey instead */
            const boxes = hlSectorBoxes(want);
            if (boxes.length) gHlFrame.selectAll("rect").data(boxes).join("rect")
              .attr("class", "mi-hlframe")
              .attr("x", b => b.x).attr("y", b => b.y)
              .attr("width", b => b.w).attr("height", b => b.h);
            else muteOthers(want);
          }
        } else if (ds.ind){
          /* the ranking lights what is named instead, and leaves the rest alone */
          const keep = new Set(ds.ind.split("|"));
          const R = hlStep(span) === "3" ? R1 : R2;
          if (R && R.row){ litBands(R, keep); R.row.classed("is-lit", d => keep.has(d.name)); }
        }
        span.classList.add("is-lit");
      };
      hlSpans.forEach(span => {
        const on = () => { if (fig.dataset.step !== hlStep(span)) return; clearHl(); litHl(span); };
        span.addEventListener("mouseenter", on);
        span.addEventListener("focus", on);
        span.addEventListener("mouseleave", clearHl);
        span.addEventListener("blur", clearHl);
        span.addEventListener("click", () => {
          if (span.classList.contains("is-lit")) clearHl(); else on();
        });
      });
      /* leaving the beat must not leave the mix half dimmed */
      clearHighlight = clearHl;

      /* the ranking rows carry the same card, raised from the row rather than
         the bar — hovering a name or a jobs count is hovering the industry */
      function wireRows(R){
        if (!R || !R.row) return;
        R.row.style("cursor", "default")
          .on("mouseenter.mirow", function(ev, d){
            /* the cell's handler opens with cool(), so the band has to be lit
               after it has run, not before — and it lights a row of its own,
               which this one replaces */
            const cellG = cell.filter(c => c.name === d.name).node();
            if (cellG) cellG.dispatchEvent(new MouseEvent("mouseenter"));
            else cool();
            if (hotRow) hotRow.classList.remove("is-hot");
            hotRow = this;
            this.classList.add("is-hot");
            hiRect.attr("y", rowY(R.pos.get(d.name)) - RH / 2).style("opacity", 1);
          })
          .on("mousemove.mirow", function(ev){ cursorTipPos(ev, wrap, tip); })
          .on("mouseleave.mirow", cool);
      }
      wireRows(R1); wireRows(R2);
      wireRowsRef = wireRows;
    }

    /* a study control: three ways for a phrase in the text to point at a
       sector on the map - stand the rest down, turn the rest grey, or draw a
       line round the block being named */
    const hlOptEl = document.getElementById(p + "HlOpt");
    if (hlOptEl) hlOptEl.addEventListener("change", () => {
      if (hlOptEl.value === hlMode) return;
      const lit = hlSpansRef && hlSpansRef.find(x => x.classList.contains("is-lit"));
      if (clearHighlight) clearHighlight();
      hlMode = hlOptEl.value;
      fig.dataset.hl = hlMode;
      /* a phrase left lit shows the new treatment at once */
      if (lit) lit.dispatchEvent(new MouseEvent("mouseenter"));
    });

    /* one word in the head carries every study: it opens a panel of plain
       dropdowns rather than lining four sets of buttons along the row */
    const studies = document.getElementById(p + "Studies");
    if (studies){
      const sBtn = studies.querySelector(".mi-studies-btn");
      const sPanel = studies.querySelector(".mi-studies-panel");
      const setOpen = on => {
        sPanel.hidden = !on;
        sBtn.setAttribute("aria-expanded", String(on));
      };
      sBtn.addEventListener("click", () => setOpen(sPanel.hidden));
      document.addEventListener("click", ev => {
        if (!sPanel.hidden && !studies.contains(ev.target)) setOpen(false);
      });
      document.addEventListener("keydown", ev => { if (ev.key === "Escape") setOpen(false); });
    }

    /* the bars' order: the same bars, re-sorted. The set does not change,
       so the reader keeps the metro's biggest industries in view either way */
    const barSortEl = document.getElementById(p + "BarSort");
    if (barSortEl) barSortEl.addEventListener("click", ev => {
      const b = ev.target.closest(".seg-btn[data-barsort]");
      if (!b || b.dataset.barsort === barSort) return;
      barSort = b.dataset.barsort;
      barSortEl.querySelectorAll(".seg-btn[data-barsort]").forEach(x => {
        const on = x.dataset.barsort === barSort;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      reBarRank();
      drawBars(barListAll, gBarsAll);
      paint(step, !reduced());
    });

    /* the arrangement control belongs to the two beats that show the whole
       mix; switching it repaints the beat in place */
    const viewEl = document.getElementById(p + "View");
    if (viewEl) viewEl.addEventListener("click", ev => {
      const b = ev.target.closest(".seg-btn[data-view]");
      if (!b || b.dataset.view === view) return;
      view = b.dataset.view;
      fig.dataset.view = view;
      viewEl.querySelectorAll(".seg-btn[data-view]").forEach(x => {
        const on = x.dataset.view === view;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      if (opts.adminReveal && step === 0){ placeCoarse(!reduced(), true); return; }
      if (step === 0 || step === 1 || step === 4 || step === 5 || step === 7) paint(step, !reduced());
    });

    /* sort: the same rows in another order, bars and names travelling together */
    const sortEl = document.getElementById(p + "Sort");
    if (sortEl) sortEl.addEventListener("click", ev => {
      /* the opt-1/opt-2 study shares this row and this button class: a click
         on it must not read as a sort with no key, which cleared every sort
         button's selected state and hid the brace */
      const b = ev.target.closest(".seg-btn[data-sort]");
      if (!b || b.dataset.sort === sortKey) return;
      sortKey = b.dataset.sort;
      fig.dataset.sort = sortKey;
      sortEl.querySelectorAll(".seg-btn").forEach(x => {
        const on = x.dataset.sort === sortKey;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      reorder(R1); reorder(R2);
      const anim = !reduced();
      placeRanking(R1, anim); placeRanking(R2, anim);
      if (step === 3 || step === 6) paint(step, anim);
    });

    /* the section may have mounted before this figure existed, in which
       case the beat it settled on is waiting on the figure: open there, not
       on state 0, or the first beat shows a state its controls do not drive */
    window[ctlName].setStep(fig.dataset.wantStep != null ? +fig.dataset.wantStep : 0);
  }

  function initExportTooltip(){
    const svgEl = document.getElementById("exportTreemapSvg");
    const tip = document.getElementById("exportTip");
    const wrap = document.querySelector(".export-viz-row");
    if (!svgEl || !tip || !wrap) return;
    exportClearHover = attachCellTip(svgEl, wrap, tip);
  }

  function initTradableTooltip(){
    const svgEl = document.getElementById("tradableAnimatedSvg");
    const tip = document.getElementById("tradableTip");
    const wrap = document.querySelector(".tradable-viz-wrapper");
    if (!svgEl || !tip || !wrap) return;
    tradableClearHover = attachCellTip(svgEl, wrap, tip);
  }


  function initExportOptions(){
    /* the numbered design list is gone from the bar — the section ships on
       option 2 alone — so the wiring no longer depends on finding it */
    const btns = document.querySelectorAll("#exportOptList .design-opt");
    btns.forEach(b => b.addEventListener("click", () => {
      const n = +b.dataset.opt;
      exportOpt = (exportOpt === n) ? 0 : n;
      exportView = "map";                       /* every option opens on the treemap */
      exportListOn = false;                     /* the list is always opt-in */
      btns.forEach(x => x.classList.toggle("is-on", +x.dataset.opt === exportOpt));
      updateExportViewSeg();
      updateTopBtn();
      updateExportOptCtl();
      applyExportOption(true);
    }));
    const topBtn = document.getElementById("exportTopBtn");
    if (topBtn) topBtn.addEventListener("click", () => {
      exportListOn = !exportListOn;
      updateTopBtn();
      applyExportOption(true);
    });

    /* option 2 is the section's default: its View toggle sits on the bar
       from the start, with the treemap still the resting view */
    exportOpt = 2;
    btns.forEach(x => x.classList.toggle("is-on", +x.dataset.opt === 2));
    updateExportViewSeg();
    updateTopBtn();
    updateExportOptCtl();
    applyExportOption(false);
    const wrap = document.getElementById("exportViewWrap");
    if (wrap) wrap.addEventListener("click", e => {
      const b = e.target.closest(".seg-btn");
      if (!b || b.dataset.view === exportView) return;
      exportView = b.dataset.view;
      updateExportViewSeg();
      applyExportOption(true);
    });
  }

  function init(){
    if (typeof d3 === "undefined") return;
    renderStaticTreemap();
    renderComplexityTreemap();
    initComplexityTooltip();
    initTradableAnimation();
    initColorBySegments();
    initExportOptions();
    initExportTooltip();
    initTradableTooltip();
    initLeanMap();
    initCommuteStats();
    updateExportHeadStat();
    initIndustryFigure("mi", industryData, "MI");
    /* Worker Flows now runs its own figure — one set of sector rows
       read three ways — which lives with the section's markup rather than
       here; nothing to build in this file. */
    initRcaChart();
    initPeerChart();
    initRcaViewToggle();
    initPeerCityChips();
    renderMetroScatter();
    renderCityInMetro();
    initDxExplainer();
  }

  window.CityTreemaps = { setColorBy };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
