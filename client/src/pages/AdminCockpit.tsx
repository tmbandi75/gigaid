import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  UserCog
} from "lucide-react";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

function HealthBadge({ health }: { health: "green" | "yellow" | "red" }) {
  const config = {
    green: { label: "Healthy", variant: "default" as const, icon: CheckCircle, className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    yellow: { label: "Warning", variant: "secondary" as const, icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    red: { label: "Critical", variant: "destructive" as const, icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  };
  const { label, icon: Icon, className } = config[health];
  return (
    <Badge className={className}>
      <Icon className="h-3 w-3 mr-1" />
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
      <span className="inline-flex items-center text-xs text-muted-foreground">
        <Minus className="h-3 w-3 mr-0.5" />
        {Math.abs(delta).toFixed(1)}%
      </span>
    );
  }
  
  if (isPositive) {
    return (
      <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400">
        <ArrowUpRight className="h-3 w-3 mr-0.5" />
        {Math.abs(delta).toFixed(1)}%
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center text-xs text-red-600 dark:text-red-400">
      <ArrowDownRight className="h-3 w-3 mr-0.5" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function KPICard({ 
  title, 
  value, 
  format = "number",
  metric,
  icon: Icon 
}: { 
  title: string; 
  value: number;
  format?: "number" | "currency" | "percent";
  metric: KPIMetric;
  icon: React.ElementType;
}) {
  const formatValue = (v: number) => {
    if (format === "currency") return `$${(v / 100).toLocaleString()}`;
    if (format === "percent") return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <HealthBadge health={metric.health} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatValue(value)}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex gap-3 mt-2">
          <span className="text-xs text-muted-foreground">
            WoW: <DeltaBadge delta={metric.deltaWoW} />
          </span>
          {metric.deltaMoM !== undefined && (
            <span className="text-xs text-muted-foreground">
              MoM: <DeltaBadge delta={metric.deltaMoM} />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminCockpit() {
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<SummaryData>({
    queryKey: ["/api/admin/cockpit/summary"],
    retry: false,
  });

  const { data: focus, isLoading: focusLoading, error: focusError } = useQuery<FocusData>({
    queryKey: ["/api/admin/cockpit/focus"],
    retry: false,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<{ alerts: Alert[] }>({
    queryKey: ["/api/admin/cockpit/alerts"],
    retry: false,
  });

  const { data: riskData } = useQuery<any>({
    queryKey: ["/api/admin/cockpit/risk-leakage"],
    retry: false,
  });

  const { data: revenueData } = useQuery<any>({
    queryKey: ["/api/admin/cockpit/revenue-payments"],
    retry: false,
  });

  const { data: funnelData } = useQuery<any>({
    queryKey: ["/api/admin/cockpit/activation-funnel"],
    retry: false,
  });

  const isAccessDenied = (summaryError as any)?.message?.includes("403") || 
                         (focusError as any)?.message?.includes("403");

  if (isAccessDenied) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" data-testid="page-access-denied">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view the admin cockpit.</p>
      </div>
    );
  }

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cockpit/refresh"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cockpit/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cockpit/focus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cockpit/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cockpit/risk-leakage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cockpit/revenue-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cockpit/activation-funnel"] });
      toast({ title: "Data refreshed" });
    },
    onError: () => {
      toast({ title: "Failed to refresh", variant: "destructive" });
    },
  });

  if (summaryLoading || focusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const healthColors = {
    green: "bg-green-500",
    yellow: "bg-yellow-500", 
    red: "bg-red-500",
  };

  return (
    <div className="min-h-screen bg-background pb-8" data-testid="page-admin-cockpit">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6" />
                Founder Cockpit
              </h1>
              <p className="text-slate-300 text-sm mt-1">Business health at a glance</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10" data-testid="button-user-ops">
                  <UserCog className="h-4 w-4 mr-2" />
                  User Ops
                </Button>
              </Link>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-4 space-y-6">
        {focus && (
          <Card className="border-2" style={{ borderColor: focus.healthState === 'green' ? '#22c55e' : focus.healthState === 'yellow' ? '#eab308' : '#ef4444' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Focus This Week
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${healthColors[focus.healthState]}`} />
                  <span className="text-sm font-medium capitalize">{focus.healthState} health</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Bottleneck: {focus.primaryBottleneck}
                  </Badge>
                  {focus.biggestFunnelLeak && (
                    <Badge variant="outline">
                      Leak: {focus.biggestFunnelLeak.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    Urgency: {focus.urgencyScore}/100
                  </Badge>
                </div>
                <p className="text-lg font-medium" data-testid="text-recommendation">
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
          <Card className="border-red-200 dark:border-red-900">
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
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900"
                  data-testid={`alert-${alert.key}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{alert.summary}</span>
                    <Badge variant="destructive" className="text-xs">
                      Severity: {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.explanation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {summary && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Key Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KPICard 
                title="Total Users" 
                value={summary.totalUsers.value}
                metric={summary.totalUsers}
                icon={Users}
              />
              <KPICard 
                title="Active (7d)" 
                value={summary.activeUsers7d.value}
                metric={summary.activeUsers7d}
                icon={Activity}
              />
              <KPICard 
                title="Active (30d)" 
                value={summary.activeUsers30d.value}
                metric={summary.activeUsers30d}
                icon={Activity}
              />
              <KPICard 
                title="Paying Customers" 
                value={summary.payingCustomers.value}
                metric={summary.payingCustomers}
                icon={DollarSign}
              />
              <KPICard 
                title="MRR" 
                value={summary.mrr.value}
                format="currency"
                metric={summary.mrr}
                icon={DollarSign}
              />
              <KPICard 
                title="Net Churn" 
                value={summary.netChurnPct.value}
                format="percent"
                metric={summary.netChurnPct}
                icon={TrendingDown}
              />
            </div>
          </div>
        )}

        {funnelData && funnelData.metrics && funnelData.metrics.length > 0 && (
          <Card className="border-2" style={{ 
            borderColor: funnelData.summary?.health === 'green' ? '#22c55e' : 
                         funnelData.summary?.health === 'yellow' ? '#eab308' : '#ef4444' 
          }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Activation Funnel
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${healthColors[(funnelData.summary?.health as keyof typeof healthColors) || 'green']}`} />
                  <span className="text-sm font-medium">{funnelData.totalUsers} users</span>
                </div>
              </div>
              <CardDescription>{funnelData.summary?.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {funnelData.metrics.map((metric: any) => (
                  <div 
                    key={metric.key} 
                    className="p-3 rounded-lg border bg-card"
                    data-testid={`funnel-metric-${metric.key}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{metric.label}</span>
                      <HealthBadge health={metric.health} />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold">
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
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {riskData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk & Leakage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Lead Conversion</span>
                  <span className="font-medium">
                    {riskData.leadLeakage?.conversionRate?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Invoice Payment Rate</span>
                  <span className="font-medium">
                    {riskData.invoiceLeakage?.paymentRate?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paying Users Inactive (7d)</span>
                  <span className="font-medium">{riskData.payingUsersInactive7d || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Churned (7d / 30d)</span>
                  <span className="font-medium">
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
                  <DollarSign className="h-4 w-4" />
                  Revenue & Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Invoices</span>
                  <span className="font-medium">
                    {revenueData.invoiceStats?.paid || 0} / {revenueData.invoiceStats?.total || 0} paid
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Overdue Invoices</span>
                  <span className="font-medium text-red-600">{revenueData.invoiceStats?.overdue || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Failed Payments (24h)</span>
                  <span className="font-medium">{revenueData.failedPayments?.last24h || 0}</span>
                </div>
                <Separator />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => window.open(revenueData.links?.stripeDashboard, "_blank")}
                  data-testid="button-open-stripe"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Stripe Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
