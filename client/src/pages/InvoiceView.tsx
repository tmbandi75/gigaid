import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PaymentConfirmation } from "@/components/PaymentConfirmation";
import { 
  ArrowLeft, 
  Send, 
  CheckCircle, 
  Clock, 
  FileText, 
  Phone, 
  Mail, 
  Loader2,
  Share2,
  Copy,
  Check,
  DollarSign,
  Edit,
  Trash2,
} from "lucide-react";
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

const statusColors: Record<string, string> = {
  draft: "bg-muted/50 text-muted-foreground border-muted",
  sent: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  paid: "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

const statusIcons: Record<string, typeof Clock> = {
  draft: Clock,
  sent: Send,
  paid: CheckCircle,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "other", label: "Other" },
];

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["/api/invoices", id],
    enabled: !!id,
  });

  const { data: payments = [] } = useQuery<JobPayment[]>({
    queryKey: [`/api/invoices/${id}/payments`],
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/invoices/${id}/send`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      toast({ title: "Invoice sent successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to send invoice", variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentMethod: string) => {
      return apiRequest("POST", `/api/invoices/${id}/mark-paid`, { paymentMethod });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Invoice marked as paid!" });
      setShowPaymentDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to mark invoice as paid", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/invoices/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
      navigate("/invoices");
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    },
  });

  const copyShareLink = () => {
    if (invoice?.shareLink) {
      const link = `${window.location.origin}/invoice/${invoice.shareLink}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Invoice link copied!" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Loading..." showActions={false} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Invoice Not Found" showActions={false} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Invoice not found</p>
        </div>
      </div>
    );
  }

  const StatusIcon = statusIcons[invoice.status] || Clock;

  return (
    <div className="flex flex-col min-h-full" data-testid="page-invoice-view">
      <TopBar title={`Invoice #${invoice.invoiceNumber}`} showActions={false} />
      
      <div className="px-4 py-4 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/invoices")}
          className="-ml-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-chart-4" />
                  </div>
                  #{invoice.invoiceNumber}
                </CardTitle>
                <CardDescription>Created on {formatDate(invoice.createdAt)}</CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`capitalize ${statusColors[invoice.status]}`}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {invoice.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Client</h3>
              <p className="font-medium text-lg">{invoice.clientName}</p>
              <div className="flex flex-col gap-1 mt-2">
                {invoice.clientEmail && (
                  <a 
                    href={`mailto:${invoice.clientEmail}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    data-testid="link-client-email"
                  >
                    <Mail className="h-4 w-4" />
                    {invoice.clientEmail}
                  </a>
                )}
                {invoice.clientPhone && (
                  <a 
                    href={`tel:${invoice.clientPhone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    data-testid="link-client-phone"
                  >
                    <Phone className="h-4 w-4" />
                    {invoice.clientPhone}
                  </a>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Service Description</h3>
              <p className="text-foreground">{invoice.serviceDescription}</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Total Amount</h3>
              <p className="text-2xl font-bold flex items-center gap-1">
                <DollarSign className="h-5 w-5" />
                {formatCurrency(invoice.amount).replace("$", "")}
              </p>
            </div>

            {invoice.status === "paid" && invoice.paidAt && (
              <>
                <Separator />
                <div className="p-4 rounded-lg bg-chart-3/10 border border-chart-3/20">
                  <div className="flex items-center gap-2 text-chart-3 mb-1">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Paid</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(invoice.paidAt)}
                    {invoice.paymentMethod && ` via ${invoice.paymentMethod}`}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {invoice.shareLink && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Share Invoice</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyShareLink}
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <PaymentConfirmation 
          invoice={invoice} 
          payments={payments}
          onPaymentConfirmed={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
            queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          {invoice.status === "draft" && (
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="col-span-2"
              data-testid="button-send-invoice"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to Client
            </Button>
          )}

          {invoice.status === "sent" && (
            <>
              <Button
                variant="outline"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                data-testid="button-resend"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Resend
              </Button>
              <Button
                onClick={() => setShowPaymentDialog(true)}
                data-testid="button-mark-paid"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Paid
              </Button>
            </>
          )}

          {invoice.status !== "paid" && (
            <>
              <Button
                variant="outline"
                onClick={() => navigate(`/invoices/${id}/edit`)}
                data-testid="button-edit"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="button-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              Select how the payment was received for invoice #{invoice.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger data-testid="select-payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => markPaidMutation.mutate(selectedPaymentMethod)}
              disabled={markPaidMutation.isPending}
              data-testid="button-confirm-paid"
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete invoice #{invoice.invoiceNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
