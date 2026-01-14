import { serviceCategories, type ServiceIconName } from "@shared/service-categories";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type LucideIcon,
} from "lucide-react";

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

interface ServiceTypeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function ServiceTypeSelect({
  value,
  onValueChange,
  placeholder = "Select a service",
  disabled,
  className,
  "data-testid": testId,
}: ServiceTypeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {serviceCategories.map((category) => {
          const IconComponent = iconMap[category.icon];
          return (
            <SelectGroup key={category.id}>
              <SelectLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <IconComponent className="h-3.5 w-3.5" />
                <span>{category.name}</span>
              </SelectLabel>
              {category.services.map((service) => (
                <SelectItem
                  key={service}
                  value={service}
                  className="pl-8"
                  data-testid={`select-service-${service.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                >
                  {service}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
