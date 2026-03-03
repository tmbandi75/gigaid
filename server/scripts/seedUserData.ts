import { db } from "../db";
import {
  jobs,
  leads,
  invoices,
  reminders,
  crewMembers,
  crewInvites,
  bookingRequests,
  bookingEvents,
  reviews,
  referrals,
  voiceNotes,
  userPaymentMethods,
  jobPayments,
  aiNudges,
  clients,
  jobResolutions,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const TARGET_USER_ID = process.argv[2];
if (!TARGET_USER_ID) {
  console.error("Usage: npx tsx server/scripts/seedUserData.ts <userId>");
  process.exit(1);
}

const now = new Date();

function daysFromNow(days: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function hoursFromNow(hours: number): string {
  const date = new Date(now);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function daysAgo(days: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const prefix = "usr-seed";
const today = now.toISOString().split("T")[0];

async function main() {
  console.log(`\nSeeding sample data for user: ${TARGET_USER_ID}\n`);
  const results: { area: string; status: string }[] = [];

  function pass(area: string, detail: string) {
    results.push({ area, status: "OK" });
    console.log(`  + ${area}: ${detail}`);
  }
  function fail(area: string, detail: string) {
    results.push({ area, status: "FAIL" });
    console.error(`  x ${area}: ${detail}`);
  }

  // --- Clients ---
  try {
    const existing = await db.select().from(clients).where(eq(clients.userId, TARGET_USER_ID));
    if (existing.length >= 5) {
      pass("Clients", `already have ${existing.length}`);
    } else {
      const clientData = [
        { userId: TARGET_USER_ID, clientName: "Sarah Johnson", clientPhone: "+15551001001", clientEmail: "sarah.j@example.com", isFirstTime: false, totalBookings: 5, lastBookingAt: daysAgo(3), createdAt: daysAgo(60) },
        { userId: TARGET_USER_ID, clientName: "Michael Chen", clientPhone: "+15551001002", clientEmail: "m.chen@example.com", isFirstTime: false, totalBookings: 3, lastBookingAt: daysAgo(10), createdAt: daysAgo(45) },
        { userId: TARGET_USER_ID, clientName: "Emily Rodriguez", clientPhone: "+15551001003", clientEmail: "emily.r@example.com", isFirstTime: false, totalBookings: 2, lastBookingAt: daysAgo(1), createdAt: daysAgo(30) },
        { userId: TARGET_USER_ID, clientName: "David Kim", clientPhone: "+15551001004", clientEmail: "d.kim@example.com", isFirstTime: false, totalBookings: 4, lastBookingAt: daysAgo(5), createdAt: daysAgo(90) },
        { userId: TARGET_USER_ID, clientName: "Lisa Wang", clientPhone: "+15551001005", clientEmail: "lisa.w@example.com", isFirstTime: true, totalBookings: 1, lastBookingAt: daysAgo(7), createdAt: daysAgo(14) },
        { userId: TARGET_USER_ID, clientName: "Robert Taylor", clientPhone: "+15551001006", clientEmail: "r.taylor@example.com", isFirstTime: true, totalBookings: 0, createdAt: daysAgo(2) },
      ];
      await db.insert(clients).values(clientData);
      pass("Clients", "6 clients added");
    }
  } catch (e: any) { fail("Clients", e.message); }

  // --- Jobs (insert as scheduled, then complete with resolution) ---
  const jobIds: string[] = [];
  try {
    const existing = await db.select().from(jobs).where(eq(jobs.userId, TARGET_USER_ID));
    if (existing.length >= 5) {
      pass("Jobs", `already have ${existing.length}`);
      jobIds.push(...existing.map(j => j.id));
    } else {
      const jobData = [
        {
          userId: TARGET_USER_ID, title: "Kitchen Sink Repair", description: "Fix leaking kitchen sink and replace faucet",
          serviceType: "Faucet Repair / Replacement", location: "123 Main Street, Austin TX 78701",
          scheduledDate: daysFromNow(1), scheduledTime: "10:00", duration: 90, status: "scheduled",
          price: 15000, clientName: "Sarah Johnson", clientPhone: "+15551001001", clientEmail: "sarah.j@example.com",
          customerLat: 30.2672, customerLng: -97.7431, createdAt: daysAgo(2),
        },
        {
          userId: TARGET_USER_ID, title: "Bathroom Tile Installation", description: "Install new subway tiles in master bathroom shower",
          serviceType: "Toilet Repair", location: "456 Oak Avenue, Austin TX 78702",
          scheduledDate: daysFromNow(3), scheduledTime: "09:00", duration: 240, status: "scheduled",
          price: 45000, clientName: "Michael Chen", clientPhone: "+15551001002", clientEmail: "m.chen@example.com",
          customerLat: 30.2599, customerLng: -97.7348, createdAt: daysAgo(5),
        },
        {
          userId: TARGET_USER_ID, title: "Water Heater Installation", description: "Install new tankless water heater",
          serviceType: "Water Heater Service", location: "789 Pine Road, Round Rock TX 78681",
          scheduledDate: daysFromNow(0), scheduledTime: "14:00", duration: 180, status: "in_progress",
          price: 85000, clientName: "Emily Rodriguez", clientPhone: "+15551001003", clientEmail: "emily.r@example.com",
          customerLat: 30.5083, customerLng: -97.6789, createdAt: daysAgo(7),
        },
        {
          userId: TARGET_USER_ID, title: "Electrical Panel Upgrade", description: "Upgrade 100A to 200A electrical panel",
          serviceType: "Circuit Breaker Issues", location: "321 Elm Street, Cedar Park TX 78613",
          scheduledDate: daysAgo(3).split("T")[0], scheduledTime: "08:00", duration: 300, status: "scheduled",
          price: 120000, clientName: "David Kim", clientPhone: "+15551001004", clientEmail: "d.kim@example.com",
          paymentStatus: "paid", paymentMethod: "card", paidAt: daysAgo(2),
          customerLat: 30.5052, customerLng: -97.8203, createdAt: daysAgo(10),
        },
        {
          userId: TARGET_USER_ID, title: "Deep House Cleaning", description: "Full house deep cleaning including windows",
          serviceType: "Deep Cleaning", location: "555 Market Street, Austin TX 78701",
          scheduledDate: daysAgo(7).split("T")[0], scheduledTime: "10:00", duration: 240, status: "scheduled",
          price: 35000, clientName: "Lisa Wang", clientPhone: "+15551001005", clientEmail: "lisa.w@example.com",
          paymentStatus: "paid", paymentMethod: "venmo", paidAt: daysAgo(6),
          customerLat: 30.2672, customerLng: -97.7431, createdAt: daysAgo(14),
        },
        {
          userId: TARGET_USER_ID, title: "Outdoor Lighting Installation", description: "Install landscape lighting in backyard",
          serviceType: "Light Fixture Installation", location: "888 Sunset Blvd, Lakeway TX 78734",
          scheduledDate: daysFromNow(5), scheduledTime: "11:00", duration: 180, status: "scheduled",
          price: 55000, clientName: "Robert Taylor", clientPhone: "+15551001006", clientEmail: "r.taylor@example.com",
          customerLat: 30.3632, customerLng: -97.9795, createdAt: daysAgo(1),
        },
      ];

      const inserted = await db.insert(jobs).values(jobData).returning();
      jobIds.push(...inserted.map(j => j.id));

      // Now mark the completed jobs with resolution records
      for (const idx of [3, 4]) {
        if (jobIds[idx]) {
          await db.insert(jobResolutions).values({
            jobId: jobIds[idx],
            resolutionType: idx === 3 ? "invoiced" : "paid_without_invoice",
            paymentMethod: idx === 4 ? "venmo" : undefined,
            resolvedAt: daysAgo(idx === 3 ? 2 : 6),
            resolvedByUserId: TARGET_USER_ID,
            createdAt: daysAgo(idx === 3 ? 2 : 6),
          });
          await db.update(jobs).set({
            status: "completed",
            completedAt: daysAgo(idx === 3 ? 2 : 6),
          }).where(eq(jobs.id, jobIds[idx]));
        }
      }

      pass("Jobs", "6 jobs (2 completed, 1 in-progress, 3 scheduled)");
    }
  } catch (e: any) { fail("Jobs", e.message); }

  // --- Leads ---
  try {
    const existing = await db.select().from(leads).where(eq(leads.userId, TARGET_USER_ID));
    if (existing.length >= 5) {
      pass("Leads", `already have ${existing.length}`);
    } else {
      const leadData = [
        { userId: TARGET_USER_ID, clientName: "Jennifer Martinez", clientPhone: "+15552001001", clientEmail: "j.martinez@example.com", serviceType: "Toilet Repair", description: "Need quote for bathroom remodel", status: "new", source: "booking_form", score: 85, createdAt: daysAgo(1) },
        { userId: TARGET_USER_ID, clientName: "Thomas Anderson", clientPhone: "+15552001002", clientEmail: "t.anderson@example.com", serviceType: "Smart Device Installation", description: "EV charger installation inquiry", status: "contacted", source: "referral", score: 92, notes: "Very interested, waiting for availability", lastContactedAt: daysAgo(0), createdAt: daysAgo(3) },
        { userId: TARGET_USER_ID, clientName: "Amanda Foster", clientPhone: "+15552001003", clientEmail: "a.foster@example.com", serviceType: "Standard Home Cleaning", description: "Regular weekly cleaning service", status: "converted", source: "social", score: 100, convertedAt: daysAgo(5), convertedJobId: jobIds[4] || null, createdAt: daysAgo(14) },
        { userId: TARGET_USER_ID, clientName: "Kevin Brown", clientPhone: "+15552001004", clientEmail: "k.brown@example.com", serviceType: "Emergency Plumbing", description: "Emergency pipe repair needed", status: "new", source: "manual", score: 75, createdAt: hoursFromNow(-3) },
        { userId: TARGET_USER_ID, clientName: "Diana Moore", clientPhone: "+15552001005", clientEmail: "d.moore@example.com", serviceType: "Drain Cleaning", description: "Slow drain in kitchen sink", status: "contacted", source: "booking_form", score: 45, lastContactedAt: daysAgo(2), createdAt: daysAgo(4) },
        { userId: TARGET_USER_ID, clientName: "Brian Cooper", clientPhone: "+15552001006", clientEmail: "b.cooper@example.com", serviceType: "Light Fixture Installation", description: "Install ceiling fan in bedroom", status: "cold", source: "social", score: 15, lastContactedAt: daysAgo(14), createdAt: daysAgo(21) },
        { userId: TARGET_USER_ID, clientName: "Stephanie Hall", clientPhone: "+15552001007", clientEmail: "s.hall@example.com", serviceType: "Deep Cleaning", description: "Post-construction cleanup needed", status: "cold", source: "referral", score: 0, lastContactedAt: daysAgo(30), createdAt: daysAgo(45) },
        { userId: TARGET_USER_ID, clientName: "Ryan Peterson", clientPhone: "+15552001008", clientEmail: "r.peterson@example.com", serviceType: "Water Heater Service", description: "Annual water heater maintenance", status: "contacted", source: "manual", score: 60, lastContactedAt: daysAgo(1), createdAt: daysAgo(3) },
        { userId: TARGET_USER_ID, clientName: "Michelle Clark", clientPhone: "+15552001009", clientEmail: "m.clark@example.com", serviceType: "Standard Home Cleaning", description: "Weekly cleaning service inquiry", status: "new", source: "booking_form", score: 70, createdAt: hoursFromNow(-1) },
        { userId: TARGET_USER_ID, clientName: "Christopher Lee", clientPhone: "+15552001010", clientEmail: "c.lee@example.com", serviceType: "Circuit Breaker Issues", description: "Breaker keeps tripping", status: "cold", source: "social", score: 25, lastContactedAt: daysAgo(10), createdAt: daysAgo(18) },
      ];
      await db.insert(leads).values(leadData);
      pass("Leads", "10 leads (3 new, 3 contacted, 1 converted, 3 cold)");
    }
  } catch (e: any) { fail("Leads", e.message); }

  // --- Invoices ---
  try {
    const existing = await db.select().from(invoices).where(eq(invoices.userId, TARGET_USER_ID));
    if (existing.length >= 4) {
      pass("Invoices", `already have ${existing.length}`);
    } else {
      const invData = [
        { invoiceNumber: "INV-2026-001", userId: TARGET_USER_ID, jobId: jobIds[3] || null, clientName: "David Kim", clientEmail: "d.kim@example.com", clientPhone: "+15551001004", serviceDescription: "Electrical panel upgrade from 100A to 200A including permits", amount: 120000, tax: 10800, status: "paid", paidAt: daysAgo(2), createdAt: daysAgo(3), sentAt: daysAgo(3) },
        { invoiceNumber: "INV-2026-002", userId: TARGET_USER_ID, jobId: jobIds[4] || null, clientName: "Lisa Wang", clientEmail: "lisa.w@example.com", clientPhone: "+15551001005", serviceDescription: "Deep house cleaning - 4 bedrooms, 3 bathrooms, windows", amount: 35000, status: "paid", paidAt: daysAgo(6), createdAt: daysAgo(7), sentAt: daysAgo(7) },
        { invoiceNumber: "INV-2026-003", userId: TARGET_USER_ID, jobId: jobIds[0] || null, clientName: "Sarah Johnson", clientEmail: "sarah.j@example.com", clientPhone: "+15551001001", serviceDescription: "Kitchen sink repair and faucet replacement", amount: 15000, tax: 1350, status: "sent", createdAt: daysAgo(1), sentAt: daysAgo(1) },
        { invoiceNumber: "INV-2026-004", userId: TARGET_USER_ID, clientName: "Michael Chen", clientEmail: "m.chen@example.com", clientPhone: "+15551001002", serviceDescription: "Bathroom renovation - tile and fixtures", amount: 45000, tax: 4050, status: "draft", createdAt: daysAgo(0) },
      ];
      await db.insert(invoices).values(invData).returning();
      pass("Invoices", "4 invoices (2 paid, 1 sent, 1 draft)");
    }
  } catch (e: any) { fail("Invoices", e.message); }

  // --- Reminders ---
  try {
    const existing = await db.select().from(reminders).where(eq(reminders.userId, TARGET_USER_ID));
    if (existing.length >= 3) {
      pass("Reminders", `already have ${existing.length}`);
    } else {
      const remData = [
        { userId: TARGET_USER_ID, jobId: jobIds[0] || null, clientName: "Sarah Johnson", clientPhone: "+15551001001", message: "Reminder: Your plumbing appointment is tomorrow at 10:00 AM", channel: "sms", scheduledAt: hoursFromNow(12), status: "pending", createdAt: daysAgo(1) },
        { userId: TARGET_USER_ID, jobId: jobIds[1] || null, clientName: "Michael Chen", clientPhone: "+15551001002", clientEmail: "m.chen@example.com", message: "Reminder: Your bathroom renovation is scheduled for this week", channel: "email", scheduledAt: hoursFromNow(48), status: "pending", createdAt: daysAgo(0) },
        { userId: TARGET_USER_ID, jobId: jobIds[3] || null, clientName: "David Kim", clientPhone: "+15551001004", message: "Your electrical panel upgrade is complete. Thanks for choosing us!", channel: "sms", scheduledAt: daysAgo(2), status: "sent", createdAt: daysAgo(3) },
      ];
      await db.insert(reminders).values(remData);
      pass("Reminders", "3 reminders (2 pending, 1 sent)");
    }
  } catch (e: any) { fail("Reminders", e.message); }

  // --- Reviews ---
  try {
    const existing = await db.select().from(reviews).where(eq(reviews.userId, TARGET_USER_ID));
    if (existing.length >= 4) {
      pass("Reviews", `already have ${existing.length}`);
    } else {
      const revData = [
        { userId: TARGET_USER_ID, jobId: jobIds[3] || null, clientName: "David Kim", clientEmail: "d.kim@example.com", rating: 5, comment: "Excellent work on the electrical panel upgrade. Very professional and explained everything clearly. Highly recommend!", isPublic: true, createdAt: daysAgo(2) },
        { userId: TARGET_USER_ID, jobId: jobIds[4] || null, clientName: "Lisa Wang", clientEmail: "lisa.w@example.com", rating: 5, comment: "The deep cleaning was amazing! My house has never looked better. Will definitely use again.", providerResponse: "Thank you Lisa! It was a pleasure working in your beautiful home.", respondedAt: daysAgo(5), isPublic: true, createdAt: daysAgo(6) },
        { userId: TARGET_USER_ID, clientName: "Rachel Adams", clientEmail: "r.adams@example.com", rating: 4, comment: "Good service overall. Arrived on time and fixed the issue quickly.", isPublic: true, createdAt: daysAgo(14) },
        { userId: TARGET_USER_ID, clientName: "Mark Thompson", clientEmail: "m.thompson@example.com", rating: 5, comment: "Fast, reliable, and fair pricing. Exactly what you want in a service provider!", isPublic: true, createdAt: daysAgo(21) },
      ];
      await db.insert(reviews).values(revData);
      pass("Reviews", "4 reviews (avg 4.75 stars)");
    }
  } catch (e: any) { fail("Reviews", e.message); }

  // --- Crew Members ---
  try {
    const existing = await db.select().from(crewMembers).where(eq(crewMembers.userId, TARGET_USER_ID));
    if (existing.length >= 2) {
      pass("Crew", `already have ${existing.length}`);
    } else {
      const crewData = [
        { userId: TARGET_USER_ID, name: "Carlos Mendez", phone: "+15553001001", email: "carlos.m@example.com", role: "plumber", status: "joined", invitedAt: daysAgo(30), joinedAt: daysAgo(28) },
        { userId: TARGET_USER_ID, name: "James Wilson", phone: "+15553001002", email: "james.w@example.com", role: "electrician", status: "joined", invitedAt: daysAgo(60), joinedAt: daysAgo(58) },
        { userId: TARGET_USER_ID, name: "Maria Santos", phone: "+15553001003", email: "maria.s@example.com", role: "helper", status: "invited", invitedAt: daysAgo(2) },
      ];
      await db.insert(crewMembers).values(crewData);
      pass("Crew", "3 members (2 joined, 1 invited)");
    }
  } catch (e: any) { fail("Crew", e.message); }

  // --- Booking Requests ---
  try {
    const existing = await db.select().from(bookingRequests).where(eq(bookingRequests.userId, TARGET_USER_ID));
    if (existing.length >= 3) {
      pass("Booking Requests", `already have ${existing.length}`);
    } else {
      const bookData = [
        { userId: TARGET_USER_ID, clientName: "Patricia Green", clientPhone: "+15554001001", clientEmail: "p.green@example.com", serviceType: "plumbing", preferredDate: daysFromNow(7), preferredTime: "10:00", description: "Leaky faucet in master bathroom", location: "100 Congress Ave, Austin TX 78701", status: "pending", depositAmountCents: 5000, depositStatus: "none", customerLat: 30.2747, customerLng: -97.7404, createdAt: hoursFromNow(-5) },
        { userId: TARGET_USER_ID, clientName: "Steven Miller", clientPhone: "+15554001002", clientEmail: "s.miller@example.com", serviceType: "electrical", preferredDate: daysFromNow(10), preferredTime: "14:00", description: "Install new outlet in garage", location: "200 Lamar Blvd, Austin TX 78701", status: "accepted", depositAmountCents: 7500, depositStatus: "held", completionStatus: "scheduled", customerLat: 30.2650, customerLng: -97.7520, createdAt: daysAgo(3) },
        { userId: TARGET_USER_ID, clientName: "Nancy White", clientPhone: "+15554001003", clientEmail: "n.white@example.com", serviceType: "cleaning", preferredDate: daysAgo(5).split("T")[0], preferredTime: "09:00", description: "Move-out deep cleaning", location: "300 Barton Springs Rd, Austin TX 78704", status: "accepted", depositAmountCents: 10000, depositStatus: "released", completionStatus: "completed", customerLat: 30.2621, customerLng: -97.7510, createdAt: daysAgo(10) },
      ];
      await db.insert(bookingRequests).values(bookData);
      pass("Booking Requests", "3 bookings (1 pending, 1 accepted, 1 completed)");
    }
  } catch (e: any) { fail("Booking Requests", e.message); }

  // --- Referrals ---
  try {
    const existing = await db.select().from(referrals).where(eq(referrals.referrerId, TARGET_USER_ID));
    if (existing.length >= 3) {
      pass("Referrals", `already have ${existing.length}`);
    } else {
      const refData = [
        { referrerId: TARGET_USER_ID, referredEmail: "friend1@example.com", referredPhone: "+15555001001", status: "pending", createdAt: daysAgo(5) },
        { referrerId: TARGET_USER_ID, referredEmail: "friend2@example.com", status: "signed_up", convertedAt: daysAgo(10), createdAt: daysAgo(20) },
        { referrerId: TARGET_USER_ID, referredEmail: "friend3@example.com", status: "rewarded", rewardAmount: 2500, convertedAt: daysAgo(25), createdAt: daysAgo(30) },
      ];
      await db.insert(referrals).values(refData);
      pass("Referrals", "3 referrals (1 pending, 1 signed up, 1 rewarded)");
    }
  } catch (e: any) { fail("Referrals", e.message); }

  // --- Payment Methods ---
  try {
    const existing = await db.select().from(userPaymentMethods).where(eq(userPaymentMethods.userId, TARGET_USER_ID));
    if (existing.length >= 3) {
      pass("Payment Methods", `already have ${existing.length}`);
    } else {
      const pmData = [
        { userId: TARGET_USER_ID, type: "venmo", label: "@heinz-plumbing", instructions: "Send payment via Venmo", isEnabled: true, createdAt: daysAgo(60) },
        { userId: TARGET_USER_ID, type: "zelle", label: "payments@heinzplumbing.com", instructions: "Send Zelle payment", isEnabled: true, createdAt: daysAgo(60) },
        { userId: TARGET_USER_ID, type: "cash", label: "Cash", instructions: "Cash accepted at time of service", isEnabled: true, createdAt: daysAgo(60) },
      ];
      await db.insert(userPaymentMethods).values(pmData);
      pass("Payment Methods", "3 methods (Venmo, Zelle, Cash)");
    }
  } catch (e: any) { fail("Payment Methods", e.message); }

  // --- Voice Notes ---
  try {
    const existing = await db.select().from(voiceNotes).where(eq(voiceNotes.userId, TARGET_USER_ID));
    if (existing.length >= 2) {
      pass("Voice Notes", `already have ${existing.length}`);
    } else {
      const vnData = [
        { userId: TARGET_USER_ID, jobId: jobIds[2] || null, audioUrl: "/demo/voice-note-1.mp3", transcript: "Customer mentioned the water heater is making a clicking noise. They want to upgrade to tankless. Budget is around $800-1000 for the unit.", summary: "Customer wants tankless water heater upgrade, budget $800-1000", duration: 45, createdAt: daysAgo(1) },
        { userId: TARGET_USER_ID, audioUrl: "/demo/voice-note-2.mp3", transcript: "Remember to order more copper fittings for next week. Also need to follow up with the electrical supplier about the panel.", summary: "Order copper fittings, follow up with electrical supplier", duration: 22, createdAt: daysAgo(3) },
      ];
      await db.insert(voiceNotes).values(vnData);
      pass("Voice Notes", "2 voice notes");
    }
  } catch (e: any) { fail("Voice Notes", e.message); }

  // --- AI Nudges ---
  try {
    const existingNudges = await db.select().from(aiNudges).where(eq(aiNudges.userId, TARGET_USER_ID));
    if (existingNudges.length >= 5) {
      pass("AI Nudges", `already have ${existingNudges.length}`);
    } else {
      const nudgeData = [
        { userId: TARGET_USER_ID, entityType: "lead", entityId: "new-lead", nudgeType: "lead_follow_up", priority: 90, status: "active", createdAt: hoursFromNow(-2), explainText: "Follow up now - replies drop after 24h.", actionPayload: JSON.stringify({ suggestedMessage: "Hi Jennifer! Just following up on your inquiry about bathroom remodel. When would be a good time to chat?" }), dedupeKey: `${TARGET_USER_ID}:lead:new:follow_up:${today}` },
        { userId: TARGET_USER_ID, entityType: "invoice", entityId: "unpaid", nudgeType: "invoice_reminder", priority: 88, status: "active", createdAt: hoursFromNow(-1), explainText: "You're owed $150 - send a reminder?", actionPayload: JSON.stringify({ reminderMessage: "Hi Sarah! Just a friendly reminder about your invoice for $163.50." }), dedupeKey: `${TARGET_USER_ID}:invoice:unpaid:reminder:${today}` },
        { userId: TARGET_USER_ID, entityType: "lead", entityId: "emergency", nudgeType: "lead_follow_up", priority: 85, status: "active", createdAt: hoursFromNow(-3), explainText: "New lead - respond quickly to win the job.", actionPayload: JSON.stringify({ suggestedMessage: "Hi Kevin! Got your message about the emergency pipe repair. I can help!" }), dedupeKey: `${TARGET_USER_ID}:lead:emergency:follow_up:${today}` },
        { userId: TARGET_USER_ID, entityType: "lead", entityId: "quiet", nudgeType: "lead_silent_rescue", priority: 70, status: "active", createdAt: hoursFromNow(-4), explainText: "Brian went quiet 2 weeks ago - check in.", actionPayload: JSON.stringify({ suggestedMessage: "Hi Brian! Just checking in on your ceiling fan installation. Still interested?" }), dedupeKey: `${TARGET_USER_ID}:lead:quiet:rescue:${today}` },
        { userId: TARGET_USER_ID, entityType: "job", entityId: "stuck", nudgeType: "job_stuck", priority: 78, status: "active", createdAt: hoursFromNow(-1), explainText: "Water heater job has been in progress for a while - update status?", actionPayload: JSON.stringify({ action: "update_status" }), dedupeKey: `${TARGET_USER_ID}:job:stuck:stuck:${today}` },
      ];
      await db.insert(aiNudges).values(nudgeData);
      pass("AI Nudges", "5 nudges (follow-ups, reminders, rescue)");
    }
  } catch (e: any) { fail("AI Nudges", e.message); }

  // --- Summary ---
  const failCount = results.filter(r => r.status === "FAIL").length;
  console.log("\n========================================");
  console.log(`  SUMMARY: ${results.length - failCount} OK, ${failCount} FAIL`);
  console.log("========================================\n");

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
