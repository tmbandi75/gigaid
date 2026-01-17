import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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

// Track global API loader state
let apiLoaderKey: string | null = null;
let apiLoadPromise: Promise<void> | null = null;

async function ensureApiLoaded(apiKey: string): Promise<void> {
  // Check if we need to reinitialize due to key change
  if (apiLoaderKey && apiLoaderKey !== apiKey) {
    const existingLoader = document.querySelector("gmpx-api-loader");
    if (existingLoader) {
      existingLoader.remove();
    }
    apiLoaderKey = null;
    apiLoadPromise = null;
  }
  
  if (apiLoaderKey === apiKey) return;
  
  if (apiLoadPromise) return apiLoadPromise;
  
  apiLoadPromise = (async () => {
    try {
      await import("@googlemaps/extended-component-library/api_loader.js");
      await import("@googlemaps/extended-component-library/place_picker.js");
      
      // Create global API loader
      const existingLoader = document.querySelector("gmpx-api-loader");
      if (!existingLoader) {
        const apiLoader = document.createElement("gmpx-api-loader");
        apiLoader.setAttribute("key", apiKey);
        apiLoader.setAttribute("solution-channel", "GMP_GE_mapsplatform_v1");
        document.body.appendChild(apiLoader);
      }
      
      apiLoaderKey = apiKey;
    } catch (err) {
      apiLoadPromise = null;
      throw err;
    }
  })();
  
  return apiLoadPromise;
}

export function AddressAutocomplete({ value, onChange, placeholder = "Start typing an address...", className }: AddressAutocompleteProps) {
  const [manualMode, setManualMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [manualFields, setManualFields] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const placePickerRef = useRef<HTMLElement | null>(null);
  const onChangeRef = useRef(onChange);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // If no API key, go straight to manual mode
  useEffect(() => {
    if (!apiKey) {
      setManualMode(true);
      setError("Google Maps API key not configured");
    }
  }, [apiKey]);

  // Listen for billing errors
  useEffect(() => {
    if (manualMode) return;
    
    const originalError = console.error;
    const errorHandler = function(...args: any[]) {
      const message = args.join(" ");
      if (message.includes("BillingNotEnabled") || message.includes("enable Billing")) {
        setManualMode(true);
        setError("Google Maps requires billing - using manual entry");
      }
      originalError.apply(console, args);
    };
    
    console.error = errorHandler;
    
    return () => {
      console.error = originalError;
    };
  }, [manualMode]);

  // Load API
  useEffect(() => {
    if (!apiKey || manualMode) return;
    
    let cancelled = false;
    
    async function init() {
      try {
        await ensureApiLoaded(apiKey);
        if (cancelled) return;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error("[AddressAutocomplete] Failed to load:", err);
        setManualMode(true);
        setError("Failed to load address lookup");
      }
    }
    
    init();
    
    return () => {
      cancelled = true;
    };
  }, [apiKey, manualMode]);

  // Create/update place picker element
  useEffect(() => {
    if (!ready || !containerRef.current || manualMode) return;
    
    const container = containerRef.current;
    
    // Update placeholder if element exists
    if (placePickerRef.current) {
      placePickerRef.current.setAttribute("placeholder", placeholder);
      return;
    }
    
    const placePicker = document.createElement("gmpx-place-picker");
    placePicker.setAttribute("country", "us");
    placePicker.setAttribute("placeholder", placeholder);
    placePicker.style.width = "100%";
    placePicker.style.minWidth = "300px";
    placePicker.style.setProperty("--gmpx-color-surface", "hsl(var(--background))");
    placePicker.style.setProperty("--gmpx-color-on-surface", "hsl(var(--foreground))");
    placePicker.style.setProperty("--gmpx-color-on-surface-variant", "hsl(var(--muted-foreground))");
    placePicker.style.setProperty("--gmpx-color-primary", "hsl(var(--primary))");
    placePicker.style.setProperty("--gmpx-font-family-base", "inherit");
    placePicker.style.setProperty("--gmpx-font-size-base", "0.875rem");

    const handlePlaceChange = async (event: any) => {
      try {
        const place = event.target?.value;
        if (!place) return;

        await place.fetchFields({
          fields: ["addressComponents", "formattedAddress", "location"],
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
            streetNumber = comp.longText || comp.long_name || "";
          } else if (types.includes("route")) {
            route = comp.longText || comp.long_name || "";
          } else if (types.includes("locality")) {
            city = comp.longText || comp.long_name || "";
          } else if (types.includes("sublocality_level_1") && !city) {
            city = comp.longText || comp.long_name || "";
          } else if (types.includes("administrative_area_level_1")) {
            state = comp.shortText || comp.short_name || "";
          } else if (types.includes("postal_code")) {
            zipCode = comp.longText || comp.long_name || "";
          }
        }

        const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
        const fullAddress = place.formattedAddress || "";
        
        const lat = typeof place.location?.lat === "function" ? place.location.lat() : place.location?.lat;
        const lng = typeof place.location?.lng === "function" ? place.location.lng() : place.location?.lng;

        onChangeRef.current(fullAddress, {
          streetAddress,
          city,
          state,
          zipCode,
          fullAddress,
          lat,
          lng,
        });
      } catch (err) {
        console.error("[AddressAutocomplete] Error processing place:", err);
      }
    };

    placePicker.addEventListener("gmpx-placechange", handlePlaceChange);
    container.appendChild(placePicker);
    placePickerRef.current = placePicker;

    return () => {
      placePicker.removeEventListener("gmpx-placechange", handlePlaceChange);
      if (placePickerRef.current && container.contains(placePickerRef.current)) {
        container.removeChild(placePickerRef.current);
      }
      placePickerRef.current = null;
    };
  }, [ready, manualMode, placeholder]);

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
            <span>{error}</span>
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
      <div ref={containerRef} data-testid="input-address-autocomplete" />
      <div className="flex items-center justify-between gap-2 mt-1">
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" />
          Powered by Google
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[10px] h-auto p-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setManualMode(true);
            setError(null);
          }}
          data-testid="button-manual-entry"
        >
          Enter manually
        </Button>
      </div>
    </div>
  );
}
