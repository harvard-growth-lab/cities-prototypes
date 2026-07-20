/**
 * Static replacement for the geojson hooks. Same type exports + hook names as
 * cities-tool, but the FeatureCollections come from staticGeo.ts (the bundled
 * Boston-MSA TopoJSON reshaped) instead of fetched files. Results are stable
 * module-level constants so react-leaflet's (key, data) pairs stay consistent.
 */

import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type MsaProps = { city_id: string; city_name: string; kind?: string };
export type MsaFeature = Feature<Polygon | MultiPolygon, MsaProps>;
export type MsaFeatureCollection = FeatureCollection<Polygon | MultiPolygon, MsaProps>;

export type CountyProps = { county_id: string; county_name: string; kind?: string };
export type CountyFeature = Feature<Polygon | MultiPolygon, CountyProps>;
export type CountyFeatureCollection = FeatureCollection<Polygon | MultiPolygon, CountyProps>;

export type ZctaProps = { zip: string; kind?: string };
export type ZctaFeature = Feature<Polygon | MultiPolygon, ZctaProps>;
export type ZctaFeatureCollection = FeatureCollection<Polygon | MultiPolygon, ZctaProps>;

export type PlaceProps = {
  place_id: string;
  place_name: string;
  place_long_name?: string;
  lsad?: string;
  kind?: string;
};
export type PlaceFeature = Feature<Polygon | MultiPolygon, PlaceProps>;
export type PlaceFeatureCollection = FeatureCollection<Polygon | MultiPolygon, PlaceProps>;

import { MSA_GEO_FC, MSA_PLACES_GEO_FC, placeGeoFC } from "./staticGeo";

type State<T> = { data: T | null; loading: boolean; error: Error | null };
const ok = <T>(data: T): State<T> => ({ data, loading: false, error: null });

const MSA_GEO_S = ok(MSA_GEO_FC);
const MSA_PLACES_GEO_S = ok(MSA_PLACES_GEO_FC);
const EMPTY_COUNTY: State<CountyFeatureCollection> = ok({ type: "FeatureCollection", features: [] });
const EMPTY_ZCTA: State<ZctaFeatureCollection> = ok({ type: "FeatureCollection", features: [] });

// Cache single-place FeatureCollections so identity is stable across renders.
const placeCache = new Map<string, State<PlaceFeatureCollection>>();
function placeState(placeId: string): State<PlaceFeatureCollection> {
  let s = placeCache.get(placeId);
  if (!s) {
    s = ok(placeGeoFC(placeId));
    placeCache.set(placeId, s);
  }
  return s;
}

export function useMsaGeo(_cityId: string): State<MsaFeatureCollection> {
  return MSA_GEO_S;
}
export function useCountyGeo(_countyId: string): State<CountyFeatureCollection> {
  return EMPTY_COUNTY;
}
export function useZctaGeo(_zip: string): State<ZctaFeatureCollection> {
  return EMPTY_ZCTA;
}
export function usePlaceGeo(placeId: string): State<PlaceFeatureCollection> {
  return placeState(placeId);
}
export function useMsaPlacesGeo(_msaId: string): State<PlaceFeatureCollection> {
  return MSA_PLACES_GEO_S;
}
