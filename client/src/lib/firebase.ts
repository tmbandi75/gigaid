import { initializeApp, type FirebaseApp } from "firebase/app";
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
  type Auth,
  type User as FirebaseUser 
} from "firebase/auth";
import { isNativePlatform } from "./platform";
import { logger } from "@/lib/logger";

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export let firebaseInitError: string | null = null;

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;

try {
  const missing = REQUIRED_ENV_KEYS.filter(
    (key) => !import.meta.env[key]
  );
  if (missing.length > 0) {
    const msg = `[Firebase] Missing required env vars: ${missing.join(', ')}`;
    logger.error(msg);
    firebaseInitError = msg;
  } else {
    app = initializeApp(firebaseConfig);
    _auth = getAuth(app);
    logger.info("[Firebase] Initialized successfully");
  }
} catch (err) {
  const msg = `[Firebase] Initialization failed: ${err instanceof Error ? err.message : String(err)}`;
  logger.error(msg, err);
  firebaseInitError = msg;
}

export const auth = _auth as Auth;

function requireAuth(): Auth {
  if (firebaseInitError || !_auth) {
    throw new Error(firebaseInitError || "Firebase auth is not initialized");
  }
  return _auth;
}

export function getFirebaseAuth() {
  return auth;
}

const googleProvider = new GoogleAuthProvider();

let redirectResultPromise: Promise<string | null> | null = null;

export function initializeRedirectResultHandler(): Promise<string | null> {
  if (firebaseInitError || !_auth) return Promise.resolve(null);

  if (redirectResultPromise) {
    return redirectResultPromise;
  }
  
  redirectResultPromise = getRedirectResult(_auth)
    .then(async (result) => {
      if (result && result.user) {
        logger.debug("[Firebase] Redirect result received, getting ID token");
        const idToken = await result.user.getIdToken();
        return idToken;
      }
      return null;
    })
    .catch((error) => {
      logger.error("[Firebase] Redirect result error:", error);
      return null;
    });
  
  return redirectResultPromise;
}

export async function signInWithGoogle(): Promise<string> {
  const a = requireAuth();
  if (isNativePlatform()) {
    logger.debug("[Firebase] Native platform detected, using signInWithRedirect");
    await signInWithRedirect(a, googleProvider);
    throw new Error("Redirect initiated - waiting for redirect result");
  }
  
  const result = await signInWithPopup(a, googleProvider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function firebaseSignOut(): Promise<void> {
  if (!_auth) return;
  await signOut(_auth);
}

export function onFirebaseAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (!_auth) {
    logger.warn("[Firebase] Auth not initialized, calling back with null user");
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(_auth, callback);
}

export async function getFirebaseIdToken(): Promise<string | null> {
  if (!_auth) return null;
  const user = _auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function signUpWithEmail(email: string, password: string): Promise<string> {
  const a = requireAuth();
  const result = await createUserWithEmailAndPassword(a, email, password);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
  const a = requireAuth();
  const result = await signInWithEmailAndPassword(a, email, password);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function resetPassword(email: string): Promise<void> {
  const a = requireAuth();
  await sendPasswordResetEmail(a, email);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const a = requireAuth();
  const user = a.currentUser;
  if (!user || !user.email) {
    throw new Error("No user is currently signed in");
  }
  
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  
  await updatePassword(user, newPassword);
}

export function isEmailPasswordUser(): boolean {
  if (!_auth) return false;
  const user = _auth.currentUser;
  if (!user) return false;
  return user.providerData.some(provider => provider.providerId === "password");
}
