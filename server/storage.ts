import { 
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
  type JobResolution, type InsertJobResolution,
  type ActionQueueItem, type InsertActionQueueItem,
  type OutcomeMetricsDaily, type InsertOutcomeMetricsDaily,
  type PhotoAsset, type InsertPhotoAsset,
  type PhotoSourceType,
  type EstimationRequest, type InsertEstimationRequest,
  type SmsMessage, type InsertSmsMessage,
  type StallDetection, type InsertStallDetection,
  type NextAction, type InsertNextAction,
  type AutoExecutionLog, type InsertAutoExecutionLog,
  type IntentSignal, type InsertIntentSignal,
  type ReadyAction, type InsertReadyAction,
  type AiOverride, type InsertAiOverride,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPublicSlug(slug: string): Promise<User | undefined>;
  getUserByReferralCode(code: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // OTP
  createOtp(otp: InsertOtp): Promise<OtpCode>;
  getOtp(identifier: string, code: string): Promise<OtpCode | undefined>;
  verifyOtp(id: string): Promise<boolean>;

  // Sessions
  createSession(userId: string, token: string, expiresAt: string): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<boolean>;

  // Jobs
  getJobs(userId: string): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  getJobByReviewToken(token: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;

  // Leads
  getLeads(userId: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;

  // Invoices
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByShareLink(shareLink: string): Promise<Invoice | undefined>;
  getInvoiceByPublicToken(token: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  // Reminders
  getReminders(userId: string): Promise<Reminder[]>;
  getReminder(id: string): Promise<Reminder | undefined>;
  getPendingReminders(): Promise<Reminder[]>;
  createReminder(reminder: InsertReminder): Promise<Reminder>;
  updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | undefined>;
  deleteReminder(id: string): Promise<boolean>;

  // Crew
  getCrewMembers(userId: string): Promise<CrewMember[]>;
  getCrewMember(id: string): Promise<CrewMember | undefined>;
  createCrewMember(member: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: string, updates: Partial<CrewMember>): Promise<CrewMember | undefined>;
  deleteCrewMember(id: string): Promise<boolean>;

  // Referrals
  getReferrals(userId: string): Promise<Referral[]>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  updateReferral(id: string, updates: Partial<Referral>): Promise<Referral | undefined>;

  // Booking Requests
  getBookingRequests(userId: string): Promise<BookingRequest[]>;
  getBookingRequest(id: string): Promise<BookingRequest | undefined>;
  getBookingRequestByToken(token: string): Promise<BookingRequest | undefined>;
  getBookingRequestsAwaitingRelease(): Promise<BookingRequest[]>;
  createBookingRequest(request: InsertBookingRequest): Promise<BookingRequest>;
  updateBookingRequest(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest | undefined>;
  
  // Booking Events (audit trail)
  getBookingEvents(bookingId: string): Promise<BookingEvent[]>;
  createBookingEvent(event: InsertBookingEvent): Promise<BookingEvent>;

  // Voice Notes
  getVoiceNotes(userId: string): Promise<VoiceNote[]>;
  getVoiceNote(id: string): Promise<VoiceNote | undefined>;
  createVoiceNote(note: InsertVoiceNote): Promise<VoiceNote>;
  updateVoiceNote(id: string, updates: Partial<VoiceNote>): Promise<VoiceNote | undefined>;
  deleteVoiceNote(id: string): Promise<boolean>;

  // Reviews
  getReviews(userId: string): Promise<Review[]>;
  getReview(id: string): Promise<Review | undefined>;
  getPublicReviews(userId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined>;

  // Dashboard
  getDashboardSummary(userId: string): Promise<DashboardSummary>;

  // Payment Methods
  getUserPaymentMethods(userId: string): Promise<UserPaymentMethod[]>;
  getUserPaymentMethod(id: string): Promise<UserPaymentMethod | undefined>;
  createUserPaymentMethod(method: InsertUserPaymentMethod): Promise<UserPaymentMethod>;
  updateUserPaymentMethod(id: string, updates: Partial<UserPaymentMethod>): Promise<UserPaymentMethod | undefined>;
  deleteUserPaymentMethod(id: string): Promise<boolean>;

  // Job Payments
  getJobPayments(userId: string): Promise<JobPayment[]>;
  getJobPayment(id: string): Promise<JobPayment | undefined>;
  getJobPaymentsByInvoice(invoiceId: string): Promise<JobPayment[]>;
  getJobPaymentsByJob(jobId: string): Promise<JobPayment[]>;
  createJobPayment(payment: InsertJobPayment): Promise<JobPayment>;
  updateJobPayment(id: string, updates: Partial<JobPayment>): Promise<JobPayment | undefined>;

  // Crew Invites
  getCrewInvites(userId: string): Promise<CrewInvite[]>;
  getCrewInvite(id: string): Promise<CrewInvite | undefined>;
  getCrewInviteByToken(token: string): Promise<CrewInvite | undefined>;
  getCrewInvitesByJob(jobId: string): Promise<CrewInvite[]>;
  createCrewInvite(invite: InsertCrewInvite): Promise<CrewInvite>;
  updateCrewInvite(id: string, updates: Partial<CrewInvite>): Promise<CrewInvite | undefined>;
  deleteCrewInvite(id: string): Promise<boolean>;

  // Crew Job Photos
  getCrewJobPhotos(jobId: string): Promise<CrewJobPhoto[]>;
  getCrewJobPhoto(id: string): Promise<CrewJobPhoto | undefined>;
  createCrewJobPhoto(photo: InsertCrewJobPhoto): Promise<CrewJobPhoto>;
  deleteCrewJobPhoto(id: string): Promise<boolean>;

  // Crew Messages
  getCrewMessages(jobId: string): Promise<CrewMessage[]>;
  getCrewMessagesByUser(userId: string): Promise<CrewMessage[]>;
  createCrewMessage(message: InsertCrewMessage): Promise<CrewMessage>;
  updateCrewMessage(id: string, updates: Partial<CrewMessage>): Promise<CrewMessage | undefined>;

  // Price Confirmations
  getPriceConfirmation(id: string): Promise<PriceConfirmation | undefined>;
  getPriceConfirmationByToken(token: string): Promise<PriceConfirmation | undefined>;
  getPriceConfirmationsByLead(leadId: string): Promise<PriceConfirmation[]>;
  getPriceConfirmationsByUser(userId: string): Promise<PriceConfirmation[]>;
  getActivePriceConfirmationForLead(leadId: string): Promise<PriceConfirmation | undefined>;
  createPriceConfirmation(confirmation: InsertPriceConfirmation): Promise<PriceConfirmation>;
  updatePriceConfirmation(id: string, updates: Partial<PriceConfirmation>): Promise<PriceConfirmation | undefined>;
  deletePriceConfirmation(id: string): Promise<boolean>;

  // AI Nudges
  getAiNudges(userId: string): Promise<AiNudge[]>;
  getAiNudge(id: string): Promise<AiNudge | undefined>;
  getAiNudgesByEntity(entityType: string, entityId: string): Promise<AiNudge[]>;
  getActiveAiNudgesForUser(userId: string): Promise<AiNudge[]>;
  getAiNudgeByDedupeKey(dedupeKey: string): Promise<AiNudge | undefined>;
  createAiNudge(nudge: InsertAiNudge): Promise<AiNudge>;
  updateAiNudge(id: string, updates: Partial<AiNudge>): Promise<AiNudge | undefined>;
  deleteAiNudge(id: string): Promise<boolean>;

  // AI Nudge Events
  getAiNudgeEvents(nudgeId: string): Promise<AiNudgeEvent[]>;
  createAiNudgeEvent(event: InsertAiNudgeEvent): Promise<AiNudgeEvent>;
  getTodayNudgeCount(userId: string): Promise<number>;
  // Get the latest dismiss/snooze event time for a list of nudge IDs
  // Used for Trust Memory cooldown - returns null if no dismiss/snooze events found
  getLatestDismissEventTime(nudgeIds: string[]): Promise<string | null>;

  // Feature Flags
  getFeatureFlag(key: string): Promise<FeatureFlag | undefined>;
  setFeatureFlag(key: string, enabled: boolean, description?: string): Promise<FeatureFlag>;
  getAllFeatureFlags(): Promise<FeatureFlag[]>;

  // Job Drafts (QuickBook)
  getJobDrafts(userId: string): Promise<JobDraft[]>;
  getJobDraft(id: string): Promise<JobDraft | undefined>;
  getJobDraftByToken(token: string): Promise<JobDraft | undefined>;
  createJobDraft(draft: InsertJobDraft): Promise<JobDraft>;
  updateJobDraft(id: string, updates: Partial<JobDraft>): Promise<JobDraft | undefined>;
  deleteJobDraft(id: string): Promise<boolean>;

  // Job Resolutions (Revenue Protection - No Silent Completion)
  // These methods ensure every completed job has explicit payment resolution
  getJobResolution(jobId: string): Promise<JobResolution | undefined>;
  getJobResolutionsByUser(userId: string): Promise<JobResolution[]>;
  getUnresolvedCompletedJobs(userId: string): Promise<Job[]>;
  createJobResolution(resolution: InsertJobResolution): Promise<JobResolution>;
  deleteJobResolution(jobId: string): Promise<boolean>;

  // Action Queue (Today's Money Plan - Global Prioritization)
  getActionQueueItems(userId: string, status?: string): Promise<ActionQueueItem[]>;
  getActionQueueItem(id: string): Promise<ActionQueueItem | undefined>;
  getActionQueueItemByDedupeKey(dedupeKey: string): Promise<ActionQueueItem | undefined>;
  createActionQueueItem(item: InsertActionQueueItem): Promise<ActionQueueItem>;
  updateActionQueueItem(id: string, updates: Partial<ActionQueueItem>): Promise<ActionQueueItem | undefined>;
  deleteActionQueueItem(id: string): Promise<boolean>;
  clearActionQueue(userId: string): Promise<number>;

  // Outcome Metrics Daily (GigAid Impact - Outcome Attribution)
  getOutcomeMetricsDaily(userId: string, startDate: string, endDate: string): Promise<OutcomeMetricsDaily[]>;
  getOutcomeMetricsDailyByDate(userId: string, metricDate: string): Promise<OutcomeMetricsDaily | undefined>;
  createOutcomeMetricsDaily(metrics: InsertOutcomeMetricsDaily): Promise<OutcomeMetricsDaily>;
  updateOutcomeMetricsDaily(id: string, updates: Partial<OutcomeMetricsDaily>): Promise<OutcomeMetricsDaily | undefined>;

  // Photo Assets (Booking/Review/Job photos)
  getPhotoAssets(sourceType: PhotoSourceType, sourceId: string): Promise<PhotoAsset[]>;
  getPhotoAsset(id: string): Promise<PhotoAsset | undefined>;
  getPhotoAssetsByWorkspace(workspaceUserId: string, sourceType?: PhotoSourceType): Promise<PhotoAsset[]>;
  createPhotoAsset(asset: InsertPhotoAsset): Promise<PhotoAsset>;
  updatePhotoAsset(id: string, updates: Partial<PhotoAsset>): Promise<PhotoAsset | undefined>;
  deletePhotoAsset(id: string): Promise<boolean>;

  // Estimation Requests (Provider Review Required flow)
  getEstimationRequests(providerId: string): Promise<EstimationRequest[]>;
  getEstimationRequest(id: string): Promise<EstimationRequest | undefined>;
  getEstimationRequestByToken(token: string): Promise<EstimationRequest | undefined>;
  getPendingEstimationRequests(providerId: string): Promise<EstimationRequest[]>;
  createEstimationRequest(request: InsertEstimationRequest): Promise<EstimationRequest>;
  updateEstimationRequest(id: string, updates: Partial<EstimationRequest>): Promise<EstimationRequest | undefined>;
  deleteEstimationRequest(id: string): Promise<boolean>;

  // SMS Messages (Inbox with routing)
  getSmsMessages(userId: string): Promise<SmsMessage[]>;
  getSmsMessagesByPhone(userId: string, clientPhone: string): Promise<SmsMessage[]>;
  getUnreadSmsCount(userId: string): Promise<number>;
  getLastOutboundMessageByPhone(clientPhone: string): Promise<SmsMessage | undefined>;
  createSmsMessage(message: InsertSmsMessage): Promise<SmsMessage>;
  markSmsMessagesAsRead(userId: string, clientPhone: string): Promise<number>;
  
  // Phone-based lookups for SMS routing (efficient single-query lookups)
  findClientByPhone(userId: string, phone: string): Promise<{
    clientName: string | null;
    relatedJobId: string | null;
    relatedLeadId: string | null;
  } | undefined>;

  // Stall Detections (Next Best Action Engine)
  getStallDetections(userId: string, entityType?: string): Promise<StallDetection[]>;
  getStallDetection(id: string): Promise<StallDetection | undefined>;
  getActiveStallForEntity(entityType: string, entityId: string): Promise<StallDetection | undefined>;
  createStallDetection(detection: InsertStallDetection): Promise<StallDetection>;
  updateStallDetection(id: string, updates: Partial<StallDetection>): Promise<StallDetection | undefined>;
  resolveStallDetection(id: string): Promise<StallDetection | undefined>;

  // Next Actions (Recommendations)
  getNextActions(userId: string, entityType?: string): Promise<NextAction[]>;
  getNextAction(id: string): Promise<NextAction | undefined>;
  getActiveNextActionForEntity(entityType: string, entityId: string): Promise<NextAction | undefined>;
  createNextAction(action: InsertNextAction): Promise<NextAction>;
  updateNextAction(id: string, updates: Partial<NextAction>): Promise<NextAction | undefined>;
  actOnNextAction(id: string): Promise<NextAction | undefined>;
  dismissNextAction(id: string): Promise<NextAction | undefined>;
  expireNextActions(): Promise<number>;

  // Auto Execution Log
  getAutoExecutionLogs(userId: string, entityType?: string, entityId?: string): Promise<AutoExecutionLog[]>;
  getLastAutoExecutionForEntity(entityType: string, entityId: string): Promise<AutoExecutionLog | undefined>;
  createAutoExecutionLog(log: InsertAutoExecutionLog): Promise<AutoExecutionLog>;
  
  // Intent Signals
  getIntentSignals(userId: string, entityType?: string, entityId?: string): Promise<IntentSignal[]>;
  getUnprocessedIntentSignals(userId: string): Promise<IntentSignal[]>;
  createIntentSignal(signal: InsertIntentSignal): Promise<IntentSignal>;
  markIntentSignalProcessed(id: string): Promise<IntentSignal | undefined>;
  
  // Ready Actions (pre-filled one-tap actions)
  getReadyActions(userId: string): Promise<ReadyAction[]>;
  getActiveReadyActionForEntity(entityType: string, entityId: string): Promise<ReadyAction | undefined>;
  getActiveReadyActionsForUser(userId: string): Promise<ReadyAction[]>;
  createReadyAction(action: InsertReadyAction): Promise<ReadyAction>;
  updateReadyAction(id: string, updates: Partial<ReadyAction>): Promise<ReadyAction | undefined>;
  actOnReadyAction(id: string): Promise<ReadyAction | undefined>;
  dismissReadyAction(id: string): Promise<ReadyAction | undefined>;
  markReadyActionFollowUpSent(id: string): Promise<ReadyAction | undefined>;
  expireReadyActions(): Promise<{ expired: ReadyAction[], count: number }>;
  
  // AI Overrides (silent learning feedback loop)
  createAiOverride(override: InsertAiOverride): Promise<AiOverride>;
  getAiOverrides(userId: string): Promise<AiOverride[]>;
  
  // Lead respond tap tracking
  incrementLeadRespondTap(leadId: string): Promise<Lead | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private otpCodes: Map<string, OtpCode>;
  private sessions: Map<string, Session>;
  private jobs: Map<string, Job>;
  private leads: Map<string, Lead>;
  private invoices: Map<string, Invoice>;
  private reminders: Map<string, Reminder>;
  private crewMembers: Map<string, CrewMember>;
  private referrals: Map<string, Referral>;
  private bookingRequests: Map<string, BookingRequest>;
  private voiceNotes: Map<string, VoiceNote>;
  private reviews: Map<string, Review>;
  private userPaymentMethods: Map<string, UserPaymentMethod>;
  private jobPayments: Map<string, JobPayment>;
  private crewInvites: Map<string, CrewInvite>;
  private crewJobPhotos: Map<string, CrewJobPhoto>;
  private crewMessages: Map<string, CrewMessage>;
  private bookingEvents: Map<string, BookingEvent>;
  private priceConfirmations: Map<string, PriceConfirmation>;
  private aiNudges: Map<string, AiNudge>;
  private aiNudgeEvents: Map<string, AiNudgeEvent>;
  private featureFlags: Map<string, FeatureFlag>;
  private jobDrafts: Map<string, JobDraft>;
  private jobResolutions: Map<string, JobResolution>;
  private actionQueueItems: Map<string, ActionQueueItem>;
  private outcomeMetricsDaily: Map<string, OutcomeMetricsDaily>;
  private photoAssets: Map<string, PhotoAsset>;
  private smsMessages: Map<string, SmsMessage>;
  private intentSignals: Map<string, IntentSignal>;
  private readyActions: Map<string, ReadyAction>;
  private aiOverrides: Map<string, AiOverride>;

  constructor() {
    this.users = new Map();
    this.otpCodes = new Map();
    this.sessions = new Map();
    this.jobs = new Map();
    this.leads = new Map();
    this.invoices = new Map();
    this.reminders = new Map();
    this.crewMembers = new Map();
    this.referrals = new Map();
    this.bookingRequests = new Map();
    this.bookingEvents = new Map();
    this.voiceNotes = new Map();
    this.reviews = new Map();
    this.userPaymentMethods = new Map();
    this.jobPayments = new Map();
    this.crewInvites = new Map();
    this.crewJobPhotos = new Map();
    this.crewMessages = new Map();
    this.priceConfirmations = new Map();
    this.aiNudges = new Map();
    this.aiNudgeEvents = new Map();
    this.featureFlags = new Map();
    this.jobDrafts = new Map();
    this.jobResolutions = new Map();
    this.actionQueueItems = new Map();
    this.outcomeMetricsDaily = new Map();
    this.photoAssets = new Map();
    this.smsMessages = new Map();
    this.intentSignals = new Map();
    this.readyActions = new Map();
    this.aiOverrides = new Map();
    
    // Seed default feature flags
    this.featureFlags.set("ai_micro_nudges", {
      key: "ai_micro_nudges",
      enabled: true, // Enabled by default for demo
      description: "AI-powered micro-nudges for leads and invoices",
      updatedAt: new Date().toISOString(),
    });
    this.featureFlags.set("enforce_no_silent_completion", {
      key: "enforce_no_silent_completion",
      enabled: false, // Default OFF for safe rollout - Revenue Protection
      description: "Revenue Protection: Require explicit resolution (invoice/payment/waiver) before completing jobs",
      updatedAt: new Date().toISOString(),
    });
    this.featureFlags.set("nudge_trust_memory", {
      key: "nudge_trust_memory",
      enabled: false, // Default OFF - Trust Memory for AI Nudges
      description: "Trust Memory: 72-hour cooldown after dismissing nudges, prevents same nudge type from reappearing for 3 days",
      updatedAt: new Date().toISOString(),
    });
    this.featureFlags.set("today_money_plan", {
      key: "today_money_plan",
      enabled: false, // Default OFF - Today's Money Plan
      description: "Today's Money Plan: Global prioritization view showing ranked action queue across leads, jobs, and invoices",
      updatedAt: new Date().toISOString(),
    });
    this.featureFlags.set("outcome_attribution", {
      key: "outcome_attribution",
      enabled: false, // Default OFF - Outcome Attribution
      description: "Outcome Attribution: Show 'GigAid helped you collect $X faster' with conservative calculations",
      updatedAt: new Date().toISOString(),
    });
    
    this.seedDemoData();
  }

  private seedDemoData() {
    const userId = "demo-user";
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Seed demo user
    const demoUser: User = {
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
      services: ["Faucet Repair / Replacement", "Drain Cleaning", "Light Fixture Installation", "Standard Home Cleaning"],
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
      // Stripe Connect fields
      stripeConnectAccountId: null,
      stripeConnectStatus: "not_connected",
      stripeConnectOnboardedAt: null,
      // Deposit settings
      depositEnabled: true,
      depositType: "percent",
      depositValue: 50,
      lateRescheduleWindowHours: 24,
      lateRescheduleRetainPctFirst: 40,
      lateRescheduleRetainPctSecond: 60,
      lateRescheduleRetainPctCap: 75,
    };
    this.users.set(userId, demoUser);
    
    const baseJobFields = {
      clientEmail: null,
      clientConfirmStatus: "pending",
      clientConfirmToken: null,
      clientConfirmedAt: null,
      confirmationSentAt: null,
      paymentStatus: "unpaid",
      paymentMethod: null,
      paidAt: null,
      reminder24hSent: false,
      reminder2hSent: false,
      customerLat: null,
      customerLng: null,
      providerLat: null,
      providerLng: null,
      providerLocationUpdatedAt: null,
      reviewToken: null,
      reviewRequestedAt: null,
    };

    const jobs: Job[] = [
      {
        id: "job-1",
        userId,
        title: "Fix leaky kitchen faucet",
        description: "Customer reports dripping faucet, possibly needs new washers",
        serviceType: "plumbing",
        location: "123 Oak Street, Springfield",
        scheduledDate: today.toISOString().split('T')[0],
        scheduledTime: "14:00",
        duration: 60,
        status: "scheduled",
        price: 15000,
        photos: null,
        voiceNote: null,
        voiceNoteTranscript: null,
        voiceNoteSummary: null,
        clientName: "Sarah Johnson",
        clientPhone: "(555) 123-4567",
        assignedCrewId: null,
        materials: null,
        notes: null,
        createdAt: yesterday.toISOString(),
        ...baseJobFields,
      },
      {
        id: "job-2",
        userId,
        title: "Install ceiling fan",
        description: "Replace old light fixture with new ceiling fan in master bedroom",
        serviceType: "electrical",
        location: "456 Maple Ave, Springfield",
        scheduledDate: tomorrow.toISOString().split('T')[0],
        scheduledTime: "10:00",
        duration: 120,
        status: "scheduled",
        price: 25000,
        photos: null,
        voiceNote: null,
        voiceNoteTranscript: null,
        voiceNoteSummary: null,
        clientName: "Mike Chen",
        clientPhone: "(555) 234-5678",
        assignedCrewId: null,
        materials: null,
        notes: null,
        createdAt: yesterday.toISOString(),
        ...baseJobFields,
      },
      {
        id: "job-3",
        userId,
        title: "Deep clean apartment",
        description: "Move-out deep cleaning for 2BR apartment",
        serviceType: "cleaning",
        location: "789 Pine Road, Unit 4B",
        scheduledDate: dayAfter.toISOString().split('T')[0],
        scheduledTime: "09:00",
        duration: 240,
        status: "scheduled",
        price: 35000,
        photos: null,
        voiceNote: null,
        voiceNoteTranscript: null,
        voiceNoteSummary: null,
        clientName: "Emily Davis",
        clientPhone: "(555) 345-6789",
        assignedCrewId: null,
        materials: null,
        notes: null,
        createdAt: today.toISOString(),
        ...baseJobFields,
      },
      {
        id: "job-4",
        userId,
        title: "Unclog bathroom drain",
        description: "Slow draining bathtub, customer tried Drano with no success",
        serviceType: "plumbing",
        location: "321 Elm Street, Springfield",
        scheduledDate: yesterday.toISOString().split('T')[0],
        scheduledTime: "11:00",
        duration: 45,
        status: "completed",
        price: 12500,
        photos: null,
        voiceNote: null,
        voiceNoteTranscript: null,
        voiceNoteSummary: null,
        clientName: "James Wilson",
        clientPhone: "(555) 987-6543",
        assignedCrewId: null,
        materials: null,
        notes: null,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        ...baseJobFields,
        paymentStatus: "paid",
        paymentMethod: "card",
        paidAt: yesterday.toISOString(),
      },
    ];

    jobs.forEach(job => this.jobs.set(job.id, job));

    const leads: Lead[] = [
      {
        id: "lead-1",
        userId,
        clientName: "Robert Brown",
        clientPhone: "(555) 567-8901",
        clientEmail: "robert.b@email.com",
        serviceType: "plumbing",
        description: "Needs water heater replacement, asked for quote",
        status: "new",
        source: "booking_form",
        sourceType: "facebook",
        sourceUrl: "https://facebook.com/marketplace/item/123456",
        score: 75,
        notes: null,
        createdAt: today.toISOString(),
        lastContactedAt: null,
        convertedAt: null,
        convertedJobId: null,
        responseCopiedAt: null,
        followUpStatus: "none",
        followUpSnoozedUntil: null,
      },
      {
        id: "lead-2",
        userId,
        clientName: "Lisa Martinez",
        clientPhone: "(555) 678-9012",
        clientEmail: null,
        serviceType: "electrical",
        description: "Interested in whole-house rewiring estimate",
        status: "response_sent",
        source: "referral",
        sourceType: "craigslist",
        sourceUrl: "https://craigslist.org/services/12345678",
        score: 60,
        notes: null,
        createdAt: yesterday.toISOString(),
        lastContactedAt: today.toISOString(),
        convertedAt: null,
        convertedJobId: null,
        responseCopiedAt: null,
        followUpStatus: "none",
        followUpSnoozedUntil: null,
      },
      {
        id: "lead-3",
        userId,
        clientName: "David Kim",
        clientPhone: "(555) 789-0123",
        clientEmail: "dkim@company.com",
        serviceType: "cleaning",
        description: "Office cleaning, 3x per week contract",
        status: "new",
        source: "manual",
        sourceType: null,
        sourceUrl: null,
        score: 90,
        notes: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastContactedAt: null,
        convertedAt: null,
        convertedJobId: null,
        responseCopiedAt: null,
        followUpStatus: "none",
        followUpSnoozedUntil: null,
      },
    ];

    leads.forEach(lead => this.leads.set(lead.id, lead));

    const invoices: Invoice[] = [
      {
        id: "inv-1",
        invoiceNumber: "INV-001",
        userId,
        jobId: "job-4",
        clientName: "James Wilson",
        clientEmail: "jwilson@email.com",
        clientPhone: "(555) 456-7890",
        serviceDescription: "Unclogged bathroom drain - removed hair and soap buildup, tested flow",
        amount: 12500,
        tax: 0,
        discount: 0,
        status: "paid",
        paymentMethod: "zelle",
        shareLink: null,
        offlineDraft: false,
        createdAt: yesterday.toISOString(),
        sentAt: yesterday.toISOString(),
        paidAt: today.toISOString(),
        publicToken: null,
        emailSentAt: null,
        smsSentAt: null,
      },
      {
        id: "inv-2",
        invoiceNumber: "INV-002",
        userId,
        jobId: null,
        clientName: "Amanda White",
        clientEmail: "awhite@email.com",
        clientPhone: "(555) 890-1234",
        serviceDescription: "Emergency pipe repair - replaced burst pipe section under kitchen sink",
        amount: 28000,
        tax: 0,
        discount: 0,
        status: "sent",
        paymentMethod: null,
        shareLink: "inv-002-share",
        offlineDraft: false,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        sentAt: yesterday.toISOString(),
        paidAt: null,
        publicToken: "test-invoice-token",
        emailSentAt: yesterday.toISOString(),
        smsSentAt: null,
      },
      {
        id: "inv-3",
        invoiceNumber: "INV-003",
        userId,
        jobId: null,
        clientName: "Tom Anderson",
        clientEmail: null,
        clientPhone: "(555) 901-2345",
        serviceDescription: "Installed 3 new outlets in garage workshop",
        amount: 32000,
        tax: 0,
        discount: 0,
        status: "paid",
        paymentMethod: "cash",
        shareLink: null,
        offlineDraft: false,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        paidAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        publicToken: null,
        emailSentAt: null,
        smsSentAt: null,
      },
    ];

    invoices.forEach(inv => this.invoices.set(inv.id, inv));

    // Seed demo reminders
    const reminders: Reminder[] = [
      {
        id: "rem-1",
        userId,
        jobId: "job-1",
        clientName: "Sarah Johnson",
        clientPhone: "(555) 123-4567",
        clientEmail: null,
        message: "Reminder: Your plumbing appointment is tomorrow at 2:00 PM",
        channel: "sms",
        scheduledAt: today.toISOString(),
        status: "pending",
        acknowledgedAt: null,
        createdAt: yesterday.toISOString(),
      },
    ];
    reminders.forEach(r => this.reminders.set(r.id, r));

    // Seed demo crew member
    const crewMembers: CrewMember[] = [
      {
        id: "crew-1",
        userId,
        memberUserId: null,
        name: "John Helper",
        phone: "(555) 111-2222",
        email: "john.helper@email.com",
        role: "helper",
        status: "joined",
        invitedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        joinedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    crewMembers.forEach(c => this.crewMembers.set(c.id, c));

    // Seed demo reviews
    const reviews: Review[] = [
      {
        id: "review-1",
        userId,
        jobId: "job-4",
        invoiceId: null,
        clientName: "James Wilson",
        clientEmail: null,
        clientPhone: "(555) 987-6543",
        rating: 5,
        comment: "Excellent work! Fixed the drain quickly and professionally.",
        providerResponse: null,
        respondedAt: null,
        isPublic: true,
        createdAt: today.toISOString(),
      },
    ];
    reviews.forEach(r => this.reviews.set(r.id, r));

    // Seed demo booking requests with confirmation tokens for testing
    const seedBookingRequests: BookingRequest[] = [
      {
        id: "booking-1",
        userId,
        clientName: "Test Customer",
        clientPhone: "(555) 999-8888",
        clientEmail: "test.customer@email.com",
        serviceType: "plumbing",
        preferredDate: tomorrow.toISOString().split('T')[0],
        preferredTime: "10:00",
        description: "Fix leaky faucet in kitchen",
        location: "123 Test Street, San Francisco, CA 94102",
        status: "approved",
        confirmationToken: "test-booking-token",
        jobStartAt: tomorrow.toISOString(),
        jobEndAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        depositAmountCents: 5000,
        depositCurrency: "usd",
        depositStatus: "none",
        completionStatus: "pending",
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeTransferId: null,
        autoReleaseAt: null,
        lateRescheduleCount: 0,
        lastRescheduleAt: null,
        retainedAmountCents: 0,
        rolledAmountCents: 0,
        waiveRescheduleFee: false,
        customerLat: 37.7749,
        customerLng: -122.4194,
        createdAt: today.toISOString(),
        totalAmountCents: 15000, // Total job price: $150
        remainderPaymentStatus: "pending",
        remainderPaymentMethod: null,
        remainderPaidAt: null,
        remainderNotes: null,
      },
    ];
    seedBookingRequests.forEach(b => this.bookingRequests.set(b.id, b));
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.phone === phone);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUserByPublicSlug(slug: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.publicProfileSlug === slug);
  }

  async getUserByReferralCode(code: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.referralCode === code);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      firstName: null,
      lastName: null,
      name: null,
      phone: null,
      countryCode: null,
      email: null,
      photo: null,
      businessName: null,
      services: null,
      bio: null,
      serviceArea: null,
      onboardingCompleted: false,
      onboardingStep: 0,
      isPro: false,
      proExpiresAt: null,
      notifyBySms: true,
      notifyByEmail: true,
      lastActiveAt: new Date().toISOString(),
      publicProfileEnabled: false,
      publicProfileSlug: null,
      showReviewsOnBooking: true,
      referralCode: `REF${id.slice(0, 8).toUpperCase()}`,
      referredBy: null,
      availability: null,
      slotDuration: 60,
      createdAt: new Date().toISOString(),
      // Stripe Connect fields
      stripeConnectAccountId: null,
      stripeConnectStatus: "not_connected",
      stripeConnectOnboardedAt: null,
      // Deposit settings
      depositEnabled: false,
      depositType: "percent",
      depositValue: 50,
      lateRescheduleWindowHours: 24,
      lateRescheduleRetainPctFirst: 40,
      lateRescheduleRetainPctSecond: 60,
      lateRescheduleRetainPctCap: 75,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    let user = this.users.get(id);
    if (!user) {
      user = {
        id,
        username: "demo",
        password: "demo123",
        firstName: null,
        lastName: null,
        name: null,
        phone: null,
        countryCode: null,
        email: null,
        photo: null,
        businessName: null,
        services: null,
        bio: null,
        serviceArea: null,
        onboardingCompleted: false,
        onboardingStep: 0,
        isPro: false,
        proExpiresAt: null,
        notifyBySms: true,
        notifyByEmail: true,
        lastActiveAt: new Date().toISOString(),
        publicProfileEnabled: false,
        publicProfileSlug: null,
        showReviewsOnBooking: true,
        referralCode: null,
        referredBy: null,
        availability: null,
        slotDuration: 60,
        createdAt: new Date().toISOString(),
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
      };
    }
    const updatedUser = { ...user, ...updates } as User;
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // OTP methods
  async createOtp(otp: InsertOtp): Promise<OtpCode> {
    const id = randomUUID();
    const otpCode: OtpCode = {
      ...otp,
      id,
      verified: false,
      createdAt: new Date().toISOString(),
    };
    this.otpCodes.set(id, otpCode);
    return otpCode;
  }

  async getOtp(identifier: string, code: string): Promise<OtpCode | undefined> {
    return Array.from(this.otpCodes.values()).find(
      o => o.identifier === identifier && o.code === code && !o.verified
    );
  }

  async verifyOtp(id: string): Promise<boolean> {
    const otp = this.otpCodes.get(id);
    if (!otp) return false;
    otp.verified = true;
    this.otpCodes.set(id, otp);
    return true;
  }

  // Session methods
  async createSession(userId: string, token: string, expiresAt: string): Promise<Session> {
    const id = randomUUID();
    const session: Session = { id, userId, token, expiresAt, createdAt: new Date().toISOString() };
    this.sessions.set(token, session);
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    return this.sessions.get(token);
  }

  async deleteSession(token: string): Promise<boolean> {
    return this.sessions.delete(token);
  }

  // Job methods
  async getJobs(userId: string): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobByReviewToken(token: string): Promise<Job | undefined> {
    const jobs = Array.from(this.jobs.values());
    return jobs.find(job => job.reviewToken === token);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const job: Job = {
      ...insertJob,
      id,
      description: insertJob.description || null,
      location: insertJob.location || null,
      duration: insertJob.duration || 60,
      status: insertJob.status || "scheduled",
      price: insertJob.price || null,
      photos: insertJob.photos || null,
      voiceNote: insertJob.voiceNote || null,
      voiceNoteTranscript: insertJob.voiceNoteTranscript || null,
      voiceNoteSummary: insertJob.voiceNoteSummary || null,
      clientName: insertJob.clientName || null,
      clientPhone: insertJob.clientPhone || null,
      clientEmail: insertJob.clientEmail || null,
      assignedCrewId: insertJob.assignedCrewId || null,
      materials: insertJob.materials || null,
      notes: insertJob.notes || null,
      clientConfirmStatus: insertJob.clientConfirmStatus || "pending",
      clientConfirmToken: insertJob.clientConfirmToken || null,
      clientConfirmedAt: insertJob.clientConfirmedAt || null,
      confirmationSentAt: insertJob.confirmationSentAt || null,
      paymentStatus: insertJob.paymentStatus || "unpaid",
      paymentMethod: insertJob.paymentMethod || null,
      paidAt: insertJob.paidAt || null,
      reminder24hSent: insertJob.reminder24hSent || false,
      reminder2hSent: insertJob.reminder2hSent || false,
      customerLat: insertJob.customerLat || null,
      customerLng: insertJob.customerLng || null,
      providerLat: insertJob.providerLat || null,
      providerLng: insertJob.providerLng || null,
      providerLocationUpdatedAt: insertJob.providerLocationUpdatedAt || null,
      reviewToken: insertJob.reviewToken || null,
      reviewRequestedAt: insertJob.reviewRequestedAt || null,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    const updated: Job = { ...job, ...updates };
    this.jobs.set(id, updated);
    return updated;
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  // Lead methods
  async getLeads(userId: string): Promise<Lead[]> {
    return Array.from(this.leads.values())
      .filter(lead => lead.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = {
      ...insertLead,
      id,
      clientPhone: insertLead.clientPhone || null,
      clientEmail: insertLead.clientEmail || null,
      description: insertLead.description || null,
      status: insertLead.status || "new",
      source: insertLead.source || "manual",
      sourceType: insertLead.sourceType || null,
      sourceUrl: insertLead.sourceUrl || null,
      score: insertLead.score || 50,
      notes: insertLead.notes || null,
      createdAt: new Date().toISOString(),
      lastContactedAt: insertLead.lastContactedAt || null,
      convertedAt: null,
      convertedJobId: null,
      responseCopiedAt: insertLead.responseCopiedAt || null,
      followUpStatus: insertLead.followUpStatus || "none",
      followUpSnoozedUntil: insertLead.followUpSnoozedUntil || null,
    };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    const updated: Lead = { ...lead, ...updates };
    if (updates.status === "response_sent" && !lead.lastContactedAt) {
      updated.lastContactedAt = new Date().toISOString();
    }
    if (updates.status === "price_confirmed" && !lead.convertedAt) {
      updated.convertedAt = new Date().toISOString();
    }
    this.leads.set(id, updated);
    return updated;
  }

  async deleteLead(id: string): Promise<boolean> {
    return this.leads.delete(id);
  }

  // Invoice methods
  async getInvoices(userId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter(inv => inv.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async getInvoiceByShareLink(shareLink: string): Promise<Invoice | undefined> {
    return Array.from(this.invoices.values()).find(inv => inv.shareLink === shareLink);
  }

  async getInvoiceByPublicToken(token: string): Promise<Invoice | undefined> {
    return Array.from(this.invoices.values()).find(inv => inv.publicToken === token);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const shareLink = `inv-${id.slice(0, 8)}`;
    const invoice: Invoice = {
      ...insertInvoice,
      id,
      jobId: insertInvoice.jobId || null,
      clientEmail: insertInvoice.clientEmail || null,
      clientPhone: insertInvoice.clientPhone || null,
      tax: insertInvoice.tax || 0,
      discount: insertInvoice.discount || 0,
      status: insertInvoice.status || "draft",
      paymentMethod: insertInvoice.paymentMethod || null,
      shareLink,
      offlineDraft: insertInvoice.offlineDraft || false,
      createdAt: new Date().toISOString(),
      sentAt: insertInvoice.sentAt || null,
      paidAt: insertInvoice.paidAt || null,
      publicToken: insertInvoice.publicToken || null,
      emailSentAt: insertInvoice.emailSentAt || null,
      smsSentAt: insertInvoice.smsSentAt || null,
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    const updated: Invoice = { ...invoice, ...updates };
    this.invoices.set(id, updated);
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  // Reminder methods
  async getReminders(userId: string): Promise<Reminder[]> {
    return Array.from(this.reminders.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }

  async getReminder(id: string): Promise<Reminder | undefined> {
    return this.reminders.get(id);
  }

  async getPendingReminders(): Promise<Reminder[]> {
    const now = new Date().toISOString();
    return Array.from(this.reminders.values())
      .filter(r => r.status === "pending" && r.scheduledAt <= now);
  }

  async createReminder(insertReminder: InsertReminder): Promise<Reminder> {
    const id = randomUUID();
    const reminder: Reminder = {
      ...insertReminder,
      id,
      jobId: insertReminder.jobId || null,
      clientPhone: insertReminder.clientPhone || null,
      clientEmail: insertReminder.clientEmail || null,
      channel: insertReminder.channel || "sms",
      status: "pending",
      acknowledgedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.reminders.set(id, reminder);
    return reminder;
  }

  async updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | undefined> {
    const reminder = this.reminders.get(id);
    if (!reminder) return undefined;
    const updated: Reminder = { ...reminder, ...updates };
    this.reminders.set(id, updated);
    return updated;
  }

  async deleteReminder(id: string): Promise<boolean> {
    return this.reminders.delete(id);
  }

  // Crew methods
  async getCrewMembers(userId: string): Promise<CrewMember[]> {
    return Array.from(this.crewMembers.values()).filter(c => c.userId === userId);
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    return this.crewMembers.get(id);
  }

  async createCrewMember(insertMember: InsertCrewMember): Promise<CrewMember> {
    const id = randomUUID();
    const member: CrewMember = {
      ...insertMember,
      id,
      memberUserId: insertMember.memberUserId || null,
      phone: insertMember.phone || null,
      email: insertMember.email || null,
      role: insertMember.role || "helper",
      status: "invited",
      invitedAt: new Date().toISOString(),
      joinedAt: null,
    };
    this.crewMembers.set(id, member);
    return member;
  }

  async updateCrewMember(id: string, updates: Partial<CrewMember>): Promise<CrewMember | undefined> {
    const member = this.crewMembers.get(id);
    if (!member) return undefined;
    const updated: CrewMember = { ...member, ...updates };
    if (updates.status === "joined" && !member.joinedAt) {
      updated.joinedAt = new Date().toISOString();
    }
    this.crewMembers.set(id, updated);
    return updated;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    return this.crewMembers.delete(id);
  }

  // Referral methods
  async getReferrals(userId: string): Promise<Referral[]> {
    return Array.from(this.referrals.values()).filter(r => r.referrerId === userId);
  }

  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    const id = randomUUID();
    const referral: Referral = {
      ...insertReferral,
      id,
      referredEmail: insertReferral.referredEmail || null,
      referredPhone: insertReferral.referredPhone || null,
      referredUserId: insertReferral.referredUserId || null,
      status: "pending",
      rewardAmount: 0,
      createdAt: new Date().toISOString(),
      convertedAt: null,
    };
    this.referrals.set(id, referral);
    return referral;
  }

  async updateReferral(id: string, updates: Partial<Referral>): Promise<Referral | undefined> {
    const referral = this.referrals.get(id);
    if (!referral) return undefined;
    const updated: Referral = { ...referral, ...updates };
    this.referrals.set(id, updated);
    return updated;
  }

  // Booking Request methods
  async getBookingRequests(userId: string): Promise<BookingRequest[]> {
    return Array.from(this.bookingRequests.values())
      .filter(b => b.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getBookingRequest(id: string): Promise<BookingRequest | undefined> {
    return this.bookingRequests.get(id);
  }

  async createBookingRequest(insertRequest: InsertBookingRequest): Promise<BookingRequest> {
    const id = randomUUID();
    const request: BookingRequest = {
      ...insertRequest,
      id,
      clientPhone: insertRequest.clientPhone || null,
      clientEmail: insertRequest.clientEmail || null,
      preferredDate: insertRequest.preferredDate || null,
      preferredTime: insertRequest.preferredTime || null,
      description: insertRequest.description || null,
      location: insertRequest.location || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      // Deposit fields
      depositAmountCents: insertRequest.depositAmountCents || null,
      depositCurrency: insertRequest.depositCurrency || "usd",
      depositStatus: "none",
      completionStatus: "scheduled",
      // Scheduling timestamps
      jobStartAt: insertRequest.jobStartAt || null,
      jobEndAt: insertRequest.jobEndAt || null,
      autoReleaseAt: null,
      // Reschedule tracking
      lastRescheduleAt: null,
      lateRescheduleCount: 0,
      waiveRescheduleFee: false,
      retainedAmountCents: 0,
      rolledAmountCents: 0,
      // Stripe integration
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeTransferId: null,
      // Customer confirmation token
      confirmationToken: randomUUID(),
      // Location coordinates
      customerLat: insertRequest.customerLat || null,
      customerLng: insertRequest.customerLng || null,
      // Remainder payment fields
      totalAmountCents: insertRequest.totalAmountCents || null,
      remainderPaymentStatus: "pending",
      remainderPaymentMethod: null,
      remainderPaidAt: null,
      remainderNotes: null,
    };
    this.bookingRequests.set(id, request);
    return request;
  }

  async updateBookingRequest(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest | undefined> {
    const request = this.bookingRequests.get(id);
    if (!request) return undefined;
    const updated: BookingRequest = { ...request, ...updates };
    this.bookingRequests.set(id, updated);
    return updated;
  }

  async getBookingRequestByToken(token: string): Promise<BookingRequest | undefined> {
    return Array.from(this.bookingRequests.values()).find(b => b.confirmationToken === token);
  }

  async getBookingRequestsAwaitingRelease(): Promise<BookingRequest[]> {
    const now = new Date();
    return Array.from(this.bookingRequests.values()).filter(b => {
      if (b.completionStatus !== "awaiting_confirmation") return false;
      if (b.depositStatus === "on_hold_dispute") return false;
      if (!b.autoReleaseAt) return false;
      return new Date(b.autoReleaseAt) <= now;
    });
  }

  // Booking Events (audit trail)
  async getBookingEvents(bookingId: string): Promise<BookingEvent[]> {
    return Array.from(this.bookingEvents.values())
      .filter(e => e.bookingId === bookingId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createBookingEvent(insertEvent: InsertBookingEvent): Promise<BookingEvent> {
    const id = randomUUID();
    const event: BookingEvent = {
      ...insertEvent,
      id,
      actorId: insertEvent.actorId || null,
      metadata: insertEvent.metadata || null,
      createdAt: new Date().toISOString(),
    };
    this.bookingEvents.set(id, event);
    return event;
  }

  // Voice Note methods
  async getVoiceNotes(userId: string): Promise<VoiceNote[]> {
    return Array.from(this.voiceNotes.values())
      .filter(v => v.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getVoiceNote(id: string): Promise<VoiceNote | undefined> {
    return this.voiceNotes.get(id);
  }

  async createVoiceNote(insertNote: InsertVoiceNote): Promise<VoiceNote> {
    const id = randomUUID();
    const note: VoiceNote = {
      ...insertNote,
      id,
      jobId: insertNote.jobId || null,
      transcript: insertNote.transcript || null,
      summary: insertNote.summary || null,
      duration: insertNote.duration || null,
      createdAt: new Date().toISOString(),
    };
    this.voiceNotes.set(id, note);
    return note;
  }

  async updateVoiceNote(id: string, updates: Partial<VoiceNote>): Promise<VoiceNote | undefined> {
    const note = this.voiceNotes.get(id);
    if (!note) return undefined;
    const updated: VoiceNote = { ...note, ...updates };
    this.voiceNotes.set(id, updated);
    return updated;
  }

  async deleteVoiceNote(id: string): Promise<boolean> {
    return this.voiceNotes.delete(id);
  }

  // Review methods
  async getReviews(userId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPublicReviews(userId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(r => r.userId === userId && r.isPublic)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = randomUUID();
    const review: Review = {
      ...insertReview,
      id,
      jobId: insertReview.jobId || null,
      invoiceId: insertReview.invoiceId || null,
      clientEmail: insertReview.clientEmail || null,
      clientPhone: insertReview.clientPhone || null,
      comment: insertReview.comment || null,
      providerResponse: null,
      respondedAt: null,
      isPublic: insertReview.isPublic !== false,
      createdAt: new Date().toISOString(),
    };
    this.reviews.set(id, review);
    return review;
  }

  async updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined> {
    const review = this.reviews.get(id);
    if (!review) return undefined;
    const updated = { ...review, ...updates } as Review;
    this.reviews.set(id, updated);
    return updated;
  }

  async getReview(id: string): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  // Dashboard methods
  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const jobs = await this.getJobs(userId);
    const leads = await this.getLeads(userId);
    const invoices = await this.getInvoices(userId);
    const reminders = await this.getReminders(userId);

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const upcomingJobs = jobs.filter(job => {
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= today && (job.status === "scheduled" || job.status === "in_progress");
    }).slice(0, 5);

    const recentLeads = leads.slice(0, 5);

    const totalEarnings = invoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.amount, 0);

    const pendingReminders = reminders.filter(r => r.status === "pending").length;

    // Weekly stats
    const weekJobs = jobs.filter(j => new Date(j.createdAt) >= startOfWeek);
    const weekLeads = leads.filter(l => new Date(l.createdAt) >= startOfWeek);
    const weekEarnings = invoices
      .filter(inv => inv.status === "paid" && inv.paidAt && new Date(inv.paidAt) >= startOfWeek)
      .reduce((sum, inv) => sum + inv.amount, 0);
    const weekCompletedJobs = weekJobs.filter(j => j.status === "completed").length;

    const weeklyStats: WeeklyStats = {
      jobsThisWeek: weekJobs.length,
      leadsThisWeek: weekLeads.length,
      earningsThisWeek: weekEarnings,
      completionRate: weekJobs.length > 0 ? Math.round((weekCompletedJobs / weekJobs.length) * 100) : 0,
    };

    // Monthly stats
    const monthJobs = jobs.filter(j => new Date(j.createdAt) >= startOfMonth);
    const monthLeads = leads.filter(l => new Date(l.createdAt) >= startOfMonth);
    const monthEarnings = invoices
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
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === "completed").length,
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.status === "new").length,
      totalEarnings,
      upcomingJobs,
      recentLeads,
      pendingReminders,
      weeklyStats,
      monthlyStats,
    };
  }

  // User Payment Methods
  async getUserPaymentMethods(userId: string): Promise<UserPaymentMethod[]> {
    return Array.from(this.userPaymentMethods.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUserPaymentMethod(id: string): Promise<UserPaymentMethod | undefined> {
    return this.userPaymentMethods.get(id);
  }

  async createUserPaymentMethod(method: InsertUserPaymentMethod): Promise<UserPaymentMethod> {
    const id = randomUUID();
    const newMethod: UserPaymentMethod = {
      ...method,
      id,
      label: method.label || null,
      instructions: method.instructions || null,
      isEnabled: method.isEnabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.userPaymentMethods.set(id, newMethod);
    return newMethod;
  }

  async updateUserPaymentMethod(id: string, updates: Partial<UserPaymentMethod>): Promise<UserPaymentMethod | undefined> {
    const method = this.userPaymentMethods.get(id);
    if (!method) return undefined;
    const updated: UserPaymentMethod = { 
      ...method, 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    this.userPaymentMethods.set(id, updated);
    return updated;
  }

  async deleteUserPaymentMethod(id: string): Promise<boolean> {
    return this.userPaymentMethods.delete(id);
  }

  // Job Payments
  async getJobPayments(userId: string): Promise<JobPayment[]> {
    return Array.from(this.jobPayments.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getJobPayment(id: string): Promise<JobPayment | undefined> {
    return this.jobPayments.get(id);
  }

  async getJobPaymentsByInvoice(invoiceId: string): Promise<JobPayment[]> {
    return Array.from(this.jobPayments.values())
      .filter(p => p.invoiceId === invoiceId);
  }

  async getJobPaymentsByJob(jobId: string): Promise<JobPayment[]> {
    return Array.from(this.jobPayments.values())
      .filter(p => p.jobId === jobId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createJobPayment(payment: InsertJobPayment): Promise<JobPayment> {
    const id = randomUUID();
    const newPayment: JobPayment = {
      ...payment,
      id,
      invoiceId: payment.invoiceId || null,
      jobId: payment.jobId || null,
      clientName: payment.clientName || null,
      clientEmail: payment.clientEmail || null,
      status: payment.status || "pending",
      stripePaymentIntentId: payment.stripePaymentIntentId || null,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId || null,
      proofUrl: payment.proofUrl || null,
      notes: payment.notes || null,
      paidAt: payment.paidAt || null,
      confirmedAt: payment.confirmedAt || null,
      createdAt: new Date().toISOString(),
    };
    this.jobPayments.set(id, newPayment);
    return newPayment;
  }

  async updateJobPayment(id: string, updates: Partial<JobPayment>): Promise<JobPayment | undefined> {
    const payment = this.jobPayments.get(id);
    if (!payment) return undefined;
    const updated: JobPayment = { ...payment, ...updates };
    this.jobPayments.set(id, updated);
    return updated;
  }

  // Crew Invites
  async getCrewInvites(userId: string): Promise<CrewInvite[]> {
    return Array.from(this.crewInvites.values())
      .filter(i => i.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCrewInvite(id: string): Promise<CrewInvite | undefined> {
    return this.crewInvites.get(id);
  }

  async getCrewInviteByToken(token: string): Promise<CrewInvite | undefined> {
    return Array.from(this.crewInvites.values()).find(i => i.token === token);
  }

  async getCrewInvitesByJob(jobId: string): Promise<CrewInvite[]> {
    return Array.from(this.crewInvites.values())
      .filter(i => i.jobId === jobId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createCrewInvite(invite: InsertCrewInvite): Promise<CrewInvite> {
    const id = randomUUID();
    const newInvite: CrewInvite = {
      ...invite,
      id,
      status: "pending",
      tokenHash: invite.tokenHash || null,
      deliveredVia: invite.deliveredVia || null,
      deliveredAt: null,
      viewedAt: null,
      confirmedAt: null,
      declinedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.crewInvites.set(id, newInvite);
    return newInvite;
  }

  async updateCrewInvite(id: string, updates: Partial<CrewInvite>): Promise<CrewInvite | undefined> {
    const invite = this.crewInvites.get(id);
    if (!invite) return undefined;
    const updated: CrewInvite = { ...invite, ...updates };
    this.crewInvites.set(id, updated);
    return updated;
  }

  async deleteCrewInvite(id: string): Promise<boolean> {
    return this.crewInvites.delete(id);
  }

  // Crew Job Photos
  async getCrewJobPhotos(jobId: string): Promise<CrewJobPhoto[]> {
    return Array.from(this.crewJobPhotos.values())
      .filter(p => p.jobId === jobId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getCrewJobPhoto(id: string): Promise<CrewJobPhoto | undefined> {
    return this.crewJobPhotos.get(id);
  }

  async createCrewJobPhoto(photo: InsertCrewJobPhoto): Promise<CrewJobPhoto> {
    const id = randomUUID();
    const newPhoto: CrewJobPhoto = {
      ...photo,
      id,
      crewInviteId: photo.crewInviteId || null,
      caption: photo.caption || null,
      uploadedAt: new Date().toISOString(),
    };
    this.crewJobPhotos.set(id, newPhoto);
    return newPhoto;
  }

  async deleteCrewJobPhoto(id: string): Promise<boolean> {
    return this.crewJobPhotos.delete(id);
  }

  // Crew Messages
  async getCrewMessages(jobId: string): Promise<CrewMessage[]> {
    return Array.from(this.crewMessages.values())
      .filter(m => m.jobId === jobId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getCrewMessagesByUser(userId: string): Promise<CrewMessage[]> {
    return Array.from(this.crewMessages.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createCrewMessage(message: InsertCrewMessage): Promise<CrewMessage> {
    const id = randomUUID();
    const newMessage: CrewMessage = {
      ...message,
      id,
      crewInviteId: message.crewInviteId || null,
      isFromCrew: message.isFromCrew ?? true,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    this.crewMessages.set(id, newMessage);
    return newMessage;
  }

  async updateCrewMessage(id: string, updates: Partial<CrewMessage>): Promise<CrewMessage | undefined> {
    const msg = this.crewMessages.get(id);
    if (!msg) return undefined;
    const updated: CrewMessage = { ...msg, ...updates };
    this.crewMessages.set(id, updated);
    return updated;
  }

  // Price Confirmations
  async getPriceConfirmation(id: string): Promise<PriceConfirmation | undefined> {
    return this.priceConfirmations.get(id);
  }

  async getPriceConfirmationByToken(token: string): Promise<PriceConfirmation | undefined> {
    return Array.from(this.priceConfirmations.values()).find(p => p.confirmationToken === token);
  }

  async getPriceConfirmationsByLead(leadId: string): Promise<PriceConfirmation[]> {
    return Array.from(this.priceConfirmations.values())
      .filter(p => p.leadId === leadId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPriceConfirmationsByUser(userId: string): Promise<PriceConfirmation[]> {
    return Array.from(this.priceConfirmations.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getActivePriceConfirmationForLead(leadId: string): Promise<PriceConfirmation | undefined> {
    const confirmations = Array.from(this.priceConfirmations.values())
      .filter(p => p.leadId === leadId && (p.status === "draft" || p.status === "sent"))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return confirmations[0];
  }

  async createPriceConfirmation(confirmation: InsertPriceConfirmation): Promise<PriceConfirmation> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newConfirmation: PriceConfirmation = {
      ...confirmation,
      id,
      serviceType: confirmation.serviceType || null,
      notes: confirmation.notes || null,
      status: confirmation.status || "draft",
      sentAt: null,
      viewedAt: null,
      confirmedAt: null,
      convertedJobId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.priceConfirmations.set(id, newConfirmation);
    return newConfirmation;
  }

  async updatePriceConfirmation(id: string, updates: Partial<PriceConfirmation>): Promise<PriceConfirmation | undefined> {
    const confirmation = this.priceConfirmations.get(id);
    if (!confirmation) return undefined;
    const updated: PriceConfirmation = { ...confirmation, ...updates, updatedAt: new Date().toISOString() };
    this.priceConfirmations.set(id, updated);
    return updated;
  }

  async deletePriceConfirmation(id: string): Promise<boolean> {
    return this.priceConfirmations.delete(id);
  }

  // AI Nudges
  async getAiNudges(userId: string): Promise<AiNudge[]> {
    return Array.from(this.aiNudges.values()).filter(n => n.userId === userId);
  }

  async getAiNudge(id: string): Promise<AiNudge | undefined> {
    return this.aiNudges.get(id);
  }

  async getAiNudgesByEntity(entityType: string, entityId: string): Promise<AiNudge[]> {
    return Array.from(this.aiNudges.values()).filter(
      n => n.entityType === entityType && n.entityId === entityId
    );
  }

  async getActiveAiNudgesForUser(userId: string): Promise<AiNudge[]> {
    const now = new Date().toISOString();
    return Array.from(this.aiNudges.values()).filter(n => {
      if (n.userId !== userId) return false;
      if (n.status !== "active") return false;
      if (n.snoozedUntil && n.snoozedUntil > now) return false;
      return true;
    }).sort((a, b) => b.priority - a.priority);
  }

  async getAiNudgeByDedupeKey(dedupeKey: string): Promise<AiNudge | undefined> {
    return Array.from(this.aiNudges.values()).find(n => n.dedupeKey === dedupeKey);
  }

  async createAiNudge(nudge: InsertAiNudge): Promise<AiNudge> {
    const id = randomUUID();
    const newNudge: AiNudge = {
      ...nudge,
      id,
      priority: nudge.priority ?? 50,
      status: nudge.status ?? "active",
      actionPayload: nudge.actionPayload ?? "{}",
      explainText: nudge.explainText ?? "",
      confidence: nudge.confidence ?? null,
      updatedAt: nudge.updatedAt ?? null,
      lastShownAt: nudge.lastShownAt ?? null,
      snoozedUntil: nudge.snoozedUntil ?? null,
    };
    this.aiNudges.set(id, newNudge);
    return newNudge;
  }

  async updateAiNudge(id: string, updates: Partial<AiNudge>): Promise<AiNudge | undefined> {
    const nudge = this.aiNudges.get(id);
    if (!nudge) return undefined;
    const updated = { ...nudge, ...updates, updatedAt: new Date().toISOString() };
    this.aiNudges.set(id, updated);
    return updated;
  }

  async deleteAiNudge(id: string): Promise<boolean> {
    return this.aiNudges.delete(id);
  }

  // AI Nudge Events
  async getAiNudgeEvents(nudgeId: string): Promise<AiNudgeEvent[]> {
    return Array.from(this.aiNudgeEvents.values()).filter(e => e.nudgeId === nudgeId);
  }

  async createAiNudgeEvent(event: InsertAiNudgeEvent): Promise<AiNudgeEvent> {
    const id = randomUUID();
    const newEvent: AiNudgeEvent = {
      ...event,
      id,
      metadata: event.metadata ?? "{}",
    };
    this.aiNudgeEvents.set(id, newEvent);
    return newEvent;
  }

  async getTodayNudgeCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    return Array.from(this.aiNudges.values()).filter(n => 
      n.userId === userId && n.createdAt?.startsWith(today)
    ).length;
  }

  // Get the latest dismiss/snooze event time for Trust Memory cooldown
  // Returns the most recent event timestamp where eventType is 'dismissed' or 'snoozed'
  async getLatestDismissEventTime(nudgeIds: string[]): Promise<string | null> {
    if (nudgeIds.length === 0) return null;
    
    const nudgeIdSet = new Set(nudgeIds);
    const events = Array.from(this.aiNudgeEvents.values())
      .filter(e => 
        nudgeIdSet.has(e.nudgeId) && 
        (e.eventType === "dismissed" || e.eventType === "snoozed")
      )
      .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());
    
    return events.length > 0 ? events[0].eventAt : null;
  }

  // Feature Flags
  async getFeatureFlag(key: string): Promise<FeatureFlag | undefined> {
    return this.featureFlags.get(key);
  }

  async setFeatureFlag(key: string, enabled: boolean, description?: string): Promise<FeatureFlag> {
    const existing = this.featureFlags.get(key);
    const flag: FeatureFlag = {
      key,
      enabled,
      description: description ?? existing?.description ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.featureFlags.set(key, flag);
    return flag;
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.featureFlags.values());
  }

  // Job Drafts (QuickBook)
  async getJobDrafts(userId: string): Promise<JobDraft[]> {
    return Array.from(this.jobDrafts.values()).filter(d => d.userId === userId);
  }

  async getJobDraft(id: string): Promise<JobDraft | undefined> {
    return this.jobDrafts.get(id);
  }

  async getJobDraftByToken(token: string): Promise<JobDraft | undefined> {
    return Array.from(this.jobDrafts.values()).find(d => d.bookingLinkToken === token);
  }

  async createJobDraft(draft: InsertJobDraft): Promise<JobDraft> {
    const id = randomUUID();
    const newDraft: JobDraft = {
      ...draft,
      id,
      status: draft.status ?? "draft",
      parsedFields: draft.parsedFields ?? "{}",
      confidence: draft.confidence ?? "{}",
      paymentConfig: draft.paymentConfig ?? "{}",
      bookingLinkUrl: draft.bookingLinkUrl ?? null,
      bookingLinkToken: draft.bookingLinkToken ?? null,
      jobId: draft.jobId ?? null,
      updatedAt: null,
      expiresAt: draft.expiresAt ?? null,
    };
    this.jobDrafts.set(id, newDraft);
    return newDraft;
  }

  async updateJobDraft(id: string, updates: Partial<JobDraft>): Promise<JobDraft | undefined> {
    const draft = this.jobDrafts.get(id);
    if (!draft) return undefined;
    const updated = { ...draft, ...updates, updatedAt: new Date().toISOString() };
    this.jobDrafts.set(id, updated);
    return updated;
  }

  async deleteJobDraft(id: string): Promise<boolean> {
    return this.jobDrafts.delete(id);
  }

  // ============================================================
  // Job Resolutions (Revenue Protection - No Silent Completion)
  // ============================================================
  // These methods ensure completed jobs have explicit payment resolution

  async getJobResolution(jobId: string): Promise<JobResolution | undefined> {
    return Array.from(this.jobResolutions.values()).find(r => r.jobId === jobId);
  }

  async getJobResolutionsByUser(userId: string): Promise<JobResolution[]> {
    return Array.from(this.jobResolutions.values()).filter(
      r => r.resolvedByUserId === userId
    );
  }

  async getUnresolvedCompletedJobs(userId: string): Promise<Job[]> {
    const completedJobs = Array.from(this.jobs.values()).filter(
      j => j.userId === userId && j.status === "completed"
    );
    const resolutions = await this.getJobResolutionsByUser(userId);
    const resolvedJobIds = new Set(resolutions.map(r => r.jobId));
    return completedJobs.filter(j => !resolvedJobIds.has(j.id));
  }

  async createJobResolution(resolution: InsertJobResolution): Promise<JobResolution> {
    const id = randomUUID();
    const newResolution: JobResolution = {
      ...resolution,
      id,
    };
    this.jobResolutions.set(id, newResolution);
    return newResolution;
  }

  async deleteJobResolution(jobId: string): Promise<boolean> {
    const resolution = Array.from(this.jobResolutions.entries()).find(([, r]) => r.jobId === jobId);
    if (resolution) {
      this.jobResolutions.delete(resolution[0]);
      return true;
    }
    return false;
  }

  // ============================================================
  // Action Queue (Today's Money Plan - Global Prioritization)
  // ============================================================

  async getActionQueueItems(userId: string, status?: string): Promise<ActionQueueItem[]> {
    let items = Array.from(this.actionQueueItems.values())
      .filter(item => item.userId === userId);
    if (status) {
      items = items.filter(item => item.status === status);
    }
    return items.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  async getActionQueueItem(id: string): Promise<ActionQueueItem | undefined> {
    return this.actionQueueItems.get(id);
  }

  async getActionQueueItemByDedupeKey(dedupeKey: string): Promise<ActionQueueItem | undefined> {
    return Array.from(this.actionQueueItems.values()).find(item => item.dedupeKey === dedupeKey);
  }

  async createActionQueueItem(item: InsertActionQueueItem): Promise<ActionQueueItem> {
    const id = randomUUID();
    const newItem: ActionQueueItem = {
      ...item,
      id,
      subtitle: item.subtitle ?? "",
      explainText: item.explainText ?? "",
      ctaPrimaryAction: item.ctaPrimaryAction ?? "{}",
      ctaSecondaryLabel: item.ctaSecondaryLabel ?? null,
      ctaSecondaryAction: item.ctaSecondaryAction ?? null,
      dueAt: item.dueAt ?? null,
      status: item.status ?? "open",
      snoozedUntil: item.snoozedUntil ?? null,
      sourceId: item.sourceId ?? null,
    };
    this.actionQueueItems.set(id, newItem);
    return newItem;
  }

  async updateActionQueueItem(id: string, updates: Partial<ActionQueueItem>): Promise<ActionQueueItem | undefined> {
    const item = this.actionQueueItems.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
    this.actionQueueItems.set(id, updated);
    return updated;
  }

  async deleteActionQueueItem(id: string): Promise<boolean> {
    return this.actionQueueItems.delete(id);
  }

  async clearActionQueue(userId: string): Promise<number> {
    const items = Array.from(this.actionQueueItems.entries())
      .filter(([_, item]) => item.userId === userId);
    for (const [id] of items) {
      this.actionQueueItems.delete(id);
    }
    return items.length;
  }

  // ============================================================
  // Outcome Metrics Daily (GigAid Impact - Outcome Attribution)
  // ============================================================

  async getOutcomeMetricsDaily(userId: string, startDate: string, endDate: string): Promise<OutcomeMetricsDaily[]> {
    return Array.from(this.outcomeMetricsDaily.values())
      .filter(m => m.userId === userId && m.metricDate >= startDate && m.metricDate <= endDate)
      .sort((a, b) => a.metricDate.localeCompare(b.metricDate));
  }

  async getOutcomeMetricsDailyByDate(userId: string, metricDate: string): Promise<OutcomeMetricsDaily | undefined> {
    return Array.from(this.outcomeMetricsDaily.values())
      .find(m => m.userId === userId && m.metricDate === metricDate);
  }

  async createOutcomeMetricsDaily(metrics: InsertOutcomeMetricsDaily): Promise<OutcomeMetricsDaily> {
    const id = randomUUID();
    const newMetrics: OutcomeMetricsDaily = {
      ...metrics,
      id,
      invoicesPaidCount: metrics.invoicesPaidCount ?? 0,
      invoicesPaidAmount: metrics.invoicesPaidAmount ?? 0,
      avgDaysToPaid: metrics.avgDaysToPaid ?? null,
      remindersSentCount: metrics.remindersSentCount ?? 0,
      nudgesActedCount: metrics.nudgesActedCount ?? 0,
      leadsConvertedCount: metrics.leadsConvertedCount ?? 0,
      estimatedDaysSaved: metrics.estimatedDaysSaved ?? 0,
      estimatedCashAccelerated: metrics.estimatedCashAccelerated ?? 0,
      createdAt: metrics.createdAt ?? new Date().toISOString(),
    };
    this.outcomeMetricsDaily.set(id, newMetrics);
    return newMetrics;
  }

  async updateOutcomeMetricsDaily(id: string, updates: Partial<OutcomeMetricsDaily>): Promise<OutcomeMetricsDaily | undefined> {
    const metrics = this.outcomeMetricsDaily.get(id);
    if (!metrics) return undefined;
    const updated = { ...metrics, ...updates };
    this.outcomeMetricsDaily.set(id, updated);
    return updated;
  }

  // ============================================================
  // Photo Assets (Booking/Review/Job photos)
  // ============================================================

  async getPhotoAssets(sourceType: PhotoSourceType, sourceId: string): Promise<PhotoAsset[]> {
    return Array.from(this.photoAssets.values())
      .filter(p => p.sourceType === sourceType && p.sourceId === sourceId);
  }

  async getPhotoAsset(id: string): Promise<PhotoAsset | undefined> {
    return this.photoAssets.get(id);
  }

  async getPhotoAssetsByWorkspace(workspaceUserId: string, sourceType?: PhotoSourceType): Promise<PhotoAsset[]> {
    return Array.from(this.photoAssets.values())
      .filter(p => p.workspaceUserId === workspaceUserId && (!sourceType || p.sourceType === sourceType));
  }

  async createPhotoAsset(asset: InsertPhotoAsset): Promise<PhotoAsset> {
    const id = randomUUID();
    const newAsset: PhotoAsset = {
      ...asset,
      id,
      ownerUserId: asset.ownerUserId ?? null,
      visibility: asset.visibility ?? "private",
      createdAt: new Date().toISOString(),
    };
    this.photoAssets.set(id, newAsset);
    return newAsset;
  }

  async updatePhotoAsset(id: string, updates: Partial<PhotoAsset>): Promise<PhotoAsset | undefined> {
    const asset = this.photoAssets.get(id);
    if (!asset) return undefined;
    const updated = { ...asset, ...updates };
    this.photoAssets.set(id, updated);
    return updated;
  }

  async deletePhotoAsset(id: string): Promise<boolean> {
    return this.photoAssets.delete(id);
  }

  // ============================================================
  // SMS Messages (Inbox with routing)
  // ============================================================

  async getSmsMessages(userId: string): Promise<SmsMessage[]> {
    return Array.from(this.smsMessages.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getSmsMessagesByPhone(userId: string, clientPhone: string): Promise<SmsMessage[]> {
    const normalizedPhone = this.normalizePhone(clientPhone);
    return Array.from(this.smsMessages.values())
      .filter(m => m.userId === userId && this.normalizePhone(m.clientPhone) === normalizedPhone)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getUnreadSmsCount(userId: string): Promise<number> {
    return Array.from(this.smsMessages.values())
      .filter(m => m.userId === userId && m.direction === "inbound" && !m.isRead).length;
  }

  async getLastOutboundMessageByPhone(clientPhone: string): Promise<SmsMessage | undefined> {
    const normalizedPhone = this.normalizePhone(clientPhone);
    const messages = Array.from(this.smsMessages.values())
      .filter(m => m.direction === "outbound" && this.normalizePhone(m.clientPhone) === normalizedPhone)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return messages[0];
  }

  async createSmsMessage(message: InsertSmsMessage): Promise<SmsMessage> {
    const id = randomUUID();
    const newMessage: SmsMessage = {
      ...message,
      id,
      clientName: message.clientName ?? null,
      twilioSid: message.twilioSid ?? null,
      relatedJobId: message.relatedJobId ?? null,
      relatedLeadId: message.relatedLeadId ?? null,
      isRead: message.isRead ?? false,
      createdAt: new Date().toISOString(),
    };
    this.smsMessages.set(id, newMessage);
    return newMessage;
  }

  async markSmsMessagesAsRead(userId: string, clientPhone: string): Promise<number> {
    const normalizedPhone = this.normalizePhone(clientPhone);
    let count = 0;
    for (const [id, msg] of this.smsMessages.entries()) {
      if (msg.userId === userId && this.normalizePhone(msg.clientPhone) === normalizedPhone && 
          msg.direction === "inbound" && !msg.isRead) {
        this.smsMessages.set(id, { ...msg, isRead: true });
        count++;
      }
    }
    return count;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  // ============================================================
  // Stall Detections (Next Best Action Engine)
  // ============================================================

  private stallDetections: Map<string, StallDetection> = new Map();
  private nextActions: Map<string, NextAction> = new Map();
  private autoExecutionLogs: Map<string, AutoExecutionLog> = new Map();

  async getStallDetections(userId: string, entityType?: string): Promise<StallDetection[]> {
    return Array.from(this.stallDetections.values())
      .filter(s => s.userId === userId && (!entityType || s.entityType === entityType) && !s.resolvedAt)
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  async getStallDetection(id: string): Promise<StallDetection | undefined> {
    return this.stallDetections.get(id);
  }

  async getActiveStallForEntity(entityType: string, entityId: string): Promise<StallDetection | undefined> {
    return Array.from(this.stallDetections.values())
      .find(s => s.entityType === entityType && s.entityId === entityId && !s.resolvedAt);
  }

  async createStallDetection(detection: InsertStallDetection): Promise<StallDetection> {
    const id = randomUUID();
    const newDetection: StallDetection = {
      ...detection,
      id,
      moneyAtRisk: detection.moneyAtRisk ?? 0,
      confidence: detection.confidence ?? 0.5,
      resolvedAt: detection.resolvedAt ?? null,
    };
    this.stallDetections.set(id, newDetection);
    return newDetection;
  }

  async updateStallDetection(id: string, updates: Partial<StallDetection>): Promise<StallDetection | undefined> {
    const detection = this.stallDetections.get(id);
    if (!detection) return undefined;
    const updated = { ...detection, ...updates };
    this.stallDetections.set(id, updated);
    return updated;
  }

  async resolveStallDetection(id: string): Promise<StallDetection | undefined> {
    return this.updateStallDetection(id, { resolvedAt: new Date().toISOString() });
  }

  // ============================================================
  // Next Actions (Recommendations)
  // ============================================================

  async getNextActions(userId: string, entityType?: string): Promise<NextAction[]> {
    const now = new Date().toISOString();
    return Array.from(this.nextActions.values())
      .filter(a => 
        a.userId === userId && 
        (!entityType || a.entityType === entityType) && 
        !a.actedAt && 
        !a.dismissedAt &&
        !a.autoExecutedAt &&
        a.expiresAt > now
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getNextAction(id: string): Promise<NextAction | undefined> {
    return this.nextActions.get(id);
  }

  async getActiveNextActionForEntity(entityType: string, entityId: string): Promise<NextAction | undefined> {
    const now = new Date().toISOString();
    return Array.from(this.nextActions.values())
      .find(a => 
        a.entityType === entityType && 
        a.entityId === entityId && 
        !a.actedAt && 
        !a.dismissedAt &&
        !a.autoExecutedAt &&
        a.expiresAt > now
      );
  }

  async createNextAction(action: InsertNextAction): Promise<NextAction> {
    const id = randomUUID();
    const newAction: NextAction = {
      ...action,
      id,
      autoExecutable: action.autoExecutable ?? false,
      actedAt: action.actedAt ?? null,
      dismissedAt: action.dismissedAt ?? null,
      autoExecutedAt: action.autoExecutedAt ?? null,
    };
    this.nextActions.set(id, newAction);
    return newAction;
  }

  async updateNextAction(id: string, updates: Partial<NextAction>): Promise<NextAction | undefined> {
    const action = this.nextActions.get(id);
    if (!action) return undefined;
    const updated = { ...action, ...updates };
    this.nextActions.set(id, updated);
    return updated;
  }

  async actOnNextAction(id: string): Promise<NextAction | undefined> {
    return this.updateNextAction(id, { actedAt: new Date().toISOString() });
  }

  async dismissNextAction(id: string): Promise<NextAction | undefined> {
    return this.updateNextAction(id, { dismissedAt: new Date().toISOString() });
  }

  async expireNextActions(): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;
    for (const [id, action] of this.nextActions.entries()) {
      if (!action.actedAt && !action.dismissedAt && !action.autoExecutedAt && action.expiresAt <= now) {
        this.nextActions.delete(id);
        count++;
      }
    }
    return count;
  }

  // ============================================================
  // Auto Execution Log
  // ============================================================

  async getAutoExecutionLogs(userId: string, entityType?: string, entityId?: string): Promise<AutoExecutionLog[]> {
    return Array.from(this.autoExecutionLogs.values())
      .filter(l => 
        l.userId === userId && 
        (!entityType || l.entityType === entityType) &&
        (!entityId || l.entityId === entityId)
      )
      .sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  }

  async getLastAutoExecutionForEntity(entityType: string, entityId: string): Promise<AutoExecutionLog | undefined> {
    const logs = Array.from(this.autoExecutionLogs.values())
      .filter(l => l.entityType === entityType && l.entityId === entityId)
      .sort((a, b) => b.executedAt.localeCompare(a.executedAt));
    return logs[0];
  }

  async createAutoExecutionLog(log: InsertAutoExecutionLog): Promise<AutoExecutionLog> {
    const id = randomUUID();
    const newLog: AutoExecutionLog = {
      ...log,
      id,
      messageContent: log.messageContent ?? null,
      deliveryChannel: log.deliveryChannel ?? null,
      success: log.success ?? true,
      errorMessage: log.errorMessage ?? null,
    };
    this.autoExecutionLogs.set(id, newLog);
    return newLog;
  }

  // ============================================================
  // Intent Signals
  // ============================================================

  async getIntentSignals(userId: string, entityType?: string, entityId?: string): Promise<IntentSignal[]> {
    return Array.from(this.intentSignals.values())
      .filter(s => 
        s.userId === userId && 
        (!entityType || s.entityType === entityType) &&
        (!entityId || s.entityId === entityId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getUnprocessedIntentSignals(userId: string): Promise<IntentSignal[]> {
    return Array.from(this.intentSignals.values())
      .filter(s => s.userId === userId && !s.processedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createIntentSignal(signal: InsertIntentSignal): Promise<IntentSignal> {
    const id = randomUUID();
    const newSignal: IntentSignal = {
      ...signal,
      id,
      triggerText: signal.triggerText ?? null,
      confidence: signal.confidence ?? 0.8,
      processedAt: signal.processedAt ?? null,
    };
    this.intentSignals.set(id, newSignal);
    return newSignal;
  }

  async markIntentSignalProcessed(id: string): Promise<IntentSignal | undefined> {
    const signal = this.intentSignals.get(id);
    if (!signal) return undefined;
    
    const updated: IntentSignal = {
      ...signal,
      processedAt: new Date().toISOString(),
    };
    this.intentSignals.set(id, updated);
    return updated;
  }

  // ============================================================
  // Ready Actions (pre-filled one-tap actions)
  // ============================================================

  async getReadyActions(userId: string): Promise<ReadyAction[]> {
    const now = new Date().toISOString();
    return Array.from(this.readyActions.values())
      .filter(a => 
        a.userId === userId && 
        !a.actedAt && 
        !a.dismissedAt && 
        a.expiresAt > now
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getActiveReadyActionForEntity(entityType: string, entityId: string): Promise<ReadyAction | undefined> {
    const now = new Date().toISOString();
    return Array.from(this.readyActions.values())
      .find(a => 
        a.entityType === entityType && 
        a.entityId === entityId && 
        !a.actedAt && 
        !a.dismissedAt && 
        a.expiresAt > now
      );
  }

  async createReadyAction(action: InsertReadyAction): Promise<ReadyAction> {
    const id = randomUUID();
    const newAction: ReadyAction = {
      ...action,
      id,
      intentSignalId: action.intentSignalId ?? null,
      prefilledAmount: action.prefilledAmount ?? null,
      prefilledClientName: action.prefilledClientName ?? null,
      prefilledClientEmail: action.prefilledClientEmail ?? null,
      prefilledClientPhone: action.prefilledClientPhone ?? null,
      prefilledDueDate: action.prefilledDueDate ?? null,
      prefilledServiceType: action.prefilledServiceType ?? null,
      prefilledDescription: action.prefilledDescription ?? null,
      actedAt: action.actedAt ?? null,
      dismissedAt: action.dismissedAt ?? null,
      autoFollowUpSent: action.autoFollowUpSent ?? false,
      autoFollowUpSentAt: action.autoFollowUpSentAt ?? null,
      ctaLabel: action.ctaLabel ?? "Send & Get Paid",
    };
    this.readyActions.set(id, newAction);
    return newAction;
  }

  async updateReadyAction(id: string, updates: Partial<ReadyAction>): Promise<ReadyAction | undefined> {
    const action = this.readyActions.get(id);
    if (!action) return undefined;
    
    const updated: ReadyAction = { ...action, ...updates };
    this.readyActions.set(id, updated);
    return updated;
  }

  async actOnReadyAction(id: string): Promise<ReadyAction | undefined> {
    return this.updateReadyAction(id, { actedAt: new Date().toISOString() });
  }

  async dismissReadyAction(id: string): Promise<ReadyAction | undefined> {
    return this.updateReadyAction(id, { dismissedAt: new Date().toISOString() });
  }

  async markReadyActionFollowUpSent(id: string): Promise<ReadyAction | undefined> {
    return this.updateReadyAction(id, { 
      autoFollowUpSent: true, 
      autoFollowUpSentAt: new Date().toISOString() 
    });
  }

  async expireReadyActions(): Promise<{ expired: ReadyAction[], count: number }> {
    const now = new Date().toISOString();
    const expired: ReadyAction[] = [];
    
    for (const [id, action] of this.readyActions.entries()) {
      if (!action.actedAt && !action.dismissedAt && action.expiresAt <= now) {
        expired.push(action);
        this.readyActions.delete(id);
      }
    }
    
    return { expired, count: expired.length };
  }

  async getActiveReadyActionsForUser(userId: string): Promise<ReadyAction[]> {
    const now = new Date().toISOString();
    return Array.from(this.readyActions.values())
      .filter(a => 
        a.userId === userId && 
        !a.actedAt && 
        !a.dismissedAt && 
        a.expiresAt > now
      );
  }

  // ============================================================
  // AI Overrides (silent learning feedback loop)
  // ============================================================

  async createAiOverride(override: InsertAiOverride): Promise<AiOverride> {
    const id = randomUUID();
    const newOverride: AiOverride = {
      ...override,
      id,
      originalAction: override.originalAction ?? null,
      originalAmount: override.originalAmount ?? null,
      originalTiming: override.originalTiming ?? null,
      userAction: override.userAction ?? null,
      userAmount: override.userAmount ?? null,
      delaySeconds: override.delaySeconds ?? null,
      confidenceScore: override.confidenceScore ?? null,
      intentSignals: override.intentSignals ?? null,
      timeOfDay: override.timeOfDay ?? null,
      jobType: override.jobType ?? null,
    };
    this.aiOverrides.set(id, newOverride);
    return newOverride;
  }

  async getAiOverrides(userId: string): Promise<AiOverride[]> {
    return Array.from(this.aiOverrides.values())
      .filter(o => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ============================================================
  // Lead respond tap tracking
  // ============================================================

  async incrementLeadRespondTap(leadId: string): Promise<Lead | undefined> {
    const lead = this.leads.get(leadId);
    if (!lead) return undefined;
    
    const updated: Lead = {
      ...lead,
      respondTapCount: (lead.respondTapCount || 0) + 1,
      lastRespondTapAt: new Date().toISOString(),
    };
    this.leads.set(leadId, updated);
    return updated;
  }
}

import { dbStorage } from "./db-storage";

// Use PostgreSQL-backed storage for persistent data
export const storage: IStorage = dbStorage;
