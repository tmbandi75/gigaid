export interface ActivationState {
  stripeConnected: boolean;
  depositsEnabled: boolean;
  bookingLinkCreated: boolean;
  payoutVerified: boolean;
  firstBookingReceived: boolean;
  hasExistingData: boolean;
  mainOnboardingCompleted: boolean;
  paydayOnboardingCompleted: boolean;
  paydayOnboardingStep: number;
}

export function isActivated(state: ActivationState): boolean {
  return (
    state.stripeConnected &&
    state.depositsEnabled &&
    state.bookingLinkCreated &&
    state.payoutVerified
  );
}

export const PAYDAY_STEP_COUNT = 6;
export const PAYDAY_STEPS = {
  WELCOME: 0,
  STRIPE: 1,
  BOOKING: 2,
  DEPOSIT: 3,
  TEMPLATES: 4,
  DONE: 5,
} as const;

export function getNextPaydayStep(state: ActivationState): number | null {
  if (isActivated(state)) return null;
  if (!state.stripeConnected) return PAYDAY_STEPS.STRIPE;
  if (!state.bookingLinkCreated) return PAYDAY_STEPS.BOOKING;
  if (!state.depositsEnabled) return PAYDAY_STEPS.DEPOSIT;
  return PAYDAY_STEPS.TEMPLATES;
}

export function clampPaydayStep(step: number): number {
  return Math.max(0, Math.min(step, PAYDAY_STEP_COUNT - 1));
}

export type ActivationRoute = "dashboard" | "onboarding" | "payday-onboarding";

export function isPaydayRequired(state: ActivationState): boolean {
  if (state.paydayOnboardingCompleted) return false;
  if (state.hasExistingData) return false;
  if (isActivated(state)) return false;
  return true;
}

export function getActivationRoute(state: ActivationState): { route: ActivationRoute; step?: number } {
  if (!state.mainOnboardingCompleted) {
    return { route: "onboarding" };
  }
  if (!isPaydayRequired(state)) {
    return { route: "dashboard" };
  }
  const nextStep = getNextPaydayStep(state);
  if (nextStep == null) {
    return { route: "dashboard" };
  }
  const effectiveStep = Math.max(nextStep, state.paydayOnboardingStep);
  return { route: "payday-onboarding", step: clampPaydayStep(effectiveStep) };
}
