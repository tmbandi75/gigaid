import { useQuery } from "@tanstack/react-query";
import { Plan, Capability, PLAN_CAPABILITIES, PLAN_NAMES } from "@shared/plans";
import { hasCapability, isDeveloper, getUserCapabilities } from "@shared/entitlements";
import { useOptimisticCapability } from "@/contexts/OptimisticCapabilityContext";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";

interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  plan?: string;
}

export interface CapabilityStatus {
  displayName: string;
  allowed: boolean;
  reason?: string;
  mode?: 'active' | 'read_only' | 'suggest_only' | 'partial';
  limit?: number;
  remaining?: number;
  current: number;
  unlimited: boolean;
  windowDays?: number;
}

export interface CapabilitiesResponse {
  plan: string;
  planName: string;
  capabilities: Record<string, CapabilityStatus>;
}

export type NewCapability = 'jobs.create' | 'invoices.send' | 'leads.manage' | 'clients.manage' | 'booking.link' |
  'deposit.enforce' | 'booking.risk_protection' | 'price.confirmation' | 'ai.micro_nudges' | 'ai.money_plan' |
  'ai.outcome_attribution' | 'ai.priority_signals' | 'ai.campaign_suggestions' | 'sms.two_way' |
  'sms.auto_followups' | 'notifications.event_driven' | 'offline.capture' | 'offline.photos' |
  'drive.mode' | 'analytics.basic' | 'analytics.advanced' | 'crew.manage' | 'admin.controls';

export function useCapability() {
  const { data: user } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });
  
  const { hasOptimisticCapability } = useOptimisticCapability();
  
  const checkCapability = (capability: Capability): boolean => {
    if (hasOptimisticCapability(capability)) {
      return true;
    }
    return hasCapability(user, capability);
  };
  
  const checkIsDeveloper = (): boolean => {
    return isDeveloper(user);
  };
  
  const getUserPlan = (): Plan => {
    return (user?.plan as Plan) ?? Plan.FREE;
  };
  
  const getUserPlanName = (): string => {
    return PLAN_NAMES[getUserPlan()];
  };
  
  const getAllUserCapabilities = (): Set<Capability> => {
    return getUserCapabilities(user);
  };
  
  const getCapabilitiesForPlan = (plan: Plan): Capability[] => {
    return PLAN_CAPABILITIES[plan] ?? [];
  };
  
  const getUpgradePath = (): Plan | null => {
    const currentPlan = getUserPlan();
    const planOrder: Plan[] = [Plan.FREE, Plan.PRO, Plan.PRO_PLUS, Plan.BUSINESS];
    const currentIndex = planOrder.indexOf(currentPlan);
    
    if (currentIndex < planOrder.length - 1) {
      return planOrder[currentIndex + 1];
    }
    return null;
  };
  
  return {
    user,
    checkCapability,
    checkIsDeveloper,
    getUserPlan,
    getUserPlanName,
    getAllUserCapabilities,
    getCapabilitiesForPlan,
    getUpgradePath,
    Plan,
    PLAN_NAMES
  };
}

export function useCapabilities() {
  return useQuery<CapabilitiesResponse>({
    queryKey: ["/api/capabilities"],
    staleTime: 60000,
  });
}

export function useCanPerform(capability: NewCapability) {
  const { data: capabilities, isLoading } = useCapabilities();
  
  if (isLoading || !capabilities) {
    return { 
      allowed: false, 
      loading: true,
      current: 0,
      unlimited: false
    };
  }
  
  const cap = capabilities.capabilities[capability];
  if (!cap) {
    return { 
      allowed: true, 
      loading: false,
      current: 0,
      unlimited: true
    };
  }
  
  return {
    allowed: cap.allowed,
    reason: cap.reason,
    remaining: cap.remaining,
    limit: cap.limit,
    current: cap.current,
    unlimited: cap.unlimited,
    mode: cap.mode,
    windowDays: cap.windowDays,
    loading: false
  };
}

export function useIncrementCapability() {
  return useApiMutation(
    async (capability: NewCapability) => apiFetch(`/api/capabilities/${capability}/increment`, { method: "POST" }),
    [["/api/capabilities"]]
  );
}

export function formatLimitMessage(capability: CapabilityStatus): string {
  if (capability.unlimited) {
    return "Unlimited";
  }
  if (capability.limit !== undefined) {
    return `${capability.current}/${capability.limit} used`;
  }
  if (capability.mode === 'read_only') {
    return "Preview only";
  }
  if (capability.mode === 'suggest_only') {
    return "Suggestions only";
  }
  return "";
}
