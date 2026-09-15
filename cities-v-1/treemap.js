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
  const complexityPalette = ["#e4a368","#efc9a5","#f8e7d7","#89ccc7","#029287"];
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

  /* Dummy tradability per industry: a sector prior (manufacturing travels,
     restaurants don't) plus a stable per-name spread, so a cell keeps its
     shade across replays and the ranked views agree with the ramp. */
  const TRADABILITY_PRIOR = {
    "Construction": 0.15, "Education & Health": 0.45,
    "Financial Activities": 0.62, "Leisure & Hospitality": 0.22,
    "Manufacturing": 0.78, "Natural Resources": 0.70,
    "Other": 0.35, "Professional & Business": 0.60,
    "Trade & Transportation": 0.50
  };
  /* Dummy admin share of each sector's metro jobs — downtown-weighted
     sectors run high, land-hungry ones low. One function to swap for real
     place-level (2-digit) employment when it arrives. */
  const ADMIN_SHARE = {
    /* jobs-weighted over the drawn sectors these come to 24% overall —
       the same 24% the key graphic, tooltips and quiz state */
    "Construction": 0.13, "Education & Health": 0.32,
    "Financial Activities": 0.38, "Leisure & Hospitality": 0.25,
    "Manufacturing": 0.08, "Natural Resources": 0.03,
    "Other": 0.19, "Professional & Business": 0.34,
    "Trade & Transportation": 0.16
  };
  const tradByName = new Map();
  let _sectorOf = null;
  function tradabilityOf(name){
    if(!tradByName.has(name)){
      if (!_sectorOf) _sectorOf = new Map(rawData.map(r => [r.name, r.sector]));
      const prior = TRADABILITY_PRIOR[_sectorOf.get(name)] ?? 0.35;
      let h = 2166136261;
      for (const c of name){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
      const jitter = ((h >>> 0) / 4294967296 - 0.5) * 0.5;
      tradByName.set(name, Math.min(0.98, Math.max(0.02, prior + jitter)));
    }
    return tradByName.get(name);
  }

  const colorMode  = { exportTreemapSvg:SECTOR, tradableAnimatedSvg:SECTOR,
                       complexityTreemapSvg:COMPLEXITY };

  /* Which cells are currently on the grey (non-tradable) side, per svg, so a
     later "Color by" change can recolour without losing the split. */
  const splitState = { exportTreemapSvg:null, tradableAnimatedSvg:null };

  function complexityColor(name){
    /* seeded, not random: the complexity map and its headline share must
       read the same on every load */
    if(!complexityByName.has(name)){
      let h = 0;
      for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
      complexityByName.set(name, complexityPalette[h % complexityPalette.length]);
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
    "Manufacturing": "#4f8fa3",
    "Natural Resources": "#7cb342",
    "Other": "#8b7ba8",
    "Professional & Business": "#b94a44",
    "Trade & Transportation": "#e0938a"
  };

  const rawData = [
    {name: "Oilseed and Grain Farming", employ: 49.09, sector: "Natural Resources"},
    {name: "Vegetable and Melon Farming", employ: 110.68, sector: "Natural Resources"},
    {name: "Fruit and Tree Nut Farming", employ: 85.66, sector: "Natural Resources"},
    {name: "Greenhouse Nursery and Floriculture Production", employ: 291.63, sector: "Natural Resources"},
    {name: "Other Crop Farming", employ: 378.25, sector: "Natural Resources"},
    {name: "Cattle Ranching and Farming", employ: 52.94, sector: "Natural Resources"},
    {name: "Hog and Pig Farming", employ: 2.89, sector: "Natural Resources"},
    {name: "Poultry and Egg Production", employ: 25.02, sector: "Natural Resources"},
    {name: "Sheep and Goat Farming", employ: 1.92, sector: "Natural Resources"},
    {name: "Aquaculture", employ: 4.81, sector: "Natural Resources"},
    {name: "Other Animal Production", employ: 106.83, sector: "Natural Resources"},
    {name: "Timber Tract Operations", employ: 0, sector: "Natural Resources"},
    {name: "Forest Nurseries and Gathering of Forest Products", employ: 4.81, sector: "Natural Resources"},
    {name: "Logging", employ: 30.80, sector: "Natural Resources"},
    {name: "Fishing", employ: 0, sector: "Natural Resources"},
    {name: "Hunting and Trapping", employ: 19.25, sector: "Natural Resources"},
    {name: "Support Activities for Crop Production", employ: 208.86, sector: "Natural Resources"},
    {name: "Support Activities for Animal Production", employ: 184.79, sector: "Natural Resources"},
    {name: "Support Activities for Forestry", employ: 16.36, sector: "Natural Resources"},
    {name: "Oil and Gas Extraction", employ: 825.80, sector: "Natural Resources"},
    {name: "Coal Mining", employ: 0.96, sector: "Natural Resources"},
    {name: "Metal Ore Mining", employ: 13.47, sector: "Natural Resources"},
    {name: "Nonmetallic Mineral Mining and Quarrying", employ: 582.30, sector: "Natural Resources"},
    {name: "Support Activities for Mining", employ: 410.98, sector: "Natural Resources"},
    {name: "Electric Power Generation Transmission and Distribution", employ: 6977.92, sector: "Construction"},
    {name: "Natural Gas Distribution", employ: 2561.14, sector: "Construction"},
    {name: "Water Sewage and Other Systems", employ: 469.69, sector: "Construction"},
    {name: "Residential Building Construction", employ: 14355.26, sector: "Construction"},
    {name: "Nonresidential Building Construction", employ: 7606.41, sector: "Construction"},
    {name: "Utility System Construction", employ: 3815.24, sector: "Construction"},
    {name: "Land Subdivision", employ: 3197.33, sector: "Construction"},
    {name: "Highway Street and Bridge Construction", employ: 1515.89, sector: "Construction"},
    {name: "Other Heavy and Civil Engineering Construction", employ: 334.94, sector: "Construction"},
    {name: "Foundation Structure and Building Exterior Contractors", employ: 13510.21, sector: "Construction"},
    {name: "Building Equipment Contractors", employ: 18991.49, sector: "Construction"},
    {name: "Building Finishing Contractors", employ: 7334.03, sector: "Construction"},
    {name: "Other Specialty Trade Contractors", employ: 8368.69, sector: "Construction"},
    {name: "Animal Food Manufacturing", employ: 74.11, sector: "Manufacturing"},
    {name: "Grain and Oilseed Milling", employ: 209.82, sector: "Manufacturing"},
    {name: "Sugar and Confectionery Product Manufacturing", employ: 265.64, sector: "Manufacturing"},
    {name: "Fruit and Vegetable Preserving and Specialty Food Manufacturing", employ: 446.59, sector: "Manufacturing"},
    {name: "Dairy Product Manufacturing", employ: 558.23, sector: "Manufacturing"},
    {name: "Animal Slaughtering and Processing", employ: 768.05, sector: "Manufacturing"},
    {name: "Seafood Product Preparation and Packaging", employ: 19.25, sector: "Manufacturing"},
    {name: "Bakeries and Tortilla Manufacturing", employ: 2905.70, sector: "Manufacturing"},
    {name: "Other Food Manufacturing", employ: 1413.87, sector: "Manufacturing"},
    {name: "Beverage Manufacturing", employ: 2292.61, sector: "Manufacturing"},
    {name: "Tobacco Manufacturing", employ: 21.17, sector: "Manufacturing"},
    {name: "Fiber Yarn and Thread Mills", employ: 23.10, sector: "Manufacturing"},
    {name: "Fabric Mills", employ: 280.08, sector: "Manufacturing"},
    {name: "Textile and Fabric Finishing and Fabric Coating Mills", employ: 88.55, sector: "Manufacturing"},
    {name: "Textile Furnishings Mills", employ: 345.53, sector: "Manufacturing"},
    {name: "Other Textile Product Mills", employ: 1232.93, sector: "Manufacturing"},
    {name: "Apparel Knitting Mills", employ: 72.19, sector: "Manufacturing"},
    {name: "Cut and Sew Apparel Manufacturing", employ: 805.59, sector: "Manufacturing"},
    {name: "Apparel Accessories and Other Apparel Manufacturing", employ: 151.11, sector: "Manufacturing"},
    {name: "Leather and Hide Tanning and Finishing", employ: 45.24, sector: "Manufacturing"},
    {name: "Footwear Manufacturing", employ: 2.89, sector: "Manufacturing"},
    {name: "Other Leather and Allied Product Manufacturing", employ: 107.80, sector: "Manufacturing"},
    {name: "Sawmills and Wood Preservation", employ: 65.45, sector: "Manufacturing"},
    {name: "Veneer Plywood and Engineered Wood Product Manufacturing", employ: 1956.70, sector: "Manufacturing"},
    {name: "Other Wood Product Manufacturing", employ: 2640.06, sector: "Manufacturing"},
    {name: "Pulp Paper and Paperboard Mills", employ: 344.56, sector: "Manufacturing"},
    {name: "Converted Paper Product Manufacturing", employ: 1906.66, sector: "Manufacturing"},
    {name: "Printing and Related Support Activities", employ: 6885.52, sector: "Manufacturing"},
    {name: "Petroleum and Coal Products Manufacturing", employ: 646.78, sector: "Manufacturing"},
    {name: "Basic Chemical Manufacturing", employ: 3774.81, sector: "Manufacturing"},
    {name: "Resin Synthetic Rubber and Artificial and Synthetic Fibers and Filaments Manufacturing", employ: 1385.00, sector: "Manufacturing"},
    {name: "Pesticide Fertilizer and Other Agricultural Chemical Manufacturing", employ: 105.87, sector: "Manufacturing"},
    {name: "Pharmaceutical and Medicine Manufacturing", employ: 1761.32, sector: "Manufacturing"},
    {name: "Paint Coating and Adhesive Manufacturing", employ: 1953.82, sector: "Manufacturing"},
    {name: "Soap Cleaning Compound and Toilet Preparation Manufacturing", employ: 910.50, sector: "Manufacturing"},
    {name: "Other Chemical Product and Preparation Manufacturing", employ: 1310.89, sector: "Manufacturing"},
    {name: "Plastics Product Manufacturing", employ: 16317.74, sector: "Manufacturing"},
    {name: "Rubber Product Manufacturing", employ: 1619.84, sector: "Manufacturing"},
    {name: "Clay Product and Refractory Manufacturing", employ: 185.76, sector: "Manufacturing"},
    {name: "Glass and Glass Product Manufacturing", employ: 2588.09, sector: "Manufacturing"},
    {name: "Cement and Concrete Product Manufacturing", employ: 1207.90, sector: "Manufacturing"},
    {name: "Lime and Gypsum Product Manufacturing", employ: 134.75, sector: "Manufacturing"},
    {name: "Other Nonmetallic Mineral Product Manufacturing", employ: 813.29, sector: "Manufacturing"},
    {name: "Iron and Steel Mills and Ferroalloy Manufacturing", employ: 3398.49, sector: "Manufacturing"},
    {name: "Steel Product Manufacturing from Purchased Steel", employ: 1215.60, sector: "Manufacturing"},
    {name: "Alumina and Aluminum Production and Processing", employ: 842.16, sector: "Manufacturing"},
    {name: "Nonferrous Metal Production and Processing", employ: 244.47, sector: "Manufacturing"},
    {name: "Foundries", employ: 6531.33, sector: "Manufacturing"},
    {name: "Forging and Stamping", employ: 4680.50, sector: "Manufacturing"},
    {name: "Cutlery and Handtool Manufacturing", employ: 605.39, sector: "Manufacturing"},
    {name: "Architectural and Structural Metals Manufacturing", employ: 5461.06, sector: "Manufacturing"},
    {name: "Boiler Tank and Shipping Container Manufacturing", employ: 116.46, sector: "Manufacturing"},
    {name: "Hardware Manufacturing", employ: 519.73, sector: "Manufacturing"},
    {name: "Spring and Wire Product Manufacturing", employ: 2010.60, sector: "Manufacturing"},
    {name: "Machine Shops Turned Product and Screw Nut and Bolt Manufacturing", employ: 9892.28, sector: "Manufacturing"},
    {name: "Coating Engraving Heat Treating and Allied Activities", employ: 5739.22, sector: "Manufacturing"},
    {name: "Other Fabricated Metal Product Manufacturing", employ: 5506.18, sector: "Manufacturing"},
    {name: "Agriculture Construction and Mining Machinery Manufacturing", employ: 722.82, sector: "Manufacturing"},
    {name: "Industrial Machinery Manufacturing", employ: 3048.15, sector: "Manufacturing"},
    {name: "Commercial and Service Industry Machinery Manufacturing", employ: 2340.73, sector: "Manufacturing"},
    {name: "Ventilation Heating Air-Conditioning and Commercial Refrigeration Equipment Manufacturing", employ: 1510.12, sector: "Manufacturing"},
    {name: "Metalworking Machinery Manufacturing", employ: 20544.92, sector: "Manufacturing"},
    {name: "Engine Turbine and Power Transmission Equipment Manufacturing", employ: 5683.39, sector: "Manufacturing"},
    {name: "Other General Purpose Machinery Manufacturing", employ: 9404.31, sector: "Manufacturing"},
    {name: "Computer and Peripheral Equipment Manufacturing", employ: 2603.49, sector: "Manufacturing"},
    {name: "Communications Equipment Manufacturing", employ: 406.16, sector: "Manufacturing"},
    {name: "Audio and Video Equipment Manufacturing", employ: 485.09, sector: "Manufacturing"},
    {name: "Semiconductor and Other Electronic Component Manufacturing", employ: 3767.11, sector: "Manufacturing"},
    {name: "Navigational Measuring Electromedical and Control Instruments Manufacturing", employ: 5314.77, sector: "Manufacturing"},
    {name: "Manufacturing and Reproducing Magnetic and Optical Media", employ: 689.13, sector: "Manufacturing"},
    {name: "Electric Lighting Equipment Manufacturing", employ: 1798.86, sector: "Manufacturing"},
    {name: "Household Appliance Manufacturing", employ: 122.23, sector: "Manufacturing"},
    {name: "Electrical Equipment Manufacturing", employ: 6392.74, sector: "Manufacturing"},
    {name: "Other Electrical Equipment and Component Manufacturing", employ: 2136.69, sector: "Manufacturing"},
    {name: "Motor Vehicle Manufacturing", employ: 26305.31, sector: "Manufacturing"},
    {name: "Motor Vehicle Body and Trailer Manufacturing", employ: 576.52, sector: "Manufacturing"},
    {name: "Motor Vehicle Parts Manufacturing", employ: 61179.72, sector: "Manufacturing"},
    {name: "Aerospace Product and Parts Manufacturing", employ: 2296.46, sector: "Manufacturing"},
    {name: "Railroad Rolling Stock Manufacturing", employ: 64.49, sector: "Manufacturing"},
    {name: "Ship and Boat Building", employ: 34.65, sector: "Manufacturing"},
    {name: "Other Transportation Equipment Manufacturing", employ: 621.76, sector: "Manufacturing"},
    {name: "Household and Institutional Furniture and Kitchen Cabinet Manufacturing", employ: 979.80, sector: "Manufacturing"},
    {name: "Office Furniture Manufacturing", employ: 451.40, sector: "Manufacturing"},
    {name: "Other Furniture Related Product Manufacturing", employ: 307.03, sector: "Manufacturing"},
    {name: "Medical Equipment and Supplies Manufacturing", employ: 1617.91, sector: "Manufacturing"},
    {name: "Other Miscellaneous Manufacturing", employ: 6297.45, sector: "Manufacturing"},
    {name: "Motor Vehicle and Motor Vehicle Parts and Supplies Merchant Wholesalers", employ: 11881.71, sector: "Trade & Transportation"},
    {name: "Furniture and Home Furnishing Merchant Wholesalers", employ: 1489.91, sector: "Trade & Transportation"},
    {name: "Lumber and Other Construction Materials Merchant Wholesalers", employ: 3238.72, sector: "Trade & Transportation"},
    {name: "Professional and Commercial Equipment and Supplies Merchant Wholesalers", employ: 6915.36, sector: "Trade & Transportation"},
    {name: "Metal and Mineral Merchant Wholesalers", employ: 4775.78, sector: "Trade & Transportation"},
    {name: "Household Appliances and Electrical and Electronic Goods Merchant Wholesalers", employ: 7325.37, sector: "Trade & Transportation"},
    {name: "Hardware and Plumbing and Heating Equipment and Supplies Merchant Wholesalers", employ: 2921.10, sector: "Trade & Transportation"},
    {name: "Machinery Equipment and Supplies Merchant Wholesalers", employ: 17313.90, sector: "Trade & Transportation"},
    {name: "Miscellaneous Durable Goods Merchant Wholesalers", employ: 3479.33, sector: "Trade & Transportation"},
    {name: "Paper and Paper Product Merchant Wholesalers", employ: 1615.99, sector: "Trade & Transportation"},
    {name: "Drugs and Druggists Sundries Merchant Wholesalers", employ: 2150.16, sector: "Trade & Transportation"},
    {name: "Apparel Piece Goods and Notions Merchant Wholesalers", employ: 1219.45, sector: "Trade & Transportation"},
    {name: "Grocery and Related Product Merchant Wholesalers", employ: 7638.17, sector: "Trade & Transportation"},
    {name: "Farm Product Raw Material Merchant Wholesalers", employ: 136.67, sector: "Trade & Transportation"},
    {name: "Chemical and Allied Products Merchant Wholesalers", employ: 1585.19, sector: "Trade & Transportation"},
    {name: "Petroleum and Petroleum Products Merchant Wholesalers", employ: 1257.95, sector: "Trade & Transportation"},
    {name: "Beer Wine and Distilled Alcoholic Beverage Merchant Wholesalers", employ: 2840.25, sector: "Trade & Transportation"},
    {name: "Miscellaneous Nondurable Goods Merchant Wholesalers", employ: 4426.41, sector: "Trade & Transportation"},
    {name: "Wholesale Electronic Markets and Agents and Brokers", employ: 80.85, sector: "Trade & Transportation"},
    {name: "Automobile Dealers", employ: 38470.95, sector: "Trade & Transportation"},
    {name: "Other Motor Vehicle Dealers", employ: 2542.85, sector: "Trade & Transportation"},
    {name: "Automotive Parts Accessories and Tire Stores", employ: 6807.56, sector: "Trade & Transportation"},
    {name: "Furniture Stores", employ: 3139.58, sector: "Trade & Transportation"},
    {name: "Home Furnishings Stores", employ: 3455.27, sector: "Trade & Transportation"},
    {name: "Electronics and Appliance Stores", employ: 5743.07, sector: "Trade & Transportation"},
    {name: "Building Material and Supplies Dealers", employ: 17117.56, sector: "Trade & Transportation"},
    {name: "Lawn and Garden Equipment and Supplies Stores", employ: 955.73, sector: "Trade & Transportation"},
    {name: "Grocery Stores", employ: 21726.83, sector: "Trade & Transportation"},
    {name: "Specialty Food Stores", employ: 8427.40, sector: "Trade & Transportation"},
    {name: "Beer Wine and Liquor Stores", employ: 2671.82, sector: "Trade & Transportation"},
    {name: "Health and Personal Care Stores", employ: 17183.97, sector: "Trade & Transportation"},
    {name: "Gasoline Stations", employ: 5415.83, sector: "Trade & Transportation"},
    {name: "Clothing Stores", employ: 14153.14, sector: "Trade & Transportation"},
    {name: "Shoe Stores", employ: 1839.28, sector: "Trade & Transportation"},
    {name: "Jewelry Luggage and Leather Goods Stores", employ: 2121.29, sector: "Trade & Transportation"},
    {name: "Sporting Goods Hobby and Musical Instrument Stores", employ: 6149.23, sector: "Trade & Transportation"},
    {name: "Book Stores and News Dealers", employ: 865.26, sector: "Trade & Transportation"},
    {name: "Department Stores", employ: 30211.98, sector: "Trade & Transportation"},
    {name: "General Merchandise Stores including Warehouse Clubs and Supercenters", employ: 6705.54, sector: "Trade & Transportation"},
    {name: "Florists", employ: 1329.17, sector: "Trade & Transportation"},
    {name: "Office Supplies Stationery and Gift Stores", employ: 3203.11, sector: "Trade & Transportation"},
    {name: "Used Merchandise Stores", employ: 1174.22, sector: "Trade & Transportation"},
    {name: "Other Miscellaneous Store Retailers", employ: 8560.22, sector: "Trade & Transportation"},
    {name: "Electronic Shopping and Mail-Order Houses", employ: 865.26, sector: "Trade & Transportation"},
    {name: "Vending Machine Operators", employ: 1362.86, sector: "Trade & Transportation"},
    {name: "Direct Selling Establishments", employ: 936.48, sector: "Trade & Transportation"},
    {name: "Scheduled Air Transportation", employ: 70.26, sector: "Trade & Transportation"},
    {name: "Nonscheduled Air Transportation", employ: 259.87, sector: "Trade & Transportation"},
    {name: "Rail Transportation", employ: 3082.80, sector: "Trade & Transportation"},
    {name: "Deep Sea Coastal and Great Lakes Water Transportation", employ: 24.06, sector: "Trade & Transportation"},
    {name: "Inland Water Transportation", employ: 74.11, sector: "Trade & Transportation"},
    {name: "General Freight Trucking", employ: 14748.91, sector: "Trade & Transportation"},
    {name: "Specialized Freight Trucking", employ: 2898.96, sector: "Trade & Transportation"},
    {name: "Urban Transit Systems", employ: 1450.44, sector: "Trade & Transportation"},
    {name: "Interurban and Rural Bus Transportation", employ: 51.97, sector: "Trade & Transportation"},
    {name: "Taxi and Limousine Service", employ: 1660.26, sector: "Trade & Transportation"},
    {name: "School and Employee Bus Transportation", employ: 612.13, sector: "Trade & Transportation"},
    {name: "Charter Bus Industry", employ: 363.81, sector: "Trade & Transportation"},
    {name: "Other Transit and Ground Passenger Transportation", employ: 354.19, sector: "Trade & Transportation"},
    {name: "Pipeline Transportation of Crude Oil", employ: 3.62, sector: "Trade & Transportation"},
    {name: "Pipeline Transportation of Natural Gas", employ: 204.04, sector: "Trade & Transportation"},
    {name: "Other Pipeline Transportation", employ: 0.96, sector: "Trade & Transportation"},
    {name: "Scenic and Sightseeing Transportation Land", employ: 6.74, sector: "Trade & Transportation"},
    {name: "Scenic and Sightseeing Transportation Water", employ: 108.76, sector: "Trade & Transportation"},
    {name: "Scenic and Sightseeing Transportation Other", employ: 1.92, sector: "Trade & Transportation"},
    {name: "Support Activities for Air Transportation", employ: 692.98, sector: "Trade & Transportation"},
    {name: "Support Activities for Rail Transportation", employ: 1846.98, sector: "Trade & Transportation"},
    {name: "Support Activities for Water Transportation", employ: 173.24, sector: "Trade & Transportation"},
    {name: "Support Activities for Road Transportation", employ: 3694.93, sector: "Trade & Transportation"},
    {name: "Freight Transportation Arrangement", employ: 6173.29, sector: "Trade & Transportation"},
    {name: "Other Support Activities for Transportation", employ: 8619.90, sector: "Trade & Transportation"},
    {name: "Postal Service", employ: 7321.52, sector: "Trade & Transportation"},
    {name: "Couriers and Express Delivery Services", employ: 1051.98, sector: "Trade & Transportation"},
    {name: "Local Messengers and Local Delivery", employ: 1268.54, sector: "Trade & Transportation"},
    {name: "Warehousing and Storage", employ: 4734.40, sector: "Trade & Transportation"},
    {name: "Newspaper Periodical Book and Directory Publishers", employ: 8640.11, sector: "Professional & Business"},
    {name: "Software Publishers", employ: 3989.44, sector: "Professional & Business"},
    {name: "Motion Picture and Video Industries", employ: 4687.24, sector: "Professional & Business"},
    {name: "Sound Recording Industries", employ: 477.39, sector: "Professional & Business"},
    {name: "Radio and Television Broadcasting", employ: 3938.43, sector: "Professional & Business"},
    {name: "Cable and Other Subscription Programming", employ: 1018.29, sector: "Professional & Business"},
    {name: "Wired and Wireless Telecommunications Carriers", employ: 8049.15, sector: "Professional & Business"},
    {name: "Satellite Telecommunications", employ: 1.92, sector: "Professional & Business"},
    {name: "Other Telecommunications", employ: 5877.81, sector: "Professional & Business"},
    {name: "Data Processing Hosting and Related Services", employ: 4608.31, sector: "Professional & Business"},
    {name: "Other Information Services", employ: 4759.42, sector: "Professional & Business"},
    {name: "Monetary Authorities-Central Bank", employ: 327.24, sector: "Financial Activities"},
    {name: "Depository Credit Intermediation", employ: 19219.59, sector: "Financial Activities"},
    {name: "Nondepository Credit Intermediation", employ: 11881.71, sector: "Financial Activities"},
    {name: "Activities Related to Credit Intermediation", employ: 6175.22, sector: "Financial Activities"},
    {name: "Securities and Commodity Contracts Intermediation and Brokerage", employ: 2709.36, sector: "Financial Activities"},
    {name: "Securities and Commodity Exchanges", employ: 42.35, sector: "Financial Activities"},
    {name: "Other Financial Investment Activities", employ: 14746.03, sector: "Financial Activities"},
    {name: "Insurance Carriers", employ: 9901.91, sector: "Financial Activities"},
    {name: "Agencies Brokerages and Other Insurance Related Activities", employ: 13823.02, sector: "Financial Activities"},
    {name: "Insurance and Employee Benefit Funds", employ: 162.66, sector: "Financial Activities"},
    {name: "Other Investment Pools and Funds", employ: 1299.34, sector: "Financial Activities"},
    {name: "Lessors of Real Estate", employ: 14619.94, sector: "Financial Activities"},
    {name: "Offices of Real Estate Agents and Brokers", employ: 20336.06, sector: "Financial Activities"},
    {name: "Activities Related to Real Estate", employ: 9254.16, sector: "Financial Activities"},
    {name: "Automotive Equipment Rental and Leasing", employ: 2618.89, sector: "Financial Activities"},
    {name: "Consumer Goods Rental", employ: 2606.37, sector: "Financial Activities"},
    {name: "General Rental Centers", employ: 63.52, sector: "Financial Activities"},
    {name: "Commercial and Industrial Machinery and Equipment Rental and Leasing", employ: 2921.10, sector: "Financial Activities"},
    {name: "Lessors of Nonfinancial Intangible Assets", employ: 228.11, sector: "Financial Activities"},
    {name: "Legal Services", employ: 21983.81, sector: "Professional & Business"},
    {name: "Accounting Tax Preparation Bookkeeping and Payroll Services", employ: 11227.23, sector: "Professional & Business"},
    {name: "Architectural Engineering and Related Services", employ: 34988.73, sector: "Professional & Business"},
    {name: "Specialized Design Services", employ: 2919.18, sector: "Professional & Business"},
    {name: "Computer Systems Design and Related Services", employ: 25431.39, sector: "Professional & Business"},
    {name: "Management Scientific and Technical Consulting Services", employ: 43482.54, sector: "Professional & Business"},
    {name: "Scientific Research and Development Services", employ: 2667.01, sector: "Professional & Business"},
    {name: "Advertising Public Relations and Related Services", employ: 6735.38, sector: "Professional & Business"},
    {name: "Other Professional Scientific and Technical Services", employ: 15955.85, sector: "Professional & Business"},
    {name: "Management of Companies and Enterprises", employ: 3811.39, sector: "Professional & Business"},
    {name: "Office Administrative Services", employ: 20367.82, sector: "Professional & Business"},
    {name: "Facilities Support Services", employ: 1453.33, sector: "Professional & Business"},
    {name: "Employment Services", employ: 20106.99, sector: "Professional & Business"},
    {name: "Business Support Services", employ: 21205.17, sector: "Professional & Business"},
    {name: "Travel Arrangement and Reservation Services", employ: 3420.62, sector: "Professional & Business"},
    {name: "Investigation and Security Services", employ: 9121.34, sector: "Professional & Business"},
    {name: "Services to Buildings and Dwellings", employ: 22337.04, sector: "Professional & Business"},
    {name: "Other Support Services", employ: 16758.55, sector: "Professional & Business"},
    {name: "Waste Collection", employ: 444.66, sector: "Professional & Business"},
    {name: "Waste Treatment and Disposal", employ: 2138.61, sector: "Professional & Business"},
    {name: "Remediation and Other Waste Management Services", employ: 3298.39, sector: "Professional & Business"},
    {name: "Elementary and Secondary Schools", employ: 103970.99, sector: "Education & Health"},
    {name: "Junior Colleges", employ: 2730.53, sector: "Education & Health"},
    {name: "Colleges Universities and Professional Schools", employ: 15505.42, sector: "Education & Health"},
    {name: "Business Schools and Computer and Management Training", employ: 820.03, sector: "Education & Health"},
    {name: "Technical and Trade Schools", employ: 2029.85, sector: "Education & Health"},
    {name: "Other Schools and Instruction", employ: 8283.03, sector: "Education & Health"},
    {name: "Educational Support Services", employ: 1190.58, sector: "Education & Health"},
    {name: "Offices of Physicians", employ: 39705.80, sector: "Education & Health"},
    {name: "Offices of Dentists", employ: 17066.55, sector: "Education & Health"},
    {name: "Offices of Other Health Practitioners", employ: 13919.26, sector: "Education & Health"},
    {name: "Outpatient Care Centers", employ: 13074.21, sector: "Education & Health"},
    {name: "Medical and Diagnostic Laboratories", employ: 2731.49, sector: "Education & Health"},
    {name: "Home Health Care Services", employ: 15810.52, sector: "Education & Health"},
    {name: "Other Ambulatory Health Care Services", employ: 9415.86, sector: "Education & Health"},
    {name: "General Medical and Surgical Hospitals", employ: 58156.38, sector: "Education & Health"},
    {name: "Psychiatric and Substance Abuse Hospitals", employ: 1831.58, sector: "Education & Health"},
    {name: "Specialty Hospitals", employ: 668.92, sector: "Education & Health"},
    {name: "Nursing Care Facilities", employ: 18170.50, sector: "Education & Health"},
    {name: "Residential Intellectual and Developmental Disability Mental Health and Substance Abuse Facilities", employ: 2408.10, sector: "Education & Health"},
    {name: "Continuing Care Retirement Communities and Assisted Living Facilities for the Elderly", employ: 11691.14, sector: "Education & Health"},
    {name: "Other Residential Care Facilities", employ: 4390.80, sector: "Education & Health"},
    {name: "Individual and Family Services", employ: 23333.20, sector: "Education & Health"},
    {name: "Community Food and Housing and Emergency and Other Relief Services", employ: 519.73, sector: "Other"},
    {name: "Vocational Rehabilitation Services", employ: 2470.66, sector: "Education & Health"},
    {name: "Child Day Care Services", employ: 10729.63, sector: "Education & Health"},
    {name: "Performing Arts Companies", employ: 1366.71, sector: "Leisure & Hospitality"},
    {name: "Spectator Sports", employ: 1312.81, sector: "Leisure & Hospitality"},
    {name: "Promoters of Performing Arts Sports and Similar Events", employ: 674.69, sector: "Leisure & Hospitality"},
    {name: "Agents and Managers for Artists Athletes Entertainers and Other Public Figures", employ: 773.83, sector: "Leisure & Hospitality"},
    {name: "Independent Artists Writers and Performers", employ: 1441.78, sector: "Leisure & Hospitality"},
    {name: "Museums Historical Sites and Similar Institutions", employ: 2634.28, sector: "Leisure & Hospitality"},
    {name: "Amusement Parks and Arcades", employ: 427.34, sector: "Leisure & Hospitality"},
    {name: "Gambling Industries", employ: 145.33, sector: "Leisure & Hospitality"},
    {name: "Other Amusement and Recreation Industries", employ: 18008.81, sector: "Leisure & Hospitality"},
    {name: "Traveler Accommodation", employ: 14363.72, sector: "Leisure & Hospitality"},
    {name: "RV Parks and Recreational Camps", employ: 846.01, sector: "Leisure & Hospitality"},
    {name: "Rooming and Boarding Houses Dormitories and Workers Camps", employ: 158.81, sector: "Leisure & Hospitality"},
    {name: "Special Food Services", employ: 6360.97, sector: "Leisure & Hospitality"},
    {name: "Drinking Places Alcoholic Beverages", employ: 7391.78, sector: "Leisure & Hospitality"},
    {name: "Restaurants and Other Eating Places", employ: 119894.12, sector: "Leisure & Hospitality"},
    {name: "Automotive Repair and Maintenance", employ: 16184.92, sector: "Professional & Business"},
    {name: "Electronic and Precision Equipment Repair and Maintenance", employ: 3599.64, sector: "Professional & Business"},
    {name: "Commercial and Industrial Machinery and Equipment Repair and Maintenance", employ: 3544.78, sector: "Professional & Business"},
    {name: "Personal and Household Goods Repair and Maintenance", employ: 3972.12, sector: "Professional & Business"},
    {name: "Personal Care Services", employ: 13523.69, sector: "Professional & Business"},
    {name: "Death Care Services", employ: 2565.95, sector: "Professional & Business"},
    {name: "Drycleaning and Laundry Services", employ: 4134.78, sector: "Professional & Business"},
    {name: "Other Personal Services", employ: 5075.11, sector: "Professional & Business"},
    {name: "Religious Organizations", employ: 19104.10, sector: "Other"},
    {name: "Grantmaking and Giving Services", employ: 1566.90, sector: "Other"},
    {name: "Social Advocacy Organizations", employ: 4651.63, sector: "Other"},
    {name: "Civic and Social Organizations", employ: 13318.68, sector: "Other"},
    {name: "Business Professional Labor Political and Similar Organizations", employ: 13376.43, sector: "Other"},
    {name: "Private Households", employ: 1.92, sector: "Other"},
    {name: "Executive Legislative and Other General Government Support", employ: 29272.61, sector: "Other"},
    {name: "Justice Public Order and Safety Activities", employ: 48264.10, sector: "Other"},
    {name: "Administration of Human Resource Programs", employ: 11616.07, sector: "Other"},
    {name: "Administration of Environmental Quality Programs", employ: 7058.77, sector: "Other"},
    {name: "Administration of Housing Programs Urban Planning and Community Development", employ: 1483.17, sector: "Other"},
    {name: "Administration of Economic Programs", employ: 4969.24, sector: "Other"},
    {name: "Space Research and Technology", employ: 0, sector: "Other"},
    {name: "National Security and International Affairs", employ: 15600.70, sector: "Other"},
  ];

  /* Drop the 150 smallest industries so labels stay legible (161 remain). */
  /* Calibrated so the drawn metro totals ~2.82M jobs — the world in which
     the LEHD commuting figures hold: 687,736 jobs (24%) inside the admin
     city, 206 for every 100 its residents hold. One constant to retire
     when real employment data lands. */
  const EMPLOY_CAL = 1.50253;
  const industryData = [...rawData]
    .sort((a, b) => b.employ - a.employ)
    .slice(0, rawData.length - 150)
    .map(r => ({ ...r, employ: r.employ * EMPLOY_CAL }));

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
        allLeaves.filter(d => tradabilityOf(d.data.name) < 0.5).map(d => d.data.name));

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
     concentrated here than it is worldwide.

     Dummy values for the prototype, held stable per industry. A handful of
     plausible Boston strengths are seeded by hand; the rest are random with
     most sitting below 1.0.
     ===================================================================== */
  const RCA_TOP_N = 10;

  const rcaSeed = {
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

  /* How likely an industry in each sector is to be tradable at all.
     Construction and government ("Other") are definitionally local, so they
     are excluded outright — letting one slip through produces nonsense like
     "building finishing contractors" ranked as an export strength. */
  const tradableOdds = {
    "Manufacturing": 0.92, "Professional & Business": 0.72, "Financial Activities": 0.55,
    "Natural Resources": 0.80, "Education & Health": 0.38, "Trade & Transportation": 0.18,
    "Leisure & Hospitality": 0.10, "Construction": 0, "Other": 0
  };

  const tradableByName = new Map();
  function isTradable(name, sector){
    if (!tradableByName.has(name)) {
      tradableByName.set(name,
        rcaSeed[name] ? true : srand() < (tradableOdds[sector] ?? 0.4));
    }
    return tradableByName.get(name);
  }

  const rcaByName = new Map();
  function rcaOf(name){
    if (!rcaByName.has(name)) {
      const seeded = rcaSeed[name];
      const v = seeded ? seeded.rca
        : (srand() < 0.80 ? 0.15 + srand() * 0.8
                          : 1.02 + srand() * 0.8);
      rcaByName.set(name, Math.round(v * 100) / 100);
    }
    return rcaByName.get(name);
  }

  const totalCityJobs = industryData.reduce((s, d) => s + d.employ, 0);

  function specialized(rows){
    const set = rows || industryData;
    const total = set.reduce((a, d) => a + d.employ, 0) || 1;
    return set
      .filter(d => isTradable(d.name, d.sector) && rcaOf(d.name) > 1)
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
          label: (rcaSeed[d.name] || {}).short ||
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
    /* numeric complexity consistent with the assigned colour bin */
    const bin = complexityPalette.indexOf(complexityColor(name));
    let h = 2166136261;
    for (const c of name) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return Math.round((bin - 2 + (h >>> 0) / 4294967296) * 100) / 100;
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
     cursor is too close to the frame's top the tip flips BELOW it — never
     pinned to an edge while the cursor keeps moving. */
  function cursorTipPos(ev, wrap, tip){
    const w = wrap.getBoundingClientRect();
    let left = ev.clientX - w.left + 10;
    if (left + tip.offsetWidth > w.width) left = ev.clientX - w.left - tip.offsetWidth - 10;
    let top = ev.clientY - w.top - tip.offsetHeight - 10;
    if (top < 0) top = ev.clientY - w.top + 14;
    tip.style.left = Math.max(0, left) + "px";
    tip.style.top  = Math.max(0, Math.min(top, w.height - tip.offsetHeight)) + "px";
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
      donutStat(host, jobsShare(r => tradabilityOf(r.name) >= 0.5), token("--teal", "#255862"),
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
       mean lands exactly on the canon: 334,026 resident jobs over the drawn
       2,824,810 metro total. */
    const RESIDENT_PROFILE = {
      Construction: .6, "Education & Health": 1.25, "Financial Activities": 1.15,
      "Leisure & Hospitality": 1.2, Manufacturing: .45, "Natural Resources": .5,
      Other: 1.05, "Professional & Business": 1.1, "Trade & Transportation": .8
    };
    const RES_OVERALL = 334026 / 2824810;
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
          .attr("height", BAR_H).attr("rx", 3).attr("fill", geom.fill);
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
        .attr("height", BAR_H).attr("rx", 3).attr("fill", geom.fill)
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
     binary keeps it only loosely, and slice or dice would put 161 industries
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

  /* The administrative city's own mix, derived from the metro's until real
     place-level employment is wired in: every industry keeps a share of its
     metro jobs, and the less tradable it is the larger that share, because
     local-serving work sits where the people are while exporters spread
     across the region. It lands near the 24% of metro jobs the section's
     other figures already quote for the admin. */
  const adminIndustryData = industryData.map(d => Object.assign({}, d, {
    employ: d.employ * (0.17 + 0.15 * (1 - tradabilityOf(d.name)))
  }));

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

    const box = (n, dx) => ({ x: n.x0 + (dx || 0), y: n.y0,
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
    /* what the map beats colour their cells by: the sector, or how much
       know-how each industry takes */
    let colorBy = "sector";
    const fillBy = d => colorBy === "complexity" ? complexityColor(d.name) : sectorColors[d.sector];
    const spot = d => posFull.get(d.name);

    const GAP = 8, HALF = (MI_W - GAP) / 2;
    const outward = industryData.filter(d => tradabilityOf(d.name) >= 0.5);
    const local   = industryData.filter(d => tradabilityOf(d.name) <  0.5);
    const posSplit = new Map();
    tmap(outward, HALF, MI_H, true).leaves()
      .forEach(n => posSplit.set(n.data.name, box(n)));
    tmap(local, HALF, MI_H, false).leaves()
      .forEach(n => posSplit.set(n.data.name, box(n, HALF + GAP)));

    /* ---- three clusters by tradability, the most tradable on the left.
       Column width is the cluster's share of jobs; inside each column the
       industries keep their sector walls, so colour stays the sector's and
       position alone carries tradability. ---- */
    const CL_HI = 0.5, CL_LO = 0.35;
    const clusterOf = d => { const t = tradabilityOf(d.name); return t >= CL_HI ? 0 : t >= CL_LO ? 1 : 2; };
    const clusterRows = [0, 1, 2].map(k => industryData.filter(d => clusterOf(d) === k));
    const jobsTotal = d3.sum(industryData, d => d.employ) || 1;
    const clusterShare = clusterRows.map(l => d3.sum(l, d => d.employ) / jobsTotal);
    const CGAP = 8, CW = MI_W - 2 * CGAP;
    const posCluster = new Map(), posClusterFlat = new Map();
    {
      let x0 = 0;
      clusterRows.forEach((l, k) => {
        const w = Math.max(36, CW * clusterShare[k]);
        if (l.length){
          tmap(l, w, MI_H, true).leaves()
            .forEach(n => posCluster.set(n.data.name, box(n, x0)));
          /* the same column in plain size order, for the Ordered view */
          const off = x0;
          stripLayout(l, w, MI_H).forEach((b, name) =>
            posClusterFlat.set(name, { x: b.x + off, y: b.y, w: b.w, h: b.h }));
        }
        x0 += w + CGAP;
      });
    }
    const clusterSpot = d => posCluster.get(d.name) || posFull.get(d.name);
    /* all three clusters wear one colouring: the columns already carry the
       tradability, so colour is free to say sector, or complexity */
    const clusterFill = fillBy;
    /* the tradable cluster alone, filling the width: the tradability-first
       narrative's second beat colours it by complexity */
    const tradRows = clusterRows[0];
    const SEC_STRIP = 17;
    const tradTree = tradRows.length ? tmap(tradRows, MI_W, MI_H, true, SEC_STRIP) : null;
    const posTrad = new Map(tradTree ? tradTree.leaves().map(n => [n.data.name, box(n)]) : []);
    /* the sector blocks themselves, so the mix can name its own colours
       instead of sending the reader to a key and back */
    const secTrad = new Map(tradTree ? tradTree.children.map(c => [c.data.name, box(c)]) : []);
    const posTradFlat = tradRows.length ? stripLayout(tradRows, MI_W, MI_H) : new Map();
    const tradSpot = d => posTrad.get(d.name);

    /* ---- Ordered by jobs: the same cells as a ranked bar chart. The top
       rows by jobs become bars, named on the left and valued at the end;
       every other cell keeps its place in the map and fades, so it can come
       back when the map does. One ranking is over the whole mix, one over
       the tradable cluster for the beat that shows that alone. ---- */
    const NB = 25, BML = 292, BMT = 48, BRH = 18.0, BBAR = 12, BPR = 812;
    const byJobsAll = industryData.slice().sort((a, b) => b.employ - a.employ);
    const barScale = d3.scaleLinear()
      .domain([0, (byJobsAll[0] ? byJobsAll[0].employ : 1) * 1.04]).range([BML + 12, BPR]);
    const barRankAll = new Map(byJobsAll.slice(0, NB).map((d, i) => [d.name, i]));
    const byJobsTrad = clusterRows[0].slice().sort((a, b) => b.employ - a.employ);
    const barRankTrad = new Map(byJobsTrad.slice(0, NB).map((d, i) => [d.name, i]));
    const barY = i => BMT + i * BRH + BRH / 2;
    const asBars = (d, rankMap, fill, fallback) => {
      const r = rankMap.get(d.name);
      return r == null
        ? { box: fallback, fill, op: 0, rx: 0 }
        : { box: { x: barScale(0), y: barY(r) - BBAR / 2,
                   w: Math.max(2, barScale(d.employ) - barScale(0)), h: BBAR }, fill, op: 1, rx: 3 };
    };
    window[ctlName + "_CLUSTERS"] = { share: clusterShare, gap: CGAP, width: MI_W };

    const ML = 292, MT = 62, RH = 34, BAR_H = 17, PLOT_R = 712;
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
    const rcaQuiet = name => {
      if (rcaByName.has(name)) return rcaByName.get(name);
      if (rcaSeed[name]) return rcaSeed[name].rca;
      const r = nameRand(name + "|rca");
      const v = r() < 0.80 ? 0.15 + r() * 0.8 : 1.02 + r() * 0.8;
      return Math.round(v * 100) / 100;
    };
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
          label: (rcaSeed[d.name] || {}).short ||
                 (d.name.length > 40 ? d.name.slice(0, 37) + "\u2026" : d.name),
          peerAvg: pr.avg, peerValues: pr.values, ahead: shown(rca) >= shown(pr.avg) };
      });
    }
    function ranking(rows, among){
      const base = among ? specializedAmong(rows) : specializedWithPeers(rows);
      const ranked = base.sort((a, b) => b.rca - a.rca).slice(0, MI_TOP_N);
      return { ranked,
        rankIdx: new Map(ranked.map((d, i) => [d.name, i])),   /* by concentration: the badges' order */
        pos: new Map(ranked.map((d, i) => [d.name, i])),       /* the order on screen, which sorting changes */
        rankRow: new Map(ranked.map(d => [d.name, d])),
        xr: d3.scaleLinear()
          .domain([1, (d3.max(ranked, d => Math.max(d.rca, d.peerAvg)) || 2) * 1.06])
          .range([ML + 12, PLOT_R]),
        /* the gap against the peer average, symmetric so the average sits
           mid-chart: ahead to the right, behind to the left */
        xg: (function(){
          const g = Math.max(0.5, (d3.max(ranked, d => Math.abs(d.rca - d.peerAvg)) || 0.5) * 1.15);
          return d3.scaleLinear().domain([-g, g]).range([ML + 12, PLOT_R]);
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
    /* the ranking the third beat shows is over the two tradable clusters —
       the most tradable and the ones that sell some of both — so its bars
       rise only from cells that were in those two columns a beat before */
    const R1 = ranking(industryData), R2 = ranking(clusterRows[0].concat(clusterRows[1]), true);
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
      0: d => view === "alt" ? asBars(d, barRankAll, sectorColors[d.sector], spot(d))
                             : { box: spot(d), fill: sectorColors[d.sector], op: 1, rx: 0 },
      1: d => view === "alt" ? asBars(d, barRankAll, complexityColor(d.name), spot(d))
                             : { box: spot(d), fill: complexityColor(d.name), op: 1, rx: 0 },
      2: d => ({ box: posSplit.get(d.name) || posFull.get(d.name),
                 fill: tradabilityOf(d.name) >= 0.5 ? sectorColors[d.sector] : GREY,
                 op: 1, rx: 0 }),
      3: d => d.rank < 0
        ? { box: posSplit.get(d.name) || posFull.get(d.name), fill: GREY, op: 0, rx: 0 }
        : sortKey === "gap"
          ? { box: gapBox(R1, d.row, R1.pos.get(d.name)), fill: gapOf(d.row) >= 0 ? TEAL : ORANGE, op: 1, rx: 3 }
          : { box: { x: xr(1), y: rowY(R1.pos.get(d.name)) - BAR_H / 2,
                     w: Math.max(2, xr(d.row.rca) - xr(1)), h: BAR_H },
              fill: d.rank < 3 ? TEAL : MUTED, op: 1, rx: 3 },
      /* the three clusters by tradability, the most tradable on the left */
      4: d => view === "alt"
        ? asBars(d, barRankAll, clusterFill(d), clusterSpot(d))
        : { box: clusterSpot(d), fill: clusterFill(d), op: 1, rx: 0 },
      /* the tradable cluster on its own, the full width, read by complexity;
         everything else stays where the clusters left it and fades */
      5: d => clusterOf(d) === 0
        ? (view === "alt"
            ? asBars(d, barRankTrad, complexityColor(d.name), tradSpot(d) || posFull.get(d.name))
            : { box: tradSpot(d) || posFull.get(d.name), fill: complexityColor(d.name), op: 1, rx: 0 })
        : { box: clusterSpot(d), fill: GREY, op: 0, rx: 0 },
      /* the most tradable cluster alone, the full width: the first beat. The
         rest wait unseen where the clusters will put them, already in the
         colour they will wear, so the second beat fades them in in place */
      7: d => clusterOf(d) === 0
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
              op: 1, rx: 3, delay: arriving ? 300 : 0 }
          : { box: { x: R2.xr(1), y: rowY(R2.pos.get(d.name)) - BAR_H / 2,
                     w: Math.max(2, R2.xr(d.row2.rca) - R2.xr(1)), h: BAR_H },
              fill: d.rank2 < 3 ? TEAL : MUTED, op: 1, rx: 3, delay: arriving ? 300 : 0 }
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
    const gHi = svg.append("g").attr("class", "mi-hilite-layer");
    const hiRect = gHi.append("rect").attr("class", "mi-hilite")
      .attr("x", 0).attr("width", MI_W).attr("height", RH).style("opacity", 0);
    const gCells = svg.append("g").attr("class", "mi-cells");
    const gRows  = svg.append("g").attr("class", "mi-rows").style("opacity", 0);
    const gRows2 = svg.append("g").attr("class", "mi-rows").style("opacity", 0);
    const gBarsAll  = svg.append("g").attr("class", "mi-rows mi-bars").style("opacity", 0);
    const gBarsTrad = svg.append("g").attr("class", "mi-rows mi-bars").style("opacity", 0);
    /* the sector names, written on the blocks they belong to */
    const gSecLab = svg.append("g").attr("class", "mi-seclab").style("opacity", 0);
    /* white or ink, whichever the fill can carry — the reference this
       follows switches per sector rather than picking one and hoping */
    const inkOn = hex => {
      const c = d3.color(hex); if (!c) return "#1a2226";
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? "#fff" : "#1a2226";
    };
    function drawSectorLabels(){
      /* only where the block can hold the words: a clipped sector name is
         worse than none, since the reader cannot tell which it was */
      const items = [...secTrad].map(([name, b]) => ({ name: name, b: b }))
        .filter(d => d.b.h >= 46 && d.b.w >= name_w(d.name));
      gSecLab.selectAll("text").data(items, d => d.name).join("text")
        .attr("class", "mi-seclab-t")
        .attr("x", d => d.b.x + 5).attr("y", d => d.b.y + 12)
        .attr("fill", d => inkOn(sectorColors[d.name]))
        .text(d => d.name);
    }
    /* 11px semibold runs about 0.55em a character, plus the 6px inset and a
       little air at the end */
    const name_w = s => s.length * 6.1 + 14;
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

    /* the ranking's own furniture, drawn once per ranking and revealed with
       its state: the axis and its name, the leading three braced, and each
       row's name, value, peer tick and badge */
    function drawGapAxis(R, AG){
      const ticks = R.xg.ticks(5);
      AG.selectAll("g.mi-tick").data(ticks).join("g").attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 0 ? " is-base" : ""))
          .attr("x1", d => R.xg(d)).attr("x2", d => R.xg(d))
          .attr("y1", MT - 18).attr("y2", MT + R.ranked.length * RH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => R.xg(d)).attr("y", MT - 24).attr("text-anchor", "middle")
          .text(d => (d > 0 ? "+" : "") + d + "\u00d7"));
      AG.append("text").attr("class", "mi-axname")
        .attr("x", ML + 12).attr("y", MT - 42)
        .text("Concentration against the four peers\u2019 average: ahead to the right, behind to the left");
      AG.append("text").attr("class", "mi-colhead")
        .attr("x", MI_W - 6).attr("y", MT - 24).attr("text-anchor", "end").text("Jobs");
      tradHead(AG);
    }
    /* the tradability column's head: the name, and the score's range under it */
    function tradHead(A){
      A.append("text").attr("class", "mi-colhead")
        .attr("x", TC_R).attr("y", MT - 24).attr("text-anchor", "end").text("Tradability");
      A.append("text").attr("class", "mi-colsub")
        .attr("x", TC_R).attr("y", MT - 11).attr("text-anchor", "end").text("0 to 1");
    }
    function drawRanking(R, A, G){
      A.selectAll("g.mi-tick").data(R.xr.ticks(5).filter(t => t >= 1)).join("g")
        .attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 1 ? " is-base" : ""))
          .attr("x1", d => R.xr(d)).attr("x2", d => R.xr(d))
          .attr("y1", MT - 18).attr("y2", MT + R.ranked.length * RH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => R.xr(d)).attr("y", MT - 24).attr("text-anchor", "middle")
          .text(d => d + "\u00d7"));
      A.append("text").attr("class", "mi-axname")
        .attr("x", ML + 12).attr("y", MT - 42)
        .text("Times more concentrated here than in a typical US metro");
      /* the jobs column: its head, and each row's count at the right edge */
      A.append("text").attr("class", "mi-colhead")
        .attr("x", MI_W - 6).attr("y", MT - 24).attr("text-anchor", "end").text("Jobs");
      tradHead(A);
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
        .attr("x", ML - 10).attr("y", 4).attr("text-anchor", "end").text(d => d.label);
      row.append("text").attr("class", d => "mi-val" + (top(d) ? " is-top" : ""))
        .attr("x", d => Math.max(R.xr(d.rca), R.xr(d.peerAvg)) + 9).attr("y", 4)
        .text(d => d.rca.toFixed(1) + "\u00d7");
      row.append("line").attr("class", "mi-peer")
        .attr("x1", d => R.xr(d.peerAvg)).attr("x2", d => R.xr(d.peerAvg))
        .attr("y1", -BAR_H / 2 - 4).attr("y2", BAR_H / 2 + 4);
      /* the jobs column: the count, and a short bar beneath it so size reads
         as a second small chart in every order the rows can take */
      const jb = d3.scaleLinear().domain([0, d3.max(R.ranked, d => d.employ) || 1]).range([0, 58]);
      row.append("text").attr("class", "mi-jobs")
        .attr("x", MI_W - 6).attr("y", 1).attr("text-anchor", "end")
        .text(d => d.employ >= 1000 ? Math.round(d.employ / 1000) + "K" : Math.round(d.employ));
      row.append("rect").attr("class", "mi-jobsbar")
        .attr("x", d => MI_W - 6 - jb(d.employ)).attr("y", 5)
        .attr("width", d => Math.max(1, jb(d.employ))).attr("height", 4).attr("rx", 2);
      /* the tradability column, built the way the jobs column is: the score,
         and a short track beneath it from 0 to 1, filled as far as the score
         reaches, with a tick at 0.5 where the most tradable cluster begins */
      const tw = d3.scaleLinear().domain([0, 1]).range([0, TC_W]);
      row.append("text").attr("class", "mi-trad")
        .attr("x", TC_R).attr("y", 1).attr("text-anchor", "end")
        .text(d => tradabilityOf(d.name).toFixed(2));
      row.append("rect").attr("class", "mi-tradtrack")
        .attr("x", TC_R - TC_W).attr("y", 5).attr("width", TC_W).attr("height", 4).attr("rx", 2);
      row.append("rect").attr("class", "mi-tradbar")
        .attr("x", TC_R - TC_W).attr("y", 5).attr("height", 4).attr("rx", 2)
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
    const shortName = n => n.length > 36 ? n.slice(0, 35).replace(/\s+\S*$/, "") + "\u2026" : n;
    function drawBars(list, G){
      const rows = list.slice(0, NB);
      G.selectAll("g.mi-tick").data(barScale.ticks(4)).join("g").attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 0 ? " is-base" : ""))
          .attr("x1", d => barScale(d)).attr("x2", d => barScale(d))
          .attr("y1", BMT - 14).attr("y2", BMT + rows.length * BRH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => barScale(d)).attr("y", BMT - 20).attr("text-anchor", "middle")
          .text(d => fmtJobs(d)));
      G.append("text").attr("class", "mi-axname")
        .attr("x", BML + 12).attr("y", BMT - 36).text("Jobs in the metro");
      const row = G.selectAll("g.mi-row").data(rows, d => d.name).join("g").attr("class", "mi-row");
      row.append("text").attr("class", "mi-name")
        .attr("x", BML - 10).attr("y", (d, i) => barY(i) + 4).attr("text-anchor", "end")
        .text(d => shortName(d.name));
      row.append("text").attr("class", "mi-val")
        .attr("x", d => barScale(d.employ) + 8).attr("y", (d, i) => barY(i) + 4)
        .text(d => fmtJobs(d.employ));
    }
    drawBars(byJobsAll, gBarsAll);
    drawBars(byJobsTrad, gBarsTrad);

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
      const labs = cell.select(".mi-lab");
      const barsOn = view === "alt" && (i === 0 || i === 1 || i === 4 || i === 5 || i === 7);
      if (i === 3 || i === 6 || barsOn){
        (dur ? labs.transition().duration(dur / 3) : labs).style("opacity", 0);
      } else {
        const lu = labUnit();
        labs.attr("x", d => at(d).box.x + 4).attr("y", d => at(d).box.y + lu)
          .text(d => fitLabel(d.name, { width: at(d).box.w, height: at(d).box.h }, lu));
        (dur ? labs.transition().delay(dur / 2).duration(dur / 2) : labs)
          .style("opacity", d => at(d).op > 0 ? 1 : 0);
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
      show(gBarsAll, barsOn && i !== 5 && i !== 7);
      show(gBarsTrad, barsOn && (i === 5 || i === 7));
      /* the names belong to the sector-coloured map: under Ordered by jobs
         the blocks are gone, and under Complexity the colour is not the
         sector's any more, so the labels would be naming the wrong thing */
      if (i === 7 && !gSecLab.selectAll("text").size()) drawSectorLabels();
      show(gSecLab, i === 7 && view === "map" && colorBy === "sector");
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
    const colorEl = document.getElementById(p + "Color");
    /* the complexity rank and the complexity explainer in the first beat's text */
    const complexityBits = [p + "RankCard", p + "ComplexityInfo"]
      .map(id => document.getElementById(id)).filter(Boolean);
    function setColorBy(c){
      colorBy = c === "complexity" ? "complexity" : "sector";
      fig.dataset.color = colorBy;
      /* those show only while the first beat is coloured by complexity. They
         are only touched on that beat: showing or hiding them in a beat above
         the reader would shift the page under them. They open and close in
         place, so the centred text re-settles smoothly rather than jumping,
         and while closed they leave the tab order and the reading order */
      if (step === 7 || step < 0) complexityBits.forEach(el => {
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
      if (step === 7 || step === 4) paint(step, !reduced());
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
      if (i === 7 || i === 4) setColorBy("sector");
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
      const colsEl = head && (head.querySelector(".mcl-cols") || head);
      if (colsEl) [].forEach.call(colsEl.children, (c, k) => {
        const pc = c.querySelector(".pct"); if (pc) pc.textContent = "(" + pct(clusterShare[k]) + ")";
      });
      /* the header of the opening frame, which shows the most tradable alone */
      const tradHead = document.getElementById(p + "TradHead");
      if (tradHead){ const pc = tradHead.querySelector(".pct");
        if (pc) pc.textContent = "(" + pct(clusterShare[0]) + " of metro jobs)"; }
      /* each name sits over its own column, so the header is measured from
         the chart rather than from the slot that holds it — the slot runs a
         little wider, and a share of that width would drift the names right */
      function sizeClusterHead(){
        if (!head || !colsEl) return;
        const w = el.getBoundingClientRect().width || MI_W, sc = w / MI_W;
        head.style.width = w + "px";
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
        /* examples come from the far end of each outer band, so the two ends
           of the score are illustrated by industries that sit near them —
           a band's largest industry can sit right at its edge — falling back
           to the whole band where its tail is thin */
        const tail = { 0: d => tradabilityOf(d.name) >= 0.7, 1: () => true, 2: d => tradabilityOf(d.name) <= 0.2 };
        const examples = k => {
          const pick = list => list.slice().sort((a, b) => b.employ - a.employ)
            .map(d => shortOf(d.name)).filter(t => t.length <= 30);
          const inTail = pick(clusterRows[k].filter(tail[k]));
          return (inTail.length >= 2 ? inTail : pick(clusterRows[k])).slice(0, 2).join(", ");
        };
        const bands = [
          { k: 0, name: "Sells outside the metro", range: "0.5 to 1",    span: 1 - CL_HI,     tone: "#255862" },
          { k: 1, name: "Some of both",            range: "0.35 to 0.5", span: CL_HI - CL_LO, tone: "#59838c" },
          { k: 2, name: "Serves the metro",        range: "0 to 0.35",   span: CL_LO,         tone: "#b9ccd0" }
        ];
        /* the ends and the banded track are gone: the figure's own header
           already runs 1 to 0 across the top of the three columns, and the
           columns are the bands. What is left is the part the chart cannot
           say — what each band is called, the score it covers, and two of
           the metro's own industries from inside it. */
        scaleHost.innerHTML =
          '<span class="ts-rows">' + bands.map(b =>
            '<span class="ts-row"><i style="background:' + b.tone + '"></i><span>' +
            '<span class="ts-name">' + b.name + '</span> <span class="ts-range">' + b.range + '</span>' +
            '<span class="ts-eg">e.g. ' + examples(b.k) + '</span></span></span>').join("") + '</span>';
        scaleHost.hidden = false;
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
      cell.select(".mi-lab").style("opacity", 0);
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

    /* the sector key, in the order the map itself is biggest-first, with
       each sector's share of metro jobs beside its name */
    const key = document.getElementById(p + "SectorKey");
    if (key){
      const jobs = {}, trad = {};
      industryData.forEach(d => { jobs[d.sector] = (jobs[d.sector] || 0) + d.employ; });
      (clusterRows[0] || []).forEach(d => { trad[d.sector] = (trad[d.sector] || 0) + d.employ; });
      const tot = Object.values(jobs).reduce((a, b) => a + b, 0) || 1;
      const totTrad = Object.values(trad).reduce((a, b) => a + b, 0) || 1;
      /* two shares per sector: of every metro job, and of the jobs in the most
         tradable industries alone, for the first beat, whose map shows only
         those; a sector with none of them leaves that beat's key */
      key.innerHTML = Object.keys(jobs)
        .sort((a, b) => jobs[b] - jobs[a])
        .map(sec =>
          '<span class="sk-sec' + (trad[sec] ? '' : ' sk-no-trad') + '"><i class="sk-sw" style="background:' +
          (sectorColors[sec] || "#ccc") + '"></i>' + sec +
          ' <span class="sk-share sk-all">' + Math.round(jobs[sec] / tot * 100) + '%</span>' +
          '<span class="sk-share sk-trad">' + Math.round((trad[sec] || 0) / totTrad * 100) + '%</span></span>')
        .join("");
    }

    /* ---- the tooltip, reading whatever the figure is currently showing ----
       The same cells mean different things state to state, so the card names
       the measure in play rather than always reciting jobs. */
    const wrap = el.closest(".tradable-viz-wrapper");
    const tip = document.getElementById(p + "Tip");
    if (wrap && tip){
      const rowOf = (k, v) => '<div class="tip-row"><span>' + k + '</span><span>' + v + '</span></div>';
      const cellOf = (k, v) => '<dt>' + k + '</dt><dd>' + v + '</dd>';
      const pct = v => v.toFixed(2) + "%";
      const tradWord = t => t >= CL_HI ? "sells outside" : t >= CL_LO ? "some of both" : "serves the metro";
      /* the number the ranking is ordered by, given the size it is ordered by */
      const tipLead = r => '<div class="tip-lead"><b>' + r.rca.toFixed(1) +
        '\u00d7</b><span>more concentrated here than in<br>a typical US metro</span></div>';
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
        let body = "";
        const rrow = step === 6 ? d.row2 : d.row;
        if ((step === 3 || step === 6) && rrow){
          /* the card carries what the row itself shows, in the order the eye
             meets it: the headline concentration, then the peer line it is
             measured against, then the two columns on the right */
          body = tipLead(rrow) +
            '<dl class="tip-grid">' +
            cellOf("Peer metros average", rrow.peerAvg.toFixed(1) + "\u00d7") +
            (step === 6 ? cellOf("Tradability",
                tradabilityOf(d.name).toFixed(2) +
                ' <em>' + tradWord(tradabilityOf(d.name)) + '</em>') : "") +
            cellOf("Jobs here", Math.round(d.employ).toLocaleString()) +
            cellOf("Share of metro jobs", pct(rrow.localPct)) +
            '</dl>';
        } else {
          body = rowOf("Sector", d.sector) +
                 rowOf("Jobs", Math.round(d.employ).toLocaleString());
          if (step === 1 || step === 5 || ((step === 4 || step === 7) && colorBy === "complexity"))
            body += rowOf("Complexity (PCI)", pciNumOf(d.name).toFixed(2));
          /* the split reads two ways, the clusters three — the card says
             what the beat on screen is actually showing */
          if (step === 2) body += rowOf("Tradability", tradabilityOf(d.name).toFixed(2)) +
            rowOf("Reads as", tradabilityOf(d.name) >= 0.5 ? "sells outward" : "serves locally");
          if (step === 4 || step === 7){
            const t = tradabilityOf(d.name);
            body += rowOf("Tradability", t.toFixed(2)) +
              rowOf("Reads as", t >= CL_HI ? "sells outside the metro"
                              : t >= CL_LO ? "some of both" : "serves the metro");
          }
        }
        const labRow = step === 6 ? d.row2 : d.row;
        const rank = (step === 6 && R2.rankIdx.has(d.name) && R2.rankIdx.get(d.name) < 3)
          ? '<span class="tip-rank">' + (R2.rankIdx.get(d.name) + 1) + '</span>' : '';
        const head = '<div class="tip-head"><strong>' + rank +
          (labRow ? labRow.label : d.name) + '</strong>' +
          ((step === 3 || step === 6)
            ? '<span class="tip-sector"><i style="background:' + sectorColors[d.sector] + '"></i>' +
              d.sector + '</span>' : '') + '</div>';
        tip.innerHTML = head + body;
        tip.hidden = false;
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
      const hlSpans = [].slice.call(document.querySelectorAll(".mi-hl[data-sector]"));
      const clearHl = () => {
        cell.classed("is-dim", false);
        hlSpans.forEach(x => x.classList.remove("is-lit"));
      };
      const litHl = span => {
        const want = span.dataset.sector.split("|");
        cell.classed("is-dim", d => want.indexOf(d.sector) < 0);
        span.classList.add("is-lit");
      };
      hlSpans.forEach(span => {
        const on = () => { if (fig.dataset.step !== "7") return; clearHl(); litHl(span); };
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
      [R1, R2].forEach(function(R){
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
      });
    }

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
      const b = ev.target.closest(".seg-btn");
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
    /* Admin Industries now runs its own figure — one set of sector rows
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
