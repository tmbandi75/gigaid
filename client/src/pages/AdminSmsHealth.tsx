import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { getAuthToken } from "@/lib/authToken";
import {
  AlertTriangle,
  BellOff,
  Loader2,
  MessageSquareOff,
  RefreshCw,
  ShieldOff,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface RecentOptOut {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  smsOptOutAt: string | null;
}

interface SmsHealthSummary {
  windowDays: number;
  canceled: { total: number; byReason: Record<string, number> };
  failed: { total: number; byReason: Record<string, number> };
  optOuts: { total: number; last7d: number; recent: RecentOptOut[] };
}

interface OptOutUser {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  phone: string | null;
  smsOptOutAt: string | null;
}

const REASON_LABELS: Record<string, string> = {
  user_opted_out: "User opted out (STOP)",
  rate_limited: "Rate limited",
  action_taken: "Action already taken",
  missing_booking_page: "Missing booking page",
  user_not_found: "User not found",
  other: "Other / unstructured",
  unknown: "No reason recorded",
};

async function authedFetch(url: string) {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { credentials: "include", headers });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function ReasonRow({
  reason,
  count,
  total,
}: {
  reason: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      className="flex items-center justify-between text-sm"
      data-testid={`row-reason-${reason}`}
    >
      <div className="flex-1 pr-3">
        <div className="font-medium">{REASON_LABELS[reason] || reason}</div>
        <div className="h-1.5 mt-1 rounded bg-muted overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-20 text-right">
        <div className="font-semibold tabular-nums" data-testid={`text-reason-count-${reason}`}>
          {count}
        </div>
        <div className="text-xs text-muted-foreground">{pct}%</div>
      </div>
    </div>
  );
}

export default function AdminSmsHealth() {
  const summaryQuery = useQuery<SmsHealthSummary>({
    queryKey: QUERY_KEYS.adminSmsHealthSummary(),
    queryFn: () => authedFetch("/api/admin/sms/summary"),
  });

  const optOutsQuery = useQuery<{ users: OptOutUser[] }>({
    queryKey: QUERY_KEYS.adminSmsOptOuts(),
    queryFn: () => authedFetch("/api/admin/sms/opt-outs?limit=100"),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSmsHealthSummary() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSmsOptOuts() });
  };

  const summary = summaryQuery.data;
  const canceledEntries = summary
    ? Object.entries(summary.canceled.byReason).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-admin-sms-health">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquareOff className="h-6 w-6" />
            SMS Deliverability Health
          </h1>
          <p className="text-sm text-muted-foreground">
            How often send-time guards fire, plus the current opt-out roster.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          data-testid="button-refresh-sms-health"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="tile-canceled-sms">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldOff className="h-4 w-4" />
              SMS canceled in last 7 days
            </CardTitle>
            <CardDescription>
              Outbound messages canceled by send-time guards, grouped by reason.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !summary ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div
                    className="text-3xl font-bold tabular-nums"
                    data-testid="text-canceled-total"
                  >
                    {summary.canceled.total}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    total canceled
                  </div>
                </div>
                {canceledEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing canceled in the last 7 days.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {canceledEntries.map(([reason, count]) => (
                      <ReasonRow
                        key={reason}
                        reason={reason}
                        count={count}
                        total={summary.canceled.total}
                      />
                    ))}
                  </div>
                )}
                {summary.failed.total > 0 && (
                  <div
                    className="border-t pt-3 text-xs text-muted-foreground flex items-start gap-2"
                    data-testid="text-failed-note"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Plus <strong>{summary.failed.total}</strong> failed sends in
                      the same window (carrier/transport errors, not guards).
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="tile-opt-outs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellOff className="h-4 w-4" />
              SMS opt-outs
            </CardTitle>
            <CardDescription>
              Users with <code>smsOptOut=true</code>, plus the most recent
              timestamps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !summary ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end gap-6">
                  <div>
                    <div
                      className="text-3xl font-bold tabular-nums"
                      data-testid="text-optout-total"
                    >
                      {summary.optOuts.total}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      total opted out
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-2xl font-semibold tabular-nums"
                      data-testid="text-optout-last7d"
                    >
                      {summary.optOuts.last7d}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      in last 7 days
                    </div>
                  </div>
                </div>
                {summary.optOuts.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No opt-outs recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Most recent
                    </div>
                    <div className="space-y-1">
                      {summary.optOuts.recent.map((u) => (
                        <Link
                          key={u.id}
                          href={`/admin/users/${u.id}`}
                          data-testid={`link-recent-optout-${u.id}`}
                        >
                          <div className="flex items-center justify-between text-sm rounded-md p-2 hover-elevate">
                            <div className="min-w-0 pr-2">
                              <div className="font-medium truncate">
                                {u.name || u.username || u.email || u.id}
                              </div>
                              {u.email && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {u.email}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(u.smsOptOutAt)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-optout-roster">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All opted-out users</CardTitle>
          <CardDescription>
            Up to 100 most recent. Click a row to open the user detail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {optOutsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !optOutsQuery.data || optOutsQuery.data.users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No opted-out users.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 pr-3">Opted out at</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {optOutsQuery.data.users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t"
                      data-testid={`row-optout-${u.id}`}
                    >
                      <td className="py-2 pr-3 font-medium">
                        {u.name || u.username || u.id}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {u.email || "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {u.phone || "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {formatDate(u.smsOptOutAt)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Link href={`/admin/users/${u.id}`}>
                          <Badge
                            variant="outline"
                            className="cursor-pointer"
                            data-testid={`link-optout-user-${u.id}`}
                          >
                            View
                          </Badge>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
