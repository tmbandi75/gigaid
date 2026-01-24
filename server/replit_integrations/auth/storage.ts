import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

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
    
    if (existingUser) {
      // Update existing user - only update auth-related fields
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          photo: userData.profileImageUrl,
          lastActiveAt: new Date().toISOString(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return user;
    }
    
    // Create new user with default plan = "free"
    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        username: userData.email || userData.id, // Use email as username, fallback to id
        password: "", // Empty password for OAuth users
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}` 
          : userData.firstName || userData.lastName || null,
        photo: userData.profileImageUrl,
        plan: "free", // Default plan for new users
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
