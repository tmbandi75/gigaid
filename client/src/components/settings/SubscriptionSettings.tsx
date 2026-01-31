import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Crown,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Calendar,
  CreditCard,
  RefreshCcw,
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

const PLAN_PRICES: Record<string, number> = {
  pro: 19,
  pro_plus: 28,
  business: 49,
};

export function SubscriptionSettings() {
  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { data: subscription, isLoading, isError } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    retry: 1,
    refetchOnWindowFocus: true,
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

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/subscription/cancel");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      toast({
        title: "Subscription cancelled",
        description: data.message || "Your subscription will end at the current billing period",
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
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/subscription/reactivate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
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
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/subscription/portal", { returnUrl: "/settings" });
    },
    onSuccess: (data: any) => {
      if (data.url) {
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
  });

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

  const isFree = !effectiveSubscription.hasSubscription || effectiveSubscription.plan === "free";
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
      </CardContent>
    </Card>
  );
}
