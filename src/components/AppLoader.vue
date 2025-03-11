<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import LoadingIndicator from './LoadingIndicator.vue';
import { useMapStore } from '@/stores/mapStore';

const mapStore = useMapStore();
const isVisible = ref(true);
const mapLoaded = ref(false);

// Create a property to track if the map is ready
const isMapReady = ref(false);

// Define props to allow parent components to signal when the map is ready
const props = defineProps({
  mapReady: {
    type: Boolean,
    default: false
  }
});

// Watch for the map to be ready
watch(() => props.mapReady, (ready) => {
  if (ready) {
    isMapReady.value = true;
    // Add a small delay before hiding the loader for a smoother transition
    setTimeout(() => {
      isVisible.value = false;
    }, 500);
  }
});

onMounted(() => {
  // If the map doesn't signal ready within 3 seconds, hide the loader anyway
  setTimeout(() => {
    if (!isMapReady.value) {
      isVisible.value = false;
    }
  }, 3000);
});
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isVisible"
      class="fixed inset-0 flex items-center justify-center bg-sea-dark z-50"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="text-center">
        <LoadingIndicator size="lg" color="text-white" />
        <h2 class="mt-4 text-xl font-bold text-white">Loading OpenSeaMap Explorer</h2>
        <p class="mt-2 text-sea-light">Initializing maritime map application...</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
