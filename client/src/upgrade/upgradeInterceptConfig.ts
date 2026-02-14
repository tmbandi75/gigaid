import type { NewCapability } from "@/hooks/useCapability";
import type { SubscriptionPlan } from "@/lib/stripeCheckout";

export interface FeatureInterceptInfo {
  title: string;
  description: string;
  benefits: string[];
  recommendedPlan: SubscriptionPlan;
}

export const FEATURE_INTERCEPT_CONFIG: Record<NewCapability, FeatureInterceptInfo> = {
  "jobs.create": {
    title: "Unlimited Job Creation",
    description: "Create as many jobs as you need to keep your schedule full and your income growing.",
    benefits: [
      "Create unlimited jobs every month",
      "Auto follow-ups that recover missed bookings",
      "One-click job creation from templates",
    ],
    recommendedPlan: "pro",
  },
  "invoices.send": {
    title: "Professional Invoicing",
    description: "Send unlimited invoices and get paid faster with automatic payment reminders.",
    benefits: [
      "Unlimited invoices every month",
      "Automatic payment reminders",
      "Track who viewed and who paid",
    ],
    recommendedPlan: "pro",
  },
  "leads.manage": {
    title: "Lead Management",
    description: "Track and manage all your leads in one place so no opportunity slips through.",
    benefits: [
      "Organize and prioritize incoming leads",
      "Follow-up reminders so no lead goes cold",
      "Convert leads to jobs with one tap",
    ],
    recommendedPlan: "pro",
  },
  "clients.manage": {
    title: "Client Management",
    description: "Keep all your client info organized and accessible from anywhere.",
    benefits: [
      "Full client contact database",
      "Job and payment history per client",
      "Quick access to repeat booking details",
    ],
    recommendedPlan: "pro",
  },
  "booking.link": {
    title: "Booking Link",
    description: "Share your personal booking link so clients can book and pay online.",
    benefits: [
      "Custom booking page for your services",
      "Clients book and pay in one step",
      "Share via text, email, or social media",
    ],
    recommendedPlan: "pro",
  },
  "deposit.enforce": {
    title: "Deposit Protection",
    description: "Require deposits to lock in bookings and reduce no-shows by up to 80%.",
    benefits: [
      "Automatic deposit collection on booking",
      "Reduce no-shows dramatically",
      "Keep your income predictable",
    ],
    recommendedPlan: "pro_plus",
  },
  "booking.risk_protection": {
    title: "Booking Risk Protection",
    description: "Protect every booking from cancellations and no-shows with smart policies.",
    benefits: [
      "Cancellation and reschedule fees",
      "Automated no-show protection",
      "Revenue protection on every booking",
    ],
    recommendedPlan: "pro_plus",
  },
  "price.confirmation": {
    title: "Price Confirmations",
    description: "Send professional price quotes that auto-create jobs when clients approve.",
    benefits: [
      "Unlimited price confirmations",
      "Automatic job creation on approval",
      "Close more deals with clear pricing",
    ],
    recommendedPlan: "pro",
  },
  "ai.micro_nudges": {
    title: "AI Micro-Nudges",
    description: "Get smart, contextual recommendations to manage leads, invoices, and jobs.",
    benefits: [
      "AI-powered action suggestions",
      "Never miss a follow-up opportunity",
      "Prioritized daily task list",
    ],
    recommendedPlan: "pro",
  },
  "ai.money_plan": {
    title: "Today's Money Plan",
    description: "A personalized daily plan showing the fastest path to getting paid.",
    benefits: [
      "Revenue-focused daily priorities",
      "Smart task ordering by impact",
      "Track your daily earnings progress",
    ],
    recommendedPlan: "pro",
  },
  "ai.outcome_attribution": {
    title: "Outcome Attribution",
    description: "Understand which actions lead to revenue so you can double down on what works.",
    benefits: [
      "See what drives your bookings",
      "Track conversion from lead to payment",
      "Data-backed business decisions",
    ],
    recommendedPlan: "pro_plus",
  },
  "ai.priority_signals": {
    title: "Priority Signals",
    description: "AI detects high-value opportunities and surfaces them before they go cold.",
    benefits: [
      "Hot lead detection and alerts",
      "Priority ranking for all tasks",
      "Never miss a time-sensitive opportunity",
    ],
    recommendedPlan: "pro",
  },
  "ai.campaign_suggestions": {
    title: "Campaign Suggestions",
    description: "AI-powered marketing campaign ideas to re-engage past clients and grow revenue.",
    benefits: [
      "Smart campaign recommendations",
      "Seasonal and event-based triggers",
      "Automated client re-engagement",
    ],
    recommendedPlan: "pro_plus",
  },
  "sms.two_way": {
    title: "Two-Way Messaging",
    description: "Send and receive messages with clients directly from the app.",
    benefits: [
      "Unlimited client messaging",
      "Faster replies mean more bookings",
      "Full conversation history in one place",
    ],
    recommendedPlan: "pro",
  },
  "sms.auto_followups": {
    title: "Auto Follow-Ups",
    description: "Automated follow-up sequences that work while you focus on the job.",
    benefits: [
      "Automated reply sequences",
      "Recover leads that go quiet",
      "Save 30+ minutes daily on messaging",
    ],
    recommendedPlan: "pro",
  },
  "notifications.event_driven": {
    title: "Smart Notifications",
    description: "Targeted messages to past clients at the perfect time to drive repeat bookings.",
    benefits: [
      "Event-driven client outreach",
      "Seasonal and rebooking reminders",
      "Automated marketing on autopilot",
    ],
    recommendedPlan: "pro_plus",
  },
  "offline.capture": {
    title: "Offline Capture",
    description: "Capture job details, notes, and data even without internet — syncs when you're back online.",
    benefits: [
      "Work without internet connection",
      "Auto-sync when back online",
      "Never lose data on a job site",
    ],
    recommendedPlan: "pro",
  },
  "offline.photos": {
    title: "Offline Photos",
    description: "Take and store job photos offline — they sync automatically when you reconnect.",
    benefits: [
      "Unlimited offline photo capture",
      "Auto-sync when back online",
      "Before and after documentation",
    ],
    recommendedPlan: "pro",
  },
  "drive.mode": {
    title: "Drive Mode",
    description: "Hands-free voice interface for managing your business while on the road.",
    benefits: [
      "Voice-controlled job management",
      "Safe, hands-free operation",
      "Navigate to job sites with one tap",
    ],
    recommendedPlan: "pro",
  },
  "analytics.basic": {
    title: "Basic Analytics",
    description: "See your key business metrics at a glance.",
    benefits: [
      "Revenue and job tracking",
      "Simple performance overview",
      "Monthly trends at a glance",
    ],
    recommendedPlan: "pro",
  },
  "analytics.advanced": {
    title: "Advanced Analytics",
    description: "Deep business insights, revenue forecasting, and exportable reports.",
    benefits: [
      "Revenue trends and forecasting",
      "Profitability by service type",
      "Export reports for tax time",
    ],
    recommendedPlan: "business",
  },
  "crew.manage": {
    title: "Crew Management",
    description: "Manage your whole team — assign jobs, track hours, and coordinate schedules.",
    benefits: [
      "Assign jobs to team members",
      "Track crew hours and availability",
      "Coordinate schedules in real time",
    ],
    recommendedPlan: "business",
  },
  "admin.controls": {
    title: "Admin Controls",
    description: "Full administrative tools for managing your business at scale.",
    benefits: [
      "Advanced user and role management",
      "Business-wide reporting",
      "Custom configuration options",
    ],
    recommendedPlan: "business",
  },
};

export function getInterceptInfo(featureKey: NewCapability): FeatureInterceptInfo {
  return FEATURE_INTERCEPT_CONFIG[featureKey];
}
