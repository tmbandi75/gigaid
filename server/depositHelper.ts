import { Job, JobPayment, DerivedDepositState, DepositMetadata, parseDepositMetadata } from "@shared/schema";

// Compute derived deposit state from job and its payments
export function computeDepositState(
  job: Job, 
  payments: JobPayment[]
): DerivedDepositState {
  // Parse deposit metadata from job notes
  const depositMeta = parseDepositMetadata(job.notes);
  
  // Calculate deposit requested amount
  let depositRequestedCents = 0;
  if (depositMeta?.depositType && depositMeta.depositAmount && job.price) {
    if (depositMeta.depositType === "flat") {
      depositRequestedCents = depositMeta.depositAmount;
    } else if (depositMeta.depositType === "percent") {
      depositRequestedCents = Math.round((job.price * depositMeta.depositAmount) / 100);
    }
  }
  
  // Calculate deposit payments (any payment marked as deposit in notes)
  // Check for isDeposit flag in various formats (handles both server-side and customer-submitted)
  const isDepositPayment = (p: JobPayment): boolean => {
    if (!p.notes) return false;
    try {
      const notesObj = JSON.parse(p.notes);
      return notesObj.isDeposit === true;
    } catch {
      return p.notes.includes('"isDeposit":true') || p.notes.includes('"isDeposit": true');
    }
  };
  
  const depositPayments = payments.filter(p => 
    p.jobId === job.id && 
    (p.status === "paid" || p.status === "confirmed") &&
    isDepositPayment(p)
  );
  
  // Also count pending payments submitted by customers (awaiting confirmation)
  const pendingDeposits = payments.filter(p => 
    p.jobId === job.id && 
    p.status === "pending" &&
    isDepositPayment(p)
  );
  
  const depositPaidCents = depositPayments.reduce((sum, p) => sum + p.amount, 0);
  const depositPendingCents = pendingDeposits.reduce((sum, p) => sum + p.amount, 0);
  
  // Check for refund
  const isRefundPayment = (p: JobPayment): boolean => {
    if (!p.notes) return false;
    try {
      const notesObj = JSON.parse(p.notes);
      return notesObj.isDepositRefund === true;
    } catch {
      return p.notes.includes('"isDepositRefund":true') || p.notes.includes('"isDepositRefund": true');
    }
  };
  
  const refundPayment = payments.find(p => 
    p.jobId === job.id && isRefundPayment(p)
  );
  
  // Total effective paid (confirmed + pending from customer)
  const totalEffectivePaid = depositPaidCents + depositPendingCents;
  const depositOutstandingCents = Math.max(0, depositRequestedCents - totalEffectivePaid);
  
  return {
    hasDeposit: depositRequestedCents > 0,
    depositRequestedCents,
    depositPaidCents,
    depositPendingCents,
    depositOutstandingCents,
    depositBalanceCents: depositOutstandingCents,
    isLocked: depositPaidCents > 0,
    isDepositFullyPaid: depositRequestedCents > 0 && depositOutstandingCents === 0,
    refundedAt: refundPayment?.createdAt
  };
}

// Calculate deposit amount from type and value
export function calculateDepositAmount(
  totalPriceCents: number,
  depositType: "flat" | "percent",
  depositValue: number
): number {
  if (depositType === "flat") {
    return Math.min(depositValue, totalPriceCents);
  } else {
    // Percent: cap at 30% for trust
    const cappedPercent = Math.min(depositValue, 30);
    return Math.round((totalPriceCents * cappedPercent) / 100);
  }
}

// Format deposit for display
export function formatDepositDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Get cancellation outcome based on rules
export function getCancellationOutcome(
  job: Job,
  cancelledBy: "worker" | "customer",
  hoursUntilJob: number,
  depositPaidCents: number
): { refundAmount: number; retainedAmount: number; reason: string } {
  if (depositPaidCents === 0) {
    return { refundAmount: 0, retainedAmount: 0, reason: "No deposit to refund" };
  }
  
  if (cancelledBy === "worker") {
    // Worker cancels: auto-refund deposit
    return { 
      refundAmount: depositPaidCents, 
      retainedAmount: 0, 
      reason: "Refunded - provider cancelled" 
    };
  }
  
  // Customer cancels
  if (hoursUntilJob > 24) {
    // More than 24h notice: full refund
    return { 
      refundAmount: depositPaidCents, 
      retainedAmount: 0, 
      reason: "Refunded - cancelled with 24+ hours notice" 
    };
  } else {
    // Less than 24h notice: deposit retained
    return { 
      refundAmount: 0, 
      retainedAmount: depositPaidCents, 
      reason: "Retained - cancelled with less than 24 hours notice" 
    };
  }
}
