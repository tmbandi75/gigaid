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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
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

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export function AddressAutocomplete({ value, onChange, placeholder = "Start typing an address...", className }: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualFields, setManualFields] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });
  
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        setManualMode(true);
        setIsLoading(false);
        return;
      }

      try {
        await loadGoogleMapsScript(apiKey);
        
        if (!mounted) return;
        
        const google = (window as any).google;
        
        // Use legacy AutocompleteService (still supported)
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        
        // Create PlacesService with a dummy div
        const dummyDiv = document.createElement("div");
        placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
        
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
    };
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPlaces = useCallback((query: string) => {
    const service = autocompleteServiceRef.current;
    if (!service || query.length < 3) {
      setPredictions([]);
      return;
    }

    setIsSearching(true);
    
    service.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: "us" },
        types: ["address"],
        sessionToken: sessionTokenRef.current,
      },
      (results: any[], status: string) => {
        setIsSearching(false);
        const google = (window as any).google;
        
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(
            results.map((r: any) => ({
              placeId: r.place_id,
              description: r.description,
              mainText: r.structured_formatting?.main_text || r.description,
              secondaryText: r.structured_formatting?.secondary_text || "",
            }))
          );
          setShowDropdown(true);
        } else {
          setPredictions([]);
        }
      }
    );
  }, []);

  const selectPlace = useCallback((prediction: Prediction) => {
    const service = placesServiceRef.current;
    if (!service) return;
    
    const google = (window as any).google;
    
    service.getDetails(
      {
        placeId: prediction.placeId,
        fields: ["address_components", "formatted_address"],
        sessionToken: sessionTokenRef.current,
      },
      (place: any, status: string) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const components = place.address_components || [];
          let streetNumber = "";
          let route = "";
          let city = "";
          let state = "";
          let zipCode = "";

          for (const comp of components) {
            const types = comp.types;
            if (types.includes("street_number")) {
              streetNumber = comp.long_name;
            } else if (types.includes("route")) {
              route = comp.long_name;
            } else if (types.includes("locality")) {
              city = comp.long_name;
            } else if (types.includes("sublocality_level_1") && !city) {
              city = comp.long_name;
            } else if (types.includes("administrative_area_level_1")) {
              state = comp.short_name;
            } else if (types.includes("postal_code")) {
              zipCode = comp.long_name;
            }
          }

          const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
          const fullAddress = place.formatted_address || prediction.description;

          setInputValue(fullAddress);
          setShowDropdown(false);
          setPredictions([]);
          
          // Reset session token
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          
          onChange(fullAddress, {
            streetAddress,
            city,
            state,
            zipCode,
            fullAddress,
          });
        }
      }
    );
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    searchPlaces(val);
    
    onChange(val, {
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      fullAddress: val,
    });
  };

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
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={isLoading ? "Loading..." : placeholder}
          className="pl-10"
          disabled={isLoading}
          autoComplete="off"
          data-testid="input-address-autocomplete"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>
      
      {showDropdown && predictions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.placeId}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-start gap-2"
              onClick={() => selectPlace(prediction)}
            >
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{prediction.mainText}</div>
                <div className="text-xs text-muted-foreground truncate">{prediction.secondaryText}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {!isLoading && (
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" />
          Powered by Google
        </p>
      )}
    </div>
  );
}
