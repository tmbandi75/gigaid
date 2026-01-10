import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  User,
  Calendar,
  CreditCard,
  Sparkles,
  ChevronRight,
  ExternalLink,
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

const statusConfig: Record<string, { 
  color: string; 
  bg: string; 
  gradient: string;
  icon: typeof Clock; 
  label: string;
  description: string;
}> = {
  draft: { 
    color: "text-slate-600", 
    bg: "bg-slate-100", 
    gradient: "from-slate-500 to-slate-600",
    icon: Clock, 
    label: "Draft",
    description: "Not sent to client yet"
  },
  sent: { 
    color: "text-amber-600", 
    bg: "bg-amber-50", 
    gradient: "from-amber-500 to-orange-500",
    icon: Send, 
    label: "Sent",
    description: "Awaiting payment from client"
  },
  paid: { 
    color: "text-emerald-600", 
    bg: "bg-emerald-50", 
    gradient: "from-emerald-500 to-teal-500",
    icon: CheckCircle, 
    label: "Paid",
    description: "Payment received"
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  { value: "cashapp", label: "Cash App" },
  { value: "check", label: "Check" },
  { value: "card", label: "Card" },
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
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
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
      <div className="flex flex-col min-h-full bg-background">
        <div className="h-48 bg-gradient-to-br from-blue-500 to-cyan-600 animate-pulse" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <div className="h-48 bg-gradient-to-br from-blue-500 to-cyan-600" />
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground mb-2">Invoice Not Found</p>
          <p className="text-muted-foreground text-center mb-6">This invoice may have been deleted</p>
          <Button onClick={() => navigate("/invoices")} data-testid="button-back-to-invoices">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const config = statusConfig[invoice.status] || statusConfig.draft;
  const StatusIcon = config.icon;
  const subtotal = invoice.amount;
  const tax = invoice.tax || 0;
  const discount = invoice.discount || 0;
  const total = subtotal + tax - discount;

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-invoice-view">
      <div className={`relative overflow-hidden bg-gradient-to-br ${config.gradient} text-white px-4 pt-4 pb-20`}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/invoices")}
              className="text-white/90 hover:text-white hover:bg-white/20 -ml-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            
            <div className="flex items-center gap-2">
              {invoice.status !== "paid" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/invoices/${id}/edit`)}
                  className="text-white/90 hover:text-white hover:bg-white/20 h-9 w-9"
                  data-testid="button-edit"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {invoice.status !== "paid" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-white/90 hover:text-white hover:bg-white/20 h-9 w-9"
                  data-testid="button-delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1 mb-4">
              <StatusIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{config.label}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              Invoice #{invoice.invoiceNumber}
            </h1>
            <p className="text-white/70 text-sm">{config.description}</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 -mt-14 pb-6 space-y-4">
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 text-center border-b">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Amount</p>
              <p className="text-4xl font-bold text-foreground tracking-tight">
                {formatCurrency(total)}
              </p>
              {(tax > 0 || discount > 0) && (
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Subtotal: {formatCurrency(subtotal)}</span>
                  {tax > 0 && <span>Tax: +{formatCurrency(tax)}</span>}
                  {discount > 0 && <span className="text-emerald-600">Discount: -{formatCurrency(discount)}</span>}
                </div>
              )}
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Client</p>
                  <p className="font-semibold text-foreground">{invoice.clientName}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {invoice.clientEmail && (
                      <a 
                        href={`mailto:${invoice.clientEmail}`}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                        data-testid="link-client-email"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {invoice.clientEmail}
                      </a>
                    )}
                    {invoice.clientPhone && (
                      <a 
                        href={`tel:${invoice.clientPhone}`}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                        data-testid="link-client-phone"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {invoice.clientPhone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="h-px bg-border" />
              
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                  <p className="text-sm text-foreground">{invoice.serviceDescription || "No description provided"}</p>
                </div>
              </div>
              
              <div className="h-px bg-border" />
              
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(invoice.createdAt)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {invoice.status === "paid" && invoice.paidAt && (
          <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">Payment Received</p>
                  <p className="text-white/80 text-sm">
                    {formatDate(invoice.paidAt)}
                    {invoice.paymentMethod && ` via ${invoice.paymentMethod.charAt(0).toUpperCase() + invoice.paymentMethod.slice(1)}`}
                  </p>
                </div>
                <Sparkles className="h-6 w-6 text-white/50" />
              </div>
            </CardContent>
          </Card>
        )}

        {invoice.shareLink && (
          <Card className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Share with Client</p>
                  <p className="text-xs text-muted-foreground">Send a link to view this invoice</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyShareLink}
                  className="gap-2"
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
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

        <div className="space-y-3 pt-2">
          {invoice.status === "draft" && (
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20 rounded-xl"
              data-testid="button-send-invoice"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center mr-3">
                  <Send className="h-4 w-4" />
                </div>
              )}
              Send Invoice to Client
            </Button>
          )}

          {invoice.status === "sent" && (
            <>
              <Button
                onClick={() => setShowPaymentDialog(true)}
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 rounded-xl"
                data-testid="button-mark-paid"
              >
                <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center mr-3">
                  <CheckCircle className="h-4 w-4" />
                </div>
                Mark as Paid
              </Button>
              <Button
                variant="outline"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="w-full h-12 rounded-xl"
                data-testid="button-resend"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Resend Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              Confirm Payment
            </DialogTitle>
            <DialogDescription>
              How did you receive payment for invoice #{invoice.invoiceNumber}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">Payment Method</p>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="h-12" data-testid="select-payment-method">
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => markPaidMutation.mutate(selectedPaymentMethod)}
              disabled={markPaidMutation.isPending}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              Delete Invoice
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete invoice #{invoice.invoiceNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
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
