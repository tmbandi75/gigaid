import { storage } from "./storage";
import { 
  ServiceCategory, 
  NotificationEventType, 
  categoryEventMapping,
  noAiSuggestionCategories,
} from "@shared/schema";
import { hasCapability, isDeveloper } from "@shared/entitlements";
import { generateDefaultMessage } from "./notificationCampaignValidator";
import { buildBookingLink } from "./lib/bookingLinkUrl";
import { logger } from "./lib/logger";

const MAX_SUGGESTIONS_PER_ACCOUNT_PER_WEEK = 2;

interface WeatherData {
  condition: "snow" | "rain" | "storm" | "heat" | "freeze" | null;
  severity: "low" | "medium" | "high";
  description: string;
}

interface SeasonalSignal {
  type: "spring_start" | "fall_start" | "winter_prep" | "summer_prep" | null;
  description: string;
}

const SEASON_DATES: Record<string, { month: number; day: number }> = {
  spring_start: { month: 3, day: 1 },
  fall_start: { month: 9, day: 1 },
  winter_prep: { month: 11, day: 1 },
  summer_prep: { month: 5, day: 15 },
};

const CATEGORY_SEASONAL_RELEVANCE: Record<string, ServiceCategory[]> = {
  spring_start: ["lawn_landscaping", "power_washing", "cleaning", "painting", "window_cleaning", "pest_control", "pool_spa_service"],
  fall_start: ["lawn_landscaping", "cleaning", "handyman_repairs", "hvac", "roofing", "carpet_flooring"],
  winter_prep: ["snow_removal", "handyman_repairs", "hvac", "plumbing", "roofing"],
  summer_prep: ["power_washing", "lawn_landscaping", "cleaning", "pool_spa_service", "auto_detailing", "pest_control"],
};

const CATEGORY_WEATHER_RELEVANCE: Record<string, ServiceCategory[]> = {
  snow: ["snow_removal"],
  rain: ["power_washing", "handyman_repairs", "roofing", "plumbing"],
  storm: ["handyman_repairs", "roofing", "electrical"],
  heat: ["power_washing", "hvac", "pool_spa_service"],
  freeze: ["handyman_repairs", "snow_removal", "plumbing", "hvac"],
};

async function detectWeatherSignal(): Promise<WeatherData | null> {
  return null;
}

function detectSeasonalSignal(): SeasonalSignal | null {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  const checkWindow = 7;
  
  for (const [season, date] of Object.entries(SEASON_DATES)) {
    if (month === date.month && day >= date.day && day <= date.day + checkWindow) {
      return {
        type: season as SeasonalSignal["type"],
        description: getSeasonDescription(season),
      };
    }
  }
  
  return null;
}

function getSeasonDescription(season: string): string {
  const descriptions: Record<string, string> = {
    spring_start: "Spring is here - time for spring cleaning and yard work",
    fall_start: "Fall season starting - prep homes and yards for winter",
    winter_prep: "Winter approaching - prepare for cold weather",
    summer_prep: "Summer approaching - outdoor maintenance season",
  };
  return descriptions[season] || "";
}

function determineEventType(
  signal: "weather" | "seasonal",
  category: ServiceCategory
): NotificationEventType | null {
  const allowedEvents = categoryEventMapping[category];
  
  if (signal === "weather" && allowedEvents.includes("environmental")) {
    return "environmental";
  }
  if (signal === "seasonal" && allowedEvents.includes("seasonal")) {
    return "seasonal";
  }
  
  return null;
}

async function createSuggestionIfValid(
  userId: string,
  serviceId: string,
  category: ServiceCategory,
  eventType: NotificationEventType,
  signal: string,
  bookingLink: string
): Promise<boolean> {
  const eligibleClients = await storage.getEligibleClientsForNotification(userId, "sms");
  if (eligibleClients.length === 0) return false;
  
  const recentCampaigns = await storage.getCampaignCountInLastWeek(userId, serviceId);
  if (recentCampaigns > 0) return false;
  
  const existingSuggestions = await storage.getCampaignSuggestions(userId);
  const hasSimilar = existingSuggestions.some(
    s => s.serviceId === serviceId && s.eventType === eventType
  );
  if (hasSimilar) return false;
  
  const suggestedMessage = generateDefaultMessage(
    eventType,
    signal,
    bookingLink,
    "sms"
  );
  
  await storage.createCampaignSuggestion({
    userId,
    serviceId,
    eventType,
    detectedSignal: signal,
    suggestedMessage,
    estimatedEligibleClients: eligibleClients.length,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  
  logger.info(`[CampaignSuggestion] Created suggestion for user ${userId}, service ${serviceId}`);
  return true;
}

export async function runSuggestionDetection(): Promise<void> {
  logger.info("[CampaignSuggestion] Running detection scan...");
  
  try {
    const users = await storage.getAllUsers();
    
    const weatherSignal = await detectWeatherSignal();
    const seasonalSignal = detectSeasonalSignal();
    
    if (!weatherSignal && !seasonalSignal) {
      logger.info("[CampaignSuggestion] No signals detected");
      return;
    }
    
    let suggestionsCreated = 0;
    
    for (const user of users) {
      // Plan gating - skip users without ai_campaign_suggestions capability
      if (!hasCapability(user, "ai_campaign_suggestions") && !isDeveloper(user)) {
        continue;
      }
      
      // Check per-account weekly suggestion limit
      const existingSuggestions = await storage.getCampaignSuggestions(user.id);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const recentSuggestions = existingSuggestions.filter(
        s => new Date(s.createdAt) > oneWeekAgo
      );
      
      if (recentSuggestions.length >= MAX_SUGGESTIONS_PER_ACCOUNT_PER_WEEK) {
        logger.info(`[CampaignSuggestion] Skipping user ${user.id} - at weekly suggestion limit`);
        continue;
      }
      
      const services = await storage.getProviderServices(user.id);
      
      for (const service of services) {
        const category = service.category as ServiceCategory;
        
        // Skip categories where AI suggestions are not allowed (e.g., 'other')
        if (noAiSuggestionCategories.includes(category)) {
          continue;
        }
        
        let bookingLink = "";
        if (user.publicProfileEnabled && user.publicProfileSlug) {
          bookingLink = buildBookingLink(user.publicProfileSlug);
        }
        
        if (weatherSignal) {
          const relevantCategories = CATEGORY_WEATHER_RELEVANCE[weatherSignal.condition!] || [];
          if (relevantCategories.includes(category)) {
            const eventType = determineEventType("weather", category);
            if (eventType) {
              const created = await createSuggestionIfValid(
                user.id,
                service.id,
                category,
                eventType,
                weatherSignal.description,
                bookingLink
              );
              if (created) suggestionsCreated++;
            }
          }
        }
        
        if (seasonalSignal) {
          const relevantCategories = CATEGORY_SEASONAL_RELEVANCE[seasonalSignal.type!] || [];
          if (relevantCategories.includes(category)) {
            const eventType = determineEventType("seasonal", category);
            if (eventType) {
              const created = await createSuggestionIfValid(
                user.id,
                service.id,
                category,
                eventType,
                seasonalSignal.description,
                bookingLink
              );
              if (created) suggestionsCreated++;
            }
          }
        }
      }
    }
    
    logger.info(`[CampaignSuggestion] Detection complete. Created ${suggestionsCreated} suggestions.`);
  } catch (error) {
    logger.error("[CampaignSuggestion] Error during detection:", error);
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function startCampaignSuggestionScheduler(): void {
  const INTERVAL_HOURS = 6;
  const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;
  
  logger.info(`[CampaignSuggestion] Starting scheduler (runs every ${INTERVAL_HOURS} hours)`);
  
  setTimeout(() => {
    runSuggestionDetection();
  }, 60000);
  
  intervalId = setInterval(runSuggestionDetection, INTERVAL_MS);
}

export function stopCampaignSuggestionScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("[CampaignSuggestion] Scheduler stopped");
  }
}
