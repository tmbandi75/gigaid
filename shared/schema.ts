import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, doublePrecision, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Onboarding state enum
export const onboardingStates = [
  "not_started",
  "in_progress", 
  "skipped_explore",
  "completed"
] as const;
export type OnboardingState = typeof onboardingStates[number];

// User table with enhanced fields for auth, onboarding, and premium
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name"),
  phone: text("phone"),
  countryCode: text("country_code"),
  email: text("email"),
  photo: text("photo"),
  businessName: text("business_name"),
  services: text("services").array(),
  bio: text("bio"),
  serviceArea: text("service_area"),
  availability: text("availability"), // JSON string: { "monday": { enabled: true, start: "09:00", end: "17:00" }, ... }
  slotDuration: integer("slot_duration").default(60), // in minutes
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStep: integer("onboarding_step").default(0),
  onboardingState: text("onboarding_state").default("not_started"), // not_started, in_progress, skipped_explore, completed
  
  // Money protection fields (required for full functionality)
  defaultServiceType: text("default_service_type"), // Primary service type
  defaultPrice: integer("default_price"), // Default price in cents
  defaultPriceMin: integer("default_price_min"), // Min price for range pricing
  defaultPriceMax: integer("default_price_max"), // Max price for range pricing  
  pricingType: text("pricing_type").default("fixed"), // fixed, range, varies
  depositPolicySet: boolean("deposit_policy_set").default(false), // Whether user explicitly set deposit policy
  
  // AI onboarding shown flag
  aiExpectationShown: boolean("ai_expectation_shown").default(false),
  isPro: boolean("is_pro").default(false),
  proExpiresAt: text("pro_expires_at"),
  notifyBySms: boolean("notify_by_sms").default(true),
  notifyByEmail: boolean("notify_by_email").default(true),
  smsOptOut: boolean("sms_opt_out").notNull().default(false),
  smsOptOutAt: text("sms_opt_out_at"),
  // Resume-confirmation send health. Populated when POST /api/profile/sms/resume
  // tries to send the START-style confirmation text and Twilio rejects it
  // (invalid phone, unverified trial number, generic send failure, or no number
  // on file). Cleared on the next successful confirmation send so the flag
  // tracks the most recent attempt only.
  smsConfirmationLastFailureAt: text("sms_confirmation_last_failure_at"),
  smsConfirmationLastFailureCode: text("sms_confirmation_last_failure_code"),
  smsConfirmationLastFailureMessage: text("sms_confirmation_last_failure_message"),
  // Rolling streak of consecutive resume-confirmation failures. Reset to 0 on
  // any successful confirmation send. Crossing PHONE_UNREACHABLE_THRESHOLD
  // flips phoneUnreachable=true so further outbound SMS is suppressed.
  smsConfirmationFailureCount: integer("sms_confirmation_failure_count").notNull().default(0),
  // Timestamp of the first failure in the current streak (set when the
  // counter goes from 0 -> 1, cleared on success). Lets the admin view show
  // how long the number has been bouncing.
  smsConfirmationFirstFailureAt: text("sms_confirmation_first_failure_at"),
  // Hard "phone is dead" flag. Set when the failure streak crosses the
  // threshold; suppresses outbound SMS via evaluateSendPolicy until the user
  // resumes successfully (or an admin clears it).
  phoneUnreachable: boolean("phone_unreachable").notNull().default(false),
  phoneUnreachableAt: text("phone_unreachable_at"),
  lastActiveAt: text("last_active_at"),
  publicProfileEnabled: boolean("public_profile_enabled").default(true),
  publicProfileSlug: text("public_profile_slug").notNull(),
  showReviewsOnBooking: boolean("show_reviews_on_booking").default(true),
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
  createdAt: text("created_at"),
  
  // Stripe Connect fields
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectStatus: text("stripe_connect_status").default("not_connected"), // not_connected, pending, active, restricted
  stripeConnectOnboardedAt: text("stripe_connect_onboarded_at"),
  
  // Deposit settings for providers
  depositEnabled: boolean("deposit_enabled").default(false),
  depositType: text("deposit_type").default("percent"), // percent, fixed
  depositValue: integer("deposit_value").default(50), // percent 0-100 or cents if fixed
  lateRescheduleWindowHours: integer("late_reschedule_window_hours").default(24),
  lateRescheduleRetainPctFirst: integer("late_reschedule_retain_pct_first").default(40),
  lateRescheduleRetainPctSecond: integer("late_reschedule_retain_pct_second").default(60),
  lateRescheduleRetainPctCap: integer("late_reschedule_retain_pct_cap").default(75),
  
  // Public estimation setting for providers
  publicEstimationEnabled: boolean("public_estimation_enabled").default(true),
  
  // Booking Protection (Guaranteed-Intent Booking) - Phase 1
  noShowProtectionEnabled: boolean("no_show_protection_enabled").default(true), // ON by default
  noShowProtectionDepositPercent: integer("no_show_protection_deposit_percent").default(25), // Default 25%
  noShowProtectionPriceThreshold: integer("no_show_protection_price_threshold").default(10000), // $100 in cents
  
  // Email signature settings
  emailSignatureText: text("email_signature_text"),
  emailSignatureLogoUrl: text("email_signature_logo_url"),
  emailSignatureIncludeLogo: boolean("email_signature_include_logo").default(true),
  
  // Activation funnel tracking
  bookingLinkCreatedAt: text("booking_link_created_at"), // When user first enabled public profile
  bookingLinkSharedAt: text("booking_link_shared_at"), // When user first shared their booking link
  firstPaidBookingAt: text("first_paid_booking_at"), // When user received first paid booking
  firstPaymentReceivedAt: text("first_payment_received_at"), // When user received first payment
  firstQuoteSentAt: text("first_quote_sent_at"), // When user sent their first invoice/quote
  requiredSupportForPayment: boolean("required_support_for_payment").default(false), // If user needed help with payments
  
  // Plan and entitlements
  plan: text("plan").default("free"), // free, pro, pro_plus, business
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // App Store / Play Billing via RevenueCat (webhook + REST sync). Null when billing is Stripe-only or free.
  subscriptionStore: text("subscription_store"), // app_store | play_store
  storeSubscriptionExpiresAt: text("store_subscription_expires_at"),
  storeSubscriptionCancelAtPeriodEnd: boolean("store_subscription_cancel_at_period_end").default(false),
  revenuecatLastProcessedEventId: text("revenuecat_last_processed_event_id"),
  subscriptionCredit: integer("subscription_credit").default(0), // Credit balance in cents from referral rewards
  
  // Firebase Auth fields for mobile authentication
  firebaseUid: text("firebase_uid").unique(),
  emailNormalized: text("email_normalized"),
  phoneE164: text("phone_e164"),
  authProvider: text("auth_provider"), // 'replit' | 'firebase' | null (indicates primary provider)
  updatedAt: text("updated_at"),
  deletedAt: text("deleted_at"), // Soft delete timestamp - Apple App Store compliance
  
  // Admin-controlled comp access
  compAccessGrantedAt: text("comp_access_granted_at"),
  compAccessExpiresAt: text("comp_access_expires_at"),
  compAccessGrantedBy: varchar("comp_access_granted_by"),
  compAccessRevokedAt: text("comp_access_revoked_at"),
  compAccessRevokedBy: varchar("comp_access_revoked_by"),
  
  // Account disable controls
  isDisabled: boolean("is_disabled").default(false),
  disabledAt: text("disabled_at"),
  disabledBy: varchar("disabled_by"),
  disabledReason: text("disabled_reason"),
  enabledAt: text("enabled_at"),
  enabledBy: varchar("enabled_by"),
  
  // Account lifecycle status (user-initiated suspension/cancellation)
  accountStatus: text("account_status").default("active"), // active, suspended, pending_deletion, deleted
  suspendedAt: text("suspended_at"), // When subscription was paused by user
  scheduledDeletionAt: text("scheduled_deletion_at"), // When account is scheduled for permanent deletion
  cancellationRequestedAt: text("cancellation_requested_at"), // When user requested account closure
  cancellationReason: text("cancellation_reason"), // Optional reason provided by user
  
  // Twilio messaging settings
  personalPhone: text("personal_phone"), // User's personal phone for forwarding inbound SMS
  inAppInboxEnabled: boolean("in_app_inbox_enabled").default(false), // If true, store replies in app instead of forwarding
  firstGigaidMessageSentAt: text("first_gigaid_message_sent_at"), // Track first message for tooltip
  
  // Payday onboarding (money-first forced flow for new users)
  paydayOnboardingCompleted: boolean("payday_onboarding_completed").default(false),
  paydayOnboardingStep: integer("payday_onboarding_step").default(0), // 0=welcome,1=stripe,2=booking,3=deposit,4=templates,5=done

  // Activation engine tracking (Phase A: First Dollar in 24 Hours)
  activationServicesDone: boolean("activation_services_done").default(false),
  activationPricingDone: boolean("activation_pricing_done").default(false),
  activationPaymentsDone: boolean("activation_payments_done").default(false),
  activationLinkDone: boolean("activation_link_done").default(false),
  activationQuoteDone: boolean("activation_quote_done").default(false),
  activationCompletedAt: text("activation_completed_at"),

  // Analytics & ATT privacy preferences (DB-persisted)
  analyticsEnabled: boolean("analytics_enabled").default(false),
  attStatus: text("att_status").default("unknown"),
  attPromptedAt: text("att_prompted_at"),
  analyticsDisabledReason: text("analytics_disabled_reason"),

  // Apple Review demo account protection
  isReviewAccount: boolean("is_review_account").default(false),

  // Phone verification (set when the user completes a self-service OTP
  // challenge, e.g. on the post-claim "Secure your account" flow). When
  // set we trust this phone for future identity-merge operations.
  phoneVerifiedAt: text("phone_verified_at"),

  // Tracks when the "your account is secured" confirmation email was sent.
  // Set by both the Firebase-link path and the OTP-only path so neither
  // path ever sends a second copy.
  securedEmailSentAt: text("secured_email_sent_at"),
}, (table) => [
  // Database-level guarantee that no two users can ever share the same
  // booking-link slug. The column is also NOT NULL (see above) so every
  // account is reachable via its public booking URL — the historical
  // `WHERE public_profile_slug IS NOT NULL` clause is kept on the index for
  // backward compatibility with the existing migration definition; it is now
  // a no-op predicate because the column itself rejects NULL.
  // Application code that writes this column MUST be ready for the
  // insert/update to fail with a unique-violation (Postgres SQLSTATE 23505)
  // and retry with the next-available suffix — see
  // `writeUserSlugWithRetry` in `server/lib/bookingSlug.ts`.
  uniqueIndex("users_public_profile_slug_unique_idx")
    .on(table.publicProfileSlug)
    .where(sql`public_profile_slug IS NOT NULL`),
]);

// Privacy events table (internal logging without external analytics)
export const privacyEvents = pgTable("privacy_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  eventName: text("event_name").notNull(),
  payload: jsonb("payload").default({}),
  createdAt: text("created_at").notNull(),
});

export type PrivacyEvent = typeof privacyEvents.$inferSelect;

export const accountDeletions = pgTable("account_deletions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  requestedAt: text("requested_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull().default("requested"),
  tablesCleared: text("tables_cleared").array(),
  stripeCleanup: boolean("stripe_cleanup").default(false),
  posthogCleanup: boolean("posthog_cleanup").default(false),
  errorDetails: text("error_details"),
});

export type AccountDeletion = typeof accountDeletions.$inferSelect;

// Availability type for frontend use
export interface TimeRange {
  start: string; // "09:00"
  end: string; // "17:00"
}

export interface DayAvailability {
  enabled: boolean;
  ranges: TimeRange[]; // Multiple time ranges per day
}

export interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// OTP verification for phone/email auth
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(), // phone or email
  code: text("code").notNull(),
  type: text("type").notNull(), // "phone" or "email"
  expiresAt: text("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: text("created_at").notNull(),
});

export const insertOtpSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
  verified: true,
});

export type InsertOtp = z.infer<typeof insertOtpSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;

// Session tokens
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export type Session = typeof sessions.$inferSelect;

// Job Status
export const jobStatuses = ["scheduled", "in_progress", "completed", "cancelled"] as const;
export type JobStatus = (typeof jobStatuses)[number];

// Client confirmation status
export const clientConfirmStatuses = ["pending", "confirmed", "declined"] as const;
export type ClientConfirmStatus = (typeof clientConfirmStatuses)[number];

// Job payment status
export const jobPaymentStatuses = ["unpaid", "paid"] as const;
export type JobPaymentStatus = (typeof jobPaymentStatuses)[number];

// Job payment methods
export const jobPaymentMethods = ["cash", "zelle", "venmo", "cashapp", "check", "card", "other"] as const;
export type JobPaymentMethod = (typeof jobPaymentMethods)[number];

// Jobs table with enhanced fields
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  serviceType: text("service_type").notNull(),
  location: text("location"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  duration: integer("duration").default(60),
  status: text("status").notNull().default("scheduled"),
  price: integer("price"),
  photos: text("photos").array(),
  voiceNote: text("voice_note"),
  voiceNoteTranscript: text("voice_note_transcript"),
  voiceNoteSummary: text("voice_note_summary"),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  assignedCrewId: text("assigned_crew_id"),
  materials: text("materials"),
  notes: text("notes"),
  clientConfirmStatus: text("client_confirm_status").default("pending"),
  clientConfirmToken: text("client_confirm_token"),
  clientConfirmedAt: text("client_confirmed_at"),
  confirmationSentAt: text("confirmation_sent_at"),
  paymentStatus: text("payment_status").default("unpaid"),
  paymentMethod: text("payment_method"),
  paidAt: text("paid_at"),
  reminder24hSent: boolean("reminder_24h_sent").default(false),
  reminder2hSent: boolean("reminder_2h_sent").default(false),
  customerLat: doublePrecision("customer_lat"),
  customerLng: doublePrecision("customer_lng"),
  providerLat: doublePrecision("provider_lat"),
  providerLng: doublePrecision("provider_lng"),
  providerLocationUpdatedAt: text("provider_location_updated_at"),
  reviewToken: text("review_token"),
  reviewRequestedAt: text("review_requested_at"),
  createdAt: text("created_at").notNull(),
  // No Silent Completion: Track when job status changed to 'completed'
  completedAt: text("completed_at"),
  // Archive support - soft deletion without data loss
  archivedAt: text("archived_at"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// ============================================================
// JOB RESOLUTION - Revenue Protection (No Silent Completion)
// ============================================================
// This table ensures every completed job has explicit payment resolution.
// Without a resolution record, a job CANNOT be marked as completed.
// This prevents revenue leakage from forgotten invoices.

export const jobResolutionTypes = ["invoiced", "paid_without_invoice", "waived"] as const;
export type JobResolutionType = (typeof jobResolutionTypes)[number];

export const waiverReasons = ["warranty", "redo", "goodwill", "internal"] as const;
export type WaiverReason = (typeof waiverReasons)[number];

export const jobResolutions = pgTable("job_resolutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().unique(), // Each job can only have one resolution
  resolutionType: text("resolution_type").notNull(), // 'invoiced', 'paid_without_invoice', 'waived'
  paymentMethod: text("payment_method"), // For paid_without_invoice: cash, zelle, etc.
  waiverReason: text("waiver_reason"), // For waived: warranty, redo, goodwill, internal
  resolvedAt: text("resolved_at").notNull(),
  resolvedByUserId: varchar("resolved_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertJobResolutionSchema = createInsertSchema(jobResolutions).omit({
  id: true,
});

export type InsertJobResolution = z.infer<typeof insertJobResolutionSchema>;
export type JobResolution = typeof jobResolutions.$inferSelect;

// Lead Status
export const leadStatuses = ["new", "response_sent", "engaged", "price_confirmed", "cold", "lost"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

// Lead follow-up status for response tracking
export const leadFollowUpStatuses = ["none", "pending_check", "replied", "waiting", "no_response"] as const;
export type LeadFollowUpStatus = (typeof leadFollowUpStatuses)[number];

// Lead sources (platform types)
export const leadSourceTypes = [
  "craigslist", "facebook", "thumbtack", "instagram", "nextdoor", 
  "yelp", "angi", "homeadvisor", "taskrabbit", "google", 
  "whatsapp", "messenger", "imessage", "sms", "email", "manual", "other"
] as const;
export type LeadSourceType = (typeof leadSourceTypes)[number];

// Lead sources (legacy - keeping for compatibility)
export const leadSources = ["manual", "booking_form", "referral", "social"] as const;
export type LeadSource = (typeof leadSources)[number];

// Leads table with enhanced fields
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  serviceType: text("service_type").notNull(),
  description: text("description"),
  status: text("status").notNull().default("new"),
  source: text("source").default("manual"),
  score: integer("score").default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  lastContactedAt: text("last_contacted_at"),
  convertedAt: text("converted_at"),
  convertedJobId: text("converted_job_id"),
  
  // Response tracking fields
  responseCopiedAt: text("response_copied_at"),
  followUpStatus: text("follow_up_status").default("none"), // none, pending_check, replied, waiting, no_response
  followUpSnoozedUntil: text("follow_up_snoozed_until"),
  
  // Source link fields - URL to original post/conversation
  sourceType: text("source_type"), // craigslist, facebook, thumbtack, etc.
  sourceUrl: text("source_url"), // Full URL to original post
  
  // Intent detection tracking
  respondTapCount: integer("respond_tap_count").default(0), // Number of times user tapped "Respond"
  lastRespondTapAt: text("last_respond_tap_at"), // Last time user tapped "Respond"
  // Archive support - soft deletion without data loss
  archivedAt: text("archived_at"),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Lead Email Conversations - track emails sent to/from leads
export const leadEmailDirections = ["outbound", "inbound"] as const;
export type LeadEmailDirection = (typeof leadEmailDirections)[number];

export const leadEmails = pgTable("lead_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  userId: varchar("user_id").notNull(),
  direction: text("direction").notNull(), // 'outbound' or 'inbound'
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  bodyHtml: text("body_html"),
  trackingId: text("tracking_id"), // Unique ID for matching replies
  inReplyToTrackingId: text("in_reply_to_tracking_id"), // For threading
  sendgridMessageId: text("sendgrid_message_id"),
  sentAt: text("sent_at"),
  receivedAt: text("received_at"),
  createdAt: text("created_at").notNull(),
});

export const insertLeadEmailSchema = createInsertSchema(leadEmails).omit({
  id: true,
  createdAt: true,
});

export type InsertLeadEmail = z.infer<typeof insertLeadEmailSchema>;
export type LeadEmail = typeof leadEmails.$inferSelect;

// Payment Methods (expanded for hybrid system)
export const paymentMethods = ["stripe", "zelle", "venmo", "cashapp", "cash", "check", "other"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

// Payment Status
export const paymentStatuses = ["pending", "processing", "paid", "confirmed", "failed", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

// User Payment Methods - what payment methods a gig worker accepts
export const userPaymentMethods = pgTable("user_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // 'stripe', 'zelle', 'venmo', 'cashapp', 'cash', 'check'
  label: text("label"), // e.g., "@janedoe" for Venmo
  instructions: text("instructions"), // e.g., "Send to janedoe@gmail.com"
  isEnabled: boolean("is_enabled").default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertUserPaymentMethodSchema = createInsertSchema(userPaymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserPaymentMethod = z.infer<typeof insertUserPaymentMethodSchema>;
export type UserPaymentMethod = typeof userPaymentMethods.$inferSelect;

// Job/Invoice Payments - track payments for jobs/invoices
export const jobPayments = pgTable("job_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id"),
  jobId: varchar("job_id"),
  userId: varchar("user_id").notNull(), // the gig worker
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  amount: integer("amount").notNull(), // in cents
  method: text("method").notNull(), // 'stripe', 'zelle', 'venmo', etc.
  status: text("status").notNull().default("pending"), // pending, processing, paid, confirmed, failed
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  proofUrl: text("proof_url"), // for manual payments, screenshot/receipt
  notes: text("notes"),
  paidAt: text("paid_at"),
  confirmedAt: text("confirmed_at"),
  createdAt: text("created_at").notNull(),
});

export const insertJobPaymentSchema = createInsertSchema(jobPayments).omit({
  id: true,
  createdAt: true,
});

export type InsertJobPayment = z.infer<typeof insertJobPaymentSchema>;
export type JobPayment = typeof jobPayments.$inferSelect;

// Invoice Status
export const invoiceStatuses = ["draft", "sent", "paid"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

// Invoices table with enhanced fields
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull(),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id"),
  leadId: varchar("lead_id"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  serviceDescription: text("service_description").notNull(),
  amount: integer("amount").notNull(),
  tax: integer("tax").default(0),
  discount: integer("discount").default(0),
  status: text("status").notNull().default("draft"),
  paymentMethod: text("payment_method"),
  shareLink: text("share_link"),
  offlineDraft: boolean("offline_draft").default(false),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  paidAt: text("paid_at"),
  publicToken: text("public_token"),
  emailSentAt: text("email_sent_at"),
  smsSentAt: text("sms_sent_at"),
  // Intent action tracking
  sourceReadyActionId: varchar("source_ready_action_id"),
  bookingLink: text("booking_link"),
  intentFollowUpSent: boolean("intent_follow_up_sent").default(false),
  intentFollowUpSentAt: text("intent_follow_up_sent_at"),
  // Archive support - soft deletion without data loss
  archivedAt: text("archived_at"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Reminder channels
export const reminderChannels = ["sms", "voice", "email"] as const;
export type ReminderChannel = (typeof reminderChannels)[number];

// Reminder status
export const reminderStatuses = ["pending", "sent", "acknowledged", "failed"] as const;
export type ReminderStatus = (typeof reminderStatuses)[number];

// Reminders table
export const reminders = pgTable("reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id"),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  message: text("message").notNull(),
  channel: text("channel").notNull().default("sms"),
  scheduledAt: text("scheduled_at").notNull(),
  status: text("status").notNull().default("pending"),
  acknowledgedAt: text("acknowledged_at"),
  createdAt: text("created_at").notNull(),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

// Crew member roles
export const crewRoles = ["plumber", "electrician", "cleaner", "helper", "other"] as const;
export type CrewRole = (typeof crewRoles)[number];

// Crew member status
export const crewStatuses = ["invited", "joined", "inactive"] as const;
export type CrewStatus = (typeof crewStatuses)[number];

// Crew members table
export const crewMembers = pgTable("crew_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // owner
  memberUserId: text("member_user_id"), // if registered user
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role").notNull().default("helper"),
  status: text("status").notNull().default("invited"),
  invitedAt: text("invited_at").notNull(),
  joinedAt: text("joined_at"),
});

export const insertCrewMemberSchema = createInsertSchema(crewMembers).omit({
  id: true,
  invitedAt: true,
  joinedAt: true,
  status: true,
});

export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type CrewMember = typeof crewMembers.$inferSelect;

// Crew job invites - magic link system
export const crewInviteStatuses = ["pending", "viewed", "confirmed", "declined", "expired", "revoked"] as const;
export type CrewInviteStatus = (typeof crewInviteStatuses)[number];

export const crewInvites = pgTable("crew_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // owner
  crewMemberId: varchar("crew_member_id").notNull(),
  jobId: varchar("job_id").notNull(),
  token: text("token").notNull().unique(), // secure magic link token
  tokenHash: text("token_hash"), // hashed version for security
  status: text("status").notNull().default("pending"),
  deliveredVia: text("delivered_via"), // "sms", "email", "both"
  deliveredAt: text("delivered_at"),
  viewedAt: text("viewed_at"),
  confirmedAt: text("confirmed_at"),
  declinedAt: text("declined_at"),
  revokedAt: text("revoked_at"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertCrewInviteSchema = createInsertSchema(crewInvites).omit({
  id: true,
  createdAt: true,
  status: true,
  deliveredAt: true,
  viewedAt: true,
  confirmedAt: true,
  declinedAt: true,
  revokedAt: true,
});

export type InsertCrewInvite = z.infer<typeof insertCrewInviteSchema>;
export type CrewInvite = typeof crewInvites.$inferSelect;

// Crew job photos - photos uploaded by crew members
export const crewJobPhotos = pgTable("crew_job_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // owner
  jobId: varchar("job_id").notNull(),
  crewMemberId: varchar("crew_member_id").notNull(),
  crewInviteId: varchar("crew_invite_id"),
  photoUrl: text("photo_url").notNull(),
  caption: text("caption"),
  uploadedAt: text("uploaded_at").notNull(),
});

export const insertCrewJobPhotoSchema = createInsertSchema(crewJobPhotos).omit({
  id: true,
  uploadedAt: true,
});

export type InsertCrewJobPhoto = z.infer<typeof insertCrewJobPhotoSchema>;
export type CrewJobPhoto = typeof crewJobPhotos.$inferSelect;

// Crew messages - messages from crew to owner
export const crewMessages = pgTable("crew_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // owner
  jobId: varchar("job_id").notNull(),
  crewMemberId: varchar("crew_member_id").notNull(),
  crewInviteId: varchar("crew_invite_id"),
  message: text("message").notNull(),
  isFromCrew: boolean("is_from_crew").default(true),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
});

export const insertCrewMessageSchema = createInsertSchema(crewMessages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InsertCrewMessage = z.infer<typeof insertCrewMessageSchema>;
export type CrewMessage = typeof crewMessages.$inferSelect;

// Referrals table
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull(),
  referredEmail: text("referred_email"),
  referredPhone: text("referred_phone"),
  referredUserId: text("referred_user_id"),
  status: text("status").notNull().default("pending"), // pending, signed_up, rewarded, redeemed
  rewardAmount: integer("reward_amount").default(0),
  createdAt: text("created_at").notNull(),
  convertedAt: text("converted_at"),
  redeemedAt: text("redeemed_at"), // When reward was redeemed for subscription credit
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// Deposit status enum
export const depositStatuses = ["none", "pending", "held", "released", "refunded", "partial_refunded", "on_hold_dispute"] as const;
export type DepositStatus = (typeof depositStatuses)[number];

// Completion status enum
export const completionStatuses = ["scheduled", "awaiting_confirmation", "completed", "dispute"] as const;
export type CompletionStatus = (typeof completionStatuses)[number];

// Public booking requests with deposit support
export const bookingRequests = pgTable("booking_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // service provider
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  serviceType: text("service_type").notNull(),
  preferredDate: text("preferred_date"),
  preferredTime: text("preferred_time"),
  description: text("description"),
  location: text("location"),
  status: text("status").notNull().default("pending"), // pending, accepted, declined, cancelled
  createdAt: text("created_at").notNull(),
  
  // Deposit fields
  depositAmountCents: integer("deposit_amount_cents"),
  depositCurrency: text("deposit_currency").default("usd"),
  depositStatus: text("deposit_status").default("none"), // none, pending, held, released, refunded, partial_refunded, on_hold_dispute
  completionStatus: text("completion_status").default("scheduled"), // scheduled, awaiting_confirmation, completed, dispute
  
  // Scheduling timestamps
  jobStartAt: text("job_start_at"),
  jobEndAt: text("job_end_at"),
  autoReleaseAt: text("auto_release_at"),
  
  // Reschedule tracking
  lastRescheduleAt: text("last_reschedule_at"),
  lateRescheduleCount: integer("late_reschedule_count").default(0),
  waiveRescheduleFee: boolean("waive_reschedule_fee").default(false),
  retainedAmountCents: integer("retained_amount_cents").default(0),
  rolledAmountCents: integer("rolled_amount_cents").default(0),
  
  // Stripe integration
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  stripeTransferId: text("stripe_transfer_id"),
  
  // Customer confirmation token
  confirmationToken: text("confirmation_token"),
  
  // Location coordinates (geocoded from location field)
  customerLat: doublePrecision("customer_lat"),
  customerLng: doublePrecision("customer_lng"),
  
  // Remainder payment fields
  totalAmountCents: integer("total_amount_cents"), // Total job price
  remainderPaymentStatus: text("remainder_payment_status").default("pending"), // pending, paid
  remainderPaymentMethod: text("remainder_payment_method"), // zelle, venmo, cashapp, cash, check, stripe
  remainderPaidAt: text("remainder_paid_at"),
  remainderNotes: text("remainder_notes"),
  
  // Policy acknowledgment for booking protection
  policyAcknowledged: boolean("policy_acknowledged").default(false),
  policyAcknowledgedAt: text("policy_acknowledged_at"),
});

// Remainder payment status enum
export const remainderPaymentStatuses = ["pending", "paid"] as const;
export type RemainderPaymentStatus = (typeof remainderPaymentStatuses)[number];

export const insertBookingRequestSchema = createInsertSchema(bookingRequests).omit({
  id: true,
  createdAt: true,
  status: true,
  depositStatus: true,
  completionStatus: true,
  lateRescheduleCount: true,
  waiveRescheduleFee: true,
  retainedAmountCents: true,
  rolledAmountCents: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  stripeTransferId: true,
  confirmationToken: true,
  autoReleaseAt: true,
  lastRescheduleAt: true,
  remainderPaymentStatus: true,
  remainderPaymentMethod: true,
  remainderPaidAt: true,
  remainderNotes: true,
});

export type InsertBookingRequest = z.infer<typeof insertBookingRequestSchema>;
export type BookingRequest = typeof bookingRequests.$inferSelect;

// Booking events table for audit trail
export const bookingEvents = pgTable("booking_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(),
  eventType: text("event_type").notNull(), // created, payment_received, rescheduled, completed, disputed, refunded, transferred
  actorType: text("actor_type").notNull(), // customer, provider, admin, system
  actorId: text("actor_id"),
  metadata: text("metadata"), // JSON string with event details
  createdAt: text("created_at").notNull(),
});

export const insertBookingEventSchema = createInsertSchema(bookingEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertBookingEvent = z.infer<typeof insertBookingEventSchema>;
export type BookingEvent = typeof bookingEvents.$inferSelect;

// Voice note types
export const voiceNoteTypes = ["job", "update", "shareable", "other"] as const;
export type VoiceNoteType = (typeof voiceNoteTypes)[number];

// Voice notes table
export const voiceNotes = pgTable("voice_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id"),
  audioUrl: text("audio_url"),
  transcript: text("transcript"),
  summary: text("summary"),
  keyPoints: text("key_points").array(),
  type: text("type").default("other"),
  duration: integer("duration"),
  createdAt: text("created_at").notNull(),
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type VoiceNote = typeof voiceNotes.$inferSelect;

// Reviews/Testimonials
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // service provider
  jobId: varchar("job_id"),
  invoiceId: varchar("invoice_id"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  providerResponse: text("provider_response"),
  respondedAt: text("responded_at"),
  isPublic: boolean("is_public").default(true),
  createdAt: text("created_at").notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Price Confirmation Status
export const priceConfirmationStatuses = ["draft", "sent", "viewed", "confirmed", "expired"] as const;
export type PriceConfirmationStatus = (typeof priceConfirmationStatuses)[number];

// Price Confirmations table - lightweight price agreement between Lead and Job
export const priceConfirmations = pgTable("price_confirmations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  userId: varchar("user_id").notNull(),
  serviceType: text("service_type"),
  agreedPrice: integer("agreed_price").notNull(), // in cents
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  confirmationToken: text("confirmation_token").notNull().unique(),
  sentAt: text("sent_at"),
  viewedAt: text("viewed_at"),
  confirmedAt: text("confirmed_at"),
  convertedJobId: text("converted_job_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertPriceConfirmationSchema = createInsertSchema(priceConfirmations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  viewedAt: true,
  confirmedAt: true,
  convertedJobId: true,
});

export type InsertPriceConfirmation = z.infer<typeof insertPriceConfirmationSchema>;
export type PriceConfirmation = typeof priceConfirmations.$inferSelect;

// Onboarding checklist items
export const onboardingItems = [
  { id: "add_service", title: "Add Service", description: "Add your first service type" },
  { id: "set_availability", title: "Set Availability", description: "Set your working hours" },
  { id: "share_booking", title: "Share Booking Link", description: "Share your booking link with clients" },
  { id: "set_reminder", title: "Set Reminder", description: "Create your first reminder" },
] as const;

export type OnboardingItemId = typeof onboardingItems[number]["id"];

// Dashboard summary types
export interface DashboardSummary {
  totalJobs: number;
  completedJobs: number;
  totalLeads: number;
  newLeads: number;
  totalEarnings: number;
  totalInvoices: number;
  sentInvoices: number;
  upcomingJobs: Job[];
  recentLeads: Lead[];
  pendingReminders?: number;
  weeklyStats?: WeeklyStats;
  monthlyStats?: MonthlyStats;
}

export interface WeeklyStats {
  jobsThisWeek: number;
  leadsThisWeek: number;
  earningsThisWeek: number;
  completionRate: number;
}

export interface MonthlyStats {
  jobsThisMonth: number;
  leadsThisMonth: number;
  earningsThisMonth: number;
  completionRate: number;
}

// Smart reply suggestions
export interface SmartReply {
  id: string;
  text: string;
  context: string;
}

// Public profile data
export interface PublicProfile {
  name: string;
  photo: string | null;
  businessName: string | null;
  services: string[];
  bio: string | null;
  rating: number;
  reviewCount: number;
  reviews: Review[];
}

// Feature Flags table for safe rollout of new features
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  updatedAt: text("updated_at"),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;

// AI Nudge types
export const nudgeTypes = [
  "lead_follow_up",
  "lead_convert_to_job",
  "lead_silent_rescue",
  "lead_hot_alert",
  "invoice_reminder",
  "invoice_reminder_firm",
  "invoice_overdue_escalation",
  "invoice_create_from_job_done",
  "invoice_weekly_summary",
  "job_stuck",
  "job_unresolved_payment" // Blocking nudge for jobs completed without resolution
] as const;
export type NudgeType = (typeof nudgeTypes)[number];

// AI Nudge statuses
export const nudgeStatuses = ["active", "dismissed", "snoozed", "acted", "expired"] as const;
export type NudgeStatus = (typeof nudgeStatuses)[number];

// AI Nudge entity types
export const nudgeEntityTypes = ["lead", "invoice", "job"] as const;
export type NudgeEntityType = (typeof nudgeEntityTypes)[number];

// AI Nudges table - stores generated nudge instances
export const aiNudges = pgTable("ai_nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entityType: text("entity_type").notNull(), // 'lead', 'invoice', 'job'
  entityId: varchar("entity_id").notNull(),
  nudgeType: text("nudge_type").notNull(),
  priority: integer("priority").notNull().default(50),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  lastShownAt: text("last_shown_at"),
  snoozedUntil: text("snoozed_until"),
  actionPayload: text("action_payload").default("{}"), // JSON: prefilled message, suggested job fields, etc
  explainText: text("explain_text").notNull().default(""), // 1 sentence: "AI suggests…"
  dedupeKey: text("dedupe_key").notNull().unique(), // prevents duplicates
  confidence: doublePrecision("confidence"), // 0..1 optional
});

export const insertAiNudgeSchema = createInsertSchema(aiNudges).omit({
  id: true,
});

export type InsertAiNudge = z.infer<typeof insertAiNudgeSchema>;
export type AiNudge = typeof aiNudges.$inferSelect;

// AI Nudge event types
export const nudgeEventTypes = ["created", "shown", "dismissed", "snoozed", "acted", "expired"] as const;
export type NudgeEventType = (typeof nudgeEventTypes)[number];

// AI Nudge Events table - audit trail
export const aiNudgeEvents = pgTable("ai_nudge_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nudgeId: varchar("nudge_id").notNull(),
  userId: varchar("user_id").notNull(),
  eventType: text("event_type").notNull(),
  eventAt: text("event_at").notNull(),
  metadata: text("metadata").default("{}"), // JSON
});

export const insertAiNudgeEventSchema = createInsertSchema(aiNudgeEvents).omit({
  id: true,
});

export type InsertAiNudgeEvent = z.infer<typeof insertAiNudgeEventSchema>;
export type AiNudgeEvent = typeof aiNudgeEvents.$inferSelect;

// Deposit metadata (stored as JSON in priceConfirmation.notes or job.notes)
export interface DepositMetadata {
  depositType: "flat" | "percent" | null; // null = no deposit requested
  depositAmount: number | null; // cents for flat, 1-100 for percent
  depositRequestedCents?: number; // computed deposit amount in cents
}

// Derived deposit state (computed from jobPayments)
export interface DerivedDepositState {
  hasDeposit: boolean;
  depositRequestedCents: number;
  depositPaidCents: number;
  depositPendingCents?: number;
  depositOutstandingCents?: number;
  depositBalanceCents: number;
  isLocked: boolean; // true if deposit paid
  isDepositFullyPaid?: boolean;
  refundedAt?: string;
}

// Job with derived deposit state (for UI display)
export interface JobWithDeposit extends Job {
  deposit?: DerivedDepositState;
}

// Helper to parse deposit metadata from notes field
export function parseDepositMetadata(notes: string | null): DepositMetadata | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed.depositType) return parsed as DepositMetadata;
    return null;
  } catch {
    // Try to find embedded [DEPOSIT_META:...] format
    const match = notes.match(/\[DEPOSIT_META:([^\]]+)\]/);
    if (match) {
      try {
        return JSON.parse(match[1]) as DepositMetadata;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Helper to extract deposit metadata from notes (supports both formats)
export function extractDepositMetadata(notes: string | null): DepositMetadata | null {
  if (!notes) return null;
  // Try embedded format first
  const match = notes.match(/\[DEPOSIT_META:([^\]]+)\]/);
  if (match) {
    try {
      return JSON.parse(match[1]) as DepositMetadata;
    } catch {
      // Fall through to JSON format
    }
  }
  // Try JSON format
  try {
    const parsed = JSON.parse(notes);
    if (parsed.depositType) return parsed as DepositMetadata;
  } catch {
    // Not valid JSON
  }
  return null;
}

// Helper to embed deposit metadata in notes field
export function embedDepositMetadata(existingNotes: string | null, deposit: DepositMetadata): string {
  const existing = existingNotes ? { originalNotes: existingNotes } : {};
  return JSON.stringify({ ...existing, ...deposit });
}

// QuickBook Job Drafts - for "Paste message → booked" flow
export const jobDraftStatuses = ["draft", "link_sent", "booked", "expired"] as const;
export type JobDraftStatus = (typeof jobDraftStatuses)[number];

export const jobDrafts = pgTable("job_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sourceText: text("source_text").notNull(),
  parsedFields: text("parsed_fields").notNull().default("{}"),
  confidence: text("confidence").notNull().default("{}"),
  status: text("status").notNull().default("draft"),
  bookingLinkUrl: text("booking_link_url"),
  bookingLinkToken: text("booking_link_token"),
  paymentConfig: text("payment_config").default("{}"),
  jobId: varchar("job_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  expiresAt: text("expires_at"),
});

export const insertJobDraftSchema = createInsertSchema(jobDrafts).omit({
  id: true,
});

export type InsertJobDraft = z.infer<typeof insertJobDraftSchema>;
export type JobDraft = typeof jobDrafts.$inferSelect;

export interface ParsedJobFields {
  service?: string;
  dateTimeStart?: string;
  dateTimeEnd?: string;
  locationText?: string;
  locationLat?: number;
  locationLng?: number;
  priceAmount?: number;
  currency?: string;
  durationMins?: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
}

export interface FieldConfidence {
  overall: number;
  service?: number;
  dateTime?: number;
  location?: number;
  price?: number;
  client?: number;
}

export interface PaymentConfig {
  type: "deposit" | "full" | "after";
  depositAmount?: number;
  depositPercent?: number;
}

// Action Queue Items - for "Today's Money Plan" global prioritization
export const actionQueueSourceTypes = ["lead", "job", "invoice", "nudge", "system"] as const;
export type ActionQueueSourceType = (typeof actionQueueSourceTypes)[number];

export const actionQueueActionTypes = [
  "follow_up_lead",
  "reply_hot_lead",
  "convert_lead_to_job",
  "navigate_to_job",
  "start_job",
  "complete_job",
  "create_invoice",
  "send_invoice_reminder",
  "resolve_payment",
  "review_unpaid_invoices",
  "review_stalled_leads"
] as const;
export type ActionQueueActionType = (typeof actionQueueActionTypes)[number];

export const actionQueueStatuses = ["open", "done", "dismissed", "snoozed"] as const;
export type ActionQueueStatus = (typeof actionQueueStatuses)[number];

export const actionQueueItems = pgTable("action_queue_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sourceType: text("source_type").notNull(), // lead, job, invoice, nudge, system
  sourceId: varchar("source_id"), // nullable - system items may not have source
  actionType: text("action_type").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  explainText: text("explain_text").notNull().default(""),
  ctaPrimaryLabel: text("cta_primary_label").notNull(),
  ctaPrimaryAction: text("cta_primary_action").notNull().default("{}"), // JSON
  ctaSecondaryLabel: text("cta_secondary_label"),
  ctaSecondaryAction: text("cta_secondary_action"), // JSON
  priorityScore: integer("priority_score").notNull(),
  dueAt: text("due_at"),
  status: text("status").notNull().default("open"),
  snoozedUntil: text("snoozed_until"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
});

export const insertActionQueueItemSchema = createInsertSchema(actionQueueItems).omit({
  id: true,
});

export type InsertActionQueueItem = z.infer<typeof insertActionQueueItemSchema>;
export type ActionQueueItem = typeof actionQueueItems.$inferSelect;

// Outcome Metrics Daily - for "GigAid Impact" attribution
export const outcomeMetricsDaily = pgTable("outcome_metrics_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  metricDate: text("metric_date").notNull(), // YYYY-MM-DD
  invoicesPaidCount: integer("invoices_paid_count").notNull().default(0),
  invoicesPaidAmount: integer("invoices_paid_amount").notNull().default(0), // cents
  avgDaysToPaid: doublePrecision("avg_days_to_paid"),
  remindersSentCount: integer("reminders_sent_count").notNull().default(0),
  nudgesActedCount: integer("nudges_acted_count").notNull().default(0),
  leadsConvertedCount: integer("leads_converted_count").notNull().default(0),
  estimatedDaysSaved: doublePrecision("estimated_days_saved").notNull().default(0),
  estimatedCashAccelerated: integer("estimated_cash_accelerated").notNull().default(0), // cents
  createdAt: text("created_at"),
});

export const insertOutcomeMetricsDailySchema = createInsertSchema(outcomeMetricsDaily).omit({
  id: true,
});

export type InsertOutcomeMetricsDaily = z.infer<typeof insertOutcomeMetricsDailySchema>;
export type OutcomeMetricsDaily = typeof outcomeMetricsDaily.$inferSelect;

// ============================================================
// PHOTO ASSETS - User-uploaded photos for bookings, reviews, jobs
// ============================================================
export const photoSourceTypes = ["booking", "review", "job"] as const;
export type PhotoSourceType = (typeof photoSourceTypes)[number];

export const photoVisibilities = ["private", "public"] as const;
export type PhotoVisibility = (typeof photoVisibilities)[number];

export const photoAssets = pgTable("photo_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id"), // null for customer-uploaded (booking/review)
  workspaceUserId: varchar("workspace_user_id").notNull(), // the provider's user ID
  sourceType: text("source_type").notNull(), // booking, review, job
  sourceId: varchar("source_id").notNull(), // ID of the booking/review/job
  storageBucket: text("storage_bucket").notNull(),
  storagePath: text("storage_path").notNull(),
  visibility: text("visibility").notNull().default("private"), // private, public
  createdAt: text("created_at").notNull(),
});

export const insertPhotoAssetSchema = createInsertSchema(photoAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertPhotoAsset = z.infer<typeof insertPhotoAssetSchema>;
export type PhotoAsset = typeof photoAssets.$inferSelect;

// Aggregated outcome stats for UI display
export interface OutcomeStats {
  totalCollected: number; // cents
  invoicesPaidCount: number;
  avgDaysToPaid: number | null;
  remindersSentCount: number;
  nudgesActedCount: number;
  leadsConvertedCount: number;
  estimatedDaysSaved: number;
  estimatedCashAccelerated: number; // cents
  hasEnoughData: boolean;
}

// ============================================================
// ESTIMATION REQUESTS - For Provider Review Required flow
// ============================================================
export const estimationRequestStatuses = ["pending", "reviewed", "sent", "expired", "cancelled"] as const;
export type EstimationRequestStatus = (typeof estimationRequestStatuses)[number];

export const estimationRequests = pgTable("estimation_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull(),
  categoryId: text("category_id").notNull(),
  serviceType: text("service_type"),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  description: text("description"),
  photos: text("photos").array(),
  measurementArea: doublePrecision("measurement_area"),
  measurementLinear: doublePrecision("measurement_linear"),
  measurementUnit: text("measurement_unit"),
  location: text("location"),
  aiEstimateLow: integer("ai_estimate_low"),
  aiEstimateHigh: integer("ai_estimate_high"),
  aiConfidence: text("ai_confidence"),
  providerEstimateLow: integer("provider_estimate_low"),
  providerEstimateHigh: integer("provider_estimate_high"),
  providerNotes: text("provider_notes"),
  status: text("status").notNull().default("pending"),
  reviewedAt: text("reviewed_at"),
  sentAt: text("sent_at"),
  confirmToken: text("confirm_token"),
  confirmedAt: text("confirmed_at"),
  convertedToJobId: varchar("converted_to_job_id"),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at"),
});

export const insertEstimationRequestSchema = createInsertSchema(estimationRequests).omit({
  id: true,
  createdAt: true,
});

export type InsertEstimationRequest = z.infer<typeof insertEstimationRequestSchema>;
export type EstimationRequest = typeof estimationRequests.$inferSelect;

// ============================================================
// SMS MESSAGES - For tracking sent/received SMS with routing
// ============================================================
export const smsMessageDirections = ["outbound", "inbound"] as const;
export type SmsMessageDirection = (typeof smsMessageDirections)[number];

export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // The gig worker who owns this conversation
  clientPhone: text("client_phone").notNull(), // The customer's phone number
  clientName: text("client_name"), // Optional client name for display
  direction: text("direction").notNull(), // "outbound" or "inbound"
  body: text("body").notNull(), // The message content
  twilioSid: text("twilio_sid"), // Twilio message SID for tracking
  relatedJobId: varchar("related_job_id"), // Optional link to a job
  relatedLeadId: varchar("related_lead_id"), // Optional link to a lead
  isRead: boolean("is_read").default(false), // For inbound messages
  createdAt: text("created_at").notNull(),
});

export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;

// ============================================================
// MESSAGE USAGE - Track monthly message limits per plan
// ============================================================
export const messageUsage = pgTable("message_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  outboundSent: integer("outbound_sent").notNull().default(0), // Messages sent via GigAid this period
  inboundForwarded: integer("inbound_forwarded").notNull().default(0), // Replies forwarded to phone
  inboundStored: integer("inbound_stored").notNull().default(0), // Replies stored in-app
  periodStart: text("period_start").notNull(), // Start of billing period (ISO date)
  periodEnd: text("period_end").notNull(), // End of billing period (ISO date)
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertMessageUsageSchema = createInsertSchema(messageUsage).omit({
  id: true,
  createdAt: true,
});

export type InsertMessageUsage = z.infer<typeof insertMessageUsageSchema>;
export type MessageUsage = typeof messageUsage.$inferSelect;

// Message limits per plan
export const MESSAGE_LIMITS = {
  free: { outbound: 25, inboundForward: 50 },
  pro: { outbound: 100, inboundForward: 200 },
  pro_plus: { outbound: 500, inboundForward: -1 }, // -1 = unlimited
  business: { outbound: -1, inboundForward: -1 }, // -1 = unlimited
} as const;

// ============================================================
// CO-PILOT / ADMIN COCKPIT - Founder analytics and guidance
// ============================================================

// Canonical Events - All business events for analytics
export const eventsCanonical = pgTable("events_canonical", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  occurredAt: text("occurred_at").notNull(),
  userId: varchar("user_id"), // nullable for system events
  orgId: varchar("org_id"), // nullable
  eventName: text("event_name").notNull(),
  context: text("context"), // JSON
  source: text("source").notNull().default("system"), // web, mobile, system
  version: integer("version").notNull().default(1),
});

export const insertEventsCanonicalSchema = createInsertSchema(eventsCanonical).omit({
  id: true,
});

export type InsertEventsCanonical = z.infer<typeof insertEventsCanonicalSchema>;
export type EventsCanonical = typeof eventsCanonical.$inferSelect;

// Signal types for Co-Pilot alerts
export const copilotSignalTypes = ["informational", "warning", "critical", "opportunity"] as const;
export type CopilotSignalType = (typeof copilotSignalTypes)[number];

export const copilotSignalStatuses = ["active", "resolved"] as const;
export type CopilotSignalStatus = (typeof copilotSignalStatuses)[number];

// Co-Pilot Signals - Alerts and anomalies detected
export const copilotSignals = pgTable("copilot_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull(),
  signalType: text("signal_type").notNull(), // informational, warning, critical, opportunity
  signalKey: text("signal_key").notNull(), // e.g. activation_rate_down_wow
  windowStart: text("window_start"),
  windowEnd: text("window_end"),
  severity: integer("severity").notNull().default(50), // 0-100
  summary: text("summary").notNull(),
  explanation: text("explanation"), // why it fired
  status: text("status").notNull().default("active"), // active, resolved
  resolvedAt: text("resolved_at"),
  links: text("links"), // JSON - deep links to external dashboards
});

export const insertCopilotSignalSchema = createInsertSchema(copilotSignals).omit({
  id: true,
});

export type InsertCopilotSignal = z.infer<typeof insertCopilotSignalSchema>;
export type CopilotSignal = typeof copilotSignals.$inferSelect;

// Health states for recommendations
export const copilotHealthStates = ["green", "yellow", "red"] as const;
export type CopilotHealthState = (typeof copilotHealthStates)[number];

// Primary bottlenecks
export const copilotBottlenecks = ["activation", "retention", "monetization"] as const;
export type CopilotBottleneck = (typeof copilotBottlenecks)[number];

export const copilotRecommendationStatuses = ["active", "expired", "superseded"] as const;
export type CopilotRecommendationStatus = (typeof copilotRecommendationStatuses)[number];

// Co-Pilot Recommendations - Focus guidance
export const copilotRecommendations = pgTable("copilot_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull(),
  recKey: text("rec_key").notNull(), // e.g. focus_send_estimates
  healthState: text("health_state").notNull(), // green, yellow, red
  primaryBottleneck: text("primary_bottleneck").notNull(), // activation, retention, monetization
  biggestFunnelLeak: text("biggest_funnel_leak"),
  recommendationText: text("recommendation_text").notNull(),
  rationale: text("rationale"), // explains drivers + metrics
  urgencyScore: integer("urgency_score").notNull().default(50), // 0-100
  impactEstimate: text("impact_estimate"), // JSON - revenue_at_risk, users_affected
  expiresAt: text("expires_at"),
  status: text("status").notNull().default("active"), // active, expired, superseded
});

export const insertCopilotRecommendationSchema = createInsertSchema(copilotRecommendations).omit({
  id: true,
});

export type InsertCopilotRecommendation = z.infer<typeof insertCopilotRecommendationSchema>;
export type CopilotRecommendation = typeof copilotRecommendations.$inferSelect;

// Metrics Daily - Aggregated daily rollup for fast queries
export const metricsDaily = pgTable("metrics_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricDate: text("metric_date").notNull().unique(), // YYYY-MM-DD
  totalUsers: integer("total_users").notNull().default(0),
  newUsersToday: integer("new_users_today").notNull().default(0),
  activeUsers7d: integer("active_users_7d").notNull().default(0),
  activeUsers30d: integer("active_users_30d").notNull().default(0),
  payingCustomers: integer("paying_customers").notNull().default(0),
  mrr: integer("mrr").notNull().default(0), // cents
  netChurnPct: doublePrecision("net_churn_pct").notNull().default(0),
  firstBookingRate: doublePrecision("first_booking_rate"),
  medianTimeToFirstBooking: doublePrecision("median_time_to_first_booking"), // hours
  failedPayments24h: integer("failed_payments_24h").notNull().default(0),
  failedPayments7d: integer("failed_payments_7d").notNull().default(0),
  revenueAtRisk: integer("revenue_at_risk").notNull().default(0), // cents
  chargebacks30d: integer("chargebacks_30d").notNull().default(0),
  payingUsersInactive7d: integer("paying_users_inactive_7d").notNull().default(0),
  churnedUsers7d: integer("churned_users_7d").notNull().default(0),
  churnedUsers30d: integer("churned_users_30d").notNull().default(0),
  bookingsPerActiveUser: doublePrecision("bookings_per_active_user"),
  totalLeads: integer("total_leads").notNull().default(0),
  leadsConverted: integer("leads_converted").notNull().default(0),
  totalJobs: integer("total_jobs").notNull().default(0),
  jobsCompleted: integer("jobs_completed").notNull().default(0),
  totalInvoices: integer("total_invoices").notNull().default(0),
  invoicesPaid: integer("invoices_paid").notNull().default(0),
  createdAt: text("created_at"),
});

export const insertMetricsDailySchema = createInsertSchema(metricsDaily).omit({
  id: true,
});

export type InsertMetricsDaily = z.infer<typeof insertMetricsDailySchema>;
export type MetricsDaily = typeof metricsDaily.$inferSelect;

// Attribution Daily - Channel performance tracking
export const attributionDaily = pgTable("attribution_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricDate: text("metric_date").notNull(), // YYYY-MM-DD
  channel: text("channel").notNull(), // utm_source / referrer grouping
  signups: integer("signups").notNull().default(0),
  activations: integer("activations").notNull().default(0),
  activationRate: doublePrecision("activation_rate"),
  notes: text("notes"), // JSON
  createdAt: text("created_at"),
});

export const insertAttributionDailySchema = createInsertSchema(attributionDaily).omit({
  id: true,
});

export type InsertAttributionDaily = z.infer<typeof insertAttributionDailySchema>;
export type AttributionDaily = typeof attributionDaily.$inferSelect;

// ============================================================
// ADMIN ACTION AUDIT - Immutable log of admin actions
// ============================================================
// ============================================================
// ADMIN ROLES - Role-based access control for admins
// ============================================================
export const adminRoles = ["super_admin", "admin", "read_only"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  name: text("name"),
  role: text("role").notNull().default("read_only"),
  enabled: boolean("enabled").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: text("created_at").notNull(),
  createdBy: varchar("created_by"),
  lastLoginAt: text("last_login_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("admins_user_id_idx").on(table.userId),
  index("admins_email_idx").on(table.email),
]);

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;

export const adminActionKeys = [
  "user_flagged",
  "add_note",
  "reset_onboarding_state",
  "trigger_webhook_retry",
  "suppress_messaging",
  "unsuppress_messaging",
  "send_one_off_push",
  "billing_upgrade",
  "billing_downgrade",
  "billing_grant_comp",
  "billing_revoke_comp",
  "billing_pause",
  "billing_resume",
  "billing_cancel",
  "billing_apply_credit",
  "billing_refund",
  "account_disable",
  "account_enable",
  "admin_created",
  "admin_updated",
  "admin_deactivated",
  "sms_attach_optout_event_to_user",
  "sms_rate_limit_override_set"
] as const;
export type AdminActionKey = (typeof adminActionKeys)[number];

export const adminActionAudit = pgTable("admin_action_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull(),
  actorUserId: varchar("actor_user_id").notNull(),
  actorEmail: text("actor_email"),
  targetUserId: varchar("target_user_id"),
  actionKey: text("action_key").notNull(),
  reason: text("reason").notNull(),
  payload: text("payload"), // JSON
  source: text("source").notNull().default("admin_ui"),
}, (table) => [
  index("admin_action_audit_target_user_idx").on(table.targetUserId, table.createdAt),
  index("admin_action_audit_action_key_idx").on(table.actionKey, table.createdAt),
]);

export const insertAdminActionAuditSchema = createInsertSchema(adminActionAudit).omit({
  id: true,
});

export type InsertAdminActionAudit = z.infer<typeof insertAdminActionAuditSchema>;
export type AdminActionAudit = typeof adminActionAudit.$inferSelect;

// ============================================================
// USER ADMIN NOTES - Internal notes on users
// ============================================================
export const userAdminNotes = pgTable("user_admin_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  actorUserId: varchar("actor_user_id").notNull(),
  targetUserId: varchar("target_user_id").notNull(),
  note: text("note").notNull(),
}, (table) => [
  index("user_admin_notes_target_user_idx").on(table.targetUserId, table.createdAt),
]);

export const insertUserAdminNoteSchema = createInsertSchema(userAdminNotes).omit({
  id: true,
});

export type InsertUserAdminNote = z.infer<typeof insertUserAdminNoteSchema>;
export type UserAdminNote = typeof userAdminNotes.$inferSelect;

// ============================================================
// USER FLAGS - Flagged users for admin attention
// ============================================================
export const userFlags = pgTable("user_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  flaggedAt: text("flagged_at").notNull(),
  flaggedBy: varchar("flagged_by").notNull(),
  reason: text("reason").notNull(),
  unflaggedAt: text("unflagged_at"),
  unflaggedBy: varchar("unflagged_by"),
}, (table) => [
  index("user_flags_user_idx").on(table.userId),
]);

export const insertUserFlagSchema = createInsertSchema(userFlags).omit({
  id: true,
});

export type InsertUserFlag = z.infer<typeof insertUserFlagSchema>;
export type UserFlag = typeof userFlags.$inferSelect;

// ============================================================
// MESSAGING SUPPRESSION - Temporarily suppress messaging for users
// ============================================================
export const messagingSuppression = pgTable("messaging_suppression", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  suppressedAt: text("suppressed_at").notNull(),
  suppressedBy: varchar("suppressed_by").notNull(),
  suppressUntil: text("suppress_until").notNull(),
  reason: text("reason").notNull(),
  unsuppressedAt: text("unsuppressed_at"),
  unsuppressedBy: varchar("unsuppressed_by"),
}, (table) => [
  index("messaging_suppression_user_idx").on(table.userId),
]);

export const insertMessagingSuppressionSchema = createInsertSchema(messagingSuppression).omit({
  id: true,
});

export type InsertMessagingSuppression = z.infer<typeof insertMessagingSuppressionSchema>;
export type MessagingSuppression = typeof messagingSuppression.$inferSelect;

// ============================================================
// NEXT BEST ACTION ENGINE - Stall Detection & Recommendations
// ============================================================

// Stall types for different entity conditions
export const stallTypes = ["no_response", "overdue", "idle", "draft_aging", "viewed_unpaid"] as const;
export type StallType = (typeof stallTypes)[number];

// Entity types that can be stalled
export const stallEntityTypes = ["lead", "job", "invoice"] as const;
export type StallEntityType = (typeof stallEntityTypes)[number];

// Detected stalls - internal tracking only (not shown to user directly)
export const stallDetections = pgTable("stall_detections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entityType: text("entity_type").notNull(), // lead, job, invoice
  entityId: varchar("entity_id").notNull(),
  stallType: text("stall_type").notNull(), // no_response, overdue, idle, draft_aging, viewed_unpaid
  moneyAtRisk: integer("money_at_risk").default(0), // in cents
  confidence: doublePrecision("confidence").default(0.5), // 0.0 - 1.0
  detectedAt: text("detected_at").notNull(),
  resolvedAt: text("resolved_at"), // when stall was resolved
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("stall_detections_user_idx").on(table.userId, table.entityType),
  index("stall_detections_entity_idx").on(table.entityType, table.entityId),
]);

export const insertStallDetectionSchema = createInsertSchema(stallDetections).omit({
  id: true,
});

export type InsertStallDetection = z.infer<typeof insertStallDetectionSchema>;
export type StallDetection = typeof stallDetections.$inferSelect;

// Action types that can be recommended
export const nextActionTypes = [
  "send_follow_up_text",
  "send_invoice_reminder", 
  "suggest_call",
  "suggest_status_update",
  "auto_send_gentle_nudge",
  "no_action"
] as const;
export type NextActionType = (typeof nextActionTypes)[number];

// Next actions - one per entity, surfaced to user
export const nextActions = pgTable("next_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  stallDetectionId: varchar("stall_detection_id").notNull(),
  entityType: text("entity_type").notNull(), // lead, job, invoice
  entityId: varchar("entity_id").notNull(),
  recommendedAction: text("recommended_action").notNull(), // from nextActionTypes
  reason: text("reason").notNull(), // plain English, ≤12 words
  autoExecutable: boolean("auto_executable").default(false),
  expiresAt: text("expires_at").notNull(),
  actedAt: text("acted_at"), // when user took action
  dismissedAt: text("dismissed_at"), // when user dismissed
  autoExecutedAt: text("auto_executed_at"), // when system auto-executed
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("next_actions_user_idx").on(table.userId, table.entityType),
  index("next_actions_entity_idx").on(table.entityType, table.entityId),
]);

export const insertNextActionSchema = createInsertSchema(nextActions).omit({
  id: true,
});

export type InsertNextAction = z.infer<typeof insertNextActionSchema>;
export type NextAction = typeof nextActions.$inferSelect;

// Auto-execution log - track what was automatically sent
export const autoExecutionLog = pgTable("auto_execution_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  nextActionId: varchar("next_action_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  actionType: text("action_type").notNull(),
  messageContent: text("message_content"), // what was sent
  deliveryChannel: text("delivery_channel"), // sms, email
  executedAt: text("executed_at").notNull(),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
}, (table) => [
  index("auto_execution_log_user_idx").on(table.userId),
  index("auto_execution_log_entity_idx").on(table.entityType, table.entityId),
]);

export const insertAutoExecutionLogSchema = createInsertSchema(autoExecutionLog).omit({
  id: true,
});

export type InsertAutoExecutionLog = z.infer<typeof insertAutoExecutionLogSchema>;
export type AutoExecutionLog = typeof autoExecutionLog.$inferSelect;

// ==================== INTENT SIGNALS ====================
// Behavioral intent detection for "ready to convert" moments

export const intentSignalTypes = [
  "time_cue",         // Client mentioned time ("tomorrow", "9am", "next week")
  "price_cue",        // Client mentioned price ("how much", "estimate", "$", "cost")
  "status_engaged",   // Lead status moved to "engaged"
  "job_completed",    // Job marked as completed
  "multiple_responds" // User tapped "Respond" more than once on same lead
] as const;
export type IntentSignalType = (typeof intentSignalTypes)[number];

export const intentSignals = pgTable("intent_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entityType: text("entity_type").notNull(), // lead, job
  entityId: varchar("entity_id").notNull(),
  signalType: text("signal_type").notNull(), // from intentSignalTypes
  triggerText: text("trigger_text"), // The text that triggered the signal (e.g., "tomorrow at 9am")
  confidence: doublePrecision("confidence").default(0.8),
  detectedAt: text("detected_at").notNull(),
  processedAt: text("processed_at"), // When we generated an action from this
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("intent_signals_user_idx").on(table.userId),
  index("intent_signals_entity_idx").on(table.entityType, table.entityId),
]);

export const insertIntentSignalSchema = createInsertSchema(intentSignals).omit({
  id: true,
});

export type InsertIntentSignal = z.infer<typeof insertIntentSignalSchema>;
export type IntentSignal = typeof intentSignals.$inferSelect;

// ==================== READY-TO-SEND ACTIONS ====================
// Pre-filled actions that are ready to execute with one tap

export const readyActionTypes = [
  "send_invoice",      // Pre-filled invoice ready to send
  "send_booking_link", // Booking link with prefilled details
  "send_follow_up"     // Follow-up message
] as const;
export type ReadyActionType = (typeof readyActionTypes)[number];

export const readyActions = pgTable("ready_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  intentSignalId: varchar("intent_signal_id"), // Optional link to triggering intent
  entityType: text("entity_type").notNull(), // lead, job, invoice
  entityId: varchar("entity_id").notNull(),
  actionType: text("action_type").notNull(), // from readyActionTypes
  headline: text("headline").notNull(), // "This looks ready to turn into money."
  subtext: text("subtext").notNull(), // "Recommended next step: Send invoice + booking link"
  ctaLabel: text("cta_label").notNull().default("Send & Get Paid"), // Button text
  
  // Pre-filled invoice data
  prefilledAmount: doublePrecision("prefilled_amount"), // AI-estimated or last-used
  prefilledClientName: text("prefilled_client_name"),
  prefilledClientEmail: text("prefilled_client_email"),
  prefilledClientPhone: text("prefilled_client_phone"),
  prefilledDueDate: text("prefilled_due_date"), // Auto-set (e.g., 7 days from now)
  prefilledServiceType: text("prefilled_service_type"),
  prefilledDescription: text("prefilled_description"),
  
  // State
  expiresAt: text("expires_at").notNull(),
  actedAt: text("acted_at"),
  dismissedAt: text("dismissed_at"),
  autoFollowUpSent: boolean("auto_follow_up_sent").default(false),
  autoFollowUpSentAt: text("auto_follow_up_sent_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("ready_actions_user_idx").on(table.userId),
  index("ready_actions_entity_idx").on(table.entityType, table.entityId),
]);

export const insertReadyActionSchema = createInsertSchema(readyActions).omit({
  id: true,
});

export type InsertReadyAction = z.infer<typeof insertReadyActionSchema>;
export type ReadyAction = typeof readyActions.$inferSelect;

// ==================== AI OVERRIDE TRACKING ====================
// Tracks when users modify AI-suggested values for continuous learning

export const aiOverrideTypes = [
  "amount_changed",       // User adjusted the suggested amount
  "cta_dismissed",        // User dismissed the recommendation
  "cta_expired",          // Action expired without user interaction
  "different_action",     // User took a different action than recommended
  "manual_invoice",       // User created invoice manually instead of using suggestion
] as const;
export type AiOverrideType = (typeof aiOverrideTypes)[number];

export const aiOverrides = pgTable("ai_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entityType: text("entity_type").notNull(), // lead, job, invoice
  entityId: varchar("entity_id").notNull(),
  overrideType: text("override_type").notNull(), // from aiOverrideTypes
  
  // Original suggestion
  originalAction: text("original_action"),
  originalAmount: doublePrecision("original_amount"),
  originalTiming: text("original_timing"),
  
  // User's override
  userAction: text("user_action"),
  userAmount: doublePrecision("user_amount"),
  delaySeconds: doublePrecision("delay_seconds"),
  
  // Context signals for learning
  confidenceScore: doublePrecision("confidence_score"),
  intentSignals: text("intent_signals").array(),
  timeOfDay: text("time_of_day"),
  jobType: text("job_type"),
  
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("ai_overrides_user_idx").on(table.userId),
  index("ai_overrides_entity_idx").on(table.entityType, table.entityId),
  index("ai_overrides_type_idx").on(table.overrideType),
]);

export const insertAiOverrideSchema = createInsertSchema(aiOverrides).omit({
  id: true,
});

export type InsertAiOverride = z.infer<typeof insertAiOverrideSchema>;
export type AiOverride = typeof aiOverrides.$inferSelect;

// ==================== BOOKING PROTECTION (Guaranteed-Intent Booking) ====================
// Phase 1: Rules-based booking protection to reduce no-shows

// Client tracking for risk assessment
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // The provider who has this client
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  isFirstTime: boolean("is_first_time").default(true),
  cancellationCount: integer("cancellation_count").default(0),
  noShowCount: integer("no_show_count").default(0),
  totalBookings: integer("total_bookings").default(0),
  lastBookingAt: text("last_booking_at"),
  optedOutOfNotifications: boolean("opted_out_of_notifications").default(false),
  depositOverridePercent: integer("deposit_override_percent"), // null = use default, 0-100 = custom percentage
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("clients_user_idx").on(table.userId),
  index("clients_phone_idx").on(table.clientPhone),
  index("clients_email_idx").on(table.clientEmail),
]);

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Booking protection records - tracks deposits and protection status per booking
export const bookingProtections = pgTable("booking_protections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().unique(),
  userId: varchar("user_id").notNull(),
  clientId: varchar("client_id"),
  
  // Risk assessment data (stored for transparency, not shown to user)
  isFirstTimeClient: boolean("is_first_time_client").default(false),
  bookingLeadTimeHours: integer("booking_lead_time_hours"),
  bookingPrice: integer("booking_price"), // in cents
  clientCancellationCount: integer("client_cancellation_count").default(0),
  
  // Protection status
  isProtected: boolean("is_protected").default(false),
  depositRequired: boolean("deposit_required").default(false),
  depositAmountCents: integer("deposit_amount_cents"),
  depositPaidAt: text("deposit_paid_at"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  
  // Client acknowledgment
  cancellationPolicyAcknowledgedAt: text("cancellation_policy_acknowledged_at"),
  phoneVerifiedAt: text("phone_verified_at"),
  
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("booking_protections_job_idx").on(table.jobId),
  index("booking_protections_user_idx").on(table.userId),
]);

export const insertBookingProtectionSchema = createInsertSchema(bookingProtections).omit({
  id: true,
});

export type InsertBookingProtection = z.infer<typeof insertBookingProtectionSchema>;
export type BookingProtection = typeof bookingProtections.$inferSelect;

// AI Interventions - tracks the rare moments when AI speaks to user
export const interventionTypes = [
  "booking_risk_adjustment",  // Silent deposit/prepay adjustment
  "risk_protection",          // "This client often cancels. A deposit is now required."
  "revenue_risk",            // "This lead converts best if replied to soon."
] as const;
export type InterventionType = (typeof interventionTypes)[number];

export const aiInterventions = pgTable("ai_interventions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  interventionType: text("intervention_type").notNull(), // from interventionTypes
  entityType: text("entity_type"), // job, lead, invoice
  entityId: varchar("entity_id"),
  
  // The one-sentence message (null for silent adjustments)
  message: text("message"),
  
  // Whether user saw it (for silent ones, always false)
  isSilent: boolean("is_silent").default(false),
  displayedAt: text("displayed_at"),
  dismissedAt: text("dismissed_at"),
  
  // Action taken (if any)
  actionTaken: text("action_taken"),
  
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("ai_interventions_user_idx").on(table.userId),
  index("ai_interventions_date_idx").on(table.createdAt),
]);

export const insertAiInterventionSchema = createInsertSchema(aiInterventions).omit({
  id: true,
});

export type InsertAiIntervention = z.infer<typeof insertAiInterventionSchema>;
export type AiIntervention = typeof aiInterventions.$inferSelect;

// ==================== EVENT-DRIVEN CLIENT NOTIFICATIONS ====================
// Safe, event-driven notification system for re-engaging past clients

// Event types - FIXED ENUM, do not extend without code change
export const notificationEventTypes = [
  "environmental", // weather-related (snow, rain, etc.)
  "seasonal",      // time of year (spring cleaning, fall prep)
  "availability",  // provider has openings
  "risk",          // safety/maintenance risks (frozen pipes, etc.)
  "relationship",  // time since last service
] as const;
export type NotificationEventType = (typeof notificationEventTypes)[number];

// Service categories with allowed event types - HARD RULES (18 categories)
export const serviceCategories = [
  "snow_removal",
  "lawn_landscaping",
  "cleaning",
  "handyman_repairs",
  "moving_hauling",
  "power_washing",
  "plumbing",
  "electrical",
  "hvac",
  "roofing",
  "painting",
  "pool_spa_service",
  "pest_control",
  "appliance_repair",
  "window_cleaning",
  "carpet_flooring",
  "locksmith",
  "auto_detailing",
  "other",
] as const;
export type ServiceCategory = (typeof serviceCategories)[number];

// Categories that require licensing verification
export const licensedRequiredCategories: ServiceCategory[] = ["electrical"];

// Category to event type mapping (immutable, per specification)
export const categoryEventMapping: Record<ServiceCategory, NotificationEventType[]> = {
  snow_removal: ["environmental", "risk", "availability"],
  lawn_landscaping: ["seasonal", "environmental", "relationship"],
  cleaning: ["seasonal", "availability", "relationship"],
  handyman_repairs: ["risk", "environmental", "relationship"],
  moving_hauling: ["seasonal", "availability", "relationship"],
  power_washing: ["seasonal", "environmental", "relationship"],
  plumbing: ["risk", "environmental", "relationship"],
  electrical: ["risk", "environmental", "relationship"], // Requires licensed === true
  hvac: ["environmental", "seasonal", "risk", "relationship"],
  roofing: ["environmental", "risk", "relationship"],
  painting: ["seasonal", "availability", "relationship"],
  pool_spa_service: ["seasonal", "environmental", "relationship"],
  pest_control: ["seasonal", "environmental", "risk", "relationship"],
  appliance_repair: ["risk", "availability", "relationship"],
  window_cleaning: ["seasonal", "availability", "relationship"],
  carpet_flooring: ["seasonal", "availability", "relationship"],
  locksmith: ["risk", "relationship"],
  auto_detailing: ["seasonal", "environmental", "availability", "relationship"],
  other: ["relationship"], // RELATIONSHIP only, no AI suggestions allowed
};

// Categories where AI suggestions are NOT allowed
export const noAiSuggestionCategories: ServiceCategory[] = ["other"];

// Provider services table - tracks services offered with categories
export const providerServices = pgTable("provider_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(), // from serviceCategories
  description: text("description"),
  licensed: boolean("licensed").default(false), // Required true for electrical category
  isActive: boolean("is_active").default(true),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("provider_services_user_idx").on(table.userId),
  index("provider_services_category_idx").on(table.category),
]);

export const insertProviderServiceSchema = createInsertSchema(providerServices).omit({
  id: true,
});

export type InsertProviderService = z.infer<typeof insertProviderServiceSchema>;
export type ProviderService = typeof providerServices.$inferSelect;

// Client notification campaigns - tracks sent campaigns
export const clientNotificationCampaigns = pgTable("client_notification_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceId: varchar("service_id").notNull(),
  eventType: text("event_type").notNull(), // from notificationEventTypes
  eventReason: text("event_reason").notNull(), // max 120 chars, why this event is relevant
  channel: text("channel").notNull(), // "sms" or "email"
  bookingLink: text("booking_link").notNull(),
  messageContent: text("message_content").notNull(),
  recipientCount: integer("recipient_count").default(0),
  sentAt: text("sent_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("campaigns_user_idx").on(table.userId),
  index("campaigns_service_idx").on(table.serviceId),
  index("campaigns_sent_idx").on(table.sentAt),
]);

export const insertCampaignSchema = createInsertSchema(clientNotificationCampaigns).omit({
  id: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type ClientNotificationCampaign = typeof clientNotificationCampaigns.$inferSelect;

// Campaign suggestions - AI-suggested campaigns (advisory only)
export const campaignSuggestions = pgTable("campaign_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceId: varchar("service_id").notNull(),
  eventType: text("event_type").notNull(), // from notificationEventTypes
  detectedSignal: text("detected_signal").notNull(), // what triggered the suggestion
  suggestedMessage: text("suggested_message"),
  estimatedEligibleClients: integer("estimated_eligible_clients").default(0),
  status: text("status").default("pending"), // pending, dismissed, converted
  dismissedAt: text("dismissed_at"),
  convertedToCampaignId: varchar("converted_to_campaign_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("campaign_suggestions_user_idx").on(table.userId),
  index("campaign_suggestions_status_idx").on(table.status),
]);

export const insertCampaignSuggestionSchema = createInsertSchema(campaignSuggestions).omit({
  id: true,
});

export type InsertCampaignSuggestion = z.infer<typeof insertCampaignSuggestionSchema>;
export type CampaignSuggestion = typeof campaignSuggestions.$inferSelect;

// ============================================================================
// POST-JOB MOMENTUM ENGINE
// Automated follow-up and payment reminder scheduling after job completion
// ============================================================================

// User automation settings for post-job follow-ups
export const userAutomationSettings = pgTable("user_automation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  
  // Follow-up settings
  postJobFollowupEnabled: boolean("post_job_followup_enabled").default(true),
  followupDelayHours: integer("followup_delay_hours").default(24), // 24 or 48
  followupTemplate: text("followup_template").default(
    "Hi {{client_first_name}} — thanks again for choosing me. If you need anything else, just reply here."
  ),
  
  // Payment reminder settings
  paymentReminderEnabled: boolean("payment_reminder_enabled").default(true),
  paymentReminderDelayHours: integer("payment_reminder_delay_hours").default(24),
  paymentReminderTemplate: text("payment_reminder_template").default(
    "Hi {{client_first_name}} — quick note: the invoice for {{job_title}} is still open. No rush—sharing here in case it got buried: {{invoice_link}}"
  ),
  
  // Review link
  reviewLinkUrl: text("review_link_url"),
  
  // Auto-confirmation settings
  autoConfirmEnabled: boolean("auto_confirm_enabled").default(true),
  confirmationTemplate: text("confirmation_template").default(
    "Hi {{client_first_name}} — just confirming we're set for {{job_date}} at {{job_time}}. Reply YES to confirm, or let me know if anything changes."
  ),

  // Per-user override for the rolling-24h SMS rate-limit cap. NULL means
  // "use the plan default from CAPABILITY_RULES['sms.rate_limit_per_24h']".
  // A positive integer overrides the plan default. 0 or negative means unlimited.
  smsRateLimitPer24hOverride: integer("sms_rate_limit_per_24h_override"),

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (table) => [
  index("user_automation_settings_user_idx").on(table.userId),
]);

export const insertUserAutomationSettingsSchema = createInsertSchema(userAutomationSettings).omit({
  id: true,
});

export type InsertUserAutomationSettings = z.infer<typeof insertUserAutomationSettingsSchema>;
export type UserAutomationSettings = typeof userAutomationSettings.$inferSelect;

// Outbound message types
export const outboundMessageTypes = ["followup", "payment_reminder", "review_request", "confirmation"] as const;
export type OutboundMessageType = typeof outboundMessageTypes[number];

// Outbound message channels
export const outboundMessageChannels = ["sms", "email", "inapp"] as const;
export type OutboundMessageChannel = typeof outboundMessageChannels[number];

// Outbound message statuses
export const outboundMessageStatuses = ["scheduled", "queued", "sent", "canceled", "failed"] as const;
export type OutboundMessageStatus = typeof outboundMessageStatuses[number];

// Outbound messages queue for scheduled follow-ups and reminders
export const outboundMessages = pgTable("outbound_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id"), // nullable: standalone messages (e.g. first-booking nudges) have no job
  clientId: varchar("client_id"),
  bookingPageId: varchar("booking_page_id"), // nullable: links nudge messages back to a booking_pages row for cancellation
  
  channel: text("channel").notNull(), // sms, email, inapp
  toAddress: text("to_address").notNull(), // phone or email
  type: text("type").notNull(), // followup, payment_reminder, review_request
  status: text("status").notNull().default("scheduled"), // scheduled, queued, sent, canceled, failed
  
  scheduledFor: text("scheduled_for").notNull(), // ISO timestamp
  sentAt: text("sent_at"),
  canceledAt: text("canceled_at"),
  failureReason: text("failure_reason"),
  
  templateRendered: text("template_rendered"), // Final rendered message
  metadata: text("metadata"), // JSON: job_title, invoice_id, etc

  // Set on email sends to round-trip the SendGrid message id (the `sg_message_id`
  // field on every event in the SendGrid event webhook payload). Lets us
  // correlate webhook events back to the originating outbound_messages row when
  // SendGrid omits our customArgs (some bounce/dropped events do).
  providerMessageId: text("provider_message_id"),

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (table) => [
  index("outbound_messages_status_scheduled_idx").on(table.status, table.scheduledFor),
  index("outbound_messages_job_type_idx").on(table.jobId, table.type),
  index("outbound_messages_user_status_idx").on(table.userId, table.status),
  // Partial unique index: prevents duplicate first-booking nudges per booking page
  // while a row is still scheduled, queued, or sent. Because `sent` is included
  // in the predicate, a sent row permanently blocks any future insert of the
  // same (booking_page_id, type), making "sent" terminal at the database level.
  uniqueIndex("outbound_messages_first_booking_dedupe_idx")
    .on(table.bookingPageId, table.type)
    .where(sql`type IN ('first_booking_nudge_10m', 'first_booking_nudge_24h', 'first_booking_nudge_72h', 'first_booking_email_2h', 'first_booking_email_48h') AND status IN ('scheduled', 'queued', 'sent')`),
  // Used by the rate limiter to count recent SMS sends per user.
  index("outbound_messages_user_channel_sent_idx").on(table.userId, table.channel, table.sentAt),
  // Lookup by SendGrid message id when the webhook arrives without customArgs.
  index("outbound_messages_provider_message_id_idx").on(table.providerMessageId),
]);

export const insertOutboundMessageSchema = createInsertSchema(outboundMessages).omit({
  id: true,
});

export type InsertOutboundMessage = z.infer<typeof insertOutboundMessageSchema>;
export type OutboundMessage = typeof outboundMessages.$inferSelect;

// ============================================================================
// OUTBOUND MESSAGE EVENTS (Task #81)
// One row per SendGrid event-webhook delivery (open, click, delivered, etc.)
// for outbound emails. Currently populated only for first-booking emails so we
// can compute open / click / downstream-first-booking rates per touch.
// ============================================================================

export const outboundMessageEventTypes = [
  "processed",
  "delivered",
  "open",
  "click",
  "bounce",
  "dropped",
  "deferred",
  "spamreport",
  "unsubscribe",
  "group_unsubscribe",
  "group_resubscribe",
] as const;
export type OutboundMessageEventType = typeof outboundMessageEventTypes[number];

export const outboundMessageEvents = pgTable("outbound_message_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  outboundMessageId: varchar("outbound_message_id").notNull(),
  // Mirrored from outbound_messages.type so per-touch aggregations don't have
  // to JOIN. Always populated by the webhook handler from the parent row.
  messageType: text("message_type").notNull(),
  eventType: text("event_type").notNull(),
  // ISO timestamp from the SendGrid event payload (`timestamp` is unix seconds).
  occurredAt: text("occurred_at").notNull(),
  // Click events carry the URL that was clicked. NULL for other event types.
  url: text("url"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  // SendGrid's per-event id. Used to dedupe re-deliveries of the same event.
  sgEventId: text("sg_event_id"),
  // SendGrid's per-message id (X-Message-Id header). Useful for grouping all
  // events from a single send and for the fallback lookup on outbound_messages.
  sgMessageId: text("sg_message_id"),
  // Full event payload, persisted as JSON for forensic / audit use.
  rawPayload: text("raw_payload"),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("outbound_message_events_message_idx").on(table.outboundMessageId, table.eventType),
  index("outbound_message_events_type_event_idx").on(table.messageType, table.eventType),
  index("outbound_message_events_occurred_idx").on(table.occurredAt),
  // Dedupe re-deliveries from SendGrid. Plain unique index — Postgres treats
  // multiple NULLs as distinct, so we can safely insert events that lack an
  // sg_event_id (defensive — should never happen) without breaking ON CONFLICT
  // inference for the dedupe upsert. (A partial unique index here would force
  // every upsert to repeat the WHERE predicate as a `targetWhere` clause.)
  uniqueIndex("outbound_message_events_sg_event_id_idx").on(table.sgEventId),
]);

export const insertOutboundMessageEventSchema = createInsertSchema(outboundMessageEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertOutboundMessageEvent = z.infer<typeof insertOutboundMessageEventSchema>;
export type OutboundMessageEvent = typeof outboundMessageEvents.$inferSelect;

// Audit trail of inbound STOP webhook deliveries. We persist every STOP we
// receive (matched or not) so the admin SMS Health view can surface
// unmatched opt-outs without operators having to grep raw logs.
export const smsOptOutEvents = pgTable("sms_optout_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Always-stored masked rendering (e.g. +15***4567) for safe display.
  fromPhoneMasked: text("from_phone_masked").notNull(),
  // Raw From value as Twilio delivered it. Sensitive; only exposed to admins.
  fromPhoneRaw: text("from_phone_raw").notNull(),
  // Resolved user when the ambiguity-safe resolver could pin one. Null when
  // unmatched (no users.phoneE164 hit and no recent outbound history) or
  // when the resolver refused due to ambiguity.
  userId: varchar("user_id"),
  // "matched" | "unmatched" | "ambiguous". Lets the UI/summary distinguish
  // between "no user at all" vs "we deliberately refused due to ambiguity".
  resolution: text("resolution").notNull(),
  // Trimmed inbound body (cap 30 chars to mirror existing log policy) so an
  // operator can tell apart STOP/STOPALL/UNSUBSCRIBE etc. when investigating.
  body: text("body"),
  twilioSid: text("twilio_sid"),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("sms_optout_events_created_idx").on(table.createdAt),
  index("sms_optout_events_resolution_created_idx").on(table.resolution, table.createdAt),
]);

export const insertSmsOptOutEventSchema = createInsertSchema(smsOptOutEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertSmsOptOutEvent = z.infer<typeof insertSmsOptOutEventSchema>;
export type SmsOptOutEvent = typeof smsOptOutEvents.$inferSelect;

// Pre-generated booking pages for the Growth Engine acquisition flow.
// Existing user-owned booking pages (resolved via users.publicProfileSlug) are unaffected.
export const bookingPages = pgTable("booking_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone"), // E.164 of the prospect provider, optional
  category: text("category"), // e.g. "moving", "cleaning"
  location: text("location"), // e.g. "Brooklyn"
  claimed: boolean("claimed").notNull().default(false),
  claimedAt: text("claimed_at"),
  claimedByUserId: varchar("claimed_by_user_id"),
  source: text("source"), // e.g. "growth_engine", "user_created"
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("booking_pages_claimed_idx").on(table.claimed),
  index("booking_pages_phone_idx").on(table.phone),
]);

export const insertBookingPageSchema = createInsertSchema(bookingPages).omit({
  id: true,
  claimed: true,
  claimedAt: true,
  claimedByUserId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBookingPage = z.infer<typeof insertBookingPageSchema>;
export type BookingPage = typeof bookingPages.$inferSelect;

export const bookingPageEventTypes = ["page_viewed", "page_claimed", "link_copied", "link_shared", "first_booking_viewed"] as const;
export type BookingPageEventType = typeof bookingPageEventTypes[number];

export const bookingPageEvents = pgTable("booking_page_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull(),
  type: text("type").notNull(),
  variant: text("variant"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("booking_page_events_page_idx").on(table.pageId, table.type),
  index("booking_page_events_variant_idx").on(table.variant, table.type),
  // Partial unique index: a `first_booking_viewed` event should be recorded
  // at most once per booking page (which, post-claim, is 1:1 with its owner).
  // The frontend already ref-guards within a single mount, but reloads and
  // revisits used to record a fresh event each time, inflating view counts
  // and corrupting "viewed -> copied" / "viewed -> shared" funnel math. The
  // storage helper `trackBookingPageEvent` does a check-then-insert for
  // this event type and swallows a unique-violation (Postgres SQLSTATE
  // 23505) as the race tiebreaker; this index is the database-level
  // guarantee that backstops it. Every other event type (page_viewed,
  // page_claimed, link_copied, link_shared) is unaffected because the
  // predicate excludes them.
  uniqueIndex("booking_page_events_first_view_unique_idx")
    .on(table.pageId)
    .where(sql`type = 'first_booking_viewed'`),
]);

export const unclaimedHeadlineVariants = ["back_and_forth", "deposit_first", "speed_first", "social_proof"] as const;
export type UnclaimedHeadlineVariant = typeof unclaimedHeadlineVariants[number];

export const insertBookingPageEventSchema = createInsertSchema(bookingPageEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertBookingPageEvent = z.infer<typeof insertBookingPageEventSchema>;
export type BookingPageEvent = typeof bookingPageEvents.$inferSelect;

// Capability usage tracking for plan limits
export const capabilityUsage = pgTable("capability_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  capability: text("capability").notNull(), // e.g., 'jobs.create', 'sms.two_way'
  usageCount: integer("usage_count").notNull().default(0),
  windowStart: text("window_start"), // ISO timestamp for time-windowed limits
  lastUsedAt: text("last_used_at"),
  // Quota notification tracking. Reset to null when the usage window rolls over so
  // the next window's alerts fire. Stored per-window so we never email twice in the
  // same period.
  alert80SentAt: text("alert_80_sent_at"),
  alert100SentAt: text("alert_100_sent_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (table) => [
  index("capability_usage_user_capability_idx").on(table.userId, table.capability),
]);

export const insertCapabilityUsageSchema = createInsertSchema(capabilityUsage).omit({
  id: true,
});

export type InsertCapabilityUsage = z.infer<typeof insertCapabilityUsageSchema>;
export type CapabilityUsage = typeof capabilityUsage.$inferSelect;

// ============ STRIPE WEBHOOK TABLES ============

// Stripe webhook event statuses
export const stripeWebhookStatuses = ["received", "processed", "failed"] as const;
export type StripeWebhookStatus = typeof stripeWebhookStatuses[number];

// Stripe webhook events - audit trail for all received webhooks
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  type: text("type").notNull(),
  apiVersion: text("api_version"),
  livemode: boolean("livemode").notNull().default(false),
  account: text("account"), // Connect account ID if present
  created: text("created"), // Stripe event created time (ISO)
  payload: text("payload").notNull(), // Full event JSON
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
  status: text("status").notNull().default("received"),
  error: text("error"),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
}, (table) => [
  index("stripe_webhook_events_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
  index("stripe_webhook_events_type_idx").on(table.type),
]);

export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEvents).omit({
  id: true,
});

export type InsertStripeWebhookEvent = z.infer<typeof insertStripeWebhookEventSchema>;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;

// Stripe payment state statuses
export const stripePaymentStatuses = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "canceled",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded"
] as const;
export type StripePaymentStatus = typeof stripePaymentStatuses[number];

// Stripe payment state - canonical payment status used by app
export const stripePaymentState = pgTable("stripe_payment_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentIntentId: text("payment_intent_id").notNull().unique(),
  chargeId: text("charge_id"),
  customerId: text("customer_id"),
  connectedAccountId: text("connected_account_id"),
  amount: integer("amount").notNull(), // cents
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull(),
  lastEventId: text("last_event_id"),
  lastEventType: text("last_event_type"),
  lastUpdatedAt: text("last_updated_at").notNull(),
  metadata: text("metadata"), // JSON copy of PI metadata for mapping
  jobId: varchar("job_id"),
  invoiceId: varchar("invoice_id"),
}, (table) => [
  index("stripe_payment_state_job_idx").on(table.jobId),
  index("stripe_payment_state_invoice_idx").on(table.invoiceId),
  index("stripe_payment_state_status_idx").on(table.status),
]);

export const insertStripePaymentStateSchema = createInsertSchema(stripePaymentState).omit({
  id: true,
});

export type InsertStripePaymentState = z.infer<typeof insertStripePaymentStateSchema>;
export type StripePaymentState = typeof stripePaymentState.$inferSelect;

// Stripe idempotency locks - ensures exactly-once effect per event/handler
export const stripeIdempotencyLocks = pgTable("stripe_idempotency_locks", {
  key: text("key").primaryKey(), // e.g., `${eventId}:${handlerName}`
  createdAt: text("created_at").notNull(),
});

export type StripeIdempotencyLock = typeof stripeIdempotencyLocks.$inferSelect;

// Stripe disputes - tracks chargebacks and dispute state
export const stripeDisputes = pgTable("stripe_disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeDisputeId: text("stripe_dispute_id").notNull().unique(),
  chargeId: text("charge_id"),
  paymentIntentId: text("payment_intent_id"),
  connectedAccountId: text("connected_account_id"),
  amount: integer("amount").notNull(), // cents
  currency: text("currency").notNull().default("usd"),
  reason: text("reason"), // e.g., fraudulent, duplicate, product_not_received
  status: text("status").notNull(), // needs_response, under_review, won, lost
  evidenceDueBy: text("evidence_due_by"),
  evidenceSubmittedAt: text("evidence_submitted_at"),
  lastEventId: text("last_event_id"),
  lastEventType: text("last_event_type"),
  lastUpdatedAt: text("last_updated_at").notNull(),
  metadata: text("metadata"), // JSON copy of dispute metadata
  jobId: varchar("job_id"),
  invoiceId: varchar("invoice_id"),
  bookingId: varchar("booking_id"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  resolvedAt: text("resolved_at"),
  resolution: text("resolution"), // won, lost, withdrawn
}, (table) => [
  index("stripe_disputes_dispute_id_idx").on(table.stripeDisputeId),
  index("stripe_disputes_status_idx").on(table.status),
  index("stripe_disputes_job_idx").on(table.jobId),
  index("stripe_disputes_invoice_idx").on(table.invoiceId),
  index("stripe_disputes_booking_idx").on(table.bookingId),
]);

export const insertStripeDisputeSchema = createInsertSchema(stripeDisputes).omit({
  id: true,
});

export type InsertStripeDispute = z.infer<typeof insertStripeDisputeSchema>;
export type StripeDispute = typeof stripeDisputes.$inferSelect;

// Job Templates - prebuilt job configurations by trade
export const jobTemplates = pgTable("job_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // handyman, cleaning, lawn, moving, tutoring
  description: text("description"),
  defaultPriceCents: integer("default_price_cents").notNull(),
  depositPercent: integer("deposit_percent").default(25),
  estimatedDurationMinutes: integer("estimated_duration_minutes").default(60),
  cancellationPolicy: text("cancellation_policy"),
  messageTemplate: text("message_template"),
  isSystemTemplate: boolean("is_system_template").default(true),
  userId: varchar("user_id"), // null for system templates, set for user-created
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertJobTemplateSchema = createInsertSchema(jobTemplates).omit({
  id: true,
  createdAt: true,
});

export type InsertJobTemplate = z.infer<typeof insertJobTemplateSchema>;
export type JobTemplate = typeof jobTemplates.$inferSelect;

// Follow-up rules for Auto Follow-Up Bot
export const followUpRules = pgTable("follow_up_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  ruleType: text("rule_type").notNull(), // no_reply, quote_pending, unpaid_invoice
  delayHours: integer("delay_hours").notNull(), // hours to wait before triggering
  enabled: boolean("enabled").default(true),
  messageTemplate: text("message_template"),
  channel: text("channel").default("sms"), // sms, email
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertFollowUpRuleSchema = createInsertSchema(followUpRules).omit({
  id: true,
  createdAt: true,
});

export type InsertFollowUpRule = z.infer<typeof insertFollowUpRuleSchema>;
export type FollowUpRule = typeof followUpRules.$inferSelect;

// Follow-up logs - tracks sent auto follow-ups
export const followUpLogs = pgTable("follow_up_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  ruleId: varchar("rule_id"),
  ruleType: text("rule_type").notNull(),
  entityType: text("entity_type").notNull(), // lead, job, invoice
  entityId: varchar("entity_id").notNull(),
  channel: text("channel").notNull(),
  toAddress: text("to_address").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("sent"), // sent, failed, skipped
  sentAt: text("sent_at").notNull().default(sql`now()`),
  failureReason: text("failure_reason"),
});

export type FollowUpLog = typeof followUpLogs.$inferSelect;

// Rebooking rules - per job type rebooking schedules
export const rebookingRules = pgTable("rebooking_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceType: text("service_type").notNull(),
  intervalDays: integer("interval_days").notNull(), // days between rebookings
  enabled: boolean("enabled").default(true),
  messageTemplate: text("message_template"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertRebookingRuleSchema = createInsertSchema(rebookingRules).omit({
  id: true,
  createdAt: true,
});

export type InsertRebookingRule = z.infer<typeof insertRebookingRuleSchema>;
export type RebookingRule = typeof rebookingRules.$inferSelect;

// Rebooking log - tracks sent rebooking reminders
export const rebookingLogs = pgTable("rebooking_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  ruleId: varchar("rule_id"),
  jobId: varchar("job_id").notNull(),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  status: text("status").notNull().default("sent"), // sent, booked, ignored, failed, converted
  sentAt: text("sent_at").notNull().default(sql`now()`),
  rebookedAt: text("rebooked_at"),
  newJobId: varchar("new_job_id"),
  convertedJobId: varchar("converted_job_id"),
  convertedAt: text("converted_at"),
});

export type RebookingLog = typeof rebookingLogs.$inferSelect;

export const priceAdjustments = pgTable("price_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceType: text("service_type").notNull(),
  previousPriceCents: integer("previous_price_cents"),
  newPriceCents: integer("new_price_cents"),
  changePercent: integer("change_percent").notNull(),
  source: text("source").default("price_optimization"),
  status: text("status").default("applied"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertPriceAdjustmentSchema = createInsertSchema(priceAdjustments).omit({ id: true, createdAt: true });
export type InsertPriceAdjustment = z.infer<typeof insertPriceAdjustmentSchema>;
export type PriceAdjustment = typeof priceAdjustments.$inferSelect;

// ============================================================
// CHURN PREDICTION & RETENTION
// ============================================================

export const churnMetrics = pgTable("churn_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  lastLoginDays: integer("last_login_days").notNull().default(0),
  jobs7d: integer("jobs_7d").notNull().default(0),
  msgs7d: integer("msgs_7d").notNull().default(0),
  rev30d: integer("rev_30d").notNull().default(0),
  revDelta: integer("rev_delta").notNull().default(0),
  noPay14d: boolean("no_pay_14d").notNull().default(false),
  failedPayments: integer("failed_payments").notNull().default(0),
  errors7d: integer("errors_7d").notNull().default(0),
  blocks7d: integer("blocks_7d").notNull().default(0),
  limit95Hits: integer("limit_95_hits").notNull().default(0),
  downgradeViews: integer("downgrade_views").notNull().default(0),
  cancelHover: integer("cancel_hover").notNull().default(0),
  score: integer("score").notNull().default(0),
  tier: text("tier").notNull().default("Healthy"),
  computedAt: text("computed_at").notNull().default(sql`now()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("churn_metrics_user_idx").on(table.userId),
  index("churn_metrics_updated_idx").on(table.updatedAt),
  index("churn_metrics_tier_idx").on(table.tier),
]);

export const insertChurnMetricsSchema = createInsertSchema(churnMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChurnMetrics = z.infer<typeof insertChurnMetricsSchema>;
export type ChurnMetrics = typeof churnMetrics.$inferSelect;

export const retentionActions = pgTable("retention_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  tier: text("tier").notNull(),
  actionType: text("action_type").notNull(),
  channel: text("channel").notNull(),
  payload: text("payload"),
  status: text("status").notNull().default("Queued"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  error: text("error"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("retention_actions_user_idx").on(table.userId),
  index("retention_actions_status_idx").on(table.status),
]);

export const insertRetentionActionSchema = createInsertSchema(retentionActions).omit({ id: true, createdAt: true });
export type InsertRetentionAction = z.infer<typeof insertRetentionActionSchema>;
export type RetentionAction = typeof retentionActions.$inferSelect;

export const retentionPlaybooks = pgTable("retention_playbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tier: text("tier").notNull(),
  priority: integer("priority").notNull().default(0),
  actionType: text("action_type").notNull(),
  channel: text("channel").notNull(),
  templateKey: text("template_key").notNull(),
  delayHours: integer("delay_hours").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
});

export const insertRetentionPlaybookSchema = createInsertSchema(retentionPlaybooks).omit({ id: true });
export type InsertRetentionPlaybook = z.infer<typeof insertRetentionPlaybookSchema>;
export type RetentionPlaybook = typeof retentionPlaybooks.$inferSelect;

export const planOverrides = pgTable("plan_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  overrideType: text("override_type").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  createdBy: text("created_by"),
}, (table) => [
  index("plan_overrides_user_idx").on(table.userId),
]);

export const insertPlanOverrideSchema = createInsertSchema(planOverrides).omit({ id: true, createdAt: true });
export type InsertPlanOverride = z.infer<typeof insertPlanOverrideSchema>;
export type PlanOverride = typeof planOverrides.$inferSelect;

// ============================================================
// PHASE 2: ACQUISITION ENGINE
// ============================================================

export const growthLeadStatuses = ["new", "booked", "no_show", "completed", "converted", "disqualified"] as const;
export type GrowthLeadStatus = (typeof growthLeadStatuses)[number];

export const growthLeads = pgTable("growth_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
  name: text("name").notNull(),
  businessName: text("business_name"),
  email: text("email"),
  phone: text("phone"),
  serviceCategory: text("service_category"),
  city: text("city"),
  source: text("source").notNull().default("homepage"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  referrerUserId: varchar("referrer_user_id"),
  status: text("status").notNull().default("new"),
  bookedAt: text("booked_at"),
  onboardedAt: text("onboarded_at"),
  activatedAt: text("activated_at"),
  convertedUserId: varchar("converted_user_id"),
  notes: text("notes"),
}, (table) => [
  index("growth_leads_source_created_idx").on(table.source, table.createdAt),
  index("growth_leads_status_idx").on(table.status),
]);

export const insertGrowthLeadSchema = createInsertSchema(growthLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGrowthLead = z.infer<typeof insertGrowthLeadSchema>;
export type GrowthLead = typeof growthLeads.$inferSelect;

export const onboardingCallOutcomes = ["scheduled", "completed", "no_show", "rescheduled", "converted", "not_fit"] as const;
export type OnboardingCallOutcome = (typeof onboardingCallOutcomes)[number];

export const onboardingCalls = pgTable("onboarding_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
  leadId: varchar("lead_id").notNull(),
  userId: varchar("user_id"),
  scheduledAt: text("scheduled_at").notNull(),
  completedAt: text("completed_at"),
  outcome: text("outcome").notNull().default("scheduled"),
  repUserId: varchar("rep_user_id"),
  calendaringProvider: text("calendaring_provider"),
  metadata: jsonb("metadata"),
}, (table) => [
  index("onboarding_calls_lead_idx").on(table.leadId),
]);

export const insertOnboardingCallSchema = createInsertSchema(onboardingCalls).omit({
  id: true,
  createdAt: true,
});
export type InsertOnboardingCall = z.infer<typeof insertOnboardingCallSchema>;
export type OnboardingCall = typeof onboardingCalls.$inferSelect;

export const acquisitionAttribution = pgTable("acquisition_attribution", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
  userId: varchar("user_id").notNull(),
  source: text("source"),
  landingPath: text("landing_path"),
  referrerUserId: varchar("referrer_user_id"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  firstTouchAt: text("first_touch_at").notNull(),
  lastTouchAt: text("last_touch_at").notNull(),
  touchCount: integer("touch_count").notNull().default(1),
}, (table) => [
  uniqueIndex("acquisition_attribution_user_idx").on(table.userId),
  index("acquisition_attribution_campaign_idx").on(table.utmCampaign, table.createdAt),
]);

export const insertAcquisitionAttributionSchema = createInsertSchema(acquisitionAttribution).omit({
  id: true,
  createdAt: true,
});
export type InsertAcquisitionAttribution = z.infer<typeof insertAcquisitionAttributionSchema>;
export type AcquisitionAttribution = typeof acquisitionAttribution.$inferSelect;

export const growthReferralStatuses = ["clicked", "signed_up", "activated", "rewarded", "expired"] as const;
export type GrowthReferralStatus = (typeof growthReferralStatuses)[number];

export const growthReferrals = pgTable("growth_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
  referrerUserId: varchar("referrer_user_id").notNull(),
  referredUserId: varchar("referred_user_id"),
  referralCode: text("referral_code").notNull(),
  status: text("status").notNull().default("clicked"),
  clickedAt: text("clicked_at"),
  signedUpAt: text("signed_up_at"),
  activatedAt: text("activated_at"),
  rewardedAt: text("rewarded_at"),
}, (table) => [
  index("growth_referrals_referrer_status_idx").on(table.referrerUserId, table.status),
  index("growth_referrals_code_idx").on(table.referralCode),
]);

export const insertGrowthReferralSchema = createInsertSchema(growthReferrals).omit({
  id: true,
  createdAt: true,
});
export type InsertGrowthReferral = z.infer<typeof insertGrowthReferralSchema>;
export type GrowthReferral = typeof growthReferrals.$inferSelect;

export const referralRewardTypes = ["pro_days", "discount", "credit"] as const;
export type ReferralRewardType = (typeof referralRewardTypes)[number];

export const referralRewardStatuses = ["pending", "applied", "failed"] as const;
export type ReferralRewardStatus = (typeof referralRewardStatuses)[number];

export const referralRewards = pgTable("referral_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
  referrerUserId: varchar("referrer_user_id").notNull(),
  referredUserId: varchar("referred_user_id").notNull(),
  rewardType: text("reward_type").notNull().default("pro_days"),
  rewardValue: integer("reward_value").notNull().default(30),
  appliedAt: text("applied_at"),
  status: text("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
}, (table) => [
  index("referral_rewards_referrer_idx").on(table.referrerUserId),
]);

export const insertReferralRewardSchema = createInsertSchema(referralRewards).omit({
  id: true,
  createdAt: true,
});
export type InsertReferralReward = z.infer<typeof insertReferralRewardSchema>;
export type ReferralReward = typeof referralRewards.$inferSelect;

export const outreachStatuses = ["new", "contacted", "replied", "booked", "converted", "dead"] as const;
export type OutreachStatus = (typeof outreachStatuses)[number];

export const outreachQueue = pgTable("outreach_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
  platform: text("platform").notNull(),
  profileUrl: text("profile_url").notNull(),
  handleName: text("handle_name"),
  city: text("city"),
  status: text("status").notNull().default("new"),
  assignedToUserId: varchar("assigned_to_user_id"),
  lastContactedAt: text("last_contacted_at"),
  nextFollowupAt: text("next_followup_at"),
  notes: text("notes"),
}, (table) => [
  index("outreach_queue_status_assigned_idx").on(table.status, table.assignedToUserId, table.nextFollowupAt),
]);

export const insertOutreachQueueSchema = createInsertSchema(outreachQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutreachQueue = z.infer<typeof insertOutreachQueueSchema>;
export type OutreachItem = typeof outreachQueue.$inferSelect;

// ============ REVENUE DRIFT LOGS ============

export const revenueDriftStatuses = ["ok", "warning", "critical"] as const;
export type RevenueDriftStatus = typeof revenueDriftStatuses[number];

export const revenueDriftLogs = pgTable("revenue_drift_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ranAt: text("ran_at").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("ok"),
  depositsExpected: integer("deposits_expected").notNull().default(0),
  depositsActual: integer("deposits_actual").notNull().default(0),
  depositsDelta: integer("deposits_delta").notNull().default(0),
  transfersExpected: integer("transfers_expected").notNull().default(0),
  transfersActual: integer("transfers_actual").notNull().default(0),
  transfersDelta: integer("transfers_delta").notNull().default(0),
  subscriptionsExpected: integer("subscriptions_expected").notNull().default(0),
  subscriptionsActual: integer("subscriptions_actual").notNull().default(0),
  subscriptionsDelta: integer("subscriptions_delta").notNull().default(0),
  triggeredBy: text("triggered_by"), // "scheduled", "admin", "test"
  details: text("details"), // JSON string with additional context
});

export const insertRevenueDriftLogSchema = createInsertSchema(revenueDriftLogs).omit({
  id: true,
});
export type InsertRevenueDriftLog = z.infer<typeof insertRevenueDriftLogSchema>;
export type RevenueDriftLog = typeof revenueDriftLogs.$inferSelect;

// Tracks which duplicate-phone groups support has already been alerted on,
// so the scheduled notifier (server/admin/duplicatePhoneAlertJob.ts) does
// not re-spam support every run. We re-alert if the group grows (new
// colliding user joined) by comparing lastUserCount to the current size.
export const duplicatePhoneAlerts = pgTable("duplicate_phone_alerts", {
  phoneE164: text("phone_e164").primaryKey(),
  lastUserCount: integer("last_user_count").notNull(),
  lastUserIds: text("last_user_ids").notNull(), // JSON-encoded sorted list
  firstAlertedAt: text("first_alerted_at").notNull(),
  lastAlertedAt: text("last_alerted_at").notNull(),
  alertCount: integer("alert_count").notNull().default(1),
});

export type DuplicatePhoneAlert = typeof duplicatePhoneAlerts.$inferSelect;

export * from "./models/chat";
export * from "./models/auth";
