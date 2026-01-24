import { Capability } from "./plans";
import { isDeveloper } from "./entitlements";

interface CapabilityLogEvent {
  capability: Capability;
  plan: string;
  is_dev: boolean;
  timestamp: string;
  granted: boolean;
  context?: Record<string, unknown>;
}

const capabilityLogs: CapabilityLogEvent[] = [];

export function logCapabilityAttempt({
  user,
  capability,
  granted = false,
  context = {}
}: {
  user?: { email?: string | null; plan?: string | null };
  capability: Capability;
  granted?: boolean;
  context?: Record<string, unknown>;
}): void {
  const event: CapabilityLogEvent = {
    capability,
    plan: user?.plan ?? "free",
    is_dev: isDeveloper(user),
    timestamp: new Date().toISOString(),
    granted,
    context
  };
  
  capabilityLogs.push(event);
  
  if (capabilityLogs.length > 1000) {
    capabilityLogs.shift();
  }
  
  console.log("[capability_attempted]", event);
}

export function getCapabilityLogs(): CapabilityLogEvent[] {
  return [...capabilityLogs];
}

export function getCapabilityStats(): Record<Capability, { attempts: number; grants: number; denials: number }> {
  const stats: Record<string, { attempts: number; grants: number; denials: number }> = {};
  
  for (const log of capabilityLogs) {
    if (!stats[log.capability]) {
      stats[log.capability] = { attempts: 0, grants: 0, denials: 0 };
    }
    stats[log.capability].attempts++;
    if (log.granted) {
      stats[log.capability].grants++;
    } else {
      stats[log.capability].denials++;
    }
  }
  
  return stats as Record<Capability, { attempts: number; grants: number; denials: number }>;
}

interface PricingInterestEvent {
  source: "soft_intercept" | "manual_navigation";
  capability: string;
  plan: string;
  is_dev: boolean;
  context?: Record<string, unknown>;
  timestamp: string;
}

const pricingInterestLogs: PricingInterestEvent[] = [];

export function logPricingInterest({
  user,
  source,
  capability,
  context = {}
}: {
  user?: { email?: string | null; plan?: string | null };
  source: "soft_intercept" | "manual_navigation";
  capability: string;
  context?: Record<string, unknown>;
}): void {
  const event: PricingInterestEvent = {
    source,
    capability,
    plan: user?.plan ?? "free",
    is_dev: isDeveloper(user),
    context,
    timestamp: new Date().toISOString()
  };
  
  pricingInterestLogs.push(event);
  
  if (pricingInterestLogs.length > 1000) {
    pricingInterestLogs.shift();
  }
  
  console.log("[pricing_interest]", event);
}

export function getPricingInterestLogs(): PricingInterestEvent[] {
  return [...pricingInterestLogs];
}

export function getPricingInterestCount(): number {
  return pricingInterestLogs.length;
}
