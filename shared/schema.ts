import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";
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
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

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

// Voice notes table
export const voiceNotes = pgTable("voice_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  jobId: varchar("job_id"),
  audioUrl: text("audio_url").notNull(),
  transcript: text("transcript"),
  summary: text("summary"),
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

export * from "./models/chat";
