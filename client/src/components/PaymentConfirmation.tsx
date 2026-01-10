import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock,
  Loader2,
  DollarSign,
  Receipt,
  AlertCircle,
  Smartphone,
  CreditCard,
  Banknote,
  FileText,
} from "lucide-react";
import { SiVenmo, SiCashapp } from "react-icons/si";
import type { Invoice } from "@shared/schema";

interface JobPayment {
  id: string;
  userId: string;
  invoiceId: string | null;
  jobId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  amount: number;
  method: string;
  status: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  proofUrl: string | null;
  notes: string | null;
  paidAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

interface PaymentConfirmationProps {
  invoice: Invoice;
  payments?: JobPayment[];
  onPaymentConfirmed?: () => void;
}

const METHOD_ICONS: Record<string, React.ReactNode> = {
  zelle: <Smartphone className="h-4 w-4" />,
  venmo: <SiVenmo className="h-4 w-4" />,
  cashapp: <SiCashapp className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  check: <FileText className="h-4 w-4" />,
  stripe: <CreditCard className="h-4 w-4" />,
};

const METHOD_LABELS: Record<string, string> = {
  zelle: "Zelle",
  venmo: "Venmo",
  cashapp: "Cash App",
  cash: "Cash",
  check: "Check",
  stripe: "Card (Stripe)",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    icon: <Clock className="h-3 w-3" />,
  },
  processing: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  paid: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  confirmed: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  failed: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

export function PaymentConfirmation({
  invoice,
  payments = [],
  onPaymentConfirmed,
}: PaymentConfirmationProps) {
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<JobPayment | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");

  const confirmMutation = useMutation({
    mutationFn: async ({ paymentId, notes }: { paymentId: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/payments/${paymentId}/confirm`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoice.id, "payments"] });
      toast({
        title: "Payment confirmed",
        description: "The payment has been marked as confirmed.",
      });
      setShowConfirmDialog(false);
      setSelectedPayment(null);
      setConfirmNotes("");
      onPaymentConfirmed?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to confirm payment.",
        variant: "destructive",
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ paymentId, notes }: { paymentId: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/payments/${paymentId}/mark-paid`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Payment marked as paid",
        description: "The payment status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update payment status.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmPayment = () => {
    if (selectedPayment) {
      confirmMutation.mutate({ paymentId: selectedPayment.id, notes: confirmNotes });
    }
  };

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const pendingPayments = payments.filter(
    (p) => p.status === "pending" || p.status === "processing"
  );
  const completedPayments = payments.filter(
    (p) => p.status === "paid" || p.status === "confirmed"
  );

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Payment Status</CardTitle>
          </div>
          <Badge
            className={`${
              invoice.status === "paid"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            {invoice.status === "paid" ? "Paid" : "Pending"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">Invoice Total</span>
          <span className="text-lg font-semibold">
            {formatAmount(invoice.amount + (invoice.tax || 0) - (invoice.discount || 0))}
          </span>
        </div>

        {pendingPayments.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Awaiting Confirmation
            </div>
            {pendingPayments.map((payment) => {
              const statusStyle = STATUS_STYLES[payment.status] || STATUS_STYLES.pending;
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  data-testid={`payment-pending-${payment.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      {METHOD_ICONS[payment.method] || <DollarSign className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {METHOD_LABELS[payment.method] || payment.method}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatAmount(payment.amount)}</span>
                    <Dialog open={showConfirmDialog && selectedPayment?.id === payment.id} onOpenChange={(open) => {
                      setShowConfirmDialog(open);
                      if (!open) setSelectedPayment(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowConfirmDialog(true);
                          }}
                          data-testid={`button-confirm-payment-${payment.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Confirm
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm Payment Received</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                            <div className="flex items-center gap-2">
                              {METHOD_ICONS[payment.method]}
                              <span>{METHOD_LABELS[payment.method]}</span>
                            </div>
                            <span className="font-semibold">{formatAmount(payment.amount)}</span>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Notes (optional)</label>
                            <Textarea
                              placeholder="Add any notes about this payment..."
                              value={confirmNotes}
                              onChange={(e) => setConfirmNotes(e.target.value)}
                              className="resize-none"
                              rows={2}
                              data-testid="input-confirm-notes"
                            />
                          </div>
                          <Button
                            onClick={handleConfirmPayment}
                            disabled={confirmMutation.isPending}
                            className="w-full"
                            data-testid="button-submit-confirmation"
                          >
                            {confirmMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Confirm Payment Received
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {completedPayments.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Completed Payments
            </div>
            {completedPayments.map((payment) => {
              const statusStyle = STATUS_STYLES[payment.status] || STATUS_STYLES.paid;
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                  data-testid={`payment-completed-${payment.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {METHOD_LABELS[payment.method] || payment.method}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Paid {payment.paidAt ? formatDate(payment.paidAt) : ""}
                      </div>
                    </div>
                  </div>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatAmount(payment.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {payments.length === 0 && invoice.status !== "paid" && (
          <div className="text-center py-6 text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No payment records yet</p>
            <p className="text-xs mt-1">Payments will appear here when recorded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
