# OpenSeaMap Explorer

A responsive maritime web map application built with Vue 3, Leaflet.js, and TailwindCSS that integrates OpenSeaMap data.

## Features

- **Interactive Map Display**: Leaflet-based map centered on user's location with smooth zoom controls
- **Maritime Navigation Layers**: Toggle visibility of sea marks, harbor facilities, coordinate grid, depth soundings, and bathymetric contours
- **Feature Interactions**: Tooltips and popups for maritime features with detailed information
- **Distance Measurement Tool**: Measure distances between points on the map
- **Responsive Design**: Mobile-first approach for all screen sizes
- **Performance Optimized**: Layer clustering, viewport-based loading, and data caching

## Technical Stack

- **Frontend Framework**: Vue 3 with Composition API
- **Map Library**: Leaflet.js
- **Styling**: TailwindCSS
- **State Management**: Pinia
- **TypeScript**: Type-safe development
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 16+ or Bun
- Modern web browser

### Installation

```sh
# Install dependencies
bun install

# Start development server
bun dev
```

### Building for Production

```sh
# Type-check and build for production
bun run build
```

## Project Structure

- `src/components/` - Vue components
  - `MapContainer.vue` - Main Leaflet map container
  - `LayerControl.vue` - Layer visibility toggle controls
  - `MeasurementTool.vue` - Distance measurement functionality
  - `FeatureInfo.vue` - Feature tooltips and popups
  - `LoadingIndicator.vue` - Loading state indicator
- `src/services/` - API and data services
  - `maritimeService.ts` - OpenSeaMap data fetching and processing
- `src/stores/` - Pinia stores
  - `mapStore.ts` - Map state management
- `src/types/` - TypeScript interfaces
  - `maritime.ts` - Types for maritime data
- `src/utils/` - Utility functions
  - `geolocation.ts` - User location and coordinate formatting

## Data Attribution

- OpenSeaMap data © [OpenSeaMap](https://www.openseamap.org/) contributors
- Base map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors

## License

This project is licensed under the MIT License - see the LICENSE file for details.
