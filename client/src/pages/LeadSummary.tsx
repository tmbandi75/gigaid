import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  User,
  Briefcase,
  MessageCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  Send,
  Eye,
  ExternalLink,
  Copy,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import type { Lead, PriceConfirmation, AiNudge } from "@shared/schema";
import { LeadEmailConversation } from "@/components/lead/LeadEmailConversation";
import { LeadTextComposer } from "@/components/lead/LeadTextComposer";
import { LeadSmsConversation } from "@/components/lead/LeadSmsConversation";
import { useState, useEffect } from "react";
import { useNudges, useGenerateNudges, useFeatureFlag } from "@/hooks/use-nudges";
import { NudgeChips } from "@/components/nudges/NudgeChip";
import { NudgeActionSheet } from "@/components/nudges/NudgeActionSheet";
import { NextActionBanner } from "@/components/NextActionBanner";
import { IntentActionCard } from "@/components/IntentActionCard";

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  new: { label: "New", color: "text-blue-600", bgColor: "bg-blue-500/10" },
  response_sent: { label: "Contacted", color: "text-amber-600", bgColor: "bg-amber-500/10" },
  engaged: { label: "Engaged", color: "text-violet-600", bgColor: "bg-violet-500/10" },
  price_confirmed: { label: "Price Confirmed", color: "text-green-600", bgColor: "bg-green-500/10" },
  cold: { label: "Cold", color: "text-gray-600", bgColor: "bg-gray-500/10" },
  lost: { label: "Lost", color: "text-red-600", bgColor: "bg-red-500/10" },
};

const sourceConfig: Record<string, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "bg-blue-500" },
  craigslist: { label: "Craigslist", color: "bg-purple-500" },
  nextdoor: { label: "Nextdoor", color: "bg-green-500" },
  referral: { label: "Referral", color: "bg-amber-500" },
  manual: { label: "Manual", color: "bg-gray-500" },
  booking: { label: "Booking", color: "bg-cyan-500" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function LeadSummary() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ["/api/leads", id],
    enabled: !!id,
  });

  const { data: activePriceConfirmation } = useQuery<PriceConfirmation | null>({
    queryKey: ["/api/leads", id, "active-price-confirmation"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${id}/active-price-confirmation`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      return data || null;
    },
    enabled: !!id,
  });

  const { data: featureFlag } = useFeatureFlag("ai_micro_nudges");
  const { data: nudges = [] } = useNudges("lead", id);
  const [selectedNudge, setSelectedNudge] = useState<AiNudge | null>(null);
  const [nudgeSheetOpen, setNudgeSheetOpen] = useState(false);

  const handleNudgeClick = (nudge: AiNudge) => {
    setSelectedNudge(nudge);
    setNudgeSheetOpen(true);
  };

  const handleCreateJobFromNudge = (prefill: any) => {
    navigate(`/jobs/new?leadId=${id}`);
  };

  // Scroll to email section if #email hash is in URL
  useEffect(() => {
    if (window.location.hash === '#email' && lead) {
      setTimeout(() => {
        const emailSection = document.querySelector('[data-testid="lead-email-section"]');
        if (emailSection) {
          emailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [lead]);

  const convertToJobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/leads/${id}/convert`);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Lead converted to job!" });
      navigate(`/jobs/${data.jobId}`);
    },
    onError: () => {
      toast({ title: "Failed to convert lead", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" data-testid="page-lead-not-found">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Lead not found</p>
        <Button onClick={() => navigate("/leads")} data-testid="button-back-to-leads">
          Back to Leads
        </Button>
      </div>
    );
  }

  const status = statusConfig[lead.status] || statusConfig.new;
  const source = sourceConfig[lead.source || "manual"] || sourceConfig.manual;

  const handleCall = () => {
    if (lead.clientPhone) {
      window.location.href = `tel:${lead.clientPhone}`;
    }
  };

  const handleEmail = () => {
    if (lead.clientEmail) {
      const emailSection = document.querySelector('[data-testid="lead-email-section"]');
      if (emailSection) {
        emailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const priceConfirmationStatusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    draft: { label: "Draft", icon: FileText, color: "text-gray-500" },
    sent: { label: "Sent", icon: Send, color: "text-blue-500" },
    viewed: { label: "Viewed", icon: Eye, color: "text-amber-500" },
    confirmed: { label: "Confirmed", icon: CheckCircle2, color: "text-green-500" },
    expired: { label: "Expired", icon: Clock, color: "text-red-500" },
  };
  const priceConfirmationStatus = activePriceConfirmation?.status;
  const pcStatus = priceConfirmationStatus ? priceConfirmationStatusConfig[priceConfirmationStatus] : null;

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-lead-summary">
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white px-4 pt-6 pb-16">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/leads")}
              className="text-white hover:bg-white/20 -ml-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/leads/${id}/edit`)}
              data-testid="button-edit"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <User className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate" data-testid="text-client-name">{lead.clientName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={`${status.bgColor} ${status.color} border-0`} data-testid="badge-status">
                  {status.label}
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-0" data-testid="badge-source">
                  {source.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4">
        <IntentActionCard entityType="lead" entityId={id!} />
        <NextActionBanner entityType="lead" entityId={id!} />
        
        {featureFlag?.enabled && nudges.length > 0 && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10" data-testid="card-nudges">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <h3 className="font-semibold text-sm">AI Suggestions</h3>
              </div>
              <NudgeChips nudges={nudges} onNudgeClick={handleNudgeClick} />
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-lg" data-testid="card-contact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-teal-500" />
              <h3 className="font-semibold text-sm">Contact Info</h3>
            </div>
            <div className="space-y-3">
              {lead.clientPhone && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
                    <p className="font-medium" data-testid="text-phone">{lead.clientPhone}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCall} data-testid="button-call">
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </Button>
                </div>
              )}
              {lead.clientEmail && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                    <p className="font-medium" data-testid="text-email">{lead.clientEmail}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleEmail} data-testid="button-email">
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </Button>
                </div>
              )}
              {!lead.clientPhone && !lead.clientEmail && (
                <p className="text-sm text-muted-foreground">No contact info available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {lead.description && (
          <Card className="border-0 shadow-md bg-primary/5 border-l-4 border-l-primary" data-testid="card-description">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">
                  {lead.source === "booking_form" ? "Client's Request" : "Description"}
                </h3>
                {lead.source === "booking_form" && (
                  <Badge variant="secondary" className="text-xs ml-auto">From booking form</Badge>
                )}
              </div>
              <p className="text-sm" data-testid="text-description">{lead.description}</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-md" data-testid="card-service">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="h-4 w-4 text-violet-500" />
              <h3 className="font-semibold text-sm">Service Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Service Type</p>
                <p className="font-medium capitalize" data-testid="text-service">{lead.serviceType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created</p>
                <p className="font-medium" data-testid="text-created">{formatDate(lead.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {lead.notes && (
          <Card className="border-0 shadow-md" data-testid="card-notes">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-sm">Notes</h3>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-notes">{lead.notes}</p>
            </CardContent>
          </Card>
        )}

        <LeadSmsConversation
          leadId={lead.id}
          clientPhone={lead.clientPhone}
          clientName={lead.clientName}
        />

        <LeadTextComposer
          leadId={lead.id}
          clientPhone={lead.clientPhone}
          clientName={lead.clientName}
          serviceType={lead.serviceType}
          description={lead.description || undefined}
        />

        <LeadEmailConversation 
          leadId={lead.id} 
          clientEmail={lead.clientEmail} 
          clientName={lead.clientName}
          serviceType={lead.serviceType}
          description={lead.description || undefined}
        />

        {lead.sourceUrl && (
          <Card className="border-0 shadow-md" data-testid="card-source-url">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-cyan-500" />
                  <h3 className="font-semibold text-sm">Source Link</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(lead.sourceUrl!, "_blank")}
                  data-testid="button-open-source"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activePriceConfirmation && pcStatus && (
          <Card className="border-0 shadow-md" data-testid="card-price-confirmation">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">Price Confirmation</h3>
                </div>
                <Badge variant="secondary" className={pcStatus.color} data-testid="badge-pc-status">
                  <pcStatus.icon className="h-3 w-3 mr-1" />
                  {pcStatus.label}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Price:</span>
                  <span className="font-bold text-lg" data-testid="text-pc-price">
                    ${((activePriceConfirmation.agreedPrice || 0) / 100).toFixed(2)}
                  </span>
                </div>
                {activePriceConfirmation.notes && (
                  <p className="text-sm text-muted-foreground" data-testid="text-pc-notes">
                    {activePriceConfirmation.notes}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator className="my-2" />

        <div className="space-y-3">
          {lead.status !== "price_confirmed" && !lead.convertedJobId && (
            <Button
              className="w-full h-12"
              variant="outline"
              onClick={() => navigate(`/leads/${id}/edit`)}
              data-testid="button-send-price"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              Send Price Confirmation
            </Button>
          )}

          {!lead.convertedJobId && (
            <Button
              className="w-full h-12"
              onClick={() => convertToJobMutation.mutate()}
              disabled={convertToJobMutation.isPending}
              data-testid="button-convert"
            >
              {convertToJobMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              )}
              Convert to Job
            </Button>
          )}

          {lead.convertedJobId && (
            <Button
              className="w-full h-12"
              onClick={() => navigate(`/jobs/${lead.convertedJobId}`)}
              data-testid="button-view-job"
            >
              <Briefcase className="h-5 w-5 mr-2" />
              View Job
            </Button>
          )}

          <Button
            className="w-full h-12"
            variant="secondary"
            onClick={() => navigate(`/leads/${id}/edit`)}
            data-testid="button-edit-bottom"
          >
            <Edit className="h-5 w-5 mr-2" />
            Edit Lead Details
          </Button>
        </div>
      </div>

      <NudgeActionSheet
        nudge={selectedNudge}
        open={nudgeSheetOpen}
        onClose={() => {
          setNudgeSheetOpen(false);
          setSelectedNudge(null);
        }}
        onCreateJob={handleCreateJobFromNudge}
      />
    </div>
  );
}
