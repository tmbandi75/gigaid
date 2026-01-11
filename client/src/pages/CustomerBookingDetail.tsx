import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { 
  Shield, 
  Clock, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  CreditCard,
  RefreshCw,
  Info,
  MapPin,
  Lock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface BookingDetail {
  id: number;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  serviceType: string;
  description: string | null;
  location: string | null;
  preferredDate: string;
  preferredTime: string;
  status: string;
  depositAmountCents: number | null;
  depositCurrency: string | null;
  depositStatus: string | null;
  completionStatus: string | null;
  autoReleaseAt: string | null;
  lateRescheduleCount: number | null;
  retainedAmountCents: number | null;
  rolledAmountCents: number | null;
  stripePaymentIntentId: string | null;
  provider: {
    name: string;
    businessName: string | null;
    photo: string | null;
    depositEnabled: boolean;
    lateRescheduleWindowHours: number;
    lateRescheduleRetainPctFirst: number;
    lateRescheduleRetainPctSecond: number;
    lateRescheduleRetainPctCap: number;
  };
}

interface DepositIntentResponse {
  clientSecret: string;
  depositAmountCents: number;
  depositCurrency: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

interface PaymentFormProps {
  token: string;
  bookingId: number;
  depositAmountCents: number;
  depositCurrency: string;
  onSuccess: () => void;
}

function PaymentForm({ token, bookingId, depositAmountCents, depositCurrency, onSuccess }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const formatCurrency = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setPaymentError(error.message || "Payment failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      try {
        const confirmRes = await fetch(`/api/bookings/${bookingId}/confirm-deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!confirmRes.ok) {
          console.error("Failed to confirm deposit on backend");
        }
      } catch (err) {
        console.error("Error confirming deposit:", err);
      }

      toast({ 
        title: "Payment successful!", 
        description: "Your deposit has been received." 
      });
      onSuccess();
    } else if (paymentIntent && paymentIntent.status === "requires_action") {
      setPaymentError("Additional authentication required. Please follow the prompts.");
      setIsProcessing(false);
    } else {
      toast({ 
        title: "Payment successful!", 
        description: "Your deposit has been received." 
      });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement 
        options={{
          layout: "tabs",
        }}
      />
      
      {paymentError && (
        <div className="text-sm text-destructive flex items-center gap-2" data-testid="text-payment-error">
          <AlertCircle className="h-4 w-4" />
          {paymentError}
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || isProcessing}
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Pay {formatCurrency(depositAmountCents, depositCurrency)} Deposit
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3 w-3" />
        <span>Secured by Stripe</span>
      </div>
    </form>
  );
}

interface DepositPaymentSectionProps {
  token: string;
  booking: BookingDetail;
  onPaymentSuccess: () => void;
}

function DepositPaymentSection({ token, booking, onPaymentSuccess }: DepositPaymentSectionProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    
    async function initializePayment() {
      try {
        setIsLoading(true);
        setError(null);

        const keyRes = await fetch("/api/stripe/publishable-key");
        if (!keyRes.ok) throw new Error("Failed to load payment system");
        const { publishableKey } = await keyRes.json();
        setStripePromise(loadStripe(publishableKey));

        const intentRes = await fetch(`/api/bookings/by-token/${token}/create-deposit-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        
        if (!intentRes.ok) {
          const data = await intentRes.json();
          throw new Error(data.error || "Failed to initialize payment");
        }
        
        const intentData: DepositIntentResponse = await intentRes.json();
        setClientSecret(intentData.clientSecret);
        setInitialized(true);
      } catch (err: any) {
        setError(err.message || "Failed to load payment form");
      } finally {
        setIsLoading(false);
      }
    }

    initializePayment();
  }, [token, initialized]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading payment form...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!stripePromise || !clientSecret) {
    return null;
  }

  return (
    <Elements 
      stripe={stripePromise} 
      options={{ 
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#1565C0",
          },
        },
      }}
    >
      <PaymentForm
        token={token}
        bookingId={booking.id}
        depositAmountCents={booking.depositAmountCents || 0}
        depositCurrency={booking.depositCurrency || "usd"}
        onSuccess={onPaymentSuccess}
      />
    </Elements>
  );
}

export default function CustomerBookingDetail() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");

  const { data: booking, isLoading, error } = useQuery<BookingDetail>({
    queryKey: ["/api/bookings/by-token", token, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/by-token/${token}/detail`);
      if (!res.ok) throw new Error("Booking not found");
      return res.json();
    },
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bookings/by-token/${token}/confirm-completion`),
    onSuccess: () => {
      toast({ title: "Job confirmed complete!", description: "The deposit has been released to the provider." });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/by-token", token] });
    },
    onError: () => {
      toast({ title: "Failed to confirm completion", variant: "destructive" });
    },
  });

  const flagIssueMutation = useMutation({
    mutationFn: (reason: string) => 
      apiRequest("POST", `/api/bookings/by-token/${token}/flag-issue`, { reason }),
    onSuccess: () => {
      toast({ title: "Issue reported", description: "The deposit is on hold. We'll review your case." });
      setShowIssueDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/by-token", token] });
    },
    onError: () => {
      toast({ title: "Failed to report issue", variant: "destructive" });
    },
  });

  const formatCurrency = (cents: number | null | undefined, currency: string = "usd") => {
    if (cents == null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "captured":
        return <Badge variant="default" data-testid="badge-deposit-held">Deposit Held</Badge>;
      case "released":
        return <Badge variant="secondary" data-testid="badge-deposit-released">Deposit Released</Badge>;
      case "on_hold_dispute":
        return <Badge variant="destructive" data-testid="badge-deposit-dispute">Under Review</Badge>;
      case "pending":
        return <Badge variant="outline" data-testid="badge-deposit-pending">Payment Pending</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-deposit-none">No Deposit</Badge>;
    }
  };

  const getCompletionStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-status-completed">Completed</Badge>;
      case "awaiting_confirmation":
        return <Badge variant="secondary" data-testid="badge-status-awaiting">Awaiting Confirmation</Badge>;
      case "dispute":
        return <Badge variant="destructive" data-testid="badge-status-dispute">Dispute</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status-scheduled">Scheduled</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-muted-foreground">
              This booking link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showCompletionPrompt = booking.completionStatus === "awaiting_confirmation" && 
    booking.depositStatus === "captured";

  const autoReleaseDate = booking.autoReleaseAt ? new Date(booking.autoReleaseAt) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold" data-testid="text-booking-title">Your Booking</h1>
          <p className="text-muted-foreground">
            with {booking.provider?.businessName || booking.provider?.name || "Your Provider"}
          </p>
        </div>

        {/* Booking Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{booking.serviceType}</CardTitle>
              {getCompletionStatusBadge(booking.completionStatus)}
            </div>
            <CardDescription>{booking.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-booking-date">{formatDate(booking.preferredDate)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-booking-time">{formatTime(booking.preferredTime)}</span>
            </div>
            {booking.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-booking-location">{booking.location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deposit Information Card */}
        {booking.depositAmountCents && booking.depositAmountCents > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Deposit
                </CardTitle>
                {getStatusBadge(booking.depositStatus)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-xl font-semibold" data-testid="text-deposit-amount">
                  {formatCurrency(booking.depositAmountCents, booking.depositCurrency || "usd")}
                </span>
              </div>

              {/* Retained amount from reschedules */}
              {booking.retainedAmountCents && booking.retainedAmountCents > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Retained (late reschedule fee)</span>
                  <span className="text-orange-600" data-testid="text-retained-amount">
                    -{formatCurrency(booking.retainedAmountCents, booking.depositCurrency || "usd")}
                  </span>
                </div>
              )}

              {/* Rolled forward amount */}
              {booking.rolledAmountCents && booking.rolledAmountCents > 0 && 
               booking.rolledAmountCents !== booking.depositAmountCents && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Applied to booking</span>
                  <span className="text-green-600" data-testid="text-rolled-amount">
                    {formatCurrency(booking.rolledAmountCents, booking.depositCurrency || "usd")}
                  </span>
                </div>
              )}

              <Separator />

              {/* Payment Form - show when deposit needs to be paid */}
              {(booking.depositStatus === "none" || booking.depositStatus === "pending" || !booking.depositStatus) && 
               booking.provider?.depositEnabled && (
                <div className="space-y-4" data-testid="section-deposit-payment">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="h-4 w-4" />
                    <span>Pay Your Deposit</span>
                  </div>
                  <DepositPaymentSection
                    token={token!}
                    booking={booking}
                    onPaymentSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/bookings/by-token", token] });
                    }}
                  />
                  <Separator />
                </div>
              )}

              {/* Deposit Safety Message */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Your deposit is protected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your deposit is held securely by GigAid until the job is completed. 
                      It will only be released to the provider after you confirm the work 
                      is done, or automatically 36 hours after the scheduled end time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Reschedule Policy */}
              {booking.provider && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Reschedule Policy</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        If you need to reschedule within {booking.provider.lateRescheduleWindowHours ?? 24} hours 
                        of your appointment, a portion of your deposit may be retained as a late 
                        reschedule fee:
                      </p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                        <li>1st late reschedule: {booking.provider.lateRescheduleRetainPctFirst ?? 40}% retained</li>
                        <li>2nd late reschedule: {booking.provider.lateRescheduleRetainPctSecond ?? 60}% retained</li>
                        <li>Maximum retention: {booking.provider.lateRescheduleRetainPctCap ?? 75}%</li>
                      </ul>
                      <p className="text-sm text-muted-foreground mt-2">
                        The remaining deposit will be applied to your new appointment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Late reschedule count indicator */}
              {booking.lateRescheduleCount && booking.lateRescheduleCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <Info className="h-4 w-4" />
                  <span data-testid="text-reschedule-count">
                    This booking has been rescheduled {booking.lateRescheduleCount} time(s) within the late window.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Completion Confirmation Prompt */}
        {showCompletionPrompt && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Was the job completed?
              </CardTitle>
              <CardDescription>
                Please confirm if the service was completed satisfactorily.
                {autoReleaseDate && (
                  <span className="block mt-1">
                    If no response, deposit will auto-release on {autoReleaseDate.toLocaleDateString()}.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1"
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  data-testid="button-confirm-complete"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Yes, Job Completed
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowIssueDialog(true)}
                  disabled={flagIssueMutation.isPending}
                  data-testid="button-report-issue"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  There's an Issue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Messages */}
        {booking.completionStatus === "completed" && booking.depositStatus === "released" && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <div>
                  <p className="font-medium">Job completed</p>
                  <p className="text-sm text-muted-foreground">
                    The deposit has been released to the provider. Thank you!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {booking.depositStatus === "on_hold_dispute" && (
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-orange-600">
                <AlertCircle className="h-6 w-6" />
                <div>
                  <p className="font-medium">Issue under review</p>
                  <p className="text-sm text-muted-foreground">
                    Your deposit is on hold while we review the reported issue. 
                    We'll be in touch soon.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Questions? Contact your service provider directly.</p>
        </div>
      </div>

      {/* Issue Dialog */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Please describe the issue with this job. Your deposit will be held 
              while we review your case.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe what went wrong..."
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            rows={4}
            data-testid="input-issue-description"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssueDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => flagIssueMutation.mutate(issueDescription)}
              disabled={!issueDescription.trim() || flagIssueMutation.isPending}
              data-testid="button-submit-issue"
            >
              {flagIssueMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
