/* =========================================================================
   Boston MSA industry treemaps (d3)

   Renders two views off one dataset:
     1. #exportTreemapSvg     - static initial map, industries grouped by sector
     2. #tradableAnimatedSvg  - same map, then split into
                                Tradable (left, still sector-grouped/coloured)
                                Non-tradable (right, greyed)

   Both use a 880x550 viewBox so they share the prototype's proportions.
   ========================================================================= */
(function(){
  "use strict";

  const WIDTH  = 880;
  const HEIGHT = 550;
  const GREY   = "#9ca3af";

  /* "Color by" modes. Complexity and change are dummy values for the prototype,
     but held stable per industry so a cell keeps its shade across replays. */
  const SECTOR     = "Sector";
  const COMPLEXITY = "Product complexity";
  const CHANGE     = "Change";

  const complexityPalette = ["#d38b52","#e8c39b","#d3e5df","#6fab97","#2f7d6a"];
  const complexityByName = new Map();

  /* Change 2014 -> 2024. Deliberately a different axis from the complexity
     ramp (terracotta -> green): this one runs on the theme's own two accent
     tokens, --orange (shrinking) through a light neutral to --teal (growing).
     Read from :root so the scale tracks the theme rather than duplicating it.
     "New" industries have no 2014 baseline, so they have no growth rate to
     place on the ramp and take an off-scale swatch instead. */
  const CHANGE_MID = "#f4f1ee";
  const CHANGE_NEW = "#7a67a3";

  function token(name, fallback){
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  }

  let _changeScale = null;
  function changeScale(v){
    if (!_changeScale) {
      _changeScale = d3.scaleLinear()
        .domain([-0.6, 0, 0.9])
        .range([token("--orange", "#e76565"), CHANGE_MID, token("--teal", "#255862")])
        .interpolate(d3.interpolateLab)
        .clamp(true);
    }
    return _changeScale(v);
  }

  /* Dummy 2014->2024 growth per industry; null means "new since 2014". */
  const growthByName = new Map();

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

  function growthOf(name){
    if(!growthByName.has(name)){
      // ~8% are new since 2014 (no baseline); the rest spread across the ramp.
      growthByName.set(name,
        Math.random() < 0.08 ? null : (Math.random() * 1.5 - 0.6));
    }
    return growthByName.get(name);
  }

  function changeColor(name){
    const g = growthOf(name);
    return g === null ? CHANGE_NEW : changeScale(g);
  }

  /* Fill for one industry cell. Non-tradable cells stay grey in every mode —
     grey encodes "non-tradable", not a sector. */
  function cellFill(svgId, d, grey){
    if (grey) return GREY;
    const mode = colorMode[svgId];
    if (mode === COMPLEXITY) return complexityColor(d.data.name);
    if (mode === CHANGE)     return changeColor(d.data.name);
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
    }

    function run(){
      reset();

      // 30 random industries become non-tradable (grey, right half).
      const pick = new Set();
      while (pick.size < 30) pick.add(Math.floor(Math.random() * allLeaves.length));
      const nonTradableNames = new Set([...pick].map(i => allLeaves[i].data.name));

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
      el.classList.add("animated");
      // Also flag the subsection so the split headers above the chart can reveal.
      const section = el.closest(".export-subsection");
      if (section) section.classList.add("animated");
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

    if (legends) {
      const show = (id, on) => {
        const el = id && document.getElementById(id);
        if (el) el.classList.toggle("show", on);
      };
      show(legends.complexity, mode === COMPLEXITY);
      show(legends.change,     mode === CHANGE);
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
  /* "dot" (live design) or "bar" — a stakeholder-facing alternative, reachable
     from the viz bar. Not part of the reader-facing flow. */
  let rcaDesign = "dot";

  /* Shared axis header for both RCA charts, so they read identically.
     "RCA = 1" sits at the head of the benchmark line and reads rightwards from
     it; the axis title shares that baseline and is centred over the scale —
     nudged right only if it would otherwise run into the marker. */
  const RCA_LABEL_ZONE = 84;   // width reserved for the "RCA = 1" marker

  function drawAxisHeader(svg, x, plotR, MT, gridBottom, plainLabel){
    const baseline = MT - 40;

    svg.append("line").attr("class", "rca-benchmark")
      .attr("x1", x(1)).attr("y1", MT - 34).attr("x2", x(1)).attr("y2", gridBottom);

    // Centred on the scale *after* the marker's zone. Measuring the rendered
    // text would be exact, but getComputedTextLength returns 0 while the page
    // is hidden at init, so the clamp would silently never fire.
    svg.append("text").attr("class", "rca-axis-title")
      .attr("x", (x(1) + RCA_LABEL_ZONE + plotR) / 2).attr("y", baseline)
      .attr("text-anchor", "middle")
      .text("Times more concentrated in this city than in the world");

    const bench = svg.append("g").attr("class", "rca-bench-hit");
    bench.append("rect")
      .attr("x", x(1) - 6).attr("y", MT - 55)
      .attr("width", 74).attr("height", 24);
    bench.append("text")
      .attr("class", "rca-benchmark-label" + (plainLabel ? " rca-benchmark-label--plain" : ""))
      .attr("x", x(1) + 7).attr("y", baseline).attr("text-anchor", "start")
      .text("RCA = 1");

    return bench;
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
        const w = wrap.getBoundingClientRect();
        const left = ev.clientX - w.left + 16;
        const top  = ev.clientY - w.top + 14;
        rowTip.style.left =
          Math.max(0, Math.min(left, w.width - rowTip.offsetWidth)) + "px";
        rowTip.style.top =
          Math.max(0, Math.min(top, w.height - rowTip.offsetHeight)) + "px";
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
  /* "dot" (live design) or "bar" — stakeholder-facing alternative, same as the
     specialization chart. Not part of the reader-facing flow. */
  let peerDesign = "dot";

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
    const rowTip = document.getElementById("peerRowTip");
    const wrap = el.parentElement;
    if (rowTip && wrap) {
      const yearSel = document.querySelector("#peerSection .ctl select");
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
        const w = wrap.getBoundingClientRect();
        const left = ev.clientX - w.left + 16;
        const top  = ev.clientY - w.top + 14;
        rowTip.style.left =
          Math.max(0, Math.min(left, w.width - rowTip.offsetWidth)) + "px";
        rowTip.style.top =
          Math.max(0, Math.min(top, w.height - rowTip.offsetHeight)) + "px";
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
    setKey("peerCityKey", !isBar);
    setKey("peerCityKeyBar", isBar);
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
    const design = document.getElementById("peerDesignBtn");
    if (design) design.addEventListener("click", () => {
      peerDesign = (peerDesign === "dot") ? "bar" : "dot";
      design.textContent = (peerDesign === "dot")
        ? "Bar design option" : "Back to dot design";
      renderPeerChart();
    });
  }

  function initRcaChart(){
    if (!document.getElementById("rcaChartSvg")) return;
    renderRcaChart();
    const btn = document.getElementById("rcaToggleBtn");
    if (btn) btn.addEventListener("click", () => {
      rcaShowAll = !rcaShowAll;
      renderRcaChart();
    });
    const design = document.getElementById("rcaDesignBtn");
    if (design) design.addEventListener("click", () => {
      rcaDesign = (rcaDesign === "dot") ? "bar" : "dot";
      design.textContent = (rcaDesign === "dot")
        ? "Bar design option" : "Back to dot design";
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

  function init(){
    if (typeof d3 === "undefined") return;
    renderStaticTreemap();
    initTradableAnimation();
    initColorBySegments();
    initRcaChart();
    initPeerChart();
    initPeerCityChips();
  }

  window.CityTreemaps = { setColorBy };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
