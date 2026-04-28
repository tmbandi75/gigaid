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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { getAuthToken } from "@/lib/authToken";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  BellOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  HelpCircle,
  Loader2,
  MessageSquareOff,
  PhoneOff,
  RefreshCw,
  Search,
  ShieldOff,
  History,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface RecentOptOut {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  smsOptOutAt: string | null;
}

interface RecentConfirmFailure {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  phone: string | null;
  smsConfirmationLastFailureAt: string | null;
  smsConfirmationLastFailureCode: string | null;
  smsConfirmationLastFailureMessage: string | null;
  smsConfirmationFailureCount: number | null;
  smsConfirmationFirstFailureAt: string | null;
  phoneUnreachable: boolean | null;
  phoneUnreachableAt: string | null;
}

interface UnmatchedOptOut {
  id: string;
  fromPhoneMasked: string;
  resolution: "unmatched" | "ambiguous" | "matched";
  body: string | null;
  createdAt: string;
}

interface UnmatchedOptOutDetail extends UnmatchedOptOut {
  fromPhoneRaw: string;
  userId: string | null;
  twilioSid: string | null;
}

interface SmsHealthSummary {
  windowDays: number;
  canceled: { total: number; byReason: Record<string, number> };
  failed: { total: number; byReason: Record<string, number> };
  optOuts: { total: number; last7d: number; recent: RecentOptOut[] };
  confirmationFailures: {
    total: number;
    unreachable: number;
    recent: RecentConfirmFailure[];
  };
  unmatchedOptOuts: { last7d: number; recent: UnmatchedOptOut[] };
}

interface ClearPhoneAuditEvent {
  id: string;
  createdAt: string;
  actorUserId: string;
  actorEmail: string | null;
  targetUserId: string | null;
  targetUser: {
    id: string;
    email: string | null;
    username: string | null;
    name: string | null;
  } | null;
  reason: string;
  source: string;
  previousPhoneE164: string | null;
}

interface ClearPhoneAuditResponse {
  events: ClearPhoneAuditEvent[];
  pagination: { total: number; limit: number; offset: number };
}

interface OptOutUser {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  phone: string | null;
  smsOptOutAt: string | null;
}

interface DuplicatePhoneUser {
  id: string;
  phoneE164: string | null;
  email?: string | null;
  username?: string | null;
  name?: string | null;
  lastActiveAt?: string | null;
}

interface DuplicatePhoneGroup {
  phoneE164: string;
  userCount: number;
  users: DuplicatePhoneUser[];
}

interface DuplicatePhonesResponse {
  groupCount: number;
  affectedUserCount: number;
  groups: DuplicatePhoneGroup[];
}

interface ClearPhoneTarget {
  userId: string;
  phoneE164: string;
  label: string;
}

interface ClearUnreachableTarget {
  userId: string;
  label: string;
  phone: string | null;
  failureCount: number;
}

const REASON_LABELS: Record<string, string> = {
  user_opted_out: "User opted out (STOP)",
  phone_unreachable: "Phone unreachable (auto-paused)",
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

const PAGE_SIZE = 50;

type OptOutSortKey =
  | "optOutAt_desc"
  | "optOutAt_asc"
  | "name_asc"
  | "name_desc"
  | "email_asc"
  | "email_desc";

const DEFAULT_OPT_OUT_SORT: OptOutSortKey = "optOutAt_desc";

const VALID_OPT_OUT_SORTS: ReadonlySet<OptOutSortKey> = new Set<OptOutSortKey>([
  "optOutAt_desc",
  "optOutAt_asc",
  "name_asc",
  "name_desc",
  "email_asc",
  "email_desc",
]);

type SortField = "optOutAt" | "name" | "email";

function parseSort(value: OptOutSortKey): { field: SortField; dir: "asc" | "desc" } {
  const [field, dir] = value.split("_") as [SortField, "asc" | "desc"];
  return { field, dir };
}

function buildSortKey(field: SortField, dir: "asc" | "desc"): OptOutSortKey {
  return `${field}_${dir}` as OptOutSortKey;
}

interface OptOutsResponse {
  users: OptOutUser[];
  sort?: OptOutSortKey;
  pagination: { total: number; limit: number; offset: number };
}

function SortableHeader({
  label,
  field,
  sortState,
  onToggle,
}: {
  label: string;
  field: SortField;
  sortState: { field: SortField; dir: "asc" | "desc" };
  onToggle: (field: SortField) => void;
}) {
  const active = sortState.field === field;
  const Icon = !active
    ? ArrowUpDown
    : sortState.dir === "asc"
      ? ChevronUp
      : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={`inline-flex items-center gap-1 uppercase tracking-wide text-xs font-medium hover:text-foreground transition-colors ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
      data-testid={`button-sort-${field}`}
    >
      {label}
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function ariaSortFor(
  field: SortField,
  sortState: { field: SortField; dir: "asc" | "desc" },
): "ascending" | "descending" | "none" {
  if (sortState.field !== field) return "none";
  return sortState.dir === "asc" ? "ascending" : "descending";
}

export default function AdminSmsHealth() {
  const [showUnmatchedDetail, setShowUnmatchedDetail] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);
  const [clearAuditPage, setClearAuditPage] = useState(1);
  const [sort, setSort] = useState<OptOutSortKey>(DEFAULT_OPT_OUT_SORT);

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (since) params.set("since", since);
    if (until) {
      // Make `until` inclusive of the selected day.
      params.set("until", `${until}T23:59:59.999Z`);
    }
    if (VALID_OPT_OUT_SORTS.has(sort) && sort !== DEFAULT_OPT_OUT_SORT) {
      params.set("sort", sort);
    }
    return params;
  }, [search, since, until, sort]);

  const optOutQueryParams = useMemo(() => {
    const params = new URLSearchParams(filterParams);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));
    return params.toString();
  }, [filterParams, page]);

  const sortState = useMemo(() => parseSort(sort), [sort]);

  const toggleSort = (field: SortField) => {
    setPage(1);
    setSort((current) => {
      const parsed = parseSort(current);
      if (parsed.field !== field) {
        // First click on a different column: pick a sensible default direction.
        return buildSortKey(field, field === "optOutAt" ? "desc" : "asc");
      }
      return buildSortKey(field, parsed.dir === "asc" ? "desc" : "asc");
    });
  };

  const summaryQuery = useQuery<SmsHealthSummary>({
    queryKey: QUERY_KEYS.adminSmsHealthSummary(),
    queryFn: () => authedFetch("/api/admin/sms/summary"),
  });

  const optOutsQuery = useQuery<OptOutsResponse>({
    queryKey: QUERY_KEYS.adminSmsOptOuts(optOutQueryParams),
    queryFn: () => authedFetch(`/api/admin/sms/opt-outs?${optOutQueryParams}`),
  });

  const CLEAR_AUDIT_PAGE_SIZE = 25;
  const clearAuditQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(CLEAR_AUDIT_PAGE_SIZE));
    params.set("offset", String((clearAuditPage - 1) * CLEAR_AUDIT_PAGE_SIZE));
    return params.toString();
  }, [clearAuditPage]);

  const clearPhoneAuditQuery = useQuery<ClearPhoneAuditResponse>({
    queryKey: QUERY_KEYS.adminSmsClearPhoneAudit(clearAuditQueryParams),
    queryFn: () =>
      authedFetch(`/api/admin/sms/clear-phone-audit?${clearAuditQueryParams}`),
  });

  const unmatchedDetailQuery = useQuery<{ events: UnmatchedOptOutDetail[] }>({
    queryKey: QUERY_KEYS.adminSmsOptOutEvents(),
    queryFn: () => authedFetch("/api/admin/sms/opt-out-events?limit=50"),
    enabled: showUnmatchedDetail,
  });

  const duplicatesQuery = useQuery<DuplicatePhonesResponse>({
    queryKey: QUERY_KEYS.adminSmsDuplicatePhones(),
    queryFn: () => authedFetch("/api/admin/sms/duplicate-phones"),
  });

  const { toast } = useToast();
  const [clearTarget, setClearTarget] = useState<ClearPhoneTarget | null>(null);
  const [clearReason, setClearReason] = useState("");
  const [unreachableTarget, setUnreachableTarget] =
    useState<ClearUnreachableTarget | null>(null);
  const [unreachableReason, setUnreachableReason] = useState("");

  const clearPhoneMutation = useApiMutation<
    unknown,
    { userId: string; reason: string }
  >(
    async ({ userId, reason }) =>
      apiFetch(`/api/admin/sms/users/${userId}/clear-phone`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    [QUERY_KEYS.adminSmsDuplicatePhones()],
    {
      onSuccess: () => {
        toast({ title: "Phone number cleared" });
        setClearTarget(null);
        setClearReason("");
      },
      onError: (error) => {
        toast({
          title: "Could not clear phone",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      },
    },
  );

  // Reset the auto-pause flag (phoneUnreachable) + the failure-streak
  // counters that drove it. Refreshes the SMS health summary so the row
  // either drops out of the chronic-bounce list or reflects "One-off".
  const clearUnreachableMutation = useApiMutation<
    unknown,
    { userId: string; reason: string }
  >(
    async ({ userId, reason }) =>
      apiFetch(`/api/admin/sms/users/${userId}/clear-unreachable`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    [QUERY_KEYS.adminSmsHealthSummary()],
    {
      onSuccess: () => {
        toast({ title: "Auto-pause cleared" });
        setUnreachableTarget(null);
        setUnreachableReason("");
      },
      onError: (error) => {
        toast({
          title: "Could not clear auto-pause",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      },
    },
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSmsHealthSummary() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSmsOptOutEvents() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminSmsDuplicatePhones() });
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/admin/sms/clear-phone-audit"),
    });
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/admin/sms/opt-outs"),
    });
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleExport = async () => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(
      `/api/admin/sms/opt-outs/export?${filterParams.toString()}`,
      { credentials: "include", headers },
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sms-opt-outs-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const total = optOutsQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(total, page * PAGE_SIZE);

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
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/admin/cockpit" data-testid="link-back-to-cockpit">
              <ArrowLeft className="h-4 w-4" />
              Back to Cockpit
            </Link>
          </Button>
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

      <Card data-testid="tile-unmatched-optouts">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4" />
            Unmatched STOP webhooks
          </CardTitle>
          <CardDescription>
            STOP messages we couldn't pin to a specific user — either no
            matching phone, or multiple users share the number. These used
            to live only in raw logs.
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
                    data-testid="text-unmatched-optout-last7d"
                  >
                    {summary.unmatchedOptOuts.last7d}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    in last 7 days
                  </div>
                </div>
                <div className="ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUnmatchedDetail((v) => !v)}
                    data-testid="button-toggle-unmatched-detail"
                  >
                    {showUnmatchedDetail ? "Hide details" : "Show recent"}
                  </Button>
                </div>
              </div>

              {!showUnmatchedDetail && summary.unmatchedOptOuts.recent.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {summary.unmatchedOptOuts.recent.length} recent event
                  {summary.unmatchedOptOuts.recent.length === 1 ? "" : "s"} on file.
                </div>
              )}

              {showUnmatchedDetail && (
                <div data-testid="region-unmatched-detail">
                  {unmatchedDetailQuery.isLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !unmatchedDetailQuery.data ||
                    unmatchedDetailQuery.data.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No unmatched STOP events recorded.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="py-2 pr-3">When</th>
                            <th className="py-2 pr-3">From</th>
                            <th className="py-2 pr-3">Resolution</th>
                            <th className="py-2 pr-3">Body</th>
                            <th className="py-2 pr-3">Twilio SID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unmatchedDetailQuery.data.events.map((ev) => (
                            <tr
                              key={ev.id}
                              className="border-t"
                              data-testid={`row-unmatched-event-${ev.id}`}
                            >
                              <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                                {formatDate(ev.createdAt)}
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs">
                                {ev.fromPhoneRaw || ev.fromPhoneMasked}
                              </td>
                              <td className="py-2 pr-3">
                                <Badge
                                  variant={
                                    ev.resolution === "ambiguous"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {ev.resolution}
                                </Badge>
                              </td>
                              <td className="py-2 pr-3 text-muted-foreground">
                                {ev.body || "—"}
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                                {ev.twilioSid || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-clear-phone-audit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Recent phone-clear actions
          </CardTitle>
          <CardDescription>
            Most recent <code>sms_clear_phone_e164</code> repairs from the
            duplicate-phone tool. Shows who cleared which user, when, and
            why.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clearPhoneAuditQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !clearPhoneAuditQuery.data ||
            clearPhoneAuditQuery.data.events.length === 0 ? (
            <p
              className="text-sm text-muted-foreground py-4 text-center"
              data-testid="text-no-clear-phone-audit"
            >
              No phone-clear actions recorded yet.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">When</th>
                      <th className="py-2 pr-3">Actor</th>
                      <th className="py-2 pr-3">Target user</th>
                      <th className="py-2 pr-3">Previous phone</th>
                      <th className="py-2 pr-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clearPhoneAuditQuery.data.events.map((ev) => {
                      const target = ev.targetUser;
                      const targetLabel = target
                        ? target.name ||
                          target.username ||
                          target.email ||
                          target.id
                        : ev.targetUserId || "—";
                      return (
                        <tr
                          key={ev.id}
                          className="border-t"
                          data-testid={`row-clear-phone-audit-${ev.id}`}
                        >
                          <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(ev.createdAt)}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="font-medium truncate">
                              {ev.actorEmail || ev.actorUserId}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            {ev.targetUserId ? (
                              <Link
                                href={`/admin/users/${ev.targetUserId}`}
                                data-testid={`link-clear-phone-target-${ev.id}`}
                              >
                                <span className="font-medium hover:underline">
                                  {targetLabel}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                            {ev.previousPhoneE164 || "—"}
                          </td>
                          <td
                            className="py-2 pr-3 text-muted-foreground"
                            data-testid={`text-clear-phone-reason-${ev.id}`}
                          >
                            {ev.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {clearPhoneAuditQuery.data.pagination.total >
                CLEAR_AUDIT_PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 text-sm">
                  <div
                    className="text-muted-foreground"
                    data-testid="text-clear-phone-audit-pagination-summary"
                  >
                    Showing{" "}
                    {(clearAuditPage - 1) * CLEAR_AUDIT_PAGE_SIZE + 1}–
                    {Math.min(
                      clearPhoneAuditQuery.data.pagination.total,
                      clearAuditPage * CLEAR_AUDIT_PAGE_SIZE,
                    )}{" "}
                    of {clearPhoneAuditQuery.data.pagination.total}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={clearAuditPage <= 1}
                      onClick={() =>
                        setClearAuditPage((p) => Math.max(1, p - 1))
                      }
                      data-testid="button-clear-phone-audit-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        clearAuditPage * CLEAR_AUDIT_PAGE_SIZE >=
                        clearPhoneAuditQuery.data.pagination.total
                      }
                      onClick={() => setClearAuditPage((p) => p + 1)}
                      data-testid="button-clear-phone-audit-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-optout-roster">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">All opted-out users</CardTitle>
              <CardDescription>
                Filter by date and search by name, email, username, or phone.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              data-testid="button-export-optouts-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
          <form
            onSubmit={applySearch}
            className="grid gap-2 mt-4 md:grid-cols-[1fr_auto_auto_auto]"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search email, phone, name…"
                className="pl-9"
                data-testid="input-search-optouts"
              />
            </div>
            <Input
              type="date"
              value={since}
              onChange={(e) => {
                setSince(e.target.value);
                setPage(1);
              }}
              data-testid="input-since-date"
              aria-label="From date"
            />
            <Input
              type="date"
              value={until}
              onChange={(e) => {
                setUntil(e.target.value);
                setPage(1);
              }}
              data-testid="input-until-date"
              aria-label="To date"
            />
            <Button type="submit" data-testid="button-apply-filters">
              Apply
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {optOutsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !optOutsQuery.data || optOutsQuery.data.users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-optouts">
              No opted-out users match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th
                      className="py-2 pr-3"
                      aria-sort={ariaSortFor("name", sortState)}
                    >
                      <SortableHeader
                        label="User"
                        field="name"
                        sortState={sortState}
                        onToggle={toggleSort}
                      />
                    </th>
                    <th
                      className="py-2 pr-3"
                      aria-sort={ariaSortFor("email", sortState)}
                    >
                      <SortableHeader
                        label="Email"
                        field="email"
                        sortState={sortState}
                        onToggle={toggleSort}
                      />
                    </th>
                    <th className="py-2 pr-3">Phone</th>
                    <th
                      className="py-2 pr-3"
                      aria-sort={ariaSortFor("optOutAt", sortState)}
                    >
                      <SortableHeader
                        label="Opted out at"
                        field="optOutAt"
                        sortState={sortState}
                        onToggle={toggleSort}
                      />
                    </th>
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
          {optOutsQuery.data && total > 0 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <div
                className="text-muted-foreground"
                data-testid="text-optout-pagination-summary"
              >
                Showing {showingFrom}–{showingTo} of {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="button-optout-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span data-testid="text-optout-page">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-optout-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-duplicate-phones">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneOff className="h-4 w-4" />
            Duplicate phone numbers
          </CardTitle>
          <CardDescription>
            Phone numbers shared by 2+ users. STOP texts from these numbers
            are blocked until the duplicate is resolved. Clear the wrong
            account&apos;s phone to unblock opt-outs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {duplicatesQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !duplicatesQuery.data ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : duplicatesQuery.data.groups.length === 0 ? (
            <p
              className="text-sm text-muted-foreground py-4 text-center"
              data-testid="text-no-duplicates"
            >
              No duplicate phone numbers. STOP routing is healthy.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end gap-6">
                <div>
                  <div
                    className="text-3xl font-bold tabular-nums"
                    data-testid="text-duplicate-group-count"
                  >
                    {duplicatesQuery.data.groupCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    duplicate phone groups
                  </div>
                </div>
                <div>
                  <div
                    className="text-2xl font-semibold tabular-nums"
                    data-testid="text-duplicate-affected-users"
                  >
                    {duplicatesQuery.data.affectedUserCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    affected users
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {duplicatesQuery.data.groups.map((group) => (
                  <div
                    key={group.phoneE164}
                    className="border rounded-md overflow-hidden"
                    data-testid={`group-duplicate-${group.phoneE164}`}
                  >
                    <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                      <div
                        className="font-mono text-sm font-semibold"
                        data-testid={`text-duplicate-phone-${group.phoneE164}`}
                      >
                        {group.phoneE164}
                      </div>
                      <Badge variant="outline">
                        {group.userCount} users
                      </Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="py-2 px-3">User</th>
                            <th className="py-2 px-3">Email</th>
                            <th className="py-2 px-3">User ID</th>
                            <th className="py-2 px-3">Last active</th>
                            <th className="py-2 px-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {group.users.map((u) => {
                            const label =
                              u.name || u.username || u.email || u.id;
                            return (
                              <tr
                                key={u.id}
                                className="border-t"
                                data-testid={`row-duplicate-user-${u.id}`}
                              >
                                <td className="py-2 px-3 font-medium">
                                  <Link
                                    href={`/admin/users/${u.id}`}
                                    data-testid={`link-duplicate-user-${u.id}`}
                                  >
                                    <span className="hover:underline cursor-pointer">
                                      {label}
                                    </span>
                                  </Link>
                                </td>
                                <td className="py-2 px-3 text-muted-foreground">
                                  {u.email || "—"}
                                </td>
                                <td className="py-2 px-3 text-xs font-mono text-muted-foreground">
                                  {u.id}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground">
                                  {formatDate(u.lastActiveAt ?? null)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setClearTarget({
                                        userId: u.id,
                                        phoneE164: group.phoneE164,
                                        label,
                                      });
                                      setClearReason("");
                                    }}
                                    data-testid={`button-clear-phone-${u.id}`}
                                  >
                                    Clear phone
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={clearTarget !== null}
        onOpenChange={(open) => {
          if (!open && !clearPhoneMutation.isPending) {
            setClearTarget(null);
            setClearReason("");
          }
        }}
      >
        <DialogContent data-testid="dialog-clear-phone">
          <DialogHeader>
            <DialogTitle>Clear phone number</DialogTitle>
            <DialogDescription>
              This will remove <span className="font-mono">{clearTarget?.phoneE164}</span>{" "}
              from {clearTarget?.label}. STOP texts from that number will then
              opt out the remaining account. The action is logged in the admin
              audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clear-phone-reason">Reason (required)</Label>
            <Textarea
              id="clear-phone-reason"
              value={clearReason}
              onChange={(e) => setClearReason(e.target.value)}
              placeholder="e.g. Duplicate created during signup; this account never confirmed."
              rows={3}
              data-testid="input-clear-phone-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setClearTarget(null);
                setClearReason("");
              }}
              disabled={clearPhoneMutation.isPending}
              data-testid="button-cancel-clear-phone"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!clearTarget || !clearReason.trim()) return;
                clearPhoneMutation.mutate({
                  userId: clearTarget.userId,
                  reason: clearReason.trim(),
                });
              }}
              disabled={
                !clearReason.trim() || clearPhoneMutation.isPending
              }
              data-testid="button-confirm-clear-phone"
            >
              {clearPhoneMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Clear phone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card data-testid="card-confirmation-failures">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Resume confirmation bounces
          </CardTitle>
          <CardDescription>
            Users whose most recent &quot;Resume SMS&quot; confirmation text
            failed to deliver. Likely bad or unverified phone numbers.
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
            <div className="space-y-3">
              <div className="flex items-end gap-6">
                <div>
                  <div
                    className="text-3xl font-bold tabular-nums"
                    data-testid="text-confirmation-failures-total"
                  >
                    {summary.confirmationFailures.total}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    users with a failed confirmation on file
                  </div>
                </div>
                <div>
                  <div
                    className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400"
                    data-testid="text-confirmation-failures-unreachable"
                  >
                    {summary.confirmationFailures.unreachable}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    auto-paused (chronic)
                  </div>
                </div>
              </div>
              {summary.confirmationFailures.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No bounced confirmations recorded.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Phone</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Streak</th>
                        <th className="py-2 pr-3">Reason</th>
                        <th className="py-2 pr-3">Failed at</th>
                        <th className="py-2 pr-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {summary.confirmationFailures.recent.map((u) => (
                        <tr
                          key={u.id}
                          className="border-t"
                          data-testid={`row-confirmation-failure-${u.id}`}
                        >
                          <td className="py-2 pr-3 font-medium">
                            {u.name || u.username || u.email || u.id}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {u.phone || "—"}
                          </td>
                          <td
                            className="py-2 pr-3"
                            data-testid={`text-confirmation-failure-status-${u.id}`}
                          >
                            {u.phoneUnreachable ? (
                              <Badge
                                variant="destructive"
                                data-testid={`badge-phone-unreachable-${u.id}`}
                              >
                                Auto-paused
                              </Badge>
                            ) : (
                              <Badge variant="secondary">One-off</Badge>
                            )}
                          </td>
                          <td
                            className="py-2 pr-3 text-muted-foreground tabular-nums"
                            data-testid={`text-confirmation-failure-count-${u.id}`}
                          >
                            {u.smsConfirmationFailureCount ?? 0}
                          </td>
                          <td
                            className="py-2 pr-3 text-muted-foreground"
                            data-testid={`text-confirmation-failure-code-${u.id}`}
                          >
                            {u.smsConfirmationLastFailureCode || "—"}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {formatDate(u.smsConfirmationLastFailureAt)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {u.phoneUnreachable && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setUnreachableTarget({
                                      userId: u.id,
                                      label:
                                        u.name ||
                                        u.username ||
                                        u.email ||
                                        u.id,
                                      phone: u.phone,
                                      failureCount:
                                        u.smsConfirmationFailureCount ?? 0,
                                    });
                                    setUnreachableReason("");
                                  }}
                                  data-testid={`button-clear-unreachable-${u.id}`}
                                >
                                  Clear auto-pause
                                </Button>
                              )}
                              <Link href={`/admin/users/${u.id}`}>
                                <Badge
                                  variant="outline"
                                  className="cursor-pointer"
                                  data-testid={`link-confirmation-failure-user-${u.id}`}
                                >
                                  View
                                </Badge>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={unreachableTarget !== null}
        onOpenChange={(open) => {
          if (!open && !clearUnreachableMutation.isPending) {
            setUnreachableTarget(null);
            setUnreachableReason("");
          }
        }}
      >
        <DialogContent data-testid="dialog-clear-unreachable">
          <DialogHeader>
            <DialogTitle>Clear auto-pause</DialogTitle>
            <DialogDescription>
              This re-enables outbound SMS for{" "}
              <span className="font-medium">{unreachableTarget?.label}</span>
              {unreachableTarget?.phone ? (
                <>
                  {" "}
                  (<span className="font-mono">{unreachableTarget.phone}</span>)
                </>
              ) : null}
              . The failure streak counter (
              {unreachableTarget?.failureCount ?? 0}) will reset and the
              action is recorded in the admin audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clear-unreachable-reason">Reason (required)</Label>
            <Textarea
              id="clear-unreachable-reason"
              value={unreachableReason}
              onChange={(e) => setUnreachableReason(e.target.value)}
              placeholder="e.g. User confirmed they fixed their carrier; re-test outbound."
              rows={3}
              data-testid="input-clear-unreachable-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUnreachableTarget(null);
                setUnreachableReason("");
              }}
              disabled={clearUnreachableMutation.isPending}
              data-testid="button-cancel-clear-unreachable"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!unreachableTarget || !unreachableReason.trim()) return;
                clearUnreachableMutation.mutate({
                  userId: unreachableTarget.userId,
                  reason: unreachableReason.trim(),
                });
              }}
              disabled={
                !unreachableReason.trim() || clearUnreachableMutation.isPending
              }
              data-testid="button-confirm-clear-unreachable"
            >
              {clearUnreachableMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Clear auto-pause
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
