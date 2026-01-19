import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, Loader2, Sparkles, RefreshCw, Copy, Check, Phone } from "lucide-react";
import { useSendText } from "@/hooks/use-send-text";

interface LeadTextComposerProps {
  leadId: string;
  clientPhone: string | null;
  clientName: string;
  serviceType?: string;
  description?: string;
}

const replyScenarios = [
  { id: "quote", label: "Quote" },
  { id: "availability", label: "Availability" },
  { id: "followup", label: "Follow-up" },
  { id: "details", label: "Ask details" },
];

export function LeadTextComposer({ leadId, clientPhone, clientName, serviceType, description }: LeadTextComposerProps) {
  const { toast } = useToast();
  const { sendText } = useSendText();
  const [showCompose, setShowCompose] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setMessage(data.reply);
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

  // Track respond tap for intent detection
  const trackRespondTap = async () => {
    try {
      await apiRequest("POST", `/api/leads/${leadId}/respond-tap`);
    } catch (err) {
      console.debug("[RespondTap] Failed to track:", err);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast({ title: "Message copied!" });
    setTimeout(() => setCopied(false), 2000);
    trackRespondTap();
  };

  const handleSendText = () => {
    if (!message.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }
    if (clientPhone) {
      sendText({ phoneNumber: clientPhone, message });
      trackRespondTap();
    } else {
      toast({ 
        title: "No phone number", 
        description: "Add a phone number to send texts",
        variant: "destructive" 
      });
    }
  };

  if (!clientPhone) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Phone className="h-5 w-5" />
            <span className="text-sm">No phone number for this lead</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm" data-testid="lead-text-section">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Text Message
          </CardTitle>
          {!showCompose && (
            <Button 
              size="sm" 
              onClick={() => setShowCompose(true)}
              data-testid="button-compose-text"
            >
              <Send className="h-4 w-4 mr-2" />
              Compose
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCompose && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg" data-testid="text-compose-form">
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <div className="text-sm font-medium">{clientName} ({clientPhone})</div>
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
                    data-testid={`button-text-ai-scenario-${scenario.id}`}
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
                    data-testid="button-regenerate-text-reply"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${generateReplyMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="text-message">Message</Label>
              <Textarea
                id="text-message"
                placeholder="Write your message or use AI Reply Composer above..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                data-testid="input-text-message"
              />
            </div>
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowCompose(false);
                  setMessage("");
                  setSelectedScenario(null);
                }}
                data-testid="button-cancel-text"
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                {message && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    data-testid="button-copy-text"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy
                  </Button>
                )}
                <Button 
                  size="sm"
                  onClick={handleSendText}
                  data-testid="button-send-text"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Text
                </Button>
              </div>
            </div>
          </div>
        )}

        {!showCompose && (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2" />
            <span className="text-sm">Compose a text message</span>
            <span className="text-xs">Use AI to help craft your message</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
