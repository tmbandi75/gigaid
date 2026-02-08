export interface EncouragementConfig {
  maxPerSession: number;
  maxPerDay: number;
  dismissCooldownHours: number;
  noDuplicateWindowHours: number;
  identityCooldownDays: number;
}

export const DEFAULT_CONFIG: EncouragementConfig = {
  maxPerSession: 1,
  maxPerDay: 3,
  dismissCooldownHours: 24,
  noDuplicateWindowHours: 48,
  identityCooldownDays: 7,
};

const STORAGE_KEY = "gigaid_encouragement_state";

interface EncouragementState {
  shownThisSession: number;
  shownToday: { date: string; count: number };
  dismissedAt: string | null;
  recentIds: { id: string; shownAt: string }[];
  lastIdentityShownAt: string | null;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function loadState(): EncouragementState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as EncouragementState;
      if (state.shownToday.date !== getToday()) {
        state.shownToday = { date: getToday(), count: 0 };
      }
      return state;
    }
  } catch {}
  return {
    shownThisSession: 0,
    shownToday: { date: getToday(), count: 0 },
    dismissedAt: null,
    recentIds: [],
    lastIdentityShownAt: null,
  };
}

function saveState(state: EncouragementState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function canShowEncouragement(config: EncouragementConfig = DEFAULT_CONFIG): boolean {
  const state = loadState();

  if (state.shownThisSession >= config.maxPerSession) return false;

  if (state.shownToday.count >= config.maxPerDay) return false;

  if (state.dismissedAt) {
    const dismissedTime = new Date(state.dismissedAt).getTime();
    const cooldown = config.dismissCooldownHours * 60 * 60 * 1000;
    if (Date.now() - dismissedTime < cooldown) return false;
  }

  return true;
}

export function canShowIdentity(config: EncouragementConfig = DEFAULT_CONFIG): boolean {
  const state = loadState();
  if (!state.lastIdentityShownAt) return true;
  const lastShown = new Date(state.lastIdentityShownAt).getTime();
  const cooldown = config.identityCooldownDays * 24 * 60 * 60 * 1000;
  return Date.now() - lastShown >= cooldown;
}

export function wasRecentlyShown(templateId: string, config: EncouragementConfig = DEFAULT_CONFIG): boolean {
  const state = loadState();
  const windowMs = config.noDuplicateWindowHours * 60 * 60 * 1000;
  return state.recentIds.some(
    (r) => r.id === templateId && Date.now() - new Date(r.shownAt).getTime() < windowMs
  );
}

export function recordShown(templateId: string, isIdentity: boolean): void {
  const state = loadState();
  state.shownThisSession += 1;
  state.shownToday.count += 1;
  state.recentIds = [
    { id: templateId, shownAt: new Date().toISOString() },
    ...state.recentIds.filter((r) => r.id !== templateId).slice(0, 19),
  ];
  if (isIdentity) {
    state.lastIdentityShownAt = new Date().toISOString();
  }
  saveState(state);
}

export function recordDismissed(): void {
  const state = loadState();
  state.dismissedAt = new Date().toISOString();
  saveState(state);
}

export function resetSessionCount(): void {
  const state = loadState();
  state.shownThisSession = 0;
  saveState(state);
}
