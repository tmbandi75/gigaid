import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
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
import { openExternalUrl } from "@/lib/openExternalUrl";
import { openNativeStoreSubscriptionSettings } from "@/lib/storeSubscriptionSettings";
import { restoreNativePurchasesThenServer } from "@/lib/revenuecat";
import { startSubscriptionUpgrade, type SubscriptionPlan } from "@/lib/stripeCheckout";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/use-auth";
import { Plan, PLAN_PRICES_DOLLARS } from "@shared/plans";

interface SubscriptionStatus {
  plan: string;
  planName: string;
  status: string;
  hasSubscription: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  /** Where the active subscription is billed; used to open the correct store UI on native. */
  billingSource?: "stripe" | "app_store" | "play_store" | "none";
  pendingPlanChange?: {
    targetPlan: string;
    targetPlanName: string;
    effectiveDate: string;
  } | null;
}

interface ChangePlanResponse {
  success?: boolean;
  message?: string;
  checkoutUrl?: string;
  effectiveAt?: "immediate" | "period_end";
  effectiveDate?: string | null;
  targetPlan?: string;
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

const PLAN_PRICES: Record<Plan, number> = {
  [Plan.PRO]: PLAN_PRICES_DOLLARS[Plan.PRO],
  [Plan.PRO_PLUS]: PLAN_PRICES_DOLLARS[Plan.PRO_PLUS],
  [Plan.BUSINESS]: PLAN_PRICES_DOLLARS[Plan.BUSINESS],
  [Plan.FREE]: PLAN_PRICES_DOLLARS[Plan.FREE],
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
    price: PLAN_PRICES_DOLLARS[Plan.PRO],
    icon: Crown,
    tagline: "Grow faster",
    features: ["Unlimited jobs", "Auto follow-ups", "Two-way SMS", "Job templates"],
  },
  {
    id: "pro_plus",
    name: "Pro+",
    price: PLAN_PRICES_DOLLARS[Plan.PRO_PLUS],
    icon: Shield,
    tagline: "Get paid reliably",
    popular: true,
    features: ["Everything in Pro", "Deposit enforcement", "Booking protection", "Today's Money Plan"],
  },
  {
    id: "business",
    name: "Business",
    price: PLAN_PRICES_DOLLARS[Plan.BUSINESS],
    icon: Users,
    tagline: "Scale your team",
    features: ["Everything in Pro+", "Crew management", "Business analytics", "Admin controls"],
  },
] as const;

const PLAN_ORDER = ["free", "pro", "pro_plus", "business"];

export function SubscriptionSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  useEffect(() => {
    if (showCancelDialog) {
      emitChurnEvent("cancel_hover");
    }
  }, [showCancelDialog]);

  // This forces a fresh sync after returning from App Store / Play so plan labels do not stay stale.
  const syncSubscriptionStateFromStore = useCallback(async () => {
    try {
      await apiFetch("/api/subscription/sync-store", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptionStatus() });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.authUser() });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.capabilities() });
      await queryClient.refetchQueries({ queryKey: QUERY_KEYS.subscriptionStatus() });
    } catch (e) {
      logger.warn("[SubscriptionSettings] sync-store:", e);
    }
  }, [queryClient]);

  // Native: sync once on mount and again whenever the app becomes active.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    void syncSubscriptionStateFromStore();

    void CapacitorApp.addListener("appStateChange", (state) => {
      if (!state.isActive || disposed) return;
      void syncSubscriptionStateFromStore();
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }
      listenerHandle = handle;
    }).catch((e) => {
      logger.warn("[SubscriptionSettings] appStateChange listener:", e);
    });

    return () => {
      disposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [syncSubscriptionStateFromStore]);
  const [showCloseAccountDialog, setShowCloseAccountDialog] = useState(false);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [nativeUpgradePlanId, setNativeUpgradePlanId] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    restored: boolean;
    reason?: string;
    message: string;
  } | null>(null);

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
    // Stripe invoice history is web billing only; App Store / Play do not use this list.
    enabled: !Capacitor.isNativePlatform(),
  });

  const effectiveSubscription: SubscriptionStatus = subscription || {
    plan: "free",
    planName: "Free",
    status: "active",
    hasSubscription: false,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    billingSource: "none",
    pendingPlanChange: null,
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
          openExternalUrl(data.url);
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

  const restoreMutation = useApiMutation(
    async () => {
      await restoreNativePurchasesThenServer();
      return apiFetch<any>("/api/subscription/restore", { method: "POST" });
    },
    [QUERY_KEYS.subscriptionStatus(), QUERY_KEYS.profile(), QUERY_KEYS.authUser()],
    {
      onSuccess: (data: any) => {
        setRestoreResult({
          restored: data.restored,
          reason: data.reason,
          message: data.message,
        });
        if (data.restored) {
          toast({
            title: "Access restored",
            description: data.message || "Your subscription has been restored successfully",
          });
        } else {
          toast({
            title: "Restore incomplete",
            description: data.message || "Could not restore subscription",
            variant: data.reason === "no_subscription" ? "default" : "destructive",
          });
        }
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to restore subscription. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  /** Opens Apple or Google subscription management; IAP can only be changed in the store, not in-app. */
  const openPlatformSubscriptionSettings = useCallback(
    async (afterOpen?: () => void) => {
      try {
        await openNativeStoreSubscriptionSettings();
        await syncSubscriptionStateFromStore();
        afterOpen?.();
        toast({
          title: "Subscription settings opened",
          description: "Your current plan below is refreshed from the store.",
        });
        // Store changes can reach RevenueCat a moment after the sheet closes; catch up without leaving Settings.
        window.setTimeout(() => void syncSubscriptionStateFromStore(), 2000);
      } catch (e) {
        logger.warn("[SubscriptionSettings] store subscription settings:", e);
        toast({
          title: "Could not open subscription settings",
          description:
            "Open subscriptions from your Apple ID or Google Play account on this device, then try again.",
          variant: "destructive",
        });
      }
    },
    [syncSubscriptionStateFromStore, toast],
  );

  const runNativeUpgrade = useCallback(
    async (planId: string) => {
      setNativeUpgradePlanId(planId);
      try {
        const result = await startSubscriptionUpgrade({
          plan: planId as SubscriptionPlan,
          returnTo: "/settings?tab=billing",
          appUserId: user?.id,
        });
        if (result.success) {
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptionStatus() });
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.authUser() });
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.capabilities() });
          await queryClient.refetchQueries({ queryKey: QUERY_KEYS.subscriptionStatus() });
          const label =
            planId === "pro_plus" ? "Pro+" : planId === "business" ? "Business" : "Pro";
          toast({
            title: "Subscription updated",
            description: `You're on ${label}.`,
          });
        } else {
          toast({
            title: "Purchase did not complete",
            description:
              result.error ||
              "No detail returned. Confirm Sandbox Apple ID (Settings → App Store), RevenueCat Current offering, and package ids pro / pro_plus / business.",
            variant: "destructive",
          });
        }
      } catch (e) {
        logger.error("[SubscriptionSettings] native upgrade:", e);
        toast({
          title: "Upgrade failed",
          description: "Please try again in a few minutes.",
          variant: "destructive",
        });
      } finally {
        setNativeUpgradePlanId(null);
      }
    },
    [queryClient, toast, user?.id]
  );

  const changePlanMutation = useApiMutation(
    (planToChange: string) =>
      apiFetch<any>("/api/subscription/change-plan", {
        method: "POST",
        body: JSON.stringify({ newPlan: planToChange }),
      }),
    [QUERY_KEYS.subscriptionStatus(), QUERY_KEYS.profile(), QUERY_KEYS.authUser()],
    {
      onSuccess: (data: ChangePlanResponse) => {
        if (data?.checkoutUrl) {
          openExternalUrl(data.checkoutUrl);
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
  const normalizedPlan = (effectiveSubscription.plan || "free") as Plan;
  const price = PLAN_PRICES[normalizedPlan] || 0;
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
  const isNativeApp = Capacitor.isNativePlatform();
  const nativePlatform = Capacitor.getPlatform();
  const billingSource = effectiveSubscription.billingSource ?? "none";
  const isStoreBilling =
    effectiveSubscription.hasSubscription &&
    (billingSource === "app_store" || billingSource === "play_store");

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
                    ${price.toFixed(2)}/month
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

          {effectiveSubscription.pendingPlanChange && (
            <div
              className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 mb-4"
              data-testid="text-pending-downgrade-notice"
            >
              <p className="text-xs text-amber-800 dark:text-amber-200">
                You will switch to {effectiveSubscription.pendingPlanChange.targetPlanName} on{" "}
                {formatDate(effectiveSubscription.pendingPlanChange.effectiveDate)}. Your current plan stays active until then.
              </p>
            </div>
          )}

          {!isFree && (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (isNativeApp && isStoreBilling) {
                    void openPlatformSubscriptionSettings();
                  } else {
                    portalMutation.mutate();
                  }
                }}
                disabled={isNativeApp && isStoreBilling ? false : portalMutation.isPending}
                className="w-full"
                data-testid="button-manage-billing"
              >
                {portalMutation.isPending && !(isNativeApp && isStoreBilling) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {isNativeApp && isStoreBilling ? "Manage subscription" : "Manage Billing"}
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Button>

              {effectiveSubscription.cancelAtPeriodEnd && (
                isStoreBilling ? (
                  <Button
                    variant="default"
                    onClick={() => void openPlatformSubscriptionSettings()}
                    className="w-full"
                    data-testid="button-reactivate"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Turn auto-renew on in{" "}
                    {nativePlatform === "ios" ? "App Store" : "Google Play"}
                  </Button>
                ) : (
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
                )
              )}
            </div>
          )}
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
                          <span className="text-xs text-muted-foreground font-medium">${plan.price.toFixed(2)}/mo</span>
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
                            } else if (Capacitor.isNativePlatform()) {
                              setSelectedPlan(plan.id);
                              void runNativeUpgrade(plan.id);
                            } else {
                              setSelectedPlan(plan.id);
                              changePlanMutation.mutate(plan.id);
                            }
                          }}
                          disabled={
                            changePlanMutation.isPending || nativeUpgradePlanId === plan.id
                          }
                          data-testid={`button-${isUpgrade ? "upgrade" : "downgrade"}-${plan.id}`}
                        >
                          {(changePlanMutation.isPending || nativeUpgradePlanId === plan.id) &&
                          selectedPlan === plan.id ? (
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
            <AlertDialogTitle>
              {isNativeApp && isStoreBilling
                ? nativePlatform === "ios"
                  ? "Change plan in the App Store?"
                  : "Change plan in Google Play?"
                : "Downgrade your plan?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {isNativeApp && isStoreBilling ? (
                  <>
                    <p>
                      Paid plans on this app are billed through{" "}
                      {nativePlatform === "ios" ? "Apple" : "Google Play"}. To move to{" "}
                      <strong>
                        {selectedPlan === "free"
                          ? "Free"
                          : selectedPlan === "pro"
                            ? "Pro"
                            : selectedPlan === "pro_plus"
                              ? "Pro+"
                              : "Business"}
                      </strong>
                      , change or cancel the subscription in your store account. The next button opens
                      those subscription settings for you.
                    </p>
                    <p className="text-muted-foreground">
                      When you return, we will sync your access. If something still looks wrong, tap Restore Access.
                    </p>
                  </>
                ) : isNativeApp ? (
                  <>
                    <p>
                      Your subscription is billed outside the app store (for example through Stripe).
                      Use Confirm Downgrade to request the plan change on our servers.
                    </p>
                    <p className="text-muted-foreground">
                      If you expected App Store or Google Play billing, check that you are signed into
                      the same account you used to subscribe.
                    </p>
                  </>
                ) : (
                  <>
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
                      </strong>
                      .
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
                  </>
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
              onClick={(e) => {
                if (isNativeApp && isStoreBilling) {
                  e.preventDefault();
                  void openPlatformSubscriptionSettings(() => {
                    setShowChangePlanDialog(false);
                    setSelectedPlan(null);
                  });
                  return;
                }
                if (selectedPlan) changePlanMutation.mutate(selectedPlan);
              }}
              disabled={
                !selectedPlan ||
                (isNativeApp && isStoreBilling ? false : changePlanMutation.isPending)
              }
              data-testid="button-confirm-change-plan"
            >
              {changePlanMutation.isPending && selectedPlan && !(isNativeApp && isStoreBilling) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isNativeApp && isStoreBilling
                ? nativePlatform === "ios"
                  ? "Open App Store subscriptions"
                  : "Open Play Store subscriptions"
                : "Confirm Downgrade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice History — Stripe only; hidden on native (store-billed). */}
      {!isNativeApp && (
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
                            aria-label="View invoice"
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
                            aria-label="Download PDF"
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
      )}

      {/* Subscription & Billing Disclosure */}
      <Card data-testid="card-subscription-disclosure">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Subscription Info
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            {isNativeApp ? (
              <p data-testid="text-subscription-disclosure">
                On this app, paid plans are purchased through{" "}
                {nativePlatform === "ios" ? "the App Store" : "Google Play"} and renew
                automatically until you cancel in your store account settings. Gig Aid
                subscriptions unlock business management tools (scheduling, invoicing, clients,
                and automation).
              </p>
            ) : (
              <p data-testid="text-subscription-disclosure">
                On the web, subscriptions are billed through Stripe. Gig Aid subscriptions
                are for business management services (job scheduling, invoicing, client
                management, and automation tools). Paid plans auto-renew each month until
                cancelled. Cancellation takes effect at the end of the current billing
                period.
              </p>
            )}

            <div className="space-y-2">
              <p className="font-medium text-foreground text-xs">How to manage your subscription:</p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {isNativeApp ? (
                  <>
                    <li>
                      <strong>Upgrade</strong> — Tap &quot;Upgrade&quot; on a higher plan above or use
                      the Pricing screen. You will complete purchase with{" "}
                      {nativePlatform === "ios" ? "App Store" : "Google Play"}.
                    </li>
                    <li>
                      <strong>Cancel or change</strong> — Use your{" "}
                      {nativePlatform === "ios" ? "Apple ID" : "Google Play"} subscription
                      settings.
                    </li>
                    <li>
                      <strong>Restore</strong> — Use &quot;Restore Access&quot; below if you reinstall
                      or change devices.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>Upgrade</strong> — Tap &quot;Upgrade&quot; above or visit Pricing to
                      choose a higher plan. You will use secure Stripe checkout.
                    </li>
                    <li>
                      <strong>Cancel</strong> — Use &quot;Cancel subscription&quot; below when
                      available. Access continues through the end of the billing period.
                    </li>
                    <li>
                      <strong>Manage billing</strong> — Visit{" "}
                      <a
                        href="https://gigaid.ai/account"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        data-testid="link-manage-billing"
                      >
                        gigaid.ai/account
                      </a>{" "}
                      or tap &quot;Manage Billing&quot; above for payment method and invoices.
                    </li>
                  </>
                )}
              </ul>
            </div>

            {isNativeApp && (
              <p className="text-xs">
                {nativePlatform === "ios" ? "App Store" : "Google Play"} subscriptions:{" "}
                <button
                  type="button"
                  onClick={() => void openPlatformSubscriptionSettings()}
                  className="underline text-foreground font-medium"
                  data-testid="link-store-subscriptions"
                >
                  Open subscription settings
                </button>
                .
              </p>
            )}
            {!isNativeApp && (
              <p className="text-xs">
                If you subscribed through the App Store on an iPhone or iPad, manage that
                subscription in{" "}
                <a
                  href="https://apps.apple.com/account/subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  data-testid="link-apple-subscriptions-web"
                >
                  Apple Subscription Settings
                </a>
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Restore Access */}
      <Card data-testid="card-restore-access">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Restore Access
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Reinstalled the app or switched devices? Tap below to restore your subscription.
          </p>

          {restoreResult && (
            <div
              className={`p-3 rounded-lg mb-3 text-sm ${
                restoreResult.restored
                  ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                  : restoreResult.reason === "payment_failed"
                  ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid="text-restore-result"
            >
              {restoreResult.message}
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => {
              setRestoreResult(null);
              restoreMutation.mutate();
            }}
            disabled={restoreMutation.isPending}
            className="w-full"
            data-testid="button-restore-access"
          >
            {restoreMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Restore Access
          </Button>
        </CardContent>
      </Card>

      {/* Account Management */}
   {!isNativeApp &&    <Card>
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
                          <AlertDialogTitle>
                            {isNativeApp && isStoreBilling
                              ? nativePlatform === "ios"
                                ? "Cancel in the App Store?"
                                : "Cancel in Google Play?"
                              : "Cancel your subscription?"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {isNativeApp && isStoreBilling ? (
                              <>
                                To stop renewing, turn off auto-renew in{" "}
                                {nativePlatform === "ios" ? "App Store" : "Google Play"} subscription
                                settings. You keep {effectiveSubscription.planName} until{" "}
                                {formatDate(effectiveSubscription.currentPeriodEnd)}, then access moves
                                to the Free plan once the store updates us.
                              </>
                            ) : (
                              <>
                                You will keep access to {effectiveSubscription.planName} features until{" "}
                                {formatDate(effectiveSubscription.currentPeriodEnd)}. After that, your
                                account will be downgraded to the Free plan.
                              </>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-keep-subscription">
                            Keep Subscription
                          </AlertDialogCancel>
                          {isNativeApp && isStoreBilling ? (
                            <AlertDialogAction
                              onClick={(e) => {
                                e.preventDefault();
                                void openPlatformSubscriptionSettings(() => setShowCancelDialog(false));
                              }}
                              data-testid="button-confirm-cancel"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {nativePlatform === "ios"
                                ? "Open App Store subscriptions"
                                : "Open Play Store subscriptions"}
                            </AlertDialogAction>
                          ) : (
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
                          )}
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
      </Card>}
    </div>
  );
}
