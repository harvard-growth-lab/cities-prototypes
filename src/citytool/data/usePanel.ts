/**
 * Static replacement for the parquet-backed hooks. Same hook names + return
 * shape ({ data, loading, error }) as cities-tool, but every result is a stable
 * module-level constant built from staticData.ts — so consumers' useMemo deps
 * (which key on `.data`) never thrash. County/ZIP/sector tables aren't used by
 * CityStory and resolve to empty arrays.
 */

import type {
  CityDirectoryRow,
  CityPanelRow,
  SectorEmploymentRow,
  NationalSectorRow,
  HousingRow,
  CityIndustryRow,
  CityComplexityRow,
  CountyDirectoryRow,
  CountyIndustryRow,
  CountyPanelRow,
  CountyHousingRow,
  CountyMigrationRow,
  ZipDirectoryRow,
  ZipPanelRow,
  ZipHousingRow,
  PlaceDirectoryRow,
  PlacePanelRow,
  PlaceHousingRow,
  PlaceRentRow,
  CityRentRow,
  PlaceFiscalRow,
  MsaIndustryRow,
  NationalIndustryRow,
  IndustryAttributeRow,
} from "./types";
import {
  CITY_DIRECTORY,
  CITY_PANEL,
  CITY_HOUSING,
  CITY_RENT,
  CITY_COMPLEXITY,
  PLACE_DIRECTORY,
  PLACE_PANEL,
  PLACE_HOUSING,
  PLACE_RENT,
  PLACE_FISCAL,
  MSA_INDUSTRY,
  NATIONAL_INDUSTRY,
  INDUSTRY_ATTRIBUTES,
} from "./staticData";

type State<T> = { data: T | null; loading: boolean; error: Error | null };
const ok = <T>(data: T): State<T> => ({ data, loading: false, error: null });
const empty = <T>(): State<T[]> => ok<T[]>([]);

const CITY_DIRECTORY_S = ok(CITY_DIRECTORY);
const CITY_PANEL_S = ok(CITY_PANEL);
const CITY_HOUSING_S = ok(CITY_HOUSING);
const CITY_RENT_S = ok(CITY_RENT);
const CITY_COMPLEXITY_S = ok(CITY_COMPLEXITY);
const PLACE_DIRECTORY_S = ok(PLACE_DIRECTORY);
const PLACE_PANEL_S = ok(PLACE_PANEL);
const PLACE_HOUSING_S = ok(PLACE_HOUSING);
const PLACE_RENT_S = ok(PLACE_RENT);
const PLACE_FISCAL_S = ok(PLACE_FISCAL);
const MSA_INDUSTRY_S = ok(MSA_INDUSTRY);
const NATIONAL_INDUSTRY_S = ok(NATIONAL_INDUSTRY);
const INDUSTRY_ATTRIBUTES_S = ok(INDUSTRY_ATTRIBUTES);
const EMPTY_MSA_INDUSTRY = empty<MsaIndustryRow>();

const SECTOR_EMPLOYMENT_S = empty<SectorEmploymentRow>();
const NATIONAL_SECTOR_S = empty<NationalSectorRow>();
const CITY_INDUSTRY_S = empty<CityIndustryRow>();
const COUNTY_DIRECTORY_S = empty<CountyDirectoryRow>();
const COUNTY_INDUSTRY_S = empty<CountyIndustryRow>();
const COUNTY_PANEL_S = empty<CountyPanelRow>();
const COUNTY_HOUSING_S = empty<CountyHousingRow>();
const COUNTY_MIGRATION_S = empty<CountyMigrationRow>();
const ZIP_DIRECTORY_S = empty<ZipDirectoryRow>();
const ZIP_PANEL_S = empty<ZipPanelRow>();
const ZIP_HOUSING_S = empty<ZipHousingRow>();

export const useCityDirectory = (): State<CityDirectoryRow[]> => CITY_DIRECTORY_S;
export const useCityPanel = (): State<CityPanelRow[]> => CITY_PANEL_S;
export const useSectorEmployment = (): State<SectorEmploymentRow[]> => SECTOR_EMPLOYMENT_S;
export const useNationalSector = (): State<NationalSectorRow[]> => NATIONAL_SECTOR_S;
export const useHousing = (): State<HousingRow[]> => CITY_HOUSING_S;
export const useCityIndustry = (): State<CityIndustryRow[]> => CITY_INDUSTRY_S;
export const useCityComplexity = (): State<CityComplexityRow[]> => CITY_COMPLEXITY_S;
export const useCountyDirectory = (): State<CountyDirectoryRow[]> => COUNTY_DIRECTORY_S;
export const useCountyIndustry = (): State<CountyIndustryRow[]> => COUNTY_INDUSTRY_S;
export const useCountyPanel = (): State<CountyPanelRow[]> => COUNTY_PANEL_S;
export const useCountyHousing = (): State<CountyHousingRow[]> => COUNTY_HOUSING_S;
export const useCountyMigration = (): State<CountyMigrationRow[]> => COUNTY_MIGRATION_S;
export const useZipDirectory = (): State<ZipDirectoryRow[]> => ZIP_DIRECTORY_S;
export const useZipPanel = (): State<ZipPanelRow[]> => ZIP_PANEL_S;
export const useZipHousing = (): State<ZipHousingRow[]> => ZIP_HOUSING_S;
export const usePlaceDirectory = (): State<PlaceDirectoryRow[]> => PLACE_DIRECTORY_S;
export const usePlacePanel = (): State<PlacePanelRow[]> => PLACE_PANEL_S;
export const usePlaceHousing = (): State<PlaceHousingRow[]> => PLACE_HOUSING_S;
export const useCityRent = (): State<CityRentRow[]> => CITY_RENT_S;
export const usePlaceRent = (): State<PlaceRentRow[]> => PLACE_RENT_S;
export const usePlaceFiscal = (): State<PlaceFiscalRow[]> => PLACE_FISCAL_S;
export const useMsaIndustry = (msaId: string): State<MsaIndustryRow[]> =>
  msaId ? MSA_INDUSTRY_S : EMPTY_MSA_INDUSTRY;
export const useNationalIndustry = (): State<NationalIndustryRow[]> => NATIONAL_INDUSTRY_S;
export const useIndustryAttributes = (): State<IndustryAttributeRow[]> => INDUSTRY_ATTRIBUTES_S;
