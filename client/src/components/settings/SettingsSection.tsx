import { useState, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  iconGradient?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  testId?: string;
  className?: string;
  headerClassName?: string;
  statusBanner?: ReactNode;
}

export function SettingsSection({
  title,
  subtitle,
  icon,
  iconGradient = "from-slate-500 to-gray-500",
  children,
  defaultExpanded = true,
  collapsible = false,
  testId,
  className = "",
  headerClassName = "",
  statusBanner,
}: SettingsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <Card className={`border-0 shadow-md ${className}`} data-testid={testId}>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={handleToggle}
          className={`w-full flex items-center justify-between gap-2 ${collapsible ? 'cursor-pointer' : 'cursor-default'} ${headerClassName}`}
          disabled={!collapsible}
          aria-expanded={isExpanded}
          aria-controls={`${testId}-content`}
          data-testid={testId ? `${testId}-header` : undefined}
        >
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${iconGradient} flex items-center justify-center shrink-0`}>
              {icon}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-base">{title}</h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {collapsible && (
            <div className="text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          )}
        </button>
        
        {statusBanner && isExpanded && (
          <div className="mt-4">
            {statusBanner}
          </div>
        )}
        
        <div
          id={`${testId}-content`}
          className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'mt-4' : 'max-h-0 mt-0'}`}
        >
          {isExpanded && children}
        </div>
      </CardContent>
    </Card>
  );
}
