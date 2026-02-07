import type { UpgradeTriggerType, UpgradeVariant, CooldownState } from "./upgradeTypes";
import type { NewCapability } from "@/hooks/useCapability";
import { COOLDOWNS, TRIGGER_COOLDOWN_KEYS } from "./upgradeConfig";

function storageKey(userId: string): string {
  return `gigaid_upgrade_state_${userId}`;
}

function getState(userId: string): CooldownState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as CooldownState;
      const now = Date.now();
      if (now - parsed.dailyWindowStart > 24 * 60 * 60 * 1000) {
        parsed.dailyPromptCount = 0;
        parsed.dailyWindowStart = now;
      }
      return parsed;
    }
  } catch {}
  return {
    lastShownAt: {},
    dailyPromptCount: 0,
    dailyWindowStart: Date.now(),
    userVariant: null,
  };
}

function saveState(userId: string, state: CooldownState): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {}
}

function cooldownKey(triggerType: UpgradeTriggerType, capabilityKey: NewCapability): string {
  return `${TRIGGER_COOLDOWN_KEYS[triggerType]}_${capabilityKey}`;
}

export function canShowPrompt(
  userId: string,
  triggerType: UpgradeTriggerType,
  capabilityKey: NewCapability
): boolean {
  const state = getState(userId);
  const now = Date.now();

  if (state.dailyPromptCount >= COOLDOWNS.globalMaxPerDay) {
    return false;
  }

  const key = cooldownKey(triggerType, capabilityKey);
  const lastShown = state.lastShownAt[key];
  if (lastShown && now - lastShown < COOLDOWNS.perTriggerMs) {
    return false;
  }

  return true;
}

export function markPromptShown(
  userId: string,
  triggerType: UpgradeTriggerType,
  capabilityKey: NewCapability
): void {
  const state = getState(userId);
  const now = Date.now();
  const key = cooldownKey(triggerType, capabilityKey);

  state.lastShownAt[key] = now;
  state.dailyPromptCount += 1;

  if (now - state.dailyWindowStart > 24 * 60 * 60 * 1000) {
    state.dailyPromptCount = 1;
    state.dailyWindowStart = now;
  }

  saveState(userId, state);
}

export function getOrAssignVariant(userId: string): UpgradeVariant {
  const state = getState(userId);
  if (state.userVariant) {
    return state.userVariant;
  }
  const variants: UpgradeVariant[] = ["roi", "time", "social"];
  const assigned = variants[Math.floor(Math.random() * variants.length)];
  state.userVariant = assigned;
  saveState(userId, state);
  return assigned;
}

export function isDismissed(userId: string, capabilityKey: NewCapability): boolean {
  try {
    const raw = localStorage.getItem(`gigaid_dismiss_${userId}_${capabilityKey}`);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function setDismissed(userId: string, capabilityKey: NewCapability): void {
  try {
    localStorage.setItem(`gigaid_dismiss_${userId}_${capabilityKey}`, String(Date.now()));
  } catch {}
}
