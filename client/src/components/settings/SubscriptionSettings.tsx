import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

export function SubscriptionSettings() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showCloseAccountDialog, setShowCloseAccountDialog] = useState(false);

  const { data: subscription, isLoading, isError } = useQuery<SubscriptionStatus>({
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

  // Default subscription status when API fails or returns no data
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

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md" data-testid="card-subscription-loading">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isFree = effectiveSubscription.plan === "free" && !effectiveSubscription.hasSubscription;
  const price = PLAN_PRICES[effectiveSubscription.plan] || 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
    <Card className="border-0 shadow-md" data-testid="card-subscription-settings">
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Crown className="h-4 w-4 text-white" />
          </div>
          Subscription & Billing
        </h3>
        <Separator className="my-4" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold" data-testid="text-current-plan">
                  {effectiveSubscription.planName}
                </span>
                {!isFree && (
                  <Badge variant="secondary" data-testid="badge-plan-price">
                    ${price}/month
                  </Badge>
                )}
              </div>
            </div>
            {effectiveSubscription.cancelAtPeriodEnd && (
              <Badge variant="outline" className="text-amber-600 border-amber-300" data-testid="badge-cancelling">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Cancelling
              </Badge>
            )}
          </div>

          {effectiveSubscription.hasSubscription && effectiveSubscription.currentPeriodEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
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

          <Separator className="my-4" />

          {isFree ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upgrade to unlock more features and remove limits.
              </p>
              <Button
                onClick={() => window.location.href = "/pricing"}
                className="w-full"
                data-testid="button-view-plans"
              >
                <Crown className="h-4 w-4 mr-2" />
                View Plans
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
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

              {effectiveSubscription.cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
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
              ) : (
                <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      data-testid="button-cancel-subscription"
                    >
                      Cancel Subscription
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
            </div>
          )}
        </div>

        {/* Manage Subscription Section */}
        <Separator className="my-6" />
        
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground">Manage Subscription</h4>
          
          {/* Show different UI based on account status */}
          {profile?.accountStatus === "suspended" ? (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
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
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
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
            <div className="space-y-3">
              {/* Pause Subscription - only for paid plans */}
              {!isFree && !effectiveSubscription.cancelAtPeriodEnd && (
                <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
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
              )}

              {/* Close Account - available to everyone */}
              <AlertDialog open={showCloseAccountDialog} onOpenChange={setShowCloseAccountDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive"
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
        </div>
      </CardContent>
    </Card>

    {/* Invoice History */}
    <Card className="border-0 shadow-md mt-4" data-testid="card-invoice-history">
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
            <Receipt className="h-4 w-4 text-white" />
          </div>
          Invoice History
        </h3>
        <Separator className="my-4" />

        {invoicesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !invoiceData?.invoices || invoiceData.invoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your billing history will appear here after your first payment
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoiceData.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                data-testid={`invoice-row-${invoice.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {invoice.number || `Invoice #${invoice.id.slice(-8)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.created * 1000).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
                  <div className="flex gap-1">
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
    </>
  );
}
