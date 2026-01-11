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
  createdAt: text("created_at").notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Lead Status
export const leadStatuses = ["new", "contacted", "converted"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

// Lead sources
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
});

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
