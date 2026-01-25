import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getAuthToken, clearAuthToken } from "@/lib/authToken";
import { firebaseSignOut } from "@/lib/firebase";

async function fetchUser(): Promise<User | null> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch("/api/auth/user", {
    credentials: "include",
    headers,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  clearAuthToken();
  try {
    await firebaseSignOut();
  } catch (e) {
    console.error("Firebase sign out error:", e);
  }
  // Call server logout to clear session
  try {
    await fetch("/api/logout", { credentials: "include" });
  } catch (e) {
    console.error("Server logout error:", e);
  }
  // Force redirect to login page
  window.location.replace("/login");
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, status, isFetching, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onMutate: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.removeQueries();
    },
  });

  const isLoading = status === "pending" || (isFetching && user === undefined);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetchUser: refetch,
  };
}
