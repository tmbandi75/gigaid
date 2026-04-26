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
