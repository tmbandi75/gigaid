// Regression coverage for the custom tailwind-merge configuration in cn().
//
// Task #130 fixed a bug where merging "text-primary-foreground" with one of
// the project's "text-t-*" font-size tokens silently dropped the color class
// because tailwind-merge treated both as part of the same "text" group. The
// fix taught tailwind-merge to recognize the t-* tokens as font-size
// utilities.
//
// To guard against future drift, the typography token list under test is
// derived from tailwind.config.ts (the source of truth) instead of being
// hardcoded here. That way, if someone adds a new "t-*" font-size token to
// tailwind.config.ts and forgets to register it in cn()'s tailwind-merge
// config, these tests fail loudly.

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import tailwindConfig from "../../tailwind.config";

function getTypographyTokensFromTailwindConfig(): string[] {
  const fontSize = tailwindConfig.theme?.extend?.fontSize as
    | Record<string, unknown>
    | undefined;
  if (!fontSize) return [];
  return Object.keys(fontSize)
    .filter((key) => key.startsWith("t-"))
    .map((key) => `text-${key}`);
}

const TYPOGRAPHY_TOKENS = getTypographyTokensFromTailwindConfig();

describe("cn() typography token handling", () => {
  it("discovers the project's text-t-* font-size tokens from tailwind.config.ts", () => {
    // Sanity guard: if the import or key-extraction silently breaks, every
    // it.each block below would no-op without this assertion.
    expect(TYPOGRAPHY_TOKENS.length).toBeGreaterThan(0);
    for (const token of TYPOGRAPHY_TOKENS) {
      expect(token).toMatch(/^text-t-/);
    }
  });

  describe("color + typography token combinations are preserved", () => {
    it("keeps both classes when combining text-primary-foreground with text-t-secondary", () => {
      const result = cn("text-primary-foreground", "text-t-secondary");
      const classes = result.split(" ");
      expect(classes).toContain("text-primary-foreground");
      expect(classes).toContain("text-t-secondary");
    });

    it.each(TYPOGRAPHY_TOKENS)(
      "keeps text-primary-foreground alongside %s",
      (token) => {
        const result = cn("text-primary-foreground", token);
        const classes = result.split(" ");
        expect(classes).toContain("text-primary-foreground");
        expect(classes).toContain(token);
      },
    );

    it("preserves arbitrary text color classes alongside typography tokens", () => {
      const result = cn("text-white", "text-t-hero");
      const classes = result.split(" ");
      expect(classes).toContain("text-white");
      expect(classes).toContain("text-t-hero");
    });
  });

  describe("competing typography tokens collapse to one", () => {
    it("resolves two text-t-* tokens to the last one when called in a single cn() call", () => {
      const result = cn("text-t-primary", "text-t-secondary");
      const classes = result.split(" ");
      expect(classes).toEqual(["text-t-secondary"]);
    });

    it("resolves text-t-hero followed by text-t-meta to text-t-meta", () => {
      const result = cn("text-t-hero", "text-t-meta");
      const classes = result.split(" ");
      expect(classes).toEqual(["text-t-meta"]);
    });

    it.each(TYPOGRAPHY_TOKENS)(
      "is recognized as a font-size class so a later text-t-meta wins over %s (when different)",
      (token) => {
        if (token === "text-t-meta") {
          // Self-collision is trivially satisfied; skip.
          return;
        }
        const result = cn(token, "text-t-meta");
        const classes = result.split(" ");
        expect(classes).toEqual(["text-t-meta"]);
      },
    );
  });

  describe("typography tokens conflict with standard text-size utilities", () => {
    it("drops text-sm when followed by text-t-body", () => {
      const result = cn("text-sm", "text-t-body");
      const classes = result.split(" ");
      expect(classes).toContain("text-t-body");
      expect(classes).not.toContain("text-sm");
    });

    it("drops text-t-body when followed by text-lg", () => {
      const result = cn("text-t-body", "text-lg");
      const classes = result.split(" ");
      expect(classes).toContain("text-lg");
      expect(classes).not.toContain("text-t-body");
    });

    it("drops text-t-hero when followed by text-t-primary then text-xs", () => {
      const result = cn("text-t-hero", "text-t-primary", "text-xs");
      const classes = result.split(" ");
      expect(classes).toEqual(["text-xs"]);
    });

    it.each(TYPOGRAPHY_TOKENS)(
      "treats %s as a font-size utility that conflicts with a later text-xs",
      (token) => {
        const result = cn(token, "text-xs");
        const classes = result.split(" ");
        expect(classes).toContain("text-xs");
        expect(classes).not.toContain(token);
      },
    );
  });

  describe("integration: primary button keeps its foreground color", () => {
    it.each(TYPOGRAPHY_TOKENS)(
      "retains text-primary-foreground when %s is passed via className",
      (token) => {
        // Mirrors how button.tsx composes its className: variant strings are
        // concatenated by cva and then run through cn() for tailwind-merge.
        const result = cn(
          buttonVariants({
            variant: "default",
            className: token,
          }),
        );
        const classes = result.split(" ").filter(Boolean);
        expect(classes).toContain("text-primary-foreground");
        expect(classes).toContain(token);
      },
    );
  });
});
