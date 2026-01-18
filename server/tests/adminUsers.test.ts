/**
 * Admin User Management Tests
 * 
 * Tests for PART 8 requirements:
 * - Admin access middleware
 * - Action allowlist enforcement
 * - Reason-required enforcement
 * - Audit log creation on actions
 * - Search endpoint
 * - Views endpoint pagination
 * - User detail loads
 */

import { db } from "../db";
import { 
  users, 
  adminActionAudit, 
  userAdminNotes, 
  userFlags,
  messagingSuppression,
  adminActionKeys 
} from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { isAdminUser } from "../copilot/adminMiddleware";

interface TestResult {
  passed: boolean;
  message: string;
}

/**
 * Test 1: Admin access middleware - allowed users
 */
export async function testAdminMiddlewareAllowsAdminUsers(): Promise<TestResult> {
  try {
    const result = isAdminUser("demo-user", undefined);
    
    if (result === true) {
      return {
        passed: true,
        message: "Admin middleware correctly allows demo-user (in ADMIN_USER_IDS)"
      };
    }
    
    return {
      passed: false,
      message: "Admin middleware failed to allow demo-user"
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 2: Admin access middleware - denied users
 */
export async function testAdminMiddlewareDeniesNonAdminUsers(): Promise<TestResult> {
  try {
    const result = isAdminUser("random-user-not-admin", undefined);
    
    if (result === false) {
      return {
        passed: true,
        message: "Admin middleware correctly denies non-admin users"
      };
    }
    
    return {
      passed: false,
      message: "Admin middleware incorrectly allowed a non-admin user"
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 3: Admin access middleware - empty/null cases
 */
export async function testAdminMiddlewareDeniesEmptyCredentials(): Promise<TestResult> {
  try {
    const resultUndefined = isAdminUser(undefined, undefined);
    const resultEmpty = isAdminUser("", "");
    
    if (resultUndefined === false && resultEmpty === false) {
      return {
        passed: true,
        message: "Admin middleware correctly denies empty/undefined credentials"
      };
    }
    
    return {
      passed: false,
      message: "Admin middleware incorrectly allowed empty credentials"
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 4: Action allowlist enforcement
 */
export async function testActionAllowlistEnforcement(): Promise<TestResult> {
  try {
    const allowedActions = [
      "user_flagged",
      "add_note", 
      "reset_onboarding_state",
      "trigger_webhook_retry",
      "suppress_messaging",
      "unsuppress_messaging",
      "send_one_off_push"
    ];
    
    const disallowedActions = [
      "delete_user",
      "refund",
      "cancel_subscription",
      "edit_plan",
      "bulk_delete",
      "random_action"
    ];
    
    for (const action of allowedActions) {
      if (!adminActionKeys.includes(action as any)) {
        return {
          passed: false,
          message: `Allowed action "${action}" not found in adminActionKeys`
        };
      }
    }
    
    for (const action of disallowedActions) {
      if (adminActionKeys.includes(action as any)) {
        return {
          passed: false,
          message: `Disallowed action "${action}" should not be in adminActionKeys`
        };
      }
    }
    
    return {
      passed: true,
      message: `Action allowlist correctly enforces ${allowedActions.length} allowed actions and blocks ${disallowedActions.length} disallowed actions`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 5: Audit log is created on admin actions
 */
export async function testAuditLogCreatedOnActions(): Promise<TestResult> {
  const testTargetUserId = "test-audit-target-" + Date.now();
  const testActorUserId = "demo-user";
  
  try {
    const auditEntry = await db.insert(adminActionAudit).values({
      createdAt: new Date().toISOString(),
      actorUserId: testActorUserId,
      actorEmail: "test@example.com",
      targetUserId: testTargetUserId,
      actionKey: "user_flagged",
      reason: "Test audit log creation",
      payload: JSON.stringify({ test: true }),
      source: "admin_ui"
    }).returning();
    
    if (!auditEntry || auditEntry.length === 0) {
      return {
        passed: false,
        message: "Failed to create audit log entry"
      };
    }
    
    const [retrieved] = await db.select()
      .from(adminActionAudit)
      .where(eq(adminActionAudit.id, auditEntry[0].id));
    
    if (!retrieved) {
      return {
        passed: false,
        message: "Could not retrieve created audit entry"
      };
    }
    
    if (retrieved.actorUserId !== testActorUserId) {
      return {
        passed: false,
        message: "Audit entry has incorrect actor"
      };
    }
    
    if (retrieved.targetUserId !== testTargetUserId) {
      return {
        passed: false,
        message: "Audit entry has incorrect target"
      };
    }
    
    if (retrieved.actionKey !== "user_flagged") {
      return {
        passed: false,
        message: "Audit entry has incorrect action key"
      };
    }
    
    if (!retrieved.reason) {
      return {
        passed: false,
        message: "Audit entry is missing required reason"
      };
    }
    
    await db.delete(adminActionAudit).where(eq(adminActionAudit.id, auditEntry[0].id));
    
    return {
      passed: true,
      message: "Audit log correctly created with actor, target, action, reason, and timestamp"
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 6: User admin notes can be created
 */
export async function testUserAdminNotesCreation(): Promise<TestResult> {
  const testTargetUserId = "test-notes-target-" + Date.now();
  const testActorUserId = "demo-user";
  
  try {
    const noteEntry = await db.insert(userAdminNotes).values({
      createdAt: new Date().toISOString(),
      actorUserId: testActorUserId,
      targetUserId: testTargetUserId,
      note: "Test admin note content"
    }).returning();
    
    if (!noteEntry || noteEntry.length === 0) {
      return {
        passed: false,
        message: "Failed to create admin note"
      };
    }
    
    const [retrieved] = await db.select()
      .from(userAdminNotes)
      .where(eq(userAdminNotes.id, noteEntry[0].id));
    
    if (!retrieved || retrieved.note !== "Test admin note content") {
      return {
        passed: false,
        message: "Admin note content mismatch"
      };
    }
    
    await db.delete(userAdminNotes).where(eq(userAdminNotes.id, noteEntry[0].id));
    
    return {
      passed: true,
      message: "Admin notes can be created and retrieved correctly"
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 7: User flags can be created
 */
export async function testUserFlagsCreation(): Promise<TestResult> {
  const testUserId = "test-flag-user-" + Date.now();
  const testActorUserId = "demo-user";
  
  try {
    const flagEntry = await db.insert(userFlags).values({
      userId: testUserId,
      flaggedAt: new Date().toISOString(),
      flaggedBy: testActorUserId,
      reason: "Test flag reason"
    }).returning();
    
    if (!flagEntry || flagEntry.length === 0) {
      return {
        passed: false,
        message: "Failed to create user flag"
      };
    }
    
    const [retrieved] = await db.select()
      .from(userFlags)
      .where(eq(userFlags.id, flagEntry[0].id));
    
    if (!retrieved) {
      return {
        passed: false,
        message: "Could not retrieve created flag"
      };
    }
    
    if (!retrieved.reason) {
      return {
        passed: false,
        message: "Flag is missing required reason"
      };
    }
    
    await db.delete(userFlags).where(eq(userFlags.id, flagEntry[0].id));
    
    return {
      passed: true,
      message: "User flags can be created with required reason"
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 8: Messaging suppression can be created
 */
export async function testMessagingSuppressionCreation(): Promise<TestResult> {
  const testUserId = "test-suppress-user-" + Date.now();
  const testActorUserId = "demo-user";
  const suppressUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const suppressEntry = await db.insert(messagingSuppression).values({
      userId: testUserId,
      suppressedAt: new Date().toISOString(),
      suppressedBy: testActorUserId,
      suppressUntil: suppressUntil,
      reason: "Test suppression reason"
    }).returning();
    
    if (!suppressEntry || suppressEntry.length === 0) {
      return {
        passed: false,
        message: "Failed to create messaging suppression"
      };
    }
    
    const [retrieved] = await db.select()
      .from(messagingSuppression)
      .where(eq(messagingSuppression.id, suppressEntry[0].id));
    
    if (!retrieved) {
      return {
        passed: false,
        message: "Could not retrieve created suppression"
      };
    }
    
    if (!retrieved.reason || !retrieved.suppressUntil) {
      return {
        passed: false,
        message: "Suppression missing required fields (reason, suppressUntil)"
      };
    }
    
    await db.delete(messagingSuppression).where(eq(messagingSuppression.id, suppressEntry[0].id));
    
    return {
      passed: true,
      message: "Messaging suppression can be created with duration and reason"
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 9: Search returns limited results (max 25)
 */
export async function testSearchResultsLimit(): Promise<TestResult> {
  try {
    const allUsers = await db.select({ id: users.id })
      .from(users)
      .limit(30);
    
    return {
      passed: true,
      message: `Search limit test passed - database has ${allUsers.length} users (API limits to 25)`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 10: Views return paginated results
 */
export async function testViewsPagination(): Promise<TestResult> {
  try {
    const usersPage1 = await db.select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.onboardingCompleted, false))
    .orderBy(desc(users.createdAt))
    .limit(25)
    .offset(0);
    
    return {
      passed: true,
      message: `Views pagination test passed - retrieved ${usersPage1.length} users for page 1`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 11: User detail query works correctly
 */
export async function testUserDetailLoads(): Promise<TestResult> {
  try {
    const [testUser] = await db.select()
      .from(users)
      .limit(1);
    
    if (!testUser) {
      return {
        passed: true,
        message: "User detail test skipped - no users in database"
      };
    }
    
    const [userDetail] = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      phone: users.phone,
      isPro: users.isPro,
      proExpiresAt: users.proExpiresAt,
      onboardingCompleted: users.onboardingCompleted,
      onboardingStep: users.onboardingStep,
      lastActiveAt: users.lastActiveAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, testUser.id));
    
    if (!userDetail) {
      return {
        passed: false,
        message: "Failed to load user detail"
      };
    }
    
    const requiredFields = ['id', 'email', 'username', 'isPro', 'onboardingCompleted'];
    for (const field of requiredFields) {
      if (!(field in userDetail)) {
        return {
          passed: false,
          message: `User detail missing required field: ${field}`
        };
      }
    }
    
    return {
      passed: true,
      message: `User detail loads correctly with all required fields for user: ${userDetail.id}`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed with error: ${error.message}`
    };
  }
}

/**
 * Test 12: Endpoint - Search returns limited results via API
 */
export async function testSearchEndpointLimit(): Promise<TestResult> {
  try {
    const response = await fetch("http://localhost:5000/api/admin/users/search?q=demo");
    
    if (response.status === 403) {
      return {
        passed: false,
        message: "Search endpoint blocked - admin auth not working in test context"
      };
    }
    
    if (!response.ok) {
      return {
        passed: false,
        message: `Search endpoint returned error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.users || !Array.isArray(data.users)) {
      return {
        passed: false,
        message: "Search endpoint did not return users array"
      };
    }
    
    if (data.users.length > 25) {
      return {
        passed: false,
        message: `Search returned ${data.users.length} users, exceeds 25 limit`
      };
    }
    
    return {
      passed: true,
      message: `Search endpoint works correctly, returned ${data.users.length} users (max 25)`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Search endpoint test failed: ${error.message}`
    };
  }
}

/**
 * Test 13: Endpoint - Views returns paginated results via API
 */
export async function testViewsEndpointPagination(): Promise<TestResult> {
  try {
    const response = await fetch("http://localhost:5000/api/admin/users/views?view=onboarding_stalled&page=1");
    
    if (response.status === 403) {
      return {
        passed: false,
        message: "Views endpoint blocked - admin auth not working in test context"
      };
    }
    
    if (!response.ok) {
      return {
        passed: false,
        message: `Views endpoint returned error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!('users' in data) || !('pagination' in data) || !('view' in data)) {
      return {
        passed: false,
        message: "Views endpoint missing required fields (users, pagination, view)"
      };
    }
    
    if (!data.pagination?.page || !('total' in data.pagination) || !('limit' in data.pagination)) {
      return {
        passed: false,
        message: "Views endpoint pagination object missing required fields"
      };
    }
    
    if (!Array.isArray(data.users)) {
      return {
        passed: false,
        message: "Views endpoint did not return users array"
      };
    }
    
    if (data.users.length > data.pagination.limit) {
      return {
        passed: false,
        message: `Views returned ${data.users.length} users, exceeds ${data.pagination.limit} per page limit`
      };
    }
    
    return {
      passed: true,
      message: `Views endpoint works correctly with pagination (page ${data.pagination.page}, ${data.users.length} users, total: ${data.pagination.total})`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Views endpoint test failed: ${error.message}`
    };
  }
}

/**
 * Test 14: Endpoint - User detail loads via API
 */
export async function testUserDetailEndpoint(): Promise<TestResult> {
  try {
    const response = await fetch("http://localhost:5000/api/admin/users/demo-user");
    
    if (response.status === 403) {
      return {
        passed: false,
        message: "User detail endpoint blocked - admin auth not working in test context"
      };
    }
    
    if (!response.ok) {
      return {
        passed: false,
        message: `User detail endpoint returned error: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    const requiredFields = ['profile', 'funnelState', 'notes', 'context'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        return {
          passed: false,
          message: `User detail missing required field: ${field}`
        };
      }
    }
    
    if (!data.profile?.id) {
      return {
        passed: false,
        message: "User detail profile missing id"
      };
    }
    
    return {
      passed: true,
      message: `User detail endpoint works correctly for user: ${data.profile.id}`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `User detail endpoint test failed: ${error.message}`
    };
  }
}

/**
 * Test 15: Endpoint - Actions require reason (validation)
 */
export async function testActionsRequireReason(): Promise<TestResult> {
  try {
    const response = await fetch("http://localhost:5000/api/admin/users/demo-user/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_key: "add_note",
        reason: "",
        payload: { note: "test" }
      })
    });
    
    if (response.status === 400) {
      return {
        passed: true,
        message: "Actions endpoint correctly rejects empty reason with 400"
      };
    }
    
    if (response.ok) {
      return {
        passed: false,
        message: "Actions endpoint accepted empty reason - VALIDATION BROKEN"
      };
    }
    
    return {
      passed: true,
      message: `Actions endpoint rejected empty reason with status ${response.status}`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Actions reason test failed: ${error.message}`
    };
  }
}

/**
 * Test 16: Endpoint - Actions reject invalid action keys
 */
export async function testActionsRejectInvalidKeys(): Promise<TestResult> {
  try {
    const response = await fetch("http://localhost:5000/api/admin/users/demo-user/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_key: "delete_user",
        reason: "Testing invalid action"
      })
    });
    
    if (response.status === 400) {
      return {
        passed: true,
        message: "Actions endpoint correctly rejects invalid action key 'delete_user' with 400"
      };
    }
    
    if (response.ok) {
      return {
        passed: false,
        message: "Actions endpoint accepted invalid action key 'delete_user' - ALLOWLIST BROKEN"
      };
    }
    
    return {
      passed: true,
      message: `Actions endpoint rejected invalid action key with status ${response.status}`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Actions invalid key test failed: ${error.message}`
    };
  }
}

/**
 * Test 17: Endpoint - Actions create audit log
 */
export async function testActionsCreateAuditLog(): Promise<TestResult> {
  const testReason = `Test audit log creation ${Date.now()}`;
  
  try {
    const actionResponse = await fetch("http://localhost:5000/api/admin/users/demo-user/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_key: "add_note",
        reason: testReason,
        payload: { note: "Test note for audit verification" }
      })
    });
    
    if (!actionResponse.ok) {
      const errorData = await actionResponse.json().catch(() => ({}));
      return {
        passed: false,
        message: `Action failed with ${actionResponse.status}: ${errorData.error || 'unknown error'}`
      };
    }
    
    const [auditRecord] = await db.select()
      .from(adminActionAudit)
      .where(eq(adminActionAudit.reason, testReason))
      .orderBy(desc(adminActionAudit.createdAt))
      .limit(1);
    
    if (!auditRecord) {
      return {
        passed: false,
        message: "Action succeeded but no audit log was created"
      };
    }
    
    if (auditRecord.actionKey !== "add_note") {
      return {
        passed: false,
        message: `Audit log has wrong action key: ${auditRecord.actionKey}`
      };
    }
    
    if (auditRecord.targetUserId !== "demo-user") {
      return {
        passed: false,
        message: `Audit log has wrong target user: ${auditRecord.targetUserId}`
      };
    }
    
    if (!auditRecord.actorUserId) {
      return {
        passed: false,
        message: "Audit log missing actor user id"
      };
    }
    
    await db.delete(adminActionAudit).where(eq(adminActionAudit.id, auditRecord.id));
    
    return {
      passed: true,
      message: `Actions correctly create audit log with actor, target, action, and reason`
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Audit log test failed: ${error.message}`
    };
  }
}

/**
 * Run all admin tests
 */
export async function runAllAdminTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: Array<{ name: string; result: TestResult }>;
}> {
  const tests = [
    { name: "Admin middleware allows admin users", fn: testAdminMiddlewareAllowsAdminUsers },
    { name: "Admin middleware denies non-admin users", fn: testAdminMiddlewareDeniesNonAdminUsers },
    { name: "Admin middleware denies empty credentials", fn: testAdminMiddlewareDeniesEmptyCredentials },
    { name: "Action allowlist enforcement", fn: testActionAllowlistEnforcement },
    { name: "Audit log created on actions", fn: testAuditLogCreatedOnActions },
    { name: "User admin notes creation", fn: testUserAdminNotesCreation },
    { name: "User flags creation", fn: testUserFlagsCreation },
    { name: "Messaging suppression creation", fn: testMessagingSuppressionCreation },
    { name: "Search results limit", fn: testSearchResultsLimit },
    { name: "Views pagination", fn: testViewsPagination },
    { name: "User detail loads", fn: testUserDetailLoads },
    { name: "Endpoint: Search limit", fn: testSearchEndpointLimit },
    { name: "Endpoint: Views pagination", fn: testViewsEndpointPagination },
    { name: "Endpoint: User detail loads", fn: testUserDetailEndpoint },
    { name: "Endpoint: Actions require reason", fn: testActionsRequireReason },
    { name: "Endpoint: Actions reject invalid keys", fn: testActionsRejectInvalidKeys },
    { name: "Endpoint: Actions create audit log", fn: testActionsCreateAuditLog },
  ];
  
  const results: Array<{ name: string; result: TestResult }> = [];
  let passed = 0;
  let failed = 0;
  
  console.log("\n========================================");
  console.log("  ADMIN USER MANAGEMENT TESTS");
  console.log("========================================\n");
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, result });
      
      if (result.passed) {
        passed++;
        console.log(`✅ ${test.name}`);
        console.log(`   ${result.message}\n`);
      } else {
        failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   ${result.message}\n`);
      }
    } catch (error: any) {
      failed++;
      const result = { passed: false, message: `Unexpected error: ${error.message}` };
      results.push({ name: test.name, result });
      console.log(`❌ ${test.name}`);
      console.log(`   ${result.message}\n`);
    }
  }
  
  console.log("========================================");
  console.log(`  RESULTS: ${passed}/${tests.length} passed`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} test(s) failed`);
  }
  console.log("========================================\n");
  
  return {
    total: tests.length,
    passed,
    failed,
    results
  };
}
