/**
 * Boston MSA geometry — real simplified boundaries (Census cartographic
 * files, one-time static asset; the DATA drawn on them stays placeholder).
 * Layers: msa (CBSA 14460), counties (7), munis (197 county subdivisions).
 */

import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import topoRaw from "./boston-geo.json";

type Props = { NAME?: string; GEOID?: string };
const topo = topoRaw as unknown as Topology<{
  msa: GeometryCollection<Props>;
  counties: GeometryCollection<Props>;
  munis: GeometryCollection<Props>;
}>;

export const MSA_FC = feature(topo, topo.objects.msa) as FeatureCollection<Geometry, Props>;
export const COUNTIES_FC = feature(topo, topo.objects.counties) as FeatureCollection<Geometry, Props>;
export const MUNIS_FC = feature(topo, topo.objects.munis) as FeatureCollection<Geometry, Props>;

export const BOSTON_F = MUNIS_FC.features.find((f) => f.properties?.NAME === "Boston")!;

export interface MapLayout {
  w: number;
  h: number;
  path: (obj: GeoPermissibleObjects) => string;
  centroid: (f: Feature<Geometry, Props>) => [number, number];
  /** px per km at map center (approx), for distance rings */
  pxPerKm: number;
}

const layoutCache = new Map<string, MapLayout>();

export function mapLayout(w: number, h: number, pad = 6): MapLayout {
  const key = `${w}x${h}x${pad}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const proj = geoMercator().fitExtent(
    [
      [pad, pad],
      [w - pad, h - pad],
    ],
    MSA_FC,
  );
  const gp = geoPath(proj);
  // approx scale: project two points 1° of longitude apart at map center lat
  const c = proj([-71.06, 42.36])!;
  const c2 = proj([-71.06 + 1, 42.36])!;
  const kmPerDegLon = 111.32 * Math.cos((42.36 * Math.PI) / 180);
  const layout: MapLayout = {
    w,
    h,
    path: (o) => gp(o) ?? "",
    centroid: (f) => gp.centroid(f) as [number, number],
    pxPerKm: (c2[0] - c[0]) / kmPerDegLon,
  };
  layoutCache.set(key, layout);
  return layout;
}

export const muniByName = (name: string) =>
  MUNIS_FC.features.find((f) => f.properties?.NAME === name);

export const muniName = (f: Feature<Geometry, Props>) => f.properties?.NAME ?? "";
