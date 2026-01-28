import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import type { User } from "@shared/schema";
import { getAuthToken, clearAuthToken } from "@/lib/authToken";
import { firebaseSignOut } from "@/lib/firebase";
import { setGlobalLoggingOut, getGlobalLoggingOut } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";

async function fetchUser(): Promise<User | null> {
  // Don't fetch user if we're in the middle of logging out
  if (getGlobalLoggingOut()) {
    console.log("[Auth] fetchUser blocked - logout in progress, timestamp:", Date.now());
    return null;
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  console.log("[Auth] fetchUser called, timestamp:", Date.now());
  
  const response = await fetch("/api/auth/user", {
    credentials: "include",
    headers,
  });

  console.log("[Auth] fetchUser response:", response.status, "timestamp:", Date.now());

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isTokenReady, setTokenReady } = useFirebaseAuth();
  
  const { data: user, status, isFetching, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    // Don't refetch while logging out, and only fetch if token is ready
    enabled: !getGlobalLoggingOut() && isTokenReady,
  });

  const performLogout = useCallback(async (): Promise<void> => {
    console.log("[Auth] ========== LOGOUT STARTED ==========");
    console.log("[Auth] Logout timestamp:", Date.now());
    
    // Step 1: Set global logout flag to prevent ALL rehydration
    setGlobalLoggingOut(true);
    setIsLoggingOut(true);
    
    // Step 1b: Reset token ready flag
    console.log("[Auth] Step 1b: Resetting token ready flag");
    setTokenReady(false);
    
    try {
      // Step 2: Clear app JWT from localStorage
      console.log("[Auth] Step 2: Clearing app JWT token");
      clearAuthToken();
      
      // Step 3: Clear React Query cache COMPLETELY
      console.log("[Auth] Step 3: Clearing React Query cache");
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      
      // Step 4: Await Firebase signOut
      console.log("[Auth] Step 4: Signing out from Firebase");
      try {
        await firebaseSignOut();
        console.log("[Auth] Firebase signOut complete, timestamp:", Date.now());
      } catch (e) {
        console.error("[Auth] Firebase sign out error:", e);
      }
      
      // Step 5: Await server logout with JSON acknowledgment
      console.log("[Auth] Step 5: Calling server logout");
      try {
        const response = await fetch("/api/auth/logout", { 
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("[Auth] Server logout acknowledged:", data, "timestamp:", Date.now());
        } else {
          console.error("[Auth] Server logout failed:", response.status);
        }
      } catch (e) {
        console.error("[Auth] Server logout error:", e);
      }
      
      // Step 6: Clear sessionStorage
      console.log("[Auth] Step 6: Clearing sessionStorage");
      sessionStorage.clear();
      
      // Step 7: Clear splash seen flag to ensure landing page shows
      console.log("[Auth] Step 7: Clearing splash seen flag");
      localStorage.removeItem("gigaid_splash_seen");
      
      console.log("[Auth] ========== LOGOUT COMPLETE ==========");
      console.log("[Auth] Final timestamp:", Date.now());
      
    } catch (error) {
      console.error("[Auth] Logout error:", error);
    } finally {
      // Reset global logout flag - Firebase onAuthStateChanged will handle state
      setGlobalLoggingOut(false);
    }
    
    // NO page reload - Firebase signOut already triggered onAuthStateChanged
    // which will set firebaseUser=null and authLoading=false, causing
    // AuthenticatedApp to render SplashPage
    // Update URL to "/" without page reload
    window.history.replaceState({}, "", "/");
  }, [queryClient, setTokenReady]);

  const logoutMutation = useMutation({
    mutationFn: performLogout,
    onMutate: () => {
      // Immediately mark as logged out in cache
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const globalLogoutState = getGlobalLoggingOut();
  const isLoading = status === "pending" || (isFetching && user === undefined) || (!isTokenReady && !globalLogoutState);

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !globalLogoutState && isTokenReady,
    isTokenReady,
    logout: logoutMutation.mutate,
    isLoggingOut: isLoggingOut || globalLogoutState,
    refetchUser: refetch,
  };
}
