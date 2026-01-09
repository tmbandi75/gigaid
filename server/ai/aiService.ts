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
