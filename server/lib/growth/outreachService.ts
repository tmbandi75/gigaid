import { db } from "../../db";
import { outreachQueue } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface CreateOutreachInput {
  platform: string;
  profileUrl: string;
  handleName?: string;
  city?: string;
  assignedToUserId?: string;
  notes?: string;
  nextFollowupAt?: string;
}

export async function createOutreachItem(input: CreateOutreachInput) {
  const [item] = await db
    .insert(outreachQueue)
    .values({
      platform: input.platform,
      profileUrl: input.profileUrl,
      handleName: input.handleName || null,
      city: input.city || null,
      assignedToUserId: input.assignedToUserId || null,
      notes: input.notes || null,
      nextFollowupAt: input.nextFollowupAt || null,
    })
    .returning();
  return item;
}

export async function updateOutreachItem(
  id: string,
  updates: {
    status?: string;
    assignedToUserId?: string;
    lastContactedAt?: string;
    nextFollowupAt?: string;
    notes?: string;
    handleName?: string;
    city?: string;
  }
) {
  const [updated] = await db
    .update(outreachQueue)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(outreachQueue.id, id))
    .returning();

  if (!updated) throw new Error("Outreach item not found");
  return updated;
}

export async function getOutreachItems(filters?: {
  status?: string;
  assignedToUserId?: string;
  limit?: number;
  offset?: number;
}) {
  let query = db.select().from(outreachQueue).$dynamic();

  if (filters?.status) {
    query = query.where(eq(outreachQueue.status, filters.status));
  }

  return query.limit(filters?.limit || 50).offset(filters?.offset || 0);
}

export async function deleteOutreachItem(id: string) {
  const [deleted] = await db
    .delete(outreachQueue)
    .where(eq(outreachQueue.id, id))
    .returning();
  return !!deleted;
}
