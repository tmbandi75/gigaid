import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import type { User } from "@shared/schema";
import { getAuthToken, clearAuthToken } from "@/lib/authToken";
import { firebaseSignOut } from "@/lib/firebase";
import { setGlobalLoggingOut, getGlobalLoggingOut } from "@/lib/queryClient";

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
  
  const { data: user, status, isFetching, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    // Don't refetch while logging out
    enabled: !getGlobalLoggingOut(),
  });

  const performLogout = useCallback(async (): Promise<void> => {
    console.log("[Auth] ========== LOGOUT STARTED ==========");
    console.log("[Auth] Logout timestamp:", Date.now());
    
    // Step 1: Set global logout flag to prevent ALL rehydration
    setGlobalLoggingOut(true);
    setIsLoggingOut(true);
    
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
      
      // Step 6: Clear any remaining IndexedDB Firebase data
      console.log("[Auth] Step 6: Clearing IndexedDB");
      try {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name && (db.name.includes("firebase") || db.name.includes("firebaseLocalStorage"))) {
            console.log("[Auth] Deleting IndexedDB:", db.name);
            indexedDB.deleteDatabase(db.name);
          }
        }
      } catch (e) {
        console.log("[Auth] IndexedDB clear skipped:", e);
      }
      
      // Step 7: Clear sessionStorage as well
      console.log("[Auth] Step 7: Clearing sessionStorage");
      sessionStorage.clear();
      
      console.log("[Auth] ========== LOGOUT COMPLETE ==========");
      console.log("[Auth] Final timestamp:", Date.now());
      
    } catch (error) {
      console.error("[Auth] Logout error:", error);
    }
    
    // Step 8: Only after ALL steps complete, redirect
    // Keep globalIsLoggingOut true - it will be reset on next page load
    console.log("[Auth] Step 8: Redirecting to /login");
    window.location.replace("/login");
  }, [queryClient]);

  const logoutMutation = useMutation({
    mutationFn: performLogout,
    onMutate: () => {
      // Immediately mark as logged out in cache
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const isLoading = status === "pending" || (isFetching && user === undefined);
  const globalLogoutState = getGlobalLoggingOut();

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !globalLogoutState,
    logout: logoutMutation.mutate,
    isLoggingOut: isLoggingOut || globalLogoutState,
    refetchUser: refetch,
  };
}
