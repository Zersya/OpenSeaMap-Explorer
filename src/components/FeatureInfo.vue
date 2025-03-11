<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { MaritimeFeature, HarborFacility } from '@/types/maritime';
import { formatCoordinates } from '@/utils/geolocation';
import Notification from './Notification.vue';

// Import Leaflet dynamically to avoid SSR issues
let L: any;

// Props
const props = defineProps<{
  mapInstance: any;
}>();

// State
const selectedFeature = ref<MaritimeFeature | null>(null);
const isPopupOpen = ref(false);
const notification = ref({
  show: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'warning' | 'error',
  duration: 3000
});

// Initialize feature info component
const initFeatureInfo = async () => {
  if (!L) {
    L = await import('leaflet');
  }

  if (props.mapInstance) {
    // Add click handler for feature selection
    props.mapInstance.on('click', handleMapClick);
  }
};

// Handle map click for feature selection
const handleMapClick = (e: any) => {
  // This would normally query features at the clicked location
  // For now, we'll just simulate it with a timeout

  // Close any open popup
  closePopup();

  // Check if we clicked near a feature (would be implemented with spatial query)
  // This is a placeholder for actual feature detection
  const randomFeatureNearby = Math.random() > 0.7;

  if (randomFeatureNearby) {
    // Simulate finding a feature
    setTimeout(() => {
      const isHarbor = Math.random() > 0.5;

      if (isHarbor) {
        const harbor: HarborFacility = {
          id: `harbor-${Date.now()}`,
          type: 'harbor',
          name: 'Sample Harbor',
          coordinates: [e.latlng.lng, e.latlng.lat],
          services: ['Fuel', 'Water', 'Electricity'],
          capacity: Math.floor(Math.random() * 100) + 20,
          depth: Math.floor(Math.random() * 10) + 2,
          contactInfo: {
            phone: '+1-234-567-8900',
            website: 'https://example.com',
            vhfChannel: '16'
          }
        };

        showFeaturePopup(harbor, e.latlng);
      } else {
        const seaMark: MaritimeFeature = {
          id: `mark-${Date.now()}`,
          type: Math.random() > 0.5 ? 'buoy' : 'beacon',
          name: 'Navigation Mark',
          characteristics: 'Fl(3) 10s',
          coordinates: [e.latlng.lng, e.latlng.lat],
          metadata: {
            color: 'Red and White',
            purpose: 'Safe Water Mark'
          }
        };

        showFeaturePopup(seaMark, e.latlng);
      }
    }, 300);
  }
};

// Show popup for a feature
const showFeaturePopup = (feature: MaritimeFeature, latlng: any) => {
  selectedFeature.value = feature;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.className = 'feature-popup';

  // Create popup HTML based on feature type
  if (feature.type === 'harbor') {
    const harbor = feature as HarborFacility;
    popupContent.innerHTML = `
      <div class="p-2">
        <h3 class="text-lg font-bold text-sea-blue">${harbor.name || 'Harbor'}</h3>
        <p class="text-sm text-gray-600">${formatCoordinates(
          [latlng.lat, latlng.lng],
          'dms'
        )}</p>

        <div class="mt-2">
          <p><strong>Capacity:</strong> ${harbor.capacity} berths</p>
          <p><strong>Depth:</strong> ${harbor.depth}m</p>

          ${harbor.services ? `
            <div class="mt-1">
              <strong>Services:</strong>
              <ul class="list-disc list-inside">
                ${harbor.services.map(service => `<li>${service}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${harbor.contactInfo ? `
            <div class="mt-2 border-t pt-2">
              <p><strong>VHF:</strong> Channel ${harbor.contactInfo.vhfChannel || 'N/A'}</p>
              <p><strong>Phone:</strong> ${harbor.contactInfo.phone || 'N/A'}</p>
              ${harbor.contactInfo.website ? `
                <p><strong>Website:</strong> <a href="${harbor.contactInfo.website}" target="_blank" class="text-blue-500 hover:underline">${harbor.contactInfo.website}</a></p>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else {
    // Generic maritime feature
    popupContent.innerHTML = `
      <div class="p-2">
        <h3 class="text-lg font-bold text-sea-blue">${feature.name || feature.type}</h3>
        <p class="text-sm text-gray-600">${formatCoordinates(
          [latlng.lat, latlng.lng],
          'dms'
        )}</p>

        <div class="mt-2">
          <p><strong>Type:</strong> ${feature.type}</p>
          ${feature.characteristics ? `<p><strong>Characteristics:</strong> ${feature.characteristics}</p>` : ''}

          ${feature.metadata ? `
            <div class="mt-1">
              ${Object.entries(feature.metadata).map(([key, value]) => `
                <p><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}</p>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Create and open popup
  const popup = L.popup({
    maxWidth: 300,
    className: 'maritime-feature-popup'
  })
    .setLatLng(latlng)
    .setContent(popupContent)
    .openOn(props.mapInstance);

  // Set state
  isPopupOpen.value = true;

  // Show notification
  notification.value = {
    show: true,
    message: `Showing details for ${feature.name || feature.type}`,
    type: 'info',
    duration: 3000
  };

  // Add close handler
  popup.on('remove', () => {
    isPopupOpen.value = false;
    selectedFeature.value = null;
  });
};

// Close any open popup
const closePopup = () => {
  if (isPopupOpen.value) {
    props.mapInstance.closePopup();
    isPopupOpen.value = false;
    selectedFeature.value = null;
  }
};

// Close notification
const closeNotification = () => {
  notification.value.show = false;
};

// Lifecycle hooks
onMounted(() => {
  if (props.mapInstance) {
    initFeatureInfo();
  }
});

onUnmounted(() => {
  if (props.mapInstance) {
    props.mapInstance.off('click', handleMapClick);
  }
});
</script>

<template>
  <!-- This component doesn't render anything directly, it just adds functionality to the map -->
  <Notification
    :show="notification.show"
    :message="notification.message"
    :type="notification.type"
    :duration="notification.duration"
    @close="closeNotification"
  />
</template>

<style>
/* Custom styles for the feature popup */
.maritime-feature-popup .leaflet-popup-content-wrapper {
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.maritime-feature-popup .leaflet-popup-content {
  margin: 0;
  padding: 0;
}

.maritime-feature-popup .leaflet-popup-tip {
  background-color: white;
}
</style>
