import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import {
  Crown,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Calendar,
  CreditCard,
  RefreshCcw,
  Pause,
  XCircle,
  RotateCcw,
  Download,
  FileText,
  Receipt,
  ArrowUp,
  ArrowDown,
  Check,
  Zap,
  Shield,
  Users,
  ChevronRight,
  CircleDot,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { emitChurnEvent } from "@/lib/churnEvents";

interface SubscriptionStatus {
  plan: string;
  planName: string;
  status: string;
  hasSubscription: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
}

interface AccountStatus {
  accountStatus: string;
  suspendedAt: string | null;
  scheduledDeletionAt: string | null;
}

interface StripeInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amount: number;
  currency: string;
  created: number;
  periodStart: number;
  periodEnd: number;
  pdfUrl: string | null;
  hostedUrl: string | null;
  description: string;
}

const PLAN_PRICES: Record<string, number> = {
  pro: 19,
  pro_plus: 28,
  business: 49,
};

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    icon: Zap,
    tagline: "Get started",
    features: ["Basic invoicing", "Up to 5 jobs", "Manual follow-ups"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    icon: Crown,
    tagline: "Grow faster",
    features: ["Unlimited jobs", "Auto follow-ups", "Two-way SMS", "Job templates"],
  },
  {
    id: "pro_plus",
    name: "Pro+",
    price: 28,
    icon: Shield,
    tagline: "Get paid reliably",
    popular: true,
    features: ["Everything in Pro", "Deposit enforcement", "Booking protection", "Today's Money Plan"],
  },
  {
    id: "business",
    name: "Business",
    price: 49,
    icon: Users,
    tagline: "Scale your team",
    features: ["Everything in Pro+", "Crew management", "Business analytics", "Admin controls"],
  },
] as const;

const PLAN_ORDER = ["free", "pro", "pro_plus", "business"];

export function SubscriptionSettings() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  useEffect(() => {
    if (showCancelDialog) {
      emitChurnEvent("cancel_hover");
    }
  }, [showCancelDialog]);
  const [showCloseAccountDialog, setShowCloseAccountDialog] = useState(false);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data: subscription, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: QUERY_KEYS.subscriptionStatus(),
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const { data: profile } = useQuery<{ accountStatus?: string; suspendedAt?: string; scheduledDeletionAt?: string }>({
    queryKey: QUERY_KEYS.profile(),
  });

  const { data: invoiceData, isLoading: invoicesLoading } = useQuery<{ invoices: StripeInvoice[] }>({
    queryKey: QUERY_KEYS.billingInvoices(),
    enabled: true,
  });

  const effectiveSubscription: SubscriptionStatus = subscription || {
    plan: "free",
    planName: "Free",
    status: "active",
    hasSubscription: false,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
  };

  const cancelMutation = useApiMutation(
    () => apiFetch<any>("/api/subscription/cancel", { method: "POST" }),
    [QUERY_KEYS.subscriptionStatus()],
    {
      onSuccess: (data: any) => {
        toast({
          title: "Subscription cancelled",
          description: data?.message || "Your subscription will end at the current billing period",
        });
        setShowCancelDialog(false);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to cancel subscription. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const reactivateMutation = useApiMutation(
    () => apiFetch("/api/subscription/reactivate", { method: "POST" }),
    [QUERY_KEYS.subscriptionStatus()],
    {
      onSuccess: () => {
        toast({
          title: "Subscription reactivated",
          description: "Your subscription has been reactivated",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to reactivate subscription. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const portalMutation = useApiMutation(
    () => apiFetch<any>("/api/subscription/portal", { method: "POST", body: JSON.stringify({ returnUrl: "/settings" }) }),
    [],
    {
      onSuccess: (data: any) => {
        if (data?.url) {
          window.location.href = data.url;
        }
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to open billing portal. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const suspendMutation = useApiMutation(
    () => apiFetch("/api/billing/suspend", { method: "POST" }),
    [QUERY_KEYS.subscriptionStatus(), QUERY_KEYS.profile(), QUERY_KEYS.authUser()],
    {
      onSuccess: () => {
        toast({
          title: "Subscription paused",
          description: "Your subscription has been paused. You can reactivate anytime.",
        });
        setShowPauseDialog(false);
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to pause subscription. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const reactivateAccountMutation = useApiMutation(
    () => apiFetch("/api/billing/reactivate", { method: "POST" }),
    [QUERY_KEYS.subscriptionStatus(), QUERY_KEYS.profile(), QUERY_KEYS.authUser()],
    {
      onSuccess: () => {
        toast({
          title: "Account reactivated",
          description: "Your account is active again. Visit pricing to subscribe.",
        });
        navigate("/pricing");
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to reactivate account. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const closeAccountMutation = useApiMutation(
    () => apiFetch("/api/account/cancel", { method: "POST" }),
    [QUERY_KEYS.subscriptionStatus(), QUERY_KEYS.profile(), QUERY_KEYS.authUser()],
    {
      onSuccess: () => {
        toast({
          title: "Account scheduled for deletion",
          description: "Your account will be deleted in 30 days. You can undo this before then.",
        });
        setShowCloseAccountDialog(false);
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to close account. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const undoCancelMutation = useApiMutation(
    () => apiFetch("/api/account/undo-cancel", { method: "POST" }),
    [QUERY_KEYS.subscriptionStatus(), QUERY_KEYS.profile(), QUERY_KEYS.authUser()],
    {
      onSuccess: () => {
        toast({
          title: "Account restored",
          description: "Your account has been restored. Welcome back!",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to restore account. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const changePlanMutation = useApiMutation(
    (planToChange: string) =>
      apiFetch<any>("/api/subscription/change-plan", {
        method: "POST",
        body: JSON.stringify({ newPlan: planToChange }),
      }),
    [QUERY_KEYS.subscriptionStatus(), QUERY_KEYS.profile(), QUERY_KEYS.authUser()],
    {
      onSuccess: (data: any) => {
        if (data?.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        toast({
          title: "Plan changed",
          description: data?.message || "Your plan has been updated",
        });
        setShowChangePlanDialog(false);
        setSelectedPlan(null);
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to change plan. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="card-subscription-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isFree = effectiveSubscription.plan === "free" && !effectiveSubscription.hasSubscription;
  const price = PLAN_PRICES[effectiveSubscription.plan] || 0;
  const currentIdx = PLAN_ORDER.indexOf(effectiveSubscription.plan);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const currentPlanData = PLANS.find(p => p.id === effectiveSubscription.plan) || PLANS[0];
  const CurrentPlanIcon = currentPlanData.icon;

  return (
    <div className="space-y-4" data-testid="card-subscription-settings">
      {/* Current Plan Hero */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CurrentPlanIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold" data-testid="text-current-plan">
                  {effectiveSubscription.planName}
                </span>
                {!isFree && (
                  <span className="text-sm text-muted-foreground" data-testid="badge-plan-price">
                    ${price}/month
                  </span>
                )}
              </div>
            </div>
            {effectiveSubscription.cancelAtPeriodEnd && (
              <Badge variant="outline" className="ml-auto text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 shrink-0" data-testid="badge-cancelling">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Cancelling
              </Badge>
            )}
          </div>

          {effectiveSubscription.hasSubscription && effectiveSubscription.currentPeriodEnd && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 px-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {effectiveSubscription.cancelAtPeriodEnd ? (
                <span data-testid="text-cancel-date">
                  Access ends {formatDate(effectiveSubscription.currentPeriodEnd)}
                </span>
              ) : (
                <span data-testid="text-next-billing">
                  Next billing: {formatDate(effectiveSubscription.currentPeriodEnd)}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isFree ? (
              <Button
                onClick={() => window.location.href = "/pricing"}
                className="w-full"
                data-testid="button-view-plans"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Your Plan
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  className="w-full"
                  data-testid="button-manage-billing"
                >
                  {portalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Manage Billing
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>

                {effectiveSubscription.cancelAtPeriodEnd && (
                  <Button
                    variant="default"
                    onClick={() => reactivateMutation.mutate()}
                    disabled={reactivateMutation.isPending}
                    className="w-full"
                    data-testid="button-reactivate"
                  >
                    {reactivateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCcw className="h-4 w-4 mr-2" />
                    )}
                    Reactivate Subscription
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Plan */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">Change Plan</h3>
          <div className="space-y-2">
            {PLANS.map((plan) => {
              const isCurrent = effectiveSubscription.plan === plan.id;
              const planIdx = PLAN_ORDER.indexOf(plan.id);
              const isUpgrade = planIdx > currentIdx;
              const isDowngrade = planIdx < currentIdx;
              const PlanIcon = plan.icon;

              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid={`plan-card-${plan.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isCurrent ? "bg-primary/15" : "bg-muted"
                    }`}>
                      <PlanIcon className={`h-4 w-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{plan.name}</span>
                        {plan.price > 0 ? (
                          <span className="text-xs text-muted-foreground font-medium">${plan.price}/mo</span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">Free</span>
                        )}
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-0.5" />
                            Current
                          </Badge>
                        )}
                        {"popular" in plan && plan.popular && !isCurrent && (
                          <Badge variant="default" className="text-xs">
                            Popular
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>

                      <ul className="mt-2 space-y-1">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <CircleDot className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {!isCurrent && (
                        <Button
                          variant={isUpgrade ? "default" : "outline"}
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => {
                            if (isDowngrade) {
                              setSelectedPlan(plan.id);
                              setShowChangePlanDialog(true);
                            } else {
                              setSelectedPlan(plan.id);
                              changePlanMutation.mutate(plan.id);
                            }
                          }}
                          disabled={changePlanMutation.isPending}
                          data-testid={`button-${isUpgrade ? "upgrade" : "downgrade"}-${plan.id}`}
                        >
                          {changePlanMutation.isPending && selectedPlan === plan.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : isUpgrade ? (
                            <ArrowUp className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowDown className="h-3 w-3 mr-1" />
                          )}
                          {isUpgrade ? "Upgrade" : "Downgrade"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Change Plan Confirmation Dialog */}
      <AlertDialog open={showChangePlanDialog} onOpenChange={setShowChangePlanDialog}>
        <AlertDialogContent data-testid="dialog-change-plan">
          <AlertDialogHeader>
            <AlertDialogTitle>Downgrade your plan?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  You're switching from <strong>{effectiveSubscription.planName}</strong> to{" "}
                  <strong>
                    {selectedPlan === "free"
                      ? "Free"
                      : selectedPlan === "pro"
                      ? "Pro"
                      : selectedPlan === "pro_plus"
                      ? "Pro+"
                      : "Business"}
                  </strong>.
                </p>
                {selectedPlan === "free" ? (
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your subscription will be cancelled at the end of the billing period</li>
                    <li>You'll keep current features until then</li>
                    <li>After that, limits from the Free plan will apply</li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your plan changes immediately, but the new lower rate starts next billing cycle</li>
                    <li>No extra charges or credits for the current period</li>
                    <li>Some features from your current plan may become limited</li>
                  </ul>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSelectedPlan(null)}
              data-testid="button-cancel-change-plan"
            >
              Keep Current Plan
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPlan && changePlanMutation.mutate(selectedPlan)}
              disabled={changePlanMutation.isPending || !selectedPlan}
              data-testid="button-confirm-change-plan"
            >
              {changePlanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice History */}
      <Card data-testid="card-invoice-history">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Invoice History
          </h3>

          {invoicesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !invoiceData?.invoices || invoiceData.invoices.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No invoices yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your billing history will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {invoiceData.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover-elevate"
                  data-testid={`invoice-row-${invoice.id}`}
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {invoice.number || `#${invoice.id.slice(-8)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.created * 1000).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        ${(invoice.amount / 100).toFixed(2)}
                      </p>
                      <Badge
                        variant={invoice.status === "paid" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {invoice.status === "paid" ? "Paid" : invoice.status}
                      </Badge>
                    </div>
                    <div className="flex gap-0.5">
                      {invoice.hostedUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(invoice.hostedUrl!, "_blank")}
                          title="View invoice"
                          data-testid={`button-view-invoice-${invoice.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {invoice.pdfUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(invoice.pdfUrl!, "_blank")}
                          title="Download PDF"
                          data-testid={`button-download-invoice-${invoice.id}`}
                        >
                          <Download className="h-4 w-4" />
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

      {/* Account Management */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Account</h3>

          {profile?.accountStatus === "suspended" ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Your subscription is paused. Your data is safe and you can reactivate anytime.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => reactivateAccountMutation.mutate()}
                disabled={reactivateAccountMutation.isPending}
                className="w-full"
                data-testid="button-reactivate-account"
              >
                {reactivateAccountMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Reactivate My Account
              </Button>
            </div>
          ) : profile?.accountStatus === "pending_deletion" ? (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Your account is scheduled for deletion
                  {profile.scheduledDeletionAt && (
                    <> on {new Date(profile.scheduledDeletionAt).toLocaleDateString()}</>
                  )}
                  . You can undo this before then.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => undoCancelMutation.mutate()}
                disabled={undoCancelMutation.isPending}
                className="w-full"
                data-testid="button-undo-close-account"
              >
                {undoCancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Keep My Account
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {!isFree && !effectiveSubscription.cancelAtPeriodEnd && (
                <>
                  <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground"
                        data-testid="button-pause-subscription"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pause my subscription
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent data-testid="dialog-pause-subscription">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Pause your subscription?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3 text-sm">
                            <p>If you pause your subscription:</p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li>Billing will stop immediately</li>
                              <li>Your account will be downgraded to the Free plan</li>
                              <li>All your data will be safely retained</li>
                              <li>You can reactivate and subscribe again anytime</li>
                            </ul>
                            <p className="text-muted-foreground">
                              No refunds are issued for unused time in your current billing period.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-pause">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => suspendMutation.mutate()}
                          disabled={suspendMutation.isPending}
                          data-testid="button-confirm-pause"
                        >
                          {suspendMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Confirm Pause
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {!effectiveSubscription.cancelAtPeriodEnd && (
                    <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-muted-foreground"
                          data-testid="button-cancel-subscription"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel subscription
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-testid="dialog-cancel-subscription">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You'll keep access to {effectiveSubscription.planName} features until{" "}
                            {formatDate(effectiveSubscription.currentPeriodEnd)}. After that,
                            your account will be downgraded to the Free plan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-keep-subscription">
                            Keep Subscription
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => cancelMutation.mutate()}
                            disabled={cancelMutation.isPending}
                            className="bg-destructive text-destructive-foreground"
                            data-testid="button-confirm-cancel"
                          >
                            {cancelMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Cancel Subscription
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </>
              )}

              <AlertDialog open={showCloseAccountDialog} onOpenChange={setShowCloseAccountDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive"
                    data-testid="button-close-account"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Close my account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-testid="dialog-close-account">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close your account?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 text-sm">
                        <p>This is a significant action. Please understand what happens:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Your account access will be disabled immediately</li>
                          <li>Your data will be retained for 30 days (you can undo during this time)</li>
                          <li>After 30 days, data is archived for 120 days</li>
                          <li>After 150 days total, all data is permanently deleted</li>
                          <li>Any active subscription will be cancelled immediately</li>
                        </ul>
                        <p className="text-muted-foreground">
                          No refunds are issued for unused subscription time.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-close">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => closeAccountMutation.mutate()}
                      disabled={closeAccountMutation.isPending}
                      className="bg-destructive text-destructive-foreground"
                      data-testid="button-confirm-close"
                    >
                      {closeAccountMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Close Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
