import admin from "firebase-admin";
import { db } from "../db";
import { users, clients, jobs, invoices } from "@shared/schema";
import { eq } from "drizzle-orm";

const REVIEW_EMAIL = "reviewer@gigaid.ai";
const REVIEW_PASSWORD = "GigaidReview2026!";
const REVIEW_BUSINESS = "GigAid Demo Services";
const REVIEW_NAME = "Alex Review";

const now = new Date();
const iso = now.toISOString();

function daysAgo(d: number): string {
  const dt = new Date(now);
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
}

function daysFromNow(d: number): string {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split("T")[0];
}

function dateStr(daysOffset: number): string {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + daysOffset);
  return dt.toISOString().split("T")[0];
}

async function main() {
  const env = process.env.NODE_ENV || process.env.VITE_APP_ENV;
  if (env !== "production") {
    console.error(
      `\n⛔  REFUSED: NODE_ENV="${process.env.NODE_ENV}", VITE_APP_ENV="${process.env.VITE_APP_ENV}"\n` +
      `   This script only runs in production. Set NODE_ENV=production.\n`
    );
    process.exit(1);
  }

  console.log("\n🔧 Provisioning Apple Review demo account...\n");

  const results: { step: string; status: "PASS" | "FAIL"; detail?: string }[] = [];

  function pass(step: string, detail?: string) {
    results.push({ step, status: "PASS", detail });
    console.log(`  ✅ ${step}${detail ? ` — ${detail}` : ""}`);
  }

  function fail(step: string, detail?: string) {
    results.push({ step, status: "FAIL", detail });
    console.error(`  ❌ ${step}${detail ? ` — ${detail}` : ""}`);
  }

  let firebaseUid: string | null = null;

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
      fail("Firebase config", "Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY");
      printSummary(results);
      process.exit(1);
    }

    let privateKey = privateKeyRaw;
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    pass("Firebase Admin SDK", "initialized");
  } catch (err: any) {
    fail("Firebase Admin SDK", err.message);
    printSummary(results);
    process.exit(1);
  }

  try {
    let fbUser: admin.auth.UserRecord;
    try {
      fbUser = await admin.auth().getUserByEmail(REVIEW_EMAIL);
      firebaseUid = fbUser.uid;
      pass("Firebase account exists", `uid=${firebaseUid}`);

      await admin.auth().updateUser(firebaseUid, {
        password: REVIEW_PASSWORD,
        emailVerified: true,
        disabled: false,
      });
      pass("Firebase credentials reset", "password updated, verified, enabled");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        fbUser = await admin.auth().createUser({
          email: REVIEW_EMAIL,
          password: REVIEW_PASSWORD,
          emailVerified: true,
          disabled: false,
          displayName: REVIEW_NAME,
        });
        firebaseUid = fbUser.uid;
        pass("Firebase account created", `uid=${firebaseUid}`);
      } else {
        throw err;
      }
    }
  } catch (err: any) {
    fail("Firebase account provisioning", err.message);
    printSummary(results);
    process.exit(1);
  }

  let userId: string;

  try {
    const emailNorm = REVIEW_EMAIL.toLowerCase().trim();

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, emailNorm))
      .limit(1);

    if (existing) {
      userId = existing.id;

      await db.update(users).set({
        firebaseUid: firebaseUid!,
        plan: "pro",
        isPro: true,
        compAccessGrantedAt: iso,
        compAccessExpiresAt: "2099-12-31T23:59:59.000Z",
        compAccessGrantedBy: "apple-review-script",
        isReviewAccount: true,
        accountStatus: "active",
        isDisabled: false,
        onboardingCompleted: true,
        onboardingStep: 4,
        onboardingState: "completed",
        paydayOnboardingCompleted: true,
        paydayOnboardingStep: 5,
        businessName: REVIEW_BUSINESS,
        name: REVIEW_NAME,
        firstName: "Alex",
        lastName: "Review",
        email: REVIEW_EMAIL,
        emailNormalized: emailNorm,
        authProvider: "firebase",
        publicProfileEnabled: true,
        publicProfileSlug: "gigaid-demo",
        defaultServiceType: "handyman",
        defaultPrice: 7500,
        pricingType: "fixed",
        depositEnabled: true,
        depositType: "percent",
        depositValue: 25,
        activationServicesDone: true,
        activationPricingDone: true,
        activationLinkDone: true,
        updatedAt: iso,
      }).where(eq(users.id, userId));

      pass("DB user updated", `id=${userId}`);
    } else {
      const [newUser] = await db.insert(users).values({
        username: emailNorm,
        password: "",
        email: REVIEW_EMAIL,
        emailNormalized: emailNorm,
        firebaseUid: firebaseUid!,
        authProvider: "firebase",
        plan: "pro",
        isPro: true,
        compAccessGrantedAt: iso,
        compAccessExpiresAt: "2099-12-31T23:59:59.000Z",
        compAccessGrantedBy: "apple-review-script",
        isReviewAccount: true,
        accountStatus: "active",
        isDisabled: false,
        onboardingCompleted: true,
        onboardingStep: 4,
        onboardingState: "completed",
        paydayOnboardingCompleted: true,
        paydayOnboardingStep: 5,
        businessName: REVIEW_BUSINESS,
        name: REVIEW_NAME,
        firstName: "Alex",
        lastName: "Review",
        phone: null,
        publicProfileEnabled: true,
        publicProfileSlug: "gigaid-demo",
        defaultServiceType: "handyman",
        defaultPrice: 7500,
        pricingType: "fixed",
        depositEnabled: true,
        depositType: "percent",
        depositValue: 25,
        activationServicesDone: true,
        activationPricingDone: true,
        activationLinkDone: true,
        createdAt: iso,
        updatedAt: iso,
      }).returning();

      userId = newUser.id;
      pass("DB user created", `id=${userId}`);
    }
  } catch (err: any) {
    fail("DB user provisioning", err.message);
    printSummary(results);
    process.exit(1);
  }

  try {
    const existingClients = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId));

    const needsClientReseed = existingClients.length < 3;
    if (!needsClientReseed) {
      pass("Clients already seeded", `${existingClients.length} clients`);
    } else {
      await db.delete(clients).where(eq(clients.userId, userId));

      const clientData = [
        {
          userId,
          clientName: "Sarah Thompson",
          clientPhone: "+15551234001",
          clientEmail: "sarah.t@example.com",
          isFirstTime: false,
          totalBookings: 5,
          lastBookingAt: daysAgo(3),
          createdAt: daysAgo(60),
        },
        {
          userId,
          clientName: "Mike Johnson",
          clientPhone: "+15551234002",
          clientEmail: "mike.j@example.com",
          isFirstTime: false,
          totalBookings: 2,
          lastBookingAt: daysAgo(10),
          createdAt: daysAgo(30),
        },
        {
          userId,
          clientName: "Emily Chen",
          clientPhone: "+15551234003",
          clientEmail: "emily.c@example.com",
          isFirstTime: true,
          totalBookings: 1,
          lastBookingAt: daysAgo(1),
          createdAt: daysAgo(7),
        },
      ];

      await db.insert(clients).values(clientData);
      pass("Clients seeded", "3 clients");
    }
  } catch (err: any) {
    fail("Client seeding", err.message);
  }

  let jobIds: string[] = [];
  try {
    const existingJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId));

    const hasCompletedJob = existingJobs.some((j) => j.status === "completed");
    const needsJobReseed = existingJobs.length < 3 || !hasCompletedJob;
    if (!needsJobReseed) {
      jobIds = existingJobs.map((j) => j.id);
      pass("Jobs already seeded", `${existingJobs.length} jobs`);
    } else {
      await db.delete(jobs).where(eq(jobs.userId, userId));

      const jobData = [
        {
          userId,
          title: "Kitchen Faucet Repair",
          description: "Fix leaking kitchen faucet and replace washer",
          serviceType: "plumbing",
          location: "123 Oak Street, Austin TX",
          scheduledDate: dateStr(-5),
          scheduledTime: "09:00",
          duration: 90,
          status: "completed",
          price: 15000,
          clientName: "Sarah Thompson",
          clientPhone: "+15551234001",
          clientEmail: "sarah.t@example.com",
          paymentStatus: "paid",
          paidAt: daysAgo(5),
          completedAt: daysAgo(5),
          createdAt: daysAgo(7),
        },
        {
          userId,
          title: "Bathroom Tile Installation",
          description: "Install new subway tiles in master bathroom shower area",
          serviceType: "handyman",
          location: "456 Elm Avenue, Austin TX",
          scheduledDate: dateStr(2),
          scheduledTime: "10:00",
          duration: 180,
          status: "scheduled",
          price: 35000,
          clientName: "Mike Johnson",
          clientPhone: "+15551234002",
          clientEmail: "mike.j@example.com",
          paymentStatus: "unpaid",
          createdAt: daysAgo(3),
        },
        {
          userId,
          title: "Ceiling Fan Installation",
          description: "Install ceiling fan in living room, including wiring",
          serviceType: "electrical",
          location: "789 Pine Road, Austin TX",
          scheduledDate: dateStr(5),
          scheduledTime: "14:00",
          duration: 120,
          status: "scheduled",
          price: 22500,
          clientName: "Emily Chen",
          clientPhone: "+15551234003",
          clientEmail: "emily.c@example.com",
          paymentStatus: "unpaid",
          createdAt: daysAgo(1),
        },
      ];

      const inserted = await db.insert(jobs).values(jobData).returning();
      jobIds = inserted.map((j) => j.id);
      pass("Jobs seeded", "3 jobs (1 completed, 2 scheduled)");
    }
  } catch (err: any) {
    fail("Job seeding", err.message);
  }

  try {
    const existingInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId));

    const hasPaid = existingInvoices.some((i) => i.status === "paid");
    const hasUnpaid = existingInvoices.some((i) => i.status !== "paid");
    const needsInvoiceReseed = existingInvoices.length < 2 || !hasPaid || !hasUnpaid;
    if (!needsInvoiceReseed) {
      pass("Invoices already seeded", `${existingInvoices.length} invoices`);
    } else {
      await db.delete(invoices).where(eq(invoices.userId, userId));

      const invoiceData = [
        {
          invoiceNumber: "INV-DEMO-001",
          userId,
          jobId: jobIds[0] || null,
          clientName: "Sarah Thompson",
          clientEmail: "sarah.t@example.com",
          clientPhone: "+15551234001",
          serviceDescription: "Kitchen faucet repair — labor and parts",
          amount: 15000,
          tax: 1200,
          status: "paid",
          paidAt: daysAgo(5),
          sentAt: daysAgo(5),
          createdAt: daysAgo(5),
        },
        {
          invoiceNumber: "INV-DEMO-002",
          userId,
          jobId: jobIds[1] || null,
          clientName: "Mike Johnson",
          clientEmail: "mike.j@example.com",
          clientPhone: "+15551234002",
          serviceDescription: "Bathroom tile installation — materials and labor",
          amount: 35000,
          tax: 2800,
          status: "sent",
          sentAt: daysAgo(1),
          createdAt: daysAgo(2),
        },
      ];

      await db.insert(invoices).values(invoiceData);
      pass("Invoices seeded", "2 invoices (1 paid, 1 sent/unpaid)");
    }
  } catch (err: any) {
    fail("Invoice seeding", err.message);
  }

  console.log("\n--- Verification ---\n");

  try {
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.emailNormalized, REVIEW_EMAIL.toLowerCase()))
      .limit(1);

    if (!dbUser) {
      fail("DB user lookup", "user not found after provisioning");
    } else {
      if (dbUser.plan === "pro" && dbUser.isReviewAccount) {
        pass("Entitlements", `plan=${dbUser.plan}, isReviewAccount=${dbUser.isReviewAccount}`);
      } else {
        fail("Entitlements", `plan=${dbUser.plan}, isReviewAccount=${dbUser.isReviewAccount}`);
      }

      if (dbUser.compAccessExpiresAt === "2099-12-31T23:59:59.000Z") {
        pass("Never-expires", `compAccessExpiresAt=${dbUser.compAccessExpiresAt}`);
      } else {
        fail("Never-expires", `compAccessExpiresAt=${dbUser.compAccessExpiresAt}`);
      }

      if (dbUser.accountStatus === "active" && !dbUser.isDisabled) {
        pass("Account active", `status=${dbUser.accountStatus}, disabled=${dbUser.isDisabled}`);
      } else {
        fail("Account active", `status=${dbUser.accountStatus}, disabled=${dbUser.isDisabled}`);
      }
    }
  } catch (err: any) {
    fail("DB verification", err.message);
  }

  try {
    const clientCount = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId));
    if (clientCount.length >= 3) {
      pass("Data: Clients", `${clientCount.length} clients`);
    } else {
      fail("Data: Clients", `only ${clientCount.length} clients`);
    }
  } catch (err: any) {
    fail("Data: Clients", err.message);
  }

  try {
    const jobCount = await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId));
    const completed = jobCount.filter((j) => j.status === "completed").length;
    if (jobCount.length >= 3 && completed >= 1) {
      pass("Data: Jobs", `${jobCount.length} jobs, ${completed} completed`);
    } else {
      fail("Data: Jobs", `${jobCount.length} jobs, ${completed} completed`);
    }
  } catch (err: any) {
    fail("Data: Jobs", err.message);
  }

  try {
    const invCount = await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId));
    const paid = invCount.filter((i) => i.status === "paid").length;
    const unpaid = invCount.filter((i) => i.status !== "paid").length;
    if (invCount.length >= 2 && paid >= 1 && unpaid >= 1) {
      pass("Data: Invoices", `${invCount.length} invoices, ${paid} paid, ${unpaid} unpaid`);
    } else {
      fail("Data: Invoices", `${invCount.length} invoices, ${paid} paid, ${unpaid} unpaid`);
    }
  } catch (err: any) {
    fail("Data: Invoices", err.message);
  }

  try {
    const fbUser = await admin.auth().getUserByEmail(REVIEW_EMAIL);
    if (fbUser.emailVerified && !fbUser.disabled) {
      pass("Firebase login ready", "verified + enabled");
    } else {
      fail("Firebase login ready", `verified=${fbUser.emailVerified}, disabled=${fbUser.disabled}`);
    }
  } catch (err: any) {
    fail("Firebase login check", err.message);
  }

  printSummary(results);

  const failCount = results.filter((r) => r.status === "FAIL").length;
  process.exit(failCount > 0 ? 1 : 0);
}

function printSummary(results: { step: string; status: "PASS" | "FAIL"; detail?: string }[]) {
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n========================================");
  console.log(`  SUMMARY: ${passed} PASS, ${failed} FAIL`);
  console.log("========================================");

  if (failed === 0) {
    console.log(`\n  ✅ Apple Review account ready!`);
    console.log(`     Email:    ${REVIEW_EMAIL}`);
    console.log(`     Password: ${REVIEW_PASSWORD}`);
    console.log(`     Plan:     Pro (never expires)\n`);
  } else {
    console.log(`\n  ⚠️  ${failed} step(s) failed. Review output above.\n`);
  }

  console.log("  Rollback steps:");
  console.log("    1. Delete Firebase user: firebase auth:delete reviewer@gigaid.ai");
  console.log("    2. DELETE FROM users WHERE email_normalized = 'reviewer@gigaid.ai';");
  console.log("    3. DELETE FROM clients WHERE user_id = '<userId>';");
  console.log("    4. DELETE FROM jobs WHERE user_id = '<userId>';");
  console.log("    5. DELETE FROM invoices WHERE user_id = '<userId>';\n");
}

main().catch((err) => {
  console.error("\n💥 Unhandled error:", err);
  process.exit(1);
});
