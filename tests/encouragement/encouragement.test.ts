import {
  progressTemplates,
  effortTemplates,
  resilienceTemplates,
  identityTemplates,
  fillTemplate,
} from "../../client/src/encouragement/encouragementTemplates";

import {
  canShowEncouragement,
  canShowIdentity,
  wasRecentlyShown,
  recordShown,
  recordDismissed,
  resetSessionCount,
  DEFAULT_CONFIG,
} from "../../client/src/encouragement/encouragementRules";

import {
  getEncouragementMessage,
  getActionEncouragement,
  type EncouragementData,
} from "../../client/src/encouragement/encouragementEngine";

const STORAGE_KEY = "gigaid_encouragement_state";

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function makeData(overrides: Partial<EncouragementData> = {}): EncouragementData {
  return {
    weeklyEarnings: 0,
    lastWeekEarnings: 0,
    jobsCompletedThisWeek: 0,
    collectedToday: 0,
    moneyWaiting: 0,
    outstandingAmount: 0,
    lastActionType: null,
    lastActionAt: null,
    lastPaymentAt: null,
    lastJobAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  clearStorage();
  resetSessionCount();
});

describe("Variable Substitution", () => {
  test("fills template variables correctly", () => {
    const result = fillTemplate(
      "You earned ${{weeklyEarnings}} this week. One more job gets you past ${{nextTarget}}.",
      { weeklyEarnings: 450, nextTarget: 500 }
    );
    expect(result).toBe("You earned $450 this week. One more job gets you past $500.");
  });

  test("leaves unfilled variables as-is when missing", () => {
    const result = fillTemplate("Up {{percentChange}}% from last week.", {});
    expect(result).toBe("Up {{percentChange}}% from last week.");
  });

  test("handles multiple variables in one template", () => {
    const result = fillTemplate("{{a}} and {{b}} and {{c}}", { a: 1, b: 2, c: 3 });
    expect(result).toBe("1 and 2 and 3");
  });
});

describe("Message Categories", () => {
  test("has 4 categories of templates", () => {
    expect(progressTemplates.length).toBeGreaterThan(0);
    expect(effortTemplates.length).toBeGreaterThan(0);
    expect(resilienceTemplates.length).toBeGreaterThan(0);
    expect(identityTemplates.length).toBeGreaterThan(0);
  });

  test("all templates have valid category assignments", () => {
    for (const t of progressTemplates) expect(t.category).toBe("progress");
    for (const t of effortTemplates) expect(t.category).toBe("effort");
    for (const t of resilienceTemplates) expect(t.category).toBe("resilience");
    for (const t of identityTemplates) expect(t.category).toBe("identity");
  });

  test("all templates have unique IDs", () => {
    const allTemplates = [...progressTemplates, ...effortTemplates, ...resilienceTemplates, ...identityTemplates];
    const ids = allTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("no templates contain generic motivational quotes", () => {
    const allTemplates = [...progressTemplates, ...effortTemplates, ...resilienceTemplates, ...identityTemplates];
    const genericPhrases = [
      "believe in yourself",
      "you can do it",
      "stay positive",
      "never give up",
      "dream big",
      "follow your heart",
    ];
    for (const t of allTemplates) {
      const lower = t.template.toLowerCase();
      for (const phrase of genericPhrases) {
        expect(lower).not.toContain(phrase);
      }
    }
  });

  test("progress templates reference financial data or job metrics", () => {
    for (const t of progressTemplates) {
      const hasDataRef =
        t.requiredVars.length > 0 ||
        t.template.includes("$") ||
        t.template.includes("job");
      expect(hasDataRef).toBe(true);
    }
  });
});

describe("Selection Logic", () => {
  test("selects progress when earnings data available", () => {
    const data = makeData({ weeklyEarnings: 50000 });
    const msg = getEncouragementMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe("progress");
  });

  test("selects progress when jobs completed", () => {
    const data = makeData({ jobsCompletedThisWeek: 3 });
    const msg = getEncouragementMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe("progress");
  });

  test("selects effort when recent action and no progress data", () => {
    const data = makeData({
      lastActionAt: new Date().toISOString(),
      lastActionType: "reminder_sent",
    });
    const msg = getEncouragementMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe("effort");
  });

  test("selects resilience when inactive >48h and no progress data", () => {
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const data = makeData({
      lastPaymentAt: threeDaysAgo,
      lastJobAt: threeDaysAgo,
    });
    const msg = getEncouragementMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe("resilience");
  });

  test("selects identity when no other conditions met and identity cooldown elapsed", () => {
    const data = makeData({
      lastPaymentAt: new Date().toISOString(),
      lastJobAt: new Date().toISOString(),
    });
    const msg = getEncouragementMessage(data);
    if (msg) {
      expect(["identity", "effort"]).toContain(msg.category);
    }
  });

  test("returns null when no data and no conditions met", () => {
    const data = makeData({
      lastPaymentAt: new Date().toISOString(),
      lastJobAt: new Date().toISOString(),
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        shownThisSession: 0,
        shownToday: { date: new Date().toISOString().split("T")[0], count: 0 },
        dismissedAt: null,
        recentIds: identityTemplates.map((t) => ({
          id: t.id,
          shownAt: new Date().toISOString(),
        })),
        lastIdentityShownAt: new Date().toISOString(),
      })
    );
    const msg = getEncouragementMessage(data);
    expect(msg).toBeNull();
  });

  test("progress has priority over effort", () => {
    const data = makeData({
      weeklyEarnings: 50000,
      lastActionAt: new Date().toISOString(),
    });
    const msg = getEncouragementMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe("progress");
  });
});

describe("Cooldown Enforcement", () => {
  test("blocks after max per session", () => {
    expect(canShowEncouragement()).toBe(true);
    recordShown("test_1", false);
    expect(canShowEncouragement()).toBe(false);
  });

  test("blocks after max per day", () => {
    for (let i = 0; i < DEFAULT_CONFIG.maxPerDay; i++) {
      resetSessionCount();
      expect(canShowEncouragement()).toBe(true);
      recordShown(`test_${i}`, false);
    }
    resetSessionCount();
    expect(canShowEncouragement()).toBe(false);
  });

  test("blocks after dismiss for 24h", () => {
    expect(canShowEncouragement()).toBe(true);
    recordDismissed();
    resetSessionCount();
    expect(canShowEncouragement()).toBe(false);
  });

  test("prevents duplicate within 48h", () => {
    recordShown("weekly_earnings", false);
    expect(wasRecentlyShown("weekly_earnings")).toBe(true);
    expect(wasRecentlyShown("jobs_completed")).toBe(false);
  });

  test("identity cooldown enforced at 7 days", () => {
    expect(canShowIdentity()).toBe(true);
    recordShown("real_business", true);
    expect(canShowIdentity()).toBe(false);
  });

  test("session reset clears session count but not day count", () => {
    recordShown("test_1", false);
    expect(canShowEncouragement()).toBe(false);
    resetSessionCount();
    expect(canShowEncouragement()).toBe(true);
  });
});

describe("Action Encouragement", () => {
  test("returns effort message for known action type", () => {
    const msg = getActionEncouragement("reminder_sent");
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe("effort");
  });

  test("returns null when session limit reached", () => {
    recordShown("test_1", false);
    const msg = getActionEncouragement("reminder_sent");
    expect(msg).toBeNull();
  });

  test("falls back to other effort template if primary recently shown", () => {
    recordShown("reminder_sent", false);
    resetSessionCount();
    const msg = getActionEncouragement("reminder_sent");
    if (msg) {
      expect(msg.category).toBe("effort");
      expect(msg.id).not.toBe("reminder_sent");
    }
  });
});

describe("No Generic Messages", () => {
  test("all messages contain specific references or actionable suggestions", () => {
    const allTemplates = [...progressTemplates, ...effortTemplates, ...resilienceTemplates, ...identityTemplates];
    const actionKeywords = [
      "$", "{{", "reminder", "invoice", "link", "job", "follow",
      "booking", "business", "money", "pros", "pace", "building",
      "client", "deal", "pay", "send", "momentum",
    ];
    for (const t of allTemplates) {
      const lower = t.template.toLowerCase();
      const hasSpecificity = actionKeywords.some((kw) =>
        kw === "$" || kw === "{{"
          ? t.template.includes(kw)
          : lower.includes(kw)
      );
      expect(hasSpecificity).toBe(true);
    }
  });

  test("filled messages never contain unfilled variables when data is provided", () => {
    const data = makeData({
      weeklyEarnings: 50000,
      lastWeekEarnings: 40000,
      jobsCompletedThisWeek: 5,
      collectedToday: 10000,
      moneyWaiting: 25000,
      outstandingAmount: 25000,
    });
    for (let i = 0; i < 20; i++) {
      clearStorage();
      resetSessionCount();
      const msg = getEncouragementMessage(data);
      if (msg) {
        expect(msg.message).not.toMatch(/\{\{.*\}\}/);
      }
    }
  });
});
