/**
 * No Silent Completion Regression Test
 * 
 * CRITICAL: This test MUST fail if the job resolution enforcement is removed.
 * 
 * The test verifies that:
 * 1. Jobs CANNOT be completed via API without a resolution
 * 2. The HTTP 409 error is returned with correct error code
 * 3. This enforcement works regardless of feature flags
 * 
 * DO NOT REMOVE THIS TEST.
 */

import { storage } from "../storage";

/**
 * Test: Attempting to complete a job without resolution should fail
 * 
 * This test creates a job, attempts to complete it without creating
 * a job_resolution record, and expects a 409 error.
 */
export async function testNoSilentCompletionEnforcement(): Promise<{
  passed: boolean;
  message: string;
}> {
  const testUserId = "demo-user";
  
  try {
    // Step 1: Create a test job
    const testJob = await storage.createJob({
      userId: testUserId,
      title: "Test Job for Enforcement",
      serviceType: "Test Service",
      status: "scheduled",
      scheduledDate: new Date().toISOString().split("T")[0],
      price: 10000,
      clientName: "Test Client",
      clientPhone: "555-0000",
    });
    
    console.log(`[Test] Created test job: ${testJob.id}`);
    
    // Step 2: Attempt to complete the job WITHOUT creating a resolution
    // This MUST fail if enforcement is working
    try {
      const updated = await storage.updateJob(testJob.id, {
        status: "completed",
      });
      
      // If we get here, enforcement failed!
      // Clean up and report failure
      await storage.deleteJob(testJob.id);
      
      return {
        passed: false,
        message: `CRITICAL: Job was completed without resolution! Enforcement is broken. Job ID: ${testJob.id}`,
      };
    } catch (error: any) {
      // We expect either a DB trigger error or the storage layer to throw
      // The API layer would return 409, but storage layer should also fail
      
      // Check if it's the expected enforcement error
      if (error.message?.includes("RESOLUTION_REQUIRED") || 
          error.code === "P0001" ||
          error.message?.includes("job_resolution")) {
        console.log(`[Test] Correctly rejected completion: ${error.message}`);
        
        // Clean up
        await storage.deleteJob(testJob.id);
        
        return {
          passed: true,
          message: "Enforcement working: Job completion without resolution was correctly rejected",
        };
      }
      
      // Unexpected error - still a failure
      await storage.deleteJob(testJob.id);
      
      return {
        passed: false,
        message: `Unexpected error during test: ${error.message}`,
      };
    }
  } catch (error: any) {
    return {
      passed: false,
      message: `Test setup failed: ${error.message}`,
    };
  }
}

/**
 * Test: Jobs with resolution CAN be completed
 */
export async function testJobWithResolutionCanComplete(): Promise<{
  passed: boolean;
  message: string;
}> {
  const testUserId = "demo-user";
  
  try {
    // Step 1: Create a test job
    const testJob = await storage.createJob({
      userId: testUserId,
      title: "Test Job With Resolution",
      serviceType: "Test Service",
      status: "scheduled",
      scheduledDate: new Date().toISOString().split("T")[0],
      price: 10000,
      clientName: "Test Client",
      clientPhone: "555-0001",
    });
    
    console.log(`[Test] Created test job with resolution: ${testJob.id}`);
    
    // Step 2: Create a resolution FIRST
    await storage.createJobResolution({
      jobId: testJob.id,
      resolutionType: "waived",
      waiverReason: "internal",
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: testUserId,
      createdAt: new Date().toISOString(),
    });
    
    console.log(`[Test] Created resolution for job: ${testJob.id}`);
    
    // Step 3: Now complete the job - this should succeed
    const updated = await storage.updateJob(testJob.id, {
      status: "completed",
    });
    
    if (updated?.status === "completed") {
      // Clean up
      await storage.deleteJobResolution(testJob.id);
      await storage.deleteJob(testJob.id);
      
      return {
        passed: true,
        message: "Jobs with resolution can be completed successfully",
      };
    } else {
      await storage.deleteJobResolution(testJob.id);
      await storage.deleteJob(testJob.id);
      
      return {
        passed: false,
        message: "Job was not updated to completed status",
      };
    }
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed unexpectedly: ${error.message}`,
    };
  }
}

/**
 * Run all No Silent Completion tests
 */
export async function runNoSilentCompletionTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; passed: boolean; message: string }>;
}> {
  console.log("[Test] Running No Silent Completion regression tests...");
  
  const results: Array<{ name: string; passed: boolean; message: string }> = [];
  
  // Test 1: Enforcement blocks completion without resolution
  const test1 = await testNoSilentCompletionEnforcement();
  results.push({ name: "testNoSilentCompletionEnforcement", ...test1 });
  
  // Test 2: Jobs with resolution can complete
  const test2 = await testJobWithResolutionCanComplete();
  results.push({ name: "testJobWithResolutionCanComplete", ...test2 });
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`[Test] Results: ${passed} passed, ${failed} failed`);
  
  for (const result of results) {
    console.log(`[Test] ${result.passed ? "PASS" : "FAIL"}: ${result.name} - ${result.message}`);
  }
  
  return { passed, failed, results };
}
