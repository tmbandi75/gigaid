const TOKEN_KEY = "gigaid_auth_token";
const TOKEN_READY_KEY = "gigaid_token_ready_ts";

// Global token readiness state - non-React accessible
// This is set to current timestamp when token is successfully exchanged
// and cleared on logout or user change
let tokenReadyTimestamp: number | null = null;

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    // Mark token as ready with current timestamp
    const now = Date.now();
    tokenReadyTimestamp = now;
    localStorage.setItem(TOKEN_READY_KEY, String(now));
    console.log("[AuthToken] Token set and marked ready at:", now);
  } catch {
    console.error("Failed to store auth token");
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_READY_KEY);
    tokenReadyTimestamp = null;
    console.log("[AuthToken] Token and readiness cleared");
  } catch {
    console.error("Failed to clear auth token");
  }
}

// Check if token is ready for use
// Token is ready if:
// 1. It exists in localStorage
// 2. It was set during this session (tokenReadyTimestamp exists) OR
//    it has a stored ready timestamp from a previous session
export function isTokenReady(): boolean {
  const token = getAuthToken();
  if (!token) {
    return false;
  }
  
  // If we have in-memory readiness (set this session), use it
  if (tokenReadyTimestamp !== null) {
    return true;
  }
  
  // Otherwise check localStorage for persisted readiness
  try {
    const storedTs = localStorage.getItem(TOKEN_READY_KEY);
    if (storedTs) {
      tokenReadyTimestamp = parseInt(storedTs, 10);
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  
  return false;
}

// Reset token readiness (called when Firebase user changes)
export function resetTokenReadiness(): void {
  tokenReadyTimestamp = null;
  try {
    localStorage.removeItem(TOKEN_READY_KEY);
    console.log("[AuthToken] Token readiness reset (user change)");
  } catch {
    // Ignore storage errors
  }
}

// Initialize token readiness from localStorage on module load
// This handles page reload scenario
function initializeTokenReadiness(): void {
  try {
    const storedTs = localStorage.getItem(TOKEN_READY_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (storedTs && token) {
      tokenReadyTimestamp = parseInt(storedTs, 10);
      console.log("[AuthToken] Initialized token readiness from storage:", tokenReadyTimestamp);
    }
  } catch {
    // Ignore storage errors
  }
}

// Run initialization on module load
initializeTokenReadiness();

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
