import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Loader2, 
  Copy, 
  Check, 
  Sparkles,
  MessageCircle,
  Phone,
  RefreshCw
} from "lucide-react";
import type { Lead } from "@shared/schema";
import { useSendText } from "@/hooks/use-send-text";

interface ReplyComposerProps {
  lead: Lead;
}

const replyScenarios = [
  { id: "quote", label: "Quote", emoji: "💰" },
  { id: "availability", label: "Availability", emoji: "📅" },
  { id: "followup", label: "Follow-up", emoji: "🔔" },
  { id: "details", label: "Ask details", emoji: "💬" },
];

export function ReplyComposer({ lead }: ReplyComposerProps) {
  const { toast } = useToast();
  const { sendText } = useSendText();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [generatedReply, setGeneratedReply] = useState("");
  const [editedReply, setEditedReply] = useState("");
  const [copied, setCopied] = useState(false);

  const generateReplyMutation = useMutation({
    mutationFn: async (scenario: string) => {
      const response = await apiRequest("POST", "/api/ai/generate-negotiation-reply", {
        leadId: lead.id,
        scenario,
        clientName: lead.clientName,
        serviceType: lead.serviceType,
        description: lead.description,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedReply(data.reply);
      setEditedReply(data.reply);
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
    setGeneratedReply("");
    setEditedReply("");
    generateReplyMutation.mutate(scenario);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedReply);
    setCopied(true);
    toast({ title: "Message copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendText = () => {
    if (lead.clientPhone) {
      sendText({ phoneNumber: lead.clientPhone, message: editedReply });
    } else {
      toast({ 
        title: "No phone number", 
        description: "Add a phone number to send texts",
        variant: "destructive" 
      });
    }
  };

  const handleRegenerate = () => {
    if (selectedScenario) {
      generateReplyMutation.mutate(selectedScenario);
    }
  };

  return (
    <Card data-testid="card-reply-composer">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-5 w-5" />
          Reply Composer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Generate a quick reply for your negotiation with {lead.clientName}
        </p>

        <div className="flex flex-wrap gap-2">
          {replyScenarios.map((scenario) => (
            <Button
              key={scenario.id}
              type="button"
              variant={selectedScenario === scenario.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleScenarioSelect(scenario.id)}
              disabled={generateReplyMutation.isPending}
              data-testid={`button-scenario-${scenario.id}`}
            >
              <span className="mr-1">{scenario.emoji}</span>
              {scenario.label}
            </Button>
          ))}
        </div>

        {generateReplyMutation.isPending && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generating reply...</span>
          </div>
        )}

        {generatedReply && !generateReplyMutation.isPending && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                data-testid="button-regenerate"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate
              </Button>
            </div>

            <Textarea
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
              className="min-h-[120px] text-base"
              placeholder="Edit your reply..."
              data-testid="textarea-reply"
            />

            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={handleCopy}
                data-testid="button-copy-reply"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>

              {lead.clientPhone && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleSendText}
                  data-testid="button-send-text"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send Text
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
