import axios from 'axios';
import type {
  MaritimeFeature,
  HarborFacility,
  SeaMark,
  DepthSounding,
  BathymetricContour
} from '@/types/maritime';

// Cache configuration
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes in milliseconds
const cache: Record<string, { data: any; timestamp: number }> = {};

// Rate limiting configuration
const API_RATE_LIMIT = 5; // requests per second
let requestQueue: Array<() => Promise<any>> = [];
let processingQueue = false;

// Base URLs for different OpenSeaMap services
const TILE_SERVER_URL = 'https://tiles.openseamap.org';
const API_BASE_URL = 'https://map.openseamap.org/api';

// Proxy server URLs (replace with your actual server URL in production)
const PROXY_SERVER_URL = 'http://localhost:3000/api';
const HARBOR_API_URL = `${PROXY_SERVER_URL}/harbors`;
const DEPTH_10M_URL = `${PROXY_SERVER_URL}/depth/10m`;
const DEPTH_100M_URL = `${PROXY_SERVER_URL}/depth/100m`;

// Check if the OpenSeaMap tile server is accessible
export const checkTileServerAccess = async (): Promise<boolean> => {
  try {
    // Try to fetch a test tile
    const response = await fetch(`${TILE_SERVER_URL}/seamark/1/1/1.png`, {
      method: 'HEAD',
      cache: 'no-cache'
    });

    return response.ok;
  } catch (error) {
    console.error('Error checking tile server access:', error);
    return false;
  }
};

// Process the request queue with rate limiting
const processQueue = async () => {
  if (processingQueue || requestQueue.length === 0) return;

  processingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error) {
        console.error('Error processing queued request:', error);
      }

      // Wait to respect rate limit
      await new Promise(resolve => setTimeout(resolve, 1000 / API_RATE_LIMIT));
    }
  }

  processingQueue = false;
};

// Add a request to the queue
const queueRequest = <T>(request: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await request();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    // Start processing the queue if it's not already running
    if (!processingQueue) {
      processQueue();
    }
  });
};

// Check if cached data is still valid
const isCacheValid = (key: string): boolean => {
  if (!cache[key]) return false;

  const now = Date.now();
  return now - cache[key].timestamp < CACHE_EXPIRY;
};

// Generic fetch function with caching
const fetchWithCache = async <T>(url: string, params: Record<string, any> = {}): Promise<T> => {
  // Create a cache key from the URL and params
  const cacheKey = `${url}?${new URLSearchParams(params).toString()}`;

  // Check if we have valid cached data
  if (isCacheValid(cacheKey)) {
    return cache[cacheKey].data as T;
  }

  // Queue the actual request
  const data = await queueRequest<T>(async () => {
    const response = await axios.get<T>(url, { params });
    return response.data;
  });

  // Cache the result
  cache[cacheKey] = {
    data,
    timestamp: Date.now()
  };

  return data;
};
// https://t2.openseamap.org/tile/16/34738/21014.png
// Get tile URL for OpenSeaMap layers
export const getOpenSeaMapTileUrl = (layer: string): string => {
  switch (layer) {
    case 'base':
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    case 'seamark':
      return `${TILE_SERVER_URL}/seamark/{z}/{x}/{y}.png`;
    case 'harbor':
      return `${TILE_SERVER_URL}/harbor/{z}/{x}/{y}.png`;
    case 'grid':
      return `${TILE_SERVER_URL}/grid/{z}/{x}/{y}.png`;
    default:
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
};

// Fetch sea marks in a bounding box
export const fetchSeaMarks = async (
  bounds: [[number, number], [number, number]] // [[south, west], [north, east]]
): Promise<SeaMark[]> => {
  const [sw, ne] = bounds;
  const params = {
    bbox: `${sw[1]},${sw[0]},${ne[1]},${ne[0]}`, // west,south,east,north
    type: 'seamark'
  };

  try {
    return await fetchWithCache<SeaMark[]>(`${API_BASE_URL}/seamark`, params);
  } catch (error) {
    console.error('Error fetching sea marks:', error);
    throw new Error('Failed to fetch sea marks data');
  }
};

// Parse harbor data from OpenSeaMap's special format
const parseHarborData = (responseText: string): HarborFacility[] => {
  const harbors: HarborFacility[] = [];

  // The response is in the format: putHarbourMarker(id, lon, lat, name, country, size);
  const regex = /putHarbourMarker\((\d+),\s*([\d.-]+),\s*([\d.-]+),\s*'([^']*)',\s*'([^']*)',\s*(\d+)\);/g;

  let match;
  while ((match = regex.exec(responseText)) !== null) {
    const [_, id, lon, lat, name, country, size] = match;

    harbors.push({
      id: id,
      type: 'harbor',
      name: name,
      coordinates: [parseFloat(lon), parseFloat(lat)],
      metadata: {
        country: country,
        size: parseInt(size),
        icon: `https://map.openseamap.org/resources/places/harbour_32.png`
      }
    });
  }

  return harbors;
};

// Fetch harbor facilities in a bounding box
export const fetchHarborFacilities = async (
  bounds: [[number, number], [number, number]] // [[south, west], [north, east]]
): Promise<HarborFacility[]> => {
  const [sw, ne] = bounds;

  // OpenSeaMap harbor API uses different parameter names
  const params = {
    b: sw[0].toString(), // bottom (south)
    t: ne[0].toString(), // top (north)
    l: sw[1].toString(), // left (west)
    r: ne[1].toString(), // right (east)
    ucid: '2',           // user context ID (required by API)
    maxSize: '4',        // maximum harbor size to display
    zoom: '10'           // zoom level
  };

  // Create cache key
  const cacheKey = `harbors-${sw[0]}-${sw[1]}-${ne[0]}-${ne[1]}`;

  // Check cache
  if (isCacheValid(cacheKey)) {
    return cache[cacheKey].data as HarborFacility[];
  }

  try {
    console.log('Fetching harbor data with params:', params);

    // Use axios to fetch the data from our proxy server
    const response = await axios.get(HARBOR_API_URL, { params });

    // Parse the response text
    const harbors = parseHarborData(response.data);

    // Cache the result
    cache[cacheKey] = {
      data: harbors,
      timestamp: Date.now()
    };

    console.log(`Fetched ${harbors.length} harbors`);
    return harbors;
  } catch (error) {
    console.error('Error fetching harbor facilities:', error);
    throw new Error('Failed to fetch harbor facilities data');
  }
};

// Get WMS URL for depth data from our proxy server
export const getDepthWmsUrl = (resolution: '10m' | '100m'): string => {
  return resolution === '10m' ? DEPTH_10M_URL : DEPTH_100M_URL;
};

// Fetch bathymetric contours in a bounding box
export const fetchBathymetricContours = async (
  bounds: [[number, number], [number, number]] // [[south, west], [north, east]]
): Promise<BathymetricContour[]> => {
  const [sw, ne] = bounds;
  const params = {
    bbox: `${sw[1]},${sw[0]},${ne[1]},${ne[0]}`, // west,south,east,north
  };

  try {
    return await fetchWithCache<BathymetricContour[]>(`${API_BASE_URL}/contours`, params);
  } catch (error) {
    console.error('Error fetching bathymetric contours:', error);
    throw new Error('Failed to fetch bathymetric contours data');
  }
};

// Calculate distance between two points in meters (Haversine formula)
export const calculateDistance = (
  point1: [number, number], // [latitude, longitude]
  point2: [number, number]  // [latitude, longitude]
): number => {
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;

  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Calculate total distance of a path in meters
export const calculatePathDistance = (points: [number, number][]): number => {
  if (points.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 1; i < points.length; i++) {
    totalDistance += calculateDistance(points[i - 1], points[i]);
  }

  return totalDistance;
};
