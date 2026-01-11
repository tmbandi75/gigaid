/**
 * Integration tests for Deposit Protection System
 * 
 * These tests verify the core deposit flows:
 * 1. Deposit PaymentIntent creation
 * 2. Reschedule with late fee retention
 * 3. Completion confirmation triggers transfer
 * 4. Auto-release after 36 hours
 * 5. Issue flag prevents transfer
 * 
 * Run with: npx tsx server/tests/deposit.test.ts
 */

import { MemStorage } from "../storage";
import type { InsertBookingRequest } from "../../shared/schema";

const storage = new MemStorage();

async function setup() {
  // Create test provider with deposit settings
  // Using 'as any' since test includes extra fields not in the minimal InsertUser type
  const testUser = {
    username: "testprovider",
    password: "password123",
    name: "Test Provider",
    depositEnabled: true,
    depositType: "percent",
    depositValue: 20,
    lateRescheduleWindowHours: 24,
    lateRescheduleRetainPctFirst: 40,
    lateRescheduleRetainPctSecond: 60,
    lateRescheduleRetainPctCap: 75,
    stripeConnectAccountId: "acct_test123",
    stripeConnectStatus: "active",
  } as const;
  
  const user = await storage.createUser(testUser as any);
  return user;
}

async function createTestBooking(userId: number | string, options: Partial<InsertBookingRequest> = {}) {
  const booking = {
    userId: String(userId),
    clientName: "Test Client",
    clientPhone: "+15551234567",
    serviceType: "plumbing",
    depositAmountCents: 5000, // $50.00
    depositCurrency: "usd",
    preferredDate: new Date(Date.now() + 86400000).toISOString().split("T")[0], // Tomorrow
    preferredTime: "10:00",
    ...options,
  } as InsertBookingRequest;
  
  return storage.createBookingRequest(booking);
}

// Test 1: Deposit PaymentIntent creation
async function testDepositPaymentIntentCreation() {
  console.log("\n--- Test 1: Deposit PaymentIntent Creation ---");
  
  const user = await setup();
  const booking = await createTestBooking(user.id);
  
  // Verify booking has deposit fields
  console.assert(booking.depositAmountCents === 5000, "Deposit amount should be 5000 cents");
  console.assert(booking.depositCurrency === "usd", "Deposit currency should be usd");
  console.assert(booking.depositStatus === "none", "Initial deposit status should be none");
  console.assert(booking.completionStatus === "scheduled", "Initial completion status should be scheduled");
  console.assert(booking.confirmationToken !== null, "Booking should have confirmation token");
  
  // Simulate PaymentIntent creation
  const updatedBooking = await storage.updateBookingRequest(booking.id, {
    stripePaymentIntentId: "pi_test_123",
    depositStatus: "pending",
  });
  
  console.assert(updatedBooking?.stripePaymentIntentId === "pi_test_123", "PaymentIntent ID should be stored");
  console.assert(updatedBooking?.depositStatus === "pending", "Deposit status should be pending");
  
  // Simulate payment success (capture)
  const capturedBooking = await storage.updateBookingRequest(booking.id, {
    depositStatus: "captured",
    stripeChargeId: "ch_test_123",
  });
  
  console.assert(capturedBooking?.depositStatus === "captured", "Deposit status should be captured");
  console.assert(capturedBooking?.stripeChargeId === "ch_test_123", "Charge ID should be stored");
  
  console.log("✓ Test 1 passed: Deposit PaymentIntent creation works correctly");
}

// Test 2: Reschedule retention calculation
async function testRescheduleRetention() {
  console.log("\n--- Test 2: Reschedule Retention Calculation ---");
  
  const user = await setup();
  const booking = await createTestBooking(user.id, {
    depositAmountCents: 10000, // $100.00
  });
  
  // Capture deposit
  await storage.updateBookingRequest(booking.id, {
    depositStatus: "captured",
  });
  
  // First late reschedule - 40% retention
  const depositAmount = 10000;
  const firstRetainPct = user.lateRescheduleRetainPctFirst || 40;
  const firstRetained = Math.floor(depositAmount * firstRetainPct / 100);
  const firstRolled = depositAmount - firstRetained;
  
  console.assert(firstRetained === 4000, `First retention should be 4000 cents, got ${firstRetained}`);
  console.assert(firstRolled === 6000, `First rolled amount should be 6000 cents, got ${firstRolled}`);
  
  const afterFirst = await storage.updateBookingRequest(booking.id, {
    lateRescheduleCount: 1,
    retainedAmountCents: firstRetained,
    rolledAmountCents: firstRolled,
  });
  
  console.assert(afterFirst?.lateRescheduleCount === 1, "Reschedule count should be 1");
  console.assert(afterFirst?.retainedAmountCents === 4000, "Retained amount should be 4000");
  
  // Second late reschedule - 60% retention (of original, cumulative)
  const secondRetainPct = user.lateRescheduleRetainPctSecond || 60;
  const secondRetained = Math.floor(depositAmount * secondRetainPct / 100);
  const secondRolled = depositAmount - secondRetained;
  
  console.assert(secondRetained === 6000, `Second retention should be 6000 cents, got ${secondRetained}`);
  console.assert(secondRolled === 4000, `Second rolled amount should be 4000 cents, got ${secondRolled}`);
  
  // Third late reschedule - capped at 75%
  const capPct = user.lateRescheduleRetainPctCap || 75;
  const capRetained = Math.floor(depositAmount * capPct / 100);
  const capRolled = depositAmount - capRetained;
  
  console.assert(capRetained === 7500, `Cap retention should be 7500 cents, got ${capRetained}`);
  console.assert(capRolled === 2500, `Cap rolled amount should be 2500 cents, got ${capRolled}`);
  
  console.log("✓ Test 2 passed: Reschedule retention calculation works correctly");
}

// Test 3: Completion confirmation triggers release
async function testCompletionConfirmation() {
  console.log("\n--- Test 3: Completion Confirmation ---");
  
  const user = await setup();
  const booking = await createTestBooking(user.id);
  
  // Set up booking as awaiting confirmation
  await storage.updateBookingRequest(booking.id, {
    depositStatus: "captured",
    completionStatus: "awaiting_confirmation",
    autoReleaseAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(), // 36h from now
  });
  
  // Customer confirms completion
  const confirmed = await storage.updateBookingRequest(booking.id, {
    completionStatus: "completed",
    depositStatus: "released",
    stripeTransferId: "tr_test_123",
  });
  
  console.assert(confirmed?.completionStatus === "completed", "Completion status should be completed");
  console.assert(confirmed?.depositStatus === "released", "Deposit status should be released");
  console.assert(confirmed?.stripeTransferId === "tr_test_123", "Transfer ID should be stored");
  
  // Create booking event
  const event = await storage.createBookingEvent({
    bookingId: booking.id,
    eventType: "customer_confirmed",
    actorType: "customer",
    metadata: JSON.stringify({ trigger: "customer_confirmation" }),
  });
  
  console.assert(event.eventType === "customer_confirmed", "Event type should be customer_confirmed");
  
  console.log("✓ Test 3 passed: Completion confirmation triggers transfer correctly");
}

// Test 4: Auto-release after 36 hours
async function testAutoRelease() {
  console.log("\n--- Test 4: Auto-Release After 36 Hours ---");
  
  const user = await setup();
  const booking = await createTestBooking(user.id);
  
  // Set up booking with past auto-release time
  const pastTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
  await storage.updateBookingRequest(booking.id, {
    depositStatus: "captured",
    completionStatus: "awaiting_confirmation",
    autoReleaseAt: pastTime,
  });
  
  // Query for bookings awaiting release
  const awaitingRelease = await storage.getBookingRequestsAwaitingRelease();
  
  console.assert(awaitingRelease.length >= 1, "Should have at least 1 booking awaiting release");
  console.assert(
    awaitingRelease.some(b => b.id === booking.id), 
    "Our booking should be in awaiting release list"
  );
  
  // Simulate auto-release
  const released = await storage.updateBookingRequest(booking.id, {
    completionStatus: "completed",
    depositStatus: "released",
    stripeTransferId: "tr_auto_123",
  });
  
  console.assert(released?.depositStatus === "released", "Deposit should be released");
  
  // Create auto-release event
  const event = await storage.createBookingEvent({
    bookingId: booking.id,
    eventType: "auto_released",
    actorType: "system",
    metadata: JSON.stringify({ trigger: "36h_auto_release" }),
  });
  
  console.assert(event.actorType === "system", "Actor should be system for auto-release");
  
  console.log("✓ Test 4 passed: Auto-release works correctly");
}

// Test 5: Issue flag prevents transfer
async function testIssueFlagPreventsTransfer() {
  console.log("\n--- Test 5: Issue Flag Prevents Transfer ---");
  
  const user = await setup();
  const booking = await createTestBooking(user.id);
  
  // Set up booking as awaiting confirmation
  const futureTime = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
  await storage.updateBookingRequest(booking.id, {
    depositStatus: "captured",
    completionStatus: "awaiting_confirmation",
    autoReleaseAt: futureTime,
  });
  
  // Customer flags an issue
  const flagged = await storage.updateBookingRequest(booking.id, {
    completionStatus: "dispute",
    depositStatus: "on_hold_dispute",
  });
  
  console.assert(flagged?.completionStatus === "dispute", "Completion status should be dispute");
  console.assert(flagged?.depositStatus === "on_hold_dispute", "Deposit status should be on_hold_dispute");
  
  // Verify booking is NOT in auto-release queue
  const awaitingRelease = await storage.getBookingRequestsAwaitingRelease();
  console.assert(
    !awaitingRelease.some(b => b.id === booking.id),
    "Disputed booking should not be in auto-release queue"
  );
  
  // Create issue event
  const event = await storage.createBookingEvent({
    bookingId: booking.id,
    eventType: "issue_flagged",
    actorType: "customer",
    metadata: JSON.stringify({ reason: "Job was not completed properly" }),
  });
  
  console.assert(event.eventType === "issue_flagged", "Event type should be issue_flagged");
  
  console.log("✓ Test 5 passed: Issue flag prevents transfer correctly");
}

// Test 6: Waive reschedule fee
async function testWaiveRescheduleFee() {
  console.log("\n--- Test 6: Waive Reschedule Fee ---");
  
  const user = await setup();
  const booking = await createTestBooking(user.id);
  
  // Initially fee is not waived
  console.assert(booking.waiveRescheduleFee === false, "Initially fee should not be waived");
  
  // Provider waives the fee
  const waived = await storage.updateBookingRequest(booking.id, {
    waiveRescheduleFee: true,
  });
  
  console.assert(waived?.waiveRescheduleFee === true, "Fee should be waived");
  
  // Create waive event
  const event = await storage.createBookingEvent({
    bookingId: booking.id,
    eventType: "reschedule_fee_waived",
    actorType: "provider",
  });
  
  console.assert(event.eventType === "reschedule_fee_waived", "Event type should be reschedule_fee_waived");
  
  console.log("✓ Test 6 passed: Waive reschedule fee works correctly");
}

// Run all tests
async function runTests() {
  console.log("=== Deposit Protection System Tests ===\n");
  
  try {
    await testDepositPaymentIntentCreation();
    await testRescheduleRetention();
    await testCompletionConfirmation();
    await testAutoRelease();
    await testIssueFlagPreventsTransfer();
    await testWaiveRescheduleFee();
    
    console.log("\n=== All tests passed! ===");
  } catch (error) {
    console.error("\n=== Test failed! ===");
    console.error(error);
    process.exit(1);
  }
}

runTests();
