import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  Send,
  Loader2, 
  DollarSign,
  User,
  Building2,
  Phone,
  Mail,
  AlertCircle,
} from "lucide-react";

interface PaymentMethodInfo {
  label: string | null;
  instructions: string | null;
}

interface PublicInvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    serviceDescription: string;
    amount: number;
    tax: number | null;
    discount: number | null;
    status: string;
    createdAt: string;
    sentAt: string | null;
    paidAt: string | null;
  };
  provider: {
    name: string | null;
    businessName: string | null;
    phone: string | null;
    email: string | null;
  };
  paymentMethods: Record<string, PaymentMethodInfo>;
}

const statusConfig: Record<string, { 
  color: string; 
  icon: typeof Clock; 
  label: string;
  description: string;
}> = {
  draft: { 
    color: "bg-slate-100 text-slate-700", 
    icon: Clock, 
    label: "Draft",
    description: "Invoice not yet sent"
  },
  sent: { 
    color: "bg-amber-100 text-amber-700", 
    icon: Send, 
    label: "Awaiting Payment",
    description: "Please submit payment using one of the options below"
  },
  paid: { 
    color: "bg-green-100 text-green-700", 
    icon: CheckCircle, 
    label: "Paid",
    description: "Thank you for your payment!"
  },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function getPaymentMethodLabel(type: string): string {
  const labels: Record<string, string> = {
    zelle: "Zelle",
    venmo: "Venmo",
    cashapp: "Cash App",
    cash: "Cash",
    check: "Check",
    stripe: "Card Payment",
    other: "Other",
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const hasShownConfetti = useRef(false);

  const { data, isLoading, error } = useQuery<PublicInvoiceData>({
    queryKey: ["/api/public/invoice", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/invoice/${token}`);
      if (!res.ok) {
        throw new Error("Invoice not found");
      }
      return res.json();
    },
    enabled: !!token,
  });

  // Show subtle confetti when invoice is paid
  useEffect(() => {
    if (data?.invoice?.status === "paid" && !hasShownConfetti.current) {
      hasShownConfetti.current = true;
      // Subtle confetti burst from top
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.3 },
        colors: ['#22c55e', '#16a34a', '#15803d'],
        gravity: 1.2,
        scalar: 0.8,
      });
    }
  }, [data?.invoice?.status]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invoice Not Found</h2>
            <p className="text-muted-foreground">
              This invoice link may be invalid or expired. Please contact your service provider.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invoice, provider, paymentMethods } = data;
  const statusInfo = statusConfig[invoice.status] || statusConfig.draft;
  const StatusIcon = statusInfo.icon;

  const subtotal = invoice.amount;
  const tax = invoice.tax || 0;
  const discount = invoice.discount || 0;
  const total = subtotal + tax - discount;

  const hasPaymentMethods = Object.keys(paymentMethods).length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Invoice {invoice.invoiceNumber}
                </CardTitle>
                <CardDescription className="mt-1">
                  From {provider.businessName || provider.name || "Service Provider"}
                </CardDescription>
              </div>
              <Badge className={`${statusInfo.color} shrink-0`} data-testid="badge-invoice-status">
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Bill To</h4>
                <p className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {invoice.clientName}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Invoice Date</h4>
                <p className="text-sm">{formatDate(invoice.createdAt)}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Service</h4>
              <p className="text-sm" data-testid="text-service-description">{invoice.serviceDescription}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span data-testid="text-tax">{formatCurrency(tax)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span data-testid="text-discount">-{formatCurrency(discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span data-testid="text-total">{formatCurrency(total)}</span>
              </div>
            </div>

            {invoice.paidAt && (
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Paid on {formatDate(invoice.paidAt)}</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400 font-medium" data-testid="text-payment-complete">
                  Nice. That job is officially done.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {invoice.status !== "paid" && hasPaymentMethods && (
          <Card data-testid="card-payment-methods">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Options
              </CardTitle>
              <CardDescription>
                Use any of the following methods to submit your payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(paymentMethods).map(([type, info]) => (
                <div 
                  key={type} 
                  className="border rounded-lg p-4 bg-muted/30"
                  data-testid={`payment-method-${type}`}
                >
                  <h4 className="font-medium mb-1">
                    {getPaymentMethodLabel(type)}
                  </h4>
                  {info.label && (
                    <p className="text-sm text-muted-foreground">{info.label}</p>
                  )}
                  {info.instructions && (
                    <p className="text-sm text-muted-foreground mt-1">{info.instructions}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Contact Provider
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium">{provider.businessName || provider.name}</p>
            {provider.phone && (
              <a 
                href={`tel:${provider.phone}`} 
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Phone className="h-4 w-4" />
                {provider.phone}
              </a>
            )}
            {provider.email && (
              <a 
                href={`mailto:${provider.email}`} 
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                {provider.email}
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
