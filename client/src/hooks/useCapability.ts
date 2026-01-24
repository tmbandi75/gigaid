import { useQuery } from "@tanstack/react-query";
import { Plan, Capability, PLAN_CAPABILITIES, PLAN_NAMES } from "@shared/plans";
import { hasCapability, isDeveloper, getUserCapabilities } from "@shared/entitlements";

interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  plan?: string;
}

export function useCapability() {
  const { data: user } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });
  
  const checkCapability = (capability: Capability): boolean => {
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
