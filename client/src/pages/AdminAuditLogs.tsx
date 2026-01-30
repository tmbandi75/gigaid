import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  Search,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  User,
  Calendar
} from "lucide-react";
import { Link, useLocation } from "wouter";

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
    billing_grant_comp: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    billing_revoke_comp: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    billing_pause: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    billing_resume: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    billing_cancel: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    account_disable: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    account_enable: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    admin_created: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    admin_updated: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    admin_deactivated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  
  return (
    <Badge className={colors[action] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}>
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
    queryKey: [`/api/admin/audit-logs?${queryParams.toString()}`],
  });

  const { data: actionKeys } = useQuery<{ actionKeys: string[] }>({
    queryKey: ["/api/admin/audit-logs/action-keys"],
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
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/cockpit">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Audit Logs</h1>
              <p className="text-muted-foreground">View and export admin action history</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger data-testid="select-action">
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
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                placeholder="End date"
                data-testid="input-end-date"
              />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Action History
            </CardTitle>
            <CardDescription>
              {data?.pagination ? `${data.pagination.total.toLocaleString()} total entries` : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : data?.logs && data.logs.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Time</th>
                        <th className="text-left py-3 px-2 font-medium">Action</th>
                        <th className="text-left py-3 px-2 font-medium">Actor</th>
                        <th className="text-left py-3 px-2 font-medium">Target</th>
                        <th className="text-left py-3 px-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.logs.map((log) => (
                        <tr 
                          key={log.id} 
                          className="border-b hover-elevate cursor-pointer"
                          onClick={() => navigate(`/admin/users/${log.targetUserId}`)}
                          data-testid={`log-row-${log.id}`}
                        >
                          <td className="py-3 px-2 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <ActionBadge action={log.actionKey} />
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[150px]">
                                {log.actor?.email || log.actorUserId}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {log.target ? (
                              <span className="truncate max-w-[150px]">
                                {log.target.email || log.targetUserId}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <span className="truncate max-w-[200px] block">
                              {log.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
