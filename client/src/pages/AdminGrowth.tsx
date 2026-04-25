import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  Rocket,
  Users,
  PhoneCall,
  RefreshCw,
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
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "leads" | "outreach" | "channels";

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

const leadStatusConfig: Record<string, { className: string }> = {
  new: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  contacted: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  qualified: { className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  booked_call: { className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  converted: { className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  lost: { className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
};

const outreachStatusConfig: Record<string, { className: string }> = {
  new: { className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  contacted: { className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  replied: { className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  converted: { className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  closed: { className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
};

function StatusBadge({ status, config }: { status: string; config: Record<string, { className: string }> }) {
  const c = config[status] || { className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("font-medium", c.className)} data-testid={`badge-status-${status}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function OverviewTab({ days, setDays }: { days: number; setDays: (d: number) => void }) {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: QUERY_KEYS.adminGrowthOverview(days),
    queryFn: () => apiFetch(`/api/admin/growth/overview?days=${days}`),
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
    return <p className="text-muted-foreground text-center py-10" data-testid="text-overview-empty">No overview data available.</p>;
  }

  const kpis = [
    { label: "Leads", value: data.leads, icon: UserPlus, iconColor: "text-blue-500", iconBg: "bg-blue-500/10", suffix: "" },
    { label: "Calls Booked", value: data.callsBooked, icon: PhoneCall, iconColor: "text-cyan-500", iconBg: "bg-cyan-500/10", suffix: "" },
    { label: "Conversions", value: data.conversions, icon: TrendingUp, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10", suffix: "" },
    { label: "Referrals", value: data.referrals, icon: Users, iconColor: "text-violet-500", iconBg: "bg-violet-500/10", suffix: "" },
    { label: "Activation Rate", value: data.activationRate, icon: Rocket, iconColor: "text-amber-500", iconBg: "bg-amber-500/10", suffix: "%" },
    { label: "Paid Conversion", value: data.paidConversionRate, icon: TrendingUp, iconColor: "text-green-500", iconBg: "bg-green-500/10", suffix: "%" },
    { label: "Referral Share", value: data.referralContribution, icon: Users, iconColor: "text-pink-500", iconBg: "bg-pink-500/10", suffix: "%" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-36" data-testid="select-days">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-0 shadow-sm" data-testid={`card-kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", kpi.iconBg)}>
                    <Icon className={cn("h-6 w-6", kpi.iconColor)} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold">{kpi.value.toLocaleString()}{kpi.suffix}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm" data-testid="card-top-sources">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              Top Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.topSources.length > 0 ? (
              <div className="space-y-3">
                {data.topSources.map((s, i) => {
                  const maxCount = data.topSources[0]?.count || 1;
                  const pct = (s.count / maxCount) * 100;
                  return (
                    <div key={i} className="space-y-1" data-testid={`source-row-${i}`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{s.source || "Direct"}</span>
                        <span className="font-medium">{s.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6" data-testid="text-sources-empty">No source data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm" data-testid="card-top-campaigns">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-violet-500" />
              Top Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.topCampaigns.length > 0 ? (
              <div className="space-y-3">
                {data.topCampaigns.map((c, i) => {
                  const maxCount = data.topCampaigns[0]?.count || 1;
                  const pct = (c.count / maxCount) * 100;
                  return (
                    <div key={i} className="space-y-1" data-testid={`campaign-row-${i}`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{c.campaign || "None"}</span>
                        <span className="font-medium">{c.count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6" data-testid="text-campaigns-empty">No campaign data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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

const leadStatuses = ["new", "booked", "no_show", "completed", "converted", "disqualified"] as const;
const leadSources = ["homepage", "booking_page", "free_setup", "facebook_dm", "craigslist", "partner"] as const;
const callOutcomes = ["scheduled", "completed", "no_show", "rescheduled", "converted", "not_fit"] as const;

function LeadsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
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
    queryFn: () => apiFetch(`/api/admin/growth/leads${queryString ? `?${queryString}` : ""}`),
    retry: false,
  });

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
      onError: (err) => toast({ title: "Failed to save notes", description: err.message, variant: "destructive" }),
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
        if (selectedLead) {
          leadDetailQuery.refetch();
        }
      },
      onError: (err) => toast({ title: "Failed to update outcome", description: err.message, variant: "destructive" }),
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
      onError: (err) => toast({ title: "Failed to convert", description: err.message, variant: "destructive" }),
    },
  );

  const openDrawer = (lead: GrowthLead) => {
    setSelectedLead(lead as LeadDetail);
    setNotesValue(lead.notes || "");
    setConvertUserId("");
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm" data-testid="card-leads-table">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">Growth Leads</CardTitle>
            <Badge variant="outline" className="font-medium" data-testid="badge-leads-count">
              {leads?.length ?? 0} leads
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36" data-testid="select-leads-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {leadStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
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
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-leads">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-3 px-4 text-left font-medium">Name</th>
                  <th className="py-3 px-2 text-left font-medium">Business</th>
                  <th className="py-3 px-2 text-left font-medium">Contact</th>
                  <th className="py-3 px-2 text-left font-medium">Source</th>
                  <th className="py-3 px-2 text-left font-medium">Status</th>
                  <th className="py-3 px-4 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {leads && leads.length > 0 ? (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b last:border-0 cursor-pointer hover-elevate"
                      data-testid={`row-lead-${lead.id}`}
                      onClick={() => openDrawer(lead)}
                    >
                      <td className="py-3 px-4 font-medium">{lead.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{lead.businessName || "-"}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{lead.email || lead.phone || "-"}</td>
                      <td className="py-3 px-2 text-muted-foreground">{lead.source}</td>
                      <td className="py-3 px-2">
                        <StatusBadge status={lead.status} config={leadStatusConfig} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground" data-testid="text-leads-empty">
                      No growth leads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-lead-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Lead: {selectedLead?.name}
              {selectedLead && <StatusBadge status={selectedLead.status} config={leadStatusConfig} />}
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Business</p>
                  <p className="font-medium">{selectedLead.businessName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedLead.email || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedLead.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Source</p>
                  <p className="font-medium">{selectedLead.source}</p>
                </div>
                {selectedLead.utmCampaign && (
                  <div>
                    <p className="text-muted-foreground">Campaign</p>
                    <p className="font-medium">{selectedLead.utmCampaign}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(selectedLead.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {leadDetailQuery.data?.calls && leadDetailQuery.data.calls.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Calls</p>
                  <div className="space-y-2">
                    {leadDetailQuery.data.calls.map((call) => (
                      <div key={call.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm">
                        <div>
                          <span className="text-muted-foreground">Scheduled: </span>
                          <span>{new Date(call.scheduledAt).toLocaleString()}</span>
                        </div>
                        <Select
                          value={call.outcome}
                          onValueChange={(v) => callOutcomeMutation.mutate({ callId: call.id, outcome: v })}
                        >
                          <SelectTrigger className="w-32" data-testid={`select-call-outcome-${call.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {callOutcomes.map((o) => (
                              <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">Notes</Label>
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  className="mt-1 resize-none text-sm"
                  rows={3}
                  data-testid="textarea-lead-notes"
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => notesMutation.mutate({ id: selectedLead.id, notes: notesValue })}
                  disabled={notesMutation.isPending}
                  data-testid="button-save-notes"
                >
                  {notesMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Save Notes
                </Button>
              </div>

              {selectedLead.status !== "converted" && (
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-2">Convert Lead</p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="User ID (optional)"
                      value={convertUserId}
                      onChange={(e) => setConvertUserId(e.target.value)}
                      className="flex-1"
                      data-testid="input-convert-user-id"
                    />
                    <Button
                      size="sm"
                      onClick={() => convertMutation.mutate({ leadId: selectedLead.id, userId: convertUserId || undefined })}
                      disabled={convertMutation.isPending}
                      data-testid="button-convert-lead"
                    >
                      {convertMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Convert
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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

function OutreachTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OutreachItem | null>(null);
  const [form, setForm] = useState<OutreachFormData>(emptyOutreachForm);

  const { data: items, isLoading } = useQuery<OutreachItem[]>({
    queryKey: QUERY_KEYS.adminGrowthOutreach(),
    queryFn: () => apiFetch("/api/admin/growth/outreach"),
    retry: false,
  });

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
        toast({ title: "Outreach item created" });
        closeDialog();
      },
      onError: (err) => {
        toast({ title: "Failed to create", description: err.message, variant: "destructive" });
      },
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
        toast({ title: "Outreach item updated" });
        closeDialog();
      },
      onError: (err) => {
        toast({ title: "Failed to update", description: err.message, variant: "destructive" });
      },
    },
  );

  const deleteMutation = useApiMutation(
    async (id: string) =>
      apiFetch(`/api/admin/growth/outreach/${id}`, { method: "DELETE" }),
    [QUERY_KEYS.adminGrowthOutreach()],
    {
      onSuccess: () => {
        toast({ title: "Outreach item deleted" });
      },
      onError: (err) => {
        toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
      },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm" data-testid="card-outreach-table">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base font-semibold">Outreach Queue</CardTitle>
          <Button size="sm" onClick={openCreate} data-testid="button-add-outreach">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-outreach">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-3 px-4 text-left font-medium">Platform</th>
                  <th className="py-3 px-2 text-left font-medium">Handle</th>
                  <th className="py-3 px-2 text-left font-medium">City</th>
                  <th className="py-3 px-2 text-left font-medium">Status</th>
                  <th className="py-3 px-2 text-left font-medium">Next Follow-up</th>
                  <th className="py-3 px-4 text-left font-medium">Created</th>
                  <th className="py-3 px-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items && items.length > 0 ? (
                  items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0" data-testid={`row-outreach-${item.id}`}>
                      <td className="py-3 px-4 font-medium">{item.platform}</td>
                      <td className="py-3 px-2 text-muted-foreground">{item.handleName || "-"}</td>
                      <td className="py-3 px-2 text-muted-foreground">{item.city || "-"}</td>
                      <td className="py-3 px-2">
                        <StatusBadge status={item.status} config={outreachStatusConfig} />
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {item.nextFollowupAt ? new Date(item.nextFollowupAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(item)}
                            aria-label="Edit outreach item"
                            data-testid={`button-edit-outreach-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                            aria-label="Delete outreach item"
                            data-testid={`button-delete-outreach-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground" data-testid="text-outreach-empty">
                      No outreach items in the queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent data-testid="dialog-outreach-form">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Outreach Item" : "Add Outreach Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Input
                id="platform"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                placeholder="e.g., facebook, instagram, thumbtack"
                disabled={!!editingItem}
                data-testid="input-platform"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileUrl">Profile URL</Label>
              <Input
                id="profileUrl"
                value={form.profileUrl}
                onChange={(e) => setForm({ ...form, profileUrl: e.target.value })}
                placeholder="https://..."
                disabled={!!editingItem}
                data-testid="input-profile-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="handleName">Handle / Name</Label>
              <Input
                id="handleName"
                value={form.handleName}
                onChange={(e) => setForm({ ...form, handleName: e.target.value })}
                placeholder="Contact name or handle"
                data-testid="input-handle-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="City"
                data-testid="input-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextFollowupAt">Next Follow-up</Label>
              <Input
                id="nextFollowupAt"
                type="date"
                value={form.nextFollowupAt}
                onChange={(e) => setForm({ ...form, nextFollowupAt: e.target.value })}
                data-testid="input-next-followup"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                className="resize-none"
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
              disabled={createMutation.isPending || updateMutation.isPending || (!editingItem && (!form.platform || !form.profileUrl))}
              data-testid="button-submit-outreach"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              {editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const LOW_ACTIVATION_THRESHOLD = 20;
const HIGH_CAC_THRESHOLD = 100;

function ChannelsTab() {
  const { data: channels, isLoading } = useQuery<ChannelRow[]>({
    queryKey: QUERY_KEYS.adminGrowthChannels(),
    queryFn: () => apiFetch("/api/admin/growth/channels"),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-sm" data-testid="card-channels-table">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            Channel Performance
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Flags: activation &lt; {LOW_ACTIVATION_THRESHOLD}% or CAC &gt; ${HIGH_CAC_THRESHOLD}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-channels">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 px-4 text-left font-medium">Campaign</th>
                <th className="py-3 px-2 text-left font-medium">Source</th>
                <th className="py-3 px-2 text-right font-medium">Signups</th>
                <th className="py-3 px-2 text-right font-medium">Activated</th>
                <th className="py-3 px-2 text-right font-medium">Paid</th>
                <th className="py-3 px-2 text-right font-medium">CAC ($)</th>
                <th className="py-3 px-4 text-left font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {channels && channels.length > 0 ? (
                channels.map((ch, i) => {
                  const activationRate = ch.signups > 0 ? (ch.activated / ch.signups) * 100 : 0;
                  const paidRate = ch.signups > 0 ? ((ch.paid / ch.signups) * 100).toFixed(1) : "0";
                  const cac = (ch as ChannelRow & { cac?: number }).cac;
                  const lowActivation = ch.signups >= 3 && activationRate < LOW_ACTIVATION_THRESHOLD;
                  const highCac = typeof cac === "number" && cac > HIGH_CAC_THRESHOLD;
                  return (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-channel-${i}`}>
                      <td className="py-3 px-4 font-medium">{ch.utm_campaign || "-"}</td>
                      <td className="py-3 px-2 text-muted-foreground">{ch.utm_source || "-"}</td>
                      <td className="py-3 px-2 text-right">{ch.signups}</td>
                      <td className="py-3 px-2 text-right">
                        <span>{ch.activated}</span>
                        <span className="text-muted-foreground text-xs ml-1">({activationRate.toFixed(1)}%)</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span>{ch.paid}</span>
                        <span className="text-muted-foreground text-xs ml-1">({paidRate}%)</span>
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {typeof cac === "number" ? `$${cac}` : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {lowActivation && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs" data-testid={`flag-low-activation-${i}`}>
                              Low activation
                            </Badge>
                          )}
                          {highCac && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-xs" data-testid={`flag-high-cac-${i}`}>
                              High CAC
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground" data-testid="text-channels-empty">
                    No channel data available.
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
  { key: "overview", label: "Overview", icon: Target },
  { key: "leads", label: "Leads", icon: UserPlus },
  { key: "outreach", label: "Outreach", icon: Send },
  { key: "channels", label: "Channels", icon: BarChart3 },
];

export default function AdminGrowth() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [days, setDays] = useState(30);

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="page-admin-growth">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Rocket className="h-6 w-6 text-violet-500" />
              Growth Engine
            </h1>
            <p className="text-muted-foreground mt-1">Lead acquisition, outreach, and channel performance</p>
          </div>
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/admin/cockpit" data-testid="link-back-to-cockpit">
              <ArrowLeft className="h-4 w-4" />
              Back to Cockpit
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map((tab) => {
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

        {activeTab === "overview" && <OverviewTab days={days} setDays={setDays} />}
        {activeTab === "leads" && <LeadsTab />}
        {activeTab === "outreach" && <OutreachTab />}
        {activeTab === "channels" && <ChannelsTab />}
      </div>
    </AdminLayout>
  );
}
