import mapboxgl from "mapbox-gl";

export const MAPBOX_ACCESS_TOKEN = String(
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ""
).trim();

export const CM_OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

export const CM_MAPBOX_DEFAULT_CENTER = Object.freeze([-104.292, 19.081]);

const isPublicMapboxToken = (token) => /^pk\.[A-Za-z0-9._-]+$/.test(token);

if (!MAPBOX_ACCESS_TOKEN) {
  console.error(
    "Falta VITE_MAPBOX_ACCESS_TOKEN. Copia .env.example a .env.local y agrega un token público restringido de Mapbox."
  );
} else if (!isPublicMapboxToken(MAPBOX_ACCESS_TOKEN)) {
  throw new Error(
    "VITE_MAPBOX_ACCESS_TOKEN debe ser un token público de Mapbox que comience con pk. Nunca uses un token secreto sk. en el navegador."
  );
}

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

export const cmMapboxTileUrl = (url = "") =>
  String(url).replace("{s}", "a").replace("{r}", "");

export const cmToLngLat = (coords) =>
  Array.isArray(coords) && coords.length >= 2
    ? [Number(coords[1]), Number(coords[0])]
    : [...CM_MAPBOX_DEFAULT_CENTER];

export const cmToGeoJsonCoords = (coords = []) =>
  (coords || []).map((coordinate) =>
    Array.isArray(coordinate?.[0])
      ? cmToGeoJsonCoords(coordinate)
      : cmToLngLat(coordinate)
  );

export const cmRasterStyle = (
  tileUrl,
  attribution = CM_OSM_ATTRIBUTION
) => ({
  version: 8,
  sources: {
    "cm-raster": {
      type: "raster",
      tiles: [cmMapboxTileUrl(tileUrl)],
      tileSize: 256,
      attribution,
    },
  },
  layers: [
    {
      id: "cm-background",
      type: "background",
      paint: { "background-color": "#06111f" },
    },
    {
      id: "cm-raster-layer",
      type: "raster",
      source: "cm-raster",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
});

export class MapboxAdapter {
  constructor(map) {
    if (!(map instanceof mapboxgl.Map)) {
      throw new TypeError("MapboxAdapter requiere una instancia de mapboxgl.Map.");
    }
    this.map = map;
    this.markers = new Map();
    this.layerIds = new Set();
    this.sourceIds = new Set();
    this.destroyed = false;
  }

  assertReady() {
    if (this.destroyed || !this.map) {
      throw new Error("El mapa Mapbox no está disponible.");
    }
  }

  centerMap(coords, zoom) {
    this.assertReady();
    this.map.easeTo({
      center: cmToLngLat(coords),
      ...(Number.isFinite(zoom) ? { zoom } : {}),
      duration: 450,
    });
  }

  changeZoom(zoom) {
    this.assertReady();
    this.map.easeTo({
      zoom: Math.max(0, Math.min(22, Number(zoom) || 0)),
      duration: 250,
    });
  }

  zoomIn() {
    this.assertReady();
    this.map.zoomIn({ duration: 220 });
  }

  zoomOut() {
    this.assertReady();
    this.map.zoomOut({ duration: 220 });
  }

  addMarker({
    id,
    coords,
    element,
    draggable = false,
    popupHtml = "",
    onDragEnd,
    onClick,
  }) {
    this.assertReady();
    this.removeMarker(id);

    const marker = new mapboxgl.Marker({ element, draggable }).setLngLat(
      cmToLngLat(coords)
    );

    if (popupHtml) {
      marker.setPopup(
        new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml)
      );
    }

    if (onDragEnd) {
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        onDragEnd([point.lat, point.lng], marker);
      });
    }

    if (onClick && element) {
      element.addEventListener("click", onClick);
    }

    marker.addTo(this.map);
    this.markers.set(id, marker);
    return marker;
  }

  removeMarker(id) {
    const marker = this.markers.get(id);
    marker?.remove();
    this.markers.delete(id);
  }

  clearMarkers() {
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
  }

  addGeoJsonLayer({ sourceId, data, layers }) {
    this.assertReady();
    this.removeGeoJsonLayer(sourceId);
    this.map.addSource(sourceId, { type: "geojson", data });
    this.sourceIds.add(sourceId);

    (layers || []).forEach((layer) => {
      this.map.addLayer({ ...layer, source: sourceId });
      this.layerIds.add(layer.id);
    });
  }

  updateGeoJson(sourceId, data) {
    this.assertReady();
    const source = this.map.getSource(sourceId);
    source?.setData?.(data);
  }

  removeGeoJsonLayer(sourceId) {
    if (!this.map) return;

    [...this.layerIds].forEach((id) => {
      const layer = this.map.getLayer(id);
      if (layer?.source === sourceId) {
        this.map.removeLayer(id);
        this.layerIds.delete(id);
      }
    });

    if (this.map.getSource(sourceId)) {
      this.map.removeSource(sourceId);
    }
    this.sourceIds.delete(sourceId);
  }

  clearLayers() {
    if (!this.map) return;

    [...this.layerIds].reverse().forEach((id) => {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    });
    [...this.sourceIds].forEach((id) => {
      if (this.map.getSource(id)) this.map.removeSource(id);
    });

    this.layerIds.clear();
    this.sourceIds.clear();
  }

  clearAll() {
    this.clearMarkers();
    this.clearLayers();
  }

  dispose() {
    if (this.destroyed) return;
    this.clearAll();
    this.destroyed = true;
    this.map = null;
  }
}

export default mapboxgl;
