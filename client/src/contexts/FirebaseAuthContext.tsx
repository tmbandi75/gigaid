import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { onFirebaseAuthChange } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";

interface FirebaseAuthContextValue {
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    console.log("[FirebaseAuth] Setting up onAuthStateChanged listener");
    console.log("AUTH STATE CHANGE (initial)", {
      authLoading: true,
      firebaseUser: null
    });
    
    const unsubscribe = onFirebaseAuthChange((user) => {
      console.log("[FirebaseAuth] onAuthStateChanged fired:", user ? user.email : "null");
      console.log("AUTH STATE CHANGE", {
        authLoading: false,
        firebaseUser: user ? user.uid : null
      });
      setFirebaseUser(user);
      setAuthLoading(false);
    });

    return () => {
      console.log("[FirebaseAuth] Cleaning up onAuthStateChanged listener");
      unsubscribe();
    };
  }, []);

  return (
    <FirebaseAuthContext.Provider value={{ firebaseUser, authLoading }}>
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
