import { getOpenAI } from "./openaiClient";
import type { Job } from "@shared/schema";

export interface JobDraft {
  service: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone?: string;
  description?: string;
  duration?: number;
  price?: number;
}

export interface ScheduleSuggestion {
  date: string;
  time: string;
  reason: string;
}

export interface FollowUpMessage {
  message: string;
  subject?: string;
}

export async function parseTextToPlan(userMessage: string): Promise<JobDraft> {
  const today = new Date().toISOString().split("T")[0];
  
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant for gig workers (plumbers, electricians, cleaners). 
Extract job details from the user's message and return a JSON object with these fields:
- service: The type of service (plumbing, electrical, cleaning, or other)
- date: The date in YYYY-MM-DD format. Today is ${today}. If relative dates like "tomorrow" or "next Monday" are used, calculate the actual date.
- time: The time in HH:MM format (24-hour). If not specified, default to "09:00"
- clientName: The client's name if mentioned, otherwise empty string
- clientPhone: The client's phone if mentioned, otherwise empty string
- description: A brief description of the job
- duration: Estimated duration in minutes if mentioned, otherwise 60
- price: Price in cents if mentioned, otherwise 0

Return ONLY valid JSON, no other text.`
      },
      {
        role: "user",
        content: userMessage
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as JobDraft;
}

export async function suggestScheduleSlots(
  existingJobs: Job[],
  requestedDuration: number,
  preferredDate?: string
): Promise<ScheduleSuggestion[]> {
  const today = new Date();
  const searchDate = preferredDate || today.toISOString().split("T")[0];
  
  const busySlots = existingJobs
    .filter(job => job.status !== "cancelled" && job.status !== "completed")
    .map(job => ({
      date: job.scheduledDate,
      time: job.scheduledTime,
      duration: job.duration || 60,
      title: job.title
    }));

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a scheduling assistant for gig workers. Suggest 3 optimal time slots for a new job.

Working hours: 8:00 AM to 6:00 PM (08:00 to 18:00)
Today's date: ${today.toISOString().split("T")[0]}
Preferred date: ${searchDate}
Job duration needed: ${requestedDuration} minutes

Current busy slots (avoid these):
${JSON.stringify(busySlots, null, 2)}

Rules:
1. Never suggest times that overlap with busy slots (include buffer time)
2. Prefer morning slots first, then afternoon
3. Allow 30 minutes buffer between jobs for travel
4. Suggest slots within the next 7 days starting from preferred date
5. Each suggestion should be on a different day if possible

Return a JSON object with an array called "suggestions" containing exactly 3 objects, each with:
- date: YYYY-MM-DD format
- time: HH:MM format (24-hour)
- reason: Brief explanation of why this slot is good

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(content);
  return (parsed.suggestions || []) as ScheduleSuggestion[];
}

export async function generateFollowUp(params: {
  clientName: string;
  context: "job_completed" | "quote_sent" | "new_lead" | "no_response";
  lastService?: string;
  daysSinceInteraction?: number;
  tone?: "friendly" | "professional" | "casual";
}): Promise<FollowUpMessage> {
  const { clientName, context, lastService, daysSinceInteraction = 3, tone = "friendly" } = params;

  const contextPrompts = {
    job_completed: `The job "${lastService || "recent service"}" was just completed for this client.`,
    quote_sent: `A quote was sent ${daysSinceInteraction} days ago for "${lastService || "requested service"}" but no response yet.`,
    new_lead: `This is a new lead that hasn't been contacted in ${daysSinceInteraction} days.`,
    no_response: `The client hasn't responded in ${daysSinceInteraction} days after initial contact.`
  };

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant for gig workers. Generate a follow-up message for a client.

Client name: ${clientName}
Context: ${contextPrompts[context]}
Tone: ${tone}

Write a short, personalized follow-up message (2-4 sentences) that:
1. References the specific context naturally
2. Includes a clear call-to-action
3. Feels genuine and not template-like
4. Is appropriate for SMS or email

Return a JSON object with:
- message: The follow-up message text
- subject: A short email subject line (optional, for email use)

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as FollowUpMessage;
}

// Booking Page AI Features

export interface ServiceRecommendation {
  serviceId: string;
  serviceName: string;
  confidence: number;
  reason: string;
}

export async function recommendService(params: {
  userInput: string;
  services: Array<{ id: string; name: string; description?: string }>;
}): Promise<ServiceRecommendation[]> {
  const { userInput, services } = params;

  if (!services.length) {
    return [];
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that matches customer needs to available services.

Available services:
${services.map((s, i) => `${i + 1}. ${s.name}${s.description ? ` - ${s.description}` : ""} (ID: ${s.id})`).join("\n")}

Given the customer's description of their issue, recommend the 1-2 best matching services.

Return a JSON object with an array called "recommendations" containing objects with:
- serviceId: The ID of the recommended service
- serviceName: The name of the service
- confidence: A number 0-100 indicating match confidence
- reason: A brief explanation of why this service matches

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: userInput
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content);
  return (parsed.recommendations || []) as ServiceRecommendation[];
}

export interface NotesSuggestion {
  suggestion: string;
}

export async function autocompleteNotes(params: {
  partialText: string;
  serviceName?: string;
}): Promise<NotesSuggestion> {
  const { partialText, serviceName } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that completes job notes for service bookings.
${serviceName ? `The service being booked is: ${serviceName}` : ""}

Given the partial text the customer started typing, suggest a complete, helpful note.
Make it specific and actionable for the service provider.
Keep it concise (1-2 sentences max).

Return a JSON object with:
- suggestion: The completed note text

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: `Complete this note: "${partialText}"`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 150,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { suggestion: partialText };
  }

  return JSON.parse(content) as NotesSuggestion;
}

export interface FAQAnswer {
  answer: string;
  confidence: number;
}

export async function answerFAQ(params: {
  question: string;
  providerName?: string;
  services?: string[];
}): Promise<FAQAnswer> {
  const { question, providerName, services } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful FAQ assistant for a gig worker's booking page.
${providerName ? `Provider name: ${providerName}` : ""}
${services?.length ? `Services offered: ${services.join(", ")}` : ""}

Answer common questions about booking, services, and policies.
Be helpful, concise, and professional.
If you don't know the specific answer, provide a general helpful response and suggest contacting the provider directly.

Common topics you can help with:
- Booking process
- Cancellation/rescheduling (standard 24-hour notice policy)
- Payment methods (typically cash, card, or digital payment)
- What to expect during service
- Preparation tips for the service

Return a JSON object with:
- answer: Your helpful response (2-3 sentences max)
- confidence: A number 0-100 indicating how confident you are in the answer

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: question
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { answer: "Please contact the service provider directly for more information.", confidence: 0 };
  }

  return JSON.parse(content) as FAQAnswer;
}

export interface PriceEstimate {
  estimateRange: string;
  breakdown?: string;
}

export interface BioRewrite {
  rewrittenBio: string;
}

export async function rewriteBio(params: {
  bio: string;
  businessName?: string;
  services?: string[];
}): Promise<BioRewrite> {
  const { bio, businessName, services } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional copywriter helping gig workers improve their bio for their public profile.
${businessName ? `Business name: ${businessName}` : ""}
${services?.length ? `Services offered: ${services.join(", ")}` : ""}

Rewrite the bio to be:
- Professional but friendly and approachable
- Highlight experience and reliability
- Include a call to action
- Keep it concise (2-3 sentences max)
- Maintain the original meaning and key details

Return a JSON object with:
- rewrittenBio: The improved bio text

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: bio
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { rewrittenBio: bio };
  }

  return JSON.parse(content) as BioRewrite;
}

export async function estimatePrice(params: {
  description: string;
  services: Array<{ name: string; price?: number }>;
}): Promise<PriceEstimate> {
  const { description, services } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a price estimation assistant for gig services.

Available services and their base prices:
${services.map(s => `- ${s.name}: ${s.price ? `$${(s.price / 100).toFixed(0)}` : "Price varies"}`).join("\n")}

Given the job description, provide a reasonable price estimate range.
Consider job complexity, time needed, and standard rates.
If unsure, give a wider range.

Return a JSON object with:
- estimateRange: A price range string like "$75 - $150"
- breakdown: Brief explanation of what factors affect the price

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: description
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { estimateRange: "Contact for quote" };
  }

  return JSON.parse(content) as PriceEstimate;
}

// Voice Note Summarizer
export interface VoiceNoteSummary {
  transcript: string;
  summary: string;
  type: "job" | "update" | "shareable" | "other";
  keyPoints: string[];
}

export async function summarizeVoiceNote(transcript: string): Promise<VoiceNoteSummary> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that summarizes voice notes for gig workers.

Analyze the transcript and:
1. Create a concise summary (1-2 sentences)
2. Identify the type of note:
   - "job": Related to a specific job or task
   - "update": Status update or progress report
   - "shareable": Something that could be shared with clients
   - "other": General notes or reminders
3. Extract 2-4 key points

Return a JSON object with:
- transcript: The original transcript (cleaned up)
- summary: A brief summary
- type: The note type
- keyPoints: Array of key points

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: transcript
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 400,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { transcript, summary: transcript, type: "other", keyPoints: [] };
  }

  return JSON.parse(content) as VoiceNoteSummary;
}

// Referral Message Optimizer
export interface ReferralMessage {
  message: string;
  hashtags?: string[];
}

export async function generateReferralMessage(params: {
  tone: "friendly" | "professional" | "casual" | "enthusiastic";
  link: string;
  serviceCategory?: string;
  providerName?: string;
}): Promise<ReferralMessage> {
  const { tone, link, serviceCategory, providerName } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a marketing copywriter helping gig workers create referral messages.

Provider: ${providerName || "a trusted professional"}
Service: ${serviceCategory || "home services"}
Referral link: ${link}
Tone: ${tone}

Create a compelling referral message that:
1. Feels authentic and not spammy
2. Highlights the value/quality of service
3. Includes the referral link naturally
4. Is shareable on SMS, email, or social media
5. Is concise (2-3 sentences max)

Return a JSON object with:
- message: The referral message
- hashtags: Array of 2-3 relevant hashtags (optional, for social media)

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { message: `Check out this amazing service! ${link}` };
  }

  return JSON.parse(content) as ReferralMessage;
}

// Booking Insights & Job Forecast
export interface BookingInsights {
  topDays: Array<{ day: string; count: number }>;
  popularServices: Array<{ service: string; count: number; revenue: number }>;
  topClients: Array<{ name: string; jobs: number; totalSpent: number }>;
  busyHours: Array<{ hour: string; count: number }>;
  forecast: string;
  recommendations: string[];
}

export async function analyzeBookingPatterns(params: {
  jobs: Array<{ service: string; date: string; time: string; price: number; clientName: string }>;
}): Promise<BookingInsights> {
  const { jobs } = params;

  if (jobs.length === 0) {
    return {
      topDays: [],
      popularServices: [],
      topClients: [],
      busyHours: [],
      forecast: "Not enough data to forecast. Complete more jobs to see insights.",
      recommendations: ["Complete your first few jobs to start seeing patterns."]
    };
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a business analytics assistant for gig workers.

Analyze the job history and provide insights.

Job history:
${JSON.stringify(jobs, null, 2)}

Provide:
1. Top 3 busiest days of the week
2. Most popular services with job count and revenue
3. Top 3 clients by number of jobs and total spent
4. Busiest hours of the day
5. A brief forecast for the upcoming week
6. 2-3 actionable recommendations

Return a JSON object with:
- topDays: Array of { day: string, count: number }
- popularServices: Array of { service: string, count: number, revenue: number }
- topClients: Array of { name: string, jobs: number, totalSpent: number }
- busyHours: Array of { hour: string, count: number }
- forecast: A brief text forecast
- recommendations: Array of actionable tips

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 600,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as BookingInsights;
}

// AI-Powered Feature Unlock Nudges
export interface FeatureNudge {
  message: string;
  callToAction: string;
  featureName: string;
  priority: "high" | "medium" | "low";
}

export async function generateFeatureNudge(params: {
  completedFeatures: string[];
  incompleteFeatures: string[];
  userType?: string;
}): Promise<FeatureNudge> {
  const { completedFeatures, incompleteFeatures, userType } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a user engagement assistant helping gig workers get the most from their app.

User type: ${userType || "gig worker"}
Completed features: ${completedFeatures.join(", ") || "None yet"}
Incomplete features: ${incompleteFeatures.join(", ")}

Choose the most impactful incomplete feature to nudge the user about.
Consider what would provide immediate value.

Priority order:
1. Profile completion (high value for getting clients)
2. Adding services (needed for bookings)
3. Setting availability (enables scheduling)
4. Connecting payment methods
5. Enabling public profile

Return a JSON object with:
- message: A friendly, encouraging nudge message (1-2 sentences)
- callToAction: A short button text (2-4 words)
- featureName: The feature being nudged
- priority: "high", "medium", or "low"

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      message: "Complete your profile to attract more clients!",
      callToAction: "Complete Profile",
      featureName: "profile",
      priority: "high"
    };
  }

  return JSON.parse(content) as FeatureNudge;
}

// Instant Service Builder
export interface ServiceSuggestion {
  name: string;
  category: string;
  duration: number;
  price: number;
  description: string;
}

export async function buildServicesFromDescription(description: string): Promise<ServiceSuggestion[]> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a service catalog assistant for gig workers.

Given a description of what services someone offers, create structured service entries.

Categories: plumbing, electrical, cleaning, handyman, landscaping, moving, painting, hvac, appliance_repair, other

For each service, suggest:
- A clear, professional name
- The appropriate category
- Estimated duration in minutes
- Suggested price in cents (reasonable market rate)
- A brief description

Return a JSON object with:
- services: Array of { name, category, duration, price, description }

Create 1-4 services based on the description.
Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: description
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return [];
  }

  const parsed = JSON.parse(content);
  return (parsed.services || []) as ServiceSuggestion[];
}

// Client Review Draft Generator
export interface ReviewDraft {
  review: string;
  rating: number;
}

export async function generateReviewDraft(params: {
  clientName: string;
  jobName: string;
  tone?: "enthusiastic" | "professional" | "grateful";
  highlights?: string[];
}): Promise<ReviewDraft> {
  const { clientName, jobName, tone = "professional", highlights } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are helping a gig worker draft a review request message to send to their client.

Client: ${clientName}
Job completed: ${jobName}
Tone: ${tone}
${highlights?.length ? `Highlights to mention: ${highlights.join(", ")}` : ""}

Create a message that:
1. Thanks the client for choosing them
2. Mentions the specific job completed
3. Politely asks for a review
4. Keeps it short and genuine (3-4 sentences)

Return a JSON object with:
- review: The draft message to send to the client
- rating: Suggested star rating to ask for (always 5)

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      review: `Hi ${clientName}, thank you for trusting us with your ${jobName}! We hope you're happy with the work. If so, we'd really appreciate a review!`,
      rating: 5
    };
  }

  return JSON.parse(content) as ReviewDraft;
}

// AI-Powered Client Tagging
export interface ClientTags {
  tags: string[];
  insights: string;
}

export async function tagClient(params: {
  clientHistory: {
    name: string;
    totalJobs: number;
    totalSpent: number;
    lastJobDate?: string;
    cancellations?: number;
    noShows?: number;
    averageRating?: number;
    paymentHistory?: "prompt" | "delayed" | "mixed";
    referrals?: number;
  };
}): Promise<ClientTags> {
  const { clientHistory } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a CRM assistant helping gig workers categorize their clients.

Client data:
${JSON.stringify(clientHistory, null, 2)}

Available tags:
- "VIP": High value client (many jobs or high spend)
- "Repeat": Has booked more than once
- "New": First time customer
- "High Value": Spends above average
- "Referrer": Has referred others
- "Prompt Payer": Always pays on time
- "Delayed Payer": Payment issues
- "No-Show Risk": History of cancellations/no-shows
- "Loyal": Long-term customer
- "At Risk": Haven't booked in a while

Analyze the client and assign 1-4 appropriate tags.
Provide a brief insight about managing this client.

Return a JSON object with:
- tags: Array of tag strings
- insights: A brief recommendation (1 sentence)

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { tags: ["New"], insights: "New client - provide excellent service to encourage repeat business." };
  }

  return JSON.parse(content) as ClientTags;
}

// ============================================================
// Category-Based Price Estimation with Guardrails
// ============================================================
export interface CategoryEstimateParams {
  categoryId: string;
  serviceType: string;
  description: string;
  measurementArea?: number;
  measurementLinear?: number;
}

export interface CategoryEstimateResult {
  lowEstimate: number;
  highEstimate: number;
  confidence: "Low" | "Medium" | "High";
  basedOn: string[];
}

export async function generateCategoryEstimate(params: CategoryEstimateParams): Promise<CategoryEstimateResult> {
  const { categoryId, serviceType, description, measurementArea, measurementLinear } = params;

  const measurementInfo = [];
  if (measurementArea) {
    measurementInfo.push(`Area: approximately ${measurementArea} sq ft`);
  }
  if (measurementLinear) {
    measurementInfo.push(`Linear measurement: approximately ${measurementLinear} ft`);
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a pricing assistant for gig workers. Generate a price RANGE estimate based on job details.

STRICT RULES (MUST FOLLOW):
1. ONLY output price RANGES (never exact prices)
2. Use round numbers only (no decimals, no cents)
3. Range should be realistic (low should be minimum reasonable, high should be maximum reasonable)
4. NEVER guarantee pricing - this is an estimate only
5. Confidence should reflect how much information was provided

Category: ${categoryId}
Service type: ${serviceType}
${measurementInfo.length > 0 ? `Measurements: ${measurementInfo.join(", ")}` : "No measurements provided"}

Analyze the job description and provide a price range estimate.

Return a JSON object with:
- lowEstimate: The lower end of the price range (integer, no decimals)
- highEstimate: The higher end of the price range (integer, no decimals)
- confidence: "Low", "Medium", or "High" based on detail provided
- basedOn: Array of 2-4 brief factors used in estimation

IMPORTANT: Prices must be realistic for the service industry. Consider labor, materials, and typical market rates.

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: description
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      lowEstimate: 100,
      highEstimate: 300,
      confidence: "Low",
      basedOn: ["Service category", "Typical local pricing"],
    };
  }

  try {
    const parsed = JSON.parse(content) as CategoryEstimateResult;
    return {
      lowEstimate: Math.round(parsed.lowEstimate),
      highEstimate: Math.round(parsed.highEstimate),
      confidence: parsed.confidence || "Low",
      basedOn: parsed.basedOn || ["Service category", "Job description"],
    };
  } catch {
    return {
      lowEstimate: 100,
      highEstimate: 300,
      confidence: "Low",
      basedOn: ["Service category", "Typical local pricing"],
    };
  }
}

// Private in-app estimation for providers (always available)
export async function generateProviderEstimate(params: CategoryEstimateParams & {
  photos?: string[];
  providerHistory?: { avgPrice?: number; completedJobs?: number };
}): Promise<CategoryEstimateResult> {
  const { categoryId, serviceType, description, measurementArea, measurementLinear, providerHistory } = params;

  const contextInfo = [];
  if (measurementArea) {
    contextInfo.push(`Area: ${measurementArea} sq ft`);
  }
  if (measurementLinear) {
    contextInfo.push(`Linear: ${measurementLinear} ft`);
  }
  if (providerHistory?.avgPrice) {
    contextInfo.push(`Provider's average price for similar jobs: $${Math.round(providerHistory.avgPrice / 100)}`);
  }
  if (providerHistory?.completedJobs) {
    contextInfo.push(`Provider has completed ${providerHistory.completedJobs} similar jobs`);
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a pricing assistant helping a service provider create an estimate for a customer.

STRICT RULES:
1. Output price RANGES only (low to high)
2. Use round numbers (no decimals)
3. Be realistic for the ${categoryId} service category
4. Consider all provided context

Context:
- Category: ${categoryId}
- Service: ${serviceType}
${contextInfo.length > 0 ? `- ${contextInfo.join("\n- ")}` : "- No additional context"}

Provide a suggested price range the provider can review and adjust.

Return JSON with:
- lowEstimate: Lower price (integer)
- highEstimate: Higher price (integer)
- confidence: "Low", "Medium", or "High"
- basedOn: Array of factors considered

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: description
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      lowEstimate: 150,
      highEstimate: 400,
      confidence: "Low",
      basedOn: ["Service category", "Typical pricing"],
    };
  }

  try {
    const parsed = JSON.parse(content) as CategoryEstimateResult;
    return {
      lowEstimate: Math.round(parsed.lowEstimate),
      highEstimate: Math.round(parsed.highEstimate),
      confidence: parsed.confidence || "Low",
      basedOn: parsed.basedOn || ["Service category", "Job details"],
    };
  } catch {
    return {
      lowEstimate: 150,
      highEstimate: 400,
      confidence: "Low",
      basedOn: ["Service category", "Typical pricing"],
    };
  }
}

export interface EstimationGuardrails {
  disclaimers: string[];
  noExactPrices: boolean;
  requiresRange: boolean;
  confidenceLevels: string[];
}

export function getEstimationGuardrails(): EstimationGuardrails {
  return {
    disclaimers: [
      "This is an AI-generated estimate and may vary based on actual conditions",
      "Final pricing will be confirmed after assessment",
      "Additional work discovered during the job may affect the price",
    ],
    noExactPrices: true,
    requiresRange: true,
    confidenceLevels: ["low", "medium", "high"],
  };
}

export interface AIEstimateInput {
  category: string;
  description: string;
  squareFootage?: number;
  photos?: string[];
  isPublic: boolean;
}

export interface AIEstimateResult {
  priceRange: { min: number; max: number };
  confidence: "low" | "medium" | "high";
  factors: string[];
  notes?: string;
}

export async function analyzePhotosForEstimate(photos: string[], category: string): Promise<string> {
  if (!photos || photos.length === 0) {
    return "";
  }

  console.log(`[PhotoAnalysis] Analyzing ${photos.length} photos for ${category}`);
  
  const imageContents = photos.slice(0, 4).map((url, idx) => {
    const urlLength = url.length;
    console.log(`[PhotoAnalysis] Photo ${idx + 1} data URL length: ${urlLength} chars`);
    return {
      type: "image_url" as const,
      image_url: { url, detail: "low" as const }
    };
  });

  try {
    console.log("[PhotoAnalysis] Sending to GPT-4o vision...");
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a visual assessment assistant for ${category} service estimates.

PHOTO ANALYSIS RULES:
- Use reference objects (doors, tiles, appliances, furniture) to estimate approximate area/scope
- Identify visible condition issues, materials, or complexity factors
- NEVER infer exact dimensions - use qualitative terms like "small", "medium", "large"
- Note any visible obstacles, access issues, or special requirements

Provide a brief summary (2-3 sentences) of what you observe that would affect pricing.
Focus on: scope/size, condition, materials visible, and complexity indicators.`
        },
        {
          role: "user",
          content: [
            { type: "text" as const, text: `Analyze these photos for a ${category} job estimate:` },
            ...imageContents
          ]
        }
      ],
      max_tokens: 300,
    });

    const result = response.choices[0]?.message?.content || "";
    console.log(`[PhotoAnalysis] Success: ${result.substring(0, 100)}...`);
    return result;
  } catch (error: any) {
    console.error("[PhotoAnalysis] Error:", error?.message || error);
    if (error?.response) {
      console.error("[PhotoAnalysis] API error details:", error.response.status, error.response.data);
    }
    return "";
  }
}

export async function generateAIEstimate(input: AIEstimateInput): Promise<AIEstimateResult> {
  const { category, description, squareFootage, photos, isPublic } = input;

  const contextParts: string[] = [];
  if (squareFootage) {
    contextParts.push(`Area: approximately ${squareFootage} sq ft`);
  }
  if (isPublic) {
    contextParts.push("This is a public booking estimate - be conservative with ranges");
  }

  let photoAnalysis = "";
  if (photos && photos.length > 0) {
    photoAnalysis = await analyzePhotosForEstimate(photos, category);
    if (photoAnalysis) {
      contextParts.push(`Photo Analysis: ${photoAnalysis}`);
    }
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a pricing assistant for gig workers in the ${category} industry.

IMPORTANT GUARDRAILS:
- NEVER give exact prices - always provide ranges
- Use round numbers for estimates
- Be conservative - err on the side of wider ranges
- Consider regional pricing variations
${photoAnalysis ? "- Photo-based estimates are approximate and used only to assist pricing" : ""}

Context:
${contextParts.join("\n")}

Given the job description${photoAnalysis ? " and photo analysis" : ""}, provide:
1. A price RANGE (min and max in cents)
2. Confidence level: "low", "medium", or "high"
3. Key factors that influenced the estimate

Return JSON with:
- priceRange: { min: number, max: number } (in cents)
- confidence: "low" | "medium" | "high"
- factors: string[] (list of factors considered)

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: description
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 400,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return getDefaultEstimate(category);
  }

  try {
    const parsed = JSON.parse(content) as AIEstimateResult;
    return {
      priceRange: {
        min: Math.round(parsed.priceRange.min / 100) * 100,
        max: Math.round(parsed.priceRange.max / 100) * 100,
      },
      confidence: parsed.confidence || "low",
      factors: parsed.factors || ["Service type", "General scope"],
    };
  } catch {
    return getDefaultEstimate(category);
  }
}

function getDefaultEstimate(category: string): AIEstimateResult {
  const categoryDefaults: Record<string, { min: number; max: number }> = {
    "cleaning": { min: 10000, max: 25000 },
    "plumbing": { min: 15000, max: 40000 },
    "electrical": { min: 12000, max: 35000 },
    "handyman": { min: 8000, max: 20000 },
    "lawn-outdoor": { min: 5000, max: 15000 },
    "flooring": { min: 30000, max: 80000 },
    "carpentry": { min: 20000, max: 60000 },
    "moving": { min: 15000, max: 50000 },
  };

  const defaultRange = categoryDefaults[category] || { min: 10000, max: 30000 };

  return {
    priceRange: defaultRange,
    confidence: "low",
    factors: ["Service category", "Typical pricing for this type of work"],
  };
}
