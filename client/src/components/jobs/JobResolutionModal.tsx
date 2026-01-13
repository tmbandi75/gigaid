import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, CreditCard, Ban, ChevronRight, Loader2 } from "lucide-react";
import type { Job, JobResolutionType, WaiverReason, JobPaymentMethod } from "@shared/schema";

const PAYMENT_METHODS: { value: JobPaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "cashapp", label: "CashApp" },
  { value: "check", label: "Check" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

const WAIVER_REASONS: { value: WaiverReason; label: string; description: string }[] = [
  { value: "warranty", label: "Warranty Work", description: "Covered under previous job warranty" },
  { value: "redo", label: "Redo / Fix", description: "Fixing previous work at no charge" },
  { value: "goodwill", label: "Goodwill", description: "Customer courtesy or relationship building" },
  { value: "internal", label: "Internal", description: "Company/personal work, not billable" },
];

interface JobResolutionModalProps {
  open: boolean;
  job: Job;
  onResolved: (resolutionType: JobResolutionType, data?: { invoiceId?: string }) => void;
  onOpenInvoiceCreate: () => void;
}

type ResolutionPath = "invoice" | "paid" | "waived" | null;

export function JobResolutionModal({
  open,
  job,
  onResolved,
  onOpenInvoiceCreate,
}: JobResolutionModalProps) {
  const [selectedPath, setSelectedPath] = useState<ResolutionPath>(null);
  const [paymentMethod, setPaymentMethod] = useState<JobPaymentMethod | "">("");
  const [waiverReason, setWaiverReason] = useState<WaiverReason | "">("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createResolutionMutation = useMutation({
    mutationFn: async (data: {
      resolutionType: JobResolutionType;
      paymentMethod?: string;
      waiverReason?: string;
    }) => {
      return apiRequest("POST", `/api/jobs/${job.id}/resolution`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", job.id] });
      toast({
        title: "Job Completed",
        description: "Payment resolution recorded successfully.",
      });
      onResolved(variables.resolutionType);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record resolution",
        variant: "destructive",
      });
    },
  });

  const handleSelectPath = (path: ResolutionPath) => {
    setSelectedPath(path);
    if (path === "invoice") {
      onOpenInvoiceCreate();
    }
  };

  const handleConfirmPaid = () => {
    if (!paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select how you were paid.",
        variant: "destructive",
      });
      return;
    }
    createResolutionMutation.mutate({
      resolutionType: "paid_without_invoice",
      paymentMethod,
    });
  };

  const handleConfirmWaived = () => {
    if (!waiverReason) {
      toast({
        title: "Reason Required",
        description: "Please select why no invoice is needed.",
        variant: "destructive",
      });
      return;
    }
    createResolutionMutation.mutate({
      resolutionType: "waived",
      waiverReason,
    });
  };

  const handleBack = () => {
    setSelectedPath(null);
    setPaymentMethod("");
    setWaiverReason("");
  };

  const isLoading = createResolutionMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Finish Job & Protect Payment</DialogTitle>
          <DialogDescription>
            Before completing this job, choose how you'd like to handle payment.
            This protects your revenue.
          </DialogDescription>
        </DialogHeader>

        {!selectedPath && (
          <div className="space-y-3 mt-4">
            <button
              onClick={() => handleSelectPath("invoice")}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover-elevate transition-colors text-left"
              data-testid="resolution-option-invoice"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Create Invoice</div>
                  <div className="text-sm text-muted-foreground">
                    Send a professional invoice to the client
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => handleSelectPath("paid")}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover-elevate transition-colors text-left"
              data-testid="resolution-option-paid"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <CreditCard className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="font-medium">Already Paid (No Invoice)</div>
                  <div className="text-sm text-muted-foreground">
                    Client paid directly - cash, Zelle, Venmo, etc.
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              onClick={() => handleSelectPath("waived")}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover-elevate transition-colors text-left"
              data-testid="resolution-option-waived"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <Ban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium">No Invoice Needed</div>
                  <div className="text-sm text-muted-foreground">
                    Warranty, redo, or internal work
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}

        {selectedPath === "paid" && (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>How were you paid?</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as JobPaymentMethod)}
              >
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                data-testid="button-back"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmPaid}
                disabled={isLoading || !paymentMethod}
                data-testid="button-confirm-paid"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm & Complete Job"
                )}
              </Button>
            </div>
          </div>
        )}

        {selectedPath === "waived" && (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Why doesn't this job need an invoice?</Label>
              <RadioGroup
                value={waiverReason}
                onValueChange={(v) => setWaiverReason(v as WaiverReason)}
                className="space-y-2"
              >
                {WAIVER_REASONS.map((reason) => (
                  <div
                    key={reason.value}
                    className="flex items-start space-x-3 p-3 rounded-lg border border-border hover-elevate cursor-pointer"
                    onClick={() => setWaiverReason(reason.value)}
                    data-testid={`waiver-reason-${reason.value}`}
                  >
                    <RadioGroupItem value={reason.value} id={reason.value} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={reason.value} className="font-medium cursor-pointer">
                        {reason.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{reason.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                data-testid="button-back-waiver"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmWaived}
                disabled={isLoading || !waiverReason}
                data-testid="button-confirm-waived"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm & Complete Job"
                )}
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-2">
          This ensures you never forget to collect payment for completed work.
        </p>
      </DialogContent>
    </Dialog>
  );
}
