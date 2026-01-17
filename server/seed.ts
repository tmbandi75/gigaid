import { db } from "./db";
import {
  users,
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
  featureFlags,
} from "@shared/schema";

const DEMO_USER_ID = "demo-user";

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function hoursFromNow(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function seedDatabase() {
  console.log("[Seed] Starting database seeding...");

  try {
    // Seed Demo User first (all other records reference this user)
    const demoUser = {
      id: DEMO_USER_ID,
      username: "demo",
      password: "demo123",
      firstName: "Gig",
      lastName: "Worker",
      name: "Gig Worker",
      phone: "(555) 000-0000",
      email: "gig@example.com",
      businessName: "Pro Gig Services",
      bio: "Professional gig worker serving the Bay Area with plumbing, electrical, and cleaning services. Over 10 years of experience.",
      services: ["Faucet Repair / Replacement", "Drain Cleaning", "Light Fixture Installation", "Standard Home Cleaning"],
      serviceArea: "San Francisco Bay Area",
      availability: JSON.stringify({
        monday: { enabled: true, ranges: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }] },
        tuesday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
        wednesday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
        thursday: { enabled: true, ranges: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }] },
        friday: { enabled: true, ranges: [{ start: "08:00", end: "15:00" }] },
        saturday: { enabled: false, ranges: [{ start: "09:00", end: "17:00" }] },
        sunday: { enabled: false, ranges: [{ start: "09:00", end: "17:00" }] },
      }),
      slotDuration: 60,
      onboardingCompleted: true,
      onboardingStep: 5,
      publicProfileEnabled: true,
      publicProfileSlug: "gig-worker",
      showReviewsOnBooking: true,
      referralCode: "GIGPRO2026",
      notifyBySms: true,
      notifyByEmail: true,
      depositEnabled: true,
      depositType: "percent",
      depositValue: 50,
      createdAt: daysAgo(90),
    };

    await db.insert(users).values(demoUser).onConflictDoUpdate({
      target: users.id,
      set: demoUser,
    });
    console.log("[Seed] Demo user seeded");

    // Seed Jobs with various statuses and locations
    // Using service names from predefined catalog (shared/service-categories.ts)
    const jobsData = [
      {
        id: "seed-job-1",
        userId: DEMO_USER_ID,
        title: "Kitchen Sink Repair",
        description: "Fix leaking kitchen sink and replace faucet",
        serviceType: "Faucet Repair / Replacement",
        location: "123 Main Street, San Francisco, CA 94102",
        scheduledDate: daysFromNow(1),
        scheduledTime: "10:00",
        duration: 90,
        status: "scheduled",
        price: 15000,
        clientName: "Sarah Johnson",
        clientPhone: "415-555-1234",
        clientEmail: "sarah.j@email.com",
        customerLat: 37.7749,
        customerLng: -122.4194,
        providerLat: 37.7849,
        providerLng: -122.4094,
        providerLocationUpdatedAt: hoursFromNow(-1),
        createdAt: daysAgo(2),
      },
      {
        id: "seed-job-2",
        userId: DEMO_USER_ID,
        title: "Bathroom Renovation",
        description: "Complete bathroom tile work and fixture installation",
        serviceType: "Toilet Repair",
        location: "456 Oak Avenue, San Francisco, CA 94110",
        scheduledDate: daysFromNow(3),
        scheduledTime: "09:00",
        duration: 240,
        status: "scheduled",
        price: 45000,
        clientName: "Michael Chen",
        clientPhone: "415-555-5678",
        clientEmail: "m.chen@email.com",
        customerLat: 37.7599,
        customerLng: -122.4148,
        createdAt: daysAgo(5),
      },
      {
        id: "seed-job-3",
        userId: DEMO_USER_ID,
        title: "Water Heater Installation",
        description: "Install new tankless water heater",
        serviceType: "Water Heater Service",
        location: "789 Pine Street, Oakland, CA 94607",
        scheduledDate: daysFromNow(0),
        scheduledTime: "14:00",
        duration: 180,
        status: "in_progress",
        price: 85000,
        clientName: "Emily Rodriguez",
        clientPhone: "510-555-9012",
        clientEmail: "emily.r@email.com",
        customerLat: 37.8044,
        customerLng: -122.2712,
        providerLat: 37.7949,
        providerLng: -122.2612,
        providerLocationUpdatedAt: hoursFromNow(-0.5),
        createdAt: daysAgo(7),
      },
      {
        id: "seed-job-4",
        userId: DEMO_USER_ID,
        title: "Electrical Panel Upgrade",
        description: "Upgrade 100A to 200A electrical panel",
        serviceType: "Circuit Breaker Issues",
        location: "321 Elm Street, Berkeley, CA 94704",
        scheduledDate: daysAgo(3),
        scheduledTime: "08:00",
        duration: 300,
        status: "completed",
        price: 120000,
        clientName: "David Kim",
        clientPhone: "510-555-3456",
        clientEmail: "d.kim@email.com",
        paymentStatus: "paid",
        paymentMethod: "card",
        paidAt: daysAgo(2),
        customerLat: 37.8716,
        customerLng: -122.2727,
        createdAt: daysAgo(10),
      },
      {
        id: "seed-job-5",
        userId: DEMO_USER_ID,
        title: "Deep House Cleaning",
        description: "Full house deep cleaning including windows",
        serviceType: "Deep Cleaning",
        location: "555 Market Street, San Francisco, CA 94105",
        scheduledDate: daysAgo(7),
        scheduledTime: "10:00",
        duration: 240,
        status: "completed",
        price: 35000,
        clientName: "Lisa Wang",
        clientPhone: "415-555-7890",
        clientEmail: "lisa.w@email.com",
        paymentStatus: "paid",
        paymentMethod: "venmo",
        paidAt: daysAgo(6),
        customerLat: 37.7897,
        customerLng: -122.3972,
        createdAt: daysAgo(14),
      },
      {
        id: "seed-job-6",
        userId: DEMO_USER_ID,
        title: "Outdoor Lighting Installation",
        description: "Install landscape lighting in backyard",
        serviceType: "Light Fixture Installation",
        location: "888 Sunset Blvd, Sausalito, CA 94965",
        scheduledDate: daysFromNow(5),
        scheduledTime: "11:00",
        duration: 180,
        status: "scheduled",
        price: 55000,
        clientName: "Robert Taylor",
        clientPhone: "415-555-4321",
        clientEmail: "r.taylor@email.com",
        customerLat: 37.8591,
        customerLng: -122.4853,
        createdAt: daysAgo(1),
      },
    ];

    for (const job of jobsData) {
      await db.insert(jobs).values(job).onConflictDoUpdate({
        target: jobs.id,
        set: job,
      });
    }
    console.log("[Seed] Jobs seeded");

    // Seed Leads with various statuses
    // Using service names from predefined catalog (shared/service-categories.ts)
    const leadsData = [
      {
        id: "seed-lead-1",
        userId: DEMO_USER_ID,
        clientName: "Jennifer Martinez",
        clientPhone: "415-555-2222",
        clientEmail: "j.martinez@email.com",
        serviceType: "Toilet Repair",
        description: "Need quote for bathroom remodel",
        status: "new",
        source: "booking_form",
        score: 85,
        createdAt: daysAgo(1),
      },
      {
        id: "seed-lead-2",
        userId: DEMO_USER_ID,
        clientName: "Thomas Anderson",
        clientPhone: "510-555-3333",
        clientEmail: "t.anderson@email.com",
        serviceType: "Smart Device Installation",
        description: "EV charger installation inquiry",
        status: "contacted",
        source: "referral",
        score: 92,
        notes: "Very interested, waiting for availability",
        lastContactedAt: daysAgo(0),
        createdAt: daysAgo(3),
      },
      {
        id: "seed-lead-3",
        userId: DEMO_USER_ID,
        clientName: "Amanda Foster",
        clientPhone: "415-555-4444",
        clientEmail: "a.foster@email.com",
        serviceType: "Standard Home Cleaning",
        description: "Regular weekly cleaning service",
        status: "converted",
        source: "social",
        score: 100,
        convertedAt: daysAgo(5),
        convertedJobId: "seed-job-5",
        createdAt: daysAgo(14),
      },
      {
        id: "seed-lead-4",
        userId: DEMO_USER_ID,
        clientName: "Kevin Brown",
        clientPhone: "510-555-5555",
        clientEmail: "k.brown@email.com",
        serviceType: "Emergency Plumbing",
        description: "Emergency pipe repair needed",
        status: "new",
        source: "manual",
        score: 75,
        createdAt: hoursFromNow(-3),
      },
    ];

    for (const lead of leadsData) {
      await db.insert(leads).values(lead).onConflictDoUpdate({
        target: leads.id,
        set: lead,
      });
    }
    console.log("[Seed] Leads seeded");

    // Seed Invoices
    const invoicesData = [
      {
        id: "seed-invoice-1",
        invoiceNumber: "INV-2026-001",
        userId: DEMO_USER_ID,
        jobId: "seed-job-4",
        clientName: "David Kim",
        clientEmail: "d.kim@email.com",
        clientPhone: "510-555-3456",
        serviceDescription: "Electrical panel upgrade from 100A to 200A including permits",
        amount: 120000,
        tax: 10800,
        status: "paid",
        paidAt: daysAgo(2),
        createdAt: daysAgo(3),
        sentAt: daysAgo(3),
      },
      {
        id: "seed-invoice-2",
        invoiceNumber: "INV-2026-002",
        userId: DEMO_USER_ID,
        jobId: "seed-job-5",
        clientName: "Lisa Wang",
        clientEmail: "lisa.w@email.com",
        clientPhone: "415-555-7890",
        serviceDescription: "Deep house cleaning - 4 bedrooms, 3 bathrooms, windows",
        amount: 35000,
        status: "paid",
        paidAt: daysAgo(6),
        createdAt: daysAgo(7),
        sentAt: daysAgo(7),
      },
      {
        id: "seed-invoice-3",
        invoiceNumber: "INV-2026-003",
        userId: DEMO_USER_ID,
        jobId: "seed-job-1",
        clientName: "Sarah Johnson",
        clientEmail: "sarah.j@email.com",
        clientPhone: "415-555-1234",
        serviceDescription: "Kitchen sink repair and faucet replacement",
        amount: 15000,
        tax: 1350,
        status: "sent",
        createdAt: daysAgo(1),
        sentAt: daysAgo(1),
      },
      {
        id: "seed-invoice-4",
        invoiceNumber: "INV-2026-004",
        userId: DEMO_USER_ID,
        clientName: "Michael Chen",
        clientEmail: "m.chen@email.com",
        clientPhone: "415-555-5678",
        serviceDescription: "Bathroom renovation - tile and fixtures",
        amount: 45000,
        tax: 4050,
        status: "draft",
        createdAt: daysAgo(0),
      },
    ];

    for (const invoice of invoicesData) {
      await db.insert(invoices).values(invoice).onConflictDoUpdate({
        target: invoices.id,
        set: invoice,
      });
    }
    console.log("[Seed] Invoices seeded");

    // Seed Reminders
    const remindersData = [
      {
        id: "seed-reminder-1",
        userId: DEMO_USER_ID,
        jobId: "seed-job-1",
        clientName: "Sarah Johnson",
        clientPhone: "415-555-1234",
        message: "Reminder: Your plumbing appointment is tomorrow at 10:00 AM",
        channel: "sms",
        scheduledAt: hoursFromNow(12),
        status: "pending",
        createdAt: daysAgo(1),
      },
      {
        id: "seed-reminder-2",
        userId: DEMO_USER_ID,
        jobId: "seed-job-2",
        clientName: "Michael Chen",
        clientPhone: "415-555-5678",
        clientEmail: "m.chen@email.com",
        message: "Reminder: Your bathroom renovation is scheduled for this week",
        channel: "email",
        scheduledAt: hoursFromNow(48),
        status: "pending",
        createdAt: daysAgo(0),
      },
      {
        id: "seed-reminder-3",
        userId: DEMO_USER_ID,
        jobId: "seed-job-4",
        clientName: "David Kim",
        clientPhone: "510-555-3456",
        message: "Your electrical panel upgrade is complete. Thanks for choosing us!",
        channel: "sms",
        scheduledAt: daysAgo(2),
        status: "sent",
        createdAt: daysAgo(3),
      },
    ];

    for (const reminder of remindersData) {
      await db.insert(reminders).values(reminder).onConflictDoUpdate({
        target: reminders.id,
        set: reminder,
      });
    }
    console.log("[Seed] Reminders seeded");

    // Seed Crew Members
    const crewMembersData = [
      {
        id: "seed-crew-1",
        userId: DEMO_USER_ID,
        name: "Carlos Mendez",
        phone: "415-555-8001",
        email: "carlos.m@email.com",
        role: "plumber",
        status: "joined",
        invitedAt: daysAgo(30),
        joinedAt: daysAgo(28),
      },
      {
        id: "seed-crew-2",
        userId: DEMO_USER_ID,
        name: "James Wilson",
        phone: "415-555-8002",
        email: "james.w@email.com",
        role: "electrician",
        status: "joined",
        invitedAt: daysAgo(60),
        joinedAt: daysAgo(58),
      },
      {
        id: "seed-crew-3",
        userId: DEMO_USER_ID,
        name: "Maria Santos",
        phone: "510-555-8003",
        email: "maria.s@email.com",
        role: "helper",
        status: "invited",
        invitedAt: daysAgo(2),
      },
    ];

    for (const crew of crewMembersData) {
      await db.insert(crewMembers).values(crew).onConflictDoUpdate({
        target: crewMembers.id,
        set: crew,
      });
    }
    console.log("[Seed] Crew members seeded");

    // Seed Crew Invites
    const crewInvitesData = [
      {
        id: "seed-invite-1",
        userId: DEMO_USER_ID,
        crewMemberId: "seed-crew-1",
        jobId: "seed-job-3",
        token: "demo-token-123456",
        status: "confirmed",
        deliveredVia: "sms",
        deliveredAt: daysAgo(1),
        viewedAt: daysAgo(1),
        confirmedAt: daysAgo(1),
        expiresAt: daysFromNow(7),
        createdAt: daysAgo(1),
      },
      {
        id: "seed-invite-2",
        userId: DEMO_USER_ID,
        crewMemberId: "seed-crew-2",
        jobId: "seed-job-6",
        token: "demo-token-789012",
        status: "pending",
        deliveredVia: "email",
        deliveredAt: daysAgo(0),
        expiresAt: daysFromNow(7),
        createdAt: daysAgo(0),
      },
    ];

    for (const invite of crewInvitesData) {
      await db.insert(crewInvites).values(invite).onConflictDoUpdate({
        target: crewInvites.id,
        set: invite,
      });
    }
    console.log("[Seed] Crew invites seeded");

    // Seed Booking Requests
    const bookingRequestsData = [
      {
        id: "seed-booking-1",
        userId: DEMO_USER_ID,
        clientName: "Patricia Green",
        clientPhone: "415-555-9001",
        clientEmail: "p.green@email.com",
        serviceType: "plumbing",
        preferredDate: daysFromNow(7),
        preferredTime: "10:00",
        description: "Leaky faucet in master bathroom",
        location: "100 California Street, San Francisco, CA 94111",
        status: "pending",
        depositAmountCents: 5000,
        depositStatus: "none",
        customerLat: 37.7935,
        customerLng: -122.3980,
        createdAt: hoursFromNow(-5),
      },
      {
        id: "seed-booking-2",
        userId: DEMO_USER_ID,
        clientName: "Steven Miller",
        clientPhone: "510-555-9002",
        clientEmail: "s.miller@email.com",
        serviceType: "electrical",
        preferredDate: daysFromNow(10),
        preferredTime: "14:00",
        description: "Install new outlet in garage",
        location: "200 Broadway, Oakland, CA 94607",
        status: "accepted",
        depositAmountCents: 7500,
        depositStatus: "held",
        completionStatus: "scheduled",
        jobStartAt: new Date(daysFromNow(10) + "T14:00:00").toISOString(),
        customerLat: 37.7984,
        customerLng: -122.2753,
        createdAt: daysAgo(3),
      },
      {
        id: "seed-booking-3",
        userId: DEMO_USER_ID,
        clientName: "Nancy White",
        clientPhone: "415-555-9003",
        clientEmail: "n.white@email.com",
        serviceType: "cleaning",
        preferredDate: daysAgo(5),
        preferredTime: "09:00",
        description: "Move-out deep cleaning",
        location: "300 Folsom Street, San Francisco, CA 94105",
        status: "accepted",
        depositAmountCents: 10000,
        depositStatus: "released",
        completionStatus: "completed",
        customerLat: 37.7878,
        customerLng: -122.3923,
        createdAt: daysAgo(10),
      },
    ];

    for (const booking of bookingRequestsData) {
      await db.insert(bookingRequests).values(booking).onConflictDoUpdate({
        target: bookingRequests.id,
        set: booking,
      });
    }
    console.log("[Seed] Booking requests seeded");

    // Seed Booking Events
    const bookingEventsData = [
      {
        id: "seed-event-1",
        bookingId: "seed-booking-2",
        eventType: "deposit_captured",
        actorType: "customer",
        metadata: JSON.stringify({ amount: 7500, method: "card" }),
        createdAt: daysAgo(2),
      },
      {
        id: "seed-event-2",
        bookingId: "seed-booking-3",
        eventType: "deposit_captured",
        actorType: "customer",
        metadata: JSON.stringify({ amount: 10000, method: "card" }),
        createdAt: daysAgo(8),
      },
      {
        id: "seed-event-3",
        bookingId: "seed-booking-3",
        eventType: "deposit_released",
        actorType: "system",
        metadata: JSON.stringify({ amount: 10000, reason: "job_completed" }),
        createdAt: daysAgo(4),
      },
    ];

    for (const event of bookingEventsData) {
      await db.insert(bookingEvents).values(event).onConflictDoUpdate({
        target: bookingEvents.id,
        set: event,
      });
    }
    console.log("[Seed] Booking events seeded");

    // Seed Reviews
    const reviewsData = [
      {
        id: "seed-review-1",
        userId: DEMO_USER_ID,
        jobId: "seed-job-4",
        clientName: "David Kim",
        clientEmail: "d.kim@email.com",
        rating: 5,
        comment: "Excellent work on the electrical panel upgrade. Very professional and explained everything clearly. Highly recommend!",
        isPublic: true,
        createdAt: daysAgo(2),
      },
      {
        id: "seed-review-2",
        userId: DEMO_USER_ID,
        jobId: "seed-job-5",
        clientName: "Lisa Wang",
        clientEmail: "lisa.w@email.com",
        rating: 5,
        comment: "The deep cleaning was amazing! My house has never looked better. Will definitely use again.",
        providerResponse: "Thank you Lisa! It was a pleasure working in your beautiful home.",
        respondedAt: daysAgo(5),
        isPublic: true,
        createdAt: daysAgo(6),
      },
      {
        id: "seed-review-3",
        userId: DEMO_USER_ID,
        clientName: "Rachel Adams",
        clientEmail: "r.adams@email.com",
        rating: 4,
        comment: "Good service overall. Arrived on time and fixed the issue quickly.",
        isPublic: true,
        createdAt: daysAgo(14),
      },
      {
        id: "seed-review-4",
        userId: DEMO_USER_ID,
        clientName: "Mark Thompson",
        clientEmail: "m.thompson@email.com",
        rating: 5,
        comment: "Fast, reliable, and fair pricing. Exactly what you want in a service provider!",
        isPublic: true,
        createdAt: daysAgo(21),
      },
    ];

    for (const review of reviewsData) {
      await db.insert(reviews).values(review).onConflictDoUpdate({
        target: reviews.id,
        set: review,
      });
    }
    console.log("[Seed] Reviews seeded");

    // Seed Referrals
    const referralsData = [
      {
        id: "seed-referral-1",
        referrerId: DEMO_USER_ID,
        referredEmail: "friend1@email.com",
        referredPhone: "415-555-1111",
        status: "pending",
        createdAt: daysAgo(5),
      },
      {
        id: "seed-referral-2",
        referrerId: DEMO_USER_ID,
        referredEmail: "friend2@email.com",
        status: "signed_up",
        referredUserId: "referred-user-1",
        convertedAt: daysAgo(10),
        createdAt: daysAgo(20),
      },
      {
        id: "seed-referral-3",
        referrerId: DEMO_USER_ID,
        referredEmail: "friend3@email.com",
        status: "rewarded",
        referredUserId: "referred-user-2",
        rewardAmount: 2500,
        convertedAt: daysAgo(25),
        createdAt: daysAgo(30),
      },
    ];

    for (const referral of referralsData) {
      await db.insert(referrals).values(referral).onConflictDoUpdate({
        target: referrals.id,
        set: referral,
      });
    }
    console.log("[Seed] Referrals seeded");

    // Seed User Payment Methods
    const paymentMethodsData = [
      {
        id: "seed-payment-method-1",
        userId: DEMO_USER_ID,
        type: "venmo",
        label: "@pro-gig-services",
        instructions: "Send payment to @pro-gig-services on Venmo",
        isEnabled: true,
        createdAt: daysAgo(60),
      },
      {
        id: "seed-payment-method-2",
        userId: DEMO_USER_ID,
        type: "zelle",
        label: "payments@progigservices.com",
        instructions: "Send Zelle payment to payments@progigservices.com",
        isEnabled: true,
        createdAt: daysAgo(60),
      },
      {
        id: "seed-payment-method-3",
        userId: DEMO_USER_ID,
        type: "cash",
        label: "Cash",
        instructions: "Cash accepted at time of service",
        isEnabled: true,
        createdAt: daysAgo(60),
      },
    ];

    for (const method of paymentMethodsData) {
      await db.insert(userPaymentMethods).values(method).onConflictDoUpdate({
        target: userPaymentMethods.id,
        set: method,
      });
    }
    console.log("[Seed] Payment methods seeded");

    // Seed Job Payments
    const jobPaymentsData = [
      {
        id: "seed-job-payment-1",
        invoiceId: "seed-invoice-1",
        jobId: "seed-job-4",
        userId: DEMO_USER_ID,
        clientName: "David Kim",
        clientEmail: "d.kim@email.com",
        amount: 130800,
        method: "card",
        status: "paid",
        paidAt: daysAgo(2),
        confirmedAt: daysAgo(2),
        createdAt: daysAgo(3),
      },
      {
        id: "seed-job-payment-2",
        invoiceId: "seed-invoice-2",
        jobId: "seed-job-5",
        userId: DEMO_USER_ID,
        clientName: "Lisa Wang",
        clientEmail: "lisa.w@email.com",
        amount: 35000,
        method: "venmo",
        status: "confirmed",
        paidAt: daysAgo(6),
        confirmedAt: daysAgo(6),
        createdAt: daysAgo(7),
      },
    ];

    for (const payment of jobPaymentsData) {
      await db.insert(jobPayments).values(payment).onConflictDoUpdate({
        target: jobPayments.id,
        set: payment,
      });
    }
    console.log("[Seed] Job payments seeded");

    // Seed Voice Notes
    const voiceNotesData = [
      {
        id: "seed-voice-1",
        userId: DEMO_USER_ID,
        jobId: "seed-job-3",
        audioUrl: "/demo/voice-note-1.mp3",
        transcript: "Customer mentioned the water heater is making a clicking noise. They want to upgrade to tankless. Budget is around $800-1000 for the unit.",
        summary: "Customer wants tankless water heater upgrade, budget $800-1000",
        duration: 45,
        createdAt: daysAgo(1),
      },
      {
        id: "seed-voice-2",
        userId: DEMO_USER_ID,
        audioUrl: "/demo/voice-note-2.mp3",
        transcript: "Remember to order more copper fittings for next week. Also need to follow up with the electrical supplier about the panel.",
        summary: "Order copper fittings, follow up with electrical supplier",
        duration: 22,
        createdAt: daysAgo(3),
      },
    ];

    for (const note of voiceNotesData) {
      await db.insert(voiceNotes).values(note).onConflictDoUpdate({
        target: voiceNotes.id,
        set: note,
      });
    }
    console.log("[Seed] Voice notes seeded");

    // Seed Feature Flags (enable AI nudges and QuickBook)
    const featureFlagsData = [
      {
        key: "ai_micro_nudges",
        enabled: true,
        description: "Enable AI micro-nudges for leads and invoices",
        updatedAt: daysAgo(30),
      },
      {
        key: "quickbook_enabled",
        enabled: true,
        description: "Enable QuickBook paste-to-booking flow",
        updatedAt: daysAgo(1),
      },
      {
        key: "enforce_no_silent_completion",
        enabled: false, // Default OFF for safe rollout
        description: "Revenue Protection: Require explicit resolution (invoice/payment/waiver) before completing jobs",
        updatedAt: daysAgo(0),
      },
      {
        key: "nudge_trust_memory",
        enabled: false, // Default OFF - Trust Memory for AI Nudges
        description: "Trust Memory: 72-hour cooldown after dismissing nudges, prevents same nudge type from reappearing for 3 days",
        updatedAt: daysAgo(0),
      },
      {
        key: "today_money_plan",
        enabled: true, // Enabled for all users - Today's Money Plan global prioritization
        description: "Today's Money Plan: Global prioritization view showing ranked action queue across leads, jobs, and invoices",
        updatedAt: daysAgo(0),
      },
      {
        key: "outcome_attribution",
        enabled: true, // Default ON - Outcome Attribution impact metrics
        description: "Outcome Attribution: Show 'GigAid helped you collect $X faster' with conservative calculations",
        updatedAt: daysAgo(0),
      },
    ];

    for (const flag of featureFlagsData) {
      await db.insert(featureFlags).values(flag).onConflictDoUpdate({
        target: featureFlags.key,
        set: flag,
      });
    }
    console.log("[Seed] Feature flags seeded");

    // Seed AI Nudges for Today's Game Plan
    const today = new Date().toISOString().split("T")[0];
    const aiNudgesData = [
      {
        id: "seed-nudge-1",
        userId: DEMO_USER_ID,
        entityType: "lead",
        entityId: "seed-lead-1",
        nudgeType: "lead_follow_up",
        priority: 90,
        status: "active",
        createdAt: hoursFromNow(-2),
        explainText: "Follow up now — replies drop after 24h.",
        actionPayload: JSON.stringify({
          suggestedMessage: "Hi Jennifer! Just following up on your inquiry about bathroom remodel. When would be a good time to chat?",
        }),
        dedupeKey: `${DEMO_USER_ID}:lead:seed-lead-1:lead_follow_up:${today}`,
      },
      {
        id: "seed-nudge-2",
        userId: DEMO_USER_ID,
        entityType: "invoice",
        entityId: "seed-invoice-3",
        nudgeType: "invoice_reminder",
        priority: 88,
        status: "active",
        createdAt: hoursFromNow(-1),
        explainText: "You're owed $150 — send a reminder?",
        actionPayload: JSON.stringify({
          reminderMessage: "Hi Sarah! Just a friendly reminder about invoice #INV-2026-003 for $163.50. Payment link: {link}",
        }),
        dedupeKey: `${DEMO_USER_ID}:invoice:seed-invoice-3:invoice_reminder:${today}`,
      },
      {
        id: "seed-nudge-3",
        userId: DEMO_USER_ID,
        entityType: "lead",
        entityId: "seed-lead-4",
        nudgeType: "lead_follow_up",
        priority: 85,
        status: "active",
        createdAt: hoursFromNow(-3),
        explainText: "New lead — respond quickly to win the job.",
        actionPayload: JSON.stringify({
          suggestedMessage: "Hi Kevin! Got your message about the emergency pipe repair. I can help! When would be a good time to take a look?",
        }),
        dedupeKey: `${DEMO_USER_ID}:lead:seed-lead-4:lead_follow_up:${today}`,
      },
    ];

    for (const nudge of aiNudgesData) {
      await db.insert(aiNudges).values(nudge).onConflictDoUpdate({
        target: aiNudges.id,
        set: nudge,
      });
    }
    console.log("[Seed] AI nudges seeded");

    console.log("[Seed] Database seeding completed successfully!");
    return true;
  } catch (error) {
    console.error("[Seed] Error seeding database:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
