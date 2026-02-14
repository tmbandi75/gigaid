import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { MessageSquare, Loader2, Sparkles, Copy, Send, Check, Phone, User, Info } from "lucide-react";
import { UpgradeInterceptModal } from "@/upgrade";
import type { Job, Lead } from "@shared/schema";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface MessageUsage {
  outboundSent: number;
  outboundLimit: number | null;
  outboundRemaining: number | null;
  inboxEnabled: boolean;
  plan: string;
  isFirstSend?: boolean;
}

interface FollowUpMessage {
  message: string;
  subject?: string;
}

interface ClientOption {
  id: string;
  name: string;
  phone: string | null;
  type: "job" | "lead";
  context: string;
  serviceType?: string;
}

export function FollowUpComposer() {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual">("friendly");
  const [context, setContext] = useState<"job_completed" | "quote_sent" | "new_lead" | "no_response">("job_completed");
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showFirstSendTooltip, setShowFirstSendTooltip] = useState(false);
  const [inboxInterceptOpen, setInboxInterceptOpen] = useState(false);

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: QUERY_KEYS.jobs(),
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: QUERY_KEYS.leads(),
  });

  const { data: usage } = useQuery<MessageUsage>({
    queryKey: QUERY_KEYS.messagesUsage(),
  });

  const clientOptions: ClientOption[] = [
    ...jobs
      .filter(job => job.clientName && job.clientPhone)
      .map(job => ({
        id: `job-${job.id}`,
        name: job.clientName || "Unknown",
        phone: job.clientPhone,
        type: "job" as const,
        context: job.status === "completed" ? "Job Completed" : "Active Job",
        serviceType: job.serviceType || job.title || undefined,
      })),
    ...leads
      .filter(lead => lead.clientName && lead.clientPhone)
      .map(lead => ({
        id: `lead-${lead.id}`,
        name: lead.clientName,
        phone: lead.clientPhone,
        type: "lead" as const,
        context: lead.status === "new" ? "New Lead" : "Existing Lead",
        serviceType: lead.serviceType || undefined,
      })),
  ];

  const selectedClient = clientOptions.find(c => c.id === selectedClientId);

  const generateMutation = useApiMutation(
    async () => {
      if (!selectedClient) throw new Error("No client selected");
      return apiFetch<FollowUpMessage>("/api/ai/follow-up", {
        method: "POST",
        body: JSON.stringify({
          clientName: selectedClient.name,
          context,
          lastService: selectedClient.serviceType,
          tone,
        }),
      });
    },
    [],
    {
      onSuccess: (data) => {
        setMessage(data.message);
        toast({ title: "Follow-up message generated!" });
      },
      onError: () => {
        toast({ title: "Failed to generate message", variant: "destructive" });
      },
    }
  );

  const trackRespondTap = async () => {
    if (!selectedClient || selectedClient.type !== "lead") return;
    const leadId = selectedClient.id.replace("lead-", "");
    try {
      await apiFetch(`/api/leads/${leadId}/respond-tap`, { method: "POST" });
    } catch (err) {
      console.debug("[RespondTap] Failed to track:", err);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
    trackRespondTap();
  };

  const sendMutation = useApiMutation(
    async (payload: { to: string; message: string; clientName: string; relatedJobId: string | null; relatedLeadId: string | null }) => {
      return apiFetch<{ isFirstSend?: boolean }>("/api/sms/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    [QUERY_KEYS.messagesUsage()],
    {
      onSuccess: (data) => {
        if (data.isFirstSend) {
          setShowFirstSendTooltip(true);
          setTimeout(() => setShowFirstSendTooltip(false), 8000);
        }
        toast({ title: "Message sent via GigAid!" });
        setMessage("");
        trackRespondTap();
      },
      onError: (error: any) => {
        const errorMessage = error?.message || "Failed to send message";
        if (errorMessage.includes("SMS_LIMIT_EXCEEDED")) {
          toast({ 
            title: "Message limit reached", 
            description: "Upgrade to send more messages this month.",
            variant: "destructive" 
          });
        } else {
          toast({ title: "Failed to send message", variant: "destructive" });
        }
      },
    }
  );

  const handleSend = async () => {
    if (!message || !selectedClient?.phone) return;
    sendMutation.mutate({
      to: selectedClient.phone,
      message: message,
      clientName: selectedClient.name,
      relatedJobId: selectedClient.type === "job" ? selectedClient.id : null,
      relatedLeadId: selectedClient.type === "lead" ? selectedClient.id : null,
    });
  };

  const contextLabels = {
    job_completed: "Job Completed",
    quote_sent: "Quote Sent",
    new_lead: "New Lead",
    no_response: "No Response",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Follow-Up Message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Client</Label>
          {clientOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clients with phone numbers found. Add clients through jobs or leads first.
            </p>
          ) : (
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger data-testid="select-client">
                <SelectValue placeholder="Choose a client to follow up with..." />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>{client.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {client.type === "job" ? "Job" : "Lead"}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedClient && (
          <div className="p-3 rounded-md bg-muted/50 space-y-2" data-testid="selected-client-info">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">{selectedClient.name}</span>
              <Badge variant="outline">{selectedClient.context}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{selectedClient.phone}</span>
            </div>
            {selectedClient.serviceType && (
              <p className="text-xs text-muted-foreground">
                Service: {selectedClient.serviceType}
              </p>
            )}
          </div>
        )}

        {selectedClient && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="context">Context</Label>
                <Select value={context} onValueChange={(v) => setContext(v as typeof context)}>
                  <SelectTrigger data-testid="select-context">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_completed">Job Completed</SelectItem>
                    <SelectItem value="quote_sent">Quote Sent</SelectItem>
                    <SelectItem value="new_lead">New Lead</SelectItem>
                    <SelectItem value="no_response">No Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              className="w-full"
              data-testid="button-generate-followup"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Message
            </Button>
          </>
        )}

        {message && (
          <>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              placeholder="Your follow-up message..."
              data-testid="textarea-followup-message"
            />

            <div className="p-3 rounded-md bg-muted/30 border" data-testid="recipient-confirmation">
              <p className="text-xs text-muted-foreground mb-1">Will be sent to:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Phone className="h-4 w-4" />
                <span className="font-medium" data-testid="text-recipient-name">{selectedClient?.name}</span>
                <span className="text-muted-foreground" data-testid="text-recipient-phone">({selectedClient?.phone})</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="w-full"
                data-testid="button-copy-message"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copied!" : "Copy & send via phone"}
              </Button>
              <Tooltip open={showFirstSendTooltip}>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleSend} 
                    className="w-full" 
                    disabled={sendMutation.isPending || !selectedClient?.phone}
                    data-testid="button-send-followup"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send from GigAid
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs p-3" data-testid="tooltip-first-send">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Replies will go to your phone</p>
                      <button
                        className="text-primary mt-1 text-left hover:underline cursor-pointer"
                        onClick={() => setInboxInterceptOpen(true)}
                        data-testid="button-followup-inbox-upgrade"
                      >
                        Tap to unlock in-app replies
                      </button>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </CardContent>

      <UpgradeInterceptModal
        open={inboxInterceptOpen}
        onOpenChange={setInboxInterceptOpen}
        featureKey="sms.two_way"
        featureName="In-App Replies"
      />
    </Card>
  );
}
