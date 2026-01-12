import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type CelebrationType = "job_booked" | "payment_received";

interface CelebrationContext {
  type: CelebrationType;
  jobTitle?: string;
  clientName?: string;
  amount?: number;
  serviceName?: string;
}

const CELEBRATION_PROMPTS: Record<CelebrationType, string> = {
  job_booked: `You are a supportive assistant for gig workers. Generate a short, enthusiastic congratulatory message (2-3 sentences max) for someone who just booked a new job. 
Be warm, encouraging, and genuine. Mention how this contributes to their success as a business owner.
Keep it brief and impactful. Don't use excessive exclamation marks.`,
  
  payment_received: `You are a supportive assistant for gig workers. Generate a short, enthusiastic congratulatory message (2-3 sentences max) for someone who just received a payment.
Be warm, encouraging, and celebrate their hard work paying off. Mention how every payment is a testament to their skills and reliability.
Keep it brief and impactful. Don't use excessive exclamation marks.`,
};

export async function generateCelebrationMessage(context: CelebrationContext): Promise<string> {
  try {
    const systemPrompt = CELEBRATION_PROMPTS[context.type];
    
    let userPrompt = "";
    if (context.type === "job_booked") {
      userPrompt = `The user just booked a job`;
      if (context.jobTitle) userPrompt += ` called "${context.jobTitle}"`;
      if (context.clientName) userPrompt += ` with client ${context.clientName}`;
      if (context.serviceName) userPrompt += ` for ${context.serviceName} service`;
      userPrompt += ". Generate a personalized congratulations message.";
    } else if (context.type === "payment_received") {
      userPrompt = `The user just received a payment`;
      if (context.amount) userPrompt += ` of $${(context.amount / 100).toFixed(2)}`;
      if (context.clientName) userPrompt += ` from ${context.clientName}`;
      userPrompt += ". Generate a personalized congratulations message.";
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 150,
    });

    return response.choices[0]?.message?.content || getDefaultMessage(context.type);
  } catch (error) {
    console.error("Error generating celebration message:", error);
    return getDefaultMessage(context.type);
  }
}

function getDefaultMessage(type: CelebrationType): string {
  if (type === "job_booked") {
    return "Another job in the books! Your hard work and dedication are building something great. Keep up the momentum!";
  }
  return "Payment received! Your skills and reliability continue to pay off. Every satisfied customer is a step toward even greater success.";
}
