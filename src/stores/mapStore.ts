import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MapSettings, LayerState, MeasurementPath, WindyOptions } from '@/types/maritime';

export const useMapStore = defineStore('map', () => {
  // Default map settings
  const defaultCenter: [number, number] = [51.505, -0.09]; // London as fallback
  const defaultZoom = 5;

  // Create default layer state
  const createDefaultLayerState = (): LayerState => ({
    visible: false,
    loading: false,
    error: null,
    lastUpdated: null
  });

  // Default Windy options
  const defaultWindyOptions = {
    overlay: 'wind',
    level: 'surface',
    timestamp: null
  };

  // Windy options state
  const windyOptions = ref<WindyOptions>(defaultWindyOptions);

  // Map settings state
  const mapSettings = ref<MapSettings>({
    center: defaultCenter,
    zoom: defaultZoom,
    layers: {
      seaMarks: createDefaultLayerState(),
      harborFacilities: createDefaultLayerState(),
      coordinateGrid: createDefaultLayerState(),
      depthSoundings: createDefaultLayerState(),
      bathymetricContours: createDefaultLayerState(),
      windy: createDefaultLayerState()
    }
  });

  // User location
  const userLocation = ref<[number, number] | null>(null);

  // Measurement paths
  const measurementPaths = ref<MeasurementPath[]>([]);
  const activeMeasurementId = ref<string | null>(null);

  // Load settings from localStorage
  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('mapSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);

        // Update map settings
        mapSettings.value = {
          ...mapSettings.value,
          ...parsed,
          // Ensure we have all required layer properties
          layers: {
            ...mapSettings.value.layers,
            ...(parsed.layers || {})
          }
        };

        // Update Windy options if they exist
        if (parsed.windyOptions) {
          windyOptions.value = {
            overlay: parsed.windyOptions.overlay || defaultWindyOptions.overlay,
            level: parsed.windyOptions.level || defaultWindyOptions.level,
            timestamp: parsed.windyOptions.timestamp !== undefined ?
              parsed.windyOptions.timestamp : defaultWindyOptions.timestamp
          };
        }
      }
    } catch (error) {
      console.error('Failed to load map settings from localStorage:', error);
    }
  };

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem('mapSettings', JSON.stringify({
        center: mapSettings.value.center,
        zoom: mapSettings.value.zoom,
        layers: mapSettings.value.layers,
        windyOptions: windyOptions.value
      }));
    } catch (error) {
      console.error('Failed to save map settings to localStorage:', error);
    }
  };

  // Set user location
  const setUserLocation = (location: [number, number]) => {
    userLocation.value = location;
    // Optionally center map on user location
    mapSettings.value.center = location;
  };

  // Update map center and zoom
  const updateMapView = (center: [number, number], zoom: number) => {
    mapSettings.value.center = center;
    mapSettings.value.zoom = zoom;
    saveSettings();
  };

  // Toggle layer visibility
  const toggleLayer = (layerName: keyof MapSettings['layers']) => {
    if (mapSettings.value.layers[layerName]) {
      const newVisibility = !mapSettings.value.layers[layerName].visible;
      console.log(`Toggling ${layerName} layer to ${newVisibility ? 'visible' : 'hidden'}`);
      mapSettings.value.layers[layerName].visible = newVisibility;

      // Mark as updated
      mapSettings.value.layers[layerName].lastUpdated = Date.now();

      // Save settings
      saveSettings();

      console.log('Current layer states:', JSON.stringify(mapSettings.value.layers));
    }
  };

  // Set layer loading state
  const setLayerLoading = (layerName: keyof MapSettings['layers'], loading: boolean) => {
    if (mapSettings.value.layers[layerName]) {
      mapSettings.value.layers[layerName].loading = loading;
    }
  };

  // Set layer error state
  const setLayerError = (layerName: keyof MapSettings['layers'], error: string | null) => {
    if (mapSettings.value.layers[layerName]) {
      mapSettings.value.layers[layerName].error = error;
    }
  };

  // Update layer timestamp
  const updateLayerTimestamp = (layerName: keyof MapSettings['layers']) => {
    if (mapSettings.value.layers[layerName]) {
      mapSettings.value.layers[layerName].lastUpdated = Date.now();
    }
  };

  // Add a new measurement path
  const addMeasurementPath = (path: MeasurementPath) => {
    measurementPaths.value.push(path);
    activeMeasurementId.value = path.id;
  };

  // Remove a measurement path
  const removeMeasurementPath = (id: string) => {
    const index = measurementPaths.value.findIndex(path => path.id === id);
    if (index !== -1) {
      measurementPaths.value.splice(index, 1);
    }
    if (activeMeasurementId.value === id) {
      activeMeasurementId.value = null;
    }
  };

  // Clear all measurements
  const clearMeasurements = () => {
    measurementPaths.value = [];
    activeMeasurementId.value = null;
  };

  // Get active measurement
  const activeMeasurement = computed(() => {
    if (!activeMeasurementId.value) return null;
    return measurementPaths.value.find(path => path.id === activeMeasurementId.value) || null;
  });

  // Update Windy overlay
  const updateWindyOverlay = (overlay: string) => {
    windyOptions.value.overlay = overlay;
    updateLayerTimestamp('windy');
    saveSettings();
  };

  // Update Windy level
  const updateWindyLevel = (level: string) => {
    windyOptions.value.level = level;
    updateLayerTimestamp('windy');
    saveSettings();
  };

  // Update Windy timestamp
  const updateWindyTimestamp = (timestamp: number | null) => {
    windyOptions.value.timestamp = timestamp;
    updateLayerTimestamp('windy');
    saveSettings();
  };

  // Reset Windy options to defaults
  const resetWindyOptions = () => {
    windyOptions.value = { ...defaultWindyOptions };
    updateLayerTimestamp('windy');
    saveSettings();
  };

  return {
    mapSettings,
    userLocation,
    measurementPaths,
    activeMeasurementId,
    activeMeasurement,
    windyOptions,
    loadSettings,
    saveSettings,
    setUserLocation,
    updateMapView,
    toggleLayer,
    setLayerLoading,
    setLayerError,
    updateLayerTimestamp,
    addMeasurementPath,
    removeMeasurementPath,
    clearMeasurements,
    updateWindyOverlay,
    updateWindyLevel,
    updateWindyTimestamp,
    resetWindyOptions
  };
});
