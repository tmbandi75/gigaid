import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CreditCard, 
  ExternalLink, 
  Loader2,
  Check,
  AlertCircle,
  DollarSign,
  Clock,
  Shield,
} from "lucide-react";

interface ConnectStatus {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
}

interface DepositSettings {
  depositEnabled: boolean;
  depositType: "percent" | "fixed";
  depositValue: number;
  lateRescheduleWindowHours: number;
  lateRescheduleRetainPctFirst: number;
  lateRescheduleRetainPctSecond: number;
  lateRescheduleRetainPctCap: number;
}

export function StripeConnectSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [depositSettings, setDepositSettings] = useState<DepositSettings>({
    depositEnabled: false,
    depositType: "percent",
    depositValue: 50,
    lateRescheduleWindowHours: 24,
    lateRescheduleRetainPctFirst: 40,
    lateRescheduleRetainPctSecond: 60,
    lateRescheduleRetainPctCap: 75,
  });

  const { data: connectStatus, isLoading: statusLoading } = useQuery<ConnectStatus>({
    queryKey: ["/api/stripe/connect/status"],
    refetchInterval: 30000,
  });

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
  });

  useEffect(() => {
    if (profile) {
      setDepositSettings({
        depositEnabled: profile.depositEnabled || false,
        depositType: profile.depositType || "percent",
        depositValue: profile.depositValue || 50,
        lateRescheduleWindowHours: profile.lateRescheduleWindowHours || 24,
        lateRescheduleRetainPctFirst: profile.lateRescheduleRetainPctFirst || 40,
        lateRescheduleRetainPctSecond: profile.lateRescheduleRetainPctSecond || 60,
        lateRescheduleRetainPctCap: profile.lateRescheduleRetainPctCap || 75,
      });
    }
  }, [profile]);

  const onboardMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/stripe/connect/onboard"),
    onSuccess: (data: any) => {
      if (data.url) {
        // Open Stripe onboarding in new tab to avoid navigation issues
        window.open(data.url, "_blank");
        toast({ 
          title: "Stripe Setup", 
          description: "Complete your Stripe setup in the new tab. Return here when finished." 
        });
      } else {
        toast({ title: "Failed to get onboarding URL", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error("Onboarding error:", error);
      toast({ title: "Failed to start onboarding", variant: "destructive" });
    },
  });

  const dashboardMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/stripe/connect/dashboard"),
    onSuccess: (data: any) => {
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast({ title: "Failed to get dashboard URL", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error("Dashboard error:", error);
      toast({ 
        title: "Cannot open dashboard", 
        description: "Please complete your Stripe setup first.",
        variant: "destructive" 
      });
    },
  });

  const saveDepositMutation = useMutation({
    mutationFn: (data: DepositSettings) => 
      apiRequest("PATCH", "/api/stripe/connect/deposit-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Deposit settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save deposit settings", variant: "destructive" });
    },
  });

  const handleSaveDepositSettings = () => {
    saveDepositMutation.mutate(depositSettings);
  };

  const getStatusBadge = () => {
    if (!connectStatus?.connected) {
      return <Badge variant="secondary">Not Connected</Badge>;
    }
    if (connectStatus.chargesEnabled && connectStatus.payoutsEnabled) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
    }
    if (connectStatus.onboardingComplete) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Restricted</Badge>;
    }
    return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Pending</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card data-testid="card-stripe-connect">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Account
            {getStatusBadge()}
          </CardTitle>
          <CardDescription>
            Connect your Stripe account to receive deposits from customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !connectStatus?.connected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm">
                  Connect your Stripe account to start accepting secure deposits from customers. 
                  You'll be able to:
                </p>
                <ul className="text-sm mt-2 space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Accept deposits for bookings
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Protect against no-shows
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Get paid automatically after jobs
                  </li>
                </ul>
              </div>
              <Button 
                onClick={() => onboardMutation.mutate()} 
                disabled={onboardMutation.isPending}
                className="w-full"
                data-testid="button-connect-stripe"
              >
                {onboardMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Connect Stripe Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {!connectStatus.chargesEnabled && (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Complete Your Setup</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Your account needs additional information before you can accept payments.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => onboardMutation.mutate()} 
                  disabled={onboardMutation.isPending}
                  className="flex-1"
                  data-testid="button-update-stripe"
                >
                  {onboardMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {connectStatus?.onboardingComplete ? "Update Account" : "Complete Setup"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => dashboardMutation.mutate()} 
                  disabled={dashboardMutation.isPending || !connectStatus?.onboardingComplete}
                  className="flex-1"
                  data-testid="button-stripe-dashboard"
                >
                  {dashboardMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Stripe Dashboard
                </Button>
              </div>
              
              {!connectStatus?.onboardingComplete && (
                <p className="text-xs text-muted-foreground">
                  Complete your Stripe setup to access the dashboard and start accepting payments.
                </p>
              )}

              {connectStatus.chargesEnabled && (
                <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Your account is ready to accept payments
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {connectStatus?.chargesEnabled && (
        <Card data-testid="card-deposit-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Deposit Settings
            </CardTitle>
            <CardDescription>
              Configure how deposits work for your bookings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Require Deposits</p>
                <p className="text-sm text-muted-foreground">Ask customers for a deposit when booking</p>
              </div>
              <Switch
                checked={depositSettings.depositEnabled}
                onCheckedChange={(checked) => setDepositSettings({ ...depositSettings, depositEnabled: checked })}
                data-testid="switch-deposit-enabled"
              />
            </div>

            {depositSettings.depositEnabled && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Deposit Type</Label>
                    <select 
                      className="w-full p-2 rounded-md border bg-background"
                      value={depositSettings.depositType}
                      onChange={(e) => setDepositSettings({ ...depositSettings, depositType: e.target.value as "percent" | "fixed" })}
                      data-testid="select-deposit-type"
                    >
                      <option value="percent">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{depositSettings.depositType === "percent" ? "Percentage" : "Amount (cents)"}</Label>
                    <Input
                      type="number"
                      value={depositSettings.depositValue}
                      onChange={(e) => setDepositSettings({ ...depositSettings, depositValue: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={depositSettings.depositType === "percent" ? 100 : undefined}
                      data-testid="input-deposit-value"
                    />
                  </div>
                </div>

                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Late Reschedule Policy</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When a customer reschedules within the window below, a portion of their deposit is kept.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Window (hours before job)</Label>
                      <Input
                        type="number"
                        value={depositSettings.lateRescheduleWindowHours}
                        onChange={(e) => setDepositSettings({ ...depositSettings, lateRescheduleWindowHours: parseInt(e.target.value) || 24 })}
                        min={1}
                        max={168}
                        data-testid="input-late-window"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>1st Late (%)</Label>
                      <Input
                        type="number"
                        value={depositSettings.lateRescheduleRetainPctFirst}
                        onChange={(e) => setDepositSettings({ ...depositSettings, lateRescheduleRetainPctFirst: parseInt(e.target.value) || 40 })}
                        min={0}
                        max={100}
                        data-testid="input-retain-first"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>2nd Late (%)</Label>
                      <Input
                        type="number"
                        value={depositSettings.lateRescheduleRetainPctSecond}
                        onChange={(e) => setDepositSettings({ ...depositSettings, lateRescheduleRetainPctSecond: parseInt(e.target.value) || 60 })}
                        min={0}
                        max={100}
                        data-testid="input-retain-second"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cap (%)</Label>
                      <Input
                        type="number"
                        value={depositSettings.lateRescheduleRetainPctCap}
                        onChange={(e) => setDepositSettings({ ...depositSettings, lateRescheduleRetainPctCap: parseInt(e.target.value) || 75 })}
                        min={0}
                        max={100}
                        data-testid="input-retain-cap"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example: If a customer reschedules late twice on a $100 deposit, 
                    you keep {depositSettings.lateRescheduleRetainPctFirst}% then {depositSettings.lateRescheduleRetainPctSecond}% 
                    (capped at {depositSettings.lateRescheduleRetainPctCap}% total).
                  </p>
                </div>

                <Button 
                  onClick={handleSaveDepositSettings}
                  disabled={saveDepositMutation.isPending}
                  className="w-full"
                  data-testid="button-save-deposit-settings"
                >
                  {saveDepositMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Deposit Settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
