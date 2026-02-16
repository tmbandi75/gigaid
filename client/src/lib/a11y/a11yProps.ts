import type { KeyboardEvent } from "react";

export function iconButtonA11y(label: string) {
  return {
    "aria-label": label,
  } as const;
}

export function toggleA11y(label: string, pressed: boolean) {
  return {
    "aria-label": label,
    "aria-pressed": pressed,
    role: "switch" as const,
  };
}

export function expandableA11y(label: string, expanded: boolean) {
  return {
    "aria-label": label,
    "aria-expanded": expanded,
  };
}

export function clickableA11y(
  label: string,
  onClick: () => void,
  role: "button" | "link" = "button"
) {
  return {
    "aria-label": label,
    role,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  };
}

export function liveRegionA11y(politeness: "polite" | "assertive" = "polite") {
  return {
    "aria-live": politeness,
    role: "status" as const,
  };
}
