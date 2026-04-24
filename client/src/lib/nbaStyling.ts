import type { NBAState } from "./nbaState";

export type NBATone = "neutral" | "money";

const STATE_TONES: Record<NBAState, NBATone> = {
  NEW_USER: "neutral",
  NO_JOBS_YET: "neutral",
  IN_PROGRESS: "neutral",
  READY_TO_INVOICE: "money",
  ACTIVE_USER: "neutral",
};

export function getNBATone(state: NBAState): NBATone {
  return STATE_TONES[state];
}

export function isNBAMoneyToneApplied(
  tone: NBATone,
  demoteMoneyTone: boolean,
): boolean {
  return tone === "money" && !demoteMoneyTone;
}

export interface NBACardClasses {
  isMoneyTone: boolean;
  cardClass: string;
  iconWrapperClass: string;
}

export function getNBACardClasses(
  tone: NBATone,
  demoteMoneyTone: boolean,
): NBACardClasses {
  const isMoneyTone = isNBAMoneyToneApplied(tone, demoteMoneyTone);
  return {
    isMoneyTone,
    cardClass: isMoneyTone
      ? "border-0 shadow-md overflow-visible bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10"
      : "border-0 shadow-md overflow-visible",
    iconWrapperClass: isMoneyTone
      ? "h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0"
      : "h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shrink-0",
  };
}

export function shouldDemoteNBAMoneyTone(
  stats: { moneyWaiting: number } | undefined | null,
): boolean {
  if (!stats) return false;
  return stats.moneyWaiting > 0;
}
