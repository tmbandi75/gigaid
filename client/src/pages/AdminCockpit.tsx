import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TestTube2,
  Sparkles,
  Clock,
  Receipt,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface KPIMetric {
  value: number;
  deltaWoW: number | null;
  deltaMoM?: number | null;
  health: "green" | "yellow" | "red";
}

interface SummaryData {
  totalUsers: KPIMetric;
  activeUsers7d: KPIMetric;
  activeUsers30d: KPIMetric;
  payingCustomers: KPIMetric;
  mrr: KPIMetric;
  arr: KPIMetric;
  netChurnPct: KPIMetric;
}

interface FocusData {
  healthState: "green" | "yellow" | "red";
  primaryBottleneck: string;
  biggestFunnelLeak: string | null;
  recommendation: string;
  rationale: string;
  urgencyScore: number;
  createdAt: string;
}

interface Alert {
  id: string;
  type: string;
  key: string;
  severity: number;
  summary: string;
  explanation: string;
  createdAt: string;
}

function HealthIndicator({ health }: { health: "green" | "yellow" | "red" }) {
  const config = {
    green: { className: "bg-emerald-500", pulse: false },
    yellow: { className: "bg-amber-500", pulse: true },
    red: { className: "bg-red-500", pulse: true },
  };
  const { className, pulse } = config[health];
  return (
    <span className="relative flex h-3 w-3">
      {pulse && <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", className)} />}
      <span className={cn("relative inline-flex rounded-full h-3 w-3", className)} />
    </span>
  );
}

function HealthBadge({ health }: { health: "green" | "yellow" | "red" }) {
  const config = {
    green: { label: "Healthy", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    yellow: { label: "Warning", icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    red: { label: "Critical", icon: XCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  };
  const { label, icon: Icon, className } = config[health];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function DeltaBadge({ delta, inverted = false }: { delta: number | null; inverted?: boolean }) {
  if (delta === null) return <span className="text-xs text-muted-foreground">--</span>;
  
  const isPositive = inverted ? delta < 0 : delta > 0;
  const isNegative = inverted ? delta > 0 : delta < 0;
  
  if (Math.abs(delta) < 1) {
    return (
      <span className="inline-flex items-center text-xs text-muted-foreground font-medium">
        <Minus className="h-3 w-3 mr-0.5" />
        {Math.abs(delta).toFixed(1)}%
      </span>
    );
  }
  
  if (isPositive) {
    return (
      <span className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
        <ArrowUpRight className="h-3 w-3 mr-0.5" />
        {Math.abs(delta).toFixed(1)}%
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center text-xs text-red-600 dark:text-red-400 font-medium">
      <ArrowDownRight className="h-3 w-3 mr-0.5" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function MetricCard({ 
  title, 
  value, 
  format = "number",
  metric,
  icon: Icon,
  gradient,
}: { 
  title: string; 
  value: number;
  format?: "number" | "currency" | "percent";
  metric: KPIMetric;
  icon: React.ElementType;
  gradient?: string;
}) {
  const formatValue = (v: number) => {
    if (format === "currency") return `$${(v / 100).toLocaleString()}`;
    if (format === "percent") return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-card/80">
      <div className={cn("absolute inset-0 opacity-5", gradient || "bg-gradient-to-br from-violet-500 to-purple-500")} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{formatValue(value)}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground">
                WoW: <DeltaBadge delta={metric.deltaWoW} inverted={format === "percent" && title.includes("Churn")} />
              </span>
            </div>
          </div>
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center",
            metric.health === "green" ? "bg-emerald-500/10" : 
            metric.health === "yellow" ? "bg-amber-500/10" : "bg-red-500/10"
          )}>
            <Icon className={cn(
              "h-6 w-6",
              metric.health === "green" ? "text-emerald-600 dark:text-emerald-400" : 
              metric.health === "yellow" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminCockpit() {
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<SummaryData>({
    queryKey: QUERY_KEYS.adminCockpitSummary(),
    retry: false,
  });

  const { data: focus, isLoading: focusLoading, error: focusError } = useQuery<FocusData>({
    queryKey: QUERY_KEYS.adminCockpitFocus(),
    retry: false,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<{ alerts: Alert[] }>({
    queryKey: QUERY_KEYS.adminCockpitAlerts(),
    retry: false,
  });

  const { data: riskData } = useQuery<any>({
    queryKey: QUERY_KEYS.adminCockpitRiskLeakage(),
    retry: false,
  });

  const { data: revenueData } = useQuery<any>({
    queryKey: QUERY_KEYS.adminCockpitRevenuePayments(),
    retry: false,
  });

  const { data: funnelData } = useQuery<any>({
    queryKey: QUERY_KEYS.adminCockpitActivationFunnel(),
    retry: false,
  });

  const { data: testSummary } = useQuery<{
    reportAvailable: boolean;
    lastRun: string | null;
    summary: { total: number; passed: number; failed: number; passRate: string };
  }>({
    queryKey: QUERY_KEYS.adminTestSummary(),
    retry: false,
  });

  const isAccessDenied = (summaryError as any)?.message?.includes("403") || 
                         (focusError as any)?.message?.includes("403");

  if (isAccessDenied) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20" data-testid="page-access-denied">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view the admin cockpit.</p>
      </div>
    );
  }

  const refreshMutation = useApiMutation(
    () => apiFetch("/api/admin/cockpit/refresh", { method: "POST" }),
    [
      QUERY_KEYS.adminCockpitSummary(),
      QUERY_KEYS.adminCockpitFocus(),
      QUERY_KEYS.adminCockpitAlerts(),
      QUERY_KEYS.adminCockpitRiskLeakage(),
      QUERY_KEYS.adminCockpitRevenuePayments(),
      QUERY_KEYS.adminCockpitActivationFunnel(),
    ],
    {
      onSuccess: () => {
        toast({ title: "Data refreshed" });
      },
      onError: () => {
        toast({ title: "Failed to refresh", variant: "destructive" });
      },
    }
  );

  if (summaryLoading || focusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-admin-cockpit">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Business health at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/admin/analytics" data-testid="link-view-analytics">
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh"
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshMutation.isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {focus && (
        <Card className={cn(
          "relative overflow-hidden border-2",
          focus.healthState === "green" ? "border-emerald-500/30" :
          focus.healthState === "yellow" ? "border-amber-500/30" : "border-red-500/30"
        )}>
          <div className={cn(
            "absolute inset-0 opacity-5",
            focus.healthState === "green" ? "bg-emerald-500" :
            focus.healthState === "yellow" ? "bg-amber-500" : "bg-red-500"
          )} />
          <CardHeader className="pb-2 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-violet-500" />
                Focus This Week
              </CardTitle>
              <div className="flex items-center gap-2">
                <HealthIndicator health={focus.healthState} />
                <span className="text-sm font-medium capitalize">{focus.healthState} health</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Target className="h-3 w-3" />
                  {focus.primaryBottleneck}
                </Badge>
                {focus.biggestFunnelLeak && (
                  <Badge variant="secondary" className="gap-1">
                    <TrendingDown className="h-3 w-3" />
                    {focus.biggestFunnelLeak.replace(/_/g, " ")}
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <BarChart3 className="h-3 w-3" />
                  Urgency: {focus.urgencyScore}/100
                </Badge>
              </div>
              <p className="text-lg font-semibold" data-testid="text-recommendation">
                {focus.recommendation}
              </p>
              <p className="text-sm text-muted-foreground">
                {focus.rationale}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {alerts && alerts.alerts.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({alerts.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.alerts.map((alert) => (
              <div 
                key={alert.id} 
                className="p-4 rounded-xl bg-card border border-red-500/20"
                data-testid={`alert-${alert.key}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{alert.summary}</span>
                  <Badge variant="destructive" className="text-xs">
                    Severity {alert.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{alert.explanation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-violet-500" />
            Key Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              title="Total Users" 
              value={summary.totalUsers.value}
              metric={summary.totalUsers}
              icon={Users}
              gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
            />
            <MetricCard 
              title="Active (7d)" 
              value={summary.activeUsers7d.value}
              metric={summary.activeUsers7d}
              icon={Activity}
              gradient="bg-gradient-to-br from-violet-500 to-purple-500"
            />
            <MetricCard 
              title="Paying Customers" 
              value={summary.payingCustomers.value}
              metric={summary.payingCustomers}
              icon={UserCheck}
              gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
            />
            <MetricCard 
              title="MRR" 
              value={summary.mrr.value}
              format="currency"
              metric={summary.mrr}
              icon={DollarSign}
              gradient="bg-gradient-to-br from-amber-500 to-orange-500"
            />
          </div>
        </div>
      )}

      {funnelData && funnelData.metrics && funnelData.metrics.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-violet-500" />
                Activation Funnel
              </CardTitle>
              <div className="flex items-center gap-2">
                <HealthIndicator health={funnelData.summary?.health || "green"} />
                <span className="text-sm text-muted-foreground">{funnelData.totalUsers} users</span>
              </div>
            </div>
            <CardDescription>{funnelData.summary?.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {funnelData.metrics.map((metric: any) => (
                <div 
                  key={metric.key} 
                  className="p-4 rounded-xl border bg-muted/30"
                  data-testid={`funnel-metric-${metric.key}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{metric.label}</span>
                    <HealthBadge health={metric.health} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {metric.displayValue || `${metric.value.toFixed(1)}%`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Target: {metric.thresholdLabel}
                    </span>
                  </div>
                  {metric.count !== undefined && metric.total !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {metric.count} of {metric.total} users
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="gap-2" asChild>
                <Link href="/admin/analytics" data-testid="link-funnel-view-analytics">
                  <BarChart3 className="h-4 w-4" />
                  View full analytics
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {funnelData?.activationFunnel && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-emerald-500" />
                Signup &rarr; Activated &rarr; Paid
              </CardTitle>
              <span className="text-sm text-muted-foreground">{funnelData.activationFunnel.totalSignups} signups</span>
            </div>
            <CardDescription>
              {funnelData.activationFunnel.avgTimeToActivationHours > 0
                ? `Avg time to activation: ${funnelData.activationFunnel.avgTimeToActivationHours}h`
                : "No activations yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3" data-testid="activation-funnel-stages">
              {[
                { label: "Signups", count: funnelData.activationFunnel.totalSignups, pct: 100 },
                { label: "Activated (all 5 steps)", count: funnelData.activationFunnel.activated, pct: funnelData.activationFunnel.pctActivated },
                { label: "First Quote Sent", count: funnelData.activationFunnel.firstQuoteSent, pct: funnelData.activationFunnel.pctFirstQuoteSent },
                { label: "First Payment Received", count: funnelData.activationFunnel.paid, pct: funnelData.activationFunnel.totalSignups > 0 ? (funnelData.activationFunnel.paid / funnelData.activationFunnel.totalSignups * 100) : 0 },
              ].map((stage) => (
                <div key={stage.label} data-testid={`funnel-stage-${stage.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{stage.label}</span>
                    <span className="text-sm font-medium">{stage.count} ({stage.pct.toFixed(1)}%)</span>
                  </div>
                  <Progress value={stage.pct} className="h-2" />
                </div>
              ))}
            </div>
            <Separator />
            <div data-testid="activation-step-breakdown">
              <p className="text-xs font-medium text-muted-foreground mb-2">Step Breakdown</p>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: "Service", count: funnelData.activationFunnel.steps.servicesDone },
                  { label: "Price", count: funnelData.activationFunnel.steps.pricingDone },
                  { label: "Pay", count: funnelData.activationFunnel.steps.paymentsDone },
                  { label: "Link", count: funnelData.activationFunnel.steps.linkDone },
                  { label: "Quote", count: funnelData.activationFunnel.steps.quoteDone },
                ].map((step) => (
                  <div key={step.label} className="p-2 rounded-md bg-muted/30">
                    <p className="text-lg font-bold">{step.count}</p>
                    <p className="text-xs text-muted-foreground">{step.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {riskData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Risk & Leakage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lead Conversion</span>
                <span className="font-semibold">
                  {riskData.leadLeakage?.conversionRate?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Invoice Payment Rate</span>
                <span className="font-semibold">
                  {riskData.invoiceLeakage?.paymentRate?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Paying Users Inactive</span>
                <span className="font-semibold">{riskData.payingUsersInactive7d || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Churned (7d / 30d)</span>
                <span className="font-semibold text-red-500">
                  {riskData.churnedUsers?.last7d || 0} / {riskData.churnedUsers?.last30d || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {revenueData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-500" />
                Revenue & Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Invoices</span>
                <span className="font-semibold">
                  {revenueData.invoiceStats?.paid || 0} / {revenueData.invoiceStats?.total || 0} paid
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Overdue Invoices</span>
                <span className="font-semibold text-red-500">{revenueData.invoiceStats?.overdue || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Failed Payments (24h)</span>
                <span className="font-semibold">{revenueData.failedPayments?.last24h || 0}</span>
              </div>
              <Separator />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
                onClick={() => window.open(revenueData.links?.stripeDashboard, "_blank")}
                data-testid="button-open-stripe"
              >
                <ExternalLink className="h-4 w-4" />
                Open Stripe Dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {testSummary && (
          <Card data-testid="card-test-results">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TestTube2 className="h-4 w-4 text-violet-500" />
                UAT Test Results
              </CardTitle>
              <CardDescription>
                End-to-end test suite status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Tests</span>
                <span className="font-semibold">{testSummary.summary.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Passed</span>
                <span className="font-semibold text-emerald-600">{testSummary.summary.passed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Failed</span>
                <span className="font-semibold text-red-500">{testSummary.summary.failed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pass Rate</span>
                <Badge className={cn(
                  Number(testSummary.summary.passRate) >= 95 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                  Number(testSummary.summary.passRate) >= 80 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                  "bg-red-500/10 text-red-600 border-red-500/20"
                )} variant="outline">
                  {testSummary.summary.passRate}%
                </Badge>
              </div>
              {testSummary.lastRun && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(testSummary.lastRun).toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
                onClick={() => window.open("/api/admin/test-report", "_blank")}
                disabled={!testSummary.reportAvailable}
                data-testid="button-view-test-report"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Report
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
