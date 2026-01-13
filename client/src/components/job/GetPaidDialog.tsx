import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  DollarSign, 
  Banknote, 
  CreditCard, 
  Smartphone,
  Check,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Star,
  X,
  FileText
} from "lucide-react";
import { SiVenmo, SiCashapp } from "react-icons/si";

interface GetPaidDialogProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  amount?: number;
  clientName?: string;
  depositPaidCents?: number;
  totalAmountCents?: number;
}

const paymentMethods = [
  { id: "cash", label: "Cash", icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  { id: "zelle", label: "Zelle", icon: Smartphone, color: "text-purple-600", bg: "bg-purple-500/10" },
  { id: "venmo", label: "Venmo", icon: SiVenmo, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "cashapp", label: "Cash App", icon: SiCashapp, color: "text-green-600", bg: "bg-green-500/10" },
  { id: "check", label: "Check", icon: DollarSign, color: "text-amber-600", bg: "bg-amber-500/10" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-slate-600", bg: "bg-slate-500/10" },
];

export function GetPaidDialog({ open, onClose, jobId, jobTitle, amount, clientName, depositPaidCents, totalAmountCents }: GetPaidDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [step, setStep] = useState<"ask" | "method" | "success" | "review_sent" | "invoice_created">("ask");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const markPaidMutation = useMutation({
    mutationFn: async (method: string) => {
      return apiRequest("PATCH", `/api/jobs/${jobId}/payment`, {
        paymentStatus: "paid",
        paymentMethod: method,
        paidAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setStep("success");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const requestReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/request-review`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.smsSent || data.emailSent) {
        setStep("review_sent");
      } else {
        toast({
          title: "No contact info",
          description: "Customer has no phone or email on file for review request.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send review request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleYesPaid = () => {
    setStep("method");
  };

  const handleSelectMethod = (method: string) => {
    setSelectedMethod(method);
    markPaidMutation.mutate(method);
  };

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/send-payment-link`);
      return response.json();
    },
    onSuccess: (data) => {
      const sentVia = [];
      if (data.smsSent) sentVia.push("SMS");
      if (data.emailSent) sentVia.push("Email");
      
      toast({
        title: "Payment link sent!",
        description: sentVia.length > 0 
          ? `Sent via ${sentVia.join(" and ")}` 
          : "Link created - share with your client",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send payment link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRequestPayment = () => {
    sendPaymentLinkMutation.mutate();
  };

  const handleRequestReview = () => {
    requestReviewMutation.mutate();
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const invoiceAmount = totalAmountCents || amount || 0;
      const response = await apiRequest("POST", `/api/invoices`, {
        userId: "demo-user",
        jobId,
        clientName: clientName || "Customer",
        serviceDescription: jobTitle,
        amount: invoiceAmount,
        status: "draft",
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setStep("invoice_created");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateInvoice = () => {
    createInvoiceMutation.mutate();
  };

  const handleClose = () => {
    setStep("ask");
    setSelectedMethod(null);
    onClose();
  };

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-get-paid">
        {step === "ask" && (
          <>
            <DialogHeader>
              <div className="mx-auto p-3 rounded-full bg-emerald-500/10 mb-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <DialogTitle className="text-center text-xl">Job Complete!</DialogTitle>
              <DialogDescription className="text-center">
                <span className="font-medium text-foreground">{jobTitle}</span>
                {clientName && (
                  <span className="block text-sm mt-1">for {clientName}</span>
                )}
                {totalAmountCents && totalAmountCents > 0 && depositPaidCents && depositPaidCents > 0 ? (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span>{formatAmount(totalAmountCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Deposit paid</span>
                      <span>-{formatAmount(depositPaidCents)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold text-lg">
                      <span>Balance due</span>
                      <span className="text-emerald-600">{formatAmount(totalAmountCents - depositPaidCents)}</span>
                    </div>
                  </div>
                ) : amount && amount > 0 ? (
                  <span className="block text-2xl font-bold text-emerald-600 mt-2">
                    {formatAmount(amount)}
                  </span>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              <p className="text-center text-base font-medium">Did you get paid?</p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleYesPaid}
                  data-testid="button-yes-paid"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Yes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-base"
                  onClick={handleCreateInvoice}
                  disabled={createInvoiceMutation.isPending}
                  data-testid="button-create-invoice"
                >
                  {createInvoiceMutation.isPending ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-5 w-5 mr-2" />
                  )}
                  {createInvoiceMutation.isPending ? "Creating..." : "Invoice Now"}
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Create an invoice to track payment and send reminders
              </p>
            </div>
          </>
        )}

        {step === "method" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">How did they pay?</DialogTitle>
              <DialogDescription className="text-center">
                Select the payment method used
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => handleSelectMethod(method.id)}
                    disabled={markPaidMutation.isPending}
                    className={`p-4 rounded-xl border-2 transition-all hover-elevate ${
                      selectedMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`button-method-${method.id}`}
                  >
                    <div className={`p-2 rounded-lg ${method.bg} w-fit mx-auto mb-2`}>
                      <Icon className={`h-5 w-5 ${method.color}`} />
                    </div>
                    <p className="text-sm font-medium">{method.label}</p>
                  </button>
                );
              })}
            </div>
            {markPaidMutation.isPending && (
              <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Recording payment...</span>
              </div>
            )}
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <div className="mx-auto p-4 rounded-full bg-emerald-500/10 mb-2">
                <DollarSign className="h-10 w-10 text-emerald-600" />
              </div>
              <DialogTitle className="text-center text-xl">Payment Recorded!</DialogTitle>
              <DialogDescription className="text-center">
                {totalAmountCents && totalAmountCents > 0 && depositPaidCents && depositPaidCents > 0 ? (
                  <div className="mt-2 space-y-1 text-left">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Balance collected</span>
                      <span className="font-medium">{formatAmount(totalAmountCents - depositPaidCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Deposit (already paid)</span>
                      <span>{formatAmount(depositPaidCents)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold text-emerald-600">
                      <span>Total earned</span>
                      <span>{formatAmount(totalAmountCents)}</span>
                    </div>
                  </div>
                ) : amount && amount > 0 ? (
                  <>
                    <span className="text-2xl font-bold text-emerald-600 block mt-2">
                      {formatAmount(amount)}
                    </span>
                    <span className="block mt-1">has been added to your earnings</span>
                  </>
                ) : (
                  "This job has been marked as paid"
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              <p className="text-center text-sm text-muted-foreground">
                Would you like to request a review from {clientName || "the customer"}?
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 h-12 text-base bg-amber-500 hover:bg-amber-600"
                  onClick={handleRequestReview}
                  disabled={requestReviewMutation.isPending}
                  data-testid="button-request-review"
                >
                  {requestReviewMutation.isPending ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Star className="h-5 w-5 mr-2" />
                  )}
                  Request Review
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-base"
                  onClick={handleClose}
                  data-testid="button-skip-review"
                >
                  <X className="h-5 w-5 mr-2" />
                  Skip
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "review_sent" && (
          <>
            <DialogHeader>
              <div className="mx-auto p-4 rounded-full bg-amber-500/10 mb-2">
                <Star className="h-10 w-10 text-amber-500 fill-amber-500" />
              </div>
              <DialogTitle className="text-center text-xl">Review Request Sent!</DialogTitle>
              <DialogDescription className="text-center">
                <span className="block mt-2">
                  {clientName || "The customer"} will receive a link to leave a review.
                </span>
                <span className="block text-sm mt-2 text-muted-foreground">
                  Reviews help grow your business!
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button 
                className="w-full" 
                onClick={handleClose}
                data-testid="button-done"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "invoice_created" && (
          <>
            <DialogHeader>
              <div className="mx-auto p-4 rounded-full bg-blue-500/10 mb-2">
                <FileText className="h-10 w-10 text-blue-600" />
              </div>
              <DialogTitle className="text-center text-xl">Invoice Created!</DialogTitle>
              <DialogDescription className="text-center">
                <span className="block mt-2">
                  Your invoice for <span className="font-medium text-foreground">{jobTitle}</span> is ready.
                </span>
                {(totalAmountCents || amount) && (
                  <span className="block text-2xl font-bold text-blue-600 mt-2">
                    {formatAmount(totalAmountCents || amount || 0)}
                  </span>
                )}
                <span className="block text-sm mt-2 text-muted-foreground">
                  GigAid will remind you to follow up if unpaid.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
              <Button 
                className="flex-1"
                onClick={() => navigate("/invoices")}
                data-testid="button-view-invoices"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Invoices
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                data-testid="button-done-invoice"
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
