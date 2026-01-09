import { 
  type User, type InsertUser, 
  type Job, type InsertJob,
  type Lead, type InsertLead,
  type Invoice, type InsertInvoice,
  type DashboardSummary
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getJobs(userId: string): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;

  getLeads(userId: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;

  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;

  getDashboardSummary(userId: string): Promise<DashboardSummary>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;
  private leads: Map<string, Lead>;
  private invoices: Map<string, Invoice>;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.leads = new Map();
    this.invoices = new Map();
    
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
        clientName: "Sarah Johnson",
        clientPhone: "(555) 123-4567",
        createdAt: yesterday.toISOString(),
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
        clientName: "Mike Chen",
        clientPhone: "(555) 234-5678",
        createdAt: yesterday.toISOString(),
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
        clientName: "Emily Davis",
        clientPhone: "(555) 345-6789",
        createdAt: today.toISOString(),
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
        clientName: "James Wilson",
        clientPhone: "(555) 456-7890",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
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
        createdAt: today.toISOString(),
        lastContactedAt: null,
      },
      {
        id: "lead-2",
        userId,
        clientName: "Lisa Martinez",
        clientPhone: "(555) 678-9012",
        clientEmail: null,
        serviceType: "electrical",
        description: "Interested in whole-house rewiring estimate",
        status: "contacted",
        source: "referral",
        createdAt: yesterday.toISOString(),
        lastContactedAt: today.toISOString(),
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
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastContactedAt: null,
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
        status: "paid",
        paymentMethod: "zelle",
        createdAt: yesterday.toISOString(),
        sentAt: yesterday.toISOString(),
        paidAt: today.toISOString(),
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
        status: "sent",
        paymentMethod: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        sentAt: yesterday.toISOString(),
        paidAt: null,
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
        status: "paid",
        paymentMethod: "cash",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        paidAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    invoices.forEach(inv => this.invoices.set(inv.id, inv));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      name: null,
      phone: null,
      email: null,
      photo: null,
      onboardingCompleted: false,
    };
    this.users.set(id, user);
    return user;
  }

  async getJobs(userId: string): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
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
      clientName: insertJob.clientName || null,
      clientPhone: insertJob.clientPhone || null,
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
      createdAt: new Date().toISOString(),
      lastContactedAt: insertLead.lastContactedAt || null,
    };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    
    const updated: Lead = { ...lead, ...updates };
    if (updates.status === "contacted" && !lead.lastContactedAt) {
      updated.lastContactedAt = new Date().toISOString();
    }
    this.leads.set(id, updated);
    return updated;
  }

  async deleteLead(id: string): Promise<boolean> {
    return this.leads.delete(id);
  }

  async getInvoices(userId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter(inv => inv.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const invoice: Invoice = {
      ...insertInvoice,
      id,
      jobId: insertInvoice.jobId || null,
      clientEmail: insertInvoice.clientEmail || null,
      clientPhone: insertInvoice.clientPhone || null,
      status: insertInvoice.status || "draft",
      paymentMethod: insertInvoice.paymentMethod || null,
      createdAt: new Date().toISOString(),
      sentAt: insertInvoice.sentAt || null,
      paidAt: insertInvoice.paidAt || null,
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

  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const jobs = await this.getJobs(userId);
    const leads = await this.getLeads(userId);
    const invoices = await this.getInvoices(userId);

    const today = new Date();
    const upcomingJobs = jobs.filter(job => {
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= today && (job.status === "scheduled" || job.status === "in_progress");
    }).slice(0, 5);

    const recentLeads = leads.slice(0, 5);

    const totalEarnings = invoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.amount, 0);

    return {
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === "completed").length,
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.status === "new").length,
      totalEarnings,
      upcomingJobs,
      recentLeads,
    };
  }
}

export const storage = new MemStorage();
