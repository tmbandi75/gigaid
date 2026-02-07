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

export function getCopy(
  capabilityKey: NewCapability,
  variant: UpgradeVariant,
  _triggerType: UpgradeTriggerType
): CopyBlock {
  const capCopy = CAPABILITY_COPY[capabilityKey];
  if (capCopy && capCopy[variant]) {
    return capCopy[variant];
  }
  return DEFAULT_COPY[variant];
}
