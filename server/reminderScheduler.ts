import { storage } from "./storage";
import { sendSMS } from "./twilio";

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

async function checkAndSendReminders() {
  try {
    const jobs = await storage.getJobs("demo-user");
    const now = new Date();
    
    for (const job of jobs) {
      if (job.status !== "scheduled") continue;
      if (!job.clientPhone) continue;

      const jobDateTime = new Date(`${job.scheduledDate}T${job.scheduledTime}`);
      const hoursUntilJob = (jobDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilJob > 0 && hoursUntilJob <= 24 && !job.reminder24hSent) {
        const message = `Reminder: Your appointment for "${job.title}" is tomorrow at ${formatTime(job.scheduledTime)}. See you soon!`;
        
        try {
          await sendSMS(job.clientPhone, message);
          await storage.updateJob(job.id, { reminder24hSent: true });
          console.log(`[Reminder] Sent 24h reminder for job ${job.id}`);
        } catch (err) {
          console.error(`[Reminder] Failed to send 24h reminder for job ${job.id}:`, err);
        }
      }

      if (hoursUntilJob > 0 && hoursUntilJob <= 2 && !job.reminder2hSent) {
        const message = `Reminder: Your appointment for "${job.title}" is in about 2 hours at ${formatTime(job.scheduledTime)}. See you soon!`;
        
        try {
          await sendSMS(job.clientPhone, message);
          await storage.updateJob(job.id, { reminder2hSent: true });
          console.log(`[Reminder] Sent 2h reminder for job ${job.id}`);
        } catch (err) {
          console.error(`[Reminder] Failed to send 2h reminder for job ${job.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("[Reminder] Error checking reminders:", error);
  }
}

export function startReminderScheduler() {
  console.log("[Reminder] Starting auto-reminder scheduler (checks every 5 minutes)");
  checkAndSendReminders();
  setInterval(checkAndSendReminders, 5 * 60 * 1000);
}
