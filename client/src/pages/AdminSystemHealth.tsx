import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";

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
    healthy: { label: "Healthy", icon: CheckCircle, className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    degraded: { label: "Degraded", icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    down: { label: "Down", icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  };
  const { label, icon: Icon, className } = config[status];
  return (
    <Badge className={className}>
      <Icon className="h-3 w-3 mr-1" />
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
  return <Icon className="h-5 w-5 text-muted-foreground" />;
}

export default function AdminSystemHealth() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system/status"],
    refetchInterval: 30000,
  });

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<JobsStatus>({
    queryKey: ["/api/admin/system/jobs"],
    refetchInterval: 60000,
  });

  const { data: errors, isLoading: errorsLoading, refetch: refetchErrors } = useQuery<ErrorRates>({
    queryKey: ["/api/admin/system/errors"],
    refetchInterval: 60000,
  });

  const handleRefreshAll = () => {
    refetchStatus();
    refetchJobs();
    refetchErrors();
    queryClient.invalidateQueries({ queryKey: ["/api/admin/system"] });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/cockpit">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">System Health</h1>
              <p className="text-muted-foreground">Monitor infrastructure and background jobs</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Status
            </CardTitle>
            <CardDescription>
              {status?.timestamp ? `Last checked: ${new Date(status.timestamp).toLocaleString()}` : "Checking..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : status ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Overall Status:</span>
                  <StatusBadge status={status.overall} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(status.checks).map(([service, check]) => (
                    <div 
                      key={service} 
                      className="flex items-center justify-between p-4 rounded-lg border"
                      data-testid={`service-${service}`}
                    >
                      <div className="flex items-center gap-3">
                        <ServiceIcon service={service} />
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
              <p className="text-muted-foreground">Failed to load status</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog className="h-5 w-5" />
              Background Jobs
            </CardTitle>
            <CardDescription>Scheduler status and event activity</CardDescription>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Events (Last Hour)</p>
                    <p className="text-2xl font-bold">{jobs.eventActivity.lastHour.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Events (Last 24h)</p>
                    <p className="text-2xl font-bold">{jobs.eventActivity.lastDay.toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Schedulers</h3>
                  <div className="grid gap-2">
                    {jobs.schedulers.map((scheduler) => (
                      <div 
                        key={scheduler.name}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        data-testid={`scheduler-${scheduler.name.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div>
                          <p className="font-medium">{scheduler.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {scheduler.interval}
                          </p>
                        </div>
                        <Badge variant={scheduler.isRunning ? "default" : "secondary"}>
                          {scheduler.isRunning ? "Running" : "Idle"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Failed to load job status</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Rates
            </CardTitle>
            <CardDescription>API and system error tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {errorsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : errors ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Hourly Error Rate</p>
                  <p className="text-2xl font-bold">{errors.hourly.rate}</p>
                  <p className="text-xs text-muted-foreground">
                    {errors.hourly.errors} errors / {errors.hourly.total} events
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Daily Error Rate</p>
                  <p className="text-2xl font-bold">{errors.daily.rate}</p>
                  <p className="text-xs text-muted-foreground">
                    {errors.daily.errors} errors / {errors.daily.total} events
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Failed to load error rates</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
