import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, DollarSign, Clock, User, Shield, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import type { ParsedJobFields } from "@shared/schema";

interface DraftPublicData {
  id: string;
  status: string;
  fields: ParsedJobFields;
  depositAmountCents?: number;
  paymentType: "deposit" | "full" | "after";
  providerName?: string;
  expiresAt: string;
}

export default function QuickBookConfirm() {
  const [, params] = useRoute("/qb/:token");
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);

  const { data: draft, isLoading, error } = useQuery<DraftPublicData>({
    queryKey: ["/api/public/quickbook", params?.token],
    queryFn: async () => {
      const res = await fetch(`/api/public/quickbook/${params?.token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Booking not found");
      }
      return res.json();
    },
    enabled: !!params?.token,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/quickbook/${params?.token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to confirm booking");
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmed(true);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const formatPrice = (cents?: number) => {
    if (!cents) return "N/A";
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatDateTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return "To be scheduled";
    try {
      const dt = new Date(dateTimeStr);
      return dt.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateTimeStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-muted-foreground">
              This booking link may have expired or is no longer valid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (draft.status === "booked" || confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">You're All Set!</h2>
            <p className="text-muted-foreground mb-6">
              Your booking has been confirmed. You'll receive a reminder before your appointment.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span>{formatDateTime(draft.fields.dateTimeStart)}</span>
              </div>
              {draft.fields.locationText && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <span>{draft.fields.locationText}</span>
                </div>
              )}
              {draft.fields.priceAmount && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span>{formatPrice(draft.fields.priceAmount)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Confirm Your Booking</h1>
          {draft.providerName && (
            <p className="text-muted-foreground">
              with {draft.providerName}
            </p>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Appointment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.fields.service && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium capitalize">{draft.fields.service}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">When</p>
                <p className="font-medium">{formatDateTime(draft.fields.dateTimeStart)}</p>
              </div>
            </div>

            {draft.fields.locationText && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Where</p>
                  <p className="font-medium">{draft.fields.locationText}</p>
                </div>
              </div>
            )}

            {draft.fields.priceAmount && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Price</p>
                  <p className="font-medium">{formatPrice(draft.fields.priceAmount)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {draft.paymentType !== "after" && draft.depositAmountCents && (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
                <DollarSign className="h-5 w-5" />
                <div>
                  <p className="font-medium">
                    {draft.paymentType === "full" ? "Pay" : "Deposit"}: {formatPrice(draft.depositAmountCents)}
                  </p>
                  {draft.paymentType === "deposit" && draft.fields.priceAmount && (
                    <p className="text-sm text-green-600 dark:text-green-500">
                      Remaining {formatPrice(draft.fields.priceAmount - draft.depositAmountCents)} after service
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30" data-testid="trust-copy-block">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <p className="font-medium text-sm">Your payment is protected</p>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>You're only charged what's shown above</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Payments are processed securely</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Funds are released after the job is completed</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>You'll receive reminders before your appointment</span>
              </li>
            </ul>
            {draft.paymentType === "deposit" && draft.depositAmountCents && (
              <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
                This deposit secures your appointment. The remaining balance is paid after the work is done.
              </p>
            )}
            <p className="text-xs text-muted-foreground/70 pt-1">
              Secure payments powered by Stripe
            </p>
          </CardContent>
        </Card>

        <Button
          onClick={() => confirmMutation.mutate()}
          className="w-full"
          size="lg"
          disabled={confirmMutation.isPending}
          data-testid="button-confirm-booking"
        >
          {confirmMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Confirming...
            </>
          ) : (
            <>
              Confirm Booking
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By confirming, you agree to the service terms and cancellation policy.
        </p>
      </div>
    </div>
  );
}
