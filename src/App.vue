<script setup lang="ts">
import { ref } from 'vue'
import MaritimeMap from './components/MaritimeMap.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import AppLoader from './components/AppLoader.vue'

// Track if the map is ready
const isMapReady = ref(false)

// Function to handle map ready event
const handleMapReady = () => {
  isMapReady.value = true
}
</script>

<template>
  <ErrorBoundary>
    <AppLoader :map-ready="isMapReady" />
    <MaritimeMap @map-ready="handleMapReady" />
  </ErrorBoundary>
</template>

<style>
/* Global styles */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

#app {
  height: 100vh;
  width: 100vw;
}

/* Accessibility focus styles */
*:focus-visible {
  outline: 2px solid #1e3a8a;
  outline-offset: 2px;
}

/* Skip to content link for keyboard users */
.skip-to-content {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.skip-to-content:focus {
  position: fixed;
  top: 0;
  left: 0;
  width: auto;
  height: auto;
  padding: 0.5rem 1rem;
  background: #1e3a8a;
  color: white;
  z-index: 9999;
}
</style>
