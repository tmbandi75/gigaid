import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
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
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStep: integer("onboarding_step").default(0),
  isPro: boolean("is_pro").default(false),
  proExpiresAt: text("pro_expires_at"),
  notifyBySms: boolean("notify_by_sms").default(true),
  notifyByEmail: boolean("notify_by_email").default(true),
  lastActiveAt: text("last_active_at"),
  publicProfileEnabled: boolean("public_profile_enabled").default(false),
  publicProfileSlug: text("public_profile_slug"),
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
  createdAt: text("created_at"),
});

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
  assignedCrewId: text("assigned_crew_id"),
  materials: text("materials"),
  notes: text("notes"),
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

// Payment Methods
export const paymentMethods = ["cash", "zelle", "venmo", "other"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

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

// Public booking requests
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
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  createdAt: text("created_at").notNull(),
});

export const insertBookingRequestSchema = createInsertSchema(bookingRequests).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertBookingRequest = z.infer<typeof insertBookingRequestSchema>;
export type BookingRequest = typeof bookingRequests.$inferSelect;

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
  clientName: text("client_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
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
