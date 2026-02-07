export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
  duration_ms: number;
  timestamp: string;
}

export interface TestReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  duration_ms: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
  };
  categories: Record<string, { passed: number; failed: number; tests: TestResult[] }>;
  fixesApplied: string[];
  stripeIds: string[];
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  usagePattern: "light" | "heavy" | "max";
}

export function createTestResult(
  name: string,
  category: string,
  passed: boolean,
  message: string,
  startTime: number,
  details?: Record<string, any>
): TestResult {
  return {
    name,
    category,
    passed,
    message,
    details,
    duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}
