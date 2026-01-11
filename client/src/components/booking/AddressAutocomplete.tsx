import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

interface AddressComponents {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (fullAddress: string, components: AddressComponents) => void;
  placeholder?: string;
  className?: string;
}

declare global {
  interface Window {
    google: typeof google;
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-script";

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function parseAddressFromPlace(place: any): AddressComponents {
  const addressComponents = place.addressComponents || [];
  let streetNumber = "";
  let route = "";
  let city = "";
  let state = "";
  let zipCode = "";

  for (const component of addressComponents) {
    const types = component.types || [];
    if (types.includes("street_number")) {
      streetNumber = component.longText || "";
    } else if (types.includes("route")) {
      route = component.longText || "";
    } else if (types.includes("locality")) {
      city = component.longText || "";
    } else if (types.includes("sublocality_level_1") && !city) {
      city = component.longText || "";
    } else if (types.includes("administrative_area_level_1")) {
      state = component.shortText || "";
    } else if (types.includes("postal_code")) {
      zipCode = component.longText || "";
    }
  }

  const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
  const fullAddress = place.formattedAddress || "";

  return {
    streetAddress,
    city,
    state,
    zipCode,
    fullAddress,
  };
}

export function AddressAutocomplete({ value, onChange, placeholder = "Start typing an address...", className }: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualFields, setManualFields] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });

  useEffect(() => {
    let mounted = true;
    
    const initAutocomplete = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        setManualMode(true);
        setIsLoading(false);
        return;
      }

      try {
        await loadGoogleMapsScript(apiKey);
        
        if (!mounted) return;
        
        console.log("[AddressAutocomplete] Importing places library...");
        const placesLib = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
        console.log("[AddressAutocomplete] Places library loaded:", Object.keys(placesLib));
        
        if (!placesLib.PlaceAutocompleteElement) {
          console.error("[AddressAutocomplete] PlaceAutocompleteElement not available - falling back to manual mode");
          if (mounted) {
            setManualMode(true);
            setIsLoading(false);
          }
          return;
        }
        
        const { PlaceAutocompleteElement } = placesLib;
        
        if (!mounted || !containerRef.current) return;
        
        console.log("[AddressAutocomplete] Creating PlaceAutocompleteElement...");
        
        // Create the autocomplete element
        const autocomplete = new PlaceAutocompleteElement({
          componentRestrictions: { country: "us" },
        });
        
        autocompleteRef.current = autocomplete;
        console.log("[AddressAutocomplete] PlaceAutocompleteElement created");
        
        // Listen for place selection
        autocomplete.addEventListener("gmp-placeselect", async (event: any) => {
          const place = event.place;
          
          await place.fetchFields({
            fields: ["formattedAddress", "addressComponents", "displayName", "location"]
          });
          
          const components = parseAddressFromPlace(place);
          onChange(components.fullAddress, components);
        });
        
        // Append to container
        if (containerRef.current && mounted) {
          containerRef.current.appendChild(autocomplete);
          setIsReady(true);
        }
        
        setIsLoading(false);
      } catch (err: any) {
        console.error("[AddressAutocomplete] Google Maps failed to load:", err?.message || err, err);
        if (mounted) {
          setError("Address suggestions unavailable");
          setManualMode(true);
          setIsLoading(false);
        }
      }
    };
    
    initAutocomplete();
    
    return () => {
      mounted = false;
      if (autocompleteRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(autocompleteRef.current);
        } catch (e) {
          // Element may already be removed
        }
      }
    };
  }, [onChange]);

  const handleManualChange = (field: keyof typeof manualFields, val: string) => {
    const updated = { ...manualFields, [field]: val };
    setManualFields(updated);
    
    const fullAddress = [
      updated.streetAddress,
      updated.city,
      updated.state,
      updated.zipCode,
    ].filter(Boolean).join(", ");
    
    onChange(fullAddress, {
      ...updated,
      fullAddress,
    });
  };

  if (manualMode) {
    return (
      <div className={`space-y-3 ${className}`}>
        {error && (
          <div className="flex items-center gap-2 text-xs text-amber-600 mb-2">
            <AlertCircle className="h-3 w-3" />
            <span>{error} - Enter address manually</span>
          </div>
        )}
        <div>
          <Label htmlFor="street-address" className="text-sm">Street Address</Label>
          <Input
            id="street-address"
            value={manualFields.streetAddress}
            onChange={(e) => handleManualChange("streetAddress", e.target.value)}
            placeholder="123 Main Street"
            data-testid="input-street-address"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city" className="text-sm">City</Label>
            <Input
              id="city"
              value={manualFields.city}
              onChange={(e) => handleManualChange("city", e.target.value)}
              placeholder="City"
              data-testid="input-city"
            />
          </div>
          <div>
            <Label htmlFor="state" className="text-sm">State</Label>
            <Input
              id="state"
              value={manualFields.state}
              onChange={(e) => handleManualChange("state", e.target.value.toUpperCase().slice(0, 2))}
              placeholder="CA"
              maxLength={2}
              data-testid="input-state"
            />
          </div>
        </div>
        <div className="w-1/2">
          <Label htmlFor="zip-code" className="text-sm">ZIP Code</Label>
          <Input
            id="zip-code"
            value={manualFields.zipCode}
            onChange={(e) => handleManualChange("zipCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="12345"
            maxLength={5}
            data-testid="input-zip-code"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative">
        {isLoading && (
          <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading address search...</span>
          </div>
        )}
        <div 
          ref={containerRef}
          className={`${isLoading ? 'hidden' : ''} [&>gmp-place-autocomplete]:w-full [&>gmp-place-autocomplete]:block`}
          data-testid="input-address-autocomplete"
        />
      </div>
      {isReady && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" />
          Powered by Google
        </p>
      )}
    </div>
  );
}
