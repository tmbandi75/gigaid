import { Plan, Capability, PLAN_CAPABILITIES } from "./plans";

const DEV_EMAILS = [
  "tmbandi@gmail.com"
];

export function isDeveloper(user?: { email?: string | null }) {
  return !!user?.email && DEV_EMAILS.includes(user.email);
}

export function getUserCapabilities(user?: {
  email?: string | null;
  plan?: Plan | string | null;
}): Set<Capability> {
  if (isDeveloper(user)) {
    return new Set(
      Object.values(PLAN_CAPABILITIES).flat()
    );
  }

  const plan = (user?.plan as Plan) ?? Plan.FREE;
  const capabilities = PLAN_CAPABILITIES[plan];
  
  if (!capabilities) {
    return new Set(PLAN_CAPABILITIES[Plan.FREE]);
  }
  
  return new Set(capabilities);
}

export function hasCapability(
  user: { email?: string | null; plan?: Plan | string | null } | undefined,
  capability: Capability
): boolean {
  return getUserCapabilities(user).has(capability);
}

export function getAllCapabilities(): Capability[] {
  return Object.values(PLAN_CAPABILITIES).flat().filter(
    (cap, index, arr) => arr.indexOf(cap) === index
  );
}
