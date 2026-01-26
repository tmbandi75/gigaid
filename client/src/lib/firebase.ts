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
  type User as FirebaseUser 
} from "firebase/auth";
import { isNativePlatform } from "./platform";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

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
