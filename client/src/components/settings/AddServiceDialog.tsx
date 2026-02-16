import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { Loader2, Plus, Wrench, Check } from "lucide-react";
import { QUERY_KEYS } from "@/lib/queryKeys";

const COMMON_SERVICES = [
  "plumbing",
  "electrical", 
  "cleaning",
  "handyman",
  "landscaping",
  "painting",
  "HVAC",
  "roofing",
  "carpentry",
  "moving",
];

interface Profile {
  services: string[] | null;
}

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddServiceDialog({ open, onOpenChange }: AddServiceDialogProps) {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState("");
  const { toast } = useToast();

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: QUERY_KEYS.profile(),
  });

  const existingServices = profile?.services || [];

  const resetForm = () => {
    setSelectedServices([]);
    setCustomService("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const saveMutation = useApiMutation(
    (services: string[]) => {
      const allServices = Array.from(new Set([...existingServices, ...services]));
      return apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify({ services: allServices }) });
    },
    [QUERY_KEYS.profile(), QUERY_KEYS.dashboardGamePlan(), QUERY_KEYS.onboarding()],
    {
      onSuccess: () => {
        toast({
          title: "Services added",
          description: `Added ${selectedServices.length} service${selectedServices.length > 1 ? "s" : ""} to your profile.`,
        });
        resetForm();
        onOpenChange(false);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to save services. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const toggleService = (service: string) => {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter((s) => s !== service));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleAddCustomService = () => {
    const trimmed = customService.trim().toLowerCase();
    if (trimmed && !selectedServices.includes(trimmed) && !existingServices.includes(trimmed)) {
      setSelectedServices([...selectedServices, trimmed]);
      setCustomService("");
    }
  };

  const handleSave = () => {
    if (selectedServices.length > 0) {
      saveMutation.mutate(selectedServices);
    }
  };

  const availableCommonServices = COMMON_SERVICES.filter(
    (s) => !existingServices.includes(s)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-service">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            Add Your Services
          </DialogTitle>
          <DialogDescription>
            Select the services you offer so clients know what you can do.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {existingServices.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Your current services</Label>
              <div className="flex flex-wrap gap-2">
                {existingServices.map((service) => (
                  <Badge key={service} variant="secondary">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">Select services to add</Label>
            <div className="flex flex-wrap gap-2">
              {availableCommonServices.map((service) => {
                const isSelected = selectedServices.includes(service);
                return (
                  <Badge
                    key={service}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleService(service)}
                    data-testid={`badge-service-${service}`}
                  >
                    {isSelected && <Check className="h-3 w-3 mr-1" />}
                    {service}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Add a custom service</Label>
            <div className="flex gap-2">
              <Input
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                placeholder="e.g., pool cleaning, fence repair..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomService();
                  }
                }}
                data-testid="input-custom-service-dialog"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddCustomService}
                disabled={!customService.trim()}
                data-testid="button-add-custom-service-dialog"
                aria-label="Add custom service"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedServices.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Services to add ({selectedServices.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedServices.map((service) => (
                  <Badge
                    key={service}
                    variant="default"
                    className="cursor-pointer"
                    onClick={() => toggleService(service)}
                    data-testid={`badge-selected-${service}`}
                  >
                    {service} &times;
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
            data-testid="button-cancel-add-service"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedServices.length === 0 || saveMutation.isPending || profileLoading}
            data-testid="button-save-services"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              `Add ${selectedServices.length || ""} Service${selectedServices.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
