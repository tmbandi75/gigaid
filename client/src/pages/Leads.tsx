import { useQuery, useMutation } from "@tanstack/react-query";
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
  Star,
  Mail,
  Send
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSendText } from "@/hooks/use-send-text";
import { apiRequest } from "@/lib/queryClient";
import type { Lead } from "@shared/schema";

interface FollowUpMessage {
  message: string;
  subject?: string;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  new: { color: "text-emerald-600", bg: "bg-emerald-500/10", label: "New" },
  contacted: { color: "text-blue-600", bg: "bg-blue-500/10", label: "Contacted" },
  converted: { color: "text-violet-600", bg: "bg-violet-500/10", label: "Won" },
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

function getScoreColor(score: number | null): string {
  if (!score) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
}

const filters = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Won" },
];

function LeadCard({ lead, onGenerateFollowUp, onSendText }: { lead: Lead; onGenerateFollowUp: (lead: Lead) => void; onSendText: (phone: string) => void }) {
  const config = statusConfig[lead.status] || statusConfig.new;
  const initials = lead.clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <Card className="border-0 shadow-sm hover-elevate overflow-hidden" data-testid={`lead-card-${lead.id}`}>
      <CardContent className="p-0">
        <div className="flex">
          <div className={`w-1 ${lead.status === "new" ? "bg-emerald-500" : lead.status === "converted" ? "bg-violet-500" : "bg-blue-500"}`} />
          <div className="flex-1 p-4">
            <Link href={`/leads/${lead.id}`} data-testid={`link-lead-${lead.id}`}>
              <div className="flex items-start gap-3 cursor-pointer">
                <div className={`h-12 w-12 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-base font-semibold ${config.color}`}>
                    {initials}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{lead.clientName}</h3>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] px-2 py-0.5 flex-shrink-0 ${config.bg} ${config.color} border-0`}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 capitalize">{lead.serviceType}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{formatDate(lead.createdAt)}</span>
                    {lead.score && (
                      <span className={`flex items-center gap-1 font-medium ${getScoreColor(lead.score)}`}>
                        <Star className="h-3 w-3" />
                        {lead.score}%
                      </span>
                    )}
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
                  <a href={`mailto:${lead.clientEmail}`} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 px-2" data-testid={`button-email-${lead.id}`}>
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                  </a>
                )}
              </div>
              <Button
                variant="outline"
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
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6">
        <UserPlus className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No Leads Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Add leads to track potential clients and grow your business
      </p>
      <Link href="/leads/new">
        <Button className="bg-gradient-to-r from-emerald-500 to-teal-500" data-testid="button-add-first-lead">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Lead
        </Button>
      </Link>
    </div>
  );
}

export default function Leads() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [followUpMessage, setFollowUpMessage] = useState<string>("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual">("friendly");
  const { toast } = useToast();
  const { sendText } = useSendText();
  
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const followUpMutation = useMutation({
    mutationFn: async (params: {
      clientName: string;
      context: "new_lead" | "no_response";
      daysSinceInteraction: number;
      tone: "friendly" | "professional" | "casual";
    }) => {
      const response = await apiRequest("POST", "/api/ai/follow-up", params);
      return response.json() as Promise<FollowUpMessage>;
    },
    onSuccess: (data) => {
      setFollowUpMessage(data.message);
    },
    onError: () => {
      toast({ title: "Failed to generate message", variant: "destructive" });
    },
  });

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
    ? leads 
    : leads.filter(lead => lead.status === filter);

  const newCount = leads.filter(l => l.status === "new").length;
  const convertedCount = leads.filter(l => l.status === "converted").length;

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-leads">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white px-4 pt-6 pb-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-teal-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Leads</h1>
              <p className="text-sm text-white/80">Track potential clients</p>
            </div>
            <Link href="/leads/new">
              <Button size="icon" className="bg-white/20 hover:bg-white/30 text-white" data-testid="button-add-lead-header">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-white/80" />
                <span className="text-xs text-white/80">New Leads</span>
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
        <Card className="border-0 shadow-md mb-4 overflow-hidden">
          <CardContent className="p-1">
            <div className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
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
          <Button className="w-full mb-6 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg" data-testid="button-add-lead">
            <Plus className="h-5 w-5 mr-2" />
            Add New Lead
          </Button>
        </Link>

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
                onGenerateFollowUp={handleGenerateFollowUp}
                onSendText={(phone) => sendText({ phoneNumber: phone, message: "" })}
              />
            ))}
          </div>
        )}
        
        <div className="h-6" />
      </div>

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
    </div>
  );
}
