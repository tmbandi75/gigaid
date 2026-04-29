import { useEffect, useMemo, useState } from "react";
import { safePrice } from "@/lib/safePrice";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Loader2,
  Rocket,
  Users,
  PhoneCall,
  TrendingUp,
  Megaphone,
  BarChart3,
  Globe,
  Plus,
  Pencil,
  Trash2,
  Send,
  UserPlus,
  Target,
  CalendarIcon,
  Search,
  MoreHorizontal,
  ExternalLink,
  Inbox,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  X,
  Mail,
  Phone,
  MapPin,
  Eye,
  Share2,
  CheckCircle,
  DollarSign,
  Clock,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "leads" | "outreach" | "channels" | "first-booking";

interface OverviewData {
  period: number;
  leads: number;
  callsBooked: number;
  conversions: number;
  referrals: number;
  activationRate: number;
  paidConversionRate: number;
  referralContribution: number;
  topSources: { source: string; count: number }[];
  topCampaigns: { campaign: string; count: number }[];
}

interface GrowthLead {
  id: string;
  name: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  notes: string | null;
  createdAt: string;
}

interface OutreachItem {
  id: string;
  platform: string;
  profileUrl: string;
  handleName: string | null;
  city: string | null;
  status: string;
  assignedToUserId: string | null;
  lastContactedAt: string | null;
  nextFollowupAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface ChannelRow {
  utm_campaign: string;
  utm_source: string;
  signups: number;
  activated: number;
  paid: number;
}

const leadStatusConfig: Record<string, { className: string; dot: string }> = {
  new: {
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    dot: "bg-blue-500",
  },
  contacted: {
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    dot: "bg-amber-500",
  },
  qualified: {
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    dot: "bg-violet-500",
  },
  booked: {
    className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
    dot: "bg-cyan-500",
  },
  booked_call: {
    className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
    dot: "bg-cyan-500",
  },
  no_show: {
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
    dot: "bg-orange-500",
  },
  completed: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  converted: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  disqualified: {
    className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    dot: "bg-red-500",
  },
  lost: {
    className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    dot: "bg-red-500",
  },
};

const outreachStatusConfig: Record<string, { className: string; dot: string }> = {
  new: {
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    dot: "bg-blue-500",
  },
  contacted: {
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    dot: "bg-amber-500",
  },
  replied: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  converted: {
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    dot: "bg-violet-500",
  },
  closed: {
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

function StatusPill({
  status,
  config,
  testId,
}: {
  status: string;
  config: Record<string, { className: string; dot: string }>;
  testId?: string;
}) {
  const c =
    config[status] || {
      className: "bg-muted text-muted-foreground border-border",
      dot: "bg-muted-foreground",
    };
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium capitalize", c.className)}
      data-testid={testId ?? `badge-status-${status}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  testId,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  action?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-12 px-6"
      data-testid={testId}
    >
      <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-semibold text-base">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ────────────────────────────── OVERVIEW ────────────────────────────── */

interface OverviewTabProps {
  days: number;
  setDays: (d: number) => void;
}

function OverviewTab({ days, setDays }: OverviewTabProps) {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: QUERY_KEYS.adminGrowthOverview(days),
    queryFn: () => apiFetch(`/api/admin/growth/overview?days=${days}`),
    retry: false,
  });

  const heroKpis = useMemo(
    () => [
      {
        label: "New Leads",
        value: data?.leads ?? 0,
        icon: UserPlus,
        gradient: "from-blue-500/15 to-blue-500/0",
        iconColor: "text-blue-600 dark:text-blue-400",
        ring: "ring-blue-500/20",
      },
      {
        label: "Calls Booked",
        value: data?.callsBooked ?? 0,
        icon: PhoneCall,
        gradient: "from-cyan-500/15 to-cyan-500/0",
        iconColor: "text-cyan-600 dark:text-cyan-400",
        ring: "ring-cyan-500/20",
      },
      {
        label: "Conversions",
        value: data?.conversions ?? 0,
        icon: TrendingUp,
        gradient: "from-emerald-500/15 to-emerald-500/0",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        ring: "ring-emerald-500/20",
      },
      {
        label: "Referrals",
        value: data?.referrals ?? 0,
        icon: Users,
        gradient: "from-violet-500/15 to-violet-500/0",
        iconColor: "text-violet-600 dark:text-violet-400",
        ring: "ring-violet-500/20",
      },
    ],
    [data],
  );

  const rateKpis = useMemo(
    () => [
      {
        label: "Activation Rate",
        value: data?.activationRate ?? 0,
        icon: Rocket,
        accent: "text-amber-600 dark:text-amber-400",
        bar: "bg-amber-500",
      },
      {
        label: "Paid Conversion",
        value: data?.paidConversionRate ?? 0,
        icon: TrendingUp,
        accent: "text-emerald-600 dark:text-emerald-400",
        bar: "bg-emerald-500",
      },
      {
        label: "Referral Share",
        value: data?.referralContribution ?? 0,
        icon: Users,
        accent: "text-pink-600 dark:text-pink-400",
        bar: "bg-pink-500",
      },
    ],
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Snapshot for the{" "}
          <span className="font-medium text-foreground">last {days} days</span>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40" data-testid="select-days">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7" data-testid="select-option-7">Last 7 days</SelectItem>
            <SelectItem value="14" data-testid="select-option-14">Last 14 days</SelectItem>
            <SelectItem value="30" data-testid="select-option-30">Last 30 days</SelectItem>
            <SelectItem value="90" data-testid="select-option-90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {heroKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.label}
              className={cn(
                "relative overflow-hidden border bg-card ring-1 ring-inset",
                kpi.ring,
              )}
              data-testid={`card-kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br pointer-events-none",
                  kpi.gradient,
                )}
              />
              <CardContent className="relative p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {kpi.label}
                  </p>
                  <div
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center bg-background/60 backdrop-blur",
                      kpi.iconColor,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    kpi.value.toLocaleString()
                  )}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Conversion rates */}
      <Card className="border bg-card" data-testid="card-conversion-rates">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Conversion Health
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          {rateKpis.map((kpi) => {
            const Icon = kpi.icon;
            const pct = Math.max(0, Math.min(100, kpi.value));
            return (
              <div
                key={kpi.label}
                className="space-y-2"
                data-testid={`rate-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", kpi.accent)} />
                    <span className="text-sm font-medium">{kpi.label}</span>
                  </div>
                  <span className={cn("text-base font-semibold tabular-nums", kpi.accent)}>
                    {isLoading ? "--" : `${kpi.value.toFixed(1)}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", kpi.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Sources & Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border bg-card" data-testid="card-top-sources">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              Top Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data && data.topSources.length > 0 ? (
              <div className="space-y-3.5">
                {data.topSources.map((s, i) => {
                  const maxCount = data.topSources[0]?.count || 1;
                  const pct = (s.count / maxCount) * 100;
                  return (
                    <div key={i} className="space-y-1.5" data-testid={`source-row-${i}`}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">
                          {s.source || "Direct"}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {s.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Globe}
                title="No source data yet"
                description="Once leads start arriving, you'll see where they're coming from here."
                testId="text-sources-empty"
              />
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card" data-testid="card-top-campaigns">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-violet-500" />
              Top Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data && data.topCampaigns.length > 0 ? (
              <div className="space-y-3.5">
                {data.topCampaigns.map((c, i) => {
                  const maxCount = data.topCampaigns[0]?.count || 1;
                  const pct = (c.count / maxCount) * 100;
                  return (
                    <div key={i} className="space-y-1.5" data-testid={`campaign-row-${i}`}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">
                          {c.campaign || "None"}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {c.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Tag your acquisition links with utm_campaign to see campaign performance here."
                testId="text-campaigns-empty"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────────────── LEADS ─────────────────────────────── */

interface LeadDetail extends GrowthLead {
  calls?: Array<{
    id: string;
    scheduledAt: string;
    completedAt: string | null;
    outcome: string;
  }>;
  serviceCategory: string | null;
  city: string | null;
  referrerUserId: string | null;
  convertedUserId: string | null;
}

const leadStatuses = [
  "new",
  "booked",
  "no_show",
  "completed",
  "converted",
  "disqualified",
] as const;
const leadSources = [
  "homepage",
  "booking_page",
  "free_setup",
  "facebook_dm",
  "craigslist",
  "partner",
] as const;
const callOutcomes = [
  "scheduled",
  "completed",
  "no_show",
  "rescheduled",
  "converted",
  "not_fit",
] as const;

interface LeadsTabProps {
  onCount: (n: number) => void;
}

function LeadsTab({ onCount }: LeadsTabProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [convertUserId, setConvertUserId] = useState("");

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (sourceFilter !== "all") queryParams.set("source", sourceFilter);
  const queryString = queryParams.toString();

  const { data: leads, isLoading } = useQuery<GrowthLead[]>({
    queryKey: [...QUERY_KEYS.adminGrowthLeads(), statusFilter, sourceFilter],
    queryFn: async () =>
      (await apiFetch(
        `/api/admin/growth/leads${queryString ? `?${queryString}` : ""}`,
      )) as GrowthLead[],
    retry: false,
  });

  useEffect(() => {
    if (leads) onCount(leads.length);
  }, [leads, onCount]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.businessName, l.email, l.phone, l.utmCampaign]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(q)),
    );
  }, [leads, search]);

  const leadDetailQuery = useQuery<LeadDetail>({
    queryKey: ["admin-growth-lead-detail", selectedLead?.id],
    queryFn: () => apiFetch(`/api/admin/growth/leads/${selectedLead!.id}`),
    enabled: !!selectedLead?.id && drawerOpen,
    retry: false,
  });

  const notesMutation = useApiMutation(
    async ({ id, notes }: { id: string; notes: string }) =>
      apiFetch(`/api/admin/growth/leads/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      }),
    [QUERY_KEYS.adminGrowthLeads()],
    {
      onSuccess: () => toast({ title: "Notes saved" }),
      onError: (err) =>
        toast({
          title: "Failed to save notes",
          description: err.message,
          variant: "destructive",
        }),
    },
  );

  const callOutcomeMutation = useApiMutation(
    async ({ callId, outcome }: { callId: string; outcome: string }) =>
      apiFetch(`/api/admin/growth/calls/${callId}/outcome`, {
        method: "PATCH",
        body: JSON.stringify({ outcome }),
      }),
    [QUERY_KEYS.adminGrowthLeads()],
    {
      onSuccess: () => {
        toast({ title: "Call outcome updated" });
        if (selectedLead) leadDetailQuery.refetch();
      },
      onError: (err) =>
        toast({
          title: "Failed to update outcome",
          description: err.message,
          variant: "destructive",
        }),
    },
  );

  const convertMutation = useApiMutation(
    async ({ leadId, userId }: { leadId: string; userId?: string }) =>
      apiFetch("/api/admin/growth/convert", {
        method: "POST",
        body: JSON.stringify({ leadId, userId: userId || undefined }),
      }),
    [QUERY_KEYS.adminGrowthLeads()],
    {
      onSuccess: () => {
        toast({ title: "Lead converted" });
        setDrawerOpen(false);
        setSelectedLead(null);
      },
      onError: (err) =>
        toast({
          title: "Failed to convert",
          description: err.message,
          variant: "destructive",
        }),
    },
  );

  const openDrawer = (lead: GrowthLead) => {
    setSelectedLead(lead as LeadDetail);
    setNotesValue(lead.notes || "");
    setConvertUserId("");
    setDrawerOpen(true);
  };

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (sourceFilter !== "all" ? 1 : 0);

  return (
    <>
      <Card className="border bg-card" data-testid="card-leads-table">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-500" />
                Growth Leads
                <Badge variant="secondary" className="ml-1 font-medium" data-testid="badge-leads-count">
                  {filteredLeads.length}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Click any row to view details, log call outcomes, and convert.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, business, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-leads"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-leads-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {leadStatuses.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-36" data-testid="select-leads-source">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {leadSources.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setSourceFilter("all");
                  }}
                  data-testid="button-clear-leads-filters"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-0 sm:px-6">
          {isLoading ? (
            <div className="px-6 pb-6 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No leads match"
              description={
                search || activeFilterCount > 0
                  ? "Try adjusting your search or filters."
                  : "New leads will land here as soon as they sign up or book a call."
              }
              testId="text-leads-empty"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-leads">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[28%]">Lead</TableHead>
                    <TableHead className="hidden md:table-cell w-[22%]">Contact</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover-elevate"
                      data-testid={`row-lead-${lead.id}`}
                      onClick={() => openDrawer(lead)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium leading-tight">{lead.name}</span>
                          {lead.businessName && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {lead.businessName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col text-xs text-muted-foreground gap-0.5">
                          {lead.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                          {!lead.email && !lead.phone && <span>—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground capitalize">
                          {lead.source.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={lead.status} config={leadStatusConfig} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {format(new Date(lead.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedLead(null);
            setNotesValue("");
            setConvertUserId("");
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
          data-testid="dialog-lead-detail"
        >
          {selectedLead && (
            <>
              <SheetHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <SheetTitle className="text-xl">{selectedLead.name}</SheetTitle>
                  <StatusPill status={selectedLead.status} config={leadStatusConfig} />
                </div>
                <SheetDescription>
                  {selectedLead.businessName || "Independent lead"} ·{" "}
                  <span className="capitalize">
                    {selectedLead.source.replace(/_/g, " ")}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Contact card */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contact
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {selectedLead.email || "No email"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        {selectedLead.phone || "No phone"}
                      </span>
                    </div>
                    {selectedLead.utmCampaign && (
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{selectedLead.utmCampaign}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs">
                        Added {format(new Date(selectedLead.createdAt), "PPp")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calls */}
                {leadDetailQuery.data?.calls && leadDetailQuery.data.calls.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Activity
                    </p>
                    <div className="space-y-2">
                      {leadDetailQuery.data.calls.map((call) => (
                        <div
                          key={call.id}
                          className="flex items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <PhoneCall className="h-4 w-4 text-cyan-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {format(new Date(call.scheduledAt), "MMM d, p")}
                              </p>
                              <p className="text-xs text-muted-foreground">Scheduled call</p>
                            </div>
                          </div>
                          <Select
                            value={call.outcome}
                            onValueChange={(v) =>
                              callOutcomeMutation.mutate({ callId: call.id, outcome: v })
                            }
                          >
                            <SelectTrigger
                              className="w-32 h-8 text-xs"
                              data-testid={`select-call-outcome-${call.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {callOutcomes.map((o) => (
                                <SelectItem key={o} value={o} className="capitalize">
                                  {o.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <Label
                    htmlFor="lead-notes"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Notes
                  </Label>
                  <Textarea
                    id="lead-notes"
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    className="mt-2 resize-none text-sm"
                    rows={4}
                    placeholder="What did they say? Pain points? Next step?"
                    data-testid="textarea-lead-notes"
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      notesMutation.mutate({ id: selectedLead.id, notes: notesValue })
                    }
                    disabled={notesMutation.isPending}
                    data-testid="button-save-notes"
                  >
                    {notesMutation.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    )}
                    Save notes
                  </Button>
                </div>

                {/* Convert */}
                {selectedLead.status !== "converted" ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Convert to user</p>
                        <p className="text-xs text-muted-foreground">
                          Optionally link to an existing user account.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Input
                        placeholder="Existing user ID (optional)"
                        value={convertUserId}
                        onChange={(e) => setConvertUserId(e.target.value)}
                        className="flex-1 min-w-0"
                        data-testid="input-convert-user-id"
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          convertMutation.mutate({
                            leadId: selectedLead.id,
                            userId: convertUserId || undefined,
                          })
                        }
                        disabled={convertMutation.isPending}
                        data-testid="button-convert-lead"
                      >
                        {convertMutation.isPending && (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        )}
                        Convert
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium">Already converted</span>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ─────────────────────────────── OUTREACH ─────────────────────────────── */

interface OutreachFormData {
  platform: string;
  profileUrl: string;
  handleName: string;
  city: string;
  notes: string;
  nextFollowupAt: string;
}

const emptyOutreachForm: OutreachFormData = {
  platform: "",
  profileUrl: "",
  handleName: "",
  city: "",
  notes: "",
  nextFollowupAt: "",
};

const platformIconMap: Record<string, string> = {
  facebook: "FB",
  instagram: "IG",
  thumbtack: "TT",
  craigslist: "CL",
  linkedin: "LI",
  tiktok: "TK",
  twitter: "X",
};

interface OutreachTabProps {
  onCount: (n: number) => void;
}

function OutreachTab({ onCount }: OutreachTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OutreachItem | null>(null);
  const [form, setForm] = useState<OutreachFormData>(emptyOutreachForm);

  const { data: items, isLoading } = useQuery<OutreachItem[]>({
    queryKey: QUERY_KEYS.adminGrowthOutreach(),
    queryFn: async () =>
      (await apiFetch("/api/admin/growth/outreach")) as OutreachItem[],
    retry: false,
  });

  useEffect(() => {
    if (items) onCount(items.length);
  }, [items, onCount]);

  const createMutation = useApiMutation(
    async (data: OutreachFormData) =>
      apiFetch("/api/admin/growth/outreach", {
        method: "POST",
        body: JSON.stringify({
          platform: data.platform,
          profileUrl: data.profileUrl,
          handleName: data.handleName || undefined,
          city: data.city || undefined,
          notes: data.notes || undefined,
          nextFollowupAt: data.nextFollowupAt || undefined,
        }),
      }),
    [QUERY_KEYS.adminGrowthOutreach()],
    {
      onSuccess: () => {
        toast({ title: "Outreach added" });
        closeDialog();
      },
      onError: (err) =>
        toast({
          title: "Failed to create",
          description: err.message,
          variant: "destructive",
        }),
    },
  );

  const updateMutation = useApiMutation(
    async ({ id, ...data }: { id: string } & Partial<OutreachFormData>) =>
      apiFetch(`/api/admin/growth/outreach/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          handleName: data.handleName || undefined,
          city: data.city || undefined,
          notes: data.notes || undefined,
          nextFollowupAt: data.nextFollowupAt || undefined,
        }),
      }),
    [QUERY_KEYS.adminGrowthOutreach()],
    {
      onSuccess: () => {
        toast({ title: "Outreach updated" });
        closeDialog();
      },
      onError: (err) =>
        toast({
          title: "Failed to update",
          description: err.message,
          variant: "destructive",
        }),
    },
  );

  const deleteMutation = useApiMutation(
    async (id: string) =>
      apiFetch(`/api/admin/growth/outreach/${id}`, { method: "DELETE" }),
    [QUERY_KEYS.adminGrowthOutreach()],
    {
      onSuccess: () => toast({ title: "Outreach removed" }),
      onError: (err) =>
        toast({
          title: "Failed to delete",
          description: err.message,
          variant: "destructive",
        }),
    },
  );

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(emptyOutreachForm);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyOutreachForm);
    setDialogOpen(true);
  };

  const openEdit = (item: OutreachItem) => {
    setEditingItem(item);
    setForm({
      platform: item.platform,
      profileUrl: item.profileUrl,
      handleName: item.handleName || "",
      city: item.city || "",
      notes: item.notes || "",
      nextFollowupAt: item.nextFollowupAt || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const followupDate = form.nextFollowupAt ? new Date(form.nextFollowupAt) : undefined;

  return (
    <>
      <Card className="border bg-card" data-testid="card-outreach-table">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Send className="h-4 w-4 text-violet-500" />
                Outreach Queue
                <Badge variant="secondary" className="ml-1 font-medium" data-testid="badge-outreach-count">
                  {items?.length ?? 0}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Track manual outreach across Facebook, Instagram, Thumbtack, and more.
              </p>
            </div>
            <Button size="sm" onClick={openCreate} data-testid="button-add-outreach">
              <Plus className="h-4 w-4 mr-1" />
              Add outreach
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-0 sm:px-6">
          {isLoading ? (
            <div className="px-6 pb-6 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No outreach yet"
              description="Add a profile you want to reach out to and track your conversation through to conversion."
              action={
                <Button size="sm" onClick={openCreate} data-testid="button-add-outreach-empty">
                  <Plus className="h-4 w-4 mr-1" />
                  Add your first
                </Button>
              }
              testId="text-outreach-empty"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-outreach">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[26%]">Profile</TableHead>
                    <TableHead className="hidden sm:table-cell">City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Next follow-up</TableHead>
                    <TableHead className="hidden lg:table-cell">Added</TableHead>
                    <TableHead className="w-[40px] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const initials =
                      platformIconMap[item.platform.toLowerCase()] ||
                      item.platform.slice(0, 2).toUpperCase();
                    return (
                      <TableRow
                        key={item.id}
                        className="hover-elevate"
                        data-testid={`row-outreach-${item.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate flex items-center gap-1">
                                {item.handleName || item.platform}
                                <a
                                  href={item.profileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Open profile"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </p>
                              <p className="text-xs text-muted-foreground capitalize truncate">
                                {item.platform}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            {item.city ? (
                              <>
                                <MapPin className="h-3 w-3" />
                                {item.city}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusPill status={item.status} config={outreachStatusConfig} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {item.nextFollowupAt
                            ? format(new Date(item.nextFollowupAt), "MMM d")
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), "MMM d")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label="Row actions"
                                data-testid={`button-actions-outreach-${item.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEdit(item)}
                                data-testid={`button-edit-outreach-${item.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a
                                  href={item.profileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  data-testid={`link-open-outreach-${item.id}`}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" /> Open profile
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400 focus:text-red-600"
                                onClick={() => deleteMutation.mutate(item.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-outreach-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-[480px]" data-testid="dialog-outreach-form">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit outreach" : "New outreach"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update notes, status, and follow-up details."
                : "Track a profile you plan to contact and the next step for them."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="platform" className="text-xs font-medium">
                  Platform
                </Label>
                <Input
                  id="platform"
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  placeholder="facebook, instagram…"
                  disabled={!!editingItem}
                  data-testid="input-platform"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="handleName" className="text-xs font-medium">
                  Handle / name
                </Label>
                <Input
                  id="handleName"
                  value={form.handleName}
                  onChange={(e) => setForm({ ...form, handleName: e.target.value })}
                  placeholder="@username or name"
                  data-testid="input-handle-name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profileUrl" className="text-xs font-medium">
                Profile URL
              </Label>
              <Input
                id="profileUrl"
                value={form.profileUrl}
                onChange={(e) => setForm({ ...form, profileUrl: e.target.value })}
                placeholder="https://…"
                disabled={!!editingItem}
                data-testid="input-profile-url"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-medium">
                  City
                </Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Optional"
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nextFollowupAt" className="text-xs font-medium">
                  Next follow-up
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal",
                        !followupDate && "text-muted-foreground",
                      )}
                      data-testid="input-next-followup"
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {followupDate ? format(followupDate, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={followupDate}
                      onSelect={(d) =>
                        setForm({
                          ...form,
                          nextFollowupAt: d ? format(d, "yyyy-MM-dd") : "",
                        })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Conversation context, objections, next step…"
                className="resize-none"
                rows={3}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-outreach">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                (!editingItem && (!form.platform || !form.profileUrl))
              }
              data-testid="button-submit-outreach"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              {editingItem ? "Save changes" : "Add to queue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────────────── CHANNELS ─────────────────────────────── */

const LOW_ACTIVATION_THRESHOLD = 20;
const HIGH_CAC_THRESHOLD = 100;

function ChannelsTab() {
  const { data: channels, isLoading } = useQuery<ChannelRow[]>({
    queryKey: QUERY_KEYS.adminGrowthChannels(),
    queryFn: () => apiFetch("/api/admin/growth/channels"),
    retry: false,
  });

  return (
    <Card className="border bg-card" data-testid="card-channels-table">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-500" />
              Channel Performance
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Performance by UTM campaign and source.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-muted-foreground">
              Flagged when activation &lt;{" "}
              <span className="font-medium text-foreground">{LOW_ACTIVATION_THRESHOLD}%</span>{" "}
              or CAC &gt;{" "}
              <span className="font-medium text-foreground">{safePrice(HIGH_CAC_THRESHOLD)}</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0 sm:px-6">
        {isLoading ? (
          <div className="px-6 pb-6 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !channels || channels.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No channel data available"
            description="Add UTM parameters to your acquisition links and signups will roll up here."
            testId="text-channels-empty"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table data-testid="table-channels">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[24%]">Campaign</TableHead>
                  <TableHead className="hidden sm:table-cell">Source</TableHead>
                  <TableHead className="text-right">Signups</TableHead>
                  <TableHead className="hidden md:table-cell">Activation</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Paid</TableHead>
                  <TableHead className="text-right">CAC</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((ch, i) => {
                  const activationRate =
                    ch.signups > 0 ? (ch.activated / ch.signups) * 100 : 0;
                  const paidRate =
                    ch.signups > 0 ? ((ch.paid / ch.signups) * 100).toFixed(1) : "0";
                  const cac = (ch as ChannelRow & { cac?: number }).cac;
                  const lowActivation =
                    ch.signups >= 3 && activationRate < LOW_ACTIVATION_THRESHOLD;
                  const highCac = typeof cac === "number" && cac > HIGH_CAC_THRESHOLD;
                  const flagged = lowActivation || highCac;

                  const activationColor = lowActivation
                    ? "bg-red-500"
                    : activationRate >= 50
                      ? "bg-emerald-500"
                      : "bg-amber-500";

                  return (
                    <TableRow
                      key={i}
                      className={cn(flagged && "bg-amber-500/[0.04]")}
                      data-testid={`row-channel-${i}`}
                    >
                      <TableCell className="font-medium">
                        {ch.utm_campaign || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground capitalize">
                        {ch.utm_source || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {ch.signups.toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={cn("h-full rounded-full", activationColor)}
                              style={{ width: `${Math.min(100, activationRate)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground w-14 text-right">
                            {ch.activated} ({activationRate.toFixed(0)}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell tabular-nums">
                        <span>{ch.paid}</span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({paidRate}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {typeof cac === "number" ? (
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-md text-xs font-medium",
                              highCac
                                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {safePrice(cac)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {lowActivation && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px]"
                              data-testid={`flag-low-activation-${i}`}
                            >
                              Low activation
                            </Badge>
                          )}
                          {highCac && (
                            <Badge
                              variant="outline"
                              className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20 text-[10px]"
                              data-testid={`flag-high-cac-${i}`}
                            >
                              High CAC
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── FIRST BOOKING ─────────────────────────── */

interface FirstBookingTotals {
  generated: number;
  viewed: number;
  claimed: number;
  shared: number;
  paid: number;
}

interface FirstBookingCategoryRow extends FirstBookingTotals {
  category: string;
}

interface FirstBookingFunnelData {
  window: string;
  filters: { source: string; location: string };
  filterOptions: { sources: string[]; locations: string[] };
  totals: FirstBookingTotals;
  categories: FirstBookingCategoryRow[];
}

interface FirstBookingPageRow {
  id: string;
  category: string;
  source: string;
  location: string | null;
  claimed: boolean;
  claimedAt: string | null;
  claimedByUserId: string | null;
  createdAt: string;
  viewed: boolean;
  shared: boolean;
  firstPaidAt: string | null;
}

interface FirstBookingPagesData {
  window: string;
  limit: number;
  pages: FirstBookingPageRow[];
}

interface FirstBookingPageDetail {
  page: {
    id: string;
    category: string | null;
    location: string | null;
    source: string | null;
    phone: string | null;
    claimed: boolean;
    claimedAt: string | null;
    claimedByUserId: string | null;
    createdAt: string;
  };
  claimer: { id: string; name: string | null; email: string | null } | null;
  firstPaidAt: string | null;
  totalPaidInvoices: number;
  events: Array<{
    id: string;
    type: string;
    variant: string | null;
    metadata: string | null;
    createdAt: string;
  }>;
}

const FUNNEL_WINDOWS: { value: string; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function pct(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy HH:mm");
  } catch {
    return value;
  }
}

function FunnelStageCard({
  label,
  value,
  baseline,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  baseline: number;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <Card
      className="border bg-card"
      data-testid={`card-funnel-stage-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center bg-background/60",
              accent,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p
          className="mt-2 text-2xl font-bold tabular-nums"
          data-testid={`text-funnel-stage-value-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {value.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {baseline > 0 ? `${pct(value, baseline)} of generated` : "—"}
        </p>
      </CardContent>
    </Card>
  );
}

const eventTypeLabels: Record<string, string> = {
  page_viewed: "Page viewed",
  page_claimed: "Page claimed",
  link_copied: "Link copied",
  link_shared: "Link shared",
  first_booking_viewed: "First booking viewed",
};

function FirstBookingPageDetailSheet({
  pageId,
  open,
  onOpenChange,
}: {
  pageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery<FirstBookingPageDetail>({
    queryKey: QUERY_KEYS.adminFirstBookingFunnelPage(pageId ?? ""),
    queryFn: () =>
      apiFetch(`/api/admin/analytics/first-booking-funnel/pages/${pageId}`),
    enabled: !!pageId && open,
    retry: false,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-lg w-full overflow-y-auto"
        data-testid="sheet-first-booking-page-detail"
      >
        <SheetHeader>
          <SheetTitle>Booking page detail</SheetTitle>
          <SheetDescription>
            Full event timeline and conversion status for this page.
          </SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <div className="space-y-3 mt-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error || !data ? (
          <div
            className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            data-testid="text-detail-error"
          >
            <p className="font-medium">Couldn't load this booking page.</p>
            <p className="mt-1 text-destructive/80">
              {error instanceof Error
                ? error.message
                : "The page may have been removed or isn't part of the First Booking funnel."}
            </p>
          </div>
        ) : (
          <div className="space-y-5 mt-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Category
                </p>
                <p className="font-medium" data-testid="text-detail-category">
                  {data.page.category || "uncategorized"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Source
                </p>
                <p className="font-medium" data-testid="text-detail-source">
                  {data.page.source || "unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Location
                </p>
                <p className="font-medium">{data.page.location || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Created
                </p>
                <p className="font-medium">{formatDateTime(data.page.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Claimed
                </p>
                <p className="font-medium">
                  {data.page.claimed ? formatDateTime(data.page.claimedAt) : "Not claimed"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  First invoice paid
                </p>
                <p className="font-medium" data-testid="text-detail-first-paid">
                  {formatDateTime(data.firstPaidAt)}
                </p>
              </div>
            </div>

            {data.claimer && (
              <Card className="bg-muted/40 border-none">
                <CardContent className="p-3 text-sm">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">
                    Converted user
                  </p>
                  <p className="font-medium">
                    {data.claimer.name || "Unnamed"}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({data.claimer.id.slice(0, 8)})
                    </span>
                  </p>
                  <p className="text-muted-foreground">{data.claimer.email || "no email"}</p>
                  <p className="text-muted-foreground mt-1">
                    {data.totalPaidInvoices.toLocaleString()} paid invoice
                    {data.totalPaidInvoices === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">Event timeline</h3>
              {data.events.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-detail-no-events"
                >
                  No events recorded yet for this page.
                </p>
              ) : (
                <ol className="space-y-2" data-testid="list-detail-events">
                  {data.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm"
                      data-testid={`row-event-${ev.id}`}
                    >
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {eventTypeLabels[ev.type] ?? ev.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(ev.createdAt)}
                          {ev.variant ? ` • variant: ${ev.variant}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Sentinel value for the source/location dropdowns. When picked, the
// frontend sends `source=all` / `location=all` to the API and the backend
// drops that filter from the WHERE clause. We avoid using "" as the value
// because shadcn's <SelectItem> rejects empty strings.
const FUNNEL_FILTER_ALL_VALUE = "all";

function FirstBookingTab() {
  const [windowValue, setWindowValue] = useState<string>("30");
  // Default the source dropdown to the existing cohort ('growth_engine')
  // so opening the tab keeps showing the historical First Booking funnel.
  // Switching to "All" or another source reveals other acquisition data.
  const [sourceValue, setSourceValue] = useState<string>("growth_engine");
  const [locationValue, setLocationValue] = useState<string>(FUNNEL_FILTER_ALL_VALUE);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const funnelParams = new URLSearchParams({
    days: windowValue,
    source: sourceValue,
    location: locationValue,
  });

  const funnelQuery = useQuery<FirstBookingFunnelData>({
    queryKey: QUERY_KEYS.adminFirstBookingFunnel(windowValue, sourceValue, locationValue),
    queryFn: () =>
      apiFetch(`/api/admin/analytics/first-booking-funnel?${funnelParams.toString()}`),
    retry: false,
  });

  const pagesParams = new URLSearchParams({
    days: windowValue,
    source: sourceValue,
    location: locationValue,
    limit: "200",
  });

  const pagesQuery = useQuery<FirstBookingPagesData>({
    queryKey: QUERY_KEYS.adminFirstBookingFunnelPages(windowValue, sourceValue, locationValue),
    queryFn: () =>
      apiFetch(`/api/admin/analytics/first-booking-funnel/pages?${pagesParams.toString()}`),
    retry: false,
  });

  const totals = funnelQuery.data?.totals ?? {
    generated: 0,
    viewed: 0,
    claimed: 0,
    shared: 0,
    paid: 0,
  };
  const baseline = totals.generated;

  const stages = [
    { key: "generated", label: "Generated", icon: Plus, accent: "text-blue-600 dark:text-blue-400", value: totals.generated },
    { key: "viewed", label: "Viewed", icon: Eye, accent: "text-cyan-600 dark:text-cyan-400", value: totals.viewed },
    { key: "claimed", label: "Claimed", icon: CheckCircle, accent: "text-violet-600 dark:text-violet-400", value: totals.claimed },
    { key: "shared", label: "Shared", icon: Share2, accent: "text-amber-600 dark:text-amber-400", value: totals.shared },
    { key: "paid", label: "First Invoice Paid", icon: DollarSign, accent: "text-emerald-600 dark:text-emerald-400", value: totals.paid },
  ] as const;

  // Dropdown options come from the funnel response so admins always see
  // exactly the source/location values that exist in their data within
  // the current time window. We always include the current selection
  // even if it's missing from the response (e.g. the value disappeared
  // after the user filtered to a smaller time window) so the Select stays
  // in sync with the controlled state.
  const sourceOptions = Array.from(
    new Set([...(funnelQuery.data?.filterOptions.sources ?? []), sourceValue].filter(
      (v) => v && v !== FUNNEL_FILTER_ALL_VALUE,
    )),
  ).sort((a, b) => a.localeCompare(b));
  const locationOptions = Array.from(
    new Set([...(funnelQuery.data?.filterOptions.locations ?? []), locationValue].filter(
      (v) => v && v !== FUNNEL_FILTER_ALL_VALUE,
    )),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Funnel for{" "}
          <span className="font-medium text-foreground">
            {FUNNEL_WINDOWS.find((w) => w.value === windowValue)?.label ?? "Last 30 days"}
          </span>
          . Time filter applies to the page&apos;s creation date.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sourceValue} onValueChange={setSourceValue}>
            <SelectTrigger
              className="w-44"
              data-testid="select-first-booking-source"
            >
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={FUNNEL_FILTER_ALL_VALUE}
                data-testid="select-first-booking-source-option-all"
              >
                All sources
              </SelectItem>
              {sourceOptions.map((s) => (
                <SelectItem
                  key={s}
                  value={s}
                  data-testid={`select-first-booking-source-option-${s}`}
                >
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationValue} onValueChange={setLocationValue}>
            <SelectTrigger
              className="w-48"
              data-testid="select-first-booking-location"
            >
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={FUNNEL_FILTER_ALL_VALUE}
                data-testid="select-first-booking-location-option-all"
              >
                All locations
              </SelectItem>
              {locationOptions.map((l) => (
                <SelectItem
                  key={l}
                  value={l}
                  data-testid={`select-first-booking-location-option-${l}`}
                >
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={windowValue} onValueChange={setWindowValue}>
            <SelectTrigger
              className="w-44"
              data-testid="select-first-booking-window"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUNNEL_WINDOWS.map((w) => (
                <SelectItem
                  key={w.value}
                  value={w.value}
                  data-testid={`select-first-booking-window-option-${w.value}`}
                >
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Funnel stages */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stages.map((s) => (
          <FunnelStageCard
            key={s.key}
            label={s.label}
            value={s.value}
            baseline={baseline}
            icon={s.icon}
            accent={s.accent}
          />
        ))}
      </div>

      {/* Per-category breakdown */}
      <Card className="border bg-card" data-testid="card-funnel-by-category">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            By category
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {funnelQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : funnelQuery.data && funnelQuery.data.categories.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Generated</TableHead>
                    <TableHead className="text-right">Viewed</TableHead>
                    <TableHead className="text-right">Claimed</TableHead>
                    <TableHead className="text-right">Shared</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">View → Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnelQuery.data.categories.map((row) => (
                    <TableRow
                      key={row.category}
                      data-testid={`row-funnel-category-${row.category}`}
                    >
                      <TableCell className="font-medium capitalize">
                        {row.category}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.generated.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.viewed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.claimed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.shared.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.paid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {pct(row.paid, row.viewed)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No booking pages yet"
              description="Once the Growth Engine generates pages in this window, the breakdown will appear here."
              testId="text-funnel-categories-empty"
            />
          )}
        </CardContent>
      </Card>

      {/* Pages list */}
      <Card className="border bg-card" data-testid="card-funnel-pages">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Inbox className="h-4 w-4 text-blue-500" />
            Pages ({pagesQuery.data?.pages.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {pagesQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : pagesQuery.data && pagesQuery.data.pages.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagesQuery.data.pages.map((p) => {
                    const stage = p.firstPaidAt
                      ? "paid"
                      : p.shared
                      ? "shared"
                      : p.claimed
                      ? "claimed"
                      : p.viewed
                      ? "viewed"
                      : "generated";
                    const stageColor: Record<string, string> = {
                      paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
                      shared: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
                      claimed: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
                      viewed: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
                      generated: "bg-muted text-muted-foreground border-border",
                    };
                    return (
                      <TableRow
                        key={p.id}
                        data-testid={`row-funnel-page-${p.id}`}
                      >
                        <TableCell className="font-mono text-xs">
                          {p.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="capitalize">{p.category}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDateTime(p.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("capitalize", stageColor[stage])}
                            data-testid={`badge-funnel-page-stage-${p.id}`}
                          >
                            {stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPageId(p.id);
                              setSheetOpen(true);
                            }}
                            data-testid={`button-funnel-page-detail-${p.id}`}
                          >
                            View timeline
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No pages in this window"
              description="Pages generated by the Growth Engine will show up here as soon as they exist."
              testId="text-funnel-pages-empty"
            />
          )}
        </CardContent>
      </Card>

      <FirstBookingPageDetailSheet
        pageId={selectedPageId}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedPageId(null);
        }}
      />
    </div>
  );
}

/* ─────────────────────────────── PAGE ─────────────────────────────── */

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Overview", icon: Target },
  { key: "leads", label: "Leads", icon: UserPlus },
  { key: "outreach", label: "Outreach", icon: Send },
  { key: "channels", label: "Channels", icon: BarChart3 },
  { key: "first-booking", label: "First Booking", icon: Sparkles },
];

export default function AdminGrowth() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [days, setDays] = useState(30);
  const [leadsCount, setLeadsCount] = useState<number | null>(null);
  const [outreachCount, setOutreachCount] = useState<number | null>(null);

  const tabCounts: Record<TabKey, number | null> = {
    overview: null,
    leads: leadsCount,
    outreach: outreachCount,
    channels: null,
    "first-booking": null,
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="page-admin-growth">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-blue-500/10 p-6 sm:p-8">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
                <Rocket className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                  data-testid="text-page-title"
                >
                  Growth Engine
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                  See where leads come from, work the outreach queue, and spot
                  underperforming channels — all in one place.
                </p>
              </div>
            </div>
            <Button variant="outline" className="gap-2 shrink-0" asChild>
              <Link href="/admin/cockpit" data-testid="link-back-to-cockpit">
                <ArrowLeft className="h-4 w-4" />
                Back to Cockpit
              </Link>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="space-y-6"
        >
          <TabsList className="h-auto p-1 bg-muted/60 flex-wrap gap-1 justify-start">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const count = tabCounts[tab.key];
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
                  data-testid={`tab-${tab.key}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {count !== null && count > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] font-semibold"
                    >
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview" className="m-0">
            <OverviewTab days={days} setDays={setDays} />
          </TabsContent>
          <TabsContent value="leads" className="m-0">
            <LeadsTab onCount={setLeadsCount} />
          </TabsContent>
          <TabsContent value="outreach" className="m-0">
            <OutreachTab onCount={setOutreachCount} />
          </TabsContent>
          <TabsContent value="channels" className="m-0">
            <ChannelsTab />
          </TabsContent>
          <TabsContent value="first-booking" className="m-0">
            <FirstBookingTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
