import { and, eq, isNull } from "drizzle-orm";
import { jobTemplates } from "@shared/schema";
import { logger } from "../lib/logger";
import type { db } from "../db";

type DrizzleDb = typeof db;

interface SystemTemplateRow {
  category: string;
  name: string;
  description: string;
  defaultPriceCents: number;
  estimatedDurationMinutes: number;
}

export const SYSTEM_JOB_TEMPLATES: SystemTemplateRow[] = [
  { category: "handyman", name: "General Repair", description: "Basic home repair and maintenance", defaultPriceCents: 7500, estimatedDurationMinutes: 60 },
  { category: "handyman", name: "Plumbing Fix", description: "Fix leaks, unclog drains, minor plumbing", defaultPriceCents: 15000, estimatedDurationMinutes: 90 },
  { category: "handyman", name: "Furniture Assembly", description: "Assemble flat-pack furniture", defaultPriceCents: 12000, estimatedDurationMinutes: 120 },
  { category: "cleaning", name: "Standard Cleaning", description: "Regular home cleaning service", defaultPriceCents: 12000, estimatedDurationMinutes: 120 },
  { category: "cleaning", name: "Deep Cleaning", description: "Thorough deep cleaning including appliances", defaultPriceCents: 20000, estimatedDurationMinutes: 240 },
  { category: "cleaning", name: "Move-Out Cleaning", description: "Complete cleaning for move-out", defaultPriceCents: 25000, estimatedDurationMinutes: 300 },
  { category: "lawn", name: "Lawn Mowing", description: "Standard lawn mowing and edging", defaultPriceCents: 5000, estimatedDurationMinutes: 45 },
  { category: "lawn", name: "Full Yard Service", description: "Mowing, edging, trimming, and blowing", defaultPriceCents: 8500, estimatedDurationMinutes: 90 },
  { category: "lawn", name: "Landscaping", description: "Garden design, planting, and hardscaping", defaultPriceCents: 30000, estimatedDurationMinutes: 480 },
  { category: "moving", name: "Furniture Moving", description: "Move specific furniture items", defaultPriceCents: 15000, estimatedDurationMinutes: 120 },
  { category: "moving", name: "Local Move", description: "Moving within the same city", defaultPriceCents: 30000, estimatedDurationMinutes: 240 },
  { category: "moving", name: "Packing Service", description: "Professional packing of household items", defaultPriceCents: 20000, estimatedDurationMinutes: 180 },
  { category: "tutoring", name: "1-Hour Session", description: "One-on-one tutoring session", defaultPriceCents: 5000, estimatedDurationMinutes: 60 },
  { category: "tutoring", name: "Weekly Tutoring", description: "Recurring weekly tutoring sessions", defaultPriceCents: 4500, estimatedDurationMinutes: 60 },
  { category: "tutoring", name: "Test Prep Package", description: "2-hour intensive test preparation", defaultPriceCents: 10000, estimatedDurationMinutes: 120 },
];

export interface SeedJobTemplatesResult {
  inserted: number;
  skipped: number;
}

export async function seedJobTemplates(database: DrizzleDb): Promise<SeedJobTemplatesResult> {
  let inserted = 0;
  let skipped = 0;

  for (const tpl of SYSTEM_JOB_TEMPLATES) {
    const existing = await database
      .select({ id: jobTemplates.id })
      .from(jobTemplates)
      .where(
        and(
          eq(jobTemplates.name, tpl.name),
          eq(jobTemplates.category, tpl.category),
          eq(jobTemplates.isSystemTemplate, true),
          isNull(jobTemplates.userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    await database.insert(jobTemplates).values({
      name: tpl.name,
      category: tpl.category,
      description: tpl.description,
      defaultPriceCents: tpl.defaultPriceCents,
      estimatedDurationMinutes: tpl.estimatedDurationMinutes,
      isSystemTemplate: true,
      userId: null,
    });
    inserted += 1;
  }

  logger.info(`[Seed] Job templates seeded: inserted=${inserted}, skipped=${skipped}`);
  return { inserted, skipped };
}
