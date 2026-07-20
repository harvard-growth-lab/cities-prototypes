// NAICS 2-digit sector metadata shared across treemap views (workers by
// industry, shift-share effects, new industries). A few NAICS-2 codes are
// conventionally reported as a single sector — 31-33 Manufacturing, 44-45
// Retail, 48-49 Transportation — so we collapse them to one parent on the
// treemap layout. `groupCode` is the visible badge ("31-33"), `name` is the
// long sector name, `color` is the fill for sector chrome.

export interface SectorMeta {
  groupCode: string;
  name: string;
  color: string;
}

export const SECTOR_META: Record<string, SectorMeta> = {
  '11': { groupCode: '11',    name: 'Agriculture, Forestry & Fishing', color: '#4a7a4a' },
  '21': { groupCode: '21',    name: 'Mining',                          color: '#7a5a3a' },
  '22': { groupCode: '22',    name: 'Utilities',                       color: '#b59a6e' },
  '23': { groupCode: '23',    name: 'Construction',                    color: '#c9a36a' },
  '31': { groupCode: '31-33', name: 'Manufacturing',                   color: '#a85a55' },
  '32': { groupCode: '31-33', name: 'Manufacturing',                   color: '#a85a55' },
  '33': { groupCode: '31-33', name: 'Manufacturing',                   color: '#a85a55' },
  '42': { groupCode: '42',    name: 'Wholesale Trade',                 color: '#8e9bba' },
  '44': { groupCode: '44-45', name: 'Retail Trade',                    color: '#c08aa6' },
  '45': { groupCode: '44-45', name: 'Retail Trade',                    color: '#c08aa6' },
  '48': { groupCode: '48-49', name: 'Transportation & Warehousing',    color: '#5a8a8a' },
  '49': { groupCode: '48-49', name: 'Transportation & Warehousing',    color: '#5a8a8a' },
  '51': { groupCode: '51',    name: 'Information',                     color: '#5a7aaa' },
  '52': { groupCode: '52',    name: 'Finance & Insurance',             color: '#d4a74e' },
  '53': { groupCode: '53',    name: 'Real Estate',                     color: '#a87a8e' },
  '54': { groupCode: '54',    name: 'Professional Services',           color: '#4a6a8a' },
  '55': { groupCode: '55',    name: 'Management of Companies',         color: '#555e6a' },
  '56': { groupCode: '56',    name: 'Administrative & Support',        color: '#9a9a8e' },
  '61': { groupCode: '61',    name: 'Educational Services',            color: '#6a9b6a' },
  '62': { groupCode: '62',    name: 'Health Care & Social',            color: '#b95a6e' },
  '71': { groupCode: '71',    name: 'Arts & Recreation',               color: '#d4866e' },
  '72': { groupCode: '72',    name: 'Accommodation & Food',            color: '#d0826c' },
  '81': { groupCode: '81',    name: 'Other Services',                  color: '#8e8e7a' },
  '92': { groupCode: '92',    name: 'Public Administration',           color: '#555e7a' },
};

export const SECTOR_FALLBACK: SectorMeta = { groupCode: '??', name: 'Unknown', color: '#bfbfb8' };

export const sectorOf = (code: string | null | undefined): SectorMeta =>
  (code && SECTOR_META[code]) || SECTOR_FALLBACK;
