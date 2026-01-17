import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, AlertCircle, Loader2 } from "lucide-react";

interface AddressComponents {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (fullAddress: string, components: AddressComponents) => void;
  placeholder?: string;
  className?: string;
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
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

export function AddressAutocomplete({ value, onChange, placeholder = "Start typing an address...", className }: AddressAutocompleteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualFields, setManualFields] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setManualMode(true);
      setError("Google Maps API key not configured");
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        await loadGoogleMapsScript(apiKey);
        
        if (!mounted) return;

        const google = (window as any).google;
        const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
        
        if (!mounted || !containerRef.current) return;

        // Create the new PlaceAutocompleteElement
        const autocomplete = new PlaceAutocompleteElement({
          componentRestrictions: { country: ["us"] },
        });
        
        // Style the element
        autocomplete.style.width = "100%";
        autocomplete.style.height = "40px";
        
        // Listen for errors (e.g., billing not enabled)
        autocomplete.addEventListener("gmp-requesterror", (event: any) => {
          console.error("[AddressAutocomplete] API error:", event);
          if (mounted) {
            setError("Google Maps billing not enabled");
            setManualMode(true);
            setIsLoading(false);
          }
        });
        
        // Listen for place selection
        autocomplete.addEventListener("gmp-placeselect", async (event: any) => {
          const place = event.place;
          
          // Fetch address components and location
          await place.fetchFields({
            fields: ["addressComponents", "formattedAddress", "displayName", "location"],
          });

          const components = place.addressComponents || [];
          let streetNumber = "";
          let route = "";
          let city = "";
          let state = "";
          let zipCode = "";

          for (const comp of components) {
            const types = comp.types || [];
            if (types.includes("street_number")) {
              streetNumber = comp.longText || "";
            } else if (types.includes("route")) {
              route = comp.longText || "";
            } else if (types.includes("locality")) {
              city = comp.longText || "";
            } else if (types.includes("sublocality_level_1") && !city) {
              city = comp.longText || "";
            } else if (types.includes("administrative_area_level_1")) {
              state = comp.shortText || "";
            } else if (types.includes("postal_code")) {
              zipCode = comp.longText || "";
            }
          }

          const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
          const fullAddress = place.formattedAddress || place.displayName || "";
          
          // Extract coordinates
          const lat = place.location?.lat?.();
          const lng = place.location?.lng?.();

          onChange(fullAddress, {
            streetAddress,
            city,
            state,
            zipCode,
            fullAddress,
            lat,
            lng,
          });
        });

        // Clear any existing content and append
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(autocomplete);
        autocompleteElementRef.current = autocomplete;
        
        setIsLoading(false);
      } catch (err: any) {
        console.error("[AddressAutocomplete] Failed to load:", err?.message || err);
        if (mounted) {
          setError("Address suggestions unavailable");
          setManualMode(true);
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (autocompleteElementRef.current) {
        autocompleteElementRef.current.remove();
      }
    };
  }, [apiKey, onChange]);

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

  if (manualMode || !apiKey) {
    return (
      <div className={`space-y-3 ${className}`}>
        {error && (
          <div className="flex items-center gap-2 text-xs text-amber-600 mb-2">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span>Enter address manually</span>
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
    <div className={className}>
      {isLoading && (
        <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading address search...</span>
        </div>
      )}
      <div 
        ref={containerRef} 
        className={isLoading ? "hidden" : ""}
        data-testid="input-address-autocomplete"
      />
      {!isLoading && (
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" />
          Powered by Google
        </p>
      )}
    </div>
  );
}
