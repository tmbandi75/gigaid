/**
 * Coverage for the slug-collision notice helper at
 * `client/src/lib/slugAdjustedNotice.ts` (Task #188).
 *
 * Why this exists: `users.public_profile_slug` is enforced unique at the
 * DB. When two pros race to claim the same custom slug from Settings or
 * the first-booking claim flow, `writeUserSlugWithRetry` silently
 * advances the loser to `${slug}-2` so they don't see a 500. The Settings
 * page's save-mutation onSuccess and the FirstBookingPage confirmation
 * screen both call `buildSlugAdjustedNotice` to decide whether to surface
 * a small non-blocking "we adjusted your link" notice. This test pins
 * the contract: the notice MUST appear only when the resolved slug
 * differs from the requested slug, and MUST stay hidden in every other
 * shape (matching, missing, or empty).
 */

import { buildSlugAdjustedNotice } from "@/lib/slugAdjustedNotice";

describe("buildSlugAdjustedNotice", () => {
  it("returns a notice when the resolved slug differs from the requested slug", () => {
    const notice = buildSlugAdjustedNotice("larry-payne", "larry-payne-2");
    expect(notice).not.toBeNull();
    // The description has to name BOTH slugs so the user can see what
    // they typed and what was actually saved. Locking both substrings
    // here guards against a copy refactor accidentally dropping either.
    expect(notice?.description).toContain("larry-payne");
    expect(notice?.description).toContain("larry-payne-2");
    expect(notice?.title.length).toBeGreaterThan(0);
  });

  it("returns null when the resolved slug exactly matches the requested slug (the happy path)", () => {
    // This is the case that fires on every single Settings save where
    // no concurrent write happened. If this ever returned a notice the
    // toast would shout at every user on every save.
    expect(buildSlugAdjustedNotice("larry-payne", "larry-payne")).toBeNull();
  });

  it("returns null when the requested slug is missing (e.g. a save that didn't touch the slug field)", () => {
    // Saves that don't touch the slug column send `publicProfileSlug:
    // undefined` to /api/settings, so the comparison has nothing to
    // assert on — the helper must NOT fabricate a notice from a
    // server-echoed slug the user didn't try to change.
    expect(buildSlugAdjustedNotice(null, "larry-payne")).toBeNull();
    expect(buildSlugAdjustedNotice(undefined, "larry-payne")).toBeNull();
    expect(buildSlugAdjustedNotice("", "larry-payne")).toBeNull();
  });

  it("returns null when the resolved slug is missing (defensive — server should always echo it back)", () => {
    expect(buildSlugAdjustedNotice("larry-payne", null)).toBeNull();
    expect(buildSlugAdjustedNotice("larry-payne", undefined)).toBeNull();
    expect(buildSlugAdjustedNotice("larry-payne", "")).toBeNull();
  });
});
