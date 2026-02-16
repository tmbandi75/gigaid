import { logger } from "@/lib/logger";

const TOKEN_KEY = "gigaid_auth_token";
const TOKEN_UID_KEY = "gigaid_token_uid";

let tokenOwnerUid: string | null = null;

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, firebaseUid?: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (firebaseUid) {
      localStorage.setItem(TOKEN_UID_KEY, firebaseUid);
      tokenOwnerUid = firebaseUid;
    }
  } catch {
    logger.error("[AuthToken] Failed to store auth token");
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_UID_KEY);
    tokenOwnerUid = null;
  } catch {
    logger.error("[AuthToken] Failed to clear auth token");
  }
}

export function isTokenReadyForUser(currentFirebaseUid: string | null): boolean {
  if (!currentFirebaseUid) {
    return false;
  }
  
  const token = getAuthToken();
  if (!token) {
    return false;
  }
  
  if (tokenOwnerUid === currentFirebaseUid) {
    return true;
  }
  
  try {
    const storedUid = localStorage.getItem(TOKEN_UID_KEY);
    if (storedUid === currentFirebaseUid) {
      tokenOwnerUid = storedUid;
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  
  return false;
}

export function isTokenReady(): boolean {
  const token = getAuthToken();
  if (!token) {
    return false;
  }
  
  if (tokenOwnerUid !== null) {
    return true;
  }
  
  try {
    const storedUid = localStorage.getItem(TOKEN_UID_KEY);
    if (storedUid) {
      tokenOwnerUid = storedUid;
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  
  return true;
}

export function resetTokenReadiness(): void {
  tokenOwnerUid = null;
  try {
    localStorage.removeItem(TOKEN_UID_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getTokenOwnerUid(): string | null {
  if (tokenOwnerUid) {
    return tokenOwnerUid;
  }
  try {
    const storedUid = localStorage.getItem(TOKEN_UID_KEY);
    if (storedUid) {
      tokenOwnerUid = storedUid;
      return storedUid;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function initializeTokenOwnership(): void {
  try {
    const storedUid = localStorage.getItem(TOKEN_UID_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (storedUid && token) {
      tokenOwnerUid = storedUid;
    }
  } catch {
    // Ignore storage errors
  }
}

initializeTokenOwnership();

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
