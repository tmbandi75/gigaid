import { 
  ServiceCategory, 
  NotificationEventType, 
  categoryEventMapping,
  notificationEventTypes,
  serviceCategories,
  licensedRequiredCategories,
} from "@shared/schema";

export interface CampaignValidationRequest {
  userId: string;
  serviceId: string;
  serviceCategory: ServiceCategory;
  eventType: NotificationEventType;
  eventReason: string;
  channel: "sms" | "email";
  bookingLink: string;
  messageContent: string;
  serviceLicensed?: boolean; // Required for electrical category
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const DISALLOWED_PHRASES = [
  "discount",
  "% off",
  "percent off",
  "limited time",
  "special deal",
  "don't miss out",
  "exclusive offer",
  "act now",
  "hurry",
  "last chance",
  "sale",
  "promo",
  "promotion",
  "coupon",
  "free",
  "bonus",
  "new service announcement",
  "introducing",
  "just launched",
];

const MAX_SMS_LENGTH = 320;
const MAX_EVENT_REASON_LENGTH = 120;
const QUIET_HOURS_START = 21; // 9 PM
const QUIET_HOURS_END = 8; // 8 AM
const MAX_CAMPAIGNS_PER_SERVICE_PER_WEEK = 1;
const MAX_CAMPAIGNS_PER_ACCOUNT_PER_WEEK = 2;

export function validateCategoryEventCompatibility(
  category: ServiceCategory,
  eventType: NotificationEventType
): ValidationResult {
  const allowedEvents = categoryEventMapping[category];
  
  if (!allowedEvents) {
    return {
      valid: false,
      errors: [`Unknown service category: ${category}`],
      warnings: [],
    };
  }
  
  if (!allowedEvents.includes(eventType)) {
    return {
      valid: false,
      errors: [
        `This service can only notify clients when a relevant event occurs. ` +
        `"${formatEventType(eventType)}" is not valid for ${formatCategory(category)}. ` +
        `Allowed events: ${allowedEvents.map(formatEventType).join(", ")}.`
      ],
      warnings: [],
    };
  }
  
  return { valid: true, errors: [], warnings: [] };
}

export function validateLicensing(
  category: ServiceCategory,
  isLicensed: boolean | undefined
): ValidationResult {
  if (licensedRequiredCategories.includes(category) && !isLicensed) {
    return {
      valid: false,
      errors: [
        `${formatCategory(category)} services require verification of licensing before sending notifications. ` +
        `Please update your service to indicate you are licensed.`
      ],
      warnings: [],
    };
  }
  
  return { valid: true, errors: [], warnings: [] };
}

export function validateEventReason(eventReason: string): ValidationResult {
  const errors: string[] = [];
  
  if (!eventReason || eventReason.trim().length === 0) {
    errors.push("Event reason is required. Explain why this event is relevant to your clients.");
  }
  
  if (eventReason && eventReason.length > MAX_EVENT_REASON_LENGTH) {
    errors.push(`Event reason must be ${MAX_EVENT_REASON_LENGTH} characters or less.`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export function validateMessageContent(
  message: string,
  channel: "sms" | "email"
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!message || message.trim().length === 0) {
    errors.push("Message content is required.");
    return { valid: false, errors, warnings };
  }
  
  if (channel === "sms") {
    if (message.length > MAX_SMS_LENGTH) {
      errors.push(`SMS messages must be ${MAX_SMS_LENGTH} characters or less. Current: ${message.length}`);
    }
    
    if (!message.toLowerCase().includes("reply stop to opt out")) {
      errors.push("SMS messages must include opt-out language: 'Reply STOP to opt out'");
    }
    
    const emojiCount = countEmojis(message);
    if (emojiCount > 1) {
      errors.push("SMS messages can contain at most 1 emoji.");
    }
  }
  
  const disallowedFound = DISALLOWED_PHRASES.filter(phrase => 
    message.toLowerCase().includes(phrase.toLowerCase())
  );
  
  if (disallowedFound.length > 0) {
    errors.push(
      `Message contains promotional language that is not allowed: "${disallowedFound[0]}". ` +
      `Client notifications must be event-driven, not promotional.`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateBookingLink(bookingLink: string): ValidationResult {
  const errors: string[] = [];
  
  if (!bookingLink || bookingLink.trim().length === 0) {
    errors.push("A booking link is required for all client notifications.");
    return { valid: false, errors, warnings: [] };
  }
  
  try {
    const url = new URL(bookingLink);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push("Booking link must be a valid HTTP or HTTPS URL.");
    }
  } catch {
    errors.push("Booking link must be a valid URL.");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export async function validateRateLimits(
  userId: string,
  serviceId: string,
  getCampaignsInLastWeek: (userId: string, serviceId?: string) => Promise<number>
): Promise<ValidationResult> {
  const errors: string[] = [];
  
  const serviceCampaigns = await getCampaignsInLastWeek(userId, serviceId);
  if (serviceCampaigns >= MAX_CAMPAIGNS_PER_SERVICE_PER_WEEK) {
    errors.push(
      `You've already sent a notification for this service this week. ` +
      `Each service can only notify clients once per 7 days to prevent spam.`
    );
  }
  
  const totalCampaigns = await getCampaignsInLastWeek(userId);
  if (totalCampaigns >= MAX_CAMPAIGNS_PER_ACCOUNT_PER_WEEK) {
    errors.push(
      `You've reached the weekly limit of ${MAX_CAMPAIGNS_PER_ACCOUNT_PER_WEEK} client notifications. ` +
      `This limit resets next week.`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export function validateQuietHours(recipientLocalHour: number): ValidationResult {
  if (recipientLocalHour >= QUIET_HOURS_START || recipientLocalHour < QUIET_HOURS_END) {
    return {
      valid: false,
      errors: [
        `Messages cannot be sent between 9 PM and 8 AM recipient local time. ` +
        `Please schedule for a later time.`
      ],
      warnings: [],
    };
  }
  
  return { valid: true, errors: [], warnings: [] };
}

export function validateAudienceEligibility(
  eligibleClientCount: number
): ValidationResult {
  if (eligibleClientCount === 0) {
    return {
      valid: false,
      errors: [
        `No eligible clients found. Notifications can only be sent to past clients ` +
        `who have not opted out.`
      ],
      warnings: [],
    };
  }
  
  return { valid: true, errors: [], warnings: [] };
}

export async function validateFullCampaign(
  request: CampaignValidationRequest,
  getCampaignsInLastWeek: (userId: string, serviceId?: string) => Promise<number>,
  eligibleClientCount: number
): Promise<ValidationResult> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  const categoryCheck = validateCategoryEventCompatibility(
    request.serviceCategory,
    request.eventType
  );
  allErrors.push(...categoryCheck.errors);
  allWarnings.push(...categoryCheck.warnings);
  
  if (!categoryCheck.valid) {
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }
  
  // Validate licensing requirement (for electrical category)
  const licensingCheck = validateLicensing(
    request.serviceCategory,
    request.serviceLicensed
  );
  allErrors.push(...licensingCheck.errors);
  allWarnings.push(...licensingCheck.warnings);
  
  if (!licensingCheck.valid) {
    return { valid: false, errors: allErrors, warnings: allWarnings };
  }
  
  const eventReasonCheck = validateEventReason(request.eventReason);
  allErrors.push(...eventReasonCheck.errors);
  allWarnings.push(...eventReasonCheck.warnings);
  
  const messageCheck = validateMessageContent(request.messageContent, request.channel);
  allErrors.push(...messageCheck.errors);
  allWarnings.push(...messageCheck.warnings);
  
  const bookingLinkCheck = validateBookingLink(request.bookingLink);
  allErrors.push(...bookingLinkCheck.errors);
  allWarnings.push(...bookingLinkCheck.warnings);
  
  const rateLimitCheck = await validateRateLimits(
    request.userId,
    request.serviceId,
    getCampaignsInLastWeek
  );
  allErrors.push(...rateLimitCheck.errors);
  allWarnings.push(...rateLimitCheck.warnings);
  
  const audienceCheck = validateAudienceEligibility(eligibleClientCount);
  allErrors.push(...audienceCheck.errors);
  allWarnings.push(...audienceCheck.warnings);
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

export function generateDefaultMessage(
  eventType: NotificationEventType,
  eventReason: string,
  bookingLink: string,
  channel: "sms" | "email"
): string {
  const templates: Record<NotificationEventType, string> = {
    environmental: `${eventReason} I'm available to help. Book here if needed: ${bookingLink}`,
    seasonal: `It's that time of year again. ${eventReason} Book here if you need service: ${bookingLink}`,
    availability: `I have openings available. ${eventReason} Book here: ${bookingLink}`,
    risk: `${eventReason} I can help address this before it becomes a bigger issue. Book here: ${bookingLink}`,
    relationship: `It's been a while since your last service. ${eventReason} Book here if you'd like to schedule: ${bookingLink}`,
  };
  
  let message = templates[eventType];
  
  if (channel === "sms") {
    message += "\nReply STOP to opt out.";
    if (message.length > MAX_SMS_LENGTH) {
      const shortened = templates[eventType].substring(0, MAX_SMS_LENGTH - 50);
      message = `${shortened}... ${bookingLink}\nReply STOP to opt out.`;
    }
  }
  
  return message;
}

function countEmojis(text: string): number {
  const emojiRanges = [
    /[\u2600-\u26FF]/g,
    /[\u2700-\u27BF]/g,
    /[\uD83C][\uDF00-\uDFFF]/g,
    /[\uD83D][\uDC00-\uDE4F]/g,
    /[\uD83D][\uDE80-\uDEFF]/g,
  ];
  
  let count = 0;
  for (const regex of emojiRanges) {
    const matches = text.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function formatEventType(eventType: NotificationEventType): string {
  const labels: Record<NotificationEventType, string> = {
    environmental: "Weather/Environmental",
    seasonal: "Seasonal",
    availability: "Availability",
    risk: "Safety/Risk",
    relationship: "Relationship",
  };
  return labels[eventType] || eventType;
}

function formatCategory(category: ServiceCategory): string {
  const labels: Record<ServiceCategory, string> = {
    snow_removal: "Snow Removal",
    lawn_landscaping: "Lawn & Landscaping",
    cleaning: "Cleaning",
    handyman_repairs: "Handyman & Repairs",
    moving_hauling: "Moving & Hauling",
    power_washing: "Power Washing",
    plumbing: "Plumbing",
    electrical: "Electrical",
    hvac: "HVAC",
    roofing: "Roofing",
    painting: "Painting",
    pool_spa_service: "Pool & Spa Service",
    pest_control: "Pest Control",
    appliance_repair: "Appliance Repair",
    window_cleaning: "Window Cleaning",
    carpet_flooring: "Carpet & Flooring",
    locksmith: "Locksmith",
    auto_detailing: "Auto Detailing",
    other: "Other Services",
  };
  return labels[category] || category;
}

export const RATE_LIMITS = {
  maxCampaignsPerServicePerWeek: MAX_CAMPAIGNS_PER_SERVICE_PER_WEEK,
  maxCampaignsPerAccountPerWeek: MAX_CAMPAIGNS_PER_ACCOUNT_PER_WEEK,
};

export const MESSAGE_LIMITS = {
  maxSmsLength: MAX_SMS_LENGTH,
  maxEventReasonLength: MAX_EVENT_REASON_LENGTH,
};

export const QUIET_HOURS = {
  start: QUIET_HOURS_START,
  end: QUIET_HOURS_END,
};

export { formatEventType, formatCategory };
