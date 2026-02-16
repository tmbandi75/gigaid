import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { Sparkles, Loader2, Plus, Check, X, Edit } from "lucide-react";

interface ServiceSuggestion {
  name: string;
  category: string;
  duration: number;
  price: number;
  description: string;
}

interface NewServiceAIInputProps {
  onServicesCreated?: (services: ServiceSuggestion[]) => void;
}

export function NewServiceAIInput({ onServicesCreated }: NewServiceAIInputProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const buildMutation = useApiMutation(
    async (desc: string) => {
      return apiFetch<{ services: ServiceSuggestion[] }>("/api/ai/build-services", {
        method: "POST",
        body: JSON.stringify({ description: desc }),
      });
    },
    [],
    {
      onSuccess: (data) => {
        const services = data.services || [];
        setSuggestions(services);
        toast({ title: `${services.length} service(s) suggested!` });
      },
      onError: () => {
        toast({ title: "Failed to build services", variant: "destructive" });
      },
    }
  );

  const handleBuild = () => {
    if (!description.trim()) {
      toast({ title: "Please describe your services", variant: "destructive" });
      return;
    }
    buildMutation.mutate(description);
  };

  const handleSaveAll = () => {
    if (suggestions && suggestions.length > 0) {
      onServicesCreated?.(suggestions);
      toast({ title: `${suggestions.length} service(s) added!` });
      setSuggestions([]);
      setDescription("");
    }
  };

  const handleRemove = (index: number) => {
    if (suggestions) {
      setSuggestions(suggestions.filter((_, i) => i !== index));
    }
  };

  const handleUpdate = (index: number, field: keyof ServiceSuggestion, value: string | number) => {
    if (!suggestions) return;
    const updated = [...suggestions];
    updated[index] = { ...updated[index], [field]: value };
    setSuggestions(updated);
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Instant Service Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Describe your services</Label>
          <Textarea
            placeholder="e.g., I do plumbing repairs, drain cleaning, and water heater installation. Also offer emergency services."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px]"
            data-testid="textarea-service-description"
          />
        </div>

        <Button
          onClick={handleBuild}
          disabled={buildMutation.isPending || !description.trim()}
          className="w-full"
          data-testid="button-build-services"
        >
          {buildMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Generate Services
        </Button>

        {suggestions && suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Suggested Services</p>
            {suggestions.map((service, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border space-y-2"
                data-testid={`service-suggestion-${idx}`}
              >
                {editingIndex === idx ? (
                  <div className="space-y-2">
                    <Input
                      value={service.name}
                      onChange={(e) => handleUpdate(idx, "name", e.target.value)}
                      placeholder="Service name"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={service.duration}
                        onChange={(e) => handleUpdate(idx, "duration", parseInt(e.target.value) || 60)}
                        placeholder="Duration (min)"
                      />
                      <Input
                        type="number"
                        value={service.price / 100}
                        onChange={(e) => handleUpdate(idx, "price", (parseFloat(e.target.value) || 0) * 100)}
                        placeholder="Price ($)"
                      />
                    </div>
                    <Button size="sm" onClick={() => setEditingIndex(null)}>
                      <Check className="h-4 w-4 mr-1" />
                      Done
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{service.category}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingIndex(idx)}
                          aria-label="Edit service"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemove(idx)}
                          aria-label="Remove service"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                    <div className="flex gap-3 text-xs">
                      <span>{service.duration} min</span>
                      <span className="font-medium">{formatPrice(service.price)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}

            <Button onClick={handleSaveAll} className="w-full" data-testid="button-save-services">
              <Check className="h-4 w-4 mr-2" />
              Add All Services
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
