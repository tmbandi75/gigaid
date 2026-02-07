import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Database, 
  CreditCard, 
  Flame,
  Cog,
  RefreshCw,
  Loader2,
  Activity,
  Clock,
  Sparkles,
  Zap,
  Server,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface HealthCheck {
  status: "healthy" | "degraded" | "down";
  message?: string;
  latencyMs?: number;
}

interface SystemStatus {
  overall: "healthy" | "degraded" | "down";
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

interface Scheduler {
  name: string;
  interval: string;
  isRunning: boolean;
}

interface JobsStatus {
  schedulers: Scheduler[];
  eventActivity: {
    lastHour: number;
    lastDay: number;
  };
}

interface ErrorRates {
  hourly: {
    errors: number;
    total: number;
    rate: string;
  };
  daily: {
    errors: number;
    total: number;
    rate: string;
  };
}

function StatusBadge({ status }: { status: "healthy" | "degraded" | "down" }) {
  const config = {
    healthy: { label: "Healthy", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    degraded: { label: "Degraded", icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    down: { label: "Down", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
  };
  const { label, icon: Icon, className } = config[status];
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function ServiceIcon({ service }: { service: string }) {
  const icons: Record<string, any> = {
    database: Database,
    stripe: CreditCard,
    firebase: Flame,
    backgroundJobs: Cog,
  };
  const Icon = icons[service] || Activity;
  return <Icon className="h-5 w-5" />;
}

export default function AdminSystemHealth() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<SystemStatus>({
    queryKey: QUERY_KEYS.adminSystemStatus(),
    refetchInterval: 30000,
  });

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<JobsStatus>({
    queryKey: QUERY_KEYS.adminSystemJobs(),
    refetchInterval: 60000,
  });

  const { data: errors, isLoading: errorsLoading, refetch: refetchErrors } = useQuery<ErrorRates>({
    queryKey: QUERY_KEYS.adminSystemErrors(),
    refetchInterval: 60000,
  });

  const handleRefreshAll = () => {
    refetchStatus();
    refetchJobs();
    refetchErrors();
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSystem() });
  };

  return (
    <div className="space-y-6" data-testid="page-admin-system-health">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            System Health
          </h1>
          <p className="text-muted-foreground mt-1">Monitor infrastructure and background jobs</p>
        </div>
        <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-violet-500" />
            <CardTitle>System Status</CardTitle>
          </div>
          <CardDescription>
            {status?.timestamp ? `Last checked: ${new Date(status.timestamp).toLocaleString()}` : "Checking..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground mt-3">Checking system status...</p>
            </div>
          ) : status ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30">
                <span className="font-medium">Overall Status:</span>
                <StatusBadge status={status.overall} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(status.checks).map(([service, check]) => (
                  <div 
                    key={service} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border",
                      check.status === "healthy" ? "bg-emerald-500/5 border-emerald-500/10" :
                      check.status === "degraded" ? "bg-amber-500/5 border-amber-500/10" :
                      "bg-red-500/5 border-red-500/10"
                    )}
                    data-testid={`service-${service}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        check.status === "healthy" ? "bg-emerald-500/10" :
                        check.status === "degraded" ? "bg-amber-500/10" : "bg-red-500/10"
                      )}>
                        <ServiceIcon service={service} />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{service.replace(/([A-Z])/g, ' $1').trim()}</p>
                        {check.message && (
                          <p className="text-sm text-muted-foreground">{check.message}</p>
                        )}
                        {check.latencyMs !== undefined && (
                          <p className="text-xs text-muted-foreground">{check.latencyMs}ms</p>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={check.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-muted-foreground">Failed to load status</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cog className="h-5 w-5 text-violet-500" />
            <CardTitle>Background Jobs</CardTitle>
          </div>
          <CardDescription>Scheduler status and event activity</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground mt-3">Loading job status...</p>
            </div>
          ) : jobs ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-5 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="h-5 w-5 text-violet-500" />
                    <p className="text-sm text-muted-foreground">Events (Last Hour)</p>
                  </div>
                  <p className="text-3xl font-bold">{jobs.eventActivity.lastHour.toLocaleString()}</p>
                </div>
                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <p className="text-sm text-muted-foreground">Events (Last 24h)</p>
                  </div>
                  <p className="text-3xl font-bold">{jobs.eventActivity.lastDay.toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Schedulers
                </h3>
                <div className="grid gap-3">
                  {jobs.schedulers.map((scheduler) => (
                    <div 
                      key={scheduler.name}
                      className="flex items-center justify-between p-4 rounded-xl border bg-card"
                      data-testid={`scheduler-${scheduler.name.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <div>
                        <p className="font-medium">{scheduler.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {scheduler.interval}
                        </p>
                      </div>
                      <Badge 
                        variant="outline"
                        className={cn(
                          scheduler.isRunning 
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                            : "bg-slate-500/10 text-slate-600 border-slate-500/20"
                        )}
                      >
                        {scheduler.isRunning ? "Running" : "Idle"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Cog className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Failed to load job status</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle>Error Rates</CardTitle>
          </div>
          <CardDescription>API and system error tracking</CardDescription>
        </CardHeader>
        <CardContent>
          {errorsLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground mt-3">Loading error rates...</p>
            </div>
          ) : errors ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-5 rounded-xl border bg-card">
                <p className="text-sm text-muted-foreground mb-2">Hourly Error Rate</p>
                <p className="text-3xl font-bold">{errors.hourly.rate}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {errors.hourly.errors} errors / {errors.hourly.total} events
                </p>
              </div>
              <div className="p-5 rounded-xl border bg-card">
                <p className="text-sm text-muted-foreground mb-2">Daily Error Rate</p>
                <p className="text-3xl font-bold">{errors.daily.rate}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {errors.daily.errors} errors / {errors.daily.total} events
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Failed to load error rates</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
