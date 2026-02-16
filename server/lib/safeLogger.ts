/**
 * safeLogger — Only approved logging interface for production code.
 *
 * DO NOT log PII (email, phone, UID, token, address, etc.) directly.
 * Use the mask* functions below when identifiers must appear in logs.
 *
 * Usage:
 *   import { maskPhone, maskEmail } from "@/lib/safeLogger";
 *   console.log("Sent SMS to", maskPhone(user.phone));
 */

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "[no-phone]";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return "***" + digits.slice(-4);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "[no-email]";
  const parts = email.split("@");
  if (parts.length !== 2) return "[invalid-email]";
  const local = parts[0];
  const domain = parts[1];
  const masked = local.charAt(0) + "***";
  return `${masked}@${domain}`;
}

export function maskUid(uid: string | null | undefined): string {
  if (!uid) return "[no-uid]";
  if (uid.length <= 4) return "[REDACTED]";
  return uid.slice(0, 4) + "…";
}

export function maskAddress(address: string | null | undefined): string {
  if (!address) return "[no-address]";
  if (address.length <= 8) return "***";
  return address.slice(0, 3) + "***" + address.slice(-3);
}
