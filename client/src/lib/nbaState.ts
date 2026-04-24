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
  if (data.hasLinkShared && !data.hasJobs) return "NO_JOBS_YET";
  if (!data.hasClients && !data.hasJobs) return "NEW_USER";
  if (data.hasJobs && !data.hasCompletedJobs) return "IN_PROGRESS";
  if (data.hasUninvoicedCompletedJobs) return "READY_TO_INVOICE";
  return "ACTIVE_USER";
}
