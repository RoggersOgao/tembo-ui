import type mapboxgl from 'mapbox-gl'

export const addRouteToMap = (
  map: mapboxgl.Map,
  routeGeometry: GeoJSON.Geometry,
  isNavigating: boolean,
  theme: 'light' | 'dark'
) => {
  if (!map.isStyleLoaded()) return;

  try {
    // Remove existing route layers & source
    if (map.getSource('route')) {
      ['route', 'route-glow', 'route-outline'].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      map.removeSource('route');
    }

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: routeGeometry,
        properties: {},
      },
    });

    const lineWidth = isNavigating ? 6 : 4;
    const glowWidth = isNavigating ? 10 : 8;
    const outlineWidth = isNavigating ? 14 : 12;

    // Outline
    map.addLayer({
      id: 'route-outline',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': theme === 'dark' ? '#3b82f6' : '#1d4ed8',
        'line-width': outlineWidth,
        'line-opacity': 0.35,
        'line-blur': 4,
      },
    });

    // Glow
    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': theme === 'dark' ? '#60a5fa' : '#3b82f6',
        'line-width': glowWidth,
        'line-opacity': 0.55,
        'line-blur': 2,
      },
    });

    // Main route
    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': theme === 'dark' ? '#93c5fd' : '#60a5fa',
        'line-width': lineWidth,
      },
    });
  } catch (err) {
    console.error('Error adding route to map:', err);
  }
};
