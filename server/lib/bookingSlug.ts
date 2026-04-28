const RESERVED_WORDS = new Set([
  "admin", "api", "login", "signup", "sign-up", "register", "book", "booking",
  "support", "help", "contact", "terms", "privacy", "about", "home", "dashboard",
  "settings", "profile", "account", "billing", "pricing", "download", "downloads",
  "app", "jobs", "leads", "invoices", "messages", "notifications", "reports",
  "analytics", "webhooks", "stripe", "pay", "payment", "checkout", "demo",
  "test", "debug", "status", "health", "feedback", "invite", "referral",
  "reset", "verify", "confirm", "unsubscribe", "logout", "signout",
]);

const BLOCKED_PATTERNS = [
  /gigaid/i,
  /official/i,
  /support/i,
  /admin/i,
  /moderator/i,
  /staff/i,
];

const PROFANITY_WORDS = new Set([
  "ass", "damn", "hell", "shit", "fuck", "crap", "dick", "bitch",
  "bastard", "cunt", "piss", "cock", "slut", "whore",
]);

/**
 * Matches our system-assigned placeholder slugs. Two historical shapes are
 * covered:
 *  - The current default `user-<first N hex chars of UUID>` (e.g.
 *    `user-b727046e`, `user-abc123`).
 *  - The older numeric variant `user-<digits>` (e.g. `user-1234`).
 * Both reduce to "starts with `user-` and the rest is hex (digits ⊂ hex)".
 *
 * Policy: the `user-*` namespace is reserved for system placeholders —
 * users can't manually pick a slug shaped like one of ours. This matches
 * the prior intent of the validator (which already rejected `^user-\d+$`)
 * and is now extended to hex so the same rule covers the current default.
 *
 * Used in two places:
 *  - /api/profile auto-upgrades any account whose slug matches this shape
 *    to a name-based slug on next login.
 *  - validateSlug rejects manual entry of slugs in this shape so users
 *    can't reintroduce the placeholder pattern by hand.
 */
export const LEGACY_DEFAULT_SLUG_REGEX = /^user-[a-f0-9]+$/i;

export function isLegacyDefaultSlug(slug: string | null | undefined): boolean {
  return !!slug && LEGACY_DEFAULT_SLUG_REGEX.test(slug);
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function generateBookingSlug(user: {
  name?: string | null;
  businessName?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  const rawName =
    user.businessName?.trim() ||
    user.name?.trim() ||
    user.username?.trim() ||
    user.email?.split("@")[0] ||
    "pro";

  const slug = slugify(rawName);
  return slug || "pro";
}

export interface SlugValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateSlug(slug: string): SlugValidationResult {
  if (!slug || slug.length < 3) {
    return { valid: false, reason: "Slug must be at least 3 characters" };
  }
  if (slug.length > 48) {
    return { valid: false, reason: "Slug must be 48 characters or less" };
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { valid: false, reason: "Slug can only contain lowercase letters, numbers, and hyphens" };
  }
  if (RESERVED_WORDS.has(slug)) {
    return { valid: false, reason: "This name is reserved. Please choose a different one." };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(slug)) {
      return { valid: false, reason: "This name is not allowed. Please choose a different one." };
    }
  }
  const parts = slug.split("-");
  for (const part of parts) {
    if (PROFANITY_WORDS.has(part)) {
      return { valid: false, reason: "This name contains inappropriate language. Please choose a different one." };
    }
  }
  if (LEGACY_DEFAULT_SLUG_REGEX.test(slug)) {
    return { valid: false, reason: "Please choose a more descriptive name for your booking link." };
  }
  return { valid: true };
}

/**
 * Slug uniqueness contract
 * ------------------------
 * The `users.public_profile_slug` column has a partial UNIQUE index
 * (`users_public_profile_slug_unique_idx`) declared in `shared/schema.ts`.
 * That index — not this file — is the source of truth: two writers landing
 * the same slug at the same instant will both pass an application-side
 * `slugExists` probe, and one of the writes will be rejected by the
 * database with Postgres SQLSTATE `23505`.
 *
 * Any code path that writes a slug must therefore:
 *   1. Pick a likely-available candidate via `ensureUniqueSlug` (best-effort
 *      probe), AND
 *   2. Wrap the write in `writeUserSlugWithRetry`, which catches the unique
 *      violation and re-tries with the next-available suffix so users never
 *      see a 500.
 *
 * The three known writers are:
 *   - `server/db-storage.ts:createUser` (new user signup),
 *   - `server/firstBookingRoutes.ts` claim transaction (claim-page upgrade),
 *   - `server/routes.ts:/api/profile` auto-upgrade and `/api/settings` save.
 *
 * Future writers must follow the same pattern — the schema comment on the
 * column also points back here.
 */

/**
 * Best-effort pre-check: probe `checkExists(candidate)` and walk through
 * `${baseSlug}-2`, `${baseSlug}-3`, ... until a candidate appears free.
 *
 * Even when this returns a slug that looked free, the DB write that follows
 * can still fail with a unique violation (concurrent writer raced past us).
 * Always pair this with `writeUserSlugWithRetry`.
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>,
  excludeUserId?: string
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;

  while (await checkExists(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
    if (suffix > 100) {
      candidate = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
      break;
    }
  }

  return candidate;
}

/**
 * Returns true iff `err` looks like a Postgres unique-violation triggered
 * by the `public_profile_slug` partial unique index. We deliberately *only*
 * swallow conflicts on this column — a unique-violation on, say,
 * `username` or `firebase_uid` is a real bug and must propagate.
 */
export function isSlugUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as any;
  const code = e.code ?? e.cause?.code;
  if (code !== "23505") return false;

  const haystacks: string[] = [];
  for (const candidate of [
    e.constraint,
    e.constraint_name,
    e.cause?.constraint,
    e.cause?.constraint_name,
    e.detail,
    e.cause?.detail,
    e.message,
    e.cause?.message,
  ]) {
    if (typeof candidate === "string") haystacks.push(candidate);
  }
  return haystacks.some((s) => s.includes("public_profile_slug"));
}

/**
 * Run `write(candidate)` and, if it fails with a slug unique-violation,
 * advance to the next-available suffix and try again. Up to `maxAttempts`
 * suffixes are tried before giving up; after that we fall back to a
 * timestamp-suffixed candidate (matches `ensureUniqueSlug`'s escape hatch)
 * for one final attempt before re-throwing.
 *
 * `checkExists` is optional — when supplied, we run the same pre-check as
 * `ensureUniqueSlug` to avoid the DB round-trip in the common case.
 *
 * The `write` callback receives the slug to use. It must be idempotent
 * with respect to side effects unrelated to the slug column, since it can
 * be invoked more than once. For inserts wrapped in a transaction, that
 * means the entire transaction must be retried by the caller — see
 * `server/firstBookingRoutes.ts` for the canonical example.
 */
export async function writeUserSlugWithRetry<T>(
  baseSlug: string,
  write: (candidate: string) => Promise<T>,
  options?: {
    checkExists?: (slug: string) => Promise<boolean>;
    maxAttempts?: number;
  },
): Promise<{ slug: string; result: T }> {
  const maxAttempts = options?.maxAttempts ?? 100;

  let candidate = baseSlug;
  let suffix = 2;

  if (options?.checkExists) {
    while (await options.checkExists(candidate)) {
      candidate = `${baseSlug}-${suffix}`;
      suffix++;
      if (suffix > maxAttempts) {
        candidate = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
        break;
      }
    }
  }

  let attempts = 0;
  while (true) {
    try {
      const result = await write(candidate);
      return { slug: candidate, result };
    } catch (err) {
      if (!isSlugUniqueViolation(err)) throw err;
      attempts++;
      if (attempts > maxAttempts) {
        throw err;
      }
      candidate = `${baseSlug}-${suffix}`;
      suffix++;
      if (suffix > maxAttempts) {
        candidate = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
      }
    }
  }
}
