/**
 * Builds the user-facing notice copy shown when the slug we actually wrote
 * doesn't match the slug the user (or the claim flow on their behalf)
 * requested.
 *
 * Why this exists: `users.public_profile_slug` is enforced unique at the
 * database. When two pros race to claim the same custom slug from Settings
 * or the first-booking claim flow, `writeUserSlugWithRetry` silently
 * advances the loser to `${slug}-2` (etc.) so they don't see a 500. Without
 * a UI hint they may not realize their saved link differs from what they
 * typed. Both surfaces (`Settings.tsx`, `FirstBookingPage.tsx`) call this
 * helper to format an identical, non-blocking message.
 *
 * Returns `null` when the resolved slug matches the requested slug (or
 * either is missing), so callers can branch on truthiness.
 */
export interface SlugAdjustedNotice {
  title: string;
  description: string;
}

export function buildSlugAdjustedNotice(
  requestedSlug: string | null | undefined,
  resolvedSlug: string | null | undefined,
): SlugAdjustedNotice | null {
  if (!requestedSlug || !resolvedSlug) return null;
  if (requestedSlug === resolvedSlug) return null;
  return {
    title: "We adjusted your booking link",
    description:
      `\`${requestedSlug}\` was just taken, so we saved your link as \`${resolvedSlug}\` instead.`,
  };
}
