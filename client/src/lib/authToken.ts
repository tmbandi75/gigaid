const TOKEN_KEY = "gigaid_auth_token";
const TOKEN_UID_KEY = "gigaid_token_uid";

// Global token readiness state - non-React accessible
// Tracks the Firebase UID that the current token was issued for
let tokenOwnerUid: string | null = null;

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// Set token along with the Firebase UID it belongs to
export function setAuthToken(token: string, firebaseUid?: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (firebaseUid) {
      localStorage.setItem(TOKEN_UID_KEY, firebaseUid);
      tokenOwnerUid = firebaseUid;
      console.log("[AuthToken] Token set for user:", firebaseUid);
    } else {
      console.log("[AuthToken] Token set (no UID provided)");
    }
  } catch {
    console.error("Failed to store auth token");
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_UID_KEY);
    tokenOwnerUid = null;
    console.log("[AuthToken] Token and UID cleared");
  } catch {
    console.error("Failed to clear auth token");
  }
}

// Check if token is ready for a specific Firebase user
// Token is ready if:
// 1. Token exists in localStorage
// 2. Token was issued for the current Firebase user (UID matches)
export function isTokenReadyForUser(currentFirebaseUid: string | null): boolean {
  if (!currentFirebaseUid) {
    return false;
  }
  
  const token = getAuthToken();
  if (!token) {
    return false;
  }
  
  // Check in-memory first
  if (tokenOwnerUid === currentFirebaseUid) {
    return true;
  }
  
  // Check localStorage
  try {
    const storedUid = localStorage.getItem(TOKEN_UID_KEY);
    if (storedUid === currentFirebaseUid) {
      tokenOwnerUid = storedUid;
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  
  console.log("[AuthToken] Token not ready - UID mismatch:", { tokenOwner: tokenOwnerUid, currentUser: currentFirebaseUid });
  return false;
}

// Simple check if any token exists (for non-user-specific checks)
export function isTokenReady(): boolean {
  const token = getAuthToken();
  if (!token) {
    return false;
  }
  
  // If we have in-memory owner tracking, token was properly set
  if (tokenOwnerUid !== null) {
    return true;
  }
  
  // Check localStorage for persisted UID (page reload case)
  try {
    const storedUid = localStorage.getItem(TOKEN_UID_KEY);
    if (storedUid) {
      tokenOwnerUid = storedUid;
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  
  // Token exists but no UID tracking - allow for backward compatibility
  // Old tokens from before UID tracking was added should still work
  // The server will validate the token regardless
  return true;
}

// Reset token readiness (called when Firebase user changes)
export function resetTokenReadiness(): void {
  tokenOwnerUid = null;
  try {
    localStorage.removeItem(TOKEN_UID_KEY);
    console.log("[AuthToken] Token readiness reset (user change)");
  } catch {
    // Ignore storage errors
  }
}

// Get the UID the current token was issued for
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

// Initialize token ownership from localStorage on module load
function initializeTokenOwnership(): void {
  try {
    const storedUid = localStorage.getItem(TOKEN_UID_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (storedUid && token) {
      tokenOwnerUid = storedUid;
      console.log("[AuthToken] Initialized token ownership from storage for user:", storedUid);
    } else if (token && !storedUid) {
      console.log("[AuthToken] Found token without UID - will require fresh exchange");
    }
  } catch {
    // Ignore storage errors
  }
}

// Run initialization on module load
initializeTokenOwnership();

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
