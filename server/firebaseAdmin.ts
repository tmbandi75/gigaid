import admin from 'firebase-admin';

let firebaseInitialized = false;

function initializeFirebaseAdmin(): boolean {
  if (firebaseInitialized) {
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[Firebase] Missing Firebase credentials. Mobile auth will not work.');
    console.warn('[Firebase] Required env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    firebaseInitialized = true;
    console.log('[Firebase] Admin SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('[Firebase] Failed to initialize Admin SDK:', error);
    return false;
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
    throw new Error('Firebase Admin SDK not initialized. Check your environment variables.');
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
    console.error('[Firebase] Token verification failed:', error);
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
