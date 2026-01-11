import { storage } from "./storage";
import { sendEmail } from "./sendgrid";
import type { User } from "@shared/schema";

interface WeeklyMetrics {
  weeklyRevenue: number;
  jobsCompleted: number;
  newLeads: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesTotal: number;
  upcomingJobsCount: number;
}

async function getWeeklyMetrics(userId: string): Promise<WeeklyMetrics> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const jobs = await storage.getJobs(userId);
  const leads = await storage.getLeads(userId);
  const invoices = await storage.getInvoices(userId);

  const completedJobs = jobs.filter(job => {
    if (job.status !== "completed") return false;
    const paidAt = job.paidAt ? new Date(job.paidAt) : null;
    const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
    const completionDate = paidAt || scheduledDate;
    return completionDate && completionDate >= oneWeekAgo;
  });

  const weeklyRevenue = completedJobs.reduce((sum, job) => sum + (job.price || 0), 0);
  const jobsCompleted = completedJobs.length;

  const newLeads = leads.filter(lead => {
    const createdAt = lead.createdAt ? new Date(lead.createdAt) : null;
    return createdAt && createdAt >= oneWeekAgo;
  }).length;

  const unpaidInvoices = invoices.filter(inv => inv.status === "pending" || inv.status === "sent");
  const outstandingInvoicesCount = unpaidInvoices.length;
  const outstandingInvoicesTotal = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const upcomingJobs = jobs.filter(job => {
    if (job.status !== "scheduled") return false;
    const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : null;
    return scheduledDate && scheduledDate >= now && scheduledDate <= oneWeekFromNow;
  });

  return {
    weeklyRevenue,
    jobsCompleted,
    newLeads,
    outstandingInvoicesCount,
    outstandingInvoicesTotal,
    upcomingJobsCount: upcomingJobs.length,
  };
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function buildEmailHtml(
  userName: string,
  metrics: WeeklyMetrics,
  ownerViewUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your GigAid Weekly Summary</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">GigAid</h1>
    <p style="margin: 0; opacity: 0.9;">Your Weekly Business Summary</p>
  </div>

  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <p style="margin: 0 0 16px 0; color: #64748b;">Hi ${userName || "there"},</p>
    <p style="margin: 0; color: #334155; font-size: 18px; font-weight: 600;">Here's how your business did last week</p>
  </div>

  <div style="display: grid; gap: 12px; margin-bottom: 24px;">
    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 28px;">💰</div>
        <div>
          <p style="margin: 0; color: #64748b; font-size: 14px;">Revenue</p>
          <p style="margin: 0; color: #16a34a; font-size: 24px; font-weight: 700;">${formatCurrency(metrics.weeklyRevenue)}</p>
        </div>
      </div>
    </div>

    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 28px;">🛠</div>
        <div>
          <p style="margin: 0; color: #64748b; font-size: 14px;">Jobs Completed</p>
          <p style="margin: 0; color: #334155; font-size: 24px; font-weight: 700;">${metrics.jobsCompleted}</p>
        </div>
      </div>
    </div>

    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 28px;">📥</div>
        <div>
          <p style="margin: 0; color: #64748b; font-size: 14px;">New Leads</p>
          <p style="margin: 0; color: #334155; font-size: 24px; font-weight: 700;">${metrics.newLeads}</p>
        </div>
      </div>
    </div>

    ${metrics.outstandingInvoicesCount > 0 ? `
    <div style="background: #fffbeb; border-radius: 12px; padding: 20px; border: 1px solid #fcd34d;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 28px;">⚠️</div>
        <div>
          <p style="margin: 0; color: #92400e; font-size: 14px;">Unpaid Invoices</p>
          <p style="margin: 0; color: #92400e; font-size: 24px; font-weight: 700;">${metrics.outstandingInvoicesCount} (${formatCurrency(metrics.outstandingInvoicesTotal)})</p>
        </div>
      </div>
    </div>
    ` : ""}

    <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 28px;">📅</div>
        <div>
          <p style="margin: 0; color: #64748b; font-size: 14px;">Jobs Coming Up (Next 7 Days)</p>
          <p style="margin: 0; color: #334155; font-size: 24px; font-weight: 700;">${metrics.upcomingJobsCount}</p>
        </div>
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${ownerViewUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
      View Full Owner Summary
    </a>
  </div>

  <div style="text-align: center; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">You received this because you're a GigAid Pro subscriber.</p>
    <p style="margin: 8px 0 0 0;">© ${new Date().getFullYear()} GigAid. All rights reserved.</p>
  </div>
</body>
</html>
  `.trim();
}

function buildEmailText(
  userName: string,
  metrics: WeeklyMetrics,
  ownerViewUrl: string
): string {
  return `
GigAid Weekly Summary

Hi ${userName || "there"},

Here's how your business did last week:

💰 Revenue: ${formatCurrency(metrics.weeklyRevenue)}
🛠 Jobs Completed: ${metrics.jobsCompleted}
📥 New Leads: ${metrics.newLeads}
${metrics.outstandingInvoicesCount > 0 ? `⚠️ Unpaid Invoices: ${metrics.outstandingInvoicesCount} (${formatCurrency(metrics.outstandingInvoicesTotal)})` : ""}
📅 Jobs Coming Up: ${metrics.upcomingJobsCount}

View your full Owner Summary: ${ownerViewUrl}

---
You received this because you're a GigAid Pro subscriber.
  `.trim();
}

export async function sendWeeklySummaryToUser(
  userId: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    
    if (!user) {
      console.log(`[WeeklySummary] User ${userId} not found`);
      return false;
    }

    if (!user.isPro) {
      console.log(`[WeeklySummary] Skipping ${userId} - not a Pro user`);
      return false;
    }

    if (!user.email) {
      console.log(`[WeeklySummary] Skipping ${userId} - no email`);
      return false;
    }

    if (user.notifyByEmail === false) {
      console.log(`[WeeklySummary] Skipping ${userId} - email notifications disabled`);
      return false;
    }

    const metrics = await getWeeklyMetrics(userId);
    const ownerViewUrl = `${baseUrl}/owner`;

    const html = buildEmailHtml(user.name || user.firstName || "", metrics, ownerViewUrl);
    const text = buildEmailText(user.name || user.firstName || "", metrics, ownerViewUrl);

    const success = await sendEmail({
      to: user.email,
      subject: "Your GigAid weekly summary",
      text,
      html,
    });

    if (success) {
      console.log(`[WeeklySummary] Sent weekly summary to ${user.email}`);
    }

    return success;
  } catch (error) {
    console.error(`[WeeklySummary] Error sending to ${userId}:`, error);
    return false;
  }
}

export async function sendWeeklySummaryToAllProUsers(baseUrl: string): Promise<void> {
  console.log("[WeeklySummary] Starting weekly summary job...");
  
  try {
    const users = await storage.getAllUsers();
    const proUsers = users.filter((u: User) => u.isPro && u.email && u.notifyByEmail !== false);
    
    console.log(`[WeeklySummary] Found ${proUsers.length} Pro users with email notifications enabled`);
    
    let sent = 0;
    let failed = 0;
    
    for (const user of proUsers) {
      const success = await sendWeeklySummaryToUser(user.id, baseUrl);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[WeeklySummary] Completed: ${sent} sent, ${failed} failed`);
  } catch (error) {
    console.error("[WeeklySummary] Error in weekly summary job:", error);
  }
}

let weeklySchedulerInterval: NodeJS.Timeout | null = null;

export function startWeeklySummaryScheduler(baseUrl: string): void {
  console.log("[WeeklySummary] Starting weekly summary scheduler (Monday 8am check)");
  
  const checkInterval = 60 * 60 * 1000;
  
  const checkAndSend = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    
    if (dayOfWeek === 1 && hour === 8) {
      console.log("[WeeklySummary] It's Monday 8am - sending weekly summaries");
      sendWeeklySummaryToAllProUsers(baseUrl);
    }
  };
  
  weeklySchedulerInterval = setInterval(checkAndSend, checkInterval);
  
  checkAndSend();
}

export function stopWeeklySummaryScheduler(): void {
  if (weeklySchedulerInterval) {
    clearInterval(weeklySchedulerInterval);
    weeklySchedulerInterval = null;
    console.log("[WeeklySummary] Stopped weekly summary scheduler");
  }
}
