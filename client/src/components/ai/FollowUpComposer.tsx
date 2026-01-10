import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Loader2, Sparkles, Copy, Send, Check } from "lucide-react";

interface FollowUpMessage {
  message: string;
  subject?: string;
}

interface FollowUpComposerProps {
  clientName: string;
  clientId?: string;
  jobId?: string;
  lastService?: string;
  context?: "job_completed" | "quote_sent" | "new_lead" | "no_response";
  onSend?: (message: string) => void;
}

export function FollowUpComposer({
  clientName,
  context = "job_completed",
  lastService,
  onSend,
}: FollowUpComposerProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "casual">("friendly");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/follow-up", {
        clientName,
        context,
        lastService,
        tone,
      });
      return response as unknown as FollowUpMessage;
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

  const handleSend = () => {
    if (message) {
      onSend?.(message);
      toast({ title: "Message sent!" });
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
          <MessageSquare className="h-4 w-4 text-primary" />
          Follow-Up Message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">For: <span className="font-medium text-foreground">{clientName}</span></span>
          <span className="text-xs text-muted-foreground">{contextLabels[context]}</span>
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

        {message && (
          <>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              placeholder="Your follow-up message..."
              data-testid="textarea-followup-message"
            />

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
              <Button onClick={handleSend} className="flex-1" data-testid="button-send-followup">
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
