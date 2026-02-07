import type { NewCapability } from "@/hooks/useCapability";
import type { UpgradeVariant, UpgradeTriggerType } from "./upgradeTypes";

interface CopyBlock {
  title: string;
  subtitle: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
}

type CapabilityCopy = Record<UpgradeVariant, CopyBlock>;

const CAPABILITY_COPY: Partial<Record<NewCapability, CapabilityCopy>> = {
  "jobs.create": {
    roi: {
      title: "Unlock unlimited jobs",
      subtitle: "Every job you miss is money left on the table.",
      bullets: [
        "Create unlimited jobs each month",
        "Auto follow-ups that recover $200+ on average",
        "Never lose a booking to slow replies",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    time: {
      title: "Save hours every week",
      subtitle: "Stop managing jobs manually. Let GigAid handle the admin.",
      bullets: [
        "One-click job creation from templates",
        "Automated reminders save 3+ hours per week",
        "Focus on the work, not the paperwork",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    social: {
      title: "Serious pros go unlimited",
      subtitle: "Top-rated gig workers never cap out on jobs.",
      bullets: [
        "Professional workflow your clients trust",
        "Automated follow-ups show you're reliable",
        "Stand out from part-timers",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
  },
  "sms.two_way": {
    roi: {
      title: "Keep conversations flowing",
      subtitle: "Every missed reply could cost you a $300+ job.",
      bullets: [
        "Unlimited client messaging",
        "Auto follow-ups recover lost leads",
        "Faster replies = more bookings",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    time: {
      title: "Stop typing, start earning",
      subtitle: "Auto follow-ups handle the back-and-forth for you.",
      bullets: [
        "Automated reply sequences",
        "Template messages save 30+ minutes daily",
        "Never forget to follow up again",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    social: {
      title: "Respond like a pro",
      subtitle: "Clients expect fast replies. Stay ahead of the competition.",
      bullets: [
        "Instant professional responses",
        "Automated sequences keep clients engaged",
        "Build trust with timely communication",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
  },
  "deposit.enforce": {
    roi: {
      title: "Protect your revenue",
      subtitle: "No-shows cost gig workers $500+/month on average.",
      bullets: [
        "Require deposits to lock in bookings",
        "Reduce no-shows by 80%",
        "Keep your income predictable",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    time: {
      title: "Stop chasing no-shows",
      subtitle: "Deposits mean clients show up. No more wasted trips.",
      bullets: [
        "Automatic deposit collection",
        "Zero time wasted on empty appointments",
        "Reschedule fees built in",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    social: {
      title: "Run a serious operation",
      subtitle: "Clients respect businesses that require deposits.",
      bullets: [
        "Professional booking experience",
        "Builds trust with clear policies",
        "Clients value your time more",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
  },
  "invoices.send": {
    roi: {
      title: "Get paid faster",
      subtitle: "Auto reminders cut payment time by 60%.",
      bullets: [
        "Unlimited invoices every month",
        "Automatic payment reminders",
        "Track who viewed and who paid",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    time: {
      title: "Bill without the hassle",
      subtitle: "Stop manually chasing every invoice.",
      bullets: [
        "Send invoices in seconds",
        "Auto reminders do the chasing for you",
        "Save 2+ hours per week on billing",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    social: {
      title: "Invoice like a real business",
      subtitle: "Professional invoicing earns client respect.",
      bullets: [
        "Branded, professional invoices",
        "Automatic reminders show organization",
        "Build a reputation clients recommend",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
  },
  "price.confirmation": {
    roi: {
      title: "Lock in more deals",
      subtitle: "Price confirmations convert 40% more quotes to jobs.",
      bullets: [
        "Unlimited price confirmations",
        "Automatic job creation on approval",
        "Never lose a quote to slow follow-up",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    time: {
      title: "Quotes to jobs, automatically",
      subtitle: "One tap and your quote becomes a confirmed job.",
      bullets: [
        "No manual job creation after approval",
        "Instant notifications when clients accept",
        "Streamlined quoting workflow",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    social: {
      title: "Quote with confidence",
      subtitle: "Professional confirmations close deals faster.",
      bullets: [
        "Polished client-facing quotes",
        "Clear pricing builds trust",
        "Clients see you as established",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
  },
  "notifications.event_driven": {
    roi: {
      title: "Turn past clients into repeat revenue",
      subtitle: "Event-driven notifications bring back 25% of past clients.",
      bullets: [
        "Targeted messages to past clients",
        "Seasonal and event-based triggers",
        "Automated rebooking reminders",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    time: {
      title: "Marketing on autopilot",
      subtitle: "Set triggers once, reach clients at the perfect time.",
      bullets: [
        "No manual outreach needed",
        "Smart scheduling respects quiet hours",
        "Set it and forget it",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    social: {
      title: "Stay top of mind",
      subtitle: "Clients forget. Smart reminders keep you first in line.",
      bullets: [
        "Timely, relevant client outreach",
        "Professional communication cadence",
        "Build lasting client relationships",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
  },
  "analytics.advanced": {
    roi: {
      title: "Know your numbers",
      subtitle: "Data-driven pros earn 30% more on average.",
      bullets: [
        "Revenue trends and forecasting",
        "Profitability by service type",
        "Export reports for tax time",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    time: {
      title: "Insights without spreadsheets",
      subtitle: "All your business data, organized automatically.",
      bullets: [
        "Dashboard shows what matters",
        "No manual tracking needed",
        "One-click export for accountants",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
    social: {
      title: "Run your business like a business",
      subtitle: "Top earners track their numbers. So should you.",
      bullets: [
        "Professional reporting tools",
        "Understand your growth trajectory",
        "Make confident pricing decisions",
      ],
      primaryCta: "See Plans",
      secondaryCta: "Not now",
    },
  },
};

const DEFAULT_COPY: CapabilityCopy = {
  roi: {
    title: "Grow your business",
    subtitle: "Upgrade to unlock features that drive more revenue.",
    bullets: [
      "Higher limits on every feature",
      "Automation saves time and money",
      "Priority support when you need it",
    ],
    primaryCta: "See Plans",
    secondaryCta: "Not now",
  },
  time: {
    title: "Work smarter, not harder",
    subtitle: "Save hours every week with powerful automation.",
    bullets: [
      "Automate repetitive tasks",
      "Templates for everything",
      "Less admin, more earning",
    ],
    primaryCta: "See Plans",
    secondaryCta: "Not now",
  },
  social: {
    title: "Level up your operation",
    subtitle: "Professional tools that serious gig workers rely on.",
    bullets: [
      "Stand out from the crowd",
      "Tools clients expect from pros",
      "Build a business you're proud of",
    ],
    primaryCta: "See Plans",
    secondaryCta: "Not now",
  },
};

const POST_SUCCESS_OVERRIDES: Partial<Record<NewCapability, Record<UpgradeVariant, Partial<CopyBlock>>>> = {
  "jobs.create": {
    roi: { title: "Nice! Want to do even more?", subtitle: "You just created a job. Upgrade for unlimited jobs and auto follow-ups that recover $200+ on average." },
    time: { title: "Job created! Save even more time?", subtitle: "Upgrade to automate reminders, follow-ups, and never do manual scheduling again." },
    social: { title: "Looking professional!", subtitle: "Upgrade to show clients you run a top-tier operation with unlimited jobs." },
  },
  "sms.two_way": {
    roi: { title: "Message sent! Keep the momentum", subtitle: "Auto follow-ups recover leads that go quiet. Stop losing money to missed replies." },
    time: { title: "Sent! Let GigAid handle the rest", subtitle: "Upgrade for auto follow-ups that reply for you while you focus on the job." },
    social: { title: "Quick response! Stay ahead", subtitle: "Clients expect fast replies. Auto follow-ups keep you looking professional 24/7." },
  },
  "deposit.enforce": {
    roi: { title: "Booking confirmed! Protect your revenue", subtitle: "Deposits reduce no-shows by 80%, keeping $500+/month in your pocket." },
    time: { title: "Booked! Never chase a no-show again", subtitle: "Deposits mean clients show up. Zero wasted trips, zero wasted time." },
    social: { title: "Booking secured! Level up", subtitle: "Requiring deposits tells clients you're a serious professional." },
  },
  "invoices.send": {
    roi: { title: "Invoice sent! Get paid even faster", subtitle: "Auto reminders cut payment time by 60%. Stop waiting for overdue payments." },
    time: { title: "Sent! Let reminders handle the rest", subtitle: "Upgrade for automatic payment reminders so you never manually chase invoices." },
    social: { title: "Professional invoice sent!", subtitle: "Upgrade for branded invoices with automatic reminders that earn client respect." },
  },
  "price.confirmation": {
    roi: { title: "Quote sent! Close more deals", subtitle: "Price confirmations convert 40% more quotes to paid jobs." },
    time: { title: "Quote away! Automate the rest", subtitle: "When clients approve, jobs create automatically. No manual steps." },
    social: { title: "Professional quote sent!", subtitle: "Clients trust clear, professional pricing. Upgrade for unlimited confirmations." },
  },
};

const STALL_OVERRIDES: Partial<Record<NewCapability, Record<UpgradeVariant, Partial<CopyBlock>>>> = {
  "sms.two_way": {
    roi: { title: "You're losing money to slow follow-ups", subtitle: "Auto follow-ups recover leads before they go cold. Stop leaving revenue on the table." },
    time: { title: "Too much time on manual follow-ups", subtitle: "You've sent several follow-ups manually. Let automation handle this for you." },
    social: { title: "Clients notice slow responses", subtitle: "Fast, automated follow-ups show clients you're reliable and professional." },
  },
  "deposit.enforce": {
    roi: { title: "Bookings at risk without deposits", subtitle: "You have bookings without deposit protection. No-shows could cost you hundreds." },
    time: { title: "Protect your time with deposits", subtitle: "Without deposits, no-shows waste your schedule. Lock in bookings automatically." },
    social: { title: "Serious pros require deposits", subtitle: "Clients expect professional booking policies. Deposits show you value your time." },
  },
  "invoices.send": {
    roi: { title: "Unpaid invoices piling up", subtitle: "Auto reminders cut payment delays by 60%. Stop losing money to overdue invoices." },
    time: { title: "Stop chasing unpaid invoices", subtitle: "Automatic reminders handle payment follow-ups so you don't have to." },
    social: { title: "Get paid what you're owed", subtitle: "Professional reminder sequences get invoices paid faster and build trust." },
  },
};

const FEATURE_LOCKED_OVERRIDES: Partial<Record<NewCapability, Record<UpgradeVariant, Partial<CopyBlock>>>> = {
  "jobs.create": {
    roi: { title: "Job limit reached", subtitle: "You've hit your monthly job limit. Upgrade to create unlimited jobs and keep earning." },
    time: { title: "Job limit reached", subtitle: "No more manual limits. Upgrade for unlimited job creation and save hours." },
    social: { title: "Job limit reached", subtitle: "Top pros never hit limits. Upgrade to run your business without restrictions." },
  },
  "sms.two_way": {
    roi: { title: "Message limit reached", subtitle: "You've used all your messages this month. Upgrade to keep conversations flowing." },
    time: { title: "Message limit reached", subtitle: "Upgrade for unlimited messaging and auto follow-ups that work while you sleep." },
    social: { title: "Message limit reached", subtitle: "Don't let limits slow your response time. Upgrade for unlimited messaging." },
  },
  "deposit.enforce": {
    roi: { title: "Deposits require an upgrade", subtitle: "Protect your bookings from no-shows. Deposits reduce cancellations by 80%." },
    time: { title: "Deposits require an upgrade", subtitle: "Stop wasting time on no-shows. Deposits lock in committed clients." },
    social: { title: "Deposits require an upgrade", subtitle: "Professional businesses require deposits. Upgrade to set clear booking policies." },
  },
  "invoices.send": {
    roi: { title: "Invoice limit reached", subtitle: "You've sent all your free invoices. Upgrade to bill without limits." },
    time: { title: "Invoice limit reached", subtitle: "Upgrade for unlimited invoices and automatic payment reminders." },
    social: { title: "Invoice limit reached", subtitle: "Keep billing professionally. Upgrade for unlimited invoices." },
  },
};

function getOverrides(
  capabilityKey: NewCapability,
  variant: UpgradeVariant,
  triggerType: UpgradeTriggerType
): Partial<CopyBlock> | undefined {
  if (triggerType === "post_success") {
    return POST_SUCCESS_OVERRIDES[capabilityKey]?.[variant];
  }
  if (triggerType === "stall_detected") {
    return STALL_OVERRIDES[capabilityKey]?.[variant];
  }
  if (triggerType === "feature_locked" || triggerType === "hit_limit") {
    return FEATURE_LOCKED_OVERRIDES[capabilityKey]?.[variant];
  }
  return undefined;
}

export function getCopy(
  capabilityKey: NewCapability,
  variant: UpgradeVariant,
  triggerType: UpgradeTriggerType
): CopyBlock {
  const baseCopy = CAPABILITY_COPY[capabilityKey]?.[variant] || DEFAULT_COPY[variant];
  const overrides = getOverrides(capabilityKey, variant, triggerType);

  if (overrides) {
    return { ...baseCopy, ...overrides };
  }
  return baseCopy;
}
