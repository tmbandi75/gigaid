import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  UserPlus, 
  Phone, 
  ChevronRight, 
  Sparkles, 
  Copy, 
  Loader2, 
  MessageSquare,
  Users,
  TrendingUp,
  Mail,
  Send,
  ExternalLink,
  List,
  LayoutGrid,
  Flame,
  Sun,
  Snowflake,
  Star
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSendText } from "@/hooks/use-send-text";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import type { Lead, AiNudge } from "@shared/schema";
import FollowUpCheckIn from "@/components/FollowUpCheckIn";
import { NudgeChips } from "@/components/nudges/NudgeChip";
import { PriorityBadge, inferLeadPriority } from "@/components/priority/PriorityBadge";
import { NudgeActionSheet } from "@/components/nudges/NudgeActionSheet";
import { LeadsTableView } from "@/components/leads/LeadsTableView";
import { useIsMobile } from "@/hooks/use-mobile";
import { CoachingRenderer } from "@/coaching/CoachingRenderer";
import { ActivationChecklist } from "@/components/activation/ActivationChecklist";
import { FreeSetupCta } from "@/components/growth/FreeSetupCta";
import { BookingLinkShare, BookingLinkEmptyState } from "@/components/booking-link";
import { HelpLink } from "@/components/HelpLink";
import { SwipeableCard, type SwipeAction as SwipeCardAction } from "@/components/ui/swipeable-card";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { 
  getLeadActionEligibility, 
  getSwipeActions, 
  type SwipeAction as RulesSwipeAction 
} from "@shared/archive-delete-rules";

interface FollowUpMessage {
  message: string;
  subject?: string;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  new: { color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Just Added" },
  response_sent: { color: "text-blue-600", bg: "bg-blue-500/10", label: "Awaiting Reply" },
  engaged: { color: "text-cyan-600", bg: "bg-cyan-500/10", label: "Talking" },
  price_confirmed: { color: "text-violet-600", bg: "bg-violet-500/10", label: "Ready to Book" },
  cold: { color: "text-gray-600", bg: "bg-gray-500/10", label: "Gone Quiet" },
  lost: { color: "text-red-600", bg: "bg-red-500/10", label: "Not Interested" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getHeatLabel(score: number | null | undefined): { label: string; color: string; icon: string } | null {
  if (score === null || score === undefined) return null;
  if (score >= 70) return { label: "Hot", color: "text-red-500", icon: "flame" };
  if (score >= 40) return { label: "Warm", color: "text-amber-500", icon: "sun" };
  return { label: "Cold", color: "text-blue-400", icon: "snowflake" };
}

const filters = [
  { value: "all", label: "Active" },
  { value: "new", label: "Just Added" },
  { value: "response_sent", label: "Awaiting Reply" },
  { value: "engaged", label: "Talking" },
  { value: "price_confirmed", label: "Ready to Book" },
  { value: "cold", label: "Gone Quiet" },
  { value: "lost", label: "Not Interested" },
];

interface LeadCardProps {
  lead: Lead;
  nudges: AiNudge[];
  onGenerateFollowUp: (lead: Lead) => void;
  onSendText: (phone: string) => void;
  onNudgeClick: (nudge: AiNudge) => void;
}

function LeadCard({ lead, nudges, onGenerateFollowUp, onSendText, onNudgeClick }: LeadCardProps) {
  const config = statusConfig[lead.status] || statusConfig.new;
  const initials = lead.clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const leadNudges = nudges.filter(n => n.entityType === "lead" && n.entityId === lead.id && n.status === "active");
  const priority = inferLeadPriority({ status: lead.status, createdAt: lead.createdAt, score: lead.score });
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [confirmAction, setConfirmAction] = useState<RulesSwipeAction | null>(null);

  const eligibility = getLeadActionEligibility(lead);
  const swipeActions = getSwipeActions("lead", eligibility);

  const archiveLeadMutation = useApiMutation(
    async () => {
      return apiFetch(`/api/leads/${lead.id}/archive`, { method: "POST" });
    },
    [QUERY_KEYS.leads(), QUERY_KEYS.dashboardGamePlan()],
    {
      onSuccess: () => {
        toast({ title: "Request archived" });
        setConfirmAction(null);
      },
      onError: () => {
        toast({ title: "Failed to archive request", variant: "destructive" });
        setConfirmAction(null);
      },
    }
  );

  const deleteLeadMutation = useApiMutation(
    async () => {
      return apiFetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    },
    [QUERY_KEYS.leads(), QUERY_KEYS.dashboardGamePlan()],
    {
      onSuccess: () => {
        toast({ title: "Request deleted" });
        setConfirmAction(null);
      },
      onError: (error: any) => {
        toast({ 
          title: "Cannot delete request", 
          description: error?.message || "Try archiving instead.",
          variant: "destructive" 
        });
        setConfirmAction(null);
      },
    }
  );

  const handleSwipeAction = (action: RulesSwipeAction) => {
    if (action.requiresConfirmation) {
      setConfirmAction(action);
    } else {
      executeAction(action.id);
    }
  };

  const executeAction = (actionId: string) => {
    if (actionId === "archive") {
      archiveLeadMutation.mutate();
    } else if (actionId === "delete") {
      deleteLeadMutation.mutate();
    }
  };

  const swipeCardActions: SwipeCardAction[] = swipeActions.map(action => ({
    id: action.id,
    label: action.label,
    icon: action.icon as "Archive" | "Trash2" | "X",
    variant: action.variant,
    onClick: () => handleSwipeAction(action),
  }));

  const isPending = archiveLeadMutation.isPending || deleteLeadMutation.isPending;

  const cardContent = (
    <Card className="border-0 shadow-sm hover-elevate overflow-hidden" data-testid={`lead-card-${lead.id}`}>
      <CardContent className="p-0">
        <div className="flex">
          <div className={`w-1 ${lead.status === "new" ? "bg-emerald-500" : lead.status === "price_confirmed" ? "bg-violet-500" : "bg-blue-500"}`} />
          <div className="flex-1 p-3">
            <Link href={`/leads/${lead.id}`} data-testid={`link-lead-${lead.id}`}>
              <div className="flex items-start gap-3 cursor-pointer">
                <div className={`h-12 w-12 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-base font-semibold ${config.color}`}>
                    {initials}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{lead.clientName}</h3>
                      {priority && <PriorityBadge priority={priority} compact />}
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] px-2 py-0.5 flex-shrink-0 ${config.bg} ${config.color} border-0`}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 capitalize">{lead.serviceType}</p>
                  {leadNudges.length > 0 && (
                    <div className="mb-2" onClick={(e) => e.preventDefault()}>
                      <NudgeChips nudges={leadNudges} onNudgeClick={onNudgeClick} />
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{formatDate(lead.createdAt)}</span>
                    {(() => {
                      const heat = lead.score !== null && lead.score !== undefined ? getHeatLabel(lead.score) : null;
                      if (!heat) return null;
                      return (
                        <span className={`flex items-center gap-1 font-medium ${heat.color}`}>
                          {heat.icon === "flame" && <Flame className="h-3 w-3" />}
                          {heat.icon === "sun" && <Sun className="h-3 w-3" />}
                          {heat.icon === "snowflake" && <Snowflake className="h-3 w-3" />}
                          {heat.label}
                        </span>
                      );
                    })()}
                  </div>
                  {lead.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-1">{lead.description}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 mt-2" />
              </div>
            </Link>
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lead.sourceUrl && (
                  <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 px-2" data-testid={`button-source-${lead.id}`}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Post
                    </Button>
                  </a>
                )}
                {lead.clientPhone && (
                  <a href={`tel:${lead.clientPhone}`} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 px-2" data-testid={`button-call-${lead.id}`}>
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                  </a>
                )}
                {lead.clientPhone && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendText(lead.clientPhone!);
                    }}
                    data-testid={`button-text-${lead.id}`}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Text
                  </Button>
                )}
                {lead.clientEmail && (
                  <Link href={`/leads/${lead.id}#email`} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 px-2" data-testid={`button-email-${lead.id}`}>
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                  </Link>
                )}
              </div>
              <Button
                size="sm"
                className="h-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onGenerateFollowUp(lead);
                }}
                data-testid={`button-followup-${lead.id}`}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Follow Up
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <>
    {isMobile && swipeCardActions.length > 0 ? (
      <SwipeableCard 
        actions={swipeCardActions} 
        disabled={isPending}
        data-testid={`swipeable-lead-${lead.id}`}
      >
        {cardContent}
      </SwipeableCard>
    ) : cardContent}
    
    <ActionConfirmDialog
      open={confirmAction !== null}
      onOpenChange={(open) => !open && setConfirmAction(null)}
      title={confirmAction?.confirmTitle || "Confirm Action"}
      description={confirmAction?.confirmDescription || "Are you sure?"}
      confirmLabel={confirmAction?.label || "Confirm"}
      variant={confirmAction?.variant === "destructive" ? "destructive" : "default"}
      isPending={isPending}
      onConfirm={() => confirmAction && executeAction(confirmAction.id)}
    />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="w-full max-w-md mb-6">
        <ActivationChecklist />
      </div>
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6">
        <UserPlus className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No Leads Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Add leads to track potential clients and grow your business
      </p>
      <CoachingRenderer screen="leads" placement="empty_state" />
      <Link href="/leads/new">
        <Button className="bg-gradient-to-r from-emerald-500 to-teal-500" data-testid="button-add-first-lead">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Lead
        </Button>
      </Link>
      <BookingLinkEmptyState />
      <FreeSetupCta />
    </div>
  );
}

export default function Leads() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState<string>("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual">("friendly");
  const [selectedNudge, setSelectedNudge] = useState<AiNudge | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { sendText } = useSendText();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: QUERY_KEYS.leads(),
  });

  const { data: nudges = [] } = useQuery<AiNudge[]>({
    queryKey: QUERY_KEYS.nudges(),
  });

  const { data: profile } = useQuery<{ services: string[] | null }>({
    queryKey: QUERY_KEYS.profile(),
  });

  const showTableView = !isMobile && viewMode === "table";

  const followUpMutation = useApiMutation(
    async (params: {
      clientName: string;
      context: "new_lead" | "no_response";
      daysSinceInteraction: number;
      tone: "friendly" | "professional" | "casual";
    }) => {
      return apiFetch("/api/ai/follow-up", {
        method: "POST",
        body: JSON.stringify(params),
      }) as Promise<FollowUpMessage>;
    },
    [],
    {
      onSuccess: (data: FollowUpMessage) => {
        setFollowUpMessage(data.message);
      },
      onError: () => {
        toast({ title: "Failed to generate message", variant: "destructive" });
      },
    }
  );

  const handleGenerateFollowUp = (lead: Lead) => {
    setSelectedLead(lead);
    setFollowUpMessage("");
  };

  const handleGenerateMessage = () => {
    if (!selectedLead) return;
    const daysSince = getDaysSince(selectedLead.lastContactedAt || selectedLead.createdAt);
    const context = selectedLead.status === "new" ? "new_lead" : "no_response";
    followUpMutation.mutate({
      clientName: selectedLead.clientName,
      context,
      daysSinceInteraction: daysSince,
      tone,
    });
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(followUpMessage);
    toast({ title: "Message copied to clipboard" });
  };

  const filteredLeads = filter === "all" 
    ? leads.filter(lead => lead.status !== "cold" && lead.status !== "lost")
    : leads.filter(lead => lead.status === filter);

  const newCount = leads.filter(l => l.status === "new").length;
  const convertedCount = leads.filter(l => l.status === "converted").length;

  const contactedCount = leads.filter(l => l.status === "response_sent").length;
  const totalLeadsCount = leads.length;

  const renderMobileLayout = () => (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-leads">
      <div 
        className="relative overflow-hidden text-white px-4 pt-6 pb-8"
        style={{ 
          background: isDarkMode 
            ? 'linear-gradient(180deg, #0E3D2E 0%, #124737 100%)'
            : 'linear-gradient(180deg, #1FA97A 0%, #1B9B71 45%, #178B67 100%)',
          boxShadow: 'inset 0 -16px 24px rgba(0, 0, 0, 0.08)'
        }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-teal-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-2xl font-bold">Leads</h1>
                <HelpLink slug="leads-booking-requests" label="Help with Leads" className="text-white/80 hover:text-white hover:bg-white/10" />
              </div>
              <p className="text-sm text-white/80">Track potential clients</p>
              <CoachingRenderer screen="leads" />
            </div>
            <Link href="/leads/new">
              <Button size="icon" className="bg-white/20 hover:bg-white/30 text-white" aria-label="Add new lead" data-testid="button-add-lead-header">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-white/80" />
                <span className="text-xs text-white/80">New</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-new-count">{newCount}</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-white/80" />
                <span className="text-xs text-white/80">Converted</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-converted-count">{convertedCount}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 py-6 -mt-4">
        <div className="flex flex-col gap-4 mb-6">
          <Card className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-1">
              <div className="flex gap-1 overflow-x-auto">
                {filters.slice(0, 4).map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      filter === f.value
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    data-testid={`filter-${f.value}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Link href="/leads/new">
            <Button className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg" data-testid="button-add-lead">
              <Plus className="h-5 w-5 mr-2" />
              Add New Lead
            </Button>
          </Link>
        </div>

        <BookingLinkShare variant="inline" context="leads" />

        <FollowUpCheckIn />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 bg-muted animate-pulse rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <LeadCard 
                key={lead.id} 
                lead={lead}
                nudges={nudges}
                onGenerateFollowUp={handleGenerateFollowUp}
                onSendText={(phone) => sendText({ phoneNumber: phone, message: "" })}
                onNudgeClick={(nudge) => setSelectedNudge(nudge)}
              />
            ))}
          </div>
        )}
        
        <div className="h-6" />
      </div>
    </div>
  );

  const renderDesktopLayout = () => (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-leads">
      <div className="border-b bg-background sticky top-0 z-[999]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Leads</h1>
                  <HelpLink slug="leads-booking-requests" label="Help with Leads" />
                </div>
                <p className="text-sm text-muted-foreground">Track potential clients</p>
                <CoachingRenderer screen="leads" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-8 pr-6 border-r">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-new-count">{newCount}</p>
                  <p className="text-xs text-muted-foreground">New</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-converted-count">{convertedCount}</p>
                  <p className="text-xs text-muted-foreground">Converted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-contacted-count">{contactedCount}</p>
                  <p className="text-xs text-muted-foreground">Contacted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-leads">{totalLeadsCount}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>

              <Link href="/leads/new">
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md" data-testid="button-add-lead-header-desktop">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter(f.value)}
                className={`h-9 ${filter === f.value ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                data-testid={`filter-${f.value}`}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-9"
              data-testid="view-mode-table"
            >
              <List className="h-4 w-4 mr-1" />
              Table
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="h-9"
              data-testid="view-mode-cards"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Cards
            </Button>
          </div>
        </div>

        <BookingLinkShare variant="inline" context="leads" />

        <FollowUpCheckIn />

        {isLoading ? (
          showTableView ? (
            <LeadsTableView leads={[]} isLoading={true} />
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 bg-muted animate-pulse rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : filteredLeads.length === 0 ? (
          <EmptyState />
        ) : showTableView ? (
          <LeadsTableView leads={filteredLeads} />
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLeads.map((lead) => (
              <LeadCard 
                key={lead.id} 
                lead={lead}
                nudges={nudges}
                onGenerateFollowUp={handleGenerateFollowUp}
                onSendText={(phone) => sendText({ phoneNumber: phone, message: "" })}
                onNudgeClick={(nudge) => setSelectedNudge(nudge)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-followup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
              Follow-Up Message
            </DialogTitle>
            <DialogDescription>
              AI-generated message for {selectedLead?.clientName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger className="w-[140px]" data-testid="select-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleGenerateMessage}
                disabled={followUpMutation.isPending}
                className="flex-1"
                data-testid="button-generate"
              >
                {followUpMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                Generate
              </Button>
            </div>

            {followUpMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Textarea
                value={followUpMessage}
                onChange={(e) => setFollowUpMessage(e.target.value)}
                className="min-h-[120px] resize-none"
                placeholder="Generated message will appear here..."
                data-testid="textarea-message"
              />
            )}
          </div>

          <DialogFooter className="flex-col gap-2">
            <Button
              onClick={() => {
                if (selectedLead?.clientPhone && followUpMessage) {
                  sendText({ phoneNumber: selectedLead.clientPhone, message: followUpMessage });
                  setSelectedLead(null);
                }
              }}
              disabled={!followUpMessage || !selectedLead?.clientPhone || followUpMutation.isPending}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500"
              data-testid="button-send-text"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Text Message
            </Button>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setSelectedLead(null)}
                className="flex-1"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyMessage}
                disabled={!followUpMessage || followUpMutation.isPending}
                className="flex-1"
                data-testid="button-copy"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Only
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NudgeActionSheet
        nudge={selectedNudge}
        open={!!selectedNudge}
        onClose={() => setSelectedNudge(null)}
      />
    </>
  );
}
