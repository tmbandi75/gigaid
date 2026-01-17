import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Loader2, Sparkles, Copy, Send, Check, Phone, User } from "lucide-react";
import type { Job, Lead } from "@shared/schema";

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

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
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

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("No client selected");
      const response = await apiRequest("POST", "/api/ai/follow-up", {
        clientName: selectedClient.name,
        context,
        lastService: selectedClient.serviceType,
        tone,
      });
      return response.json() as Promise<FollowUpMessage>;
    },
    onSuccess: (data) => {
      setMessage(data.message);
      toast({ title: "Follow-up message generated!" });
    },
    onError: () => {
      toast({ title: "Failed to generate message", variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!message || !selectedClient?.phone) return;
    
    setIsSending(true);
    try {
      await apiRequest("POST", "/api/sms/send", {
        to: selectedClient.phone,
        message: message,
        clientName: selectedClient.name,
        relatedJobId: selectedClient.type === "job" ? selectedClient.id : null,
        relatedLeadId: selectedClient.type === "lead" ? selectedClient.id : null,
      });
      toast({ title: "Message sent successfully!" });
      setMessage("");
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1"
                data-testid="button-copy-message"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button 
                onClick={handleSend} 
                className="flex-1" 
                disabled={isSending || !selectedClient?.phone}
                data-testid="button-send-followup"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send SMS
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
