import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { onFirebaseAuthChange } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { isTokenReady as checkTokenReady, resetTokenReadiness } from "@/lib/authToken";

interface FirebaseAuthContextValue {
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  lastAuthEventTs: number | null;
  callbackCount: number;
  isTokenReady: boolean;
  setTokenReady: (ready: boolean) => void;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastAuthEventTs, setLastAuthEventTs] = useState<number | null>(null);
  const callbackCountRef = useRef(0);
  const [callbackCount, setCallbackCount] = useState(0);
  const previousFirebaseUidRef = useRef<string | null>(null);
  
  // Initialize isTokenReady from the module-level token readiness state
  // This syncs React state with the global auth token module
  const [isTokenReady, setIsTokenReady] = useState(() => {
    const ready = checkTokenReady();
    console.log("[FirebaseAuth] Initial isTokenReady from module:", ready);
    return ready;
  });

  const setTokenReady = (ready: boolean) => {
    console.log("[FirebaseAuth] setTokenReady called:", ready, "timestamp:", Date.now());
    // Note: setAuthToken() automatically sets module-level readiness
    // This just syncs React state for UI updates
    setIsTokenReady(ready);
  };

  useEffect(() => {
    const setupTs = Date.now();
    console.log("[FirebaseAuth] Setting up onAuthStateChanged listener, timestamp:", setupTs);
    console.log("AUTH STATE CHANGE (initial)", {
      authLoading: true,
      firebaseUser: null,
      timestamp: setupTs
    });
    
    const unsubscribe = onFirebaseAuthChange((user) => {
      const callbackTs = Date.now();
      callbackCountRef.current += 1;
      const count = callbackCountRef.current;
      
      const currentUid = user?.uid || null;
      const previousUid = previousFirebaseUidRef.current;
      
      console.log("[FirebaseAuth] ===== CALLBACK FIRED =====");
      console.log("[FirebaseAuth] onAuthStateChanged callback #" + count);
      console.log("[FirebaseAuth] user:", user ? user.email : "null");
      console.log("[FirebaseAuth] uid:", currentUid);
      console.log("[FirebaseAuth] previousUid:", previousUid);
      console.log("[FirebaseAuth] timestamp:", callbackTs);
      console.log("[FirebaseAuth] time since setup:", callbackTs - setupTs, "ms");
      
      // CRITICAL: Reset isTokenReady when user changes or signs out
      // This prevents using stale tokens from a previous user session
      if (currentUid !== previousUid) {
        console.log("[FirebaseAuth] User changed from", previousUid, "to", currentUid, "- resetting token readiness");
        
        // Reset both module-level and React state token readiness
        // This forces fresh token exchange for new user
        resetTokenReadiness();
        setIsTokenReady(false);
        
        previousFirebaseUidRef.current = currentUid;
      }
      
      console.log("AUTH STATE CHANGE", {
        authLoading: false,
        firebaseUser: user ? user.uid : null,
        email: user ? user.email : null,
        callbackNumber: count,
        timestamp: callbackTs
      });
      
      setLastAuthEventTs(callbackTs);
      setCallbackCount(count);
      setFirebaseUser(user);
      setAuthLoading(false);
      
      console.log("[FirebaseAuth] State updated: authLoading=false, firebaseUser=" + (user ? "present" : "null"));
    });

    return () => {
      console.log("[FirebaseAuth] Cleaning up onAuthStateChanged listener");
      unsubscribe();
    };
  }, []);

  return (
    <FirebaseAuthContext.Provider value={{ firebaseUser, authLoading, lastAuthEventTs, callbackCount, isTokenReady, setTokenReady }}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error("useFirebaseAuth must be used within a FirebaseAuthProvider");
  }
  return context;
}
