import type { ReactNode } from "react";
import { useCanPerform, type NewCapability } from "@/hooks/useCapability";

interface CapabilityGateProps {
  capability: NewCapability;
  children: ReactNode;
  fallback?: ReactNode;
  showMessage?: boolean;
}

export function CapabilityGate({ 
  capability, 
  children, 
  fallback,
  showMessage = true 
}: CapabilityGateProps) {
  const { allowed, reason, loading } = useCanPerform(capability);
  
  if (loading) {
    return null;
  }
  
  if (!allowed) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showMessage && reason) {
      return (
        <div className="text-sm text-muted-foreground py-2 px-3 bg-muted/50 rounded-md">
          {reason}
        </div>
      );
    }
    
    return null;
  }
  
  return <>{children}</>;
}

interface CapabilityLimitInfoProps {
  capability: NewCapability;
  className?: string;
}

export function CapabilityLimitInfo({ capability, className }: CapabilityLimitInfoProps) {
  const { remaining, limit, unlimited, current, loading } = useCanPerform(capability);
  
  if (loading || unlimited) {
    return null;
  }
  
  if (limit === undefined) {
    return null;
  }
  
  const percentage = Math.round((current / limit) * 100);
  const isNearLimit = remaining !== undefined && remaining <= 2;
  const isAtLimit = remaining === 0;
  
  return (
    <div className={`text-xs ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-600' : 'text-muted-foreground'} ${className}`}>
      {current}/{limit} used
      {isAtLimit && " (limit reached)"}
      {isNearLimit && !isAtLimit && ` (${remaining} remaining)`}
    </div>
  );
}

export function useCapabilityEnforce(capability: NewCapability) {
  const result = useCanPerform(capability);
  
  const enforce = (onBlocked?: (reason: string) => void): boolean => {
    if (!result.allowed && result.reason) {
      onBlocked?.(result.reason);
      
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('capability_blocked', {
          capability,
          plan: result.loading ? 'unknown' : 'current',
          reason: result.reason,
          current_usage: result.current,
          limit: result.limit
        });
      }
      
      return false;
    }
    return true;
  };
  
  return {
    ...result,
    enforce
  };
}
