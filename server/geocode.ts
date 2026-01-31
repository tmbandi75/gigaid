// Server can access VITE_ prefixed env vars in development
// Use GOOGLE_MAPS_API_KEY for production, fallback to VITE_ for dev
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

interface GeocodeResult {
  lat: number;
  lng: number;
}

export interface DrivingDistanceResult {
  distanceText: string;
  distanceMeters: number;
  durationText: string;
  durationSeconds: number;
}

export interface GeocodeExtendedResult {
  success: boolean;
  lat?: number;
  lng?: number;
  status: "OK" | "ZERO_RESULTS" | "REQUEST_DENIED" | "INVALID_REQUEST" | "OVER_QUERY_LIMIT" | "UNKNOWN_ERROR" | "NO_API_KEY" | "FETCH_ERROR";
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const result = await geocodeAddressExtended(address);
  if (result.success && result.lat !== undefined && result.lng !== undefined) {
    return { lat: result.lat, lng: result.lng };
  }
  return null;
}

export async function geocodeAddressExtended(address: string): Promise<GeocodeExtendedResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("[Geocode] No Google Maps API key configured");
    return { success: false, status: "NO_API_KEY" };
  }

  if (!address || address.trim().length === 0) {
    return { success: false, status: "INVALID_REQUEST" };
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("[Geocode] API request failed:", response.status, response.statusText);
      return { success: false, status: "FETCH_ERROR" };
    }

    const data = await response.json();
    
    if (data.status === "ZERO_RESULTS") {
      console.warn("[Geocode] No results for address:", address);
      return { success: false, status: "ZERO_RESULTS" };
    }
    
    if (data.status === "REQUEST_DENIED") {
      console.warn("[Geocode] Request denied for address:", address, "Error:", data.error_message);
      return { success: false, status: "REQUEST_DENIED" };
    }
    
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn("[Geocode] Unexpected status for address:", address, "Status:", data.status);
      return { success: false, status: data.status || "UNKNOWN_ERROR" };
    }

    const location = data.results[0].geometry?.location;
    
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      console.warn("[Geocode] Invalid location data for address:", address);
      return { success: false, status: "UNKNOWN_ERROR" };
    }

    console.log(`[Geocode] Successfully geocoded "${address}" to (${location.lat}, ${location.lng})`);
    
    return {
      success: true,
      lat: location.lat,
      lng: location.lng,
      status: "OK",
    };
  } catch (error) {
    console.error("[Geocode] Error geocoding address:", error);
    return { success: false, status: "FETCH_ERROR" };
  }
}

export async function getDrivingDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DrivingDistanceResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("[DrivingDistance] No Google Maps API key configured");
    return null;
  }

  try {
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&units=imperial&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("[DrivingDistance] API request failed:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.status !== "OK") {
      console.warn("[DrivingDistance] API returned status:", data.status);
      return null;
    }

    const element = data.rows?.[0]?.elements?.[0];
    
    if (!element || element.status !== "OK") {
      console.warn("[DrivingDistance] No route found, element status:", element?.status);
      return null;
    }

    return {
      distanceText: element.distance.text,
      distanceMeters: element.distance.value,
      durationText: element.duration.text,
      durationSeconds: element.duration.value,
    };
  } catch (error) {
    console.error("[DrivingDistance] Error calculating distance:", error);
    return null;
  }
}
