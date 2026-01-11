import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, AlertCircle } from "lucide-react";
import { APILoader, PlacePicker } from "@googlemaps/extended-component-library/react";

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

export function AddressAutocomplete({ value, onChange, placeholder = "Start typing an address...", className }: AddressAutocompleteProps) {
  const [manualMode, setManualMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualFields, setManualFields] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });
  
  const pickerRef = useRef<any>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setManualMode(true);
      setError("Google Maps API key not configured");
    }
  }, [apiKey]);

  const handlePlaceChange = () => {
    const picker = pickerRef.current;
    if (!picker?.value) return;
    
    const place = picker.value;
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
    const fullAddress = place.formattedAddress || place.displayName || "";

    onChange(fullAddress, {
      streetAddress,
      city,
      state,
      zipCode,
      fullAddress,
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

  if (manualMode || !apiKey) {
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
    <div className={className}>
      <APILoader apiKey={apiKey} solutionChannel="GMP_GE_mapsandplacesautocomplete_v2" />
      <PlacePicker
        ref={pickerRef}
        placeholder={placeholder}
        country={["us"]}
        onPlaceChange={handlePlaceChange}
        style={{
          width: "100%",
          height: "40px",
        }}
        data-testid="input-address-autocomplete"
      />
      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
        <MapPin className="h-2.5 w-2.5" />
        Powered by Google
      </p>
    </div>
  );
}
