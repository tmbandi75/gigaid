import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
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
  window.location.href = "/api/logout";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, status, isFetching } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 30, // 30 seconds - check more frequently
    refetchOnWindowFocus: true, // Refetch when user returns to app
    refetchOnMount: "always", // Always refetch on mount to catch logout state
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onMutate: () => {
      // Immediately clear user data before redirect
      queryClient.setQueryData(["/api/auth/user"], null);
      // Remove all queries to prevent stale auth data
      queryClient.removeQueries();
    },
  });

  // isLoading true during initial fetch or during refetch when we need fresh data
  const isLoading = status === "pending" || (isFetching && user === undefined);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
