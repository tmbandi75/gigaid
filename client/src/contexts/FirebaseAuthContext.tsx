import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { onFirebaseAuthChange, firebaseInitError } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { isTokenReadyForUser, resetTokenReadiness } from "@/lib/authToken";

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
  
  const [isTokenReady, setIsTokenReady] = useState(false);

  const setTokenReady = (ready: boolean) => {
    setIsTokenReady(ready);
  };
  
  useEffect(() => {
    const uid = firebaseUser?.uid || null;
    const ready = isTokenReadyForUser(uid);
    setIsTokenReady(ready);
  }, [firebaseUser]);

  useEffect(() => {
    if (firebaseInitError) {
      console.error("[FirebaseAuth] Firebase failed to initialize");
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onFirebaseAuthChange((user) => {
      const callbackTs = Date.now();
      callbackCountRef.current += 1;
      const count = callbackCountRef.current;
      
      const currentUid = user?.uid || null;
      const previousUid = previousFirebaseUidRef.current;
      
      if (currentUid !== previousUid) {
        resetTokenReadiness();
        setIsTokenReady(false);
        previousFirebaseUidRef.current = currentUid;
      }
      
      setLastAuthEventTs(callbackTs);
      setCallbackCount(count);
      setFirebaseUser(user);
      setAuthLoading(false);
    });

    return () => {
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
