import { getOpenAI } from "./openaiClient";

export interface ParsedLead {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceType: string;
  description: string;
  source: string;
  suggestedReply: string;
  extractedDetails: {
    location?: string;
    urgency?: "low" | "medium" | "high";
    preferredDate?: string;
    preferredTime?: string;
    budget?: string;
  };
}

export interface QuickReply {
  id: string;
  text: string;
  tone: "professional" | "friendly" | "casual";
}

const SOURCE_PATTERNS: Record<string, RegExp[]> = {
  facebook: [/facebook\.com/i, /fb\.com/i, /messenger/i],
  thumbtack: [/thumbtack/i],
  taskrabbit: [/taskrabbit/i],
  angi: [/angi/i, /angieslist/i, /angie's list/i],
  homeadvisor: [/homeadvisor/i],
  yelp: [/yelp/i],
  google: [/google/i, /gbp/i, /local services/i],
  instagram: [/instagram/i, /ig/i],
  twitter: [/twitter/i, /x\.com/i],
  linkedin: [/linkedin/i],
  whatsapp: [/whatsapp/i],
  sms: [/sms/i, /text message/i, /imessage/i],
  email: [/email/i, /gmail/i, /outlook/i, /mail/i],
  referral: [/referr/i, /friend told/i, /recommend/i],
};

function detectSource(text: string, url?: string): string {
  const combined = `${text} ${url || ""}`.toLowerCase();
  
  for (const [source, patterns] of Object.entries(SOURCE_PATTERNS)) {
    if (patterns.some(p => p.test(combined))) {
      return source;
    }
  }
  
  return "manual";
}

export async function parseSharedContent(params: {
  text: string;
  url?: string;
  imageBase64?: string;
  providerServices?: string[];
  providerName?: string;
}): Promise<ParsedLead> {
  const { text, url, providerServices, providerName } = params;
  
  const detectedSource = detectSource(text, url);
  
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an assistant that parses shared messages/posts into lead information for gig workers.

The gig worker shared this content from another app (${detectedSource}).
${providerName ? `Provider name: ${providerName}` : ""}
${providerServices?.length ? `Services offered: ${providerServices.join(", ")}` : ""}

Extract the following from the shared content:
1. Client name (if mentioned)
2. Phone number (if mentioned)
3. Email (if mentioned)
4. Service type needed (plumbing, electrical, cleaning, handyman, etc.)
5. Job description
6. Location (if mentioned)
7. Urgency level (low, medium, high)
8. Preferred date/time (if mentioned)
9. Budget (if mentioned)

Also generate a professional, friendly reply the gig worker can send back.
The reply should:
- Acknowledge the request
- Ask 1-2 clarifying questions if needed
- Be concise and mobile-friendly

Return a JSON object with:
{
  "clientName": string or "",
  "clientPhone": string or "",
  "clientEmail": string or "",
  "serviceType": string,
  "description": string,
  "suggestedReply": string,
  "extractedDetails": {
    "location": string or null,
    "urgency": "low" | "medium" | "high",
    "preferredDate": string or null,
    "preferredTime": string or null,
    "budget": string or null
  }
}

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: url ? `URL: ${url}\n\nContent:\n${text}` : text
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 600,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(content);
  return {
    ...parsed,
    source: detectedSource,
  } as ParsedLead;
}

export async function generateQuickReplies(params: {
  originalMessage: string;
  context: string;
  providerName?: string;
  serviceName?: string;
}): Promise<QuickReply[]> {
  const { originalMessage, context, providerName, serviceName } = params;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are helping a gig worker respond to a potential client's message.

${providerName ? `Provider name: ${providerName}` : ""}
${serviceName ? `Service discussed: ${serviceName}` : ""}
Context: ${context}

Generate 3 reply options:
1. Professional tone - formal and business-like
2. Friendly tone - warm and approachable  
3. Casual tone - brief and to the point

Each reply should:
- Be concise (2-3 sentences max)
- Be appropriate for SMS/text
- Move the conversation forward
- Include relevant details if available

Return a JSON object with:
{
  "replies": [
    { "id": "1", "text": "...", "tone": "professional" },
    { "id": "2", "text": "...", "tone": "friendly" },
    { "id": "3", "text": "...", "tone": "casual" }
  ]
}

Return ONLY valid JSON.`
      },
      {
        role: "user",
        content: `Client's message: "${originalMessage}"`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 400,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return [
      { id: "1", text: "Thanks for reaching out! I'd be happy to help. When would work best for you?", tone: "professional" },
      { id: "2", text: "Hi! That sounds great - I can definitely help with that. What's your availability?", tone: "friendly" },
      { id: "3", text: "Got it! When works for you?", tone: "casual" },
    ];
  }

  const parsed = JSON.parse(content);
  return (parsed.replies || []) as QuickReply[];
}

export async function generateFollowUpReply(params: {
  conversationHistory: Array<{ role: "client" | "provider"; message: string }>;
  nextStep: "quote" | "schedule" | "clarify" | "close";
  providerName?: string;
  priceCents?: number;
}): Promise<string> {
  const { conversationHistory, nextStep, providerName, priceCents } = params;

  const stepInstructions = {
    quote: `Provide a quote${priceCents ? ` of $${(priceCents / 100).toFixed(2)}` : ""} and ask for confirmation.`,
    schedule: "Propose specific times to schedule the job.",
    clarify: "Ask clarifying questions to better understand the job.",
    close: "Confirm the booking details and thank the client.",
  };

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are helping a gig worker continue a conversation with a potential client.

${providerName ? `Provider name: ${providerName}` : ""}

Conversation so far:
${conversationHistory.map(m => `${m.role === "client" ? "Client" : "You"}: ${m.message}`).join("\n")}

Goal: ${stepInstructions[nextStep]}

Write a single reply that:
- Is concise (2-3 sentences max)
- Moves toward the goal
- Sounds natural and professional
- Is appropriate for SMS/text

Return a JSON object with:
{ "reply": "your message here" }

Return ONLY valid JSON.`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return "Thanks for the details! I'll get back to you shortly.";
  }

  const parsed = JSON.parse(content);
  return parsed.reply || "Thanks for the details! I'll get back to you shortly.";
}
