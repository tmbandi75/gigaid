import {
  progressTemplates,
  effortTemplates,
  resilienceTemplates,
  identityTemplates,
  fillTemplate,
  type EncouragementTemplate,
  type EncouragementCategory,
} from "./encouragementTemplates";
import {
  canShowEncouragement,
  canShowIdentity,
  wasRecentlyShown,
  DEFAULT_CONFIG,
} from "./encouragementRules";

export interface EncouragementData {
  weeklyEarnings: number;
  lastWeekEarnings: number;
  jobsCompletedThisWeek: number;
  collectedToday: number;
  moneyWaiting: number;
  outstandingAmount: number;
  lastActionType: string | null;
  lastActionAt: string | null;
  lastPaymentAt: string | null;
  lastJobAt: string | null;
}

export interface SelectedEncouragement {
  id: string;
  category: EncouragementCategory;
  message: string;
}

function hoursSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function roundTarget(amount: number): number {
  if (amount < 500) return Math.ceil(amount / 100) * 100;
  if (amount < 2000) return Math.ceil(amount / 250) * 250;
  return Math.ceil(amount / 500) * 500;
}

function selectFromCategory(
  templates: EncouragementTemplate[],
  vars: Record<string, string | number>
): EncouragementTemplate | null {
  const eligible = templates.filter((t) => {
    if (wasRecentlyShown(t.id)) return false;
    return t.requiredVars.every((v) => vars[v] !== undefined && vars[v] !== "");
  });
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function getEncouragementMessage(
  data: EncouragementData
): SelectedEncouragement | null {
  if (!canShowEncouragement(DEFAULT_CONFIG)) return null;

  const vars: Record<string, string | number> = {};

  if (data.weeklyEarnings > 0) {
    vars.weeklyEarnings = Math.round(data.weeklyEarnings / 100);
    vars.nextTarget = roundTarget(Math.round(data.weeklyEarnings / 100));
  }
  if (data.lastWeekEarnings > 0 && data.weeklyEarnings > data.lastWeekEarnings) {
    vars.percentChange = Math.round(
      ((data.weeklyEarnings - data.lastWeekEarnings) / data.lastWeekEarnings) * 100
    );
  }
  if (data.jobsCompletedThisWeek > 0) {
    vars.jobsCompleted = data.jobsCompletedThisWeek;
  }
  if (data.collectedToday > 0) {
    vars.collectedToday = Math.round(data.collectedToday / 100);
  }
  if (data.moneyWaiting > 0) {
    vars.moneyWaiting = Math.round(data.moneyWaiting / 100);
  }
  if (data.outstandingAmount > 0) {
    vars.outstandingAmount = Math.round(data.outstandingAmount / 100);
  }

  const hasProgressData =
    data.weeklyEarnings > 0 ||
    data.jobsCompletedThisWeek > 0 ||
    data.collectedToday > 0 ||
    data.moneyWaiting > 0;
  const validActionTypes = ["reminder_sent", "invoice_sent", "link_shared", "job_marked_complete", "follow_up_sent"];
  const hasRecentAction =
    data.lastActionAt &&
    hoursSince(data.lastActionAt) <= 24 &&
    (!data.lastActionType || validActionTypes.includes(data.lastActionType));
  const isInactive =
    hoursSince(data.lastPaymentAt) > 48 && hoursSince(data.lastJobAt) > 48;

  if (hasProgressData) {
    const template = selectFromCategory(progressTemplates, vars);
    if (template) {
      return {
        id: template.id,
        category: "progress",
        message: fillTemplate(template.template, vars),
      };
    }
  }

  if (hasRecentAction) {
    const template = selectFromCategory(effortTemplates, vars);
    if (template) {
      return {
        id: template.id,
        category: "effort",
        message: fillTemplate(template.template, vars),
      };
    }
  }

  if (isInactive) {
    const template = selectFromCategory(resilienceTemplates, vars);
    if (template) {
      return {
        id: template.id,
        category: "resilience",
        message: fillTemplate(template.template, vars),
      };
    }
  }

  if (canShowIdentity(DEFAULT_CONFIG)) {
    const template = selectFromCategory(identityTemplates, vars);
    if (template) {
      return {
        id: template.id,
        category: "identity",
        message: fillTemplate(template.template, vars),
      };
    }
  }

  return null;
}

export function getSubtitleMessage(
  data: EncouragementData
): string | null {
  const vars: Record<string, string | number> = {};

  if (data.weeklyEarnings > 0) {
    vars.weeklyEarnings = Math.round(data.weeklyEarnings / 100);
    vars.nextTarget = roundTarget(Math.round(data.weeklyEarnings / 100));
  }
  if (data.lastWeekEarnings > 0 && data.weeklyEarnings > data.lastWeekEarnings) {
    vars.percentChange = Math.round(
      ((data.weeklyEarnings - data.lastWeekEarnings) / data.lastWeekEarnings) * 100
    );
  }
  if (data.jobsCompletedThisWeek > 0) {
    vars.jobsCompleted = data.jobsCompletedThisWeek;
  }
  if (data.collectedToday > 0) {
    vars.collectedToday = Math.round(data.collectedToday / 100);
  }
  if (data.moneyWaiting > 0) {
    vars.moneyWaiting = Math.round(data.moneyWaiting / 100);
  }
  if (data.outstandingAmount > 0) {
    vars.outstandingAmount = Math.round(data.outstandingAmount / 100);
  }

  const hasProgressData =
    data.weeklyEarnings > 0 ||
    data.jobsCompletedThisWeek > 0 ||
    data.collectedToday > 0 ||
    data.moneyWaiting > 0;
  const isInactive =
    hoursSince(data.lastPaymentAt) > 48 && hoursSince(data.lastJobAt) > 48;

  const allTemplates: { templates: EncouragementTemplate[]; eligible: boolean }[] = [
    { templates: progressTemplates, eligible: hasProgressData },
    { templates: resilienceTemplates, eligible: isInactive },
    { templates: identityTemplates, eligible: true },
    { templates: effortTemplates, eligible: true },
  ];

  for (const { templates, eligible } of allTemplates) {
    if (!eligible) continue;
    const valid = templates.filter((t) =>
      t.requiredVars.every((v) => vars[v] !== undefined && vars[v] !== "")
    );
    if (valid.length > 0) {
      const pick = valid[Math.floor(Math.random() * valid.length)];
      return fillTemplate(pick.template, vars);
    }
  }

  return null;
}

export function getActionEncouragement(
  actionType: "reminder_sent" | "invoice_sent" | "link_shared" | "job_marked_complete" | "follow_up_sent"
): SelectedEncouragement | null {
  if (!canShowEncouragement(DEFAULT_CONFIG)) return null;

  const matchingTemplates = effortTemplates.filter(
    (t) => t.id === actionType && !wasRecentlyShown(t.id)
  );

  if (matchingTemplates.length === 0) {
    const fallbacks = effortTemplates.filter((t) => !wasRecentlyShown(t.id));
    if (fallbacks.length === 0) return null;
    const template = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return {
      id: template.id,
      category: "effort",
      message: fillTemplate(template.template, {}),
    };
  }

  const template = matchingTemplates[0];
  return {
    id: template.id,
    category: "effort",
    message: fillTemplate(template.template, {}),
  };
}
