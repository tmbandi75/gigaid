import { db } from "../db";
import { bookingRequests, users, stripeWebhookEvents } from "@shared/schema";
import { eq, and, gte, lte, sql, ne, isNotNull } from "drizzle-orm";

export interface ReconciliationCounts {
  count: number;
  totalCents: number;
  items: Array<{ id: string; amountCents: number; status: string }>;
}

export interface SubscriptionCounts {
  count: number;
  items: Array<{ id: string; plan: string; subscriptionId: string | null }>;
}

export async function calculateExpectedDeposits(
  startDate: string,
  endDate: string
): Promise<ReconciliationCounts> {
  const rows = await db
    .select({
      id: bookingRequests.id,
      depositAmountCents: bookingRequests.depositAmountCents,
      depositStatus: bookingRequests.depositStatus,
    })
    .from(bookingRequests)
    .where(
      and(
        gte(bookingRequests.createdAt, startDate),
        lte(bookingRequests.createdAt, endDate),
        isNotNull(bookingRequests.depositAmountCents),
        ne(bookingRequests.depositStatus, "none")
      )
    );

  const items = rows
    .filter((r) => r.depositAmountCents && r.depositAmountCents > 0)
    .map((r) => ({
      id: r.id,
      amountCents: r.depositAmountCents!,
      status: r.depositStatus || "unknown",
    }));

  return {
    count: items.length,
    totalCents: items.reduce((sum, i) => sum + i.amountCents, 0),
    items,
  };
}

export async function calculateStripeCharges(
  startDate: string,
  endDate: string
): Promise<ReconciliationCounts> {
  const rows = await db
    .select({
      id: bookingRequests.id,
      depositAmountCents: bookingRequests.depositAmountCents,
      depositStatus: bookingRequests.depositStatus,
      stripePaymentIntentId: bookingRequests.stripePaymentIntentId,
    })
    .from(bookingRequests)
    .where(
      and(
        gte(bookingRequests.createdAt, startDate),
        lte(bookingRequests.createdAt, endDate),
        isNotNull(bookingRequests.stripePaymentIntentId),
        eq(bookingRequests.depositStatus, "captured")
      )
    );

  const items = rows.map((r) => ({
    id: r.id,
    amountCents: r.depositAmountCents || 0,
    status: "captured",
  }));

  return {
    count: items.length,
    totalCents: items.reduce((sum, i) => sum + i.amountCents, 0),
    items,
  };
}

export async function calculateExpectedTransfers(
  startDate: string,
  endDate: string
): Promise<ReconciliationCounts> {
  const rows = await db
    .select({
      id: bookingRequests.id,
      depositAmountCents: bookingRequests.depositAmountCents,
      depositStatus: bookingRequests.depositStatus,
    })
    .from(bookingRequests)
    .where(
      and(
        gte(bookingRequests.createdAt, startDate),
        lte(bookingRequests.createdAt, endDate),
        eq(bookingRequests.depositStatus, "captured"),
        isNotNull(bookingRequests.depositAmountCents)
      )
    );

  const items = rows
    .filter((r) => r.depositAmountCents && r.depositAmountCents > 0)
    .map((r) => ({
      id: r.id,
      amountCents: r.depositAmountCents!,
      status: "expected_transfer",
    }));

  return {
    count: items.length,
    totalCents: items.reduce((sum, i) => sum + i.amountCents, 0),
    items,
  };
}

export async function calculateStripeTransfers(
  startDate: string,
  endDate: string
): Promise<ReconciliationCounts> {
  const rows = await db
    .select({
      id: bookingRequests.id,
      depositAmountCents: bookingRequests.depositAmountCents,
      stripeTransferId: bookingRequests.stripeTransferId,
    })
    .from(bookingRequests)
    .where(
      and(
        gte(bookingRequests.createdAt, startDate),
        lte(bookingRequests.createdAt, endDate),
        isNotNull(bookingRequests.stripeTransferId)
      )
    );

  const items = rows.map((r) => ({
    id: r.id,
    amountCents: r.depositAmountCents || 0,
    status: "transferred",
  }));

  return {
    count: items.length,
    totalCents: items.reduce((sum, i) => sum + i.amountCents, 0),
    items,
  };
}

export async function calculateActiveSubscriptions(): Promise<SubscriptionCounts> {
  const rows = await db
    .select({
      id: users.id,
      plan: users.plan,
      stripeSubscriptionId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(isNotNull(users.stripeSubscriptionId));

  return {
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      plan: r.plan || "free",
      subscriptionId: r.stripeSubscriptionId,
    })),
  };
}

export async function calculateEntitledPaidUsers(): Promise<SubscriptionCounts> {
  const rows = await db
    .select({
      id: users.id,
      plan: users.plan,
      stripeSubscriptionId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(
      and(
        ne(users.plan, "free"),
        isNotNull(users.plan)
      )
    );

  return {
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      plan: r.plan || "free",
      subscriptionId: r.stripeSubscriptionId,
    })),
  };
}
