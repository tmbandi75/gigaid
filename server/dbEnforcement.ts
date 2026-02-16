/**
 * Database Enforcement: No Silent Completion Trigger
 * 
 * CRITICAL: This module creates a PostgreSQL trigger that prevents jobs
 * from being marked as 'completed' without a job_resolution record.
 * 
 * This is a DATA-LEVEL GUARANTEE that cannot be bypassed by:
 * - UI code
 * - API endpoints
 * - Feature flags
 * - Seed scripts
 * - Direct SQL updates
 * 
 * DO NOT REMOVE OR DISABLE THIS CODE.
 * See spec: "DB trigger always active, API guard always active,
 * Feature flag only affects UI modal behavior"
 */

import { pool } from "./db";
import { logger } from "./lib/logger";

/**
 * Creates the database trigger that enforces job resolution requirement.
 * This MUST run on every server startup to ensure the trigger exists.
 */
export async function createJobResolutionEnforcementTrigger(): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    logger.info(`[DBEnforcement] Creating/verifying job resolution trigger (attempt ${attempt}/${MAX_RETRIES})...`);

    const client = await pool.connect();
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION enforce_job_resolution_on_update()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
            IF NOT EXISTS (
              SELECT 1 FROM job_resolutions WHERE job_id = NEW.id
            ) THEN
              RAISE EXCEPTION 'RESOLUTION_REQUIRED: Completed jobs must have a job_resolution record (invoice, payment, or waiver). Job ID: %', NEW.id
                USING ERRCODE = 'P0001';
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        CREATE OR REPLACE FUNCTION enforce_job_resolution_on_insert()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.status = 'completed' THEN
            IF NOT EXISTS (
              SELECT 1 FROM job_resolutions WHERE job_id = NEW.id
            ) THEN
              RAISE EXCEPTION 'RESOLUTION_REQUIRED: Cannot insert job with completed status without job_resolution record. Job ID: %', NEW.id
                USING ERRCODE = 'P0001';
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`DROP TRIGGER IF EXISTS enforce_job_resolution_trigger ON jobs;`);
      await client.query(`DROP TRIGGER IF EXISTS enforce_job_resolution_insert_trigger ON jobs;`);

      await client.query(`
        CREATE TRIGGER enforce_job_resolution_trigger
        BEFORE UPDATE ON jobs
        FOR EACH ROW
        EXECUTE FUNCTION enforce_job_resolution_on_update();
      `);

      await client.query(`
        CREATE TRIGGER enforce_job_resolution_insert_trigger
        BEFORE INSERT ON jobs
        FOR EACH ROW
        EXECUTE FUNCTION enforce_job_resolution_on_insert();
      `);

      logger.info("[DBEnforcement] Job resolution triggers (INSERT + UPDATE) created successfully");
      return;
    } catch (error: any) {
      const isRetryable = error?.message?.includes('tuple concurrently updated') ||
        error?.code === 'XX000';

      if (isRetryable && attempt < MAX_RETRIES) {
        logger.warn(`[DBEnforcement] Transient error on attempt ${attempt}, retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

      logger.error("[DBEnforcement] CRITICAL: Failed to create job resolution trigger:", error);
      logger.error("[DBEnforcement] The application CANNOT run without revenue protection enforcement!");
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * Repairs existing seed data that violates the job resolution requirement.
 * For each completed job without a resolution, creates a 'waived' resolution
 * with reason 'internal'.
 * 
 * This ensures:
 * - Migrations do not fail
 * - Legacy data is healed
 * - Enforcement can activate safely
 */
export async function repairUnresolvedCompletedJobs(): Promise<{
  checked: number;
  repaired: number;
}> {
  logger.info("[DBEnforcement] Checking for unresolved completed jobs...");
  
  const client = await pool.connect();
  try {
    // Find all completed jobs without resolutions
    const result = await client.query(`
      SELECT j.id, j.user_id, j.completed_at, j.created_at
      FROM jobs j
      LEFT JOIN job_resolutions jr ON jr.job_id = j.id
      WHERE j.status = 'completed'
      AND jr.id IS NULL
    `);
    
    const unresolvedJobs = result.rows;
    let repaired = 0;
    
    for (const job of unresolvedJobs) {
      const resolvedAt = job.completed_at || job.created_at || new Date().toISOString();
      const userId = job.user_id || "demo-user";
      
      await client.query(`
        INSERT INTO job_resolutions (job_id, resolution_type, waiver_reason, resolved_at, resolved_by_user_id, created_at)
        VALUES ($1, 'waived', 'internal', $2, $3, $4)
        ON CONFLICT (job_id) DO NOTHING
      `, [job.id, resolvedAt, userId, new Date().toISOString()]);
      
      repaired++;
      logger.info(`[DBEnforcement] Repaired job ${job.id} with internal waiver`);
    }
    
    if (repaired > 0) {
      logger.info(`[DBEnforcement] Repaired ${repaired} unresolved completed jobs`);
    } else {
      logger.info("[DBEnforcement] No unresolved completed jobs found");
    }
    
    return { checked: unresolvedJobs.length, repaired };
  } catch (error) {
    logger.error("[DBEnforcement] Error repairing jobs:", error);
    return { checked: 0, repaired: 0 };
  } finally {
    client.release();
  }
}

/**
 * Initialize all database enforcement mechanisms.
 * Call this on server startup BEFORE any job operations.
 */
export async function initializeDbEnforcement(): Promise<void> {
  logger.info("[DBEnforcement] Initializing database enforcement...");
  
  // First repair any existing violations (before trigger is active)
  await repairUnresolvedCompletedJobs();
  
  // Then create the trigger to prevent future violations
  await createJobResolutionEnforcementTrigger();
  
  logger.info("[DBEnforcement] Database enforcement initialized");
}
