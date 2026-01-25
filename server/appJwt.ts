import jwt from 'jsonwebtoken';

const JWT_ISSUER = process.env.APP_JWT_ISSUER || 'gigaid';
const JWT_EXPIRY = '30d';

function getJwtSecret(): string | null {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) {
    return null;
  }
  return secret;
}

export interface AppJwtPayload {
  sub: string;
  provider: 'replit' | 'firebase';
  email_normalized?: string;
  firebase_uid?: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

export function signAppJwt(payload: Omit<AppJwtPayload, 'iat' | 'exp' | 'iss'>): string {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('APP_JWT_SECRET is not configured. Cannot sign tokens.');
  }
  return jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRY,
    issuer: JWT_ISSUER,
  });
}

export function verifyAppJwt(token: string): AppJwtPayload | null {
  const secret = getJwtSecret();
  if (!secret) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: JWT_ISSUER,
    }) as AppJwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function isAppJwtConfigured(): boolean {
  return !!process.env.APP_JWT_SECRET;
}
