import type { Job, Lead, Invoice } from "./schema";

export interface ActionEligibility {
  canArchive: boolean;
  canDelete: boolean;
  canCancel: boolean;
  deleteBlockedReason?: string;
  archiveBlockedReason?: string;
  cancelBlockedReason?: string;
}

export function getJobActionEligibility(job: Job, hasInvoice: boolean = false): ActionEligibility {
  const status = job.status;
  const paymentStatus = job.paymentStatus;
  const hasClientNotified = !!(job.confirmationSentAt || job.reviewRequestedAt);
  
  const result: ActionEligibility = {
    canArchive: false,
    canDelete: false,
    canCancel: false,
  };
  
  if (status === "completed" || status === "cancelled") {
    result.canArchive = true;
    result.canDelete = false;
    result.deleteBlockedReason = "Completed or cancelled jobs cannot be deleted. Archive instead.";
  } else if (status === "in_progress") {
    result.canArchive = false;
    result.canDelete = false;
    result.canCancel = false;
    result.deleteBlockedReason = "In-progress jobs cannot be deleted.";
    result.archiveBlockedReason = "In-progress jobs must be completed or cancelled first.";
    result.cancelBlockedReason = "In-progress jobs must be completed first.";
  } else if (status === "scheduled") {
    result.canCancel = true;
    result.canArchive = false;
    result.archiveBlockedReason = "Scheduled jobs should be cancelled first.";
    
    const isDraft = !hasClientNotified && !hasInvoice && paymentStatus === "unpaid";
    if (isDraft) {
      result.canDelete = true;
    } else {
      result.canDelete = false;
      result.deleteBlockedReason = hasInvoice 
        ? "Cannot delete job with attached invoice."
        : hasClientNotified 
          ? "Cannot delete job after client has been notified."
          : "Cannot delete job with payment activity.";
    }
  } else {
    const isDraft = !hasClientNotified && !hasInvoice && paymentStatus === "unpaid";
    if (isDraft) {
      result.canDelete = true;
    }
    result.canArchive = status === "cancelled";
  }
  
  return result;
}

export function getLeadActionEligibility(lead: Lead): ActionEligibility {
  return {
    canArchive: true,
    canDelete: true,
    canCancel: false,
  };
}

export function getInvoiceActionEligibility(
  invoice: Invoice, 
  hasStripePayment: boolean = false
): ActionEligibility {
  const status = invoice.status;
  
  const result: ActionEligibility = {
    canArchive: true,
    canDelete: false,
    canCancel: false,
  };
  
  if (status === "paid") {
    result.canDelete = false;
    result.deleteBlockedReason = "Paid invoices cannot be deleted. Archive instead.";
  } else if (status === "sent") {
    result.canDelete = false;
    result.deleteBlockedReason = "Sent invoices cannot be deleted. Archive instead.";
  } else if (hasStripePayment) {
    result.canDelete = false;
    result.deleteBlockedReason = "Invoices with payment activity cannot be deleted.";
  } else {
    result.canDelete = true;
  }
  
  return result;
}

export type ItemType = "job" | "lead" | "invoice";

export interface SwipeAction {
  id: string;
  label: string;
  icon: string;
  variant: "destructive" | "secondary" | "warning";
  requiresConfirmation: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
}

export function getSwipeActions(
  type: ItemType,
  eligibility: ActionEligibility
): SwipeAction[] {
  const actions: SwipeAction[] = [];
  
  if (type === "job") {
    if (eligibility.canCancel) {
      actions.push({
        id: "cancel",
        label: "Cancel",
        icon: "X",
        variant: "warning",
        requiresConfirmation: true,
        confirmTitle: "Cancel this job?",
        confirmDescription: "The client will not be charged. You can archive it later.",
      });
    }
    if (eligibility.canArchive) {
      actions.push({
        id: "archive",
        label: "Archive",
        icon: "Archive",
        variant: "secondary",
        requiresConfirmation: true,
        confirmTitle: "Archive this job?",
        confirmDescription: "It will be hidden from your active list but kept for records.",
      });
    }
    if (eligibility.canDelete) {
      actions.push({
        id: "delete",
        label: "Delete",
        icon: "Trash2",
        variant: "destructive",
        requiresConfirmation: true,
        confirmTitle: "Delete this draft job?",
        confirmDescription: "This cannot be undone.",
      });
    }
  } else if (type === "lead") {
    if (eligibility.canArchive) {
      actions.push({
        id: "archive",
        label: "Archive",
        icon: "Archive",
        variant: "secondary",
        requiresConfirmation: false,
      });
    }
    if (eligibility.canDelete) {
      actions.push({
        id: "delete",
        label: "Delete",
        icon: "Trash2",
        variant: "destructive",
        requiresConfirmation: true,
        confirmTitle: "Delete this request?",
        confirmDescription: "This cannot be undone.",
      });
    }
  } else if (type === "invoice") {
    if (eligibility.canArchive) {
      actions.push({
        id: "archive",
        label: "Archive",
        icon: "Archive",
        variant: "secondary",
        requiresConfirmation: true,
        confirmTitle: "Archive this invoice?",
        confirmDescription: "It will be hidden from your active list but kept for records.",
      });
    }
    if (eligibility.canDelete) {
      actions.push({
        id: "delete",
        label: "Delete",
        icon: "Trash2",
        variant: "destructive",
        requiresConfirmation: true,
        confirmTitle: "Delete this draft invoice?",
        confirmDescription: "This cannot be undone.",
      });
    }
  }
  
  return actions;
}
