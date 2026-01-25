import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "./authToken";

// Global logout state - prevents any API calls during logout
let isLoggingOutGlobal = false;

export function setGlobalLoggingOut(value: boolean): void {
  isLoggingOutGlobal = value;
  console.log("[QueryClient] Global logout state set to:", value, "timestamp:", Date.now());
}

export function getGlobalLoggingOut(): boolean {
  return isLoggingOutGlobal;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Block all API requests during logout to prevent rehydration
  if (isLoggingOutGlobal) {
    console.log("[QueryClient] API request blocked during logout:", method, url);
    throw new Error("Logout in progress");
  }

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Block all queries during logout to prevent rehydration
    if (isLoggingOutGlobal) {
      console.log("[QueryClient] Query blocked during logout:", queryKey);
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      throw new Error("Logout in progress");
    }

    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
