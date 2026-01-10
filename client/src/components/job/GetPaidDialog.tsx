import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  Banknote, 
  CreditCard, 
  Smartphone,
  Check,
  ExternalLink,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { SiVenmo, SiCashapp } from "react-icons/si";

interface GetPaidDialogProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  amount?: number;
  clientName?: string;
}

const paymentMethods = [
  { id: "cash", label: "Cash", icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  { id: "zelle", label: "Zelle", icon: Smartphone, color: "text-purple-600", bg: "bg-purple-500/10" },
  { id: "venmo", label: "Venmo", icon: SiVenmo, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "cashapp", label: "Cash App", icon: SiCashapp, color: "text-green-600", bg: "bg-green-500/10" },
  { id: "check", label: "Check", icon: DollarSign, color: "text-amber-600", bg: "bg-amber-500/10" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-slate-600", bg: "bg-slate-500/10" },
];

export function GetPaidDialog({ open, onClose, jobId, jobTitle, amount, clientName }: GetPaidDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [step, setStep] = useState<"ask" | "method" | "success">("ask");
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

  const handleYesPaid = () => {
    setStep("method");
  };

  const handleSelectMethod = (method: string) => {
    setSelectedMethod(method);
    markPaidMutation.mutate(method);
  };

  const handleRequestPayment = () => {
    toast({
      title: "Payment link feature",
      description: "Payment link sending coming soon!",
    });
    onClose();
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
                {amount && amount > 0 && (
                  <span className="block text-2xl font-bold text-emerald-600 mt-2">
                    {formatAmount(amount)}
                  </span>
                )}
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
                  onClick={handleRequestPayment}
                  data-testid="button-request-payment"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Request Payment
                </Button>
              </div>
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
                {amount && amount > 0 ? (
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
      </DialogContent>
    </Dialog>
  );
}
