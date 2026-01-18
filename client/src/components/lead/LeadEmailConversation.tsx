import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Send, Loader2, Inbox, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, Sparkles, RefreshCw } from "lucide-react";
import type { LeadEmail } from "@shared/schema";

interface LeadEmailConversationProps {
  leadId: string;
  clientEmail: string | null;
  clientName: string;
  serviceType?: string;
  description?: string;
}

const replyScenarios = [
  { id: "quote", label: "Quote", icon: "DollarSign" },
  { id: "availability", label: "Availability", icon: "Calendar" },
  { id: "followup", label: "Follow-up", icon: "Bell" },
  { id: "details", label: "Ask details", icon: "MessageCircle" },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EmailMessage({ email, isExpanded, onToggle }: { email: LeadEmail; isExpanded: boolean; onToggle: () => void }) {
  const isOutbound = email.direction === "outbound";
  
  // Get preview text (first line or first 60 chars)
  const previewText = email.bodyText.split('\n')[0].substring(0, 60) + (email.bodyText.length > 60 ? '...' : '');
  
  return (
    <div 
      className={`border-b border-border last:border-b-0 cursor-pointer hover-elevate transition-colors ${isExpanded ? 'bg-muted/30' : ''}`}
      onClick={onToggle}
      data-testid={`email-message-${email.id}`}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isOutbound ? 'bg-primary' : 'bg-green-500'}`} />
          <span className="text-sm font-medium truncate flex-1">
            {isOutbound ? 'You' : email.fromEmail?.split('@')[0] || 'Client'}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDate(email.sentAt || email.receivedAt || email.createdAt)}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
        
        {!isExpanded && (
          <div className="ml-4 mt-1">
            <span className="text-xs font-medium text-foreground">{email.subject}</span>
            <span className="text-xs text-muted-foreground"> - {previewText}</span>
          </div>
        )}
        
        {isExpanded && (
          <div className="ml-4 mt-3 space-y-2">
            <div className="text-sm font-medium">{email.subject}</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-background p-3 rounded-md border">
              {email.bodyText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadEmailConversation({ leadId, clientEmail, clientName, serviceType, description }: LeadEmailConversationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [showAllEmails, setShowAllEmails] = useState(false);

  const { data: emails = [], isLoading } = useQuery<LeadEmail[]>({
    queryKey: ["/api/leads", leadId, "emails"],
    enabled: !!leadId,
  });

  // Show only latest 3 emails by default, all if expanded
  const visibleEmails = showAllEmails ? emails : emails.slice(0, 3);
  const hiddenCount = emails.length - 3;

  const generateReplyMutation = useMutation({
    mutationFn: async (scenario: string) => {
      const response = await apiRequest("POST", "/api/ai/generate-negotiation-reply", {
        leadId,
        scenario,
        clientName,
        serviceType: serviceType || "service",
        description: description || "",
      });
      return response.json();
    },
    onSuccess: (data) => {
      setBody(data.reply);
      if (!subject) {
        setSubject(`Re: ${serviceType || "Your inquiry"}`);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate reply. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleScenarioSelect = (scenario: string) => {
    setSelectedScenario(scenario);
    generateReplyMutation.mutate(scenario);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; body: string; includeSignature: boolean }) => {
      return apiRequest("POST", `/api/leads/${leadId}/emails`, data);
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      setSubject("");
      setBody("");
      setSelectedScenario(null);
      setShowCompose(false);
    },
    onError: () => {
      toast({ title: "Failed to send email", variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Please fill in subject and message", variant: "destructive" });
      return;
    }
    sendEmailMutation.mutate({ subject, body, includeSignature });
  };

  if (!clientEmail) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Mail className="h-5 w-5" />
            <span className="text-sm">No email address for this lead</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm" data-testid="lead-email-section">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Conversation
          </CardTitle>
          {!showCompose && (
            <Button 
              size="sm" 
              onClick={() => setShowCompose(true)}
              data-testid="button-compose-email"
            >
              <Send className="h-4 w-4 mr-2" />
              Compose
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCompose && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg" data-testid="email-compose-form">
            <div>
              <Label htmlFor="email-to" className="text-xs text-muted-foreground">To</Label>
              <div className="text-sm font-medium">{clientName} &lt;{clientEmail}&gt;</div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                AI Reply Composer
              </Label>
              <div className="flex flex-wrap gap-2">
                {replyScenarios.map((scenario) => (
                  <Button
                    key={scenario.id}
                    type="button"
                    variant={selectedScenario === scenario.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleScenarioSelect(scenario.id)}
                    disabled={generateReplyMutation.isPending}
                    data-testid={`button-ai-scenario-${scenario.id}`}
                  >
                    {generateReplyMutation.isPending && selectedScenario === scenario.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    {scenario.label}
                  </Button>
                ))}
                {selectedScenario && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleScenarioSelect(selectedScenario)}
                    disabled={generateReplyMutation.isPending}
                    data-testid="button-regenerate-reply"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${generateReplyMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Enter subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
            <div>
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                placeholder="Write your message or use AI Reply Composer above..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                data-testid="input-email-body"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="include-signature"
                  checked={includeSignature}
                  onCheckedChange={setIncludeSignature}
                  data-testid="switch-include-signature"
                />
                <Label htmlFor="include-signature" className="text-sm">Include signature</Label>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowCompose(false)}
                  data-testid="button-cancel-email"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSend}
                  disabled={sendEmailMutation.isPending}
                  data-testid="button-send-email"
                >
                  {sendEmailMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Inbox className="h-8 w-8 mb-2" />
            <span className="text-sm">No emails yet</span>
            <span className="text-xs">Send an email to start the conversation</span>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {visibleEmails.map((email) => (
              <EmailMessage 
                key={email.id} 
                email={email}
                isExpanded={expandedEmailId === email.id}
                onToggle={() => setExpandedEmailId(expandedEmailId === email.id ? null : email.id)}
              />
            ))}
            {hiddenCount > 0 && !showAllEmails && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full py-2 text-xs text-muted-foreground"
                onClick={() => setShowAllEmails(true)}
                data-testid="button-show-more-emails"
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {hiddenCount} more email{hiddenCount > 1 ? 's' : ''}
              </Button>
            )}
            {showAllEmails && emails.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full py-2 text-xs text-muted-foreground"
                onClick={() => setShowAllEmails(false)}
                data-testid="button-show-less-emails"
              >
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
