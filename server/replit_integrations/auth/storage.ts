import { users, jobs, leads, invoices, aiNudges, nextActions, type User, type InsertUser } from "@shared/schema";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

// Auth user data from OIDC claims
interface AuthUserData {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(userData: AuthUserData): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: AuthUserData): Promise<User> {
    // Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.id, userData.id));
    
    // Normalize email for account linking
    const emailNormalized = userData.email 
      ? userData.email.toLowerCase().trim() 
      : null;
    
    if (existingUser) {
      if (existingUser.deletedAt) {
        logger.warn("[AuthStorage] Blocked Replit upsert for deleted account:", existingUser.id);
        throw new Error("ACCOUNT_DELETED");
      }
      // Update existing user - only update auth-related fields
      // Also populate emailNormalized for account linking with Firebase mobile auth
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          emailNormalized: emailNormalized || existingUser.emailNormalized,
          firstName: userData.firstName,
          lastName: userData.lastName,
          photo: userData.profileImageUrl,
          authProvider: existingUser.authProvider || 'replit',
          lastActiveAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return user;
    }
    
    // Create new user with default plan = "free"
    const now = new Date().toISOString();
    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        username: userData.email || userData.id, // Use email as username, fallback to id
        password: "", // Empty password for OAuth users
        email: userData.email,
        emailNormalized: emailNormalized,
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}` 
          : userData.firstName || userData.lastName || null,
        photo: userData.profileImageUrl,
        authProvider: 'replit',
        plan: "free", // Default plan for new users
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      })
      .returning();
    
    // Transfer demo data to the new user if demo-user exists
    await this.transferDemoData(userData.id);
    
    return user;
  }
  
  // Transfer demo data from demo-user to a new user
  private async transferDemoData(newUserId: string): Promise<void> {
    try {
      // Check if demo-user exists
      const [demoUser] = await db.select().from(users).where(eq(users.id, 'demo-user'));
      if (!demoUser) {
        logger.debug('[Auth] No demo-user found, skipping demo data transfer');
        return;
      }
      
      // Transfer jobs
      await db.update(jobs).set({ userId: newUserId }).where(eq(jobs.userId, 'demo-user'));
      logger.debug('[Auth] Transferred jobs to new user');
      
      // Transfer leads
      await db.update(leads).set({ userId: newUserId }).where(eq(leads.userId, 'demo-user'));
      logger.debug('[Auth] Transferred leads to new user');
      
      // Transfer invoices
      await db.update(invoices).set({ userId: newUserId }).where(eq(invoices.userId, 'demo-user'));
      logger.debug('[Auth] Transferred invoices to new user');
      
      // Transfer AI nudges
      await db.update(aiNudges).set({ userId: newUserId }).where(eq(aiNudges.userId, 'demo-user'));
      logger.debug('[Auth] Transferred AI nudges to new user');
      
      // Transfer next best actions
      await db.update(nextActions).set({ userId: newUserId }).where(eq(nextActions.userId, 'demo-user'));
      logger.debug('[Auth] Transferred next best actions to new user');
      
      // Update any other tables with user_id referencing demo-user
      // Using raw SQL for tables that may not be imported
      await db.execute(sql`UPDATE crew_members SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE onboarding SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE reminders SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE sms_messages SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE referrals SET referrer_user_id = ${newUserId} WHERE referrer_user_id = 'demo-user'`);
      await db.execute(sql`UPDATE user_service_types SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE user_availability SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE location_trackings SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE provider_photos SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE stall_detection SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE outcome_attributions SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE intent_signals SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      await db.execute(sql`UPDATE voice_notes SET user_id = ${newUserId} WHERE user_id = 'demo-user'`);
      
      logger.debug('[Auth] Demo data transfer complete for user:', newUserId);
      
      // Delete the demo-user after transfer
      await db.delete(users).where(eq(users.id, 'demo-user'));
      logger.debug('[Auth] Deleted demo-user account');
    } catch (error) {
      logger.error('[Auth] Error transferring demo data:', error);
      // Don't throw - user creation should still succeed even if demo data transfer fails
    }
  }
}

export const authStorage = new AuthStorage();
