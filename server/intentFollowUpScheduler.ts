import { storage } from "./storage";
import { sendSMS } from "./twilio";

const FOLLOW_UP_DELAY_HOURS = 4;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export function startIntentFollowUpScheduler() {
  console.log("[IntentFollowUp] Starting scheduler (checks every 5 minutes)");
  
  setInterval(async () => {
    try {
      await checkAndSendFollowUps();
    } catch (error) {
      console.error("[IntentFollowUp] Scheduler error:", error);
    }
  }, CHECK_INTERVAL_MS);
  
  // Run once immediately on startup
  setTimeout(() => checkAndSendFollowUps().catch(console.error), 10000);
}

async function checkAndSendFollowUps() {
  const invoices = await storage.getInvoices("demo-user");
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - FOLLOW_UP_DELAY_HOURS * 60 * 60 * 1000);
  
  for (const invoice of invoices) {
    // Only process invoices that:
    // 1. Were created from a ready action (intent-driven)
    // 2. Are still in 'sent' status (not paid)
    // 3. Haven't had a follow-up sent yet
    // 4. Were sent more than X hours ago
    if (
      invoice.sourceReadyActionId &&
      invoice.status === "sent" &&
      !invoice.intentFollowUpSent &&
      invoice.sentAt &&
      new Date(invoice.sentAt) < cutoffTime
    ) {
      await sendFollowUpNudge(invoice);
    }
  }
}

async function sendFollowUpNudge(invoice: {
  id: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  publicToken: string | null;
  amount: number;
}) {
  const now = new Date().toISOString();
  
  // Compose the one-time nudge message
  const invoiceUrl = invoice.publicToken 
    ? `${process.env.FRONTEND_URL || "http://localhost:5000"}/pay/${invoice.publicToken}`
    : null;
  
  const nudgeMessage = invoiceUrl
    ? `Just sent this over so we can lock in the time. ${invoiceUrl}`
    : `Just sent this over so we can lock in the time.`;
  
  let sent = false;
  
  // Try SMS first
  if (invoice.clientPhone) {
    try {
      const success = await sendSMS(invoice.clientPhone, nudgeMessage);
      if (success) {
        sent = true;
        console.log(`[IntentFollowUp] Sent SMS nudge for invoice ${invoice.id} to ${invoice.clientPhone}`);
      }
    } catch (err) {
      console.error(`[IntentFollowUp] SMS failed for invoice ${invoice.id}:`, err);
    }
  }
  
  // Try email if SMS didn't work
  if (!sent && invoice.clientEmail) {
    try {
      const sgMail = (await import("@sendgrid/mail")).default;
      if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const user = await storage.getUser("demo-user");
        
        await sgMail.send({
          to: invoice.clientEmail,
          from: {
            email: process.env.SENDGRID_VERIFIED_SENDER || "noreply@example.com",
            name: user?.businessName || user?.name || "GigAid"
          },
          subject: "Quick follow-up",
          html: `<p>Just sent this over so we can lock in the time.</p>${invoiceUrl ? `<p><a href="${invoiceUrl}">View Invoice</a></p>` : ""}`,
        });
        sent = true;
        console.log(`[IntentFollowUp] Sent email nudge for invoice ${invoice.id} to ${invoice.clientEmail}`);
      }
    } catch (err) {
      console.error(`[IntentFollowUp] Email failed for invoice ${invoice.id}:`, err);
    }
  }
  
  // Mark follow-up as sent regardless (to prevent retry loops)
  await storage.updateInvoice(invoice.id, {
    intentFollowUpSent: true,
    intentFollowUpSentAt: now,
  });
  
  if (sent) {
    console.log(`[IntentFollowUp] Successfully sent one-time nudge for invoice ${invoice.id}`);
  } else {
    console.log(`[IntentFollowUp] Could not send nudge for invoice ${invoice.id} (no contact method available)`);
  }
}
