import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { onFirebaseAuthChange } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { getAuthToken } from "@/lib/authToken";

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
  
  // Initialize isTokenReady based on whether we have an existing token in localStorage
  // This handles page reloads where user is already authenticated
  const [isTokenReady, setIsTokenReady] = useState(() => {
    const existingToken = getAuthToken();
    const hasToken = !!existingToken;
    console.log("[FirebaseAuth] Initial isTokenReady:", hasToken, "hasExistingToken:", hasToken);
    return hasToken;
  });

  const setTokenReady = (ready: boolean) => {
    console.log("[FirebaseAuth] setTokenReady called:", ready, "timestamp:", Date.now());
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
      
      console.log("[FirebaseAuth] ===== CALLBACK FIRED =====");
      console.log("[FirebaseAuth] onAuthStateChanged callback #" + count);
      console.log("[FirebaseAuth] user:", user ? user.email : "null");
      console.log("[FirebaseAuth] uid:", user ? user.uid : "null");
      console.log("[FirebaseAuth] timestamp:", callbackTs);
      console.log("[FirebaseAuth] time since setup:", callbackTs - setupTs, "ms");
      
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
