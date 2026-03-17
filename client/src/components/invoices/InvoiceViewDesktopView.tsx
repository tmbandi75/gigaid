import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  CheckCircle,
  Clock,
  FileText,
  Phone,
  Mail,
  User,
  Calendar,
  Copy,
  Check,
  Undo2,
  MessageSquare,
  Edit,
  Trash2,
  Sparkles,
  CreditCard,
} from "lucide-react";
import type { Invoice, AiNudge } from "@shared/schema";
import { NudgeChips } from "@/components/nudges/NudgeChip";
import { PaymentConfirmation } from "@/components/PaymentConfirmation";
import { NextActionBanner } from "@/components/NextActionBanner";

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

interface InvoiceViewDesktopViewProps {
  invoice: Invoice;
  payments: JobPayment[];
  nudges: AiNudge[];
  featureFlag: { enabled: boolean } | undefined;
  copied: boolean;
  statusConfig: {
    color: string;
    bg: string;
    gradient: string;
    icon: typeof Clock;
    label: string;
    description: string;
  };
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  onSendClick: () => void;
  onMarkPaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRevert: () => void;
  onCopyShareLink: () => void;
  onNudgeClick: (nudge: AiNudge) => void;
  onSendText: (params: { phoneNumber: string; message: string }) => void;
  onPaymentConfirmed: () => void;
  onIncrementStall: () => void;
  formatCurrency: (cents: number) => string;
  formatDate: (dateStr: string) => string;
  formatShortDate: (dateStr: string) => string;
}

export function InvoiceViewDesktopView({
  invoice,
  payments,
  nudges,
  featureFlag,
  copied,
  statusConfig: config,
  subtotal,
  tax,
  discount,
  total,
  onSendClick,
  onMarkPaid,
  onEdit,
  onDelete,
  onRevert,
  onCopyShareLink,
  onNudgeClick,
  onSendText,
  onPaymentConfirmed,
  onIncrementStall,
  formatCurrency,
  formatDate,
  formatShortDate,
}: InvoiceViewDesktopViewProps) {
  const StatusIcon = config.icon;
  const invoiceNudges = nudges.filter(
    (n) => n.entityType === "invoice" && n.entityId === invoice.id && n.status === "active"
  );

  const paymentMethodLabel = (method: string) =>
    method.charAt(0).toUpperCase() + method.slice(1);

  return (
    <div className="max-w-7xl mx-auto w-full px-6 lg:px-8 pt-6 pb-8">
      <NextActionBanner entityType="invoice" entityId={invoice.id} />

      {featureFlag?.enabled && invoiceNudges.length > 0 && (
        <Card className="rounded-xl border border-gray-200 shadow-sm mb-6" data-testid="card-nudges-desktop">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-sm">AI Suggestions</h3>
            </div>
            <NudgeChips nudges={invoiceNudges} onNudgeClick={onNudgeClick} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card className="rounded-xl border border-gray-200 shadow-sm" data-testid="card-invoice-details-desktop">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Invoice Details</h2>
                <div className="flex items-center gap-2">
                  {invoice.status !== "paid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onEdit}
                      aria-label="Edit invoice"
                      data-testid="button-edit-desktop"
                    >
                      <Edit className="h-4 w-4 mr-1.5" />
                      Edit
                    </Button>
                  )}
                  {invoice.status !== "paid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDelete}
                      className="text-destructive hover:text-destructive"
                      aria-label="Delete invoice"
                      data-testid="button-delete-desktop"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Client</p>
                  <p className="font-semibold text-foreground text-lg" data-testid="text-client-name-desktop">{invoice.clientName}</p>
                  <div className="flex flex-wrap gap-4 mt-3">
                    {invoice.clientEmail && (
                      <a
                        href={`mailto:${invoice.clientEmail}`}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-600 transition-colors"
                        data-testid="link-client-email-desktop"
                      >
                        <Mail className="h-4 w-4" />
                        {invoice.clientEmail}
                      </a>
                    )}
                    {invoice.clientPhone && (
                      <a
                        href={`tel:${invoice.clientPhone}`}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-600 transition-colors"
                        data-testid="link-client-phone-desktop"
                      >
                        <Phone className="h-4 w-4" />
                        {invoice.clientPhone}
                      </a>
                    )}
                    {invoice.clientPhone && (
                      <button
                        onClick={() => {
                          const token = invoice.publicToken || invoice.shareLink;
                          const payLink = token
                            ? `${window.location.origin}/invoice/${token}`
                            : null;
                          const linkText = payLink ? ` You can view and pay it here: ${payLink}` : "";
                          onSendText({
                            phoneNumber: invoice.clientPhone!,
                            message: `Hi ${invoice.clientName}, this is a reminder about invoice #${invoice.invoiceNumber} for ${formatCurrency(total)}.${linkText} Please let me know if you have any questions!`,
                          });
                          if (invoice.status !== "paid") {
                            onIncrementStall();
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald-600 transition-colors"
                        data-testid="button-text-client-desktop"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Send Text
                      </button>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Service Description</p>
                  <p className="text-sm text-foreground" data-testid="text-description-desktop">
                    {invoice.serviceDescription || "No description provided"}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="grid grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Created</p>
                    <p className="text-sm font-medium text-foreground" data-testid="text-created-date-desktop">
                      {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Invoice #</p>
                    <p className="text-sm font-medium text-foreground" data-testid="text-invoice-number-desktop">
                      {invoice.invoiceNumber}
                    </p>
                  </div>
                </div>
                {invoice.sentAt && (
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Send className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Sent</p>
                      <p className="text-sm font-medium text-foreground" data-testid="text-sent-date-desktop">
                        {formatDate(invoice.sentAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <PaymentConfirmation
            invoice={invoice}
            payments={payments}
            onPaymentConfirmed={onPaymentConfirmed}
          />
        </div>

        <div className="col-span-4 space-y-6">
          <Card className="rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="card-payment-summary-desktop">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 text-center border-b">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Amount</p>
                <p className="text-4xl font-semibold text-foreground tracking-tight" data-testid="text-total-desktop">
                  {formatCurrency(total)}
                </p>
                {(tax > 0 || discount > 0) && (
                  <div className="flex flex-col items-center gap-1 mt-3 text-sm text-muted-foreground">
                    <span>Subtotal: {formatCurrency(subtotal)}</span>
                    {tax > 0 && <span>Tax: +{formatCurrency(tax)}</span>}
                    {discount > 0 && (
                      <span className="text-emerald-600">Discount: -{formatCurrency(discount)}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 flex items-center justify-center">
                <Badge
                  className={`text-sm px-4 py-1.5 ${
                    invoice.status === "paid"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : invoice.status === "sent"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                  data-testid="badge-status-desktop"
                >
                  <StatusIcon className="h-4 w-4 mr-1.5" />
                  {config.label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {invoice.status === "paid" && invoice.paidAt && (
            <Card className="rounded-xl border-0 shadow-sm overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 text-white" data-testid="card-payment-status-desktop">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">Payment Received</p>
                    <p className="text-white/80 text-sm">
                      {formatDate(invoice.paidAt)}
                      {invoice.paymentMethod &&
                        ` via ${paymentMethodLabel(invoice.paymentMethod)}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRevert}
                  className="mt-3 w-full text-white/80 hover:text-white hover:bg-white/20"
                  data-testid="button-revert-paid-desktop"
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  Undo Payment
                </Button>
              </CardContent>
            </Card>
          )}

          {payments.length > 0 && (
            <Card className="rounded-xl border border-gray-200 shadow-sm" data-testid="card-payment-history-desktop">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-sm text-foreground">Completed Payments</h3>
                <div className="space-y-3">
                  {payments
                    .filter((p) => p.status !== "voided")
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        data-testid={`payment-record-${payment.id}`}
                      >
                        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {paymentMethodLabel(payment.method)}
                          </p>
                          {payment.paidAt && (
                            <p className="text-xs text-muted-foreground">
                              Paid {formatShortDate(payment.paidAt)}
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(payment.amount)}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-xl border border-gray-200 shadow-sm" data-testid="card-invoice-actions-desktop">
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold text-sm text-foreground mb-1">Actions</h3>

              {invoice.status === "draft" && (
                <Button
                  onClick={onSendClick}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 shadow-md"
                  aria-label="Send invoice to client"
                  data-testid="button-send-invoice-desktop"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
              )}

              {invoice.status === "sent" && (
                <>
                  <Button
                    onClick={onMarkPaid}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md"
                    aria-label="Mark invoice as paid"
                    data-testid="button-mark-paid-desktop"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onSendClick}
                    className="w-full"
                    aria-label="Resend invoice"
                    data-testid="button-resend-desktop"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Resend Invoice
                  </Button>
                </>
              )}

              {(invoice.publicToken || invoice.shareLink) && (
                <Button
                  variant="outline"
                  onClick={onCopyShareLink}
                  className="w-full"
                  aria-label="Copy shareable invoice link"
                  data-testid="button-copy-link-desktop"
                >
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied ? "Link Copied" : "Copy Share Link"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
