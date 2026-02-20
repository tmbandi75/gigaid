import { z } from "zod";

export const ViewportSchema = z.enum(["mobile", "desktop"]);
export type Viewport = z.infer<typeof ViewportSchema>;

export const StepActionSchema = z.enum([
  "goto",
  "click",
  "fill",
  "wait",
  "signup",
  "login",
  "create_job",
  "send_invoice",
  "pay_invoice",
  "upgrade_plan",
  "logout",
  "assert",
]);
export type StepAction = z.infer<typeof StepActionSchema>;

export const AssertionTypeSchema = z.enum([
  "url",
  "text_present",
  "element_visible",
  "element_hidden",
  "payment_success",
  "job_status",
  "invoice_status",
  "subscription_status",
]);
export type AssertionType = z.infer<typeof AssertionTypeSchema>;

export const StepSchema = z.object({
  action: StepActionSchema,
  selector: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  timeout: z.number().optional(),
  description: z.string().optional(),
});
export type Step = z.infer<typeof StepSchema>;

export const AssertionSchema = z.object({
  type: AssertionTypeSchema,
  selector: z.string().optional(),
  expected: z.string().optional(),
  description: z.string().optional(),
});
export type Assertion = z.infer<typeof AssertionSchema>;

export const ScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  viewport: ViewportSchema,
  tags: z.array(z.string()).optional(),
  steps: z.array(StepSchema),
  assertions: z.array(AssertionSchema),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export interface StepResult {
  action: string;
  description: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface AssertionResult {
  type: string;
  description: string;
  status: "pass" | "fail";
  expected?: string;
  actual?: string;
  error?: string;
}

export interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: number;
}

export interface NetworkError {
  url: string;
  status: number;
  statusText: string;
  method: string;
  timestamp: number;
}

export interface ScenarioResult {
  name: string;
  description: string;
  viewport: Viewport;
  status: "pass" | "fail" | "error";
  startTime: number;
  endTime: number;
  duration: number;
  steps: StepResult[];
  assertions: AssertionResult[];
  consoleErrors: ConsoleEntry[];
  networkErrors: NetworkError[];
  screenshots: string[];
}

export interface UATReport {
  runId: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalScenarios: number;
  passed: number;
  failed: number;
  errored: number;
  scenarios: ScenarioResult[];
}
