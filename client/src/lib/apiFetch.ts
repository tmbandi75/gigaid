import { Capacitor } from "@capacitor/core";
import { getAuthToken, isTokenReady } from "./authToken";
import { getGlobalLoggingOut } from "./queryClient";

function clientPlatformHeader(): string | undefined {
  if (!Capacitor.isNativePlatform()) return "web";
  const p = Capacitor.getPlatform();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return p;
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  if (getGlobalLoggingOut()) {
    throw new Error("Logout in progress");
  }

  const token = getAuthToken();
  const tokenReady = isTokenReady();
  const method = options?.method?.toUpperCase() || "GET";
  const isMutating = method !== "GET" && method !== "HEAD";

  if (isMutating && (!token || !tokenReady)) {
    throw new Error("Authentication required - please sign in again");
  }

  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  const platform = clientPlatformHeader();
  if (platform) {
    headers["X-Client-Platform"] = platform;
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type");
  if (res.status === 204 || !contentType?.includes("application/json")) {
    return undefined as T;
  }

  return res.json();
}
