<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMapStore } from '@/stores/mapStore';
import LoadingIndicator from './LoadingIndicator.vue';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';

const mapStore = useMapStore();
const isCollapsed = ref(false);

// Layer definitions with display names
const layers = computed(() => [
  {
    id: 'seaMarks',
    name: 'Sea Marks',
    description: 'Buoys, beacons, and lights',
    state: mapStore.mapSettings.layers.seaMarks
  },
  {
    id: 'harborFacilities',
    name: 'Harbor Facilities',
    description: 'Ports and harbor information',
    state: mapStore.mapSettings.layers.harborFacilities
  },
  {
    id: 'coordinateGrid',
    name: 'Coordinate Grid',
    description: 'Latitude/longitude grid',
    state: mapStore.mapSettings.layers.coordinateGrid
  },
  {
    id: 'depthSoundings',
    name: 'Depth Soundings',
    description: 'Water depth measurements',
    state: mapStore.mapSettings.layers.depthSoundings
  }
]);

// Toggle a layer's visibility
const toggleLayer = (layerId: string) => {
  mapStore.toggleLayer(layerId as keyof typeof mapStore.mapSettings.layers);
};

// Toggle panel collapse
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};
</script>

<template>
  <div 
    class="absolute top-4 left-4 z-map-controls bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
    :class="{ 'w-64': !isCollapsed, 'w-12': isCollapsed }"
  >
    <!-- Header with collapse button -->
    <div class="flex items-center justify-between p-2 bg-sea-blue text-white">
      <h2 class="text-sm font-semibold" :class="{ 'sr-only': isCollapsed }">Map Layers</h2>
      <button 
        @click="toggleCollapse" 
        class="p-1 rounded hover:bg-sea-light hover:bg-opacity-20 focus:outline-none"
        :aria-label="isCollapsed ? 'Expand layer controls' : 'Collapse layer controls'"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          class="h-5 w-5" 
          :class="{ 'transform rotate-180': isCollapsed }"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M4 6h16M4 12h16m-7 6h7" 
          />
        </svg>
      </button>
    </div>

    <!-- Layer controls -->
    <div v-if="!isCollapsed" class="p-2 max-h-[calc(100vh-200px)] overflow-y-auto">
      <Disclosure v-for="layer in layers" :key="layer.id" as="div" class="mb-2" v-slot="{ open }">
        <div class="flex items-center justify-between p-2 bg-gray-100 rounded">
          <div class="flex items-center space-x-2">
            <input
              :id="`layer-${layer.id}`"
              type="checkbox"
              class="h-4 w-4 text-sea-blue focus:ring-sea-light rounded"
              :checked="layer.state.visible"
              @change="toggleLayer(layer.id)"
            />
            <label :for="`layer-${layer.id}`" class="text-sm font-medium text-gray-700">
              {{ layer.name }}
            </label>
            <LoadingIndicator v-if="layer.state.loading" size="sm" />
          </div>
          <DisclosureButton class="p-1 rounded hover:bg-gray-200 focus:outline-none">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              class="h-4 w-4 transition-transform duration-200" 
              :class="{ 'transform rotate-180': open }"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="black"
            >
              <path 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M19 9l-7 7-7-7" 
              />
            </svg>
          </DisclosureButton>
        </div>
        <DisclosurePanel class="px-2 pt-2 pb-1 text-xs text-gray-600">
          <p>{{ layer.description }}</p>
          <div v-if="layer.state.error" class="mt-1 text-red-600">
            Error: {{ layer.state.error }}
          </div>
          <div v-if="layer.state.lastUpdated" class="mt-1 text-gray-500">
            Last updated: {{ new Date(layer.state.lastUpdated).toLocaleTimeString() }}
          </div>
        </DisclosurePanel>
      </Disclosure>
    </div>
  </div>
</template>
