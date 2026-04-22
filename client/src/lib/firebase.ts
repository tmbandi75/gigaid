import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  linkWithPopup,
  linkWithCredential,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import { isNativePlatform } from "./platform";
import { logger } from "@/lib/logger";
import { initAppCheck } from "@/lib/security/initAppCheck";

const REQUIRED_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
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
  const missing = REQUIRED_ENV_KEYS.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    const msg = `[Firebase] Missing required env vars: ${missing.join(", ")}`;
    logger.error(msg);
    firebaseInitError = msg;
  } else {
    app = initializeApp(firebaseConfig);
    // Auth must be initialized before App Check so the popup flow
    // isn't gated by an unregistered debug token in development
    _auth = getAuth(app);
    initAppCheck(app);
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

/** Current Firebase user, or throws if auth is missing or no one is signed in. */
export function requireFirebaseUser(): FirebaseUser {
  const a = requireAuth();
  const user = a.currentUser;
  if (!user) {
    throw new Error("Sign in to link a phone number.");
  }
  return user;
}

export function getFirebaseAuth() {
  return auth;
}

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<string> {
  const a = requireAuth();
  logger.info("[GoogleSignIn] Starting sign-in flow", {
    isNative: isNativePlatform(),
    authDomain: firebaseConfig.authDomain,
  });

  // Native platforms use the Capacitor Firebase plugin which invokes the
  // platform's native Google Sign-In SDK, avoiding WKWebView sessionStorage
  // partitioning issues that break signInWithRedirect on iOS.
  if (isNativePlatform()) {
    logger.info("[GoogleSignIn] Native platform — using Capacitor Firebase plugin");
    const { FirebaseAuthentication } = await import(
      "@capacitor-firebase/authentication"
    );
    const result = await FirebaseAuthentication.signInWithGoogle();

    if (!result.credential?.idToken) {
      throw new Error("Google Sign-In did not return a credential. The user may have cancelled.");
    }

    const credential = GoogleAuthProvider.credential(
      result.credential.idToken,
      result.credential.accessToken,
    );
    const userCredential = await signInWithCredential(a, credential);
    logger.info("[GoogleSignIn] Native sign-in succeeded", {
      email: userCredential.user.email,
    });
    return await userCredential.user.getIdToken();
  }

  // Web uses popup — works with the COOP fix already in server/index.ts
  try {
    const result = await signInWithPopup(a, googleProvider);
    logger.info("[GoogleSignIn] Popup succeeded", { email: result.user.email });
    return await result.user.getIdToken();
  } catch (popupError: any) {
    logger.error("[GoogleSignIn] Popup error:", popupError?.code, popupError?.message);

    if (popupError?.code === "auth/popup-blocked") {
      throw new Error("Popup was blocked by your browser. Please allow popups for this site and try again.");
    }
    if (popupError?.code === "auth/popup-closed-by-user" || popupError?.code === "auth/cancelled-popup-request") {
      throw new Error("Sign-in was cancelled. Please try again.");
    }
    throw popupError;
  }
}

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
let nativeAppleSignInInFlight: Promise<string> | null = null;

export async function signInWithApple(): Promise<string> {
  const a = requireAuth();
  logger.info("[AppleSignIn] Starting sign-in flow", {
    isNative: isNativePlatform(),
    authDomain: firebaseConfig.authDomain,
  });

  if (isNativePlatform()) {
    if (nativeAppleSignInInFlight) {
      logger.warn("[AppleSignIn] Native sign-in already in progress, reusing existing request");
      return nativeAppleSignInInFlight;
    }

    nativeAppleSignInInFlight = (async () => {
      logger.info("[AppleSignIn] Native platform — using Capacitor Firebase plugin");
      const { FirebaseAuthentication } = await import(
        "@capacitor-firebase/authentication"
      );
      const result = await FirebaseAuthentication.signInWithApple({
        // We complete auth with Firebase JS SDK below using signInWithCredential.
        // Native auth must be skipped to avoid nonce/credential reuse conflicts.
        skipNativeAuth: true,
      });

      const idToken = result.credential?.idToken;
      // Plugin payloads can vary by platform/version, so normalize nonce shape.
      const rawNonce = (result.credential as any)?.nonce ?? (result.credential as any)?.rawNonce;

      if (!idToken) {
        throw new Error("Apple Sign-In did not return an idToken. The user may have cancelled.");
      }
      if (!rawNonce) {
        throw new Error("Apple Sign-In did not return a nonce. Please try again.");
      }

      try {
        const credential = appleProvider.credential({
          idToken,
          rawNonce,
        });
        const userCredential = await signInWithCredential(a, credential);
        logger.info("[AppleSignIn] Native sign-in succeeded", {
          email: userCredential.user.email,
          nameReceived: Boolean(userCredential.user.displayName),
          emailReceived: Boolean(userCredential.user.email),
        });
        return await userCredential.user.getIdToken();
      } catch (nativeError: any) {
        const message = nativeError?.message || "";
        const code = nativeError?.code || "";
        if (
          code === "auth/missing-or-invalid-nonce" ||
          message.includes("missing-or-invalid-nonce") ||
          message.includes("duplicate credential")
        ) {
          throw new Error("Apple sign-in nonce expired or was reused. Please try again.");
        }
        throw nativeError;
      }
    })();

    try {
      return await nativeAppleSignInInFlight;
    } finally {
      nativeAppleSignInInFlight = null;
    }
  }

  try {
    const result = await signInWithPopup(a, appleProvider);
    logger.info("[AppleSignIn] Popup succeeded", {
      email: result.user.email,
      nameReceived: Boolean(result.user.displayName),
      emailReceived: Boolean(result.user.email),
    });
    return await result.user.getIdToken();
  } catch (popupError: any) {
    logger.error("[AppleSignIn] Popup error:", popupError?.code, popupError?.message);

    if (popupError?.code === "auth/popup-blocked") {
      throw new Error("Popup was blocked by your browser. Please allow popups for this site and try again.");
    }
    if (popupError?.code === "auth/popup-closed-by-user" || popupError?.code === "auth/cancelled-popup-request") {
      throw new Error("Sign-in was cancelled. Please try again.");
    }
    throw popupError;
  }
}

export async function firebaseSignOut(): Promise<void> {
  if (!_auth) return;
  await signOut(_auth);
}

export function onFirebaseAuthChange(
  callback: (user: FirebaseUser | null) => void,
): () => void {
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

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const a = requireAuth();
  const result = await createUserWithEmailAndPassword(a, email, password);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const a = requireAuth();
  const result = await signInWithEmailAndPassword(a, email, password);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export async function resetPassword(email: string): Promise<void> {
  const a = requireAuth();
  await sendPasswordResetEmail(a, email);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
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
  return user.providerData.some(
    (provider) => provider.providerId === "password",
  );
}

const PROVIDER_ID_TO_LINK_KIND: Record<
  string,
  "apple" | "google" | "phone" | "email"
> = {
  "google.com": "google",
  "apple.com": "apple",
  phone: "phone",
  password: "email",
};

export type AccountLinkKind = "apple" | "google" | "phone" | "email";

export interface AccountLinkingLinkedMethod {
  provider: AccountLinkKind;
  identifier?: string;
  verified: boolean;
}

/** Maps Firebase providerData into the shape used by AccountLinking. */
export function getAccountLinkingInfo(user: FirebaseUser | null): {
  currentProvider: AccountLinkKind;
  linkedMethods: AccountLinkingLinkedMethod[];
} {
  if (!user?.providerData?.length) {
    return { currentProvider: "email", linkedMethods: [] };
  }
  const linkedMethods: AccountLinkingLinkedMethod[] = [];
  for (const p of user.providerData) {
    const kind = PROVIDER_ID_TO_LINK_KIND[p.providerId];
    if (!kind) continue;
    linkedMethods.push({
      provider: kind,
      identifier: p.email || p.phoneNumber || undefined,
      verified: true,
    });
  }
  const primary = user.providerData[0];
  const currentProvider =
    PROVIDER_ID_TO_LINK_KIND[primary?.providerId ?? ""] ?? "email";
  return { currentProvider, linkedMethods };
}

function isAlreadyLinked(user: FirebaseUser, providerId: string): boolean {
  return user.providerData.some((p) => p.providerId === providerId);
}

async function applyNativeLinkResultToJs(
  user: FirebaseUser,
  credential: {
    idToken?: string;
    accessToken?: string;
    nonce?: string;
    providerId?: string;
  } | null,
  kind: "google" | "apple",
): Promise<void> {
  if (kind === "google") {
    if (!credential?.idToken) {
      await user.reload();
      return;
    }
    const oauthCred = GoogleAuthProvider.credential(
      credential.idToken,
      credential.accessToken,
    );
    try {
      await linkWithCredential(user, oauthCred);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (
        code === "auth/provider-already-linked" ||
        code === "auth/credential-already-in-use"
      ) {
        await user.reload();
        return;
      }
      throw e;
    }
    return;
  }
  const rawNonce = credential?.nonce;
  if (!credential?.idToken || !rawNonce) {
    await user.reload();
    return;
  }
  const oauthCred = appleProvider.credential({
    idToken: credential.idToken,
    rawNonce,
  });
  try {
    await linkWithCredential(user, oauthCred);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (
      code === "auth/provider-already-linked" ||
      code === "auth/credential-already-in-use"
    ) {
      await user.reload();
      return;
    }
    throw e;
  }
}

/** Links Google to the signed-in Firebase user (web popup or native SDK + JS sync). */
export async function linkGoogleToCurrentUser(): Promise<void> {
  const a = requireAuth();
  const user = a.currentUser;
  if (!user) {
    throw new Error("Sign in to link Google.");
  }
  if (isAlreadyLinked(user, "google.com")) {
    return;
  }

  if (isNativePlatform()) {
    const { FirebaseAuthentication } = await import(
      "@capacitor-firebase/authentication"
    );
    const result = await FirebaseAuthentication.linkWithGoogle();
    await applyNativeLinkResultToJs(user, result.credential, "google");
    await user.reload();
    return;
  }

  try {
    await linkWithPopup(user, googleProvider);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/credential-already-in-use") {
      throw new Error(
        "That Google account is already linked to a different user.",
      );
    }
    throw e;
  }
}

/** Links Apple to the signed-in Firebase user (web popup or native SDK + JS sync). */
export async function linkAppleToCurrentUser(): Promise<void> {
  const a = requireAuth();
  const user = a.currentUser;
  if (!user) {
    throw new Error("Sign in to link Apple.");
  }
  if (isAlreadyLinked(user, "apple.com")) {
    return;
  }

  if (isNativePlatform()) {
    const { FirebaseAuthentication } = await import(
      "@capacitor-firebase/authentication"
    );
    const result = await FirebaseAuthentication.linkWithApple();
    await applyNativeLinkResultToJs(user, result.credential, "apple");
    await user.reload();
    return;
  }

  try {
    await linkWithPopup(user, appleProvider);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/credential-already-in-use") {
      throw new Error(
        "That Apple ID is already linked to a different user.",
      );
    }
    throw e;
  }
}

function firebaseErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  try {
    return String(err ?? "");
  } catch {
    return "";
  }
}

/** User-facing message for Firebase link/sign-in errors. */
export function formatFirebaseLinkError(err: unknown): string {
  const message = firebaseErrorText(err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: string }).code
      : undefined;
  const haystack = `${code ?? ""} ${message}`.toUpperCase();
  if (haystack.includes("BILLING_NOT_ENABLED")) {
    return "Phone sign-in requires billing on your Firebase/Google Cloud project. Open Google Cloud Console → select this project → Billing → link a billing account. Firebase Phone Auth will not send SMS until billing is enabled.";
  }
  switch (code) {
    case "auth/credential-already-in-use":
      return "That sign-in is already used by another account.";
    case "auth/provider-already-linked":
      return "That sign-in method is already linked.";
    case "auth/requires-recent-login":
      return "For security, sign out and sign in again, then try linking.";
    case "auth/popup-blocked":
      return "Your browser blocked the popup. Allow popups for this site and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/invalid-verification-code":
    case "auth/code-expired":
      return "That code is invalid or expired. Request a new code.";
    default:
      return message || "Something went wrong. Please try again.";
  }
}
