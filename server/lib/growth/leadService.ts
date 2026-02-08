import { db } from "../../db";
import { growthLeads, onboardingCalls, users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface CreateLeadInput {
  name: string;
  businessName?: string;
  email?: string;
  phone?: string;
  serviceCategory?: string;
  city?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrerCode?: string;
}

export async function createGrowthLead(input: CreateLeadInput) {
  let referrerUserId: string | null = null;

  if (input.referrerCode) {
    const [referrer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, input.referrerCode))
      .limit(1);
    if (referrer) {
      referrerUserId = referrer.id;
    }
  }

  const [lead] = await db
    .insert(growthLeads)
    .values({
      name: input.name,
      businessName: input.businessName || null,
      email: input.email || null,
      phone: input.phone || null,
      serviceCategory: input.serviceCategory || null,
      city: input.city || null,
      source: input.source || "homepage",
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      utmContent: input.utmContent || null,
      utmTerm: input.utmTerm || null,
      referrerUserId,
    })
    .returning();

  return lead;
}

export async function bookCall(leadId: string, scheduledAt: string) {
  const [lead] = await db
    .select()
    .from(growthLeads)
    .where(eq(growthLeads.id, leadId))
    .limit(1);

  if (!lead) {
    throw new Error("Lead not found");
  }

  const [call] = await db
    .insert(onboardingCalls)
    .values({
      leadId,
      scheduledAt,
      outcome: "scheduled",
    })
    .returning();

  await db
    .update(growthLeads)
    .set({
      status: "booked",
      bookedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(growthLeads.id, leadId));

  return call;
}

export async function convertLead(leadId: string, userId?: string) {
  const [lead] = await db
    .select()
    .from(growthLeads)
    .where(eq(growthLeads.id, leadId))
    .limit(1);

  if (!lead) {
    throw new Error("Lead not found");
  }

  if (lead.status === "converted") {
    throw new Error("Lead already converted");
  }

  let convertedUserId = userId || null;

  await db
    .update(growthLeads)
    .set({
      status: "converted",
      convertedUserId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(growthLeads.id, leadId));

  const updatedCalls = await db
    .update(onboardingCalls)
    .set({ outcome: "converted" })
    .where(eq(onboardingCalls.leadId, leadId))
    .returning();

  return { leadId, convertedUserId, callsUpdated: updatedCalls.length };
}

export async function updateCallOutcome(
  callId: string,
  outcome: string,
  completedAt?: string
) {
  const updates: Record<string, any> = { outcome };
  if (completedAt || outcome === "completed") {
    updates.completedAt = completedAt || new Date().toISOString();
  }

  const [updated] = await db
    .update(onboardingCalls)
    .set(updates)
    .where(eq(onboardingCalls.id, callId))
    .returning();

  if (!updated) {
    throw new Error("Call not found");
  }

  if (outcome === "no_show") {
    await db
      .update(growthLeads)
      .set({ status: "no_show", updatedAt: new Date().toISOString() })
      .where(eq(growthLeads.id, updated.leadId));
  } else if (outcome === "completed") {
    await db
      .update(growthLeads)
      .set({ status: "completed", updatedAt: new Date().toISOString() })
      .where(eq(growthLeads.id, updated.leadId));
  }

  return updated;
}

export async function getLeads(filters?: {
  status?: string;
  source?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(growthLeads.status, filters.status));
  }
  if (filters?.source) {
    conditions.push(eq(growthLeads.source, filters.source));
  }

  let query = db.select().from(growthLeads).$dynamic();
  if (conditions.length > 0) {
    const { and } = await import("drizzle-orm");
    query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const results = await query.limit(filters?.limit || 50).offset(filters?.offset || 0);
  return results;
}

export async function getLeadById(id: string) {
  const [lead] = await db.select().from(growthLeads).where(eq(growthLeads.id, id)).limit(1);
  return lead || null;
}

export async function updateLeadNotes(id: string, notes: string) {
  const [updated] = await db
    .update(growthLeads)
    .set({ notes, updatedAt: new Date().toISOString() })
    .where(eq(growthLeads.id, id))
    .returning();
  return updated;
}
