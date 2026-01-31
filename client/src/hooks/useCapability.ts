import { useQuery, useMutation } from "@tanstack/react-query";
import { Plan, Capability, PLAN_CAPABILITIES, PLAN_NAMES } from "@shared/plans";
import { hasCapability, isDeveloper, getUserCapabilities } from "@shared/entitlements";
import { useOptimisticCapability } from "@/contexts/OptimisticCapabilityContext";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const { data: capabilities } = useCapabilities();
  
  if (!capabilities) {
    return { allowed: true, loading: true };
  }
  
  const cap = capabilities.capabilities[capability];
  if (!cap) {
    return { allowed: true, loading: false };
  }
  
  return {
    allowed: cap.allowed,
    reason: cap.reason,
    remaining: cap.remaining,
    limit: cap.limit,
    current: cap.current,
    unlimited: cap.unlimited,
    mode: cap.mode,
    loading: false
  };
}

export function useIncrementCapability() {
  return useMutation({
    mutationFn: async (capability: NewCapability) => {
      return apiRequest("POST", `/api/capabilities/${capability}/increment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capabilities"] });
    }
  });
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
