/**
 * Static geo for the CityStory port — built from the sandbox's bundled Boston-MSA
 * TopoJSON (src/geo/boston-geo.json, exposed by src/geo/geo.ts) and reshaped into
 * the FeatureCollections cities-tool's maps expect (property names place_id /
 * place_name / city_id / city_name). Replaces the parquet-era per-file geojson.
 */

import type { Feature, Geometry, Polygon, MultiPolygon } from "geojson";
import { MSA_FC, MUNIS_FC, BOSTON_F } from "../geo/geo";
import type { PlaceFeatureCollection, MsaFeatureCollection } from "./useMsaGeo";

export const MSA_ID = "14460";
export const BOSTON_PLACE_ID = "2507000";

type GeoFeature = Feature<Geometry, { NAME?: string; GEOID?: string }>;

/** Boston keeps the canonical place GEOID; every other muni uses its own GEOID. */
export function placeIdOf(f: GeoFeature): string {
  if (f === BOSTON_F || f.properties?.NAME === "Boston") return BOSTON_PLACE_ID;
  return f.properties?.GEOID ?? f.properties?.NAME ?? "";
}

export interface MuniRef {
  place_id: string;
  place_name: string;
}

/** The 197 municipalities, as (place_id, place_name) — the join key for panels. */
export const MUNI_REFS: MuniRef[] = (MUNIS_FC.features as GeoFeature[]).map((f) => ({
  place_id: placeIdOf(f),
  place_name: f.properties?.NAME ?? "",
}));

const geom = (f: GeoFeature) => f.geometry as Polygon | MultiPolygon;

/** One Feature per municipality — the "places in this MSA" choropleth reads this. */
export const MSA_PLACES_GEO_FC: PlaceFeatureCollection = {
  type: "FeatureCollection",
  features: (MUNIS_FC.features as GeoFeature[]).map((f) => ({
    type: "Feature",
    geometry: geom(f),
    properties: { place_id: placeIdOf(f), place_name: f.properties?.NAME ?? "", kind: "place" },
  })),
};

/** The dissolved MSA outline — the StoryMap backdrop's zoom-out target. */
export const MSA_GEO_FC: MsaFeatureCollection = {
  type: "FeatureCollection",
  features: (MSA_FC.features as GeoFeature[]).map((f) => ({
    type: "Feature",
    geometry: geom(f),
    properties: { city_id: MSA_ID, city_name: "Boston", kind: "msa" },
  })),
};

/** A single-place FeatureCollection (the StoryMap's place-zoom target). */
export function placeGeoFC(placeId: string): PlaceFeatureCollection {
  const f =
    (MUNIS_FC.features as GeoFeature[]).find((ff) => placeIdOf(ff) === placeId) ??
    (BOSTON_F as GeoFeature);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: geom(f),
        properties: { place_id: placeId, place_name: f.properties?.NAME ?? "", kind: "place" },
      },
    ],
  };
}
