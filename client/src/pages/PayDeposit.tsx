import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  DollarSign,
  Shield,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Smartphone,
  Banknote,
} from "lucide-react";

interface DepositData {
  job: {
    id: string;
    title: string;
    serviceType: string;
    scheduledDate: string;
    scheduledTime: string;
    location?: string;
    price: number;
    clientName?: string;
  };
  depositRequestedCents: number;
  depositPaidCents: number;
  depositOutstandingCents: number;
  isDepositFullyPaid: boolean;
  provider: {
    name?: string;
    businessName?: string;
    phone?: string;
    email?: string;
  };
}

const paymentMethods = [
  { id: "zelle", label: "Zelle", icon: Smartphone },
  { id: "venmo", label: "Venmo", icon: Smartphone },
  { id: "cashapp", label: "Cash App", icon: Smartphone },
  { id: "stripe", label: "Card", icon: CreditCard },
  { id: "cash", label: "Cash", icon: Banknote },
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default function PayDeposit() {
  const { token } = useParams<{ token: string }>();
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [proofUrl, setProofUrl] = useState("");
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<DepositData>({
    queryKey: ["/api/public/deposit", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/deposit/${token}`);
      if (!res.ok) {
        throw new Error("Deposit information not found");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/deposit/${token}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: selectedMethod,
          proofUrl: proofUrl || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to record payment");
      }
      return res.json();
    },
    onSuccess: () => {
      setPaymentSubmitted(true);
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" data-testid="loader" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2" data-testid="text-error-title">Not Found</h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
              This deposit link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const providerName = data.provider.businessName || data.provider.name || "Your Service Provider";
  const isFullyPaid = data.isDepositFullyPaid || paymentSubmitted;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4" data-testid="page-pay-deposit">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center mb-2">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                <Shield className="h-7 w-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl" data-testid="text-title">Secure Your Appointment</CardTitle>
            <CardDescription>
              {providerName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Deposit Amount</p>
              <p className="text-3xl font-bold text-teal-600 dark:text-teal-400" data-testid="text-deposit-amount">
                {formatCurrency(data.depositRequestedCents)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of {formatCurrency(data.job.price)} total
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{formatDate(data.job.scheduledDate)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(data.job.scheduledTime)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{data.job.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{data.job.serviceType}</p>
                </div>
              </div>

              {data.job.location && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm">{data.job.location}</p>
                </div>
              )}
            </div>

            {isFullyPaid ? (
              <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl" data-testid="section-payment-success">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
                <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                  Deposit Received
                </h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">
                  Your appointment is secured. We look forward to serving you!
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm" data-testid="section-trust-message">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">Why a deposit?</h4>
                  <p className="text-blue-600 dark:text-blue-500">
                    A small deposit helps us hold your spot and ensures we can provide 
                    you with dedicated, quality service. Your deposit will be applied 
                    to your final bill.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Choose payment method</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {paymentMethods.slice(0, 3).map((method) => (
                      <Button
                        key={method.id}
                        type="button"
                        variant={selectedMethod === method.id ? "default" : "outline"}
                        className="h-auto py-3 flex-col"
                        onClick={() => setSelectedMethod(method.id)}
                        data-testid={`button-method-${method.id}`}
                      >
                        <method.icon className="h-5 w-5 mb-1" />
                        <span className="text-xs">{method.label}</span>
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.slice(3).map((method) => (
                      <Button
                        key={method.id}
                        type="button"
                        variant={selectedMethod === method.id ? "default" : "outline"}
                        className="h-auto py-3 flex-col"
                        onClick={() => setSelectedMethod(method.id)}
                        data-testid={`button-method-${method.id}`}
                      >
                        <method.icon className="h-5 w-5 mb-1" />
                        <span className="text-xs">{method.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedMethod && selectedMethod !== "cash" && selectedMethod !== "stripe" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Payment confirmation (optional)</Label>
                    <Input
                      type="text"
                      placeholder="Paste screenshot link or confirmation #"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      data-testid="input-proof"
                    />
                    <p className="text-xs text-muted-foreground">
                      Share a screenshot or confirmation number of your payment
                    </p>
                  </div>
                )}

                <Button
                  className="w-full h-12 bg-gradient-to-r from-teal-500 to-emerald-500"
                  onClick={() => recordPaymentMutation.mutate()}
                  disabled={!selectedMethod || recordPaymentMutation.isPending}
                  data-testid="button-confirm-payment"
                >
                  {recordPaymentMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      Confirm Payment Sent
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By confirming, you acknowledge you&apos;ve sent {formatCurrency(data.depositRequestedCents)} to secure your appointment.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {data.provider.phone && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Questions? Contact your service provider:
              </p>
              <div className="flex justify-center gap-4">
                {data.provider.phone && (
                  <Button variant="outline" size="sm" asChild data-testid="button-call-provider">
                    <a href={`tel:${data.provider.phone}`}>
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </a>
                  </Button>
                )}
                {data.provider.email && (
                  <Button variant="outline" size="sm" asChild data-testid="button-email-provider">
                    <a href={`mailto:${data.provider.email}`}>
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
