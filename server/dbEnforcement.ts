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

/**
 * Creates the database trigger that enforces job resolution requirement.
 * This MUST run on every server startup to ensure the trigger exists.
 */
export async function createJobResolutionEnforcementTrigger(): Promise<void> {
  console.log("[DBEnforcement] Creating/verifying job resolution trigger...");
  
  const client = await pool.connect();
  try {
    // Create the trigger function for UPDATES
    // This function checks if a job_resolution exists before allowing completion
    await client.query(`
      CREATE OR REPLACE FUNCTION enforce_job_resolution_on_update()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Only check when status is being set to 'completed'
        -- and it wasn't already 'completed'
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
    
    // Create the trigger function for INSERTS
    // Prevents inserting a job directly with status='completed' without resolution
    await client.query(`
      CREATE OR REPLACE FUNCTION enforce_job_resolution_on_insert()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Block inserting a job with status='completed' without resolution
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
    
    // Drop existing triggers if they exist (to update them)
    await client.query(`
      DROP TRIGGER IF EXISTS enforce_job_resolution_trigger ON jobs;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS enforce_job_resolution_insert_trigger ON jobs;
    `);
    
    // Create UPDATE trigger
    await client.query(`
      CREATE TRIGGER enforce_job_resolution_trigger
      BEFORE UPDATE ON jobs
      FOR EACH ROW
      EXECUTE FUNCTION enforce_job_resolution_on_update();
    `);
    
    // Create INSERT trigger
    await client.query(`
      CREATE TRIGGER enforce_job_resolution_insert_trigger
      BEFORE INSERT ON jobs
      FOR EACH ROW
      EXECUTE FUNCTION enforce_job_resolution_on_insert();
    `);
    
    console.log("[DBEnforcement] Job resolution triggers (INSERT + UPDATE) created successfully");
  } catch (error) {
    // CRITICAL: Log and re-throw - the app should NOT start without enforcement
    // The API guard provides defense-in-depth but DB trigger is the hard guarantee
    console.error("[DBEnforcement] CRITICAL: Failed to create job resolution trigger:", error);
    console.error("[DBEnforcement] The application CANNOT run without revenue protection enforcement!");
    throw error;
  } finally {
    client.release();
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
  console.log("[DBEnforcement] Checking for unresolved completed jobs...");
  
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
      console.log(`[DBEnforcement] Repaired job ${job.id} with internal waiver`);
    }
    
    if (repaired > 0) {
      console.log(`[DBEnforcement] Repaired ${repaired} unresolved completed jobs`);
    } else {
      console.log("[DBEnforcement] No unresolved completed jobs found");
    }
    
    return { checked: unresolvedJobs.length, repaired };
  } catch (error) {
    console.error("[DBEnforcement] Error repairing jobs:", error);
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
  console.log("[DBEnforcement] Initializing database enforcement...");
  
  // First repair any existing violations (before trigger is active)
  await repairUnresolvedCompletedJobs();
  
  // Then create the trigger to prevent future violations
  await createJobResolutionEnforcementTrigger();
  
  console.log("[DBEnforcement] Database enforcement initialized");
}
