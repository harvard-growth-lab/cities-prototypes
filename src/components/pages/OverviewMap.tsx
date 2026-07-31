import { useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RefObject } from "react";

const CITY_POLY: [number, number][] = [
  // simplified Boston city boundary
  [42.397, -71.035],
  [42.386, -71.076],
  [42.353, -71.117],
  [42.355, -71.167],
  [42.335, -71.169],
  [42.342, -71.125],
  [42.318, -71.125],
  [42.295, -71.115],
  [42.255, -71.163],
  [42.227, -71.13],
  [42.25, -71.09],
  [42.272, -71.07],
  [42.28, -71.03],
  [42.31, -71.02],
  [42.33, -71.02],
  [42.36, -71.0],
  [42.37, -70.99],
  [42.39, -70.985],
];
const MSA_POLY: [number, number][] = [
  // simplified Boston MSA boundary
  [43.3, -71.05],
  [43.22, -70.82],
  [42.98, -70.75],
  [42.86, -70.8],
  [42.68, -70.6],
  [42.55, -70.85],
  [42.42, -70.92],
  [42.3, -70.87],
  [42.15, -70.6],
  [41.95, -70.55],
  [41.93, -70.85],
  [42.05, -71.05],
  [42.13, -71.3],
  [42.25, -71.5],
  [42.45, -71.55],
  [42.63, -71.55],
  [42.7, -71.3],
  [42.88, -71.4],
  [43.1, -71.25],
];

interface OverviewMapProps {
  /** the scrolling .pages container that drives the zoom */
  pagesRef: RefObject<HTMLElement | null>;
  /** the .ov-wrap block whose scroll progress maps to city -> msa zoom */
  wrapRef: RefObject<HTMLDivElement | null>;
  /** whether the map is currently laid out (tool active, explainers closed) */
  visible: boolean;
}

export function OverviewMap({ pagesRef, wrapRef, visible }: OverviewMapProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const ovZoom = useCallback(() => {
    const map = mapRef.current;
    const pages = pagesRef.current;
    const wrap = wrapRef.current;
    if (!map || !pages || !wrap) return;
    const range = wrap.offsetHeight - pages.clientHeight;
    if (range <= 0) return;
    const p = Math.min(1, Math.max(0, (pages.scrollTop - wrap.offsetTop) / range));
    const zoom = 11.4 - 2.9 * p; // city (11.4) -> msa (8.5)
    const lat = 42.33 + 0.22 * p,
      lng = -71.06 - 0.04 * p;
    map.setView([lat, lng], zoom, { animate: false });
  }, [pagesRef, wrapRef]);

  useEffect(() => {
    const el = mapEl.current;
    if (!el) return;
    const map = L.map(el, {
      zoomControl: false,
      zoomSnap: 0,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView([42.33, -71.06], 11.4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    L.polygon(MSA_POLY, {
      color: "#4a6a72",
      weight: 2,
      dashArray: "6 6",
      fillColor: "#255862",
      fillOpacity: 0.04,
    }).addTo(map);
    L.polygon(CITY_POLY, {
      color: "#255862",
      weight: 2,
      fillColor: "#255862",
      fillOpacity: 0.45,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pages = pagesRef.current;
    if (!pages) return;
    const onScroll = () => ovZoom();
    const onResize = () => {
      mapRef.current?.invalidateSize();
      ovZoom();
    };
    pages.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      pages.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [pagesRef, ovZoom]);

  /* the map initializes while the tool is display:none, so recompute the
     tile layout each time it actually becomes visible */
  useEffect(() => {
    if (visible && mapRef.current) {
      mapRef.current.invalidateSize();
      ovZoom();
    }
  }, [visible, ovZoom]);

  return <div id="ovMap" ref={mapEl}></div>;
}
