// Default fallback coordinates (Atlantic Ocean)
export const DEFAULT_COORDINATES: [number, number] = [40.7128, -74.0060];

// Options for the Geolocation API
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

/**
 * Get the user's current position
 * @returns Promise that resolves to [latitude, longitude]
 */
export const getUserLocation = (): Promise<[number, number]> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      resolve(DEFAULT_COORDINATES);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve([latitude, longitude]);
      },
      (error) => {
        console.warn(`Geolocation error (${error.code}): ${error.message}`);
        resolve(DEFAULT_COORDINATES);
      },
      GEOLOCATION_OPTIONS
    );
  });
};

/**
 * Watch the user's position and call the callback when it changes
 * @param callback Function to call when position changes
 * @returns Function to stop watching
 */
export const watchUserLocation = (
  callback: (position: [number, number]) => void
): () => void => {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    callback(DEFAULT_COORDINATES);
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      callback([latitude, longitude]);
    },
    (error) => {
      console.warn(`Geolocation error (${error.code}): ${error.message}`);
      callback(DEFAULT_COORDINATES);
    },
    GEOLOCATION_OPTIONS
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
};

/**
 * Format coordinates as a string
 * @param coordinates [latitude, longitude]
 * @param format 'dms' for degrees, minutes, seconds or 'dd' for decimal degrees
 * @returns Formatted coordinates string
 */
export const formatCoordinates = (
  coordinates: [number, number],
  format: 'dms' | 'dd' = 'dd'
): string => {
  const [latitude, longitude] = coordinates;

  if (format === 'dd') {
    return `${latitude.toFixed(6)}°, ${longitude.toFixed(6)}°`;
  }

  // Convert to degrees, minutes, seconds
  const formatDMS = (value: number, isLatitude: boolean): string => {
    const absolute = Math.abs(value);
    const degrees = Math.floor(absolute);
    const minutes = Math.floor((absolute - degrees) * 60);
    const seconds = ((absolute - degrees) * 60 - minutes) * 60;
    
    const direction = isLatitude
      ? value >= 0 ? 'N' : 'S'
      : value >= 0 ? 'E' : 'W';
    
    return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
  };

  const latDMS = formatDMS(latitude, true);
  const lonDMS = formatDMS(longitude, false);

  return `${latDMS}, ${lonDMS}`;
};
