import { useState } from "react";
import { serviceCategories, type ServiceIconName } from "@shared/service-categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Wrench,
  Droplets,
  Zap,
  Sparkles,
  LayoutGrid,
  TreePine,
  PanelTop,
  Layers,
  Hammer,
  Thermometer,
  Package,
  Car,
  Lock,
  Scissors,
  Baby,
  Dog,
  Home,
  Heart,
  Camera,
  PartyPopper,
  GraduationCap,
  ShowerHead,
  Shield,
  Monitor,
  Briefcase,
  ClipboardCheck,
  Snowflake,
  MoreHorizontal,
  ChevronDown,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<ServiceIconName, LucideIcon> = {
  Wrench,
  Droplets,
  Zap,
  Sparkles,
  LayoutGrid,
  TreePine,
  PanelTop,
  Layers,
  Hammer,
  Thermometer,
  Package,
  Car,
  Lock,
  Scissors,
  Baby,
  Dog,
  Home,
  Heart,
  Camera,
  PartyPopper,
  GraduationCap,
  ShowerHead,
  Shield,
  Monitor,
  Briefcase,
  ClipboardCheck,
  Snowflake,
  MoreHorizontal,
};

interface ServicesMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  maxServices?: number;
  disabled?: boolean;
  className?: string;
}

export function ServicesMultiSelect({
  value,
  onChange,
  maxServices = 20,
  disabled,
  className,
}: ServicesMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleService = (service: string) => {
    if (value.includes(service)) {
      onChange(value.filter((s) => s !== service));
    } else if (value.length < maxServices) {
      onChange([...value, service]);
    }
  };

  const removeService = (service: string) => {
    onChange(value.filter((s) => s !== service));
  };

  const getCategoryForService = (service: string) => {
    return serviceCategories.find((cat) => cat.services.includes(service));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {value.length === 0 ? (
          <span className="text-sm text-muted-foreground">No services selected</span>
        ) : (
          value.map((service) => {
            const category = getCategoryForService(service);
            const IconComponent = category ? iconMap[category.icon] : MoreHorizontal;
            return (
              <Badge
                key={service}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <IconComponent className="h-3 w-3" />
                <span className="text-xs">{service}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeService(service)}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                    data-testid={`button-remove-service-${service.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            data-testid="button-add-services"
          >
            <Plus className="h-4 w-4 mr-1" />
            {value.length === 0 ? "Add Services" : "Edit Services"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Your Services</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose the services you offer ({value.length}/{maxServices} selected)
            </p>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {serviceCategories.map((category) => {
                const selectedInCategory = category.services.filter((s) =>
                  value.includes(s)
                ).length;
                const isExpanded = expandedCategories.has(category.id);
                const IconComponent = iconMap[category.icon];

                return (
                  <Collapsible
                    key={category.id}
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(category.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-between w-full p-2 rounded-md hover-elevate text-left"
                        data-testid={`category-${category.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{category.name}</span>
                          {selectedInCategory > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {selectedInCategory}
                            </Badge>
                          )}
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "transform rotate-180"
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-8 py-2 space-y-2">
                        {category.services.map((service) => {
                          const isSelected = value.includes(service);
                          const isDisabled =
                            !isSelected && value.length >= maxServices;

                          return (
                            <label
                              key={service}
                              className={cn(
                                "flex items-center gap-2 p-1.5 rounded cursor-pointer hover-elevate",
                                isDisabled && "opacity-50 cursor-not-allowed"
                              )}
                              data-testid={`service-option-${service.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => !isDisabled && toggleService(service)}
                                disabled={isDisabled}
                              />
                              <span className="text-sm">{service}</span>
                            </label>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="button-done-services"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
