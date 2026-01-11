import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JobLocationMapProps {
  customerLat: number;
  customerLng: number;
  providerLat?: number;
  providerLng?: number;
  providerLocationUpdatedAt?: string;
  jobLocation: string;
  onUpdateLocation?: () => void;
  isUpdatingLocation?: boolean;
}

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-script";

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if ((window as any).google?.maps) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const checkLoaded = setInterval(() => {
        if ((window as any).google?.maps) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return "< 0.1 mi";
  } else if (miles < 1) {
    return `${(miles * 5280).toFixed(0)} ft`;
  } else {
    return `${miles.toFixed(1)} mi`;
  }
}

export function JobLocationMap({
  customerLat,
  customerLng,
  providerLat,
  providerLng,
  providerLocationUpdatedAt,
  jobLocation,
  onUpdateLocation,
  isUpdatingLocation,
}: JobLocationMapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasProviderLocation = providerLat !== undefined && providerLng !== undefined;

  const distance = hasProviderLocation
    ? calculateHaversineDistance(customerLat, customerLng, providerLat!, providerLng!)
    : null;

  const relativeTime = providerLocationUpdatedAt
    ? formatDistanceToNow(new Date(providerLocationUpdatedAt), { addSuffix: true })
    : null;

  const googleMapsUrl = hasProviderLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${providerLat},${providerLng}&destination=${customerLat},${customerLng}`
    : `https://www.google.com/maps/search/?api=1&query=${customerLat},${customerLng}`;

  const appleMapsUrl = hasProviderLocation
    ? `https://maps.apple.com/?saddr=${providerLat},${providerLng}&daddr=${customerLat},${customerLng}`
    : `https://maps.apple.com/?q=${customerLat},${customerLng}`;

  const initMap = useCallback(async () => {
    if (!mapRef.current || !apiKey) return;

    try {
      await loadGoogleMapsScript(apiKey);
      
      const google = (window as any).google;
      const { Map } = await google.maps.importLibrary("maps");
      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

      const center = hasProviderLocation
        ? {
            lat: (customerLat + providerLat!) / 2,
            lng: (customerLng + providerLng!) / 2,
          }
        : { lat: customerLat, lng: customerLng };

      const map = new Map(mapRef.current, {
        center,
        zoom: 14,
        mapId: "job-location-map",
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
      });

      mapInstanceRef.current = map;

      markersRef.current.forEach((marker) => {
        if (marker.setMap) marker.setMap(null);
      });
      markersRef.current = [];

      const customerPin = new PinElement({
        background: "#3b82f6",
        borderColor: "#1d4ed8",
        glyphColor: "#ffffff",
      });

      const customerMarker = new AdvancedMarkerElement({
        map,
        position: { lat: customerLat, lng: customerLng },
        title: "Customer Location",
        content: customerPin.element,
      });
      markersRef.current.push(customerMarker);

      if (hasProviderLocation) {
        const providerPin = new PinElement({
          background: "#22c55e",
          borderColor: "#15803d",
          glyphColor: "#ffffff",
        });

        const providerMarker = new AdvancedMarkerElement({
          map,
          position: { lat: providerLat!, lng: providerLng! },
          title: "Your Location",
          content: providerPin.element,
        });
        markersRef.current.push(providerMarker);

        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: customerLat, lng: customerLng });
        bounds.extend({ lat: providerLat!, lng: providerLng! });
        map.fitBounds(bounds, { padding: 50 });
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error("[JobLocationMap] Failed to load:", err?.message || err);
      setError("Unable to load map");
      setIsLoading(false);
    }
  }, [apiKey, customerLat, customerLng, providerLat, providerLng, hasProviderLocation]);

  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps API key not configured");
      setIsLoading(false);
      return;
    }

    initMap();

    return () => {
      markersRef.current.forEach((marker) => {
        if (marker.setMap) marker.setMap(null);
      });
      markersRef.current = [];
    };
  }, [apiKey, initMap]);

  if (error) {
    return (
      <Card data-testid="card-job-location-map">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Job Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <p className="text-sm mt-2">{jobLocation}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              asChild
              data-testid="button-google-maps-directions"
            >
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4 mr-1" />
                Google Maps
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              data-testid="button-apple-maps-directions"
            >
              <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4 mr-1" />
                Apple Maps
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-job-location-map">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Job Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={mapRef}
          className="w-full h-48 sm:h-64 rounded-lg bg-muted overflow-hidden relative"
          data-testid="map-container"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium">Customer Location</span>
              <p className="text-muted-foreground text-xs">{jobLocation}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium">Your Location</span>
              {hasProviderLocation ? (
                <div className="text-muted-foreground text-xs flex items-center gap-1 flex-wrap">
                  {distance !== null && (
                    <span data-testid="text-distance">{formatDistance(distance)} away</span>
                  )}
                  {relativeTime && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5" data-testid="text-location-updated">
                        <Clock className="h-3 w-3" />
                        Updated {relativeTime}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs" data-testid="text-location-unavailable">
                  Location unavailable
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {onUpdateLocation && (
            <Button
              variant="default"
              size="sm"
              onClick={onUpdateLocation}
              disabled={isUpdatingLocation}
              data-testid="button-update-location"
            >
              {isUpdatingLocation ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-1" />
              )}
              Update My Location
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            asChild
            data-testid="button-google-maps-directions"
          >
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4 mr-1" />
              Google Maps
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            data-testid="button-apple-maps-directions"
          >
            <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4 mr-1" />
              Apple Maps
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
