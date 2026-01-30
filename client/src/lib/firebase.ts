import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  type User as FirebaseUser 
} from "firebase/auth";
import { isNativePlatform } from "./platform";

// Firebase configuration - these are public web API keys (secured via domain restrictions in Firebase Console)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBdyS79wNb_GBqARmJmzrBr2ZsdsC_51l8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gigaid-9c982.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gigaid-9c982",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gigaid-9c982.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1091854959908",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1091854959908:web:8c56f7c0a8e3d5f7a1b2c3",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Function to get the auth instance (for use in callbacks where direct import may cause issues)
export function getFirebaseAuth() {
  return auth;
}

const googleProvider = new GoogleAuthProvider();

let redirectResultPromise: Promise<string | null> | null = null;

export function initializeRedirectResultHandler(): Promise<string | null> {
  if (redirectResultPromise) {
    return redirectResultPromise;
  }
  
  redirectResultPromise = getRedirectResult(auth)
    .then(async (result) => {
      if (result && result.user) {
        console.log("[Firebase] Redirect result received, getting ID token");
        const idToken = await result.user.getIdToken();
        return idToken;
      }
      return null;
    })
    .catch((error) => {
      console.error("[Firebase] Redirect result error:", error);
      return null;
    });
  
  return redirectResultPromise;
}

export async function signInWithGoogle(): Promise<string> {
  if (isNativePlatform()) {
    console.log("[Firebase] Native platform detected, using signInWithRedirect");
    await signInWithRedirect(auth, googleProvider);
    throw new Error("Redirect initiated - waiting for redirect result");
  }
  
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function firebaseSignOut(): Promise<void> {
  await signOut(auth);
}

export function onFirebaseAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function signUpWithEmail(email: string, password: string): Promise<string> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("No user is currently signed in");
  }
  
  // Re-authenticate the user with current password
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  
  // Update to new password
  await updatePassword(user, newPassword);
}

export function isEmailPasswordUser(): boolean {
  const user = auth.currentUser;
  if (!user) return false;
  return user.providerData.some(provider => provider.providerId === "password");
}
