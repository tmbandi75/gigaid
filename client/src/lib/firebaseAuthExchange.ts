import { clearAuthToken } from "@/lib/authToken";
import { firebaseSignOut } from "@/lib/firebase";

export const ACCOUNT_DELETED_ERROR_CODE = "account_deleted";

export function isAccountDeletedExchangePayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.code === ACCOUNT_DELETED_ERROR_CODE) return true;
  const err = d.error;
  if (typeof err === "string" && err.toLowerCase().includes("account was deleted")) return true;
  return false;
}

export async function readFirebaseExchangeErrorBody(
  response: Response,
): Promise<{ error: string; code?: string }> {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    return {
      error: typeof data.error === "string" ? data.error : "Authentication failed",
      code: typeof data.code === "string" ? data.code : undefined,
    };
  } catch {
    return { error: "Authentication failed" };
  }
}

const DELETED_TOAST_DEDUP_MS = 4000;
const DELETED_TOAST_STORAGE_KEY = "gigaid_deleted_account_notice_ts";

export function shouldShowDeletedAccountToast(): boolean {
  const now = Date.now();
  try {
    const prev = sessionStorage.getItem(DELETED_TOAST_STORAGE_KEY);
    if (prev && now - Number(prev) < DELETED_TOAST_DEDUP_MS) {
      return false;
    }
    sessionStorage.setItem(DELETED_TOAST_STORAGE_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

export async function cleanupAfterDeletedAccountExchange(): Promise<void> {
  clearAuthToken();
  try {
    await firebaseSignOut();
  } catch {
    // Firebase may already be signing out; still clear local app state above.
  }
}
