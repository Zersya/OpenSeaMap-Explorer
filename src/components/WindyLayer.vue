<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useMapStore } from '@/stores/mapStore';

const props = defineProps<{
  mapInstance: any;
}>();

// Store
const mapStore = useMapStore();

// State
const isWindyInitialized = ref(false);
const windyInstance = ref<any>(null);
const windyContainer = ref<HTMLElement | null>(null);
const isWindyLoading = ref(false);
const windyError = ref<string | null>(null);

// Initialize Windy
const initWindy = async () => {
  if (!props.mapInstance || isWindyInitialized.value) return;

  try {
    console.log('Starting Windy initialization...');
    isWindyLoading.value = true;
    mapStore.setLayerLoading('windy', true);

    // Create container for Windy
    if (!windyContainer.value) {
      console.log('Creating Windy container...');
      windyContainer.value = document.createElement('div');
      windyContainer.value.id = 'windy-container';
      windyContainer.value.style.position = 'absolute';
      windyContainer.value.style.top = '0';
      windyContainer.value.style.left = '0';
      windyContainer.value.style.width = '100%';
      windyContainer.value.style.height = '100%';
      windyContainer.value.style.zIndex = '400'; // Below controls but above map
      windyContainer.value.style.pointerEvents = 'none'; // Allow clicks to pass through to map

      // Add container to map
      if (!props.mapInstance._container) {
        throw new Error('Map container not available');
      }
      props.mapInstance._container.appendChild(windyContainer.value);
      console.log('Windy container added to map');
    }

    // Create a direct div for Windy instead of iframe
    console.log('Creating Windy div...');
    const windyDiv = document.createElement('div');
    windyDiv.id = 'windy';
    windyDiv.style.width = '100%';
    windyDiv.style.height = '100%';
    windyDiv.style.position = 'absolute';
    windyDiv.style.top = '0';
    windyDiv.style.left = '0';
    windyDiv.style.zIndex = '399';
    windyDiv.style.backgroundColor = 'transparent';
    windyDiv.style.pointerEvents = 'none';

    // Add div to container
    windyContainer.value.appendChild(windyDiv);

    // Load Windy API script directly
    console.log('Loading Windy API script...');
    if (!window.W) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://api.windy.com/assets/map-forecast/libBoot.js';
        script.async = true;
        script.onload = () => {
          console.log('Windy script loaded successfully');
          resolve();
        };
        script.onerror = (e) => {
          console.error('Failed to load Windy script:', e);
          reject(new Error('Failed to load Windy script'));
        };
        document.head.appendChild(script);
      });
    } else {
      console.log('Windy API already loaded');
    }

    // Wait for Windy to be available
    console.log('Waiting for Windy API to be available...');
    let attempts = 0;
    const maxAttempts = 30; // Increase max attempts
    while (!window.W && attempts < maxAttempts) {
      console.log(`Waiting for Windy API... Attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }

    if (!window.W) {
      throw new Error('Windy API not available after waiting');
    }

    console.log('Windy API is available, initializing map...');

    // Get map bounds
    const bounds = props.mapInstance.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Initialize Windy with options
    try {
      console.log('Checking Windy API structure:', {
        W: !!window.W,
        windyAPI: !!window.windyAPI,
        windyInit: typeof window.windyInit,
        W_properties: Object.keys(window.W || {})
      });

      // Try to initialize using the available W object
      if (window.W) {
        console.log('Initializing Windy using W object with module system');

        // Create a Leaflet map instance for Windy
        const windyMapContainer = document.createElement('div');
        windyMapContainer.style.width = '100%';
        windyMapContainer.style.height = '100%';
        windyDiv.appendChild(windyMapContainer);

        try {
          // Based on the properties, it looks like Windy is using a module system
          // Let's try to load the necessary modules
          if (typeof window.W.require === 'function') {
            console.log('Using W.require to load modules');

            // Create an iframe to load Windy in its own context
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.position = 'absolute';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.zIndex = '399';

            // Build the URL with initial parameters
            const center = props.mapInstance.getCenter();
            const zoom = props.mapInstance.getZoom();
            const overlay = mapStore.windyOptions.overlay;
            const level = mapStore.windyOptions.level;

            // Construct the Windy embed URL with parameters
            const windyUrl = new URL('https://embed.windy.com/embed2.html');
            windyUrl.searchParams.append('lat', center.lat.toString());
            windyUrl.searchParams.append('lon', center.lng.toString());
            windyUrl.searchParams.append('zoom', zoom.toString());
            windyUrl.searchParams.append('overlay', overlay);
            windyUrl.searchParams.append('level', level);
            windyUrl.searchParams.append('product', 'ecmwf');
            windyUrl.searchParams.append('menu', 'true');
            windyUrl.searchParams.append('message', 'true');
            windyUrl.searchParams.append('marker', 'true');
            windyUrl.searchParams.append('calendar', 'now');
            windyUrl.searchParams.append('pressure', 'true');
            windyUrl.searchParams.append('type', 'map');
            windyUrl.searchParams.append('location', 'coordinates');
            windyUrl.searchParams.append('metricWind', 'default');
            windyUrl.searchParams.append('metricTemp', 'default');

            iframe.src = windyUrl.toString();

            // Add iframe to the container
            windyDiv.appendChild(iframe);

            // Create a placeholder Windy instance that will control the iframe
            windyInstance.value = {
              iframe,
              map: props.mapInstance, // Use our existing Leaflet map for positioning
              setOverlay: (overlay: string) => {
                try {
                  // Try to communicate with the iframe to change the overlay
                  if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                      type: 'setOverlay',
                      overlay
                    }, '*');
                  }
                } catch (error) {
                  console.error('Error setting overlay:', error);
                }
              },
              setLevel: (level: string) => {
                try {
                  // Try to communicate with the iframe to change the level
                  if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                      type: 'setLevel',
                      level
                    }, '*');
                  }
                } catch (error) {
                  console.error('Error setting level:', error);
                }
              }
            };

            // Listen for messages from the iframe
            window.addEventListener('message', (event) => {
              if (event.source === iframe.contentWindow) {
                console.log('Received message from Windy iframe:', event.data);
              }
            });

            console.log('Created iframe-based Windy integration');
          } else {
            throw new Error('W.require function not found');
          }
        } catch (moduleError) {
          console.error('Error loading Windy modules:', moduleError);

          // Create a fallback implementation
          console.log('Creating fallback implementation');

          // Create a placeholder Windy instance
          windyInstance.value = {
            map: props.mapInstance, // Use our existing Leaflet map
            setOverlay: (overlay: string) => {
              console.log(`Would set overlay to ${overlay} if API was available`);
            },
            setLevel: (level: string) => {
              console.log(`Would set level to ${level} if API was available`);
            }
          };

          // Add a message to the Windy container explaining the situation
          const messageDiv = document.createElement('div');
          messageDiv.style.position = 'absolute';
          messageDiv.style.top = '50%';
          messageDiv.style.left = '50%';
          messageDiv.style.transform = 'translate(-50%, -50%)';
          messageDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
          messageDiv.style.padding = '20px';
          messageDiv.style.borderRadius = '5px';
          messageDiv.style.maxWidth = '80%';
          messageDiv.style.textAlign = 'center';
          messageDiv.style.zIndex = '1000';
          messageDiv.innerHTML = `
            <h3 style="margin-top: 0;">Windy API Compatibility Issue</h3>
            <p>The Windy API structure has changed and is not compatible with this application.</p>
            <p>Please check the browser console for more details.</p>
            <p style="margin-top: 10px; font-size: 0.9em;">
              <a href="https://api.windy.com/api/maps-api/getting-started" target="_blank" style="color: #1e88e5; text-decoration: underline;">
                Windy API Documentation
              </a>
            </p>
          `;
          windyDiv.appendChild(messageDiv);
        }

        console.log('Windy map initialized with available methods');
      } else {
        throw new Error('Windy API (W object) not found. The script may have failed to load properly.');
      }
    } catch (initError) {
      console.error('Error during Windy map initialization:', initError);
      throw new Error(`Windy map initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`);
    }

    // Sync Leaflet map with Windy map
    console.log('Syncing maps...');
    syncMaps();

    isWindyInitialized.value = true;
    mapStore.setLayerError('windy', null);
    console.log('Windy initialized successfully');
  } catch (error) {
    console.error('Error initializing Windy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Windy';
    windyError.value = errorMessage;
    mapStore.setLayerError('windy', errorMessage);

    // Clean up on error
    if (windyContainer.value) {
      try {
        windyContainer.value.innerHTML = '';
      } catch (cleanupError) {
        console.error('Error cleaning up after failed initialization:', cleanupError);
      }
    }
  } finally {
    isWindyLoading.value = false;
    mapStore.setLayerLoading('windy', false);
  }
};

// Load Windy script
const loadWindyScript = () => {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://api.windy.com/assets/map-forecast/libBoot.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Windy script'));
    document.head.appendChild(script);
  });
};

// Sync Leaflet map with Windy map
const syncMaps = () => {
  if (!props.mapInstance || !windyInstance.value) {
    console.warn('Cannot sync maps: map instance or Windy instance not available');
    return;
  }

  console.log('Setting up map sync events');

  // Function to update Windy view
  const updateWindyView = () => {
    if (!windyInstance.value || !mapStore.mapSettings.layers.windy.visible) return;

    try {
      const center = props.mapInstance.getCenter();
      const zoom = props.mapInstance.getZoom();

      console.log(`Syncing Windy map to: lat=${center.lat}, lng=${center.lng}, zoom=${zoom}`);

      // Check if we're using the iframe approach
      if (windyInstance.value.iframe) {
        // Get the current iframe
        const iframe = windyInstance.value.iframe;

        // If the iframe is not loaded yet, skip
        if (!iframe.contentWindow) {
          console.log('Iframe not loaded yet, skipping view update');
          return;
        }

        // Validate the center coordinates
        if (isNaN(center.lat) || isNaN(center.lng) || !isFinite(center.lat) || !isFinite(center.lng)) {
          console.error('Invalid center coordinates:', center);
          return;
        }

        // Validate the zoom level
        if (isNaN(zoom) || !isFinite(zoom) || zoom < 0 || zoom > 20) {
          console.error('Invalid zoom level:', zoom);
          return;
        }

        try {
          // Get the current URL
          const currentUrl = new URL(iframe.src);

          // Update the URL parameters with validated values
          currentUrl.searchParams.set('lat', center.lat.toFixed(6));
          currentUrl.searchParams.set('lon', center.lng.toFixed(6));
          currentUrl.searchParams.set('zoom', Math.round(zoom).toString());

          // Update the iframe src
          console.log('Updating iframe URL with new view:', currentUrl.toString());
          iframe.src = currentUrl.toString();
        } catch (error) {
          console.error('Error updating iframe URL:', error);
        }
      }
      // Check if we have the map property in the Windy API
      else if (windyInstance.value.map && typeof windyInstance.value.map.setView === 'function') {
        windyInstance.value.map.setView([center.lat, center.lng], zoom);
      } else {
        console.warn('Windy map API structure is different than expected');
      }
    } catch (error) {
      console.error('Error syncing maps:', error);
    }
  };

  // Debounce function to limit update frequency
  const debounce = (func: Function, wait: number) => {
    let timeout: number | null = null;
    return function(...args: any[]) {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      timeout = window.setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  };

  // Debounced update function - use a longer delay to prevent too many iframe reloads
  const debouncedUpdate = debounce(updateWindyView, 500);

  // Sync Leaflet -> Windy only on moveend (which also fires after zoomend)
  props.mapInstance.on('moveend', debouncedUpdate);

  // Initial sync
  updateWindyView();
};

// Update Windy overlay
const updateWindyOverlay = (overlay: string) => {
  if (!windyInstance.value) {
    // If Windy is not initialized but should be visible, try to initialize it
    if (mapStore.mapSettings.layers.windy.visible && !isWindyInitialized.value && !isWindyLoading.value) {
      initWindy().then(() => {
        if (windyInstance.value) {
          try {
            updateWindySettings({ overlay });
          } catch (error) {
            console.error('Error updating Windy overlay after init:', error);
          }
        }
      });
    }
    return;
  }

  try {
    updateWindySettings({ overlay });
    console.log(`Windy overlay updated to ${overlay}`);
  } catch (error) {
    console.error('Error updating Windy overlay:', error);
    // If there's an error, try to reinitialize Windy
    if (mapStore.mapSettings.layers.windy.visible) {
      windyError.value = 'Error updating overlay. Trying to reconnect...';
      setTimeout(() => {
        initWindy();
      }, 1000);
    }
  }
};

// Update Windy level
const updateWindyLevel = (level: string) => {
  if (!windyInstance.value) {
    // If Windy is not initialized but should be visible, try to initialize it
    if (mapStore.mapSettings.layers.windy.visible && !isWindyInitialized.value && !isWindyLoading.value) {
      initWindy().then(() => {
        if (windyInstance.value) {
          try {
            updateWindySettings({ level });
          } catch (error) {
            console.error('Error updating Windy level after init:', error);
          }
        }
      });
    }
    return;
  }

  try {
    updateWindySettings({ level });
    console.log(`Windy level updated to ${level}`);
  } catch (error) {
    console.error('Error updating Windy level:', error);
    // If there's an error, try to reinitialize Windy
    if (mapStore.mapSettings.layers.windy.visible) {
      windyError.value = 'Error updating level. Trying to reconnect...';
      setTimeout(() => {
        initWindy();
      }, 1000);
    }
  }
};

// Helper function to update Windy settings
const updateWindySettings = (settings: { overlay?: string, level?: string }) => {
  if (!windyInstance.value) return;

  console.log('Updating Windy settings:', settings);

  try {
    // Check if we're using the iframe approach
    if (windyInstance.value.iframe) {
      // Get the current iframe
      const iframe = windyInstance.value.iframe;

      // If the iframe is not loaded yet, store the settings to apply later
      if (!iframe.contentWindow) {
        console.log('Iframe not loaded yet, will update settings when it loads');
        return;
      }

      try {
        // Get the current URL
        const currentUrl = new URL(iframe.src);

        // Update the URL parameters
        if (settings.overlay) {
          currentUrl.searchParams.set('overlay', settings.overlay);
        }

        if (settings.level) {
          currentUrl.searchParams.set('level', settings.level);
        }

        // Get current map position for validation
        if (props.mapInstance) {
          const center = props.mapInstance.getCenter();
          const zoom = props.mapInstance.getZoom();

          // Validate and update coordinates if they exist in the URL
          if (center && !isNaN(center.lat) && !isNaN(center.lng) &&
              isFinite(center.lat) && isFinite(center.lng)) {
            currentUrl.searchParams.set('lat', center.lat.toFixed(6));
            currentUrl.searchParams.set('lon', center.lng.toFixed(6));
          }

          // Validate and update zoom if it exists in the URL
          if (!isNaN(zoom) && isFinite(zoom) && zoom >= 0 && zoom <= 20) {
            currentUrl.searchParams.set('zoom', Math.round(zoom).toString());
          }
        }

        // Update the iframe src
        console.log('Updating iframe URL with new settings:', currentUrl.toString());
        iframe.src = currentUrl.toString();
      } catch (error) {
        console.error('Error updating iframe URL with settings:', error);
      }

      return;
    }

    // Try different API structures as fallback
    if (windyInstance.value.picker && typeof windyInstance.value.picker.set === 'function') {
      // Standard API structure
      windyInstance.value.picker.set(settings);
    } else if (windyInstance.value.store && typeof windyInstance.value.store.set === 'function') {
      // Alternative API structure
      windyInstance.value.store.set(settings);
    } else if (typeof windyInstance.value.setOverlay === 'function' && settings.overlay) {
      // Direct method calls
      windyInstance.value.setOverlay(settings.overlay);
    } else if (typeof windyInstance.value.setLevel === 'function' && settings.level) {
      // Direct method calls
      windyInstance.value.setLevel(settings.level);
    } else {
      // Log that we couldn't find a way to update settings
      console.warn('Could not find a method to update Windy settings:', {
        settings,
        windyInstanceMethods: Object.keys(windyInstance.value || {})
      });
    }
  } catch (error) {
    console.error('Error updating Windy settings:', error);
  }
};

// Show/hide Windy layer
const toggleWindyVisibility = (visible: boolean) => {
  if (visible) {
    // Create container if it doesn't exist
    if (!windyContainer.value) {
      windyContainer.value = document.createElement('div');
      windyContainer.value.id = 'windy-container';
      windyContainer.value.style.position = 'absolute';
      windyContainer.value.style.top = '0';
      windyContainer.value.style.left = '0';
      windyContainer.value.style.width = '100%';
      windyContainer.value.style.height = '100%';
      windyContainer.value.style.zIndex = '400';
      // Allow pointer events so users can interact with the Windy iframe
      windyContainer.value.style.pointerEvents = 'auto';

      // Add container to map if map instance exists
      if (props.mapInstance && props.mapInstance._container) {
        props.mapInstance._container.appendChild(windyContainer.value);
      }
    }

    // Show container
    windyContainer.value.style.display = 'block';

    // Initialize Windy if not already initialized
    if (!isWindyInitialized.value && !isWindyLoading.value) {
      initWindy();
    } else if (windyInstance.value && windyInstance.value.iframe) {
      // If already initialized with iframe, make sure it's visible
      windyInstance.value.iframe.style.display = 'block';

      // Update the iframe with current map position
      const center = props.mapInstance.getCenter();
      const zoom = props.mapInstance.getZoom();

      try {
        // Validate the center coordinates
        if (isNaN(center.lat) || isNaN(center.lng) || !isFinite(center.lat) || !isFinite(center.lng)) {
          console.error('Invalid center coordinates:', center);
          return;
        }

        // Validate the zoom level
        if (isNaN(zoom) || !isFinite(zoom) || zoom < 0 || zoom > 20) {
          console.error('Invalid zoom level:', zoom);
          return;
        }

        const currentUrl = new URL(windyInstance.value.iframe.src);
        currentUrl.searchParams.set('lat', center.lat.toFixed(6));
        currentUrl.searchParams.set('lon', center.lng.toFixed(6));
        currentUrl.searchParams.set('zoom', Math.round(zoom).toString());
        currentUrl.searchParams.set('overlay', mapStore.windyOptions.overlay);
        currentUrl.searchParams.set('level', mapStore.windyOptions.level);

        windyInstance.value.iframe.src = currentUrl.toString();
      } catch (error) {
        console.error('Error updating iframe URL:', error);
      }
    }
  } else if (windyContainer.value) {
    // Hide container
    windyContainer.value.style.display = 'none';

    // If using iframe, also hide it
    if (windyInstance.value && windyInstance.value.iframe) {
      windyInstance.value.iframe.style.display = 'none';
    }
  }
};

// Watch for changes in Windy options
watch(() => mapStore.windyOptions.overlay, (newOverlay) => {
  if (isWindyInitialized.value) {
    updateWindyOverlay(newOverlay);
  }
});

watch(() => mapStore.windyOptions.level, (newLevel) => {
  if (isWindyInitialized.value) {
    updateWindyLevel(newLevel);
  }
});

// Watch for changes in layer visibility
watch(() => mapStore.mapSettings.layers.windy.visible, (visible) => {
  toggleWindyVisibility(visible);
});

// Initialize on mount
onMounted(() => {
  if (mapStore.mapSettings.layers.windy.visible) {
    initWindy();
  }
});

// Cleanup on unmount
onUnmounted(() => {
  console.log('WindyLayer unmounting, cleaning up resources...');

  // Remove event listeners
  if (props.mapInstance) {
    try {
      // Only need to remove the moveend listener since we're not using zoomend anymore
      props.mapInstance.off('moveend');
      console.log('Removed map event listeners');
    } catch (error) {
      console.error('Error removing map event listeners:', error);
    }
  }

  // Remove message event listener
  try {
    window.removeEventListener('message', (event) => {
      console.log('Removed message event listener');
    });
  } catch (error) {
    console.error('Error removing message event listener:', error);
  }

  if (windyInstance.value) {
    // Clean up Windy instance
    try {
      console.log('Cleaning up Windy instance');

      // If we're using the iframe approach, clean up the iframe
      if (windyInstance.value.iframe) {
        try {
          // Clear iframe content
          if (windyInstance.value.iframe.contentWindow) {
            windyInstance.value.iframe.contentWindow.location.replace('about:blank');
          }

          // Remove iframe from DOM
          if (windyInstance.value.iframe.parentNode) {
            windyInstance.value.iframe.parentNode.removeChild(windyInstance.value.iframe);
          }

          console.log('Removed Windy iframe');
        } catch (iframeError) {
          console.error('Error cleaning up Windy iframe:', iframeError);
        }
      }

      // Try to close Windy properly if possible
      if (typeof windyInstance.value.close === 'function') {
        windyInstance.value.close();
      }

      windyInstance.value = null;
    } catch (error) {
      console.error('Error cleaning up Windy instance:', error);
    }
  }

  // Remove container
  if (windyContainer.value) {
    try {
      console.log('Removing Windy container');
      // Clear the container first
      windyContainer.value.innerHTML = '';

      // Remove from DOM if it has a parent
      if (windyContainer.value.parentNode) {
        windyContainer.value.parentNode.removeChild(windyContainer.value);
      }
    } catch (error) {
      console.error('Error removing Windy container:', error);
    }
  }

  // Reset state
  isWindyInitialized.value = false;
  windyInstance.value = null;
  windyContainer.value = null;
  windyError.value = null;

  console.log('WindyLayer cleanup complete');
});

// Expose methods to parent
defineExpose({
  initWindy,
  updateWindyOverlay,
  updateWindyLevel,
  toggleWindyVisibility
});
</script>

<template>
  <div class="windy-controls" v-if="mapStore.mapSettings.layers.windy.visible">
    <div class="windy-panel bg-white rounded-lg shadow-md p-3 absolute bottom-32 right-4 z-map-controls">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-sm font-semibold text-sea-dark">Windy Controls</h3>
        <a
          href="https://www.windy.com"
          target="_blank"
          class="text-xs text-sea-blue hover:underline"
          title="Open Windy.com in a new tab"
        >
          Windy.com
        </a>
      </div>

      <!-- Overlay selector -->
      <div class="mb-3">
        <label class="block text-xs text-gray-600 mb-1">Weather Layer</label>
        <select
          v-model="mapStore.windyOptions.overlay"
          class="w-full text-sea-dark px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-sea-blue"
          :disabled="isWindyLoading"
          @change="updateWindyOverlay(mapStore.windyOptions.overlay)"
        >
          <option value="wind">Wind</option>
          <option value="temp">Temperature</option>
          <option value="rain">Rain / Snow</option>
          <option value="clouds">Clouds</option>
          <option value="waves">Waves</option>
          <option value="pressure">Pressure</option>
        </select>
      </div>

      <!-- Level selector -->
      <div class="mb-3">
        <label class="block text-xs text-gray-600 mb-1">Altitude</label>
        <select
          v-model="mapStore.windyOptions.level"
          class="w-full text-sea-dark px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-sea-blue"
          :disabled="isWindyLoading"
          @change="updateWindyLevel(mapStore.windyOptions.level)"
        >
          <option value="surface">Surface</option>
          <option value="1000h">1000 hPa</option>
          <option value="850h">850 hPa</option>
          <option value="700h">700 hPa</option>
          <option value="500h">500 hPa</option>
          <option value="300h">300 hPa</option>
          <option value="200h">200 hPa</option>
        </select>
      </div>

      <div class="flex space-x-2">
        <!-- Reset button -->
        <button
          @click="mapStore.resetWindyOptions"
          class="flex-1 px-2 py-1 text-xs bg-sea-light text-white rounded hover:bg-sea-blue transition-colors"
          :disabled="isWindyLoading"
        >
          Reset
        </button>

        <!-- Refresh button -->
        <button
          @click="initWindy"
          class="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          :disabled="isWindyLoading"
        >
          Refresh
        </button>
      </div>

      <!-- Loading indicator -->
      <div v-if="isWindyLoading" class="mt-2 text-xs text-center text-gray-600 flex items-center justify-center">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-sea-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading weather data...
      </div>

      <!-- Error message -->
      <div v-if="windyError" class="mt-2 text-xs text-center text-red-600">
        <p class="font-semibold">Error:</p>
        <p>{{ windyError }}</p>
        <div class="mt-2 flex space-x-2 justify-center">
          <button
            @click="initWindy"
            class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Note about iframe -->
      <div class="mt-2 text-xs text-center text-gray-500">
        <p>You can interact directly with the Windy map</p>
      </div>
    </div>
  </div>
</template>

<style>
/* Add Windy API types to window object */
declare global {
  interface Window {
    W: any;
    windyInit: (options: any, callback: (api: any) => void) => void;
    windyAPI: any;
  }
}
</style>
