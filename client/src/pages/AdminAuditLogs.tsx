import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  User,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";

interface AuditLog {
  id: string;
  createdAt: string;
  actorUserId: string;
  actorEmail: string | null;
  targetUserId: string | null;
  actionKey: string;
  reason: string;
  payload: string | null;
  source: string;
  actor: { email: string; name: string | null };
  target: { email: string; name: string | null } | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    billing_grant_comp: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    billing_revoke_comp: "bg-red-500/10 text-red-600 border-red-500/20",
    billing_pause: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    billing_resume: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    billing_cancel: "bg-red-500/10 text-red-600 border-red-500/20",
    account_disable: "bg-red-500/10 text-red-600 border-red-500/20",
    account_enable: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    admin_created: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    admin_updated: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    admin_deactivated: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  
  return (
    <Badge variant="outline" className={cn("capitalize", colors[action] || "bg-slate-500/10 text-slate-600 border-slate-500/20")}>
      {action.replace(/_/g, " ")}
    </Badge>
  );
}

export default function AdminAuditLogs() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = new URLSearchParams();
  queryParams.set("page", page.toString());
  queryParams.set("limit", "25");
  if (search) queryParams.set("search", search);
  if (actionFilter && actionFilter !== "all") queryParams.set("actionKey", actionFilter);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);

  const { data, isLoading, refetch } = useQuery<AuditLogsResponse>({
    queryKey: QUERY_KEYS.adminAuditLogsQuery(queryParams.toString()),
  });

  const { data: actionKeys } = useQuery<{ actionKeys: string[] }>({
    queryKey: QUERY_KEYS.adminAuditLogActionKeys(),
  });

  const handleExport = () => {
    const exportParams = new URLSearchParams();
    if (actionFilter && actionFilter !== "all") exportParams.set("actionKey", actionFilter);
    if (startDate) exportParams.set("startDate", startDate);
    if (endDate) exportParams.set("endDate", endDate);
    window.open(`/api/admin/audit-logs/export?${exportParams.toString()}`, "_blank");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  return (
    <div className="space-y-6" data-testid="page-admin-audit-logs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">View and export admin action history</p>
        </div>
        <Button variant="outline" onClick={handleExport} data-testid="button-export" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-violet-500" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 h-11 rounded-xl"
                data-testid="input-search"
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
              <SelectTrigger data-testid="select-action" className="h-11 rounded-xl">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionKeys?.actionKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              placeholder="Start date"
              data-testid="input-start-date"
              className="h-11 rounded-xl"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              placeholder="End date"
              data-testid="input-end-date"
              className="h-11 rounded-xl"
            />
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-500" />
            <CardTitle>Action History</CardTitle>
          </div>
          <CardDescription>
            {data?.pagination ? `${data.pagination.total.toLocaleString()} total entries` : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground mt-3">Loading audit logs...</p>
            </div>
          ) : data?.logs && data.logs.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {data.logs.map((log) => (
                  <div 
                    key={log.id}
                    className="p-4 rounded-xl border bg-card hover-elevate cursor-pointer group"
                    onClick={() => navigate(`/admin/users/${log.targetUserId}`)}
                    data-testid={`log-row-${log.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <ActionBadge action={log.actionKey} />
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <p className="text-sm">{log.reason}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">
                              By: {log.actor?.email || log.actorUserId}
                            </span>
                          </div>
                          {log.target && (
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[200px]">
                                Target: {log.target.email || log.targetUserId}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-4" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    data-testid="button-prev"
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.pagination.totalPages}
                    data-testid="button-next"
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
