import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Please set up the AI integration.");
    }
    
    openaiInstance = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });
  }
  return openaiInstance;
}
