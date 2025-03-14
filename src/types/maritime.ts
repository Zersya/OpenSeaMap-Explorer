export interface MaritimeFeature {
  id: string;
  type: string;
  name?: string;
  characteristics?: string;
  metadata?: Record<string, any>;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface HarborFacility extends MaritimeFeature {
  type: 'harbor';
  services?: string[];
  capacity?: number;
  depth?: number;
  contactInfo?: {
    phone?: string;
    website?: string;
    vhfChannel?: string;
  };
}

export interface SeaMark extends MaritimeFeature {
  type: 'buoy' | 'beacon' | 'light';
  color?: string;
  lightCharacteristics?: string;
  purpose?: string;
}

export interface DepthSounding {
  coordinates: [number, number]; // [longitude, latitude]
  depth: number;
  timestamp?: string;
}

export interface BathymetricContour {
  depth: number;
  coordinates: Array<[number, number]>; // Array of [longitude, latitude] points
}

export interface LayerState {
  visible: boolean;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export interface MapSettings {
  center: [number, number]; // [latitude, longitude]
  zoom: number;
  layers: {
    seaMarks: LayerState;
    harborFacilities: LayerState;
    coordinateGrid: LayerState;
    depthSoundings: LayerState;
    bathymetricContours: LayerState;
    windy: LayerState;
  };
}

export interface WindyOptions {
  overlay: string; // 'wind', 'rain', 'temp', 'clouds', 'waves', 'pressure'
  level: string; // 'surface', '1000h', '850h', '700h', '500h', '300h', '200h'
  timestamp: number | null; // Unix timestamp for forecast time or null for current
}

export interface MeasurementPoint {
  coordinates: [number, number]; // [latitude, longitude]
  label?: string;
}

export interface MeasurementPath {
  id: string;
  points: MeasurementPoint[];
  distance: number; // in meters
}
