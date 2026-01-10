const ZIP_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "606": { lat: 41.8781, lng: -87.6298 },
  "607": { lat: 41.9742, lng: -87.9073 },
  "608": { lat: 41.7508, lng: -88.0475 },
  "600": { lat: 41.8827, lng: -87.6233 },
  "601": { lat: 41.8961, lng: -87.6553 },
  "602": { lat: 41.9203, lng: -87.7052 },
  "603": { lat: 41.8736, lng: -87.8089 },
  "604": { lat: 42.0333, lng: -87.8834 },
  "605": { lat: 42.0451, lng: -87.6877 },
  "100": { lat: 40.7128, lng: -74.0060 },
  "101": { lat: 40.7580, lng: -73.9855 },
  "102": { lat: 40.7484, lng: -73.9857 },
  "103": { lat: 40.6892, lng: -74.0445 },
  "104": { lat: 40.8448, lng: -73.8648 },
  "110": { lat: 40.7282, lng: -73.7949 },
  "111": { lat: 40.6501, lng: -73.9496 },
  "112": { lat: 40.6782, lng: -73.9442 },
  "900": { lat: 34.0522, lng: -118.2437 },
  "901": { lat: 34.0195, lng: -118.4912 },
  "902": { lat: 33.9425, lng: -118.4081 },
  "903": { lat: 33.8536, lng: -118.1340 },
  "904": { lat: 34.1478, lng: -118.1445 },
  "905": { lat: 33.8959, lng: -118.2201 },
  "906": { lat: 34.1425, lng: -118.2551 },
  "907": { lat: 34.1808, lng: -118.3090 },
  "908": { lat: 34.0689, lng: -118.0275 },
  "910": { lat: 34.1808, lng: -118.4645 },
  "911": { lat: 34.1478, lng: -118.1445 },
  "912": { lat: 34.1425, lng: -118.2551 },
  "913": { lat: 34.1808, lng: -118.3090 },
  "770": { lat: 29.7604, lng: -95.3698 },
  "771": { lat: 29.9511, lng: -95.3597 },
  "772": { lat: 29.8168, lng: -95.3916 },
  "773": { lat: 29.7855, lng: -95.4921 },
  "774": { lat: 29.6197, lng: -95.6349 },
  "750": { lat: 32.7767, lng: -96.7970 },
  "751": { lat: 32.7767, lng: -96.7970 },
  "752": { lat: 32.8998, lng: -96.8782 },
  "753": { lat: 32.9545, lng: -96.8300 },
  "850": { lat: 33.4484, lng: -112.0740 },
  "851": { lat: 33.4152, lng: -111.8315 },
  "852": { lat: 33.4255, lng: -111.9400 },
  "191": { lat: 39.9526, lng: -75.1652 },
  "192": { lat: 40.0379, lng: -75.1379 },
  "193": { lat: 40.0417, lng: -75.3000 },
  "194": { lat: 40.1157, lng: -75.2830 },
  "782": { lat: 29.4241, lng: -98.4936 },
  "783": { lat: 29.5241, lng: -98.5936 },
  "920": { lat: 32.7157, lng: -117.1611 },
  "921": { lat: 32.8227, lng: -117.1089 },
  "922": { lat: 32.6940, lng: -117.1611 },
  "337": { lat: 30.2672, lng: -97.7431 },
  "338": { lat: 30.3500, lng: -97.7000 },
  "339": { lat: 30.2000, lng: -97.8000 },
  "787": { lat: 30.2672, lng: -97.7431 },
  "300": { lat: 33.7490, lng: -84.3880 },
  "301": { lat: 33.8500, lng: -84.3600 },
  "302": { lat: 33.6500, lng: -84.4500 },
  "303": { lat: 33.9500, lng: -84.5500 },
};

function getZipPrefix(zipCode: string): string {
  const clean = zipCode.replace(/\D/g, "");
  return clean.slice(0, 3);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getDistanceBetweenZips(zip1: string, zip2: string): number {
  const prefix1 = getZipPrefix(zip1);
  const prefix2 = getZipPrefix(zip2);
  
  if (prefix1 === prefix2) {
    const lastDigits1 = parseInt(zip1.slice(3)) || 0;
    const lastDigits2 = parseInt(zip2.slice(3)) || 0;
    return 1 + Math.abs(lastDigits1 - lastDigits2) * 0.05;
  }
  
  const coords1 = ZIP_COORDINATES[prefix1];
  const coords2 = ZIP_COORDINATES[prefix2];
  
  if (coords1 && coords2) {
    return haversineDistance(coords1.lat, coords1.lng, coords2.lat, coords2.lng);
  }
  
  const num1 = parseInt(prefix1);
  const num2 = parseInt(prefix2);
  const diff = Math.abs(num1 - num2);
  
  return 5 + diff * 2;
}

export function estimateTravelTime(distanceMiles: number): number {
  const avgSpeedMph = 25;
  return Math.round((distanceMiles / avgSpeedMph) * 60);
}

export function extractZipFromLocation(location: string): string | null {
  const zipMatch = location.match(/\b(\d{5})(?:-\d{4})?\b/);
  return zipMatch ? zipMatch[1] : null;
}
