import admin from 'firebase-admin';
import { logger } from "./lib/logger";

let firebaseInitialized = false;
let initError: string | null = null;

function parsePrivateKey(raw: string): string {
  let key = raw;
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\\\n/g, '\n');
  key = key.replace(/\\n/g, '\n');

  if (!key.includes('-----BEGIN') || !key.includes('PRIVATE KEY')) {
    throw new Error('FIREBASE_PRIVATE_KEY does not contain a valid PEM private key header. Check the value in your secrets.');
  }

  return key;
}

function initializeFirebaseAdmin(): boolean {
  if (firebaseInitialized) {
    return true;
  }

  if (initError) {
    return false;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    const missing = [];
    if (!projectId) missing.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKeyRaw) missing.push('FIREBASE_PRIVATE_KEY');
    initError = `Missing Firebase credentials: ${missing.join(', ')}`;
    logger.error(`[Firebase] ${initError}. Signup/login will NOT work.`);
    return false;
  }

  let privateKey: string;
  try {
    privateKey = parsePrivateKey(privateKeyRaw);
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
    logger.error(`[Firebase] Private key parsing failed: ${initError}`);
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseInitialized = true;
    logger.info('[Firebase] Admin SDK initialized successfully');
    return true;
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    logger.error('[Firebase] Failed to initialize Admin SDK:', initError);
    return false;
  }
}

export async function selfTestFirebaseAdmin(): Promise<{ ok: boolean; error?: string }> {
  if (!initializeFirebaseAdmin()) {
    return { ok: false, error: initError || 'Firebase Admin SDK failed to initialize' };
  }

  try {
    await admin.auth().listUsers(1);
    logger.info('[Firebase] Self-test PASSED — Admin SDK can reach Firebase Auth');
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Firebase] Self-test FAILED — Admin SDK cannot reach Firebase Auth: ${msg}`);
    return { ok: false, error: msg };
  }
}

export interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase: {
    sign_in_provider: string;
  };
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedFirebaseToken | null> {
  if (!initializeFirebaseAdmin()) {
    throw new Error(initError || 'Firebase Admin SDK not initialized. Check your environment variables.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      phone_number: decodedToken.phone_number,
      name: decodedToken.name,
      picture: decodedToken.picture,
      firebase: {
        sign_in_provider: decodedToken.firebase?.sign_in_provider || 'unknown',
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Firebase] Token verification failed:', msg);
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getFirebaseInitError(): string | null {
  return initError;
}
