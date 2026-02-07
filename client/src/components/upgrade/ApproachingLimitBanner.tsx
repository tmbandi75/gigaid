import { AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useApproachingLimit } from "@/hooks/useApproachingLimit";
import type { NewCapability } from "@/hooks/useCapability";

interface ApproachingLimitBannerProps {
  capability: NewCapability;
  className?: string;
  compact?: boolean;
}

export function ApproachingLimitBanner({ capability, className = "", compact = false }: ApproachingLimitBannerProps) {
  const [, navigate] = useLocation();
  const { isApproaching, isAtLimit, message, loading, percentage } = useApproachingLimit(capability);

  if (loading || (!isApproaching && !isAtLimit)) {
    return null;
  }

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md ${
          isAtLimit
            ? "bg-destructive/10 text-destructive"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        } ${className}`}
        data-testid={`banner-limit-${capability.replace(/\./g, '-')}`}
      >
        {isAtLimit ? (
          <AlertTriangle className="h-3 w-3 shrink-0" />
        ) : (
          <TrendingUp className="h-3 w-3 shrink-0" />
        )}
        <span className="flex-1">{message}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => navigate("/pricing")}
          data-testid={`button-upgrade-limit-${capability.replace(/\./g, '-')}`}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-md border ${
        isAtLimit
          ? "bg-destructive/5 border-destructive/20"
          : "bg-amber-500/5 border-amber-500/20"
      } ${className}`}
      data-testid={`banner-limit-${capability.replace(/\./g, '-')}`}
    >
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isAtLimit ? "bg-destructive/10" : "bg-amber-500/10"
      }`}>
        {isAtLimit ? (
          <AlertTriangle className={`h-4 w-4 ${isAtLimit ? "text-destructive" : "text-amber-600"}`} />
        ) : (
          <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isAtLimit ? "text-destructive" : "text-foreground"}`}>
          {message}
        </p>
        {!isAtLimit && (
          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        )}
      </div>
      <Button
        size="sm"
        onClick={() => navigate("/pricing")}
        data-testid={`button-upgrade-limit-${capability.replace(/\./g, '-')}`}
      >
        Upgrade
      </Button>
    </div>
  );
}
