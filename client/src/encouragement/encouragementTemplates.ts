export type EncouragementCategory = "progress" | "effort" | "resilience" | "identity";

export interface EncouragementTemplate {
  id: string;
  category: EncouragementCategory;
  template: string;
  requiredVars: string[];
}

export const progressTemplates: EncouragementTemplate[] = [
  {
    id: "weekly_earnings",
    category: "progress",
    template: "You earned ${{weeklyEarnings}} this week. One more job gets you past ${{nextTarget}}.",
    requiredVars: ["weeklyEarnings", "nextTarget"],
  },
  {
    id: "weekly_growth",
    category: "progress",
    template: "Up {{percentChange}}% from last week. Keep this pace.",
    requiredVars: ["percentChange"],
  },
  {
    id: "jobs_completed",
    category: "progress",
    template: "{{jobsCompleted}} jobs done this week. That's real momentum.",
    requiredVars: ["jobsCompleted"],
  },
  {
    id: "collected_today",
    category: "progress",
    template: "You collected ${{collectedToday}} today. Nice work.",
    requiredVars: ["collectedToday"],
  },
  {
    id: "money_waiting",
    category: "progress",
    template: "${{moneyWaiting}} is waiting on you. A quick reminder could bring it in today.",
    requiredVars: ["moneyWaiting"],
  },
];

export const effortTemplates: EncouragementTemplate[] = [
  {
    id: "reminder_sent",
    category: "effort",
    template: "Good move \u2014 reminders usually get paid within 48 hours.",
    requiredVars: [],
  },
  {
    id: "invoice_sent",
    category: "effort",
    template: "Invoice sent. Most clients pay within 3 days when you send on time.",
    requiredVars: [],
  },
  {
    id: "link_shared",
    category: "effort",
    template: "Sharing your link brings in new bookings. Smart move.",
    requiredVars: [],
  },
  {
    id: "job_marked_complete",
    category: "effort",
    template: "Job done. Send the invoice now while it\u2019s fresh.",
    requiredVars: [],
  },
  {
    id: "follow_up_sent",
    category: "effort",
    template: "Follow-ups close deals. Most pros win jobs after the second message.",
    requiredVars: [],
  },
];

export const resilienceTemplates: EncouragementTemplate[] = [
  {
    id: "quiet_day",
    category: "resilience",
    template: "Quiet days happen. One reminder can change today.",
    requiredVars: [],
  },
  {
    id: "follow_up_reminder",
    category: "resilience",
    template: "Most pros close jobs after follow-ups. Send one today.",
    requiredVars: [],
  },
  {
    id: "invoice_nudge",
    category: "resilience",
    template: "${{outstandingAmount}} is still outstanding. A quick nudge could bring it in.",
    requiredVars: ["outstandingAmount"],
  },
  {
    id: "booking_reminder",
    category: "resilience",
    template: "Share your booking link today \u2014 it only takes one new client.",
    requiredVars: [],
  },
];

export const identityTemplates: EncouragementTemplate[] = [
  {
    id: "real_business",
    category: "identity",
    template: "You\u2019re running a real business. Keep going.",
    requiredVars: [],
  },
  {
    id: "track_money",
    category: "identity",
    template: "Pros track their money. You do.",
    requiredVars: [],
  },
  {
    id: "consistency",
    category: "identity",
    template: "Consistency wins. You\u2019re building something.",
    requiredVars: [],
  },
];

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}
