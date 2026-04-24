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

export function getNBAState(data: NBAInputs): NBAState {
  if (!data.hasClients && !data.hasJobs && !data.hasLinkShared) return "NEW_USER";
  if (data.hasLinkShared && !data.hasJobs) return "NO_JOBS_YET";
  if (data.hasJobs && !data.hasCompletedJobs) return "IN_PROGRESS";
  if (data.hasUninvoicedCompletedJobs) return "READY_TO_INVOICE";
  if (data.hasInvoices || data.hasCompletedJobs) return "ACTIVE_USER";
  return "NEW_USER";
}
