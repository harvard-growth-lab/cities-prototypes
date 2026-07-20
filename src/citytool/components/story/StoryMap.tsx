import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { useMsaGeo, usePlaceGeo } from '../../data/useMsaGeo';
import { GL } from '../../lib/glColors';

// The headline animation. ONE Leaflet instance, pinned full-viewport behind the
// story (the map sections have transparent backgrounds and overlay a card). As
// the reader moves section 1 → 2 we fly the same map from the place's bounds out
// to the whole MSA's bounds while the MSA outline fades in — a continuous
// zoom-out rather than a swap. `dim` hides the stage once the story leaves the
// map sections so later (opaque) sections sit cleanly on top.

type Zoom = 'place' | 'msa';

type Props = {
  placeId: string;
  msaId: string;
  zoom: Zoom;
  dim: boolean;
};

const HIGHLIGHT = GL.c2;       // the focus place — identity red
const MSA_OUTLINE = GL.ink3;   // surrounding metro outline

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const PLACE_STYLE: L.PathOptions = {
  color: HIGHLIGHT,
  weight: 2,
  fillColor: HIGHLIGHT,
  fillOpacity: 0.45,
};

// Mount style for the MSA outline (hidden until the story zooms out). Must be
// a module constant: react-leaflet re-applies `style` whenever the prop's
// identity changes — with an inline object that's every re-render, silently
// resetting the outline to hidden (e.g. when `dim` flips as the reader scrolls
// back up). Visibility is driven imperatively in the zoom effect below.
const MSA_HIDDEN_STYLE: L.PathOptions = {
  color: MSA_OUTLINE,
  weight: 1.5,
  dashArray: '5 5',
  opacity: 0,
  fillOpacity: 0,
};

function extendBbox(bbox: number[], coords: unknown): void {
  if (Array.isArray(coords) && typeof coords[0] === 'number') {
    const [x, y] = coords as [number, number];
    if (x < bbox[0]) bbox[0] = x;
    if (y < bbox[1]) bbox[1] = y;
    if (x > bbox[2]) bbox[2] = x;
    if (y > bbox[3]) bbox[3] = y;
    return;
  }
  if (Array.isArray(coords)) for (const c of coords) extendBbox(bbox, c);
}

function boundsOf(fc: FeatureCollection<Polygon | MultiPolygon> | null): L.LatLngBounds | null {
  if (!fc || fc.features.length === 0) return null;
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of fc.features) {
    if (f.geometry && 'coordinates' in f.geometry) extendBbox(bbox, f.geometry.coordinates);
  }
  const [w, s, e, n] = bbox;
  if (!Number.isFinite(w)) return null;
  return L.latLngBounds([s, w], [n, e]);
}

export default function StoryMap({ placeId, msaId, zoom, dim }: Props) {
  const placeGeo = usePlaceGeo(placeId);
  const msaGeo = useMsaGeo(msaId);
  // The map and MSA layer live in STATE, not refs. react-leaflet v4 assigns
  // its forwarded ref a commit AFTER the map is created — and with all-static
  // data every effect dep below (zoom, bounds) is ready on the first render,
  // so ref-guarded effects would run exactly once, see null, and never re-run:
  // the map stayed on its broken creation-time fit until a scroll changed
  // `zoom`. State makes instance arrival itself re-run the effects.
  const [map, setMap] = useState<L.Map | null>(null);
  const [msaLayer, setMsaLayer] = useState<L.GeoJSON | null>(null);
  const mapRefCb = useCallback((m: L.Map | null) => setMap(m), []);
  const msaLayerRefCb = useCallback(
    (layer: unknown) => setMsaLayer((layer as L.GeoJSON | null) ?? null),
    [],
  );
  // First positioning should be an instant fit, not a 1.3s fly out of the
  // broken creation-time view.
  const didFitRef = useRef(false);
  useEffect(() => {
    didFitRef.current = false;
  }, [map]);
  // The current zoom target, readable from the resize observer below without
  // making `zoom` one of its deps (re-observing on every zoom change fires the
  // observer's initial ping, which would instantly snap the 1.3s fly).
  const targetRef = useRef<L.LatLngBounds | null>(null);

  const placeFc = (placeGeo.data ?? null) as FeatureCollection<Polygon | MultiPolygon> | null;
  const msaFc = (msaGeo.data ?? null) as FeatureCollection<Polygon | MultiPolygon> | null;

  const placeBounds = useMemo(() => boundsOf(placeFc), [placeFc]);
  const msaBounds = useMemo(() => boundsOf(msaFc), [msaFc]);

  // The initial view — place if we have it, else the MSA.
  const initialBounds = placeBounds ?? msaBounds;

  // Fly between the place and the MSA as the active section changes. Longer
  // duration than the per-page maps (0.4s) for a deliberate, cinematic zoom —
  // but respect prefers-reduced-motion and jump straight to the target.
  useEffect(() => {
    const target = zoom === 'msa' ? msaBounds ?? placeBounds : placeBounds ?? msaBounds;
    targetRef.current = target;
    if (!map || !target) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !didFitRef.current) {
      // First fit (or reduced motion): re-measure — the container may have been
      // zero-height when Leaflet initialised — and jump straight to the target.
      map.invalidateSize();
      map.fitBounds(target, { padding: [60, 60] });
      didFitRef.current = true;
    } else {
      map.flyToBounds(target, { padding: [60, 60], duration: 1.3 });
    }
  }, [map, zoom, placeBounds, msaBounds]);

  // Fade the MSA outline with the zoom. react-leaflet only applies <GeoJSON
  // style> on mount, so drive opacity imperatively through the layer ref.
  useEffect(() => {
    if (!msaLayer) return;
    msaLayer.setStyle({
      color: MSA_OUTLINE,
      weight: 1.5,
      dashArray: '5 5',
      opacity: zoom === 'msa' ? 0.9 : 0,
      fillColor: MSA_OUTLINE,
      fillOpacity: zoom === 'msa' ? 0.05 : 0,
    });
  }, [msaLayer, zoom, msaFc]);

  // Leaflet sizes itself on mount; if the stage was display:none-ish it can
  // render with a stale size. Invalidate when un-dimming.
  useEffect(() => {
    if (!dim) map?.invalidateSize();
  }, [map, dim]);

  // The theme stylesheet is injected as a <link> after mount (see main.tsx), so
  // the fixed map stage can start at zero height and Leaflet fits to a stale box.
  // Watch the container, but only re-fit when Leaflet's cached size disagrees
  // with the real one — the observer's initial ping and the place↔MSA fly must
  // NOT trigger a snap (deps are [map] alone for the same reason: re-observing
  // on zoom changes would ping mid-flight and cut the animation short).
  useEffect(() => {
    if (!map) return;
    const el = map.getContainer();
    const ro = new ResizeObserver(() => {
      const real = el.getBoundingClientRect();
      const cached = map.getSize();
      if (Math.abs(real.width - cached.x) < 2 && Math.abs(real.height - cached.y) < 2) return;
      map.invalidateSize();
      if (targetRef.current) map.fitBounds(targetRef.current, { padding: [60, 60] });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  if (!initialBounds) {
    return <div className={`story-map-stage${dim ? ' is-dim' : ''}`} aria-hidden />;
  }

  return (
    <div className={`story-map-stage${dim ? ' is-dim' : ''}`} aria-hidden={dim}>
      <MapContainer
        bounds={initialBounds}
        boundsOptions={{ padding: [60, 60] }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl
        dragging={false}
        doubleClickZoom={false}
        style={{ width: '100%', height: '100%' }}
        ref={mapRefCb}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={18} />
        {/* interactive={false}: these layers are pure decoration, but Leaflet's
            default interactive paths re-enable pointer-events inside this
            pointer-events:none stage — and because the stage is position:fixed,
            wheel events over a polygon scroll-chain to the (overflow:hidden)
            viewport instead of the story scroller, killing scrolling wherever
            the cursor sat on the highlighted city. */}
        {msaFc && (
          <GeoJSON
            key={`story-msa-${msaId}`}
            data={msaFc}
            style={MSA_HIDDEN_STYLE}
            interactive={false}
            ref={msaLayerRefCb}
          />
        )}
        {placeFc && (
          <GeoJSON key={`story-place-${placeId}`} data={placeFc} style={PLACE_STYLE} interactive={false} />
        )}
      </MapContainer>
    </div>
  );
}
