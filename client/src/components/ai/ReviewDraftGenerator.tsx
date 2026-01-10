import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Star, Loader2, Sparkles, Copy, Send, Check } from "lucide-react";

interface ReviewDraft {
  review: string;
  rating: number;
}

interface ReviewDraftGeneratorProps {
  clientName: string;
  jobName: string;
  onSend?: (message: string) => void;
}

export function ReviewDraftGenerator({ clientName, jobName, onSend }: ReviewDraftGeneratorProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<"enthusiastic" | "professional" | "grateful">("professional");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/review-draft", {
        clientName,
        jobName,
        tone,
      });
      return response as unknown as ReviewDraft;
    },
    onSuccess: (data) => {
      setMessage(data.review);
      toast({ title: "Review request drafted!" });
    },
    onError: () => {
      toast({ title: "Failed to generate draft", variant: "destructive" });
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
      toast({ title: "Review request sent!" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          Review Request
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-2 rounded-lg bg-muted/50 text-sm">
          <p><span className="text-muted-foreground">Client:</span> {clientName}</p>
          <p><span className="text-muted-foreground">Job:</span> {jobName}</p>
        </div>

        <div className="space-y-2">
          <Label>Tone</Label>
          <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
            <SelectTrigger data-testid="select-review-tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="grateful">Grateful</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          variant="outline"
          className="w-full"
          data-testid="button-generate-review"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Generate Review Request
        </Button>

        {message && (
          <>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-review-message"
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1"
                data-testid="button-copy-review"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button onClick={handleSend} className="flex-1" data-testid="button-send-review">
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
