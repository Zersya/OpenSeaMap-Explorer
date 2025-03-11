<script setup lang="ts">
import { computed } from 'vue';
import { formatCoordinates } from '@/utils/geolocation';

const props = defineProps<{
  coordinates: [number, number] | null;
  format?: 'dd' | 'dms';
}>();

const formattedCoordinates = computed(() => {
  if (!props.coordinates) return '';
  return formatCoordinates(props.coordinates, props.format || 'dd');
});
</script>

<template>
  <div 
    class="coordinate-display text-sm" 
    aria-live="polite"
    aria-atomic="true"
  >
    <span v-if="coordinates" class="font-mono">{{ formattedCoordinates }}</span>
    <span v-else class="text-gray-400">No coordinates</span>
  </div>
</template>

<style scoped>
.coordinate-display {
  min-width: 200px;
  text-align: right;
}
</style>
