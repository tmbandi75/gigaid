import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Webhook,
  Shield,
  DollarSign,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface WebhookEvent {
  id: string;
  stripeEventId: string;
  type: string;
  status: string;
  attemptCount: number;
  error: string | null;
  receivedAt: string;
  processedAt: string | null;
  nextAttemptAt: string | null;
}

interface PaymentState {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: string;
  jobId: string | null;
  invoiceId: string | null;
  lastUpdatedAt: string;
}

interface Dispute {
  id: string;
  stripeDisputeId: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  evidenceDueBy: string | null;
  jobId: string | null;
  invoiceId: string | null;
  bookingId: string | null;
  createdAt: string;
}

interface Stats {
  webhooks: {
    received: number;
    failed: number;
    processed24h: number;
  };
  payments: {
    processing: number;
    succeeded24h: number;
  };
  disputes: {
    active: number;
    needsResponse: number;
    underReview: number;
  };
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
    processed: { variant: "default", icon: CheckCircle },
    succeeded: { variant: "default", icon: CheckCircle },
    won: { variant: "default", icon: CheckCircle },
    received: { variant: "secondary", icon: Clock },
    processing: { variant: "secondary", icon: Clock },
    under_review: { variant: "secondary", icon: Clock },
    needs_response: { variant: "destructive", icon: AlertTriangle },
    failed: { variant: "destructive", icon: XCircle },
    lost: { variant: "destructive", icon: XCircle },
    disputed: { variant: "destructive", icon: Shield },
  };

  const { variant, icon: Icon } = config[status] || { variant: "outline" as const, icon: Clock };

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function formatCurrency(amount: number, currency: string = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default function AdminStripeMonitoring() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<Stats>({
    queryKey: QUERY_KEYS.adminStripeStats(),
  });

  const { data: webhooksData, isLoading: webhooksLoading, refetch: refetchWebhooks } = useQuery<{ events: WebhookEvent[] }>({
    queryKey: QUERY_KEYS.adminStripeWebhooks(),
  });

  const { data: paymentsData, isLoading: paymentsLoading, refetch: refetchPayments } = useQuery<{ payments: PaymentState[] }>({
    queryKey: QUERY_KEYS.adminStripePayments(),
  });

  const { data: disputesData, isLoading: disputesLoading, refetch: refetchDisputes } = useQuery<{ disputes: Dispute[] }>({
    queryKey: QUERY_KEYS.adminStripeDisputes(),
  });

  const retryWebhookMutation = useApiMutation(
    async (eventId: string) => apiFetch(`/api/admin/stripe/webhooks/${eventId}/retry`, { method: "POST" }),
    [QUERY_KEYS.adminStripeWebhooks(), QUERY_KEYS.adminStripeStats()],
    {
      onSuccess: () => {
        toast({ title: "Webhook retry initiated" });
      },
      onError: (error: any) => {
        toast({ title: "Retry failed", description: error.message, variant: "destructive" });
      },
    }
  );

  const reconcileMutation = useApiMutation(
    async () => apiFetch("/api/admin/stripe/reconcile", { method: "POST" }),
    [QUERY_KEYS.adminStripePayments(), QUERY_KEYS.adminStripeStats()],
    {
      onSuccess: (data: any) => {
        toast({ 
          title: "Reconciliation complete", 
          description: `Checked: ${data.result?.checked || 0}, Fixed: ${data.result?.fixed || 0}` 
        });
      },
      onError: (error: any) => {
        toast({ title: "Reconciliation failed", description: error.message, variant: "destructive" });
      },
    }
  );

  const closeDisputeMutation = useApiMutation(
    async (disputeId: string) => apiFetch(`/api/admin/stripe/disputes/${disputeId}/close`, { method: "POST" }),
    [QUERY_KEYS.adminStripeDisputes(), QUERY_KEYS.adminStripeStats()],
    {
      onSuccess: () => {
        toast({ title: "Dispute closed (accepted loss)" });
      },
      onError: (error: any) => {
        toast({ title: "Failed to close dispute", description: error.message, variant: "destructive" });
      },
    }
  );

  const refreshAll = () => {
    refetchStats();
    refetchWebhooks();
    refetchPayments();
    refetchDisputes();
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="admin-stripe-monitoring">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stripe Monitoring</h1>
          <p className="text-muted-foreground">Webhooks, payments, and disputes</p>
        </div>
        <Button onClick={refreshAll} variant="outline" size="sm" data-testid="button-refresh-all">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Pending Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.webhooks.received || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Failed Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.webhooks.failed || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payments (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.payments.succeeded24h || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.payments.processing || 0} processing</p>
          </CardContent>
        </Card>

        <Card className={cn(stats?.disputes?.active && stats.disputes.active > 0 && "border-destructive")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Active Disputes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.disputes?.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.disputes?.needsResponse || 0} need response
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks" data-testid="tab-webhooks">
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">
            Payments
          </TabsTrigger>
          <TabsTrigger value="disputes" data-testid="tab-disputes">
            Disputes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Events</CardTitle>
              <CardDescription>Recent Stripe webhook events and their processing status</CardDescription>
            </CardHeader>
            <CardContent>
              {webhooksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !webhooksData?.events?.length ? (
                <p className="text-center text-muted-foreground py-8">No webhook events found</p>
              ) : (
                <div className="space-y-2">
                  {webhooksData.events.slice(0, 20).map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`webhook-event-${event.stripeEventId}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{event.type}</code>
                          <StatusBadge status={event.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {event.stripeEventId} | {format(new Date(event.receivedAt), "MMM d, HH:mm:ss")}
                          {event.attemptCount > 0 && ` | ${event.attemptCount} attempts`}
                        </div>
                        {event.error && (
                          <p className="text-xs text-destructive truncate max-w-md">{event.error}</p>
                        )}
                      </div>
                      {(event.status === "failed" || event.status === "received") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryWebhookMutation.mutate(event.stripeEventId)}
                          disabled={retryWebhookMutation.isPending}
                          data-testid={`button-retry-${event.stripeEventId}`}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payment States</CardTitle>
                <CardDescription>Tracked payment intents and their current status</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => reconcileMutation.mutate()}
                disabled={reconcileMutation.isPending}
                data-testid="button-reconcile"
              >
                {reconcileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Reconcile Stuck Payments
              </Button>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !paymentsData?.payments?.length ? (
                <p className="text-center text-muted-foreground py-8">No payment records found</p>
              ) : (
                <div className="space-y-2">
                  {paymentsData.payments.slice(0, 20).map((payment) => (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`payment-${payment.paymentIntentId}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(payment.amount, payment.currency)}</span>
                          <StatusBadge status={payment.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {payment.paymentIntentId}
                          {payment.jobId && ` | Job: ${payment.jobId.slice(0, 8)}...`}
                          {payment.invoiceId && ` | Invoice: ${payment.invoiceId.slice(0, 8)}...`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated: {format(new Date(payment.lastUpdatedAt), "MMM d, HH:mm")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Disputes & Chargebacks</CardTitle>
              <CardDescription>Active and resolved payment disputes</CardDescription>
            </CardHeader>
            <CardContent>
              {disputesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !disputesData?.disputes?.length ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No disputes found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disputesData.disputes.map((dispute) => (
                    <div 
                      key={dispute.id} 
                      className={cn(
                        "p-4 border rounded-lg",
                        dispute.status === "needs_response" && "border-destructive bg-destructive/5"
                      )}
                      data-testid={`dispute-${dispute.stripeDisputeId}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(dispute.amount, dispute.currency)}</span>
                            <StatusBadge status={dispute.status} />
                            <Badge variant="outline">{dispute.reason?.replace(/_/g, " ") || "Unknown"}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {dispute.stripeDisputeId}
                            {dispute.jobId && ` | Job: ${dispute.jobId.slice(0, 8)}...`}
                            {dispute.invoiceId && ` | Invoice: ${dispute.invoiceId.slice(0, 8)}...`}
                            {dispute.bookingId && ` | Booking: ${dispute.bookingId.slice(0, 8)}...`}
                          </div>
                          {dispute.evidenceDueBy && (
                            <div className="text-xs">
                              <span className="text-destructive font-medium">
                                Evidence due: {format(new Date(dispute.evidenceDueBy), "MMM d, yyyy HH:mm")}
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Created: {format(new Date(dispute.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`https://dashboard.stripe.com/disputes/${dispute.stripeDisputeId}`, "_blank")}
                            data-testid={`button-view-dispute-${dispute.stripeDisputeId}`}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View in Stripe
                          </Button>
                          {(dispute.status === "needs_response" || dispute.status === "warning_needs_response") && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => closeDisputeMutation.mutate(dispute.stripeDisputeId)}
                              disabled={closeDisputeMutation.isPending}
                              data-testid={`button-close-dispute-${dispute.stripeDisputeId}`}
                            >
                              Accept Loss
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
