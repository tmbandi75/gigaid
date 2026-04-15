import { Router, Request, Response } from 'express';
import { verifyFirebaseIdToken, isFirebaseConfigured, selfTestFirebaseAdmin, getFirebaseInitError } from './firebaseAdmin';
import { signAppJwt, isAppJwtConfigured } from './appJwt';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import { users } from '@shared/schema';
import { db } from './db';
import { logger } from "./lib/logger";

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

function isDeletedUser(user: any): boolean {
  return Boolean(user?.deletedAt);
}

/** Catches legacy rows where firebase_uid was cleared but email/phone still match a deleted account. */
async function hasDeletedIdentityConflict(
  firebaseUid: string,
  emailNormalized: string | undefined,
  phoneE164: string | undefined,
  email: string | undefined,
): Promise<boolean> {
  const clauses = [eq(users.firebaseUid, firebaseUid)];
  if (emailNormalized) clauses.push(eq(users.emailNormalized, emailNormalized));
  if (phoneE164) clauses.push(eq(users.phoneE164, phoneE164));
  if (email) clauses.push(eq(users.email, email));

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNotNull(users.deletedAt), or(...clauses)))
    .limit(1);
  if (row) {
    logger.warn("[AccountDeleteFlow] step=firebase_exchange_blocked_tombstone", {
      tombstoneUserId: row.id,
      hadEmail: !!emailNormalized,
      hadPhone: !!phoneE164,
    });
  }
  return !!row;
}

/**
 * Reactivating a soft-deleted row via Firebase is OFF by default in every environment.
 * Set GIGAID_ALLOW_DELETED_FIREBASE_REACTIVATION=true only when you intentionally need it (e.g. staging or local testing).
 */
function isSoftDeleteFirebaseReactivationEnabled(): boolean {
  return process.env.GIGAID_ALLOW_DELETED_FIREBASE_REACTIVATION === "true";
}

function reactivateSoftDeletedUserPatch(
  row: { id: string; username: string },
  firebaseUid: string,
  email: string | undefined,
  emailNormalized: string | undefined,
  phoneE164: string | undefined,
  name: string | undefined,
  photo: string | undefined,
  now: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    deletedAt: null,
    updatedAt: now,
    firebaseUid,
    authProvider: "firebase",
  };
  if (email) {
    patch.email = email;
  }
  if (emailNormalized) {
    patch.emailNormalized = emailNormalized;
  }
  if (emailNormalized && row.username.startsWith("deleted_")) {
    patch.username = emailNormalized;
  }
  if (phoneE164) {
    patch.phoneE164 = phoneE164;
    patch.phone = phoneE164;
  }
  if (photo) {
    patch.photo = photo;
  }
  if (name) {
    patch.name = name;
  }
  return patch;
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

    logger.info('[MobileAuth] Processing Firebase auth, provider:', decoded.firebase.sign_in_provider);

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
      logger.info('[MobileAuth] Found existing user by Firebase UID match');
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
        logger.info('[MobileAuth] Linking Firebase to existing user by email match');
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
        logger.info('[MobileAuth] Linking Firebase to existing user by phone match');
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
        logger.info('[MobileAuth] Linking Firebase to existing user by raw email match');
      }
    }

    // Legacy rows may use email as username while email_normalized (or email) was never backfilled.
    if (!existingUser && emailNormalized) {
      const existingByUsername = await db
        .select()
        .from(users)
        .where(eq(users.username, emailNormalized))
        .limit(1);

      if (existingByUsername.length > 0) {
        existingUser = existingByUsername[0];
        linkedBy = 'email';
        logger.info('[MobileAuth] Linking Firebase to existing user by username match');
      }
    }

    let userId: string;
    const now = new Date().toISOString();

    if (existingUser) {
      if (isDeletedUser(existingUser)) {
        if (!isSoftDeleteFirebaseReactivationEnabled()) {
          logger.info("[MobileAuth] Blocked login for deleted account:", { userId: existingUser.id });
          return res.status(403).json({
            error: "This account was deleted and cannot be used to sign in.",
            code: "account_deleted",
          });
        }
        const rePatch = reactivateSoftDeletedUserPatch(
          { id: existingUser.id, username: existingUser.username },
          firebaseUid,
          email,
          emailNormalized,
          phoneE164,
          name,
          photo,
          now,
        );
        await db.update(users).set(rePatch).where(eq(users.id, existingUser.id));
        logger.warn("[MobileAuth] Reactivated soft-deleted user (GIGAID_ALLOW_DELETED_FIREBASE_REACTIVATION)", {
          userId: existingUser.id,
        });
        Object.assign(existingUser, rePatch);
      }

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
        logger.info('[MobileAuth] Updated user with Firebase data:', updates);
      }
    } else {
      if (await hasDeletedIdentityConflict(firebaseUid, emailNormalized, phoneE164, email)) {
        logger.info("[MobileAuth] Blocked signup — identity matches a deleted account");
        return res.status(403).json({
          error: "This account was deleted and cannot be used to sign in.",
          code: "account_deleted",
        });
      }

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
      logger.info('[MobileAuth] Created new user from Firebase:', userId);
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

    logger.info('[MobileAuth] Auth successful:', { userId, linkedBy });
    return res.json(response);
  } catch (error: unknown) {
    const pgCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[MobileAuth] Error:", pgCode || "(no pg code)", message, error);
    return res.status(500).json({ error: "Internal server error during authentication" });
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
      logger.error('[WebAuth] APP_JWT_SECRET not configured');
      return res.status(503).json({ 
        error: 'Authentication is not fully configured. Please contact support.' 
      });
    }

    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch (verifyErr: any) {
      logger.error('[WebAuth] Firebase token verification threw:', verifyErr?.message);
      return res.status(503).json({ 
        error: 'Authentication service error. Please try again or contact support.' 
      });
    }
    if (!decoded) {
      logger.error('[WebAuth] Token verification returned null — token may be expired or malformed');
      return res.status(401).json({ error: 'Invalid or expired login session. Please try again.' });
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email;
    const emailNormalized = normalizeEmail(email);
    const phoneE164 = decoded.phone_number;
    const name = decoded.name;
    const photo = decoded.picture;

    logger.info('[WebAuth] Processing Firebase auth, provider:', decoded.firebase.sign_in_provider);

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
      logger.info('[WebAuth] Found existing user by Firebase UID match');
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
        logger.info('[WebAuth] Linking Firebase to existing user by email match');
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
        logger.info('[WebAuth] Linking Firebase to existing user by phone match');
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
        logger.info('[WebAuth] Linking Firebase to existing user by raw email match');
      }
    }

    if (!existingUser && emailNormalized) {
      const existingByUsername = await db
        .select()
        .from(users)
        .where(eq(users.username, emailNormalized))
        .limit(1);

      if (existingByUsername.length > 0) {
        existingUser = existingByUsername[0];
        linkedBy = 'email';
        logger.info('[WebAuth] Linking Firebase to existing user by username match');
      }
    }

    let userId: string;
    const now = new Date().toISOString();

    if (existingUser) {
      if (isDeletedUser(existingUser)) {
        if (!isSoftDeleteFirebaseReactivationEnabled()) {
          logger.info("[WebAuth] Blocked login for deleted account:", { userId: existingUser.id });
          return res.status(403).json({
            error: "This account was deleted and cannot be used to sign in.",
            code: "account_deleted",
          });
        }
        const rePatch = reactivateSoftDeletedUserPatch(
          { id: existingUser.id, username: existingUser.username },
          firebaseUid,
          email,
          emailNormalized,
          phoneE164,
          name,
          photo,
          now,
        );
        await db.update(users).set(rePatch).where(eq(users.id, existingUser.id));
        logger.warn("[WebAuth] Reactivated soft-deleted user (GIGAID_ALLOW_DELETED_FIREBASE_REACTIVATION)", {
          userId: existingUser.id,
        });
        Object.assign(existingUser, rePatch);
      }

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
        logger.info('[WebAuth] Updated user with Firebase data:', updates);
      }
    } else {
      if (await hasDeletedIdentityConflict(firebaseUid, emailNormalized, phoneE164, email)) {
        logger.info("[WebAuth] Blocked signup — identity matches a deleted account");
        return res.status(403).json({
          error: "This account was deleted and cannot be used to sign in.",
          code: "account_deleted",
        });
      }

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
      logger.info('[WebAuth] Created new user from Firebase:', userId);
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

    logger.info('[WebAuth] Auth successful:', { userId, linkedBy });
    return res.json(response);
  } catch (error: unknown) {
    const pgCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[WebAuth] Error:", pgCode || "(no pg code)", message, error);
    return res.status(500).json({ error: "Internal server error during authentication" });
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
