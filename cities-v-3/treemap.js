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

  const WIDTH  = 1000;   /* the figure measure: slightly inside the 1104 text measure, fonts 1:1 */
  const HEIGHT = 480;    /* wide-and-short (2.1:1) so the full map fits one view */
  const GREY   = "#9ca3af";

  /* "Color by" modes. Complexity and change are dummy values for the prototype,
     but held stable per industry so a cell keeps its shade across replays. */
  const SECTOR     = "Sector";
  const COMPLEXITY = "Product complexity";
  const TRADABILITY = "Tradability";

  const complexityPalette = ["#d38b52","#e8c39b","#d3e5df","#6fab97","#2f7d6a"];
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
    "Construction": 0.12, "Education & Health": 0.31,
    "Financial Activities": 0.38, "Leisure & Hospitality": 0.24,
    "Manufacturing": 0.08, "Natural Resources": 0.03,
    "Other": 0.18, "Professional & Business": 0.33,
    "Trade & Transportation": 0.15
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

  const colorMode  = { exportTreemapSvg:SECTOR, tradableAnimatedSvg:SECTOR };

  /* Which cells are currently on the grey (non-tradable) side, per svg, so a
     later "Color by" change can recolour without losing the split. */
  const splitState = { exportTreemapSvg:null, tradableAnimatedSvg:null };

  function complexityColor(name){
    if(!complexityByName.has(name)){
      complexityByName.set(name,
        complexityPalette[Math.floor(Math.random() * complexityPalette.length)]);
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
  const industryData = [...rawData]
    .sort((a, b) => b.employ - a.employ)
    .slice(0, rawData.length - 150);

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
  function fitLabel(name, box){
    if (box.width < 40 || box.height < 20) return "";
    const chars = Math.floor((box.width - 8) * 0.125);
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

  /* ---------- 2. animated split ---------- */
  function initTradableAnimation(){
    const el = document.getElementById("tradableAnimatedSvg");
    if (!el) return;

    const { svg, root, sectorLayer, cells } = draw(el);
    const allLeaves = root.leaves();

    function reset(){
      if (tradableClearHover) tradableClearHover();
      svg.selectAll(".adm-layer").interrupt().remove();
      merged = false;
      const key = document.getElementById("admKey");
      if (key) key.hidden = true;
      const stripEl = document.getElementById("admHeadStat");
      if (stripEl) stripEl.hidden = true;
      const sect = el.closest(".export-subsection");
      if (sect) sect.classList.remove("animated");
      cells.style("pointer-events", null);
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
        .attr("fill", d => cellFill(el.id, d, false))
        .style("opacity", 1);

      cells.select(".industry-text").interrupt()
        .style("opacity", 1)
        .attr("x", d => d.x0 + 4).attr("y", d => d.y0 + 11)
        .text(d => fitLabel(d.data.name, { width: d.x1 - d.x0, height: d.y1 - d.y0 }));

      el.classList.remove("animated");
    }

    let merged = false;

    function run(){
      reset();

      // The grain change is deliberately quiet: the industry seams and
      // labels fade out IN PLACE and the sector blocks that were always
      // behind them come forward — nothing moves, the areas do not change,
      // only the level of detail does.
      cells.select(".industry-text").transition().duration(300).style("opacity", 0);
      cells.style("pointer-events", "none");
      cells.select(".cell").transition().duration(700).ease(d3.easeCubicInOut)
        .style("opacity", 0)
        .end().then(() => {
          /* rejects if a replay interrupts this run — exactly when phase 2
             must NOT fire on top of a fresh reset */
          merged = true;
          phase2();
        }).catch(() => {});

      // Phase 2 — the admin share: a veil fades everything that happens
      // elsewhere in the metro; the solid band left at the foot of each
      // block IS the city's slice of that sector.
      function phase2(){
        const layer = svg.append("g")
          .attr("class", "adm-layer").attr("pointer-events", "none");
        root.children.forEach(sec => {
          const name = sec.data.name;
          const a = { x: sec.x0, y: sec.y0, w: sec.x1 - sec.x0, h: sec.y1 - sec.y0 };
          const share = ADMIN_SHARE[name] !== undefined ? ADMIN_SHARE[name] : 0.15;
          const veilH = (1 - share) * a.h;
          const g = layer.append("g");
          g.append("rect")
            .attr("x", a.x).attr("y", a.y)
            .attr("width", a.w).attr("height", 0)
            .attr("fill", "#ffffff").attr("opacity", 0.68)
            .transition().delay(250).duration(750).ease(d3.easeCubicInOut)
            .attr("height", veilH);
          if (a.w > 64 && a.h > 44){
            const label = fitLabel(name, { width: a.w, height: a.h });
            g.append("text")
              .attr("x", a.x + 8).attr("y", a.y + 19)
              .attr("fill", "#1a2226").attr("font-size", 13.5).attr("font-weight", 600)
              .text(label)
              .style("opacity", 0)
              .transition().delay(650).duration(450).style("opacity", 1);
            g.append("text")
              .attr("x", a.x + 8).attr("y", a.y + 36)
              .attr("fill", "#5b686d").attr("font-size", 12)
              .text(Math.round(share * 100) + "% in the city")
              .style("opacity", 0)
              .transition().delay(800).duration(450).style("opacity", 1);
          }
        });
        const key = document.getElementById("admKey");
        if (key) key.hidden = false;
        const strip = document.getElementById("admHeadStat");
        if (strip) strip.hidden = false;
        el.classList.add("animated");
        const section = el.closest(".export-subsection");
        if (section) section.classList.add("animated");
      }
    }

    /* In the merged state the sector blocks are the marks — they answer the
       cursor with the sector's metro total and the city's slice of it. */
    const admTip = document.getElementById("tradableTip");
    const admWrap = document.querySelector(".tradable-viz-wrapper");
    sectorLayer.selectAll(".sector-rect")
      .on("mouseenter.adm", function(ev, d){
        if (!merged || !admTip) return;
        const share = ADMIN_SHARE[d.data.name] !== undefined ? ADMIN_SHARE[d.data.name] : 0.15;
        admTip.innerHTML = "<strong>" + d.data.name + "</strong>" +
          '<div class="tip-row"><span>Metro jobs</span><span>' +
            Math.round(d.value).toLocaleString() + "</span></div>" +
          '<div class="tip-row"><span>Inside the city</span><span>' +
            Math.round(d.value * share).toLocaleString() + " \u00b7 " +
            Math.round(share * 100) + "%</span></div>";
        admTip.hidden = false;
      })
      .on("mousemove.adm", function(ev){
        if (!merged || !admTip) return;
        cursorTipPos(ev, admWrap, admTip);
      })
      .on("mouseleave.adm", function(){ if (admTip) admTip.hidden = true; });

    const admTotal = d3.sum(root.children, sec => sec.value);
    const admInside = d3.sum(root.children, sec =>
      sec.value * (ADMIN_SHARE[sec.data.name] !== undefined ? ADMIN_SHARE[sec.data.name] : 0.15));
    const admStat = document.getElementById("admHeadStat");
    donutStat(admStat, admInside / admTotal, token("--teal", "#255862"),
      'of the metro\u2019s jobs sit inside <span class="city-short">Boston</span> proper');
    if (admStat) admStat.hidden = true;   /* revealed by the veil's final beat */

    let hasRun = false;
    const runOnce = () => { hasRun = true; run(); };
    const btn = document.getElementById("replayBtn");
    if (btn) btn.addEventListener("click", runOnce);

    // Play once when the section first scrolls into view — but never stomp
    // a run the reader already started (the replay button races this timer).
    new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        setTimeout(() => { if (!hasRun) runOnce(); }, 300);
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
     in the global benchmark. Above 1.0 means the industry is more
     concentrated here than it is worldwide.

     Dummy values for the prototype, held stable per industry. A handful of
     plausible Boston strengths are seeded by hand; the rest are random with
     most sitting below 1.0.
     ===================================================================== */
  const RCA_TOP_N = 12;

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
        rcaSeed[name] ? true : Math.random() < (tradableOdds[sector] ?? 0.4));
    }
    return tradableByName.get(name);
  }

  const rcaByName = new Map();
  function rcaOf(name){
    if (!rcaByName.has(name)) {
      const seeded = rcaSeed[name];
      const v = seeded ? seeded.rca
        : (Math.random() < 0.80 ? 0.15 + Math.random() * 0.8
                                : 1.02 + Math.random() * 0.8);
      rcaByName.set(name, Math.round(v * 100) / 100);
    }
    return rcaByName.get(name);
  }

  const totalCityJobs = industryData.reduce((s, d) => s + d.employ, 0);

  function specialized(){
    return industryData
      .filter(d => isTradable(d.name, d.sector) && rcaOf(d.name) > 1)
      .map(d => {
        const rca = rcaOf(d.name);
        // Shares behind the ratio, so a tooltip can show numbers that
        // actually divide out to the multiplier rather than asserting it.
        const localPct = d.employ / totalCityJobs * 100;
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
            "'s jobs vs " + d.worldPct.toFixed(2) + "% of the world's</div>" +
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

     Same RCA formula, same global benchmark — computed independently for each
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
      population: "690K", density: "4,460/km²", wage: "$104,000",
      home: "$712,000", share: "10.8%", diversity: "0.69" },
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
      const factor = 0.4 + Math.random() * 0.85;
      // Floor the target, never the resulting average — clamping after the
      // fact would leave the tick showing a number the four cities don't
      // actually average to.
      const target = Math.max(1.15, cityRca * factor);

      // Spread four cities around that target, then rescale so they average
      // to it exactly — the tooltip numbers must reconcile with the tick.
      const jitter = PEERS.map(() => 0.62 + Math.random() * 0.76);
      const mean = jitter.reduce((s, j) => s + j, 0) / jitter.length;
      const values = jitter.map(j => Math.round(target * (j / mean) * 10) / 10);

      // Average taken from the rounded values, so what is shown adds up.
      const avg = Math.round(
        (values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;

      peerByName.set(name, { values: values, avg: avg });
    }
    return peerByName.get(name);
  }

  function specializedWithPeers(){
    // Compare on the values the reader actually sees. Testing the raw numbers
    // would flag a row orange while its two labels read identically.
    const shown = v => Math.round(v * 10) / 10;
    return specialized().map(d => {
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

  const HOME = { name: "Boston", pop: 0.4, pay: 4.5, size: 4.9 };
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
      const pop = METRO_X_MED + (Math.random() + Math.random() + Math.random() - 1.5) * 1.1;
      const pay = METRO_Y_MED + (Math.random() + Math.random() + Math.random() - 1.5) * 1.1;
      rest.push({
        name: "Metro area " + (i + 1),
        pop: Math.round(pop * 100) / 100,
        pay: Math.round(pay * 100) / 100,
        size: Math.round((0.15 + Math.pow(Math.random(), 3) * 5.5) * 100) / 100,
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
      .text("Population growth (annual rate, 2014\u20132024)");
    svg.append("text").attr("class", "ms-axis-title")
      .attr("transform", "rotate(-90)")
      .attr("x", -(M.top + H - M.bottom) / 2).attr("y", 24)
      .attr("text-anchor", "middle")
      .text("Average salary growth (annual rate, 2014\u20132024)");

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
    { name:"Boston",      dx:-0.88, dy: 0.22, size:660, home:true }
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
        const valTxt = m.isNew && m.isNew(d.data.name) ? "new since 2014" : m.fmt(exVal(m, d));
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
    rawData.forEach(r => { tot += r.employ; if (pred(r)) hit += r.employ; });
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
        "of metro jobs are in industries of above-average complexity");
    else if (mode === TRADABILITY)
      donutStat(host, jobsShare(r => tradabilityOf(r.name) >= 0.5), token("--teal", "#255862"),
        "of metro jobs are in widely traded industries (tradability \u2265 0.5)");
    else host.hidden = true;
  }

  /* ---- the lean map: what the place does more of than its metro ----
     The same sector blocks as the merged admin map, recoloured by each
     sector's share of the city against its share of the metro (the ratio
     the reference proto states as "1.9x as large a share here"). House
     diverging pair: russet = leans less, teal = leans more, parity pale. */
  /* The two commuting donuts — real LEHD-style shares from the reference. */
  function initCommuteStats(){
    donutStat(document.getElementById("commuteOutStat"), 0.54, token("--teal", "#255862"),
      'of the jobs <span class="city-short">Boston</span>\u2019s residents hold are inside the city itself');
    donutStat(document.getElementById("commuteInStat"), 0.26, token("--teal", "#255862"),
      'of the jobs inside <span class="city-short">Boston</span> are held by its own residents');
  }

  function initLeanMap(){
    const el = document.getElementById("leanMapSvg");
    if (!el) return;
    const root = layout(industryData, "root", WIDTH);
    const total = d3.sum(root.children, sec => sec.value);
    const overall = d3.sum(root.children, sec =>
      sec.value * (ADMIN_SHARE[sec.data.name] !== undefined ? ADMIN_SHARE[sec.data.name] : 0.15)) / total;
    const ratioOf = sec => {
      const sh = ADMIN_SHARE[sec.data.name] !== undefined ? ADMIN_SHARE[sec.data.name] : 0.15;
      return sh / overall;
    };
    const leanScale = d3.scaleLinear()
      .domain([-1.6, 0, 0.8])
      .range(["#7f451e", "#efeeec", token("--teal", "#255862")])
      .interpolate(d3.interpolateLab)
      .clamp(true);

    const svg = d3.select(el);
    const g = svg.selectAll("g.lean-cell")
      .data(root.children, d => d.data.name)
      .join("g").attr("class", "lean-cell");
    g.append("rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
      .attr("fill", d => leanScale(Math.log2(ratioOf(d))))
      .attr("stroke", "#fff").attr("stroke-width", 1.5);
    g.each(function(d){
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 70 || h < 44) return;
      const r = ratioOf(d);
      const nearParity = r > 0.8 && r < 1.25;
      const ink = nearParity ? "#1a2226" : "#ffffff";
      const sub = nearParity ? "#5b686d" : "rgba(255,255,255,.85)";
      const sel = d3.select(this);
      sel.append("text")
        .attr("x", d.x0 + 8).attr("y", d.y0 + 19)
        .attr("fill", ink).attr("font-size", 13.5).attr("font-weight", 600)
        .text(fitLabel(d.data.name, { width: w, height: h }));
      sel.append("text")
        .attr("x", d.x0 + 8).attr("y", d.y0 + 36)
        .attr("fill", sub).attr("font-size", 12)
        .text(r.toFixed(1).replace(/\.0$/, "") + "\u00d7 the metro\u2019s share");
    });

    /* the superlative, stated the way the reference states it */
    const top = root.children.reduce((a, b) => ratioOf(a) > ratioOf(b) ? a : b);
    const note = document.getElementById("leanNote");
    if (note){
      const sh = ADMIN_SHARE[top.data.name];
      note.innerHTML = "<strong>" + top.data.name + "</strong> is " +
        ratioOf(top).toFixed(1) + "\u00d7 as large a share here as in the metro \u2014 " +
        Math.round(sh * 100) + "% of the metro\u2019s " + top.data.name.toLowerCase() +
        " sits inside the city, against " + Math.round(overall * 100) +
        "% of the metro\u2019s jobs overall.";
    }

    /* house tooltip: cursor top-right */
    const tip = document.getElementById("leanTip");
    const wrap = document.getElementById("leanWrap");
    if (tip && wrap){
      g.on("mouseenter", function(ev, d){
        const r = ratioOf(d);
        const sh = ADMIN_SHARE[d.data.name] !== undefined ? ADMIN_SHARE[d.data.name] : 0.15;
        tip.innerHTML = "<strong>" + d.data.name + "</strong>" +
          '<div class="tip-row"><span>Lean vs the metro</span><span>' + r.toFixed(2) + "\u00d7</span></div>" +
          '<div class="tip-row"><span>Of this sector, in the city</span><span>' +
            Math.round(sh * 100) + "%</span></div>" +
          '<div class="tip-row"><span>Of all metro jobs, in the city</span><span>' +
            Math.round(overall * 100) + "%</span></div>";
        tip.hidden = false;
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, tip);
      })
      .on("mouseleave", function(){ tip.hidden = true; });
    }
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
    const btns = document.querySelectorAll("#exportOptList .design-opt");
    if (!btns.length) return;
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
    initTradableAnimation();
    initColorBySegments();
    initExportOptions();
    initExportTooltip();
    initTradableTooltip();
    initLeanMap();
    initCommuteStats();
    updateExportHeadStat();
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
