import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  getNBATone,
  isNBAMoneyToneApplied,
  getNBACardClasses,
  shouldDemoteNBAMoneyTone,
} from "../../client/src/lib/nbaStyling";
import type { NBAState } from "../../client/src/lib/nbaState";

const MONEY_GRADIENT_FRAGMENT = "from-emerald-50";
const MONEY_ICON_BG = "bg-emerald-500";
const NEUTRAL_ICON_BG = "bg-primary";

describe("getNBATone", () => {
  it("returns 'money' only for READY_TO_INVOICE", () => {
    expect(getNBATone("READY_TO_INVOICE")).toBe("money");
  });

  it.each<NBAState>([
    "NEW_USER",
    "NO_JOBS_YET",
    "IN_PROGRESS",
    "ACTIVE_USER",
  ])("returns 'neutral' for %s", (state) => {
    expect(getNBATone(state)).toBe("neutral");
  });
});

describe("isNBAMoneyToneApplied", () => {
  it("applies money tone when tone='money' and not demoted", () => {
    expect(isNBAMoneyToneApplied("money", false)).toBe(true);
  });

  it("withholds money tone when tone='money' but demoted (the regression guard)", () => {
    expect(isNBAMoneyToneApplied("money", true)).toBe(false);
  });

  it("never applies money tone when tone is 'neutral', regardless of demote flag", () => {
    expect(isNBAMoneyToneApplied("neutral", false)).toBe(false);
    expect(isNBAMoneyToneApplied("neutral", true)).toBe(false);
  });
});

describe("getNBACardClasses (NextBestActionCard styling source-of-truth)", () => {
  it("uses the green money gradient + emerald icon for READY_TO_INVOICE when not demoted", () => {
    const tone = getNBATone("READY_TO_INVOICE");
    const classes = getNBACardClasses(tone, false);

    expect(classes.isMoneyTone).toBe(true);
    expect(classes.cardClass).toContain(MONEY_GRADIENT_FRAGMENT);
    expect(classes.iconWrapperClass).toContain(MONEY_ICON_BG);
  });

  it("falls back to neutral styling for READY_TO_INVOICE when demoteMoneyTone=true (no stacked green cards)", () => {
    const tone = getNBATone("READY_TO_INVOICE");
    const classes = getNBACardClasses(tone, true);

    expect(classes.isMoneyTone).toBe(false);
    expect(classes.cardClass).not.toContain(MONEY_GRADIENT_FRAGMENT);
    expect(classes.iconWrapperClass).toContain(NEUTRAL_ICON_BG);
    expect(classes.iconWrapperClass).not.toContain(MONEY_ICON_BG);
  });

  it.each<NBAState>([
    "NEW_USER",
    "NO_JOBS_YET",
    "IN_PROGRESS",
    "ACTIVE_USER",
  ])(
    "stays neutral for %s regardless of the demote flag (only READY_TO_INVOICE is money-toned)",
    (state) => {
      const tone = getNBATone(state);
      const undemoted = getNBACardClasses(tone, false);
      const demoted = getNBACardClasses(tone, true);

      expect(undemoted.isMoneyTone).toBe(false);
      expect(demoted.isMoneyTone).toBe(false);
      expect(undemoted.cardClass).not.toContain(MONEY_GRADIENT_FRAGMENT);
      expect(demoted.cardClass).not.toContain(MONEY_GRADIENT_FRAGMENT);
    },
  );
});

describe("shouldDemoteNBAMoneyTone (parent decision)", () => {
  it("demotes when there is money waiting (the standalone Collect Payment card owns the green tone)", () => {
    expect(shouldDemoteNBAMoneyTone({ moneyWaiting: 1 })).toBe(true);
    expect(shouldDemoteNBAMoneyTone({ moneyWaiting: 1234.56 })).toBe(true);
  });

  it("does not demote when no money is waiting", () => {
    expect(shouldDemoteNBAMoneyTone({ moneyWaiting: 0 })).toBe(false);
  });

  it("does not demote when stats are missing", () => {
    expect(shouldDemoteNBAMoneyTone(undefined)).toBe(false);
    expect(shouldDemoteNBAMoneyTone(null)).toBe(false);
  });

  it("treats negative moneyWaiting as not demoted (defensive — should never happen, but no false demotion)", () => {
    expect(shouldDemoteNBAMoneyTone({ moneyWaiting: -1 })).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Source-level guards
//
// The two parent dashboards (mobile + desktop) MUST forward the demote flag
// to NextBestActionCard based on stats.moneyWaiting. Without these checks,
// a future refactor could accidentally drop the prop and silently bring back
// the duplicate-green-card regression that demoteMoneyTone was added to fix.
// --------------------------------------------------------------------------

function readSource(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf8");
}

describe("Parent dashboards wire demoteMoneyTone from stats.moneyWaiting", () => {
  const MOBILE_PATH = "client/src/pages/TodaysGamePlanPage.tsx";
  const DESKTOP_PATH = "client/src/components/game-plan/GamePlanDesktopView.tsx";

  it("TodaysGamePlanPage (mobile) imports the helper and passes demoteMoneyTone derived from stats", () => {
    const src = readSource(MOBILE_PATH);
    expect(src).toMatch(
      /import\s*\{\s*shouldDemoteNBAMoneyTone\s*\}\s*from\s*["']@\/lib\/nbaStyling["']/,
    );
    expect(src).toMatch(
      /demoteMoneyTone=\{shouldDemoteNBAMoneyTone\(stats\)\}/,
    );
  });

  it("GamePlanDesktopView imports the helper and passes demoteMoneyTone derived from stats", () => {
    const src = readSource(DESKTOP_PATH);
    expect(src).toMatch(
      /import\s*\{\s*shouldDemoteNBAMoneyTone\s*\}\s*from\s*["']@\/lib\/nbaStyling["']/,
    );
    expect(src).toMatch(
      /demoteMoneyTone=\{shouldDemoteNBAMoneyTone\(stats\)\}/,
    );
  });
});

describe("NextBestActionCard uses the shared styling helper", () => {
  it("imports and calls getNBACardClasses with the demote flag (so the regression guard runs)", () => {
    const src = readSource("client/src/components/dashboard/NextBestActionCard.tsx");
    expect(src).toMatch(
      /import\s*\{\s*getNBACardClasses\s*\}\s*from\s*["']@\/lib\/nbaStyling["']/,
    );
    expect(src).toMatch(
      /getNBACardClasses\(\s*content\.tone\s*,\s*demoteMoneyTone\s*,?\s*\)/,
    );
  });
});
