<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMapStore } from '@/stores/mapStore';
import MapContainer from './MapContainer.vue';
import LayerControl from './LayerControl.vue';
import MeasurementTool from './MeasurementTool.vue';
import FeatureInfo from './FeatureInfo.vue';
import CoordinateDisplay from './CoordinateDisplay.vue';
import WindyLayer from './WindyLayer.vue';

// Define emits
const emit = defineEmits<{
  (e: 'map-ready'): void
}>();

// Store
const mapStore = useMapStore();

// Refs
const mapInstance = ref<any>(null);
const measurementToolRef = ref<InstanceType<typeof MeasurementTool> | null>(null);
const windyLayerRef = ref<InstanceType<typeof WindyLayer> | null>(null);
const mapReady = ref(false);

// Current coordinates display
const currentCoordinates = ref<[number, number] | null>(null);

// Set map instance
const setMapInstance = (instance: any) => {
  mapInstance.value = instance;

  // Set up mousemove handler for coordinate display
  if (instance) {
    instance.on('mousemove', (e: any) => {
      currentCoordinates.value = [e.latlng.lat, e.latlng.lng];
    });

    instance.on('mouseout', () => {
      currentCoordinates.value = null;
    });

    // Set map ready flag
    mapReady.value = true;
    console.log('Map is ready');

    // Emit map-ready event
    emit('map-ready');
  }
};

// Load settings on mount
onMounted(() => {
  mapStore.loadSettings();
});
</script>

<template>
  <div class="maritime-map-app w-full h-screen flex flex-col">
    <!-- Skip to content link for accessibility -->
    <a href="#map-content" class="skip-to-content">Skip to map content</a>

    <!-- Header -->
    <header class="bg-sea-dark text-white p-2 shadow-md z-10">
      <div class="container mx-auto flex justify-between items-center">
        <h1 class="text-xl font-bold">OpenSeaMap Explorer</h1>
        <CoordinateDisplay :coordinates="currentCoordinates" format="dd" />
      </div>
    </header>

    <!-- Map Container -->
    <div id="map-content" class="flex-grow relative" tabindex="-1">
      <MapContainer @map-ready="setMapInstance" />

      <!-- Map Controls -->
      <LayerControl v-if="mapInstance" />
      <MeasurementTool
        v-if="mapInstance"
        :map-instance="mapInstance"
        ref="measurementToolRef"
      />
      <FeatureInfo
        v-if="mapInstance"
        :map-instance="mapInstance"
      />
      <WindyLayer
        v-if="mapInstance"
        :map-instance="mapInstance"
        ref="windyLayerRef"
      />

      <!-- Attribution Footer -->
      <!-- <div class="absolute bottom-0 left-0 right-0 bg-white bg-opacity-70 text-xs text-center p-1 z-10">
        Data © <a href="https://www.openseamap.org/" target="_blank" class="text-sea-blue hover:underline">OpenSeaMap</a> contributors |
        Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" class="text-sea-blue hover:underline">OpenStreetMap</a> contributors
      </div> -->
    </div>
  </div>
</template>

<style scoped>
.maritime-map-app {
  font-family: 'Inter', sans-serif;
}
</style>
