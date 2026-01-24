import { Capability } from "./plans";
import { isDeveloper } from "./entitlements";

interface CapabilityLogEvent {
  capability: Capability;
  plan: string;
  is_dev: boolean;
  timestamp: string;
  granted: boolean;
}

const capabilityLogs: CapabilityLogEvent[] = [];

export function logCapabilityAttempt(
  user: { email?: string; plan?: string } | undefined,
  capability: Capability,
  granted: boolean
): void {
  const event: CapabilityLogEvent = {
    capability,
    plan: user?.plan ?? "free",
    is_dev: isDeveloper(user),
    timestamp: new Date().toISOString(),
    granted
  };
  
  capabilityLogs.push(event);
  
  if (capabilityLogs.length > 1000) {
    capabilityLogs.shift();
  }
  
  if (process.env.NODE_ENV === "development") {
    console.log("[Capability]", event);
  }
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
