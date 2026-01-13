import { eq, and, desc, asc, lte, or, ne, isNull } from "drizzle-orm";
import { db } from "./db";
import { 
  users, otpCodes, sessions, jobs, leads, invoices, reminders,
  crewMembers, referrals, bookingRequests, bookingEvents, voiceNotes,
  reviews, userPaymentMethods, jobPayments, crewInvites, crewJobPhotos, crewMessages,
  priceConfirmations, aiNudges, aiNudgeEvents, featureFlags, jobDrafts,
  type User, type InsertUser,
  type Job, type InsertJob,
  type Lead, type InsertLead,
  type Invoice, type InsertInvoice,
  type Reminder, type InsertReminder,
  type CrewMember, type InsertCrewMember,
  type Referral, type InsertReferral,
  type BookingRequest, type InsertBookingRequest,
  type BookingEvent, type InsertBookingEvent,
  type VoiceNote, type InsertVoiceNote,
  type Review, type InsertReview,
  type OtpCode, type InsertOtp,
  type Session,
  type DashboardSummary,
  type WeeklyStats,
  type MonthlyStats,
  type UserPaymentMethod, type InsertUserPaymentMethod,
  type JobPayment, type InsertJobPayment,
  type CrewInvite, type InsertCrewInvite,
  type CrewJobPhoto, type InsertCrewJobPhoto,
  type CrewMessage, type InsertCrewMessage,
  type PriceConfirmation, type InsertPriceConfirmation,
  type AiNudge, type InsertAiNudge,
  type AiNudgeEvent, type InsertAiNudgeEvent,
  type FeatureFlag,
  type JobDraft, type InsertJobDraft,
} from "@shared/schema";
import { IStorage } from "./storage";
import { randomUUID } from "crypto";

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initDemoUser();
  }

  private async initDemoUser() {
    const userId = "demo-user";
    const existing = await this.getUser(userId);
    if (!existing) {
      const today = new Date();
      await db.insert(users).values({
        id: userId,
        username: "demo",
        password: "demo123",
        firstName: "Gig",
        lastName: "Worker",
        name: "Gig Worker",
        phone: "(555) 000-0000",
        countryCode: "+1",
        email: "gig@example.com",
        photo: null,
        businessName: "Pro Gig Services",
        services: ["plumbing", "electrical", "cleaning"],
        bio: "Professional gig worker serving the Springfield area.",
        serviceArea: null,
        onboardingCompleted: false,
        onboardingStep: 0,
        isPro: true,
        proExpiresAt: null,
        notifyBySms: true,
        notifyByEmail: true,
        lastActiveAt: today.toISOString(),
        publicProfileEnabled: true,
        publicProfileSlug: "gig-worker",
        showReviewsOnBooking: true,
        referralCode: "GIGPRO2024",
        referredBy: null,
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
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        stripeConnectAccountId: null,
        stripeConnectStatus: "not_connected",
        stripeConnectOnboardedAt: null,
        depositEnabled: false,
        depositType: "percent",
        depositValue: 50,
        lateRescheduleWindowHours: 24,
        lateRescheduleRetainPctFirst: 40,
        lateRescheduleRetainPctSecond: 60,
        lateRescheduleRetainPctCap: 75,
      }).onConflictDoNothing();
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPublicSlug(slug: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.publicProfileSlug, slug));
    return user || undefined;
  }

  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, code));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const [user] = await db.insert(users).values({
      id,
      username: insertUser.username,
      password: insertUser.password,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      name: insertUser.name ?? null,
      phone: insertUser.phone ?? null,
      countryCode: insertUser.countryCode ?? null,
      email: insertUser.email ?? null,
      photo: insertUser.photo ?? null,
      businessName: insertUser.businessName ?? null,
      services: insertUser.services ?? null,
      bio: insertUser.bio ?? null,
      serviceArea: insertUser.serviceArea ?? null,
      onboardingCompleted: insertUser.onboardingCompleted ?? false,
      onboardingStep: insertUser.onboardingStep ?? 0,
      isPro: insertUser.isPro ?? false,
      proExpiresAt: insertUser.proExpiresAt ?? null,
      notifyBySms: insertUser.notifyBySms ?? true,
      notifyByEmail: insertUser.notifyByEmail ?? true,
      lastActiveAt: insertUser.lastActiveAt ?? new Date().toISOString(),
      publicProfileEnabled: insertUser.publicProfileEnabled ?? false,
      publicProfileSlug: insertUser.publicProfileSlug ?? null,
      showReviewsOnBooking: insertUser.showReviewsOnBooking ?? true,
      referralCode: insertUser.referralCode ?? `REF${id.slice(0, 8).toUpperCase()}`,
      referredBy: insertUser.referredBy ?? null,
      availability: insertUser.availability ?? null,
      slotDuration: insertUser.slotDuration ?? 60,
      createdAt: new Date().toISOString(),
      stripeConnectAccountId: insertUser.stripeConnectAccountId ?? null,
      stripeConnectStatus: insertUser.stripeConnectStatus ?? "not_connected",
      stripeConnectOnboardedAt: insertUser.stripeConnectOnboardedAt ?? null,
      depositEnabled: insertUser.depositEnabled ?? false,
      depositType: insertUser.depositType ?? "percent",
      depositValue: insertUser.depositValue ?? 50,
      lateRescheduleWindowHours: insertUser.lateRescheduleWindowHours ?? 24,
      lateRescheduleRetainPctFirst: insertUser.lateRescheduleRetainPctFirst ?? 40,
      lateRescheduleRetainPctSecond: insertUser.lateRescheduleRetainPctSecond ?? 60,
      lateRescheduleRetainPctCap: insertUser.lateRescheduleRetainPctCap ?? 75,
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      return undefined;
    }
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  async createOtp(otp: InsertOtp): Promise<OtpCode> {
    const id = randomUUID();
    const [created] = await db.insert(otpCodes).values({
      ...otp,
      id,
      verified: false,
      createdAt: new Date().toISOString(),
    }).returning();
    return created;
  }

  async getOtp(identifier: string, code: string): Promise<OtpCode | undefined> {
    const [otp] = await db.select().from(otpCodes).where(
      and(eq(otpCodes.identifier, identifier), eq(otpCodes.code, code))
    );
    return otp || undefined;
  }

  async verifyOtp(id: string): Promise<boolean> {
    const result = await db.update(otpCodes).set({ verified: true }).where(eq(otpCodes.id, id)).returning();
    return result.length > 0;
  }

  async createSession(userId: string, token: string, expiresAt: string): Promise<Session> {
    const id = randomUUID();
    const [session] = await db.insert(sessions).values({
      id,
      userId,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    }).returning();
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session || undefined;
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.token, token)).returning();
    return result.length > 0;
  }

  async getJobs(userId: string): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt));
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async getJobByReviewToken(token: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.reviewToken, token));
    return job || undefined;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const [job] = await db.insert(jobs).values({
      ...insertJob,
      id,
      createdAt: new Date().toISOString(),
    }).returning();
    return job;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const [updated] = await db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return updated || undefined;
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id)).returning();
    return result.length > 0;
  }

  async getLeads(userId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const [lead] = await db.insert(leads).values({
      ...insertLead,
      id,
      createdAt: new Date().toISOString(),
    }).returning();
    return lead;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
    return updated || undefined;
  }

  async deleteLead(id: string): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  }

  async getInvoices(userId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async getInvoiceByShareLink(shareLink: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.shareLink, shareLink));
    return invoice || undefined;
  }

  async getInvoiceByPublicToken(token: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.publicToken, token));
    return invoice || undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const [invoice] = await db.insert(invoices).values({
      ...insertInvoice,
      id,
      createdAt: new Date().toISOString(),
    }).returning();
    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices).set(updates).where(eq(invoices.id, id)).returning();
    return updated || undefined;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  }

  async getReminders(userId: string): Promise<Reminder[]> {
    return await db.select().from(reminders).where(eq(reminders.userId, userId)).orderBy(desc(reminders.createdAt));
  }

  async getReminder(id: string): Promise<Reminder | undefined> {
    const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id));
    return reminder || undefined;
  }

  async getPendingReminders(): Promise<Reminder[]> {
    const now = new Date().toISOString();
    return await db.select().from(reminders).where(
      and(eq(reminders.status, "pending"), lte(reminders.scheduledAt, now))
    );
  }

  async createReminder(insertReminder: InsertReminder): Promise<Reminder> {
    const id = randomUUID();
    const [reminder] = await db.insert(reminders).values({
      ...insertReminder,
      id,
      status: "pending",
      createdAt: new Date().toISOString(),
    }).returning();
    return reminder;
  }

  async updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | undefined> {
    const [updated] = await db.update(reminders).set(updates).where(eq(reminders.id, id)).returning();
    return updated || undefined;
  }

  async deleteReminder(id: string): Promise<boolean> {
    const result = await db.delete(reminders).where(eq(reminders.id, id)).returning();
    return result.length > 0;
  }

  async getCrewMembers(userId: string): Promise<CrewMember[]> {
    return await db.select().from(crewMembers).where(eq(crewMembers.userId, userId));
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    const [member] = await db.select().from(crewMembers).where(eq(crewMembers.id, id));
    return member || undefined;
  }

  async createCrewMember(insertMember: InsertCrewMember): Promise<CrewMember> {
    const id = randomUUID();
    const [member] = await db.insert(crewMembers).values({
      ...insertMember,
      id,
      status: "invited",
      invitedAt: new Date().toISOString(),
      joinedAt: null,
    }).returning();
    return member;
  }

  async updateCrewMember(id: string, updates: Partial<CrewMember>): Promise<CrewMember | undefined> {
    const [updated] = await db.update(crewMembers).set(updates).where(eq(crewMembers.id, id)).returning();
    return updated || undefined;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    const result = await db.delete(crewMembers).where(eq(crewMembers.id, id)).returning();
    return result.length > 0;
  }

  async getReferrals(userId: string): Promise<Referral[]> {
    return await db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
  }

  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    const id = randomUUID();
    const [referral] = await db.insert(referrals).values({
      ...insertReferral,
      id,
      status: "pending",
      rewardAmount: 0,
      createdAt: new Date().toISOString(),
      convertedAt: null,
    }).returning();
    return referral;
  }

  async updateReferral(id: string, updates: Partial<Referral>): Promise<Referral | undefined> {
    const [updated] = await db.update(referrals).set(updates).where(eq(referrals.id, id)).returning();
    return updated || undefined;
  }

  async getBookingRequests(userId: string): Promise<BookingRequest[]> {
    return await db.select().from(bookingRequests).where(eq(bookingRequests.userId, userId)).orderBy(desc(bookingRequests.createdAt));
  }

  async getBookingRequest(id: string): Promise<BookingRequest | undefined> {
    const [request] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id));
    return request || undefined;
  }

  async getBookingRequestByToken(token: string): Promise<BookingRequest | undefined> {
    const [request] = await db.select().from(bookingRequests).where(eq(bookingRequests.confirmationToken, token));
    return request || undefined;
  }

  async getBookingRequestsAwaitingRelease(): Promise<BookingRequest[]> {
    const now = new Date().toISOString();
    const allRequests = await db.select().from(bookingRequests).where(
      eq(bookingRequests.completionStatus, "awaiting_confirmation")
    );
    return allRequests.filter(b => {
      if (b.depositStatus === "on_hold_dispute") return false;
      if (!b.autoReleaseAt) return false;
      return b.autoReleaseAt <= now;
    });
  }

  async createBookingRequest(insertRequest: InsertBookingRequest): Promise<BookingRequest> {
    const id = randomUUID();
    const [request] = await db.insert(bookingRequests).values({
      ...insertRequest,
      id,
      status: "pending",
      depositStatus: "none",
      completionStatus: "scheduled",
      lateRescheduleCount: 0,
      waiveRescheduleFee: false,
      retainedAmountCents: 0,
      rolledAmountCents: 0,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeTransferId: null,
      confirmationToken: randomUUID(),
      autoReleaseAt: null,
      lastRescheduleAt: null,
      createdAt: new Date().toISOString(),
    }).returning();
    return request;
  }

  async updateBookingRequest(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest | undefined> {
    const [updated] = await db.update(bookingRequests).set(updates).where(eq(bookingRequests.id, id)).returning();
    return updated || undefined;
  }

  async getBookingEvents(bookingId: string): Promise<BookingEvent[]> {
    return await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId)).orderBy(asc(bookingEvents.createdAt));
  }

  async createBookingEvent(insertEvent: InsertBookingEvent): Promise<BookingEvent> {
    const id = randomUUID();
    const [event] = await db.insert(bookingEvents).values({
      ...insertEvent,
      id,
      createdAt: new Date().toISOString(),
    }).returning();
    return event;
  }

  async getVoiceNotes(userId: string): Promise<VoiceNote[]> {
    return await db.select().from(voiceNotes).where(eq(voiceNotes.userId, userId)).orderBy(desc(voiceNotes.createdAt));
  }

  async getVoiceNote(id: string): Promise<VoiceNote | undefined> {
    const [note] = await db.select().from(voiceNotes).where(eq(voiceNotes.id, id));
    return note || undefined;
  }

  async createVoiceNote(insertNote: InsertVoiceNote): Promise<VoiceNote> {
    const id = randomUUID();
    const [note] = await db.insert(voiceNotes).values({
      ...insertNote,
      id,
      createdAt: new Date().toISOString(),
    }).returning();
    return note;
  }

  async updateVoiceNote(id: string, updates: Partial<VoiceNote>): Promise<VoiceNote | undefined> {
    const [updated] = await db.update(voiceNotes).set(updates).where(eq(voiceNotes.id, id)).returning();
    return updated || undefined;
  }

  async deleteVoiceNote(id: string): Promise<boolean> {
    const result = await db.delete(voiceNotes).where(eq(voiceNotes.id, id)).returning();
    return result.length > 0;
  }

  async getReviews(userId: string): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.createdAt));
  }

  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review || undefined;
  }

  async getPublicReviews(userId: string): Promise<Review[]> {
    return await db.select().from(reviews).where(
      and(eq(reviews.userId, userId), eq(reviews.isPublic, true))
    ).orderBy(desc(reviews.createdAt));
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = randomUUID();
    const [review] = await db.insert(reviews).values({
      ...insertReview,
      id,
      providerResponse: null,
      respondedAt: null,
      isPublic: insertReview.isPublic !== false,
      createdAt: new Date().toISOString(),
    }).returning();
    return review;
  }

  async updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined> {
    const [updated] = await db.update(reviews).set(updates).where(eq(reviews.id, id)).returning();
    return updated || undefined;
  }

  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const allJobs = await this.getJobs(userId);
    const allLeads = await this.getLeads(userId);
    const allInvoices = await this.getInvoices(userId);
    const allReminders = await this.getReminders(userId);

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const upcomingJobs = allJobs.filter(job => {
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= today && (job.status === "scheduled" || job.status === "in_progress");
    }).slice(0, 5);

    const recentLeads = allLeads.slice(0, 5);

    const totalEarnings = allInvoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.amount, 0);

    const pendingReminders = allReminders.filter(r => r.status === "pending").length;

    const weekJobs = allJobs.filter(j => new Date(j.createdAt) >= startOfWeek);
    const weekLeads = allLeads.filter(l => new Date(l.createdAt) >= startOfWeek);
    const weekEarnings = allInvoices
      .filter(inv => inv.status === "paid" && inv.paidAt && new Date(inv.paidAt) >= startOfWeek)
      .reduce((sum, inv) => sum + inv.amount, 0);
    const weekCompletedJobs = weekJobs.filter(j => j.status === "completed").length;

    const weeklyStats: WeeklyStats = {
      jobsThisWeek: weekJobs.length,
      leadsThisWeek: weekLeads.length,
      earningsThisWeek: weekEarnings,
      completionRate: weekJobs.length > 0 ? Math.round((weekCompletedJobs / weekJobs.length) * 100) : 0,
    };

    const monthJobs = allJobs.filter(j => new Date(j.createdAt) >= startOfMonth);
    const monthLeads = allLeads.filter(l => new Date(l.createdAt) >= startOfMonth);
    const monthEarnings = allInvoices
      .filter(inv => inv.status === "paid" && inv.paidAt && new Date(inv.paidAt) >= startOfMonth)
      .reduce((sum, inv) => sum + inv.amount, 0);
    const monthCompletedJobs = monthJobs.filter(j => j.status === "completed").length;

    const monthlyStats: MonthlyStats = {
      jobsThisMonth: monthJobs.length,
      leadsThisMonth: monthLeads.length,
      earningsThisMonth: monthEarnings,
      completionRate: monthJobs.length > 0 ? Math.round((monthCompletedJobs / monthJobs.length) * 100) : 0,
    };

    return {
      totalJobs: allJobs.length,
      completedJobs: allJobs.filter(j => j.status === "completed").length,
      totalLeads: allLeads.length,
      newLeads: allLeads.filter(l => l.status === "new").length,
      totalEarnings,
      upcomingJobs,
      recentLeads,
      pendingReminders,
      weeklyStats,
      monthlyStats,
    };
  }

  async getUserPaymentMethods(userId: string): Promise<UserPaymentMethod[]> {
    return await db.select().from(userPaymentMethods).where(eq(userPaymentMethods.userId, userId)).orderBy(desc(userPaymentMethods.createdAt));
  }

  async getUserPaymentMethod(id: string): Promise<UserPaymentMethod | undefined> {
    const [method] = await db.select().from(userPaymentMethods).where(eq(userPaymentMethods.id, id));
    return method || undefined;
  }

  async createUserPaymentMethod(insertMethod: InsertUserPaymentMethod): Promise<UserPaymentMethod> {
    const id = randomUUID();
    const [method] = await db.insert(userPaymentMethods).values({
      ...insertMethod,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    }).returning();
    return method;
  }

  async updateUserPaymentMethod(id: string, updates: Partial<UserPaymentMethod>): Promise<UserPaymentMethod | undefined> {
    const [updated] = await db.update(userPaymentMethods).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }).where(eq(userPaymentMethods.id, id)).returning();
    return updated || undefined;
  }

  async deleteUserPaymentMethod(id: string): Promise<boolean> {
    const result = await db.delete(userPaymentMethods).where(eq(userPaymentMethods.id, id)).returning();
    return result.length > 0;
  }

  async getJobPayments(userId: string): Promise<JobPayment[]> {
    return await db.select().from(jobPayments).where(eq(jobPayments.userId, userId)).orderBy(desc(jobPayments.createdAt));
  }

  async getJobPayment(id: string): Promise<JobPayment | undefined> {
    const [payment] = await db.select().from(jobPayments).where(eq(jobPayments.id, id));
    return payment || undefined;
  }

  async getJobPaymentsByInvoice(invoiceId: string): Promise<JobPayment[]> {
    return await db.select().from(jobPayments).where(eq(jobPayments.invoiceId, invoiceId));
  }

  async getJobPaymentsByJob(jobId: string): Promise<JobPayment[]> {
    return await db.select().from(jobPayments).where(eq(jobPayments.jobId, jobId));
  }

  async createJobPayment(insertPayment: InsertJobPayment): Promise<JobPayment> {
    const id = randomUUID();
    const [payment] = await db.insert(jobPayments).values({
      ...insertPayment,
      id,
      createdAt: new Date().toISOString(),
    }).returning();
    return payment;
  }

  async updateJobPayment(id: string, updates: Partial<JobPayment>): Promise<JobPayment | undefined> {
    const [updated] = await db.update(jobPayments).set(updates).where(eq(jobPayments.id, id)).returning();
    return updated || undefined;
  }

  async getCrewInvites(userId: string): Promise<CrewInvite[]> {
    return await db.select().from(crewInvites).where(eq(crewInvites.userId, userId)).orderBy(desc(crewInvites.createdAt));
  }

  async getCrewInvite(id: string): Promise<CrewInvite | undefined> {
    const [invite] = await db.select().from(crewInvites).where(eq(crewInvites.id, id));
    return invite || undefined;
  }

  async getCrewInviteByToken(token: string): Promise<CrewInvite | undefined> {
    const [invite] = await db.select().from(crewInvites).where(eq(crewInvites.token, token));
    return invite || undefined;
  }

  async getCrewInvitesByJob(jobId: string): Promise<CrewInvite[]> {
    return await db.select().from(crewInvites).where(eq(crewInvites.jobId, jobId)).orderBy(desc(crewInvites.createdAt));
  }

  async createCrewInvite(insertInvite: InsertCrewInvite): Promise<CrewInvite> {
    const id = randomUUID();
    const [invite] = await db.insert(crewInvites).values({
      ...insertInvite,
      id,
      status: "pending",
      deliveredAt: null,
      viewedAt: null,
      confirmedAt: null,
      declinedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    }).returning();
    return invite;
  }

  async updateCrewInvite(id: string, updates: Partial<CrewInvite>): Promise<CrewInvite | undefined> {
    const [updated] = await db.update(crewInvites).set(updates).where(eq(crewInvites.id, id)).returning();
    return updated || undefined;
  }

  async deleteCrewInvite(id: string): Promise<boolean> {
    const result = await db.delete(crewInvites).where(eq(crewInvites.id, id)).returning();
    return result.length > 0;
  }

  async getCrewJobPhotos(jobId: string): Promise<CrewJobPhoto[]> {
    return await db.select().from(crewJobPhotos).where(eq(crewJobPhotos.jobId, jobId)).orderBy(desc(crewJobPhotos.uploadedAt));
  }

  async getCrewJobPhoto(id: string): Promise<CrewJobPhoto | undefined> {
    const [photo] = await db.select().from(crewJobPhotos).where(eq(crewJobPhotos.id, id));
    return photo || undefined;
  }

  async createCrewJobPhoto(insertPhoto: InsertCrewJobPhoto): Promise<CrewJobPhoto> {
    const id = randomUUID();
    const [photo] = await db.insert(crewJobPhotos).values({
      ...insertPhoto,
      id,
      uploadedAt: new Date().toISOString(),
    }).returning();
    return photo;
  }

  async deleteCrewJobPhoto(id: string): Promise<boolean> {
    const result = await db.delete(crewJobPhotos).where(eq(crewJobPhotos.id, id)).returning();
    return result.length > 0;
  }

  async getCrewMessages(jobId: string): Promise<CrewMessage[]> {
    return await db.select().from(crewMessages).where(eq(crewMessages.jobId, jobId)).orderBy(asc(crewMessages.createdAt));
  }

  async getCrewMessagesByUser(userId: string): Promise<CrewMessage[]> {
    return await db.select().from(crewMessages).where(eq(crewMessages.userId, userId)).orderBy(desc(crewMessages.createdAt));
  }

  async createCrewMessage(insertMessage: InsertCrewMessage): Promise<CrewMessage> {
    const id = randomUUID();
    const [message] = await db.insert(crewMessages).values({
      ...insertMessage,
      id,
      readAt: null,
      createdAt: new Date().toISOString(),
    }).returning();
    return message;
  }

  async updateCrewMessage(id: string, updates: Partial<CrewMessage>): Promise<CrewMessage | undefined> {
    const [updated] = await db.update(crewMessages).set(updates).where(eq(crewMessages.id, id)).returning();
    return updated || undefined;
  }

  // Price Confirmation methods
  async getPriceConfirmation(id: string): Promise<PriceConfirmation | undefined> {
    const [confirmation] = await db.select().from(priceConfirmations).where(eq(priceConfirmations.id, id));
    return confirmation || undefined;
  }

  async getPriceConfirmationByToken(token: string): Promise<PriceConfirmation | undefined> {
    const [confirmation] = await db.select().from(priceConfirmations).where(eq(priceConfirmations.confirmationToken, token));
    return confirmation || undefined;
  }

  async getPriceConfirmationsByLead(leadId: string): Promise<PriceConfirmation[]> {
    return await db.select().from(priceConfirmations).where(eq(priceConfirmations.leadId, leadId)).orderBy(desc(priceConfirmations.createdAt));
  }

  async getPriceConfirmationsByUser(userId: string): Promise<PriceConfirmation[]> {
    return await db.select().from(priceConfirmations).where(eq(priceConfirmations.userId, userId)).orderBy(desc(priceConfirmations.createdAt));
  }

  async getActivePriceConfirmationForLead(leadId: string): Promise<PriceConfirmation | undefined> {
    const [confirmation] = await db.select().from(priceConfirmations)
      .where(and(
        eq(priceConfirmations.leadId, leadId),
        eq(priceConfirmations.status, "draft")
      ))
      .orderBy(desc(priceConfirmations.createdAt));
    if (confirmation) return confirmation;
    
    // Also check for sent but not expired
    const [sentConfirmation] = await db.select().from(priceConfirmations)
      .where(and(
        eq(priceConfirmations.leadId, leadId),
        eq(priceConfirmations.status, "sent")
      ))
      .orderBy(desc(priceConfirmations.createdAt));
    return sentConfirmation || undefined;
  }

  async createPriceConfirmation(insertConfirmation: InsertPriceConfirmation): Promise<PriceConfirmation> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const [confirmation] = await db.insert(priceConfirmations).values({
      ...insertConfirmation,
      id,
      status: insertConfirmation.status || "draft",
      createdAt: now,
      updatedAt: now,
    }).returning();
    return confirmation;
  }

  async updatePriceConfirmation(id: string, updates: Partial<PriceConfirmation>): Promise<PriceConfirmation | undefined> {
    const [updated] = await db.update(priceConfirmations).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }).where(eq(priceConfirmations.id, id)).returning();
    return updated || undefined;
  }

  async deletePriceConfirmation(id: string): Promise<boolean> {
    const result = await db.delete(priceConfirmations).where(eq(priceConfirmations.id, id)).returning();
    return result.length > 0;
  }

  // AI Nudges
  async getAiNudges(userId: string): Promise<AiNudge[]> {
    return await db.select().from(aiNudges).where(eq(aiNudges.userId, userId)).orderBy(desc(aiNudges.priority));
  }

  async getAiNudge(id: string): Promise<AiNudge | undefined> {
    const [nudge] = await db.select().from(aiNudges).where(eq(aiNudges.id, id));
    return nudge || undefined;
  }

  async getAiNudgesByEntity(entityType: string, entityId: string): Promise<AiNudge[]> {
    const now = new Date().toISOString();
    return await db.select().from(aiNudges).where(
      and(
        eq(aiNudges.entityType, entityType), 
        eq(aiNudges.entityId, entityId),
        eq(aiNudges.status, "active"),
        or(
          isNull(aiNudges.snoozedUntil),
          lte(aiNudges.snoozedUntil, now)
        )
      )
    ).orderBy(desc(aiNudges.priority));
  }

  async getActiveAiNudgesForUser(userId: string): Promise<AiNudge[]> {
    const now = new Date().toISOString();
    return await db.select().from(aiNudges).where(
      and(
        eq(aiNudges.userId, userId),
        eq(aiNudges.status, "active"),
        or(
          isNull(aiNudges.snoozedUntil),
          lte(aiNudges.snoozedUntil, now)
        )
      )
    ).orderBy(desc(aiNudges.priority));
  }

  async getAiNudgeByDedupeKey(dedupeKey: string): Promise<AiNudge | undefined> {
    const [nudge] = await db.select().from(aiNudges).where(eq(aiNudges.dedupeKey, dedupeKey));
    return nudge || undefined;
  }

  async createAiNudge(nudge: InsertAiNudge): Promise<AiNudge> {
    const id = randomUUID();
    const [created] = await db.insert(aiNudges).values({
      ...nudge,
      id,
      priority: nudge.priority ?? 50,
      status: nudge.status ?? "active",
      actionPayload: nudge.actionPayload ?? "{}",
      explainText: nudge.explainText ?? "",
    }).returning();
    return created;
  }

  async updateAiNudge(id: string, updates: Partial<AiNudge>): Promise<AiNudge | undefined> {
    const [updated] = await db.update(aiNudges).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }).where(eq(aiNudges.id, id)).returning();
    return updated || undefined;
  }

  async deleteAiNudge(id: string): Promise<boolean> {
    const result = await db.delete(aiNudges).where(eq(aiNudges.id, id)).returning();
    return result.length > 0;
  }

  // AI Nudge Events
  async getAiNudgeEvents(nudgeId: string): Promise<AiNudgeEvent[]> {
    return await db.select().from(aiNudgeEvents).where(eq(aiNudgeEvents.nudgeId, nudgeId)).orderBy(desc(aiNudgeEvents.eventAt));
  }

  async createAiNudgeEvent(event: InsertAiNudgeEvent): Promise<AiNudgeEvent> {
    const id = randomUUID();
    const [created] = await db.insert(aiNudgeEvents).values({
      ...event,
      id,
      metadata: event.metadata ?? "{}",
    }).returning();
    return created;
  }

  // Feature Flags
  async getFeatureFlag(key: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key));
    return flag || undefined;
  }

  async setFeatureFlag(key: string, enabled: boolean, description?: string): Promise<FeatureFlag> {
    const existing = await this.getFeatureFlag(key);
    if (existing) {
      const [updated] = await db.update(featureFlags).set({
        enabled,
        description: description ?? existing.description,
        updatedAt: new Date().toISOString(),
      }).where(eq(featureFlags.key, key)).returning();
      return updated;
    } else {
      const [created] = await db.insert(featureFlags).values({
        key,
        enabled,
        description: description ?? null,
        updatedAt: new Date().toISOString(),
      }).returning();
      return created;
    }
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return await db.select().from(featureFlags);
  }

  // Job Drafts (QuickBook)
  async getJobDrafts(userId: string): Promise<JobDraft[]> {
    return await db.select().from(jobDrafts).where(eq(jobDrafts.userId, userId)).orderBy(desc(jobDrafts.createdAt));
  }

  async getJobDraft(id: string): Promise<JobDraft | undefined> {
    const [draft] = await db.select().from(jobDrafts).where(eq(jobDrafts.id, id));
    return draft;
  }

  async getJobDraftByToken(token: string): Promise<JobDraft | undefined> {
    const [draft] = await db.select().from(jobDrafts).where(eq(jobDrafts.bookingLinkToken, token));
    return draft;
  }

  async createJobDraft(draft: InsertJobDraft): Promise<JobDraft> {
    const [newDraft] = await db.insert(jobDrafts).values(draft).returning();
    return newDraft;
  }

  async updateJobDraft(id: string, updates: Partial<JobDraft>): Promise<JobDraft | undefined> {
    const [updated] = await db.update(jobDrafts)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(jobDrafts.id, id))
      .returning();
    return updated;
  }

  async deleteJobDraft(id: string): Promise<boolean> {
    const result = await db.delete(jobDrafts).where(eq(jobDrafts.id, id));
    return result.rowCount! > 0;
  }
}

export const dbStorage = new DatabaseStorage();
