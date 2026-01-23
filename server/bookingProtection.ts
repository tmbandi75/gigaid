import { db } from "./db";
import { 
  clients, 
  bookingProtections, 
  aiInterventions, 
  users,
  type Client,
  type BookingProtection,
} from "@shared/schema";
import { eq, and, or, gte, sql } from "drizzle-orm";

const DEFAULT_DEPOSIT_PERCENT = 25;
const DEFAULT_PRICE_THRESHOLD_CENTS = 10000;
const SHORT_LEAD_TIME_HOURS = 24;

interface BookingRiskAssessment {
  isHigherRisk: boolean;
  isFirstTimeClient: boolean;
  isShortLeadTime: boolean;
  isHighPrice: boolean;
  hasPriorCancellation: boolean;
  clientCancellationCount: number;
  suggestedDepositPercent: number;
}

export async function findOrCreateClient(
  userId: string,
  clientName: string,
  clientPhone?: string | null,
  clientEmail?: string | null
): Promise<Client> {
  const normalizedPhone = clientPhone?.replace(/\D/g, '') || null;
  const normalizedEmail = clientEmail?.toLowerCase().trim() || null;

  let existingClient: Client | undefined;

  if (normalizedPhone || normalizedEmail) {
    const conditions = [];
    if (normalizedPhone) {
      conditions.push(eq(clients.clientPhone, normalizedPhone));
    }
    if (normalizedEmail) {
      conditions.push(eq(clients.clientEmail, normalizedEmail));
    }

    const results = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.userId, userId),
        or(...conditions)
      ))
      .limit(1);
    
    existingClient = results[0];
  }

  if (existingClient) {
    return existingClient;
  }

  const [created] = await db.insert(clients).values({
    userId,
    clientName,
    clientPhone: normalizedPhone,
    clientEmail: normalizedEmail,
    isFirstTime: true,
    cancellationCount: 0,
    noShowCount: 0,
    totalBookings: 0,
    lastBookingAt: null,
    createdAt: new Date().toISOString(),
  }).returning();
  return created;
}

export async function assessBookingRisk(
  userId: string,
  bookingPrice: number | null,
  scheduledDate: string,
  scheduledTime: string,
  clientId?: string
): Promise<BookingRiskAssessment> {
  const now = new Date();
  const bookingDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
  const leadTimeHours = Math.max(0, (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60));

  let clientRecord: Client | undefined;
  if (clientId) {
    const results = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    clientRecord = results[0];
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const priceThreshold = user[0]?.noShowProtectionPriceThreshold ?? DEFAULT_PRICE_THRESHOLD_CENTS;
  const depositPercent = user[0]?.noShowProtectionDepositPercent ?? DEFAULT_DEPOSIT_PERCENT;

  const isFirstTimeClient = clientRecord?.isFirstTime ?? true;
  const isShortLeadTime = leadTimeHours < SHORT_LEAD_TIME_HOURS;
  const isHighPrice = bookingPrice !== null && bookingPrice >= priceThreshold;
  const hasPriorCancellation = (clientRecord?.cancellationCount ?? 0) >= 1 || (clientRecord?.noShowCount ?? 0) >= 1;
  const clientCancellationCount = (clientRecord?.cancellationCount ?? 0) + (clientRecord?.noShowCount ?? 0);

  const isHigherRisk = isFirstTimeClient || isShortLeadTime || isHighPrice || hasPriorCancellation;

  return {
    isHigherRisk,
    isFirstTimeClient,
    isShortLeadTime,
    isHighPrice,
    hasPriorCancellation,
    clientCancellationCount,
    suggestedDepositPercent: depositPercent,
  };
}

export async function createBookingProtection(
  jobId: string,
  userId: string,
  clientId: string | null,
  riskAssessment: BookingRiskAssessment,
  bookingPrice: number | null,
  bookingLeadTimeHours: number
): Promise<BookingProtection> {
  const depositAmountCents = riskAssessment.isHigherRisk && bookingPrice
    ? Math.round(bookingPrice * (riskAssessment.suggestedDepositPercent / 100))
    : null;

  const [created] = await db.insert(bookingProtections).values({
    jobId,
    userId,
    clientId,
    isFirstTimeClient: riskAssessment.isFirstTimeClient,
    bookingLeadTimeHours: Math.round(bookingLeadTimeHours),
    bookingPrice,
    clientCancellationCount: riskAssessment.clientCancellationCount,
    isProtected: riskAssessment.isHigherRisk,
    depositRequired: riskAssessment.isHigherRisk,
    depositAmountCents,
    depositPaidAt: null,
    stripePaymentIntentId: null,
    cancellationPolicyAcknowledgedAt: null,
    phoneVerifiedAt: null,
    createdAt: new Date().toISOString(),
  }).returning();
  return created;
}

export async function recordClientCancellation(
  userId: string,
  clientId: string
): Promise<void> {
  await db
    .update(clients)
    .set({
      cancellationCount: sql`${clients.cancellationCount} + 1`,
    })
    .where(and(
      eq(clients.id, clientId),
      eq(clients.userId, userId)
    ));
}

export async function recordClientNoShow(
  userId: string,
  clientId: string
): Promise<void> {
  await db
    .update(clients)
    .set({
      noShowCount: sql`${clients.noShowCount} + 1`,
    })
    .where(and(
      eq(clients.id, clientId),
      eq(clients.userId, userId)
    ));
}

export async function markClientAsReturning(
  userId: string,
  clientId: string
): Promise<void> {
  await db
    .update(clients)
    .set({
      isFirstTime: false,
      totalBookings: sql`${clients.totalBookings} + 1`,
      lastBookingAt: new Date().toISOString(),
    })
    .where(and(
      eq(clients.id, clientId),
      eq(clients.userId, userId)
    ));
}

export async function canShowInterventionToday(userId: string): Promise<boolean> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaysInterventions = await db
    .select()
    .from(aiInterventions)
    .where(and(
      eq(aiInterventions.userId, userId),
      eq(aiInterventions.isSilent, false),
      gte(aiInterventions.createdAt, startOfToday.toISOString())
    ))
    .limit(1);

  return todaysInterventions.length === 0;
}

interface InterventionResult {
  shouldIntervene: boolean;
  message?: string;
  interventionType?: "risk_protection" | "revenue_risk";
}

export async function checkForIntervention(
  userId: string,
  entityType: string,
  entityId: string,
  context: {
    clientCancellationCount?: number;
    leadAge?: number;
    suggestedPrice?: number;
    actualPrice?: number;
  }
): Promise<InterventionResult> {
  const canShow = await canShowInterventionToday(userId);
  if (!canShow) {
    return { shouldIntervene: false };
  }

  if (context.clientCancellationCount && context.clientCancellationCount >= 2) {
    return {
      shouldIntervene: true,
      message: "This client often cancels. A deposit is now required.",
      interventionType: "risk_protection",
    };
  }

  if (entityType === "lead" && context.leadAge && context.leadAge >= 24 && context.leadAge <= 48) {
    return {
      shouldIntervene: true,
      message: "This lead converts best if replied to soon.",
      interventionType: "revenue_risk",
    };
  }

  // Underpricing intervention - only trigger if price is significantly below suggested
  if (context.suggestedPrice && context.actualPrice && 
      context.actualPrice < context.suggestedPrice * 0.7) {
    return {
      shouldIntervene: true,
      message: "You may be underpricing this service in this area.",
      interventionType: "revenue_risk",
    };
  }

  return { shouldIntervene: false };
}

export async function recordIntervention(
  userId: string,
  interventionType: string,
  entityType: string | null,
  entityId: string | null,
  message: string | null,
  isSilent: boolean = false
): Promise<void> {
  await db.insert(aiInterventions).values({
    userId,
    interventionType,
    entityType,
    entityId,
    message,
    isSilent,
    displayedAt: isSilent ? null : new Date().toISOString(),
    dismissedAt: null,
    actionTaken: null,
    createdAt: new Date().toISOString(),
  });
}

export async function getBookingProtection(jobId: string): Promise<BookingProtection | null> {
  const results = await db
    .select()
    .from(bookingProtections)
    .where(eq(bookingProtections.jobId, jobId))
    .limit(1);
  
  return results[0] || null;
}

export async function markDepositPaid(
  jobId: string,
  stripePaymentIntentId: string
): Promise<void> {
  await db
    .update(bookingProtections)
    .set({
      depositPaidAt: new Date().toISOString(),
      stripePaymentIntentId,
    })
    .where(eq(bookingProtections.jobId, jobId));
}

export async function markPolicyAcknowledged(jobId: string): Promise<void> {
  await db
    .update(bookingProtections)
    .set({
      cancellationPolicyAcknowledgedAt: new Date().toISOString(),
    })
    .where(eq(bookingProtections.jobId, jobId));
}
