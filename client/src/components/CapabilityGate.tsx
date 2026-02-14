import { useState, useEffect, useRef, useCallback, type ReactNode, type KeyboardEvent, type MouseEvent } from "react";
import { useCanPerform, type NewCapability } from "@/hooks/useCapability";
import { emitChurnEvent } from "@/lib/churnEvents";
import { UpgradeInterceptModal } from "@/upgrade/UpgradeInterceptModal";
import { Lock } from "lucide-react";

interface CapabilityGateProps {
  capability: NewCapability;
  children: ReactNode;
  fallback?: ReactNode;
  showMessage?: boolean;
  interceptClicks?: boolean;
  featureName?: string;
  showLockIndicator?: boolean;
}

export function CapabilityGate({ 
  capability, 
  children, 
  fallback,
  showMessage = true,
  interceptClicks = true,
  featureName,
  showLockIndicator = true,
}: CapabilityGateProps) {
  const { allowed, reason, loading } = useCanPerform(capability);
  const emittedRef = useRef<string | null>(null);
  const [interceptModalOpen, setInterceptModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !allowed && emittedRef.current !== capability) {
      emittedRef.current = capability;
      emitChurnEvent("paywall_block", { capability });
    }
  }, [loading, allowed, capability]);

  const handleInterceptClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setInterceptModalOpen(true);
  }, []);

  const handleInterceptKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setInterceptModalOpen(true);
    }
  }, []);

  if (loading) {
    return null;
  }
  
  if (!allowed) {
    if (interceptClicks) {
      return (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={handleInterceptClick}
            onKeyDown={handleInterceptKeyDown}
            onClickCapture={handleInterceptClick}
            className="relative cursor-pointer group"
            aria-label={featureName ? `Unlock ${featureName}` : `Unlock this feature`}
            data-testid={`capability-gate-intercept-${capability}`}
          >
            <div className="opacity-60 pointer-events-none select-none" aria-hidden="true">
              {children}
            </div>
            {showLockIndicator && (
              <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-muted/80 flex items-center justify-center z-10" aria-hidden="true">
                <Lock className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
          <UpgradeInterceptModal
            open={interceptModalOpen}
            onOpenChange={setInterceptModalOpen}
            featureKey={capability}
            featureName={featureName}
          />
        </>
      );
    }

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

export function useCapabilityEnforce(capability: NewCapability, featureName?: string) {
  const result = useCanPerform(capability);
  const [interceptModalOpen, setInterceptModalOpen] = useState(false);
  
  const enforce = (onBlocked?: (reason: string) => void): boolean => {
    if (!result.allowed && result.reason) {
      setInterceptModalOpen(true);
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

  const InterceptModal = useCallback(() => (
    <UpgradeInterceptModal
      open={interceptModalOpen}
      onOpenChange={setInterceptModalOpen}
      featureKey={capability}
      featureName={featureName}
    />
  ), [interceptModalOpen, capability, featureName]);
  
  return {
    ...result,
    enforce,
    interceptModalOpen,
    setInterceptModalOpen,
    InterceptModal,
  };
}
