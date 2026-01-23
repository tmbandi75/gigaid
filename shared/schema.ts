import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  isPro: boolean("is_pro").default(false),
  proExpiresAt: text("pro_expires_at"),
  notifyBySms: boolean("notify_by_sms").default(true),
  notifyByEmail: boolean("notify_by_email").default(true),
  lastActiveAt: text("last_active_at"),
  publicProfileEnabled: boolean("public_profile_enabled").default(false),
  publicProfileSlug: text("public_profile_slug"),
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
  requiredSupportForPayment: boolean("required_support_for_payment").default(false), // If user needed help with payments
});

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
  status: text("status").notNull().default("pending"), // pending, signed_up, rewarded
  rewardAmount: integer("reward_amount").default(0),
  createdAt: text("created_at").notNull(),
  convertedAt: text("converted_at"),
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
export const adminActionKeys = [
  "user_flagged",
  "add_note",
  "reset_onboarding_state",
  "trigger_webhook_retry",
  "suppress_messaging",
  "unsuppress_messaging",
  "send_one_off_push"
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

export * from "./models/chat";
