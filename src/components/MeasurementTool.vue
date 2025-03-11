<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useMapStore } from '@/stores/mapStore';
import { calculatePathDistance } from '@/services/maritimeService';
import { formatCoordinates } from '@/utils/geolocation';
import type { MeasurementPath, MeasurementPoint } from '@/types/maritime';
import { v4 as uuidv4 } from 'uuid';

// Import Leaflet dynamically to avoid SSR issues
let L: any;

// Props
const props = defineProps<{
  mapInstance: any;
}>();

// Store
const mapStore = useMapStore();

// State
const isMeasuring = ref(false);
const currentPath = ref<MeasurementPoint[]>([]);
const measurementLayer = ref<any>(null);

// Format distance in a human-readable way
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters.toFixed(1)} m`;
  } else {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  }
};

// Initialize the measurement tool
const initMeasurementTool = async () => {
  if (!L) {
    try {
      L = await import('leaflet');
      console.log('Leaflet loaded successfully in MeasurementTool');
    } catch (error) {
      console.error('Failed to load Leaflet in MeasurementTool:', error);
      return;
    }
  }

  if (props.mapInstance && !measurementLayer.value) {
    try {
      // Create a feature group for measurements
      measurementLayer.value = L.featureGroup().addTo(props.mapInstance);
      console.log('Measurement layer created and added to map');

      // Draw existing measurements
      drawMeasurements();
    } catch (error) {
      console.error('Error initializing measurement tool:', error);
    }
  } else {
    console.warn('Map instance or measurement layer not available');
  }
};

// Start a new measurement
const startMeasurement = () => {
  if (!props.mapInstance) {
    console.error('Map instance not available');
    return;
  }

  // Set measuring state
  isMeasuring.value = true;
  currentPath.value = [];

  // Add click handler for measurements
  props.mapInstance.on('click', handleMapClick);

  // Change cursor to indicate measuring mode
  document.body.classList.add('measuring-cursor');

  console.log('Started measurement mode');
};

// End the current measurement
const endMeasurement = () => {
  if (!props.mapInstance) {
    console.error('Map instance not available');
    return;
  }

  // Remove click handler
  props.mapInstance.off('click', handleMapClick);

  // Reset cursor
  document.body.classList.remove('measuring-cursor');

  if (currentPath.value.length >= 2) {
    // Calculate total distance
    const coordinates = currentPath.value.map(point => point.coordinates);
    const distance = calculatePathDistance(coordinates);

    // Create a new measurement path
    const path: MeasurementPath = {
      id: uuidv4(),
      points: [...currentPath.value],
      distance
    };

    // Add to store
    mapStore.addMeasurementPath(path);
    console.log('Measurement saved:', path);
  }

  // Reset current path
  currentPath.value = [];
  isMeasuring.value = false;

  // Redraw measurements
  drawMeasurements();

  console.log('Ended measurement mode');
};

// Cancel the current measurement
const cancelMeasurement = () => {
  if (!props.mapInstance) {
    console.error('Map instance not available');
    return;
  }

  // Remove click handler
  props.mapInstance.off('click', handleMapClick);

  // Reset cursor
  document.body.classList.remove('measuring-cursor');

  // Reset state
  currentPath.value = [];
  isMeasuring.value = false;

  // Redraw measurements
  drawMeasurements();

  console.log('Cancelled measurement mode');
};

// Clear all measurements
const clearAllMeasurements = () => {
  if (!props.mapInstance) {
    console.error('Map instance not available');
    return;
  }

  // If we're in measuring mode, remove the click handler
  if (isMeasuring.value) {
    props.mapInstance.off('click', handleMapClick);
    document.body.classList.remove('measuring-cursor');
  }

  // Clear all measurements from the store
  mapStore.clearMeasurements();

  // Reset state
  currentPath.value = [];
  isMeasuring.value = false;

  // Redraw (which will clear the layer)
  drawMeasurements();

  console.log('Cleared all measurements');
};

// Handle map click for measurements
const handleMapClick = (e: any) => {
  console.log('Map clicked, measuring mode:', isMeasuring.value);

  if (!isMeasuring.value) return;

  const { lat, lng } = e.latlng;
  console.log(`Adding measurement point at ${lat}, ${lng}`);

  const point: MeasurementPoint = {
    coordinates: [lat, lng],
    label: `Point ${currentPath.value.length + 1}`
  };

  // Add point to current path
  currentPath.value.push(point);
  console.log(`Added point ${currentPath.value.length}, total points:`, currentPath.value.length);

  // Update the display
  drawCurrentPath();
};

// Draw the current measurement path
const drawCurrentPath = () => {
  if (!measurementLayer.value) return;

  // Clear the layer
  measurementLayer.value.clearLayers();

  // Draw all saved measurements
  drawMeasurements(false);

  // If we have points in the current path
  if (currentPath.value.length > 0) {
    // Create line coordinates
    const lineCoords = currentPath.value.map(point => point.coordinates);

    // Draw line
    if (lineCoords.length >= 2) {
      const polyline = L.polyline(lineCoords, {
        color: '#FF4500',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10'
      }).addTo(measurementLayer.value);

      // Calculate distance
      const distance = calculatePathDistance(lineCoords);

      // Add distance label at midpoint
      if (lineCoords.length >= 2) {
        const midIndex = Math.floor(lineCoords.length / 2) - 1;
        const midpoint = L.latLng(
          (lineCoords[midIndex][0] + lineCoords[midIndex + 1][0]) / 2,
          (lineCoords[midIndex][1] + lineCoords[midIndex + 1][1]) / 2
        );

        L.marker(midpoint, {
          icon: L.divIcon({
            className: 'measurement-label',
            html: `<div class="bg-sea-blue text-white px-2 py-1 rounded text-xs">${formatDistance(distance)}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
          })
        }).addTo(measurementLayer.value);
      }
    }

    // Draw markers for each point
    currentPath.value.forEach((point, index) => {
      const marker = L.marker(point.coordinates, {
        icon: L.divIcon({
          className: 'measurement-point',
          html: `<div class="bg-white border-2 border-red-500 rounded-full w-4 h-4"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(measurementLayer.value);

      // Add tooltip with coordinates
      marker.bindTooltip(formatCoordinates(point.coordinates));
    });
  }
};

// Draw all saved measurements
const drawMeasurements = (clearFirst = true) => {
  if (!measurementLayer.value) return;

  if (clearFirst) {
    measurementLayer.value.clearLayers();
  }

  // Draw each saved path
  mapStore.measurementPaths.forEach(path => {
    const isActive = path.id === mapStore.activeMeasurementId;
    const lineCoords = path.points.map(point => point.coordinates);

    // Draw line
    if (lineCoords.length >= 2) {
      const polyline = L.polyline(lineCoords, {
        color: isActive ? '#4CAF50' : '#3388ff',
        weight: isActive ? 4 : 3,
        opacity: 0.7
      }).addTo(measurementLayer.value);

      // Add distance label at midpoint
      if (lineCoords.length >= 2) {
        const midIndex = Math.floor(lineCoords.length / 2) - 1;
        const midpoint = L.latLng(
          (lineCoords[midIndex][0] + lineCoords[midIndex + 1][0]) / 2,
          (lineCoords[midIndex][1] + lineCoords[midIndex + 1][1]) / 2
        );

        L.marker(midpoint, {
          icon: L.divIcon({
            className: 'measurement-label',
            html: `<div class="bg-${isActive ? 'green' : 'blue'}-600 text-white px-2 py-1 rounded text-xs">${formatDistance(path.distance)}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
          })
        }).addTo(measurementLayer.value);
      }
    }

    // Draw markers for each point
    path.points.forEach((point, index) => {
      const marker = L.marker(point.coordinates, {
        icon: L.divIcon({
          className: 'measurement-point',
          html: `<div class="bg-white border-2 border-${isActive ? 'green' : 'blue'}-500 rounded-full w-3 h-3"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(measurementLayer.value);

      // Add tooltip with coordinates
      marker.bindTooltip(formatCoordinates(point.coordinates));
    });
  });
};

// Watch for changes in measurements
watch(
  () => [mapStore.measurementPaths, mapStore.activeMeasurementId],
  () => {
    drawMeasurements();
  },
  { deep: true }
);

// Lifecycle hooks
onMounted(() => {
  if (props.mapInstance) {
    initMeasurementTool();
  }
});

onUnmounted(() => {
  console.log('MeasurementTool unmounting, cleaning up...');

  if (props.mapInstance) {
    // Remove event listeners
    props.mapInstance.off('click', handleMapClick);
    props.mapInstance.off('load', displayExistingMeasurements);

    // Remove measurement layer
    if (measurementLayer.value) {
      try {
        measurementLayer.value.clearLayers();
        props.mapInstance.removeLayer(measurementLayer.value);
        console.log('Measurement layer removed');
      } catch (error) {
        console.error('Error removing measurement layer:', error);
      }
    }

    // Reset cursor if needed
    document.body.classList.remove('measuring-cursor');
  }

  console.log('MeasurementTool cleanup complete');
});

// Expose methods
defineExpose({
  startMeasurement,
  endMeasurement,
  cancelMeasurement,
  clearAllMeasurements,
  isMeasuring
});
</script>

<template>
  <div class="absolute bottom-8 left-6 z-map-controls">
    <div class="bg-white rounded-lg shadow-lg p-2">
      <div class="flex items-center space-x-2">
        <button
          v-if="!isMeasuring"
          @click="startMeasurement"
          class="bg-sea-blue hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm flex items-center"
          aria-label="Start measurement"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Measure
        </button>

        <template v-else>
          <span class="text-xs text-gray-600">Click on map to add points</span>
          <button
            @click="endMeasurement"
            class="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs"
            :disabled="currentPath.length < 2"
            :class="{ 'opacity-50 cursor-not-allowed': currentPath.length < 2 }"
          >
            Done
          </button>
          <button
            @click="cancelMeasurement"
            class="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-xs"
          >
            Cancel
          </button>
        </template>

        <button
          v-if="!isMeasuring && mapStore.measurementPaths.length > 0"
          @click="clearAllMeasurements"
          class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-2 rounded text-xs"
          aria-label="Clear all measurements"
        >
          Clear All
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.measurement-label {
  background: transparent;
  border: none;
  box-shadow: none;
  z-index: 1000 !important;
}

.measurement-point {
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Custom cursor for measuring mode */
body.measuring-cursor {
  cursor: crosshair !important;
}

/* Make sure the measurement buttons are clearly visible */
.measurement-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
</style>
