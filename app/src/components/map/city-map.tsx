/* The tool's one map: the metro as a dashed edge, the admin city as a solid
   patch, and — when asked — every place as a clickable cell. MapLibre stays
   inside this file so the chunk loads only where a map is on screen
   (lazy-import it: `lazy(() => import('@/components/map/city-map'))`). */
import { Layer, Map as MapGL, Marker, Source, type MapRef } from '@vis.gl/react-maplibre'
import { geoBounds, geoCentroid } from 'd3'
import { setWorkerUrl, type ExpressionSpecification, type MapLayerMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MetroGeo } from '@/data/types'
import { CHROME } from '@/lib/palette'
import { useReducedMotion } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/positron'

// maplibre-gl 6 looks for its worker next to its own module URL, which is not
// where a bundler puts it. Hand it the worker Vite builds instead.
setWorkerUrl(workerUrl)

type Feature = MetroGeo['features'][number]
type Bounds = [[number, number], [number, number]]
type Geo = 'city' | 'metro'

export interface CityMapProps {
  geo: MetroGeo
  /** which geography the camera frames */
  focus: Geo
  /** the admin place's id */
  cityId: string
  /** the metro's short name, for the callout chips */
  cityName?: string
  /** picker mode: these places become clickable cells */
  placeIds?: string[]
  selectedIds?: string[]
  onPlaceClick?: (id: string) => void
  /** false = a static picture (the geo dialog) */
  interactive?: boolean
  showCallouts?: boolean
  /** the chips open the geo dialog */
  onCalloutClick?: (geo: Geo) => void
  /** keep the basemap's place names (off by default: our layers name the places) */
  labels?: boolean
  className?: string
}

// MetroGeo is typed loosely on purpose (coordinates for either polygon kind);
// MapLibre wants the GeoJSON types, so the collection is cast once here.
const fc = (features: Feature[]) => ({ type: 'FeatureCollection', features }) as unknown as GeoJSON.FeatureCollection
const boundsOf = (f: Feature): Bounds => geoBounds(f as unknown as GeoJSON.Feature) as Bounds
const centroidOf = (f: Feature) => geoCentroid(f as unknown as GeoJSON.Feature)

/** The polygon's northernmost vertex — where the metro chip hangs, clear of the city. */
function topVertex(f: Feature): [number, number] {
  let best: [number, number] = [0, -90]
  const rings = f.geometry.type === 'Polygon' ? (f.geometry.coordinates as number[][][]) : (f.geometry.coordinates as number[][][][]).flat()
  for (const ring of rings) for (const [lng, lat] of ring) if (lat > best[1]) best = [lng, lat]
  return best
}

const CTL = 'flex size-[26px] items-center justify-center rounded-[5px] border border-line-strong bg-white text-[15px] font-bold text-teal shadow-[0_1px_3px_rgba(15,35,40,.12)] hover:bg-teal-tint max-narrow:size-[34px]'

export function CityMap({
  geo,
  focus,
  cityId,
  cityName,
  placeIds,
  selectedIds = [],
  onPlaceClick,
  interactive = true,
  showCallouts = true,
  onCalloutClick,
  labels = false,
  className,
}: CityMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [loaded, setLoaded] = useState(false)
  const [hover, setHover] = useState<{ id: string; name: string } | null>(null)
  const manual = useRef(false)
  const reduced = useReducedMotion()

  const metro = useMemo(() => geo.features.find((f) => f.properties.kind === 'metro'), [geo])
  const city = useMemo(() => geo.features.find((f) => f.properties.kind === 'place' && f.properties.id === cityId), [geo, cityId])
  const places = useMemo(() => {
    if (!placeIds) return []
    const want = new Set(placeIds)
    return geo.features.filter((f) => f.properties.kind === 'place' && f.properties.id !== cityId && want.has(f.properties.id))
  }, [geo, placeIds, cityId])
  const metroBounds = useMemo(() => (metro ? boundsOf(metro) : null), [metro])
  const cityBounds = useMemo(() => (city ? boundsOf(city) : null), [city])
  const metroTop = useMemo(() => (metro ? topVertex(metro) : null), [metro])
  const cityCentre = useMemo(() => (city ? centroidOf(city) : null), [city])
  const initial = useMemo(() => {
    const c = metro ? centroidOf(metro) : city ? centroidOf(city) : [-71, 42]
    return { longitude: c[0], latitude: c[1], zoom: 8 }
  }, [metro, city])

  const fit = useCallback(
    (which: Geo, animate: boolean) => {
      const map = mapRef.current?.getMap()
      if (!map) return
      const duration = animate && !reduced ? 900 : 0
      if (which === 'city' && cityBounds) {
        // one zoom level out from the city's own frame: the city with its surroundings
        const cam = map.cameraForBounds(cityBounds, { padding: 28 })
        if (!cam) return
        const target = { center: cam.center, zoom: (cam.zoom ?? 10) - 1 }
        if (duration) map.flyTo({ ...target, duration, essential: true })
        else map.jumpTo(target)
      } else if (metroBounds) {
        // room above for the metro chip, which hangs off the polygon's top vertex
        map.fitBounds(metroBounds, { padding: { top: 64, right: 28, bottom: 28, left: 28 }, duration })
      }
    },
    [cityBounds, metroBounds, reduced],
  )

  useEffect(() => {
    if (!loaded || manual.current) return
    fit(focus, true)
  }, [focus, loaded, fit])

  // the frame changes size (a dialog opening, the narrow band): re-frame, unless the reader took the wheel
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host || !loaded) return
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false
        return
      }
      if (!manual.current) fit(focus, false)
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [loaded, fit, focus])

  const onLoad = () => {
    const map = mapRef.current?.getMap()
    if (map && !labels) for (const l of map.getStyle().layers) if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', 'none')
    setLoaded(true)
    fit(focus, false)
  }

  const picker = places.length > 0
  const placeFill: ExpressionSpecification = ['case', ['in', ['get', 'id'], ['literal', selectedIds]], CHROME.orange, '#8aa0a6']
  const placeOpacity: ExpressionSpecification = [
    'case',
    ['==', ['get', 'id'], hover?.id ?? ''],
    0.3,
    ['in', ['get', 'id'], ['literal', selectedIds]],
    0.38,
    0.07,
  ]
  const placeStroke: ExpressionSpecification = ['case', ['in', ['get', 'id'], ['literal', selectedIds]], CHROME.orange, '#55666b']

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    const id = f?.properties?.id as string | undefined
    const name = f?.properties?.name as string | undefined
    setHover(id && name ? { id, name } : null)
  }

  return (
    <div ref={hostRef} className={cn('relative h-full w-full bg-[#eceef0]', className)}>
      <MapGL
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={initial}
        style={{ width: '100%', height: '100%' }}
        interactive={interactive}
        scrollZoom={false}
        dragRotate={false}
        touchPitch={false}
        attributionControl={{ compact: true }}
        interactiveLayerIds={picker && interactive ? ['places-fill'] : []}
        cursor={hover ? 'pointer' : interactive ? 'grab' : 'default'}
        onLoad={onLoad}
        onMouseMove={picker ? onMove : undefined}
        onMouseLeave={picker ? () => setHover(null) : undefined}
        onClick={picker && onPlaceClick ? (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined
          if (id) onPlaceClick(id)
        } : undefined}
      >
        {metro && (
          <Source id="metro" type="geojson" data={fc([metro])}>
            <Layer id="metro-fill" type="fill" paint={{ 'fill-color': CHROME.geoCity, 'fill-opacity': 0.04 }} />
            <Layer id="metro-line" type="line" paint={{ 'line-color': CHROME.geoMetro, 'line-width': 2, 'line-dasharray': [3, 3] }} />
          </Source>
        )}
        {picker && (
          <Source id="places" type="geojson" data={fc(places)}>
            <Layer id="places-fill" type="fill" paint={{ 'fill-color': placeFill, 'fill-opacity': placeOpacity }} />
            <Layer id="places-line" type="line" paint={{ 'line-color': placeStroke, 'line-width': 1 }} />
          </Source>
        )}
        {city && (
          <Source id="city" type="geojson" data={fc([city])}>
            <Layer id="city-fill" type="fill" paint={{ 'fill-color': CHROME.geoCity, 'fill-opacity': picker ? 0.16 : 0.45 }} />
            <Layer id="city-line" type="line" paint={{ 'line-color': CHROME.geoCity, 'line-width': picker ? 1.2 : 2 }} />
          </Source>
        )}
        {showCallouts && cityCentre && (
          <Marker longitude={cityCentre[0]} latitude={cityCentre[1]} anchor="right">
            <div className="flex items-center">
              <Callout geo="city" label={`${cityName ?? city?.properties.name ?? 'Admin'} admin`} onClick={onCalloutClick} />
              <svg width="30" height="6" aria-hidden>
                <line x1="0" y1="3" x2="27" y2="3" stroke={CHROME.geoCity} strokeWidth="1.2" />
                <circle cx="27" cy="3" r="2.6" fill={CHROME.geoCity} />
              </svg>
            </div>
          </Marker>
        )}
        {showCallouts && metroTop && focus === 'metro' && (
          <Marker longitude={metroTop[0]} latitude={metroTop[1]} anchor="bottom">
            <div className="flex flex-col items-center">
              <Callout geo="metro" label={`${cityName ?? metro?.properties.name ?? 'Metro'} metro`} onClick={onCalloutClick} />
              <svg width="6" height="22" aria-hidden>
                <line x1="3" y1="0" x2="3" y2="19" stroke={CHROME.geoMetro} strokeWidth="1.2" strokeDasharray="4 4" />
                <circle cx="3" cy="19" r="2.6" fill={CHROME.geoMetro} />
              </svg>
            </div>
          </Marker>
        )}
      </MapGL>

      {interactive && (
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5">
          <button type="button" className={CTL} title="Zoom in" onClick={() => { manual.current = true; mapRef.current?.getMap().zoomIn({ duration: reduced ? 0 : 300 }) }}>+</button>
          <button type="button" className={CTL} title="Zoom out" onClick={() => { manual.current = true; mapRef.current?.getMap().zoomOut({ duration: reduced ? 0 : 300 }) }}>−</button>
          <button type="button" className={CTL} title="Reset view" onClick={() => { manual.current = false; fit(focus, true) }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 8a5 5 0 1 0 1.5-3.6" />
              <path d="M3 2.5v3h3" />
            </svg>
          </button>
        </div>
      )}

      {hover && (
        <div className="pointer-events-none absolute top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-[4px] border border-line-strong bg-white px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
          {hover.name}
        </div>
      )}
    </div>
  )
}

function Callout({ geo, label, onClick }: { geo: Geo; label: string; onClick?: (geo: Geo) => void }) {
  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(geo) : undefined}
      tabIndex={onClick ? 0 : -1}
      className={cn(
        'rounded-[3px] px-2 py-[3px] text-[10px] font-bold whitespace-nowrap text-white shadow-[0_1px_4px_rgba(15,35,40,.25)]',
        geo === 'city' ? 'bg-geo-city' : 'bg-geo-metro',
        !onClick && 'cursor-default',
      )}
    >
      {label}
    </button>
  )
}

export default CityMap
