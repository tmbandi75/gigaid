import { storage } from "./storage";

async function releaseDeposit(bookingId: string) {
  try {
    const booking = await storage.getBookingRequest(bookingId);
    if (!booking) {
      console.log(`[AutoRelease] Booking ${bookingId} not found`);
      return;
    }

    if (booking.depositStatus !== "captured" || !booking.stripeChargeId) {
      console.log(`[AutoRelease] Booking ${bookingId} has no captured deposit`);
      return;
    }

    const provider = await storage.getUser(booking.userId);
    if (!provider?.stripeConnectAccountId) {
      console.log(`[AutoRelease] Provider for booking ${bookingId} has no Connect account`);
      return;
    }

    const { getUncachableStripeClient } = await import("./stripeClient");
    const stripe = await getUncachableStripeClient();

    const releaseAmount = booking.rolledAmountCents || booking.depositAmountCents || 0;
    if (releaseAmount <= 0) {
      console.log(`[AutoRelease] No amount to release for booking ${bookingId}`);
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

    console.log(`[AutoRelease] Released deposit for booking ${bookingId}: $${(releaseAmount / 100).toFixed(2)}`);
  } catch (error) {
    console.error(`[AutoRelease] Failed to release deposit for booking ${bookingId}:`, error);
  }
}

async function checkForAutoRelease() {
  try {
    const bookingsToRelease = await storage.getBookingRequestsAwaitingRelease();
    
    if (bookingsToRelease.length > 0) {
      console.log(`[AutoRelease] Found ${bookingsToRelease.length} bookings ready for auto-release`);
    }

    for (const booking of bookingsToRelease) {
      await releaseDeposit(booking.id);
    }
  } catch (error) {
    console.error("[AutoRelease] Error checking for auto-release:", error);
  }
}

export function startAutoReleaseScheduler() {
  console.log("[AutoRelease] Starting deposit auto-release scheduler (checks every 5 minutes)");
  checkForAutoRelease();
  setInterval(checkForAutoRelease, 5 * 60 * 1000);
}
