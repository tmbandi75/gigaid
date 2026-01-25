import { useEffect, useState } from "react";
import { clearAuthToken } from "@/lib/authToken";
import { firebaseSignOut } from "@/lib/firebase";

export default function ForceLogout() {
  const [status, setStatus] = useState("Clearing authentication...");

  useEffect(() => {
    async function clearAllAuth() {
      try {
        setStatus("Clearing local token...");
        clearAuthToken();
        
        setStatus("Clearing localStorage...");
        localStorage.clear();
        
        setStatus("Signing out from Firebase...");
        try {
          await firebaseSignOut();
        } catch (e) {
          console.log("Firebase signout:", e);
        }
        
        setStatus("Clearing server session...");
        try {
          await fetch("/api/auth/logout", { 
            method: "POST",
            credentials: "include" 
          });
        } catch (e) {
          console.log("Server logout:", e);
        }
        
        setStatus("Clearing IndexedDB...");
        try {
          const databases = await indexedDB.databases();
          for (const db of databases) {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (e) {
          console.log("IndexedDB clear:", e);
        }
        
        setStatus("Clearing sessionStorage...");
        sessionStorage.clear();
        
        setStatus("All cleared! Redirecting to login...");
        
        setTimeout(() => {
          window.location.replace("/login");
        }, 1000);
        
      } catch (error) {
        console.error("Force logout error:", error);
        setStatus("Error occurred. Redirecting anyway...");
        setTimeout(() => {
          window.location.replace("/login");
        }, 1000);
      }
    }
    
    clearAllAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground" data-testid="text-logout-status">{status}</p>
      </div>
    </div>
  );
}
