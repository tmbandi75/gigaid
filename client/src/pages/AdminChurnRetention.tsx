import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Shield,
  Users,
  AlertTriangle,
  TrendingDown,
  Activity,
  DollarSign,
  Frown,
  Send,
  Gift,
  Phone,
  Mail,
  UserCheck,
  Clock,
  ChevronLeft,
  ToggleLeft,
  ToggleRight,
  Zap,
  Target,
  ArrowLeft,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "at-risk" | "user-detail" | "playbooks";

interface TierDistribution {
  Healthy: number;
  Drifting: number;
  AtRisk: number;
  Critical: number;
}

interface TrendDay {
  date: string;
  Healthy: number;
  Drifting: number;
  AtRisk: number;
  Critical: number;
}

interface ChurnDriver {
  signal: string;
  avgScore: number;
  category: string;
}

interface OverviewData {
  distribution: TierDistribution;
  trends: TrendDay[];
  topDrivers: ChurnDriver[];
}

interface ChurnUser {
  userId: string;
  name: string;
  email: string;
  score: number;
  tier: string;
  lastLogin: string | null;
  jobs7d: number;
  revenue30d: number;
  noPay14d: boolean;
  failedPayments: number;
  blocks7d: number;
  lastAction: string | null;
}

interface SignalPoint {
  signal: string;
  points: number;
  category: string;
}

interface RetentionAction {
  id: string;
  actionType: string;
  channel: string;
  status: string;
  createdAt: string;
  notes?: string;
}

interface UserDetail {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  plan: string;
  score: number;
  tier: string;
  signals: SignalPoint[];
  actions: RetentionAction[];
}

interface Playbook {
  id: string;
  tier: string;
  priority: number;
  actionType: string;
  channel: string;
  templateKey: string;
  delayHours: number;
  enabled: boolean;
}

function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { className: string }> = {
    Healthy: { className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    Drifting: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    AtRisk: { className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
    Critical: { className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  };
  const c = config[tier] || config.Healthy;
  return (
    <Badge variant="outline" className={cn("font-medium", c.className)}>
      {tier}
    </Badge>
  );
}

function tierIcon(tier: string) {
  switch (tier) {
    case "Healthy": return <Shield className="h-5 w-5 text-emerald-500" />;
    case "Drifting": return <Activity className="h-5 w-5 text-amber-500" />;
    case "AtRisk": return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    case "Critical": return <Frown className="h-5 w-5 text-red-500" />;
    default: return <Users className="h-5 w-5" />;
  }
}

function tierCardBg(tier: string) {
  switch (tier) {
    case "Healthy": return "bg-emerald-500";
    case "Drifting": return "bg-amber-500";
    case "AtRisk": return "bg-orange-500";
    case "Critical": return "bg-red-500";
    default: return "bg-muted";
  }
}

function OverviewTab() {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: QUERY_KEYS.adminChurnOverview(),
    queryFn: () => apiFetch("/api/admin/churn/overview"),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-center py-10">No data available.</p>;
  }

  const tiers: (keyof TierDistribution)[] = ["Healthy", "Drifting", "AtRisk", "Critical"];
  const categories = ["Activity", "Revenue", "Friction", "Intent"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-violet-500" />
          Risk Distribution
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => (
            <Card key={tier} className="relative overflow-hidden border-0 shadow-sm" data-testid={`card-tier-${tier.toLowerCase()}`}>
              <div className={cn("absolute inset-0 opacity-5", tierCardBg(tier))} />
              <CardContent className="p-5 relative">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">{tier}</p>
                    <p className="text-3xl font-bold tracking-tight">{data.distribution[tier] ?? 0}</p>
                  </div>
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center",
                    tier === "Healthy" ? "bg-emerald-500/10" :
                    tier === "Drifting" ? "bg-amber-500/10" :
                    tier === "AtRisk" ? "bg-orange-500/10" : "bg-red-500/10"
                  )}>
                    {tierIcon(tier)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {data.trends && data.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-5 w-5 text-violet-500" />
              14-Day Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-trends">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Date</th>
                    {tiers.map((t) => (
                      <th key={t} className="text-right py-2 px-2 font-medium text-muted-foreground">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.trends.map((day) => (
                    <tr key={day.date} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">{day.Healthy}</td>
                      <td className="py-2 px-2 text-right text-amber-600 dark:text-amber-400 font-medium">{day.Drifting}</td>
                      <td className="py-2 px-2 text-right text-orange-600 dark:text-orange-400 font-medium">{day.AtRisk}</td>
                      <td className="py-2 px-2 text-right text-red-600 dark:text-red-400 font-medium">{day.Critical}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.topDrivers && data.topDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-violet-500" />
              Top Churn Drivers (AtRisk + Critical)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topDrivers.map((driver) => (
                <div key={driver.signal} className="flex items-center justify-between" data-testid={`driver-${driver.signal}`}>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {driver.category}
                    </Badge>
                    <span className="text-sm font-medium">{driver.signal}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          categories.indexOf(driver.category) === 0 ? "bg-blue-500" :
                          categories.indexOf(driver.category) === 1 ? "bg-emerald-500" :
                          categories.indexOf(driver.category) === 2 ? "bg-orange-500" : "bg-violet-500"
                        )}
                        style={{ width: `${Math.min(driver.avgScore * 10, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{driver.avgScore.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AtRiskUsersTab({
  onSelectUser,
}: {
  onSelectUser: (userId: string) => void;
}) {
  const { toast } = useToast();
  const [tierFilter, setTierFilter] = useState("All");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");

  const queryParams = new URLSearchParams();
  if (tierFilter !== "All") queryParams.set("tier", tierFilter);
  if (minScore) queryParams.set("minScore", minScore);
  if (maxScore) queryParams.set("maxScore", maxScore);
  const qs = queryParams.toString();

  const { data, isLoading } = useQuery<{ users: ChurnUser[] }>({
    queryKey: QUERY_KEYS.adminChurnUsers(qs),
    queryFn: () => apiFetch(`/api/admin/churn/users?${qs}`),
    retry: false,
  });

  const nudgeMutation = useApiMutation(
    (vars: { userId: string }) =>
      apiFetch("/api/admin/churn/action", {
        method: "POST",
        body: JSON.stringify({ userId: vars.userId, actionType: "nudge", channel: "email" }),
      }),
    [QUERY_KEYS.adminChurnUsers(qs), QUERY_KEYS.adminChurnOverview()],
    {
      onSuccess: () => {
        toast({ title: "Nudge sent successfully" });
      },
      onError: () => {
        toast({ title: "Failed to send nudge", variant: "destructive" });
      },
    }
  );

  const trialMutation = useApiMutation(
    (vars: { userId: string }) =>
      apiFetch("/api/admin/churn/action", {
        method: "POST",
        body: JSON.stringify({ userId: vars.userId, actionType: "grant_trial", channel: "system" }),
      }),
    [QUERY_KEYS.adminChurnUsers(qs), QUERY_KEYS.adminChurnOverview()],
    {
      onSuccess: () => {
        toast({ title: "Trial granted successfully" });
      },
      onError: () => {
        toast({ title: "Failed to grant trial", variant: "destructive" });
      },
    }
  );

  const contactMutation = useApiMutation(
    (vars: { userId: string }) =>
      apiFetch("/api/admin/churn/action", {
        method: "POST",
        body: JSON.stringify({ userId: vars.userId, actionType: "mark_contacted", channel: "manual" }),
      }),
    [QUERY_KEYS.adminChurnUsers(qs), QUERY_KEYS.adminChurnOverview()],
    {
      onSuccess: () => {
        toast({ title: "User marked as contacted" });
      },
      onError: () => {
        toast({ title: "Failed to mark contacted", variant: "destructive" });
      },
    }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Tier</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                data-testid="select-tier-filter"
              >
                <option value="All">All</option>
                <option value="Drifting">Drifting</option>
                <option value="AtRisk">AtRisk</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Min Score</label>
              <input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="0"
                className="h-9 w-20 rounded-md border bg-background px-3 text-sm"
                data-testid="input-min-score"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Max Score</label>
              <input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="100"
                className="h-9 w-20 rounded-md border bg-background px-3 text-sm"
                data-testid="input-max-score"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-users">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Score</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Tier</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Last Login</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Jobs 7d</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Revenue 30d</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">No Pay 14d</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Failed Payments</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Blocks 7d</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Last Action</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users && data.users.length > 0 ? (
                    data.users.map((user) => (
                      <tr
                        key={user.userId}
                        className="border-b last:border-0 hover-elevate cursor-pointer"
                        onClick={() => onSelectUser(user.userId)}
                        data-testid={`row-user-${user.userId}`}
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-bold">{user.score}</td>
                        <td className="py-3 px-2 text-center"><TierBadge tier={user.tier} /></td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                        </td>
                        <td className="py-3 px-2 text-right">{user.jobs7d}</td>
                        <td className="py-3 px-2 text-right">${(user.revenue30d / 100).toFixed(0)}</td>
                        <td className="py-3 px-2 text-center">
                          {user.noPay14d ? (
                            <Badge variant="destructive" className="text-xs">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">{user.failedPayments}</td>
                        <td className="py-3 px-2 text-right">{user.blocks7d}</td>
                        <td className="py-3 px-2 text-muted-foreground text-xs">
                          {user.lastAction || "None"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => nudgeMutation.mutate({ userId: user.userId })}
                              disabled={nudgeMutation.isPending}
                              data-testid={`button-send-nudge-${user.userId}`}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Nudge
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => trialMutation.mutate({ userId: user.userId })}
                              disabled={trialMutation.isPending}
                              data-testid={`button-grant-trial-${user.userId}`}
                            >
                              <Gift className="h-3 w-3 mr-1" />
                              Trial
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => contactMutation.mutate({ userId: user.userId })}
                              disabled={contactMutation.isPending}
                              data-testid={`button-mark-contacted-${user.userId}`}
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Contacted
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-muted-foreground">
                        No at-risk users found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserDetailTab({
  userId,
  onBack,
}: {
  userId: string;
  onBack: () => void;
}) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: QUERY_KEYS.adminChurnUser(userId),
    queryFn: () => apiFetch(`/api/admin/churn/user/${userId}`),
    retry: false,
  });

  const actionMutation = useApiMutation(
    (vars: { actionType: string; channel: string }) =>
      apiFetch("/api/admin/churn/action", {
        method: "POST",
        body: JSON.stringify({ userId, actionType: vars.actionType, channel: vars.channel }),
      }),
    [QUERY_KEYS.adminChurnUser(userId), QUERY_KEYS.adminChurnUsers(), QUERY_KEYS.adminChurnOverview()],
    {
      onSuccess: () => {
        toast({ title: "Action performed successfully" });
      },
      onError: () => {
        toast({ title: "Action failed", variant: "destructive" });
      },
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">User not found.</p>
        <Button variant="outline" onClick={onBack} className="mt-4" data-testid="button-back-to-users">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>
    );
  }

  const categoryGroups: Record<string, SignalPoint[]> = {};
  (data.signals || []).forEach((s) => {
    if (!categoryGroups[s.category]) categoryGroups[s.category] = [];
    categoryGroups[s.category].push(s);
  });

  const categoryIcons: Record<string, typeof Activity> = {
    Activity: Activity,
    Revenue: DollarSign,
    Friction: AlertTriangle,
    Intent: Target,
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} data-testid="button-back-to-users">
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to At-Risk Users
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              User Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium" data-testid="text-user-name">{data.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium flex items-center gap-1" data-testid="text-user-email">
                <Mail className="h-3 w-3" />
                {data.email}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Phone</span>
              <span className="text-sm font-medium flex items-center gap-1" data-testid="text-user-phone">
                <Phone className="h-3 w-3" />
                {data.phone || "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <Badge variant="secondary" data-testid="text-user-plan">{data.plan}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Risk Score</span>
              <span className="text-lg font-bold" data-testid="text-user-score">{data.score}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tier</span>
              <TierBadge tier={data.tier} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-violet-500" />
              Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(categoryGroups).map(([category, signals]) => {
              const Icon = categoryIcons[category] || Activity;
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{category}</span>
                  </div>
                  <div className="space-y-1 pl-6">
                    {signals.map((sig) => (
                      <div key={sig.signal} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{sig.signal}</span>
                        <span className={cn(
                          "font-medium",
                          sig.points > 5 ? "text-red-600 dark:text-red-400" :
                          sig.points > 2 ? "text-orange-600 dark:text-orange-400" :
                          "text-muted-foreground"
                        )}>
                          +{sig.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {Object.keys(categoryGroups).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No signal data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5 text-violet-500" />
            Action History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.actions && data.actions.length > 0 ? (
            <div className="space-y-3">
              {data.actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border"
                  data-testid={`action-history-${action.id}`}
                >
                  <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{action.actionType}</span>
                      <Badge variant="secondary" className="text-xs">{action.channel}</Badge>
                      <Badge
                        variant={action.status === "completed" ? "default" : action.status === "failed" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {action.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(action.createdAt).toLocaleString()}
                    </p>
                    {action.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{action.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No actions recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-5 w-5 text-violet-500" />
            Manual Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate({ actionType: "nudge", channel: "email" })}
              disabled={actionMutation.isPending}
              data-testid="button-send-nudge"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Nudge
            </Button>
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate({ actionType: "grant_trial_7d", channel: "system" })}
              disabled={actionMutation.isPending}
              data-testid="button-grant-trial"
            >
              <Gift className="h-4 w-4 mr-2" />
              Grant 7-Day Trial
            </Button>
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate({ actionType: "grant_credit_1mo", channel: "system" })}
              disabled={actionMutation.isPending}
              data-testid="button-grant-credit"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Grant 1-Month Credit
            </Button>
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate({ actionType: "enable_lite_mode", channel: "system" })}
              disabled={actionMutation.isPending}
              data-testid="button-enable-lite"
            >
              <Shield className="h-4 w-4 mr-2" />
              Enable Lite Mode
            </Button>
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate({ actionType: "mark_contacted", channel: "manual" })}
              disabled={actionMutation.isPending}
              data-testid="button-mark-contacted"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Mark Contacted
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlaybooksTab() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ playbooks: Playbook[] }>({
    queryKey: QUERY_KEYS.adminChurnPlaybooks(),
    queryFn: () => apiFetch("/api/admin/churn/playbooks"),
    retry: false,
  });

  const toggleMutation = useApiMutation(
    (vars: { id: string; enabled: boolean }) =>
      apiFetch(`/api/admin/churn/playbooks/${vars.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: vars.enabled }),
      }),
    [QUERY_KEYS.adminChurnPlaybooks()],
    {
      onSuccess: () => {
        toast({ title: "Playbook updated" });
      },
      onError: () => {
        toast({ title: "Failed to update playbook", variant: "destructive" });
      },
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-5 w-5 text-violet-500" />
          Retention Playbooks
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-playbooks">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tier</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Priority</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Action Type</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Channel</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Template Key</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Delay Hours</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {data?.playbooks && data.playbooks.length > 0 ? (
                data.playbooks.map((pb) => (
                  <tr key={pb.id} className="border-b last:border-0" data-testid={`row-playbook-${pb.id}`}>
                    <td className="py-3 px-4"><TierBadge tier={pb.tier} /></td>
                    <td className="py-3 px-2 text-right font-medium">{pb.priority}</td>
                    <td className="py-3 px-2">{pb.actionType}</td>
                    <td className="py-3 px-2">
                      <Badge variant="secondary" className="text-xs">{pb.channel}</Badge>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{pb.templateKey}</td>
                    <td className="py-3 px-2 text-right">{pb.delayHours}h</td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleMutation.mutate({ id: pb.id, enabled: !pb.enabled })}
                        disabled={toggleMutation.isPending}
                        data-testid={`button-toggle-playbook-${pb.id}`}
                      >
                        {pb.enabled ? (
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No playbooks configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "at-risk", label: "At-Risk Users", icon: AlertTriangle },
  { key: "user-detail", label: "User Detail", icon: Users },
  { key: "playbooks", label: "Playbooks", icon: Target },
];

export default function AdminChurnRetention() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab("user-detail");
  };

  const handleBackToUsers = () => {
    setActiveTab("at-risk");
  };

  const visibleTabs = tabs.filter(
    (t) => t.key !== "user-detail" || selectedUserId
  );

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="page-admin-churn-retention">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-violet-500" />
            Churn & Retention
          </h1>
          <p className="text-muted-foreground mt-1">Monitor churn risk and manage retention actions</p>
        </div>

        <div className="flex flex-wrap gap-1 border-b">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                  isActive
                    ? "border-violet-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.key}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "at-risk" && <AtRiskUsersTab onSelectUser={handleSelectUser} />}
        {activeTab === "user-detail" && selectedUserId && (
          <UserDetailTab userId={selectedUserId} onBack={handleBackToUsers} />
        )}
        {activeTab === "playbooks" && <PlaybooksTab />}
      </div>
    </AdminLayout>
  );
}
