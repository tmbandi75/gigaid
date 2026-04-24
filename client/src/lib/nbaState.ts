import { hasSharedBookingLinkLocally } from "./bookingLinkShared";

export type NBAState =
  | "NEW_USER"
  | "NO_JOBS_YET"
  | "IN_PROGRESS"
  | "READY_TO_INVOICE"
  | "ACTIVE_USER";

export interface NBAInputs {
  hasClients: boolean;
  hasJobs: boolean;
  hasCompletedJobs: boolean;
  hasUninvoicedCompletedJobs: boolean;
  hasInvoices: boolean;
  hasLinkShared: boolean;
}

export type DashboardSummary = {
  totalJobs: number;
  completedJobs: number;
  totalInvoices: number;
  sentInvoices: number;
  hasClients?: boolean;
  hasUninvoicedCompletedJobs?: boolean;
  hasLinkShared?: boolean;
};

export function getNBAState(data: NBAInputs): NBAState {
  if (!data.hasClients && !data.hasJobs && !data.hasLinkShared) return "NEW_USER";
  if (data.hasLinkShared && !data.hasJobs) return "NO_JOBS_YET";
  if (data.hasJobs && !data.hasCompletedJobs) return "IN_PROGRESS";
  if (data.hasUninvoicedCompletedJobs) return "READY_TO_INVOICE";
  if (data.hasInvoices || data.hasCompletedJobs) return "ACTIVE_USER";
  return "NEW_USER";
}

export function deriveNBAState(
  summary: DashboardSummary | undefined,
  userId?: string,
): NBAState {
  const inputs: NBAInputs = {
    hasClients: Boolean(summary?.hasClients),
    hasJobs: (summary?.totalJobs ?? 0) > 0,
    hasCompletedJobs: (summary?.completedJobs ?? 0) > 0,
    hasUninvoicedCompletedJobs: Boolean(summary?.hasUninvoicedCompletedJobs),
    hasInvoices: (summary?.totalInvoices ?? 0) > 0,
    hasLinkShared:
      Boolean(summary?.hasLinkShared) || hasSharedBookingLinkLocally(userId),
  };
  return getNBAState(inputs);
}
