import type { NBAState } from "./nbaState";

const seenNBAStates = new Set<string>();

export function nbaShownDedupeKey(
  userId: string | undefined,
  state: NBAState,
): string {
  return `${userId ?? "anon"}:${state}`;
}

/**
 * Returns true the first time this (userId, state) pair is seen in the
 * current page session, and false on every subsequent call. The caller
 * should fire the `nba_shown` analytics event only when this returns true.
 */
export function shouldFireNBAShown(
  userId: string | undefined,
  state: NBAState,
): boolean {
  const key = nbaShownDedupeKey(userId, state);
  if (seenNBAStates.has(key)) return false;
  seenNBAStates.add(key);
  return true;
}

/** Test-only helper: clears the dedupe set so each test starts clean. */
export function _resetNBAShownDedupeForTests(): void {
  seenNBAStates.clear();
}
