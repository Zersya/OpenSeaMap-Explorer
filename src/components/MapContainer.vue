<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useMapStore } from '@/stores/mapStore';
import { getUserLocation } from '@/utils/geolocation';
import {
  getOpenSeaMapTileUrl,
  getDepthWmsUrl,
  checkTileServerAccess,
  fetchHarborFacilities
} from '@/services/maritimeService';
import type { HarborFacility } from '@/types/maritime';
import LoadingIndicator from './LoadingIndicator.vue';
import 'leaflet/dist/leaflet.css';

const emit = defineEmits<{
  (e: 'map-ready', instance: any): void;
}>();

// Import Leaflet dynamically to avoid SSR issues
let L: any;

// Map instance
const mapInstance = ref<any>(null);
const mapElement = ref<HTMLElement | null>(null);
const isMapLoading = ref(true);
const mapError = ref<string | null>(null);

// Cursor position
const cursorPosition = ref<[number, number] | null>(null);

// Layers
const baseTileLayer = ref<any>(null);
const seaMarkLayer = ref<any>(null);
const harborLayer = ref<any>(null); // This will be a feature group for harbor markers
const depthLayer10m = ref<any>(null); // WMS layer for 10m depth data
const depthLayer100m = ref<any>(null); // WMS layer for 100m depth data
const gridLayer = ref<any>(null); // This will be a feature group for coordinate grid lines

// Data
const harborFacilities = ref<HarborFacility[]>([]);
const currentDepthResolution = ref<'10m' | '100m'>('10m'); // Default to 10m resolution

// Store
const mapStore = useMapStore();

// Check if a layer is properly loaded
const checkLayerLoaded = (layer: any, name: string) => {
  if (!layer) {
    console.error(`${name} layer is not initialized`);
    return false;
  }

  console.log(`${name} layer is initialized`);
  return true;
};

// Force reload a layer
const forceReloadLayer = (layerType: string, layerRef: any) => {
  console.log(`Force reloading ${layerType} layer`);

  // Remove the layer if it exists on the map
  if (mapInstance.value && mapInstance.value.hasLayer(layerRef.value)) {
    mapInstance.value.removeLayer(layerRef.value);
  }

  // Create a new layer instance
  layerRef.value = L.tileLayer(getOpenSeaMapTileUrl(layerType), {
    maxZoom: 18,
  });

  return layerRef.value;
};

// Initialize the map
const initializeMap = async () => {
  try {
    isMapLoading.value = true;
    mapError.value = null;

    // Load Leaflet dynamically
    if (!L) {
      L = await import('leaflet');
    }

    // Check if the OpenSeaMap tile server is accessible
    const serverAccessible = await checkTileServerAccess();
    console.log('OpenSeaMap tile server accessible:', serverAccessible);

    if (!serverAccessible) {
      console.warn('OpenSeaMap tile server is not accessible. Some layers may not load correctly.');
    }

    // Get user location or use default
    let initialCenter: [number, number];
    try {
      initialCenter = await getUserLocation();
      mapStore.setUserLocation(initialCenter);
    } catch (error) {
      console.warn('Failed to get user location, using default:', error);
      initialCenter = mapStore.mapSettings.center;
    }

    // Create map instance if it doesn't exist
    if (!mapInstance.value && mapElement.value) {
      mapInstance.value = L.map(mapElement.value, {
        center: initialCenter,
        zoom: mapStore.mapSettings.zoom,
        zoomControl: false, // We'll add custom zoom controls
        attributionControl: true,
      });

      // Add zoom control to the top right
      L.control.zoom({
        position: 'topright'
      }).addTo(mapInstance.value);

      // Add scale control
      L.control.scale({
        imperial: true,
        metric: true,
        position: 'bottomright'
      }).addTo(mapInstance.value);

      // Add base tile layer (OpenStreetMap)
      baseTileLayer.value = L.tileLayer(getOpenSeaMapTileUrl('base'), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://openseamap.org">OpenSeaMap</a>',
        maxZoom: 18,
      }).addTo(mapInstance.value);

      // Initialize other layers but don't add them yet
      seaMarkLayer.value = L.tileLayer(getOpenSeaMapTileUrl('seamark'), {
        maxZoom: 18,
      });

      // Initialize harbor layer as a feature group
      harborLayer.value = L.featureGroup();

      // Initialize depth layers as WMS layers
      depthLayer10m.value = L.tileLayer.wms(getDepthWmsUrl('10m'), {
        format: 'image/png',
        transparent: true,
        attribution: '&copy; <a href="https://openseamap.org">OpenSeaMap</a> contributors',
        maxZoom: 18
      });

      depthLayer100m.value = L.tileLayer.wms(getDepthWmsUrl('100m'), {
        format: 'image/png',
        transparent: true,
        attribution: '&copy; <a href="https://openseamap.org">OpenSeaMap</a> contributors',
        maxZoom: 18
      });

      // Initialize grid layer as a feature group
      gridLayer.value = L.featureGroup();

      // Set up map event listeners
      mapInstance.value.on('moveend', handleMapMoveEnd);
      mapInstance.value.on('zoomend', handleMapZoomEnd);
      mapInstance.value.on('mousemove', handleMouseMove);
      mapInstance.value.on('mouseout', handleMouseOut);

      // Load saved layer visibility settings
      mapStore.loadSettings();

      // Log the initial layer states
      console.log('Initial layer states:', JSON.stringify(mapStore.mapSettings.layers));

      // Update layer visibility based on saved settings
      updateLayerVisibility();

      // Emit the map-ready event
      emit('map-ready', mapInstance.value);
    }
  } catch (error) {
    console.error('Error initializing map:', error);
    mapError.value = 'Failed to initialize map. Please try refreshing the page.';
  } finally {
    isMapLoading.value = false;
  }
};

// Load harbor facilities
const loadHarborFacilities = async () => {
  if (!mapInstance.value) return;

  try {
    // Set loading state
    mapStore.setLayerLoading('harborFacilities', true);

    // Get current map bounds
    const bounds = mapInstance.value.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Fetch harbor facilities
    const harbors = await fetchHarborFacilities([
      [sw.lat, sw.lng],
      [ne.lat, ne.lng]
    ]);

    // Update harbor facilities
    harborFacilities.value = harbors;

    // Update layer state
    mapStore.updateLayerTimestamp('harborFacilities');
    mapStore.setLayerError('harborFacilities', null);

    console.log(`Loaded ${harbors.length} harbor facilities`);

    // Update the map
    updateHarborMarkers();
  } catch (error) {
    console.error('Error loading harbor facilities:', error);
    mapStore.setLayerError('harborFacilities', 'Failed to load harbor facilities');
  } finally {
    mapStore.setLayerLoading('harborFacilities', false);
  }
};

// Toggle depth resolution between 10m and 100m
const toggleDepthResolution = () => {
  if (!mapInstance.value) return;

  // Toggle resolution
  currentDepthResolution.value = currentDepthResolution.value === '10m' ? '100m' : '10m';

  console.log(`Switched depth resolution to ${currentDepthResolution.value}`);

  // Update the visible layer
  updateDepthLayerVisibility();
};

// Update depth layer visibility based on current resolution
const updateDepthLayerVisibility = () => {
  if (!mapInstance.value) return;

  try {
    // Set loading state
    mapStore.setLayerLoading('depthSoundings', true);

    // Remove both layers first
    if (mapInstance.value.hasLayer(depthLayer10m.value)) {
      mapInstance.value.removeLayer(depthLayer10m.value);
    }

    if (mapInstance.value.hasLayer(depthLayer100m.value)) {
      mapInstance.value.removeLayer(depthLayer100m.value);
    }

    // Add the appropriate layer if depth soundings are visible
    if (mapStore.mapSettings.layers.depthSoundings.visible) {
      if (currentDepthResolution.value === '10m') {
        depthLayer10m.value.addTo(mapInstance.value);
        console.log('Added 10m depth layer');
      } else {
        depthLayer100m.value.addTo(mapInstance.value);
        console.log('Added 100m depth layer');
      }

      // Update layer state
      mapStore.updateLayerTimestamp('depthSoundings');
      mapStore.setLayerError('depthSoundings', null);
    }

    // Clear loading state
    mapStore.setLayerLoading('depthSoundings', false);
  } catch (error) {
    console.error('Error updating depth layer visibility:', error);
    mapStore.setLayerError('depthSoundings', 'Failed to load depth data');
    mapStore.setLayerLoading('depthSoundings', false);
  }
};

// Create and update the coordinate grid
const updateCoordinateGrid = () => {
  if (!mapInstance.value) return;

  try {
    // Set loading state
    mapStore.setLayerLoading('coordinateGrid', true);

    // Clear existing grid lines
    if (gridLayer.value) {
      gridLayer.value.clearLayers();
    } else {
      // Create a new feature group if it doesn't exist
      gridLayer.value = L.featureGroup();
    }

    // Get current map bounds
    const bounds = mapInstance.value.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const zoom = mapInstance.value.getZoom();

    // Determine grid spacing based on zoom level
    let latSpacing = 10; // Default to 10 degrees for very zoomed out
    let lngSpacing = 10;
    let showLabels = true;
    let skipFactor = 1; // Show every grid line by default

    if (zoom <= 1) {
      // Very zoomed out - world view
      latSpacing = 45; // Show only at 45° intervals
      lngSpacing = 45;
      showLabels = true; // Show labels but very sparse
    } else if (zoom <= 2) {
      latSpacing = 30;
      lngSpacing = 30;
      showLabels = true;
    } else if (zoom <= 3) {
      latSpacing = 15;
      lngSpacing = 15;
    } else if (zoom <= 4) {
      latSpacing = 10;
      lngSpacing = 10;
    } else if (zoom <= 5) {
      latSpacing = 5;
      lngSpacing = 5;
    } else if (zoom <= 6) {
      latSpacing = 5;
      lngSpacing = 5;
    } else if (zoom <= 7) {
      latSpacing = 1;
      lngSpacing = 1;
    } else if (zoom <= 9) {
      latSpacing = 0.5;
      lngSpacing = 0.5;
    } else if (zoom <= 11) {
      latSpacing = 0.1;
      lngSpacing = 0.1;
    } else if (zoom <= 13) {
      latSpacing = 0.05;
      lngSpacing = 0.05;
    } else {
      latSpacing = 0.01;
      lngSpacing = 0.01;
    }

    // Round bounds to nearest grid line
    const startLat = Math.floor(sw.lat / latSpacing) * latSpacing;
    const endLat = Math.ceil(ne.lat / latSpacing) * latSpacing;
    const startLng = Math.floor(sw.lng / lngSpacing) * lngSpacing;
    const endLng = Math.ceil(ne.lng / lngSpacing) * lngSpacing;

    // Create latitude lines (horizontal)
    for (let lat = startLat; lat <= endLat; lat += latSpacing) {
      // Skip if outside valid latitude range
      if (lat < -90 || lat > 90) continue;

      const line = L.polyline(
        [
          [lat, startLng],
          [lat, endLng]
        ],
        {
          color: '#1e3a8a',
          weight: 1,
          opacity: 0.5,
          dashArray: '5, 5'
        }
      );

      gridLayer.value.addLayer(line);

      // Add label if not too zoomed out
      if (showLabels) {
        // Position the label at the left edge of the map, but higher up for better visibility
        const labelPos = L.latLng(lat, sw.lng);
        const label = L.marker(labelPos, {
          icon: L.divIcon({
            className: 'grid-label',
            html: `<div class="bg-sea-dark text-white px-2 py-1 rounded text-xs font-mono">${formatLatitude(lat)}</div>`,
            iconSize: [60, 20],
            // Adjust the iconAnchor to position the label higher up
            // First value is horizontal offset (0 = left aligned), second is vertical (negative = move up)
            iconAnchor: [0, -15]
          })
        });
        gridLayer.value.addLayer(label);
      }
    }

    // Create longitude lines (vertical)
    for (let lng = startLng; lng <= endLng; lng += lngSpacing) {
      // Skip if outside valid longitude range
      if (lng < -180 || lng > 180) continue;

      const line = L.polyline(
        [
          [startLat, lng],
          [endLat, lng]
        ],
        {
          color: '#1e3a8a',
          weight: 1,
          opacity: 0.5,
          dashArray: '5, 5'
        }
      );

      gridLayer.value.addLayer(line);

      // Add label if not too zoomed out
      if (showLabels) {
        // Position the label at the bottom edge of the map, but with better visibility
        const labelPos = L.latLng(sw.lat, lng);
        const label = L.marker(labelPos, {
          icon: L.divIcon({
            className: 'grid-label',
            html: `<div class="bg-sea-dark text-white px-2 py-1 rounded text-xs font-mono">${formatLongitude(lng)}</div>`,
            iconSize: [60, 20],
            // Adjust the iconAnchor to position the label better
            // First value is horizontal offset (20 = centered), second is vertical (negative = move up)
            iconAnchor: [30, 20]
          })
        });
        gridLayer.value.addLayer(label);
      }
    }

    // Add layer to map if it's visible
    if (mapStore.mapSettings.layers.coordinateGrid.visible) {
      gridLayer.value.addTo(mapInstance.value);
    }

    // Update layer state
    mapStore.updateLayerTimestamp('coordinateGrid');
    mapStore.setLayerError('coordinateGrid', null);

    console.log('Coordinate grid updated');
  } catch (error) {
    console.error('Error updating coordinate grid:', error);
    mapStore.setLayerError('coordinateGrid', 'Failed to update coordinate grid');
  } finally {
    mapStore.setLayerLoading('coordinateGrid', false);
  }
};

// Format latitude for display
const formatLatitude = (lat: number): string => {
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = Math.round(((abs - deg) * 60 - min) * 60);

  return `${lat >= 0 ? 'N' : 'S'} ${deg}°${min > 0 ? ` ${min}'` : ''}${sec > 0 ? ` ${sec}"` : ''}`;
};

// Format longitude for display
const formatLongitude = (lng: number): string => {
  const abs = Math.abs(lng);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = Math.round(((abs - deg) * 60 - min) * 60);

  return `${lng >= 0 ? 'E' : 'W'} ${deg}°${min > 0 ? ` ${min}'` : ''}${sec > 0 ? ` ${sec}"` : ''}`;
};

// Update harbor markers on the map
const updateHarborMarkers = () => {
  if (!mapInstance.value) return;

  // Clear existing markers
  if (harborLayer.value) {
    harborLayer.value.clearLayers();
  } else {
    // Create a new feature group if it doesn't exist
    harborLayer.value = L.featureGroup();
  }

  // Add markers for each harbor
  harborFacilities.value.forEach(harbor => {
    // Create custom icon
    const icon = L.icon({
      iconUrl: harbor.metadata?.icon || 'https://map.openseamap.org/resources/places/harbour_16.png',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8]
    });

    // Create marker
    const marker = L.marker([harbor.coordinates[1], harbor.coordinates[0]], { icon });

    // Add popup
    marker.bindPopup(`
      <div class="harbor-popup">
        <h3 class="text-lg font-bold">${harbor.name}</h3>
        <p class="text-sm text-gray-600">ID: ${harbor.id}</p>
        ${harbor.metadata?.country ? `<p>Country: ${harbor.metadata.country}</p>` : ''}
        ${harbor.metadata?.size ? `<p>Size: ${harbor.metadata.size}</p>` : ''}
      </div>
    `);

    // Add to layer
    marker.addTo(harborLayer.value);
  });

  // Add layer to map if it's visible
  if (mapStore.mapSettings.layers.harborFacilities.visible) {
    harborLayer.value.addTo(mapInstance.value);
  }
};

// Handle map move event
const handleMapMoveEnd = () => {
  if (!mapInstance.value) return;

  const center = mapInstance.value.getCenter();
  mapStore.updateMapView(
    [center.lat, center.lng],
    mapInstance.value.getZoom()
  );

  // Reload harbor data when the map moves
  if (mapStore.mapSettings.layers.harborFacilities.visible) {
    loadHarborFacilities();
  }

  // Update coordinate grid when the map moves
  if (mapStore.mapSettings.layers.coordinateGrid.visible) {
    updateCoordinateGrid();
  }

  // No need to reload depth data as WMS layers handle this automatically
};

// Handle map zoom event
const handleMapZoomEnd = () => {
  if (!mapInstance.value) return;

  mapStore.mapSettings.zoom = mapInstance.value.getZoom();
  mapStore.saveSettings();

  // Update coordinate grid when the map zooms
  if (mapStore.mapSettings.layers.coordinateGrid.visible) {
    updateCoordinateGrid();
  }
};

// Handle mouse move to track cursor position
const handleMouseMove = (e: any) => {
  cursorPosition.value = [e.latlng.lat, e.latlng.lng];
};

// Handle mouse out event
const handleMouseOut = () => {
  cursorPosition.value = null;
};

// Update layer visibility based on store state
const updateLayerVisibility = () => {
  if (!mapInstance.value) return;

  // Sea marks layer
  if (mapStore.mapSettings.layers.seaMarks.visible) {
    if (!mapInstance.value.hasLayer(seaMarkLayer.value)) {
      seaMarkLayer.value.addTo(mapInstance.value);
    }
  } else if (mapInstance.value.hasLayer(seaMarkLayer.value)) {
    mapInstance.value.removeLayer(seaMarkLayer.value);
  }

  // Harbor facilities layer
  console.log('Harbor layer visibility:', mapStore.mapSettings.layers.harborFacilities.visible);

  if (mapStore.mapSettings.layers.harborFacilities.visible) {
    console.log('Adding harbor layer to map');

    try {
      // Load harbor facilities if not already loaded
      if (harborFacilities.value.length === 0) {
        loadHarborFacilities();
      } else {
        // Just update the markers with existing data
        updateHarborMarkers();
      }

      console.log('Harbor layer added successfully');
    } catch (error) {
      console.error('Error adding harbor layer:', error);
      mapStore.setLayerError('harborFacilities', 'Failed to load harbor facilities');
    }
  } else if (mapInstance.value && harborLayer.value && mapInstance.value.hasLayer(harborLayer.value)) {
    console.log('Removing harbor layer from map');
    mapInstance.value.removeLayer(harborLayer.value);
  }

  // Depth layer
  console.log('Depth layer visibility:', mapStore.mapSettings.layers.depthSoundings.visible);

  try {
    // Update depth layer visibility based on current state
    updateDepthLayerVisibility();

    if (mapStore.mapSettings.layers.depthSoundings.visible) {
      console.log('Depth layer added successfully');
    }
  } catch (error) {
    console.error('Error handling depth layer:', error);
    mapStore.setLayerError('depthSoundings', 'Failed to load depth data');
  }

  // Grid layer
  console.log('Grid layer visibility:', mapStore.mapSettings.layers.coordinateGrid.visible);

  if (mapStore.mapSettings.layers.coordinateGrid.visible) {
    console.log('Adding grid layer to map');

    try {
      // Update the coordinate grid
      updateCoordinateGrid();

      console.log('Grid layer added successfully');
    } catch (error) {
      console.error('Error adding grid layer:', error);
      mapStore.setLayerError('coordinateGrid', 'Failed to load coordinate grid');
    }
  } else if (mapInstance.value && gridLayer.value && mapInstance.value.hasLayer(gridLayer.value)) {
    console.log('Removing grid layer from map');
    mapInstance.value.removeLayer(gridLayer.value);
  }
};

// Watch for changes in layer visibility
watch(
  () => [
    mapStore.mapSettings.layers.seaMarks.visible,
    mapStore.mapSettings.layers.harborFacilities.visible,
    mapStore.mapSettings.layers.depthSoundings.visible,
    mapStore.mapSettings.layers.coordinateGrid.visible,
  ],
  () => {
    updateLayerVisibility();
  }
);

// Center map on user location
const centerOnUserLocation = async () => {
  try {
    const location = await getUserLocation();
    if (mapInstance.value) {
      mapInstance.value.setView(location, 14);
      mapStore.setUserLocation(location);
    }
  } catch (error) {
    console.error('Error centering on user location:', error);
  }
};

// Lifecycle hooks
onMounted(() => {
  initializeMap();
});

onUnmounted(() => {
  if (mapInstance.value) {
    mapInstance.value.off('moveend', handleMapMoveEnd);
    mapInstance.value.off('zoomend', handleMapZoomEnd);
    mapInstance.value.off('mousemove', handleMouseMove);
    mapInstance.value.off('mouseout', handleMouseOut);
    mapInstance.value.remove();
    mapInstance.value = null;
  }
});
</script>

<template>
  <div class="relative w-full h-full">
    <!-- Map container -->
    <div
      ref="mapElement"
      class="w-full h-full z-0"
      aria-label="Interactive maritime map"
    ></div>

    <!-- Loading overlay removed - using AppLoader instead -->

    <!-- Error message -->
    <div
      v-if="mapError"
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-50"
    >
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{{ mapError }}</p>
        <button
          @click="initializeMap"
          class="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Depth resolution toggle button (only visible when depth layer is active) -->
    <button
      v-if="mapStore.mapSettings.layers.depthSoundings.visible"
      @click="toggleDepthResolution"
      class="absolute bottom-16 right-4 bg-white px-3 py-2 rounded shadow-md z-map-controls text-sm font-medium flex items-center"
      aria-label="Toggle depth resolution"
      :title="`Switch to ${currentDepthResolution === '10m' ? '100m' : '10m'} resolution`"
    >
      <span class="mr-1 text-sea-blue">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
      <span class="text-gray-600">Depth: <span class="text-gray-600 font-bold">{{ currentDepthResolution }}</span></span>
    </button>

    <!-- Coordinates Display -->
    <div class="absolute bottom-8 left-0 right-0 flex justify-center z-10">
      <div v-if="cursorPosition" class="bg-sea-dark text-white px-6 py-2 rounded-t-lg shadow-lg text-sm font-mono font-medium">
        <span class="mr-3">{{ formatLatitude(cursorPosition[0]) }}</span>
        <span>{{ formatLongitude(cursorPosition[1]) }}</span>
      </div>
    </div>

    <!-- Location button -->
    <button
      @click="centerOnUserLocation"
      class="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-md z-map-controls"
      aria-label="Center map on my location"
      title="Center on my location"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-sea-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>

    <!-- Attribution Footer -->
    <!-- <div class="absolute bottom-0 left-0 right-0 bg-white bg-opacity-70 text-xs text-center p-1 z-10">
      Data © <a href="https://www.openseamap.org/" target="_blank" class="text-sea-blue hover:underline">OpenSeaMap</a> contributors |
      Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" class="text-sea-blue hover:underline">OpenStreetMap</a> contributors
    </div> -->
  </div>
</template>

<style>
/* Ensure the map container takes full height */
.leaflet-container {
  height: 100%;
  width: 100%;
}

/* Harbor popup styles */
.harbor-popup h3 {
  margin: 0 0 5px 0;
  color: #1e3a8a;
}

.harbor-popup p {
  margin: 2px 0;
}

/* Depth popup styles */
.depth-popup h3 {
  margin: 0 0 5px 0;
  color: #1565c0;
}

.depth-popup p {
  margin: 2px 0;
}

/* Grid label styles */
.grid-label {
  background: transparent;
  border: none;
  box-shadow: none;
  z-index: 1000 !important; /* Ensure labels are above other elements */
}

.grid-label div {
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0.95;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
