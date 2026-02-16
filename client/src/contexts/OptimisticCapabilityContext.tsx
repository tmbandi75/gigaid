import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Capability } from "@shared/plans";
import { logger } from "@/lib/logger";

interface OptimisticCapabilityContextType {
  hasOptimisticCapability: (capability: Capability) => boolean;
  grantOptimisticCapability: (capability: Capability, durationMs?: number) => void;
  clearOptimisticCapability: (capability: Capability) => void;
}

const OptimisticCapabilityContext = createContext<OptimisticCapabilityContextType | null>(null);

interface OptimisticGrant {
  capability: Capability;
  expiresAt: number;
}

export function OptimisticCapabilityProvider({ children }: { children: ReactNode }) {
  const [grants, setGrants] = useState<OptimisticGrant[]>([]);

  useEffect(() => {
    if (grants.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setGrants(prev => prev.filter(g => g.expiresAt > now));
    }, 1000);

    return () => clearInterval(interval);
  }, [grants.length]);

  const hasOptimisticCapability = useCallback((capability: Capability): boolean => {
    const now = Date.now();
    return grants.some(g => g.capability === capability && g.expiresAt > now);
  }, [grants]);

  const grantOptimisticCapability = useCallback((capability: Capability, durationMs: number = 15000) => {
    const expiresAt = Date.now() + durationMs;
    setGrants(prev => {
      const filtered = prev.filter(g => g.capability !== capability);
      return [...filtered, { capability, expiresAt }];
    });
    logger.debug(`[OptimisticCapability] Granted ${capability} for ${durationMs}ms`);
  }, []);

  const clearOptimisticCapability = useCallback((capability: Capability) => {
    setGrants(prev => prev.filter(g => g.capability !== capability));
  }, []);

  return (
    <OptimisticCapabilityContext.Provider value={{
      hasOptimisticCapability,
      grantOptimisticCapability,
      clearOptimisticCapability,
    }}>
      {children}
    </OptimisticCapabilityContext.Provider>
  );
}

export function useOptimisticCapability() {
  const context = useContext(OptimisticCapabilityContext);
  if (!context) {
    return {
      hasOptimisticCapability: () => false,
      grantOptimisticCapability: () => {},
      clearOptimisticCapability: () => {},
    };
  }
  return context;
}
