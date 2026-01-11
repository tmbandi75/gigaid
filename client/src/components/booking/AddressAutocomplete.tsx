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
    initGoogleMapsCallback?: () => void;
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-script";

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps")));
      return;
    }

    window.initGoogleMapsCallback = () => {
      resolve();
      delete window.initGoogleMapsCallback;
    };

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function parseAddressComponents(place: google.maps.places.PlaceResult): AddressComponents {
  const components = place.address_components || [];
  let streetNumber = "";
  let route = "";
  let city = "";
  let state = "";
  let zipCode = "";

  for (const component of components) {
    const types = component.types;
    if (types.includes("street_number")) {
      streetNumber = component.long_name;
    } else if (types.includes("route")) {
      route = component.long_name;
    } else if (types.includes("locality")) {
      city = component.long_name;
    } else if (types.includes("sublocality_level_1") && !city) {
      city = component.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      state = component.short_name;
    } else if (types.includes("postal_code")) {
      zipCode = component.long_name;
    }
  }

  const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

  return {
    streetAddress,
    city,
    state,
    zipCode,
    fullAddress: place.formatted_address || "",
  };
}

export function AddressAutocomplete({ value, onChange, placeholder = "Start typing an address...", className }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const [manualMode, setManualMode] = useState(false);
  const [manualFields, setManualFields] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const initAutocomplete = useCallback(async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    console.log("[AddressAutocomplete] API Key present:", !!apiKey, apiKey ? `(${apiKey.substring(0, 8)}...)` : "(none)");
    
    if (!apiKey) {
      console.log("[AddressAutocomplete] No API key found, switching to manual mode");
      setManualMode(true);
      setIsLoading(false);
      return;
    }

    try {
      console.log("[AddressAutocomplete] Loading Google Maps script...");
      await loadGoogleMapsScript(apiKey);
      console.log("[AddressAutocomplete] Google Maps script loaded successfully");
      
      if (inputRef.current && window.google?.maps?.places) {
        console.log("[AddressAutocomplete] Initializing autocomplete on input");
        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["address_components", "formatted_address", "geometry"],
        });

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          console.log("[AddressAutocomplete] Place selected:", place?.formatted_address);
          if (place && place.address_components) {
            const components = parseAddressComponents(place);
            setInputValue(components.fullAddress);
            onChange(components.fullAddress, components);
          }
        });
        console.log("[AddressAutocomplete] Autocomplete ready!");
      }
      setIsLoading(false);
    } catch (err) {
      console.error("[AddressAutocomplete] Google Maps failed to load:", err);
      setError("Address suggestions unavailable");
      setManualMode(true);
      setIsLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    initAutocomplete();
    
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [initAutocomplete]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value, {
              streetAddress: "",
              city: "",
              state: "",
              zipCode: "",
              fullAddress: e.target.value,
            });
          }}
          placeholder={isLoading ? "Loading..." : placeholder}
          className="pl-10"
          disabled={isLoading}
          data-testid="input-address-autocomplete"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
        <MapPin className="h-2.5 w-2.5" />
        Powered by Google
      </p>
    </div>
  );
}
