import { logger } from "@/lib/logger";

const MOBILE_AUTH_TOKEN_KEY = 'gigaid_mobile_auth_token';

export interface MobileAuthResult {
  token: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
    name?: string;
  };
  linkedBy?: 'email' | 'phone' | 'new_user';
}

export async function signInWithFirebaseIdToken(idToken: string): Promise<MobileAuthResult> {
  const response = await fetch('/api/auth/mobile/firebase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Authentication failed');
  }

  const result: MobileAuthResult = await response.json();
  
  setMobileAuthToken(result.token);
  
  return result;
}

export function getMobileAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(MOBILE_AUTH_TOKEN_KEY);
}

export function setMobileAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOBILE_AUTH_TOKEN_KEY, token);
}

export function clearMobileAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MOBILE_AUTH_TOKEN_KEY);
}

export function isMobileAuthActive(): boolean {
  return !!getMobileAuthToken();
}

export function getMobileAuthHeaders(): HeadersInit {
  const token = getMobileAuthToken();
  if (!token) return {};
  return {
    'Authorization': `Bearer ${token}`,
  };
}

export async function fetchWithMobileAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getMobileAuthToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export async function checkMobileAuthStatus(): Promise<{
  firebaseConfigured: boolean;
  supportedProviders: string[];
}> {
  const response = await fetch('/api/auth/mobile/status');
  if (!response.ok) {
    throw new Error('Failed to check mobile auth status');
  }
  return response.json();
}

export async function getMobileAuthUser(): Promise<MobileAuthResult['user'] | null> {
  const token = getMobileAuthToken();
  if (!token) return null;
  
  try {
    const response = await fetch('/api/auth/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        clearMobileAuthToken();
        return null;
      }
      throw new Error('Failed to get user');
    }
    
    return response.json();
  } catch (error) {
    logger.error('[MobileAuth] Failed to get user:', error);
    return null;
  }
}

export function signOutMobile(): void {
  clearMobileAuthToken();
  window.location.href = '/';
}
