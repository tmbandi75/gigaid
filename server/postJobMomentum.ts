import { db } from "./db";
import { 
  userAutomationSettings, 
  outboundMessages, 
  jobs, 
  invoices,
  clients,
  users,
  bookingPages,
  bookingPageEvents,
  type UserAutomationSettings,
  type OutboundMessage,
  type Job,
  type Client
} from "@shared/schema";
import { eq, and, lte, gte, ne, inArray, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

// ============================================================================
// Send-time policy for outbound SMS.
// ----------------------------------------------------------------------------
// Order of guards inside attemptSendMessage / evaluateSendPolicy:
//   1. Global opt-out      (sms_opt_out OR notify_by_sms === false)
//   2. Per-user rate limit (recent SMS sends in the rolling window)
//   3. First-booking eligibility (only for first_booking_nudge_*)
//   4. Send and transition queued -> sent atomically
// Email sends skip 1-3 (opt-out and rate limit are SMS-only).
// ============================================================================

// Single source of truth for "an action by the owner cancels first-booking
// nudges." Add future signals (link_clicked, booking_created, etc.) here —
// that is the only edit required.
export const FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES = [
  "link_copied",
  "link_shared",
] as const;

export const FIRST_BOOKING_NUDGE_TYPES = [
  "first_booking_nudge_10m",
  "first_booking_nudge_24h",
] as const;

function isFirstBookingNudgeType(type: string): boolean {
  return (FIRST_BOOKING_NUDGE_TYPES as readonly string[]).includes(type);
}

// Per-user rolling 24h SMS cap. Applies to ALL outbound SMS types (nudges,
// reminders, follow-ups, confirmations, …). Single source of truth so
// future tuning is one edit. Enforced at the send chokepoint.
export const SMS_RATE_LIMIT_PER_24H = 3;

/**
 * Counts outbound SMS rows for `userId` with status='sent' within the last
 * 24h. Exported so tests can call it directly against the real DB if they
 * need to, and so isSmsRateLimited can be unit-tested by injecting a fake.
 */
export async function countSentSmsLast24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(outboundMessages)
    .where(and(
      eq(outboundMessages.userId, userId),
      eq(outboundMessages.channel, "sms"),
      eq(outboundMessages.status, "sent"),
      gte(outboundMessages.sentAt, since),
    ));
  return rows[0]?.n ?? 0;
}

/**
 * Return true if sending another SMS to this user would violate the rolling
 * 24h cap. The counter is injectable so tests can drive it with controlled
 * values without exercising the database layer.
 */
export async function isSmsRateLimited(
  userId: string,
  getCount: (userId: string) => Promise<number> = countSentSmsLast24h,
): Promise<boolean> {
  return (await getCount(userId)) >= SMS_RATE_LIMIT_PER_24H;
}

function buildFirstNamePrefix(firstName: string | null | undefined): string {
  const trimmed = (firstName ?? "").trim();
  // Locked spec: "{first_name}, " when known, "" when not. No "there," fallback.
  return trimmed ? `${trimmed}, ` : "";
}

/**
 * Render the locked first-booking nudge body. Exists in exactly one place so
 * the verbatim spec strings live in a single file and personalization is
 * always rendered fresh at send time.
 */
export function renderFirstBookingNudgeBody(
  type: string,
  firstName: string | null | undefined,
): string {
  const prefix = buildFirstNamePrefix(firstName);
  if (type === "first_booking_nudge_10m") {
    return `${prefix}send your GigAid booking link to your next customer — it saves a ton of back and forth.\n\nReply STOP to opt out.\n— Your partners at GigAid`;
  }
  if (type === "first_booking_nudge_24h") {
    return `${prefix}most people get their first GigAid booking within a day after sharing their link.\n\n— Your partners at GigAid`;
  }
  return "";
}

type SendOutcome =
  | { kind: "sent"; body: string }
  | { kind: "canceled"; reason: string }
  | { kind: "deferred"; reason: string };

// Cancellation reasons surfaced via outbound_messages.failure_reason. Locked
// strings — admin dashboards and tests both pattern-match these directly.
export const CANCEL_REASONS = {
  USER_NOT_FOUND: "user_not_found",
  USER_OPTED_OUT: "user_opted_out",
  RATE_LIMITED: "rate_limited",
  ACTION_TAKEN: "action_taken",
  MISSING_BOOKING_PAGE: "missing_booking_page",
} as const;

// Inputs to evaluateSendPolicy — all data the chain needs is collected up
// front by the caller so this stays a pure function (no DB / network).
export interface SendPolicyInput {
  channel: string;
  type: string;
  bookingPageId: string | null | undefined;
  user: { smsOptOut?: boolean | null; notifyBySms?: boolean | null } | null;
  // First-booking nudge inputs (only consulted when type matches a nudge):
  bookingPageClaimed?: boolean | null;
  disqualifyingEventCount?: number;
  // Rate-limit inputs (only consulted for SMS):
  recentSmsSentCount?: number;
  maxSmsPerWindow?: number;
}

export type SendPolicyDecision =
  | { kind: "allow" }
  | { kind: "cancel"; reason: string };

/**
 * Pure send-time policy decision. Centralizes the chain so attemptSendMessage
 * and tests both consume the exact same logic. Order is load-bearing: opt-out
 * before rate-limit before first-booking-eligibility, so a STOPped user is
 * always reported as `user_opted_out` rather than masked by a rate limit.
 */
export function evaluateSendPolicy(input: SendPolicyInput): SendPolicyDecision {
  // Email path: opt-out and rate limit are SMS-only by design (spec).
  if (input.channel !== "sms") {
    return { kind: "allow" };
  }

  if (!input.user) {
    return { kind: "cancel", reason: CANCEL_REASONS.USER_NOT_FOUND };
  }

  // Guard 1: global opt-out. Either flag blocks; STOP webhook flips both.
  if (input.user.smsOptOut === true || input.user.notifyBySms === false) {
    return { kind: "cancel", reason: CANCEL_REASONS.USER_OPTED_OUT };
  }

  // Guard 2: per-user rate limit. Skipped when caller didn't provide a max
  // (e.g. internal tests of just opt-out behavior); enforced strictly when
  // the cap is provided. >= so the cap is the inclusive max already-sent.
  const max = input.maxSmsPerWindow;
  const recent = input.recentSmsSentCount ?? 0;
  if (typeof max === "number" && recent >= max) {
    return { kind: "cancel", reason: CANCEL_REASONS.RATE_LIMITED };
  }

  // Guard 3: first-booking eligibility re-check. Other types unaffected.
  if (isFirstBookingNudgeType(input.type)) {
    if (!input.bookingPageId) {
      return { kind: "cancel", reason: CANCEL_REASONS.MISSING_BOOKING_PAGE };
    }
    if (!input.bookingPageClaimed) {
      return { kind: "cancel", reason: CANCEL_REASONS.ACTION_TAKEN };
    }
    if ((input.disqualifyingEventCount ?? 0) > 0) {
      return { kind: "cancel", reason: CANCEL_REASONS.ACTION_TAKEN };
    }
  }

  return { kind: "allow" };
}

// Template rendering utility - simple string replacement, no code execution
export function renderTemplate(template: string, context: Record<string, string | undefined>): string {
  let result = template;
  
  // Replace known placeholders
  const placeholders = [
    "client_first_name",
    "client_name", 
    "job_title",
    "invoice_link",
    "review_link",
    "job_date",
    "job_time",
    "confirm_link"
  ];
  
  for (const placeholder of placeholders) {
    const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, "g");
    const value = context[placeholder] ?? "";
    result = result.replace(regex, value);
  }
  
  // Remove any remaining unrecognized placeholders (safety)
  result = result.replace(/\{\{[^}]+\}\}/g, "");
  
  return result.trim();
}

// Get or create user automation settings with defaults
export async function getOrCreateAutomationSettings(userId: string): Promise<UserAutomationSettings> {
  const existing = await db
    .select()
    .from(userAutomationSettings)
    .where(eq(userAutomationSettings.userId, userId))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Create with defaults
  const [created] = await db
    .insert(userAutomationSettings)
    .values({
      userId,
      createdAt: new Date().toISOString(),
    })
    .returning();
  
  return created;
}

// Schedule follow-up message after job completion
export async function schedulePostJobMessages(job: Job, previousStatus: string): Promise<void> {
  // Only trigger when transitioning TO completed from a non-completed state
  if (job.status !== "completed" || previousStatus === "completed") {
    return;
  }
  
  const userId = job.userId;
  if (!userId) return;
  
  // Get automation settings
  const settings = await getOrCreateAutomationSettings(userId);
  
  // Get client info
  let client: Client | null = null;
  if (job.clientPhone || job.clientEmail) {
    const clients_result = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.userId, userId),
          job.clientPhone 
            ? eq(clients.clientPhone, job.clientPhone)
            : eq(clients.clientEmail, job.clientEmail || "")
        )
      )
      .limit(1);
    client = clients_result[0] || null;
  }
  
  // Determine contact channel and address
  const toAddress = job.clientPhone || job.clientEmail;
  if (!toAddress) {
    logger.info(`[PostJobMomentum] No contact info for job ${job.id}, skipping`);
    return;
  }
  
  const channel = job.clientPhone ? "sms" : "email";
  const clientFirstName = job.clientName?.split(" ")[0] || "there";
  
  // Check for existing scheduled messages to prevent duplicates and enforce rate limit
  const existingMessages = await db
    .select()
    .from(outboundMessages)
    .where(
      and(
        eq(outboundMessages.jobId, job.id),
        inArray(outboundMessages.status, ["scheduled", "queued", "sent"])
      )
    );
  
  // Rate limit: max 2 messages per job (followup + payment_reminder)
  if (existingMessages.length >= 2) {
    logger.info(`[PostJobMomentum] Job ${job.id} already has ${existingMessages.length} messages, skipping`);
    return;
  }
  
  const hasFollowup = existingMessages.some(m => m.type === "followup");
  const hasPaymentReminder = existingMessages.some(m => m.type === "payment_reminder");
  
  const now = new Date();
  
  // Schedule follow-up if enabled and not already scheduled
  if (settings.postJobFollowupEnabled && !hasFollowup) {
    const scheduledFor = new Date(now.getTime() + (settings.followupDelayHours || 24) * 60 * 60 * 1000);
    
    // Build template with optional review link
    let template = settings.followupTemplate || "";
    if (settings.reviewLinkUrl) {
      template += "\n\nIf you were happy with the work, a quick review helps a lot: {{review_link}}";
    }
    
    const renderedMessage = renderTemplate(template, {
      client_first_name: clientFirstName,
      client_name: job.clientName || "",
      job_title: job.title || "the job",
      review_link: settings.reviewLinkUrl || "",
    });
    
    await db.insert(outboundMessages).values({
      userId,
      jobId: job.id,
      clientId: client?.id,
      channel,
      toAddress,
      type: "followup",
      status: "scheduled",
      scheduledFor: scheduledFor.toISOString(),
      templateRendered: renderedMessage,
      metadata: JSON.stringify({ jobTitle: job.title }),
      createdAt: now.toISOString(),
    });
    
    logger.info(`[PostJobMomentum] Scheduled followup for job ${job.id} at ${scheduledFor.toISOString()}`);
  }
  
  // Schedule payment reminder if enabled, job is unpaid, and not already scheduled
  if (settings.paymentReminderEnabled && !hasPaymentReminder) {
    // Check if job has unpaid balance
    const jobInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.jobId, job.id));
    
    const hasUnpaidInvoice = jobInvoices.some(inv => 
      inv.status !== "paid" && (inv.amount || 0) > 0
    );
    
    if (hasUnpaidInvoice) {
      const scheduledFor = new Date(now.getTime() + (settings.paymentReminderDelayHours || 24) * 60 * 60 * 1000);
      
      const invoice = jobInvoices.find(inv => inv.status !== "paid");
      const invoiceToken = invoice?.publicToken || invoice?.shareLink;
      const invoiceLink = invoiceToken ? `${process.env.FRONTEND_URL || ""}/invoice/${invoiceToken}` : "";
      
      const renderedMessage = renderTemplate(settings.paymentReminderTemplate || "", {
        client_first_name: clientFirstName,
        client_name: job.clientName || "",
        job_title: job.title || "the job",
        invoice_link: invoiceLink,
      });
      
      await db.insert(outboundMessages).values({
        userId,
        jobId: job.id,
        clientId: client?.id,
        channel,
        toAddress,
        type: "payment_reminder",
        status: "scheduled",
        scheduledFor: scheduledFor.toISOString(),
        templateRendered: renderedMessage,
        metadata: JSON.stringify({ 
          jobTitle: job.title,
          invoiceId: invoice?.id 
        }),
        createdAt: now.toISOString(),
      });
      
      logger.info(`[PostJobMomentum] Scheduled payment reminder for job ${job.id} at ${scheduledFor.toISOString()}`);
    }
  }
}

// Schedule confirmation message when job is scheduled/rescheduled
export async function scheduleJobConfirmation(job: Job, isReschedule: boolean = false): Promise<void> {
  // Only for jobs with scheduled date/time and contact info
  if (!job.scheduledDate || !job.scheduledTime) {
    logger.info(`[PostJobMomentum] Job ${job.id} has no scheduled date/time, skipping confirmation`);
    return;
  }
  
  const toAddress = job.clientPhone || job.clientEmail;
  if (!toAddress) {
    logger.info(`[PostJobMomentum] Job ${job.id} has no contact info, skipping confirmation`);
    return;
  }
  
  const userId = job.userId;
  if (!userId) return;
  
  // Get automation settings
  const settings = await getOrCreateAutomationSettings(userId);
  
  if (!settings.autoConfirmEnabled) {
    logger.info(`[PostJobMomentum] Auto-confirm disabled for user ${userId}`);
    return;
  }
  
  // Check for existing confirmation for this job (avoid duplicates)
  const existingConfirmations = await db
    .select()
    .from(outboundMessages)
    .where(
      and(
        eq(outboundMessages.jobId, job.id),
        eq(outboundMessages.type, "confirmation"),
        inArray(outboundMessages.status, ["scheduled", "queued", "sent"])
      )
    );
  
  // If rescheduling, cancel any pending confirmations and schedule new one
  if (isReschedule && existingConfirmations.length > 0) {
    const pending = existingConfirmations.filter(m => m.status === "scheduled" || m.status === "queued");
    for (const msg of pending) {
      await db
        .update(outboundMessages)
        .set({
          status: "canceled",
          canceledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(outboundMessages.id, msg.id),
          // Defense-in-depth: never overwrite a row already in `sent`.
          // The DB trigger also blocks this, but failing fast in the app
          // surfaces the bug instead of relying on a SQL exception.
          ne(outboundMessages.status, "sent"),
        ));
      logger.info(`[PostJobMomentum] Canceled old confirmation ${msg.id} for reschedule`);
    }
  } else if (!isReschedule && existingConfirmations.length > 0) {
    logger.info(`[PostJobMomentum] Confirmation already exists for job ${job.id}, skipping`);
    return;
  }
  
  const channel = job.clientPhone ? "sms" : "email";
  const clientFirstName = job.clientName?.split(" ")[0] || "there";
  
  // Format date and time for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };
  
  // Generate confirm token
  const crypto = await import("crypto");
  const confirmToken = crypto.randomBytes(16).toString("base64url");
  const confirmUrl = `${process.env.FRONTEND_URL || "https://account.gigaid.ai"}/confirm/${confirmToken}`;
  
  // Store token on job for confirmation tracking
  await db
    .update(jobs)
    .set({ clientConfirmToken: confirmToken })
    .where(eq(jobs.id, job.id));
  
  const template = settings.confirmationTemplate || 
    "Hi {{client_first_name}} — just confirming we're set for {{job_date}} at {{job_time}}. Reply YES to confirm, or let me know if anything changes.";
  
  const renderedMessage = renderTemplate(template, {
    client_first_name: clientFirstName,
    client_name: job.clientName || "",
    job_title: job.title || "",
    job_date: formatDate(job.scheduledDate),
    job_time: formatTime(job.scheduledTime),
    confirm_link: confirmUrl,
  });
  
  // Schedule immediately (send within next scheduler run)
  const now = new Date();
  
  await db.insert(outboundMessages).values({
    userId,
    jobId: job.id,
    channel,
    toAddress,
    type: "confirmation",
    status: "scheduled",
    scheduledFor: now.toISOString(), // Send immediately
    templateRendered: renderedMessage,
    metadata: JSON.stringify({
      jobTitle: job.title,
      scheduledDate: job.scheduledDate,
      scheduledTime: job.scheduledTime,
      isReschedule,
    }),
    createdAt: now.toISOString(),
  });
  
  logger.info(`[PostJobMomentum] Scheduled ${isReschedule ? "reschedule " : ""}confirmation for job ${job.id}`);
}

// Cancel a scheduled message
export async function cancelOutboundMessage(messageId: string, userId: string): Promise<boolean> {
  const result = await db
    .update(outboundMessages)
    .set({
      status: "canceled",
      canceledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(outboundMessages.id, messageId),
        eq(outboundMessages.userId, userId),
        inArray(outboundMessages.status, ["scheduled", "queued"])
      )
    )
    .returning();
  
  if (result.length > 0) {
    logger.info(`[PostJobMomentum] Canceled message ${messageId}`);
    return true;
  }
  return false;
}

// Get scheduled messages for a job
export async function getScheduledMessagesForJob(jobId: string, userId: string): Promise<OutboundMessage[]> {
  return db
    .select()
    .from(outboundMessages)
    .where(
      and(
        eq(outboundMessages.jobId, jobId),
        eq(outboundMessages.userId, userId)
      )
    );
}

// Scheduler worker: process due messages
export async function processScheduledMessages(): Promise<number> {
  const now = new Date().toISOString();
  
  // Find messages that are scheduled and due
  const dueMessages = await db
    .select()
    .from(outboundMessages)
    .where(
      and(
        eq(outboundMessages.status, "scheduled"),
        lte(outboundMessages.scheduledFor, now)
      )
    )
    .limit(50); // Process in batches
  
  let processed = 0;
  
  for (const message of dueMessages) {
    try {
      // Transition to queued (with idempotency check)
      const updated = await db
        .update(outboundMessages)
        .set({ 
          status: "queued",
          updatedAt: new Date().toISOString()
        })
        .where(
          and(
            eq(outboundMessages.id, message.id),
            eq(outboundMessages.status, "scheduled") // Idempotency
          )
        )
        .returning();
      
      if (updated.length === 0) {
        continue; // Already processed by another worker
      }
      
      // Run send-time policy chain + provider call.
      const outcome = await attemptSendMessage(message);

      if (outcome.kind === "sent") {
        // Atomic terminal transition: only flip queued -> sent. Combined with
        // the partial unique index on (booking_page_id, type), this guarantees
        // a row already in `sent` cannot be flipped back or re-enqueued.
        await db
          .update(outboundMessages)
          .set({
            status: "sent",
            sentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(and(
            eq(outboundMessages.id, message.id),
            eq(outboundMessages.status, "queued"),
          ));
        logger.info(`[OutboundMessages] Sent ${message.type} message ${message.id}`);
      } else if (outcome.kind === "canceled") {
        // Cancel the message with a structured failureReason (user_opted_out,
        // rate_limited, action_taken, user_not_found). Atomic on queued so
        // we never overwrite a row another worker raced to "sent".
        await db
          .update(outboundMessages)
          .set({
            status: "canceled",
            canceledAt: new Date().toISOString(),
            failureReason: outcome.reason.substring(0, 500),
            updatedAt: new Date().toISOString(),
          })
          .where(and(
            eq(outboundMessages.id, message.id),
            eq(outboundMessages.status, "queued"),
          ));
        logger.info(`[OutboundMessages] Canceled ${message.type} message ${message.id} (${outcome.reason})`);
      }
      // "deferred" leaves it as "queued" for the next worker tick (e.g. no provider configured).

      processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await db
        .update(outboundMessages)
        .set({
          status: "failed",
          failureReason: errorMessage.substring(0, 500),
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(outboundMessages.id, message.id),
          // Defense-in-depth: a thrown error during a "sent" race must
          // never demote the row back to "failed". The DB trigger backs
          // this up.
          ne(outboundMessages.status, "sent"),
        ));
      
      logger.error(`[PostJobMomentum] Failed to send message ${message.id}:`, errorMessage);
    }
  }
  
  return processed;
}

// Attempt to send message via available provider
async function attemptSendMessage(message: OutboundMessage): Promise<SendOutcome> {
  // ----- SMS-only guards -----
  // Email is exempt from opt-out and the SMS rate limit by design (spec).
  if (message.channel === "sms") {
    // Look up the user once and reuse for opt-out + first-name rendering.
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, message.userId))
      .limit(1);

    // Collect remaining policy inputs so the pure evaluateSendPolicy chain
    // can decide. Reuses HEAD's isSmsRateLimited (24h cap, applies to all
    // SMS types) for the rate-limit signal — kept as a separate function so
    // ad-hoc callers (e.g. growth tooling) can consult it standalone.
    let bookingPageClaimed: boolean | null = null;
    let disqualifyingEventCount = 0;
    if (user && isFirstBookingNudgeType(message.type) && message.bookingPageId) {
      const [page] = await db
        .select()
        .from(bookingPages)
        .where(eq(bookingPages.id, message.bookingPageId))
        .limit(1);
      bookingPageClaimed = page ? page.claimed : null;
      if (page) {
        const disqRows = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(bookingPageEvents)
          .where(and(
            eq(bookingPageEvents.pageId, message.bookingPageId),
            inArray(
              bookingPageEvents.type,
              Array.from(FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES),
            ),
          ));
        disqualifyingEventCount = disqRows[0]?.n ?? 0;
      }
    }

    // Rate-limit signal from HEAD's standalone helper. Pass it into the
    // pure policy chain as a "saturated" recent-count when limited, so
    // evaluateSendPolicy still owns the cancel decision and ordering.
    const rateLimited = user ? await isSmsRateLimited(message.userId) : false;

    const decision = evaluateSendPolicy({
      channel: message.channel,
      type: message.type,
      bookingPageId: message.bookingPageId,
      user: user ? { smsOptOut: user.smsOptOut, notifyBySms: user.notifyBySms } : null,
      bookingPageClaimed,
      disqualifyingEventCount,
      recentSmsSentCount: rateLimited ? SMS_RATE_LIMIT_PER_24H : 0,
      maxSmsPerWindow: SMS_RATE_LIMIT_PER_24H,
    });

    if (decision.kind === "cancel") {
      if (decision.reason === CANCEL_REASONS.USER_NOT_FOUND) {
        logger.warn(`[OutboundMessages] Cancel ${message.id}: user_not_found ${message.userId}`);
      } else if (decision.reason === CANCEL_REASONS.MISSING_BOOKING_PAGE) {
        logger.warn(`[OutboundMessages] Cancel ${message.id}: first-booking nudge missing bookingPageId`);
      } else if (decision.reason === CANCEL_REASONS.RATE_LIMITED) {
        logger.warn(`[OutboundMessages] Cancel ${message.id}: rate_limited (>=${SMS_RATE_LIMIT_PER_24H}/24h)`);
      }
      return { kind: "canceled", reason: decision.reason };
    }

    // After an `allow` decision, user is guaranteed non-null (a null user
    // would have produced a `user_not_found` cancel above).
    const allowedUser = user!;

    // Render body. Locked first-booking nudge bodies are rendered exclusively
    // here, at send time, so first_name is always fresh.
    const body = isFirstBookingNudgeType(message.type)
      ? renderFirstBookingNudgeBody(message.type, allowedUser.firstName)
      : (message.templateRendered || "");

    // Reuse the canonical Twilio sender so credential resolution, error
    // mapping, and number normalization stay in one place.
    const { sendSMS } = await import("./twilio");
    const result = await sendSMS(message.toAddress, body);
    if (result.success) {
      return { kind: "sent", body };
    }
    if (result.errorCode === "NO_FROM_NUMBER") {
      logger.info(`[OutboundMessages] Twilio not configured, deferring ${message.id}`);
      return { kind: "deferred", reason: "no_provider" };
    }
    logger.error(`[OutboundMessages] Twilio send failed: ${result.errorCode} ${result.errorMessage}`);
    throw new Error(result.errorMessage || result.errorCode || "twilio_send_failed");
  }

  // ----- Email path (unchanged behavior) -----
  if (message.channel === "email" && process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = await import("@sendgrid/mail");
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
      const body = message.templateRendered || "";
      await sgMail.default.send({
        to: message.toAddress,
        from: process.env.SENDGRID_FROM_EMAIL || "noreply@gigaid.app",
        subject: message.type === "payment_reminder" ? "Quick reminder about your invoice" : "Thanks for choosing me!",
        text: body,
      });
      return { kind: "sent", body };
    } catch (error) {
      logger.error(`[OutboundMessages] SendGrid send failed:`, error);
      throw error;
    }
  }

  logger.info(`[OutboundMessages] No provider for ${message.channel}, leaving as queued`);
  return { kind: "deferred", reason: "no_provider" };
}

// Start the scheduler (call this from server startup)
let schedulerInterval: NodeJS.Timeout | null = null;

export function startMomentumScheduler(intervalMs: number = 60000): void {
  if (schedulerInterval) {
    return; // Already running
  }
  
  logger.info(`[PostJobMomentum] Starting scheduler with ${intervalMs}ms interval`);
  
  schedulerInterval = setInterval(async () => {
    try {
      const processed = await processScheduledMessages();
      if (processed > 0) {
        logger.info(`[PostJobMomentum] Processed ${processed} messages`);
      }
    } catch (error) {
      logger.error(`[PostJobMomentum] Scheduler error:`, error);
    }
  }, intervalMs);
}

export function stopMomentumScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info(`[PostJobMomentum] Scheduler stopped`);
  }
}
