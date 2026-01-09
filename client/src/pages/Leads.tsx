import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, UserPlus, Phone, ChevronRight, Sparkles, Copy, Loader2, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Lead } from "@shared/schema";

interface FollowUpMessage {
  message: string;
  subject?: string;
}

const statusColors: Record<string, string> = {
  new: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  contacted: "bg-primary/10 text-primary border-primary/20",
  converted: "bg-chart-2/10 text-chart-2 border-chart-2/20",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function LeadCard({ lead, onGenerateFollowUp }: { lead: Lead; onGenerateFollowUp: (lead: Lead) => void }) {
  return (
    <Card className="hover-elevate" data-testid={`lead-card-${lead.id}`}>
      <CardContent className="p-4">
        <Link href={`/leads/${lead.id}`}>
          <div className="flex items-start gap-3 cursor-pointer">
            <div className="h-12 w-12 rounded-full bg-chart-3/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-medium text-chart-3">
                {lead.clientName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-medium text-foreground truncate">{lead.clientName}</h3>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 flex-shrink-0 capitalize ${statusColors[lead.status]}`}
                >
                  {lead.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2 capitalize">{lead.serviceType}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{formatDate(lead.createdAt)}</span>
                {lead.clientPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.clientPhone}
                  </span>
                )}
              </div>
              {lead.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-1">{lead.description}</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
          </div>
        </Link>
        <div className="mt-3 pt-3 border-t flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onGenerateFollowUp(lead);
            }}
            data-testid={`button-followup-${lead.id}`}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Follow Up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        <UserPlus className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No Leads Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Add leads to track potential clients and grow your business
      </p>
      <Link href="/leads/new">
        <Button data-testid="button-add-first-lead">
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
    const daysSince = getDaysSince(lead.lastContactedAt || lead.createdAt);
    const context = lead.status === "new" ? "new_lead" : "no_response";
    followUpMutation.mutate({
      clientName: lead.clientName,
      context,
      daysSinceInteraction: daysSince,
      tone,
    });
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(followUpMessage);
    toast({ title: "Message copied to clipboard" });
  };

  const handleRegenerateWithTone = (newTone: "friendly" | "professional" | "casual") => {
    setTone(newTone);
    if (selectedLead) {
      const daysSince = getDaysSince(selectedLead.lastContactedAt || selectedLead.createdAt);
      const context = selectedLead.status === "new" ? "new_lead" : "no_response";
      followUpMutation.mutate({
        clientName: selectedLead.clientName,
        context,
        daysSinceInteraction: daysSince,
        tone: newTone,
      });
    }
  };

  const filteredLeads = filter === "all" 
    ? leads 
    : leads.filter(lead => lead.status === filter);

  return (
    <div className="flex flex-col min-h-full" data-testid="page-leads">
      <TopBar title="Leads" />
      
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <Tabs value={filter} onValueChange={setFilter} className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-10">
              <TabsTrigger value="all" className="text-xs" data-testid="filter-all">
                All ({leads.length})
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs" data-testid="filter-new">
                New
              </TabsTrigger>
              <TabsTrigger value="contacted" className="text-xs" data-testid="filter-contacted">
                Contacted
              </TabsTrigger>
              <TabsTrigger value="converted" className="text-xs" data-testid="filter-converted">
                Won
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <Link href="/leads/new">
          <Button className="w-full mb-6 h-12" data-testid="button-add-lead">
            <Plus className="h-5 w-5 mr-2" />
            Add New Lead
          </Button>
        </Link>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
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
              <LeadCard key={lead.id} lead={lead} onGenerateFollowUp={handleGenerateFollowUp} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-followup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Follow-Up Message
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                AI-generated message for <span className="font-medium text-foreground">{selectedLead?.clientName}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <Select value={tone} onValueChange={(v) => handleRegenerateWithTone(v as any)}>
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
                size="sm"
                onClick={() => selectedLead && handleGenerateFollowUp(selectedLead)}
                disabled={followUpMutation.isPending}
                data-testid="button-regenerate"
              >
                {followUpMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
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

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedLead(null)}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCopyMessage}
              disabled={!followUpMessage || followUpMutation.isPending}
              className="flex-1"
              data-testid="button-copy"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
