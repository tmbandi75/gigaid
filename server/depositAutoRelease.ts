import { storage } from "./storage";
import { logger } from "./lib/logger";
import { safePriceCentsExact } from "@shared/safePrice";

async function releaseDeposit(bookingId: string) {
  try {
    const booking = await storage.getBookingRequest(bookingId);
    if (!booking) {
      logger.info(`[AutoRelease] Booking ${bookingId} not found`);
      return;
    }

    if (booking.depositStatus !== "captured" || !booking.stripeChargeId) {
      logger.info(`[AutoRelease] Booking ${bookingId} has no captured deposit`);
      return;
    }

    const provider = await storage.getUser(booking.userId);
    if (!provider?.stripeConnectAccountId) {
      logger.info(`[AutoRelease] Provider for booking ${bookingId} has no Connect account`);
      return;
    }

    const { getUncachableStripeClient } = await import("./stripeClient");
    const stripe = await getUncachableStripeClient();

    const releaseAmount = booking.rolledAmountCents || booking.depositAmountCents || 0;
    if (releaseAmount <= 0) {
      logger.info(`[AutoRelease] No amount to release for booking ${bookingId}`);
      await storage.updateBookingRequest(bookingId, {
        completionStatus: "completed",
        depositStatus: "released",
      });
      return;
    }

    const transfer = await stripe.transfers.create({
      amount: releaseAmount,
      currency: booking.depositCurrency || "usd",
      destination: provider.stripeConnectAccountId,
      transfer_group: `booking_${booking.id}`,
      metadata: {
        booking_id: booking.id,
        type: "auto_release_36h",
      },
    });

    await storage.updateBookingRequest(bookingId, {
      completionStatus: "completed",
      depositStatus: "released",
      stripeTransferId: transfer.id,
    });

    await storage.createBookingEvent({
      bookingId,
      eventType: "deposit_auto_released",
      actorType: "system",
      actorId: null,
      metadata: JSON.stringify({
        amount: releaseAmount,
        transferId: transfer.id,
        trigger: "36h_auto_release",
      }),
    });

    logger.info(`[AutoRelease] Released deposit for booking ${bookingId}: ${safePriceCentsExact(releaseAmount)}`);
  } catch (error) {
    logger.error(`[AutoRelease] Failed to release deposit for booking ${bookingId}:`, error);
  }
}

async function checkForAutoRelease() {
  try {
    const bookingsToRelease = await storage.getBookingRequestsAwaitingRelease();
    
    if (bookingsToRelease.length > 0) {
      logger.info(`[AutoRelease] Found ${bookingsToRelease.length} bookings ready for auto-release`);
    }

    for (const booking of bookingsToRelease) {
      await releaseDeposit(booking.id);
    }
  } catch (error) {
    logger.error("[AutoRelease] Error checking for auto-release:", error);
  }
}

export function startAutoReleaseScheduler() {
  logger.info("[AutoRelease] Starting deposit auto-release scheduler (checks every 5 minutes)");
  checkForAutoRelease();
  setInterval(checkForAutoRelease, 5 * 60 * 1000);
}
