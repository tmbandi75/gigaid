import { Router, Request, Response } from 'express';
import { verifyFirebaseIdToken, isFirebaseConfigured, selfTestFirebaseAdmin, getFirebaseInitError } from './firebaseAdmin';
import { signAppJwt, isAppJwtConfigured } from './appJwt';
import { storage } from './storage';
import { eq, or } from 'drizzle-orm';
import { users } from '@shared/schema';
import { db } from './db';

const router = Router();

function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  return email.toLowerCase().trim();
}

interface MobileAuthResponse {
  token: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
    name?: string;
  };
  linkedBy?: 'email' | 'phone' | 'new_user';
}

router.post('/mobile/firebase', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken is required' });
    }

    if (!isFirebaseConfigured()) {
      return res.status(503).json({ 
        error: 'Firebase authentication is not configured. Please contact support.' 
      });
    }

    if (!isAppJwtConfigured()) {
      return res.status(503).json({ 
        error: 'Mobile authentication is not fully configured. Please contact support.' 
      });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired Firebase token' });
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email;
    const emailNormalized = normalizeEmail(email);
    const phoneE164 = decoded.phone_number;
    const name = decoded.name;
    const photo = decoded.picture;

    console.log('[MobileAuth] Processing Firebase auth, provider:', decoded.firebase.sign_in_provider);

    let existingUser = null;
    let linkedBy: 'email' | 'phone' | 'new_user' = 'new_user';

    const existingByFirebaseUid = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    if (existingByFirebaseUid.length > 0) {
      existingUser = existingByFirebaseUid[0];
      linkedBy = 'email';
      console.log('[MobileAuth] Found existing user by Firebase UID match');
    }

    if (!existingUser && emailNormalized) {
      const existingByEmail = await db
        .select()
        .from(users)
        .where(eq(users.emailNormalized, emailNormalized))
        .limit(1);
      
      if (existingByEmail.length > 0) {
        existingUser = existingByEmail[0];
        linkedBy = 'email';
        console.log('[MobileAuth] Linking Firebase to existing user by email match');
      }
    }

    if (!existingUser && phoneE164) {
      const existingByPhone = await db
        .select()
        .from(users)
        .where(eq(users.phoneE164, phoneE164))
        .limit(1);
      
      if (existingByPhone.length > 0) {
        existingUser = existingByPhone[0];
        linkedBy = 'phone';
        console.log('[MobileAuth] Linking Firebase to existing user by phone match');
      }
    }

    if (!existingUser && email) {
      const existingByRawEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingByRawEmail.length > 0) {
        existingUser = existingByRawEmail[0];
        linkedBy = 'email';
        console.log('[MobileAuth] Linking Firebase to existing user by raw email match');
      }
    }

    let userId: string;
    const now = new Date().toISOString();

    if (existingUser) {
      userId = existingUser.id;

      const updates: Record<string, any> = {
        updatedAt: now,
      };

      if (!existingUser.firebaseUid) {
        updates.firebaseUid = firebaseUid;
      }
      if (!existingUser.emailNormalized && emailNormalized) {
        updates.emailNormalized = emailNormalized;
      }
      if (!existingUser.email && email) {
        updates.email = email;
      }
      if (!existingUser.phoneE164 && phoneE164) {
        updates.phoneE164 = phoneE164;
      }
      if (!existingUser.phone && phoneE164) {
        updates.phone = phoneE164;
      }
      if (!existingUser.photo && photo) {
        updates.photo = photo;
      }
      if (!existingUser.name && name) {
        updates.name = name;
      }

      if (Object.keys(updates).length > 1) {
        await db.update(users).set(updates).where(eq(users.id, userId));
        console.log('[MobileAuth] Updated user with Firebase data:', updates);
      }
    } else {
      const username = emailNormalized || `firebase_${firebaseUid}`;
      
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: '',
          email,
          emailNormalized,
          phone: phoneE164,
          phoneE164,
          name,
          photo,
          firebaseUid,
          authProvider: 'firebase',
          createdAt: now,
          updatedAt: now,
          onboardingState: 'not_started',
        })
        .returning();

      userId = newUser.id;
      linkedBy = 'new_user';
      console.log('[MobileAuth] Created new user from Firebase:', userId);
    }

    const appToken = signAppJwt({
      sub: userId,
      provider: 'firebase',
      email_normalized: emailNormalized,
      firebase_uid: firebaseUid,
    });

    const response: MobileAuthResponse = {
      token: appToken,
      user: {
        id: userId,
        email,
        phone: phoneE164,
        name,
      },
      linkedBy,
    };

    console.log('[MobileAuth] Auth successful:', { userId, linkedBy });
    return res.json(response);
  } catch (error) {
    console.error('[MobileAuth] Error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

router.get('/mobile/status', (req: Request, res: Response) => {
  const firebaseReady = isFirebaseConfigured();
  const jwtReady = isAppJwtConfigured();
  
  res.json({
    firebaseConfigured: firebaseReady,
    jwtConfigured: jwtReady,
    mobileAuthReady: firebaseReady && jwtReady,
    supportedProviders: ['google', 'apple', 'email', 'phone'],
  });
});

// Web Firebase Auth endpoint - same logic as mobile but for web clients
router.post('/web/firebase', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken is required' });
    }

    if (!isFirebaseConfigured()) {
      return res.status(503).json({ 
        error: 'Firebase authentication is not configured. Please contact support.' 
      });
    }

    if (!isAppJwtConfigured()) {
      console.error('[WebAuth] APP_JWT_SECRET not configured');
      return res.status(503).json({ 
        error: 'Authentication is not fully configured. Please contact support.' 
      });
    }

    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch (verifyErr: any) {
      console.error('[WebAuth] Firebase token verification threw:', verifyErr?.message);
      return res.status(503).json({ 
        error: 'Authentication service error. Please try again or contact support.' 
      });
    }
    if (!decoded) {
      console.error('[WebAuth] Token verification returned null — token may be expired or malformed');
      return res.status(401).json({ error: 'Invalid or expired login session. Please try again.' });
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email;
    const emailNormalized = normalizeEmail(email);
    const phoneE164 = decoded.phone_number;
    const name = decoded.name;
    const photo = decoded.picture;

    console.log('[WebAuth] Processing Firebase auth, provider:', decoded.firebase.sign_in_provider);

    let existingUser = null;
    let linkedBy: 'email' | 'phone' | 'new_user' = 'new_user';

    // Check by Firebase UID first
    const existingByFirebaseUid = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    if (existingByFirebaseUid.length > 0) {
      existingUser = existingByFirebaseUid[0];
      linkedBy = 'email';
      console.log('[WebAuth] Found existing user by Firebase UID match');
    }

    // Check by normalized email
    if (!existingUser && emailNormalized) {
      const existingByEmail = await db
        .select()
        .from(users)
        .where(eq(users.emailNormalized, emailNormalized))
        .limit(1);
      
      if (existingByEmail.length > 0) {
        existingUser = existingByEmail[0];
        linkedBy = 'email';
        console.log('[WebAuth] Linking Firebase to existing user by email match');
      }
    }

    // Check by phone
    if (!existingUser && phoneE164) {
      const existingByPhone = await db
        .select()
        .from(users)
        .where(eq(users.phoneE164, phoneE164))
        .limit(1);
      
      if (existingByPhone.length > 0) {
        existingUser = existingByPhone[0];
        linkedBy = 'phone';
        console.log('[WebAuth] Linking Firebase to existing user by phone match');
      }
    }

    // Check by raw email as fallback
    if (!existingUser && email) {
      const existingByRawEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingByRawEmail.length > 0) {
        existingUser = existingByRawEmail[0];
        linkedBy = 'email';
        console.log('[WebAuth] Linking Firebase to existing user by raw email match');
      }
    }

    let userId: string;
    const now = new Date().toISOString();

    if (existingUser) {
      userId = existingUser.id;

      const updates: Record<string, any> = {
        updatedAt: now,
      };

      if (!existingUser.firebaseUid) {
        updates.firebaseUid = firebaseUid;
      }
      if (!existingUser.emailNormalized && emailNormalized) {
        updates.emailNormalized = emailNormalized;
      }
      if (!existingUser.email && email) {
        updates.email = email;
      }
      if (!existingUser.phoneE164 && phoneE164) {
        updates.phoneE164 = phoneE164;
      }
      if (!existingUser.phone && phoneE164) {
        updates.phone = phoneE164;
      }
      if (!existingUser.photo && photo) {
        updates.photo = photo;
      }
      if (!existingUser.name && name) {
        updates.name = name;
      }

      if (Object.keys(updates).length > 1) {
        await db.update(users).set(updates).where(eq(users.id, userId));
        console.log('[WebAuth] Updated user with Firebase data:', updates);
      }
    } else {
      // Create new user
      const username = emailNormalized || `firebase_${firebaseUid}`;
      
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: '',
          email,
          emailNormalized,
          phone: phoneE164,
          phoneE164,
          name,
          photo,
          firebaseUid,
          authProvider: 'firebase',
          createdAt: now,
          updatedAt: now,
          onboardingState: 'not_started',
        })
        .returning();

      userId = newUser.id;
      linkedBy = 'new_user';
      console.log('[WebAuth] Created new user from Firebase:', userId);
    }

    const appToken = signAppJwt({
      sub: userId,
      provider: 'firebase',
      email_normalized: emailNormalized,
      firebase_uid: firebaseUid,
    });

    const response: MobileAuthResponse = {
      token: appToken,
      user: {
        id: userId,
        email,
        phone: phoneE164,
        name,
      },
      linkedBy,
    };

    console.log('[WebAuth] Auth successful:', { userId, linkedBy });
    return res.json(response);
  } catch (error) {
    console.error('[WebAuth] Error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// Web auth status endpoint
router.get('/web/status', (req: Request, res: Response) => {
  const firebaseReady = isFirebaseConfigured();
  const jwtReady = isAppJwtConfigured();
  
  res.json({
    firebaseConfigured: firebaseReady,
    jwtConfigured: jwtReady,
    webAuthReady: firebaseReady && jwtReady,
    supportedProviders: ['google', 'apple', 'email'],
  });
});

router.get('/health', async (req: Request, res: Response) => {
  const firebaseConfigured = isFirebaseConfigured();
  const jwtConfigured = isAppJwtConfigured();
  const initError = getFirebaseInitError();

  let firebaseLive = false;
  let firebaseError: string | null = initError;

  if (firebaseConfigured && !initError) {
    const test = await selfTestFirebaseAdmin();
    firebaseLive = test.ok;
    if (!test.ok) firebaseError = test.error || 'Self-test failed';
  }

  const healthy = firebaseConfigured && jwtConfigured && firebaseLive;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    firebase: {
      configured: firebaseConfigured,
      live: firebaseLive,
      error: firebaseError,
    },
    jwt: {
      configured: jwtConfigured,
    },
  });
});

export default router;
